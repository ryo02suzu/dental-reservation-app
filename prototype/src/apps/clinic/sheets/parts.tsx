// シートの中で使う小さな部品。シートの面は白（elevated）なので、まとまりは
// 白いカードではなく、うすい塗り（fill）のインセットで見せる（iOSのマップ・macOSの設定と同じ考え方）。
import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useIsPhone } from "@/lib/media";
import { TODAY_KEY } from "@/lib/clock";
import { hm, wd } from "@/lib/format";
import { cn, spring } from "@/ui";
import { slotCandidates, type DayOption } from "./logic";

/** 塗りのインセット（グループ化した行の入れ物） */
export function Inset({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-cell bg-fill/8", className)}>{children}</div>;
}

/** セクションの見出し（ListSection と同じ文字） */
export function Head({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-[20px] items-end justify-between gap-3 px-4 pb-1.5", className)}>
      <h3 className="text-footnote font-medium text-label2">{children}</h3>
      {aside}
    </div>
  );
}

/** フォームの大きな区切りの見出し（患者・メニュー・日時…） */
export function Title({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end justify-between gap-3 px-1 pb-2.5", className)}>
      <h3 className="text-[17px] font-semibold leading-[22px] palt md:text-[15px] md:leading-5">{children}</h3>
      {aside}
    </div>
  );
}

/** 行の下の0.5pxの区切り線（最後の行では出さない） */
export const RowSep = ({ left = 16 }: { left?: number }) => (
  <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last/row:hidden" style={{ left }} />
);

/** 左に項目名、右に値の行 */
export function KV({ k, children, onClick, sub, align = "center" }: { k: ReactNode; children: ReactNode; onClick?: () => void; sub?: ReactNode; align?: "center" | "start" }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group/row relative flex min-h-[44px] w-full gap-3 px-4 py-2.5 text-left md:min-h-[42px] md:py-2",
        align === "center" ? "items-center" : "items-start",
        onClick && "transition-colors hover:bg-fill/[0.06] active:bg-fill/12",
      )}
    >
      <span className="w-[5.5em] shrink-0 text-[15px] leading-[22px] text-label2 md:text-[14px] md:leading-5">{k}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right text-[16px] leading-[22px] md:text-[14px] md:leading-5">{children}</span>
      {sub}
      <RowSep />
    </Tag>
  );
}

/** 選べる小さなカプセル（理由・担当・ユニットなど） */
export function Chip({ selected, onClick, disabled, children, className, tone = "ink" }: {
  selected?: boolean; onClick?: () => void; disabled?: boolean; children: ReactNode; className?: string; tone?: "ink" | "red";
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: "spring", stiffness: 700, damping: 32 }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-10 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-[15px] font-medium transition-colors duration-150 md:h-8 md:px-3.5 md:text-[13px]",
        selected
          ? tone === "red" ? "bg-red text-white" : "bg-ink text-onink"
          : "bg-fill/12 text-label hover:bg-fill/18",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

/** 高さを伸び縮みさせて出し入れする */
export function Reveal({ show, children, className }: { show: boolean; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          key="reveal"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ height: spring, opacity: { duration: 0.18 } }}
          className={cn("overflow-hidden", className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** 入力に合わせて高さが伸びる複数行の入力欄 */
export function AutoText({ value, onChange, placeholder, onSubmit, className, minRows = 2, autoFocus }: {
  value: string; onChange: (v: string) => void; placeholder?: string; onSubmit?: () => void; className?: string; minRows?: number; autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onKeyDown={e => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onSubmit?.();
        }
      }}
      className={cn("block w-full resize-none bg-transparent text-[16px] leading-[1.6] outline-none placeholder:text-label3 md:text-[14px]", className)}
    />
  );
}

/** 日付の横スクロール（休診日は理由つきで押せない） */
export function DayStrip({ days, value, onChange, counts, onMore, bleed = "px-4 -mx-4 md:px-5 md:-mx-5" }: {
  days: DayOption[];
  value: string;
  onChange: (key: string) => void;
  /** 日ごとの空き枠の数（なければ出さない） */
  counts?: Record<string, number>;
  /** 末尾の「その先」（さらに先の日付を足す） */
  onMore?: () => void;
  bleed?: string;
}) {
  const strip = useRef<HTMLDivElement>(null);
  // 選んでいる日が見えるように（縦のスクロールは動かさない）
  useEffect(() => {
    const el = strip.current;
    const chip = el?.querySelector<HTMLElement>(`[data-day="${value}"]`);
    if (!el || !chip) return;
    const left = chip.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft + 8 || left + chip.offsetWidth > el.scrollLeft + el.clientWidth - 8) {
      el.scrollTo({ left: Math.max(0, left - el.clientWidth / 2 + chip.offsetWidth / 2), behavior: "smooth" });
    }
  }, [value]);
  return (
    <div ref={strip} className={cn("no-scrollbar flex snap-x gap-1.5 overflow-x-auto pb-1 pt-0.5", bleed)} data-vaul-no-drag="">
      {days.map((d, i) => {
        const first = i === 0 || d.date.getDate() === 1;
        const on = d.key === value;
        const today = d.key === TODAY_KEY;
        const n = counts?.[d.key];
        return (
          <div key={d.key} className="flex shrink-0 snap-start items-stretch gap-1.5">
            {first && i > 0 && (
              <div className="flex w-7 shrink-0 items-center justify-center text-[11px] font-semibold leading-tight text-label2 [writing-mode:vertical-rl]">
                {d.date.getMonth() + 1}月
              </div>
            )}
            <motion.button
              type="button"
              data-day={d.key}
              disabled={!d.open}
              title={d.open ? undefined : d.reason}
              aria-label={`${d.date.getMonth() + 1}月${d.date.getDate()}日（${wd(d.date)}）${d.open ? "" : ` ${d.reason}`}`}
              aria-pressed={on}
              whileTap={d.open ? { scale: 0.95 } : undefined}
              transition={{ type: "spring", stiffness: 700, damping: 32 }}
              onClick={() => onChange(d.key)}
              className={cn(
                "relative flex w-[50px] flex-col items-center justify-center rounded-[12px] py-2 transition-colors duration-150",
                d.open ? (on ? "bg-ink text-onink" : "bg-fill/8 text-label hover:bg-fill/14") : "hatch text-label3",
              )}
            >
              <span className={cn("text-[11px] font-medium leading-none", on ? "text-onink/70" : today ? "text-accent" : "text-label2", !d.open && "text-label3")}>
                {today ? "今日" : wd(d.date)}
              </span>
              <span className="mt-1.5 text-[19px] font-semibold leading-none tnum">{d.date.getDate()}</span>
              <span className={cn("mt-1.5 text-[10px] font-medium leading-none tnum", on ? "text-onink/70" : "text-label3")}>
                {!d.open ? (d.reason === "休診日" ? "休診" : "祝日") : n === undefined ? " " : n === 0 ? "満" : `空${n}`}
              </span>
            </motion.button>
          </div>
        );
      })}
      {onMore && (
        <button
          type="button"
          onClick={onMore}
          className="flex w-[50px] shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] text-[11px] font-semibold leading-tight text-accent transition-colors hover:bg-fill/8"
        >
          <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          <span>その先</span>
        </button>
      )}
    </div>
  );
}

