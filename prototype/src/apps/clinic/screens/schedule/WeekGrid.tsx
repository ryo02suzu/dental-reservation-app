// PC・iPad の週表示。月〜日の列を、それぞれユニット1〜4の細いレーンに分けて並べる
// （どの日のどのユニットが空いているかが一目で分かるように）
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { units as UNITS, type Appointment } from "@/data";
import { TODAY_KEY, minutesOfDay } from "@/lib/clock";
import { WEEKDAYS, hm, key } from "@/lib/format";
import { cn, tapSoft } from "@/ui";
import type { NewPrefill } from "../../context";
import { expand, isActive, statusOf } from "../../helpers";
import { blockLook } from "./ApptBlock";
import { BAR_H, scrollParent } from "./DayGrid";
import { OccBar } from "./parts";
import {
  SLOT, SLOT_BOOK, blockedBands, closedInfo, dayStat, floorTo, sessionsOf, timeRange, weekDays, type DayStat,
} from "./model";

const HOUR_H = 64;
const PPM = HOUR_H / 60;
const GUTTER = 72;
const PAD_T = 12;
const PAD_B = 18;
const HEAD_H = 78;
const EMPTY: Appointment[] = [];

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

interface DayCol {
  date: Date;
  dk: string;
  appts: Appointment[];
  stat: DayStat;
  closed: ReturnType<typeof closedInfo>;
  holiday?: string;
}

