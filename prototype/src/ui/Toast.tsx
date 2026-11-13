import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck } from "lucide-react";
import { useIsPhone } from "@/lib/media";
import { spring } from "./motion";
import type { LucideIcon } from "lucide-react";

type ToastOpts = {
  icon?: LucideIcon;
  detail?: string;
  /** 「取り消す」などの操作。付けると表示が少し長くなる */
  action?: { label: string; onClick: () => void };
};
type ToastFn = (message: string, opts?: ToastOpts) => void;
const Ctx = createContext<ToastFn>(() => {});

/**
 * 小さなカプセル型の通知。PCは画面の上、スマホはタブバーのすぐ上に出る
 * （画面上部の見出しやボタンを隠さないように）。約2秒、操作付きは約4秒で消える。
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const phone = useIsPhone();
  const [item, setItem] = useState<({ id: number; message: string } & ToastOpts) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const toast = useCallback<ToastFn>((message, opts) => {
    clearTimeout(timer.current);
    setItem({ id: Date.now(), message, ...opts });
    timer.current = setTimeout(() => setItem(null), opts?.action ? 4200 : 2300);
  }, []);
  const Icon = item?.icon ?? CircleCheck;
  const from = phone ? 18 : -18;
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div
        className={
          phone
            ? "pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+62px)] z-[90] flex justify-center px-4"
            : "pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+10px)] z-[90] flex justify-center px-4"
        }
      >
        <AnimatePresence>
          {item && (
            <motion.div
              key={item.id}
              role="status"
              initial={{ opacity: 0, y: from, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: from * 0.6, scale: 0.98, transition: { duration: 0.16 } }}
              transition={spring}
              className="pointer-events-auto flex min-h-[46px] max-w-[min(460px,100%)] items-center gap-2.5 rounded-full bg-ink/95 py-2 pl-3 pr-2 text-onink shadow-pop backdrop-blur"
            >
              <Icon className="h-[22px] w-[22px] shrink-0 text-sand" strokeWidth={2.2} />
              <div className={item.action ? "min-w-0 flex-1" : "min-w-0 flex-1 pr-3"}>
                <div className="truncate text-[14px] font-semibold leading-tight">{item.message}</div>
                {item.detail && <div className="truncate text-[12px] leading-tight opacity-70">{item.detail}</div>}
              </div>
              {item.action && (
                <button
                  onClick={() => {
                    item.action!.onClick();
                    clearTimeout(timer.current);
                    setItem(null);
                  }}
                  className="ml-1 h-8 shrink-0 rounded-full px-3 text-[14px] font-semibold text-sand transition-colors hover:bg-onink/10"
                >
                  {item.action.label}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
