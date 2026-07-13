import { useEffect, useState, type CSSProperties } from "react";

// 患者予約ページ用の医院ブランドスプラッシュ。
// 専用画像が登録されている医院はその画像を段階演出付きで全画面表示し、
// ない医院はテーマカラーから自動生成したデザインで表示する。
// 1ブラウザセッションにつき医院ごとに1回だけ表示。
const DURATION_MS = 2500;
const FADE_MS = 450;

// 専用スプラッシュの構成（画像を横帯に分解し、時間差でふわっと組み上げる）。
// 素材は client/public/clinic-splash/<slug>/ に配置。
// y0/y1 は元画像のピクセル座標、delay は表示開始秒。
// deco は画像から切り出した装飾レイヤー（元画像ピクセルの矩形指定）で、
// 星の瞬きなどベクター重ね描きだと二重に見える演出を画像そのもので行う。
type SplashScene = {
  dir: string;
  w: number; h: number;                 // 元画像サイズ
  bg: string;                           // 読み込み中の下地色
  bands: Array<{ file: string; y0: number; y1: number; delay: number; motion: "fade" | "rise" }>;
  loader: { cx: number; cy: number; size: number; color: string; gold: string; delay: number }; // %座標
  deco: Array<{ file: string; x: number; y: number; w: number; h: number; delay: number; anim: "twinkle" }>;
};

const SPLASH_SCENES: Record<string, SplashScene> = {
  "imaizumi-dental": {
    dir: "/clinic-splash/imaizumi-dental",
    w: 853, h: 1844,
    bg: "#eef3f9",
    bands: [
      { file: "top", y0: 0, y1: 500, delay: 0.1, motion: "fade" },
      { file: "mid", y0: 1005, y1: 1090, delay: 0.1, motion: "fade" },
      { file: "bottom", y0: 1330, y1: 1844, delay: 0.1, motion: "fade" },
      { file: "logo", y0: 500, y1: 800, delay: 0.4, motion: "rise" },
      { file: "name", y0: 800, y1: 915, delay: 0.8, motion: "rise" },
      { file: "english", y0: 915, y1: 1005, delay: 1.05, motion: "fade" },
      { file: "text", y0: 1220, y1: 1330, delay: 1.35, motion: "rise" },
    ],
    loader: { cx: 50.4, cy: 62.55, size: 12.8, color: "#6b98c8", gold: "#c9a35c", delay: 1.25 },
    // ロゴ右上の金の星（logo.webpからは除去済み。この1枚だけが本物の星）
    deco: [
      { file: "star", x: 536, y: 570, w: 48, h: 54, delay: 0.55, anim: "twinkle" },
    ],
  },
};

// index.htmlが先出ししたプレスプラッシュ（ぼかし下地）を回収する
function removePreSplash() {
  try { document.getElementById("clinic-pre-splash")?.remove(); } catch { /* noop */ }
}
const GOLD = "#c2a36b";
const GOLD_DEEP = "#b0904f";

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

// スラッグから英字表記を作る（imaizumi-dental → "IMAIZUMI DENTAL OFFICE"）。
// 汎用語や短すぎるトークンしか残らない場合は "DENTAL OFFICE" のみ。
const GENERIC_TOKENS = new Set(["dental", "dentist", "clinic", "office", "shika", "dc", "demo", "default", "test"]);
function englishLine(slug?: string): string {
  const base = (slug || "")
    .toLowerCase()
    .split(/[-_]/)
    .filter(t => /^[a-z]{3,}$/.test(t) && !GENERIC_TOKENS.has(t));
  if (base.length === 0) return "DENTAL OFFICE";
  return `${base.join(" ").toUpperCase()} DENTAL OFFICE`;
}

// 4条の光（スパークル）
function Sparkle({ size = 14, color = GOLD, className = "", style }: {
  size?: number; color?: string; className?: string; style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path
        d="M12 0 C12.4 7.2 13.8 9.6 21 10.5 C13.8 11.4 12.4 13.8 12 21 C11.6 13.8 10.2 11.4 3 10.5 C10.2 9.6 11.6 7.2 12 0 Z"
        fill={color}
      />
    </svg>
  );
}

