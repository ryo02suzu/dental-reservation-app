// プロトタイプ用のサンプルデータ（すべて架空）。
// 乱数は固定シードなので、同じ日に開けば同じ内容になる。
import { addDays, addMonths, differenceInCalendarDays, format, startOfWeek, subDays, subMonths } from "date-fns";
import { TODAY, TODAY_KEY, isClinicOpenDay, minutesOfDay, now } from "@/lib/clock";
import { fromKey, hm, mdw, relDay } from "@/lib/format";
import type {
  Addon, Appointment, ApptSource, AttendanceRow, ConsoleClinic, InsuranceType, Memo, Notice, Patient, Quadrant,
  RecallItem, Service, ShiftCell, Staff, ToothState, Unit, VisitRecord,
} from "./types";

export * from "./types";

// ─── 乱数 ───────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry32(20261118);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(R() * a.length)];
const chance = (p: number) => R() < p;
const int = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
const key = (d: Date) => format(d, "yyyy-MM-dd");

// ─── 医院 ───────────────────────────────────────────────────────────────────
export const clinic = {
  name: "ひだまり歯科クリニック",
  nameEn: "Hidamari Dental Clinic",
  director: "佐伯 直人",
  address: "東京都世田谷区桜新町 2-14-8 ひだまりビル 2F",
  access: "東急田園都市線「桜新町」駅 南口から徒歩3分",
  phone: "03-1234-5678",
  slug: "hidamari-dental",
  closedLabel: "木曜・日曜・祝日",
  parking: "提携駐車場あり（2時間無料）",
};

/** 曜日ごとの診療時間（分）。null は休診 */
export const HOURS: Record<number, { am: [number, number]; pm: [number, number] } | null> = {
  0: null,
  1: { am: [540, 780], pm: [870, 1140] },
  2: { am: [540, 780], pm: [870, 1140] },
  3: { am: [540, 780], pm: [870, 1140] },
  4: null,
  5: { am: [540, 780], pm: [870, 1140] },
  6: { am: [540, 780], pm: [840, 1020] },
};
export const hoursFor = (d: Date) => (isClinicOpenDay(d) ? HOURS[d.getDay()] : null);

/**
 * いまが診療のどの時間帯か。今日の画面・患者さんのWeb予約・受付端末で使う。
 * 例: { kind: "am", label: "午前の診療中", detail: "13:00まで" }
 */
