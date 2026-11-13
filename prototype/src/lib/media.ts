import { useEffect, useState } from "react";

function useMedia(query: string): boolean {
  const get = () => (typeof window !== "undefined" ? window.matchMedia(query).matches : false);
  const [match, setMatch] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
}

/** スマホ幅（タブバー＋大見出しのiOS型レイアウト） */
export const useIsPhone = () => useMedia("(max-width: 767px)");
/** 幅の広い画面（3カラムなどを使ってよい） */
export const useIsWide = () => useMedia("(min-width: 1180px)");
/** iPadの横向き以上（2段組みを使ってよい） */
export const useIsDesktop = () => useMedia("(min-width: 1024px)");
/** 任意の最小幅 */
export const useMinWidth = (px: number) => useMedia(`(min-width: ${px}px)`);
