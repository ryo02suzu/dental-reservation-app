// PC・iPad の予約台帳（日・週・月）
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { TODAY_KEY, useNow } from "@/lib/clock";
import { fromKey, key, relDay } from "@/lib/format";
import { useIsWide } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { Button, IconButton, Page, Segmented } from "@/ui";
import { useClinicUI, type NewPrefill } from "../../context";
import { ClosedDay } from "./ClosedDay";
import { DayGrid } from "./DayGrid";
import { MonthGrid } from "./MonthGrid";
import { Pager, StatLine, ToggleChip } from "./parts";
import { WeekGrid } from "./WeekGrid";
import {
  PERIOD_UNIT, closedInfo, isDateKey, periodTitle, shiftDate, useByDate, usePeriodStats, type ColumnMode, type View,
} from "./model";
import { scheduleMemory } from "./memory";

const EMPTY: never[] = [];

export function DesktopSchedule({ param }: { param?: string }) {
  const ui = useClinicUI();
  const { go, route } = useRoute();
  const wide = useIsWide();
  const dk = isDateKey(param) ? param : TODAY_KEY;
  const date = useMemo(() => fromKey(dk), [dk]);
  const [view, setViewState] = useState<View>(scheduleMemory.view);
  const [mode, setModeState] = useState<ColumnMode>(scheduleMemory.mode);
  const [showCancelled, setShowCancelledState] = useState(scheduleMemory.cancelled);
  const [dir, setDir] = useState(0);
  const now = useNow(30_000);
  const byDate = useByDate();
  const dayAppts = byDate.get(dk) ?? EMPTY;

  const setView = (v: View) => { scheduleMemory.view = v; setViewState(v); };
  const setMode = (m: ColumnMode) => { scheduleMemory.mode = m; setModeState(m); };
  const setShowCancelled = (v: boolean) => { scheduleMemory.cancelled = v; setShowCancelledState(v); };

  const goDate = useCallback((d: Date, direction = 0) => {
    setDir(direction);
    go("schedule", key(d), { replace: true });
  }, [go]);
  const step = useCallback((n: number) => goDate(shiftDate(view, date, n), n), [goDate, view, date]);
  const toToday = useCallback(() => goDate(fromKey(TODAY_KEY), dk < TODAY_KEY ? 1 : -1), [goDate, dk]);
  const openDay = (d: Date) => { setView("day"); goDate(d, 0); };

  // ← → で前後、T で今日（シートを開いているときと入力中は除く）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (route.sheet || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.closest("input, textarea, select, [contenteditable=true], [role=dialog]"))) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "t" || e.key === "T") toToday();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [route.sheet, step, toToday]);

  // ─── 見出しの下の数字 ───
  const { sum } = usePeriodStats(view, date, byDate, now);
  const closed = view === "day" ? closedInfo(date) : null;
  const isPast = view === "day" ? dk < TODAY_KEY : false;

  const rel = relDay(date, fromKey(TODAY_KEY));
  const subtitle = closed ? (
    <span>
      <span className="font-medium">{rel}</span>
      <span className="px-2 text-label4">·</span>
      休診日{closed.holiday ? `（${closed.holiday}）` : ""}
    </span>
  ) : (
    <StatLine
      lead={view === "day" ? <span className={rel === "今日" ? "font-semibold text-accent" : "font-medium text-label2"}>{rel}</span> : view === "month" ? <span>診療日 <span className="font-semibold text-label">{sum.openDays}</span>日</span> : undefined}
      items={[
        { label: "予約", value: sum.count, unit: "件" },
        ...(isPast ? [] : [{ label: "空き", value: sum.free, unit: "枠" }]),
        { label: "稼働率", value: Math.round(sum.util * 100), unit: "%" },
        ...(sum.pending ? [{ label: "仮予約", value: sum.pending, unit: "件", tone: "accent" as const }] : []),
        ...(sum.late ? [{ label: "未来院", value: sum.late, unit: "件", tone: "red" as const }] : []),
      ]}
    />
  );

  const isCurrent = view === "day" ? dk === TODAY_KEY : periodTitle(view, date) === periodTitle(view, fromKey(TODAY_KEY));
  const onNew = (p: NewPrefill) => ui.openNew(p);
  const cancelledCount = dayAppts.length - dayAppts.filter(a => a.status !== "cancelled" && a.status !== "no_show").length;

  return (
    <Page
      title={periodTitle(view, date)}
      subtitle={subtitle}
      wide
      back={ui.back}
      actions={
        <>
          <Pager
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onToday={toToday}
            prevLabel={`前の${PERIOD_UNIT[view]}`}
            nextLabel={`次の${PERIOD_UNIT[view]}`}
            isCurrent={isCurrent}
          />
          {wide ? (
            <Button size="sm" icon={Plus} className="ml-1.5" onClick={() => ui.openNew({ date: view === "day" ? dk : undefined })}>
              予約を追加
            </Button>
          ) : (
            <IconButton icon={Plus} label="予約を追加" variant="filled" size="sm" className="ml-1" onClick={() => ui.openNew({ date: view === "day" ? dk : undefined })} />
          )}
        </>
      }
      accessory={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[{ value: "day", label: "日" }, { value: "week", label: "週" }, { value: "month", label: "月" }]}
            className="w-[180px]"
          />
          {view === "day" && !closed && (
            <div className="flex items-center gap-2">
              <Segmented<ColumnMode>
                size="sm"
                value={mode}
                onChange={setMode}
                options={[{ value: "unit", label: "ユニット" }, { value: "staff", label: "担当者" }]}
              />
              <ToggleChip on={showCancelled} onChange={setShowCancelled} count={cancelledCount}>キャンセルを表示</ToggleChip>
            </div>
          )}
        </div>
      }
    >
      <motion.div
        key={view}
        className="-mx-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {view === "day" && (closed ? (
          <ClosedDay date={date} onJump={d => goDate(d, 1)} />
        ) : (
          <DayGrid
            date={date}
            dk={dk}
            appts={dayAppts}
            mode={mode}
            showCancelled={showCancelled}
            now={now}
            dir={dir}
            onOpen={ui.openAppointment}
            onNew={onNew}
          />
        ))}
        {view === "week" && <WeekGrid date={date} byDate={byDate} now={now} dir={dir} onOpenDay={openDay} onOpen={ui.openAppointment} onNew={onNew} />}
        {view === "month" && <MonthGrid date={date} byDate={byDate} now={now} dir={dir} onOpenDay={openDay} />}
      </motion.div>
    </Page>
  );
}
