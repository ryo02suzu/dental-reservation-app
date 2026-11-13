import { useMemo } from "react";
import { format } from "date-fns";
import { minutesOfDay } from "@/lib/clock";
import { useStore } from "@/lib/store";
import { patientById, serviceById, staffById, unitById, type Appointment, type Patient } from "@/data";
import type { StatusKey } from "@/ui";

export const LATE_GRACE = 5; // 予約開始からこの分数を過ぎても来院記録がなければ「未来院」

/** 表示上の状態。今日の予約で、開始を過ぎても来院していないものは late */
export function statusOf(a: Appointment, now: Date): StatusKey {
  if ((a.status === "confirmed" || a.status === "pending") && a.date === format(now, "yyyy-MM-dd") && minutesOfDay(now) >= a.start + LATE_GRACE && minutesOfDay(now) < a.end + 30) return "late";
  return a.status;
}

export const isActive = (a: Appointment) => a.status !== "cancelled" && a.status !== "no_show";

/** 予約に関係するものをまとめて引く */
export function expand(a: Appointment) {
  return { a, patient: patientById(a.patientId), service: serviceById(a.serviceId), staff: staffById(a.staffId), unit: unitById(a.unitId) };
}
export type Expanded = ReturnType<typeof expand>;

/** その日の予約（開始順） */
export function useDay(dateKey: string) {
  const { appointments } = useStore();
  return useMemo(() => appointments.filter(a => a.date === dateKey).sort((x, y) => x.start - y.start || x.unitId.localeCompare(y.unitId)), [appointments, dateKey]);
}

/** 患者の注意事項（アレルギー・服薬・既往など、治療前に見るべきもの） */
export function alertsOf(p: Patient): { label: string; tone: "red" | "neutral" }[] {
  const out: { label: string; tone: "red" | "neutral" }[] = [];
  for (const x of p.allergies) out.push({ label: `アレルギー：${x}`, tone: "red" });
  for (const c of p.conditions) out.push({ label: c, tone: /抗凝固|BP製剤|妊娠|ペースメーカー/.test(c) ? "red" : "neutral" });
  return out;
}

export const riskOf = (p: Patient) => p.cancellations + p.noShows;
