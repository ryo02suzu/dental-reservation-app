import { memo, useDeferredValue, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, Check, Plus, Search, TriangleAlert, UserPlus } from "lucide-react";
import { TODAY, TODAY_KEY, useNow } from "@/lib/clock";
import { KANA_ROWS, ago, fromKey, hm, matchesPatient, md } from "@/lib/format";
import { Button, EmptyState, IconButton, Menu, MenuItem, SearchField, Tag, cn, spring } from "@/ui";
import type { Patient } from "@/data";
import { alertsOf, statusOf } from "@/apps/clinic/helpers";
import { ageOf } from "@/apps/clinic/sheets/logic";
import { listMemory, scrollParent, type ListState, type usePatientIndex } from "./hooks";
import { FILTER_NOTE, hasRedAlert, hira, inFilter, sectionize, whenShort, type FilterKey, type PatientMeta, type Section } from "./util";

type Index = ReturnType<typeof usePatientIndex>;

const FILTERS: { value: FilterKey; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "today", label: "今日来院" },
  { value: "recall", label: "リコール" },
  { value: "attention", label: "要注意" },
];

/** 絞り込み・検索・並び替えを済ませた一覧（区切りごと） */
export function useVisibleSections(state: ListState, index: Index) {
  const { patients, meta } = index;
  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = { all: 0, today: 0, recall: 0, attention: 0 };
    for (const p of patients) {
      const m = meta.get(p.id)!;
      for (const f of FILTERS) if (inFilter(f.value, p, m)) c[f.value]++;
    }
    return c;
  }, [patients, meta]);
  // 入力のたびに800人を描き直さないよう、検索語は少し遅れて反映する（入力欄はすぐ動く）
  const query = useDeferredValue(state.query);
  const filtered = useMemo(
    () => patients.filter(p => inFilter(state.filter, p, meta.get(p.id)!) && matchesPatient(p, query)),
    [patients, meta, state.filter, query],
  );
  const sections = useMemo(() => sectionize(filtered, state.sort, meta), [filtered, state.sort, meta]);
  const order = useMemo(() => sections.flatMap(s => s.items.map(p => p.id)), [sections]);
  return { counts, sections, order, total: filtered.length };
}

// ─── 見出しの下：検索と絞り込み ───────────────────────────────────────────
export function ListControls({ state, counts, size = "md", compact }: { state: ListState; counts: Record<FilterKey, number>; size?: "sm" | "md"; compact?: boolean }) {
  // 狭い列（iPad横）では件数を出さず、ラベルだけにする（件数は一覧の下に出る）
  return (
    <div className="space-y-2.5">
      <SearchField value={state.query} onChange={state.setQuery} placeholder="名前・診察券番号・電話番号" />
      <FitSegmented value={state.filter} onChange={state.setFilter} size={size} options={FILTERS.map(f => ({ ...f, count: compact ? undefined : counts[f.value] }))} />
    </div>
  );
}

/**
 * 項目の幅を文字に合わせるセグメント（共通の Segmented と同じ見た目）。
 * 4つの絞り込みに件数を付けても、一覧の列（約310px）に収まるようにしている。
 */
