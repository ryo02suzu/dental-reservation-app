import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, MinusCircle, Plus } from "lucide-react";
import { TODAY } from "@/lib/clock";
import { WEEKDAYS, duration, fromKey, hm, key, mdw } from "@/lib/format";
import { useIsPhone, useIsWide } from "@/lib/media";
import { ListRow, ListSection, Sheet, Stepper, Switch, cn, useToast } from "@/ui";
import { useClinicUI } from "../../context";
import { SheetField, SheetGroup, SwitchRow, inputCls } from "./parts";
import { newYearRange, upcomingHolidays } from "./dates";
import { patch, setSettings, useSettings, type DayHours } from "./store";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const RANGE: [number, number] = [8 * 60, 20 * 60];
const pct = (m: number) => ((m - RANGE[0]) / (RANGE[1] - RANGE[0])) * 100;

/** 8:00〜20:00 の帯に、午前と午後の診療時間を置いた小さな図 */
function DayBar({ h }: { h: DayHours }) {
  return (
    <div className={cn("relative h-[22px] rounded-[6px]", h.open ? "bg-fill/8" : "hatch bg-fill/4")}>
      {h.open && [h.am, h.pm].map((r, i) => (
        <motion.span
          key={i}
          layout
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
          className="absolute inset-y-[3px] rounded-[4px] bg-sand/70"
          style={{ left: `${pct(r[0])}%`, width: `${pct(r[1]) - pct(r[0])}%` }}
        />
      ))}
    </div>
  );
}

const rangeText = (h: DayHours) => `${hm(h.am[0])}–${hm(h.am[1])} / ${hm(h.pm[0])}–${hm(h.pm[1])}`;

// ─── 診療時間 ───────────────────────────────────────────────────────────────
/**
 * 曜日ごとの行。iOSの設定と同じく、行そのものを押すと編集のシートが開く（どの幅でも同じ形）。
 * 診療する／休診のスイッチは、時間と一緒にシートの中で切り替える。
 */
