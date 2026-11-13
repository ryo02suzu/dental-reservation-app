import { useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import { NotebookPen, Pin, Search, SquarePen } from "lucide-react";
import { useStore } from "@/lib/store";
import { TODAY_KEY } from "@/lib/clock";
import { matchesPatient } from "@/lib/format";
import { useIsPhone, useIsWide } from "@/lib/media";
import { patientById, type Memo } from "@/data";
import { Button, EmptyState, IconButton, Page, SearchField, Segmented, Sheet, cn, springSoft, useToast } from "@/ui";
import { useClinicUI } from "../context";
import { MemoCard } from "./records/MemoCard";
import { ComposerFields, useComposer, type ComposerState } from "./records/Composer";
import { dayLabel, toothName } from "./records/util";

type Filter = "all" | "today" | "pinned";
const PAGE_DAYS = 4;

const byNewest = (a: Memo, b: Memo) => (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1);

/**
 * 診療メモ（受付・歯科衛生士・歯科医師のあいだの申し送り。カルテではない）。
 * 新しい順に日ごとにまとめ、ピン留めは上に。PC（1180px以上）は右に入力欄、それ以外は右上のボタンからシートで書く。
 */
export default function RecordsScreen({ param }: { param?: string }) {
  void param;
  const ui = useClinicUI();
  const phone = useIsPhone();
  const twoCol = useIsWide();
  const toast = useToast();
  const { memos, addMemo } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [days, setDays] = useState(PAGE_DAYS);
  const [composeOpen, setComposeOpen] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const c = useComposer();

  const query = q.trim();
  const matched = useMemo(() => {
    if (!query) return memos;
    const low = query.toLowerCase();
    return memos.filter(m => {
      const p = patientById(m.patientId);
      return matchesPatient(p, query) || m.body.toLowerCase().includes(low) || (m.next ?? "").toLowerCase().includes(low) || (m.teeth ?? []).some(t => toothName(t).includes(query));
    });
  }, [memos, query]);

  const pinned = useMemo(() => matched.filter(m => m.pinned).sort(byNewest), [matched]);
  const groups = useMemo(() => {
    const src = matched.filter(m => (filter === "today" ? m.date === TODAY_KEY : !m.pinned || filter !== "all")).sort(byNewest);
    const map = new Map<string, Memo[]>();
    for (const m of src) {
      const l = map.get(m.date);
      if (l) l.push(m);
      else map.set(m.date, [m]);
    }
    return [...map.entries()];
  }, [matched, filter]);
  const todayCount = memos.filter(m => m.date === TODAY_KEY).length;
  const pinCount = memos.filter(m => m.pinned).length;
  const visibleGroups = query || filter !== "all" ? groups : groups.slice(0, days);
  const hiddenDays = groups.length - visibleGroups.length;

  const submit = (cs: ComposerState) => {
    if (!cs.ready) return;
    const m = addMemo(cs.toMemo());
    const name = patientById(m.patientId).name;
    cs.reset();
    setComposeOpen(false);
    if (filter === "pinned") setFilter("all");
    setQ("");
    setFresh(m.id);
    toast("メモを追加しました", { icon: NotebookPen, detail: `${name}さん` });
  };

  const empty = (
    <EmptyState
      icon={query ? Search : filter === "pinned" ? Pin : NotebookPen}
      title={query ? `「${query}」に一致するメモはありません` : filter === "pinned" ? "ピン留めしたメモはありません" : "今日のメモはまだありません"}
      message={query ? "患者さんの氏名・ふりがな、または本文の言葉で探せます。" : filter === "pinned" ? "服薬やアレルギーなど、毎回見てほしいメモはピン留めしておくと上に出ます。" : "診療が終わったら、処置の内容と次回の予定を残しておきましょう。"}
      action={!query && filter === "today" && !twoCol ? <Button variant="tinted" size="sm" icon={SquarePen} onClick={() => setComposeOpen(true)}>メモを書く</Button> : undefined}
      className="rounded-cell bg-surface"
    />
  );

  const showPinnedSection = filter === "all" && pinned.length > 0;
  const feed = (
    <LayoutGroup id="memos">
      {showPinnedSection && (
        <Group key="pinned" title="ピン留め" count={pinned.length}>
          {pinned.map(m => <MemoCard key={m.id} m={m} showDate fresh={m.id === fresh} />)}
        </Group>
      )}
      {filter === "pinned" ? (
        pinned.length ? (
          <Group title="ピン留め" count={pinned.length}>
            {pinned.map(m => <MemoCard key={m.id} m={m} showDate />)}
          </Group>
        ) : empty
      ) : visibleGroups.length ? (
        visibleGroups.map(([k, items]) => (
          <Group key={k} title={dayLabel(k)} count={items.length}>
            {items.map(m => <MemoCard key={m.id} m={m} fresh={m.id === fresh} />)}
          </Group>
        ))
      ) : !showPinnedSection ? empty : null}
      {hiddenDays > 0 && (
        <motion.div layout="position" className="mt-5 flex justify-center">
          <Button variant="gray" size="sm" onClick={() => setDays(d => d + 5)}>以前のメモを表示</Button>
        </motion.div>
      )}
    </LayoutGroup>
  );

  const controls = (
    <div className={cn(phone ? "space-y-3" : "flex items-center gap-3")}>
      <SearchField value={q} onChange={setQ} placeholder="患者名・内容で検索" className={phone ? undefined : "w-[280px]"} />
      <Segmented
        value={filter}
        onChange={setFilter}
        full={phone}
        className={phone ? undefined : "w-[300px]"}
        options={[
          { value: "all", label: "すべて" },
          { value: "today", label: <>今日{todayCount ? <span className="tnum opacity-55">{todayCount}</span> : null}</> },
          { value: "pinned", label: <>ピン留め{pinCount ? <span className="tnum opacity-55">{pinCount}</span> : null}</> },
        ]}
      />
    </div>
  );

  return (
    <Page
      title="診療メモ"
      subtitle="スタッフ間の申し送り・カルテとは別です"
      back={ui.back}
      actions={
        twoCol ? undefined : phone ? (
          <IconButton icon={SquarePen} label="メモを書く" variant="plain" onClick={() => setComposeOpen(true)} />
        ) : (
          <Button size="sm" icon={SquarePen} onClick={() => setComposeOpen(true)}>メモを書く</Button>
        )
      }
      accessory={twoCol ? undefined : controls}
    >
      {twoCol ? (
        <div className="grid grid-cols-[minmax(0,1fr)_352px] items-start gap-6">
          <div>
            <div className="pb-4">{controls}</div>
            {feed}
          </div>
          <aside className="sticky top-[64px] flex max-h-[calc(100vh-164px)] flex-col overflow-hidden rounded-card bg-surface">
            <div className="hairline-b flex h-[52px] shrink-0 items-center justify-between px-5">
              <h2 className="text-headline palt">メモを書く</h2>
              {(c.patientId || c.body || c.teeth.length > 0 || c.next) && (
                <button type="button" onClick={c.reset} className="text-[14px] text-accent transition-opacity hover:opacity-70">消去</button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
              <ComposerFields c={c} />
            </div>
            <div className="hairline-t shrink-0 px-5 pb-5 pt-4">
              <Button full disabled={!c.ready} onClick={() => submit(c)}>メモを追加</Button>
              <p className="mt-2 h-[18px] text-center text-footnote text-label3">
                {!c.patientId ? "患者さんを選んでください" : !c.body.trim() ? "内容を入力してください" : "今日の日付・いまの時刻で残ります"}
              </p>
            </div>
          </aside>
        </div>
      ) : (
        feed
      )}
      {!twoCol && (
        <Sheet
          open={composeOpen}
          onOpenChange={setComposeOpen}
          title="メモを書く"
          cancelLabel="キャンセル"
          confirmLabel="追加"
          confirmDisabled={!c.ready}
          onConfirm={() => submit(c)}
        >
          <div className="pt-2">
            <ComposerFields c={c} />
          </div>
        </Sheet>
      )}
    </Page>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <motion.section layout="position" transition={springSoft} className="mt-7 first:mt-0">
      <div className="flex items-end justify-between px-4 pb-1.5">
        <h3 className="text-footnote font-medium text-label2">{title}</h3>
        <span className="text-footnote text-label3 tnum">{count}件</span>
      </div>
      <div className="overflow-hidden rounded-cell bg-surface">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </motion.section>
  );
}
