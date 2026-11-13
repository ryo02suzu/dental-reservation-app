import { useMemo } from "react";

// 診察券のQR風コード。番号から毎回同じ模様を作る（受付端末でかざす想定の見本で、実際のQRではない）。
const N = 25; // バージョン2のQRと同じ 25×25
const QUIET = 2;

function seeded(text: string) {
  let s = 0;
  for (const c of text) s = (Math.imul(s, 31) + c.charCodeAt(0)) | 0;
  s ^= 0x5bd1e995;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function modules(value: string): boolean[][] {
  const m: (boolean | null)[][] = Array.from({ length: N }, () => Array<boolean | null>(N).fill(null));
  const set = (r: number, c: number, v: boolean) => {
    if (r >= 0 && r < N && c >= 0 && c < N) m[r][c] = v;
  };
  // 3つの角の位置合わせの四角（周りは白い余白）
  for (const [r0, c0] of [[0, 0], [0, N - 7], [N - 7, 0]] as const) {
    for (let r = -1; r <= 7; r++)
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const ring = inside && (r === 0 || r === 6 || c === 0 || c === 6);
        const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        set(r0 + r, c0 + c, ring || core);
      }
  }
  // タイミングの線
  for (let i = 8; i < N - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // 右下の小さな位置合わせ
  for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) set(18 + r, 18 + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
  set(N - 8, 8, true);
  const rnd = seeded(`hidamari:${value}`);
  return m.map(row => row.map(v => (v === null ? rnd() < 0.52 : v)));
}

export function QrCode({ value, size = 140, className }: { value: string; size?: number; className?: string }) {
  const d = useMemo(() => {
    const mm = modules(value);
    let p = "";
    mm.forEach((row, y) => {
      let x = 0;
      while (x < N) {
        if (!row[x]) {
          x++;
          continue;
        }
        let len = 1;
        while (x + len < N && row[x + len]) len++;
        p += `M${x + QUIET} ${y + QUIET}h${len}v1h-${len}z`;
        x += len;
      }
    });
    return p;
  }, [value]);
  const box = N + QUIET * 2;
  return (
    <svg viewBox={`0 0 ${box} ${box}`} width={size} height={size} shapeRendering="crispEdges" role="img" aria-label={`診察券番号 ${value} のコード`} className={className}>
      <rect width={box} height={box} className="fill-white" />
      <path d={d} className="fill-black" />
    </svg>
  );
}
