// 予約台帳の計算（描画から切り離した純粋な関数と、ストアを読む小さなフック）
import { useMemo } from "react";
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { hoursFor, staff as STAFF, units as UNITS, type Appointment, type Staff, type TileTone } from "@/data";
import { isClinicOpenDay, minutesOfDay } from "@/lib/clock";
import { getHolidayName } from "@/lib/holidays";
import { WEEKDAYS, fromKey, key, md, mdw } from "@/lib/format";
import { useStore } from "@/lib/store";
import { isActive, statusOf } from "../../helpers";

export type View = "day" | "week" | "month";
export type ColumnMode = "unit" | "staff";

/** 台帳の最小単位（分） */
export const SLOT = 15;
/** 予約を受けられる最短の長さ＝空き1枠（分） */
export const SLOT_BOOK = 30;

export const floorTo = (m: number, step = SLOT) => Math.floor(m / step) * step;
export const ceilTo = (m: number, step = SLOT) => Math.ceil(m / step) * step;

export const isDateKey = (s?: string): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromKey(s).getTime());

/** 診療の時間帯（午前・午後）。休診日は空 */
export function sessionsOf(d: Date): [number, number][] {
  const h = hoursFor(d);
  return h ? [h.am, h.pm] : [];
}

/** 休診の理由。診療日なら null */
export function closedInfo(d: Date): { label: string; reason: string; holiday?: string } | null {
  if (isClinicOpenDay(d)) return null;
  const holiday = getHolidayName(key(d));
  if (holiday) return { label: holiday, reason: `${holiday}（祝日）のため休診です`, holiday };
  const w = `${WEEKDAYS[d.getDay()]}曜日`;
  return { label: w, reason: `${w}は休診日です` };
}

/** 次（dir=-1 なら前）の診療日 */
export function nextOpenDay(d: Date, dir: 1 | -1 = 1): Date {
  let x = addDays(d, dir);
  for (let i = 0; i < 60 && !isClinicOpenDay(x); i++) x = addDays(x, dir);
  return x;
}

export const weekStartOf = (d: Date) => startOfWeek(d, { weekStartsOn: 1 });
export const weekDays = (d: Date) => Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(d), i));

/** 月曜始まりのカレンダー（前後の月の日も含めて週単位） */
export function monthMatrix(d: Date): Date[][] {
  const start = weekStartOf(startOfMonth(d));
  const end = endOfWeek(endOfMonth(d), { weekStartsOn: 1 });
  const rows: Date[][] = [];
  for (let x = start; x <= end; x = addDays(x, 7)) rows.push(Array.from({ length: 7 }, (_, i) => addDays(x, i)));
  return rows;
}

