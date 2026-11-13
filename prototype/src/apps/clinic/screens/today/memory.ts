import { useSyncExternalStore } from "react";

// 「今日」の画面だけで使う、その場の記録。ストアに項目がないもの（問診票を送った・申し送った など）を
// 画面を移動しても消えないようにモジュールに持つ。保存はしない（再読み込みで元に戻る）。
export interface Memory {
  /** 注意事項を担当に申し送った予約 */
  handedOff: Record<string, true>;
  /** 問診票のURLを送った予約 */
  formSent: Record<string, true>;
  /** 保険証を確認した予約 */
  insurance: Record<string, true>;
  /** 未来院の患者さんへの連絡（at は分、result は 不在／向かっている） */
  contacted: Record<string, { at: number; result: "absent" | "coming"; eta?: number }>;
  /** ユニットごとの「さっき完了した予約」。次回予約の案内をしばらく出す（at はデモ時計のミリ秒） */
  done: Record<string, { apptId: string; at: number }>;
}

let state: Memory = { handedOff: {}, formSent: {}, insurance: {}, contacted: {}, done: {} };
const subs = new Set<() => void>();

const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => subs.delete(cb);
};
const get = () => state;

export function useMemory(): Memory {
  return useSyncExternalStore(subscribe, get, get);
}

export function remember(patch: (m: Memory) => Partial<Memory>) {
  state = { ...state, ...patch(state) };
  subs.forEach(f => f());
}
