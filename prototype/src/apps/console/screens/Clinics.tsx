import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownWideNarrow, Check, SearchX } from "lucide-react";
import type { ConsoleClinic } from "@/data";
import { useIsPhone } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { Button, EmptyState, IconButton, ListRow, ListSection, Menu, MenuItem, Page, SearchField, Segmented, cn, spring } from "@/ui";
import { ClinicDetail } from "./parts/ClinicDetail";
import { ClinicTable, sortClinics, type SortState } from "./parts/ClinicTable";
import { isDormant, isGrowingFree, matchesClinic, needsAction, reasonOf } from "./parts/model";
import { useConsole } from "./parts/store";
import { ClinicMark, PlanTag, PushStack, useElementWidth } from "./parts/ui";

type Filter = "all" | "active" | "attention" | "stopped";
const FILTERS: { value: Filter; label: string; test: (c: ConsoleClinic) => boolean }[] = [
  { value: "all", label: "すべて", test: () => true },
  { value: "active", label: "稼働中", test: c => c.active },
  { value: "attention", label: "要対応", test: needsAction },
  { value: "stopped", label: "停止中", test: c => !c.active },
];

const SORTS: { label: string; sort: SortState }[] = [
  { label: "予約が多い順", sort: { key: "appts", dir: "desc" } },
  { label: "名前順", sort: { key: "name", dir: "asc" } },
  { label: "プランが上の順", sort: { key: "plan", dir: "desc" } },
  { label: "最終利用が古い順", sort: { key: "last", dir: "asc" } },
];

/** 医院（param = 医院ID）。PCは表＋右のインスペクタ、iPhoneは一覧 → 詳細 */
export default function ConsoleClinics({ param }: { param?: string }) {
  const phone = useIsPhone();
  const { go } = useRoute();
  const s = useConsole();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortState>({ key: "appts", dir: "desc" });
  const selected = param && s.clinics.some(c => c.id === param) ? param : undefined;

  const rows = useMemo(() => {
    const f = FILTERS.find(x => x.value === filter)!;
    return sortClinics(s.clinics.filter(c => f.test(c) && matchesClinic(c, query)), sort);
  }, [s.clinics, filter, query, sort]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(f => [f.value, s.clinics.filter(f.test).length])) as Record<Filter, number>, [s.clinics]);
  const subtitle = `契約 ${s.clinics.length}医院 · 稼働中 ${counts.active} · 要対応 ${counts.attention}`;
  const clear = () => {
    setQuery("");
    setFilter("all");
  };
  const props = { rows, query, setQuery, filter, setFilter, counts, subtitle, sort, setSort, clear };

  if (phone) {
    return (
      <PushStack depthKey={selected}>
        {selected ? (
          <DetailPage id={selected} onBack={() => go("clinics")} />
        ) : (
          <PhoneList {...props} onOpen={id => go("clinics", id)} />
        )}
      </PushStack>
    );
  }
  return <DesktopClinics {...props} selected={selected} />;
}

interface ListProps {
  rows: ConsoleClinic[];
  query: string;
  setQuery: (v: string) => void;
  filter: Filter;
  setFilter: (v: Filter) => void;
  counts: Record<Filter, number>;
  subtitle: string;
  sort: SortState;
  setSort: (s: SortState) => void;
  clear: () => void;
}

function FilterBar({ filter, setFilter, counts, full }: Pick<ListProps, "filter" | "setFilter" | "counts"> & { full?: boolean }) {
  return (
    <Segmented
      full={full}
      size={full ? "sm" : "md"}
      value={filter}
      onChange={setFilter}
      options={FILTERS.map(f => ({ value: f.value, label: f.label, count: counts[f.value] }))}
    />
  );
}

