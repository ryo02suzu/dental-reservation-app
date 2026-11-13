import { useEffect, useState } from "react";
import type { ConsoleClinic, PlanKey } from "@/data";
import { yen } from "@/lib/format";
import { Segmented, Sheet, useToast } from "@/ui";
import { daysSince, emailOf, planLabel, planPrice, sinceSignup } from "./model";
import { sendProposal } from "./store";
import { RowRule, SheetGroup } from "./ui";

const CHOICES: PlanKey[] = ["standard", "pro"];
const subject = (p: PlanKey) => `${planLabel(p)}プランのご案内（Arche）`;
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
    `ご登録から${days}日で、予約が${sinceSignup(c)}件になりました。`,
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
      <SheetGroup>
        <div className="group relative flex min-h-[44px] items-center gap-3 px-4 py-2.5">
          <span className="w-[3em] shrink-0 text-[14px] text-label2">宛先</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px]">{clinic.name} 院長</span>
            <span className="block truncate text-[13px] text-label2">{emailOf(clinic)}</span>
          </span>
          <RowRule inset={16} />
        </div>
        <div className="flex min-h-[44px] items-center gap-3 px-4 py-2.5">
          <span className="w-[3em] shrink-0 text-[14px] text-label2">件名</span>
          <span className="min-w-0 flex-1 truncate text-[15px]">{subject(plan)}</span>
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
      <SheetGroup header="メッセージ" footer="院長あてに送信します。返信はサポートの受信箱に届きます。">
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
