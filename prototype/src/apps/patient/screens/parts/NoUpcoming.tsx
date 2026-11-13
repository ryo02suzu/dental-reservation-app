import { ME } from "@/data";
import { useRoute } from "@/lib/nav";
import { Button } from "@/ui";
import { mePrefill, useBooking } from "./booking";

/** 「11月中旬ごろ」。目安の日がちょうど休診日に当たっても、案内として不自然にならないよう旬で伝える */
export function aroundLabel(d: Date): string {
  const n = d.getDate();
  return `${d.getMonth() + 1}月${n <= 10 ? "上旬" : n <= 20 ? "中旬" : "下旬"}ごろ`;
}

/** 次の予約がないとき（ホーム・予約の確認で共通）。定期検診の目安を添えて、日時の選択へ直接進む */
export function NoUpcoming({ title }: { title: string }) {
  const { go } = useRoute();
  const { setDraft } = useBooking();
  const due = ME.nextRecall;
  return (
    <div className="rounded-card bg-surface px-4 py-4 md:px-5">
      <div className="text-[16px] font-semibold">{title}</div>
      <p className="mt-1 text-footnote leading-[1.6] text-label2">
        {due ? `定期検診の目安は${aroundLabel(due)}です。3か月ごとの検診で、むし歯や歯周病を早めに見つけられます。` : "定期検診は3か月ごとがおすすめです。"}
      </p>
      <Button
        variant="tinted"
        className="mt-3.5"
        onClick={() => {
          setDraft({ visit: "return", who: "me", serviceId: "sv01", date: undefined, start: undefined, apptId: undefined, receipt: undefined, ...mePrefill(), note: "" });
          go("book", "time");
        }}
      >
        定期検診を予約
      </Button>
    </div>
  );
}
