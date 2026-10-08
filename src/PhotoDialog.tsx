import { useEffect, useRef, useState } from "react";
import { RefreshCw, Smartphone, X } from "lucide-react";
import QRCode from "qrcode";
import { createPhotoSession, getPhotoSession, getPublicUrl } from "./api";

const POLL_MS = 1500;

type View =
  | { kind: "loading" }
  | { kind: "offline"; detail: string }
  | { kind: "qr"; qr: string; url: string; expiresAt: number };

/** One-time QR for a customer's phone; mounted only while open, calls onPhoto when their upload lands. */
export default function PhotoDialog({ onPhoto, onClose }: { onPhoto: (id: string) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<View>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const done = useRef({ onPhoto, onClose });
  done.current = { onPhoto, onClose };

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setView({ kind: "loading" });
    (async () => {
      try {
        const base = await getPublicUrl(ctrl.signal);
        if (!base) return setView({ kind: "offline", detail: "The internet tunnel isn't running, so phones can't reach the booth." });
        const { token, expires_in } = await createPhotoSession();
        const url = `${base}/u/${token}`;
        const qr = await QRCode.toDataURL(url, { margin: 1, width: 560, color: { dark: "#173210", light: "#ffffff" } });
        if (ctrl.signal.aborted) return;
        setView({ kind: "qr", qr, url, expiresAt: Date.now() + expires_in * 1000 });
        const poll = async () => {
          try {
            const s = await getPhotoSession(token, ctrl.signal);
            if (s.status === "ready") return done.current.onPhoto(s.photo);
            if (s.status === "expired") return setAttempt((n) => n + 1); // fresh QR
          } catch {
            if (ctrl.signal.aborted) return;
          }
          timer = setTimeout(poll, POLL_MS);
        };
        timer = setTimeout(poll, POLL_MS);
      } catch (e) {
        if (!ctrl.signal.aborted) setView({ kind: "offline", detail: (e as Error).message });
      }
    })();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [attempt]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const left = view.kind === "qr" ? Math.max(0, Math.round((view.expiresAt - now) / 1000)) : 0;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="photo-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92dvh] w-[min(94vw,520px)] overflow-auto rounded-3xl bg-paper p-6 text-ink shadow-xl backdrop:bg-black/50"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="photo-dialog-title" className="text-xl font-semibold">Add your photo</h2>
          <p className="text-[15px] font-medium text-ink-soft">Scan with your phone camera, pick a photo, adjust the crop, then tap Send.</p>
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full bg-tint hover:bg-tint-2">
          <X aria-hidden />
        </button>
      </div>

      {view.kind === "loading" && <div className="mx-auto aspect-square w-full max-w-[320px] animate-pulse rounded-2xl bg-tint" />}

      {view.kind === "qr" && (
        <div className="flex flex-col items-center gap-3">
          <img src={view.qr} alt="QR code to upload a photo from your phone" className="aspect-square w-full max-w-[320px] rounded-2xl" />
          <p className="flex items-center gap-2 font-medium">
            <Smartphone className="size-5 animate-pulse" aria-hidden />
            Waiting for your photo…
          </p>
          <p className="text-sm text-ink-soft tabular-nums">
            Code expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}, then a new one appears.
          </p>
        </div>
      )}

      {view.kind === "offline" && (
        <div className="flex flex-col gap-3">
          <p role="alert" className="rounded-2xl bg-tomato-bg px-4 py-3 font-medium text-tomato-ink">
            Phone upload is offline. {view.detail}
          </p>
          <p className="text-sm text-ink-soft">Staff: install cloudflared (or set PUBLIC_URL) and restart the booth server, then try again.</p>
          <button type="button" onClick={() => setAttempt((n) => n + 1)} className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink font-semibold text-paper hover:bg-ink-deep">
            <RefreshCw className="size-4" aria-hidden />
            Try again
          </button>
        </div>
      )}
    </dialog>
  );
}
