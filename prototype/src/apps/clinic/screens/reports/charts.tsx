// レポートのグラフ。色はトークンだけ（アクセントの濃淡）で、値は棒や升目のそばに直接書く。
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { HEATMAP_DAYS, HEATMAP_HOURS, heatmap, weekly } from "@/data";
import { md } from "@/lib/format";
import { cn, springSoft } from "@/ui";
import type { Metric, Share } from "./model";

/** 要素の幅を測る（SVGを実寸で描くため） */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** レポートの1区画（見出し＋補足＋中身） */
export function Card({ title, detail, aside, children, className, footer }: {
  title: string; detail?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; footer?: ReactNode;
}) {
  return (
    <section className={cn("flex flex-col rounded-card bg-surface p-4 md:p-5", className)}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-5 palt">{title}</h2>
          {detail && <div className="mt-0.5 text-[13px] leading-[18px] text-label2 tnum">{detail}</div>}
        </div>
        {aside}
      </header>
      <div className="flex-1">{children}</div>
      {footer && <p className="mt-4 text-[13px] leading-[1.6] text-label2">{footer}</p>}
    </section>
  );
}

// ─── 指標 ───────────────────────────────────────────────────────────────────
export function MetricTile({ m, compare, compact }: { m: Metric; compare: string; compact?: boolean }) {
  const up = m.delta >= 0;
  const flat = m.kind === "pt" ? Math.abs(m.delta) < 0.0005 : Math.abs(m.delta) < 0.0005;
  const positive = up === m.good;
  const text = m.kind === "pt" ? `${Math.abs(m.delta * 100).toFixed(1)}pt` : `${Math.abs(m.delta * 100).toFixed(1)}%`;
  return (
    <div className="min-w-0">
      <div className="truncate text-[13px] font-medium leading-[18px] text-label2">{m.label}</div>
      <div className="mt-1.5 flex items-baseline gap-0.5">
        <span className={cn("font-semibold leading-none tracking-[-0.02em] tnum", compact ? "text-[24px]" : "text-[28px]")}>{m.value}</span>
        {m.unit && <span className="text-[14px] font-medium text-label2">{m.unit}</span>}
      </div>
      <div className={cn("mt-2 flex items-center gap-0.5 text-[12px] font-semibold leading-4 tnum", flat ? "text-label2" : positive ? "text-accent" : "text-red")}>
        {!flat && (up ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} /> : <ArrowDownRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2.6} />)}
        {flat ? "変化なし" : text}
        <span className="ml-1 truncate font-medium text-label3">{compare}</span>
      </div>
    </div>
  );
}

// ─── 週ごとの来院数 ────────────────────────────────────────────────────────
function niceStep(max: number, n: number) {
  const raw = max / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

export function WeeklyChart({ height = 196 }: { height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const data = weekly.map(x => x.visits);
  const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
  const last = data.length - 1;
  const step = niceStep(Math.max(...data), 3);
  const top = Math.ceil(Math.max(...data) / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  const axisW = 30;
  const padT = 22;
  const padB = 22;
  const plotW = Math.max(0, w - axisW);
  const plotH = height - padT - padB;
  const y = (v: number) => padT + plotH * (1 - v / top);
  const band = plotW / data.length;
  const barW = Math.min(28, band * 0.62);
  const labelAt = (i: number) => (last - i) % 3 === 0;
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} className="block" role="img" aria-label={`週ごとの来院数。今週 ${data[last]}人、12週の平均 ${avg}人`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} stroke="rgb(var(--separator) / 0.16)" strokeWidth={1} />
              <text x={w} y={y(t) + 4} textAnchor="end" className="fill-label3 text-[11px] tnum">{t}</text>
            </g>
          ))}
          {data.map((v, i) => {
            const cx = band * i + band / 2;
            const h = plotH * (v / top);
            return (
              <g key={i}>
                <motion.rect
                  x={cx - barW / 2}
                  y={padT + plotH - h}
                  width={barW}
                  height={h}
                  rx={Math.min(5, barW / 3)}
                  style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ ...springSoft, delay: i * 0.02 }}
                  fill={i === last ? "rgb(var(--accent))" : "rgb(var(--sand) / 0.55)"}
                >
                  <title>{`${md(weekly[i].week)}の週 ${v}人`}</title>
                </motion.rect>
                {labelAt(i) && (
                  <text x={cx} y={height - 5} textAnchor="middle" className={cn("text-[11px] tnum", i === last ? "fill-label font-semibold" : "fill-label3")}>
                    {i === last ? "今週" : md(weekly[i].week)}
                  </text>
                )}
              </g>
            );
          })}
          <line x1={0} x2={plotW} y1={y(avg)} y2={y(avg)} stroke="rgb(var(--label) / 0.55)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={band * last + band / 2} y={y(data[last]) - 7} textAnchor="middle" className="fill-label text-[12px] font-semibold tnum">{data[last]}</text>
        </svg>
      )}
    </div>
  );
}

export function WeeklyLegend() {
  const data = weekly.map(x => x.visits);
  const avg = Math.round(data.reduce((a, b) => a + b, 0) / data.length);
  return (
    <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] text-label2 tnum">
      <svg width="16" height="2" aria-hidden><line x1="0" x2="16" y1="1" y2="1" stroke="rgb(var(--label) / 0.55)" strokeDasharray="3 3" /></svg>
      平均 {avg}人
    </div>
  );
}