/** 見出し：日「11月13日（金）」／週「11月9日〜15日」／月「2026年11月」 */
export function periodTitle(view: View, d: Date): string {
  if (view === "day") return mdw(d);
  if (view === "week") {
    const s = weekStartOf(d);
    const e = addDays(s, 6);
    return s.getMonth() === e.getMonth() ? `${md(s)}〜${e.getDate()}日` : `${md(s)}〜${md(e)}`;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

export function shiftDate(view: View, d: Date, n: number): Date {
  if (view === "day") return addDays(d, n);
  if (view === "week") return addDays(d, 7 * n);
  return addMonths(d, n);
}

export const PERIOD_UNIT: Record<View, string> = { day: "日", week: "週", month: "月" };

/** busy を除いた空き時間（sessions の中、from より後） */
export function freeIntervals(busy: { start: number; end: number }[], sessions: [number, number][], from = 0): [number, number][] {
  const out: [number, number][] = [];
  const b = [...busy].sort((x, y) => x.start - y.start);
  for (const [s0, e0] of sessions) {
    let cur = Math.max(s0, from);
    if (cur >= e0) continue;
    for (const x of b) {
      if (x.end <= cur || x.start >= e0) continue;
      if (x.start > cur) out.push([cur, x.start]);
      cur = Math.max(cur, x.end);
      if (cur >= e0) break;
    }
    if (cur < e0) out.push([cur, e0]);
  }
  return out;
}

/** その日、予約を入れられるのは何分から（過去の日は Infinity） */
export function bookableFrom(dk: string, nowDate: Date): number {
  const today = key(nowDate);
  if (dk < today) return Infinity;
  if (dk > today) return 0;
  return ceilTo(minutesOfDay(nowDate));
}

export interface DayStat {
  key: string;
  date: Date;
  open: boolean;
  /** 有効な予約（キャンセル・無断キャンセルを除く） */
  count: number;
  /** これから入れられる30分の空き枠（ユニットごとの合計） */
  free: number;
  /** 診療時間に対する予約の埋まり具合 0〜1 */
  util: number;
  pending: number;
  first: number;
  late: number;
  cancelled: number;
  /** 診療時間×ユニット数（分）と、そのうち予約で埋まっている分 */
  cap: number;
  used: number;
}

export function dayStat(dk: string, appts: Appointment[], nowDate: Date): DayStat {
  const date = fromKey(dk);
  const sessions = sessionsOf(date);
  const active = appts.filter(isActive);
  const base = {
    key: dk, date, open: sessions.length > 0, count: active.length,
    pending: active.filter(a => a.status === "pending").length,
    first: active.filter(a => a.firstVisit).length,
    late: active.filter(a => statusOf(a, nowDate) === "late").length,
    cancelled: appts.length - active.length,
  };
  if (!sessions.length) return { ...base, free: 0, util: 0, cap: 0, used: 0 };
  const cap = sessions.reduce((s, [a, b]) => s + b - a, 0) * UNITS.length;
  let used = 0;
  for (const a of active) for (const [s, e] of sessions) used += Math.max(0, Math.min(a.end, e) - Math.max(a.start, s));
  const from = bookableFrom(dk, nowDate);
  let free = 0;
  if (from !== Infinity) {
    for (const u of UNITS) {
      for (const [s, e] of freeIntervals(active.filter(a => a.unitId === u.id), sessions, from)) free += Math.floor((e - s) / SLOT_BOOK);
    }
  }
  return { ...base, free, util: Math.min(1, used / cap), cap, used };
}

/** 期間（週・月）の合計 */
export function sumStats(days: DayStat[]) {
  const open = days.filter(d => d.open);
  const cap = open.reduce((s, d) => s + d.cap, 0);
  const used = open.reduce((s, d) => s + d.used, 0);
  return {
    openDays: open.length,
    count: days.reduce((s, d) => s + d.count, 0),
    free: days.reduce((s, d) => s + d.free, 0),
    pending: days.reduce((s, d) => s + d.pending, 0),
    late: days.reduce((s, d) => s + d.late, 0),
    util: cap ? Math.min(1, used / cap) : 0,
  };
}

/** 重なる予約を横に並べるためのレーン割り当て（同じ列の中で） */
export interface Placed { a: Appointment; lane: number; lanes: number }
export function placeLanes(list: Appointment[]): Placed[] {
  const sorted = [...list].sort((x, y) => x.start - y.start || (y.end - y.start) - (x.end - x.start) || Number(isActive(y)) - Number(isActive(x)));
  const out: Placed[] = [];
  let cluster: Placed[] = [];
  let ends: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    for (const p of cluster) p.lanes = ends.length;
    cluster = [];
    ends = [];
  };
  for (const a of sorted) {
    if (cluster.length && a.start >= clusterEnd) flush();
    let lane = ends.findIndex(e => e <= a.start);
    if (lane < 0) { lane = ends.length; ends.push(a.end); } else ends[lane] = a.end;
    const p: Placed = { a, lane, lanes: 1 };
    cluster.push(p);
    out.push(p);
    clusterEnd = Math.max(clusterEnd, a.end);
  }
  flush();
  return out;
}

/** 時間軸の範囲。診療時間を基本に、時間外の予約があれば1時間単位で広げる */
export function timeRange(days: Date[], appts: Appointment[]): [number, number] {
  let s = Infinity;
  let e = -Infinity;
  for (const d of days) {
    const h = hoursFor(d);
    if (h) { s = Math.min(s, h.am[0]); e = Math.max(e, h.pm[1]); }
  }
  if (s === Infinity) { s = 540; e = 1140; }
  for (const a of appts) {
    if (!isActive(a)) continue;
    s = Math.min(s, Math.floor(a.start / 60) * 60);
    e = Math.max(e, Math.ceil(a.end / 60) * 60);
  }
  return [s, e];
}

/** 斜線で示す時間（昼休み・時間外）。label は帯の中に出す短い言葉 */
export function blockedBands(d: Date, range: [number, number]): { start: number; end: number; label: string }[] {
  const h = hoursFor(d);
  if (!h) return [{ start: range[0], end: range[1], label: "休診" }];
  const out: { start: number; end: number; label: string }[] = [];
  if (range[0] < h.am[0]) out.push({ start: range[0], end: h.am[0], label: "時間外" });
  if (h.am[1] < h.pm[0]) out.push({ start: h.am[1], end: h.pm[0], label: "昼休み" });
  if (h.pm[1] < range[1]) out.push({ start: h.pm[1], end: range[1], label: "時間外" });
  return out;
}

/** 日付ごとの予約（開始順）。ストアの変更にそのまま追従する */
export function useByDate(): Map<string, Appointment[]> {
  const { appointments } = useStore();
  return useMemo(() => {
    const m = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const l = m.get(a.date);
      if (l) l.push(a);
      else m.set(a.date, [a]);
    }
    for (const l of m.values()) l.sort((x, y) => x.start - y.start || x.unitId.localeCompare(y.unitId));
    return m;
  }, [appointments]);
}

