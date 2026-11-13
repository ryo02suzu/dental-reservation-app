// 医院の表（PC）。列は幅に合わせて大事な順に出す。見出しを押すと並べ替え（もう一度で逆順）。
import { useMemo, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, SearchX } from "lucide-react";
import type { ConsoleClinic } from "@/data";
import { useNow } from "@/lib/clock";
import { ago } from "@/lib/format";
import { Button, EmptyState, Sparkline, Tag, cn, spring } from "@/ui";
import { planPrice, weeksOf } from "./model";
import { CLINIC_KANA, useConsole } from "./store";
import { ClinicMark, LastActive, PlanTag, ReasonText, StateText } from "./ui";

export type ColKey = "name" | "plan" | "units" | "staff" | "appts" | "web" | "addons" | "last" | "status";
export type SortState = { key: ColKey; dir: "asc" | "desc" };

interface Col { key: ColKey; label: string; width: number; align: "left" | "right"; prio: number; first: "asc" | "desc" }
const COLS: Col[] = [
  { key: "name", label: "医院名", width: 0, align: "left", prio: 0, first: "asc" },
  { key: "plan", label: "プラン", width: 112, align: "left", prio: 1, first: "desc" },
  { key: "units", label: "ユニット", width: 60, align: "right", prio: 7, first: "desc" },
  { key: "staff", label: "スタッフ", width: 60, align: "right", prio: 8, first: "desc" },
  { key: "appts", label: "30日の予約", width: 132, align: "right", prio: 2, first: "desc" },
  { key: "web", label: "Web予約", width: 68, align: "right", prio: 5, first: "desc" },
  { key: "addons", label: "オプション", width: 92, align: "left", prio: 6, first: "desc" },
  { key: "last", label: "最終利用", width: 76, align: "right", prio: 4, first: "desc" },
  { key: "status", label: "状態", width: 100, align: "left", prio: 3, first: "asc" },
];
const GAP = 16;
const PAD = 16;
const NAME_MIN = 188;

/** 表の幅から、出せる列を大事な順に決める */
export function visibleColumns(width: number): ColKey[] {
  let used = PAD * 2 + NAME_MIN;
  const keep = new Set<ColKey>(["name"]);
  for (const c of [...COLS].filter(c => c.key !== "name").sort((a, b) => a.prio - b.prio)) {
    if (used + GAP + c.width > width) break;
    used += GAP + c.width;
    keep.add(c.key);
  }
  return COLS.filter(c => keep.has(c.key)).map(c => c.key);
}

const RANK: Record<string, number> = { free: 0, partner: 0.5, standard: 1, pro: 2, enterprise: 3 };
function compare(a: ConsoleClinic, b: ConsoleClinic, key: ColKey): number {
  switch (key) {
    case "name": return (CLINIC_KANA[a.id] ?? a.name).localeCompare(CLINIC_KANA[b.id] ?? b.name, "ja");
    case "plan": return RANK[a.plan] - RANK[b.plan] || planPrice(a.plan) - planPrice(b.plan);
    case "units": return a.units - b.units;
    case "staff": return a.staff - b.staff;
    case "appts": return a.appts30d - b.appts30d;
    case "web": return a.webRatio - b.webRatio;
    case "addons": return a.addons.length - b.addons.length;
    case "last": return a.lastActiveAt.getTime() - b.lastActiveAt.getTime();
    case "status": return Number(b.active) - Number(a.active);
  }
}
export function sortClinics(list: ConsoleClinic[], sort: SortState) {
  const k = sort.dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => compare(a, b, sort.key) * k || compare(a, b, "name"));
}
export function nextSort(cur: SortState, key: ColKey): SortState {
  if (cur.key === key) return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
  return { key, dir: COLS.find(c => c.key === key)!.first };
}

