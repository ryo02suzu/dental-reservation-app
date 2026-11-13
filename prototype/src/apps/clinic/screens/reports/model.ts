// レポートの数字。KPIは共有データ（kpis / weekly）から、内訳はストアの予約から出す。
import { addDays, startOfWeek, subDays } from "date-fns";
import { kpis, serviceById, weekly, type Appointment, type ApptSource, type Service } from "@/data";
import { TODAY } from "@/lib/clock";
import { key, md, yen } from "@/lib/format";

export type Period = "week" | "month";

export interface Metric {
  key: string;
  label: string;
  /** 表示用の値 */
  value: string;
  unit?: string;
  /** 前期比。kind=pct は相対の変化率（0.06=6%）、kind=pt は割合の差（0.006=0.6ポイント） */
  delta: number;
  kind: "pct" | "pt";
  /** 上がると良いか */
  good: boolean;
}

const pct1 = (r: number) => (r * 100).toFixed(1);
const pct0 = (r: number) => String(Math.round(r * 100));

/** 週ごとの稼働率・リコールからの来院率（共有データにないので月の値から毎回同じに作る） */
const wobble = (i: number, k: number) => (((i * k) % 7) - 3) / 100;
const weeklyUtil = weekly.map((_, i) => Math.min(0.95, kpis.utilizationPrev - 0.02 + (i / 11) * 0.06 + wobble(i, 5) * 0.6));
const weeklyRecall = weekly.map((_, i) => Math.min(0.9, kpis.recallReturnPrev - 0.03 + (i / 11) * 0.08 + wobble(i, 3)));
const rateOf = (w: (typeof weekly)[number]) => {
  const booked = w.visits + w.cancellations + w.noShows;
  return { cancel: w.cancellations / booked, noShow: w.noShows / booked };
};

interface Raw { visits: number; newP: number; cancel: number; noShow: number; web: number; selfPay: number; util: number; recall: number }

function raw(period: Period): { cur: Raw; prev: Raw } {
  if (period === "month") {
    return {
      cur: { visits: kpis.visitsMonth, newP: kpis.newMonth, cancel: kpis.cancelRate, noShow: kpis.noShowRate, web: kpis.webRatio, selfPay: kpis.selfPayMonth, util: kpis.utilization, recall: kpis.recallReturn },
      prev: { visits: kpis.visitsPrev, newP: kpis.newPrev, cancel: kpis.cancelPrev, noShow: kpis.noShowPrev, web: kpis.webPrev, selfPay: kpis.selfPayPrev, util: kpis.utilizationPrev, recall: kpis.recallReturnPrev },
    };
  }
  const at = (i: number): Raw => {
    const w = weekly[i];
    const r = rateOf(w);
    return { visits: w.visits, newP: w.newPatients, cancel: r.cancel, noShow: r.noShow, web: w.webRatio, selfPay: Math.round(w.selfPay / 100) * 100, util: weeklyUtil[i], recall: weeklyRecall[i] };
  };
  return { cur: at(11), prev: at(10) };
}

export function metricsFor(period: Period): Metric[] {
  const { cur, prev } = raw(period);
  const rel = (a: number, b: number) => (b ? (a - b) / b : 0);
  return [
    { key: "visits", label: "来院数", value: cur.visits.toLocaleString("ja-JP"), unit: "人", delta: rel(cur.visits, prev.visits), kind: "pct", good: true },
    { key: "new", label: "新患数", value: String(cur.newP), unit: "人", delta: rel(cur.newP, prev.newP), kind: "pct", good: true },
    { key: "cancel", label: "キャンセル率", value: pct1(cur.cancel), unit: "%", delta: cur.cancel - prev.cancel, kind: "pt", good: false },
    { key: "noshow", label: "無断キャンセル率", value: pct1(cur.noShow), unit: "%", delta: cur.noShow - prev.noShow, kind: "pt", good: false },
    { key: "web", label: "Web予約の割合", value: pct0(cur.web), unit: "%", delta: cur.web - prev.web, kind: "pt", good: true },
    { key: "selfpay", label: "自費の売上", value: yen(cur.selfPay), delta: rel(cur.selfPay, prev.selfPay), kind: "pct", good: true },
    { key: "util", label: "ユニット稼働率", value: pct0(cur.util), unit: "%", delta: cur.util - prev.util, kind: "pt", good: true },
    { key: "recall", label: "リコールからの来院率", value: pct0(cur.recall), unit: "%", delta: cur.recall - prev.recall, kind: "pt", good: true },
  ];
}

