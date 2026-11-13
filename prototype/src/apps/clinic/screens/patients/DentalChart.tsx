import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, SquarePen, X } from "lucide-react";
import { TODAY } from "@/lib/clock";
import { TOOTH_STATE_LABEL, hm, md, toothLabel } from "@/lib/format";
import { staffById, type Appointment, type Memo, type Patient, type ToothState, type VisitRecord } from "@/data";
import { Button, Tag, cn, springSoft } from "@/ui";
import { useWidth } from "./hooks";
import { LOWER, STATE_ORDER, UPPER, dateSmart, notesForTooth, toothKeysWithNotes, toothNum, type ToothKey } from "./util";
import { differenceInCalendarDays } from "date-fns";

// 歯の状態ごとの見た目。色は控えめに：むし歯だけ赤い線、要観察は点線、処置済みは灰色の濃淡、欠損は空のマスに斜線。
const CELL: Record<ToothState | "none", string> = {
  none: "bg-fill/8 text-label3",
  C: "bg-surface text-red shadow-[inset_0_0_0_1.5px_rgb(var(--red)/0.9)]",
  観察: "bg-surface text-label2 border-[1.5px] border-dotted border-label2/70",
  CR: "bg-fill/16 text-label",
  In: "bg-fill/16 text-label",
  RCT: "bg-fill/16 text-label",
  Cr: "bg-fill/28 text-label",
  Br: "bg-fill/28 text-label",
  Imp: "bg-fill/36 text-label",
  M: "bg-transparent text-label3 shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.35)]",
};