export function ClinicTable({ rows, width, sort, onSort, selected, onSelect, onClose, onClearFilters }: {
  rows: ConsoleClinic[];
  width: number;
  sort: SortState;
  onSort: (s: SortState) => void;
  selected?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onClearFilters: () => void;
}) {
  const s = useConsole();
  const t = useNow(60_000);
  const keys = visibleColumns(width);
  const cols = keys.map(k => COLS.find(c => c.key === k)!);
  const template = cols.map(c => (c.key === "name" ? "minmax(0,1fr)" : `${c.width}px`)).join(" ");
  const show = (k: ColKey) => keys.includes(k);
  const weeks = useMemo(() => Object.fromEntries(s.clinics.map(c => [c.id, weeksOf(c).map(w => w.count)])), [s.clinics]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Escape") return;
    e.preventDefault();
    if (e.key === "Escape") return onClose();
    const i = rows.findIndex(r => r.id === selected);
    const next = e.key === "ArrowDown" ? Math.min(rows.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1);
    if (rows[next]) onSelect(rows[next].id);
  };

  return (
    <div role="table" aria-label="契約医院" aria-rowcount={rows.length} className="rounded-cell bg-surface [overflow:clip]">
      {/* 見出し（スクロールしても上に残る） */}
      <div role="row" className="hairline-b sticky top-[52px] z-20 grid h-9 items-center bg-surface px-4" style={{ gridTemplateColumns: template, columnGap: GAP }}>
        {cols.map(col => {
          const on = sort.key === col.key;
          const Arrow = sort.dir === "asc" ? ChevronUp : ChevronDown;
          return (
            <button
              key={col.key}
              role="columnheader"
              aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
              onClick={() => onSort(nextSort(sort, col.key))}
              className={cn(
                "flex h-full min-w-0 items-center gap-0.5 whitespace-nowrap text-[12px] transition-colors",
                col.align === "right" && "justify-end",
                col.key === "name" && "pl-11",
                on ? "font-semibold text-label" : "font-medium text-label2 hover:text-label",
              )}
            >
              <span className="truncate">{col.label}</span>
              {on && <Arrow className="h-3.5 w-3.5 shrink-0 text-label2" strokeWidth={2.4} />}
            </button>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={SearchX} title="該当する医院はありません" message="検索の条件を変えてください。" action={<Button size="sm" variant="gray" onClick={onClearFilters}>条件をクリア</Button>} />
      ) : (
        <div tabIndex={0} onKeyDown={onKey} className="outline-none" aria-label="↑↓キーで医院を切り替え">
          <AnimatePresence initial={false}>
            {rows.map(c => {
              const sel = c.id === selected;
              return (
                <motion.div
                  key={c.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  transition={spring}
                  role="row"
                  aria-selected={sel}
                  onClick={() => onSelect(c.id)}
                  className={cn("group relative isolate grid min-h-[56px] cursor-default items-center px-4 py-2", !sel && "hover:bg-fill/[0.05]")}
                  style={{ gridTemplateColumns: template, columnGap: GAP }}
                >
                  {sel && <motion.div layoutId="console-clinic-selected" className="absolute inset-0 -z-10 bg-sand/20" transition={spring} />}
                  {/* 医院名 */}
                  <div role="cell" className="flex min-w-0 items-center gap-3">
                    <ClinicMark name={c.name} size={32} />
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium leading-5">{c.name}</span>
                        {!show("status") && !c.active && <Tag tone="outline" className="shrink-0">停止中</Tag>}
                      </div>
                      <div className="truncate text-[12px] leading-4 text-label2">{c.city}</div>
                    </div>
                  </div>
                  {show("plan") && <div role="cell" className="min-w-0"><PlanTag plan={c.plan} /></div>}
                  {show("units") && <div role="cell" className="text-right text-[14px] tnum">{c.units}</div>}
                  {show("staff") && <div role="cell" className="text-right text-[14px] tnum">{c.staff}</div>}
                  {show("appts") && (
                    <div role="cell" className="flex items-center justify-end gap-3">
                      <Sparkline data={weeks[c.id]} width={56} height={20} strokeWidth={1.5} area={false} dot={false} className={sel ? "text-accent" : "text-label3"} />
                      <span className="w-[42px] text-right text-[14px] tnum">{c.appts30d.toLocaleString("ja-JP")}</span>
                    </div>
                  )}
                  {show("web") && <div role="cell" className="text-right text-[14px] tnum">{Math.round(c.webRatio * 100)}%</div>}
                  {show("addons") && (
                    <div role="cell" className="flex items-center gap-2" title={c.addons.length ? c.addons.map(k => s.addons.find(a => a.key === k)?.name).join("、") : "オプションなし"}>
                      <span className="flex gap-[3px]">
                        {s.addons.map(a => (
                          <span key={a.key} className={cn("h-[7px] w-[7px] rounded-full transition-colors", c.addons.includes(a.key) ? "bg-accent" : "bg-fill/18")} />
                        ))}
                      </span>
                      <span className="text-[13px] text-label2 tnum">{c.addons.length}</span>
                    </div>
                  )}
                  {show("last") && <div role="cell" className="text-right text-[14px]"><LastActive clinic={c} text={ago(c.lastActiveAt, t)} /></div>}
                  {show("status") && (
                    <div role="cell" className="min-w-0 text-[13px] leading-[18px]">
                      <StateText clinic={c} className="block" />
                      <ReasonText clinic={c} withLast={!show("last")} className="block truncate text-[12px] leading-4" />
                    </div>
                  )}
                  <span aria-hidden className="pointer-events-none absolute bottom-0 left-[60px] right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
