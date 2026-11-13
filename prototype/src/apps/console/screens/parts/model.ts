// 運営コンソールの計算（MRR・推移・要対応・週ごとの予約数など）。描画せず、値だけを返す。
import { differenceInCalendarDays, startOfDay, startOfWeek, subWeeks } from "date-fns";
import { PLANS, consoleMonthly } from "@/data";
import type { ConsoleClinic, PlanKey } from "@/data";
import { TODAY, minutesOfDay, now } from "@/lib/clock";
import { ago, hm, md, toKatakana, yen } from "@/lib/format";
import type { ComponentProps } from "react";
import type { Tag } from "@/ui";
import { CLINIC_KANA, type ConsoleState } from "./store";

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

/**
 * MRRの12か月。consoleMonthly はエンタープライズ（個別見積）を含まない数字なので、
 * 北浜デンタルクリニック（12か月より前から契約）の ¥98,000 を足す。最新の月は今のストアから計算する。
 */
export function mrrHistory(s: ConsoleState) {
  return consoleMonthly.map((m, i) => ({
    month: m.month,
    value: i === consoleMonthly.length - 1 ? totalMRR(s) : m.mrr + ENTERPRISE_PRICE,
  }));
}

// ─── 予約数 ────────────────────────────────────────────────────────────────
/** 直近12週の予約数。登録前の週と、停止後の週は0にする（データの登録日・最終利用と揃える） */
export function weeksOf(c: ConsoleClinic) {
  const thisWeek = startOfWeek(TODAY, { weekStartsOn: 1 });
  const n = c.apptsSeries.length;
  const born = startOfDay(c.createdAt);
  return c.apptsSeries.map((v, i) => {
    const start = subWeeks(thisWeek, n - 1 - i);
    const zero = start < born || (!c.active && start > c.lastActiveAt);
    return { start, count: zero ? 0 : v };
  });
}
const sum = (a: number[]) => a.reduce((t, v) => t + v, 0);
/** 直近4週と、その前の4週 */
export function recentOf(c: ConsoleClinic) {
  const w = weeksOf(c).map(x => x.count);
  return { last4: sum(w.slice(-4)), prev4: sum(w.slice(-8, -4)) };
}

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
/** 休眠：停止中、または最終利用から7日より前 */
export const isDormant = (c: ConsoleClinic) => !c.active || daysSince(c.lastActiveAt) > 7;
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

/** 概要の「対応が必要」 */
export function attentionOf(s: ConsoleState) {
  const setup = s.clinics.filter(isSetupIncomplete).sort((a, b) => setupDone(a) - setupDone(b));
  const dormant = s.clinics.filter(isDormant).sort((a, b) => daysSince(a.lastActiveAt) - daysSince(b.lastActiveAt));
  const growth = s.clinics.filter(isGrowingFree);
  return { setup, dormant, growth, count: new Set([...setup, ...dormant, ...growth].map(c => c.id)).size };
}

// ─── 概要の指標 ────────────────────────────────────────────────────────────
// 先月のWeb予約の割合（前月比を出すための補助データ）
const WEB_PREV: Record<string, number> = { c1: 0.39, c2: 0.31, c3: 0.26, c4: 0.5, c5: 0.12, c6: 0.45, c7: 0.23, c8: 0 };

export function overviewStats(s: ConsoleState) {
  const hist = mrrHistory(s);
  const mrr = hist[hist.length - 1].value;
  const prevMrr = hist[hist.length - 2].value;
  const active = s.clinics.filter(c => c.active).length;
  // 30日前の時点で稼働していた医院（それ以降の登録は含めない）
  const activePrev = s.clinics.filter(c => c.active && differenceInCalendarDays(TODAY, c.createdAt) > 30).length;
  const appts = sum(s.clinics.map(c => c.appts30d));
  const last4 = sum(s.clinics.map(c => recentOf(c).last4));
  const prev4 = sum(s.clinics.map(c => recentOf(c).prev4));
  const web = appts ? sum(s.clinics.map(c => c.webRatio * c.appts30d)) / appts : 0;
  const webPrev = prev4 ? sum(s.clinics.map(c => (WEB_PREV[c.id] ?? c.webRatio) * recentOf(c).prev4)) / prev4 : web;
  const dormant = s.clinics.filter(isDormant).length;
  const dormantPrev = s.clinics.filter(c => daysSince(c.lastActiveAt) > 37).length;
  return {
    mrr, mrrDelta: prevMrr ? (mrr - prevMrr) / prevMrr : 0,
    active, total: s.clinics.length, activeDelta: active - activePrev,
    appts, apptsDelta: prev4 ? (last4 - prev4) / prev4 : 0,
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

/** 医院の検索（名前・読み・所在地。ひらがなでも当たる） */
export function matchesClinic(c: ConsoleClinic, q: string) {
  const t = q.trim().replace(/\s/g, "");
  if (!t) return true;
  const k = toKatakana(t);
  return c.name.replace(/\s/g, "").includes(t) || (CLINIC_KANA[c.id] ?? "").includes(k) || c.city.includes(t);
}