/** 開始時刻のボタン（午前・午後）。空いていない時刻は押せない */
export function SlotGrid({ day, minutes, available, value, onChange, current, cols = "grid-cols-4 md:grid-cols-8" }: {
  day: Date;
  minutes: number;
  available: Set<number>;
  value?: number;
  onChange: (t: number) => void;
  /** いまの予約の時刻（変更のときに印を付ける） */
  current?: number;
  cols?: string;
}) {
  const phone = useIsPhone();
  const { am, pm } = slotCandidates(day, minutes);
  const groups = [
    { label: "午前", times: am },
    { label: "午後", times: pm },
  ].filter(g => g.times.length);
  if (!groups.length) return <p className="py-6 text-center text-[14px] text-label2">この日は休診です</p>;
  return (
    <div className="space-y-3">
      {groups.map(g => {
        const free = g.times.filter(t => available.has(t)).length;
        const allGone = free === 0;
        return (
          <div key={g.label}>
            <div className="mb-1.5 flex items-baseline gap-2 px-1">
              <span className="text-[13px] font-semibold text-label">{g.label}</span>
              <span className="text-[12px] text-label3 tnum">{allGone ? "空きなし" : `空き ${free}`}</span>
            </div>
            <div className={cn("grid gap-1.5", cols)}>
              {g.times.map(t => {
                const ok = available.has(t);
                const on = value === t;
                const cur = current === t;
                return (
                  <motion.button
                    key={t}
                    type="button"
                    disabled={!ok && !on}
                    whileTap={ok ? { scale: 0.95 } : undefined}
                    transition={{ type: "spring", stiffness: 700, damping: 32 }}
                    onClick={() => onChange(t)}
                    aria-pressed={on}
                    className={cn(
                      "relative rounded-[10px] text-[15px] tnum transition-colors duration-150",
                      phone ? "h-11" : "h-9 text-[14px]",
                      on ? "bg-ink font-semibold text-onink" : ok ? (cur ? "bg-sand/30 font-semibold text-label" : "bg-fill/8 font-medium text-label hover:bg-fill/14") : "text-label4",
                    )}
                  >
                    {hm(t)}
                    {cur && !on && <span className="absolute inset-x-0 bottom-[3px] mx-auto h-[3px] w-[3px] rounded-full bg-accent" aria-label="現在の時刻" />}
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
