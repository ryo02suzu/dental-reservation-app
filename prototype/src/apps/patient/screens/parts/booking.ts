// Web予約の手順・空き枠・入力チェック・予約の登録。画面（JSX）を持たないロジックだけをまとめる。
import { addDays, differenceInYears, getDaysInMonth } from "date-fns";
import { ME, availableStarts, hoursFor, serviceById, units } from "@/data";
import type { Appointment, InsuranceType, Patient, Service } from "@/data";
import { TODAY, TODAY_KEY, minutesOfDay, now } from "@/lib/clock";
import { fromKey, hm, key, mdw, toKatakana, yen } from "@/lib/format";
import type { useStore } from "@/lib/store";
import { useDraft, type BookingDraft } from "@/apps/patient/PatientApp";
import { rememberBooking } from "./session";

type Store = ReturnType<typeof useStore>;

// ─── 入力途中の内容 ─────────────────────────────────────────────────────────
// 共有の BookingDraft には生年月日・性別がないので、同じ入れ物に追加の項目を持たせる
// （setDraft は中身をそのまま重ねるだけなので、追加の項目も画面をまたいで残る）。
export type Visit = "first" | "return";
export type Sex = "女性" | "男性";
/** 再診のとき、ログイン中の本人か、ご家族か */
export type Who = "me" | "family";
export interface Draft extends BookingDraft {
  who?: Who; // 再診のみ

  birth?: string; // yyyy-MM-dd（初診）
  sex?: Sex; // 初診
  apptId?: string; // 登録した予約（完了画面で一度だけ作る）
  receipt?: string; // 予約番号
}
export function useBooking() {
  return useDraft() as unknown as { draft: Draft; setDraft: (p: Partial<Draft>) => void; reset: () => void };
}

// ─── 手順 ───────────────────────────────────────────────────────────────────
export const STEPS = ["type", "menu", "time", "info", "confirm"] as const;
export type Step = (typeof STEPS)[number] | "done";
export const isStep = (s?: string): s is Step => !!s && (s === "done" || (STEPS as readonly string[]).includes(s));
export const stepNo = (s: Step) => (s === "done" ? STEPS.length : STEPS.indexOf(s));

export const STEP_TITLE: Record<Step, string> = {
  type: "どなたのご予約ですか？",
  menu: "ご予約のメニュー",
  time: "ご希望の日時",
  info: "お名前とご連絡先",
  confirm: "ご予約内容の確認",
  done: "ご予約を承りました",
};
/** 戻るボタンや要約に出す短い名前 */
export const STEP_SHORT: Record<Step, string> = {
  type: "受診される方",
  menu: "メニュー",
  time: "日時",
  info: "ご連絡先",
  confirm: "確認",
  done: "完了",
};

// ─── メニュー ───────────────────────────────────────────────────────────────
export const MENU_GROUPS: Record<Visit, { title: string; ids: string[]; footer?: string }[]> = {
  first: [
    { title: "はじめての方", ids: ["sv10"], footer: "痛みや腫れがある方も、こちらをお選びください。お口全体を検査してから治療の方針をご説明します。" },
    { title: "ご相談のみ", ids: ["sv12", "sv13"], footer: "相談は無料です。治療を始めるかどうかは、お話を聞いてからお決めいただけます。" },
  ],
  return: [
    { title: "予防・クリーニング", ids: ["sv01", "sv02"] },
    { title: "治療の続き・お悩み", ids: ["sv03", "sv04", "sv05", "sv06", "sv08", "sv07", "sv09"], footer: "治療の続きは、前回の受診時にお伝えした内容をお選びください。" },
    { title: "審美・ご相談", ids: ["sv11", "sv12", "sv13"] },
  ],
};
export const menuIds = (v: Visit) => MENU_GROUPS[v].flatMap(g => g.ids);

/** 料金の表示（保険診療は窓口負担が人によって違うので金額を出さない） */
export const priceShort = (s: Service) => (s.insurance ? "保険" : s.price ? yen(s.price) : "無料");
export const priceLong = (s: Service) => (s.insurance ? "保険診療" : s.price ? `${yen(s.price)}（税込）` : "無料");
export const roleOf = (s: Service) => (s.by === "Dr" ? "歯科医師" : "歯科衛生士");

// ─── 空き枠 ─────────────────────────────────────────────────────────────────
/** Web予約を受け付ける日数（今日から） */
export const WINDOW_DAYS = 30;
/** 当日の予約は、開始の1時間前まで */
export const LEAD_MIN = 60;

