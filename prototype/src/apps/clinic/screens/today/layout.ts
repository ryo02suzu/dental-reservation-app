import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

/** 幅のメディアクエリ（共有の media.ts にない 1024px 以上の判定に使う） */
export function useMinWidth(px: number): boolean {
  const q = `(min-width: ${px}px)`;
  const [m, setM] = useState(() => (typeof window !== "undefined" ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

/**
 * 右カラムを画面に貼り付けるときの top。画面より低ければ上端（offset）で、
 * 高ければ下端が画面の下から gap の位置で止まるようにする（下の方が隠れたままにならない）。
 */
export function useStickyTop(ref: RefObject<HTMLElement>, offset: number, gap = 24): number {
  const [top, setTop] = useState(offset);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setTop(Math.min(offset, window.innerHeight - el.offsetHeight - gap));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [ref, offset, gap]);
  return top;
}
