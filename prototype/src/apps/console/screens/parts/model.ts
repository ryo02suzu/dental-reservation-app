// 運営コンソールの計算（MRR・推移・要対応・週ごとの予約数など）。描画せず、値だけを返す。
import { addDays, differenceInCalendarDays, endOfMonth, startOfDay, startOfWeek, subDays, subMonths, subWeeks } from "date-fns";
import { PLANS } from "@/data";
import type { ConsoleClinic, PlanKey } from "@/data";
import { TODAY, minutesOfDay, now } from "@/lib/clock";
import { ago, hm, md, toKatakana, yen } from "@/lib/format";
import type { ComponentProps } from "react";
import type { Tag } from "@/ui";
import { CLINIC_KANA, type ConsoleEvent, type ConsoleState } from "./store";

// ─── プラン ────────────────────────────────────────────────────────────────
/** エンタープライズは個別見積。デモでは月額 ¥98,000 として扱う */
export const ENTERPRISE_PRICE = 98000;
export const PLAN_ORDER: PlanKey[] = ["free", "standard", "pro", "enterprise", "partner"];
export const planLabel = (p: PlanKey) => PLANS[p].label;
export const planPrice = (p: PlanKey) => (p === "enterprise" ? ENTERPRISE_PRICE : PLANS[p].price ?? 0);

type TagTone = NonNullable<ComponentProps<typeof Tag>["tone"]>;

/**
 * tag: 表などに出すラベルの見た目（料金が上がるほど重く。¥0 のプランは線だけ）
 * swatch: グラフの色。有料の段階は accent の濃淡（ダークでは明るい方が上位）、パートナーは段階の外なのでグレー
 */
export const PLAN_STYLE: Record<PlanKey, { tag: TagTone; swatch: string; note: string }> = {
  free: { tag: "outline", swatch: "bg-accent/50", note: "スタッフ1名まで" },
  standard: { tag: "neutral", swatch: "bg-accent/70", note: "スタッフ10名まで" },
  pro: { tag: "sand", swatch: "bg-accent/85", note: "スタッフ数の上限なし・経営レポート" },
  enterprise: { tag: "accent", swatch: "bg-accent", note: "複数院の管理・専任サポート（個別見積）" },
  partner: { tag: "outline", swatch: "bg-fill/40", note: "開発協力医院との特別契約" },
};

/** プランごとのスタッフの上限（ない場合は undefined） */
export const STAFF_LIMIT: Partial<Record<PlanKey, number>> = { free: 1, standard: 10 };
/** 契約書の取り交わしが必要なプラン */
export const NEEDS_CONTRACT: PlanKey[] = ["enterprise", "partner"];

/** 医院の連絡先（架空のアドレス。.example はどこにも届かない） */
const DOMAIN: Record<string, string> = {
  c1: "hidamari-dental.example",
  c2: "minatomirai-dental.example",
  c3: "nakano-ekimae.example",
  c4: "aoba-kids-dental.example",
  c5: "sakura-dori.example",
  c6: "kitahama-dental.example",
  c7: "shirakaba-dental.example",
  c8: "kotori-dental.example",
};
export const emailOf = (c: ConsoleClinic) => `info@${DOMAIN[c.id] ?? "clinic.example"}`;

// ─── 金額 ──────────────────────────────────────────────────────────────────
export const addonOf = (s: ConsoleState, key: string) => s.addons.find(a => a.key === key);
export const addonsTotal = (s: ConsoleState, c: ConsoleClinic) => c.addons.reduce((t, k) => t + (addonOf(s, k)?.price ?? 0), 0);
/** 医院1件の月額（停止中は0） */
export const clinicMRR = (s: ConsoleState, c: ConsoleClinic) => (c.active ? planPrice(c.plan) + addonsTotal(s, c) : 0);
export const totalMRR = (s: ConsoleState) => s.clinics.reduce((t, c) => t + clinicMRR(s, c), 0);
export const planMRR = (s: ConsoleState) => s.clinics.reduce((t, c) => t + (c.active ? planPrice(c.plan) : 0), 0);
export const addonMRR = (s: ConsoleState) => s.clinics.reduce((t, c) => t + (c.active ? addonsTotal(s, c) : 0), 0);

