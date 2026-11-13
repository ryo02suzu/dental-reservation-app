import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { ME, clinic, serviceById, staffById } from "@/data";
import type { Appointment } from "@/data";
import { TODAY, useNow } from "@/lib/clock";
import { fromKey, hm, md, mdw, relDay } from "@/lib/format";
import { useIsPhone, useIsWide } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { Avatar, Button, StatusPill, Surface, tap } from "@/ui";
import { useUpcoming } from "./parts/appts";
import { mePrefill, useBooking } from "./parts/booking";
import { AccessSection, HoursTable, MenuOverview, TodayStatus } from "./parts/clinic";
import { PatientPage } from "./parts/shell";
import { ClinicMark, SectionHeading } from "./parts/ui";

/** 医院のWeb予約のトップ。予約する・次回のご予約・診療時間・アクセス・診療メニュー */
export default function PatientHome({ param }: { param?: string }) {
  void param;
  const { go } = useRoute();
  const at = useNow();
  const phone = useIsPhone();
  const wide = useIsWide();
  const upcoming = useUpcoming();

  const info = (
    <>
      <SectionHeading>診療時間</SectionHeading>
      <HoursTable at={at} />
      <AccessSection />
    </>
  );

  return (
    <PatientPage
      title={clinic.name}
      subtitle={clinic.access}
      leading={<ClinicMark size={30} className="ml-2 md:ml-0" />}
      actions={
        <motion.button whileTap={tap} onClick={() => go("mine")} aria-label="予約の確認・診察券" title="予約の確認・診察券" className="mr-2 rounded-full md:mr-0">
          <Avatar name={ME.name} size={32} />
        </motion.button>
      }
      side={info}
    >
      <TodayStatus at={at} />
      <div className="mt-6">
        <Button size="lg" full={phone} className={phone ? undefined : "min-w-[240px]"} onClick={() => go("book", "type")}>
          予約する
        </Button>
        <p className="mt-2.5 px-1 text-footnote text-label2">Web予約は24時間、30日先まで受け付けています。</p>
      </div>

      <SectionHeading>次回のご予約</SectionHeading>
      {upcoming[0] ? <NextCard a={upcoming[0]} more={upcoming.length - 1} /> : <NoNext />}

      {!wide && info}
      <MenuOverview />
    </PatientPage>
  );
}

function NextCard({ a, more }: { a: Appointment; more: number }) {
  const { go } = useRoute();
  const sv = serviceById(a.serviceId);
  const st = staffById(a.staffId);
  const day = fromKey(a.date);
  return (
    <>
      <Surface onClick={() => go("mine")} padded={false} className="overflow-hidden">
        <div className="px-4 pb-4 pt-3.5 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-footnote font-semibold text-accent">{relDay(day, TODAY)}</span>
            {a.status === "pending" && <StatusPill status="pending" />}
          </div>
          <div className="mt-1 text-title2 tnum palt">
            {mdw(day)} {hm(a.start)}
          </div>
          <div className="mt-2 text-[16px] leading-[22px]">{sv.name}</div>
          <div className="mt-0.5 text-footnote text-label2 tnum">
            {hm(a.start)}–{hm(a.end)}・担当 {st.name}（{st.role}）
          </div>
          {a.status === "pending" && <div className="mt-1 text-footnote text-label2">医院の確認待ちです</div>}
        </div>
        <div className="hairline-t flex h-12 items-center justify-between px-4 text-[16px] text-accent md:px-5 md:text-[15px]">
          <span>予約の確認・変更</span>
          <ChevronRight className="h-[18px] w-[18px] text-label4" strokeWidth={2.4} />
        </div>
      </Surface>
      {more > 0 && (
        <button onClick={() => go("mine")} className="mt-2.5 px-1 text-footnote font-medium text-accent">
          ほかに{more}件のご予約があります
        </button>
      )}
    </>
  );
}

/** 次回の予約がないとき。定期検診の目安を添えて、そのまま定期検診の予約へ */
function NoNext() {
  const { go } = useRoute();
  const { setDraft } = useBooking();
  const due = ME.nextRecall;
  return (
    <div className="rounded-card bg-surface px-4 py-4 md:px-5">
      <div className="text-[16px] font-semibold">次回のご予約はありません</div>
      <p className="mt-1 text-footnote leading-[1.6] text-label2">
        {due ? `定期検診の目安は${md(due)}ごろです。3か月ごとの検診で、むし歯や歯周病を早めに見つけられます。` : "定期検診は3か月ごとがおすすめです。"}
      </p>
      <Button
        variant="tinted"
        className="mt-3.5"
        onClick={() => {
          setDraft({ visit: "return", serviceId: "sv01", date: undefined, start: undefined, ...mePrefill() });
          go("book", "time");
        }}
      >
        定期検診を予約
      </Button>
    </div>
  );
}