/** その日に予約できる開始時刻。過ぎた時刻・本人のほかの予約と重なる時刻は除く */
export function slotsFor(day: Date, minutes: number, appts: Appointment[], opts: { excludeId?: string; patientId?: string } = {}): number[] {
  const dk = key(day);
  if (dk < TODAY_KEY) return [];
  const list = opts.excludeId ? appts.filter(a => a.id !== opts.excludeId) : appts;
  let res = availableStarts(day, minutes, list);
  if (dk === TODAY_KEY) {
    const limit = minutesOfDay(now()) + LEAD_MIN;
    res = res.filter(t => t >= limit);
  }
  if (opts.patientId) {
    const own = list.filter(a => a.patientId === opts.patientId && a.date === dk && a.status !== "cancelled" && a.status !== "no_show" && a.status !== "completed");
    if (own.length) res = res.filter(t => !own.some(a => a.start < t + minutes && a.end > t));
  }
  return res;
}

export type Level = "closed" | "none" | "few" | "ok";
export interface DayInfo {
  date: Date;
  key: string;
  slots: number[];
  level: Level;
}
export const LEVEL_LABEL: Record<Level, string> = { closed: "休診", none: "空きなし", few: "残りわずか", ok: "空きあり" };

export function dayInfos(minutes: number, appts: Appointment[], opts: { excludeId?: string; patientId?: string } = {}): DayInfo[] {
  return Array.from({ length: WINDOW_DAYS }, (_, i) => {
    const date = addDays(TODAY, i);
    if (!hoursFor(date)) return { date, key: key(date), slots: [], level: "closed" as const };
    const slots = slotsFor(date, minutes, appts, opts);
    return { date, key: key(date), slots, level: slots.length === 0 ? "none" : slots.length <= 3 ? "few" : "ok" };
  });
}

/** 予約の時間帯 "9:00–9:30" */
export const range = (start: number, minutes: number) => `${hm(start)}–${hm(start + minutes)}`;

// ─── 再診の入力済み・デモ用の下書き ──────────────────────────────────────────
export const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const mePrefill = () => ({ name: ME.name, kana: toHiragana(ME.kana), phone: ME.phone, number: ME.number, email: ME.email ?? "" });

/**
 * # で途中の手順を直接開いたときに使う、現実的な下書き。
 * 再診・定期検診・クリーニング・次の診療日の最初の空き枠・本人の情報。
 */
export function demoDraft(appts: Appointment[]): Draft {
  const sv = serviceById("sv01");
  let date = key(addDays(TODAY, 1));
  let start = 540;
  for (let i = 1; i < WINDOW_DAYS; i++) {
    const day = addDays(TODAY, i);
    if (!hoursFor(day)) continue;
    const s = slotsFor(day, sv.minutes, appts, { patientId: ME.id });
    if (s.length) {
      date = key(day);
      start = s[0];
      break;
    }
  }
  return { visit: "return", who: "me", serviceId: sv.id, date, start, ...mePrefill(), note: "" };
}

/** その手順を表示するのに必要な内容がそろっているか */
export function isReady(step: Step, d: Draft): boolean {
  const i = stepNo(step);
  if (i >= 1 && !d.visit) return false;
  if (i >= 2 && !(d.visit && d.serviceId && menuIds(d.visit).includes(d.serviceId))) return false;
  if (i >= 3 && !(d.date && d.start !== undefined)) return false;
  if (i >= 4 && !d.apptId && Object.keys(validate(d)).length > 0) return false;
  return true;
}

// ─── 入力チェック ───────────────────────────────────────────────────────────
export type FieldKey = "name" | "kana" | "birth" | "sex" | "phone" | "email" | "number" | "note";
export const FIELD_ORDER: FieldKey[] = ["name", "kana", "birth", "sex", "number", "phone", "email", "note"];
export const NOTE_MAX = 200;

/** 全角の数字・記号を半角に */
export const toHalf = (s: string) =>
  s.replace(/[０-９Ａ-Ｚａ-ｚ＠．＿＋－]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[ー－―‐−]/g, "-");
export const digitsOf = (s: string) => toHalf(s).replace(/[-\s()（）]/g, "");
/** 名前の空白をそろえる（全角スペース・連続した空白 → 半角1つ） */
export const cleanSpaces = (s: string) => s.replace(/[\s　]+/g, " ").trim();