export function HoursPage() {
  const { hours } = useSettings();
  const phone = useIsPhone();
  const bar = useIsWide();
  const { go } = useClinicUI();
  const [edit, setEdit] = useState<number | null>(null);
  return (
    <>
      <ListSection header="曜日ごとの診療時間" footer="曜日を押すと、診療するかどうかと時間（15分単位）を変更できます。">
        {bar && (
          <div className="hairline-b flex h-8 items-center gap-4 pl-4 pr-[46px] text-[11px] text-label3 tnum">
            <span className="w-[72px] shrink-0" />
            <div className="relative h-full flex-1">
              {[9, 12, 15, 18].map(h => (
                <span key={h} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${pct(h * 60)}%` }}>{h}:00</span>
              ))}
            </div>
            <span className="w-[200px] shrink-0" />
          </div>
        )}
        {ORDER.map((d, i) => {
          const h = hours[d];
          return (
            <div key={d} className="relative">
              <button
                onClick={() => setEdit(d)}
                className="flex min-h-[56px] w-full items-center gap-4 pl-4 pr-3 text-left transition-colors hover:bg-fill/[0.04] active:bg-fill/12 md:min-h-[52px]"
                aria-label={`${WEEKDAYS[d]}曜日の診療時間を変更`}
              >
                <span className={cn("w-[72px] shrink-0 text-[16px] font-medium md:text-[15px]", !h.open && "text-label2")}>{WEEKDAYS[d]}曜日</span>
                {bar && <div className="min-w-0 flex-1"><DayBar h={h} /></div>}
                <span className={cn("shrink-0 text-[15px] tnum md:text-[14px]", bar ? "w-[200px] text-right" : "ml-auto", h.open ? "text-label2" : "text-label3")}>
                  {h.open ? (phone ? <span className="flex flex-col items-end leading-5"><span>{hm(h.am[0])}–{hm(h.am[1])}</span><span>{hm(h.pm[0])}–{hm(h.pm[1])}</span></span> : rangeText(h)) : "休診"}
                </span>
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-label4" strokeWidth={2.4} />
              </button>
              {i < ORDER.length - 1 && <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />}
            </div>
          );
        })}
      </ListSection>
      <ListSection>
        <ListRow title="祝日・年末年始の休診" chevron onClick={() => go("settings", "holidays")} />
      </ListSection>
      <HoursSheet day={edit} onClose={() => setEdit(null)} />
    </>
  );
}

function HoursSheet({ day, onClose }: { day: number | null; onClose: () => void }) {
  const { hours } = useSettings();
  const toast = useToast();
  const [d, setD] = useState<DayHours | null>(null);
  useEffect(() => { if (day !== null) setD(hours[day]); }, [day]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = () => {
    if (day === null || !d) return;
    const before = hours[day];
    setSettings(s => ({ ...s, hours: { ...s.hours, [day]: d } }));
    toast("変更を保存しました", {
      detail: d.open ? (before.open ? `${WEEKDAYS[day]}曜日 ${rangeText(d)}` : `${WEEKDAYS[day]}曜日を診療日にしました`) : `${WEEKDAYS[day]}曜日を休診にしました`,
    });
    onClose();
  };
  const set = (part: "am" | "pm", i: 0 | 1, v: number) => d && setD({ ...d, [part]: (part === "am" ? (i ? [d.am[0], v] : [v, d.am[1]]) : (i ? [d.pm[0], v] : [v, d.pm[1]])) as [number, number] });
  return (
    <Sheet open={day !== null} onOpenChange={o => !o && onClose()} title={day !== null ? `${WEEKDAYS[day]}曜日の診療時間` : ""} cancelLabel="キャンセル" confirmLabel="完了" onConfirm={done}>
      {d && (
        <>
          <SheetGroup footer={d.open ? undefined : "この曜日は毎週休診になります。"}>
            <ListRow title="診療する" trailing={<Switch checked={d.open} onChange={v => setD({ ...d, open: v })} label="診療する" />} />
          </SheetGroup>
          <AnimatePresence initial={false}>
            {d.open && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                <SheetGroup header="午前">
                  <ListRow title="開始" trailing={<Stepper value={d.am[0]} min={7 * 60} max={d.am[1] - 30} step={15} format={hm} onChange={v => set("am", 0, v)} />} />
                  <ListRow title="終了" trailing={<Stepper value={d.am[1]} min={d.am[0] + 30} max={d.pm[0]} step={15} format={hm} onChange={v => set("am", 1, v)} />} />
                </SheetGroup>
                <SheetGroup header="午後" footer={<span className="tnum">昼休み {hm(d.am[1])}〜{hm(d.pm[0])}（{duration(d.pm[0] - d.am[1])}）</span>}>
                  <ListRow title="開始" trailing={<Stepper value={d.pm[0]} min={d.am[1]} max={d.pm[1] - 30} step={15} format={hm} onChange={v => set("pm", 0, v)} />} />
                  <ListRow title="終了" trailing={<Stepper value={d.pm[1]} min={d.pm[0] + 30} max={21 * 60} step={15} format={hm} onChange={v => set("pm", 1, v)} />} />
                </SheetGroup>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </Sheet>
  );
}

// ─── 休診日 ─────────────────────────────────────────────────────────────────
export function HolidaysPage() {
  const { holidays, hours } = useSettings();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [ny0, ny1] = newYearRange();
  const upcoming = upcomingHolidays(8);
  const weekly = ORDER.filter(d => !hours[d].open).map(d => `${WEEKDAYS[d]}曜`).join("・");
  const minDate = key(TODAY);
  const add = () => {
    if (!date) return;
    if (holidays.extra.some(x => x.date === date)) { toast("その日はすでに登録されています", { detail: mdw(fromKey(date)) }); return; }
    setSettings(s => ({ ...s, holidays: { ...s.holidays, extra: [...s.holidays.extra, { id: `x${Date.now()}`, date, note: note.trim() || "臨時休診" }].sort((a, b) => a.date.localeCompare(b.date)) } }));
    toast("臨時休診日を追加しました", { detail: mdw(fromKey(date)) });
    setAdding(false); setDate(""); setNote("");
  };
  const remove = (id: string, d: string) => {
    setSettings(s => ({ ...s, holidays: { ...s.holidays, extra: s.holidays.extra.filter(x => x.id !== id) } }));
    toast("臨時休診日を削除しました", { detail: mdw(fromKey(d)) });
  };
  return (
    <>
      <ListSection header="毎週の休診日" footer="曜日ごとの休診は「診療時間」で変更できます。">
        <ListRow title="毎週" value={weekly || "なし"} />
      </ListSection>
      <ListSection header="祝日と年末年始">
        <SwitchRow title="祝日を休診にする" subtitle={upcoming[0] ? `次の祝日：${mdw(upcoming[0].date)} ${upcoming[0].name}` : undefined} checked={holidays.national} onChange={v => patch("holidays", { national: v })} />
        <SwitchRow title="年末年始を休診にする" subtitle={<span className="tnum">{mdw(ny0)}〜{mdw(ny1)}</span>} checked={holidays.newYear} onChange={v => patch("holidays", { newYear: v })} />
      </ListSection>
      <ListSection header="臨時休診日" footer="研修・学会・設備の点検などで休む日を登録します。すでに入っている予約は自動では動かないので、予約台帳で確認してください。">
        <AnimatePresence initial={false}>
          {holidays.extra.map(x => (
            <motion.div key={x.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="relative overflow-hidden">
              <ListRow
                title={<span className="tnum">{mdw(fromKey(x.date))}</span>}
                subtitle={x.note}
                trailing={
                  <button onClick={() => remove(x.id, x.date)} className="-mr-1 flex h-9 items-center gap-1 rounded-full px-2 text-[14px] font-medium text-red hover:bg-red/10" aria-label={`${mdw(fromKey(x.date))}の臨時休診を削除`}>
                    <MinusCircle className="h-[18px] w-[18px]" strokeWidth={2.2} />削除
                  </button>
                }
              />
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />
            </motion.div>
          ))}
        </AnimatePresence>
        <ListRow title={<span className="flex items-center gap-2 text-accent"><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />臨時休診日を追加</span>} onClick={() => setAdding(true)} />
      </ListSection>
      <ListSection header="これからの祝日">
        {upcoming.map(h => {
          const closedAnyway = !hours[h.date.getDay()].open;
          return (
            <ListRow
              key={h.date.getTime()}
              title={h.name}
              subtitle={<span className="tnum">{mdw(h.date)}</span>}
              value={closedAnyway ? <span className="text-label3">もともと休診</span> : holidays.national ? "休診" : "通常どおり診療"}
            />
          );
        })}
      </ListSection>

      <Sheet open={adding} onOpenChange={setAdding} title="臨時休診日を追加" cancelLabel="キャンセル" confirmLabel="追加" onConfirm={add} confirmDisabled={!date}>
        <SheetGroup footer={date ? <span className="tnum">{mdw(fromKey(date))}を休診にします</span> : "研修・学会・設備の点検などで休む日を登録します。"}>
          <SheetField label="日付">
            <input type="date" value={date} min={minDate} onChange={e => setDate(e.target.value)} className={cn(inputCls, "text-right tnum")} />
          </SheetField>
          <SheetField label="理由">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="例：学会参加のため" className={cn(inputCls, "text-right")} />
          </SheetField>
        </SheetGroup>
      </Sheet>
    </>
  );
}
