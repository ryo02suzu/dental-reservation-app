import fs from "fs";
import path from "path";

// 医院専用の読み込み画面を /book/<slug> のHTMLに差し込む。
// 素材は <publicDir>/clinic-splash/<slug>/splash.html（フォントは埋め込み済み）。
// JSバンドルの読み込み前の最初の描画から表示させるため、クライアントではなくHTMLに直接入れる。
// 素材のない医院は何もしない。

const BOOK_PATH = /^\/book\/([a-z0-9-]+)\/?(?:[?#]|$)/i;

const cache = new Map<string, string | null>();

function loadSplash(publicDir: string, slug: string): string | null {
  try {
    return fs.readFileSync(path.join(publicDir, "clinic-splash", slug, "splash.html"), "utf-8");
  } catch {
    return null;
  }
}

// 読み込み画面が全面を覆っている間は、外部スタイルシートの到着を待たずに最初の描画を出す。
// （待つと医院サイトの画面が止まったまま見えたり、白い画面が挟まったりする）
// media="print" で読み込み、splash.html 冒頭のスクリプトが media="all" に戻す（CSPでインラインの
// onload属性は使えないため）。booking.tsx はスタイル適用を確かめてから読み込み画面を外す。
function makeStylesheetsNonBlocking(html: string): string {
  return html.replace(/<link\b[^>]*\brel="stylesheet"[^>]*>/g, (tag) =>
    tag.replace('rel="stylesheet"', 'rel="stylesheet" media="print" data-splash-css'),
  );
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

  return makeStylesheetsNonBlocking(html).replace(/<body([^>]*)>/, (tag) => `${tag}\n${splash}`);
}
