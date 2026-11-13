import { useId, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "./cn";
import { easeOut } from "./motion";

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[i + 1];
    const [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }
  return d;
}

/** 小さな折れ線（なめらか）。色は currentColor */
export function Sparkline({ data, width = 120, height = 36, area = true, className, strokeWidth = 2, dot = true }: {
  data: number[]; width?: number; height?: number; area?: boolean; className?: string; strokeWidth?: number; dot?: boolean;
}) {
  const id = useId();
  const { line, fill, last } = useMemo(() => {
    const min = Math.min(...data), max = Math.max(...data);
    const span = max - min || 1;
    const pad = strokeWidth + 2;
    const pts = data.map((v, i) => [
      pad + (i / Math.max(1, data.length - 1)) * (width - pad * 2),
      pad + (1 - (v - min) / span) * (height - pad * 2),
    ] as [number, number]);
    const line = smoothPath(pts);
    return { line, fill: `${line} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`, last: pts[pts.length - 1] };
  }, [data, width, height, strokeWidth]);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <motion.path d={fill} fill={`url(#${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.25 }} />}
      <motion.path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: easeOut }}
      />
      {dot && <circle cx={last[0]} cy={last[1]} r={strokeWidth + 1.2} fill="currentColor" />}
    </svg>
  );
}

/** 縦棒グラフ。highlight の棒だけ濃く、ほかは薄く */
export function Bars({ data, labels, height = 120, highlight, className, format }: {
  data: number[]; labels?: string[]; height?: number; highlight?: number; className?: string; format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data);
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-[6px]" style={{ height }}>
        {data.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 flex-col justify-end">
            <motion.div
              className={cn("w-full rounded-[5px]", i === highlight ? "bg-accent" : "bg-sand/55 group-hover:bg-sand/80")}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(2, (v / max) * 100)}%` }}
              transition={{ type: "spring", stiffness: 260, damping: 30, delay: i * 0.025 }}
            />
            <div className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold text-onink opacity-0 transition-opacity group-hover:opacity-100 tnum">
              {format ? format(v) : v}
            </div>
          </div>
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex gap-[6px]">
          {labels.map((l, i) => (
            <div key={i} className={cn("flex-1 truncate text-center text-[10px] tnum", i === highlight ? "font-semibold text-label" : "text-label3")}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 進み具合のリング（Appleのアクティビティ風） */
export function Ring({ value, size = 56, stroke = 6, className, children, trackClassName = "text-fill/16", barClassName = "text-accent" }: {
  value: number; size?: number; stroke?: number; className?: string; children?: React.ReactNode; trackClassName?: string; barClassName?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className={trackClassName} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          className={barClassName}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
          transition={{ duration: 1, ease: easeOut }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}