export function WeekGrid({ date, byDate, now, dir, onOpenDay, onOpen, onNew }: {
  date: Date;
  byDate: Map<string, Appointment[]>;
  now: Date;
  dir: number;
  onOpenDay: (d: Date) => void;
  onOpen: (id: string) => void;
  onNew: (p: NewPrefill) => void;
}) {
  const days: DayCol[] = useMemo(() => weekDays(date).map(d => {
    const dk = key(d);
    const appts = byDate.get(dk) ?? EMPTY;
    const closed = closedInfo(d);
    return { date: d, dk, appts, stat: dayStat(dk, appts, now), closed, holiday: closed?.holiday };
  }), [date, byDate, now]);
  const weekKey = days[0].dk;
  const [r0, r1] = useMemo(() => timeRange(days.filter(d => !d.closed).map(d => d.date), days.flatMap(d => d.appts)), [days]);
  const yOf = (t: number) => PAD_T + (t - r0) * PPM;
  const height = PAD_T + (r1 - r0) * PPM + PAD_B;
  const hours: number[] = [];
  for (let t = Math.ceil(r0 / 60) * 60; t <= r1; t += 60) hours.push(t);

  const [bodyRef, bodyW] = useWidth<HTMLDivElement>();
  const laneW = bodyW ? (bodyW - GUTTER - 12) / 7 / UNITS.length : 0;
  const nowMin = minutesOfDay(now);
  const todayIdx = days.findIndex(d => d.dk === TODAY_KEY);
  const showNow = todayIdx >= 0 && !days[todayIdx].closed && nowMin >= r0 && nowMin <= r1;

  // ─── 空き：ホバーで枠、クリックで新規予約 ───
  const [ghost, setGhost] = useState<{ dk: string; lane: number; start: number; len: number } | null>(null);
  const slotAt = (d: DayCol, lane: number, t: number) => {
    const from = d.dk < TODAY_KEY ? Infinity : d.dk === TODAY_KEY ? floorTo(nowMin) : 0;
    if (t < from) return null;
    const ses = sessionsOf(d.date).find(([s, e]) => t >= s && t + SLOT <= e);
    if (!ses) return null;
    const u = UNITS[lane].id;
    const busy = (s: number, e: number) => d.appts.some(a => a.unitId === u && isActive(a) && a.start < e && a.end > s);
    if (busy(t, t + SLOT)) return null;
    return { start: t, len: t + SLOT_BOOK <= ses[1] && !busy(t, t + SLOT_BOOK) ? SLOT_BOOK : SLOT };
  };
  const hit = (d: DayCol, e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const lane = Math.min(UNITS.length - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * UNITS.length)));
    const t = r0 + floorTo((e.clientY - r.top - PAD_T) / PPM);
    return { lane, s: slotAt(d, lane, t) };
  };
  const onMove = (d: DayCol) => (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-block]")) { if (ghost) setGhost(null); return; }
    const { lane, s } = hit(d, e);
    if (!s) { if (ghost) setGhost(null); return; }
    if (!ghost || ghost.dk !== d.dk || ghost.lane !== lane || ghost.start !== s.start || ghost.len !== s.len) setGhost({ dk: d.dk, lane, ...s });
  };
  const onClick = (d: DayCol) => (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const { lane, s } = hit(d, e);
    if (s) onNew({ date: d.dk, start: s.start, unitId: UNITS[lane].id });
  };

  // 今週を開いたら「いま」が見える位置へ
  useLayoutEffect(() => {
    if (!showNow) return;
    const el = bodyRef.current;
    const sc = scrollParent(el);
    if (!el || !sc) return;
    const y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop + yOf(nowMin);
    if (y > sc.scrollTop + sc.clientHeight - 100) sc.scrollTo({ top: Math.max(0, y - BAR_H - HEAD_H - 160) });
  }, [weekKey, showNow]);

  const template = { gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` };
  const showText = laneW >= 30;
  const showBandLabel = laneW * UNITS.length >= 96;

  return (
    <div className="bg-surface">
      {/* 曜日の見出し：件数・稼働率。クリックでその日の日表示へ */}
      <div className="hairline-b sticky z-20 grid bg-surface pr-3" style={{ ...template, top: BAR_H, height: HEAD_H }}>
        <div className="flex items-end justify-end pb-[5px] pr-2.5">
          <span className="text-[10px] font-medium text-label3">ユニット</span>
        </div>
        {days.map(d => {
          const today = d.dk === TODAY_KEY;
          return (
            <motion.button
              key={d.dk}
              whileTap={tapSoft}
              onClick={() => onOpenDay(d.date)}
              title={`${d.date.getMonth() + 1}月${d.date.getDate()}日の予約を日表示で見る`}
              className={cn("group flex min-w-0 flex-col pt-2 text-left transition-colors hover:bg-fill/6", today && "bg-sand/8")}
            >
              <span className="flex min-w-0 items-center gap-1.5 px-2.5">
                <span className={cn("text-[12px] font-medium", d.closed ? "text-label3" : "text-label2")}>{WEEKDAYS[d.date.getDay()]}</span>
                <span
                  className={cn(
                    "flex h-[26px] min-w-[26px] items-center justify-center rounded-full px-1 text-[17px] font-semibold tnum",
                    today ? "bg-accent text-onink" : d.closed ? "text-label3" : "text-label",
                  )}
                >
                  {d.date.getDate()}
                </span>
                {d.holiday && <span className="min-w-0 truncate text-[11px] text-label2">{d.holiday}</span>}
              </span>
              {d.closed ? (
                <span className="mt-1 px-2.5 text-[12px] leading-4 text-label3">休診</span>
              ) : (
                <>
                  <span className="mt-1 flex items-center gap-2 px-2.5 text-[12px] leading-4 tnum">
                    <span className="shrink-0 text-label">{d.stat.count}<span className="text-label2">件</span></span>
                    <OccBar util={d.stat.util} className="min-w-0 flex-1" muted={d.dk < TODAY_KEY} />
                    <span className="shrink-0 text-label2">{Math.round(d.stat.util * 100)}%</span>
                  </span>
                  <span className="mt-auto grid grid-cols-4 pb-[5px]">
                    {UNITS.map(u => (
                      <span key={u.id} className="text-center text-[10px] font-medium leading-3 text-label3 tnum">{laneW >= 18 ? u.short : u.short.slice(1)}</span>
                    ))}
                  </span>
                </>
              )}
            </motion.button>
          );
        })}
      </div>

      <div ref={bodyRef} className="relative grid pr-3" style={{ ...template, height }}>
        <div className="relative select-none">
          {hours.map(t => (
            <span
              key={t}
              className={cn("absolute right-2.5 text-[12px] leading-[14px] text-label2 tnum", showNow && Math.abs(t - nowMin) * PPM < 12 && "opacity-0")}
              style={{ top: yOf(t) - 7 }}
            >
              {hm(t)}
            </span>
          ))}
        </div>

        <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: GUTTER, right: 12 }}>
          {hours.map(t => <span key={t} className="absolute inset-x-0 h-px origin-top scale-y-50 bg-sep/30" style={{ top: yOf(t) }} />)}
          {hours.slice(0, -1).map(t => <span key={`h${t}`} className="absolute inset-x-0 h-px origin-top scale-y-50 bg-sep/10" style={{ top: yOf(t + 30) }} />)}
        </div>

        {days.map(d => {
          const today = d.dk === TODAY_KEY;
          const g = ghost?.dk === d.dk ? ghost : null;
          const bands = blockedBands(d.date, [r0, r1]);
          const visible = d.appts.filter(isActive);
          return (
            <div
              key={d.dk}
              className={cn("hairline-l relative", today && "bg-sand/6", g && "cursor-pointer")}
              onMouseMove={d.closed ? undefined : onMove(d)}
              onMouseLeave={() => setGhost(null)}
              onClick={d.closed ? undefined : onClick(d)}
            >
              {/* レーンの区切り */}
              {!d.closed && [1, 2, 3].map(i => (
                <span key={i} aria-hidden className="pointer-events-none absolute inset-y-0 w-px origin-left scale-x-50 bg-sep/10" style={{ left: `${i * 25}%` }} />
              ))}
              {bands.map(b => (
                <div key={b.start} aria-hidden className="hatch pointer-events-none absolute inset-x-0 flex justify-center" style={{ top: yOf(b.start), height: (b.end - b.start) * PPM }}>
                  {(showBandLabel || b.label === "休診") && (
                    <span className={cn("whitespace-nowrap rounded-full bg-surface px-2 py-[2px] text-[11px] font-medium leading-4 text-label3", b.label === "休診" ? "mt-5 self-start" : "self-center")}>
                      {b.label}
                    </span>
                  )}
                </div>
              ))}
              <motion.div
                key={weekKey}
                className="absolute inset-0"
                initial={{ opacity: 0, x: dir * 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <AnimatePresence initial={false}>
                  {visible.map(a => (
                    <WeekBlock key={a.id} a={a} lane={Math.max(0, UNITS.findIndex(u => u.id === a.unitId))} top={yOf(a.start) + 1} height={(a.end - a.start) * PPM - 2} now={now} showText={showText} onOpen={onOpen} />
                  ))}
                </AnimatePresence>
              </motion.div>
              {g && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute z-[1] flex justify-center overflow-hidden rounded-[4px] border border-dashed border-accent/60 bg-sand/14"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, top: yOf(g.start) + 1, height: g.len * PPM - 2 }}
                  transition={{ type: "spring", stiffness: 900, damping: 60 }}
                  style={{ top: yOf(g.start) + 1, height: g.len * PPM - 2, left: `calc(${g.lane * 25}% + 1px)`, width: "calc(25% - 2px)" }}
                >
                  <span className="pt-[2px] text-[11px] font-semibold leading-[13px] text-accent tnum">{laneW >= 34 ? hm(g.start) : "+"}</span>
                </motion.div>
              )}
              {today && showNow && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[3]" style={{ top: yOf(nowMin) }}>
                  <span className="absolute left-0 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red" />
                  <span className="absolute inset-x-0 h-[1.5px] -translate-y-1/2 bg-red" />
                </div>
              )}
            </div>
          );
        })}

        {showNow && (
          <span
            aria-hidden
            className="pointer-events-none absolute z-[3] -translate-y-1/2 pr-1.5 text-right text-[11px] font-semibold leading-[14px] text-red tnum"
            style={{ top: yOf(nowMin), right: `calc(100% - ${GUTTER}px)` }}
          >
            {hm(nowMin)}
          </span>
        )}
      </div>
    </div>
  );
}

function WeekBlock({ a, lane, top, height, now, showText, onOpen }: {
  a: Appointment; lane: number; top: number; height: number; now: Date; showText: boolean; onOpen: (id: string) => void;
}) {
  const { patient, service, staff, unit } = expand(a);
  const sk = statusOf(a, now);
  const look = blockLook(sk, staff.tone);
  return (
    <motion.button
      type="button"
      data-block=""
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.14 } }}
      whileTap={tapSoft}
      onClick={e => { e.stopPropagation(); onOpen(a.id); }}
      title={`${hm(a.start)}–${hm(a.end)}　${patient.name}（${service.short}・${staff.short}・${unit.short}）`}
      aria-label={`${hm(a.start)}から ${patient.name} ${service.name} ${unit.name}`}
      className={cn("absolute z-[1] flex flex-col overflow-hidden rounded-[4px] text-left transition-[filter] hover:z-[2] hover:brightness-[0.96]", look.box)}
      style={{ top, height, left: `calc(${lane * 25}% + 1px)`, width: "calc(25% - 2px)" }}
    >
      {look.tint && <span aria-hidden className={cn("absolute inset-0", look.tint)} />}
      {look.edge && <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[2px]", look.edge)} />}
      {showText && height >= 16 && (
        <span className={cn("relative block overflow-hidden whitespace-nowrap pl-[5px] pt-[3px] text-[10px] font-semibold leading-3", look.name)} style={{ textOverflow: "clip" }}>
          {patient.name.split(" ")[0]}
        </span>
      )}
      {sk === "late" && <span aria-hidden className="absolute right-[2px] top-[2px] h-[5px] w-[5px] rounded-full bg-red" />}
    </motion.button>
  );
}