// ─── iPhone ─────────────────────────────────────────────────────────────────
function PhoneList({ rows, query, setQuery, filter, setFilter, counts, subtitle, sort, setSort, clear, onOpen }: ListProps & { onOpen: (id: string) => void }) {
  return (
    <Page
      title="医院"
      subtitle={subtitle}
      actions={
        <Menu trigger={<IconButton icon={ArrowDownWideNarrow} label="並べ替え" variant="plain" />}>
          {SORTS.map(o => (
            <MenuItem key={o.label} icon={o.sort.key === sort.key && o.sort.dir === sort.dir ? Check : undefined} onSelect={() => setSort(o.sort)}>
              {o.label}
            </MenuItem>
          ))}
        </Menu>
      }
      accessory={
        <div className="space-y-3">
          <SearchField value={query} onChange={setQuery} placeholder="医院名・地域で検索" />
          <FilterBar filter={filter} setFilter={setFilter} counts={counts} full />
        </div>
      }
    >
      {rows.length ? (
        <ListSection footer={`${rows.length}医院 · ${SORTS.find(o => o.sort.key === sort.key && o.sort.dir === sort.dir)?.label ?? "並べ替え中"}`}>
          {rows.map(c => (
            <ListRow
              key={c.id}
              leading={<ClinicMark name={c.name} size={40} />}
              inset={68}
              title={
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-medium">{c.name}</span>
                  <PlanTag plan={c.plan} className="shrink-0" />
                </span>
              }
              subtitle={
                <>
                  {c.city} · <PhoneState clinic={c} />
                </>
              }
              value={<span className="tnum">{c.appts30d.toLocaleString("ja-JP")}件</span>}
              chevron
              onClick={() => onOpen(c.id)}
            />
          ))}
        </ListSection>
      ) : (
        <EmptyState icon={SearchX} title="該当する医院はありません" message="検索の文字や、絞り込みの条件を変えてください。" action={<Button size="sm" variant="gray" onClick={clear}>条件をクリア</Button>} />
      )}
    </Page>
  );
}

function PhoneState({ clinic }: { clinic: ConsoleClinic }) {
  if (!clinic.active) return <span className="text-label2">停止中</span>;
  const r = reasonOf(clinic);
  if (!r) return <span>稼働中</span>;
  return <span className={isDormant(clinic) ? "text-red" : isGrowingFree(clinic) ? "text-accent" : "text-label2"}>{r}</span>;
}

function DetailPage({ id, onBack }: { id: string; onBack: () => void }) {
  const s = useConsole();
  const c = s.clinics.find(x => x.id === id);
  return (
    <Page title={c?.name ?? "医院"} hideLargeTitle back={{ label: "医院", onClick: onBack }}>
      <div className="mx-auto max-w-[640px] pt-2">
        <ClinicDetail id={id} variant="page" />
      </div>
    </Page>
  );
}

// ─── PC ─────────────────────────────────────────────────────────────────────
const GAP = 24;

function DesktopClinics({ rows, query, setQuery, filter, setFilter, counts, subtitle, sort, setSort, clear, selected }: ListProps & { selected?: string }) {
  const { go, route } = useRoute();
  const [rootRef, rootW] = useElementWidth<HTMLDivElement>(typeof window === "undefined" ? 1200 : window.innerWidth - 232);
  const content = rootW - 64; // Page の左右の余白
  const insp = content >= 1000 ? 360 : 340;
  const push = content - insp - GAP < 320; // 表と並べる余地がない（iPadの縦など）
  const tableW = selected && !push ? content - insp - GAP : content;
  const close = () => go("clinics");

  // Esc で閉じる（シートを開いているとき・入力中は除く）
  useEffect(() => {
    if (!selected) return;
    const on = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || route.sheet) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (document.querySelector("[role=dialog]")) return;
      go("clinics");
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [selected, route.sheet, go]);

  const listPage = (
    <Page
      title="医院"
      subtitle={subtitle}
      wide
      accessory={
        <div className="flex flex-wrap items-center gap-3">
          <SearchField value={query} onChange={setQuery} placeholder="医院名・地域で検索" className="w-[240px]" />
          <FilterBar filter={filter} setFilter={setFilter} counts={counts} />
        </div>
      }
    >
      <div className="flex items-start">
        <div className="min-w-0 flex-1">
          <ClinicTable
            rows={rows}
            width={tableW}
            sort={sort}
            onSort={setSort}
            selected={selected}
            onSelect={id => go("clinics", id, { replace: !!selected })}
            onClose={close}
            onClearFilters={clear}
          />
          <p className="px-4 pt-2 text-footnote text-label3">見出しを押すと並べ替えます。↑↓キーで医院を切り替え、escで閉じます。</p>
        </div>
        <AnimatePresence initial={false}>
          {selected && !push && (
            <motion.aside
              key="inspector"
              aria-label="医院の詳細"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: insp + GAP, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={spring}
              className="sticky top-[60px] shrink-0 self-start overflow-hidden"
            >
              <div style={{ width: insp, marginLeft: GAP }} className={cn("no-scrollbar max-h-[calc(100dvh-76px)] overflow-y-auto overscroll-contain")}>
                <motion.div key={selected} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>
                  <ClinicDetail id={selected} variant="inspector" onClose={close} />
                </motion.div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </Page>
  );

  return (
    <div ref={rootRef} className="h-full">
      {push ? <PushStack depthKey={selected}>{selected ? <DetailPage id={selected} onBack={close} /> : listPage}</PushStack> : listPage}
    </div>
  );
}
