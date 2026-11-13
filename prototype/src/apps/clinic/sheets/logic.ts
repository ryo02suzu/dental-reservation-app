// 予約の詳細・新規予約・検索（⌘K）で共通に使う計算と、セッション中だけの小さな記憶。
import { useSyncExternalStore } from "react";
import { addDays } from "date-fns";
import { TODAY, TODAY_KEY, isClinicOpenDay, minutesOfDay, now } from "@/lib/clock";
import { ago, fromKey, hm, key, matchesPatient, md, mdw } from "@/lib/format";
import { getHolidayName } from "@/lib/holidays";
import { availableStarts, hoursFor, staff, units, type Appointment, type ApptSource, type Patient, type Service, type Staff } from "@/data";

// ─── 予約経路 ────────────────────────────────────────────────────────────────
export const SOURCE_LABEL: Record<ApptSource, string> = { web: "Web予約", phone: "電話", line: "LINE", walkin: "飛び込み" };

/** 新規予約で「来院時」（窓口で次回の予約を取った）を選んだ予約。データ上の経路は walkin */
const deskBooked = new Set<string>();
export const markDeskBooked = (id: string) => void deskBooked.add(id);
export const sourceLabel = (a: Appointment) => (a.source === "walkin" && deskBooked.has(a.id) ? "来院時に予約" : SOURCE_LABEL[a.source]);

/** 完了にした時刻（このセッションで完了にしたものだけ分かる） */
const completedAt = new Map<string, number>();
export const markCompleted = (id: string) => void completedAt.set(id, minutesOfDay(now()));
export const completedTime = (id: string) => completedAt.get(id);

// ─── 生年月日が未登録の患者さん（新規登録で省略したとき） ──────────────────
const noBirth = new Set<string>();
export const markNoBirth = (id: string) => void noBirth.add(id);
export const birthUnknown = (p: Patient) => noBirth.has(p.id);

// ─── 最近見た患者（検索の空欄時に出す。メモリ上だけ） ──────────────────────
let recent: string[] = [];
const subs = new Set<() => void>();
export function pushRecentPatient(id: string) {
  if (recent[0] === id) return;
  recent = [id, ...recent.filter(x => x !== id)].slice(0, 8);
  subs.forEach(f => f());
}
export function useRecentPatients(): string[] {
  return useSyncExternalStore(
    cb => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => recent,
    () => recent,
  );
}

// ─── ユニット・担当 ──────────────────────────────────────────────────────────
/** ユニットごとのいつもの担当（u1 院長 / u2 歯科医師 / u3・u4 歯科衛生士） */
export const USUAL_STAFF: Record<string, string> = { u1: "s1", u2: "s2", u3: "s3", u4: "s4" };

/** メニューを担当できるスタッフ（Dr=院長・歯科医師、DH=歯科衛生士） */
export function eligibleStaff(sv: Service): Staff[] {
  return staff.filter(s => (sv.by === "Dr" ? s.role === "院長" || s.role === "歯科医師" : s.role === "歯科衛生士"));
}

const live = (a: Appointment) => a.status !== "cancelled" && a.status !== "no_show";
const overlaps = (a: Appointment, date: string, start: number, end: number) => a.date === date && a.start < end && a.end > start;

export function unitBusy(appts: Appointment[], unitId: string, date: string, start: number, end: number, exclude?: string) {
  return appts.some(a => a.id !== exclude && live(a) && a.unitId === unitId && overlaps(a, date, start, end));
}
export function staffConflict(appts: Appointment[], staffId: string, date: string, start: number, end: number, exclude?: string) {
  return appts.find(a => a.id !== exclude && live(a) && a.staffId === staffId && overlaps(a, date, start, end));
}

/** 空いているユニットを選ぶ。prefer が空いていればそれ、なければ職種に合うユニットから */
export function pickUnit(appts: Appointment[], sv: Service, date: string, start: number, end: number, prefer?: string, exclude?: string): string | undefined {
  const free = units.filter(u => !unitBusy(appts, u.id, date, start, end, exclude)).map(u => u.id);
  if (prefer && free.includes(prefer)) return prefer;
  const order = sv.by === "Dr" ? ["u1", "u2", "u3", "u4"] : ["u3", "u4", "u1", "u2"];
  // いつもの担当がその時間に空いているユニットを優先
  const easy = order.find(u => free.includes(u) && eligibleStaff(sv).some(s => s.id === USUAL_STAFF[u]) && !staffConflict(appts, USUAL_STAFF[u], date, start, end, exclude));
  return easy ?? order.find(u => free.includes(u));
}

/** 担当を決める。ユニットのいつもの担当（職種が合えば）→ 空いている同じ職種の人 */
export function pickStaff(appts: Appointment[], sv: Service, unitId: string, date: string, start: number, end: number, prefer?: string, exclude?: string): string {
  const el = eligibleStaff(sv);
  if (prefer && el.some(s => s.id === prefer)) return prefer;
  const usual = USUAL_STAFF[unitId];
  if (el.some(s => s.id === usual) && !staffConflict(appts, usual, date, start, end, exclude)) return usual;
  const free = el.find(s => !staffConflict(appts, s.id, date, start, end, exclude));
  return (free ?? el.find(s => s.id === usual) ?? el[0]).id;
}