function FitSegmented<T extends string>({ value, onChange, options, size }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; size: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="tablist" className="relative flex w-full rounded-[9px] bg-fill/12 p-[2px]">
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-0 flex flex-auto items-center justify-center gap-1 whitespace-nowrap rounded-[7px] px-2 font-medium transition-colors",
              size === "sm" ? "h-[26px] text-[12px]" : "h-[30px] text-[13px]",
              active ? "text-label" : "text-label2 hover:text-label",
            )}
          >
            {active && <motion.span layoutId={`fseg-${id}`} className="absolute inset-0 -z-10 rounded-[7px] bg-thumb shadow-thumb" transition={spring} />}
            {o.label}
            {o.count !== undefined && <span className={cn("tnum", active ? "text-label2" : "text-label3")}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── バーの右：並び順と新規登録 ───────────────────────────────────────────
export function ListActions({ state, onAdd }: { state: ListState; onAdd: () => void }) {
  return (
    <>
      <Menu trigger={<IconButton icon={ArrowUpDown} size="sm" label="並び順" />}>
        <MenuItem icon={state.sort === "kana" ? Check : undefined} onSelect={() => state.setSort("kana")}>五十音順</MenuItem>
        <MenuItem icon={state.sort === "recent" ? Check : undefined} onSelect={() => state.setSort("recent")}>最終来院が新しい順</MenuItem>
      </Menu>
      <IconButton icon={Plus} size="sm" label="新しい患者を登録" onClick={onAdd} />
    </>
  );
}

// ─── 一覧の本体 ───────────────────────────────────────────────────────────
export function PatientSections({
  sections, total, state, index, selectedId, onSelect, stickyTop, bleed, column, narrow, phone, flashId, onAdd, rememberScroll,
}: {
  sections: Section[];
  total: number;
  state: ListState;
  index: Index;
  selectedId?: string;
  onSelect: (id: string) => void;
  /** 見出しが止まる位置（上のバーの高さ） */
  stickyTop: number;
  /** 見出しの帯を左右の余白まで伸ばす幅 */
  bleed: number;
  column?: boolean;
  /** 一覧の列が狭い（iPad）：次回の日付を短く出す */
  narrow?: boolean;
  phone?: boolean;
  flashId?: string;
  onAdd: () => void;
  rememberScroll?: boolean;
}) {
  const now = useNow(30_000);
  const anchor = useRef<HTMLDivElement>(null);
  // 見出しの帯は左右の余白まで伸ばす。列の中では、右の区切り線に重ならないように右は伸ばさない
  const bleedR = column ? 0 : bleed;

  // 詳細から戻ったとき、元のスクロール位置で開く
  useLayoutEffect(() => {
    if (!rememberScroll) return;
    const sp = scrollParent(anchor.current);
    if (!sp) return;
    if (listMemory.scroll) sp.scrollTop = listMemory.scroll;
    const on = () => { listMemory.scroll = sp.scrollTop; };
    sp.addEventListener("scroll", on, { passive: true });
    return () => sp.removeEventListener("scroll", on);
  }, [rememberScroll]);

  const note = FILTER_NOTE[state.filter];
  const showIndex = phone && state.sort === "kana" && !state.query.trim() && sections.length > 1;

  return (
    <div ref={anchor}>
      {note && <p className="px-4 pb-3 text-footnote text-label2">{note}</p>}
      {total === 0 ? (
        state.query.trim() ? (
          <EmptyState
            icon={Search}
            title={`「${state.query.trim()}」に一致する患者はいません`}
            message="氏名・ふりがな・診察券番号・電話番号の数字で探せます。"
            action={<Button variant="gray" size="sm" icon={UserPlus} onClick={onAdd}>新しい患者を登録</Button>}
          />
        ) : (
          <EmptyState title="該当する患者はいません" message="絞り込みを「すべて」に戻すと、全員を表示します。" action={<Button variant="gray" size="sm" onClick={() => state.setFilter("all")}>すべて表示</Button>} />
        )
      ) : (
        <>
          {sections.map(s => (
            <section key={s.key} id={`pt-sec-${s.key}`} className="mt-3 first:mt-0" style={{ scrollMarginTop: stickyTop }}>
              <div
                className="sticky z-10 flex h-8 items-end bg-bg pb-1.5 text-footnote font-semibold text-label2"
                style={{ top: stickyTop, marginLeft: -bleed, marginRight: -bleedR, paddingLeft: bleed + 16, paddingRight: bleedR + 16 }}
              >
                {s.label}
              </div>
              {/* 画面の外の区切りは描画を省く（800人でも軽く） */}
              <div className="overflow-hidden rounded-cell bg-surface" style={{ contentVisibility: "auto", containIntrinsicSize: `auto ${s.items.length * (phone ? 64 : 58)}px` }}>
                {s.items.map(p => {
                  const m = index.meta.get(p.id)!;
                  return (
                  <PatientRow
                    key={p.id}
                    p={p}
                    m={m}
                    now={m.today ? now : undefined}
                    selected={p.id === selectedId}
                    onSelect={onSelect}
                    phone={phone}
                    column={column}
                    narrow={narrow}
                    flash={p.id === flashId}
                    scrollTop={stickyTop + 36}
                  />
                  );
                })}
              </div>
            </section>
          ))}
          <p className="mt-5 text-center text-footnote text-label2 tnum">{total}人</p>
        </>
      )}
      {showIndex && <IndexScrubber available={new Set(sections.map(s => s.key))} />}
    </div>
  );
}

/** 一覧の右側に出す「今日の状態」または次回の予約 */
function rightLabel(m: PatientMeta, now: Date | undefined, narrow?: boolean): { text: string; cls: string } | null {
  const t = m.today;
  if (t && now && t.status !== "completed") {
    const s = statusOf(t, now);
    if (s === "in_progress") return { text: "診療中", cls: "font-semibold text-accent" };
    if (s === "arrived") return { text: "来院済", cls: "font-semibold text-accent" };
    if (s === "late") return { text: "未来院", cls: "font-semibold text-red" };
    return { text: `今日 ${hm(t.start)}`, cls: "font-medium text-label" };
  }
  if (!m.next) return null;
  const w = whenShort(m.next);
  const near = m.next.date === TODAY_KEY || w.startsWith("明日");
  if (near) return { text: w, cls: "font-medium text-label" };
  // 狭い列では「次回」を省いて日付だけ（書き方はほかの画面と同じ「11月24日」）
  return { text: narrow ? md(fromKey(m.next.date)) : `次回 ${w}`, cls: "text-label2" };
}

/**
 * 一覧の1行。iOSの連絡先と同じく頭文字の丸は出さない（区切りの中で同じ字が並ぶだけなので）。
 * 印は治療前に確認が要る赤の注意だけ。キャンセルが多い人には小さく回数を添える。
 */
const PatientRow = memo(function PatientRow({ p, m, now, selected, onSelect, phone, column, narrow, flash, scrollTop }: {
  p: Patient; m: PatientMeta; now?: Date; selected: boolean; onSelect: (id: string) => void;
  phone?: boolean; column?: boolean; narrow?: boolean; flash?: boolean; scrollTop: number;
}) {
  const red = hasRedAlert(p);
  const right = rightLabel(m, now, narrow);
  const isNew = m.visits === 0;
  const pad = column ? 12 : 16;
  const years = ageOf(p);
  const left = `${years === null ? "年齢未登録" : `${years}歳`}・${p.sex}`;
  const last = m.lastVisit ? `前回 ${ago(m.lastVisit, TODAY)}` : "来院歴なし";
  const cancels = m.cancellations + m.noShows;
  return (
    <button
      type="button"
      data-pid={p.id}
      onClick={() => onSelect(p.id)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 text-left transition-colors duration-100",
        phone ? "min-h-[64px] py-2.5" : "min-h-[58px] py-2",
        selected ? "bg-sand/24" : "hover:bg-fill/[0.06] active:bg-fill/16",
      )}
      style={{ paddingLeft: pad, paddingRight: pad, scrollMarginTop: scrollTop, scrollMarginBottom: 12 }}
    >
      {flash && <motion.span aria-hidden className="pointer-events-none absolute inset-0 bg-sand/36" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 1.2, delay: 0.5 }} />}
      <div className="relative min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[16px] font-semibold leading-[21px] md:text-[15px] md:leading-5">{p.name}</span>
          <span className="min-w-0 truncate text-caption text-label2">{p.kana}</span>
          {isNew && m.next?.firstVisit && <Tag tone="accent" className="shrink-0">初診</Tag>}
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-1">
            {cancels >= 2 && <Tag className="tnum">キャンセル{cancels}回</Tag>}
            {red && <TriangleAlert className="h-3.5 w-3.5 text-red" strokeWidth={2.3} aria-label={alertsOf(p).filter(a => a.tone === "red").map(a => a.label).join("、")} />}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-baseline gap-2 text-footnote">
          <span className="min-w-0 flex-1 truncate text-label2 tnum">
            {left}
            {!narrow && (
              <>
                <span className="px-1 text-label4">·</span>
                {last}
              </>
            )}
          </span>
          {right && <span className={cn("shrink-0 tnum", right.cls)}>{right.text}</span>}
        </div>
      </div>
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" style={{ left: pad }} />
    </button>
  );
});

