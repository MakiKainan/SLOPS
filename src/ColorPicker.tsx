import { useState } from "react";
import { Check } from "lucide-react";
import type { Preset } from "./api";
import FilterChips from "./FilterChips";

const kindOf = (p: Preset) => (p.gradient ? "Gradient" : "Base");

interface Props {
  presets: Preset[];
  value: number;
  onChange: (index: number) => void;
}

export default function ColorPicker({ presets, value, onChange }: Props) {
  const [filter, setFilter] = useState("All");
  const kinds = [...new Set(presets.map(kindOf))].sort();
  const filters = kinds.length > 1 ? ["All", ...kinds] : [];
  // Keep each preset's index into the full list; the design stores that index.
  const visible = presets.map((p, idx) => ({ p, idx })).filter(({ p }) => filter === "All" || kindOf(p) === filter);

  return (
    <div className="flex flex-col gap-5">
      {filters.length > 0 && <FilterChips options={filters} value={filter} onChange={setFilter} label="Filter colors by type" />}

      <div role="radiogroup" aria-label="Color preset" className="flex flex-wrap gap-3 p-1">
        {visible.map(({ p, idx }) => (
          <div key={p.name}>
            <input type="radio" name="preset" id={`preset-${idx}`} className="peer sr-only" checked={idx === value} onChange={() => onChange(idx)} />
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
    </div>
  );
}
