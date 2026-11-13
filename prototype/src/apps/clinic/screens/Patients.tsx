import { useCallback, useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";
import { useRoute } from "@/lib/nav";
import { useIsPhone, useIsWide } from "@/lib/media";
import { Button, EmptyState, Page } from "@/ui";
import { useClinicUI } from "../context";
import { ColumnPage } from "./patients/ColumnPage";
import { PatientDetail } from "./patients/PatientDetail";
import { ListActions, ListControls, PatientSections, useVisibleSections } from "./patients/PatientList";
import { AddPatientSheet } from "./patients/PatientSheets";
import { useIsSplit, useListState, usePatientIndex } from "./patients/hooks";

/**
 * 患者。iPad横・Mac は「一覧｜詳細」の2段組み（連絡先アプリと同じ）、
 * スマホと iPad縦 は一覧 → 詳細を横に積み重ねる。
 */
export default function PatientsScreen({ param }: { param?: string }) {
  const ui = useClinicUI();
  const { go } = useRoute();
  const phone = useIsPhone();
  const split = useIsSplit();
  const wide = useIsWide();
  const state = useListState();
  const index = usePatientIndex();
  const { sections, counts, order, total } = useVisibleSections(state, index);
  const [adding, setAdding] = useState(false);
  const [flash, setFlash] = useState<string>();
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = param ? index.patients.find(p => p.id === param) : undefined;

  const select = useCallback(
    (id: string) => {
      if (split) go("patients", id, { replace: true });
      else go("patients", id);
    },
    [split, go],
  );

  // 2段組みで何も選んでいないときは、一覧の先頭の人を開いておく（連絡先アプリと同じ）
  useEffect(() => {
    if (split && !param && order.length) go("patients", order[0], { replace: true });
  }, [split, param, order, go]);

  // 2段組みで検索・絞り込みを変えたら、結果の先頭の人を開く（選んでいた人が結果に残っていれば、そのまま）
  const filterKey = `${state.query}\u0000${state.filter}`;
  const lastFilter = useRef(filterKey);
  useEffect(() => {
    if (lastFilter.current === filterKey) return;
    lastFilter.current = filterKey;
    if (split && order.length && (!param || !order.includes(param))) go("patients", order[0], { replace: true });
  }, [filterKey, split, order, param, go]);

  // 2段組みで開いたとき、選ばれている患者が一覧で見えるようにする
  useEffect(() => {
    if (!split || !param) return;
    const id = requestAnimationFrame(() => reveal(listRef.current, param, "center"));
    return () => cancelAnimationFrame(id);
    // 開いたときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [split]);

  // 2段組み：↑↓ で前後の患者へ（入力中は除く）
  useEffect(() => {
    if (!split) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, [role=menu], [role=dialog]") || t.isContentEditable)) return;
      if (!order.length) return;
      e.preventDefault();
      const i = param ? order.indexOf(param) : -1;
      const next = order[Math.max(0, Math.min(order.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (!next || next === param) return;
      go("patients", next, { replace: true });
      requestAnimationFrame(() => reveal(listRef.current, next, "nearest"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [split, order, param, go]);

  const onAdded = (id: string) => {
    setAdding(false);
    state.setQuery("");
    state.setFilter("all");
    setFlash(id);
    if (split) {
      go("patients", id, { replace: true });
      requestAnimationFrame(() => requestAnimationFrame(() => reveal(listRef.current, id, "center")));
    } else go("patients", id);
  };

  const sheet = <AddPatientSheet open={adding} onClose={() => setAdding(false)} onAdded={p => onAdded(p.id)} />;
  const actions = <ListActions state={state} onAdd={() => setAdding(true)} />;
  const missing = (
    <EmptyState
      icon={UserRound}
      title="患者が見つかりません"
      message="一覧から選び直してください。"
      action={<Button variant="gray" size="sm" onClick={() => go("patients")}>患者の一覧へ</Button>}
    />
  );

  // ─── iPad横・Mac：一覧｜詳細 ────────────────────────────────────────────
  if (split) {
    return (
      <div className="flex h-full min-w-0">
        <ColumnPage title="患者" width={wide ? 352 : 320} actions={actions} pinned={<ListControls state={state} counts={counts} size="sm" />} scrollRef={listRef}>
          {top => (
            <PatientSections
              sections={sections}
              total={total}
              state={state}
              index={index}
              selectedId={param}
              onSelect={select}
              stickyTop={top}
              bleed={16}
              column
              narrow={!wide}
              flashId={flash}
              onAdd={() => setAdding(true)}
            />
          )}
        </ColumnPage>
        <div className="relative min-w-0 flex-1">
          {selected ? (
            <PatientDetail key={selected.id} p={selected} />
          ) : param ? (
            <div className="flex h-full items-center justify-center">{missing}</div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState icon={UserRound} title="患者が選ばれていません" message="左の一覧から患者を選ぶと、ここに詳細が出ます。" />
            </div>
          )}
        </div>
        {sheet}
      </div>
    );
  }

  // ─── スマホ・iPad縦：詳細（一覧の上に積み重なる） ─────────────────────
  const back = { label: "患者", onClick: () => go("patients") };
  if (param) {
    return (
      <>
        {selected ? (
          <PatientDetail key={selected.id} p={selected} back={back} />
        ) : (
          <Page title="患者" back={back} hideLargeTitle>
            {missing}
          </Page>
        )}
        {sheet}
      </>
    );
  }

  // ─── スマホ・iPad縦：一覧 ──────────────────────────────────────────────
  return (
    <>
      <Page
        title="患者"
        back={ui.back}
        actions={actions}
        accessory={<ListControls state={state} counts={counts} />}
      >
        <PatientSections
          sections={sections}
          total={total}
          state={state}
          index={index}
          onSelect={select}
          stickyTop={phone ? 44 : 52}
          bleed={phone ? 16 : 32}
          phone={phone}
          flashId={flash}
          onAdd={() => setAdding(true)}
          rememberScroll
        />
      </Page>
      {sheet}
    </>
  );
}

/**
 * 一覧の列の中だけをスクロールして、その患者の行を見せる
 * （scrollIntoView は外側の領域まで動かしてしまうので使わない）
 */
function reveal(list: HTMLElement | null, id: string, mode: "center" | "nearest") {
  const row = list?.querySelector<HTMLElement>(`[data-pid="${id}"]`);
  if (!list || !row) return;
  const lr = list.getBoundingClientRect();
  const rr = row.getBoundingClientRect();
  const top = parseFloat(getComputedStyle(row).scrollMarginTop) || 0;
  const y = rr.top - lr.top + list.scrollTop;
  if (mode === "center") {
    list.scrollTop = Math.max(0, y - (lr.height - rr.height) / 2);
    return;
  }
  if (rr.top < lr.top + top) list.scrollTop = y - top;
  else if (rr.bottom > lr.bottom - 12) list.scrollTop = y + rr.height - lr.height + 12;
}
