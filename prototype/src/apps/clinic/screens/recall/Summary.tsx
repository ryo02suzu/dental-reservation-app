import { Ring, cn } from "@/ui";
import type { RecallRow } from "./model";

/** 上の要約：対象・未連絡・返事待ち・予約済みと予約率のリング（事実だけを並べる） */
export function RecallSummary({ rows, compact }: { rows: RecallRow[]; compact: boolean }) {
  const total = rows.length;
  const booked = rows.filter(x => x.r.status === "予約済み").length;
  const waitingReply = rows.filter(x => x.r.status === "送信済み").length;
  const waiting = rows.filter(x => x.r.status === "未連絡").length;
  const overdue = rows.filter(x => x.r.status === "未連絡" && x.days < 0).length;
  const rate = total ? booked / total : 0;
  // スマホは3つに絞る（対象の人数はリングの予約率の分母として読める）
  const stats = [
    ...(compact ? [] : [{ label: "対象", value: total }]),
    { label: "未連絡", value: waiting },
    { label: "返事待ち", value: waitingReply },
    { label: "予約済み", value: booked },
  ];
  return (
    <div className="rounded-card bg-surface">
      <div className={cn("flex items-center", compact ? "gap-4 px-4 py-4" : "gap-8 px-6 py-5")}>
        <Ring value={rate} size={compact ? 72 : 84} stroke={compact ? 7 : 8}>
          <div className="text-center leading-none">
            <div className={cn("font-semibold tnum", compact ? "text-[17px]" : "text-[20px]")}>
              {Math.round(rate * 100)}
              <span className="text-[11px] font-medium text-label2">%</span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-label2">予約率</div>
          </div>
        </Ring>
        <div className={cn("grid min-w-0 flex-1", compact ? "grid-cols-3 gap-2" : "grid-cols-4 gap-6")}>
          {stats.map(s => (
            <div key={s.label} className="min-w-0">
              <div className="truncate text-[12px] font-medium text-label2 md:text-[13px]">{s.label}</div>
              <div className="mt-1 flex items-baseline gap-0.5">
                <span className={cn("font-semibold leading-none tracking-[-0.01em] tnum", compact ? "text-[24px]" : "text-[28px]")}>{s.value}</span>
                <span className="text-[13px] font-medium text-label2">人</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {overdue > 0 && (
        <div className={cn("hairline-t text-[13px] text-label2", compact ? "px-4 py-2.5" : "px-6 py-3")}>
          <span className="[word-break:auto-phrase]">{compact ? `対象 ${total}人のうち、` : ""}期限を過ぎて未連絡の方が<span className="font-semibold text-label tnum">{overdue}人</span>います</span>
        </div>
      )}
    </div>
  );
}
