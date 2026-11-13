import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck } from "lucide-react";
import { springBouncy } from "./motion";
import type { LucideIcon } from "lucide-react";

type ToastFn = (message: string, opts?: { icon?: LucideIcon; detail?: string }) => void;
const Ctx = createContext<ToastFn>(() => {});

/** 画面上部に出る小さなカプセル型の通知（約2秒で消える） */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<{ id: number; message: string; detail?: string; icon?: LucideIcon } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const toast = useCallback<ToastFn>((message, opts) => {
    clearTimeout(timer.current);
    setItem({ id: Date.now(), message, detail: opts?.detail, icon: opts?.icon });
    timer.current = setTimeout(() => setItem(null), 2300);
  }, []);
  const Icon = item?.icon ?? CircleCheck;
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+10px)] z-[90] flex justify-center px-4">
        <AnimatePresence>
          {item && (
            <motion.div
              key={item.id}
              role="status"
              initial={{ opacity: 0, y: -24, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.16 } }}
              transition={springBouncy}
              className="pointer-events-auto flex min-h-[46px] max-w-[min(440px,100%)] items-center gap-2.5 rounded-full bg-ink/95 py-2 pl-3 pr-5 text-onink shadow-pop backdrop-blur"
            >
              <Icon className="h-[22px] w-[22px] shrink-0 text-sand" strokeWidth={2.2} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-tight">{item.message}</div>
                {item.detail && <div className="truncate text-[12px] leading-tight opacity-70">{item.detail}</div>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
