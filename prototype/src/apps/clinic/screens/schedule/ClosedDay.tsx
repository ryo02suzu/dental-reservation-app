// 休診日（木・日・祝）の表示。理由と、次の診療日へのボタンだけを静かに置く
import { ArrowRight } from "lucide-react";
import { clinic } from "@/data";
import { TODAY_KEY } from "@/lib/clock";
import { key, mdw } from "@/lib/format";
import { Button, cn } from "@/ui";
import { closedInfo, nextOpenDay } from "./model";

export function ClosedDay({ date, onJump, phone }: { date: Date; onJump: (d: Date) => void; phone?: boolean }) {
  const info = closedInfo(date);
  const next = nextOpenDay(date);
  if (!info) return null;
  const past = key(date) < TODAY_KEY;
  const nextIsToday = key(next) === TODAY_KEY;
  return (
    <div className={cn("relative flex items-center justify-center overflow-hidden bg-surface", phone ? "rounded-cell px-4 py-10" : "min-h-[max(440px,calc(100vh-300px))] px-8 py-16")}>
      <span aria-hidden className="hatch absolute inset-0 opacity-60" />
      <div className={cn("relative flex w-full flex-col items-center rounded-card bg-surface text-center", phone ? "px-4 pb-5 pt-5" : "max-w-[400px] px-8 pb-7 pt-7 shadow-float ring-[0.5px] ring-sep/20")}>
        <span className="text-[13px] font-semibold text-label2 palt">{info.label}</span>
        <h2 className="mt-1 text-title2 palt">休診日</h2>
        <p className="mt-2 text-[14px] leading-[1.65] text-label2">
          {info.reason}。
          {!past && (
            <>
              <br />
              Web予約も受け付けていません。
            </>
          )}
        </p>
        <Button variant="tinted" size="md" className="mt-5" onClick={() => onJump(next)}>
          {nextIsToday ? "今日" : "次の診療日"}　{mdw(next)}
          <ArrowRight className="-mr-1 h-4 w-4" strokeWidth={2.4} />
        </Button>
        <p className="mt-4 text-[12px] text-label3">定休日　{clinic.closedLabel}</p>
      </div>
    </div>
  );
}
