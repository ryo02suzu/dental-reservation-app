import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "./cn";
import { tap } from "./motion";
import type { LucideIcon } from "lucide-react";

type Variant = "filled" | "tinted" | "gray" | "plain" | "destructive" | "destructiveTinted" | "sand";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  filled: "bg-ink text-onink hover:bg-ink/90",
  sand: "bg-sand text-onsand hover:bg-sand/90",
  tinted: "bg-sand/25 text-accent hover:bg-sand/35",
  gray: "bg-fill/12 text-label hover:bg-fill/20",
  plain: "text-accent hover:bg-fill/10",
  destructive: "bg-red text-white hover:bg-red/90",
  destructiveTinted: "bg-red/10 text-red hover:bg-red/15",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5 rounded-full",
  md: "h-10 px-4 text-[15px] gap-2 rounded-full",
  lg: "h-[50px] px-5 text-[17px] gap-2 rounded-[14px] font-semibold",
};
const ICON: Record<Size, string> = { sm: "h-4 w-4", md: "h-[18px] w-[18px]", lg: "h-5 w-5" };

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  full?: boolean;
  children?: ReactNode;
}

/** ボタン。filled=主要な操作（黒地）、tinted=控えめな強調、plain=文字だけ */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "md", icon: Icon, full, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled ? undefined : tap}
      transition={{ type: "spring", stiffness: 700, damping: 30 }}
      disabled={disabled}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-semibold transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className={ICON[size]} strokeWidth={2.1} />}
      {children}
    </motion.button>
  );
});

/** 丸いアイコンだけのボタン（ツールバーなど） */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, "children" | "icon"> & { icon: ButtonProps["icon"]; label: string; badge?: number }>(
  function IconButton({ icon: Icon, label, variant = "gray", size = "md", badge, className, ...rest }, ref) {
    const dim = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
    return (
      <motion.button
        ref={ref}
        aria-label={label}
        title={label}
        whileTap={tap}
        transition={{ type: "spring", stiffness: 700, damping: 30 }}
        className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150", dim, VARIANTS[variant], className)}
        {...rest}
      >
        {Icon && <Icon className={size === "sm" ? "h-4 w-4" : "h-[19px] w-[19px]"} strokeWidth={2} />}
        {badge ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red px-1 text-[11px] font-semibold text-white tnum ring-2 ring-bg">
            {badge}
          </span>
        ) : null}
      </motion.button>
    );
  },
);
