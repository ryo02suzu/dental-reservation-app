import { createContext, useContext, useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useIsPhone } from "@/lib/media";
import { cn } from "./cn";

/** シェル（タブバーなど）が画面下に確保している高さ。Page の下余白に足す */
export const PageInsetContext = createContext<{ bottom: number }>({ bottom: 0 });

export interface PageProps {
  title: string;
  /** 大見出しの下の補足（日付など） */
  subtitle?: ReactNode;
  back?: { label?: string; onClick: () => void };
  /** バー右側のボタン類 */
  actions?: ReactNode;
  /** 大見出しの下に置く行（セグメント・検索など） */
  accessory?: ReactNode;
  /** 広い画面で最大幅をかけない（台帳など） */
  wide?: boolean;
  /** 左右の余白を付けない（中身が自分で余白を持つ） */
  flush?: boolean;
  /** 大見出しを出さず、バーの小見出しだけにする */
  hideLargeTitle?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * 画面の土台。iOSと同じく、大きな見出しで始まり、スクロールすると
 * すりガラスのバーに小さな見出しが現れる。パソコン幅でも同じ構造で、見出しは少し小さい。
 */
export function Page({ title, subtitle, back, actions, accessory, wide, flush, hideLargeTitle, children, className }: PageProps) {
  const phone = useIsPhone();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: ref });
  const threshold = phone ? 44 : 40;
  const compactOpacity = useTransform(scrollY, hideLargeTitle ? [0, 1] : [threshold - 14, threshold + 4], hideLargeTitle ? [1, 1] : [0, 1]);
  const barOpacity = useTransform(scrollY, [0, 10], [0, 1]);
  const { bottom } = useContext(PageInsetContext);
  const pad = flush ? "" : phone ? "px-4" : "px-8";

  return (
    <div ref={ref} className={cn("relative h-full overflow-y-auto overscroll-contain bg-bg", className)}>
      <header className="sticky top-0 z-30">
        <motion.div aria-hidden style={{ opacity: barOpacity }} className="material hairline-b absolute inset-0" />
        <div className={cn("relative flex items-center gap-2", phone ? "h-11 px-2" : "h-[52px] px-5")}>
          <div className="flex min-w-0 flex-1 items-center">{back && <BackButton {...back} />}</div>
          <motion.div
            style={{ opacity: compactOpacity }}
            className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[58%] truncate text-center text-[17px] font-semibold palt"
          >
            {title}
          </motion.div>
          <div className="relative flex flex-1 items-center justify-end gap-1.5">{actions}</div>
        </div>
      </header>
      <div className={cn(!wide && !phone && "mx-auto max-w-[1080px]", pad)}>
        {!hideLargeTitle && (
          <div className={phone ? "pb-3" : "pb-6 pt-1"}>
            <h1 className={cn("palt", phone ? "text-large" : "text-[30px] font-bold leading-[36px] tracking-[-0.01em]")}>{title}</h1>
            {subtitle && <div className="mt-1 text-subhead text-label2">{subtitle}</div>}
          </div>
        )}
        {accessory && <div className="pb-4">{accessory}</div>}
        <div style={{ paddingBottom: `calc(${bottom + (phone ? 28 : 48)}px + env(safe-area-inset-bottom, 0px))` }}>{children}</div>
      </div>
    </div>
  );
}

/** iOSの「＜ 戻る」 */
export function BackButton({ label = "戻る", onClick }: { label?: string; onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ opacity: 0.45 }}
      onClick={onClick}
      className="-ml-1 flex h-9 min-w-0 items-center pr-2 text-[17px] text-accent"
    >
      <ChevronLeft className="h-[27px] w-[27px] shrink-0" strokeWidth={2.3} />
      <span className="-ml-0.5 truncate">{label}</span>
    </motion.button>
  );
}

/** 画面内の見出し（セクションのタイトル＋右側のリンクなど） */
export function SectionTitle({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2.5 mt-8 flex items-end justify-between gap-3 first:mt-0", className)}>
      <h2 className="text-title3 palt">{children}</h2>
      {aside}
    </div>
  );
}
