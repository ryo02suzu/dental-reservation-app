// スマホの予約台帳。iPhone のカレンダーと同じく、週の帯で日を選び、下の予定表で1日を見る。
// 日付はこの画面の中で持つ（シェルは # の param が変わると画面を積み直すため、帯をタップするたびに
// 画面が入れ替わらないように）。# の param は開いたときの日付として使う。
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, ListFilter, Plus } from "lucide-react";
import { units as UNITS } from "@/data";
import { TODAY_KEY, useNow } from "@/lib/clock";
import { fromKey, key, relDay } from "@/lib/format";
import { Button, IconButton, Menu, MenuItem, MenuSeparator, Page, Segmented, cn, tap } from "@/ui";
import { useClinicUI } from "../../context";
import { isActive } from "../../helpers";
import { scheduleMemory } from "./memory";
import { PhoneAgenda, WeekStrip } from "./PhoneDay";
import { PhoneMonth, PhoneWeek } from "./PhoneViews";
import { StatLine } from "./parts";
import { closedInfo, isDateKey, nextOpenDay, periodTitle, shiftDate, useByDate, usePeriodStats, type View } from "./model";

const EMPTY: never[] = [];

export function PhoneSchedule({ param }: { param?: string }) {
  const ui = useClinicUI();
  const paramKey = isDateKey(param) ? param : TODAY_KEY;
  const [dk, setDk] = useState(paramKey);
  useEffect(() => setDk(paramKey), [paramKey]);
  const date = useMemo(() => fromKey(dk), [dk]);
  const [view, setViewState] = useState<View>(scheduleMemory.view);
  const [unit, setUnitState] = useState(scheduleMemory.unit);
  const [showCancelled, setShowCancelledState] = useState(scheduleMemory.cancelled);
  const [dir, setDir] = useState(0);
  const now = useNow(30_000);
  const byDate = useByDate();
  const nowRef = useRef<HTMLDivElement>(null);
  const { sum } = usePeriodStats(view, date, byDate, now);

  const setView = (v: View) => { scheduleMemory.view = v; setViewState(v); };
  const setUnit = (u: string) => { scheduleMemory.unit = u; setUnitState(u); };
  const setShowCancelled = (v: boolean) => { scheduleMemory.cancelled = v; setShowCancelledState(v); };

  const select = (d: Date) => {
    const k = key(d);
    setDir(k > dk ? 1 : k < dk ? -1 : 0);
    setDk(k);
  };
  const step = (n: number) => select(shiftDate(view === "month" ? "month" : "week", date, n));
  const openDay = (d: Date) => { setView("day"); select(d); };
  const toToday = () => {
    if (dk === TODAY_KEY) {
      if (view === "day") nowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    select(fromKey(TODAY_KEY));
  };

  // 今日の予定表を開いたら、「いま」の行が見える位置へ（終わった予約は折りたたんであるので少しだけ）
  useEffect(() => {
    if (view !== "day" || dk !== TODAY_KEY) return;
    const id = requestAnimationFrame(() => {
      const el = nowRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight - 140) el.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(id);
  }, [view, dk]);

  const closed = view === "day" ? closedInfo(date) : null;
  const past = view === "day" && dk < TODAY_KEY;
  const rel = relDay(date, fromKey(TODAY_KEY));
  const subtitle = closed ? (
    <span>
      <span className="font-medium">{rel}</span>
      <span className="px-1.5 text-label4">·</span>
      休診日{closed.holiday ? `（${closed.holiday}）` : ""}
    </span>
  ) : (
    <StatLine
      lead={view === "day" ? <span className={rel === "今日" ? "font-semibold text-accent" : "font-medium"}>{rel}</span> : undefined}
      items={[
        { label: "予約", value: sum.count, unit: "件" },
        ...(past ? [] : [{ label: "空き", value: sum.free, unit: "枠" }]),
        // スマホの週・月は1行に収めるため、稼働率は各日の行に任せる
        ...(past ? [{ label: "稼働率", value: Math.round(sum.util * 100), unit: "%" }] : []),
        ...(sum.pending && !past ? [{ label: "仮予約", value: sum.pending, unit: "件", tone: "accent" as const }] : []),
        ...(sum.late ? [{ label: "未来院", value: sum.late, unit: "件", tone: "red" as const }] : []),
      ]}
      className="gap-x-3"
    />
  );
  const unitLabel = view === "month" ? "月" : "週";
  const dayAppts = byDate.get(dk) ?? EMPTY;
  const cancelledCount = dayAppts.filter(a => !isActive(a) && (unit === "all" || a.unitId === unit)).length;
  // 休診日を表示しているときは、次の診療日で新規予約を開く
  const newDate = view === "day" ? (closed ? key(nextOpenDay(date)) : dk) : undefined;
  const unitShort = UNITS.find(u => u.id === unit)?.short;

  // ユニットの絞り込みとキャンセルの表示（iOS のカレンダーの「表示」メニューと同じく、右上にまとめる）
  const filterMenu = view === "day" && !closed && (
    <Menu
      trigger={
        <motion.button
          whileTap={tap}
          aria-label={unitShort ? `表示の絞り込み（${unitShort}）` : "表示の絞り込み"}
          className={cn(
            "flex items-center justify-center gap-1 rounded-full text-accent",
            // 絞り込み中は、砂色の小さなカプセルにして「いま絞っている」ことを見せる
            unitShort || showCancelled ? "my-[5px] h-[34px] bg-sand/25 px-3" : "h-11 w-11",
          )}
        >
          <ListFilter className="h-[20px] w-[20px]" strokeWidth={2.1} />
          {unitShort && <span className="text-[15px] font-semibold tnum">{unitShort}</span>}
        </motion.button>
      }
    >
      <MenuItem icon={unit === "all" ? Check : undefined} onSelect={() => setUnit("all")}>すべてのユニット</MenuItem>
      {UNITS.map(u => (
        <MenuItem key={u.id} icon={unit === u.id ? Check : undefined} onSelect={() => setUnit(u.id)}>{u.name}</MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem icon={showCancelled ? Check : undefined} onSelect={() => setShowCancelled(!showCancelled)}>
        キャンセルを表示{cancelledCount ? `（${cancelledCount}件）` : ""}
      </MenuItem>
    </Menu>
  );

  return (
    <Page
      title={periodTitle(view, date)}
      subtitle={subtitle}
      back={ui.back}
      actions={
        <>
          <Button variant="plain" size="sm" className="px-2.5 text-[17px] font-normal" onClick={toToday}>今日</Button>
          {filterMenu}
          <IconButton icon={Plus} label="新規予約" variant="plain" className="h-11 w-11" onClick={() => ui.openNew({ date: newDate })} />
        </>
      }
      accessory={
        <div className="flex items-center gap-2">
          <Segmented<View>
            full
            className="flex-1"
            value={view}
            onChange={setView}
            options={[{ value: "day", label: "日" }, { value: "week", label: "週" }, { value: "month", label: "月" }]}
          />
          <div className="flex h-[34px] items-center rounded-full bg-fill/12">
            <motion.button whileTap={tap} onClick={() => step(-1)} aria-label={`前の${unitLabel}`} className="flex h-[34px] w-10 items-center justify-center rounded-full text-label active:bg-fill/16">
              <ChevronLeft className="h-[19px] w-[19px]" strokeWidth={2.3} />
            </motion.button>
            <motion.button whileTap={tap} onClick={() => step(1)} aria-label={`次の${unitLabel}`} className="flex h-[34px] w-10 items-center justify-center rounded-full text-label active:bg-fill/16">
              <ChevronRight className="h-[19px] w-[19px]" strokeWidth={2.3} />
            </motion.button>
          </div>
        </div>
      }
    >
      <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className={cn(view === "day" && "-mt-2")}>
        {view === "day" && (
          <>
            <WeekStrip date={date} byDate={byDate} now={now} onSelect={select} onWeek={n => select(shiftDate("week", date, n))} />
            <PhoneAgenda
              date={date}
              dk={dk}
              appts={dayAppts}
              now={now}
              unit={unit}
              showCancelled={showCancelled}
              dir={dir}
              onOpen={ui.openAppointment}
              onNew={p => ui.openNew(p)}
              onJump={select}
              nowRef={nowRef}
            />
          </>
        )}
        {view === "week" && <PhoneWeek date={date} byDate={byDate} now={now} dir={dir} onOpenDay={openDay} />}
        {view === "month" && <PhoneMonth date={date} byDate={byDate} now={now} dir={dir} onOpenDay={openDay} />}
      </motion.div>
    </Page>
  );
}
