// Arche UIプロトタイプのビルド。
//   node prototype/build.mjs [--out <dir>] [--dev]
// <dir>/index.html（ローカル確認用の完全なHTML）、<dir>/artifact.html（公開用の本文のみ）、
// <dir>/app.js、<dir>/app.css を出力する。
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = resolve(outIdx >= 0 ? args[outIdx + 1] : resolve(here, "dist"));
const dev = args.includes("--dev");

mkdirSync(out, { recursive: true });

await build({
  entryPoints: [resolve(here, "src/main.tsx")],
  bundle: true,
  format: "iife",
  target: ["es2020", "safari15"],
  outfile: resolve(out, "app.js"),
  minify: !dev,
  jsx: "automatic",
  tsconfig: resolve(here, "tsconfig.json"),
  define: { "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production") },
  logLevel: "warning",
  legalComments: "none",
});

execFileSync(
  resolve(root, "node_modules/.bin/tailwindcss"),
  ["-c", resolve(here, "tailwind.config.cjs"), "-i", resolve(here, "src/styles.css"), "-o", resolve(out, "app.css"), ...(dev ? [] : ["--minify"])],
  { stdio: ["ignore", "ignore", "inherit"], cwd: root, env: { ...process.env, BROWSERSLIST_IGNORE_OLD_DATA: "1" } },
);

const body = readFileSync(resolve(here, "page.html"), "utf8");
writeFileSync(resolve(out, "artifact.html"), body);
writeFileSync(
  resolve(out, "index.html"),
  `<!doctype html>\n<html lang="ja">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n</head>\n<body>\n${body}\n</body>\n</html>\n`,
);
console.log("built →", out);
