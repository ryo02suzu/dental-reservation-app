import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton, cn, spring, tap } from "@/ui";
import { TODAY_KEY } from "@/lib/clock";
import { WEEKDAYS, hm, key, mdw, wd } from "@/lib/format";
import { useIsPhone } from "@/lib/media";
import { LEVEL_LABEL, type DayInfo, type Level } from "./booking";

// ─── 空き具合の印（○ 空きあり / △ 残りわずか / × 空きなし） ─────────────────
export function AvailMark({ level, className }: { level: Level; className?: string }) {
  if (level === "closed") return null;
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={cn("shrink-0", className)}>
      {level === "ok" && <circle cx="5" cy="5" r="3.7" fill="none" stroke="currentColor" strokeWidth="1.5" />}
      {level === "few" && <path d="M5 1.3 8.9 8.4H1.1Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />}
      {level === "none" && <path d="M2 2l6 6M8 2 2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}

export function AvailLegend({ className }: { className?: string }) {
  const item = (lv: Level) => (
    <span className="inline-flex items-center gap-1">
      <AvailMark level={lv} className="text-label2" />
      {LEVEL_LABEL[lv]}
    </span>
  );
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-label2", className)}>
      {item("ok")}
      {item("few")}
      {item("none")}
      <span className="inline-flex items-center gap-1">
        <span aria-hidden className="hatch inline-block h-2.5 w-3.5 rounded-[3px] shadow-[inset_0_0_0_0.5px_rgb(var(--separator)/0.35)]" />
        休診
      </span>
    </div>
  );
}

// ─── 日付の選択（横に並べた30日分 ⇄ 月のカレンダー） ────────────────────────
// スマホは52pxの日付を並べて端を少しのぞかせ（横にスワイプできると分かるように）、
// PC・iPadは列の幅にちょうど9日分を収めて、矢印で9日ずつ送る。
const CELL = 52;
const GAP = 8;
const PER_PAGE = 9;

export function DatePicker({ days, selected, onSelect, bleed = true, className }: {
  days: DayInfo[];
  selected?: string;
  onSelect: (k: string) => void;
  /** 横の並びを画面の端まで出す（スマホの本文の中に置くとき） */
  bleed?: boolean;
  className?: string;
}) {
  const [month, setMonth] = useState(false);
  return (
    <div className={className}>
      {month ? (
        <MonthCalendar days={days} selected={selected} onSelect={onSelect} toggle={<Toggle on onClick={() => setMonth(false)} />} />
      ) : (
        <DayStrip days={days} selected={selected} onSelect={onSelect} bleed={bleed} toggle={<Toggle on={false} onClick={() => setMonth(true)} />} />
      )}
      <AvailLegend className="mt-3 px-0.5" />
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={tap}
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors",
        on ? "bg-sand/30 text-accent" : "bg-fill/12 text-label hover:bg-fill/20",
      )}
    >
      <CalendarDays className="h-4 w-4" strokeWidth={2.1} />
      カレンダー
    </motion.button>
  );
}

function monthText(a: Date, b: Date) {
  if (a.getMonth() === b.getMonth()) return `${a.getFullYear()}年${a.getMonth() + 1}月`;
  return `${a.getMonth() + 1}月–${b.getMonth() + 1}月`;
}