// 淡く流れる波の装飾（上下端）。半透明レイヤー＋細い金線。
function Waves({ tint, flip }: { tint: string; flip?: boolean }) {
  return (
    <svg
      className="absolute left-0 w-full"
      style={{
        height: "24%",
        ...(flip ? { bottom: -1, transform: "scaleY(-1) scaleX(-1)" } : { top: -1 }),
      }}
      viewBox="0 0 430 220"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M0,110 C70,60 150,150 240,95 C320,45 380,110 430,70 L430,0 L0,0 Z" fill={tint} opacity={0.5} />
      <path d="M0,150 C90,90 170,185 260,125 C340,75 390,140 430,105 L430,0 L0,0 Z" fill={tint} opacity={0.3} />
      <path d="M0,185 C100,120 180,215 275,155 C350,105 395,165 430,140 L430,0 L0,0 Z" fill={tint} opacity={0.18} />
      <path
        d="M0,132 C85,75 165,168 255,110 C335,60 385,125 430,88"
        fill="none" stroke={GOLD} strokeWidth={1} opacity={0.6}
      />
    </svg>
  );
}

// 光の粒（ぼかした白い円）を静的な配置で散らす
const BOKEH: Array<[number, number, number, number]> = [
  // [left%, top%, size(px), opacity]
  [12, 9, 10, 0.8], [78, 6, 7, 0.6], [88, 14, 12, 0.5], [22, 17, 6, 0.7],
  [8, 30, 8, 0.4], [92, 36, 9, 0.45], [15, 62, 7, 0.35], [85, 58, 8, 0.4],
  [10, 82, 11, 0.6], [70, 88, 8, 0.55], [30, 92, 9, 0.5], [90, 80, 6, 0.6],
];

// 歯のアウトライン＋金のモノグラム＋金のスワッシュ
function ToothLogo({ stroke, initial }: { stroke: string; initial: string }) {
  return (
    <div className="csplash-mark relative" style={{ width: 168, height: 168 }}>
      <svg viewBox="0 0 168 168" className="h-full w-full" aria-hidden="true">
        {/* 歯のアウトライン（細線・毛筆調の一筆書きイメージ） */}
        <path
          d="M44,46 C38,26 56,14 76,22 C79,23 81,25 84,28 C87,25 89,23 92,22 C112,14 130,26 124,46 C130,62 126,82 118,102 C113,118 106,131 100,139 C97,144 92,144 91,138 C88,125 86,111 84,101 C82,111 80,125 77,138 C76,144 71,144 68,139 C62,131 55,118 50,102 C42,82 38,62 44,46 Z"
          fill="none" stroke={stroke} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"
        />
        {/* 金のスワッシュ（歯の下をくぐって右上へ抜ける曲線） */}
        <path
          d="M30,128 C56,150 118,148 132,110 C140,86 132,62 118,52"
          fill="none" stroke={GOLD} strokeWidth={2.2} strokeLinecap="round" opacity={0.9}
        />
        {/* モノグラム（金・セリフ体） */}
        <text
          x="84" y="86"
          textAnchor="middle" dominantBaseline="middle"
          fill={GOLD_DEEP}
          style={{ fontFamily: "Georgia, 'Times New Roman', 'Noto Serif JP', serif", fontSize: 52, fontWeight: 500 }}
        >
          {initial}
        </text>
      </svg>
      <Sparkle size={20} className="csplash-sparkle absolute" style={{ top: 18, right: 10 }} />
      <Sparkle size={10} color={stroke} className="csplash-sparkle absolute" style={{ top: 44, right: 2, animationDelay: "0.8s", opacity: 0.7 }} />
    </div>
  );
}

