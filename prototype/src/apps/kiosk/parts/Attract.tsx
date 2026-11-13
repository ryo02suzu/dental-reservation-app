// 待受画面：医院名・大きな時計・「受付する」
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { clinic, clinicPhase, hoursFor } from "@/data";
import { useNow, minutesOfDay } from "@/lib/clock";
import { hm, mdw } from "@/lib/format";
import { cn, spring, tapSoft } from "@/ui";

export function Attract({ onStart, onExit, onHelp }: { onStart: () => void; onExit: () => void; onHelp: () => void }) {
  const t = useNow(1000);
  const h = hoursFor(t);
  const phase = clinicPhase(t);
  const [asking, setAsking] = useState(false);
  const hours = h ? `${hm(h.am[0])}–${hm(h.am[1])} / ${hm(h.pm[0])}–${hm(h.pm[1])}` : null;

  return (
    <div className="relative flex min-h-full flex-col px-6 pb-6 pt-5 md:px-12 md:pb-10 md:pt-8 lg:px-16">
      {/* 上：医院名とスタッフ用の終了ボタン */}
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="truncate text-[20px] font-semibold tracking-[-0.01em] palt md:text-[24px]">{clinic.name}</div>
          <div className="mt-0.5 text-[14px] text-label2 md:text-[15px]">受付端末</div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setAsking(v => !v)}
            aria-label="受付端末を終了（スタッフ用）"
            className="flex h-11 w-11 items-center justify-center rounded-full text-label3 transition-colors hover:bg-fill/12 active:bg-fill/16"
          >
            <Lock className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
          <AnimatePresence>
            {asking && (
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
                transition={spring}
                style={{ transformOrigin: "top right" }}
                className="absolute right-0 top-12 z-20 w-[272px] rounded-card bg-elevated p-4 shadow-pop"
              >
                <div className="text-[15px] font-semibold">受付端末を終了しますか？</div>
                <p className="mt-1 text-[13px] leading-[1.6] text-label2">スタッフ用の操作です。終了すると、プロトタイプのトップにもどります。</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAsking(false)} className="h-11 rounded-[12px] bg-fill/12 text-[15px] font-semibold">キャンセル</button>
                  <button type="button" onClick={onExit} className="h-11 rounded-[12px] bg-ink text-[15px] font-semibold text-onink">終了する</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-10 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12 lg:py-6">
        {/* 時計 */}
        <div className="lg:flex-1">
          <div className="text-[88px] font-semibold leading-none tracking-[-0.04em] tnum md:text-[136px] lg:text-[152px]" aria-label={`現在 ${hm(minutesOfDay(t))}`}>
            {hm(minutesOfDay(t))}
          </div>
          <div className="mt-4 text-[24px] font-semibold palt md:mt-6 md:text-[32px]">{mdw(t)}</div>
          <div className="mt-2 flex items-center gap-2 text-[17px] text-label2 md:text-[20px]">
            <span className={cn("h-2 w-2 rounded-full", phase.kind === "am" || phase.kind === "pm" ? "bg-accent" : "bg-label3")} aria-hidden />
            {phase.label}
            {phase.detail && <span className="text-label3">・{phase.detail}</span>}
          </div>
        </div>

        {/* 受付する */}
        <motion.button
          type="button"
          onClick={onStart}
          whileTap={tapSoft}
          transition={{ type: "spring", stiffness: 600, damping: 32 }}
          className="group flex min-h-[208px] w-full flex-col justify-between gap-6 rounded-[28px] bg-ink p-7 text-left text-onink md:h-[260px] md:p-9 lg:h-[380px] lg:w-[440px] lg:shrink-0"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center self-end rounded-full bg-onink/14 md:h-16 md:w-16">
            <ArrowRight className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[44px] font-bold leading-none tracking-[-0.01em] palt md:text-[56px]">受付する</span>
            <span className="mt-3 block text-[17px] leading-[1.6] opacity-70 md:mt-4 md:text-[20px]"><span className="md:hidden">ご予約のある方はこちら</span><span className="hidden md:inline">ご予約のある方は、こちらを押してください</span></span>
          </span>
        </motion.button>
      </div>

      {/* 下：診療時間と、予約のない方へのご案内 */}
      <footer className="flex flex-col gap-1 text-[16px] text-label2 md:flex-row md:items-center md:justify-between md:text-[18px]">
        <div className="tnum">
          {hours ? (
            <>
              <span className="text-label3">本日の診療</span>　{hours}
            </>
          ) : (
            "本日は休診日です"
          )}
        </div>
        <button type="button" onClick={onHelp} className="-mx-3 h-16 rounded-[14px] px-3 text-left text-accent transition-colors hover:bg-fill/8 md:text-right">
          ご予約のない方・はじめての方は、<span className="font-semibold">受付カウンターへお声がけください</span>
        </button>
      </footer>
    </div>
  );
}