/** オプション1件の導入医院と売上 */
export function addonStats(s: ConsoleState, key: string) {
  const users = s.clinics.filter(c => c.addons.includes(key));
  const price = addonOf(s, key)?.price ?? 0;
  return { users, count: users.length, revenue: users.filter(c => c.active).length * price };
}

// ─── ある時点の状態 ────────────────────────────────────────────────────────
/**
 * 指定した日時の医院とオプションの料金。今のストアから、それより後の出来事（プラン変更・オプションの追加と解約・
 * 停止と再開・料金の変更）を新しい順に戻して作る。登録日より前の医院は含めない。
 */
export function stateAt(s: ConsoleState, at: Date): { clinics: ConsoleClinic[]; prices: Record<string, number> } {
  const prices: Record<string, number> = Object.fromEntries(s.addons.map(a => [a.key, a.price]));
  const clinics = s.clinics.filter(c => c.createdAt <= at).map(c => ({ ...c, addons: [...c.addons] }));
  const later = s.events.filter(e => e.at > at).sort((a, b) => b.at.getTime() - a.at.getTime());
  for (const e of later) revert(e, clinics, prices);
  return { clinics, prices };
}
function revert(e: ConsoleEvent, clinics: ConsoleClinic[], prices: Record<string, number>) {
  if (e.kind === "price" && e.addon && e.prices) prices[e.addon] = e.prices[0];
  const c = clinics.find(x => x.id === e.clinicId);
  if (!c) return;
  if (e.kind === "plan" && e.from) c.plan = e.from;
  if (e.kind === "addon_on") c.addons = c.addons.filter(k => k !== e.addon);
  if (e.kind === "addon_off" && e.addon) c.addons = [...c.addons, e.addon];
  if (e.kind === "suspend") c.active = true;
  if (e.kind === "resume") c.active = false;
}
const mrrOf = (x: { clinics: ConsoleClinic[]; prices: Record<string, number> }) =>
  x.clinics.reduce((t, c) => t + (c.active ? planPrice(c.plan) + c.addons.reduce((u, k) => u + (x.prices[k] ?? 0), 0) : 0), 0);

/**
 * MRRの12か月。各月の値は「その月末に契約していた医院の、プラン料金＋オプション料金の合計」。
 * 料金はすべて10円単位なので、合計も10円単位になる。今月は今のストアから計算する。
 */
export function mrrHistory(s: ConsoleState) {
  return Array.from({ length: 12 }, (_, i) => {
    const month = subMonths(TODAY, 11 - i);
    return { month, value: i === 11 ? totalMRR(s) : mrrOf(stateAt(s, endOfMonth(month))) };
  });
}

/** 医院が利用を停止した日時（最後の停止） */
export const suspendedAt = (s: ConsoleState, id: string) => s.events.filter(e => e.clinicId === id && e.kind === "suspend").sort((a, b) => b.at.getTime() - a.at.getTime())[0]?.at;

// ─── 予約数 ────────────────────────────────────────────────────────────────
/**
 * 先週までの12週の予約数（最後が先週。今週は途中なので含めない。共有データの weekly と同じ区切り）。
 * 1週を月〜土の6日として日ごとに分け、登録前の日は0、最終利用より後の日は
 * 稼働中ならWeb予約の分だけ（スタッフが入れる電話・窓口の予約がなくなる）、停止中なら0にする。
 */
