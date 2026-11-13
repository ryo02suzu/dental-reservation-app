import { cn } from "@/ui";
import { toothLabel } from "@/lib/format";
import { LOWER, UPPER, type ToothKey } from "./util";

/** 32本を2段に並べた小さな歯式。押した歯を選ぶ／外す */
export function ToothGrid({ value, onToggle }: { value: ToothKey[]; onToggle: (k: ToothKey) => void }) {
  const on = new Set(value);
  const cell = (k: ToothKey) => {
    const sel = on.has(k);
    return (
      <button
        key={k}
        type="button"
        aria-pressed={sel}
        aria-label={toothLabel(k)}
        title={toothLabel(k)}
        onClick={() => onToggle(k)}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center justify-center rounded-[6px] text-[13px] tnum transition-colors duration-100",
          sel ? "bg-accent font-semibold text-surface" : "text-label2 hover:bg-fill/12 active:bg-fill/16",
        )}
      >
        {k.slice(2)}
      </button>
    );
  };
  const half = (keys: ToothKey[]) => (
    <div className="flex min-w-0 flex-1 gap-px">{keys.map(cell)}</div>
  );
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-3 shrink-0 text-center text-[11px] text-label3" aria-hidden>右</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-stretch">
          {half(UPPER.slice(0, 8))}
          <span className="mx-0.5 w-px shrink-0 bg-sep/40" aria-hidden />
          {half(UPPER.slice(8))}
        </div>
        <div className="my-0.5 h-px bg-sep/40" aria-hidden />
        <div className="flex items-stretch">
          {half(LOWER.slice(0, 8))}
          <span className="mx-0.5 w-px shrink-0 bg-sep/40" aria-hidden />
          {half(LOWER.slice(8))}
        </div>
      </div>
      <span className="w-3 shrink-0 text-center text-[11px] text-label3" aria-hidden>左</span>
    </div>
  );
}
