import { units } from "@/data";
import { hm } from "@/lib/format";
import { cn } from "@/ui";
import { AnimatedNumber } from "./parts";
import type { Today } from "./model";

export type JumpTarget = "attention" | "waiting" | "units" | "upcoming" | "finished";

/** 今日の件数（予約・待合・診療中・完了・未来院）と、1日の小さな見取り図 */
export function Overview({ t, layout, onJump }: { t: Today; layout: "phone" | "tablet" | "desktop" | "wide"; onJump?: (to: JumpTarget) => void }) {
  const c = t.counts;
  const items: { label: string; value: number; to: JumpTarget; red?: boolean }[] = [
    { label: "予約", value: c.total, to: "upcoming" },
    { label: "待合", value: c.waiting, to: "waiting" },
    { label: "診療中", value: c.treating, to: "units" },
    { label: "完了", value: c.done, to: "finished" },
    { label: "未来院", value: c.late, to: "attention", red: c.late > 0 },
  ];
  // 横1行（Mac・iPad横）：左に件数、右に見取り図。縦積み（スマホ・iPad縦）：件数の下に見取り図
  const row = layout === "wide" || layout === "desktop";
  const counts = (
    <div className={cn("grid grid-cols-5", layout === "wide" ? "w-[380px] shrink-0 gap-1" : row ? "w-[300px] shrink-0" : "-mx-1.5")}>
      {items.map(it => {
        const body = (
          <>
            <span className="text-[12px] font-medium leading-4 text-label2">{it.label}</span>
            <AnimatedNumber value={it.value} className={cn("mt-1 text-[24px] font-semibold leading-7 tracking-[-0.01em]", it.red ? "text-red" : it.value === 0 ? "text-label3" : "text-label")} />
          </>
        );
        return onJump && !row ? (
          <button
            key={it.label}
            type="button"
            onClick={() => onJump(it.to)}
            className="flex flex-col items-start rounded-[10px] px-1.5 py-1 text-left transition-colors hover:bg-fill/6 active:bg-fill/12"
          >
            {body}
          </button>
        ) : (
          <div key={it.label} className="flex flex-col items-start px-0.5 py-1">{body}</div>
        );
      })}
    </div>
  );
  return (
    <div className={cn("rounded-card bg-surface", row ? cn("flex items-center py-4 pl-5 pr-6", layout === "wide" ? "gap-7" : "gap-5") : "p-4")}>
      {counts}
      {row ? <span aria-hidden className="h-16 w-px shrink-0 scale-x-50 bg-sep/30" /> : <div aria-hidden className="my-3.5 h-px scale-y-50 bg-sep/30" />}
      <DayMap t={t} hourStep={layout === "phone" || layout === "desktop" ? 2 : 1} className={row ? "min-w-0 flex-1" : undefined} />
    </div>
  );
}

/**
 * 診療時間の帯（ユニット4本）。終わった時間は塗り、昼休みは斜線、いまの位置に線。
 * 空いている時間（予約の入っていない隙間）がひと目でわかる。
 */
function DayMap({ t, hourStep, className }: { t: Today; hourStep: number; className?: string }) {
  const h = t.hours;
  if (!h) return null;
  const s0 = h.am[0];
  const e0 = h.pm[1];
  const span = e0 - s0;
  const pct = (m: number) => ((Math.min(Math.max(m, s0), e0) - s0) / span) * 100;
  const nowPct = pct(t.nowMin);
  const showNow = t.nowMin >= s0 && t.nowMin <= e0;
  const hours: number[] = [];
  for (let m = s0; m <= e0; m += 60 * hourStep) hours.push(m);
  if (hours[hours.length - 1] !== e0) hours.push(e0);

  return (
    <div className={cn("relative", className)} aria-label={`本日の予約の埋まり具合（${hm(s0)}〜${hm(e0)}）`} role="img">
      <div className="flex items-end">
        <div className="w-6 shrink-0" />
        <div className="relative h-4 flex-1">
          {showNow && (
            <span
              className="absolute bottom-[5px] whitespace-nowrap text-[11px] font-semibold leading-none text-label tnum"
              style={{ left: `${nowPct}%`, transform: `translateX(${nowPct < 6 ? "0" : nowPct > 94 ? "-100%" : "-50%"})` }}
            >
              {hm(t.nowMin)}
            </span>
          )}
        </div>
      </div>
      <div className="flex">
        <div className="flex w-6 shrink-0 flex-col gap-[5px] text-[10px] font-medium leading-[6px] text-label3 tnum">
          {units.map(u => <span key={u.id} className="h-[6px]">{u.short}</span>)}
        </div>
        <div className="relative flex-1">
          {/* 昼休み */}
          <span
            aria-hidden
            className="hatch absolute -bottom-1 -top-1 rounded-[3px]"
            style={{ left: `${pct(h.am[1])}%`, width: `${pct(h.pm[0]) - pct(h.am[1])}%` }}
          />
          <div className="relative flex flex-col gap-[5px]">
            {units.map(u => (
              <div key={u.id} className="relative h-[6px]">
                {t.rows
                  .filter(r => r.a.unitId === u.id && r.a.status !== "cancelled")
                  .map(r => {
                    const a = r.a;
                    const len = Math.max(1, a.end - a.start);
                    const passed = Math.min(1, Math.max(0, (t.nowMin - a.start) / len));
                    const fill =
                      a.status === "completed" ? { w: 1, cls: "bg-accent/45" }
                      : a.status === "no_show" ? { w: 1, cls: "bg-red/45" }
                      : a.status === "in_progress" ? { w: Math.max(passed, 0.08), cls: "bg-accent" }
                      : r.late ? { w: passed, cls: "bg-red/70" }
                      : { w: 0, cls: "" };
                    return (
                      <span
                        key={a.id}
                        className="absolute top-0 h-full overflow-hidden rounded-[1.5px] bg-fill/18"
                        style={{ left: `${pct(a.start)}%`, width: `calc(${pct(a.end) - pct(a.start)}% - 1.5px)` }}
                      >
                        {fill.w > 0 && <span className={cn("absolute inset-y-0 left-0 motion-safe:transition-[width] motion-safe:duration-700", fill.cls)} style={{ width: `${fill.w * 100}%` }} />}
                      </span>
                    );
                  })}
              </div>
            ))}
          </div>
          {showNow && (
            <span aria-hidden className="absolute -bottom-1 -top-1 w-[1.5px] -translate-x-1/2 rounded-full bg-label motion-safe:transition-[left] motion-safe:duration-700" style={{ left: `${nowPct}%` }} />
          )}
        </div>
      </div>
      <div className="flex">
        <div className="w-6 shrink-0" />
        <div className="relative mt-2.5 h-3 flex-1">
          {hours.map((m, i) => (
            <span
              key={m}
              className="absolute top-0 whitespace-nowrap text-[10px] leading-3 text-label3 tnum"
              style={{ left: `${pct(m)}%`, transform: `translateX(${i === 0 ? "0" : i === hours.length - 1 ? "-100%" : "-50%"})` }}
            >
              {`${Math.floor(m / 60)}時`}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
