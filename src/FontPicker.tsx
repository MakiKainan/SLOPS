import { useEffect, useMemo, useState } from "react";
import type { FontFamily, Style } from "./api";

const STYLES: Style[] = ["regular", "bold", "italic", "bold-italic"];
const OTHER = "Other";

const catOf = (f: FontFamily) => f.category ?? OTHER;
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Load each family's specimen face once; returns family -> CSS font-family name. */
function useSpecimenFaces(fonts: FontFamily[]) {
  const [faces, setFaces] = useState<Record<string, string>>({});
  useEffect(() => {
    // ponytail: loads every family up front; add an IntersectionObserver if the catalog grows past a few dozen.
    fonts.forEach((f, i) => {
      // Script faces are hairline-thin at tile size, so show their bold cut when there is one.
      const style = f.category === "script" && f.styles.includes("bold") ? "bold" : f.styles.includes("regular") ? "regular" : f.styles[0];
      const name = `specimen-${i}`;
      const face = new FontFace(name, `url('/font-file?family=${encodeURIComponent(f.family)}&style=${style}')`);
      face
        .load()
        .then(() => {
          document.fonts.add(face);
          setFaces((prev) => ({ ...prev, [f.family]: name }));
        })
        .catch(() => {}); // tile falls back to the UI font
    });
  }, [fonts]);
  return faces;
}

interface Props {
  fonts: FontFamily[];
  value: string | null;
  onChange: (family: string) => void;
  specimen: string;
}

export default function FontPicker({ fonts, value, onChange, specimen }: Props) {
  const [filter, setFilter] = useState("All");
  const faces = useSpecimenFaces(fonts);

  const filters = useMemo(() => {
    const cats = [...new Set(fonts.map(catOf))].sort((a, b) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b)));
    return cats.length > 1 ? ["All", ...cats] : [];
  }, [fonts]);

  const visible = fonts.filter((f) => filter === "All" || catOf(f) === filter);

  return (
    <div className="flex flex-col gap-5">
      {filters.length > 0 && (
        <div role="group" aria-label="Filter fonts by category" className="flex flex-wrap gap-2">
          {filters.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className="h-9 rounded-full bg-tint px-4 text-sm font-medium hover:bg-tint-2 aria-pressed:bg-ink aria-pressed:text-paper"
            >
              {label(c)}
            </button>
          ))}
        </div>
      )}

      <div role="radiogroup" aria-label="Font" className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {visible.map((f) => {
          const id = `font-${f.family.replace(/\W+/g, "-")}`;
          const script = f.category === "script";
          return (
            <div key={f.family}>
              <input
                type="radio"
                name="family"
                id={id}
                className="peer sr-only"
                checked={f.family === value}
                onChange={() => onChange(f.family)}
              />
              <label
                htmlFor={id}
                className="flex h-full cursor-pointer flex-col gap-3 rounded-2xl bg-tint px-5 py-4 hover:bg-tint-2 peer-checked:bg-ink peer-checked:text-paper peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-ink"
              >
                <span
                  className={`block truncate leading-tight ${script ? "text-[44px]" : "text-4xl"}`}
                  style={{ fontFamily: faces[f.family] ? `'${faces[f.family]}', var(--font-ui)` : undefined }}
                >
                  {specimen}
                </span>
                <span className="flex items-center justify-between gap-3 text-sm font-medium opacity-80">
                  <span className="truncate">{f.family}</span>
                  <span className="flex shrink-0 gap-1" aria-label={`${f.styles.length} of 4 styles`}>
                    {STYLES.map((s) => (
                      <span
                        key={s}
                        className={`size-1.5 rounded-full ${f.styles.includes(s) ? "bg-current" : "border border-current"}`}
                      />
                    ))}
                  </span>
                </span>
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
