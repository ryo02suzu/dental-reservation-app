import fs from "fs";
import path from "path";

// 医院専用の読み込み画面を /book/<slug> のHTMLに差し込む。
// 素材は <publicDir>/clinic-splash/<slug>/ に置く（splash.html と フォント *.woff2）。
// JSバンドルの読み込み前の最初の描画から表示させるため、クライアントではなくHTMLに直接入れる。
// 素材のない医院は何もしない。

const BOOK_PATH = /^\/book\/([a-z0-9-]+)\/?(?:[?#]|$)/i;

type Splash = { head: string; body: string } | null;
const cache = new Map<string, Splash>();

function loadSplash(publicDir: string, slug: string): Splash {
  const dir = path.join(publicDir, "clinic-splash", slug);
  let body: string;
  try {
    body = fs.readFileSync(path.join(dir, "splash.html"), "utf-8");
  } catch {
    return null;
  }
  const fonts = fs.readdirSync(dir).filter(f => f.endsWith(".woff2"));
  const head = fonts
    .map(f => `<link rel="preload" as="font" type="font/woff2" crossorigin href="/clinic-splash/${slug}/${f}" />`)
    .join("\n    ");
  return { head, body };
}

export function injectClinicSplash(html: string, url: string, publicDir: string, useCache = true): string {
  const m = BOOK_PATH.exec(url);
  if (!m) return html;
  const slug = m[1].toLowerCase();

  let splash = useCache ? cache.get(slug) : undefined;
  if (splash === undefined) {
    splash = loadSplash(publicDir, slug);
    if (useCache) cache.set(slug, splash);
  }
  if (!splash) return html;

  return html
    .replace("</head>", `    ${splash.head}\n  </head>`)
    .replace(/<body([^>]*)>/, (tag) => `${tag}\n${splash!.body}`);
}
