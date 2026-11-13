import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { useIsPhone } from "@/lib/media";
import type { RecallItem } from "@/data";
import { Avatar, Button, Sheet, cn } from "@/ui";
import { CHANNEL_ICON } from "./RecallRowView";
import { TEMPLATE, fillTemplate, type RecallRow } from "./model";

const ORDER: RecallItem["channel"][] = ["LINE", "SMS", "メール", "電話"];

/** まとめて送るときの確認シート。文面を編集でき、1人目の実際の表示と連絡方法の内訳を見せる */
export function SendSheet({ open, rows, resend, onClose, onSend }: {
  open: boolean;
  rows: RecallRow[];
  resend: boolean;
  onClose: () => void;
  onSend: (targets: RecallRow[]) => void;
}) {
  const phone = useIsPhone();
  const [text, setText] = useState(TEMPLATE);
  useEffect(() => {
    if (open) setText(TEMPLATE);
  }, [open]);

  const targets = rows.filter(x => x.r.channel !== "電話");
  const callers = rows.filter(x => x.r.channel === "電話");
  const counts = ORDER.map(c => ({ c, n: rows.filter(x => x.r.channel === c).length })).filter(x => x.n);
  const sample = targets[0] ?? rows[0];
  const preview = sample ? fillTemplate(text, sample.p) : "";
  const tooLong = preview.length > 670;
  const empty = !text.trim();

  return (
    <Sheet
      open={open}
      onOpenChange={o => !o && onClose()}
      title={resend ? "リコールを再送" : "リコールを送る"}
      cancelLabel="キャンセル"
      size="lg"
      footer={
        <Button variant="filled" size="lg" full disabled={!targets.length || empty || tooLong} onClick={() => onSend(targets)}>
          {targets.length}人に{resend ? "再送" : "送る"}
        </Button>
      }
    >
      <section className="pt-2">
        <h3 className="px-1 pb-1.5 text-footnote font-medium text-label2">送信先</h3>
        <div className="rounded-cell bg-fill/8 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {rows.slice(0, 5).map(x => (
                <Avatar key={x.p.id} name={x.p.name} size={30} className="ring-2 ring-elevated" />
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[16px] font-semibold tnum md:text-[15px]">{rows.length}人</div>
              <div className="truncate text-[13px] text-label2">
                {rows.slice(0, 3).map(x => x.p.name).join("、")}
                {rows.length > 3 ? ` ほか${rows.length - 3}人` : ""}
              </div>
            </div>
          </div>
          <div className="hairline-t mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 pt-3">
            {counts.map(({ c, n }) => {
              const Icon = CHANNEL_ICON[c];
              return (
                <span key={c} className={cn("inline-flex items-center gap-1.5 text-[14px] tnum", c === "電話" ? "text-label3" : "text-label")}>
                  <Icon className="h-[15px] w-[15px] text-label3" strokeWidth={2} />
                  {c} {n}
                </span>
              );
            })}
          </div>
        </div>
        {callers.length > 0 && (
          <p className="flex gap-1.5 px-1 pt-2 text-footnote leading-[1.6] text-label2 [word-break:auto-phrase]">
            <Phone className="mt-[3px] h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
            <span>連絡方法が電話の{callers.length}人（{callers.slice(0, 2).map(x => `${x.p.name}さん`).join("、")}{callers.length > 2 ? " ほか" : ""}）には送信されません。一覧に残るので、電話のあとに「電話した」を押してください。</span>
          </p>
        )}
      </section>

      <section className="pt-6">
        <div className="flex items-end justify-between px-1 pb-1.5">
          <h3 className="text-footnote font-medium text-label2">メッセージ</h3>
          <button type="button" onClick={() => setText(TEMPLATE)} disabled={text === TEMPLATE} className="text-footnote text-accent transition-opacity disabled:opacity-0">
            元の文面に戻す
          </button>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={phone ? 6 : 4}
          aria-label="メッセージ"
          className="block w-full resize-none rounded-cell bg-fill/8 px-4 py-3 text-[16px] leading-[1.65] text-label outline-none placeholder:text-label3 focus:shadow-[inset_0_0_0_1.5px_rgb(var(--accent)/0.5)] md:text-[15px]"
        />
        <div className="flex justify-between gap-3 px-1 pt-1.5 text-footnote text-label2">
          <span className="[word-break:auto-phrase]">{"{氏名}"}と{"{間隔}"}は、患者さんごとに置き換わります。</span>
          <span className={cn("shrink-0 tnum", tooLong && "text-red")}>{preview.length}文字{tooLong ? "（SMSは670文字まで）" : ""}</span>
        </div>
      </section>

      {sample && (
        <section className="pt-6">
          <h3 className="px-1 pb-1.5 text-footnote font-medium text-label2">{sample.p.name}さんへの表示</h3>
          <div className="rounded-cell bg-fill/8 p-4">
            <div className="max-w-[440px] rounded-[18px] rounded-tl-[6px] bg-surface px-4 py-3 text-[15px] leading-[1.65] text-label shadow-[0_0_0_0.5px_rgb(var(--separator)/0.3)] whitespace-pre-wrap">
              {preview || <span className="text-label3">（本文がありません）</span>}
            </div>
            <div className="mt-2 text-[12px] text-label3">{sample.r.channel}で届きます</div>
          </div>
        </section>
      )}
    </Sheet>
  );
}
