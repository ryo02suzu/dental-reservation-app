import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { BellOff, CheckCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { useNow } from "@/lib/clock";
import { useIsPhone, useMinWidth } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import type { Notice } from "@/data";
import { Button, EmptyState, Page, Segmented, cn, springSoft, useToast } from "@/ui";
import { useClinicUI } from "../context";
import { NoticeRow } from "./notifications/NoticeRow";
import { Detail, NoticePreview } from "./notifications/NoticePreview";
import { KIND, groupOf, liveBody, type DayGroup } from "./notifications/util";

type Filter = "all" | "unread";
const GROUPS: DayGroup[] = ["今日", "昨日", "それ以前"];

/**
 * お知らせ（iPhoneの通知センターのように、今日・昨日・それ以前に分けて新しい順）。
 * スマホ・iPad縦：1列。行を押すと既読になり、詳細の画面が横から重なる（param にお知らせID）。
 * 1024px以上：左に一覧、右に選んだお知らせの詳細（確定・空き枠への予約などをその場で）。
 */
export default function NotificationsScreen({ param }: { param?: string }) {
  const ui = useClinicUI();
  const phone = useIsPhone();
  const split = useMinWidth(1024);
  const toast = useToast();
  const now = useNow(30_000);
  const { go } = useRoute();
  const { notices, appointments, readNotice, readAllNotices } = useStore();
  const opened = param ? notices.find(n => n.id === param) : undefined;
  const [filter, setFilter] = useState<Filter>("all");
  // 「未読」で開いて既読になったものは、絞り込みを切り替えるまで一覧に残す（押した行が消えないように）
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(param ?? null);

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

  // リンクから詳細を直接開いたときも既読にする
  useEffect(() => {
    if (opened && !opened.read) readNotice(opened.id);
  }, [opened?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (n: Notice) => {
    if (!n.read) {
      if (filter === "unread") setKept(s => new Set(s).add(n.id));
      readNotice(n.id);
    }
    if (split) setSelectedId(n.id);
    else go("notifications", n.id);
  };

  // スマホ・iPad縦：お知らせ1件の画面
  if (!split && opened) {
    return (
      <Page title={KIND[opened.kind].label} hideLargeTitle back={{ label: "お知らせ", onClick: () => go("notifications") }}>
        <div className="mx-auto max-w-[720px] pt-2">
          <div className="rounded-card bg-surface">
            <Detail n={opened} now={now} />
          </div>
        </div>
      </Page>
    );
  }

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
                <NoticeRow key={n.id} n={n} body={liveBody(n, n.apptId ? appointments.find(a => a.id === n.apptId) : undefined)} now={now} selected={selected?.id === n.id} onClick={() => open(n)} />
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
        <div className="grid grid-cols-[minmax(300px,0.9fr)_minmax(0,1.1fr)] items-start gap-5 xl:gap-6">
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