/** 冒頭の一文（事実だけ） */
export function headline(period: Period): string {
  const { cur, prev } = raw(period);
  const lead = period === "month" ? "前の30日より" : "先週は前の週より";
  const dv = cur.visits - prev.visits;
  const visits = dv > 0 ? `来院が${dv}人増え` : dv < 0 ? `来院が${-dv}人減り` : "来院は同じ人数で";
  const dc = Math.round((cur.cancel - prev.cancel) * 1000) / 10;
  const cancel = dc < 0 ? `キャンセル率は${Math.abs(dc).toFixed(1)}ポイント下がりました` : dc > 0 ? `キャンセル率は${dc.toFixed(1)}ポイント上がりました` : "キャンセル率は変わりませんでした";
  return `${lead}${visits}、${cancel}。`;
}

/** 期間（内訳の集計に使う日付の範囲） */
export function rangeOf(period: Period): { from: string; to: string; label: string; compare: string } {
  if (period === "month") {
    const from = subDays(TODAY, 29);
    return { from: key(from), to: key(TODAY), label: `${md(from)}〜${md(TODAY)}`, compare: "前の30日と比較" };
  }
  // 週は「先週（月〜日）」を、その前の週と比べる（今週はまだ途中なので）
  const from = subDays(startOfWeek(TODAY, { weekStartsOn: 1 }), 7);
  const to = addDays(from, 6);
  return { from: key(from), to: key(to), label: `${md(from)}〜${md(to)}`, compare: "前の週と比較" };
}

export interface Share { label: string; value: number; share: number }

const toShares = (m: Map<string, number>, order?: string[]): Share[] => {
  const total = [...m.values()].reduce((a, b) => a + b, 0) || 1;
  const rows = [...m.entries()].map(([label, value]) => ({ label, value, share: value / total }));
  if (order) return order.map(l => rows.find(r => r.label === l) ?? { label: l, value: 0, share: 0 });
  return rows.sort((a, b) => b.value - a.value);
};

/** 診療の種類を、院長が読んでわかる言葉に */
const CATEGORY_LABEL: Record<Service["category"], string> = {
  予防: "定期検診・予防", 一般: "むし歯・根管治療", 歯周: "歯周病治療", 外科: "抜歯", 補綴: "被せ物・入れ歯", 小児: "小児歯科", 審美: "ホワイトニング", 相談: "初診・相談",
};

export const SOURCE_LABEL: Record<ApptSource, string> = { web: "Web", phone: "電話", line: "LINE", walkin: "飛び込み" };

/** ストアの予約から、期間内の内訳をまとめる */
export function breakdown(appointments: Appointment[], period: Period) {
  const { from, to } = rangeOf(period);
  const inRange = appointments.filter(a => a.date >= from && a.date <= to);
  const kept = inRange.filter(a => a.status !== "cancelled" && a.status !== "no_show");
  const cat = new Map<string, number>();
  const src = new Map<string, number>();
  const selfPayBy = new Map<string, number>();
  let ins = 0;
  let self = 0;
  for (const a of kept) {
    const s: Service = serviceById(a.serviceId);
    cat.set(CATEGORY_LABEL[s.category], (cat.get(CATEGORY_LABEL[s.category]) ?? 0) + 1);
    if (s.insurance) ins++;
    else {
      self++;
      const name = s.price === 0 ? `${s.name}（無料）` : s.name;
      selfPayBy.set(name, (selfPayBy.get(name) ?? 0) + 1);
    }
  }
  for (const a of inRange) src.set(SOURCE_LABEL[a.source], (src.get(SOURCE_LABEL[a.source]) ?? 0) + 1);
  const reasons = new Map<string, number>();
  const cancelled = inRange.filter(a => a.status === "cancelled");
  for (const a of cancelled) {
    const r = (a.cancelReason ?? "理由の入力なし").replace(/のため$/, "");
    reasons.set(r, (reasons.get(r) ?? 0) + 1);
  }
  return {
    total: kept.length,
    categories: toShares(cat),
    insurance: { ins, self, selfShare: self / Math.max(1, ins + self) },
    selfPayMenus: toShares(selfPayBy),
    sources: toShares(src, ["Web", "電話", "LINE", "飛び込み"]),
    sourceTotal: inRange.length,
    reasons: toShares(reasons),
    cancelled: cancelled.length,
    noShows: inRange.filter(a => a.status === "no_show").length,
  };
}
