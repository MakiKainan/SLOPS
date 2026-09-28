import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CircleCheck, Info, TriangleAlert } from "lucide-react";

export type Tone = "ready" | "hint" | "sample" | "warn";

export interface Status {
  tone: Tone;
  title?: string;
  body: ReactNode;
}

export interface PreviewError {
  headline: string;
  detail: string;
  fix: string;
  onRetry?: () => void;
}

const TONE_CLASS: Record<Tone, string> = {
  ready: "bg-paper text-ink",
  hint: "bg-paper text-ink",
  sample: "bg-tint text-ink",
  warn: "bg-butter text-butter-ink",
};

const TONE_ICON: Record<Tone, ReactNode> = {
  ready: <CircleCheck className="size-5 shrink-0" aria-hidden />,
  hint: <Info className="size-5 shrink-0" aria-hidden />,
  sample: <Info className="size-5 shrink-0" aria-hidden />,
  warn: <TriangleAlert className="size-5 shrink-0" aria-hidden />,
};

interface Props {
  src?: string;
  alt: string;
  sample: boolean;
  busy: boolean;
  error: PreviewError | null;
  status: Status | null;
}

export default function Preview({ src, alt, sample, busy, error, status }: Props) {
  // Keep the previous sticker on screen until the next one has decoded, so it never flashes blank.
  const [shown, setShown] = useState(src);
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.src = src;
    img.decode().catch(() => {}).then(() => !cancelled && setShown(src));
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <section aria-label="Sticker preview" aria-busy={busy} className="flex flex-col gap-4">
      <div className={`mat relative grid place-items-center overflow-hidden rounded-[2rem] ${error ? "p-4" : "aspect-square"}`}>
        {error ? (
          <div role="alert" className="flex w-full min-w-0 flex-col items-center justify-center gap-3 rounded-3xl border-[3px] border-dashed border-tomato bg-tomato-bg p-4 text-center">
            <AlertCircle className="size-10 shrink-0 text-tomato-ink" aria-hidden />
            <h2 className="text-xl font-semibold text-tomato-ink">{error.headline}</h2>
            {error.detail && <p className="w-full font-medium [overflow-wrap:anywhere]">“{error.detail}”</p>}
            <p className="font-medium text-ink-soft">{error.fix}</p>
            {error.onRetry && (
              <button type="button" onClick={error.onRetry} className="mt-2 h-11 rounded-full bg-tint px-6 font-semibold hover:bg-tint-2">
                Try again
              </button>
            )}
          </div>
        ) : (
          shown && (
            <div className="relative w-[78%]">
              <img
                src={shown}
                alt={alt}
                className={`block w-full drop-shadow-[0_8px_0_rgba(14,32,9,0.28)] transition-opacity duration-200 ${busy ? "opacity-70" : ""}`}
              />
              {sample && (
                <span className="pointer-events-none absolute -top-3 -left-3 -rotate-6 rounded-md bg-butter px-3 py-1.5 text-sm font-bold tracking-[0.15em] text-butter-ink shadow-[0_2px_0_rgba(14,32,9,0.15)]">
                  SAMPLE
                </span>
              )}
            </div>
          )
        )}
      </div>

      {status && (
        <p role="status" className={`flex min-h-14 items-center gap-3 rounded-2xl px-5 py-3 text-[15px] font-medium ${TONE_CLASS[status.tone]}`}>
          {TONE_ICON[status.tone]}
          <span>
            {status.title && <b className="font-semibold">{status.title} — </b>}
            {status.body}
          </span>
        </p>
      )}
    </section>
  );
}
