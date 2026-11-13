/** Arche のロゴマーク。名前の由来の「アーチ」を一本線で描く（色はトークン：砂色の地に濃い線） */
export function ArcheMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="Arche" role="img">
      <rect width="64" height="64" rx="15" fill="rgb(var(--sand))" />
      <path d="M19 46V31c0-7.2 5.8-13 13-13s13 5.8 13 13v15" fill="none" stroke="rgb(var(--on-sand))" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
