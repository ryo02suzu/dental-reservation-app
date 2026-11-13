// プロトタイプ専用のTailwind設定。色はすべてCSS変数（src/styles.css）経由で、
// ライト/ダークは変数側で切り替わる。dark: 修飾子は使わない。
const path = require("path");
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [path.join(__dirname, "src/**/*.{ts,tsx}")],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#ffffff",
      black: "#000000",
      bg: v("bg"),
      grouped: v("grouped"),
      surface: v("surface"),
      surface2: v("surface-2"),
      elevated: v("elevated"),
      thumb: v("thumb"),
      label: v("label"),
      label2: v("label-2"),
      label3: v("label-3"),
      label4: v("label-4"),
      sep: v("separator"),
      fill: v("fill"),
      accent: v("accent"),
      sand: v("sand"),
      onsand: v("on-sand"),
      ink: v("ink"),
      onink: v("on-ink"),
      red: v("red"),
      material: v("material"),
      switch: v("switch"),
      // 設定アイコンのタイルやグラフの系列に使う、彩度を抑えた補助色（両テーマ共通）
      tile: {
        sand: "#A88F6E",
        graphite: "#5A5A5E",
        slate: "#5C6B7C",
        sage: "#6E8B76",
        clay: "#B4705E",
        plum: "#7B6A8C",
        ocean: "#4F7C8A",
        amber: "#B8894A",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      fontSize: {
        // iOSのテキストスタイルに合わせた名前
        large: ["34px", { lineHeight: "41px", fontWeight: "700" }],
        title1: ["28px", { lineHeight: "34px", fontWeight: "700" }],
        title2: ["22px", { lineHeight: "28px", fontWeight: "700" }],
        title3: ["20px", { lineHeight: "25px", fontWeight: "600" }],
        headline: ["17px", { lineHeight: "22px", fontWeight: "600" }],
        body: ["17px", "22px"],
        callout: ["16px", "21px"],
        subhead: ["15px", "20px"],
        footnote: ["13px", "18px"],
        caption: ["12px", "16px"],
        caption2: ["11px", "13px"],
      },
      borderRadius: {
        sheet: "14px",
        card: "16px",
        cell: "12px",
      },
      boxShadow: {
        thumb: "0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)",
        float: "0 10px 30px -12px rgba(0,0,0,0.25), 0 2px 6px -2px rgba(0,0,0,0.08)",
        pop: "0 24px 60px -20px rgba(0,0,0,0.35), 0 8px 20px -10px rgba(0,0,0,0.12)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      // iOSの塗り（fill 12% など）を表せるよう、不透明度の段階を細かくする
      opacity: {
        4: "0.04", 6: "0.06", 8: "0.08", 12: "0.12", 14: "0.14", 16: "0.16", 18: "0.18",
        22: "0.22", 24: "0.24", 28: "0.28", 32: "0.32", 36: "0.36", 45: "0.45", 55: "0.55",
        65: "0.65", 72: "0.72", 78: "0.78", 85: "0.85", 92: "0.92",
      },
    },
  },
  plugins: [],
};
