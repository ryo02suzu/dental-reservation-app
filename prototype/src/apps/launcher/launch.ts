import type { AppId } from "@/lib/nav";

/**
 * 入口のウィジェットからアプリを開いたときの「出どころ」。
 * アプリはこの四角から広がって開き、入口に戻るときは同じ四角へ縮んで戻る（iPhoneのアプリを開く動きと同じ）。
 */
export interface LaunchOrigin {
  app: AppId;
  rect: { top: number; left: number; width: number; height: number };
  radius: number;
  /** 開いたときの入口のスクロール位置（戻ったときに同じ位置へ戻す） */
  scrollTop: number;
}

let origin: LaunchOrigin | null = null;
export const setLaunchOrigin = (o: LaunchOrigin | null) => {
  origin = o;
};
export const getLaunchOrigin = () => origin;

/** 入口の最初の登場アニメーションは、1回だけ */
let introPlayed = false;
export const takeIntro = () => {
  const first = !introPlayed;
  introPlayed = true;
  return first;
};
