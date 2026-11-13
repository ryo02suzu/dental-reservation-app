// PC・iPad の月表示。月曜始まり。各日に件数と稼働率の細い棒、祝日名、休診日は斜線
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Appointment } from "@/data";
import { TODAY_KEY } from "@/lib/clock";
import { WEEKDAYS, key } from "@/lib/format";
import { useIsWide } from "@/lib/media";
import { cn } from "@/ui";
import { OccBar } from "./parts";
import { closedInfo, dayStat, monthMatrix } from "./model";

const EMPTY: Appointment[] = [];
const HEAD = [1, 2, 3, 4, 5, 6, 0].map(i => WEEKDAYS[i]);

export function MonthGrid({ date, byDate, now, dir, onOpenDay }: {
  date: Date;
  byDate: Map<string, Appointment[]>;
  now: Date;
  dir: number;
  onOpenDay: (d: Date) => void;
}) {
  const wide = useIsWide();
  const selected = key(date);
  const rows = useMemo(() => monthMatrix(date).map(r => r.map(d => {
    const dk = key(d);
    return { d, dk, stat: dayStat(dk, byDate.get(dk) ?? EMPTY, now), closed: closedInfo(d) };
  })), [date, byDate, now]);
  const month = date.getMonth();
  const cellH = wide ? (rows.length > 5 ? 108 : 124) : rows.length > 5 ? 92 : 104;

  return (
    <div className="bg-surface">
      <div className="hairline-b grid grid-cols-7 px-[22px]">
        {HEAD.map(w => (
          <div key={w} className="px-2.5 py-2 text-[12px] font-medium text-label2">{w}</div>
        ))}
      </div>
      <motion.div
        key={`${date.getFullYear()}-${month}`}
        className="grid grid-cols-7 px-[22px]"
        initial={{ opacity: 0, x: dir * 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 38 }}
      >
        {rows.flat().map(({ d, dk, stat, closed }, i) => {
          const out = d.getMonth() !== month;
          const today = dk === TODAY_KEY;
          const past = dk < TODAY_KEY;
          const lastCol = i % 7 === 6;
          return (
            <button
              key={dk}
              onClick={() => onOpenDay(d)}
              className={cn(
                "group relative flex min-w-0 flex-col px-2.5 pb-2.5 pt-2 text-left transition-colors hover:bg-fill/6",
                closed && "hatch",
                dk === selected && !today && "bg-fill/6",
                today && "ring-[1.5px] ring-inset ring-accent/70",
              )}
              style={{ height: cellH }}
              title={closed ? `${d.getMonth() + 1}月${d.getDate()}日　${closed.reason}` : `${d.getMonth() + 1}月${d.getDate()}日　予約 ${stat.count}件・稼働率 ${Math.round(stat.util * 100)}%`}
            >
              {!lastCol && <span aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-px origin-right scale-x-50 bg-sep/25" />}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-bottom scale-y-50 bg-sep/25" />
              <span className={cn("flex min-w-0 items-baseline gap-1.5", out && "opacity-40")}>
                <span className={cn("shrink-0 text-[15px] font-semibold tnum", today ? "text-accent" : closed ? "text-label3" : "text-label")}>
                  {d.getDate() === 1 ? `${d.getMonth() + 1}月1日` : d.getDate()}
                </span>
                {closed?.holiday && <span className="min-w-0 truncate text-[11px] text-label2">{closed.holiday}</span>}
                {today && <span className="ml-auto shrink-0 text-[11px] font-semibold text-accent">今日</span>}
              </span>
              <span className={cn("mt-auto min-w-0", out && "opacity-40")}>
                {closed ? (
                  <span className="text-[12px] text-label3">休診</span>
                ) : stat.count === 0 ? (
                  <span className="text-[12px] text-label3">{past ? "予約なし" : `空き ${stat.free}枠`}</span>
                ) : (
                  <>
                    <span className="flex min-w-0 items-baseline gap-1.5 tnum">
                      <span className={cn("shrink-0 text-[13px] font-semibold", past ? "text-label2" : "text-label")}>{stat.count}<span className="ml-px text-[11px] font-medium text-label2">件</span></span>
                      {stat.pending > 0 && !past && <span className="shrink-0 text-[11px] font-semibold text-accent">{wide ? "仮予約" : "仮"} {stat.pending}</span>}
                      {!past && wide && <span className="ml-auto truncate text-[11px] text-label2">空き {stat.free}</span>}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <OccBar util={stat.util} className="min-w-0 flex-1" muted={past} />
                      <span className="w-[26px] shrink-0 text-right text-[11px] leading-none text-label3 tnum">{Math.round(stat.util * 100)}%</span>
                    </span>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
