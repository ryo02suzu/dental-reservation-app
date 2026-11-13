import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { BellOff, CheckCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/clock";
import { useIsPhone, useIsWide } from "@/lib/media";
import type { Notice } from "@/data";
import { Button, EmptyState, Page, Segmented, cn, springSoft, useToast } from "@/ui";
import { useClinicUI } from "../context";
import { NoticeRow } from "./notifications/NoticeRow";
import { NoticePreview } from "./notifications/NoticePreview";
import { groupOf, type DayGroup } from "./notifications/util";

type Filter = "all" | "unread";
const GROUPS: DayGroup[] = ["今日", "昨日", "それ以前"];

/**
 * お知らせ（iPhoneの通知センターのように、今日・昨日・それ以前に分けて新しい順）。
 * スマホ・iPad：1列。行を押すと既読になり、予約に関係するものは予約の詳細が開く。
 * 1180px以上：左に一覧、右に選んだお知らせの詳細（承認・空き枠への予約などをその場で）。
 */
export default function NotificationsScreen({ param }: { param?: string }) {
  void param;
  const ui = useClinicUI();
  const phone = useIsPhone();
  const split = useIsWide();
  const toast = useToast();
  const now = useNow(30_000);
  const { notices, readNotice, readAllNotices } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  // 「未読」で開いて既読になったものは、絞り込みを切り替えるまで一覧に残す（押した行が消えないように）
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const unread = notices.filter(n => !n.read).length;
  const sorted = useMemo(() => [...notices].sort((a, b) => b.at.getTime() - a.at.getTime()), [notices]);
  const visible = filter === "all" ? sorted : sorted.filter(n => !n.read || kept.has(n.id));
  const groups = GROUPS.map(g => ({ g, items: visible.filter(n => groupOf(n.at, now) === g) })).filter(x => x.items.length);

  const changeFilter = (f: Filter) => {
    setFilter(f);
    setKept(new Set());
  };

  // PCの詳細は、選んだものがなければ一覧の先頭を見せる（見せるだけで既読にはしない）
  const selected = split ? visible.find(n => n.id === selectedId) ?? visible[0] : undefined;
  useEffect(() => {
    if (!split) setSelectedId(null);
  }, [split]);

  const open = (n: Notice) => {
    if (!n.read) {
      if (filter === "unread") setKept(s => new Set(s).add(n.id));
      readNotice(n.id);
    }
    if (split) setSelectedId(n.id);
    else if (n.apptId) ui.openAppointment(n.apptId);
  };

  const readAll = () => {
    if (filter === "unread") setKept(new Set(sorted.filter(n => !n.read).map(n => n.id)));
    readAllNotices();
    toast("すべて既読にしました", { icon: CheckCheck, detail: `${unread}件` });
  };

  const list = groups.length ? (
    <LayoutGroup id="notices">
      {groups.map(({ g, items }) => (
        <motion.section key={g} layout="position" transition={springSoft} className="mt-7 first:mt-0">
          <h3 className="px-4 pb-1.5 text-footnote font-medium text-label2">{g}</h3>
          <div className="overflow-hidden rounded-cell bg-surface">
            <AnimatePresence initial={false}>
              {items.map(n => (
                <NoticeRow key={n.id} n={n} now={now} selected={selected?.id === n.id} onClick={() => open(n)} />
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      ))}
    </LayoutGroup>
  ) : filter === "unread" ? (
    <EmptyState
      icon={CheckCheck}
      title="未読のお知らせはありません"
      message="Web予約やキャンセル、リコールからの予約が届くと、ここに表示されます。"
      action={<Button variant="gray" size="sm" onClick={() => changeFilter("all")}>すべてのお知らせを見る</Button>}
      className="pt-16"
    />
  ) : (
    <EmptyState icon={BellOff} title="お知らせはありません" message="Web予約やキャンセルが届くと、ここに表示されます。" className="pt-16" />
  );

  return (
    <Page
      title="お知らせ"
      back={ui.back}
      actions={
        <Button variant="plain" size="sm" disabled={!unread} onClick={readAll} className={cn(phone && "text-[17px] font-normal")}>
          すべて既読
        </Button>
      }
      accessory={
        <Segmented
          value={filter}
          onChange={changeFilter}
          full={phone}
          className={phone ? undefined : "w-[260px]"}
          options={[
            { value: "all", label: "すべて" },
            { value: "unread", label: <>未読{unread ? <span className="tnum opacity-55">{unread}</span> : null}</> },
          ]}
        />
      }
    >
      {split ? (
        <div className="grid grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)] items-start gap-6">
          <div>{list}</div>
          <div className="sticky top-[64px]">
            <NoticePreview n={selected} now={now} unread={unread} />
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[720px]">{list}</div>
      )}
    </Page>
  );
}
