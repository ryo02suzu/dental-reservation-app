import { differenceInCalendarDays, differenceInYears, format, parse } from "date-fns";
import { ja } from "date-fns/locale";

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export const key = (d: Date) => format(d, "yyyy-MM-dd");
export const fromKey = (k: string) => parse(k, "yyyy-MM-dd", new Date());

/** "11月18日" */
export const md = (d: Date) => format(d, "M月d日", { locale: ja });
/** "11月18日（水）" */
export const mdw = (d: Date) => `${md(d)}（${WEEKDAYS[d.getDay()]}）`;
/** "2026年11月18日 水曜日" */
export const longDate = (d: Date) => format(d, "yyyy年M月d日 EEEE", { locale: ja });
/** "水" */
export const wd = (d: Date) => WEEKDAYS[d.getDay()];

/** 分 → "9:05" */
export const hm = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
/** 分 → "09:05" */
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** "09:30" → 570 */
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** 分の長さ → "45分" / "1時間30分" */
export const duration = (min: number) =>
  min < 60 ? `${min}分` : `${Math.floor(min / 60)}時間${min % 60 ? `${min % 60}分` : ""}`;

/** 円表記 "¥12,800" */
export const yen = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

/** 相対日 "今日" "明日" "3日後" "昨日" "5日前" */
export function relDay(d: Date, base: Date): string {
  const n = differenceInCalendarDays(d, base);
  if (n === 0) return "今日";
  if (n === 1) return "明日";
  if (n === 2) return "明後日";
  if (n === -1) return "昨日";
  return n > 0 ? `${n}日後` : `${-n}日前`;
}

/** 経過のざっくり表現 "3日前" "2か月前" "1年前" */
export function ago(d: Date, base: Date): string {
  const days = differenceInCalendarDays(base, d);
  if (days <= 0) return "今日";
  if (days === 1) return "昨日";
  if (days < 30) return `${days}日前`;
  if (days < 365) return `${Math.floor(days / 30)}か月前`;
  return `${Math.floor(days / 365)}年前`;
}

export const age = (birth: Date, base: Date) => differenceInYears(base, birth);

/** カナ（全角カタカナ）の頭文字から五十音の行を返す */
const ROWS: [string, string][] = [
  ["ア", "アイウエオヴ"], ["カ", "カキクケコガギグゲゴ"], ["サ", "サシスセソザジズゼゾ"], ["タ", "タチツテトダヂヅデド"],
  ["ナ", "ナニヌネノ"], ["ハ", "ハヒフヘホバビブベボパピプペポ"], ["マ", "マミムメモ"], ["ヤ", "ヤユヨ"],
  ["ラ", "ラリルレロ"], ["ワ", "ワヲン"],
];
export function kanaRow(kana: string): string {
  const c = kana.charAt(0);
  for (const [row, chars] of ROWS) if (chars.includes(c)) return row;
  return "#";
}
export const KANA_ROWS = ROWS.map(r => r[0]);

/** ひらがなをカタカナに（検索で「たなか」でも「タナカ」に当たるように） */
export const toKatakana = (s: string) => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));

/** 患者の検索語に当たるか（氏名・ふりがな・診察券番号・電話番号の数字） */
export function matchesPatient(p: { name: string; kana: string; number: string; phone: string }, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const k = toKatakana(q).replace(/\s/g, "");
  const digits = q.replace(/\D/g, "");
  return (
    p.name.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
    p.kana.replace(/\s/g, "").includes(k) ||
    (digits.length >= 2 && (p.number.includes(digits) || p.phone.replace(/\D/g, "").includes(digits)))
  );
}

/** 歯の記号 "LR6" → "右下6番"（患者さんから見た左右） */
const QUAD_LABEL: Record<string, string> = { UR: "右上", UL: "左上", LR: "右下", LL: "左下" };
export const toothLabel = (k: string) => `${QUAD_LABEL[k.slice(0, 2)] ?? ""}${k.slice(2)}番`;

/** 歯式の記号の読み方 */
export const TOOTH_STATE_LABEL: Record<string, string> = {
  C: "むし歯", CR: "CR充填", In: "インレー", Cr: "クラウン", RCT: "根管治療済み", M: "欠損", Imp: "インプラント", Br: "ブリッジ", 観察: "要観察",
};