// ─── 日付と空き時間 ──────────────────────────────────────────────────────────
export interface DayOption {
  key: string;
  date: Date;
  open: boolean;
  /** 休診の理由（祝日名 or 休診日） */
  reason?: string;
}

/** 今日から、診療日が openCount 日ぶん入るまでの日付（休診日も理由つきで含める） */
export function upcomingDays(openCount: number, from: Date = TODAY): DayOption[] {
  const out: DayOption[] = [];
  let d = new Date(from);
  let n = 0;
  while (n < openCount && out.length < openCount * 2) {
    const k = key(d);
    const open = isClinicOpenDay(d);
    out.push({ key: k, date: new Date(d), open, reason: open ? undefined : getHolidayName(k) ?? "休診日" });
    if (open) n++;
    d = addDays(d, 1);
  }
  return out;
}

/** 診療時間の中で、その長さの予約を置ける開始時刻の候補（30分刻み）を午前・午後に分けて */
export function slotCandidates(day: Date, minutes: number): { am: number[]; pm: number[] } {
  const h = hoursFor(day);
  if (!h) return { am: [], pm: [] };
  const list = ([ws, we]: [number, number]) => {
    const r: number[] = [];
    for (let t = ws; t + minutes <= we; t += 30) r.push(t);
    return r;
  };
  return { am: list(h.am), pm: list(h.pm) };
}

/** 実際に予約できる開始時刻。今日は「いま」より後だけ */
export function openStarts(day: Date, minutes: number, appts: Appointment[]): Set<number> {
  const dk = key(day);
  if (dk < TODAY_KEY) return new Set();
  const list = availableStarts(day, minutes, appts);
  const nowMin = minutesOfDay(now());
  return new Set(dk === TODAY_KEY ? list.filter(t => t >= nowMin) : list);
}

/**
 * 患者さんの「いま」を一言で。今日来院中 → 次の予約 → 今日の完了 → 最終来院 の順に。
 * 例：「今日 11:00 来院済」「次回 11月20日（金）15:30」「最終来院 3か月前」
 */
export function visitLabel(appts: Appointment[], p: Patient, nowMin: number, short = false): string {
  const mine = appts.filter(a => a.patientId === p.id);
  const today = mine.filter(a => a.date === TODAY_KEY);
  const cur = today.find(a => a.status === "in_progress") ?? today.find(a => a.status === "arrived");
  if (cur) return `今日 ${hm(cur.start)} ${cur.status === "in_progress" ? "診療中" : "来院済"}`;
  const next = mine
    .filter(a => (a.status === "confirmed" || a.status === "pending") && (a.date > TODAY_KEY || (a.date === TODAY_KEY && a.end > nowMin)))
    .sort((x, y) => (x.date === y.date ? x.start - y.start : x.date < y.date ? -1 : 1))[0];
  if (next) return `次回 ${next.date === TODAY_KEY ? "今日" : short ? md(fromKey(next.date)) : mdw(fromKey(next.date))} ${hm(next.start)}`;
  const done = today.filter(a => a.status === "completed").sort((x, y) => y.start - x.start)[0];
  if (done) return `今日 ${hm(done.start)} 完了`;
  if (p.lastVisit) return `最終来院 ${ago(p.lastVisit, TODAY)}`;
  return "来院歴なし";
}

/** 自費の料金表示（0円は相談無料） */
export const priceLabel = (sv: Service) => (sv.insurance ? "保険" : sv.price ? `自費 ¥${sv.price.toLocaleString("ja-JP")}` : "相談無料");

/** 患者の年齢（生年月日が未登録なら null） */
export function ageOf(p: Patient, base: Date = TODAY): number | null {
  if (birthUnknown(p)) return null;
  let y = base.getFullYear() - p.birth.getFullYear();
  const m = base.getMonth() - p.birth.getMonth();
  if (m < 0 || (m === 0 && base.getDate() < p.birth.getDate())) y--;
  return y;
}

/**
 * 完了した予約の記録時刻（来院・診療開始・完了）。記録があればそれを、サンプルデータで
 * 記録のない過去の完了分は、予約IDから毎回同じになるように現実的な時刻を決める。
 */
export function recordedTimes(a: Appointment): { arrived?: number; started?: number; done?: number } {
  if (a.status !== "completed") return { arrived: a.arrivedAt, started: a.startedAt };
  let h = 0;
  for (const c of a.id) h = (h * 31 + c.charCodeAt(0)) | 0;
  const r = (n: number) => Math.abs((h >> n) % 7); // 0〜6
  const arrived = a.arrivedAt ?? a.start - 2 - r(1);
  const started = a.startedAt ?? Math.max(arrived + 1, a.start + r(4) - 2);
  const done = completedAt.get(a.id) ?? Math.max(started + 10, a.end - 3 + r(7));
  return { arrived, started, done };
}

/**
 * 患者検索。数字だけの入力は、診察券番号（3桁から）と電話番号（4桁から）に当てる。
 * 「09」のような短い数字で、携帯番号の全員が当たってしまわないように。
 */
export function searchHit(p: Patient, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (/^[\d\-\s()]+$/.test(q)) {
    const d = q.replace(/\D/g, "");
    return (d.length >= 3 && p.number.includes(d)) || (d.length >= 4 && p.phone.replace(/\D/g, "").includes(d));
  }
  return matchesPatient(p, q);
}
