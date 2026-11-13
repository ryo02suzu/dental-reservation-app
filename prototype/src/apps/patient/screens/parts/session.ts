// この端末（このタブ）で開いているあいだだけ覚えておくもの。再読み込みで元に戻る。
import { useSyncExternalStore } from "react";
import { ME } from "@/data";

// ─── この端末から入れた予約 ─────────────────────────────────────────────────
// 初診でご家族の予約を入れたときなど、本人（田中 美咲）以外の予約も「予約の確認」に出すため。
const created = new Set<string>();
export const rememberBooking = (id: string) => void created.add(id);
export const isSessionBooking = (id: string) => created.has(id);

// ─── お知らせの設定 ─────────────────────────────────────────────────────────
export interface NotifySettings {
  line: boolean;
  remind: boolean;
}
let settings: NotifySettings = { line: ME.line, remind: true };
const listeners = new Set<() => void>();

export function setNotify(patch: Partial<NotifySettings>) {
  settings = { ...settings, ...patch };
  listeners.forEach(l => l());
}

export function useNotify(): NotifySettings {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => settings,
    () => settings,
  );
}
