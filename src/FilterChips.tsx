const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}

/** Pill row that narrows a picker to one category. */
export default function FilterChips({ options, value, onChange, label: groupLabel }: Props) {
  return (
    <div role="group" aria-label={groupLabel} className="flex flex-wrap gap-2">
      {options.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          onClick={() => onChange(c)}
          className="h-9 rounded-full bg-tint px-4 text-sm font-medium hover:bg-tint-2 aria-pressed:bg-ink aria-pressed:text-paper"
        >
          {label(c)}
        </button>
      ))}
    </div>
  );
}
