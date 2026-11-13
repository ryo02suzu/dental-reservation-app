// 運営コンソールの画面で使う小さな部品。見た目は src/ui の部品に揃えている。
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, CirclePause } from "lucide-react";
import type { ConsoleClinic, PlanKey, TileTone } from "@/data";
import { Button, Sheet, Tag, cn, springPush, toneOf } from "@/ui";
import { DORMANT_DAYS, PLAN_STYLE, daysSince, isDormant, isGrowingFree, planLabel, reasonOf } from "./model";
import type { ConsoleState } from "./store";

// ─── 医院のマーク（会社なので丸ではなく角丸の四角） ─────────────────────────
// graphite と slate はダークで背景に沈むので、灰色の塗り（トークン）にする
const MARK: Record<TileTone, string> = {
  sand: "bg-tile-sand/24 text-tile-sand",
  graphite: "bg-fill/14 text-label2",
  slate: "bg-fill/14 text-label2",
  sage: "bg-tile-sage/22 text-tile-sage",
  clay: "bg-tile-clay/22 text-tile-clay",
  plum: "bg-tile-plum/22 text-tile-plum",
  ocean: "bg-tile-ocean/22 text-tile-ocean",
  amber: "bg-tile-amber/22 text-tile-amber",
};

export function ClinicMark({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 select-none items-center justify-center font-semibold", MARK[toneOf(name)], className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.27), fontSize: Math.round(size * 0.44) }}
    >
      {name.trim().charAt(0)}
    </span>
  );
}

export function PlanTag({ plan, className }: { plan: PlanKey; className?: string }) {
  return <Tag tone={PLAN_STYLE[plan].tag} className={className}>{planLabel(plan)}</Tag>;
}

/** プランの色の印（グラフの凡例・表） */
export function Swatch({ plan, className }: { plan: PlanKey; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]", PLAN_STYLE[plan].swatch, className)} />;
}

/** 稼働中／停止中。停止中だけ形（一時停止の印）でも伝える */
export function StateText({ clinic, className }: { clinic: ConsoleClinic; className?: string }) {
  return clinic.active ? (
    <span className={cn("text-label2", className)}>稼働中</span>
  ) : (
    <span className={cn("inline-flex items-center gap-1 text-label2", className)}>
      <CirclePause className="h-3.5 w-3.5" strokeWidth={2.2} />
      停止中
    </span>
  );
}

/**
 * 要対応の理由。休眠は赤（いま連絡が必要）、予約の増加はアクセント（提案の機会）、初期設定は灰色。
 * 運営から連絡済み（確認メール・案内・提案）なら「連絡済み」などを灰色で出す
 */
export function ReasonText({ clinic, s, className, withLast = true }: { clinic: ConsoleClinic; s: ConsoleState; className?: string; withLast?: boolean }) {
  const dormant = isDormant(clinic);
  const growing = isGrowingFree(clinic);
  const done = dormant ? s.checkins[clinic.id] : growing ? s.proposals[clinic.id] : s.guides[clinic.id];
  if (done && reasonOf(clinic)) return <span className={cn("text-label3", className)}>{dormant ? "連絡済み" : growing ? "提案済み" : "案内済み"}</span>;
  // 最終利用の列があるときは、日数を繰り返さず「要連絡」だけを出す（赤は最終利用の列の1か所に）
  const r = !withLast && dormant ? "要連絡" : reasonOf(clinic);
  if (!r) return null;
  const tone = dormant ? (withLast ? "text-red" : "text-label2") : growing ? "text-accent" : "text-label3";
  return <span className={cn("tnum", tone, className)}>{r}</span>;
}

/** 最終利用。休眠の目安（7日）を過ぎたら赤（停止中は灰色） */
export function LastActive({ clinic, text, className }: { clinic: ConsoleClinic; text: string; className?: string }) {
  const stale = daysSince(clinic.lastActiveAt) >= DORMANT_DAYS;
  return <span className={cn("tnum", stale && clinic.active ? "text-red" : stale ? "text-label3" : "text-label2", className)}>{text}</span>;
}

