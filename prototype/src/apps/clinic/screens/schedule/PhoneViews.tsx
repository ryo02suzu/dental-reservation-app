// スマホの週表示（7日の一覧）と月表示（点で混み具合を示す小さなカレンダー）
import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Appointment } from "@/data";
import { TODAY_KEY } from "@/lib/clock";
import { WEEKDAYS, key, mdw } from "@/lib/format";
import { ListRow, ListSection, cn } from "@/ui";
import { LoadDots, OccBar } from "./parts";
import { closedInfo, dayStat, monthMatrix, weekDays } from "./model";

const EMPTY: Appointment[] = [];
const HEAD = [1, 2, 3, 4, 5, 6, 0].map(i => WEEKDAYS[i]);

function DateBadge({ d, today, closed }: { d: Date; today: boolean; closed: boolean }) {
  return (
    <span className="flex w-9 shrink-0 flex-col items-center leading-none">
      <span className={cn("text-[11px] font-medium", today ? "text-accent" : closed ? "text-label3" : "text-label2")}>{WEEKDAYS[d.getDay()]}</span>
      <span className={cn("mt-1 text-[20px] font-semibold tnum", today ? "text-accent" : closed ? "text-label3" : "text-label")}>{d.getDate()}</span>
    </span>
  );
}

export function PhoneWeek({ date, byDate, now, dir, onOpenDay }: {
  date: Date;
  byDate: Map<string, Appointment[]>;
  now: Date;
  dir: number;
  onOpenDay: (d: Date) => void;
}) {
  const days = weekDays(date);
  return (
    <motion.div key={key(days[0])} initial={{ opacity: 0, x: dir * 18 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 420, damping: 40 }}>
      <ListSection className="mt-2" footer="日付を押すと、その日の予定表を開きます。">
        {days.map(d => {
          const dk = key(d);
          const closed = closedInfo(d);
          const st = dayStat(dk, byDate.get(dk) ?? EMPTY, now);
          const today = dk === TODAY_KEY;
          const past = dk < TODAY_KEY;
          const pct = Math.round(st.util * 100);
          return (
            <ListRow
              key={dk}
              leading={<DateBadge d={d} today={today} closed={!!closed} />}
              inset={64}
              title={closed ? (
                <span className="text-label3">休診日</span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="tnum">予約 <span className="font-semibold">{st.count}</span>件</span>
                  {st.pending > 0 && !past && <span className="rounded-[6px] bg-sand/30 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-accent">仮予約 {st.pending}</span>}
                  {st.late > 0 && <span className="rounded-[6px] bg-red/10 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-red">未来院 {st.late}</span>}
                </span>
              )}
              subtitle={closed ? (closed.holiday ? `${closed.holiday}（祝日）` : `${WEEKDAYS[d.getDay()]}曜日は定休日`) : (
                <span className="tnum">{past ? `稼働率 ${pct}%` : `空き ${st.free}枠 · 稼働率 ${pct}%`}{today ? " · 今日" : ""}</span>
              )}
              trailing={closed ? undefined : <OccBar util={st.util} muted={past} className="w-12 shrink-0" />}
              chevron
              onClick={() => onOpenDay(d)}
            />
          );
        })}
      </ListSection>
    </motion.div>
  );
}

export function PhoneMonth({ date, byDate, now, dir, onOpenDay }: {
  date: Date;
  byDate: Map<string, Appointment[]>;
  now: Date;
  dir: number;
  onOpenDay: (d: Date) => void;
}) {
  const month = date.getMonth();
  const selected = key(date);
  const cells = useMemo(() => monthMatrix(date).flat().map(d => {
    const dk = key(d);
    return { d, dk, closed: closedInfo(d), stat: dayStat(dk, byDate.get(dk) ?? EMPTY, now) };
  }), [date, byDate, now]);
  const holidays = cells.filter(c => c.d.getMonth() === month && c.closed?.holiday);

  return (
    <motion.div key={`${date.getFullYear()}-${month}`} initial={{ opacity: 0, x: dir * 18 }} animate={{ opacity: 1, x: 0 }} transition={{ type: "spring", stiffness: 420, damping: 40 }}>
      <div className="mt-2 rounded-cell bg-surface px-1 pb-2 pt-2.5">
        <div className="grid grid-cols-7 pb-1.5">
          {HEAD.map(w => <div key={w} className="text-center text-[11px] font-medium text-label3">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map(({ d, dk, closed, stat }) => {
            const out = d.getMonth() !== month;
            const today = dk === TODAY_KEY;
            const sel = dk === selected && !today;
            return (
              <button
                key={dk}
                onClick={() => onOpenDay(d)}
                aria-label={`${mdw(d)}${closed ? ` ${closed.reason}` : ` 予約${stat.count}件`}`}
                className={cn("flex h-[54px] flex-col items-center pt-1", out && "opacity-35")}
              >
                <span
                  className={cn(
                    "flex h-[32px] w-[32px] items-center justify-center rounded-full text-[17px] tnum",
                    today ? "bg-accent font-semibold text-onink" : sel ? "bg-fill/16 font-semibold text-label" : closed ? "text-label3" : "text-label",
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="mt-1 flex h-[8px] items-center">
                  {closed ? (closed.holiday ? <span className="text-[9px] leading-none text-label3">祝</span> : null) : stat.count > 0 ? <LoadDots util={stat.util} /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-label2">
        <span className="flex items-center gap-1.5"><LoadDots util={0.4} />空きあり</span>
        <span className="flex items-center gap-1.5"><LoadDots util={0.7} />やや混雑</span>
        <span className="flex items-center gap-1.5"><LoadDots util={0.9} />混雑</span>
      </div>
      {holidays.length > 0 && (
        <ListSection header="祝日（休診）" className="mt-6">
          {holidays.map(h => (
            <ListRow key={h.dk} title={h.closed!.holiday!} value={<span className="tnum">{mdw(h.d)}</span>} />
          ))}
        </ListSection>
      )}
    </motion.div>
  );
}
