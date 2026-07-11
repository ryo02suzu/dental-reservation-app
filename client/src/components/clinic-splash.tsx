import { useEffect, useState } from "react";

// 患者予約ページ用の医院ブランドスプラッシュ。
// 医院のテーマカラーから上品な淡色グラデーション背景・波飾り・金の差し色を自動生成し、
// 歯モチーフのロゴマーク＋医院名を表示する。Archeの起動アニメとは別物。
// 1ブラウザセッションにつき医院ごとに1回だけ表示。
const DURATION_MS = 1900;
const FADE_MS = 450;
const GOLD = "#bd9a63";

function hexToHsl(hex: string): [number, number, number] | null {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return null;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function WaveLayer({ color, flip }: { color: string; flip?: boolean }) {
  return (
    <svg
      className="csplash-wave absolute left-0 w-full"
      style={flip ? { bottom: -1, transform: "scaleY(-1)" } : { top: -1 }}
      viewBox="0 0 400 150"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0,55 C90,10 160,95 250,55 C320,25 360,70 400,40 L400,0 L0,0 Z"
        fill={color}
        opacity={0.35}
      />
      <path
        d="M0,80 C110,40 170,120 260,80 C330,55 370,95 400,70 L400,0 L0,0 Z"
        fill={color}
        opacity={0.18}
      />
      <path
        d="M0,68 C100,26 165,105 255,66 C325,38 365,80 400,54"
        fill="none"
        stroke={GOLD}
        strokeWidth={0.8}
        opacity={0.55}
      />
    </svg>
  );
}

function Sparkle({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 0 C12.5 7 14 9.5 21 10.5 C14 11.5 12.5 14 12 21 C11.5 14 10 11.5 3 10.5 C10 9.5 11.5 7 12 0 Z"
        fill={GOLD}
      />
    </svg>
  );
}

function ToothMark({ color, initial }: { color: string; initial: string }) {
  return (
    <div className="relative h-24 w-24 flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="csplash-mark h-full w-full">
        <path
          d="M30,22 C30,11 40,9 50,13 C60,9 70,11 70,22 C72,32 68,46 65,61 C63,73 58,81 55,86 C53,89 50,89 49,85 C47,77 46,67 45,61 C44,67 43,77 41,85 C40,89 37,89 35,86 C32,81 27,73 25,61 C22,46 28,32 30,22 Z"
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="absolute text-2xl font-semibold select-none"
        style={{ color, fontFamily: "Georgia, 'Noto Serif JP', serif", top: "34%" }}
      >
        {initial}
      </span>
      <Sparkle size={16} className="csplash-sparkle absolute -top-1 right-1" />
    </div>
  );
}

function DotRing({ color }: { color: string }) {
  const dots = Array.from({ length: 8 });
  return (
    <div className="relative h-10 w-10">
      {dots.map((_, i) => {
        const angle = (360 / dots.length) * i;
        const isGold = i === 6;
        return (
          <span
            key={i}
            className="csplash-dot absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: isGold ? GOLD : color,
              transform: `rotate(${angle}deg) translate(0, -16px)`,
              transformOrigin: "0 0",
              marginLeft: -3,
              marginTop: -3,
              animationDelay: `${i * 0.13}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function ClinicSplash({ name, bgColor, storageKey }: {
  name: string;
  bgColor: string;      // 医院のテーマ色（primaryColor推奨、HEX優先）
  storageKey: string;   // 医院ごとのセッションキー
}) {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "gone";
      if (sessionStorage.getItem(storageKey)) return "gone";
      sessionStorage.setItem(storageKey, "1");
      return "show";
    } catch {
      return "gone";
    }
  });

  useEffect(() => {
    if (phase !== "show") return;
    const t = setTimeout(() => setPhase("leaving"), DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t = setTimeout(() => setPhase("gone"), FADE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  if (phase === "gone") return null;

  const hsl = hexToHsl(bgColor);
  const accent = hsl ? `hsl(${hsl[0]}, ${Math.max(hsl[1] - 5, 35)}%, ${Math.min(hsl[2] + 5, 55)}%)` : bgColor;
  const tint1 = hsl ? `hsl(${hsl[0]}, ${Math.max(hsl[1] - 20, 25)}%, 95%)` : "#eef4f8";
  const tint2 = hsl ? `hsl(${hsl[0]}, ${Math.max(hsl[1] - 25, 20)}%, 88%)` : "#dbe8f0";
  const initial = (name || "歯").trim().charAt(0) || "歯";

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden ${phase === "leaving" ? "splash-leave" : ""}`}
      style={{ background: `radial-gradient(120% 90% at 50% 42%, #ffffff 0%, ${tint1} 55%, ${tint2} 100%)` }}
      aria-hidden="true"
      data-testid="clinic-splash"
    >
      <WaveLayer color={accent} />
      <WaveLayer color={accent} flip />

      <div className="relative flex flex-col items-center px-8">
        <ToothMark color={accent} initial={initial} />

        <h1
          className="csplash-rise mt-4 text-2xl font-bold tracking-[0.12em] text-center leading-tight select-none"
          style={{ color: accent, animationDelay: "0.15s" }}
        >
          {name}
        </h1>

        <div className="csplash-rise mt-3 flex items-center gap-3" style={{ animationDelay: "0.3s" }}>
          <span className="h-px w-9" style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
          <Sparkle size={10} />
          <span className="h-px w-9" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
        </div>

        <div className="csplash-rise mt-7" style={{ animationDelay: "0.45s" }}>
          <DotRing color={accent} />
        </div>

        <p
          className="csplash-rise mt-4 text-sm font-medium text-center select-none"
          style={{ color: accent, animationDelay: "0.55s" }}
        >
          予約ページを準備しています
        </p>
        <p className="csplash-rise mt-1 text-xs text-slate-400 text-center select-none" style={{ animationDelay: "0.65s" }}>
          しばらくお待ちください
        </p>
      </div>
    </div>
  );
}
