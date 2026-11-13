import { useMemo } from "react";
import { ME } from "@/data";
import type { Appointment } from "@/data";
import { TODAY_KEY, minutesOfDay, useNow } from "@/lib/clock";
import { useStore } from "@/lib/store";
import { isSessionBooking } from "./session";

/** 本人（とこの端末から入れたご家族）の、これからの予約。確定・仮予約だけ */
export function upcomingOf(appts: Appointment[], at: Date): Appointment[] {
  const m = minutesOfDay(at);
  return appts
    .filter(a => (a.patientId === ME.id || isSessionBooking(a.id)) && (a.status === "confirmed" || a.status === "pending"))
    .filter(a => a.date > TODAY_KEY || (a.date === TODAY_KEY && a.end > m))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
}

export function useUpcoming(): Appointment[] {
  const { appointments } = useStore();
  const at = useNow(30_000);
  return useMemo(() => upcomingOf(appointments, at), [appointments, at]);
}
