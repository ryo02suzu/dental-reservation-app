// 設定画面の行の部品。すべて「変えた瞬間に反映」して、控えめなトーストで知らせる。
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useIsDesktop } from "@/lib/media";
import { CircleX } from "lucide-react";
import { ListRow, Stepper, Switch, cn, useToast } from "@/ui";
import type { LucideIcon } from "lucide-react";
import type { TileTone } from "@/data";

export function useSaved() {
  const toast = useToast();
  return useCallback((detail?: string) => toast("変更を保存しました", { detail }), [toast]);
}

/** 画面幅が iPad 横（1024px）以上か */
export const useTwoPane = useIsDesktop;

export function SwitchRow({ title, subtitle, checked, onChange, icon, tone, disabled }: {
  title: ReactNode; subtitle?: ReactNode; checked: boolean; onChange: (v: boolean) => void; icon?: LucideIcon; tone?: TileTone; disabled?: boolean;
}) {
  const saved = useSaved();
  return (
    <div className={cn(disabled && "pointer-events-none opacity-40")}>
      <ListRow
        icon={icon}
        tone={tone}
        title={title}
        subtitle={subtitle}
        trailing={<Switch checked={checked} onChange={v => { onChange(v); saved(); }} label={typeof title === "string" ? title : undefined} />}
      />
    </div>
  );
}

export function StepperRow({ title, subtitle, value, onChange, min, max, step, format, disabled }: {
  title: ReactNode; subtitle?: ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string; disabled?: boolean;
}) {
  const saved = useSaved();
  return (
    <div className={cn(disabled && "pointer-events-none opacity-40")}>
      <ListRow title={title} subtitle={subtitle} trailing={<Stepper value={value} onChange={v => { onChange(v); saved(); }} min={min} max={max} step={step} format={format} />} />
    </div>
  );
}

/** 入力欄の行。フォーカスが外れたとき（または Enter）に、変わっていれば保存する */
export function TextRow({ label, value, onCommit, placeholder, inputMode, wide, hint }: {
  label: string; value: string; onCommit: (v: string) => void; placeholder?: string; inputMode?: "text" | "tel" | "email" | "numeric"; wide?: boolean; hint?: ReactNode;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const saved = useSaved();
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (!v) { setDraft(value); return; }
    if (v !== value) { onCommit(v); saved(`${label}：${v}`); }
  };
  return (
    <label className="group relative flex min-h-[48px] items-center gap-3 px-4 md:min-h-[44px]">
      <span className={cn("shrink-0 text-[16px] text-label md:text-[15px]", wide ? "w-[7.5em]" : "w-[6em]")}>{label}</span>
      <input
        value={draft}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); } }}
        className="min-w-0 flex-1 bg-transparent py-3 text-right text-[16px] text-label caret-accent outline-none placeholder:text-label3 md:text-[15px]"
      />
      {/* iOSの入力欄と同じく、入力中だけ消去ボタンを出す（押しても欄からフォーカスが外れないように mousedown で処理） */}
      {focused && draft && (
        <button
          type="button"
          aria-label={`${label}を消去`}
          onMouseDown={e => { e.preventDefault(); setDraft(""); }}
          className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center text-label3 hover:text-label2"
        >
          <CircleX className="h-[17px] w-[17px] fill-label3 text-surface" strokeWidth={2.2} />
        </button>
      )}
      {hint}
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </label>
  );
}

/** シートの中のまとまり（白いシートの上なので薄い灰色の面にする） */
export function SheetGroup({ children, header, footer, className }: { children: ReactNode; header?: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-5 first:mt-2", className)}>
      {header && <h3 className="px-4 pb-1.5 text-footnote font-medium text-label2">{header}</h3>}
      <div className="overflow-hidden rounded-cell bg-fill/8">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-footnote text-label2">{footer}</p>}
    </div>
  );
}

/** シートの中の入力欄（ラベル＋入力） */
export function SheetField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="group relative flex min-h-[48px] items-center gap-3 px-4">
      <span className="w-[6em] shrink-0 text-[16px] md:text-[15px]">{label}</span>
      <div className="flex min-w-0 flex-1 items-center justify-end">{children}</div>
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </label>
  );
}

export const inputCls = "min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none placeholder:text-label3 md:text-[15px]";
