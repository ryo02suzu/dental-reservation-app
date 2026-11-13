import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { staff, staffById, type Staff } from "@/data";
import { TODAY_KEY } from "@/lib/clock";
import { WEEKDAYS, hm, key, mdw } from "@/lib/format";
import { Avatar, Button, ListRow, ListSection, Sheet, Stepper, Switch, cn, tap, useToast } from "@/ui";
import { baseCell, cellKey, hours, weekDays, weekLabel, workMinutes, type Cell, type LeaveRequest } from "./model";

export type Edits = Record<string, Partial<Cell>>;

/** 週の切り替え（‹ 11月9日〜15日 ›） */
export function WeekNav({ offset, onChange, days, className }: { offset: number; onChange: (n: number) => void; days: Date[]; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="inline-flex h-8 items-center rounded-full bg-fill/12">
        <motion.button whileTap={tap} onClick={() => onChange(offset - 1)} aria-label="前の週" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-fill/12">
          <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </motion.button>
        <motion.button whileTap={tap} onClick={() => onChange(0)} className={cn("h-8 rounded-full px-2 text-[13px] font-semibold hover:bg-fill/12", offset === 0 ? "text-label3" : "text-label")}>今週</motion.button>
        <motion.button whileTap={tap} onClick={() => onChange(offset + 1)} aria-label="次の週" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-fill/12">
          <ChevronRight className="h-[18px] w-[18px]" strokeWidth={2.3} />
        </motion.button>
      </div>
      <span className="text-[15px] font-semibold tnum">{weekLabel(days)}</span>
    </div>
  );
}

function useWeek(offset: number, edits: Edits) {
  return useMemo(() => {
    const days = weekDays(offset);
    const cell = (s: Staff, d: Date): Cell => {
      const b = baseCell(s.id, d);
      const e = edits[cellKey(s.id, b.date)];
      return e ? { ...b, ...e } : b;
    };
    const grid = staff.map(s => days.map(d => cell(s, d)));
    const totals = grid.map(r => r.reduce((a, c) => a + workMinutes(c), 0));
    const counts = days.map((_, di) => grid.filter(r => !r[di].off).length);
    return { days, grid, totals, counts };
  }, [offset, edits]);
}

/** 休み・希望休の静かな印 */
function OffChip({ c }: { c: Cell }) {
  if (c.note === "希望休") return <span className="inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold text-label2 shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.35)]">希望休</span>;
  return <span className="inline-flex h-6 items-center rounded-full bg-fill/8 px-2.5 text-[12px] font-semibold text-label3">休み</span>;
}

// ─── PC・iPad：週の表 ────────────────────────────────────────────────────────
export function ShiftGrid({ offset, edits, onEdit }: { offset: number; edits: Edits; onEdit: (c: Cell) => void }) {
  const { days, grid, totals, counts } = useWeek(offset, edits);
  const cols = "minmax(168px,1.5fr) repeat(7, minmax(92px,1fr)) 116px";
  return (
    <div className="overflow-x-auto rounded-card bg-surface">
      <div className="min-w-[940px]">
        <div className="hairline-b grid" style={{ gridTemplateColumns: cols }}>
          <div className="flex items-end px-4 pb-2.5 text-[12px] font-medium text-label2">スタッフ</div>
          {days.map(d => {
            const k = key(d);
            const today = k === TODAY_KEY;
            const closed = grid[0][days.indexOf(d)].closed;
            return (
              <div key={k} className={cn("flex flex-col items-center pb-2 pt-3", today && "bg-sand/12", closed && "hatch")}>
                <span className={cn("text-[12px] font-medium", closed ? "text-label3" : today ? "text-accent" : "text-label2")}>{WEEKDAYS[d.getDay()]}</span>
                <span className={cn("mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-[17px] font-semibold tnum", today ? "bg-accent text-surface" : closed ? "text-label3" : "text-label")}>{d.getDate()}</span>
              </div>
            );
          })}
          <div className="flex items-end justify-end whitespace-nowrap px-4 pb-2.5 text-[12px] font-medium text-label2">週の時間</div>
        </div>
        {staff.map((s, si) => (
          <div key={s.id} className="hairline-b grid" style={{ gridTemplateColumns: cols }}>
            <div className="flex min-w-0 items-center gap-2.5 px-4 py-2.5">
              <Avatar name={s.name} tone={s.tone} size={32} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold leading-5">{s.name}</div>
                <div className="truncate text-[12px] leading-4 text-label2">{s.role}</div>
              </div>
            </div>
            {grid[si].map((c, di) => {
              const today = c.date === TODAY_KEY;
              if (c.closed) {
                return (
                  <div key={c.date} className="hatch flex items-center justify-center text-[12px] text-label3">
                    {si === 0 ? (c.closed.endsWith("曜") ? "休診" : c.closed) : ""}
                  </div>
                );
              }
              return (
                <div key={c.date} className={cn("p-1", today && "bg-sand/12")}>
                  <motion.button
                    whileTap={tap}
                    onClick={() => onEdit(c)}
                    aria-label={`${s.name} ${mdw(days[di])}のシフトを編集`}
                    className="flex h-12 w-full items-center justify-center rounded-[10px] text-[13px] font-medium tnum transition-colors hover:bg-fill/8"
                  >
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={c.off ? `off-${c.note}` : `${c.start}-${c.end}`} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                        {c.off ? <OffChip c={c} /> : `${hm(c.start!)}–${hm(c.end!)}`}
                      </motion.span>
                    </AnimatePresence>
                  </motion.button>
                </div>
              );
            })}
            <div className="flex items-center justify-end whitespace-nowrap px-4 text-[14px] font-semibold tnum">{hours(totals[si])}</div>
          </div>
        ))}
        <div className="grid" style={{ gridTemplateColumns: cols }}>
          <div className="px-4 py-3 text-[12px] font-medium text-label2">出勤する人数</div>
          {counts.map((n, di) => (
            <div key={di} className={cn("flex items-center justify-center text-[13px] tnum", grid[0][di].closed ? "hatch text-label3" : "text-label2", days[di] && key(days[di]) === TODAY_KEY && "bg-sand/12")}>
              {grid[0][di].closed ? "" : `${n}人`}
            </div>
          ))}
          <div />
        </div>
      </div>
    </div>
  );
}

