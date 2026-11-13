// サンプルデータの「今日」を表で出す（予約ID・患者IDを調べてスクリーンショットの # に使うため）。
//   node prototype/tools/today.mjs            … 今日の予約と、目立たせている患者
//   node prototype/tools/today.mjs 2026-11-20 … 指定日の予約
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const proto = resolve(here, "..");
const dir = mkdtempSync(join(tmpdir(), "arche-data-"));
const out = join(dir, "data.mjs");
await build({
  entryPoints: [resolve(proto, "src/data/index.ts")], bundle: true, format: "esm", platform: "node",
  outfile: out, tsconfig: resolve(proto, "tsconfig.json"), logLevel: "error",
});
// --date YYYY-MM-DD でデモの「今日」を固定する
const di = process.argv.indexOf("--date");
if (di >= 0) globalThis.__ARCHE_NOW__ = process.argv[di + 1];
const d = await import(pathToFileURL(out).href);
const clock = await import(pathToFileURL(out).href);
rmSync(dir, { recursive: true, force: true });

const hm = m => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
const day = process.argv.slice(2).find(a => /^\d{4}-\d{2}-\d{2}$/.test(a) && process.argv[process.argv.indexOf(a) - 1] !== "--date");
const todayKey = d.initialAppointments.find(a => a.id === "a-me-next") ? null : null;
const keyOf = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
const now = new Date();
// clock.ts の TODAY と同じ日付（データ側の予約はその日付で作られている）
const dates = [...new Set(d.initialAppointments.map(a => a.date))].sort();
const target = day ?? dates.find(k => k >= (globalThis.__ARCHE_NOW__ ?? keyOf(now))) ?? dates.at(-1);
const list = d.initialAppointments.filter(a => a.date === target).sort((a, b) => a.start - b.start || a.unitId.localeCompare(b.unitId));
console.log(`日付 ${target}（デモの現在時刻は 10:42 から進みます）  予約 ${list.length}件\n`);
console.log("予約ID     時刻          ユニット 担当   状態         経路    患者");
for (const a of list) {
  const p = d.patientById(a.patientId), s = d.serviceById(a.serviceId), st = d.staffById(a.staffId);
  console.log(`${a.id.padEnd(10)} ${(hm(a.start) + "–" + hm(a.end)).padEnd(13)} ${a.unitId.padEnd(8)} ${st.short.padEnd(5)} ${a.status.padEnd(12)} ${a.source.padEnd(7)} ${p.id} ${p.name}（${s.short}${a.firstVisit ? "・初診" : ""}）${a.note ? " メモ:" + a.note : ""}`);
}
const P = i => d.patients[i];
console.log(`\n目立たせている患者: 本人(患者アプリ) ${P(3).id} ${P(3).name} / 遅れがち ${P(8).id} ${P(8).name} / 抗凝固薬 ${P(14).id} ${P(14).name} / ラテックス ${P(21).id} ${P(21).name} / 初診 ${P(30).id} ${P(30).name}`);
console.log(`患者アプリ本人の次回予約: a-me-next（${d.initialAppointments.find(a => a.id === "a-me-next").date} 15:30）`);
