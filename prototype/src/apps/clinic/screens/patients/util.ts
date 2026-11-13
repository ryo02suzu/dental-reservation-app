// 患者画面で使う、描画に依存しない計算（一覧の絞り込み・並び替え・歯式の並び・表示用の日付）。
import { addMonths, differenceInCalendarDays, format } from "date-fns";
import { TODAY, TODAY_KEY } from "@/lib/clock";
import { KANA_ROWS, ago, fromKey, hm, kanaRow, md, mdw, toothLabel } from "@/lib/format";
import { serviceById, type Appointment, type Memo, type Patient, type Quadrant, type ToothState, type VisitRecord } from "@/data";
import { alertsOf, isActive } from "@/apps/clinic/helpers";

export type ToothKey = keyof Patient["teeth"];
export type FilterKey = "all" | "today" | "recall" | "attention";
export type SortKey = "kana" | "recent";

/** ストアの予約から求めた、患者ごとの「いま」の情報 */
export interface PatientMeta {
  /** 次に来る予定の予約（今日まだ終わっていないものを含む） */
  next?: Appointment;
  /** 今日の有効な予約（キャンセル・無断キャンセル以外）で一番早いもの */
  today?: Appointment;
  lastVisit?: Date;
  nextRecall?: Date;
  visits: number;
  cancellations: number;
  noShows: number;
}

const byTime = (a: Appointment, b: Appointment) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1);

/** これから来る予約か（今日の診療中・来院済みも含む） */
export const isUpcoming = (a: Appointment) => isActive(a) && a.status !== "completed" && a.date >= TODAY_KEY;

export function metaOf(p: Patient, mine: Appointment[]): PatientMeta {
  let next: Appointment | undefined;
  let today: Appointment | undefined;
  let lastKey = "";
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  for (const a of mine) {
    if (a.status === "completed") {
      completed++;
      if (a.date > lastKey && a.date <= TODAY_KEY) lastKey = a.date;
    } else if (a.status === "cancelled") cancelled++;
    else if (a.status === "no_show") noShow++;
    if (a.date === TODAY_KEY && isActive(a) && (!today || a.start < today.start)) today = a;
    if (isUpcoming(a) && (!next || byTime(a, next) < 0)) next = a;
  }
  let lastVisit = p.lastVisit;
  if (lastKey) {
    const d = fromKey(lastKey);
    if (!lastVisit || d > lastVisit) lastVisit = d;
  }
  return {
    next,
    today,
    lastVisit,
    nextRecall: lastVisit ? addMonths(lastVisit, p.recallMonths) : p.nextRecall,
    visits: Math.max(p.visits, completed),
    cancellations: Math.max(p.cancellations, cancelled),
    noShows: Math.max(p.noShows, noShow),
  };
}

export const riskOfMeta = (m: PatientMeta) => m.cancellations + m.noShows;

export function inFilter(f: FilterKey, p: Patient, m: PatientMeta): boolean {
  switch (f) {
    case "all":
      return true;
    case "today":
      return !!m.today;
    case "recall":
      return !!m.nextRecall && Math.abs(differenceInCalendarDays(m.nextRecall, TODAY)) <= 30;
    case "attention":
      return alertsOf(p).length > 0 || riskOfMeta(m) >= 2;
  }
}

export const FILTER_NOTE: Record<FilterKey, string | undefined> = {
  all: undefined,
  today: "今日の予約がある患者さんです（キャンセルを除く）。",
  recall: "定期検診の時期が前後30日以内の患者さんです。",
  attention: "注意事項がある、またはキャンセルが2回以上ある患者さんです。",
};

// ─── 並び替えと見出し ─────────────────────────────────────────────────────
const collator = new Intl.Collator("ja");
/** カタカナ → ひらがな（見出しは「あ」「か」のようにひらがなで出す） */
export const hira = (s: string) => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

export interface Section {
  key: string;
  label: string;
  items: Patient[];
}

const RECENT: { key: string; label: string; max: number }[] = [
  { key: "d0", label: "今日", max: 0 },
  { key: "w1", label: "1週間以内", max: 7 },
  { key: "m1", label: "1か月以内", max: 31 },
  { key: "m3", label: "3か月以内", max: 92 },
  { key: "y1", label: "1年以内", max: 366 },
  { key: "old", label: "それ以前", max: Infinity },
];

export function sectionize(list: Patient[], sort: SortKey, meta: Map<string, PatientMeta>): Section[] {
  if (sort === "kana") {
    const groups = new Map<string, Patient[]>();
    for (const p of list) {
      const r = kanaRow(p.kana);
      const g = groups.get(r);
      if (g) g.push(p);
      else groups.set(r, [p]);
    }
    return [...KANA_ROWS, "#"]
      .filter(r => groups.has(r))
      .map(r => ({ key: r, label: hira(r), items: groups.get(r)!.sort((a, b) => collator.compare(a.kana, b.kana)) }));
  }
  const sorted = [...list].sort((a, b) => {
    const x = meta.get(a.id)?.lastVisit?.getTime() ?? -Infinity;
    const y = meta.get(b.id)?.lastVisit?.getTime() ?? -Infinity;
    return y - x || collator.compare(a.kana, b.kana);
  });
  const out: Section[] = RECENT.map(r => ({ key: r.key, label: r.label, items: [] }));
  const none: Section = { key: "none", label: "来院歴なし", items: [] };
  for (const p of sorted) {
    const lv = meta.get(p.id)?.lastVisit;
    if (!lv) {
      none.items.push(p);
      continue;
    }
    const days = differenceInCalendarDays(TODAY, lv);
    const i = RECENT.findIndex(r => days <= r.max);
    out[i].items.push(p);
  }
  return [...out, none].filter(s => s.items.length > 0);
}

