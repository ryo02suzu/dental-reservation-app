import { motion } from "framer-motion";
import { Globe, MessageCircle, Phone, Footprints } from "lucide-react";
import { hm } from "@/lib/format";
import { useNow } from "@/lib/clock";
import { Avatar, StatusPill, Tag, cn, tapSoft } from "@/ui";
import { alertsOf, expand, riskOf, statusOf } from "./helpers";
import type { Appointment } from "@/data";

const SOURCE_ICON = { web: Globe, line: MessageCircle, phone: Phone, walkin: Footprints } as const;
const SOURCE_LABEL = { web: "Web予約", line: "LINE", phone: "電話", walkin: "飛び込み" } as const;

/**
 * 予約1件の行。今日の画面・患者詳細・お知らせなど、予約を一覧で見せる場所で共通に使う。
 * 時刻 | アバター＋氏名＋メニュー・担当 | 状態 の3列。
 */
export function ApptRow({ appt, onClick, showDate, dense, className }: {
  appt: Appointment;
  onClick?: () => void;
  showDate?: string;
  dense?: boolean;
  className?: string;
}) {
  const now = useNow();
  const { patient, service, staff, unit } = expand(appt);
  const status = statusOf(appt, now);
  const muted = status === "completed" || status === "cancelled" || status === "no_show";
  const alerts = alertsOf(patient);
  const Src = SOURCE_ICON[appt.source];
  return (
    <motion.button
      whileTap={onClick ? tapSoft : undefined}
      transition={{ type: "spring", stiffness: 600, damping: 34 }}
      onClick={onClick}
      className={cn(
        "group relative grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 text-left transition-colors hover:bg-fill/[0.05] active:bg-fill/12",
        dense ? "py-2" : "py-3",
        className,
      )}
    >
      <div className={cn("leading-tight tnum", muted && "opacity-55")}>
        {showDate && <div className="text-[11px] font-medium text-label2">{showDate}</div>}
        <div className="text-[16px] font-semibold">{hm(appt.start)}</div>
        <div className="text-[12px] text-label3">{hm(appt.end)}</div>
      </div>
      <div className={cn("flex min-w-0 items-center gap-3", muted && "opacity-55")}>
        {!dense && <Avatar name={patient.name} size={38} />}
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn("truncate text-[16px] font-medium", status === "cancelled" && "line-through decoration-red/50")}>{patient.name}</span>
            {appt.firstVisit && <Tag tone="accent">初診</Tag>}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-label2">
            <span className="truncate">{service.name}</span>
            <span className="text-label4">·</span>
            <span className="shrink-0">{staff.short}</span>
            <span className="text-label4">·</span>
            <span className="shrink-0 tnum">{unit.short}</span>
            <Src className="ml-0.5 h-3.5 w-3.5 shrink-0 text-label3" strokeWidth={2} aria-label={SOURCE_LABEL[appt.source]} />
          </div>
          {!muted && (alerts.length > 0 || riskOf(patient) >= 3) && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {alerts.slice(0, 2).map(x => <Tag key={x.label} tone={x.tone === "red" ? "red" : "neutral"}>{x.label}</Tag>)}
              {riskOf(patient) >= 3 && <Tag tone="red">キャンセル歴 {riskOf(patient)}回</Tag>}
            </div>
          )}
        </div>
      </div>
      <StatusPill status={status} compact />
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-[4.75rem] right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </motion.button>
  );
}