// ─── スマホ：右端の五十音インデックス ────────────────────────────────────
const INDEX_KEYS = KANA_ROWS.map(k => ({ key: k, label: hira(k) }));

/** iOSの連絡先と同じ、右端をなぞって行を移動するインデックス */
function IndexScrubber({ available }: { available: Set<string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const [active, setActive] = useState<{ key: string; label: string; y: number } | null>(null);

  const pick = (clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const i = Math.max(0, Math.min(INDEX_KEYS.length - 1, Math.floor(((clientY - r.top) / r.height) * INDEX_KEYS.length)));
    const k = INDEX_KEYS[i];
    setActive({ ...k, y: r.top + (i + 0.5) * (r.height / INDEX_KEYS.length) });
    if (k.key === last.current) return;
    last.current = k.key;
    // その行に患者がいなければ、次の行（なければ前の行）へ
    let target: string | undefined;
    for (let j = i; j < INDEX_KEYS.length && !target; j++) if (available.has(INDEX_KEYS[j].key)) target = INDEX_KEYS[j].key;
    for (let j = i; j >= 0 && !target; j--) if (available.has(INDEX_KEYS[j].key)) target = INDEX_KEYS[j].key;
    if (target) document.getElementById(`pt-sec-${target}`)?.scrollIntoView({ block: "start" });
  };
  const end = () => {
    last.current = null;
    setActive(null);
  };

  return (
    <>
      <div
        ref={ref}
        role="navigation"
        aria-label="五十音で移動"
        className="fixed right-0 top-1/2 z-20 flex w-6 -translate-y-1/2 touch-none select-none flex-col items-center py-1"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e.clientY); }}
        onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientY); }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {INDEX_KEYS.map(k => (
          <span
            key={k.key}
            className={cn(
              "flex h-[19px] w-full items-center justify-center text-[11px] font-semibold leading-none transition-colors",
              active?.key === k.key ? "text-label" : available.has(k.key) ? "text-accent" : "text-label3",
            )}
          >
            {k.label}
          </span>
        ))}
      </div>
      <AnimatePresence>
        {active && (
          <motion.div
            aria-hidden
            className="material-thick pointer-events-none fixed right-10 z-30 flex h-12 w-12 items-center justify-center rounded-full text-[22px] font-semibold shadow-float"
            style={{ top: active.y - 24 }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
            transition={spring}
          >
            {active.label}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
