import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useStore } from "@/lib/store";
import { useToast } from "@/ui";
import { Copy } from "lucide-react";
import type { Appointment } from "@/data";
import { metaOf, type FilterKey, type PatientMeta, type SortKey } from "./util";

/** 幅の条件（media.ts と同じ作り。ここでは一覧＋詳細の2段組みにする幅を見る） */
export function useMediaQuery(query: string): boolean {
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

/** iPad横・Mac：患者の一覧と詳細を左右に並べる */
export const useIsSplit = () => useMediaQuery("(min-width: 1024px)");

/** 要素の幅を測る（描画前に一度測るので、レイアウトが一瞬切り替わって見えることはない） */
export function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** 患者ごとの予約・最終来院などを、ストアの予約からまとめて求める */
export function usePatientIndex() {
  const { patients, appointments } = useStore();
  return useMemo(() => {
    const byPatient = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const l = byPatient.get(a.patientId);
      if (l) l.push(a);
      else byPatient.set(a.patientId, [a]);
    }
    const meta = new Map<string, PatientMeta>();
    for (const p of patients) meta.set(p.id, metaOf(p, byPatient.get(p.id) ?? []));
    return { patients, meta, byPatient };
  }, [patients, appointments]);
}

/** 一覧の検索語・絞り込み・並び順・スクロール位置。詳細から戻ったときに元の状態で開く */
const memory = { query: "", filter: "all" as FilterKey, sort: "kana" as SortKey, scroll: 0 };
export const listMemory = memory;

export function useListState() {
  const [query, setQueryRaw] = useState(memory.query);
  const [filter, setFilterRaw] = useState<FilterKey>(memory.filter);
  const [sort, setSortRaw] = useState<SortKey>(memory.sort);
  const setQuery = useCallback((v: string) => { memory.query = v; setQueryRaw(v); }, []);
  const setFilter = useCallback((v: FilterKey) => { memory.filter = v; setFilterRaw(v); }, []);
  const setSort = useCallback((v: SortKey) => { memory.sort = v; setSortRaw(v); }, []);
  return { query, setQuery, filter, setFilter, sort, setSort };
}
export type ListState = ReturnType<typeof useListState>;

/** いちばん近いスクロール領域（Page の本体） */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const s = getComputedStyle(n).overflowY;
    if (s === "auto" || s === "scroll") return n;
  }
  return null;
}

/** 文字をコピーしてトーストで知らせる（公開先でも動くよう、クリックの処理の中で呼ぶ） */
export function useCopy() {
  const toast = useToast();
  return useCallback((text: string, what: string) => {
    try {
      navigator.clipboard.writeText(text).then(
        () => toast(`${what}をコピーしました`, { icon: Copy, detail: text }),
        () => toast("コピーできませんでした", { icon: Copy, detail: `${what}：${text}` }),
      );
    } catch {
      toast("コピーできませんでした", { icon: Copy, detail: `${what}：${text}` });
    }
  }, [toast]);
}
