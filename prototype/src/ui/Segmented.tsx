import { useId, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "./cn";
import { spring } from "./motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  count?: number;
}

/** iOSのセグメンテッドコントロール。選択中のつまみがバネで滑る */
export function Segmented<T extends string>({
  value, onChange, options, size = "md", full, className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  full?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" className={cn("relative inline-flex rounded-[9px] bg-fill/12 p-[2px]", full && "flex w-full", className)}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-0 flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-[7px] font-medium transition-colors",
              size === "sm" ? "h-[26px] px-2.5 text-[12px]" : "h-[30px] px-3.5 text-[13px]",
              active ? "text-label" : "text-label2 hover:text-label",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 -z-10 rounded-[7px] bg-thumb shadow-thumb"
                transition={spring}
              />
            )}
            {o.label}
            {o.count !== undefined && <span className="tnum text-label3">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