// ─── 要素の幅 ─────────────────────────────────────────────────────────────
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** 画面の幅（PCの段組みを決める） */
export function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

// ─── iPhoneの画面の積み重ね（一覧 → 詳細を横から） ──────────────────────────
export function PushStack({ depthKey, children }: { depthKey: string | undefined; children: ReactNode }) {
  const prev = useRef(depthKey);
  const dir = depthKey && !prev.current ? 1 : !depthKey && prev.current ? -1 : 0;
  useEffect(() => {
    prev.current = depthKey;
  }, [depthKey]);
  return (
    <div className="relative h-full overflow-hidden bg-bg">
      <AnimatePresence initial={false} custom={dir}>
        <motion.div
          key={depthKey ?? "root"}
          custom={dir}
          variants={{
            enter: (k: number) => (k > 0 ? { x: "100%", boxShadow: "-12px 0 30px rgba(0,0,0,0.12)" } : k < 0 ? { x: "-28%", opacity: 0.9 } : { opacity: 0 }),
            center: { x: 0, opacity: 1, boxShadow: "0 0 0 rgba(0,0,0,0)" },
            exit: (k: number) => (k > 0 ? { x: "-28%", opacity: 0.9 } : k < 0 ? { x: "100%" } : { opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={dir === 0 ? { duration: 0.12 } : springPush}
          className="absolute inset-0 bg-bg"
          style={{ zIndex: dir >= 0 ? 2 : 1 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── シートの中のまとまり（シートは白いので、まとまりは薄い塗りで見せる） ─────────
export function SheetGroup({ header, footer, children, className }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("mt-6 first:mt-1", className)}>
      {header && <h3 className="px-4 pb-1.5 text-footnote font-medium text-label2">{header}</h3>}
      <div className="overflow-hidden rounded-cell bg-fill/8">{children}</div>
      {footer && <div className="px-4 pt-1.5 text-footnote leading-[1.6] text-label2 [text-wrap:pretty] [word-break:auto-phrase]">{footer}</div>}
    </section>
  );
}

/** まとまりの中の区切り線（左は文字の位置から） */
export function RowRule({ inset = 16 }: { inset?: number }) {
  return <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" style={{ left: inset }} />;
}

// ─── 確認のシート（お金と契約に関わる操作の前に） ─────────────────────────────
/** 何が起きるかを書いて、下の大きなボタンで確定する。destructive なら赤 */
export function ConfirmSheet({ open, onClose, title, children, confirmLabel, onConfirm, destructive }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={o => !o && onClose()}
      title={title}
      cancelLabel="キャンセル"
      footer={
        <Button full size="lg" variant={destructive ? "destructive" : "filled"} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      }
    >
      {children}
    </Sheet>
  );
}

// ─── 増減の表示（赤は「いま注意が必要なもの」だけ） ─────────────────────────────
/**
 * 小さな増減（quiet 未満）は矢印なしの灰色。それより大きい増加はアクセント、減少は灰色＋下向きの矢印。
 * alert のときだけ、悪い向きの変化を赤にする（休眠の医院が増えた、など）
 */
export function Delta({ value, label, compare, quiet, good = true, alert, className }: {
  value: number;
  label: string;
  compare?: string;
  quiet: number;
  good?: boolean;
  alert?: boolean;
  className?: string;
}) {
  const small = Math.abs(value) < quiet;
  const up = value > 0;
  const better = up === good;
  const tone = small ? "text-label2" : better ? "text-accent" : alert ? "text-red" : "text-label2";
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 whitespace-nowrap text-[12px] tnum", className)}>
      {!small && <Arrow className={cn("h-3.5 w-3.5", tone)} strokeWidth={2.6} />}
      <span className={cn("font-semibold", tone)}>{label}</span>
      {compare && <span className="ml-1 text-label3">{compare}</span>}
    </span>
  );
}
