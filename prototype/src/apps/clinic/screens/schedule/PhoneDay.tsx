// スマホの日表示：上に週の帯（左右にスワイプで週を移動）、下に1列の予定表
import { forwardRef, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronRight, Globe, MessageCircle, Plus, TriangleAlert } from "lucide-react";
import { units as UNITS, type Appointment } from "@/data";
import { TODAY_KEY, minutesOfDay } from "@/lib/clock";
import { WEEKDAYS, duration, hm, key } from "@/lib/format";
import { ListSection, StatusPill, Tag, cn, springSoft, tapSoft } from "@/ui";
import type { NewPrefill } from "../../context";
import { alertsOf, expand, isActive, statusOf } from "../../helpers";
import { serviceLabel } from "./ApptBlock";
import { ClosedDay } from "./ClosedDay";
import { LoadDots, UnitChip } from "./parts";
import { SLOT_BOOK, bookableFrom, closedInfo, dayStat, freeIntervals, sessionsOf, weekDays } from "./model";

const EMPTY: Appointment[] = [];

// ─── 週の帯 ─────────────────────────────────────────────────────────────────
export function WeekStrip({ date, byDate, now, onSelect, onWeek }: {
  date: Date;
  byDate: Map<string, Appointment[]>;
  now: Date;
  onSelect: (d: Date) => void;
  /** -1 前の週 / 1 次の週 */
  onWeek: (n: number) => void;
}) {
  const days = weekDays(date);
  const weekKey = key(days[0]);
  const selected = key(date);
  const dragged = useRef(false);
  const prev = useRef(weekKey);
  const dir = weekKey > prev.current ? 1 : weekKey < prev.current ? -1 : 0;
  prev.current = weekKey;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -48 || info.velocity.x < -400) onWeek(1);
    else if (info.offset.x > 48 || info.velocity.x > 400) onWeek(-1);
    setTimeout(() => { dragged.current = false; }, 0);
  };

  return (
    <div className="material hairline-b sticky top-11 z-20 -mx-4 overflow-hidden px-1.5 pb-2 pt-1.5">
      <AnimatePresence initial={false} mode="popLayout" custom={dir}>
        <motion.div
          key={weekKey}
          custom={dir}
          variants={{
            enter: (k: number) => ({ x: k * 60, opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (k: number) => ({ x: k * -60, opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={springSoft}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragStart={() => { dragged.current = true; }}
          onDragEnd={onDragEnd}
          className="grid touch-pan-y grid-cols-7"
        >
          {days.map(d => {
            const dk = key(d);
            const closed = !!closedInfo(d);
            const st = dayStat(dk, byDate.get(dk) ?? EMPTY, now);
            const isSel = dk === selected;
            const isToday = dk === TODAY_KEY;
            return (
              <button
                key={dk}
                onClick={() => { if (!dragged.current) onSelect(d); }}
                aria-label={`${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）${closed ? " 休診" : ` 予約${st.count}件`}`}
                aria-pressed={isSel}
                className="flex h-[66px] flex-col items-center justify-start pt-0.5"
              >
                <span className={cn("text-[11px] font-medium leading-[14px]", closed ? "text-label3" : "text-label2")}>{WEEKDAYS[d.getDay()]}</span>
                <span
                  className={cn(
                    "mt-1 flex h-[32px] w-[32px] items-center justify-center rounded-full text-[17px] tnum transition-colors duration-200",
                    isSel ? (isToday ? "bg-accent font-semibold text-onink" : "bg-ink font-semibold text-onink") : isToday ? "font-semibold text-accent" : closed ? "text-label3" : "text-label",
                  )}
                >
                  {d.getDate()}
                </span>
                <span className="mt-[5px] flex h-[10px] items-center">
                  {closed ? <span className="text-[9px] leading-[10px] text-label3">休</span> : <LoadDots util={st.util} />}
                </span>
              </button>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── 予定表 ─────────────────────────────────────────────────────────────────
type Item =
  | { kind: "appt"; a: Appointment; t: number }
  | { kind: "gap"; units: string[]; start: number; end: number; t: number };

/** 時刻の列の幅（今日の「これから」・共有の ApptRow と同じ 3.25rem） */
const ROW = "grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4";
/** 行の区切り線の始まり（左16px＋時刻の列＋間12px） */
const SEP = "pointer-events-none absolute bottom-0 left-[5rem] right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden";

/** ユニットの絞り込みとキャンセルの表示は、右上のメニュー（PhoneSchedule）で切り替える */
export function PhoneAgenda({ date, dk, appts, now, unit, showCancelled, dir, onOpen, onNew, onJump, nowRef }: {
  date: Date;
  dk: string;
  appts: Appointment[];
  now: Date;
  unit: string;
  showCancelled: boolean;
  dir: number;
  onOpen: (id: string) => void;
  onNew: (p: NewPrefill) => void;
  onJump: (d: Date) => void;
  nowRef: RefObject<HTMLDivElement>;
}) {
  const [showDone, setShowDone] = useState(false);
  const sessions = useMemo(() => sessionsOf(date), [date]);
  const closed = closedInfo(date);
  const isToday = dk === TODAY_KEY;
  const nowMin = minutesOfDay(now);

  const { am, pm, done, counts } = useMemo(() => {
    const inUnit = (a: Appointment) => unit === "all" || a.unitId === unit;
    // 今日は、終わった予約（完了・無断キャンセル・キャンセル）をすべて「終わった予約」に畳む（今日の画面と同じ数え方）
    const isDone = (a: Appointment) => isToday && (a.status === "completed" || a.status === "no_show" || a.status === "cancelled");
    const list = appts.filter(a => inUnit(a) && (showCancelled || isActive(a) || isDone(a)));
    const items: Item[] = list.map(a => ({ kind: "appt", a, t: a.start }));
    // 空き（30分以上）。すべてのときは、同じ時間に空いているユニットを1行にまとめる
    const from = bookableFrom(dk, now);
    if (from !== Infinity && sessions.length) {
      const byRange = new Map<string, Item & { kind: "gap" }>();
      for (const u of UNITS) {
        if (unit !== "all" && u.id !== unit) continue;
        for (const [s, e] of freeIntervals(appts.filter(a => a.unitId === u.id && isActive(a)), sessions, from)) {
          if (e - s < SLOT_BOOK) continue;
          const k = `${s}-${e}`;
          const g = byRange.get(k);
          if (g) g.units.push(u.id);
          else byRange.set(k, { kind: "gap", units: [u.id], start: s, end: e, t: s });
        }
      }
      items.push(...byRange.values());
    }
    const order = (x: Item) => (x.kind === "appt" ? UNITS.findIndex(u => u.id === x.a.unitId) : 10);
    items.sort((x, y) => x.t - y.t || order(x) - order(y));
    const doneItem = (x: Item) => x.kind === "appt" && isDone(x.a);
    const done = items.filter(doneItem);
    const visible = showDone ? items : items.filter(x => !doneItem(x));
    const split = sessions[0]?.[1] ?? 780;
    return {
      am: visible.filter(x => x.t < split),
      pm: visible.filter(x => x.t >= split),
      done,
      counts: {
        am: list.filter(a => isActive(a) && a.start < split).length,
        pm: list.filter(a => isActive(a) && a.start >= split).length,
      },
    };
  }, [appts, unit, showCancelled, dk, now, sessions, isToday, showDone]);

  if (closed) {
    return (
      <div className="mt-4">
        <ClosedDay date={date} onJump={onJump} phone />
      </div>
    );
  }

  const [s0, s1] = sessions;
  const nowIn = !isToday ? null : nowMin < s0[1] ? "am" : nowMin < s1[0] ? "lunch" : nowMin <= s1[1] + 30 ? "pm" : null;

  const renderItems = (list: Item[], section: "am" | "pm") => {
    const rows: ReactNode[] = [];
    let marked = nowIn !== section;
    const marker = <NowMarker key="now" ref={nowRef} label={hm(nowMin)} />;
    if (section === "am" && done.length > 0) {
      rows.push(<DoneToggle key="done" n={done.length} open={showDone} onToggle={() => setShowDone(v => !v)} />);
    }
    for (const it of list) {
      if (!marked && it.t > nowMin) { rows.push(marker); marked = true; }
      rows.push(it.kind === "appt"
        ? <AgendaRow key={it.a.id} a={it.a} now={now} onOpen={onOpen} />
        : <FreeRow key={`g${it.start}-${it.units.join()}`} g={it} onNew={() => onNew({ date: dk, start: it.start, unitId: it.units[0] })} />);
    }
    if (!marked) rows.push(marker);
    if (!list.length && !(section === "am" && done.length)) rows.push(<div key="empty" className="px-4 py-3 text-[15px] text-label3">予約はありません</div>);
    return rows;
  };

  return (
    <div>
      <motion.div
        key={`${dk}:${unit}`}
        initial={{ opacity: 0, x: dir * 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 40 }}
      >
        <ListSection header={<span className="tnum">午前 {hm(s0[0])}〜{hm(s0[1])}</span>} aside={<span className="text-footnote text-label3 tnum">{counts.am}件</span>} className="mt-4">
          {renderItems(am, "am")}
        </ListSection>
        <div className="hatch mt-3 flex h-9 items-center justify-center gap-2 rounded-[10px]">
          <span className="rounded-full bg-bg px-2.5 py-[3px] text-[12px] font-medium leading-4 text-label2 tnum">
            昼休み {hm(s0[1])}〜{hm(s1[0])}
          </span>
          {nowIn === "lunch" && (
            <div ref={nowRef} className="rounded-full bg-red px-2 py-[3px] text-[12px] font-semibold leading-4 text-white tnum">{hm(nowMin)}</div>
          )}
        </div>
        <ListSection header={<span className="tnum">午後 {hm(s1[0])}〜{hm(s1[1])}</span>} aside={<span className="text-footnote text-label3 tnum">{counts.pm}件</span>} className="mt-3">
          {renderItems(pm, "pm")}
        </ListSection>
      </motion.div>
    </div>
  );
}

const SRC = { web: Globe, line: MessageCircle } as const;

/** 予約1件の行（時刻｜ユニットの札＋氏名・メニュー｜状態）。確定済みの「予約」には札を付けない（今日の「これから」と同じ） */
function AgendaRow({ a, now, onOpen }: { a: Appointment; now: Date; onOpen: (id: string) => void }) {
  const { patient, service, staff, unit } = expand(a);
  const sk = statusOf(a, now);
  const muted = sk === "completed" || sk === "cancelled" || sk === "no_show";
  const gone = sk === "cancelled" || sk === "no_show";
  const red = alertsOf(patient).filter(x => x.tone === "red");
  const Src = a.source === "web" || a.source === "line" ? SRC[a.source] : null;
  return (
    <motion.button
      whileTap={tapSoft}
      transition={{ type: "spring", stiffness: 600, damping: 34 }}
      onClick={() => onOpen(a.id)}
      className={cn(ROW, "group relative min-h-[60px] py-2.5 text-left transition-colors active:bg-fill/12")}
    >
      <span className={cn("leading-tight tnum", muted && "opacity-55")}>
        <span className="block text-[16px] font-semibold">{hm(a.start)}</span>
        <span className="block text-[12px] text-label3">{hm(a.end)}</span>
      </span>
      <span className={cn("flex min-w-0 items-center gap-3", muted && "opacity-55")}>
        <UnitChip label={unit.short} tone={staff.tone} />
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn("truncate text-[16px] font-medium", gone && "line-through decoration-red/50")}>{patient.name}</span>
            {a.firstVisit && !gone && <Tag tone="accent" className="shrink-0">初診</Tag>}
            {red.length > 0 && !muted && (
              <TriangleAlert className="h-[13px] w-[13px] shrink-0 text-red" strokeWidth={2.4} aria-label={`注意：${red.map(x => x.label).join("、")}`} />
            )}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px] text-label2">
            <span className="truncate">{serviceLabel(a, service)}</span>
            <span className="text-label4">·</span>
            <span className="shrink-0">{staff.short}</span>
            {Src && <Src className="ml-0.5 h-3.5 w-3.5 shrink-0 text-label3" strokeWidth={2} />}
          </span>
        </span>
      </span>
      {sk !== "confirmed" ? <StatusPill status={sk} compact /> : <span />}
      <span aria-hidden className={SEP} />
    </motion.button>
  );
}

/** 空き時間の行。押すとその時刻・ユニットで新規予約 */
function FreeRow({ g, onNew }: { g: { units: string[]; start: number; end: number }; onNew: () => void }) {
  const names = g.units.map(id => UNITS.find(u => u.id === id)?.short ?? id);
  return (
    <motion.button
      whileTap={tapSoft}
      transition={{ type: "spring", stiffness: 600, damping: 34 }}
      onClick={onNew}
      aria-label={`空き ${hm(g.start)}から${hm(g.end)} ${names.join("・")} に予約を追加`}
      className={cn(ROW, "group relative py-2 text-left transition-colors active:bg-fill/12")}
    >
      <span className="text-[13px] text-label3 tnum">{hm(g.start)}</span>
      <span className="flex min-w-0 items-center gap-3">
        <UnitChip label={names.length > 1 ? `${names.length}台` : names[0]} dashed />
        <span className="min-w-0">
          <span className="block truncate text-[15px] text-label2">
            空き <span className="text-label tnum">{hm(g.start)}〜{hm(g.end)}</span>
          </span>
          <span className="block truncate text-[12px] text-label3 tnum">{names.join("・")} · {duration(g.end - g.start)}</span>
        </span>
      </span>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sand/25 text-accent">
        <Plus className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <span aria-hidden className={SEP} />
    </motion.button>
  );
}

/** いまの位置（赤い線） */
const NowMarker = forwardRef<HTMLDivElement, { label: string }>(function NowMarker({ label }, ref) {
  return (
    <div ref={ref} className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-x-3 px-4 py-1" aria-label={`現在時刻 ${label}`}>
      <span className="text-[12px] font-semibold leading-4 text-red tnum">{label}</span>
      <span className="relative -mr-4 h-[1.5px] bg-red">
        <span className="absolute -left-[3px] top-1/2 h-[8px] w-[8px] -translate-y-1/2 rounded-full bg-red" />
      </span>
    </div>
  );
});

/** 今日の、終わった予約（完了・無断キャンセル・キャンセル）をまとめた行。呼び方と数え方は今日の画面と同じ */
function DoneToggle({ n, open, onToggle }: { n: number; open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-expanded={open} className="group relative flex min-h-[44px] w-full items-center gap-x-3 px-4 py-2 text-left transition-colors active:bg-fill/12">
      <span className="flex-1 text-[15px] text-label2">
        終わった予約 <span className="text-label3 tnum">{n}件</span>
      </span>
      <motion.span animate={{ rotate: open ? 90 : 0 }} transition={springSoft} className="text-label3">
        <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.4} />
      </motion.span>
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </button>
  );
}