export function clinicPhase(d: Date): { kind: "closed" | "before" | "am" | "lunch" | "pm" | "after"; label: string; detail?: string } {
  const h = hoursFor(d);
  if (!h) return { kind: "closed", label: "休診日" };
  const m = d.getHours() * 60 + d.getMinutes();
  const t = (x: number) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, "0")}`;
  if (m < h.am[0]) return { kind: "before", label: "診療前", detail: `${t(h.am[0])}から` };
  if (m < h.am[1]) return { kind: "am", label: "午前の診療中", detail: `${t(h.am[1])}まで` };
  if (m < h.pm[0]) return { kind: "lunch", label: "昼休み", detail: `${t(h.pm[0])}から` };
  if (m < h.pm[1]) return { kind: "pm", label: "午後の診療中", detail: `${t(h.pm[1])}まで` };
  return { kind: "after", label: "本日の診療は終了しました" };
}

// ─── スタッフ・ユニット ─────────────────────────────────────────────────────
export const staff: Staff[] = [
  { id: "s1", name: "佐伯 直人", kana: "サエキ ナオト", role: "院長", tone: "graphite", short: "佐伯" },
  { id: "s2", name: "高木 美穂", kana: "タカギ ミホ", role: "歯科医師", tone: "plum", short: "高木" },
  { id: "s3", name: "森 彩花", kana: "モリ アヤカ", role: "歯科衛生士", tone: "sage", short: "森" },
  { id: "s4", name: "川口 優奈", kana: "カワグチ ユウナ", role: "歯科衛生士", tone: "ocean", short: "川口" },
  { id: "s5", name: "小野 千尋", kana: "オノ チヒロ", role: "歯科助手", tone: "amber", short: "小野" },
  { id: "s6", name: "石井 真央", kana: "イシイ マオ", role: "受付", tone: "clay", short: "石井" },
];
export const units: Unit[] = [
  { id: "u1", name: "ユニット1", short: "U1" },
  { id: "u2", name: "ユニット2", short: "U2" },
  { id: "u3", name: "ユニット3", short: "U3" },
  { id: "u4", name: "ユニット4", short: "U4" },
];

// ─── 診療メニュー ───────────────────────────────────────────────────────────
export const services: Service[] = [
  { id: "sv01", name: "定期検診・クリーニング", short: "定期検診", minutes: 30, insurance: true, category: "予防", by: "DH", description: "歯石除去と歯面清掃、むし歯・歯周病のチェック" },
  { id: "sv02", name: "PMTC（専門的歯面清掃）", short: "PMTC", minutes: 45, insurance: false, price: 5500, category: "予防", by: "DH", description: "専用機器で着色やバイオフィルムを除去" },
  { id: "sv03", name: "むし歯治療", short: "むし歯", minutes: 30, insurance: true, category: "一般", by: "Dr", description: "CR充填・インレーなど" },
  { id: "sv04", name: "根管治療", short: "根管", minutes: 45, insurance: true, category: "一般", by: "Dr", description: "神経の治療（数回の通院が必要です）" },
  { id: "sv05", name: "歯周病治療（SRP）", short: "SRP", minutes: 45, insurance: true, category: "歯周", by: "DH", description: "歯ぐきの奥の歯石を除去" },
  { id: "sv06", name: "抜歯", short: "抜歯", minutes: 30, insurance: true, category: "外科", by: "Dr", description: "親知らずの相談も承ります" },
  { id: "sv07", name: "入れ歯の作製・調整", short: "義歯", minutes: 30, insurance: true, category: "補綴", by: "Dr", description: "痛い・合わない入れ歯の調整" },
  { id: "sv08", name: "被せ物・詰め物", short: "補綴", minutes: 45, insurance: true, category: "補綴", by: "Dr", description: "型取り・セット" },
  { id: "sv09", name: "小児歯科", short: "小児", minutes: 30, insurance: true, category: "小児", by: "Dr", description: "フッ素塗布・シーラント" },
  { id: "sv10", name: "初診・カウンセリング", short: "初診", minutes: 60, insurance: true, category: "相談", by: "Dr", description: "お口全体の検査と治療方針のご説明" },
  { id: "sv11", name: "ホワイトニング", short: "ホワイト", minutes: 60, insurance: false, price: 22000, category: "審美", by: "DH", description: "オフィスホワイトニング（1回）" },
  { id: "sv12", name: "インプラント相談", short: "インプラ", minutes: 30, insurance: false, price: 0, category: "相談", by: "Dr", description: "無料相談・CT撮影のご案内" },
  { id: "sv13", name: "矯正相談", short: "矯正", minutes: 30, insurance: false, price: 0, category: "相談", by: "Dr", description: "マウスピース矯正の無料相談" },
];

// ─── 患者 ───────────────────────────────────────────────────────────────────
const FAMILY: [string, string][] = [
  ["佐藤", "サトウ"], ["鈴木", "スズキ"], ["高橋", "タカハシ"], ["田中", "タナカ"], ["伊藤", "イトウ"], ["渡辺", "ワタナベ"],
  ["山本", "ヤマモト"], ["中村", "ナカムラ"], ["小林", "コバヤシ"], ["加藤", "カトウ"], ["吉田", "ヨシダ"], ["山田", "ヤマダ"],
  ["佐々木", "ササキ"], ["山口", "ヤマグチ"], ["松本", "マツモト"], ["井上", "イノウエ"], ["木村", "キムラ"], ["林", "ハヤシ"],
  ["斎藤", "サイトウ"], ["清水", "シミズ"], ["山崎", "ヤマザキ"], ["池田", "イケダ"], ["橋本", "ハシモト"], ["阿部", "アベ"],
  ["石川", "イシカワ"], ["前田", "マエダ"], ["藤田", "フジタ"], ["岡田", "オカダ"], ["後藤", "ゴトウ"], ["長谷川", "ハセガワ"],
  ["村上", "ムラカミ"], ["近藤", "コンドウ"], ["坂本", "サカモト"], ["遠藤", "エンドウ"], ["青木", "アオキ"], ["藤井", "フジイ"],
  ["西村", "ニシムラ"], ["福田", "フクダ"], ["太田", "オオタ"], ["三浦", "ミウラ"], ["岡本", "オカモト"], ["松田", "マツダ"],
  ["中島", "ナカジマ"], ["原田", "ハラダ"], ["小川", "オガワ"], ["竹内", "タケウチ"], ["金子", "カネコ"], ["和田", "ワダ"],
];
/** 名前は年代に合わせる（若い人に昭和の名前が付かないように） */
type Bracket = "young" | "mid" | "old";
const NAMES: Record<"女性" | "男性", Record<Bracket, [string, string][]>> = {
  女性: {
    young: [["陽菜", "ヒナ"], ["結衣", "ユイ"], ["さくら", "サクラ"], ["葵", "アオイ"], ["七海", "ナナミ"], ["凛", "リン"], ["紗希", "サキ"], ["芽依", "メイ"], ["結菜", "ユイナ"], ["莉子", "リコ"], ["美桜", "ミオ"], ["心春", "コハル"]],
    mid: [["美咲", "ミサキ"], ["彩", "アヤ"], ["千尋", "チヒロ"], ["優子", "ユウコ"], ["舞", "マイ"], ["香織", "カオリ"], ["理沙", "リサ"], ["奈々", "ナナ"], ["麻衣", "マイ"], ["愛", "アイ"], ["沙織", "サオリ"], ["恵", "メグミ"]],
    old: [["恵子", "ケイコ"], ["和子", "カズコ"], ["京子", "キョウコ"], ["明美", "アケミ"], ["由美子", "ユミコ"], ["真由美", "マユミ"], ["智子", "トモコ"], ["洋子", "ヨウコ"], ["幸子", "サチコ"], ["久美子", "クミコ"], ["典子", "ノリコ"], ["裕子", "ユウコ"]],
  },
  男性: {
    young: [["蓮", "レン"], ["陽翔", "ハルト"], ["大翔", "ヒロト"], ["湊", "ミナト"], ["悠真", "ユウマ"], ["颯太", "ソウタ"], ["朝陽", "アサヒ"], ["樹", "イツキ"], ["律", "リツ"], ["蒼", "アオイ"], ["陸", "リク"], ["新", "アラタ"]],
    mid: [["翔太", "ショウタ"], ["大輔", "ダイスケ"], ["健", "ケン"], ["拓也", "タクヤ"], ["直樹", "ナオキ"], ["健太", "ケンタ"], ["亮", "リョウ"], ["達也", "タツヤ"], ["智也", "トモヤ"], ["圭", "ケイ"], ["和也", "カズヤ"], ["雄太", "ユウタ"]],
    old: [["昭夫", "アキオ"], ["正雄", "マサオ"], ["一郎", "イチロウ"], ["浩二", "コウジ"], ["隆", "タカシ"], ["修", "オサム"], ["誠", "マコト"], ["博", "ヒロシ"], ["茂", "シゲル"], ["進", "ススム"], ["勝", "マサル"], ["清", "キヨシ"]],
  },
};
const bracketOf = (age: number): Bracket => (age < 25 ? "young" : age < 50 ? "mid" : "old");
const ALLERGIES = ["ペニシリン系", "ラテックス", "局所麻酔（リドカイン）", "金属（ニッケル）", "アスピリン"];
const CONDITIONS = ["高血圧", "糖尿病", "心疾患（ペースメーカー）", "骨粗しょう症（BP製剤服用中）", "抗凝固薬（ワーファリン）服用中", "喘息", "妊娠中（20週）"];
const TOOTH_STATES: ToothState[] = ["CR", "CR", "CR", "In", "Cr", "RCT", "C", "M", "観察", "Br", "Imp"];
const TOOTH_STATES_YOUNG: ToothState[] = ["CR", "CR", "C", "In", "観察", "RCT"];
const QUADS: Quadrant[] = ["UR", "UL", "LR", "LL"];

function insuranceFor(ageYears: number): InsuranceType {
  if (ageYears < 15) return "子ども医療証";
  if (ageYears >= 75) return "後期高齢者";
  return pick<InsuranceType>(["社保本人", "社保本人", "社保家族", "国保"]);
}

/** 年齢に合った歯式（子どもにインプラントや欠損が付かないように） */
function makeTeeth(ageYears: number): Patient["teeth"] {
  const t: Patient["teeth"] = {};
  if (ageYears < 6) return t; // 乳歯だけの年齢。永久歯の記録はまだない
  if (ageYears < 15) {
    // 永久歯は6番（6歳ごろ）と、12歳以降の7番だけ。むし歯・CR・要観察のみ
    for (let i = 0, n = int(0, 2); i < n; i++) {
      const num = ageYears >= 12 && chance(0.4) ? 7 : 6;
      t[`${pick(QUADS)}${num}`] = pick<ToothState>(["C", "CR", "観察"]);
    }
    return t;
  }
  const n = ageYears > 65 ? int(5, 10) : ageYears < 30 ? int(0, 3) : int(1, 6);
  const pool = ageYears < 30 ? TOOTH_STATES_YOUNG : TOOTH_STATES;
  for (let i = 0; i < n; i++) {
    const q = pick(QUADS);
    const num = int(1, 8) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    let st = pick(pool);
    if (ageYears > 65 && chance(0.3)) st = "M";
    t[`${q}${num}`] = st;
  }
  return t;
}

const usedNames = new Set<string>();
function makeName(sex: "女性" | "男性", ageYears: number): { name: string; kana: string } {
  const pool = NAMES[sex][bracketOf(ageYears)];
  for (;;) {
    const [f, fk] = pick(FAMILY);
    const [g, gk] = pick(pool);
    const name = `${f} ${g}`;
    if (usedNames.has(name)) continue;
    usedNames.add(name);
    return { name, kana: `${fk} ${gk}` };
  }
}

/** 患者さん（800人）。医院の規模に合わせ、1人あたりの予約が多くなりすぎないようにしている */
export const patients: Patient[] = Array.from({ length: 800 }, (_, i) => {
  const sex: "女性" | "男性" = chance(0.56) ? "女性" : "男性";
  const ageYears = pick([int(3, 14), int(18, 39), int(25, 49), int(40, 64), int(50, 74), int(66, 88)]);
  const { name, kana } = makeName(sex, ageYears);
  const birth = subDays(subMonths(TODAY, ageYears * 12 + int(0, 11)), int(0, 27));
  const firstVisit = subDays(TODAY, Math.min(int(20, 2400), Math.max(20, (ageYears - 2) * 365)));
  const visits = int(1, 46);
  const lastVisit = subDays(TODAY, int(3, 220));
  const recallMonths = pick([3, 3, 4, 6] as const);
  const nextRecall = addMonths(lastVisit, recallMonths);
  const allergies = chance(0.11) ? [pick(ALLERGIES)] : [];
  let conditions = chance(0.22) ? [pick(CONDITIONS)] : [];
  if (conditions[0]?.startsWith("妊娠") && (sex !== "女性" || ageYears < 20 || ageYears > 42)) conditions = [];
  return {
    id: `p${String(i + 1).padStart(3, "0")}`,
    number: String(1040 + i * 17).padStart(6, "0"),
    name,
    kana,
    sex,
    birth,
    phone: `090-0${int(100, 999)}-${int(1000, 9999)}`,
    email: chance(0.6) ? `user${i + 11}@example.jp` : undefined,
    insurance: insuranceFor(ageYears),
    firstVisit,
    lastVisit,
    visits,
    recallMonths,
    nextRecall,
    cancellations: chance(0.12) ? int(1, 3) : 0,
    noShows: chance(0.06) ? int(1, 2) : 0,
    line: chance(0.48),
    allergies,
    conditions,
    memo: chance(0.12) ? pick(["音に敏感。説明はゆっくり", "治療中は手を挙げて合図", "平日夕方の予約を希望", "ご家族も通院中", "嘔吐反射が強め"]) : undefined,
    teeth: makeTeeth(ageYears),
  };
});

/** 患者アプリでログインしている本人（田中 美咲） */
export const ME: Patient = (() => {
  const p = patients[3];
  usedNames.add("田中 美咲");
  Object.assign(p, {
    name: "田中 美咲",
    kana: "タナカ ミサキ",
    sex: "女性",
    birth: subMonths(TODAY, 34 * 12 + 4),
    insurance: "社保本人",
    line: true,
    allergies: [],
    conditions: [],
    visits: 14,
    lastVisit: subDays(TODAY, 86),
    recallMonths: 3,
    nextRecall: addDays(TODAY, 6),
    teeth: { LR6: "CR", UL7: "In", UR6: "観察" },
  } satisfies Partial<Patient>);
  return p;
})();

// 台帳で目立たせたい患者（遅刻しがち・抗凝固薬・初診）
const LATE_PATIENT = patients[8];
Object.assign(LATE_PATIENT, { cancellations: 2, noShows: 1 });
const ANTICOAG_PATIENT = patients[14];
Object.assign(ANTICOAG_PATIENT, { conditions: ["抗凝固薬（ワーファリン）服用中", "高血圧"], birth: subMonths(TODAY, 71 * 12 + 3), teeth: makeTeeth(71) });
{
  // 年代に合う名前に付け替える（姓はそのまま）
  const [family, familyKana] = [ANTICOAG_PATIENT.name.split(" ")[0], ANTICOAG_PATIENT.kana.split(" ")[0]];
  const given = NAMES[ANTICOAG_PATIENT.sex].old.find(([g]) => !usedNames.has(`${family} ${g}`))!;
  usedNames.add(`${family} ${given[0]}`);
  Object.assign(ANTICOAG_PATIENT, { name: `${family} ${given[0]}`, kana: `${familyKana} ${given[1]}` });
}
const ALLERGY_PATIENT = patients[21];
Object.assign(ALLERGY_PATIENT, { allergies: ["ラテックス"] });
const NEW_PATIENT = patients[30];
Object.assign(NEW_PATIENT, { visits: 0, lastVisit: undefined, firstVisit: TODAY, nextRecall: undefined, cancellations: 0, noShows: 0, teeth: {}, memo: undefined });

export const patientById = (id: string) => patients.find(p => p.id === id)!;
export const serviceById = (id: string) => services.find(s => s.id === id)!;
export const staffById = (id: string) => staff.find(s => s.id === id)!;
export const unitById = (id: string) => units.find(u => u.id === id)!;

// ─── 予約 ───────────────────────────────────────────────────────────────────
const DR_SERVICES = services.filter(s => s.by === "Dr" && s.id !== "sv10");
const DH_SERVICES = services.filter(s => s.by === "DH");
/** メニューの出やすさ（むし歯・定期検診が多く、ホワイトニングや相談は少ない） */
const SERVICE_WEIGHT: Record<string, number> = {
  sv03: 30, sv04: 14, sv08: 18, sv06: 8, sv07: 8, sv09: 10, sv12: 4, sv13: 4,
  sv01: 55, sv05: 25, sv02: 13, sv11: 7,
};
function pickService(list: Service[]): Service {
  const total = list.reduce((s, x) => s + (SERVICE_WEIGHT[x.id] ?? 1), 0);
  let r = R() * total;
  for (const x of list) {
    r -= SERVICE_WEIGHT[x.id] ?? 1;
    if (r <= 0) return x;
  }
  return list[list.length - 1];
}
const FIRST = services.find(s => s.id === "sv10")!;
/** 受付が予約に添えるメモ。メニューに合うものだけ（初診には付けない） */
const NOTES_BY_SERVICE: Record<string, string[]> = {
  sv01: ["左上の歯ぐきが腫れている", "歯みがきで出血するとのこと"],
  sv02: ["着色が気になるとのこと"],
  sv03: ["右下6番 CR充填の続き", "冷たいものがしみる", "麻酔が効きにくい方"],
  sv04: ["前回の続き（根管2回目）", "根管充填の予定"],
  sv05: ["SRP 2ブロック目", "左上の歯ぐきが腫れている"],
  sv06: ["抜歯後の消毒", "親知らずが痛む"],
  sv07: ["入れ歯が当たって痛い"],
  sv08: ["セット予定", "型取り", "仮歯が外れた"],
  sv09: ["保護者同伴"],
  sv11: ["2回目", "しみやすい方"],
};
const SOURCE: ApptSource[] = ["web", "web", "web", "phone", "phone", "phone", "phone", "phone", "line", "walkin"];
/** 初診（初診・カウンセリング）にだけ現れる新しい患者さん。過去分と今後の分 */
const NEW_PAST = patients.slice(700, 760);
const NEW_FUTURE = patients.slice(760, 790);
const REGULARS = patients.filter(p => p !== ME && p !== NEW_PATIENT && !NEW_PAST.includes(p) && !NEW_FUTURE.includes(p));
/** しばらく来院していない患者さん（この期間に予約がない。リコールの対象になる） */
const LAPSED = new Set(patients.slice(500, 700));
const BOOKABLE = REGULARS.filter(p => !LAPSED.has(p));
/** 年齢に合うメニューか（小児歯科は15歳未満、入れ歯は55歳以上 など） */
const ageOf = (p: Patient) => Math.floor((TODAY.getTime() - p.birth.getTime()) / (365.25 * 86_400_000));
const FITS: Record<string, (age: number) => boolean> = {
  sv02: a => a >= 12, sv04: a => a >= 12, sv05: a => a >= 18, sv06: a => a >= 15, sv07: a => a >= 55, sv08: a => a >= 15,
  sv09: a => a < 15, sv11: a => a >= 18 && a <= 65, sv12: a => a >= 30, sv13: a => a >= 7 && a <= 50,
};
const suits = (p: Patient, sv: Service) => (FITS[sv.id] ?? (() => true))(ageOf(p));
/** 今週の月曜日 */
export const WEEK_START = startOfWeek(TODAY, { weekStartsOn: 1 });
/** 予約データは「今週より前の12週」から35日先まで */
const FIRST_OFF = -(differenceInCalendarDays(TODAY, WEEK_START) + 84);
/** 予約データがある期間の始まり（これより前の来院は visitsOf で出す） */
export const WINDOW_START = addDays(TODAY, FIRST_OFF);

function buildAppointments(): Appointment[] {
  const out: Appointment[] = [];
  let seq = 0;
  let past = 0;
  let future = 0;
  const perPatient = new Map<string, number>();
  const nowMin = minutesOfDay(now());
  for (let off = FIRST_OFF; off <= 35; off++) {
    const day = addDays(TODAY, off);
    const h = hoursFor(day);
    if (!h) continue;
    const dk = key(day);
    const booked = new Set<string>();
    const pool = off > 0 ? NEW_FUTURE : NEW_PAST;
    // 土曜と夕方は混み、水曜と昼過ぎは空きやすい
    const dayFactor = day.getDay() === 6 ? 0.6 : day.getDay() === 3 ? 1.4 : 1;
    for (const u of units) {
      const isDr = u.id === "u1" || u.id === "u2";
      const staffId = u.id === "u1" ? "s1" : u.id === "u2" ? "s2" : u.id === "u3" ? "s3" : "s4";
      for (const [ws, we] of [h.am, h.pm]) {
        let cur = ws;
        const gapRate = off > 7 ? 0.42 : off > 0 ? 0.3 : 0.18;
        while (cur < we) {
          const hourFactor = cur >= 1020 ? 0.5 : cur >= 840 && cur < 960 ? 1.35 : cur < 600 ? 0.9 : 1;
          if (chance(Math.min(0.9, gapRate * dayFactor * hourFactor))) cur += pick([15, 30, 30, 45]);
          let sv = isDr ? (chance(off > 0 ? 0.045 : 0.03) ? FIRST : pickService(DR_SERVICES)) : pickService(DH_SERVICES);
          if (sv === FIRST && (off > 0 ? future : past) >= pool.length) sv = pickService(DR_SERVICES);
          if (cur + sv.minutes > we) break;
          let p: Patient;
          if (sv === FIRST) p = off > 0 ? NEW_FUTURE[future++] : NEW_PAST[past++];
          else {
            // 予約が少ない人を優先して選ぶ（同じ人が毎週来るような偏りを防ぐ）
            const cands = BOOKABLE.filter(q => !booked.has(q.id) && suits(q, sv));
            const pool2 = cands.length ? cands : BOOKABLE;
            p = pool2[Math.floor(R() * pool2.length)];
            for (let k = 0; k < 2; k++) {
              const q = pool2[Math.floor(R() * pool2.length)];
              if ((perPatient.get(q.id) ?? 0) < (perPatient.get(p.id) ?? 0)) p = q;
            }
          }
          perPatient.set(p.id, (perPatient.get(p.id) ?? 0) + 1);
          booked.add(p.id);
          const source: ApptSource = sv === FIRST ? pick(["web", "web", "phone"] as const) : off > 0 ? pick(SOURCE.filter(s => s !== "walkin")) : pick(SOURCE);
          let status: Appointment["status"] = "confirmed";
          if (off < 0) status = chance(0.94) ? "completed" : chance(0.75) ? "cancelled" : "no_show";
          else if (off > 0) status = source === "web" && chance(0.08) ? "pending" : chance(0.03) ? "cancelled" : "confirmed";
          else if (cur + sv.minutes <= nowMin) status = "completed";
          else if (cur <= nowMin) status = "in_progress";
          const notes = sv === FIRST ? undefined : NOTES_BY_SERVICE[sv.id];
          out.push({
            id: `a${String(++seq).padStart(4, "0")}`,
            date: dk,
            start: cur,
            end: cur + sv.minutes,
            patientId: p.id,
            serviceId: sv.id,
            staffId,
            unitId: u.id,
            status,
            source,
            firstVisit: sv === FIRST,
            note: notes && chance(0.16) ? pick(notes) : undefined,
            arrivedAt: status === "in_progress" ? cur - int(4, 12) : status === "completed" ? cur - int(1, 12) : undefined,
            startedAt: status === "in_progress" ? cur + int(0, 4) : status === "completed" ? cur + int(0, 6) : undefined,
            cancelReason: status === "cancelled" ? pick(["体調不良のため", "仕事の都合", "日程の変更希望", "家庭の事情"]) : undefined,
          });
          if (sv === FIRST) {
            // 初診の患者さんは、この日が初めての来院
            const came = status === "completed" || status === "in_progress";
            Object.assign(p, {
              firstVisit: day, visits: came ? 1 : 0, lastVisit: came ? day : undefined, nextRecall: undefined,
              cancellations: status === "cancelled" ? 1 : 0, noShows: status === "no_show" ? 1 : 0, teeth: came ? p.teeth : {},
            });
          }
          cur += sv.minutes;
        }
      }
    }
  }

  // ─── 今日の台帳に、受付が対応すべき場面をそろえておく ───
  const today = () => out.filter(a => a.date === TODAY_KEY).sort((a, b) => a.start - b.start || a.unitId.localeCompare(b.unitId));
  const SPECIAL = [LATE_PATIENT, ANTICOAG_PATIENT, ALLERGY_PATIENT];
  /** 予約 a を患者 p にする。p が今日ほかの枠にも入っていたら、その枠は別の患者さんに入れ替える */
  const assign = (a: Appointment, p: Patient) => {
    for (const o of today()) {
      if (o === a || o.patientId !== p.id) continue;
      const used = new Set(today().map(x => x.patientId));
      const alt = REGULARS.find(q => !used.has(q.id) && !SPECIAL.includes(q));
      if (alt) o.patientId = alt.id;
    }
    a.patientId = p.id;
  };
  /** 同じユニットで、start から minutes 分のあいだにほかの予約がないか */
  const fits = (a: Appointment, minutes: number) =>
    !today().some(b => b !== a && b.unitId === a.unitId && b.start < a.start + minutes && b.end > a.start);
  const clearFor = (a: Appointment, minutes: number) => {
    for (const b of today()) if (b !== a && b.unitId === a.unitId && b.start < a.start + minutes && b.end > a.start) out.splice(out.indexOf(b), 1);
  };

  const t0 = today();
  const upcoming = t0.filter(a => a.start > nowMin);
  // 予約時刻を過ぎても来ていない患者さん（ユニット2）
  const late = t0.find(a => a.unitId === "u2" && a.start < nowMin && a.start >= nowMin - 25 && a.status !== "completed")
    ?? t0.find(a => a.unitId === "u2" && a.start >= nowMin - 40 && a.start < nowMin);
  if (late) {
    assign(late, LATE_PATIENT);
    Object.assign(late, { status: "confirmed", arrivedAt: undefined, startedAt: undefined, note: undefined });
  }
  // 早めに来て待合にいる患者さん
  const early = upcoming.find(a => a.unitId === "u4") ?? upcoming[0];
  if (early) Object.assign(early, { status: "arrived", arrivedAt: nowMin - 6 });
  const waiting2 = upcoming.find(a => a !== early && a.start - nowMin <= 30);
  if (waiting2) Object.assign(waiting2, { status: "arrived", arrivedAt: nowMin - 2 });
  // 午前の無断キャンセル
  const morningDone = t0.filter(a => a.status === "completed");
  if (morningDone[2]) Object.assign(morningDone[2], { status: "no_show", note: undefined, arrivedAt: undefined, startedAt: undefined });
  // 午後：キャンセル1件・Web予約の承認待ち2件
  const pm = upcoming.filter(a => a.start >= 870);
  if (pm[1]) Object.assign(pm[1], { status: "cancelled", cancelReason: "体調不良のため" });
  if (pm[3] && !pm[3].firstVisit) Object.assign(pm[3], { status: "pending", source: "web" });
  if (pm[6] && !pm[6].firstVisit) Object.assign(pm[6], { status: "pending", source: "web" });
  // 初診の新しい患者さん（ユニット1・午後・60分。後ろの枠と重なるなら空ける）
  const fv = pm.find(a => a.unitId === "u1" && a.status === "confirmed" && !a.firstVisit && fits(a, 60))
    ?? pm.find(a => a.unitId === "u1" && a.status === "confirmed" && !a.firstVisit);
  if (fv) {
    clearFor(fv, 60);
    assign(fv, NEW_PATIENT);
    Object.assign(fv, { serviceId: "sv10", end: fv.start + 60, firstVisit: true, source: "web", note: undefined });
  }
  // 抗凝固薬を飲んでいる患者さんの抜歯（ユニット2・午後）
  const ex = pm.find(a => a.unitId === "u2" && a.status === "confirmed" && !a.firstVisit && fits(a, 30));
  if (ex) {
    assign(ex, ANTICOAG_PATIENT);
    Object.assign(ex, { serviceId: "sv06", end: ex.start + 30, note: "左下8番 抜歯。服薬状況を確認" });
  }
  // ラテックスアレルギーの患者さん（ユニット3）
  const lx = upcoming.find(a => a.unitId === "u3" && a.status === "confirmed" && !a.firstVisit);
  if (lx) assign(lx, ALLERGY_PATIENT);

  // 入れ替えた患者さんの年齢にメニューが合わなければ、同じ職種の一般的なメニューにする
  for (const a of [late, fv, ex, lx]) {
    if (!a) continue;
    const p = patientById(a.patientId);
    const sv = serviceById(a.serviceId);
    if (!suits(p, sv)) Object.assign(a, { serviceId: sv.by === "Dr" ? "sv03" : "sv01", end: a.start + 30, note: undefined });
  }

  // 患者アプリの本人の次回予約（6日後以降の最初の診療日 15:30 定期検診・ユニット3）
  const myKey = key(isOpenOrNext(addDays(TODAY, 6)));
  for (const b of out.filter(b => b.date === myKey && b.unitId === "u3" && b.start < 960 && b.end > 930)) out.splice(out.indexOf(b), 1);
  out.push({
    id: "a-me-next", date: myKey, start: 930, end: 960, patientId: ME.id, serviceId: "sv01",
    staffId: "s3", unitId: "u3", status: "confirmed", source: "web", firstVisit: false,
  });
  // 本人の前回の定期検診（約3か月前）
  const lastDay = new Date(subDays(TODAY, 86));
  while (!hoursFor(lastDay)) lastDay.setDate(lastDay.getDate() - 1);
  const lastKey = key(lastDay);
  for (const b of out.filter(b => b.date === lastKey && b.unitId === "u3" && b.start < 960 && b.end > 930)) out.splice(out.indexOf(b), 1);
  out.push({
    id: "a-me-last", date: lastKey, start: 930, end: 960, patientId: ME.id, serviceId: "sv01",
    staffId: "s3", unitId: "u3", status: "completed", source: "line", firstVisit: false, arrivedAt: 924, startedAt: 931,
  });
  ME.lastVisit = lastDay;

  // 患者情報を予約データに合わせる（最終来院・来院回数・初診日・キャンセル回数・次のリコール）
  for (const p of REGULARS) {
    const mine = out.filter(a => a.patientId === p.id);
    const done = mine.filter(a => a.status === "completed").map(a => a.date).sort();
    if (done.length) {
      p.lastVisit = fromKey(done[done.length - 1]);
      p.visits = Math.max(p.visits, done.length + 1);
      const first = fromKey(done[0]);
      if (p.firstVisit >= first) p.firstVisit = subDays(first, int(40, 900));
    } else if (p.lastVisit && p.lastVisit >= WINDOW_START) {
      p.lastVisit = subDays(WINDOW_START, int(1, 160));
    }
    if (p.lastVisit && p.firstVisit > p.lastVisit) p.firstVisit = subDays(p.lastVisit, int(40, 900));
    p.nextRecall = p.lastVisit ? addMonths(p.lastVisit, p.recallMonths) : undefined;
    p.cancellations = Math.max(p.cancellations, mine.filter(a => a.status === "cancelled").length);
    p.noShows = Math.max(p.noShows, mine.filter(a => a.status === "no_show").length);
  }
  return out;
}
function isOpenOrNext(d: Date): Date {
  const x = new Date(d);
  while (!hoursFor(x)) x.setDate(x.getDate() + 1);
  return x;
}

export const initialAppointments: Appointment[] = buildAppointments();

const HISTORY: [string, string][] = [
  ["右下6番 CR充填", "sv03"], ["歯石除去・TBI", "sv01"], ["左上4番 根管充填", "sv04"], ["PMTC・フッ素塗布", "sv02"],
  ["右上7番 インレー装着", "sv08"], ["歯周ポケット検査・SRP", "sv05"], ["入れ歯の調整（当たりを除去）", "sv07"],
  ["左下5番 冷水痛の経過観察", "sv03"], ["定期検診。問題なし", "sv01"],
];
const HISTORY_CHILD: [string, string][] = [["フッ素塗布", "sv09"], ["右下6番 シーラント", "sv09"], ["定期検診。仕上げ磨きを指導", "sv01"]];

/**
 * 予約データの期間（WINDOW_START＝42日前）より前の来院記録。患者詳細の履歴に使う。
 * 期間内の来院はストアの予約（status: completed）から出すこと。内容は患者ごとに固定。
 */
export function visitsOf(p: Patient): VisitRecord[] {
  const r = mulberry32(p.id.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7));
  const inWindow = initialAppointments.filter(a => a.patientId === p.id && a.status === "completed").length;
  const n = Math.max(0, Math.min(p.visits - inWindow, 8));
  const child = TODAY.getTime() - p.birth.getTime() < 15 * 365.25 * 86_400_000;
  let d = p.lastVisit && p.lastVisit < WINDOW_START ? p.lastVisit : subDays(WINDOW_START, 3 + Math.floor(r() * 25));
  const out: VisitRecord[] = [];
  for (let i = 0; i < n && d >= p.firstVisit; i++) {
    const pool = child ? HISTORY_CHILD : HISTORY;
    const [note, serviceId] = pool[Math.floor(r() * pool.length)];
    const by = services.find(s => s.id === serviceId)!.by;
    const staffId = by === "Dr" ? (r() < 0.6 ? "s1" : "s2") : r() < 0.5 ? "s3" : "s4";
    out.push({ date: d, serviceId, staffId, note });
    d = subDays(d, 30 + Math.floor(r() * 70));
  }
  return out;
}

// ─── 診療メモ ───────────────────────────────────────────────────────────────
type ToothKey = NonNullable<Memo["teeth"]>[number];
type MemoLine = { body: string; teeth?: ToothKey[]; next?: string; state?: ToothState };
const MEMO_LINES: Record<string, MemoLine[]> = {
  sv01: [
    { body: "歯石除去・TBI。PCR 28%。右下の歯間部に磨き残し", next: "3か月後に定期検診" },
    { body: "定期検診。新しいむし歯なし。歯ぐきの状態も良好", next: "3か月後に定期検診" },
    { body: "歯石除去。左上6番の歯ぐきに軽い腫れ。経過観察", teeth: ["UL6"], next: "1か月後に歯ぐきの再チェック", state: "観察" },
  ],
  sv02: [
    { body: "PMTC・フッ素塗布。コーヒーの着色が多め", next: "2か月後にPMTC" },
    { body: "PMTC。前回より着色は減少。歯間ブラシ SSS を案内" },
  ],
  sv03: [
    { body: "右下6番 CR充填。しみる症状は消失", teeth: ["LR6"], next: "左下5番 CR・30分", state: "CR" },
    { body: "左上5番 C2。インレー形成・印象", teeth: ["UL5"], next: "左上5番 インレーセット・30分", state: "In" },
    { body: "右上4番 CR充填。浸潤麻酔あり", teeth: ["UR4"], state: "CR" },
  ],
  sv04: [
    { body: "左上4番 根管拡大・洗浄（2回目）。打診痛は軽減", teeth: ["UL4"], next: "左上4番 根管充填・45分", state: "RCT" },
    { body: "右下7番 根管充填。術後のX線で確認", teeth: ["LR7"], next: "右下7番 支台築造・45分", state: "RCT" },
  ],
  sv05: [
    { body: "右下 SRP（1/4ブロック目）。出血あり。浸潤麻酔使用", teeth: ["LR6", "LR7"], next: "左下 SRP・45分" },
    { body: "左上 SRP。歯周ポケット 4〜5mm の部位を中心に", teeth: ["UL6", "UL7"], next: "右上 SRP・45分" },
  ],
  sv06: [
    { body: "左下8番 抜歯。止血を確認。抗生剤と痛み止めを処方", teeth: ["LL8"], next: "翌日 消毒・15分", state: "M" },
    { body: "右上8番 抜歯。術後の注意を説明。腫れは数日で引く見込み", teeth: ["UR8"], next: "1週間後 抜糸・15分", state: "M" },
  ],
  sv07: [
    { body: "上の入れ歯 当たりを2か所調整。痛みは軽減", next: "2週間後に再調整" },
    { body: "下の入れ歯 クラスプを調整。食事時の外れが改善" },
  ],
  sv08: [
    { body: "右上6番 クラウンセット。咬み合わせ良好", teeth: ["UR6"], state: "Cr" },
    { body: "左下6番 支台形成・印象。仮歯を装着", teeth: ["LL6"], next: "左下6番 クラウンセット・45分", state: "Cr" },
  ],
  sv09: [
    { body: "フッ素塗布。仕上げ磨きの方法を保護者に説明", next: "3か月後にフッ素塗布" },
    { body: "右下6番 シーラント。泣かずに頑張れました", teeth: ["LR6"] },
  ],
  sv10: [
    { body: "初診。パノラマ撮影・歯周検査。主訴は右下の冷水痛", teeth: ["LR6"], next: "右下6番 むし歯治療・30分", state: "C" },
    { body: "初診。全体のクリーニング希望。むし歯は2本（右上5番・左下6番）", teeth: ["UR5", "LL6"], next: "歯周病治療（SRP）・45分", state: "C" },
  ],
  sv11: [{ body: "オフィスホワイトニング1回目。シェード A3 → A2。知覚過敏なし", next: "2週間後に2回目" }],
  sv12: [{ body: "左下6番欠損部のインプラント相談。CT撮影の予約を案内", teeth: ["LL6"], next: "CT撮影・30分", state: "M" }],
  sv13: [{ body: "マウスピース矯正の相談。口腔内スキャンと費用を説明" }],
};

/** 15歳未満の患者さんのメモ（永久歯の6番・7番だけを扱う） */
const MEMO_LINES_CHILD: Record<string, MemoLine[]> = {
  sv01: [{ body: "定期検診。フッ素塗布。仕上げ磨きのコツを保護者に説明", next: "3か月後に定期検診" }],
  sv02: [{ body: "クリーニング。歯みがきの練習を一緒に行った" }],
  sv03: [{ body: "右下6番 小さなむし歯をCR充填。よく頑張りました", teeth: ["LR6"], state: "CR" }],
  sv09: MEMO_LINES.sv09,
  sv10: [{ body: "初診。お口全体のチェックとフッ素塗布。保護者に食生活のアドバイス", next: "3か月後に定期検診" }],
  sv13: [{ body: "小児矯正の相談。歯並びの経過を半年ごとに確認", next: "6か月後に経過観察" }],
};

/** 直近の来院に付いている診療メモ（受付・衛生士・歯科医師の申し送り）。書いた処置は歯式にも反映する */
export const initialMemos: Memo[] = (() => {
  const r = mulberry32(4242);
  const out: Memo[] = [];
  const from = key(subDays(TODAY, 21));
  const done = initialAppointments
    .filter(a => a.status === "completed" && a.date >= from && a.date <= TODAY_KEY)
    .sort((a, b) => (a.date === b.date ? b.start - a.start : a.date < b.date ? 1 : -1));
  const toothUpdates: [Patient, ToothKey[], ToothState][] = [];
  done.forEach((a, i) => {
    if (r() > 0.62) return;
    const p = patientById(a.patientId);
    const child = ageOf(p) < 15;
    const pool = (child ? MEMO_LINES_CHILD[a.serviceId] ?? MEMO_LINES_CHILD.sv01 : MEMO_LINES[a.serviceId]) ?? MEMO_LINES.sv01;
    const line = pool[Math.floor(r() * pool.length)];
    if (line.state && line.teeth) toothUpdates.push([p, line.teeth, line.state]);
    out.push({
      id: `m${String(i + 1).padStart(4, "0")}`,
      patientId: a.patientId,
      apptId: a.id,
      date: a.date,
      at: a.end + Math.floor(r() * 8),
      staffId: a.staffId,
      body: line.body,
      teeth: line.teeth,
      next: line.next,
    });
  });
  // 古いメモから順に、歯式に反映する
  for (const [p, teeth, st] of toothUpdates.reverse()) for (const t of teeth) p.teeth[t] = st;
  // 気をつけたい患者には固定メモ
  out.push({ id: "m-pin-1", patientId: ANTICOAG_PATIENT.id, date: key(subDays(TODAY, 40)), at: 640, staffId: "s1", body: "ワーファリン服用中。観血処置の前に PT-INR を確認する（かかりつけ内科：桜新町内科）", pinned: true });
  out.push({ id: "m-pin-2", patientId: ALLERGY_PATIENT.id, date: key(subDays(TODAY, 120)), at: 600, staffId: "s3", body: "ラテックスアレルギー。ニトリルグローブ・ラバーダムはノンラテックスを使用", pinned: true });
  return out;
})();

// ─── Web予約の空き枠 ─────────────────────────────────────────────────────────
/** その日に、指定の長さで予約できる開始時刻（分）。30分刻み */
export function availableStarts(day: Date, minutes: number, appts: Appointment[]): number[] {
  const h = hoursFor(day);
  if (!h) return [];
  const dk = key(day);
  const busy = appts.filter(a => a.date === dk && a.status !== "cancelled" && a.status !== "no_show");
  const res: number[] = [];
  for (const [ws, we] of [h.am, h.pm]) {
    for (let t = ws; t + minutes <= we; t += 30) {
      const free = units.some(u => !busy.some(a => a.unitId === u.id && a.start < t + minutes && a.end > t));
      if (free) res.push(t);
    }
  }
  return res;
}

// ─── レポート（予約データから集計） ───────────────────────────────────────────
const weekStart = WEEK_START;
function capacityMinutes(from: Date, to: Date): number {
  let m = 0;
  for (let d = new Date(from); d < to; d.setDate(d.getDate() + 1)) {
    const h = hoursFor(d);
    if (h) m += (h.am[1] - h.am[0] + h.pm[1] - h.pm[0]) * units.length;
  }
  return m;
}
/** from〜to（to は含まない）の予約を集計する */
export function summarize(from: Date, to: Date) {
  const f = key(from);
  const t = key(to);
  const xs = initialAppointments.filter(a => a.date >= f && a.date < t);
  const done = xs.filter(a => a.status === "completed");
  const booked = xs.filter(a => a.status !== "cancelled" && a.status !== "no_show");
  const n = Math.max(1, xs.length);
  const cancellations = xs.filter(a => a.status === "cancelled").length;
  const noShows = xs.filter(a => a.status === "no_show").length;
  return {
    appointments: xs.length,
    visits: done.length,
    newPatients: done.filter(a => a.firstVisit).length,
    cancellations,
    noShows,
    cancelRate: cancellations / n,
    noShowRate: noShows / n,
    webRatio: xs.filter(a => a.source === "web").length / n,
    selfPay: done.reduce((sum, a) => sum + (serviceById(a.serviceId).price ?? 0), 0),
    utilization: booked.reduce((sum, a) => sum + (a.end - a.start), 0) / Math.max(1, capacityMinutes(from, to)),
  };
}
/** 先週までの12週（月曜はじまり）。最後の要素が先週 */
export const weekly = Array.from({ length: 12 }, (_, i) => {
  const w = subDays(weekStart, (12 - i) * 7);
  const x = summarize(w, addDays(w, 7));
  return { week: w, visits: x.visits, newPatients: x.newPatients, cancellations: x.cancellations, noShows: x.noShows, webRatio: x.webRatio, selfPay: x.selfPay };
});
const last30 = summarize(subDays(TODAY, 30), TODAY);
const prev30 = summarize(subDays(TODAY, 60), subDays(TODAY, 30));
/** 直近30日（今日は含まない）と、その前の30日 */
export const kpis = {
  visitsMonth: last30.visits, visitsPrev: prev30.visits,
  newMonth: last30.newPatients, newPrev: prev30.newPatients,
  cancelRate: last30.cancelRate, cancelPrev: prev30.cancelRate,
  noShowRate: last30.noShowRate, noShowPrev: prev30.noShowRate,
  webRatio: last30.webRatio, webPrev: prev30.webRatio,
  selfPayMonth: last30.selfPay, selfPayPrev: prev30.selfPay,
  utilization: last30.utilization, utilizationPrev: prev30.utilization,
  recallReturn: 0.68, recallReturnPrev: 0.63,
};
/** ユニット稼働率のヒートマップ（診療曜日 × 9時〜18時台、直近8週）。null は診療時間外 */
export const HEATMAP_DAYS = ["月", "火", "水", "金", "土"];
export const HEATMAP_HOURS = Array.from({ length: 10 }, (_, i) => 9 + i);
export const heatmap: (number | null)[][] = (() => {
  const DOW: Record<string, number> = { 月: 1, 火: 2, 水: 3, 金: 5, 土: 6 };
  const byDate = new Map<string, Appointment[]>();
  for (const a of initialAppointments) {
    if (a.status === "cancelled" || a.status === "no_show") continue;
    const list = byDate.get(a.date);
    if (list) list.push(a);
    else byDate.set(a.date, [a]);
  }
  return HEATMAP_DAYS.map(dn =>
    HEATMAP_HOURS.map(hour => {
      let avail = 0;
      let used = 0;
      const hs = hour * 60;
      const he = hs + 60;
      for (let d = subDays(TODAY, 56); d < TODAY; d = addDays(d, 1)) {
        if (d.getDay() !== DOW[dn]) continue;
        const h = hoursFor(d);
        if (!h) continue;
        const open = [h.am, h.pm].reduce((sum, [a, b]) => sum + Math.max(0, Math.min(b, he) - Math.max(a, hs)), 0);
        if (!open) continue;
        avail += open * units.length;
        for (const a of byDate.get(key(d)) ?? []) used += Math.max(0, Math.min(a.end, he) - Math.max(a.start, hs));
      }
      return avail ? Math.min(1, used / avail) : null;
    }),
  );
})();

// ─── リコール ───────────────────────────────────────────────────────────────
/** 定期検診の時期（nextRecall）が前後30日に入っている患者さん。予約が入っていれば「予約済み」 */
export const recalls: RecallItem[] = (() => {
  const from = subDays(TODAY, 30);
  const to = addDays(TODAY, 30);
  const CHECKUP = new Set(["sv01", "sv02", "sv09"]);
  const recallTaken = new Set<string>();
  const items = REGULARS.filter(p => p.nextRecall && p.nextRecall >= from && p.nextRecall <= to)
    .sort((a, b) => Math.abs(a.nextRecall!.getTime() - TODAY.getTime()) - Math.abs(b.nextRecall!.getTime() - TODAY.getTime()))
    .slice(0, 40)
    .sort((a, b) => a.nextRecall!.getTime() - b.nextRecall!.getTime())
    .map((p, idx): RecallItem => {
      let booked = initialAppointments.some(a => a.patientId === p.id && a.date > TODAY_KEY && CHECKUP.has(a.serviceId) && (a.status === "confirmed" || a.status === "pending"));
      // リコールのお知らせを見て、何人かはすでに定期検診を予約している
      if (!booked && idx % 4 === 1) {
        const slot = initialAppointments.find(a => a.date > TODAY_KEY && (a.serviceId === "sv01" || a.serviceId === "sv02") && a.status === "confirmed" && a.id !== "a-me-next" && !recallTaken.has(a.id));
        if (slot) {
          recallTaken.add(slot.id);
          Object.assign(slot, { patientId: p.id, source: p.line ? "line" : "web" });
          booked = true;
        }
      }
      const due = p.nextRecall!;
      const status: RecallItem["status"] = booked ? "予約済み" : due < TODAY ? pick(["未連絡", "送信済み", "送信済み"] as const) : pick(["未連絡", "未連絡", "送信済み", "保留"] as const);
      return {
        patientId: p.id, due, status,
        channel: p.line ? "LINE" : p.email ? pick(["メール", "SMS"] as const) : pick(["SMS", "電話"] as const),
        sentAt: status === "送信済み" || status === "予約済み" ? subDays(TODAY, int(1, 12)) : undefined,
      };
    });
  // 患者アプリの本人は、LINEで届いたリコールから予約済み
  items.unshift({ patientId: ME.id, due: ME.nextRecall ?? addDays(TODAY, 6), status: "予約済み", channel: "LINE", sentAt: subDays(TODAY, 9) });
  return items;
})();

// ─── お知らせ ───────────────────────────────────────────────────────────────
/** 台帳の実際の予約から作ったお知らせ（apptId で予約を開ける） */
export const notices: Notice[] = (() => {
  const n = now();
  const at = (minAgo: number) => new Date(n.getTime() - minAgo * 60_000);
  const A = initialAppointments;
  const nameOf = (a: Appointment) => patientById(a.patientId).name;
  const svc = (a: Appointment) => serviceById(a.serviceId).name;
  const dayLabel = (k: string) => {
    const r = relDay(fromKey(k), TODAY);
    return r === "今日" ? "本日" : r === "明日" ? "明日" : mdw(fromKey(k));
  };
  const when = (a: Appointment) => `${dayLabel(a.date)} ${hm(a.start)}`;
  const pending = A.find(a => a.date === TODAY_KEY && a.status === "pending");
  const cancelled = A.find(a => a.date === TODAY_KEY && a.status === "cancelled");
  const recallItem = recalls.find(r => r.status === "予約済み" && r.patientId !== ME.id && r.channel === "LINE");
  const recallAppt = recallItem && A.find(a => a.patientId === recallItem.patientId && a.date > TODAY_KEY && a.status !== "cancelled");
  const newWeb = A.find(a => a.date > TODAY_KEY && a.source === "web" && a.status === "confirmed" && !a.firstVisit && a.id !== "a-me-next");
  const changed = A.find(a => a.date > TODAY_KEY && a.status === "confirmed" && a.source === "phone");
  const firstNext = A.find(a => a.firstVisit && a.date > TODAY_KEY && a.status !== "cancelled");
  const todays = A.filter(a => a.date === TODAY_KEY && a.status !== "cancelled");
  const ch = { LINE: 0, メール: 0, SMS: 0 };
  for (const a of todays) {
    const p = patientById(a.patientId);
    ch[p.line ? "LINE" : p.email ? "メール" : "SMS"]++;
  }
  const list: Notice[] = [];
  if (pending) list.push({ id: "n1", at: at(4), kind: "web", title: "Web予約のリクエストが届きました", body: `${nameOf(pending)}さん・${when(pending)} ${svc(pending)}（承認待ち）`, read: false, apptId: pending.id });
  if (cancelled) list.push({ id: "n2", at: at(18), kind: "cancel", title: "予約がキャンセルされました", body: `${nameOf(cancelled)}さん・${when(cancelled)} ${svc(cancelled)}（${cancelled.cancelReason ?? "理由の入力なし"}）`, read: false, apptId: cancelled.id });
  if (recallAppt) list.push({ id: "n3", at: at(52), kind: "recall", title: "リコールから予約が入りました", body: `${nameOf(recallAppt)}さん・${when(recallAppt)} ${svc(recallAppt)}（LINE）`, read: false, apptId: recallAppt.id });
  if (changed) {
    const prev = fromKey(changed.date);
    do prev.setDate(prev.getDate() - 1); while (!hoursFor(prev));
    const prevStart = changed.start >= 960 ? changed.start - 90 : changed.start + 60;
    list.push({ id: "n4", at: at(95), kind: "change", title: "予約が変更されました", body: `${nameOf(changed)}さん・${mdw(prev)} ${hm(prevStart)} → ${when(changed)}`, read: true, apptId: changed.id });
  }
  list.push({ id: "n5", at: at(162), kind: "remind", title: "本日のリマインドを送りました", body: `${todays.length}件（LINE ${ch.LINE}件・メール ${ch["メール"]}件・SMS ${ch.SMS}件）`, read: true });
  list.push({ id: "n6", at: at(330), kind: "review", title: "新しい口コミが届きました", body: "★★★★★「説明が丁寧で、安心して治療を受けられました」", read: true });
  if (newWeb) list.push({ id: "n7", at: at(1500), kind: "web", title: "Web予約が入りました", body: `${nameOf(newWeb)}さん・${when(newWeb)} ${svc(newWeb)}`, read: true, apptId: newWeb.id });
  if (firstNext) list.push({ id: "n8", at: at(1720), kind: "web", title: "初診のWeb予約が入りました", body: `${nameOf(firstNext)}さん・${when(firstNext)} 初診・カウンセリング（問診票 回答済み）`, read: true, apptId: firstNext.id });
  const y = TODAY.getMonth() >= 10 ? TODAY.getFullYear() : TODAY.getFullYear() - 1;
  list.push({ id: "n9", at: at(2900), kind: "system", title: "年末年始の休診日を登録しました", body: `${mdw(new Date(y, 11, 29))}〜${mdw(new Date(y + 1, 0, 4))}は休診です。Web予約にも反映しました`, read: true });
  return list;
})();

// ─── シフト・勤怠 ───────────────────────────────────────────────────────────
export const shiftWeek: ShiftCell[] = (() => {
  const cells: ShiftCell[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const h = hoursFor(d);
    for (const s of staff) {
      if (!h) { cells.push({ staffId: s.id, date: key(d), off: true }); continue; }
      const off = (s.id === "s2" && d.getDay() === 3) || (s.id === "s4" && d.getDay() === 6) || (s.id === "s5" && d.getDay() === 1);
      if (off) { cells.push({ staffId: s.id, date: key(d), off: true, note: "希望休" }); continue; }
      const short = s.id === "s5" && d.getDay() === 2;
      cells.push({ staffId: s.id, date: key(d), start: h.am[0] - 15, end: short ? 780 : h.pm[1] + 15 });
    }
  }
  return cells;
})();
export const attendanceToday: AttendanceRow[] = [
  { staffId: "s1", clockIn: 521, state: "勤務中" },
  { staffId: "s2", clockIn: 527, state: "勤務中" },
  { staffId: "s3", clockIn: 524, state: "勤務中" },
  { staffId: "s4", clockIn: 532, state: "勤務中" },
  { staffId: "s5", state: "未出勤" },
  { staffId: "s6", clockIn: 515, breakStart: 630, state: "休憩中" },
];

// ─── 運営コンソール ─────────────────────────────────────────────────────────
export const PLANS: Record<ConsoleClinic["plan"], { label: string; price: number | null }> = {
  free: { label: "フリー", price: 0 },
  standard: { label: "スタンダード", price: 9800 },
  pro: { label: "プロ", price: 19800 },
  enterprise: { label: "エンタープライズ", price: null },
  partner: { label: "パートナー", price: 0 },
};
export const addons: Addon[] = [
  { key: "line_reminder", name: "LINEリマインダー", price: 1980, description: "予約の前日にLINEでお知らせ", active: true },
  { key: "sms_pack", name: "SMS通知パック", price: 1980, description: "月100通までSMSでリマインド", active: true },
  { key: "recall", name: "患者リコール機能", price: 1980, description: "定期検診のご案内を自動送信", active: true },
  { key: "waitlist", name: "キャンセル待ち機能", price: 980, description: "空きが出たら順番にお知らせ", active: true },
  { key: "questionnaire", name: "問診票機能", price: 1980, description: "初診の問診をWebで事前に回答", active: true },
];
const series = (base: number, growth: number) => Array.from({ length: 12 }, (_, i) => Math.max(0, Math.round(base * (1 + growth * i / 11) + (R() - 0.5) * base * 0.18)));
export const consoleClinics: ConsoleClinic[] = [
  { id: "c1", name: "ひだまり歯科クリニック", city: "東京都世田谷区", plan: "pro", active: true, createdAt: subDays(TODAY, 412), staff: 6, units: 4, appts30d: 731, apptsSeries: series(168, 0.14), webRatio: 0.41, addons: ["line_reminder", "recall", "questionnaire"], lastActiveAt: subDays(now(), 0), setup: { hours: true, menu: true, staff: true, email: true, line: true } },
  { id: "c2", name: "みなとみらいデンタルオフィス", city: "神奈川県横浜市", plan: "standard", active: true, createdAt: subDays(TODAY, 233), staff: 5, units: 3, appts30d: 512, apptsSeries: series(118, 0.08), webRatio: 0.33, addons: ["sms_pack"], lastActiveAt: subDays(now(), 0), setup: { hours: true, menu: true, staff: true, email: true, line: false } },
  { id: "c3", name: "なかの駅前歯科", city: "東京都中野区", plan: "standard", active: true, createdAt: subDays(TODAY, 151), staff: 4, units: 3, appts30d: 388, apptsSeries: series(92, 0.05), webRatio: 0.27, addons: ["waitlist"], lastActiveAt: subDays(now(), 1), setup: { hours: true, menu: true, staff: true, email: false, line: false } },
  { id: "c4", name: "あおば小児歯科", city: "宮城県仙台市", plan: "pro", active: true, createdAt: subDays(TODAY, 298), staff: 7, units: 5, appts30d: 846, apptsSeries: series(190, 0.11), webRatio: 0.52, addons: ["line_reminder", "sms_pack", "recall", "waitlist", "questionnaire"], lastActiveAt: subDays(now(), 0), setup: { hours: true, menu: true, staff: true, email: true, line: true } },
  { id: "c5", name: "さくら通り歯科", city: "愛知県名古屋市", plan: "free", active: true, createdAt: subDays(TODAY, 19), staff: 1, units: 2, appts30d: 41, apptsSeries: series(6, 1.4), webRatio: 0.18, addons: [], lastActiveAt: subDays(now(), 2), setup: { hours: true, menu: false, staff: true, email: false, line: false } },
  { id: "c6", name: "北浜デンタルクリニック", city: "大阪府大阪市", plan: "enterprise", active: true, createdAt: subDays(TODAY, 520), staff: 18, units: 12, appts30d: 2188, apptsSeries: series(498, 0.06), webRatio: 0.46, addons: ["line_reminder", "sms_pack", "recall", "questionnaire"], lastActiveAt: subDays(now(), 0), setup: { hours: true, menu: true, staff: true, email: true, line: true } },
  { id: "c7", name: "しらかば歯科医院", city: "北海道札幌市", plan: "partner", active: true, createdAt: subDays(TODAY, 540), staff: 3, units: 3, appts30d: 274, apptsSeries: series(70, -0.04), webRatio: 0.22, addons: ["line_reminder", "recall"], lastActiveAt: subDays(now(), 9), setup: { hours: true, menu: true, staff: true, email: true, line: true } },
  { id: "c8", name: "ことり歯科", city: "福岡県福岡市", plan: "free", active: false, createdAt: subDays(TODAY, 77), staff: 1, units: 1, appts30d: 0, apptsSeries: series(4, -1), webRatio: 0, addons: [], lastActiveAt: subDays(now(), 41), setup: { hours: true, menu: false, staff: false, email: false, line: false } },
];
{
  const c1 = consoleClinics[0];
  c1.appts30d = last30.appointments;
  c1.webRatio = Math.round(last30.webRatio * 100) / 100;
  c1.apptsSeries = weekly.map(w => summarize(w.week, addDays(w.week, 7)).appointments);
}
export const consoleMonthly = Array.from({ length: 12 }, (_, i) => ({
  month: subMonths(TODAY, 11 - i),
  mrr: Math.round(18000 + i * 6400 + (R() - 0.3) * 4000),
  clinics: Math.min(8, 2 + Math.floor(i * 0.6)),
}));
