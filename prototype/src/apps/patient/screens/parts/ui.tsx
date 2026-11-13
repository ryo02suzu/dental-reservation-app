import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, CircleAlert, Copy } from "lucide-react";
import { cn, springBouncy, useToast } from "@/ui";

/**
 * 完了の印（Arche 共通：アクセントの円に白いチェック）。受付端末の完了と同じ見た目で、大きさだけ変える。
 * 出てくるときに一度だけ小さく跳ねる。
 */
export function DoneMark({ size = 56, delay = 0.18, className }: { size?: number; delay?: number; className?: string }) {
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ ...springBouncy, delay }}
      className={cn("flex items-center justify-center rounded-full bg-accent text-onink", className)}
      style={{ width: size, height: size }}
    >
      <Check style={{ width: size / 2, height: size / 2 }} strokeWidth={3} />
    </motion.span>
  );
}

/** 画面の中の見出し（カードやリストのまとまりの上） */
export function SectionHeading({ children, aside, className, id }: { children: ReactNode; aside?: ReactNode; className?: string; id?: string }) {
  return (
    <div className={cn("mb-3 mt-10 flex items-end justify-between gap-3 first:mt-0", className)}>
      <h2 id={id} className="text-title3 palt">{children}</h2>
      {aside}
    </div>
  );
}

/** クリップボードにコピー（公開先で clipboard API が使えないときは選択→コピーで代える） */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function useCopy() {
  const toast = useToast();
  return (text: string, what: string) => {
    void copyText(text).then(ok =>
      ok
        ? toast(`${what}をコピーしました`, { icon: Copy, detail: text })
        : toast("コピーできませんでした", { icon: CircleAlert, detail: "長押しして選択してください" }),
    );
  };
}

/** 行の右に置く「コピー」 */
export function CopyButton({ text, what, className }: { text: string; what: string; className?: string }) {
  const copy = useCopy();
  return (
    <button
      onClick={() => copy(text, what)}
      aria-label={`${what}をコピー`}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-fill/12 px-3 text-[13px] font-semibold text-label transition-colors hover:bg-fill/20 active:bg-fill/24",
        className,
      )}
    >
      <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
      コピー
    </button>
  );
}

/** 項目名と値の行（確認画面・カードの中）。値は折り返してよい */
export function KVRow({ label, children, className, align = "end" }: { label: ReactNode; children: ReactNode; className?: string; align?: "end" | "start" }) {
  return (
    <div className={cn("group relative flex min-h-[48px] items-start gap-4 px-4 py-[13px] md:min-h-[44px] md:py-[11px]", className)}>
      <div className="w-[6.5em] shrink-0 text-[16px] leading-[22px] text-label md:text-[15px]">{label}</div>
      <div className={cn("min-w-0 flex-1 break-words text-[16px] leading-[22px] text-label2 md:text-[15px]", align === "end" ? "text-right" : "text-left")}>{children}</div>
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </div>
  );
}

/** ひだまり歯科クリニックのマーク（地平にのぞく日だまり）。inverse は砂色の面の上に置くとき */
export function ClinicMark({ size = 32, className, inverse }: { size?: number; className?: string; inverse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={cn("shrink-0", className)} role="img" aria-label="ひだまり歯科クリニック">
      <rect width="64" height="64" rx="15" className={inverse ? "fill-white" : undefined} fill={inverse ? undefined : "rgb(var(--sand))"} />
      <path d="M17 41a15 15 0 0 1 30 0Z" className={inverse ? undefined : "fill-white"} fill={inverse ? "rgb(var(--sand))" : undefined} />
      <path d="M13 48h38" className={inverse ? undefined : "stroke-white"} stroke={inverse ? "rgb(var(--sand))" : undefined} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