// ─── スマホ：日ごとの一覧 ─────────────────────────────────────────────────────
export function ShiftDayList({ offset, edits, onEdit, onWeek }: { offset: number; edits: Edits; onEdit: (c: Cell) => void; onWeek: (n: number) => void }) {
  const { days, grid, totals, counts } = useWeek(offset, edits);
  const todayIdx = days.findIndex(d => key(d) === TODAY_KEY);
  const firstOpen = Math.max(0, grid[0].findIndex(c => !c.closed));
  const [sel, setSel] = useState(todayIdx >= 0 ? todayIdx : firstOpen);
  useEffect(() => { setSel(todayIdx >= 0 ? todayIdx : firstOpen); }, [offset]); // eslint-disable-line react-hooks/exhaustive-deps
  const d = days[sel];
  const closed = grid[0][sel].closed;
  return (
    <div>
      <WeekNav offset={offset} onChange={onWeek} days={days} />
      <div className="mt-3 grid grid-cols-7 gap-1 rounded-cell bg-surface p-1.5">
        {days.map((x, i) => {
          const on = i === sel;
          const isToday = key(x) === TODAY_KEY;
          const off = !!grid[0][i].closed;
          return (
            <button key={i} onClick={() => setSel(i)} className="relative flex h-[58px] flex-col items-center justify-center gap-1 rounded-[10px]" aria-pressed={on}>
              {on && <motion.span layoutId="shift-day" className="absolute inset-0 rounded-[10px] bg-fill/12" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className={cn("relative text-[11px] font-medium", off ? "text-label3" : isToday ? "text-accent" : "text-label2")}>{WEEKDAYS[x.getDay()]}</span>
              <span className={cn("relative flex h-7 w-7 items-center justify-center rounded-full text-[16px] font-semibold tnum", isToday ? "bg-accent text-surface" : off ? "text-label3" : "text-label")}>{x.getDate()}</span>
            </button>
          );
        })}
      </div>

      {closed ? (
        <div className="hatch mt-7 flex flex-col items-center rounded-cell bg-surface px-6 py-10 text-center">
          <div className="text-[17px] font-semibold">休診日</div>
          <p className="mt-1 text-[14px] text-label2">{mdw(d)}は{closed.endsWith("曜") ? `${closed}日のため` : `${closed}のため`}休診です</p>
        </div>
      ) : (
        <ListSection header={<span className="tnum">{mdw(d)} · 出勤 {counts[sel]}人</span>}>
          {staff.map((s, si) => {
            const c = grid[si][sel];
            return (
              <ListRow
                key={s.id}
                leading={<Avatar name={s.name} tone={s.tone} size={36} />}
                inset={64}
                title={s.name}
                subtitle={s.role}
                trailing={c.off ? <OffChip c={c} /> : <span className="text-[15px] tnum text-label">{hm(c.start!)}–{hm(c.end!)}</span>}
                chevron
                onClick={() => onEdit(c)}
              />
            );
          })}
        </ListSection>
      )}

      <ListSection header="今週の勤務時間" footer="昼休み（13:00〜14:30）を除いた時間です。">
        {staff.map((s, si) => (
          <ListRow key={s.id} leading={<Avatar name={s.name} tone={s.tone} size={28} />} inset={56} title={s.name} value={<span className="tnum">{hours(totals[si])}</span>} />
        ))}
      </ListSection>
    </div>
  );
}

/** シートの中のまとまり（白いシートの上なので薄い灰色の面にする） */
export function SheetGroup({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="overflow-hidden rounded-cell bg-fill/8">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-footnote text-label2">{footer}</p>}
    </div>
  );
}

// ─── 希望休の申請 ───────────────────────────────────────────────────────────
export function Requests({ items, onDecide }: { items: LeaveRequest[]; onDecide: (r: LeaveRequest, ok: boolean) => void }) {
  return (
    <ListSection header="希望休の申請" footer={items.length ? "承認すると、その日のシフトが「希望休」になります。" : undefined}>
      <AnimatePresence initial={false}>
        {items.map(r => {
          const s = staffById(r.staffId);
          return (
            <motion.div key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="group/req relative overflow-hidden">
              <ListRow
                leading={<Avatar name={s.name} tone={s.tone} size={36} />}
                inset={64}
                title={<span className="tnum">{s.name}<span className="ml-1.5 text-label2">{mdw(new Date(`${r.date}T00:00:00`))}</span></span>}
                subtitle={`${r.reason} · ${r.sent}に申請`}
                trailing={
                  <div className="flex shrink-0 gap-1.5">
                    <Button size="sm" variant="gray" onClick={() => onDecide(r, false)}>見送る</Button>
                    <Button size="sm" variant="tinted" onClick={() => onDecide(r, true)}>承認</Button>
                  </div>
                }
              />
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-16 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last/req:hidden" />
            </motion.div>
          );
        })}
      </AnimatePresence>
      {!items.length && <div className="flex min-h-[44px] items-center px-4 text-[15px] text-label2">未対応の申請はありません</div>}
    </ListSection>
  );
}

// ─── シフトの編集 ────────────────────────────────────────────────────────────
export function ShiftSheet({ cell, onClose, onSave }: { cell: Cell | null; onClose: () => void; onSave: (c: Cell) => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Cell | null>(cell);
  useEffect(() => {
    if (cell) setDraft(cell.off ? { ...cell, start: cell.start ?? 525, end: cell.end ?? 1155 } : cell);
  }, [cell]);
  const s = draft ? staffById(draft.staffId) : null;
  const d = draft ? new Date(`${draft.date}T00:00:00`) : null;
  const save = () => {
    if (!draft || !s || !d) return;
    const next: Cell = draft.off ? { ...draft, off: true, note: draft.note ?? "休み" } : { ...draft, off: false, note: undefined };
    onSave(next);
    toast("シフトを変更しました", { detail: `${s.name} · ${mdw(d)} ${next.off ? next.note : `${hm(next.start!)}–${hm(next.end!)}`}` });
    onClose();
  };
  return (
    <Sheet open={!!cell} onOpenChange={o => !o && onClose()} title="シフトを編集" cancelLabel="キャンセル" confirmLabel="保存" onConfirm={save}>
      {draft && s && d && (
        <>
          <div className="flex items-center gap-3 px-1 pb-1 pt-2">
            <Avatar name={s.name} tone={s.tone} size={44} />
            <div className="min-w-0">
              <div className="text-[17px] font-semibold">{s.name}</div>
              <div className="text-[14px] text-label2 tnum">{s.role} · {mdw(d)}</div>
            </div>
          </div>
          <SheetGroup className="mt-5">
            <ListRow title="休み" trailing={<Switch checked={!!draft.off} onChange={v => setDraft({ ...draft, off: v, note: v ? (cell?.note ?? "休み") : undefined })} label="休み" />} />
          </SheetGroup>
          <AnimatePresence initial={false}>
            {!draft.off && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <SheetGroup className="mt-5" footer={`勤務 ${hours(workMinutes(draft))}（昼休みを除く）· 15分単位で変更できます`}>
                  <ListRow title="出勤" trailing={<Stepper value={draft.start!} min={420} max={draft.end! - 60} step={15} format={hm} onChange={v => setDraft({ ...draft, start: v })} />} />
                  <ListRow title="退勤" trailing={<Stepper value={draft.end!} min={draft.start! + 60} max={1260} step={15} format={hm} onChange={v => setDraft({ ...draft, end: v })} />} />
                </SheetGroup>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Sheet>
  );
}
