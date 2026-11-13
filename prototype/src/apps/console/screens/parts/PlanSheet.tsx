import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ConsoleClinic, PlanKey } from "@/data";
import { yen } from "@/lib/format";
import { Sheet, cn, springBouncy, useToast } from "@/ui";
import { PLAN_ORDER, PLAN_STYLE, addonsTotal, planLabel, planPrice, signedYen } from "./model";
import { setPlan, useConsole } from "./store";
import { RowRule, SheetGroup } from "./ui";

/** プランの変更。選んで「変更」→ ストアを更新してトースト */
export function PlanSheet({ clinic, open, onClose, initial }: { clinic: ConsoleClinic; open: boolean; onClose: () => void; initial?: PlanKey }) {
  const s = useConsole();
  const toast = useToast();
  const [sel, setSel] = useState<PlanKey>(initial ?? clinic.plan);
  useEffect(() => {
    if (open) setSel(initial ?? clinic.plan);
  }, [open, clinic.plan, initial]);
  const extra = addonsTotal(s, clinic);
  const before = planPrice(clinic.plan) + extra;
  const after = planPrice(sel) + extra;
  const changed = sel !== clinic.plan;

  const confirm = () => {
    if (!changed) return;
    setPlan(clinic.id, sel);
    toast("プランを変更しました", { detail: `${clinic.name} · ${planLabel(clinic.plan)} → ${planLabel(sel)}` });
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()} title="プランを変更" cancelLabel="キャンセル" confirmLabel="変更" onConfirm={confirm} confirmDisabled={!changed}>
      <p className="px-1 pb-1 text-[14px] leading-[1.6] text-label2">
        <span className="font-semibold text-label">{clinic.name}</span>の契約プランを選んでください。
      </p>
      <SheetGroup header="プラン">
        <div role="radiogroup" aria-label="プラン">
          {PLAN_ORDER.map(p => {
            const on = sel === p;
            const current = clinic.plan === p;
            return (
              <button
                key={p}
                role="radio"
                aria-checked={on}
                onClick={() => setSel(p)}
                className={cn("group relative flex min-h-[60px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 active:bg-fill/12", on ? "bg-sand/20" : "hover:bg-fill/[0.06]")}
              >
                <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors", on ? "bg-accent text-surface" : "shadow-[inset_0_0_0_1.5px_rgb(var(--label-4))]")}>
                  <AnimatePresence initial={false}>
                    {on && (
                      <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }} transition={springBouncy}>
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[16px] font-semibold md:text-[15px]">{planLabel(p)}</span>
                    {current && <span className="text-[12px] font-medium text-label3">現在のプラン</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-label2">{PLAN_STYLE[p].note}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[15px] font-semibold tnum">{yen(planPrice(p))}</span>
                  <span className="block text-[11px] text-label3">{p === "enterprise" ? "月額・個別見積" : "月額"}</span>
                </span>
                <RowRule inset={51} />
              </button>
            );
          })}
        </div>
      </SheetGroup>

      <SheetGroup header="月額の変化" footer="変更は今日から有効です。差額は日割りで、次回の請求に反映されます。">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[15px] tnum">
              <span className="text-label2">{yen(before)}</span>
              <span className="mx-1.5 text-label3">→</span>
              <span className="font-semibold">{yen(after)}</span>
            </div>
            {extra > 0 && <div className="mt-0.5 text-[12px] text-label3">オプション {yen(extra)} を含む</div>}
          </div>
          <span className={cn("shrink-0 text-[14px] font-semibold tnum", !changed ? "text-label3" : after >= before ? "text-accent" : "text-label2")}>
            {changed ? signedYen(after - before) : "変更なし"}
          </span>
        </div>
      </SheetGroup>
    </Sheet>
  );
}
