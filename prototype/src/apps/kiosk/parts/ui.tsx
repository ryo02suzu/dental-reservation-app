// 受付端末の部品。ご高齢の方でも押しやすいよう、押せる面はすべて64px以上にしている。
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Delete } from "lucide-react";
import { cn, spring, springBouncy, tap } from "@/ui";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "secondary" | "plain";
const VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-onink disabled:bg-fill/18 disabled:text-label3",
  secondary: "bg-fill/12 text-label",
  plain: "text-accent",
};

/** 大きなボタン（高さ 72〜88px） */
export function KButton({ children, onClick, variant = "primary", icon: Icon, className, disabled, size = "lg" }: {
  children: ReactNode; onClick?: () => void; variant?: Variant; icon?: LucideIcon; className?: string; disabled?: boolean; size?: "md" | "lg";
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : tap}
      transition={{ type: "spring", stiffness: 700, damping: 30 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex select-none items-center justify-center gap-3 whitespace-nowrap font-semibold transition-[background-color,opacity] duration-200",
        size === "lg" ? "h-[76px] rounded-[20px] px-8 text-[22px] md:h-[84px] md:text-[24px]" : "h-16 rounded-[18px] px-6 text-[19px] md:text-[20px]",
        VARIANT[variant],
        variant !== "primary" && "disabled:opacity-35",
        className,
      )}
    >
      {Icon && <Icon className={size === "lg" ? "h-7 w-7" : "h-6 w-6"} strokeWidth={2.2} />}
      {children}
    </motion.button>
  );
}

/** 数字の入力欄（1けたずつの枠）。入力中の枠が分かるよう、次の枠を濃くする */
export function DigitBoxes({ value, length, shakeKey, error }: { value: string; length: number; shakeKey: number; error?: boolean }) {
  return (
    <motion.div
      key={shakeKey}
      initial={shakeKey ? { x: 0 } : false}
      animate={shakeKey ? { x: [0, -12, 12, -8, 8, -3, 0] } : { x: 0 }}
      transition={{ duration: 0.44 }}
      className="flex gap-2 md:gap-3"
      aria-live="polite"
      aria-label={`入力した番号 ${value.split("").join(" ") || "なし"}`}
    >
      {Array.from({ length }, (_, i) => {
        const ch = value[i];
        const active = i === value.length;
        return (
          <div
            key={i}
            className={cn(
              "relative flex h-[68px] min-w-0 flex-1 items-center justify-center rounded-[16px] bg-surface text-[34px] font-semibold tnum transition-shadow duration-200 md:h-[84px] md:max-w-[72px] md:text-[42px]",
              active && !error && "shadow-[inset_0_0_0_2px_rgb(var(--accent))]",
              error && "shadow-[inset_0_0_0_2px_rgb(var(--red)/0.6)]",
            )}
          >
            {ch ? (
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
                {ch}
              </motion.span>
            ) : (
              <span className="h-[3px] w-5 rounded-full bg-label4" />
            )}
          </div>
        );
      })}
    </motion.div>
  );
}

/** 数字のキー（0〜9・削除） */
export function KeyPad({ onDigit, onDelete, canDelete }: { onDigit: (d: string) => void; onDelete: () => void; canDelete: boolean }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const key = "flex h-[64px] items-center justify-center rounded-[18px] transition-colors duration-150 select-none md:h-[80px]";
  const num = "bg-surface text-[32px] font-medium tnum active:bg-fill/16 md:text-[36px]";
  return (
    <div className="grid grid-cols-3 gap-2.5 md:gap-3" role="group" aria-label="数字のキー">
      {keys.map(k => (
        <motion.button key={k} type="button" whileTap={{ scale: 0.94 }} transition={spring} onClick={() => onDigit(k)} className={cn(key, num)}>
          {k}
        </motion.button>
      ))}
      <span aria-hidden />
      <motion.button type="button" whileTap={{ scale: 0.94 }} transition={spring} onClick={() => onDigit("0")} className={cn(key, num)}>
        0
      </motion.button>
      <motion.button
        type="button"
        whileTap={canDelete ? { scale: 0.94 } : undefined}
        transition={spring}
        onClick={onDelete}
        disabled={!canDelete}
        aria-label="1文字削除"
        className={cn(key, "gap-2 bg-fill/12 text-[19px] font-semibold text-label md:text-[20px] disabled:opacity-35")}
      >
        <Delete className="h-6 w-6" strokeWidth={2} />
        削除
      </motion.button>
    </div>
  );
}

/** 画面の見出しと説明 */
export function KTitle({ title, lead, className }: { title: ReactNode; lead?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <h1 className="text-balance text-[26px] font-bold leading-[1.35] tracking-[-0.01em] palt md:text-[36px]">{title}</h1>
      {lead && <p className="mt-3 max-w-[30em] text-[17px] leading-[1.7] text-label2 md:mt-4 md:text-[20px]">{lead}</p>}
    </div>
  );
}

/** 完了の印（Arche 共通：アクセントの円に白いチェック。Web予約の完了と同じ見た目で、大きさだけ変える） */
export function DoneMark({ size = 80, delay = 0.08, className }: { size?: number; delay?: number; className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...springBouncy, delay }}
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-accent text-onink", className)}
      style={{ width: size, height: size }}
    >
      <Check style={{ width: size / 2, height: size / 2 }} strokeWidth={3} />
    </motion.span>
  );
}
