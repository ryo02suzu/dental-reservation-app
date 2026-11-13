// プロトタイプのサンプルデータの型。実アプリ（shared/schema.ts）の項目名にできるだけ合わせている。

export type Role = "院長" | "歯科医師" | "歯科衛生士" | "歯科助手" | "受付";

export interface Staff {
  id: string;
  name: string;
  kana: string;
  role: Role;
  /** 予約台帳の担当者列やアバターに使う補助色（tile.* のキー） */
  tone: TileTone;
  short: string; // 予約ブロックに出す略称（例: "佐伯"）
}

export interface Unit {
  id: string;
  name: string; // "ユニット1"
  short: string; // "U1"
}

export type TileTone = "sand" | "graphite" | "slate" | "sage" | "clay" | "plum" | "ocean" | "amber";

export interface Service {
  id: string;
  name: string;
  short: string; // 台帳のブロックに出す短い名前
  minutes: number;
  insurance: boolean; // true=保険診療 / false=自費
  price?: number; // 自費の目安料金
  category: "予防" | "一般" | "歯周" | "外科" | "補綴" | "小児" | "審美" | "相談";
  by: "Dr" | "DH"; // 主に担当する職種
  description: string;
}

export type InsuranceType = "社保本人" | "社保家族" | "国保" | "後期高齢者" | "子ども医療証";

/** 歯式の記号。FDI番号ではなく日本の歯科で一般的な「右上6番」型の表記で持つ */
export type ToothState = "C" | "CR" | "In" | "Cr" | "RCT" | "M" | "Imp" | "Br" | "観察";
export type Quadrant = "UR" | "UL" | "LR" | "LL"; // 右上・左上・右下・左下（患者から見た左右）

export interface Patient {
  id: string;
  number: string; // 診察券番号
  name: string;
  kana: string;
  sex: "女性" | "男性";
  birth: Date;
  phone: string;
  email?: string;
  insurance: InsuranceType;
  firstVisit: Date;
  lastVisit?: Date;
  visits: number;
  recallMonths: 3 | 4 | 6;
  nextRecall?: Date;
  cancellations: number;
  noShows: number;
  line: boolean; // LINE連携済み
  allergies: string[];
  conditions: string[]; // 既往歴・服薬（抗凝固薬など歯科で重要なもの）
  memo?: string;
  teeth: Partial<Record<`${Quadrant}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`, ToothState>>;
}

export type ApptStatus =
  | "pending" // 仮予約（Web予約の承認待ち）
  | "confirmed"
  | "arrived" // 来院済み（待合）
  | "in_progress" // 診療中
  | "completed"
  | "cancelled"
  | "no_show";

export type ApptSource = "web" | "phone" | "walkin" | "line";

export interface Appointment {
  id: string;
  date: string; // yyyy-MM-dd
  start: number; // 0:00からの分
  end: number;
  patientId: string;
  serviceId: string;
  staffId: string;
  unitId: string;
  status: ApptStatus;
  source: ApptSource;
  firstVisit: boolean;
  note?: string;
  arrivedAt?: number; // 来院した時刻（分）
  startedAt?: number; // 診療開始（分）
  cancelReason?: string;
  /** 受付端末で受付したときの受付番号 */
  receiptNo?: number;
}

export interface VisitRecord {
  date: Date;
  serviceId: string;
  staffId: string;
  note: string; // 簡単な診療メモ（例: 右下6番 CR充填）
}

/** 診療メモ（受付・衛生士・歯科医師で共有する申し送り。カルテではない） */
export interface Memo {
  id: string;
  patientId: string;
  apptId?: string;
  date: string; // yyyy-MM-dd
  at: number; // 書いた時刻（0:00からの分）
  staffId: string; // 書いた人
  body: string; // 例: 右下6番 CR充填。しみる症状は消失
  teeth?: `${Quadrant}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`[]; // 関係する歯（例: ["LR6"]）
  next?: string; // 次回の予定（例: 左下5番 CR・30分）
  pinned?: boolean; // 患者ごとに上に固定する重要メモ
}

export interface RecallItem {
  patientId: string;
  due: Date;
  status: "未連絡" | "送信済み" | "予約済み" | "保留";
  channel: "LINE" | "SMS" | "メール" | "電話";
  sentAt?: Date;
}

export interface Notice {
  id: string;
  at: Date;
  kind: "web" | "cancel" | "change" | "review" | "recall" | "remind" | "system";
  title: string;
  body: string;
  read: boolean;
  apptId?: string;
}

export interface ShiftCell {
  staffId: string;
  date: string;
  start?: number;
  end?: number;
  off?: boolean;
  note?: string;
}

export interface AttendanceRow {
  staffId: string;
  clockIn?: number;
  breakStart?: number;
  breakEnd?: number;
  clockOut?: number;
  state: "勤務中" | "休憩中" | "退勤" | "未出勤" | "休み";
}

export type PlanKey = "free" | "standard" | "pro" | "enterprise" | "partner";

export interface ConsoleClinic {
  id: string;
  name: string;
  city: string;
  plan: PlanKey;
  active: boolean;
  createdAt: Date;
  staff: number;
  units: number;
  appts30d: number;
  apptsSeries: number[]; // 直近12週の予約件数
  webRatio: number; // Web予約の割合 0-1
  addons: string[];
  lastActiveAt: Date;
  setup: { hours: boolean; menu: boolean; staff: boolean; email: boolean; line: boolean };
}

export interface Addon {
  key: string;
  name: string;
  price: number;
  description: string;
  active: boolean;
}
