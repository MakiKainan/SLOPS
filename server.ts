import express from "express";
import http from "http";
import path from "path";
import { spawn, ChildProcess } from "child_process";

const app = express();
const PORT = 3000;
const PYTHON_PORT = 8765;
const API_PATHS = ["/fonts", "/font-file", "/presets", "/render"];

let pyProcess: ChildProcess | null = null;

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

startPythonServer();

process.on("exit", () => {
  if (pyProcess) pyProcess.kill();
});
process.on("SIGINT", () => {
  if (pyProcess) pyProcess.kill();
  process.exit();
});
process.on("SIGTERM", () => {
  if (pyProcess) pyProcess.kill();
  process.exit();
});

// Proxy the API routes to 127.0.0.1:PYTHON_PORT
app.use(API_PATHS, (req, res) => {
  const options = {
    hostname: "127.0.0.1",
    port: PYTHON_PORT,
    path: req.originalUrl,
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
});

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
}

start();
