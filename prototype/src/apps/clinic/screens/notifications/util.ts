import { useEffect, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { BellRing, CalendarClock, CalendarX, Globe, Send, Settings2, Star } from "lucide-react";
import { minutesOfDay } from "@/lib/clock";
import { hm, md } from "@/lib/format";
import type { Notice, TileTone } from "@/data";
import type { LucideIcon } from "lucide-react";

/** 幅のメディアクエリ（共有の media.ts にない 1024px 以上の判定に使う） */
export function useMinWidth(px: number): boolean {
  const q = `(min-width: ${px}px)`;
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

export const KIND: Record<Notice["kind"], { icon: LucideIcon; tone: TileTone; label: string }> = {
  web: { icon: Globe, tone: "ocean", label: "Web予約" },
  cancel: { icon: CalendarX, tone: "clay", label: "キャンセル" },
  change: { icon: CalendarClock, tone: "amber", label: "予約変更" },
  recall: { icon: BellRing, tone: "sage", label: "リコール" },
  remind: { icon: Send, tone: "slate", label: "リマインド" },
  review: { icon: Star, tone: "plum", label: "口コミ" },
  system: { icon: Settings2, tone: "graphite", label: "Arche" },
};

export type DayGroup = "今日" | "昨日" | "それ以前";
export const groupOf = (at: Date, n: Date): DayGroup => {
  const d = differenceInCalendarDays(n, at);
  return d <= 0 ? "今日" : d === 1 ? "昨日" : "それ以前";
};

/** 一覧に出す相対時刻：「たった今」「4分前」「9:12」「昨日 9:12」「11月10日」 */
export function noticeTime(at: Date, n: Date): string {
  const mins = Math.floor((n.getTime() - at.getTime()) / 60_000);
  const d = differenceInCalendarDays(n, at);
  if (mins < 1) return "たった今";
  if (mins < 60 && d === 0) return `${mins}分前`;
  const t = hm(minutesOfDay(at));
  if (d === 0) return t;
  if (d === 1) return `昨日 ${t}`;
  return md(at);
}

/** 詳細に出す時刻：「今日 10:38（4分前）」「昨日 9:12」「11月10日 17:40」 */
export function noticeStamp(at: Date, n: Date): string {
  const d = differenceInCalendarDays(n, at);
  const t = hm(minutesOfDay(at));
  const mins = Math.floor((n.getTime() - at.getTime()) / 60_000);
  if (d === 0) return mins < 60 ? `今日 ${t}（${Math.max(0, mins)}分前）` : `今日 ${t}`;
  if (d === 1) return `昨日 ${t}`;
  return `${md(at)} ${t}`;
}