// ─── 日付の表示 ───────────────────────────────────────────────────────────
/** "2024年2月28日" */
export const ymd = (d: Date) => format(d, "yyyy年M月d日");
/** 今年なら "11月10日（火）"、それ以外は "2025年10月27日" */
export const dateSmart = (d: Date) => (d.getFullYear() === TODAY.getFullYear() ? mdw(d) : ymd(d));
/** 予約の「いつ」: 今日 15:15 / 明日 9:30 / 11月18日 */
export function whenShort(a: Appointment): string {
  const n = differenceInCalendarDays(fromKey(a.date), TODAY);
  if (n === 0) return `今日 ${hm(a.start)}`;
  if (n === 1) return `明日 ${hm(a.start)}`;
  return md(fromKey(a.date));
}
/** 最終来院の短い表現 */
export const lastShort = (d?: Date) => (d ? ago(d, TODAY) : undefined);
/** メモの書かれた日時 */
export function memoWhen(m: Memo): string {
  const d = fromKey(m.date);
  const n = differenceInCalendarDays(TODAY, d);
  if (n === 0) return `今日 ${hm(m.at)}`;
  if (n === 1) return `昨日 ${hm(m.at)}`;
  if (d.getFullYear() === TODAY.getFullYear()) return `${md(d)} ${hm(m.at)}`;
  return ymd(d);
}

// ─── 歯式 ─────────────────────────────────────────────────────────────────
const NUMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
type N = (typeof NUMS)[number];
const tk = (q: Quadrant, n: N) => `${q}${n}` as ToothKey;
const DESC = [...NUMS].reverse() as N[];
/** 上の段（見る人から見て左が患者さんの右）：右上8…1 | 左上1…8 */
export const UPPER: ToothKey[] = [...DESC.map(n => tk("UR", n)), ...NUMS.map(n => tk("UL", n))];
/** 下の段：右下8…1 | 左下1…8 */
export const LOWER: ToothKey[] = [...DESC.map(n => tk("LR", n)), ...NUMS.map(n => tk("LL", n))];
export const ALL_TEETH: ToothKey[] = [...UPPER, ...LOWER];
export const toothNum = (k: ToothKey) => k.slice(2);
/** 凡例の並び（注意が要るもの → 処置済み → 欠損） */
export const STATE_ORDER: ToothState[] = ["C", "観察", "CR", "In", "Cr", "RCT", "Br", "Imp", "M"];

/** 歯をタップしたときに出す、その歯に関係する記録 */
export interface ToothNote {
  id: string;
  kind: "memo" | "visit" | "appt";
  date: Date;
  staffId?: string;
  title: string;
  body: string;
  apptId?: string;
  /** これからの予約 */
  future?: boolean;
}

export function notesForTooth(k: ToothKey, memos: Memo[], visits: VisitRecord[], appts: Appointment[]): ToothNote[] {
  const label = toothLabel(k);
  const out: ToothNote[] = [];
  for (const m of memos) {
    if (m.teeth?.includes(k) || m.body.includes(label)) out.push({ id: m.id, kind: "memo", date: fromKey(m.date), staffId: m.staffId, title: "診療メモ", body: m.body });
  }
  visits.forEach((v, i) => {
    if (v.note.includes(label)) out.push({ id: `v${i}`, kind: "visit", date: v.date, staffId: v.staffId, title: serviceById(v.serviceId).name, body: v.note });
  });
  for (const a of appts) {
    if (!a.note?.includes(label) || !isActive(a)) continue;
    out.push({
      id: a.id, kind: "appt", date: fromKey(a.date), staffId: a.staffId, title: serviceById(a.serviceId).name, body: a.note, apptId: a.id,
      future: a.date >= TODAY_KEY && a.status !== "completed",
    });
  }
  return out.sort((x, y) => (x.future !== y.future ? (x.future ? -1 : 1) : x.future ? x.date.getTime() - y.date.getTime() : y.date.getTime() - x.date.getTime()));
}

/** 記録（メモ・来院記録・予約メモ）がある歯 */
export function toothKeysWithNotes(memos: Memo[], visits: VisitRecord[], appts: Appointment[]): Set<ToothKey> {
  const s = new Set<ToothKey>();
  const texts = [...memos.map(m => m.body), ...visits.map(v => v.note), ...appts.filter(isActive).map(a => a.note ?? "")];
  for (const m of memos) for (const t of m.teeth ?? []) s.add(t);
  for (const k of ALL_TEETH) {
    if (s.has(k)) continue;
    const label = toothLabel(k);
    if (texts.some(t => t.includes(label))) s.add(k);
  }
  return s;
}
