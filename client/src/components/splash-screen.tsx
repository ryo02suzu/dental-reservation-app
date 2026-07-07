import { useEffect, useState } from "react";
import { useLocation } from "wouter";

// 起動スプラッシュ（Archeブランド）。歯科医院側（管理・ログイン）でのみ表示する。
// - 1ブラウザセッションにつき1回だけ（タブ内の画面遷移では再表示しない）
// - prefers-reduced-motion の場合は表示しない
// - 患者/スタッフ向けページ（予約・マイページ等）には出さない
const SPLASH_KEY = "arche-splash-seen";
const SPLASH_DURATION_MS = 1450;
const SPLASH_FADE_MS = 450;

// 患者・スタッフ向けページ（ここではArcheスプラッシュを出さない）
const NON_ADMIN_ROUTE = /^\/(book|booking|my-appointments|review|checkin|qr-clock-in|my-schedule|privacy|terms)(\/|$)/;

function shouldShowSplash(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (sessionStorage.getItem(SPLASH_KEY)) return false;
    sessionStorage.setItem(SPLASH_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function SplashScreen() {
  const [location] = useLocation();
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">(() =>
    (!NON_ADMIN_ROUTE.test(location) && shouldShowSplash()) ? "show" : "gone",
  );

  useEffect(() => {
    if (phase !== "show") return;
    const t1 = setTimeout(() => setPhase("leaving"), SPLASH_DURATION_MS);
    return () => clearTimeout(t1);
  }, [phase]);

  useEffect(() => {
    if (phase !== "leaving") return;
    const t2 = setTimeout(() => setPhase("gone"), SPLASH_FADE_MS);
    return () => clearTimeout(t2);
  }, [phase]);

  if (phase === "gone") return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background overflow-hidden ${phase === "leaving" ? "splash-leave" : ""}`}
      aria-hidden="true"
      data-testid="splash-screen"
    >
      {/* 背景のやわらかいグラデーション */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-primary/5" />

      <div className="relative flex flex-col items-center">
        {/* ブランドマーク＋波紋リング（マーク中心から広がる） */}
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 rounded-[1.4rem] border-2 border-primary/40 splash-ring" />
          <span className="absolute inset-0 rounded-[1.4rem] border-2 border-primary/25 splash-ring splash-ring-delay" />
          <div className="splash-mark absolute inset-0 rounded-[1.4rem] bg-primary text-primary-foreground flex items-center justify-center text-4xl font-extrabold shadow-xl shadow-primary/30 select-none">
            A
          </div>
        </div>

        {/* ワードマーク */}
        <h1 className="splash-word mt-5 text-3xl font-bold tracking-[0.18em] text-foreground select-none">
          Arche
        </h1>
        <p className="splash-tagline mt-1.5 text-xs text-muted-foreground tracking-widest select-none">
          次世代予約管理システム
        </p>
      </div>
    </div>
  );
}