/** 欠損のマスに引く斜線 */
function Strike({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full", className)} preserveAspectRatio="none" viewBox="0 0 10 10">
      <line x1="8.4" y1="1.6" x2="1.6" y2="8.4" stroke="currentColor" strokeWidth="0.9" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 歯式（永久歯32本）。日本で一般的な並び：
 *   上段 右上8…1 | 左上1…8 / 下段 右下8…1 | 左下1…8（見る人から見て左が患者さんの右）
 * 正中の縦線と咬合の横線で十字に区切り、歯の番号はマスの外側に置く。
 */
export function DentalChart({ teeth, selected, onSelect, marked, picks, maxCell = 34 }: {
  teeth: Patient["teeth"];
  selected?: ToothKey | null;
  onSelect?: (k: ToothKey) => void;
  /** 記録（メモなど）がある歯に小さな点を付ける */
  marked?: Set<ToothKey>;
  /** 歯を選ぶとき（メモの入力欄）：選んだ歯 */
  picks?: Set<ToothKey>;
  maxCell?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const g = useMemo(() => {
    const mid = 10;
    const fit = (side: number, gap: number) => Math.floor((w - 2 * side - mid - gap * (side ? 18 : 16)) / 16);
    let side = 14;
    let gap = 3;
    if (fit(side, gap) < 24) { side = 0; gap = 2; }
    const cell = Math.max(14, Math.min(maxCell, fit(side, gap)));
    const cols = side ? 19 : 17;
    const total = 2 * side + 16 * cell + mid + gap * (cols - 1);
    const base = side ? 2 : 1;
    return { mid, side, gap, cell, h: Math.round(cell * 1.25), total, base, midCol: base + 8, font: cell >= 28 ? 11 : cell >= 23 ? 10 : 9 };
  }, [w, maxCell]);
  const colOf = (i: number) => (i < 8 ? g.base + i : g.base + i + 1);
  const template = `${g.side ? `${g.side}px ` : ""}repeat(8, ${g.cell}px) ${g.mid}px repeat(8, ${g.cell}px)${g.side ? ` ${g.side}px` : ""}`;

  const num = (k: ToothKey, i: number, row: 1 | 5) => {
    const on = selected === k || picks?.has(k);
    return (
      <div
        key={`${row}-${k}`}
        aria-hidden
        className={cn("flex justify-center text-[10px] leading-none tnum", row === 1 ? "items-end pb-[5px]" : "items-start pt-[5px]", on ? "font-semibold text-label" : "text-label3")}
        style={{ gridColumn: colOf(i), gridRow: row }}
      >
        {toothNum(k)}
      </div>
    );
  };

  const cell = (k: ToothKey, i: number, row: 2 | 4) => {
    const s = teeth[k];
    const on = selected === k || !!picks?.has(k);
    // 狭いマスでは「観察」を「観」の1字に（点線の枠と凡例で読める）
    const sym = !s || s === "M" ? "" : s === "観察" && g.cell < 26 ? "観" : s;
    const small = g.cell < 23 && sym.length > 2;
    return (
      <motion.button
        key={k}
        type="button"
        aria-label={`${toothLabel(k)}${s ? `：${TOOTH_STATE_LABEL[s]}` : ""}`}
        aria-pressed={on}
        title={`${toothLabel(k)}${s ? `　${TOOTH_STATE_LABEL[s]}` : ""}`}
        onClick={() => onSelect?.(k)}
        whileTap={{ scale: 0.9 }}
        animate={{ scale: selected === k ? 1.08 : 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
        className={cn(
          "relative flex items-center justify-center whitespace-nowrap rounded-[6px] font-semibold leading-none outline-offset-2 transition-colors",
          CELL[s ?? "none"],
          !s && "hover:bg-fill/14",
          on && "z-[1] outline outline-2 outline-accent",
          picks?.has(k) && !s && "bg-sand/30",
        )}
        style={{ gridColumn: colOf(i), gridRow: row, height: g.h, fontSize: small ? g.font - 1.5 : g.font, letterSpacing: sym.length > 2 ? "-0.02em" : undefined }}
      >
        {sym}
        {s === "M" && <Strike />}
        {marked?.has(k) && <span aria-hidden className="absolute bottom-[3px] left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-accent" />}
      </motion.button>
    );
  };

  return (
    <div ref={ref} className="w-full">
      {w > 0 && (
        <div className="mx-auto grid" style={{ width: g.total, gridTemplateColumns: template, gridTemplateRows: `18px ${g.h}px 11px ${g.h}px 18px`, columnGap: g.gap }}>
          {/* 正中線・咬合線 */}
          <div aria-hidden className="flex justify-center" style={{ gridColumn: g.midCol, gridRow: "1 / 6" }}>
            <div className="h-full w-px bg-label3/70" />
          </div>
          <div aria-hidden className="flex items-center" style={{ gridColumn: g.side ? "2 / -2" : "1 / -1", gridRow: 3 }}>
            <div className="h-px w-full bg-label3/70" />
          </div>
          {g.side > 0 && (
            <>
              <div aria-hidden className="flex items-center justify-start text-[10px] font-medium leading-none text-label3" style={{ gridColumn: 1, gridRow: 3 }}>右</div>
              <div aria-hidden className="flex items-center justify-end text-[10px] font-medium leading-none text-label3" style={{ gridColumn: -2, gridRow: 3 }}>左</div>
            </>
          )}
          {UPPER.map((k, i) => num(k, i, 1))}
          {UPPER.map((k, i) => cell(k, i, 2))}
          {LOWER.map((k, i) => cell(k, i, 4))}
          {LOWER.map((k, i) => num(k, i, 5))}
        </div>
      )}
    </div>
  );
}

/** 凡例の小さなマス */
function Swatch({ s }: { s: ToothState }) {
  return (
    <span className={cn("relative inline-flex h-[18px] min-w-[22px] items-center justify-center rounded-[4px] px-1 text-[9px] font-semibold leading-none", CELL[s])}>
      {s !== "M" && s}
      {s === "M" && <Strike />}
    </span>
  );
}

export function ChartLegend({ states, marked }: { states: ToothState[]; marked: boolean }) {
  if (!states.length && !marked) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {states.map(s => (
        <li key={s} className="inline-flex items-center gap-1.5 text-caption text-label2">
          <Swatch s={s} />
          {TOOTH_STATE_LABEL[s]}
        </li>
      ))}
      {marked && (
        <li className="inline-flex items-center gap-1.5 text-caption text-label2">
          <span className="inline-flex h-[18px] w-[10px] items-center justify-center"><span className="h-[5px] w-[5px] rounded-full bg-accent" /></span>
          記録あり
        </li>
      )}
    </ul>
  );
}

/** 歯式のまとまり：図・凡例・タップした歯の詳細 */
export function ChartCard({ p, memos, visits, appts, selected, onSelect, onWriteMemo, onOpenAppt, child }: {
  p: Patient;
  memos: Memo[];
  visits: VisitRecord[];
  appts: Appointment[];
  selected: ToothKey | null;
  onSelect: (k: ToothKey | null) => void;
  onWriteMemo: (k: ToothKey) => void;
  onOpenAppt: (id: string) => void;
  child: boolean;
}) {
  const states = useMemo(() => STATE_ORDER.filter(s => Object.values(p.teeth).includes(s)), [p.teeth]);
  const marked = useMemo(() => toothKeysWithNotes(memos, visits, appts), [memos, visits, appts]);
  const notes = useMemo(() => (selected ? notesForTooth(selected, memos, visits, appts) : []), [selected, memos, visits, appts]);
  const empty = Object.keys(p.teeth).length === 0;
  const state = selected ? p.teeth[selected] : undefined;

  return (
    <div className="px-3 pb-4 pt-3 md:px-4">
      <DentalChart teeth={p.teeth} selected={selected} onSelect={k => onSelect(selected === k ? null : k)} marked={marked} />
      {empty ? (
        <p className="mt-3 text-footnote text-label2">歯式の記録はまだありません。初診で検査した結果がここに入ります。</p>
      ) : (
        <div className="mt-3.5">
          <ChartLegend states={states} marked={marked.size > 0} />
        </div>
      )}
      {child && <p className="mt-2.5 text-caption text-label2">15歳未満の患者さんです。ここには永久歯のみ表示しています。乳歯（A〜E）の状態はカルテで確認してください。</p>}

      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            key="tooth"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            className="overflow-hidden"
          >
            <div className="hairline-t mt-4 pt-3.5">
              <div className="flex items-center gap-2">
                <span className="text-[16px] font-semibold palt">{toothLabel(selected)}</span>
                {state ? <Tag tone={state === "C" ? "red" : "neutral"}>{TOOTH_STATE_LABEL[state]}</Tag> : <span className="text-footnote text-label3">歯式の記録なし</span>}
                <button
                  type="button"
                  aria-label="閉じる"
                  onClick={() => onSelect(null)}
                  className="-mr-1.5 ml-auto flex h-8 w-8 items-center justify-center rounded-full text-label3 transition-colors hover:bg-fill/10 hover:text-label2"
                >
                  <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </button>
              </div>
              {notes.length > 0 ? (
                <ul className="mt-1.5">
                  {notes.map(n => {
                    const who = n.staffId ? staffById(n.staffId) : undefined;
                    const d = differenceInCalendarDays(n.date, TODAY);
                    const appt = n.apptId ? appts.find(a => a.id === n.apptId) : undefined;
                    const when = n.future && appt ? (d === 0 ? `今日 ${hm(appt.start)}` : d === 1 ? `明日 ${hm(appt.start)}` : `${md(n.date)} ${hm(appt.start)}`) : dateSmart(n.date);
                    const body = (
                      <>
                        <span className={cn("w-[7.2em] shrink-0 pt-px text-footnote tnum", n.future ? "font-semibold text-accent" : "text-label2")}>{when}</span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-footnote font-semibold text-label">
                            {n.future && <CalendarClock className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} />}
                            {n.title}
                            {who && <span className="font-normal text-label2">· {who.short}</span>}
                          </span>
                          <span className="mt-0.5 block text-footnote leading-[1.6] text-label2">{n.body}</span>
                        </span>
                      </>
                    );
                    return (
                      <li key={n.id} className="hairline-b last:shadow-none">
                        {n.apptId ? (
                          <button type="button" onClick={() => onOpenAppt(n.apptId!)} className="-mx-2 flex w-[calc(100%+16px)] gap-3 rounded-[8px] px-2 py-2.5 text-left transition-colors hover:bg-fill/[0.06] active:bg-fill/12">
                            {body}
                          </button>
                        ) : (
                          <div className="flex gap-3 py-2.5">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-footnote text-label2">この歯についての記録やメモはまだありません。</p>
              )}
              <div className="mt-2.5">
                <Button variant="tinted" size="sm" icon={SquarePen} onClick={() => onWriteMemo(selected)}>この歯のメモを書く</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
