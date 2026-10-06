import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const app = express();
const PORT = 3000;
const PYTHON_PORT = 8765;
// The only port the internet tunnel reaches: it serves the phone upload page and nothing else.
const PUBLIC_PORT = 3001;
const API_PATHS = ["/fonts", "/font-file", "/presets", "/render", "/photo-session", "/photo"];

let pyProcess: ChildProcess | null = null;
let tunnelProcess: ChildProcess | null = null;
let publicUrl: string | null = process.env.PUBLIC_URL?.replace(/\/+$/, "") || null;

function startPythonServer() {
  const env = { ...process.env, PORT: String(PYTHON_PORT) };
  pyProcess = spawn(process.platform === "win32" ? "python" : "python3", ["server.py", "--no-open"], {
    stdio: "inherit",
    env,
  });

  pyProcess.on("exit", (code) => {
    console.log(`Python server exited with code ${code}`);
    if (code !== 0) {
      setTimeout(startPythonServer, 2000);
    }
  });
}

/** Cloudflare quick tunnel to the public port; skipped when PUBLIC_URL points at a tunnel you run yourself. */
function startTunnel() {
  if (process.env.PUBLIC_URL) return;
  tunnelProcess = spawn("cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${PUBLIC_PORT}`]);
  const watch = (chunk: Buffer) => {
    const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString());
    if (m && m[0] !== publicUrl) {
      publicUrl = m[0];
      console.log(`Phone uploads -> ${publicUrl}`);
    }
  };
  tunnelProcess.stdout?.on("data", watch);
  tunnelProcess.stderr?.on("data", watch);
  tunnelProcess.on("error", () => {
    tunnelProcess = null;
    console.warn("cloudflared not found: phone uploads are off. Install it (winget install --id Cloudflare.cloudflared) or set PUBLIC_URL.");
  });
  tunnelProcess.on("exit", (code) => {
    if (!tunnelProcess) return;
    publicUrl = null;
    console.log(`cloudflared exited with code ${code}, restarting...`);
    setTimeout(startTunnel, 3000);
  });
}

startPythonServer();
startTunnel();

const stopChildren = () => {
  if (pyProcess) pyProcess.kill();
  if (tunnelProcess) {
    const t = tunnelProcess;
    tunnelProcess = null;
    t.kill();
  }
};
process.on("exit", stopChildren);
process.on("SIGINT", () => {
  stopChildren();
  process.exit();
});
process.on("SIGTERM", () => {
  stopChildren();
  process.exit();
});

/** Forward a request to the Python engine at `target` (defaults to the original URL). */
function proxyToPython(req: express.Request, res: express.Response, target = req.originalUrl) {
  const options = {
    hostname: "127.0.0.1",
    port: PYTHON_PORT,
    path: target,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.warn("Python server not ready yet, retrying...", err.message);
    setTimeout(() => {
      const retryReq = http.request(options, (pRes) => {
        res.writeHead(pRes.statusCode || 500, pRes.headers);
        pRes.pipe(res, { end: true });
      });
      retryReq.on("error", () => {
        res.status(502).json({ error: "Backend server starting up, please refresh in 2 seconds", code: "starting_up" });
      });
      req.pipe(retryReq, { end: true });
    }, 400);
  });

  req.pipe(proxyReq, { end: true });
}

// Proxy the API routes to 127.0.0.1:PYTHON_PORT
app.use(API_PATHS, (req, res) => proxyToPython(req, res));
app.get("/public-url", (_req, res) => res.json({ url: publicUrl }));

const publicApp = express();
publicApp.disable("x-powered-by");
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
publicApp.get("/u/:token", (req, res) => {
  if (!TOKEN.test(req.params.token)) return res.status(404).end();
  res.set("Cache-Control", "no-store").sendFile(path.resolve("upload.html"));
});
publicApp.post("/u/:token", (req, res) => {
  if (!TOKEN.test(req.params.token)) return res.status(404).end();
  proxyToPython(req, res, `/upload/${req.params.token}`);
});
publicApp.use((_req, res) => res.status(404).send("Not found"));

async function start() {
  // `npm start` runs the esbuild bundle (dist/server.cjs); `npm run dev` runs this file via tsx.
  if (process.env.NODE_ENV === "production" || process.argv[1]?.endsWith(".cjs")) {
    const dist = path.resolve("dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Booth on http://localhost:${PORT} (API -> Python 127.0.0.1:${PYTHON_PORT})`);
  });
  publicApp.listen(PUBLIC_PORT, "127.0.0.1", () => {
    console.log(`Upload page on http://127.0.0.1:${PUBLIC_PORT}/u/<token> (tunnel target)`);
  });
}

start();
