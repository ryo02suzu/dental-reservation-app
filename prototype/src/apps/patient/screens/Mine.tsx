import { useEffect, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { ME } from "@/data";
import { useMinWidth } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { ApptCard } from "./parts/ApptCard";
import { useUpcoming } from "./parts/appts";
import { HistorySection, NotifySection, PatientCard } from "./parts/mine";
import { PatientPage } from "./parts/shell";
import { SectionHeading } from "./parts/ui";
import { NoUpcoming } from "./parts/NoUpcoming";

/** 予約の確認（今後のご予約・診察券・通院履歴・お知らせの設定） */
export default function MyAppointments({ param }: { param?: string }) {
  const { go } = useRoute();
  const wide = useMinWidth(1024); // 右の列が出る幅（PatientPage と同じ）
  const upcoming = useUpcoming();
  const mine = upcoming.filter(a => a.patientId === ME.id);
  const others = upcoming.filter(a => a.patientId !== ME.id);

  // ホームの「診察券」から来たときは、診察券を見えるところまで送る
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (param !== "card") return;
    const t = window.setTimeout(() => cardRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 420);
    return () => window.clearTimeout(t);
  }, [param]);

  const card = (
    <div ref={cardRef} className="mt-10 scroll-mt-20 first:mt-0">
      <SectionHeading className="!mt-0">診察券</SectionHeading>
      <PatientCard />
    </div>
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
          {mine.map(a => (
            <ApptCard key={a.id} appt={a} />
          ))}
        </AnimatePresence>
      </div>
      {mine.length === 0 && <NoUpcoming title="今後のご予約はありません" />}

      {others.length > 0 && (
        <>
          <SectionHeading>ご家族・ほかの方のご予約</SectionHeading>
          <p className="-mt-1.5 mb-3 px-1 text-footnote leading-[1.6] text-label2">この端末からお取りしたご予約です。</p>
          <div className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
              {others.map(a => (
                <ApptCard key={a.id} appt={a} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}

      {!wide && card}
      <HistorySection />
      {!wide && <NotifySection />}
    </PatientPage>
  );
}