/** 電話番号を見やすく区切る（携帯 090-1234-5678 / 東京・大阪 03-1234-5678） */
export function formatPhone(raw: string): string {
  const d = digitsOf(raw);
  if (/\D/.test(d)) return raw;
  if (d.length === 11 && /^0[5789]0/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10 && /^0[36]/.test(d)) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

export const emailRequired = (d: Draft) => d.visit === "first";
/** 再診で、ログイン中の本人の予約か */
export const isMe = (d: Draft) => d.visit === "return" && d.who !== "family";
/** 生年月日・性別を入力してもらうか（初診と、ご家族の再診） */
export const asksProfile = (d: Draft) => d.visit === "first" || (d.visit === "return" && d.who === "family");

export function validate(d: Draft): Partial<Record<FieldKey, string>> {
  const e: Partial<Record<FieldKey, string>> = {};
  if (!cleanSpaces(d.name)) e.name = "お名前を入力してください";
  const kana = cleanSpaces(toHiragana(d.kana));
  if (!kana) e.kana = "ふりがなを入力してください";
  else if (!/^[ぁ-ゖー ]+$/.test(kana)) e.kana = "ふりがなは、ひらがなで入力してください";
  const tel = digitsOf(d.phone);
  if (!tel) e.phone = "電話番号を入力してください";
  else if (/\D/.test(tel)) e.phone = "電話番号は数字で入力してください";
  else if (!tel.startsWith("0")) e.phone = "電話番号は0から始まる番号を入力してください";
  else if (tel.length < 10 || tel.length > 11) e.phone = "電話番号の桁数をご確認ください（10〜11桁）";
  const mail = toHalf(d.email).trim();
  if (!mail && emailRequired(d)) e.email = "仮予約の確定をお知らせするため、メールアドレスを入力してください";
  else if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) e.email = "メールアドレスの形式をご確認ください（例：hanako@example.jp）";
  if (d.visit === "return") {
    const no = digitsOf(d.number);
    if (no && !/^\d{6}$/.test(no)) e.number = "診察券番号は6桁の数字で入力してください";
  }
  if (asksProfile(d)) {
    if (!d.birth) e.birth = "生年月日を選んでください";
    if (!d.sex) e.sex = "性別を選んでください";
  }
  if (d.note.length > NOTE_MAX) e.note = `${NOTE_MAX}文字以内で入力してください（いま${d.note.length}文字）`;
  return e;
}

