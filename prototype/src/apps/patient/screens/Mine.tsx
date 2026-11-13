import { AnimatePresence } from "framer-motion";
import { ME } from "@/data";
import { md } from "@/lib/format";
import { useIsWide } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { Button } from "@/ui";
import { ApptCard } from "./parts/ApptCard";
import { useUpcoming } from "./parts/appts";
import { HistorySection, NotifySection, PatientCard } from "./parts/mine";
import { PatientPage } from "./parts/shell";
import { SectionHeading } from "./parts/ui";

/** 予約の確認（今後のご予約・診察券・通院履歴・お知らせの設定） */
export default function MyAppointments({ param }: { param?: string }) {
  void param;
  const { go } = useRoute();
  const wide = useIsWide();
  const upcoming = useUpcoming();

  const card = (
    <>
      <SectionHeading>診察券</SectionHeading>
      <PatientCard />
    </>
  );

  return (
    <PatientPage
      title="予約の確認"
      subtitle={`${ME.name}さん`}
      back={{ label: "ホーム", onClick: () => go("home") }}
      side={
        <>
          {card}
          <NotifySection />
        </>
      }
    >
      <SectionHeading>今後のご予約</SectionHeading>
      <div className="space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {upcoming.map(a => (
            <ApptCard key={a.id} appt={a} />
          ))}
        </AnimatePresence>
      </div>
      {upcoming.length === 0 && (
        <div className="rounded-card bg-surface px-4 py-5 md:px-5">
          <div className="text-[16px] font-semibold">今後のご予約はありません</div>
          <p className="mt-1 text-footnote leading-[1.6] text-label2">
            {ME.nextRecall ? `定期検診の目安は${md(ME.nextRecall)}ごろです。` : "定期検診は3か月ごとがおすすめです。"}
          </p>
          <Button className="mt-3.5" onClick={() => go("book", "type")}>
            予約する
          </Button>
        </div>
      )}

      {!wide && card}
      <HistorySection />
      {!wide && <NotifySection />}
    </PatientPage>
  );
}
