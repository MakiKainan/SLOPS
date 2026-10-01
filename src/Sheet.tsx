import { useRef, useState } from "react";
import { printWhenReady } from "./printSheet";
import { Check, Printer, X } from "lucide-react";
import type { Size } from "./api";

export const SIZES: Record<Size, { label: string; mm: number }> = {
  s: { label: "Small", mm: 25 },
  m: { label: "Medium", mm: 45 },
  l: { label: "Large", mm: 65 },
  xl: { label: "Extra large", mm: 95 },
};

// One quarter of A4, and the minimum gap kept around every sticker (all mm).
const QW = 105;
const QH = 148.5;
const GAP = 5;

/** How many copies of a sticker tile one quarter. */
export function fit(size: Size) {
  const mm = SIZES[size].mm;
  return { cols: Math.floor((QW - GAP) / (mm + GAP)), rows: Math.floor((QH - GAP) / (mm + GAP)) };
}

export interface Slot {
  png: string;
  alt: string;
  design: { size: Size };
}

function Tiles({ slot, print }: { slot: Slot; print?: boolean }) {
  const { mm } = SIZES[slot.design.size];
  const { cols, rows } = fit(slot.design.size);
  // Real millimetres on paper; percentages of the quarter on screen (same proportions).
  const w = print ? `${mm}mm` : `${(mm / QW) * 100}%`;
  const h = print ? `${mm}mm` : `${(mm / QH) * 100}%`;
  return (
    <div className="grid size-full place-content-evenly" style={{ gridTemplateColumns: `repeat(${cols}, ${w})`, gridTemplateRows: `repeat(${rows}, ${h})` }}>
      {Array.from({ length: cols * rows }, (_, k) => (
        <img key={k} src={slot.png} alt={k ? "" : slot.alt} className="size-full object-contain" />
      ))}
    </div>
  );
}

interface PickerProps {
  slots: (Slot | null)[];
  active: number;
  onPick: (i: number) => void;
  onClear: (i: number) => void;
}

export function SheetPicker({ slots, active, onPick, onClear }: PickerProps) {
  const filled = slots.filter(Boolean).length;
  const dialog = useRef<HTMLDialogElement>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const total = slots.reduce((sum, slot) => sum + (slot ? fit(slot.design.size).cols * fit(slot.design.size).rows : 0), 0);
  const print = async () => {
    if (printing) return;
    setPrinting(true);
    setPrintError("");
    try {
      await printWhenReady(Array.from(document.querySelectorAll<HTMLImageElement>('#print-sheet img')), () => {
        dialog.current?.close();
        window.print();
      });
    } catch {
      setPrintError("The sheet could not be prepared. Check your stickers and try again.");
      if (!dialog.current?.open) dialog.current?.showModal();
    } finally { setPrinting(false); }
  };
  return (
    <section aria-label="A4 sticker sheet" className="flex gap-4 rounded-3xl bg-paper p-4">
      <div className="grid aspect-[210/297] w-28 shrink-0 grid-cols-2 grid-rows-2 gap-1 rounded-lg bg-line p-1">
        {slots.map((s, i) => (
          <div key={i} className="relative">
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-pressed={i === active}
              aria-label={`Section ${i + 1}${s ? ", filled" : ", empty"}${i === active ? ", editing" : ""}`}
              className={`size-full overflow-hidden rounded-md bg-paper hover:bg-tint ${i === active ? "ring-3 ring-ink" : ""}`}
            >
              {s ? <Tiles slot={s} /> : <span className="text-sm font-semibold text-ink-soft">{i + 1}</span>}
            </button>
            {s && (
              <>
                <Check className="pointer-events-none absolute -top-1.5 -left-1.5 size-4 rounded-full bg-ink p-0.5 text-paper" strokeWidth={3} aria-hidden />
                <button
                  type="button"
                  onClick={() => onClear(i)}
                  aria-label={`Clear section ${i + 1}`}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-tomato text-paper hover:bg-tomato-ink"
                >
                  <X className="size-3" strokeWidth={3} aria-hidden />
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Your A4 sheet</h2>
          <p className="text-[15px] font-medium text-ink-soft">
            {total} stickers · {filled}/4 sections filled
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => { setPrintError(""); dialog.current?.showModal(); }}
            disabled={!filled}
            className="flex h-12 items-center justify-center gap-2 rounded-full bg-ink font-semibold text-paper hover:bg-ink-deep disabled:bg-tint disabled:text-ink-soft"
          >
            <Printer className="size-5" aria-hidden />
            Preview & print
          </button>
          <p className="text-xs font-medium text-ink-soft">Print at 100% / “Actual size”, margins: none.</p>
        </div>
      </div>
      <dialog ref={dialog} aria-labelledby="print-preview-title" className="m-auto max-h-[90dvh] w-[min(94vw,720px)] overflow-auto rounded-3xl bg-paper p-5 text-ink shadow-xl backdrop:bg-black/50">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 id="print-preview-title" className="text-xl font-semibold">Print preview</h2><p className="text-sm">A4 · 210 × 297 mm · {total} stickers</p></div>
          <button type="button" aria-label="Close print preview" onClick={() => dialog.current?.close()} className="grid size-11 place-items-center rounded-full bg-tint"><X aria-hidden /></button>
        </div>
        <div aria-label="Full A4 sheet preview" className="mx-auto grid aspect-[210/297] w-full max-w-[min(420px,38vh)] grid-cols-2 grid-rows-2 bg-white shadow-md">
          {slots.map((slot, i) => <div key={i} className="border border-dashed border-gray-300">{slot && <Tiles slot={slot} />}</div>)}
        </div>
        <p className="my-4 text-sm">Use A4 paper, Actual size (100%), no margins, and turn off browser headers and footers. Blank sections stay blank.</p>
        {printError && <p role="alert" className="mb-3 text-sm text-tomato-ink">{printError}</p>}
        <button type="button" disabled={printing || !filled} onClick={() => void print()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-paper disabled:opacity-50"><Printer className="size-5" aria-hidden />{printing ? "Preparing sheet…" : "Print this sheet"}</button>
        <p className="mt-2 text-center text-xs text-ink-soft">Your sheet stays saved here so you can print another copy.</p>
      </dialog>
    </section>
  );
}

/** Hidden on screen; the only thing on the page when printing (see index.css). */
export function PrintSheet({ slots }: { slots: (Slot | null)[] }) {
  return (
    <div id="print-sheet" className="hidden">
      {slots.map((s, i) => (
        <div key={i} className="print-quarter">
          {s && <Tiles slot={s} print />}
        </div>
      ))}
    </div>
  );
}
