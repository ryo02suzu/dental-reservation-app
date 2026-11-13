import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { TODAY, TODAY_KEY, minutesOfDay, useNow } from "@/lib/clock";
import { hoursFor, staffById, units, type Appointment, type Notice, type Staff, type Unit } from "@/data";
import { LATE_GRACE, alertsOf, expand, isActive, useDay, type Expanded } from "../../helpers";
import { useMemory, type Memory } from "./memory";

/** 今日の予約1件と、画面で使う派生値 */
export interface Row extends Expanded {
  /** 予約時刻（＋猶予）を過ぎても来院していない */
  late: boolean;
  /** 予約時刻を何分過ぎたか（未来院のとき） */
  overdue: number;
}

export interface UnitState {
  unit: Unit;
  /** このユニットの担当（診療中・次の予約・その日の予約から） */
  staff: Staff;
  current?: Row;
  next?: Row;
  /** 少し前にこの画面で完了にした予約（次回予約の案内を出す） */
  done?: Row;
  /** done の患者さんの、次回以降の予約 */
  doneNext?: Appointment;
}

export type Attention =
  | { kind: "late"; key: string; row: Row }
  | { kind: "alert"; key: string; row: Row; labels: string[]; prep?: string }
  | { kind: "pending"; key: string; row: Row; requested?: Date }
  | { kind: "first"; key: string; row: Row; step: "form" | "insurance" };

export interface Today {
  now: Date;
  nowMin: number;
  hours: ReturnType<typeof hoursFor>;
  rows: Row[];
  attention: Attention[];
  waiting: Row[];
  units: UnitState[];
  upcoming: Row[];
  finished: Row[];
  counts: { total: number; waiting: number; treating: number; done: number; late: number };
}

/** 完了したあと、ユニットに「次回の予約を取る」を出しておく時間 */
export const DONE_WINDOW = 10 * 60_000;
/** 注意事項を「対応が必要」に出すのは、予約の何分前から */
export const ALERT_WINDOW = 120;
/** 「受付する」をすぐ押せるようにするのは、予約の何分前から */
export const CHECKIN_WINDOW = 30;

const FINISHED = new Set(["completed", "no_show", "cancelled"]);
export const isFinished = (a: Appointment) => FINISHED.has(a.status);

/** 問診票（Web問診）の回答状況。予約IDから決める（毎回同じ結果になるように） */
export function formAnswered(id: string) {
  let s = 0;
  for (const c of id) s += c.charCodeAt(0);
  return s % 2 === 0;
}

/** 注意事項ごとの、受付・ユニットで準備すること（surgical は外科処置のときだけ） */
const PREP: { re: RegExp; text: string; surgical?: boolean }[] = [
  { re: /ラテックス/, text: "ラテックスフリーのグローブを準備" },
  { re: /抗凝固/, text: "出血に注意。服薬状況を確認" },
  { re: /BP製剤/, text: "外科処置は歯科医師に確認（顎骨壊死のリスク）", surgical: true },
  { re: /ペースメーカー/, text: "電気メス・超音波機器の使用に注意" },
  { re: /妊娠/, text: "レントゲン・投薬は歯科医師に確認" },
  { re: /ペニシリン/, text: "抗菌薬の処方に注意" },
  { re: /リドカイン|局所麻酔/, text: "麻酔薬の種類を歯科医師に確認" },
  { re: /アスピリン/, text: "鎮痛薬の処方に注意" },
  { re: /金属|ニッケル/, text: "金属を使う治療は歯科医師に確認" },
];
export function prepFor(labels: string[], surgical: boolean): string | undefined {
  for (const p of PREP) if ((!p.surgical || surgical) && labels.some(l => p.re.test(l))) return p.text;
  return undefined;
}

