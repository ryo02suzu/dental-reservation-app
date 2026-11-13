import { useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { cn } from "@/ui";

/**
 * 2段組みの左の列（患者の一覧）。Page と同じ作り：大見出しで始まり、スクロールすると
 * バーに小見出しが出る。検索と絞り込みはバーの下に留まる（iOSの「検索欄を常に表示」）。
 */
export function ColumnPage({ title, actions, pinned, width, children, scrollRef }: {
  title: string;
  actions?: ReactNode;
  /** バーの下に留める領域（検索・絞り込み） */
  pinned: ReactNode;
  width: number;
  /** 区切りの見出しを止める位置を受け取って中身を描く */
  children: (stickyTop: number) => ReactNode;
  scrollRef?: MutableRefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [titleH, setTitleH] = useState(48);
  const [pinH, setPinH] = useState(84);
  useLayoutEffect(() => {
    if (titleRef.current) setTitleH(titleRef.current.offsetHeight);
    const el = pinRef.current;
    if (!el) return;
    setPinH(el.offsetHeight);
    const ro = new ResizeObserver(() => setPinH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const { scrollY } = useScroll({ container: ref });
  const barBg = useTransform(scrollY, [0, 10], [0, 1]);
  const compact = useTransform(scrollY, [titleH - 14, titleH + 4], [0, 1]);
  const pinBg = useTransform(scrollY, [titleH - 4, titleH + 2], [0, 1]);

  return (
    <div className="hairline-r relative h-full shrink-0" style={{ width }}>
      <div
        ref={el => {
          ref.current = el;
          if (scrollRef) scrollRef.current = el;
        }}
        className="h-full overflow-y-auto overscroll-contain"
      >
        <header className="sticky top-0 z-30 h-[52px]">
          <motion.div aria-hidden style={{ opacity: barBg }} className="material absolute inset-0" />
          <div className="relative flex h-full items-center px-4">
            <motion.div
              style={{ opacity: compact }}
              className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[50%] truncate text-center text-[17px] font-semibold palt"
            >
              {title}
            </motion.div>
            <div className="relative ml-auto flex items-center gap-1.5">{actions}</div>
          </div>
        </header>
        <div ref={titleRef} className="px-4 pb-3 pt-1">
          <h1 className="palt text-[30px] font-bold leading-[36px] tracking-[-0.01em]">{title}</h1>
        </div>
        <div ref={pinRef} className="sticky top-[52px] z-20">
          <motion.div aria-hidden style={{ opacity: pinBg }} className={cn("material hairline-b absolute inset-0")} />
          <div className="relative px-4 pb-3">{pinned}</div>
        </div>
        <div className="px-4 pb-10 pt-1">{children(52 + pinH)}</div>
      </div>
    </div>
  );
}
