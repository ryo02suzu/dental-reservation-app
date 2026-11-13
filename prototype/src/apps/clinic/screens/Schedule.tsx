import { useClinicUI } from "../context";
import { DesktopSchedule } from "./schedule/DesktopSchedule";
import { PhoneSchedule } from "./schedule/PhoneSchedule";

/**
 * 予約台帳。param は表示する日付（yyyy-MM-dd、省略で今日）。
 * PC・iPad はユニット（担当者）ごとの時間軸、スマホは週の帯＋1列の予定表。
 */
export default function ScheduleScreen({ param }: { param?: string }) {
  const ui = useClinicUI();
  return ui.phone ? <PhoneSchedule param={param} /> : <DesktopSchedule param={param} />;
}
