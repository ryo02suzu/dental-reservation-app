// PC・iPad の日表示。ユニット（または担当者）ごとの列に、15分単位の時間軸で予約を並べる
import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus } from "lucide-react";
import { staffById, units as UNITS, type Appointment, type TileTone } from "@/data";
import { hm, key } from "@/lib/format";
import { minutesOfDay } from "@/lib/clock";
import { Avatar, cn } from "@/ui";
import type { NewPrefill } from "../../context";
import { isActive } from "../../helpers";
import { ApptBlock, roleShort } from "./ApptBlock";
import { useWidth } from "./parts";
import {
  SLOT, SLOT_BOOK, blockedBands, floorTo, placeLanes, sessionsOf, staffColumns, staffOn, timeRange,
  useAssignments, type ColumnMode,
} from "./model";

export const HOUR_H = 80;
const PPM = HOUR_H / 60;
const GUTTER = 72;
const PAD_T = 12;
const PAD_B = 18;
/** Page の上のバーの高さ（PC） */
export const BAR_H = 52;
const HEAD_H = 52;

interface Col {
  id: string;
  title: string;
  /** 列が狭いときの見出し（「U1 佐伯」） */
  short: string;
  sub: ReactNode;
  /** 列が狭いときの2段目（職種だけ） */
  shortSub: string;
  /** 列の主（ユニット列＝主担当、担当者列＝ふだんのユニット）。ブロックで繰り返さない */
  main?: string;
  avatar?: { name: string; tone: TileTone };
  count: number;
  list: Appointment[];
  active: Appointment[];
  prefill: Pick<NewPrefill, "unitId" | "staffId">;
}

/** いちばん近いスクロールする親（Page の本体） */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if (o === "auto" || o === "scroll") return p;
  }
  return null;
}

