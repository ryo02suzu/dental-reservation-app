import { motion } from "framer-motion";
import { Search, XCircle } from "lucide-react";
import { cn } from "./cn";
import { spring } from "./motion";

/** iOSの検索欄。スマホで入力時に拡大されないよう文字は16px */
export function SearchField({ value, onChange, placeholder = "検索", className, autoFocus }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-label2" strokeWidth={2.2} />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full appearance-none rounded-[10px] bg-fill/12 pl-8 pr-8 text-[16px] outline-none placeholder:text-label2 md:text-[14px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button aria-label="消去" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-label3">
          <XCircle className="h-[17px] w-[17px] fill-label3 text-surface" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

/** iOSのスイッチ */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200", checked ? "bg-switch" : "bg-fill/16")}
    >
      <motion.span
        layout
        transition={spring}
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]"
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  );
}

/** ＋−で数を変える */
export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string;
}) {
  return (
    <div className="inline-flex items-center gap-3">
      <span className="min-w-[3ch] text-right text-[15px] tnum text-label2">{format ? format(value) : value}</span>
      <div className="inline-flex h-8 items-center rounded-[9px] bg-fill/12">
        <button aria-label="減らす" disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))} className="h-8 w-11 text-[20px] leading-none text-label disabled:opacity-30">−</button>
        <span className="h-4 w-px bg-sep/30" />
        <button aria-label="増やす" disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))} className="h-8 w-11 text-[20px] leading-none text-label disabled:opacity-30">＋</button>
      </div>
    </div>
  );
}

/** 文字入力（グループ化リストの中に置く前提の、枠のない入力欄） */
export function FieldRow({ label, value, onChange, placeholder, type = "text", inputMode }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric";
}) {
  return (
    <label className="group relative flex min-h-[48px] items-center gap-3 px-4">
      <span className="w-[6.5em] shrink-0 text-[16px] text-label md:text-[15px]">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none placeholder:text-label3 md:text-[15px]"
      />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </label>
  );
}
