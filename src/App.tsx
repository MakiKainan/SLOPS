import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Check, Circle, Download, Hexagon, RotateCcw, Square, Star } from "lucide-react";
import { getJSON, mapError, postRender, b64ToBlobUrl, type FontFamily, type Preset, type RenderPayload, type Shape, type Size, type Style } from "./api";
import { useRender } from "./useRender";
import { playOptionKnock } from "./optionSound";
import FontPicker from "./FontPicker";
import Preview, { type PreviewError, type Status } from "./Preview";
import Cat from "./Cat";
import Background from "./Background";
import { PrintSheet, SheetPicker, SIZES, fit, type Slot } from "./Sheet";

const SAMPLE = "Your Name";
const CAP = 24;
const STYLE_LABELS: Record<Style, string> = { regular: "Regular", bold: "Bold", italic: "Italic", "bold-italic": "Bold italic", underline: "Underline" };

interface Design {
  text: string;
  family: string | null;
  mixFonts: boolean;
  text2: string;
  family2: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  preset: number;
  shape: Shape;
  guide: boolean;
  size: Size;
}

type SheetSlot = Slot & { design: Design };

function isNearWhite(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const l = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (l + 0.05) <= 1.25; // contrast against white
}

function slug(text: string) {
  return (
    text
      .normalize("NFKD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "sticker"
  );
}

export default function App() {
  const [fonts, setFonts] = useState<FontFamily[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [d, setD] = useState<Design>({ text: "", mixFonts: false, text2: "", family2: null, family: null, bold: false, italic: false, underline: false, preset: 0, shape: "square", guide: false, size: "m" });
  const [fontPart, setFontPart] = useState<1 | 2>(1);
  const [sheet, setSheet] = useState<(SheetSlot | null)[]>([null, null, null, null]);
  const [active, setActive] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<PreviewError | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);

  const [bootTry, setBootTry] = useState(0);
  useEffect(() => {
    const ctrl = new AbortController();
    setBootError(null);
    Promise.all([getJSON<FontFamily[]>("/fonts", ctrl.signal), getJSON<Preset[]>("/presets", ctrl.signal)])
      .then(([f, p]) => {
        setFonts(f);
        setPresets(p);
        if (f.length) setD((prev) => (prev.family ? prev : { ...prev, family: f[0].family }));
      })
      .catch((e) => e.name !== "AbortError" && setBootError(e.message));
    return () => ctrl.abort();
  }, [bootTry]);

  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refreshFonts = async () => {
      try {
        const next = await getJSON<FontFamily[]>("/fonts", ctrl.signal);
        if (ctrl.signal.aborted) return;
        setFonts((prev) => JSON.stringify(prev) === JSON.stringify(next) ? prev : next);
        setD((prev) => {
          const family = next.find((f) => f.family === prev.family) ?? next[0];
          if (!family) return { ...prev, family: null };
          return prev.family === family.family ? prev : { ...prev, family: family.family };
        });
      } catch {
        // Keep the current picker during temporary connection failures.
      } finally {
        if (!ctrl.signal.aborted) timer = setTimeout(refreshFonts, 5000);
      }
    };
    timer = setTimeout(refreshFonts, 5000);
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.undo ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const update = (patch: Partial<Design>) => {
    setDownloadError(null);
    setD((prev) => ({ ...prev, ...patch }));
  };

  const cleanText = d.text.replace(/\s+/g, " ").trim();
  const cleanText2 = d.text2.replace(/\s+/g, " ").trim();
  const isSample = !cleanText || (d.mixFonts && !cleanText2);
  const preset = presets[d.preset];
  const famObj = fonts.find((f) => f.family === d.family);

  const payload = useMemo<RenderPayload | null>(
    () =>
      d.family && preset
        ? { text: cleanText || (d.mixFonts ? "Your" : SAMPLE), ...(d.mixFonts ? { text2: cleanText2 || "Name", family2: d.family2 || d.family } : {}), family: d.family, style: d.bold ? (d.italic ? "bold-italic" : "bold") : (d.italic ? "italic" : "regular"), underline: d.underline, foreground: preset.foreground, background: preset.background, gradient: preset.gradient, shape: d.shape, guide: d.guide, size: 512 }
        : null,
    [cleanText, cleanText2, d.mixFonts, d.family2, d.family, d.bold, d.italic, d.underline, d.shape, d.guide, preset],
  );
  const { result, busy, retry } = useRender(payload);

  const selectFamily = (family: string) => update(d.mixFonts && fontPart === 2 ? { family2: family } : { family });

  const snapshot = useRef<Design | null>(null);
  const startOver = () => {
    snapshot.current = d;
    update({ text: "", mixFonts: false, text2: "", family2: null, family: fonts[0]?.family ?? null, bold: false, italic: false, underline: false, preset: 0, shape: "square", guide: false, size: "m" });
    setToast({ msg: "Started over.", undo: () => snapshot.current && update(snapshot.current) });
  };

  /** 1024 px blob URL, or null after showing the error in the preview. */
  const renderFull = async (p: RenderPayload, onRetry: () => void) => {
    const r = await postRender(p, 30000);
    if (r.ok) return b64ToBlobUrl(r.png_base64);
    const info = mapError(r.code, r.message);
    setDownloadError({ headline: "Couldn't make the 1024 px file", detail: r.message, fix: info.fix, onRetry: info.retry ? onRetry : undefined });
    return null;
  };

  const download = async () => {
    if (!payload || isSample || !result?.ok) return;
    const p = { ...payload, size: 1024 as const };
    setDownloading(true);
    const url = await renderFull(p, download);
    setDownloading(false);
    if (!url) return;
    const filename = `slops-${slug([p.text, p.text2].filter(Boolean).join(" "))}-${p.shape}.png`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setToast({ msg: `Saved ${filename}` });
  };

  const confirm = async () => {
    if (!payload || !canDownload) return;
    const design = d, at = active, slotAlt = alt; // the user may keep editing while this renders
    setConfirming(true);
    const png = await renderFull({ ...payload, size: 1024 }, confirm);
    setConfirming(false);
    if (!png) return;
    const next = sheet.map((s, i) => (i === at ? { design, png, alt: slotAlt } : s));
    if (sheet[at]) URL.revokeObjectURL(sheet[at].png);
    setSheet(next);
    const empty = [1, 2, 3].map((k) => (at + k) % 4).find((i) => !next[i]);
    if (empty === undefined) return setToast({ msg: "Sheet full. Ready to print!" });
    setActive(empty);
    update({ text: "", text2: "" }); // keep font, color, shape and size for the next quarter
    setToast({ msg: `Quarter ${at + 1} saved. Now designing quarter ${empty + 1}.` });
  };

  const pickQuarter = (i: number) => {
    setActive(i);
    const s = sheet[i];
    if (s) update(s.design);
  };

  const clearQuarter = (i: number) => {
    URL.revokeObjectURL(sheet[i]!.png);
    setSheet((prev) => prev.map((s, k) => (k === i ? null : s)));
  };

  // Preview error / status / download-button copy
  let error: PreviewError | null = downloadError;
  let status: Status | null = null;
  if (bootError) {
    error = { headline: "Can't reach the sticker engine", detail: bootError, fix: "Is the booth server running?", onRetry: () => setBootTry((n) => n + 1) };
  } else if (!error && result && !result.ok) {
    const info = mapError(result.code, result.message);
    error = { headline: info.headline, detail: result.message, fix: info.fix, onRetry: info.retry ? retry : undefined };
  } else if (!error && result?.ok) {
    if (isSample) status = { tone: "sample", body: "Type your text in step 1. This is just a sample." };
    else if (result.warning)
      status = { tone: "warn", title: /contrast/i.test(result.warning) ? "Low contrast" : "Heads up", body: `still OK to download. ${result.warning}` };
    else if (preset && isNearWhite(preset.background) && !d.guide)
      status = { tone: "hint", title: "Light background", body: "turn on Cut line so the edge shows when cutting." };
    else status = { tone: "ready", title: "Ready", body: "this is exactly what you'll download, at 1024 px." };
  }

  const canDownload = !!result?.ok && !isSample && !error && !downloading;
  const dlLabel = downloading
    ? "Making your PNG…"
    : !result
      ? "Loading…"
      : error
        ? "Fix the problem above"
        : isSample
          ? (d.mixFonts ? "Fill both lines to download" : "Type your text to download")
          : "Download sticker";

  const alt = payload
    ? `${isSample ? "Sample sticker" : "Sticker"} preview: “${[payload.text, payload.text2].filter(Boolean).join(" / ")}” in ${payload.family}${payload.family2 ? ` and ${payload.family2}` : ""} ${STYLE_LABELS[payload.style]}${payload.underline ? ", underlined" : ""}, ${preset?.name ?? ""} colors, ${payload.shape}${payload.guide ? ", with cut line" : ""}`
    : "";

  return (
    <>
      <Background />
      <div className="relative mx-auto flex min-h-screen max-w-[1360px] flex-col gap-8 px-4 py-6 sm:px-6 lg:gap-10 lg:px-10 lg:py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <h1>
            <span className="sr-only">SLOPS sticker booth</span>
            <Logo />
          </h1>
          <div className="ml-auto flex max-w-full items-center gap-4">
            <p className="min-w-0 text-lg font-medium text-ink/80">Make a die-cut sticker in 7 steps, 4 per A4 sheet.</p>
            <div className="w-28 shrink-0 sm:w-40">
              <Cat />
            </div>
          </div>
        </header>

        <main
          className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10"
          onClick={(event) => {
            const option = (event.target as Element).closest('input[type="radio"], input[type="checkbox"], button[aria-pressed]');
            if (option && !option.matches(':disabled, [aria-disabled="true"]')) void playOptionKnock();
          }}
        >
          {/* On mobile the aside dissolves (display: contents) so preview and actions can be ordered around the steps. */}
          <aside className="contents lg:sticky lg:top-10 lg:flex lg:flex-col lg:gap-5 lg:self-start">
            <div className="order-1 -mx-4 bg-sage px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:order-none lg:m-0 lg:p-0">
              <div className="mx-auto w-full max-w-[200px] sm:max-w-[320px] lg:max-w-[560px]">
                <Preview src={result?.ok ? result.blobUrl : undefined} alt={alt} sample={isSample} busy={busy} error={error} status={status} />
              </div>
            </div>

            <div className="order-3 lg:order-none">
              <SheetPicker slots={sheet} active={active} onPick={pickQuarter} onClear={clearQuarter} />
            </div>

            <div className="sticky bottom-0 z-10 order-3 -mx-4 bg-sage px-4 pt-2 pb-4 sm:-mx-6 sm:px-6 lg:static lg:order-none lg:m-0 lg:p-0">
              <div className="flex gap-3 rounded-3xl bg-paper p-4">
                <button
                  type="button"
                  onClick={download}
                  aria-disabled={!canDownload}
                  disabled={!canDownload}
                  className="flex h-16 flex-1 items-center justify-center gap-3 rounded-full bg-ink text-paper hover:bg-ink-deep active:translate-y-0.5 disabled:bg-tint disabled:text-ink-soft disabled:active:translate-y-0"
                >
                  <Download className="size-5" aria-hidden />
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-lg font-semibold">{dlLabel}</span>
                    <span className="text-sm font-medium opacity-80">PNG · 1024 × 1024 px</span>
                  </span>
                </button>
                <button type="button" onClick={startOver} className="flex h-16 items-center gap-2 rounded-full bg-tint px-6 font-semibold hover:bg-tint-2">
                  <RotateCcw className="size-4" aria-hidden />
                  <span className="max-[380px]:sr-only">Start over</span>
                </button>
              </div>
            </div>
          </aside>

          <div className="order-2 flex flex-col gap-6 lg:order-none">
            <Step n={1} i={0} title={<label htmlFor="text">{d.mixFonts ? "First line" : "Your text"}</label>} meta={`${d.text.length + (d.mixFonts && d.text2 ? d.text2.length + 1 : 0)}/${CAP}`}>
              <input
                id="text"
                type="text"
                maxLength={d.mixFonts ? Math.max(0, CAP - d.text2.length - 1) : CAP}
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                placeholder={d.mixFonts ? "First line, e.g. Sweet" : "Type a name or word"}
                aria-label={d.mixFonts ? "First line" : "Your text"}
                value={d.text}
                onChange={(e) => update({ text: e.target.value })}
                className="h-14 w-full rounded-2xl border-2 border-line bg-tint px-5 text-[22px] font-medium placeholder:text-ink-soft/70 focus:border-ink focus:outline-none"
              />
              <button type="button" aria-pressed={d.mixFonts} onClick={() => {
                if (d.mixFonts) {
                  update({ mixFonts: false, text: [d.text, d.text2].filter(Boolean).join(" ") });
                  setFontPart(1);
                } else {
                  const words = d.text.trim().split(/\s+/);
                  const split = Math.ceil(words.length / 2);
                  update({ mixFonts: true, text: words.slice(0, split).join(" "), text2: words.slice(split).join(" "), family2: d.family2 || d.family });
                }
              }} className="min-h-11 self-start rounded-full bg-tint px-5 font-medium hover:bg-tint-2 aria-pressed:bg-ink aria-pressed:text-paper">
                {d.mixFonts ? "✓ Mixing two fonts" : "+ Mix two fonts"}
              </button>
              {d.mixFonts && <>
                <label htmlFor="text2" className="font-medium">Second line</label>
                <input id="text2" value={d.text2} maxLength={Math.max(0, CAP - d.text.length - 1)} onChange={(e) => update({ text2: e.target.value })} placeholder="Second line, e.g. Dreams" className="h-14 w-full rounded-2xl border-2 border-line bg-tint px-5 text-[22px] focus:border-ink focus:outline-none" />
                <p className="text-sm text-ink-soft">Two lines, two fonts. Choose a line below, then pick its font. Turn this off to join your text again.</p>
              </>}
            </Step>

            <Step n={2} i={1} title="Font" meta={d.mixFonts && fontPart === 2 ? d.family2 || d.family || undefined : famObj?.family}>
              {d.mixFonts && <div role="group" aria-label="Choose which line to style" className="flex gap-2">
                {([1, 2] as const).map((part) => <button key={part} type="button" aria-pressed={fontPart === part} onClick={() => setFontPart(part)} className="min-h-14 min-w-0 flex-1 rounded-2xl bg-tint px-3 py-2 text-left hover:bg-tint-2 aria-pressed:bg-ink aria-pressed:text-paper">
                  <span className="block text-sm font-semibold">{part === 1 ? "First line" : "Second line"}</span>
                  <span className="block truncate">{(part === 1 ? d.text : d.text2) || (part === 1 ? "Your" : "Name")}</span>
                </button>)}
              </div>}
              {fonts.length ? (
                <FontPicker fonts={fonts} value={d.mixFonts && fontPart === 2 ? d.family2 || d.family : d.family} onChange={selectFamily} specimen={d.mixFonts ? (fontPart === 2 ? cleanText2 || "Name" : cleanText || "Your") : cleanText || SAMPLE} />
              ) : (
                <div className="h-24 animate-pulse rounded-2xl bg-tint" />
              )}
            </Step>

            <Step n={3} i={2} title="Style">
              <div role="group" aria-label="Text formatting" className="flex w-full flex-wrap gap-1 rounded-2xl bg-tint p-1">
                {([
                  ["bold", "Bold", "font-bold"],
                  ["italic", "Italic", "italic"],
                  ["underline", "Underline", "underline underline-offset-4"],
                ] as const).map(([key, label, textStyle]) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={label}
                    title={label}
                    aria-pressed={d[key]}
                    onClick={() => update({ [key]: !d[key] })}
                    className="flex h-10 min-w-24 flex-1 items-center justify-center rounded-xl px-3 font-medium whitespace-nowrap text-ink hover:bg-tint-2 aria-pressed:bg-ink aria-pressed:text-paper aria-pressed:hover:bg-ink-deep"
                  >
                    <span className={textStyle}>{label}</span>
                  </button>
                ))}
              </div>
            </Step>

            <Step n={4} i={3} title="Color" meta={preset?.name}>
              <div role="radiogroup" aria-label="Color preset" className="flex flex-wrap gap-3 p-1">
                {presets.map((p, idx) => (
                  <div key={p.name}>
                    <input type="radio" name="preset" id={`preset-${idx}`} className="peer sr-only" checked={idx === d.preset} onChange={() => update({ preset: idx })} />
                    <label
                      htmlFor={`preset-${idx}`}
                      title={p.name}
                      aria-label={p.name}
                      style={{ background: p.gradient ? `linear-gradient(180deg, ${p.gradient.join(", ")})` : p.background, color: p.foreground }}
                      className="relative flex size-14 cursor-pointer items-center justify-center rounded-2xl border-2 border-line text-xl font-semibold peer-checked:ring-3 peer-checked:ring-ink peer-checked:ring-offset-3 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-6 peer-focus-visible:outline-ink [&>svg]:hidden peer-checked:[&>svg]:block"
                    >
                      Aa
                      <Check className="absolute -top-2 -right-2 size-5 rounded-full bg-ink p-0.5 text-paper" strokeWidth={3} aria-hidden />
                    </label>
                  </div>
                ))}
              </div>
            </Step>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Step n={5} i={4} title="Shape">
                <Segmented
                  name="shape"
                  value={d.shape}
                  onChange={(shape) => update({ shape })}
                  options={[
                    { value: "square" as Shape, label: <><Square className="size-4" aria-hidden /> Square</> },
                    { value: "circle" as Shape, label: <><Circle className="size-4" aria-hidden /> Circle</> },
                    { value: "hexagon" as Shape, label: <><Hexagon className="size-4" aria-hidden /> Hexagon</> },
                    { value: "star" as Shape, label: <><Star className="size-4" aria-hidden /> Star</> },
                  ]}
                />
              </Step>

              <Step n={6} i={5} title={<label htmlFor="guide">Cut line</label>} meta={d.guide ? "On" : "Off"}>
                <div className="flex h-12 items-center justify-between gap-4">
                  <span className="text-[15px] font-medium text-ink-soft">Thin outline to cut along</span>
                  <input
                    id="guide"
                    type="checkbox"
                    role="switch"
                    checked={d.guide}
                    onChange={(e) => update({ guide: e.target.checked })}
                    className="relative h-8 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-line shadow-[inset_0_0_0_2px_var(--color-ink-soft)] transition-colors after:absolute after:top-1.5 after:left-1.5 after:size-5 after:rounded-full after:bg-ink-soft after:transition-transform checked:bg-ink checked:shadow-none checked:after:translate-x-6 checked:after:bg-paper"
                  />
                </div>
              </Step>
            </div>

            <Step n={7} i={6} title="Size" meta={`${SIZES[d.size].label} · ${SIZES[d.size].mm} mm · ${fit(d.size).cols * fit(d.size).rows} per quarter`}>
              <Segmented
                name="size"
                value={d.size}
                onChange={(size) => update({ size })}
                options={(Object.keys(SIZES) as Size[]).map((s) => ({ value: s, label: <span title={SIZES[s].label}>{s.toUpperCase()}</span> }))}
              />
            </Step>

            <button
              type="button"
              onClick={confirm}
              disabled={!canDownload || confirming}
              className="flex h-16 items-center justify-center gap-3 rounded-full bg-ink text-lg font-semibold text-paper hover:bg-ink-deep active:translate-y-0.5 disabled:bg-paper/60 disabled:text-ink-soft disabled:active:translate-y-0"
            >
              {confirming ? "Saving…" : sheet[active] ? `Update quarter ${active + 1}` : `Confirm quarter ${active + 1}`}
              <ArrowRight className="size-5" aria-hidden />
            </button>
          </div>
        </main>
      </div>

      <PrintSheet slots={sheet} />

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-5 py-3 font-medium text-paper shadow-lg lg:bottom-6">
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                toast.undo!();
                setToast(null);
              }}
              className="rounded-full border-[1.5px] border-paper px-3 py-1 text-sm font-semibold"
            >
              Undo
            </button>
          )}
        </div>
      )}
    </>
  );
}

