// 受付端末の照合ロジック（診察券番号・電話番号・QR）。表示とは切り離しておく。
import { TODAY, TODAY_KEY } from "@/lib/clock";
import type { Appointment, Patient } from "@/data";

const WAITING = new Set<Appointment["status"]>(["confirmed", "pending"]);
const CHECKED = new Set<Appointment["status"]>(["arrived", "in_progress", "completed"]);

/** 照合の結果 */
export type Match =
  | { kind: "ok"; appt: Appointment }
  | { kind: "already"; appt: Appointment }
  | { kind: "noAppt"; patient: Patient }
  | { kind: "unknown" };

const todayOf = (appts: Appointment[], patientId: string) =>
  appts.filter(a => a.date === TODAY_KEY && a.patientId === patientId).sort((x, y) => x.start - y.start);

/** 患者1人について、今日受付できる予約を探す（いちばん「いま」に近い、まだ受付していない予約） */
export function matchPatient(appts: Appointment[], patient: Patient, nowMin: number): Match {
  const list = todayOf(appts, patient.id);
  const waiting = list.filter(a => WAITING.has(a.status));
  if (waiting.length) {
    // 終わりの時刻をまだ過ぎていないものを優先。なければ最後の予約
    const appt = waiting.find(a => a.end > nowMin) ?? waiting[waiting.length - 1];
    return { kind: "ok", appt };
  }
  const done = list.filter(a => CHECKED.has(a.status));
  if (done.length) return { kind: "already", appt: done[done.length - 1] };
  return { kind: "noAppt", patient };
}

/** 診察券番号（6けた）で照合 */
export function matchByNumber(appts: Appointment[], patients: Patient[], number: string, nowMin: number): Match {
  const p = patients.find(x => x.number === number);
  if (!p) return { kind: "unknown" };
  return matchPatient(appts, p, nowMin);
}

/** 電話番号の下4けたで照合。今日予約のある人を優先し、複数なら候補を返す */
export function matchByPhone(appts: Appointment[], patients: Patient[], last4: string, nowMin: number): { candidates: { patient: Patient; match: Match }[] } {
  const hits = patients.filter(p => p.phone.replace(/\D/g, "").endsWith(last4));
  const withAppt = hits
    .map(patient => ({ patient, match: matchPatient(appts, patient, nowMin) }))
    .filter(x => x.match.kind !== "noAppt");
  return { candidates: withAppt };
}

/** QRの読み取り（デモ）：これから60分以内に始まる、まだ受付していない予約のうち最も早いもの */
export function nextForQr(appts: Appointment[], nowMin: number): Appointment | undefined {
  return appts
    .filter(a => a.date === TODAY_KEY && a.status === "confirmed" && a.start >= nowMin - 5 && a.start <= nowMin + 60)
    .sort((x, y) => x.start - y.start)[0];
}

/** デモ用：番号入力で試せる診察券番号（いちばん近い、受付前の予約の患者） */
export function demoNumber(appts: Appointment[], patients: Patient[], nowMin: number): string | undefined {
  const a = appts
    .filter(x => x.date === TODAY_KEY && WAITING.has(x.status) && x.end > nowMin)
    .sort((x, y) => Math.abs(x.start - nowMin) - Math.abs(y.start - nowMin))[0];
  return a ? patients.find(p => p.id === a.patientId)?.number : undefined;
}

/** 受付番号：今日すでに受付した人数＋1 */
export function nextReceipt(appts: Appointment[]): number {
  return appts.filter(a => a.date === TODAY_KEY && CHECKED.has(a.status)).length + 1;
}

/** 今月はじめての来院か（保険証の確認が必要） */
export function firstOfMonth(appts: Appointment[], patient: Patient, appt: Appointment): boolean {
  if (appt.firstVisit) return true;
  const month = TODAY_KEY.slice(0, 7);
  const visitedInStore = appts.some(a => a.patientId === patient.id && a.status === "completed" && a.date.startsWith(month) && a.date < TODAY_KEY);
  const lv = patient.lastVisit;
  const visitedBefore = !!lv && lv.getFullYear() === TODAY.getFullYear() && lv.getMonth() === TODAY.getMonth() && lv < TODAY;
  return !(visitedInStore || visitedBefore);
}
