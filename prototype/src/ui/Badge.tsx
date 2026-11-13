import type { ComponentType, ReactNode } from "react";
import { Check } from "lucide-react";
import type { ApptStatus } from "@/data";
import { cn } from "./cn";
import type { LucideIcon } from "lucide-react";

type Tone = "neutral" | "sand" | "ink" | "red" | "redSolid" | "outline" | "accent";
const TONES: Record<Tone, string> = {
  neutral: "bg-fill/12 text-label2",
  sand: "bg-sand/30 text-label",
  ink: "bg-ink text-onink",
  red: "bg-red/10 text-red",
  redSolid: "bg-red text-white",
  outline: "text-label2 shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.35)]",
  accent: "bg-sand text-onsand",
};

/** 小さなラベル（初診・自費・アレルギーなど） */
export function Tag({ tone = "neutral", icon: Icon, children, className }: {
  tone?: Tone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 truncate rounded-[6px] px-1.5 py-[3px] text-[11px] font-semibold leading-none", TONES[tone], className)}>
      {Icon && <Icon className="h-3 w-3 shrink-0" strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/** 予約の状態。late は「予定時刻を過ぎたが来院していない」 */
export type StatusKey = ApptStatus | "late";

export const STATUS: Record<StatusKey, { label: string; cls: string }> = {
  pending: { label: "仮予約", cls: "text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.55)] [background:repeating-linear-gradient(-45deg,rgb(var(--sand)/0.14)_0_4px,transparent_4px_8px)]" },
  confirmed: { label: "予約", cls: "text-label2 shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.35)]" },
  late: { label: "未来院", cls: "text-red shadow-[inset_0_0_0_1px_rgb(var(--red)/0.45)]" },
  arrived: { label: "来院済", cls: "bg-sand/35 text-label" },
  in_progress: { label: "診療中", cls: "bg-sand text-onsand" },
  completed: { label: "完了", cls: "bg-fill/12 text-label2" },
  cancelled: { label: "キャンセル", cls: "bg-red/10 text-red" },
  no_show: { label: "無断キャンセル", cls: "bg-red text-white" },
};

export function StatusPill({ status, className, compact }: { status: StatusKey; className?: string; compact?: boolean }) {
  const m = STATUS[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold leading-none", compact ? "px-2 py-[4px] text-[11px]" : "px-2.5 py-[5px] text-[12px]", m.cls, className)}>
      {status === "in_progress" && (
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-onsand" />
      )}
      {status === "completed" && <Check className="h-3 w-3" strokeWidth={3} />}
      {status === "no_show" && compact ? "無断" : m.label}
    </span>
  );
}

/** 未読などの丸いバッジ */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1.5 text-[12px] font-semibold text-white tnum", className)}>{n}</span>;
}
