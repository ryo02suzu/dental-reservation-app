import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { attendanceToday } from "@/data";
import { TODAY, minutesOfDay, now } from "@/lib/clock";
import { hm, mdw } from "@/lib/format";
import { staffById } from "@/data";
import { useIsPhone } from "@/lib/media";
import { Page, Segmented, useToast } from "@/ui";
import { useClinicUI } from "../context";
import { ME_ID, MonthTable, PunchCard, TodayList, applyPunch, type Punch, type PunchKind } from "./staff/AttendanceView";
import { Requests, ShiftDayList, ShiftGrid, ShiftSheet, WeekNav, type Edits } from "./staff/ShiftView";
import { baseCell, cellKey, initialRequests, weekDays, type Cell, type LeaveRequest } from "./staff/model";

type Tab = "shift" | "attendance";

const PUNCH_TOAST: Record<PunchKind, string> = { in: "出勤を記録しました", breakStart: "休憩を開始しました", breakEnd: "休憩を終了しました", out: "退勤を記録しました" };

/** 今日の勤怠（シフトで休みの人は「休み」にそろえる） */
function initialRows(): Punch[] {
  return attendanceToday.map(r => {
    const off = baseCell(r.staffId, TODAY).off;
    const breaks = r.breakStart !== undefined ? [{ start: r.breakStart, end: r.breakEnd }] : [];
    return off && r.clockIn === undefined ? { ...r, state: "休み", breaks } : { ...r, breaks };
  });
}

/** シフト（週の表）と勤怠（打刻・今日の出勤状況・今月のまとめ） */
export default function StaffScreen({ param }: { param?: string }) {
  const ui = useClinicUI();
  const phone = useIsPhone();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(param === "attendance" ? "attendance" : "shift");
  const [offset, setOffset] = useState(0);
  const [edits, setEdits] = useState<Edits>({});
  const [editing, setEditing] = useState<Cell | null>(null);
  const [rows, setRows] = useState<Punch[]>(initialRows);
  const [history, setHistory] = useState<Punch[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>(initialRequests);
  const decide = (r: LeaveRequest, ok: boolean) => {
    setRequests(rs => rs.filter(x => x.id !== r.id));
    if (ok) setEdits(e => ({ ...e, [cellKey(r.staffId, r.date)]: { off: true, note: "希望休" } }));
    toast(ok ? "希望休を承認しました" : "申請を見送りました", { detail: `${staffById(r.staffId).name} · ${mdw(new Date(`${r.date}T00:00:00`))}` });
  };
  const days = useMemo(() => weekDays(offset), [offset]);
  const me = rows.find(r => r.staffId === ME_ID)!;

  const punch = (k: PunchKind) => {
    const at = minutesOfDay(now());
    setHistory(h => [...h, me]);
    setRows(rs => rs.map(r => (r.staffId === ME_ID ? applyPunch(r, k, at) : r)));
    toast(PUNCH_TOAST[k], { detail: hm(at) });
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(h => h.slice(0, -1));
    setRows(rs => rs.map(r => (r.staffId === ME_ID ? prev : r)));
    toast("打刻を取り消しました");
  };
  const saveCell = (c: Cell) => setEdits(e => ({ ...e, [cellKey(c.staffId, c.date)]: { start: c.start, end: c.end, off: c.off, note: c.note } }));

  const seg = (
    <Segmented
      value={tab}
      onChange={setTab}
      options={[{ value: "shift", label: "シフト" }, { value: "attendance", label: "勤怠" }]}
      full={phone}
      className={phone ? undefined : "w-[220px]"}
    />
  );

  return (
    <Page
      title="シフト・勤怠"
      back={ui.back}
      wide={!phone && tab === "shift"}
      accessory={phone ? seg : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {seg}
          {tab === "shift" && <WeekNav offset={offset} onChange={setOffset} days={days} className="flex-row-reverse" />}
        </div>
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.2 }}>
          {tab === "shift" ? (
            phone ? (
              <>
                <ShiftDayList offset={offset} edits={edits} onEdit={setEditing} onWeek={setOffset} />
                <div className="mt-5"><Requests items={requests} onDecide={decide} /></div>
              </>
            ) : (
              <div className="mx-auto max-w-[1240px]">
                <ShiftGrid offset={offset} edits={edits} onEdit={setEditing} />
                <p className="px-4 pt-2 text-footnote text-label2">枠を押すと出勤・退勤の時刻や休みを変更できます。週の時間は昼休み（13:00〜14:30）を除いた時間です。</p>
                <div className="mt-5 max-w-[720px]"><Requests items={requests} onDecide={decide} /></div>
              </div>
            )
          ) : phone ? (
            <>
              <PunchCard me={me} onPunch={punch} onUndo={undo} canUndo={history.length > 0} />
              <TodayList rows={rows} />
              <MonthTable />
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
                <PunchCard me={me} onPunch={punch} onUndo={undo} canUndo={history.length > 0} />
                <TodayList rows={rows} />
              </div>
              <MonthTable />
            </>
          )}
        </motion.div>
      </AnimatePresence>
      <ShiftSheet cell={editing} onClose={() => setEditing(null)} onSave={saveCell} />
    </Page>
  );
}