/** その日の予約から、ユニットの担当者（いちばん多い人） */
function staffOfUnit(unitId: string, rows: Row[]): Staff {
  const n = new Map<string, number>();
  for (const r of rows) if (r.a.unitId === unitId) n.set(r.a.staffId, (n.get(r.a.staffId) ?? 0) + 1);
  const top = [...n.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  return staffById(top ?? (unitId === "u1" ? "s1" : unitId === "u2" ? "s2" : unitId === "u3" ? "s3" : "s4"));
}

function derive(day: Appointment[], now: Date, all: Appointment[], notices: Notice[], mem: Memory): Today {
  const nowMin = minutesOfDay(now);
  const rows: Row[] = day.map(a => {
    const late = (a.status === "confirmed" || a.status === "pending") && nowMin >= a.start + LATE_GRACE;
    return { ...expand(a), late, overdue: late ? nowMin - a.start : 0 };
  });

  const waiting = rows
    .filter(r => r.a.status === "arrived")
    .sort((x, y) => (x.a.arrivedAt ?? x.a.start) - (y.a.arrivedAt ?? y.a.start) || x.a.start - y.a.start);
  const treating = rows.filter(r => r.a.status === "in_progress");
  const upcoming = rows.filter(r => r.a.status === "confirmed" || r.a.status === "pending");
  const finished = rows.filter(r => isFinished(r.a));

  // ─── ユニット ───
  const unitStates: UnitState[] = units.map(unit => {
    const mine = rows.filter(r => r.a.unitId === unit.id);
    const current = mine
      .filter(r => r.a.status === "in_progress")
      .sort((x, y) => (y.a.startedAt ?? y.a.start) - (x.a.startedAt ?? x.a.start))[0];
    const next = mine.find(r => r !== current && (r.a.status === "arrived" || ((r.a.status === "confirmed" || r.a.status === "pending") && !r.late)));
    const d = mem.done[unit.id];
    const done = !current && d && now.getTime() - d.at < DONE_WINDOW ? mine.find(r => r.a.id === d.apptId && r.a.status === "completed") : undefined;
    const doneNext = done
      ? all
          .filter(x => x.patientId === done.a.patientId && x.id !== done.a.id && (x.status === "confirmed" || x.status === "pending") && (x.date > TODAY_KEY || (x.date === TODAY_KEY && x.start >= done.a.end)))
          .sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start)[0]
      : undefined;
    return { unit, staff: (current ?? next)?.staff ?? staffOfUnit(unit.id, rows), current, next, done, doneNext };
  });

  // ─── 対応が必要 ───
  const attention: Attention[] = [];
  for (const r of rows) if (r.late) attention.push({ kind: "late", key: `late-${r.a.id}`, row: r });
  for (const r of rows) {
    const s = r.a.status;
    if (r.late || !(s === "confirmed" || s === "pending" || s === "arrived") || mem.handedOff[r.a.id]) continue;
    const labels = alertsOf(r.patient).filter(x => x.tone === "red").map(x => x.label);
    if (!labels.length) continue;
    const surgical = r.service.category === "外科";
    if (r.a.start - nowMin > ALERT_WINDOW && !surgical) continue;
    attention.push({ kind: "alert", key: `alert-${r.a.id}`, row: r, labels, prep: surgical && r.a.note ? r.a.note : prepFor(labels, surgical) });
  }
  for (const r of rows) {
    if (r.a.status !== "pending" || r.late) continue;
    attention.push({ kind: "pending", key: `pending-${r.a.id}`, row: r, requested: notices.find(n => n.apptId === r.a.id && n.kind === "web")?.at });
  }
  for (const r of rows) {
    if (!r.a.firstVisit || r.late) continue;
    if (r.a.status === "confirmed" && !formAnswered(r.a.id) && !mem.formSent[r.a.id]) attention.push({ kind: "first", key: `first-${r.a.id}`, row: r, step: "form" });
    else if (r.a.status === "arrived" && !mem.insurance[r.a.id]) attention.push({ kind: "first", key: `first-${r.a.id}`, row: r, step: "insurance" });
  }

  return {
    now,
    nowMin,
    hours: hoursFor(TODAY),
    rows,
    attention,
    waiting,
    units: unitStates,
    upcoming,
    finished,
    counts: {
      total: rows.filter(r => isActive(r.a)).length,
      waiting: waiting.length,
      treating: treating.length,
      done: rows.filter(r => r.a.status === "completed").length,
      late: rows.filter(r => r.late).length,
    },
  };
}

export function useToday(): Today {
  const now = useNow(15_000);
  const day = useDay(TODAY_KEY);
  const { appointments, notices, patients } = useStore();
  const mem = useMemory();
  return useMemo(() => derive(day, now, appointments, notices, mem), [day, now, appointments, notices, mem, patients]);
}

/** 診療の進み具合（開始が遅れたときは、実際に始めた時刻から予定の長さで数える） */
export function progressOf(r: Row, nowMin: number) {
  const planned = Math.max(1, r.a.end - r.a.start);
  const began = r.a.startedAt ?? r.a.start;
  const elapsed = Math.max(0, nowMin - began);
  return { planned, elapsed, left: planned - elapsed, ratio: Math.min(1, elapsed / planned) };
}

/** 経過時間の言い方 "12分" / "1時間5分" */
export const mins = (m: number) => (m < 60 ? `${m}分` : `${Math.floor(m / 60)}時間${m % 60 ? `${m % 60}分` : ""}`);

/** キャンセル歴の短い言い方 "キャンセル2回・無断1回" */
export function riskText(c: number, n: number) {
  return [c ? `キャンセル${c}回` : "", n ? `無断${n}回` : ""].filter(Boolean).join("・");
}
