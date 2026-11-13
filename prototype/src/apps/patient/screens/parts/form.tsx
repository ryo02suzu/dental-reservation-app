import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, CircleAlert } from "lucide-react";
import { cn, spring } from "@/ui";
import { TODAY } from "@/lib/clock";
import { joinBirth, splitBirth, type FieldKey } from "./booking";

// Web予約の入力欄。ラベルは上、欄は白い角丸、エラーは欄のすぐ下に一文で。

export const fieldId = (k: FieldKey) => `bk-${k}`;

const box = (invalid?: boolean) =>
  cn(
    "block w-full rounded-cell bg-surface text-[17px] text-label outline-none transition-shadow duration-150 placeholder:text-label3 md:text-[16px]",
    invalid
      ? "shadow-[inset_0_0_0_1.5px_rgb(var(--red)/0.75)] focus:shadow-[inset_0_0_0_2px_rgb(var(--red)/0.85)]"
      : "focus:shadow-[inset_0_0_0_2px_rgb(var(--accent)/0.6)]",
  );

export function Field({ k, label, optional, hint, error, children, className, hideLabel }: {
  k: FieldKey; label: string; optional?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string;
  /** 見出しがラベルを兼ねるとき（読み上げ用には残す） */
  hideLabel?: boolean;
}) {
  return (
    <div data-field={k} className={className}>
      <label htmlFor={fieldId(k)} className={cn(hideLabel ? "sr-only" : "mb-1.5 flex items-baseline gap-2 px-1 text-[15px] leading-5 text-label")}>
        {label}
        {optional && <span className="text-[13px] font-normal text-label3">任意</span>}
      </label>
      {children}
      <AnimatePresence initial={false} mode="popLayout">
        {error ? (
          <motion.p
            key={error}
            id={`${fieldId(k)}-msg`}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18 }}
            className="flex items-start gap-1.5 px-1 pt-1.5 text-footnote text-red"
          >
            <CircleAlert className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
            <span>{error}</span>
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" id={`${fieldId(k)}-msg`} initial={false} className="px-1 pt-1.5 text-footnote leading-[1.55] text-label2">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function TextInput({ k, value, onChange, onBlur, placeholder, type = "text", inputMode, autoComplete, invalid, maxLength }: {
  k: FieldKey; value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; type?: string;
  inputMode?: "text" | "tel" | "email" | "numeric"; autoComplete?: string; invalid?: boolean; maxLength?: number;
}) {
  return (
    <input
      id={fieldId(k)}
      type={type}
      inputMode={inputMode}
      autoComplete={autoComplete}
      value={value}
      maxLength={maxLength}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={`${fieldId(k)}-msg`}
      className={cn(box(invalid), "h-[50px] px-4")}
    />
  );
}

export function TextArea({ k, value, onChange, onBlur, placeholder, invalid, max }: {
  k: FieldKey; value: string; onChange: (v: string) => void; onBlur?: () => void; placeholder?: string; invalid?: boolean; max: number;
}) {
  return (
    <div className="relative">
      <textarea
        id={fieldId(k)}
        value={value}
        rows={4}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={`${fieldId(k)}-msg`}
        className={cn(box(invalid), "min-h-[124px] resize-none px-4 pb-8 pt-3 leading-[1.6]")}
      />
      <span className={cn("pointer-events-none absolute bottom-2.5 right-3.5 text-caption tnum", value.length > max ? "text-red" : "text-label3")}>
        {value.length}/{max}
      </span>
    </div>
  );
}

/** 西暦に和暦を添える（「1990年（平成2年）」） */
function era(y: number): string {
  const n = (base: number) => (y - base === 1 ? "元" : String(y - base));
  if (y >= 2019) return `令和${n(2018)}年`;
  if (y >= 1989) return `平成${n(1988)}年`;
  if (y >= 1926) return `昭和${n(1925)}年`;
  return `大正${n(1911)}年`;
}

function Select({ id, value, onChange, placeholder, options, invalid, onBlur, className, label }: {
  id?: string; value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[];
  invalid?: boolean; onBlur?: () => void; className?: string; label: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        id={id}
        value={value}
        aria-label={label}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid || undefined}
        className={cn(box(invalid), "h-[50px] appearance-none truncate pl-4 pr-8 tnum", !value && "text-label3")}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map(o => (
          <option key={o.value} value={o.value} className="text-label">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-label3" strokeWidth={2.4} />
    </div>
  );
}

/** 生年月日（年・月・日の3つ。スマホではドラムロールで選べる） */
export function BirthInput({ k, value, onChange, invalid, onBlur }: {
  k: FieldKey; value?: string; onChange: (v?: string) => void; invalid?: boolean; onBlur?: () => void;
}) {
  const [p, setP] = useState(() => splitBirth(value));
  const thisYear = TODAY.getFullYear();
  const years = Array.from({ length: thisYear - 1920 + 1 }, (_, i) => thisYear - i);
  const maxDay = p.y && p.m ? new Date(Number(p.y), Number(p.m), 0).getDate() : 31;
  const update = (patch: Partial<typeof p>) => {
    const next = { ...p, ...patch };
    if (next.d && Number(next.d) > (next.y && next.m ? new Date(Number(next.y), Number(next.m), 0).getDate() : 31)) next.d = "";
    setP(next);
    onChange(joinBirth(next));
  };
  return (
    <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <Select
        id={fieldId(k)}
        label="年"
        value={p.y}
        placeholder="年"
        invalid={invalid && !p.y}
        onBlur={onBlur}
        onChange={y => update({ y })}
        options={years.map(y => ({ value: String(y), label: `${y}年（${era(y)}）` }))}
      />
      <Select label="月" value={p.m} placeholder="月" invalid={invalid && !p.m} onBlur={onBlur} onChange={m => update({ m })} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}月` }))} />
      <Select label="日" value={p.d} placeholder="日" invalid={invalid && !p.d} onBlur={onBlur} onChange={d => update({ d })} options={Array.from({ length: maxDay }, (_, i) => ({ value: String(i + 1), label: `${i + 1}日` }))} />
    </div>
  );
}

/** 2〜3択（性別など）。選んだ面がなめらかに移動する */
export function Choice<T extends string>({ k, value, options, onChange, invalid }: {
  k: FieldKey; value?: T; options: T[]; onChange: (v: T) => void; invalid?: boolean;
}) {
  const lid = useId();
  return (
    <div
      id={fieldId(k)}
      role="radiogroup"
      aria-invalid={invalid || undefined}
      className={cn("grid gap-0 rounded-[13px] bg-fill/12 p-[3px]", invalid && "shadow-[inset_0_0_0_1.5px_rgb(var(--red)/0.75)]")}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(o => {
        const on = value === o;
        return (
          <button key={o} type="button" role="radio" aria-checked={on} onClick={() => onChange(o)} className="relative h-11 rounded-[10px] text-[16px] font-medium">
            {on && <motion.span layoutId={lid} transition={spring} className="absolute inset-0 rounded-[10px] bg-thumb shadow-thumb" />}
            <span className={cn("relative", on ? "text-label" : "text-label2")}>{o}</span>
          </button>
        );
      })}
    </div>
  );
}