function Step({ n, i, title, meta, children }: { n: number; i: number; title: ReactNode; meta?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ animationDelay: `${0.1 + i * 0.06}s` }} className="stick-in flex flex-col gap-5 rounded-3xl bg-paper p-6 lg:p-7">
      <div className="flex items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-lg font-semibold">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sage text-base" aria-hidden>
            {n}
          </span>
          {title}
        </h2>
        {meta && <span className="truncate text-sm font-medium text-ink-soft tabular-nums">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function Segmented<T extends string>({ name, value, onChange, options }: { name: string; value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div role="radiogroup" className="flex w-full flex-wrap gap-1 rounded-2xl bg-tint p-1">
      {options.map((o) => (
        <div key={o.value} className={name === "shape" ? "min-w-24 flex-1" : "flex-1"}>
          <input type="radio" name={name} id={`${name}-${o.value}`} className="peer sr-only" checked={o.value === value} onChange={() => onChange(o.value)} />
          <label
            htmlFor={`${name}-${o.value}`}
            className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap hover:bg-tint-2 peer-checked:bg-ink peer-checked:text-paper peer-checked:hover:bg-ink-deep peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ink"
          >
            {o.label}
          </label>
        </div>
      ))}
    </div>
  );
}

function Logo() {
  return (
    <svg className="h-12 w-auto fill-paper lg:h-14" viewBox="0 0 342.7 100" aria-hidden focusable="false">
      <path fillRule="evenodd" d="M34.2 0.2C28.9 0.2 22.3 0.6 17.4 2.6C13.2 4.3 9.3 5.9 6.1 9.4C-6.3 23.1 0.7 40.2 15.3 48.8C17.5 50.1 19.2 52.3 21.5 53.6C25.5 56 35.2 63.7 35.6 68.5C36 72.4 32.3 72.9 29.5 71.8C22.3 68.8 9.6 64.9 5.6 75C3.9 79.1 3.3 83.8 5.4 87.9C10.3 97.8 20.5 99.1 30.2 100C35.4 100.5 41.8 99.9 46.5 98C49.7 96.7 52.6 95.2 55.2 92.8C62.8 85.9 65.5 72.7 60.9 63.5C57.7 57.1 52.5 51.7 47.1 46.9C43.8 43.9 31.4 33.7 31 29.8C30.7 26 35.4 25.7 38 26.7C39.7 27.4 41.3 28.4 43.1 29.1C49.9 31.8 57.9 30.9 60.9 23.4C61.9 20.9 62.3 17.3 61.3 14.7C60.5 12.9 59.9 11.3 58.9 9.6C54.5 2.2 42 0.2 34.2 0.2Z" />
      <path fillRule="evenodd" d="M84.8 0.4C80.3 0.8 75.5 2.8 73.6 7.4C71.8 12 72.4 17.3 71.9 22.3C71.1 31.4 71.4 40.9 71.4 50.1C71.4 60.4 71 71 71.9 81.2C72.4 86.2 71.9 92.2 76 96C77.6 97.4 79.2 98.1 81 98.9C83.1 99.7 89 99.6 91.5 99.6C99.2 99.6 106.7 99.4 114.2 98.7C121.4 98 125.9 92.1 125.9 85C125.9 83.4 125.9 81.8 125.3 80.3C122.3 73 117 72.9 110 72.9C106.7 72.9 101.4 74.1 100 70.5C99.4 69.1 99.7 57.6 99.7 55.2C99.7 43.9 99.4 29.2 100.4 18.3C101.4 8.2 95.8 -0.7 84.8 0.4Z" />
      <path fillRule="evenodd" d="M161.8 0.2C154.9 0.9 152 2 145.8 5C140.3 7.8 135.4 15.1 132.4 20.2C123.9 34.4 121.7 56.5 128 71.9C129 74.5 129.9 77.3 131.3 79.7C137.8 90.6 148.6 100.9 162.3 99.6C193.5 96.7 204.1 52 194.1 27.2C190.3 17.9 185.2 8.2 175.7 3.4C174.1 2.6 172.3 2.2 170.6 1.5C168.1 0.5 164.6 0 161.8 0.2ZM162.1 24.6C166 24.2 168.5 30.6 168.7 33.7C169.3 39.9 170.7 58 168.6 63.3C167.4 66.1 166.5 71.6 162.5 71.9C158.1 72.3 155.2 66.5 154.8 62.7C154.7 61.2 154.2 59.7 154.1 58.1C153.5 52.2 153.3 38.2 155.4 33.1C156.6 30 158 24.9 162.1 24.6Z" />
      <path fillRule="evenodd" d="M238.5 0.2C230 1 220.1 0.8 213.4 6.9C209.1 10.8 208.1 16.8 207.6 22.3C206.8 30.3 206.3 56.1 207 63.9C208.2 77.1 202.1 101.7 223.3 99.7C239.9 98.1 235.1 81.9 236.2 69.4C236.4 67.5 236 62.2 236.7 60.8C237.1 60 240.3 60.5 241.2 60.5C245.3 60.5 250.3 60.7 254.1 59.1C261.9 56 267.3 51.4 270.6 43.3C271.1 42 271.4 40.5 271.9 39.1C273 36.4 272.8 33 273.1 30.1C273.4 27.2 272.9 23.4 271.8 20.7C271.2 19.2 271 17.5 270.2 16C263.8 5.4 255.5 1.7 243.7 0.6C242.1 0.4 240.2 0.1 238.5 0.2ZM241.1 22.1C249.4 21.3 250 39.1 241.9 39.8C240.6 39.9 239.1 39.6 238.3 38.7C235.4 35.5 235.6 22.6 241.1 22.1Z" />
      <path fillRule="evenodd" d="M312.3 0.3C307.3 0.8 300.4 0.8 295.9 3.1C292.3 4.9 287.4 6.5 285.2 10.3C284.4 11.6 283.2 12.6 282.5 14C281.4 16.1 281 18.4 280.1 20.5C279.5 21.9 279.7 24 279.7 25.6C279.7 34.2 284.8 42.1 292.2 46.5C294.6 47.9 296.4 50.3 298.8 51.7C303.6 54.5 314.9 63.2 315.4 68.8C315.8 72.3 312.4 73 309.8 71.9C302.5 69 291.1 65.1 285.9 73.9C285.2 75.1 285 76.4 284.4 77.7C283.6 79.7 283.5 83.6 284.3 85.6C284.9 87.1 285.2 88.6 286.1 90C291.5 99.2 307.7 100.8 317.5 99.9C322.2 99.4 327 98.2 331.2 95.7C341.9 89.3 345.4 74.9 340.8 63.7C337.8 56.3 330.5 50.1 324.6 44.7C321.8 42.2 311.2 33.4 310.9 30.1C310.5 26.1 315.1 25.6 317.9 26.7C319.7 27.4 321.3 28.4 323 29.1C330.4 32.1 337.8 30.7 341 22.8C341.8 20.7 342.1 17.3 341.2 15.1C340.5 13.4 340 11.8 339.1 10.2C334.4 2.4 320.8 -0.5 312.3 0.3Z" />
    </svg>
  );
}
