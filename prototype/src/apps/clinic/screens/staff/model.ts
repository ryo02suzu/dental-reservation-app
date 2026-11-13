// シフトと勤怠の計算。今週は共有データ（shiftWeek）、ほかの週は同じ並びを曜日ごとに当てはめる。
import { addDays, addWeeks, startOfMonth, startOfWeek, subDays, subMonths, endOfMonth } from "date-fns";
import { HOURS, hoursFor, shiftWeek, staff, type ShiftCell } from "@/data";
import { TODAY } from "@/lib/clock";
import { getHolidayName } from "@/lib/holidays";
import { WEEKDAYS, key, md } from "@/lib/format";

export interface Cell extends ShiftCell {
  /** 休診日の理由（「木曜」「勤労感謝の日」など）。休診日でなければ undefined */
  closed?: string;
}

export const cellKey = (staffId: string, date: string) => `${staffId}|${date}`;

export function weekDays(offset: number): Date[] {
  const mon = addWeeks(startOfWeek(TODAY, { weekStartsOn: 1 }), offset);
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

export const weekLabel = (days: Date[]) => `${md(days[0])}〜${days[6].getMonth() === days[0].getMonth() ? `${days[6].getDate()}日` : md(days[6])}`;

/** 曜日（0=日）× スタッフ のいつもの勤務（今週のシフトから読み取る） */
const pattern = new Map<string, ShiftCell>();
for (const c of shiftWeek) {
  const d = new Date(`${c.date}T00:00:00`);
  if (HOURS[d.getDay()]) pattern.set(`${c.staffId}|${d.getDay()}`, c);
}

export function closedReason(d: Date): string | undefined {
  if (hoursFor(d)) return undefined;
  return getHolidayName(key(d)) ?? `${WEEKDAYS[d.getDay()]}曜`;
}

/** その日・その人の予定（編集前） */
export function baseCell(staffId: string, d: Date): Cell {
  const date = key(d);
  const closed = closedReason(d);
  if (closed) return { staffId, date, off: true, closed };
  const fromWeek = shiftWeek.find(c => c.staffId === staffId && c.date === date);
  if (fromWeek) return { ...fromWeek };
  const p = pattern.get(`${staffId}|${d.getDay()}`);
  const h = hoursFor(d)!;
  if (!p) return { staffId, date, start: h.am[0] - 15, end: h.pm[1] + 15 };
  if (p.off) return { staffId, date, off: true, note: p.note };
  // 土曜は午後が短いので、退勤もその日の診療時間に合わせる
  const end = p.end === 780 ? 780 : h.pm[1] + 15;
  return { staffId, date, start: p.start, end };
}

/** 昼休み（午前の終わり〜午後の始まり）と重なる分を除いた勤務時間（分） */
export function workMinutes(c: Pick<Cell, "start" | "end" | "off" | "date">): number {
  if (c.off || c.start === undefined || c.end === undefined) return 0;
  const h = hoursFor(new Date(`${c.date}T00:00:00`)) ?? HOURS[1]!;
  const lunch = Math.max(0, Math.min(c.end, h.pm[0]) - Math.max(c.start, h.am[1]));
  return c.end - c.start - lunch;
}

/** 分 → 「45時間」「8時間30分」 */
export const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}分`;
  return m ? `${h}時間${m}分` : `${h}時間`;
};

/** 毎回同じになる小さなばらつき（IDと日付から） */
function jitter(id: string, date: string, span: number) {
  let x = 0;
  for (const ch of id + date) x = (x * 33 + ch.charCodeAt(0)) % 9973;
  return (x % (span * 2 + 1)) - span;
}

export interface MonthSummary { staffId: string; days: number; total: number; overtime: number }

/** 今月（1日〜昨日）の勤怠のまとめ。月初で日がなければ先月 */
export function monthSummary(): { label: string; rows: MonthSummary[] } {
  let from = startOfMonth(TODAY);
  let to = subDays(TODAY, 1);
  if (to < from) { from = startOfMonth(subMonths(TODAY, 1)); to = endOfMonth(from); }
  const rows = staff.map(s => {
    let days = 0, total = 0, overtime = 0;
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      const c = baseCell(s.id, d);
      if (c.off) continue;
      const date = key(d);
      const m = workMinutes(c) + jitter(s.id, date, 4) * 5;
      days++;
      total += m;
      overtime += Math.max(0, m - 480);
    }
    return { staffId: s.id, days, total, overtime };
  });
  const sameMonth = from.getMonth() === to.getMonth();
  return { label: `${md(from)}〜${sameMonth ? `${to.getDate()}日` : md(to)}`, rows };
}

export interface LeaveRequest { id: string; staffId: string; date: string; reason: string; sent: string }

/** 届いている希望休の申請（来週・再来週の診療日から決まった日を選ぶ） */
export const initialRequests: LeaveRequest[] = (() => {
  const openOn = (offset: number, dow: number) => {
    const d = weekDays(offset).find(x => x.getDay() === dow)!;
    let x = d;
    while (closedReason(x)) x = addDays(x, 1);
    return key(x);
  };
  return [
    { id: "lr1", staffId: "s4", date: openOn(1, 3), reason: "子どもの学校行事のため", sent: md(subDays(TODAY, 2)) },
    { id: "lr2", staffId: "s3", date: openOn(2, 6), reason: "通院のため", sent: md(subDays(TODAY, 1)) },
  ];
})();
