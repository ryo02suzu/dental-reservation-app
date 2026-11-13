import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ME, serviceById } from "@/data";
import { TODAY, TODAY_KEY } from "@/lib/clock";
import { duration, fromKey, mdw, relDay } from "@/lib/format";
import { useIsPhone } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { Button } from "@/ui";
import { BookingPage } from "./BookingPage";
import { DatePicker, SlotGrid } from "./DatePicker";
import { LEAD_MIN, dayInfos, range, useBooking, type Draft } from "./booking";
import { ActionBar } from "./shell";

/** 3. 日時（日付 → 時間 → 次へ） */
export function StepTime({ d }: { d: Draft }) {
  const { go } = useRoute();
  const { setDraft } = useBooking();
  const { appointments } = useStore();
  const phone = useIsPhone();
  const sv = serviceById(d.serviceId ?? "sv01");
  const days = useMemo(
    () => dayInfos(sv.minutes, appointments, { patientId: d.visit === "return" ? ME.id : undefined }),
    [sv.minutes, appointments, d.visit],
  );
  const firstOpen = days.find(x => x.slots.length > 0)?.key;
  const date = d.date && days.some(x => x.key === d.date && x.slots.length > 0) ? d.date : firstOpen;
  const info = days.find(x => x.key === date);
  const slots = info?.slots ?? [];
  const start = d.date === date && d.start !== undefined && slots.includes(d.start) ? d.start : undefined;
  const day = date ? fromKey(date) : undefined;
  const rel = day ? relDay(day, TODAY) : "";

  return (
    <BookingPage
      step="time"
      d={d}
      subtitle={`${sv.name}・${duration(sv.minutes)}`}
      footer={
        <ActionBar note={day && start !== undefined ? `${mdw(day)} ${range(start, sv.minutes)}` : "時間を選んでください"}>
          <Button size="lg" full={phone} className={phone ? undefined : "min-w-[200px]"} disabled={start === undefined} onClick={() => go("book", "info")}>
            次へ
          </Button>
        </ActionBar>
      }
    >
      <DatePicker days={days} selected={date} onSelect={k => setDraft({ date: k, start: undefined })} />

      <div className="mt-9">
        {day ? (
          <>
            <div className="mb-3.5 flex items-baseline gap-2">
              <h2 className="text-title3 tnum palt">{mdw(day)}</h2>
              {(rel === "今日" || rel === "明日" || rel === "明後日") && <span className="text-subhead text-label2">{rel}</span>}
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={date} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.2 }}>
                <SlotGrid slots={slots} selected={start} onSelect={t => setDraft({ date, start: t })} />
                {date === TODAY_KEY && (
                  <p className="mt-4 px-0.5 text-footnote text-label2">当日のご予約は、開始の{LEAD_MIN / 60}時間前まで承ります。</p>
                )}
              </motion.div>
            </AnimatePresence>
          </>
        ) : (
          <p className="rounded-cell bg-surface px-4 py-5 text-subhead leading-[1.6] text-label2">
            30日先まで空きがありません。お手数ですが、お電話でご相談ください。
          </p>
        )}
      </div>
    </BookingPage>
  );
}
