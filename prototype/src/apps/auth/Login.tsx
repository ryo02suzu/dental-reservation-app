// スタッフのサインイン。1段目でアカウント、2段目で共用iPadを使う人とPINを確かめてから医院アプリへ。
import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import type { Staff } from "@/data";
import { useIsPhone } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { cn, springSoft, useToast } from "@/ui";
import { Credentials } from "./parts/Credentials";
import { PinPad, StaffPicker } from "./parts/Device";

type Step = { k: "account" } | { k: "who" } | { k: "pin"; who: Staff };

export default function LoginApp() {
  const phone = useIsPhone();
  const { goApp } = useRoute();
  const toast = useToast();
  const { setCurrentStaff } = useStore();
  const [step, setStep] = useState<Step>({ k: "account" });
  const [dir, setDir] = useState(1);
  const to = (s: Step, d = 1) => { setDir(d); setStep(s); };

  const finish = useCallback((who: Staff) => {
    setCurrentStaff(who.id);
    toast(`${who.name}さんでサインインしました`, { detail: "ひだまり歯科クリニック" });
    goApp("clinic");
  }, [toast, goApp, setCurrentStaff]);
  const cancelPin = useCallback(() => { setDir(-1); setStep({ k: "who" }); }, []);

  const back = (
    <button type="button" onClick={() => goApp("launcher")} className="-ml-2 flex h-11 items-center gap-0.5 rounded-full px-2 text-[14px] text-label2 transition-colors hover:text-label">
      <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.2} />
      プロトタイプのトップへ
    </button>
  );
  const support = <p className="text-[12px] leading-[1.6] text-label3 tnum">医院のサポート 0120-000-000（平日 9:00–18:00）</p>;

  const key = step.k === "pin" ? `pin-${step.who.id}` : step.k;
  const content =
    step.k === "account" ? <Credentials phone={phone} footer={phone ? support : undefined} onDone={() => to({ k: "who" })} />
    : step.k === "who" ? <StaffPicker onPick={s => to({ k: "pin", who: s })} onOther={() => to({ k: "account" }, -1)} />
    : <PinPad who={step.who} onSuccess={() => finish(step.who)} onCancel={cancelPin} />;

  const animated = (
    <AnimatePresence mode="wait" initial={false} custom={dir}>
      <motion.div
        key={key}
        custom={dir}
        variants={{
          enter: (d: number) => ({ opacity: 0, x: d * 24 }),
          center: { opacity: 1, x: 0, transition: springSoft },
          exit: (d: number) => ({ opacity: 0, x: d * -16, transition: { duration: 0.12 } }),
        }}
        initial="enter"
        animate="center"
        exit="exit"
        className={cn(phone && "flex flex-1 flex-col", phone && step.k !== "account" && "justify-center pb-6")}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );

  if (phone) {
    return (
      <div className="h-full overflow-y-auto overflow-x-hidden bg-bg">
        <div className="flex min-h-full flex-col px-4 pt-[calc(env(safe-area-inset-top)+4px)]">
          <div className="h-11">{back}</div>
          <div className="flex flex-1 flex-col pt-6">{animated}</div>
          {step.k !== "account" && <div className="pb-[calc(env(safe-area-inset-bottom)+16px)] pt-6 text-center">{support}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="flex min-h-full flex-col px-8">
        <div className="flex h-16 items-center">{back}</div>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div className="w-[400px] max-w-full rounded-[20px] bg-surface px-10 pb-9 pt-10">
            {animated}
          </motion.div>
        </div>
        <div className="flex h-16 items-center justify-center">{support}</div>
      </div>
    </div>
  );
}
