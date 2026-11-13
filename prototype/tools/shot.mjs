// プロトタイプの画面を撮影する。
//   node prototype/tools/shot.mjs --dist <ビルド先> --hash "#clinic.today" --out <png>
//        [--w 390] [--h 844] [--dark] [--full] [--wait 900] [--click "<CSSセレクタ>"]... [--scroll <px>]
// 複数撮るときは --batch <json> で [{hash,out,w,h,dark,full,wait,click:[...],scroll}] を渡す（1回の起動で撮るので速い）。
import { createRequire } from "node:module";
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const require = createRequire(resolve(new URL(".", import.meta.url).pathname, "../../package.json"));
const { chromium } = require("playwright-core");

const argv = process.argv.slice(2);
const get = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const all = k => argv.flatMap((a, i) => (a === `--${k}` ? [argv[i + 1]] : []));
const has = k => argv.includes(`--${k}`);

const dist = resolve(get("dist", resolve(new URL(".", import.meta.url).pathname, "../dist")));
if (!existsSync(join(dist, "index.html"))) { console.error(`ビルドがありません: ${dist}（先に node prototype/build.mjs --out ${dist}）`); process.exit(1); }

// コマンドラインの操作は、書いた順に steps にする
const cliSteps = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i], v = argv[i + 1];
  if (a === "--click") cliSteps.push({ click: v });
  else if (a === "--hover") cliSteps.push({ hover: v });
  else if (a === "--press") cliSteps.push({ press: v });
  else if (a === "--pause") cliSteps.push({ wait: +v });
  else if (a === "--fill") { const k = v.indexOf("=>"); cliSteps.push({ fill: [v.slice(0, k), v.slice(k + 2)] }); }
}
const jobs = get("batch") ? JSON.parse(readFileSync(get("batch"), "utf8")) : [{
  hash: get("hash", "#launcher"), out: get("out", "shot.png"), w: +get("w", 390), h: +get("h", 844),
  dark: has("dark"), full: has("full"), wait: +get("wait", 900), steps: cliSteps, scroll: get("scroll") ? +get("scroll") : 0,
}];

// 自分で確認するだけなら 1 倍で十分（画像が軽い）。人に見せる画像は --scale 2
const defaultScale = +get("scale", 1);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent((req.url || "/").split("?")[0].split("#")[0]);
  const f = join(dist, p === "/" ? "index.html" : p);
  try { res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f)); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let failed = 0;
for (const j of jobs) {
  const w = j.w ?? 390, h = j.h ?? 844;
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: j.scale ?? defaultScale, colorScheme: j.dark ? "dark" : "light",
    timezoneId: "Asia/Tokyo", locale: "ja-JP", hasTouch: w < 768, isMobile: w < 768,
  });
  const page = await ctx.newPage();
  // --date YYYY-MM-DD（またはジョブの date）で、デモの「今日」を固定する
  const forced = j.date ?? get("date");
  if (forced) await page.addInitScript(d => { window.__ARCHE_NOW__ = d; }, forced);
  const errors = [];
  page.on("pageerror", e => errors.push(String(e.message || e)));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|net::ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(`http://127.0.0.1:${port}/index.html${j.hash || ""}`);
  await page.waitForTimeout(j.wait ?? 900);
  const steps = [...(j.click || []).map(c => ({ click: c })), ...(j.steps || [])];
  for (const st of steps) {
    try {
      if (st.click) await page.click(st.click, { timeout: 3000 });
      else if (st.hover) await page.hover(st.hover, { timeout: 3000 });
      else if (st.fill) await page.fill(st.fill[0], st.fill[1], { timeout: 3000 });
      else if (st.press) await page.keyboard.press(st.press);
      else if (st.mouse) await page.mouse.move(st.mouse[0], st.mouse[1]);
      else if (st.clickAt) await page.mouse.click(st.clickAt[0], st.clickAt[1]);
      if (st.wait) await page.waitForTimeout(st.wait);
      else await page.waitForTimeout(450);
    } catch (e) { errors.push(`操作に失敗: ${JSON.stringify(st)}`); }
  }
  if (j.scroll) {
    await page.evaluate(y => { const el = [...document.querySelectorAll("*")].find(e => e.scrollHeight > e.clientHeight + 40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)); (el || document.scrollingElement).scrollTop = y; }, j.scroll);
    await page.waitForTimeout(400);
  }
  if (j.full) {
    // 一番長いスクロール領域の高さまで画面を伸ばして全体を撮る
    const full = await page.evaluate(() => Math.max(...[...document.querySelectorAll("*")].filter(e => /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map(e => e.scrollHeight), document.documentElement.scrollHeight));
    await page.setViewportSize({ width: w, height: Math.min(Math.max(h, full + 40), 6000) });
    await page.waitForTimeout(500);
  }
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: j.out });
  console.log(`${j.out}  ${w}x${h}${j.dark ? " dark" : ""}${overflowX > 0 ? `  ⚠ 横はみ出し ${overflowX}px` : ""}${errors.length ? `  ⚠ エラー: ${errors.join(" | ")}` : ""}`);
  if (errors.length) failed++;
  await ctx.close();
}
await browser.close();
server.close();
process.exit(failed ? 2 : 0);