export function weeksOf(c: ConsoleClinic) {
  const thisWeek = startOfWeek(TODAY, { weekStartsOn: 1 });
  const n = c.apptsSeries.length;
  const born = startOfDay(c.createdAt);
  const last = startOfDay(c.lastActiveAt);
  return c.apptsSeries.map((v, i) => {
    const start = subWeeks(thisWeek, n - i);
    let share = 0;
    for (let d = 0; d < 6; d++) {
      const day = addDays(start, d);
      if (day < born) continue;
      share += day <= last ? 1 : c.active ? c.webRatio : 0;
    }
    return { start, count: Math.round((v * share) / 6) };
  });
}
const sum = (a: number[]) => a.reduce((t, v) => t + v, 0);
/** 直近4週（先週まで）と、その前の4週 */
export function recentOf(c: ConsoleClinic) {
  const w = weeksOf(c).map(x => x.count);
  return { last4: sum(w.slice(-4)), prev4: sum(w.slice(-8, -4)) };
}
/** 登録してからの予約の合計（先週まで） */
export const sinceSignup = (c: ConsoleClinic) => sum(weeksOf(c).map(x => x.count));

// ─── 状態・要対応 ──────────────────────────────────────────────────────────
export const daysSince = (d: Date) => differenceInCalendarDays(now(), d);
export const SETUP_ITEMS: { key: keyof ConsoleClinic["setup"]; label: string; todo: string; short: string }[] = [
  { key: "hours", label: "診療時間", todo: "未登録", short: "診療時間未登録" },
  { key: "menu", label: "診療メニュー", todo: "未登録", short: "診療メニュー未登録" },
  { key: "staff", label: "スタッフ", todo: "未登録", short: "スタッフ未登録" },
  { key: "email", label: "通知メール", todo: "未設定", short: "メール未設定" },
  { key: "line", label: "LINE連携", todo: "未連携", short: "LINE未連携" },
];
export const setupDone = (c: ConsoleClinic) => SETUP_ITEMS.filter(i => c.setup[i.key]).length;
export const setupMissing = (c: ConsoleClinic) => SETUP_ITEMS.filter(i => !c.setup[i.key]);
export const isSetupIncomplete = (c: ConsoleClinic) => c.active && setupDone(c) < SETUP_ITEMS.length;
/** 休眠の目安の日数 */
export const DORMANT_DAYS = 7;
/** 休眠：稼働中で、最終利用から7日以上（停止中は休眠に数えない。運営からとれる操作がないため） */
export const isDormant = (c: ConsoleClinic) => c.active && daysSince(c.lastActiveAt) >= DORMANT_DAYS;
/** フリープランで予約が増えている（アップグレードを提案する候補） */
export function isGrowingFree(c: ConsoleClinic) {
  if (!c.active || c.plan !== "free") return false;
  const { last4, prev4 } = recentOf(c);
  return last4 >= 20 && last4 > prev4 * 1.2;
}
export const needsAction = (c: ConsoleClinic) => isSetupIncomplete(c) || isDormant(c) || isGrowingFree(c);

/**
 * 要対応の理由（短く。表の「状態」の2行目などに）。
 * withLast=false のときは、最終利用の列と重なる「◯日 利用なし」を出さない
 */
export function reasonOf(c: ConsoleClinic, withLast = true): string | undefined {
  if (isDormant(c)) return withLast ? `${daysSince(c.lastActiveAt)}日 利用なし` : undefined;
  if (isGrowingFree(c)) return "予約が増加中";
  if (isSetupIncomplete(c)) return `初期設定 ${setupDone(c)}/${SETUP_ITEMS.length}`;
  return undefined;
}

/** 概要の「対応が必要」。count は行の数（同じ医院が2つの理由で出ることがある） */
export function attentionOf(s: ConsoleState) {
  const setup = s.clinics.filter(isSetupIncomplete).sort((a, b) => setupDone(a) - setupDone(b));
  const dormant = s.clinics.filter(isDormant).sort((a, b) => daysSince(b.lastActiveAt) - daysSince(a.lastActiveAt));
  const growth = s.clinics.filter(isGrowingFree);
  return { setup, dormant, growth, count: setup.length + dormant.length + growth.length };
}

