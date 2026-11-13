import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, ChevronDown } from "lucide-react";
import { ME, clinic, serviceById, staffById, visitsOf } from "@/data";
import { fromKey, md } from "@/lib/format";
import { useStore } from "@/lib/store";
import { ListRow, ListSection, Switch, cn, easeOut, useToast } from "@/ui";
import { QrCode } from "./QrCode";
import { setNotify, useNotify } from "./session";
import { REMIND_LABEL } from "./booking";
import { ClinicMark, SectionHeading } from "./ui";

// ─── 診察券 ─────────────────────────────────────────────────────────────────
/** ウォレットのカードのような診察券。受付端末で読み取るコードは番号から作る */
export function PatientCard() {
  return (
    <div>
      <div className="rounded-[22px] bg-sand px-5 pb-5 pt-4 text-onsand">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <ClinicMark size={28} inverse />
            <span className="truncate text-[15px] font-semibold">{clinic.name}</span>
          </div>
          <span className="shrink-0 text-footnote font-semibold text-onsand/70">診察券</span>
        </div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-caption font-medium text-onsand/65">お名前</div>
            <div className="mt-0.5 truncate text-[20px] font-semibold leading-6">{ME.name}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-caption font-medium text-onsand/65">診察券番号</div>
            <div className="mt-0.5 text-[20px] font-semibold leading-6 tnum">{ME.number}</div>
          </div>
        </div>
        <div className="mt-5 flex flex-col items-center">
          <div className="rounded-[14px] bg-white p-2">
            <QrCode value={ME.number} size={136} />
          </div>
          <div className="mt-3 text-footnote font-medium text-onsand/80">受付の端末にかざしてください</div>
        </div>
      </div>
      <p className="mt-2.5 px-1 text-footnote text-label2">読み取りにくいときは、画面を明るくしてください。</p>
    </div>
  );
}

// ─── お知らせの設定 ─────────────────────────────────────────────────────────
export function NotifySection() {
  const s = useNotify();
  const toast = useToast();
  return (
    <>
      <SectionHeading>お知らせの設定</SectionHeading>
      <ListSection
        className="!mt-0"
        footer={s.line ? "予約の確定・変更・キャンセルのお知らせが、LINEに届きます。" : `お知らせはSMS（${ME.phone}）でお送りします。`}
      >
        <ListRow
          title="LINEで受け取る"
          subtitle="LINE連携済み"
          trailing={
            <Switch
              checked={s.line}
              label="LINEで受け取る"
              onChange={v => {
                setNotify({ line: v });
                toast(v ? "LINEでのお知らせをオンにしました" : "LINEでのお知らせをオフにしました", { icon: v ? Bell : BellOff });
              }}
            />
          }
        />
        <ListRow
          title="前日のリマインド"
          subtitle={`ご予約の${REMIND_LABEL}にお送りします`}
          trailing={
            <Switch
              checked={s.remind}
              label="前日のリマインド"
              onChange={v => {
                setNotify({ remind: v });
                toast(v ? "前日のリマインドをオンにしました" : "前日のリマインドをオフにしました", { icon: v ? Bell : BellOff });
              }}
            />
          }
        />
      </ListSection>
    </>
  );
}

// ─── 通院履歴 ───────────────────────────────────────────────────────────────
const FIRST_SHOWN = 5;

export function HistorySection() {
  const { appointments } = useStore();
  const [all, setAll] = useState(false);
  // 42日以内はストアの完了した予約、それより前は来院記録から。
  // 院内の診療メモ（略語や所見）は患者さんには見せず、メニューと担当だけを出す
  const items = useMemo(() => {
    const recent = appointments
      .filter(a => a.patientId === ME.id && a.status === "completed")
      .map(a => ({ date: fromKey(a.date), serviceId: a.serviceId, staffId: a.staffId }));
    return [...recent, ...visitsOf(ME)].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [appointments]);
  const shown = all ? items : items.slice(0, FIRST_SHOWN);
  const years = [...new Set(shown.map(v => v.date.getFullYear()))];
  const first = ME.firstVisit;

  return (
    <>
      <SectionHeading>通院履歴</SectionHeading>
      {years.map((y, i) => (
        <ListSection key={y} header={`${y}年`} className={i === 0 ? "!mt-0" : "!mt-6"}>
          <AnimatePresence initial={false}>
            {shown
              .filter(v => v.date.getFullYear() === y)
              .map(v => {
                const sv = serviceById(v.serviceId);
                const st = staffById(v.staffId);
                return (
                  <motion.div
                    key={`${v.date.getTime()}-${v.serviceId}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.26, ease: easeOut }}
                    className="group relative overflow-hidden"
                  >
                    <div className="flex items-start gap-3 px-4 py-3">
                      <div className="w-[4.8em] shrink-0 text-[15px] leading-[22px] text-label2 tnum">{md(v.date)}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[16px] leading-[22px] md:text-[15px]">{sv.name}</div>
                        <div className="mt-0.5 text-footnote text-label2">
                          担当 {st.name}（{st.role}）
                        </div>
                      </div>
                    </div>
                    <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </ListSection>
      ))}
      {items.length > FIRST_SHOWN && (
        <button
          onClick={() => setAll(v => !v)}
          aria-expanded={all}
          className="mt-3 flex h-11 w-full items-center justify-center gap-1 rounded-cell text-[15px] font-medium text-accent transition-colors hover:bg-fill/[0.06]"
        >
          {all ? "閉じる" : `すべて表示（${items.length}件）`}
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", all && "rotate-180")} strokeWidth={2.4} />
        </button>
      )}
      <p className="mt-2 px-1 text-footnote text-label2 tnum">
        初診 {first.getFullYear()}年{md(first)}・これまでの来院 {ME.visits}回
      </p>
    </>
  );
}