function DayStrip({ days, selected, onSelect, bleed, toggle }: {
  days: DayInfo[]; selected?: string; onSelect: (k: string) => void; bleed: boolean; toggle: ReactNode;
}) {
  const phone = useIsPhone();
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ first: 0, last: 6, atStart: true, atEnd: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pad = bleed && phone ? 16 : 0;
    const cw = (el.firstElementChild as HTMLElement | null)?.offsetWidth || CELL;
    const first = Math.max(0, Math.floor((el.scrollLeft - pad + cw / 2) / (cw + GAP)));
    const last = Math.min(days.length - 1, Math.floor((el.scrollLeft - pad + el.clientWidth - cw / 2) / (cw + GAP)));
    setView({ first, last, atStart: el.scrollLeft < 4, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, [bleed, phone, days.length]);

  // 選んでいる日が真ん中あたりに来るように（最初の表示のとき）
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cell = selected ? el.querySelector<HTMLElement>(`[data-day="${selected}"]`) : null;
    if (cell) {
      if (phone) el.scrollLeft = Math.max(0, cell.offsetLeft - el.clientWidth / 2 + cell.offsetWidth / 2);
      else {
        // 9日ずつのページの、選んだ日を含むページを出す
        const idx = days.findIndex(d => d.key === selected);
        el.scrollLeft = Math.floor(idx / PER_PAGE) * (el.clientWidth + GAP);
      }
    }
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  const page = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * (el.clientWidth + GAP), behavior: "smooth" });
  };
  const a = days[view.first]?.date ?? days[0].date;
  const b = days[view.last]?.date ?? days[days.length - 1].date;

  return (
    <div>
      <div className="mb-3 flex h-8 items-center justify-between gap-3">
        <div className="text-[17px] font-semibold tnum">{monthText(a, b)}</div>
        <div className="flex items-center gap-1.5">
          {!phone && (
            <>
              <IconButton icon={ChevronLeft} label="前の日付" size="sm" disabled={view.atStart} onClick={() => page(-1)} className="disabled:opacity-30" />
              <IconButton icon={ChevronRight} label="次の日付" size="sm" disabled={view.atEnd} onClick={() => page(1)} className="mr-1 disabled:opacity-30" />
            </>
          )}
          {toggle}
        </div>
      </div>
      <motion.div
        ref={ref}
        layoutScroll
        onScroll={measure}
        className={cn("no-scrollbar relative flex snap-x gap-2 overflow-x-auto py-0.5", bleed && phone && "-mx-4 scroll-px-4 px-4")}
      >
        {days.map(d => {
          const sel = d.key === selected;
          const closed = d.level === "closed";
          const disabled = closed || d.level === "none";
          const today = d.key === TODAY_KEY;
          return (
            <motion.button
              key={d.key}
              data-day={d.key}
              whileTap={disabled ? undefined : tap}
              disabled={disabled}
              onClick={() => onSelect(d.key)}
              aria-pressed={sel}
              aria-label={`${mdw(d.date)} ${LEVEL_LABEL[d.level]}`}
              className={cn(
                "relative flex h-[78px] shrink-0 snap-start flex-col items-center justify-center rounded-[14px]",
                phone ? "w-[52px]" : "w-[calc((100%-64px)/9)]",
                closed ? "hatch shadow-[inset_0_0_0_0.5px_rgb(var(--separator)/0.25)]" : "bg-surface",
                d.level === "none" && "opacity-60",
              )}
            >
              {sel && <motion.span layoutId={`day-${id}`} transition={spring} className="absolute inset-0 rounded-[14px] bg-ink" />}
              <span
                className={cn(
                  "relative text-[12px] leading-4",
                  sel ? "font-semibold text-onink/75" : today ? "font-semibold text-accent" : closed ? "text-label3" : "text-label2",
                )}
              >
                {today ? "今日" : wd(d.date)}
              </span>
              <span className={cn("relative mt-1 text-[20px] font-semibold leading-6 tnum", sel ? "text-onink" : closed || d.level === "none" ? "text-label3" : "text-label")}>
                {d.date.getDate()}
              </span>
              <span className="relative mt-1.5 flex h-3 items-center">
                {closed ? (
                  <span className="text-[10px] font-medium leading-3 text-label3">休診</span>
                ) : (
                  <AvailMark level={d.level} className={sel ? "text-onink/80" : d.level === "none" ? "text-label3" : "text-label2"} />
                )}
              </span>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

function MonthCalendar({ days, selected, onSelect, toggle }: {
  days: DayInfo[]; selected?: string; onSelect: (k: string) => void; toggle: ReactNode;
}) {
  const id = useId();
  const byKey = useMemo(() => new Map(days.map(d => [d.key, d])), [days]);
  const months = useMemo(() => {
    const seen = new Map<string, Date>();
    for (const d of days) {
      const m = new Date(d.date.getFullYear(), d.date.getMonth(), 1);
      seen.set(key(m), m);
    }
    return [...seen.values()];
  }, [days]);
  const initial = Math.max(0, months.findIndex(m => selected && selected.slice(0, 7) === key(m).slice(0, 7)));
  const [mi, setMi] = useState(initial);
  const [dir, setDir] = useState(0);
  const m = months[mi];
  const lead = m.getDay();
  const count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + count) / 7) * 7 }, (_, i) => {
    const n = i - lead + 1;
    return n >= 1 && n <= count ? new Date(m.getFullYear(), m.getMonth(), n) : null;
  });
  const go = (d: 1 | -1) => {
    setDir(d);
    setMi(i => Math.min(months.length - 1, Math.max(0, i + d)));
  };

  return (
    <div className="rounded-card bg-surface px-2 pb-2 pt-2.5 md:px-3">
      <div className="mb-1 flex h-8 items-center justify-between gap-2 pl-2">
        <div className="flex items-center gap-1">
          <IconButton icon={ChevronLeft} label="前の月" size="sm" variant="plain" disabled={mi === 0} onClick={() => go(-1)} className="disabled:opacity-25" />
          <div className="min-w-[7.5em] text-center text-[17px] font-semibold tnum">{`${m.getFullYear()}年${m.getMonth() + 1}月`}</div>
          <IconButton icon={ChevronRight} label="次の月" size="sm" variant="plain" disabled={mi === months.length - 1} onClick={() => go(1)} className="disabled:opacity-25" />
        </div>
        <div className="pr-1">{toggle}</div>
      </div>
      <div className="grid grid-cols-7 pb-1 pt-1.5">
        {WEEKDAYS.map(w => (
          <div key={w} className="text-center text-[12px] font-medium text-label3">
            {w}
          </div>
        ))}
      </div>
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={mi}
          custom={dir}
          initial={{ opacity: 0, x: dir * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: dir * -24 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="grid grid-cols-7 gap-y-0.5"
        >
          {cells.map((date, i) => {
            if (!date) return <div key={i} />;
            const k = key(date);
            const info = byKey.get(k);
            const inWindow = !!info;
            const closed = info?.level === "closed";
            const disabled = !info || closed || info.level === "none";
            const sel = k === selected;
            const today = k === TODAY_KEY;
            return (
              <button
                key={k}
                disabled={disabled}
                onClick={() => onSelect(k)}
                aria-pressed={sel}
                aria-label={`${mdw(date)} ${info ? LEVEL_LABEL[info.level] : "受付期間外"}`}
                className="group flex h-[52px] flex-col items-center justify-center"
              >
                <span
                  className={cn(
                    "relative flex h-[34px] w-[34px] items-center justify-center rounded-full text-[16px] tnum",
                    closed && inWindow && "hatch",
                    !disabled && !sel && "group-hover:bg-fill/10",
                  )}
                >
                  {sel && <motion.span layoutId={`mday-${id}`} transition={spring} className="absolute inset-0 rounded-full bg-ink" />}
                  <span
                    className={cn(
                      "relative",
                      sel ? "font-semibold text-onink" : today ? "font-semibold text-accent" : !inWindow ? "text-label4" : disabled ? "text-label3" : "text-label",
                    )}
                  >
                    {date.getDate()}
                  </span>
                </span>
                <span className="mt-0.5 flex h-2.5 items-center">
                  {info && !closed && <AvailMark level={info.level} className={cn("h-2 w-2", info.level === "none" ? "text-label4" : "text-label2")} />}
                </span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── 時間の選択 ─────────────────────────────────────────────────────────────
export function SlotGrid({ slots, selected, onSelect }: { slots: number[]; selected?: number; onSelect: (t: number) => void }) {
  const groups = [
    { label: "午前", list: slots.filter(t => t < 780) },
    { label: "午後", list: slots.filter(t => t >= 780) },
  ].filter(g => g.list.length > 0);
  return (
    <div>
      {groups.map(g => (
        <div key={g.label} className="mt-5 first:mt-0">
          <div className="mb-2 px-0.5 text-footnote font-semibold text-label2">{g.label}</div>
          <div className="grid grid-cols-4 gap-2 md:grid-cols-5">
            {g.list.map(t => {
              const sel = t === selected;
              return (
                <motion.button
                  key={t}
                  data-slot={hm(t)}
                  whileTap={tap}
                  onClick={() => onSelect(t)}
                  aria-pressed={sel}
                  className={cn(
                    "h-11 rounded-[12px] text-[17px] font-medium tnum transition-colors duration-150",
                    sel ? "bg-ink font-semibold text-onink" : "bg-surface text-label hover:shadow-[inset_0_0_0_1.5px_rgb(var(--accent)/0.4)]",
                  )}
                >
                  {hm(t)}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