// ─── 概要の指標 ────────────────────────────────────────────────────────────
// 前の4週のWeb予約の割合（増減を出すための補助データ）
const WEB_PREV: Record<string, number> = { c1: 0.39, c2: 0.31, c3: 0.26, c4: 0.5, c5: 0.12, c6: 0.45, c7: 0.23, c8: 0 };

export function overviewStats(s: ConsoleState) {
  const hist = mrrHistory(s);
  const mrr = hist[hist.length - 1].value;
  const prevMrr = hist[hist.length - 2].value;
  const active = s.clinics.filter(c => c.active).length;
  // 30日前の時点の状態（登録・停止・再開を戻したもの）
  const before = stateAt(s, subDays(now(), 30)).clinics;
  const activePrev = before.filter(c => c.active).length;
  const recent = s.clinics.map(c => ({ c, ...recentOf(c) }));
  const appts = sum(recent.map(r => r.last4));
  const prev4 = sum(recent.map(r => r.prev4));
  const web = appts ? sum(recent.map(r => r.c.webRatio * r.last4)) / appts : 0;
  const webPrev = prev4 ? sum(recent.map(r => (WEB_PREV[r.c.id] ?? r.c.webRatio) * r.prev4)) / prev4 : web;
  const dormant = s.clinics.filter(isDormant).length;
  const dormantPrev = before.filter(c => c.active && daysSince(c.lastActiveAt) >= 30 + DORMANT_DAYS).length;
  return {
    mrr, mrrDelta: prevMrr ? (mrr - prevMrr) / prevMrr : 0,
    active, total: s.clinics.length, stopped: s.clinics.length - active, activeDelta: active - activePrev,
    appts, apptsDelta: prev4 ? (appts - prev4) / prev4 : 0,
    web, webDelta: web - webPrev,
    dormant, dormantDelta: dormant - dormantPrev,
  };
}

// ─── 書式 ──────────────────────────────────────────────────────────────────
/** グラフの目盛り "15万" */
export const man = (v: number) => (v === 0 ? "0" : `${Math.round((v / 10000) * 10) / 10}万`);
export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
export const signed = (n: number, unit = "") => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("ja-JP")}${unit}`;
export const signedYen = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${yen(Math.abs(n))}`;
/** "2025年5月22日" */
export const ymd = (d: Date) => `${d.getFullYear()}年${md(d)}`;

/** 出来事の時刻：たった今 / 12分前 / 今日なら 9:18 / それより前は「昨日」「3日前」 */
export function when(d: Date, base: Date): string {
  const min = Math.floor((base.getTime() - d.getTime()) / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  if (differenceInCalendarDays(base, d) === 0) return hm(minutesOfDay(d));
  return ago(d, base);
}

// 所在地の読み（ひらがなでの地域検索に使う）
const CITY_KANA: Record<string, string> = {
  c1: "トウキョウトセタガヤク",
  c2: "カナガワケンヨコハマシ",
  c3: "トウキョウトナカノク",
  c4: "ミヤギケンセンダイシ",
  c5: "アイチケンナゴヤシ",
  c6: "オオサカフオオサカシ",
  c7: "ホッカイドウサッポロシ",
  c8: "フクオカケンフクオカシ",
};

/** 医院の検索（名前・読み・所在地。ひらがなでも当たる） */
export function matchesClinic(c: ConsoleClinic, q: string) {
  const t = q.trim().replace(/\s/g, "");
  if (!t) return true;
  const k = toKatakana(t);
  return c.name.replace(/\s/g, "").includes(t) || (CLINIC_KANA[c.id] ?? "").includes(k) || c.city.includes(t) || (CITY_KANA[c.id] ?? "").includes(k);
}
