import { useId } from "react";

/** Arche のロゴマーク。名前の由来の「アーチ」を一本線で描く */
export function ArcheMark({ size = 32, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="Arche" role="img">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D3C6B2" />
          <stop offset="1" stopColor="#AE9A7C" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id}-g)`} />
      <path d="M19 46V31c0-7.2 5.8-13 13-13s13 5.8 13 13v15" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
