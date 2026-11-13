// 設定画面の中だけで持つ値（保存はしない）。スマホでページを行き来しても消えないよう、モジュールに置く。
import { useSyncExternalStore } from "react";
import { addDays, addMonths } from "date-fns";
import { HOURS, addons, clinic, consoleClinics, services, staff, units, type Service } from "@/data";
import { TODAY } from "@/lib/clock";
import { key } from "@/lib/format";
import { closedOn } from "./dates";

export type DayHours = { open: boolean; am: [number, number]; pm: [number, number] };
export type MenuItem = Service & { web: boolean };
export type Perm = "管理者" | "スタッフ";

export interface SettingsState {
  info: { name: string; address: string; access: string; phone: string; director: string; parking: string };
  hours: Record<number, DayHours>;
  holidays: { national: boolean; newYear: boolean; extra: { id: string; date: string; note: string }[] };
  menu: MenuItem[];
  web: { enabled: boolean; daysAhead: number; sameDay: boolean; cutoffHours: number; firstVisit: boolean; confirm: "auto" | "manual"; cancelHours: number };
  reminders: { dayBefore: boolean; sameDay: boolean; line: boolean; sms: boolean; mail: boolean };
  units: { id: string; name: string; short: string }[];
  staff: { id: string; perm: Perm; bookable: boolean; email: string }[];
  invited: { email: string; role: string }[];
  line: { linked: boolean; booking: boolean; remind: boolean; recall: boolean };
  plan: { key: "standard" | "pro" | "enterprise"; addons: Record<string, boolean> };
  account: { twoFactor: boolean; notifyWeb: boolean; notifyCancel: boolean };
}

const EMAIL: Record<string, string> = { s1: "saeki", s2: "takagi", s3: "mori", s4: "kawaguchi", s5: "ono", s6: "ishii" };
const mine = consoleClinics.find(c => c.id === "c1")!;

/** 来月の第2土曜（院内研修で午後休診にする日） */
const training = (() => {
  const first = addMonths(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), 1);
  let d = first;
  let sat = 0;
  for (;;) {
    if (d.getDay() === 6 && ++sat === 2) break;
    d = addDays(d, 1);
  }
  while (closedOn(d)) d = addDays(d, 7);
  return key(d);
})();

let state: SettingsState = {
  info: { name: clinic.name, address: clinic.address, access: clinic.access, phone: clinic.phone, director: clinic.director, parking: clinic.parking },
  hours: Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map(d => {
      const h = HOURS[d];
      return [d, h ? { open: true, am: [...h.am], pm: [...h.pm] } : { open: false, am: [540, 780], pm: [870, 1140] }];
    }),
  ) as Record<number, DayHours>,
  holidays: { national: true, newYear: true, extra: [{ id: "x1", date: training, note: "院内研修のため" }] },
  menu: services.map(s => ({ ...s, web: s.id !== "sv04" && s.id !== "sv06" })),
  web: { enabled: true, daysAhead: 60, sameDay: true, cutoffHours: 2, firstVisit: true, confirm: "manual", cancelHours: 24 },
  reminders: { dayBefore: true, sameDay: true, line: true, sms: true, mail: true },
  units: units.map(u => ({ ...u })),
  staff: staff.map(s => ({ id: s.id, perm: s.role === "院長" || s.role === "受付" ? "管理者" : "スタッフ", bookable: s.role !== "受付" && s.role !== "歯科助手", email: `${EMAIL[s.id]}@hidamari-dental.jp` })),
  invited: [],
  line: { linked: true, booking: true, remind: true, recall: true },
  plan: { key: "pro", addons: Object.fromEntries(addons.map(a => [a.key, mine.addons.includes(a.key)])) },
  account: { twoFactor: true, notifyWeb: true, notifyCancel: true },
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function setSettings(fn: (s: SettingsState) => SettingsState) {
  state = fn(state);
  listeners.forEach(l => l());
}

export function useSettings(): SettingsState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

/** ひとつの項目だけを書き換える */
export function patch<K extends keyof SettingsState>(k: K, v: Partial<SettingsState[K]>) {
  setSettings(s => ({ ...s, [k]: { ...(s[k] as object), ...(v as object) } }));
}
