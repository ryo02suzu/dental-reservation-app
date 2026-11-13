import { useEffect, useState } from "react";
import { format } from "date-fns";
import { isHoliday } from "./holidays";

// プロトタイプの「現在時刻」。午前の診療中の様子を見せるため、
// 今日（休診日なら次の診療日）の 10:42 を起点にして、実際の経過時間ぶん進める。
export const CLOSED_WEEKDAYS = new Set([0, 4]); // 日曜・木曜は休診

export function isClinicOpenDay(d: Date): boolean {
  return !CLOSED_WEEKDAYS.has(d.getDay()) && !isHoliday(format(d, "yyyy-MM-dd"));
}

function demoBase(): Date {
  const d = new Date();
  d.setHours(10, 42, 0, 0);
  while (!isClinicOpenDay(d)) d.setDate(d.getDate() + 1);
  return d;
}

const BASE = demoBase();
const LOADED_AT = Date.now();

export function now(): Date {
  return new Date(BASE.getTime() + (Date.now() - LOADED_AT));
}

export const TODAY: Date = (() => {
  const d = new Date(BASE);
  d.setHours(0, 0, 0, 0);
  return d;
})();

export const TODAY_KEY = format(TODAY, "yyyy-MM-dd");

/** 現在時刻を一定間隔で更新して返す（「いま」の線や待ち時間の表示用） */
export function useNow(intervalMs = 20_000): Date {
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setT(now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t;
}

/** 0:00 からの分 */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}