/** 生年月日の部品 "1990-05-12" ⇄ { y, m, d } */
export function splitBirth(b?: string): { y: string; m: string; d: string } {
  if (!b) return { y: "", m: "", d: "" };
  const [y = "", m = "", d = ""] = b.split("-");
  return { y, m: m ? String(Number(m)) : "", d: d ? String(Number(d)) : "" };
}
export function joinBirth(p: { y: string; m: string; d: string }): string | undefined {
  if (!p.y || !p.m || !p.d) return undefined;
  const max = getDaysInMonth(new Date(Number(p.y), Number(p.m) - 1, 1));
  const day = Math.min(Number(p.d), max);
  return `${p.y}-${p.m.padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export const birthLabel = (b: string) => {
  const d = fromKey(b);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

// ─── 予約の登録 ─────────────────────────────────────────────────────────────
/**
 * その時間に空いているユニットと担当。歯科医師のメニューはユニット1・2、衛生士はユニット3・4を優先。
 * 日時の変更では、空いていれば同じユニット（＝同じ担当）のままにする。
 */
export function assignUnit(dk: string, start: number, end: number, sv: Service, appts: Appointment[], excludeId?: string, keepUnit?: string) {
  const busy = appts.filter(a => a.id !== excludeId && a.date === dk && a.status !== "cancelled" && a.status !== "no_show" && a.start < end && a.end > start);
  const free = units.filter(u => !busy.some(a => a.unitId === u.id));
  const pref = sv.by === "Dr" ? ["u1", "u2"] : ["u3", "u4"];
  const unit = free.find(u => u.id === keepUnit) ?? free.find(u => pref.includes(u.id)) ?? free[0] ?? units.find(u => u.id === pref[0])!;
  const staffId = sv.by === "Dr" ? (unit.id === "u2" ? "s2" : "s1") : unit.id === "u4" ? "s4" : "s3";
  return { unitId: unit.id, staffId };
}

/**
 * 予約番号（予約日＋予約から決まる4桁。同じ予約はいつも同じ番号）。
 * 日時を変更しても番号は変わらないよう、最初に見たときの番号を覚えておく。
 */
const receipts = new Map<string, string>();
export function receiptOf(a: Pick<Appointment, "id" | "date" | "start">): string {
  let r = receipts.get(a.id);
  if (!r) receipts.set(a.id, (r = makeReceipt(a)));
  return r;
}
function makeReceipt(a: Pick<Appointment, "id" | "date" | "start">): string {
  const d = fromKey(a.date);
  const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const n = Number(a.id.replace(/\D/g, "")) || a.id.length;
  return `HD-${mmdd}-${String((a.start * 3 + n * 47 + 101) % 10000).padStart(4, "0")}`;
}

function insuranceFor(age: number): InsuranceType {
  if (age < 15) return "子ども医療証";
  if (age >= 75) return "後期高齢者";
  return "社保本人";
}

const bareName = (s: string) => s.replace(/[\s　]/g, "");
/**
 * 再診で入力された人を台帳から探す。本人の予約はログイン中の本人。
 * ご家族は「診察券番号＋お名前」か「お名前＋生年月日」が一致したときだけ。見つからなければ undefined
 * （本人に寄せない。医院で確認する仮予約にする）。
 */
export function resolveReturning(d: Draft, list: Patient[]): Patient | undefined {
  if (d.visit !== "return") return undefined;
  if (d.who !== "family") return ME;
  const no = digitsOf(d.number);
  const name = bareName(cleanSpaces(d.name));
  const byNo = no ? list.find(p => p.number === no) : undefined;
  if (byNo && bareName(byNo.name) === name) return byNo;
  if (d.birth) return list.find(p => bareName(p.name) === name && key(p.birth) === d.birth);
  return undefined;
}

/**
 * 予約を確定する（完了画面に入ったときに一度だけ）。
 * 初診は患者を登録してから「仮予約」で入れ、医院の「お知らせ」に届ける。
 */
/** 確定すると「仮予約」（医院の確認待ち）になるか。初診と、台帳で確認できなかったご家族 */
export const willBePending = (d: Draft, list: Patient[]) => d.visit === "first" || !resolveReturning(d, list);

/** この端末で一度でも予約を確定したか（完了画面へ「戻る」で来たときに、二重に登録しないため） */
let finished = false;
export const hasFinishedBooking = () => finished;

export function commitBooking(d: Draft, store: Store): { appt: Appointment; receipt: string; patient: Patient } {
  const sv = serviceById(d.serviceId!);
  const first = d.visit === "first";
  const date = d.date!;
  const start = d.start!;
  const end = start + sv.minutes;
  const found = first ? undefined : resolveReturning(d, store.patients);
  // 初診と、台帳で確認できなかったご家族は、患者を仮登録して「仮予約」にする
  const provisional = !found;
  let patient: Patient;
  if (!found) {
    const birth = fromKey(d.birth!);
    patient = store.addPatient({
      name: cleanSpaces(d.name),
      kana: toKatakana(cleanSpaces(toHiragana(d.kana))),
      sex: d.sex ?? "女性",
      birth,
      phone: formatPhone(d.phone),
      email: toHalf(d.email).trim() || undefined,
      insurance: insuranceFor(differenceInYears(TODAY, birth)),
      firstVisit: first ? fromKey(date) : TODAY,
      lastVisit: undefined,
      visits: 0,
      recallMonths: 3,
      nextRecall: undefined,
      cancellations: 0,
      noShows: 0,
      line: false,
      allergies: [],
      conditions: [],
      teeth: {},
      memo: first ? undefined : `Web予約で再診として登録（診察券番号${digitsOf(d.number) ? ` ${digitsOf(d.number)}` : "の入力なし"}）。既存のカルテと照合してください。`,
    });
  } else {
    patient = found;
  }
  const { unitId, staffId } = assignUnit(date, start, end, sv, store.appointments);
  const appt = store.addAppointment({
    date, start, end, patientId: patient.id, serviceId: sv.id, staffId, unitId,
    status: provisional ? "pending" : "confirmed",
    source: "web",
    firstVisit: first,
    note: [d.note.trim(), !first && provisional ? "診察券番号の確認が必要（Web予約で再診）" : ""].filter(Boolean).join("\n") || undefined,
  });
  finished = true;
  rememberBooking(appt.id);
  store.addNotice({
    kind: "web",
    title: provisional ? "Web予約のリクエストが届きました" : "Web予約が入りました",
    body: `${patient.name}さん・${mdw(fromKey(date))} ${hm(start)} ${sv.name}${provisional ? (first ? "（承認待ち）" : "（再診・診察券番号の確認待ち）") : ""}`,
    apptId: appt.id,
  });
  return { appt, receipt: receiptOf(appt), patient };
}

// ─── 予約の確認（変更・キャンセル） ─────────────────────────────────────────
/** 変更・キャンセルの締め切り（前日18時） */
export function deadlineOf(dateKey: string): Date {
  const d = fromKey(dateKey);
  d.setDate(d.getDate() - 1);
  d.setHours(18, 0, 0, 0);
  return d;
}
export const deadlineLabel = (dateKey: string) => `${mdw(deadlineOf(dateKey))} 18:00`;
/** Webでの変更・キャンセルの締め切りを過ぎているか（当日・前日18時以降の予約） */
export const pastDeadline = (dateKey: string) => now() >= deadlineOf(dateKey);
/** 前日のリマインドを送る時刻（変更の締め切りより前に届くように） */
export const REMIND_LABEL = "前日の12時ごろ";

export const CANCEL_REASONS = ["体調不良のため", "仕事の都合", "日程の変更希望", "家庭の事情", "その他"];
