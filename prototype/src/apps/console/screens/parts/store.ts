// 運営コンソールの小さなストア。概要・医院・オプションの3画面で同じ状態を共有する。
// 医院のプラン・オプション・オプションの料金と提供状況・メモ・最近の動きを持つ。
// 保存はしない（再読み込みで元に戻る）。共有の @/lib/store とは別物。
import { useSyncExternalStore } from "react";
import { subDays } from "date-fns";
import { addons as seedAddons, consoleClinics } from "@/data";
import type { Addon, ConsoleClinic, PlanKey } from "@/data";
import { TODAY, now } from "@/lib/clock";

export type EventKind =
  | "signup" // 新規登録
  | "plan" // プラン変更
  | "addon_on" // オプション追加
  | "addon_off" // オプション解約
  | "suspend" // 利用停止
  | "proposal" // 運営からアップグレードを提案
  | "guide" // 運営から初期設定の案内を送信
  | "checkin" // 運営から利用状況の確認メールを送信
  | "price" // オプションの料金を変更
  | "offer_on" // オプションの提供を再開
  | "offer_off"; // オプションの提供を停止

export interface ConsoleEvent {
  id: string;
  at: Date;
  kind: EventKind;
  clinicId?: string;
  addon?: string;
  from?: PlanKey;
  to?: PlanKey;
  prices?: [number, number];
}

export interface ConsoleState {
  clinics: ConsoleClinic[];
  addons: Addon[];
  events: ConsoleEvent[];
  memos: Record<string, string>;
  /** アップグレードを提案した医院 */
  proposals: Record<string, { plan: PlanKey; at: Date }>;
  /** 初期設定の案内を送った医院 */
  guides: Record<string, Date>;
  /** しばらく使われていない医院に、確認のメールを送った日時 */
  checkins: Record<string, Date>;
}

/** 医院名の読み（五十音順の並べ替えと、ひらがなでの検索に使う） */
export const CLINIC_KANA: Record<string, string> = {
  c1: "ヒダマリシカクリニック",
  c2: "ミナトミライデンタルオフィス",
  c3: "ナカノエキマエシカ",
  c4: "アオバショウニシカ",
  c5: "サクラドオリシカ",
  c6: "キタハマデンタルクリニック",
  c7: "シラカバシカイイン",
  c8: "コトリシカ",
};

const at = (daysAgo: number, h: number, m: number) => {
  const d = subDays(TODAY, daysAgo);
  d.setHours(h, m, 0, 0);
  return d;
};

// 最近の動き（サンプル）。医院のデータ（プラン・オプション・登録日・最終利用）と食い違わないようにしてある。
const seedEvents: ConsoleEvent[] = [
  { id: "e1", at: at(0, 9, 18), kind: "addon_on", clinicId: "c2", addon: "sms_pack" },
  { id: "e2", at: at(1, 16, 40), kind: "addon_on", clinicId: "c3", addon: "waitlist" },
  { id: "e3", at: at(3, 11, 5), kind: "plan", clinicId: "c4", from: "standard", to: "pro" },
  { id: "e4", at: at(6, 14, 22), kind: "addon_on", clinicId: "c1", addon: "questionnaire" },
  { id: "e5", at: at(19, 10, 3), kind: "signup", clinicId: "c5", to: "free" },
  { id: "e6", at: at(34, 15, 30), kind: "suspend", clinicId: "c8" },
];

const seedMemos: Record<string, string> = {
  c1: "デモ医院。新しい画面は、まずこちらで試していただいている。",
  c5: "10月に開業したばかり。初期設定を電話で手伝う約束（11月中）。",
  c6: "請求書払い（月末締め・翌月末払い）。分院の追加を検討中とのこと。",
  c7: "開発パートナー。新しい機能は先行してお試しいただいている。",
  c8: "10月に院長から休止の連絡あり。再開の時期は未定。",
};

let state: ConsoleState = {
  clinics: consoleClinics.map(c => ({ ...c, addons: [...c.addons], setup: { ...c.setup } })),
  addons: seedAddons.map(a => ({ ...a })),
  events: seedEvents,
  memos: seedMemos,
  proposals: {},
  guides: {},
  checkins: {},
};

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => state;
function commit(next: ConsoleState) {
  state = next;
  listeners.forEach(l => l());
}

/** コンソールの状態（読み取り専用のスナップショット） */
export const useConsole = () => useSyncExternalStore(subscribe, snapshot, snapshot);

let seq = 0;
const event = (e: Omit<ConsoleEvent, "id" | "at">): ConsoleEvent => ({ ...e, id: `ev-${++seq}`, at: now() });
const mapClinic = (id: string, f: (c: ConsoleClinic) => ConsoleClinic) => state.clinics.map(c => (c.id === id ? f(c) : c));

export function setPlan(id: string, plan: PlanKey) {
  const c = state.clinics.find(x => x.id === id);
  if (!c || c.plan === plan) return;
  commit({
    ...state,
    clinics: mapClinic(id, x => ({ ...x, plan })),
    events: [event({ kind: "plan", clinicId: id, from: c.plan, to: plan }), ...state.events],
  });
}

export function setClinicAddon(id: string, key: string, on: boolean) {
  const c = state.clinics.find(x => x.id === id);
  if (!c || c.addons.includes(key) === on) return;
  // オプションは一覧の順に並べておく（表の並びと揃える）
  const order = state.addons.map(a => a.key);
  const next = on ? [...c.addons, key].sort((a, b) => order.indexOf(a) - order.indexOf(b)) : c.addons.filter(k => k !== key);
  commit({
    ...state,
    clinics: mapClinic(id, x => ({ ...x, addons: next })),
    events: [event({ kind: on ? "addon_on" : "addon_off", clinicId: id, addon: key }), ...state.events],
  });
}

export function setOffered(key: string, on: boolean) {
  const a = state.addons.find(x => x.key === key);
  if (!a || a.active === on) return;
  commit({
    ...state,
    addons: state.addons.map(x => (x.key === key ? { ...x, active: on } : x)),
    events: [event({ kind: on ? "offer_on" : "offer_off", addon: key }), ...state.events],
  });
}

export function setAddonPrice(key: string, price: number) {
  const a = state.addons.find(x => x.key === key);
  if (!a || a.price === price) return;
  commit({
    ...state,
    addons: state.addons.map(x => (x.key === key ? { ...x, price } : x)),
    events: [event({ kind: "price", addon: key, prices: [a.price, price] }), ...state.events],
  });
}

export function setMemo(id: string, text: string) {
  if ((state.memos[id] ?? "") === text) return;
  commit({ ...state, memos: { ...state.memos, [id]: text } });
}

export function sendProposal(id: string, plan: PlanKey) {
  const e = event({ kind: "proposal", clinicId: id, to: plan });
  commit({ ...state, proposals: { ...state.proposals, [id]: { plan, at: e.at } }, events: [e, ...state.events] });
}

export function sendGuide(id: string) {
  const e = event({ kind: "guide", clinicId: id });
  commit({ ...state, guides: { ...state.guides, [id]: e.at }, events: [e, ...state.events] });
}

export function sendCheckin(id: string) {
  const e = event({ kind: "checkin", clinicId: id });
  commit({ ...state, checkins: { ...state.checkins, [id]: e.at }, events: [e, ...state.events] });
}
