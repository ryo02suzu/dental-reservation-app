// 運営コンソールのグラフ。色はトークンだけ（SVGは currentColor と rgb(var(--…))）。
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { md, yen } from "@/lib/format";
import { cn, springSoft } from "@/ui";
import { man } from "./model";
import { useElementWidth } from "./ui";

// ─── 目盛りと曲線 ─────────────────────────────────────────────────────────
/** 目盛りを3〜5本で、最大値にいちばん近い切りのよい上端を選ぶ（値が増えても目盛りが急に粗くならない） */
function niceScale(max: number, count = 4) {
  const m = Math.max(1, max);
  const mag = 10 ** Math.floor(Math.log10(m / count));
  let best: { step: number; top: number } | null = null;
  for (const k of [1, 2, 2.5, 5, 10, 20]) {
    const step = k * mag;
    const n = Math.ceil(m / step);
    if (n < 3 || n > 5) continue;
    const top = n * step;
    if (!best || top < best.top || (top === best.top && step > best.step)) best = { step, top };
  }
  return best ?? { step: 10 * mag, top: Math.ceil(m / (10 * mag)) * 10 * mag };
}

/** 単調な3次補間（Fritsch–Carlson）。点の間で行き過ぎない、なめらかな線 */
function monotonePath(pts: [number, number][]) {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]));
  t.push(m[n - 2]);
  let d = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const h = dx[i] / 3;
    d += ` C${(x0 + h).toFixed(2)},${(y0 + t[i] * h).toFixed(2)} ${(x1 - h).toFixed(2)},${(y1 - t[i + 1] * h).toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

const monthLabel = (d: Date) => `${d.getMonth() + 1}月`;
const monthLong = (d: Date) => `${d.getFullYear()}年${d.getMonth() + 1}月`;

// ─── MRRの推移（面グラフ） ─────────────────────────────────────────────────
export function MrrChart({ data, height = 220, className }: { data: { month: Date; value: number }[]; height?: number; className?: string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(600);
  const gid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const gutter = 40; // 右側の目盛りの文字
  const padL = 14, padT = 30, padB = 26;
  const plotW = Math.max(40, width - padL - gutter);
  const plotH = height - padT - padB;
  const { step, top } = niceScale(Math.max(...data.map(d => d.value)) * 1.04);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const x = (i: number) => padL + (i / (n - 1)) * plotW;
  const y = (v: number) => padT + (1 - v / top) * plotH;
  const pts = data.map((d, i) => [x(i), y(d.value)] as [number, number]);
  const line = monotonePath(pts);
  const area = `${line} L${x(n - 1).toFixed(2)},${y(0).toFixed(2)} L${x(0).toFixed(2)},${y(0).toFixed(2)} Z`;
  const minGap = 34;
  const every = Math.max(1, Math.ceil(minGap / (plotW / (n - 1))));
  const last = n - 1;
  const showIdx = hover ?? null;

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    const i = Math.round(((px - padL) / plotW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setHover(h => Math.max(0, Math.min(n - 1, (h ?? last) + (e.key === "ArrowLeft" ? -1 : 1))));
    }
  };
  const tipX = showIdx === null ? 0 : Math.max(64, Math.min(width - 64, x(showIdx)));

  return (
    <div
      ref={ref}
      className={cn("relative select-none outline-none", className)}
      style={{ height }}
      tabIndex={0}
      role="img"
      aria-label={`MRRの推移。${monthLong(data[0].month)} ${yen(data[0].value)} から ${monthLong(data[last].month)} ${yen(data[last].value)}`}
      onKeyDown={onKey}
      onFocus={() => setHover(h => h ?? last)}
      onBlur={() => setHover(null)}
      onPointerLeave={() => setHover(null)}
    >
      <svg width={width} height={height} className="block overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.16" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* 目盛り線（細く、実線） */}
        {ticks.map(v => (
          <g key={v}>
            <line x1={0} x2={padL + plotW} y1={y(v)} y2={y(v)} stroke="rgb(var(--separator) / 0.16)" strokeWidth={1} />
            <text x={padL + plotW + 8} y={y(v)} dy="0.35em" className="fill-label3 text-[11px] tnum">{man(v)}</text>
          </g>
        ))}
        {/* 月 */}
        {data.map((d, i) =>
          (last - i) % every === 0 ? (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className={cn("text-[11px]", i === last ? "fill-label font-semibold" : "fill-label3")}>
              {monthLabel(d.month)}
            </text>
          ) : null,
        )}
        <motion.path initial={{ opacity: 0 }} animate={{ opacity: 1, d: area }} transition={springSoft} fill={`url(#${gid})`} />
        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1, d: line }}
          transition={{ pathLength: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }, d: springSoft }}
          fill="none"
          stroke="rgb(var(--accent))"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* なぞった月の縦線 */}
        {showIdx !== null && (
          <g>
            <line x1={x(showIdx)} x2={x(showIdx)} y1={padT - 6} y2={y(0)} stroke="rgb(var(--label) / 0.22)" strokeWidth={1} />
            {showIdx !== last && <circle cx={x(showIdx)} cy={y(data[showIdx].value)} r={4} fill="rgb(var(--accent))" stroke="rgb(var(--surface))" strokeWidth={2} />}
          </g>
        )}
        {/* 最新の月を強調 */}
        <motion.circle initial={false} animate={{ cx: x(last), cy: y(data[last].value) }} transition={springSoft} r={4.5} fill="rgb(var(--accent))" stroke="rgb(var(--surface))" strokeWidth={2} />
        {showIdx === null && (
          <motion.text
            initial={false}
            animate={{ x: x(last), y: y(data[last].value) - 12 }}
            transition={springSoft}
            textAnchor="end"
            className="fill-label text-[12px] font-semibold tnum"
          >
            {yen(data[last].value)}
          </motion.text>
        )}
      </svg>
      {/* ポインタの受け皿 */}
      <div
        className="absolute inset-0 cursor-crosshair"
        onPointerMove={e => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={e => onMove(e.clientX, e.currentTarget.getBoundingClientRect())}
      />
      <AnimatePresence>
        {showIdx !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, left: tipX }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ type: "spring", stiffness: 600, damping: 44 }}
            className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-elevated px-2.5 py-1.5 shadow-float"
            style={{ left: tipX }}
          >
            <div className="text-[15px] font-semibold leading-tight tnum">{yen(data[showIdx].value)}</div>
            <div className="text-[11px] leading-tight text-label2">{monthLong(data[showIdx].month)}{showIdx === last ? "（今月）" : ""}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 週ごとの予約数（縦棒） ─────────────────────────────────────────────────