const TREATING = new Set<Staff["role"]>(["院長", "歯科医師", "歯科衛生士"]);

/** 担当者列：診療を担当する人＋その日に予約を持つ人 */
export function staffColumns(appts: Appointment[]): Staff[] {
  const ids = new Set(appts.filter(isActive).map(a => a.staffId));
  return STAFF.filter(s => TREATING.has(s.role) || ids.has(s.id));
}

/** ユニットと担当者のふだんの組み合わせ（予約の実績から） */
export function useAssignments() {
  const { appointments } = useStore();
  return useMemo(() => {
    const count = new Map<string, number>();
    for (const a of appointments) count.set(`${a.unitId}|${a.staffId}`, (count.get(`${a.unitId}|${a.staffId}`) ?? 0) + 1);
    const best = (filter: (u: string, s: string) => boolean) => {
      let top: [string, number] | undefined;
      for (const [k, n] of count) {
        const [u, s] = k.split("|");
        if (filter(u, s) && (!top || n > top[1])) top = [k, n];
      }
      return top?.[0].split("|");
    };
    const staffOfUnit = new Map<string, string>();
    const unitOfStaff = new Map<string, string>();
    for (const u of UNITS) { const r = best(x => x === u.id); if (r) staffOfUnit.set(u.id, r[1]); }
    for (const s of STAFF) { const r = best((_, y) => y === s.id); if (r) unitOfStaff.set(s.id, r[0]); }
    return { staffOfUnit, unitOfStaff };
  }, [appointments]);
}

/** その日にユニットへ入っている担当者（多い順） */
export function staffOn(unitId: string, appts: Appointment[]): string[] {
  const n = new Map<string, number>();
  for (const a of appts) if (a.unitId === unitId && isActive(a)) n.set(a.staffId, (n.get(a.staffId) ?? 0) + 1);
  return [...n.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
}

/** 稼働率から3段階の混み具合（週の帯・月のカレンダーの点） */
export const loadLevel = (util: number) => (util >= 0.85 ? 3 : util >= 0.6 ? 2 : util > 0 ? 1 : 0);

// ─── 色（スタッフの補助色）。Tailwind が拾えるようクラス名をそのまま書く ───
export const TONE_EDGE: Record<TileTone, string> = {
  sand: "bg-tile-sand", graphite: "bg-tile-graphite", slate: "bg-tile-slate", sage: "bg-tile-sage",
  clay: "bg-tile-clay", plum: "bg-tile-plum", ocean: "bg-tile-ocean", amber: "bg-tile-amber",
};
export const TONE_FILL: Record<TileTone, string> = {
  sand: "bg-tile-sand/14", graphite: "bg-tile-graphite/12", slate: "bg-tile-slate/14", sage: "bg-tile-sage/16",
  clay: "bg-tile-clay/14", plum: "bg-tile-plum/14", ocean: "bg-tile-ocean/14", amber: "bg-tile-amber/16",
};
export const TONE_FILL_STRONG: Record<TileTone, string> = {
  sand: "bg-tile-sand/28", graphite: "bg-tile-graphite/24", slate: "bg-tile-slate/28", sage: "bg-tile-sage/32",
  clay: "bg-tile-clay/28", plum: "bg-tile-plum/28", ocean: "bg-tile-ocean/28", amber: "bg-tile-amber/32",
};
export const TONE_TEXT: Record<TileTone, string> = {
  sand: "text-tile-sand", graphite: "text-tile-graphite", slate: "text-tile-slate", sage: "text-tile-sage",
  clay: "text-tile-clay", plum: "text-tile-plum", ocean: "text-tile-ocean", amber: "text-tile-amber",
};

/** 表示中の期間（日・週・月）の日ごとの数字と合計 */
export function usePeriodStats(view: View, date: Date, byDate: Map<string, Appointment[]>, nowDate: Date) {
  const days = useMemo(() => {
    if (view === "day") return [date];
    if (view === "week") return weekDays(date);
    return monthMatrix(date).flat().filter(d => d.getMonth() === date.getMonth());
  }, [view, date]);
  const stats = useMemo(() => days.map(d => dayStat(key(d), byDate.get(key(d)) ?? [], nowDate)), [days, byDate, nowDate]);
  const sum = useMemo(() => sumStats(stats), [stats]);
  return { days, stats, sum };
}