export function DayGrid({ date, dk, appts, mode, showCancelled, now, dir, onOpen, onNew }: {
  date: Date;
  dk: string;
  appts: Appointment[];
  mode: ColumnMode;
  showCancelled: boolean;
  now: Date;
  /** 直前の移動の向き（-1 前へ / 1 次へ）。中身を少し横から出す */
  dir: number;
  onOpen: (id: string) => void;
  onNew: (p: NewPrefill) => void;
}) {
  const { staffOfUnit, unitOfStaff } = useAssignments();
  const [r0, r1] = useMemo(() => timeRange([date], appts), [date, appts]);
  const sessions = useMemo(() => sessionsOf(date), [date]);
  const bands = useMemo(() => blockedBands(date, [r0, r1]), [date, r0, r1]);
  const yOf = (t: number) => PAD_T + (t - r0) * PPM;
  const height = PAD_T + (r1 - r0) * PPM + PAD_B;

  const cols: Col[] = useMemo(() => {
    const visible = (a: Appointment) => showCancelled || isActive(a);
    if (mode === "unit") {
      return UNITS.map(u => {
        const ids = staffOn(u.id, appts);
        const main = ids[0] ?? staffOfUnit.get(u.id);
        const st = main ? staffById(main) : undefined;
        const mine = appts.filter(a => a.unitId === u.id);
        return {
          id: u.id,
          title: u.name,
          short: st ? `${u.short} ${st.short}` : u.short,
          sub: st ? <>{st.short} · <Role role={st.role} />{ids.length > 1 ? ` ほか${ids.length - 1}名` : ""}</> : "担当なし",
          shortSub: st ? `${roleShort(st.role)}${ids.length > 1 ? ` ほか${ids.length - 1}` : ""}` : "担当なし",
          main,
          avatar: st ? { name: st.name, tone: st.tone } : undefined,
          count: mine.filter(isActive).length,
          list: mine.filter(visible),
          active: mine.filter(isActive),
          prefill: { unitId: u.id, staffId: main },
        };
      });
    }
    return staffColumns(appts).map(s => {
      const mine = appts.filter(a => a.staffId === s.id);
      const unitCount = new Map<string, number>();
      for (const a of mine) if (isActive(a)) unitCount.set(a.unitId, (unitCount.get(a.unitId) ?? 0) + 1);
      const unitId = [...unitCount.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? unitOfStaff.get(s.id);
      const unit = UNITS.find(u => u.id === unitId);
      return {
        id: s.id,
        title: s.name,
        short: unit ? `${s.short} ${unit.short}` : s.short,
        sub: <><Role role={s.role} />{unit ? ` · ${unit.short}` : ""}</>,
        shortSub: roleShort(s.role),
        main: unitId,
        avatar: { name: s.name, tone: s.tone },
        count: mine.filter(isActive).length,
        list: mine.filter(visible),
        active: mine.filter(isActive),
        prefill: { staffId: s.id, unitId },
      };
    });
  }, [mode, appts, showCancelled, staffOfUnit, unitOfStaff]);

  const placed = useMemo(() => new Map(cols.map(c => [c.id, placeLanes(c.list)])), [cols]);

  // 列の幅（iPad縦などで狭いときは、見出しとブロックの中身を詰める）
  const [wrapRef, wrapW] = useWidth<HTMLDivElement>();
  const colW = wrapW ? (wrapW - GUTTER - 12) / cols.length : 300;
  const tightHead = colW < 180;

  // ─── 空いている時間：ホバーで「+ 10:30」、クリックで新規予約 ───
  const nowMin = minutesOfDay(now);
  const todayKey = key(now);
  const isToday = dk === todayKey;
  // 今日は「いまの15分」から、過去の日は受け付けない
  const from = dk < todayKey ? Infinity : isToday ? floorTo(nowMin) : 0;
  const [ghost, setGhost] = useState<{ col: string; start: number; len: number } | null>(null);

  const slotAt = (c: Col, t: number) => {
    if (t < from) return null;
    const ses = sessions.find(([s, e]) => t >= s && t + SLOT <= e);
    if (!ses) return null;
    const busy = (s: number, e: number) => c.active.some(a => a.start < e && a.end > s);
    if (busy(t, t + SLOT)) return null;
    return { start: t, len: t + SLOT_BOOK <= ses[1] && !busy(t, t + SLOT_BOOK) ? SLOT_BOOK : SLOT };
  };
  const timeAt = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return r0 + floorTo((e.clientY - r.top - PAD_T) / PPM);
  };
  const onMove = (c: Col) => (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-block]")) { if (ghost) setGhost(null); return; }
    const s = slotAt(c, timeAt(e));
    if (!s) { if (ghost) setGhost(null); return; }
    if (!ghost || ghost.col !== c.id || ghost.start !== s.start || ghost.len !== s.len) setGhost({ col: c.id, ...s });
  };
  const onClickCol = (c: Col) => (e: MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const s = slotAt(c, timeAt(e));
    if (s) onNew({ date: dk, start: s.start, ...c.prefill });
  };

  // ─── 開いたとき「いま」が見える位置へ ───
  const bodyRef = useRef<HTMLDivElement>(null);
  const showNow = isToday && nowMin >= r0 && nowMin <= r1;
  useLayoutEffect(() => {
    if (!showNow) return;
    const el = bodyRef.current;
    const sc = scrollParent(el);
    if (!el || !sc) return;
    const y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop + yOf(minutesOfDay(now));
    const top = sc.scrollTop + BAR_H + HEAD_H;
    const bottom = sc.scrollTop + sc.clientHeight;
    if (y < top + 24 || y > bottom - 120) sc.scrollTo({ top: Math.max(0, y - BAR_H - HEAD_H - 140) });
    // 日付が変わったときだけ動かす（「いま」の更新では動かさない）
  }, [dk, showNow]);

  const hours: number[] = [];
  for (let t = Math.ceil(r0 / 60) * 60; t <= r1; t += 60) hours.push(t);
  const template = { gridTemplateColumns: `${GUTTER}px repeat(${cols.length}, minmax(0, 1fr))` };
  const total = cols.reduce((s, c) => s + c.count, 0);

  return (
    <div ref={wrapRef} className="bg-surface">
      {/* 列の見出し（スクロールしても上に残る）。狭いときはアバターを外し「U1 佐伯／Dr · 11件」の2段にする */}
      <div className="hairline-b sticky z-20 grid bg-surface pr-3" style={{ ...template, top: BAR_H, height: HEAD_H }}>
        <div />
        {cols.map(c => (
          tightHead ? (
            <div key={c.id} className="flex min-w-0 flex-col justify-center pl-2.5 pr-2" title={`${c.title}（${c.count}件）`}>
              <span className="truncate text-[13px] font-semibold leading-4 palt">{c.short}</span>
              <span className="mt-0.5 truncate text-[12px] leading-4 text-label2 tnum">{c.shortSub} · {c.count}件</span>
            </div>
          ) : (
            <div key={c.id} className="flex min-w-0 items-center gap-2.5 pl-3 pr-2.5">
              {c.avatar && <Avatar name={c.avatar.name} tone={c.avatar.tone} size={28} />}
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-2">
                  <span className="min-w-0 truncate text-[13px] font-semibold leading-4 palt">{c.title}</span>
                  <span className="ml-auto shrink-0 text-[12px] leading-4 text-label3 tnum">{c.count}件</span>
                </div>
                <div className="mt-0.5 truncate text-[12px] leading-4 text-label2">{c.sub}</div>
              </div>
            </div>
          )
        ))}
      </div>

      <div ref={bodyRef} className="relative grid pr-3" style={{ ...template, height }}>
        {/* 時刻の目盛り */}
        <div className="relative select-none">
          {hours.map(t => {
            const hide = showNow && Math.abs(t - nowMin) * PPM < 13;
            return (
              <span
                key={t}
                className={cn("absolute right-2.5 text-[12px] leading-[14px] text-label2 tnum transition-opacity", hide && "opacity-0")}
                style={{ top: yOf(t) - 7 }}
              >
                {hm(t)}
              </span>
            );
          })}
        </div>

        {/* 罫線・昼休み・時間外（予約の下に敷く） */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: GUTTER, right: 12 }}>
          {hours.map(t => (
            <span key={t} className="absolute inset-x-0 h-px origin-top scale-y-50 bg-sep/30" style={{ top: yOf(t) }} />
          ))}
          {hours.slice(0, -1).map(t => (
            <span key={`h${t}`} className="absolute inset-x-0 h-px origin-top scale-y-50 bg-sep/12" style={{ top: yOf(t + 30) }} />
          ))}
          {bands.map(b => (
            <div key={b.start} className="hatch absolute inset-x-0" style={{ top: yOf(b.start), height: (b.end - b.start) * PPM }} />
          ))}
        </div>

        {/* 列（ユニット or 担当者） */}
        {cols.map(c => {
          const g = ghost?.col === c.id ? ghost : null;
          return (
            <div
              key={c.id}
              className={cn("hairline-l relative", g && "cursor-pointer")}
              onMouseMove={onMove(c)}
              onMouseLeave={() => setGhost(null)}
              onClick={onClickCol(c)}
            >
              <motion.div
                key={dk}
                className="absolute inset-0"
                initial={{ opacity: 0, x: dir * 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 38 }}
              >
                <AnimatePresence initial={false}>
                  {placed.get(c.id)!.map(p => (
                    <ApptBlock
                      key={p.a.id}
                      a={p.a}
                      top={yOf(p.a.start) + 1}
                      height={(p.a.end - p.a.start) * PPM - 2}
                      lane={p.lane}
                      lanes={p.lanes}
                      mode={mode}
                      now={now}
                      onOpen={onOpen}
                      colMain={c.main}
                      narrow={colW / p.lanes < 160}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
              <AnimatePresence>
                {g && (
                  <motion.div
                    key="ghost"
                    aria-hidden
                    className="pointer-events-none absolute left-[2px] right-[5px] z-[1] flex items-start overflow-hidden rounded-[6px] border border-dashed border-accent/55 bg-sand/12 px-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, top: yOf(g.start) + 1, height: g.len * PPM - 2 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ type: "spring", stiffness: 900, damping: 60 }}
                    style={{ top: yOf(g.start) + 1, height: g.len * PPM - 2 }}
                  >
                    <span className="text-[12px] font-semibold leading-[17px] text-accent tnum">+ {hm(g.start)}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* 昼休み・時間外のラベル（列の罫線より上に） */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 z-[2]" style={{ left: GUTTER, right: 12 }}>
          {bands.map(b => (
            <div key={b.start} className="absolute inset-x-0 flex items-center justify-center" style={{ top: yOf(b.start), height: (b.end - b.start) * PPM }}>
              <span className="rounded-full bg-surface px-2.5 py-[3px] text-[12px] font-medium leading-4 text-label2 tnum shadow-[0_0_0_0.5px_rgb(var(--separator)/0.25)]">
                {b.label}
                <span className="ml-1.5 text-label3">{hm(b.start)}〜{hm(b.end)}</span>
              </span>
            </div>
          ))}
        </div>

        {/* いまの線 */}
        {showNow && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[3]" style={{ top: yOf(nowMin) }}>
            <span className="absolute -translate-y-1/2 pr-1.5 text-[11px] font-semibold leading-[14px] text-red tnum" style={{ right: `calc(100% - ${GUTTER}px)` }}>
              {hm(nowMin)}
            </span>
            <span className="absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red" style={{ left: GUTTER }} />
            <span className="absolute h-[1.5px] -translate-y-1/2 bg-red" style={{ left: GUTTER, right: 12 }} />
          </div>
        )}

        {/* 予約が1件もない日 */}
        {total === 0 && !showCancelled && sessions.length > 0 && (
          <div className="pointer-events-none absolute z-[2] flex justify-center" style={{ left: GUTTER, right: 12, top: yOf(sessions[0][0] + 60) }}>
            <div className="flex items-center gap-3 rounded-cell bg-surface px-4 py-3 shadow-[0_0_0_0.5px_rgb(var(--separator)/0.25)]">
              <CalendarPlus className="h-5 w-5 text-label3" strokeWidth={1.9} />
              <div>
                <div className="text-[14px] font-semibold">予約はまだありません</div>
                <div className="text-[12px] text-label2">空いている時間をクリックすると予約を追加できます</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 職種。広い画面では「歯科衛生士」、狭い画面では「DH」 */
function Role({ role }: { role: string }) {
  const short = roleShort(role);
  if (short === role) return <>{role}</>;
  return (
    <>
      <span className="hidden xl:inline">{role}</span>
      <span className="xl:hidden">{short}</span>
    </>
  );
}
