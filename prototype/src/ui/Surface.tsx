import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "./cn";
import { tapSoft } from "./motion";
import type { LucideIcon } from "lucide-react";

/** 白い面（カード）。押せる場合は onClick を渡すと押下の手応えが付く */
export function Surface({ children, className, onClick, padded = true }: { children: ReactNode; className?: string; onClick?: () => void; padded?: boolean }) {
  const cls = cn("rounded-card bg-surface", padded && "p-4 md:p-5", onClick && "cursor-pointer text-left", className);
  if (onClick) {
    return (
      <motion.button whileTap={tapSoft} transition={{ type: "spring", stiffness: 600, damping: 32 }} onClick={onClick} className={cn("block w-full", cls)}>
        {children}
      </motion.button>
    );
  }
  return <div className={cls}>{children}</div>;
}

/** 数字の指標。delta は前期比（正で上向き矢印）。good は「上がると良い」かどうか */
export function Stat({ label, value, unit, delta, deltaLabel, compareLabel = "前月比", good = true, icon: Icon, children, className }: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  /** 比べている期間（「前月比」「先週比」「前の30日比」など） */
  compareLabel?: string;
  good?: boolean;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const positive = up === good;
  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center gap-1.5 text-[13px] font-medium text-label2">
        {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] tnum">{value}</span>
        {unit && <span className="text-[14px] font-medium text-label2">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className={cn("mt-1.5 inline-flex items-center gap-0.5 text-[12px] font-semibold tnum", positive ? "text-accent" : "text-red")}>
          {up ? <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.6} /> : <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.6} />}
          {deltaLabel ?? `${Math.abs(delta * 100).toFixed(1)}%`}
          <span className="ml-1 font-medium text-label3">{compareLabel}</span>
        </div>
      )}
      {children}
    </div>
  );
}

/** 何もないときの表示 */
export function EmptyState({ icon: Icon, title, message, action, className }: {
  icon?: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {Icon && (
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-fill/12 text-label3">
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
      )}
      <div className="text-[17px] font-semibold">{title}</div>
      {message && <p className="mt-1 max-w-[30ch] text-[14px] text-label2">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
