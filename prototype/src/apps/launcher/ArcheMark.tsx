import { motion } from "framer-motion";

/**
 * Arche のロゴマーク。名前の由来の「アーチ」を一本線で描く（色はトークン：砂色の地に濃い線）。
 * draw を付けると、アーチを一筆で描く動きで現れる（入口の最初の一度だけに使う）。
 */
export function ArcheMark({ size = 32, className, draw }: { size?: number; className?: string; draw?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="Arche" role="img">
      <rect width="64" height="64" rx="15" fill="rgb(var(--sand))" />
      <motion.path
        d="M19 46V31c0-7.2 5.8-13 13-13s13 5.8 13 13v15"
        fill="none"
        stroke="rgb(var(--on-sand))"
        strokeWidth="6"
        strokeLinecap="round"
        initial={draw ? { pathLength: 0 } : false}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1], delay: 0.15 }}
      />
    </svg>
  );
}
