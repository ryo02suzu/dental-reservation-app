import { differenceInCalendarDays } from "date-fns";
import { TODAY } from "@/lib/clock";
import { fromKey, mdw, toothLabel } from "@/lib/format";
import type { Memo, Quadrant } from "@/data";

/** 永久歯（1〜8）と乳歯（A〜E）。乳歯は共有の型にないので、この画面の中で広げて扱う */
export type PermanentKey = NonNullable<Memo["teeth"]>[number];
export type PrimaryKey = `${Quadrant}${"A" | "B" | "C" | "D" | "E"}`;
export type ToothKey = PermanentKey | PrimaryKey;
export type Dentition = "permanent" | "primary";

/** 日付の見出し：「今日」「昨日」「11月10日（火）」 */
export function dayLabel(k: string): string {
  const d = differenceInCalendarDays(TODAY, fromKey(k));
  if (d === 0) return "今日";
  if (d === 1) return "昨日";
  return mdw(fromKey(k));
}

/** よく書く言葉（押すと本文の末尾に足す） */
export const PHRASES = ["歯石除去", "TBI", "CR充填", "浸潤麻酔", "経過観察", "次回SRP", "痛み止め処方"];

/** 本文の末尾に言葉を足す。直前が句読点や改行でなければ区切りを入れる */
export function appendPhrase(body: string, phrase: string): string {
  const t = body.replace(/\s+$/, "");
  if (!t) return phrase;
  const last = t.charAt(t.length - 1);
  if ("。、・\n".includes(last)) return `${t}${phrase}`;
  const endsWithPhrase = PHRASES.some(p => t.endsWith(p));
  return `${t}${endsWithPhrase ? "・" : "。"}${phrase}`;
}

const num = (n: number) => n as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
const row = (left: Quadrant, right: Quadrant): ToothKey[] => [
  ...[8, 7, 6, 5, 4, 3, 2, 1].map(n => `${left}${num(n)}` as ToothKey),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(n => `${right}${num(n)}` as ToothKey),
];
/** 日本の歯式の並び（患者さんの右が見る人の左）。上の段：右上8→1｜左上1→8、下の段：右下8→1｜左下1→8 */
export const UPPER = row("UR", "UL");
export const LOWER = row("LR", "LL");
const prow = (left: Quadrant, right: Quadrant): ToothKey[] => [
  ...(["E", "D", "C", "B", "A"] as const).map(n => `${left}${n}` as ToothKey),
  ...(["A", "B", "C", "D", "E"] as const).map(n => `${right}${n}` as ToothKey),
];
/** 乳歯の並び：右上E→A｜左上A→E、右下E→A｜左下A→E */
export const UPPER_P = prow("UR", "UL");
export const LOWER_P = prow("LR", "LL");
const ORDER = [...UPPER, ...LOWER, ...UPPER_P, ...LOWER_P];
export const sortTeeth = <T extends string>(t: T[]) => [...t].sort((a, b) => ORDER.indexOf(a as ToothKey) - ORDER.indexOf(b as ToothKey));
export const isPrimary = (k: string) => /[A-E]$/.test(k);

/** 歯の呼び方：「右下6番」、乳歯は「右下E（乳歯）」 */
export function toothName(k: string): string {
  if (!isPrimary(k)) return toothLabel(k);
  return `${toothLabel(k).replace(/番$/, "")}（乳歯）`;
}
