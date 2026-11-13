// 予約台帳の中だけで使う小さな部品
import { Fragment, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import type { TileTone } from "@/data";
import { cn, tap } from "@/ui";
import { loadLevel } from "./model";

/** 「予約 39件　空き 6枠　稼働率 86%」のように、数字だけ少し強く並べる */
export function StatLine({ lead, items, className }: {
  lead?: ReactNode;
  items: { label: string; value: ReactNode; unit?: string; tone?: "accent" | "red" }[];
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-3.5 gap-y-0.5 tnum", className)}>
      {lead}
      {items.map(it => (
        <span key={it.label} className={cn("whitespace-nowrap", it.tone === "red" ? "text-red" : it.tone === "accent" ? "text-accent" : undefined)}>
          {it.label}
          <span className={cn("ml-1 font-semibold", it.tone ? undefined : "text-label")}>{it.value}</span>
          {it.unit}
        </span>
      ))}
    </span>
  );
}

/** ‹ 今日 › をひとまとまりにした移動ボタン */
export function Pager({ onPrev, onNext, onToday, prevLabel, nextLabel, isCurrent, size = "md" }: {
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  prevLabel: string;
  nextLabel: string;
  isCurrent: boolean;
  size?: "md" | "lg";
}) {
  const h = size === "lg" ? "h-9" : "h-8";
  const w = size === "lg" ? "w-9" : "w-8";
  return (
    <div className={cn("inline-flex items-center rounded-full bg-fill/12", h)}>
      <motion.button whileTap={tap} onClick={onPrev} aria-label={prevLabel} title={`${prevLabel}（←）`} className={cn("flex items-center justify-center rounded-full text-label transition-colors hover:bg-fill/12", h, w)}>
        <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
      </motion.button>
      <motion.button
        whileTap={tap}
        onClick={onToday}
        title="今日を表示（T）"
        className={cn("rounded-full px-2 text-[13px] font-semibold transition-colors hover:bg-fill/12", h, isCurrent ? "text-label3" : "text-label")}
      >
        今日
      </motion.button>
      <motion.button whileTap={tap} onClick={onNext} aria-label={nextLabel} title={`${nextLabel}（→）`} className={cn("flex items-center justify-center rounded-full text-label transition-colors hover:bg-fill/12", h, w)}>
        <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.3} />
      </motion.button>
    </div>
  );
}

/** オン・オフで見た目が変わる小さな切り替え（「キャンセルを表示」など） */
export function ToggleChip({ on, onChange, children, count }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode; count?: number }) {
  return (
    <motion.button
      whileTap={tap}
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex h-[30px] items-center gap-1.5 rounded-[9px] px-2.5 text-[13px] font-medium transition-colors",
        on ? "bg-sand/25 text-accent" : "bg-fill/12 text-label2 hover:text-label",
      )}
    >
      <span className={cn("flex h-[15px] w-[15px] items-center justify-center rounded-[4px] transition-colors", on ? "bg-accent text-onink" : "shadow-[inset_0_0_0_1.5px_rgb(var(--label-3))]")}>
        {on && <Check className="h-[11px] w-[11px]" strokeWidth={3.2} />}
      </span>
      {children}
      {count !== undefined && <span className={cn("tnum", on ? "text-accent/72" : "text-label3")}>{count}</span>}
    </motion.button>
  );
}

/** 混み具合の3つの点（●●○） */
export function LoadDots({ util, className, onDark }: { util: number; className?: string; onDark?: boolean }) {
  const n = loadLevel(util);
  return (
    <span className={cn("flex items-center gap-[3px]", className)} aria-hidden>
      {[1, 2, 3].map(i => (
        <span key={i} className={cn("h-[4px] w-[4px] rounded-full", i <= n ? (onDark ? "bg-onink/80" : "bg-label2") : onDark ? "bg-onink/28" : "bg-label4")} />
      ))}
    </span>
  );
}

/** 稼働率の細い棒 */
export function OccBar({ util, className, muted }: { util: number; className?: string; muted?: boolean }) {
  return (
    <span className={cn("relative block h-[3px] overflow-hidden rounded-full bg-fill/14", className)} aria-hidden>
      <motion.span
        className={cn("absolute inset-y-0 left-0 rounded-full", muted ? "bg-label3" : "bg-accent/80")}
        initial={false}
        animate={{ width: `${Math.round(util * 100)}%` }}
        transition={{ type: "spring", stiffness: 260, damping: 32 }}
      />
    </span>
  );
}

const CHIP: Record<TileTone, string> = {
  sand: "bg-tile-sand/18", graphite: "bg-tile-graphite/16", slate: "bg-tile-slate/18", sage: "bg-tile-sage/20",
  clay: "bg-tile-clay/18", plum: "bg-tile-plum/18", ocean: "bg-tile-ocean/18", amber: "bg-tile-amber/20",
};
const CHIP_BAR: Record<TileTone, string> = {
  sand: "bg-tile-sand", graphite: "bg-tile-graphite", slate: "bg-tile-slate", sage: "bg-tile-sage",
  clay: "bg-tile-clay", plum: "bg-tile-plum", ocean: "bg-tile-ocean", amber: "bg-tile-amber",
};

/** ユニットの小さな札（U1〜U4）。左の細い線は担当者の色 */
export function UnitChip({ label, tone, dashed, className }: { label: string; tone?: TileTone; dashed?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-[30px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] text-[12px] font-semibold tnum",
        dashed ? "border border-dashed border-label3/70 text-label2" : cn("text-label", tone ? CHIP[tone] : "bg-fill/12"),
        className,
      )}
    >
      {!dashed && tone && <span className={cn("absolute inset-y-0 left-0 w-[3px]", CHIP_BAR[tone])} />}
      {label}
    </span>
  );
}

/** 文字の並びを「・」でつなぐ（空の要素は飛ばす） */
export function Dotted({ parts, className }: { parts: ReactNode[]; className?: string }) {
  const xs = parts.filter(p => p !== null && p !== undefined && p !== false && p !== "");
  return (
    <span className={className}>
      {xs.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="px-[3px] opacity-60">·</span>}
          {p}
        </Fragment>
      ))}
    </span>
  );
}

/** 要素の幅（ResizeObserver で追従）。台帳の列やレーンの幅から、中身の詰め方を決める */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}