// ドット型ローディングリング（医院色＋1粒だけ金）
function DotRing({ color }: { color: string }) {
  const dots = Array.from({ length: 8 });
  return (
    <div className="relative h-12 w-12">
      {dots.map((_, i) => {
        const angle = (360 / dots.length) * i;
        const isGold = i === 2;
        return (
          <span
            key={i}
            className="csplash-dot absolute left-1/2 top-1/2 rounded-full"
            style={{
              width: 7, height: 7,
              backgroundColor: isGold ? GOLD : color,
              transform: `rotate(${angle}deg) translate(0, -19px)`,
              transformOrigin: "0 0",
              marginLeft: -3.5, marginTop: -3.5,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        );
      })}
    </div>
  );
}

export function ClinicSplash({ name, bgColor, slug, storageKey }: {
  name: string;
  bgColor?: string;     // 医院のテーマ色（未取得の間は空でよい。専用シーンの医院は不要）
  slug?: string;        // 専用シーンの選択・英字表記の生成に使用
  storageKey: string;   // 医院ごとのセッションキー
}) {
  const scene = slug ? SPLASH_SCENES[slug] : undefined;
  // 専用シーンはAPI応答を待たず即表示できる。自動生成版は色が届いてから。
  const ready = !!scene || !!bgColor;

  const [phase, setPhase] = useState<"wait" | "show" | "leaving" | "gone">(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "gone";
      if (sessionStorage.getItem(storageKey)) return "gone";
      sessionStorage.setItem(storageKey, "1");
      return ready ? "show" : "wait";
    } catch {
      return "gone";
    }
  });

  // 色の到着待ちだった場合、届き次第開始
  useEffect(() => {
    if (phase === "wait" && ready) setPhase("show");
  }, [phase, ready]);

  // index.htmlのプレスプラッシュを回収（本体が画面を覆ってから/不要なら即）
  useEffect(() => {
    if (phase === "show") {
      const t = setTimeout(removePreSplash, 600);
      return () => clearTimeout(t);
    }
    if (phase === "gone") removePreSplash();
  }, [phase]);

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

  if (phase === "gone" || phase === "wait") return null;

  // 専用シーンがある医院は画像レイヤーの段階演出で表示
  if (scene) {
    const ratio = scene.w / scene.h;
    return (
      <div
        className={`fixed inset-0 z-[200] overflow-hidden ${phase === "leaving" ? "splash-leave" : ""}`}
        style={{ backgroundColor: scene.bg }}
        aria-hidden="true"
        data-testid="clinic-splash"
      >
        {/* 画像と同じ縦横比のキャンバスを基本cover・上限付き（中央コンテンツが
            切れない範囲まで拡大）で配置し、全レイヤーを%座標で正確に重ねる。
            横長画面では上限に当たり左右レターボックスになる */}
        <div
          className="absolute left-1/2 top-1/2"
          style={{
            width: `min(max(100vw, calc(100dvh * ${ratio})), calc(200dvh * ${ratio}))`,
            aspectRatio: `${scene.w} / ${scene.h}`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {/* 下地：全体を強くぼかしたプレート（波や光がにじんだ状態から始まる） */}
          <img
            src={`${scene.dir}/plate.webp`}
            alt="" draggable={false}
            className="csplash-fade absolute inset-0 h-full w-full select-none"
          />
          {/* 帯レイヤー：背景→ロゴ→医院名→英字→案内文の順にふわっと */}
          {scene.bands.map(b => (
            <img
              key={b.file}
              src={`${scene.dir}/${b.file}.webp`}
              alt="" draggable={false}
              className={`absolute left-0 w-full select-none ${b.motion === "rise" ? "csplash-piece" : "csplash-fade"}`}
              style={{
                top: `${(b.y0 / scene.h) * 100}%`,
                height: `${((b.y1 - b.y0) / scene.h) * 100}%`,
                animationDelay: `${b.delay}s`,
              }}
            />
          ))}
          {/* 本物のローディングリング（画像内の静止ドットの位置で回転） */}
          <svg
            viewBox="0 0 100 100"
            className="csplash-fade absolute"
            style={{
              left: `${scene.loader.cx}%`,
              top: `${scene.loader.cy}%`,
              width: `${scene.loader.size}%`,
              transform: "translate(-50%, -50%)",
              animationDelay: `${scene.loader.delay}s`,
            }}
          >
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (Math.PI * 2 * i) / 8;
              return (
                <circle
                  key={i}
                  cx={50 + 40 * Math.sin(a)}
                  cy={50 - 40 * Math.cos(a)}
                  r={7.5}
                  fill={i === 2 ? scene.loader.gold : scene.loader.color}
                  className="csplash-dot"
                  style={{ animationDelay: `${scene.loader.delay + i * 0.15}s` }}
                />
              );
            })}
          </svg>
          {/* 装飾レイヤー（画像から切り出した本物の星など）。
              位置決めはラッパー、瞬きは中身に分離してtransform競合を避ける */}
          {scene.deco.map(d => (
            <div
              key={d.file}
              className="absolute"
              style={{
                left: `${(d.x / scene.w) * 100}%`,
                top: `${(d.y / scene.h) * 100}%`,
                width: `${(d.w / scene.w) * 100}%`,
                height: `${(d.h / scene.h) * 100}%`,
              }}
            >
              <img
                src={`${scene.dir}/${d.file}.webp`}
                alt="" draggable={false}
                className="csplash-deco h-full w-full select-none"
                style={{ animationDelay: `${d.delay}s, ${d.delay + 0.9}s` }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hsl = hexToHsl(bgColor || "");
  const h = hsl ? hsl[0] : 204;
  const s = hsl ? Math.min(Math.max(hsl[1], 30), 55) : 45;
  // 医院名・本文用（落ち着いた中間色）
  const accent = `hsl(${h}, ${s}%, 52%)`;
  // 歯のアウトライン用（すこし明るめ）
  const stroke = `hsl(${h}, ${s}%, 60%)`;
  // 波・背景の淡いトーン
  const waveTint = `hsl(${h}, ${Math.min(s + 10, 60)}%, 86%)`;
  const bgTop = `hsl(${h}, 50%, 97%)`;
  const bgMid = "#fdfeff";
  const bgBottom = `hsl(${h}, 45%, 95%)`;

  const en = englishLine(slug);
  const initial = (en !== "DENTAL OFFICE" ? en.charAt(0) : (name || "D").trim().charAt(0)) || "D";

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden ${phase === "leaving" ? "splash-leave" : ""}`}
      style={{ background: `linear-gradient(180deg, ${bgTop} 0%, ${bgMid} 45%, ${bgBottom} 100%)` }}
      aria-hidden="true"
      data-testid="clinic-splash"
    >
      <Waves tint={waveTint} />
      <Waves tint={waveTint} flip />

      {/* 光の粒 */}
      {BOKEH.map(([l, t, size, o], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ left: `${l}%`, top: `${t}%`, width: size, height: size, opacity: o, filter: "blur(1.5px)" }}
        />
      ))}
      <Sparkle size={12} className="csplash-sparkle absolute" style={{ left: "18%", top: "26%", opacity: 0.7 }} />
      <Sparkle size={9} className="csplash-sparkle absolute" style={{ right: "14%", bottom: "24%", opacity: 0.6, animationDelay: "1.1s" }} />

      <div className="relative flex flex-col items-center px-8 -mt-6">
        <ToothLogo stroke={stroke} initial={initial} />

        {/* 医院名（明朝体・広めの字間） */}
        <h1
          className="csplash-rise mt-6 text-center leading-tight select-none"
          style={{
            color: accent,
            fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif",
            fontSize: "1.9rem",
            fontWeight: 500,
            letterSpacing: "0.28em",
            marginRight: "-0.28em",
            animationDelay: "0.2s",
          }}
        >
          {name}
        </h1>

        {/* 英字表記（金） */}
        <p
          className="csplash-rise mt-3 text-center select-none"
          style={{
            color: GOLD_DEEP,
            fontSize: "0.72rem",
            letterSpacing: "0.32em",
            marginRight: "-0.32em",
            animationDelay: "0.35s",
          }}
        >
          {en}
        </p>

        {/* 金の区切り線＋中央スパークル */}
        <div className="csplash-rise mt-4 flex items-center gap-3" style={{ animationDelay: "0.45s" }}>
          <span className="h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
          <Sparkle size={12} />
          <span className="h-px w-24" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
        </div>

        {/* ローディング */}
        <div className="csplash-rise mt-14" style={{ animationDelay: "0.55s" }}>
          <DotRing color={stroke} />
        </div>

        <p
          className="csplash-rise mt-6 text-center select-none"
          style={{ color: accent, fontSize: "0.95rem", letterSpacing: "0.12em", animationDelay: "0.65s" }}
        >
          予約ページを準備しています
        </p>
        <p
          className="csplash-rise mt-2 text-center select-none"
          style={{ color: "#9aa3ad", fontSize: "0.8rem", letterSpacing: "0.12em", animationDelay: "0.75s" }}
        >
          しばらくお待ちください
        </p>
      </div>
    </div>
  );
}
