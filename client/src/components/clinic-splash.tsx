import { useEffect, useState } from "react";

// 患者予約ページ用の医院ブランドスプラッシュ。
// 医院ごとの色（ヘッダー色）で「歯」バッジ＋医院名を表示し、Archeとは別物にする。
// 1ブラウザセッションにつき医院ごとに1回だけ表示。
const DURATION_MS = 1450;
const FADE_MS = 450;

export function ClinicSplash({ name, bgColor, storageKey }: {
  name: string;
  bgColor: string;      // 医院のヘッダー色（濃いめ）
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

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden ${phase === "leaving" ? "splash-leave" : ""}`}
      style={{ backgroundColor: bgColor }}
      aria-hidden="true"
      data-testid="clinic-splash"
    >
      <div className="relative flex flex-col items-center px-8">
        {/* 波紋リング（医院バッジから広がる） */}
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 rounded-full border-2 border-white/40 splash-ring" />
          <span className="absolute inset-0 rounded-full border-2 border-white/25 splash-ring splash-ring-delay" />
          {/* 医院バッジ（ヘッダーの「歯」バッジと同じモチーフ） */}
          <div className="splash-mark absolute inset-0 rounded-full bg-white/20 border-2 border-white/50 flex items-center justify-center text-3xl font-bold text-white select-none shadow-lg">
            歯
          </div>
        </div>
        {/* 医院名 */}
        <h1 className="splash-word mt-5 text-xl font-bold tracking-wide text-white text-center leading-tight select-none">
          {name}
        </h1>
        <p className="splash-tagline mt-1.5 text-xs text-white/85 tracking-[0.2em] select-none">
          オンライン予約
        </p>
      </div>
    </div>
  );
}
