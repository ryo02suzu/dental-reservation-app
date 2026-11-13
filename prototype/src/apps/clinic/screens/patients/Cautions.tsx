// 治療の前に必ず目に入れたいこと（医療上の注意・固定メモ・申し送り）。
// 患者詳細のいちばん上と、予約の詳細の患者名の下で同じものを出す。来院の傾向（キャンセル回数）はここに入れない。
import { Fragment } from "react";
import { Pin, TriangleAlert } from "lucide-react";
import { staffById, type Memo, type Patient } from "@/data";
import { cn } from "@/ui";
import { alertsOf } from "@/apps/clinic/helpers";
import { memoWhen } from "./util";

/** 和文の中の英数字の略語（PT-INR、CR など）を途中で折り返さない */
export function JpText({ text }: { text: string }) {
  const parts = text.split(/([A-Za-z0-9][A-Za-z0-9\-./%]*[A-Za-z0-9%]|[A-Za-z0-9])/);
  return (
    <>
      {parts.map((t, i) => (i % 2 ? <span key={i} className="whitespace-nowrap">{t}</span> : <Fragment key={i}>{t}</Fragment>))}
    </>
  );
}

export function Cautions({ p, pinned, variant, className }: { p: Patient; pinned: Memo[]; variant: "page" | "sheet"; className?: string }) {
  const items = alertsOf(p).map(a => ({ label: a.label, red: a.tone === "red" }));
  if (!items.length && !pinned.length && !p.memo) return null;
  const red = items.some(i => i.red);
  const sheet = variant === "sheet";
  return (
    <div
      role={red ? "alert" : undefined}
      className={cn(sheet ? "rounded-cell px-4 py-3" : "rounded-card px-4 py-3.5", red ? "bg-red/8" : sheet ? "bg-fill/8" : "bg-surface", className)}
    >
      {items.length > 0 && (
        <>
          <div className={cn("flex items-center gap-1.5 font-semibold", sheet ? "text-[12px]" : "text-footnote", red ? "text-red" : "text-label2")}>
            <TriangleAlert className={sheet ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={2.3} />
            注意事項
          </div>
          <ul className={cn("flex flex-wrap gap-x-6", sheet ? "mt-1.5 gap-y-1" : "mt-2 gap-y-1.5")}>
            {items.map(i => (
              <li key={i.label} className="flex min-w-0 items-center gap-2">
                <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", i.red ? "bg-red" : "bg-label3")} />
                <span className={cn(sheet ? "text-[15px] leading-[22px] md:text-[14px] md:leading-5" : "text-[17px] leading-6 md:text-[16px]", i.red ? "font-semibold text-red" : "font-medium text-label")}>
                  {i.label}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {pinned.map((x, i) => {
        const s = staffById(x.staffId);
        return (
          <div key={x.id} className={cn("flex gap-2.5", (items.length > 0 || i > 0) && (sheet ? "mt-2.5" : "hairline-t mt-3 pt-3"))}>
            <Pin className="mt-[3px] h-3.5 w-3.5 shrink-0 text-label2" strokeWidth={2.3} aria-label="固定メモ" />
            <div className="min-w-0">
              <p className={cn("leading-[1.6] text-label [word-break:auto-phrase]", sheet ? "text-[13px]" : "text-[15px]")}><JpText text={x.body} /></p>
              <p className="mt-0.5 text-caption text-label2">
                {s.name}（{s.role}）<span className="px-1 text-label4">·</span>
                {memoWhen(x)}
              </p>
            </div>
          </div>
        );
      })}
      {p.memo && (
        <div className={cn("flex gap-2.5 leading-[1.6]", sheet ? "text-[13px]" : "text-[15px]", (items.length > 0 || pinned.length > 0) && (sheet ? "mt-2" : "hairline-t mt-3 pt-3"))}>
          <span className="shrink-0 font-medium text-label2">申し送り</span>
          <span className="min-w-0 text-label [word-break:auto-phrase]">{p.memo}</span>
        </div>
      )}
    </div>
  );
}
