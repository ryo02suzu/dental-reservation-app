import { useEffect, useMemo } from "react";
import { differenceInCalendarDays, subMonths } from "date-fns";
import { TODAY, TODAY_KEY } from "@/lib/clock";
import { md } from "@/lib/format";
import { useStore } from "@/lib/store";
import { patientById, type Appointment, type Patient, type RecallItem } from "@/data";
import { isActive } from "@/apps/clinic/helpers";
import "./roster";

export type RecallStatus = RecallItem["status"];
export const STATUSES: RecallStatus[] = ["未連絡", "送信済み", "予約済み", "保留"];
const CHECKUP = new Set(["sv01", "sv02", "sv09"]);

export interface RecallRow {
  r: RecallItem;
  p: Patient;
  /** 期限までの日数（負なら超過） */
  days: number;
  /** 前回の定期検診（期限からリコール間隔を引いた日） */
  lastCheckup: Date;
  booked?: Appointment;
}

/** ストアのリコール・予約から、画面に出す行を作る（期限の早い順） */
export function useRecallRows(): RecallRow[] {
  const { recalls, appointments, setRecall } = useStore();
  const rows = useMemo(() => {
    const byPatient = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const l = byPatient.get(a.patientId);
      if (l) l.push(a);
      else byPatient.set(a.patientId, [a]);
    }
    return recalls
      .map((r): RecallRow => {
        const p = patientById(r.patientId);
        const mine = byPatient.get(r.patientId) ?? [];
        let booked: Appointment | undefined;
        for (const a of mine) {
          if (isActive(a) && a.status !== "completed" && a.date >= TODAY_KEY && (!booked || a.date < booked.date || (a.date === booked.date && a.start < booked.start))) {
            if (CHECKUP.has(a.serviceId) || a.id.startsWith("new-")) booked = a;
          }
        }
        return { r, p, days: differenceInCalendarDays(r.due, TODAY), lastCheckup: subMonths(r.due, p.recallMonths), booked };
      })
      .sort((a, b) => a.r.due.getTime() - b.r.due.getTime());
  }, [recalls, appointments]);

  // 新規予約シートで定期検診の予約を入れたら、リコールも「予約済み」にそろえる
  useEffect(() => {
    for (const x of rows) if (x.booked && x.r.status !== "予約済み" && x.booked.id.startsWith("new-")) setRecall(x.p.id, "予約済み");
  }, [rows, setRecall]);

  return rows;
}

/** 期限の表示：「11月10日・3日超過」「今日まで」「11月25日・あと12日」 */
export function dueLabel(x: RecallRow): { text: string; overdue: boolean } {
  if (x.days < 0) return { text: `${md(x.r.due)}・${-x.days}日超過`, overdue: true };
  if (x.days === 0) return { text: `${md(x.r.due)}・今日まで`, overdue: false };
  return { text: `${md(x.r.due)}・あと${x.days}日`, overdue: false };
}

/** メッセージのひな形。{氏名} {間隔} は送るときに患者さんごとに置き換える */
export const TEMPLATE =
  "【ひだまり歯科クリニック】{氏名}さま 前回の定期検診から{間隔}が経ちました。お口の健康を保つため、定期検診のご予約をおすすめします。ご予約はWeb予約から24時間受け付けています。";

export const fillTemplate = (t: string, p: Patient) => t.replace(/\{氏名\}/g, p.name).replace(/\{間隔\}/g, `${p.recallMonths}か月`);
