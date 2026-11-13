import { createContext, useContext, useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { BackButton, cn } from "@/ui";
import { useIsPhone, useMinWidth } from "@/lib/media";

// 患者さん向け画面の土台。共有の Page と同じナビゲーションバーの動き（大見出し → スクロールで
// すりガラスのバーに小見出し）で、PCでは幅560pxの列を中央に置き、広い画面では右に補助の列を出す。

interface Layout {
  phone: boolean;
  /** 右の補助の列を出しているか（幅1024px以上で side を渡したとき） */
  split: boolean;
}
const LayoutCtx = createContext<Layout>({ phone: true, split: false });
export const usePatientLayout = () => useContext(LayoutCtx);

const COLS = "grid grid-cols-[minmax(0,1fr)_300px] gap-10 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-14";

export interface PatientPageProps {
  title: string;
  /** バーに出す小見出し（省略時は title） */
  barTitle?: string;
  subtitle?: ReactNode;
  back?: { label?: string; onClick: () => void };
  /** 戻るボタンがないときのバー左（医院のマークなど） */
  leading?: ReactNode;
  /** バー右側 */
  actions?: ReactNode;
  /** 大見出しの右（アカウントのボタンなど） */
  titleAccessory?: ReactNode;
  /** 大見出しの上（完了の印など） */
  eyebrow?: ReactNode;
  /** 広い画面で右の列に出す内容 */
  side?: ReactNode;
  /** 下に固定する操作（ActionBar） */
  footer?: ReactNode;
  children: ReactNode;
}

export function PatientPage({ title, barTitle, subtitle, back, leading, actions, titleAccessory, eyebrow, side, footer, children }: PatientPageProps) {
  const phone = useIsPhone();
  const wide = useMinWidth(1024);
  const split = wide && !!side;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: ref });
  const threshold = phone ? 44 : 40;
  const compactOpacity = useTransform(scrollY, [threshold - 14, threshold + 4], [0, 1]);
  const barOpacity = useTransform(scrollY, [0, 10], [0, 1]);
  const frame = phone ? "px-4" : cn("mx-auto w-full px-8", split ? "max-w-[1020px]" : "max-w-[624px]");
  const bar = (
    <>
      <div className="flex min-w-0 flex-1 items-center">{back ? <BackButton {...back} /> : leading}</div>
      <motion.div
        style={{ opacity: compactOpacity }}
        className="pointer-events-none absolute inset-x-0 mx-auto w-fit max-w-[58%] truncate text-center text-[17px] font-semibold palt"
      >
        {barTitle ?? title}
      </motion.div>
    </>
  );

  return (
    <LayoutCtx.Provider value={{ phone, split }}>
      <div
        ref={ref}
        lang="ja"
        className="relative h-full overflow-y-auto overflow-x-hidden overscroll-contain bg-bg break-words [text-wrap:pretty] [word-break:auto-phrase]"
      >
        <div className="flex min-h-full flex-col">
          <header className="sticky top-0 z-30">
            <motion.div aria-hidden style={{ opacity: barOpacity }} className="material hairline-b absolute inset-0" />
            <div className={frame}>
              {split ? (
                // 広い画面：戻る・小見出しは左の列、右側の操作は右の列の右端にそろえる
                <div className={COLS}>
                  <div className="relative flex h-[52px] items-center gap-2">{bar}</div>
                  <div className="flex h-[52px] items-center justify-end gap-1.5">{actions}</div>
                </div>
              ) : (
                <div className={cn("relative flex items-center gap-2", phone ? "-mx-2 h-11" : "h-[52px]")}>
                  {bar}
                  <div className="relative flex flex-1 items-center justify-end gap-1.5">{actions}</div>
                </div>
              )}
            </div>
          </header>

          <div className={cn(frame, "flex flex-1", split && cn(COLS, "items-start"))}>
            <main className="flex min-w-0 flex-1 flex-col">
              <div className={cn("flex items-start justify-between gap-4", phone ? "pb-5 pt-1" : "pb-8 pt-2")}>
                <div className="min-w-0">
                  {eyebrow}
                  <h1 className={cn("palt text-balance", phone ? "text-large" : "text-[30px] font-bold leading-[36px] tracking-[-0.01em]")}>{title}</h1>
                  {subtitle && <div className="mt-1.5 text-subhead leading-[1.6] text-label2">{subtitle}</div>}
                </div>
                {titleAccessory}
              </div>
              <div className={cn("flex-1", !footer && (phone ? "pb-[calc(32px+env(safe-area-inset-bottom))]" : "pb-16"))}>{children}</div>
              {footer}
            </main>
            {split && <aside className="sticky top-[52px] min-w-0 pb-16 pt-[9px]">{side}</aside>}
          </div>
        </div>
      </div>
    </LayoutCtx.Provider>
  );
}

/**
 * 画面の主な操作。スマホは下に固定したすりガラスのバー、PCは本文の最後に右寄せで置く。
 * note は操作の上（PCは左）に出す一行の補足、error は入力の不備のまとめ。
 */
export function ActionBar({ children, note, error }: { children: ReactNode; note?: ReactNode; error?: ReactNode }) {
  const { phone } = usePatientLayout();
  const line = error ? <span className="text-red">{error}</span> : note;
  if (phone) {
    return (
      <div className="material hairline-t sticky bottom-0 z-20 -mx-4 mt-8 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
        {line && <div className="mb-2.5 truncate text-center text-footnote text-label2 tnum">{line}</div>}
        {children}
      </div>
    );
  }
  return (
    <div className="hairline-t mt-10 flex min-h-[84px] items-center justify-between gap-6 pb-14 pt-5">
      <div className="min-w-0 text-subhead text-label2 tnum">{line}</div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}
