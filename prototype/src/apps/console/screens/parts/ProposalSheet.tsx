import { useEffect, useState } from "react";
import type { ConsoleClinic, PlanKey } from "@/data";
import { yen } from "@/lib/format";
import { Segmented, Sheet, useToast } from "@/ui";
import { daysSince, planLabel, planPrice } from "./model";
import { sendProposal } from "./store";
import { SheetGroup } from "./ui";

const CHOICES: PlanKey[] = ["standard", "pro"];
const PITCH: Partial<Record<PlanKey, string>> = {
  standard: "スタッフを10名まで登録できるスタンダードプラン",
  pro: "スタッフ数の上限がなく、経営レポートも使えるプロプラン",
};

function draft(c: ConsoleClinic, plan: PlanKey) {
  const days = daysSince(c.createdAt);
  return [
    `${c.name} ご担当者様`,
    "",
    "いつもArcheをご利用いただき、ありがとうございます。",
    `ご登録から${days}日で、ご予約が${c.appts30d}件になりました。`,
    `予約が増えてきた医院には、${PITCH[plan] ?? `${planLabel(plan)}プラン`}（月額${yen(planPrice(plan))}）をおすすめしています。`,
    "ご不明な点は、このメールにご返信ください。",
    "",
    "Arche サポート（Sourirette 合同会社）",
  ].join("\n");
}

/** フリープランの医院に、有料プランを提案するメールを送る */
export function ProposalSheet({ clinic, open, onClose }: { clinic: ConsoleClinic; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [plan, setPlanChoice] = useState<PlanKey>("standard");
  const [body, setBody] = useState(() => draft(clinic, "standard"));
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (open) {
      setPlanChoice("standard");
      setBody(draft(clinic, "standard"));
      setEdited(false);
    }
  }, [open, clinic]);
  const choose = (p: PlanKey) => {
    setPlanChoice(p);
    if (!edited) setBody(draft(clinic, p));
  };
  const send = () => {
    sendProposal(clinic.id, plan);
    toast("提案を送りました", { detail: `${clinic.name} · ${planLabel(plan)}プラン` });
    onClose();
  };
  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()} title="アップグレードを提案" cancelLabel="キャンセル" confirmLabel="送信" onConfirm={send} confirmDisabled={!body.trim()}>
      <SheetGroup header="宛先">
        <div className="flex min-h-[48px] items-center justify-between gap-3 px-4 py-2.5">
          <span className="min-w-0 truncate text-[16px] md:text-[15px]">{clinic.name}</span>
          <span className="shrink-0 text-[13px] text-label2">登録時のメールアドレス</span>
        </div>
      </SheetGroup>
      <SheetGroup header="提案するプラン">
        <div className="p-2">
          <Segmented
            full
            value={plan}
            onChange={choose}
            options={CHOICES.map(p => ({ value: p, label: `${planLabel(p)} ${yen(planPrice(p))}` }))}
          />
        </div>
      </SheetGroup>
      <SheetGroup header="メッセージ" footer="送信すると、概要の「対応が必要」に提案済みと表示されます。">
        <textarea
          value={body}
          onChange={e => {
            setBody(e.target.value);
            setEdited(true);
          }}
          rows={9}
          aria-label="メッセージ"
          className="block w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-[1.7] outline-none md:text-[14px]"
        />
      </SheetGroup>
    </Sheet>
  );
}
