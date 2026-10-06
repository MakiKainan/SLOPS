import { useEffect, useMemo, useState } from "react";
import type { FontFamily, Style } from "./api";
import FilterChips from "./FilterChips";

const STYLES: Style[] = ["regular", "bold", "italic", "bold-italic", "underline"];
const OTHER = "Other";

const catOf = (f: FontFamily) => f.category ?? OTHER;

/** Load each family's specimen face once; returns family -> CSS font-family name. */
function useSpecimenFaces(fonts: FontFamily[]) {
  const [faces, setFaces] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const loaded: FontFace[] = [];
    // ponytail: loads every family up front; add an IntersectionObserver if the catalog grows past a few dozen.
    fonts.forEach((f) => {
      // Script faces are hairline-thin at tile size, so show their bold cut when there is one.
      const style = f.category === "script" && f.styles.includes("bold") ? "bold" : f.styles.includes("regular") ? "regular" : f.styles[0];
      const encodedFamily = encodeURIComponent(f.family).replace(/'/g, "%27");
      const name = `specimen-${encodedFamily}`;
      const face = new FontFace(name, `url('/font-file?family=${encodedFamily}&style=${style}')`);
      face
        .load()
        .then(() => {
          if (cancelled) return;
          document.fonts.add(face);
          loaded.push(face);
          setFaces((prev) => ({ ...prev, [f.family]: name }));
        })
        .catch(() => {}); // tile falls back to the UI font
    });
    return () => {
      cancelled = true;
      loaded.forEach((face) => document.fonts.delete(face));
    };
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
      {filters.length > 0 && <FilterChips options={filters} value={filter} onChange={setFilter} label="Filter fonts by category" />}

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
                  <span className="flex shrink-0 gap-1" aria-label={`${f.styles.length} of 5 styles`}>
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
