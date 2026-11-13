import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CircleX } from "lucide-react";
import { ME, clinic, patientById, serviceById, staffById } from "@/data";
import type { Appointment } from "@/data";
import { TODAY, TODAY_KEY, useNow } from "@/lib/clock";
import { fromKey, hm, mdw, relDay } from "@/lib/format";
import { useStore } from "@/lib/store";
import { Button, StatusPill, cn, easeOut, tap, useToast } from "@/ui";
import { CANCEL_REASONS, assignUnit, dayInfos, deadlineLabel, deadlineOf, range, receiptOf } from "./booking";
import { DatePicker, SlotGrid } from "./DatePicker";
import { CopyButton } from "./ui";

type Mode = "idle" | "change" | "cancel";

const panel = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1, transition: { height: { duration: 0.32, ease: easeOut }, opacity: { duration: 0.2, delay: 0.06 } } },
  exit: { height: 0, opacity: 0, transition: { height: { duration: 0.26, ease: easeOut }, opacity: { duration: 0.12 } } },
};

/** 「予約の確認」の1件。日時の変更・キャンセルはカードの中で完結させる */
export function ApptCard({ appt }: { appt: Appointment }) {
  const at = useNow(30_000);
  const [mode, setMode] = useState<Mode>("idle");
  const sv = serviceById(appt.serviceId);
  const st = staffById(appt.staffId);
  const p = patientById(appt.patientId);
  const day = fromKey(appt.date);
  const editable = at < deadlineOf(appt.date);
  const pending = appt.status === "pending";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      className="overflow-hidden rounded-card bg-surface"
    >
      <div className="px-4 pb-4 pt-3.5 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-footnote font-semibold text-accent">{relDay(day, TODAY)}</span>
          <StatusPill status={appt.status} />
        </div>
        <div className="mt-1 text-title2 tnum palt">
          {mdw(day)} {hm(appt.start)}
        </div>
        <div className="mt-2 text-[16px] leading-[22px]">{sv.name}</div>
        <div className="mt-0.5 text-footnote text-label2 tnum">
          {hm(appt.start)}–{hm(appt.end)}・担当 {st.name}（{st.role}）
        </div>
        {p.id !== ME.id && <div className="mt-0.5 text-footnote text-label2">受診される方 {p.name}さん</div>}
        {pending && (
          <p className="mt-3 rounded-[10px] bg-sand/15 px-3 py-2 text-footnote leading-[1.55] text-label">
            医院の確認待ちです。確定したらお知らせします。
          </p>
        )}
        <div className="mt-3 text-caption text-label3 tnum">予約番号 {receiptOf(appt)}</div>
      </div>

      <div className="hairline-t">
        {!editable ? (
          <div className="px-4 py-3.5 md:px-5">
            <p className="text-footnote leading-[1.6] text-label2">
              {appt.date === TODAY_KEY
                ? "当日のご予約の変更・キャンセルは、お電話でお願いします。"
                : `Webでの変更・キャンセルは${deadlineLabel(appt.date)}で締め切りました。お電話でご連絡ください。`}
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-3">
              <span className="text-[17px] font-semibold tnum">{clinic.phone}</span>
              <CopyButton text={clinic.phone} what="電話番号" />
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {mode === "idle" && (
              <motion.div key="idle" {...panel} className="overflow-hidden">
                <div className="px-4 pb-3.5 pt-3 md:flex md:items-center md:gap-2 md:px-5 md:py-3.5">
                  <div className="grid grid-cols-2 gap-2 md:flex">
                    <Button variant="gray" icon={CalendarClock} onClick={() => setMode("change")} className="md:min-w-[148px]">
                      日時を変更
                    </Button>
                    <Button variant="destructiveTinted" icon={CircleX} onClick={() => setMode("cancel")} className="md:min-w-[128px]">
                      キャンセル
                    </Button>
                  </div>
                  <p className="mt-2.5 text-center text-caption text-label3 tnum md:ml-auto md:mt-0 md:text-right">
                    変更・キャンセルは {deadlineLabel(appt.date)} まで
                  </p>
                </div>
              </motion.div>
            )}
            {mode === "change" && (
              <motion.div key="change" {...panel} className="overflow-hidden">
                <ChangePanel appt={appt} onClose={() => setMode("idle")} />
              </motion.div>
            )}
            {mode === "cancel" && (
              <motion.div key="cancel" {...panel} className="overflow-hidden">
                <CancelPanel appt={appt} onClose={() => setMode("idle")} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </motion.article>
  );
}

/** パネルの下の操作（スマホは2つ並べたボタンの下に補足、PCは補足を左・ボタンを右） */
function PanelActions({ note, muted, children }: { note: ReactNode; muted?: boolean; children: ReactNode }) {
  return (
    <div className="mt-5 md:flex md:items-center md:gap-4">
      <div className="grid grid-cols-2 gap-2 md:order-2 md:flex">{children}</div>
      <p className={cn("mt-2.5 text-center text-caption tnum md:order-1 md:mt-0 md:flex-1 md:text-left", muted ? "text-label3" : "text-label2")}>{note}</p>
    </div>
  );
}

function PanelTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-[17px] font-semibold palt">{children}</h3>
      {sub && <p className="mt-0.5 text-footnote text-label2 tnum">{sub}</p>}
    </div>
  );
}

/** その場で日時を選び直す（同じ長さで空いている枠だけ） */
function ChangePanel({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const sv = serviceById(appt.serviceId);
  const days = useMemo(
    () => dayInfos(appt.end - appt.start, store.appointments, { excludeId: appt.id, patientId: appt.patientId }),
    [appt.id, appt.start, appt.end, appt.patientId, store.appointments],
  );
  const [date, setDate] = useState<string | undefined>(
    () => days.find(d => d.key === appt.date && d.slots.some(t => t !== appt.start))?.key ?? days.find(d => d.slots.length > 0)?.key,
  );
  const [start, setStart] = useState<number>();
  const info = days.find(d => d.key === date);
  // いまの予約と同じ時間は「変更」にならないので出さない
  const slots = (info?.slots ?? []).filter(t => !(date === appt.date && t === appt.start));

  const confirm = () => {
    if (!date || start === undefined) return;
    const end = start + (appt.end - appt.start);
    const { unitId, staffId } = assignUnit(date, start, end, sv, store.appointments, appt.id, appt.unitId);
    const p = patientById(appt.patientId);
    store.updateAppointment(appt.id, { date, start, end, unitId, staffId });
    store.addNotice({
      kind: "change",
      title: "予約が変更されました",
      body: `${p.name}さん・${mdw(fromKey(appt.date))} ${hm(appt.start)} → ${mdw(fromKey(date))} ${hm(start)}`,
      apptId: appt.id,
    });
    toast("予約を変更しました", { icon: CalendarClock, detail: `${mdw(fromKey(date))} ${range(start, end - start)}` });
    onClose();
  };

  return (
    <div className="px-4 pb-4 pt-4 md:px-5">
      <PanelTitle sub={`いまのご予約：${mdw(fromKey(appt.date))} ${hm(appt.start)}`}>新しい日時を選んでください</PanelTitle>
      <DatePicker
        onSurface
        days={days}
        selected={date}
        onSelect={k => {
          setDate(k);
          setStart(undefined);
        }}
      />
      <div className="mt-6">
        {slots.length > 0 ? (
          <SlotGrid onSurface slots={slots} selected={start} onSelect={setStart} />
        ) : (
          <p className="rounded-[12px] bg-fill/8 px-3 py-3 text-footnote text-label2">この日はほかに空いている時間がありません。別の日をお選びください。</p>
        )}
      </div>
      <PanelActions
        muted={start === undefined}
        note={start !== undefined && date ? `${mdw(fromKey(date))} ${range(start, appt.end - appt.start)} に変更します` : "日付と時間を選んでください"}
      >
        <Button variant="gray" onClick={onClose} className="md:min-w-[112px]">
          やめる
        </Button>
        <Button disabled={start === undefined} onClick={confirm} className="md:min-w-[148px]">
          この日時に変更
        </Button>
      </PanelActions>
    </div>
  );
}

/** キャンセルの確認（理由は任意で選ぶ） */
function CancelPanel({ appt, onClose }: { appt: Appointment; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [reason, setReason] = useState<string>();
  const sv = serviceById(appt.serviceId);

  const confirm = () => {
    const p = patientById(appt.patientId);
    store.updateAppointment(appt.id, { status: "cancelled", cancelReason: reason });
    store.addNotice({
      kind: "cancel",
      title: "予約がキャンセルされました",
      body: `${p.name}さん・${mdw(fromKey(appt.date))} ${hm(appt.start)} ${sv.name}（${reason ?? "理由の入力なし"}）`,
      apptId: appt.id,
    });
    toast("予約をキャンセルしました", { icon: CircleX, detail: `${mdw(fromKey(appt.date))} ${hm(appt.start)} ${sv.short}` });
  };

  return (
    <div className="px-4 pb-4 pt-4 md:px-5">
      <PanelTitle sub={`${mdw(fromKey(appt.date))} ${hm(appt.start)}・${sv.name}`}>この予約をキャンセルしますか？</PanelTitle>
      <div className="mb-2 text-footnote font-medium text-label2">キャンセルの理由（任意）</div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="キャンセルの理由">
        {CANCEL_REASONS.map(r => {
          const on = reason === r;
          return (
            <motion.button
              key={r}
              whileTap={tap}
              role="radio"
              aria-checked={on}
              onClick={() => setReason(on ? undefined : r)}
              className={cn(
                "h-9 rounded-full px-3.5 text-[15px] transition-colors duration-150",
                on ? "bg-ink font-medium text-onink" : "bg-fill/12 text-label hover:bg-fill/20",
              )}
            >
              {r}
            </motion.button>
          );
        })}
      </div>
      <PanelActions muted note="キャンセルすると、この時間はほかの方が予約できるようになります。">
        <Button variant="gray" onClick={onClose} className="md:min-w-[112px]">
          やめる
        </Button>
        <Button variant="destructive" onClick={confirm} className="md:min-w-[148px]">
          キャンセルする
        </Button>
      </PanelActions>
    </div>
  );
}
