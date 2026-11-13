import type { ComponentType, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "./cn";
import type { TileTone } from "@/data";
import type { LucideIcon } from "lucide-react";

const TILE: Record<TileTone, string> = {
  sand: "bg-tile-sand",
  graphite: "bg-tile-graphite",
  slate: "bg-tile-slate",
  sage: "bg-tile-sage",
  clay: "bg-tile-clay",
  plum: "bg-tile-plum",
  ocean: "bg-tile-ocean",
  amber: "bg-tile-amber",
};

/** 設定アプリのような角丸の色タイル＋白アイコン */
export function IconTile({ icon: Icon, tone = "graphite", size = 29 }: { icon: LucideIcon; tone?: TileTone; size?: number }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-[7px] text-white", TILE[tone])} style={{ width: size, height: size }}>
      <Icon style={{ width: Math.round(size * 0.58), height: Math.round(size * 0.58) }} strokeWidth={size > 36 ? 1.9 : 2.1} />
    </span>
  );
}

/** グループ化されたリストのまとまり（見出し・角丸の白い面・注記） */
export function ListSection({ header, footer, children, className, aside }: {
  header?: ReactNode;
  footer?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mt-7 first:mt-2", className)}>
      {(header || aside) && (
        <div className="flex items-end justify-between gap-3 px-4 pb-1.5">
          {header && <h3 className="text-footnote font-medium text-label2">{header}</h3>}
          {aside}
        </div>
      )}
      <div className="overflow-hidden rounded-cell bg-surface">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-footnote text-label2">{footer}</p>}
    </section>
  );
}

export interface ListRowProps {
  icon?: LucideIcon;
  tone?: TileTone;
  leading?: ReactNode; // アイコンタイルの代わり（アバターなど）
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode; // 右側の灰色の値
  trailing?: ReactNode; // 右側の任意の要素（スイッチなど）
  chevron?: boolean;
  onClick?: () => void;
  destructive?: boolean;
  selected?: boolean;
  className?: string;
  /** 区切り線の左の開始位置（アイコンありなら自動で文字の位置から） */
  inset?: number;
}

/** リストの1行。押せる行は押した瞬間にうっすら灰色になる */
export function ListRow({ icon, tone, leading, title, subtitle, value, trailing, chevron, onClick, destructive, selected, className, inset }: ListRowProps) {
  const hasLead = !!(icon || leading);
  const left = inset ?? (hasLead ? 60 : 16);
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-3 pl-4 pr-4 text-left transition-colors duration-100",
        subtitle ? "min-h-[60px] py-2.5" : "min-h-[44px] py-2",
        onClick && "active:bg-fill/16 hover:bg-fill/[0.06]",
        selected && "bg-sand/20",
        className,
      )}
    >
      {icon && <IconTile icon={icon} tone={tone} />}
      {leading}
      <div className="min-w-0 flex-1">
        <div className={cn("truncate text-[16px] leading-[21px] md:text-[15px] md:leading-5", destructive ? "text-red" : "text-label")}>{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2">{subtitle}</div>}
      </div>
      {value !== undefined && <div className="shrink-0 truncate text-[15px] text-label2 md:text-[14px]">{value}</div>}
      {trailing}
      {chevron && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-label4" strokeWidth={2.4} />}
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" style={{ left }} />
    </Tag>
  );
}