export function WeekBars({ weeks, height = 88, className }: { weeks: { start: Date; count: number }[]; height?: number; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map(w => w.count));
  const last = weeks.length - 1;
  return (
    <div className={cn("relative", className)} onPointerLeave={() => setHover(null)}>
      <div className="relative flex items-end gap-[3px]" style={{ height }}>
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-bottom scale-y-50 bg-sep/30" />
        {weeks.map((w, i) => (
          <div
            key={i}
            className="relative flex h-full flex-1 cursor-default justify-center"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          >
            <motion.div
              className={cn("mt-auto w-full max-w-[18px] rounded-t-[4px]", i === last ? "bg-accent" : hover === i ? "bg-accent/60" : "bg-accent/30")}
              initial={false}
              animate={{ height: w.count ? Math.max(3, (w.count / max) * height) : 2 }}
              transition={springSoft}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-label3">
        <span>{md(weeks[0].start)}〜</span>
        <span className="font-medium text-label2">今週</span>
      </div>
      <AnimatePresence>
        {hover !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-[8px] bg-elevated px-2 py-1 text-[12px] shadow-float"
            style={{ left: `${((hover + 0.5) / weeks.length) * 100}%` }}
          >
            <span className="font-semibold tnum">{weeks[hover].count}件</span>
            <span className="ml-1.5 text-label2">{hover === last ? "今週" : `${md(weeks[hover].start)}の週`}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 一つの全体を分けた細い帯（凡例は呼び出し側の一覧） ───────────────────────────
export function SegmentBar<K extends string>({ parts, active, onHover, label }: {
  parts: { key: K; value: number; className: string; title: string }[];
  active?: K | null;
  onHover?: (k: K | null) => void;
  label: string;
}) {
  const total = parts.reduce((t, p) => t + p.value, 0) || 1;
  const visible = useMemo(() => parts.filter(p => p.value > 0), [parts]);
  return (
    <div role="img" aria-label={label} className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full" onPointerLeave={() => onHover?.(null)}>
      {visible.map(p => (
        <motion.div
          key={p.key}
          title={p.title}
          initial={false}
          animate={{ flexGrow: p.value / total, opacity: active && active !== p.key ? 0.35 : 1 }}
          transition={springSoft}
          className={cn("h-full min-w-[3px] basis-0", p.className)}
          onPointerEnter={() => onHover?.(p.key)}
        />
      ))}
    </div>
  );
}
