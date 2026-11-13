import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy } from "lucide-react";
import { cn, easeOut, useToast } from "@/ui";

/** 画面内のまとまりの見出し（見出し＋件数、右に補助リンク） */
export function Section({ title, count, aside, children, className, id }: {
  title: string;
  count?: number;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16", className)}>
      <div className="mb-2.5 flex min-h-[25px] items-end justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-title3 palt">
          {title}
          <AnimatedNumber value={count} className="text-[15px] font-medium text-label3" />
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** 角丸の白い面にまとめた行のグループ */
export function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-cell bg-surface", className)}>{children}</div>;
}

/** 数字が変わったときだけ、縦にすっと入れ替える */
export function AnimatedNumber({ value, className }: { value?: number; className?: string }) {
  if (value === undefined) return null;
  return (
    <span className={cn("relative inline-flex overflow-hidden tnum", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "60%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-60%", opacity: 0 }}
          transition={{ duration: 0.28, ease: easeOut }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * 一覧の1件を包む。追加・削除のときに高さごと出入りし、区切り線（先頭以外）を引く。
 * fresh なら、入ってきた直後に一瞬だけ砂色で知らせる。
 */
export function Item({ children, inset, fresh, sep = true }: { children: ReactNode; inset: number; fresh?: boolean; sep?: boolean }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.34, ease: easeOut }}
      className="group/item relative overflow-hidden"
    >
      {/* initial はマウント時だけ効くので、あとで fresh が false になっても途中で消えない */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-sand/25"
        initial={{ opacity: fresh ? 1 : 0 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 1.2, delay: 0.45, ease: "easeOut" }}
      />
      {sep && <span aria-hidden className="pointer-events-none absolute right-0 top-0 z-[2] h-px origin-top scale-y-50 bg-sep/30 group-first/item:hidden" style={{ left: inset }} />}
      {children}
    </motion.div>
  );
}

/**
 * 行の骨組み。行全体が「予約を開く」ボタンで、操作ボタン・電話番号のコピーはその上に重ねる（ボタンの中にボタンを入れない）。
 * 1段目：先頭（アバターや時刻）｜見出し（氏名）｜操作。2段目から：本文を右端まで使う。
 */
export function RowShell({ onOpen, label, lead, leadBelow, leadWidth = 32, title, actions, children, muted }: {
  onOpen?: () => void;
  label: string;
  lead?: ReactNode;
  /** 先頭の列の2段目（予約の終了時刻など） */
  leadBelow?: ReactNode;
  leadWidth?: number;
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  /** 終わった予約など、文字を薄くする */
  muted?: boolean;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        className="absolute inset-0 h-full w-full transition-colors duration-100 hover:bg-fill/4 focus-visible:outline-offset-[-2px] active:bg-fill/12"
      />
      <div className="pointer-events-none relative grid gap-x-3 px-4 py-3" style={{ gridTemplateColumns: `${leadWidth}px minmax(0,1fr) auto` }}>
        <div className={cn("col-start-1 row-start-1 flex items-center", actions && "min-h-8", muted && "opacity-55")}>{lead}</div>
        <div className={cn("col-start-2 row-start-1 flex min-w-0 items-center", actions && "min-h-8", muted && "opacity-55")}>{title}</div>
        {actions && <div className="pointer-events-auto col-start-3 row-start-1 flex items-center gap-1.5 self-start">{actions}</div>}
        {leadBelow && <div className={cn("col-start-1 row-start-2", muted && "opacity-55")}>{leadBelow}</div>}
        {children && <div className={cn("col-span-2 col-start-2 row-start-2 min-w-0", muted && "opacity-55")}>{children}</div>}
      </div>
    </div>
  );
}

/** 電話番号（リンクにしない）。押すとコピーしてトースト */
export function PhoneCopy({ phone, className }: { phone: string; className?: string }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      toast("電話番号をコピーしました", { detail: phone, icon: Copy });
    } catch {
      toast("コピーできませんでした", { detail: `${phone} を選択してコピーしてください`, icon: Copy });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`電話番号 ${phone} をコピー`}
      className={cn(
        "pointer-events-auto relative -mx-1 inline-flex items-center gap-1 rounded-[6px] px-1 tnum text-label2 transition-colors hover:bg-fill/8 hover:text-label active:bg-fill/16",
        "after:absolute after:-inset-y-3 after:inset-x-0 after:content-['']",
        className,
      )}
    >
      {phone}
      <Copy className="h-[13px] w-[13px] shrink-0 text-label3" strokeWidth={2.2} />
    </button>
  );
}

/** 小さめの操作ボタンのタップ領域をスマホ向けに縦44pxまで広げる */
export const hit = "relative after:absolute after:-inset-y-1.5 after:inset-x-0 after:content-['']";

/** 前の描画になかったキー（＝いま入ってきた行）。最初の描画では空 */
export function useFresh(keys: string[]): (key: string) => boolean {
  const prev = useRef<Set<string> | null>(null);
  const snapshot = prev.current;
  useEffect(() => {
    prev.current = new Set(keys);
  });
  return key => !!snapshot && !snapshot.has(key);
}
