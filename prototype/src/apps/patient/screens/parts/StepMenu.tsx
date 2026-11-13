import { ME, serviceById } from "@/data";
import { fromKey, hm, mdw } from "@/lib/format";
import { useRoute } from "@/lib/nav";
import { ListSection } from "@/ui";
import { useUpcoming } from "./appts";
import { BookingPage } from "./BookingPage";
import { MENU_GROUPS, useBooking, type Draft } from "./booking";
import { MenuRow } from "./clinic";

/** 2. メニュー（選ぶとそのまま日時へ） */
export function StepMenu({ d }: { d: Draft }) {
  const { go } = useRoute();
  const { setDraft } = useBooking();
  const visit = d.visit ?? "return";
  const upcoming = useUpcoming().filter(a => a.patientId === ME.id);

  const pick = (id: string) => {
    // 長さが変わると選べる時間も変わるので、時間だけ選び直してもらう
    const sameLength = d.serviceId && serviceById(d.serviceId).minutes === serviceById(id).minutes;
    setDraft({ serviceId: id, ...(sameLength ? {} : { start: undefined }) });
    go("book", "time");
  };
  // 再診で、同じメニューの予約がすでにある（重複に気づけるように）
  const already = (id: string) => {
    if (visit !== "return") return undefined;
    const a = upcoming.find(x => x.serviceId === id);
    return a ? `${mdw(fromKey(a.date))} ${hm(a.start)}にご予約があります` : undefined;
  };

  return (
    <BookingPage
      step="menu"
      d={d}
      subtitle={visit === "first" ? "はじめての方は、お口全体の検査とご説明から始めます。" : "料金は自費診療のみ表示しています。保険診療は窓口負担の割合によって異なります。"}
    >
      {MENU_GROUPS[visit].map((g, i) => (
        <ListSection key={g.title} header={g.title} footer={g.footer} className={i === 0 ? "!mt-0" : undefined}>
          {g.ids.map(id => (
            <MenuRow key={id} sv={serviceById(id)} selected={d.serviceId === id} note={already(id)} onClick={() => pick(id)} />
          ))}
        </ListSection>
      ))}
    </BookingPage>
  );
}