// ─── 曜日×時間の混み具合 ──────────────────────────────────────────────────
const LEVEL = ["bg-accent/12", "bg-accent/28", "bg-accent/45", "bg-accent/65", "bg-accent/85"];
const levelOf = (v: number) => (v < 0.55 ? 0 : v < 0.68 ? 1 : v < 0.8 ? 2 : v < 0.9 ? 3 : 4);

export function Heatmap({ compact }: { compact?: boolean }) {
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `${compact ? 20 : 28}px repeat(${HEATMAP_HOURS.length}, minmax(0, 1fr))` }}>
        <span />
        {HEATMAP_HOURS.map((h, i) => (
          <span key={h} className="pb-1 text-center text-[11px] leading-none text-label3 tnum">{i === 0 && !compact ? `${h}時` : h}</span>
        ))}
        {HEATMAP_DAYS.map((d, di) => (
          <Row key={d} day={d} values={heatmap[di]} compact={compact} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12px] text-label2">
        <div className="flex items-center gap-1.5">
          空いている
          <span className="flex gap-[3px]">{LEVEL.map(c => <span key={c} className={cn("h-3 w-3 rounded-[3px]", c)} />)}</span>
          混んでいる
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hatch h-3 w-3 rounded-[3px] bg-fill/6" />
          時間外・昼休み
        </div>
      </div>
    </div>
  );
}

function Row({ day, values, compact }: { day: string; values: (number | null)[]; compact?: boolean }) {
  return (
    <>
      <span className="flex items-center text-[12px] font-medium text-label2">{day}</span>
      {values.map((v, i) => (
        <span
          key={i}
          title={v === null ? `${day}曜 ${HEATMAP_HOURS[i]}時台：時間外` : `${day}曜 ${HEATMAP_HOURS[i]}時台：稼働率 ${Math.round(v * 100)}%`}
          className={cn("rounded-[5px]", compact ? "h-[26px]" : "h-8", v === null ? "hatch bg-fill/6" : LEVEL[levelOf(v)])}
        />
      ))}
    </>
  );
}

/** 一番混む枠と空いている枠を一文で */
export function heatmapSummary(): string {
  let max = { v: -1, d: "", h: 0 };
  let min = { v: 2, d: "", h: 0 };
  HEATMAP_DAYS.forEach((d, di) => heatmap[di].forEach((v, hi) => {
    if (v === null) return;
    if (v > max.v) max = { v, d, h: HEATMAP_HOURS[hi] };
    if (v < min.v) min = { v, d, h: HEATMAP_HOURS[hi] };
  }));
  return `いちばん混むのは${max.d}曜の${max.h}時台（稼働率 ${Math.round(max.v * 100)}%）、空いているのは${min.d}曜の${min.h}時台（${Math.round(min.v * 100)}%）です。`;
}

// ─── 割合の横棒 ─────────────────────────────────────────────────────────────
export function ShareList({ rows, unit = "件", tone = "accent", inline, showCount = true }: {
  rows: Share[]; unit?: string; tone?: "accent" | "neutral"; inline?: boolean; showCount?: boolean;
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  const bar = (r: Share, i: number) => (
    <div className={cn("h-[6px] overflow-hidden rounded-full bg-fill/8", inline ? "min-w-0 flex-1" : "mt-1.5")}>
      <motion.div
        className={cn("h-full rounded-full", tone === "neutral" ? "bg-label3" : i === 0 ? "bg-accent" : "bg-sand/70")}
        initial={{ width: 0 }}
        animate={{ width: `${(r.value / max) * 100}%` }}
        transition={{ ...springSoft, delay: i * 0.03 }}
      />
    </div>
  );
  const nums = (r: Share) => (
    <span className="shrink-0 tnum text-label2">
      {showCount && <><span className="font-semibold text-label">{r.value}</span>{unit}</>}
      <span className={cn("inline-block w-[3.2em] text-right", !showCount && "font-semibold text-label")}>{Math.round(r.share * 100)}%</span>
    </span>
  );
  if (inline) {
    return (
      <ul>
        {rows.map((r, i) => (
          <li key={r.label} className="flex h-9 items-center gap-4 text-[14px]">
            <span className="w-[9.5em] shrink-0 truncate">{r.label}</span>
            {bar(r, i)}
            <span className="w-[8em] text-right">{nums(r)}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[14px] leading-5">
            <span className="min-w-0 truncate">{r.label}</span>
            {nums(r)}
          </div>
          {bar(r, i)}
        </li>
      ))}
    </ul>
  );
}

/** 100%の積み上げ棒（経路・保険／自費） */
export const STACK_TONES = ["bg-accent", "bg-accent/55", "bg-accent/30", "bg-fill/24"];

export function StackBar({ rows, tones = STACK_TONES }: { rows: Share[]; tones?: string[] }) {
  return (
    <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
      {rows.filter(r => r.value > 0).map(r => {
        const i = rows.indexOf(r);
        return (
          <motion.span
            key={r.label}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", tones[i % tones.length])}
            initial={{ flexGrow: 0 }}
            animate={{ flexGrow: r.share }}
            transition={springSoft}
            style={{ flexBasis: 0 }}
            title={`${r.label} ${Math.round(r.share * 100)}%`}
          />
        );
      })}
    </div>
  );
}
