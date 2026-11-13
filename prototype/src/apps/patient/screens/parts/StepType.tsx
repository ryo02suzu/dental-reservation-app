import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { ME, clinic, serviceById } from "@/data";
import { fromKey, hm, mdw } from "@/lib/format";
import { useRoute } from "@/lib/nav";
import { Avatar, ListRow, ListSection, cn, tapSoft } from "@/ui";
import { useUpcoming } from "./appts";
import { BookingPage } from "./BookingPage";
import { mePrefill, menuIds, useBooking, type Draft, type Visit } from "./booking";
import { CopyButton } from "./ui";

function MeCard({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <motion.button
      whileTap={tapSoft}
      transition={{ type: "spring", stiffness: 600, damping: 32 }}
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-[88px] w-full items-center gap-4 rounded-card bg-surface px-4 py-4 text-left transition-shadow duration-200 md:px-5",
        selected ? "shadow-[inset_0_0_0_2px_rgb(var(--accent)/0.7)]" : "hover:shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.25)]",
      )}
    >
      <Avatar name={ME.name} size={48} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[19px] font-semibold leading-6 palt">{ME.name}さん</div>
        <div className="mt-1 text-[15px] leading-[1.45] text-label2 tnum">診察券番号 {ME.number}・通院中（再診）</div>
      </div>
      {selected ? (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-onink">
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-label4" strokeWidth={2.4} />
      )}
    </motion.button>
  );
}

type Kind = "me" | "family" | "first";
const kindOf = (d: Draft): Kind | undefined => (d.visit === "first" ? "first" : d.visit === "return" ? (d.who === "family" ? "family" : "me") : undefined);

/** 1. どなたのご予約か（ログイン中の本人を既定に、ご家族・はじめての方） */
export function StepType({ d }: { d: Draft }) {
  const { go } = useRoute();
  const { setDraft } = useBooking();
  const next = useUpcoming()[0];
  const current = kindOf(d);

  const choose = (k: Kind) => {
    const visit: Visit = k === "first" ? "first" : "return";
    const same = current === k;
    const keepService = d.visit === visit && d.serviceId && menuIds(visit).includes(d.serviceId);
    const blank = { name: "", kana: "", phone: "", email: "", number: "", birth: undefined, sex: undefined };
    setDraft({
      visit,
      who: k === "first" ? undefined : k,
      serviceId: keepService ? d.serviceId : undefined,
      // 本人はログイン中の情報を入れておく。ほかの方に切り替えたときは空にする（同じ選択ならそのまま）
      ...(same ? {} : k === "me" ? { ...blank, ...mePrefill() } : current === "me" || current === undefined ? blank : {}),
    });
    go("book", "menu");
  };
  const otherCheck = (k: Kind) =>
    current === k ? (
      <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-accent text-onink">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    ) : undefined;

  return (
    <BookingPage step="type" d={d} subtitle="ご家族のご予約や、はじめての方のご予約もこちらからできます。">
      <MeCard selected={current === undefined || current === "me"} onClick={() => choose("me")} />
      <p className="mt-2.5 px-1 text-footnote leading-[1.6] text-label2">ご登録の連絡先で進みます。入力はいりません。</p>

      <ListSection header="ほかの方のご予約" className="!mt-8">
        <ListRow title="ご家族（通院中の方）" subtitle="当院の診察券をお持ちのご家族" trailing={otherCheck("family")} chevron={current !== "family"} onClick={() => choose("family")} />
        <ListRow title="はじめての方（初診）" subtitle="当院を受診されるのが初めての方" trailing={otherCheck("first")} chevron={current !== "first"} onClick={() => choose("first")} />
      </ListSection>

      {next && (
        <ListSection header="すでにご予約がある方" footer="日時の変更・キャンセルは「予約の確認」から行えます。" className="!mt-9">
          <ListRow
            title={<span className="tnum">{`${mdw(fromKey(next.date))} ${hm(next.start)}`}</span>}
            subtitle={serviceById(next.serviceId).name}
            value="予約の確認"
            chevron
            onClick={() => go("mine")}
          />
        </ListSection>
      )}

      <ListSection header="お急ぎの方" footer="急な痛みや腫れ、詰め物が取れたときは、お電話のほうが早くご案内できます。" className="!mt-9">
        <ListRow
          title={<span className="text-[17px] tnum">{clinic.phone}</span>}
          subtitle="診療時間内にお電話ください"
          trailing={<CopyButton text={clinic.phone} what="電話番号" />}
        />
      </ListSection>
    </BookingPage>
  );
}
