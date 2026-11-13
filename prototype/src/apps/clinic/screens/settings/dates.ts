import { addDays } from "date-fns";
import { HOURS } from "@/data";
import { TODAY } from "@/lib/clock";
import { getHolidayName } from "@/lib/holidays";
import { key } from "@/lib/format";

/** 曜日の休診か祝日か */
export const closedOn = (d: Date) => !HOURS[d.getDay()] || !!getHolidayName(key(d));

/** 今日から先の祝日（holidays.ts の一覧から） */
export function upcomingHolidays(n: number): { date: Date; name: string }[] {
  const out: { date: Date; name: string }[] = [];
  for (let i = 0; i < 500 && out.length < n; i++) {
    const d = addDays(TODAY, i);
    const name = getHolidayName(key(d));
    if (name) out.push({ date: d, name });
  }
  return out;
}

/** 年末年始の休診（12月29日〜1月4日）。今年の分が終わっていれば来年の分 */
export function newYearRange(): [Date, Date] {
  const y = TODAY.getMonth() === 0 && TODAY.getDate() <= 4 ? TODAY.getFullYear() - 1 : TODAY.getFullYear();
  return [new Date(y, 11, 29), new Date(y + 1, 0, 4)];
}
