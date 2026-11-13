import { useMemo } from "react";
import { useIsDesktop, useIsWide } from "@/lib/media";
import { AnimatePresence, motion } from "framer-motion";
import { Coffee, Ellipsis, LogIn, LogOut, MessageSquareText, Play, RotateCcw, UserX } from "lucide-react";
import { staff, staffById, type AttendanceRow } from "@/data";
import { TODAY, minutesOfDay, useNow } from "@/lib/clock";
import { hm, mdw } from "@/lib/format";
import { Avatar, Button, IconButton, ListRow, ListSection, Menu, MenuItem, MenuSeparator, cn } from "@/ui";
import { baseCell, hours, monthSummary } from "./model";

export const ME_ID = "s6";
export type Punch = AttendanceRow & {
  breaks: { start: number; end?: number }[];
  /** 受付が残した連絡（遅刻の連絡・欠勤）と、代わりに打刻したか */
  note?: "遅刻の連絡あり" | "欠勤";
  proxy?: boolean;
};
/** まだ来ていない人への対応（受付が代わりに記録する） */
export type AbsenceAction = "lateNotice" | "absent" | "proxyIn";
type State = AttendanceRow["state"];

/** 打刻の行動 */
export type PunchKind = "in" | "breakStart" | "breakEnd" | "out";

export function applyPunch(r: Punch, kind: PunchKind, at: number): Punch {
  switch (kind) {
    case "in": return { ...r, clockIn: at, state: "勤務中" };
    case "breakStart": return { ...r, breaks: [...r.breaks, { start: at }], breakStart: at, breakEnd: undefined, state: "休憩中" };
    case "breakEnd": return { ...r, breaks: r.breaks.map((b, i) => (i === r.breaks.length - 1 ? { ...b, end: at } : b)), breakEnd: at, state: "勤務中" };
    case "out": return { ...r, clockOut: at, state: "退勤" };
  }
}

/** 勤務した時間（いままで・休憩を除く） */
function worked(r: Punch, nowMin: number) {
  if (r.clockIn === undefined) return 0;
  const end = r.clockOut ?? nowMin;
  const br = r.breaks.reduce((a, b) => a + Math.max(0, (b.end ?? (r.state === "休憩中" ? nowMin : b.start)) - b.start), 0);
  return Math.max(0, end - r.clockIn - br);
}

const breakText = (r: Punch) => {
  if (!r.breaks.length) return undefined;
  const last = r.breaks[r.breaks.length - 1];
  return `${hm(last.start)}–${last.end !== undefined ? hm(last.end) : ""}`;
};

/** 予定の出勤時刻を過ぎても打刻がない */
function isLate(r: Punch, nowMin: number) {
  if (r.state !== "未出勤" || r.note) return false;
  const c = baseCell(r.staffId, TODAY);
  return !c.off && c.start !== undefined && nowMin > c.start + 10;
}

function StatePill({ r, nowMin }: { r: Punch; nowMin: number }) {
  const late = isLate(r, nowMin);
  const cls: Record<State, string> = {
    勤務中: "bg-sand/35 text-label",
    休憩中: "text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.55)]",
    退勤: "bg-fill/12 text-label2",
    未出勤: late ? "text-red shadow-[inset_0_0_0_1px_rgb(var(--red)/0.45)]" : "text-label2 shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.35)]",
    休み: "bg-fill/8 text-label3",
  };
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={`${r.state}-${r.note ?? ""}`}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={cn("inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold", r.note === "欠勤" ? "bg-fill/12 text-label2" : cls[r.state])}
      >
        {r.note === "欠勤" ? "欠勤" : r.note === "遅刻の連絡あり" && r.state === "未出勤" ? "遅刻の連絡あり" : r.state}
      </motion.span>
    </AnimatePresence>
  );
}

// ─── 打刻 ───────────────────────────────────────────────────────────────────
export function PunchCard({ me, onPunch, onUndo, canUndo }: { me: Punch; onPunch: (k: PunchKind) => void; onUndo: () => void; canUndo: boolean }) {
  // 秒は出さない（打刻に秒は要らず、1秒ごとに数字が変わり続けると落ち着かない）
  const now = useNow(10_000);
  const s = staffById(ME_ID);
  const shift = baseCell(ME_ID, TODAY);
  const nowMin = minutesOfDay(now);
  const enabled: Record<PunchKind, boolean> = {
    in: me.state === "未出勤" || me.state === "休み",
    breakStart: me.state === "勤務中",
    breakEnd: me.state === "休憩中",
    out: me.state === "勤務中",
  };
  const primary: PunchKind | undefined = enabled.in ? "in" : enabled.breakEnd ? "breakEnd" : enabled.breakStart ? "breakStart" : undefined;
  const btns: { k: PunchKind; label: string; icon: typeof LogIn }[] = [
    { k: "in", label: "出勤", icon: LogIn },
    { k: "breakStart", label: "休憩開始", icon: Coffee },
    { k: "breakEnd", label: "休憩終了", icon: Play },
    { k: "out", label: "退勤", icon: LogOut },
  ];
  const times: { label: string; value?: string }[] = [
    { label: "出勤", value: me.clockIn !== undefined ? hm(me.clockIn) : undefined },
    { label: "休憩", value: breakText(me) },
    { label: "退勤", value: me.clockOut !== undefined ? hm(me.clockOut) : undefined },
  ];
  return (
    <section aria-label="打刻" className="rounded-card bg-surface p-4 md:p-5">
      <div className="flex items-center gap-3">
        <Avatar name={s.name} tone={s.tone} size={40} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold leading-5">{s.name}</div>
          <div className="truncate text-[13px] leading-[18px] text-label2 tnum">{s.role} · 予定 {shift.off ? "休み" : `${hm(shift.start!)}–${hm(shift.end!)}`}</div>
        </div>
        <StatePill r={me} nowMin={nowMin} />
      </div>

      <div className="mt-6 text-center">
        <div className="text-[13px] text-label2 tnum">{mdw(TODAY)}</div>
        <div className="mt-1 text-[52px] font-semibold leading-none tracking-[-0.03em] tnum" aria-live="off">
          {hm(nowMin)}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 rounded-cell bg-fill/6 py-2.5">
        {times.map((t, i) => (
          <div key={t.label} className={cn("flex flex-col items-center", i > 0 && "hairline-l")}>
            <span className="text-[12px] text-label2">{t.label}</span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={t.value ?? "-"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={cn("mt-0.5 text-[17px] font-semibold tnum", !t.value && "text-label4")}>
                {t.value ?? "—"}
              </motion.span>
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {btns.map(b => (
          <Button key={b.k} size="lg" icon={b.icon} variant={b.k === primary ? "filled" : "gray"} disabled={!enabled[b.k]} onClick={() => onPunch(b.k)} full>
            {b.label}
          </Button>
        ))}
      </div>

      <div className="mt-3 flex h-8 items-center justify-between text-[13px] text-label2">
        <span className="tnum">{me.clockIn !== undefined ? `本日の勤務 ${hours(worked(me, nowMin))}` : "まだ出勤していません"}</span>
        {canUndo && (
          <button onClick={onUndo} className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-accent hover:bg-fill/8">
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.4} />
            打刻を取り消す
          </button>
        )}
      </div>
    </section>
  );
}

/** 表を出せる幅（1024px以上）か。狭いときはiOSのリストにする */
const useNarrow = () => !useIsDesktop();

// ─── 今日の出勤状況 ─────────────────────────────────────────────────────────
/** 予定の時刻を過ぎて来ていない人（と、遅刻の連絡があった人）には、受付が代わりに記録できるようにする */
const canAct = (r: Punch, nowMin: number) => r.state === "未出勤" && (r.note === "遅刻の連絡あり" || isLate(r, nowMin));

function AbsenceMenu({ r, onAct }: { r: Punch; onAct: (staffId: string, a: AbsenceAction) => void }) {
  const s = staffById(r.staffId);
  return (
    <Menu trigger={<IconButton icon={Ellipsis} label={`${s.name}さんの対応`} variant="plain" size="sm" className="text-label2" />}>
      <MenuItem icon={LogIn} onSelect={() => onAct(r.staffId, "proxyIn")}>代わりに出勤を記録</MenuItem>
      {r.note !== "遅刻の連絡あり" && <MenuItem icon={MessageSquareText} onSelect={() => onAct(r.staffId, "lateNotice")}>遅刻の連絡あり</MenuItem>}
      <MenuSeparator />
      <MenuItem icon={UserX} onSelect={() => onAct(r.staffId, "absent")}>欠勤にする</MenuItem>
    </Menu>
  );
}

export function TodayList({ rows, flush, onAct }: { rows: Punch[]; flush?: boolean; onAct: (staffId: string, a: AbsenceAction) => void }) {
  // 打刻の横に並ぶので、表は1180px以上（右の列に十分な幅があるとき）だけ。それより狭ければリストにする
  const phone = !useIsWide();
  const now = useNow(20_000);
  const nowMin = minutesOfDay(now);
  const working = rows.filter(r => r.state === "勤務中" || r.state === "休憩中").length;
  const header = <span className="tnum">今日の出勤状況 · 出勤中 {working}人</span>;
  if (phone) {
    return (
      <ListSection header={header} className={flush ? "!mt-0" : undefined}>
        {rows.map(r => {
          const s = staffById(r.staffId);
          const late = isLate(r, nowMin);
          const c = baseCell(r.staffId, TODAY);
          const brMin = r.breaks.reduce((a, b) => a + ((b.end ?? b.start) - b.start), 0);
          const parts = r.note === "欠勤" ? [`欠勤 · 予定 ${c.start !== undefined ? hm(c.start) : "—"}`]
            : r.state === "休み" ? ["本日は休み"]
            : r.clockIn === undefined ? [`予定 ${c.start !== undefined ? hm(c.start) : "—"}`]
            : r.clockOut !== undefined ? [`${hm(r.clockIn)}–${hm(r.clockOut)}`, brMin > 0 && `休憩 ${hours(brMin)}`]
            : [`出勤 ${hm(r.clockIn)}`, breakText(r) && `休憩 ${breakText(r)}`];
          return (
            <ListRow
              key={r.staffId}
              leading={<Avatar name={s.name} tone={s.tone} size={36} />}
              inset={64}
              title={<>{s.name}<span className="ml-1.5 text-[13px] text-label2">{s.role}</span></>}
              subtitle={<span className="tnum">{parts.filter(Boolean).join(" · ")}</span>}
              trailing={
                <span className="flex items-center gap-1">
                  <StatePill r={r} nowMin={nowMin} />
                  {canAct(r, nowMin) && <AbsenceMenu r={r} onAct={onAct} />}
                </span>
              }
            />
          );
        })}
      </ListSection>
    );
  }
  const cols = "minmax(168px,1.6fr) 120px minmax(84px,0.9fr) repeat(2, minmax(64px,0.7fr)) minmax(84px,0.8fr) 32px";
  return (
    <section>
      <h3 className="px-4 pb-1.5 text-footnote font-medium text-label2">{header}</h3>
      <div className="overflow-hidden rounded-cell bg-surface">
        <div className="hairline-b grid h-9 items-center px-4 text-[12px] font-medium text-label2" style={{ gridTemplateColumns: cols }}>
          <span>スタッフ</span><span>状態</span><span>出勤</span><span>休憩</span><span>退勤</span><span className="text-right">勤務時間</span><span />
        </div>
        {rows.map(r => {
          const s = staffById(r.staffId);
          const late = isLate(r, nowMin);
          const c = baseCell(r.staffId, TODAY);
          return (
            <div key={r.staffId} className="hairline-b grid h-[56px] items-center px-4 text-[14px] tnum last:shadow-none" style={{ gridTemplateColumns: cols }}>
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={s.name} tone={s.tone} size={32} />
                <div className="min-w-0">
                  <div className="truncate font-semibold leading-5">{s.name}{r.staffId === ME_ID && <span className="ml-1.5 text-[12px] font-normal text-label3">自分</span>}{r.proxy && <span className="ml-1.5 text-[12px] font-normal text-label3">代理で打刻</span>}</div>
                  <div className="truncate text-[12px] leading-4 text-label2">{s.role}</div>
                </div>
              </div>
              <div><StatePill r={r} nowMin={nowMin} /></div>
              <span className={cn(r.clockIn === undefined && (late ? "text-label" : "text-label3"))}>
                {r.clockIn !== undefined ? hm(r.clockIn) : r.state === "休み" && r.note !== "欠勤" ? "—" : `予定 ${hm(c.start ?? 525)}`}
              </span>
              <span className={cn(!breakText(r) && "text-label3")}>{breakText(r) ?? "—"}</span>
              <span className={cn(r.clockOut === undefined && "text-label3")}>{r.clockOut !== undefined ? hm(r.clockOut) : "—"}</span>
              <span className={cn("text-right", r.clockIn === undefined && "text-label3")}>{r.clockIn !== undefined ? hours(worked(r, nowMin)) : "—"}</span>
              <span className="flex justify-end">{canAct(r, nowMin) && <AbsenceMenu r={r} onAct={onAct} />}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── 今月のまとめ ───────────────────────────────────────────────────────────
export function MonthTable() {
  const phone = useNarrow();
  const { label, rows } = useMemo(monthSummary, []);
  const header = <span className="tnum">今月の勤怠 · {label}</span>;
  const footer = "所定労働時間（1日8時間）を超えた分を残業として数えています。";
  if (phone) {
    return (
      <ListSection header={header} footer={footer}>
        {rows.map(r => {
          const s = staffById(r.staffId);
          return (
            <ListRow
              key={r.staffId}
              leading={<Avatar name={s.name} tone={s.tone} size={36} />}
              inset={64}
              title={s.name}
              subtitle={<span className="tnum">出勤 {r.days}日 · 残業 {hours(r.overtime)}</span>}
              value={<span className="tnum">{hours(r.total)}</span>}
            />
          );
        })}
      </ListSection>
    );
  }
  const cols = "minmax(180px,1.6fr) repeat(3, minmax(96px,1fr))";
  return (
    <section className="mt-7">
      <h3 className="px-4 pb-1.5 text-footnote font-medium text-label2">{header}</h3>
      <div className="overflow-hidden rounded-cell bg-surface">
        <div className="hairline-b grid h-9 items-center px-4 text-[12px] font-medium text-label2" style={{ gridTemplateColumns: cols }}>
          <span>スタッフ</span><span className="text-right">出勤日数</span><span className="text-right">総労働時間</span><span className="text-right">残業</span>
        </div>
        {rows.map(r => {
          const s = staffById(r.staffId);
          return (
            <div key={r.staffId} className="hairline-b grid h-12 items-center px-4 text-[14px] tnum last:shadow-none" style={{ gridTemplateColumns: cols }}>
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={s.name} tone={s.tone} size={28} />
                <span className="truncate font-medium">{s.name}</span>
                <span className="truncate text-[12px] text-label2">{s.role}</span>
              </div>
              <span className="text-right">{r.days}日</span>
              <span className="text-right">{hours(r.total)}</span>
              <span className={cn("text-right", r.overtime === 0 && "text-label3")}>{r.overtime ? hours(r.overtime) : "なし"}</span>
            </div>
          );
        })}
      </div>
      <p className="px-4 pt-1.5 text-footnote text-label2">{footer}</p>
    </section>
  );
}

export const staffOrder = staff.map(s => s.id);
