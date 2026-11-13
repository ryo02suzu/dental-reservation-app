import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck, Inbox, PauseCircle, Phone, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { useIsPhone, useMinWidth } from "@/lib/media";
import { Button, EmptyState, Page, Segmented, cn, spring, useToast } from "@/ui";
import { useClinicUI } from "../context";
import { STATUSES, STATUS_LABEL, useRecallRows, type RecallRow, type RecallStatus } from "./recall/model";
import { RecallRowView, TABLE_COLS, type RowActions } from "./recall/RecallRowView";
import { RecallSummary } from "./recall/Summary";
import { SendSheet } from "./recall/SendSheet";

/** セグメントの件数。選択中でも読めるよう、文字色の濃さを落として出す */
function SegLabel({ text, n }: { text: string; n?: number }) {
  return (
    <>
      {text}
      {n ? <span className="tnum opacity-55">{n}</span> : null}
    </>
  );
}

const EMPTY: Record<RecallStatus, { title: string; message: string }> = {
  未連絡: { title: "未連絡の方はいません", message: "定期検診の時期が近い方には、すべて連絡済みです。" },
  送信済み: { title: "連絡済みで返事待ちの方はいません", message: "ご案内を送った方・電話した方から予約が入ると「予約済み」に移ります。" },
  予約済み: { title: "まだ予約はありません", message: "リコールから予約が入ると、ここに表示されます。" },
  保留: { title: "保留の方はいません", message: "治療中・転居予定などで連絡を控える方を、ここに分けておけます。" },
};

/**
 * リコール（定期検診のご案内）。期限が前後30日の患者さんを状態ごとに分け、期限の早い順に並べる。
 * 1人ずつ「送る」か、「選択」でまとめて文面を確認してから送る。
 */
export default function RecallScreen({ param }: { param?: string }) {
  void param;
  const ui = useClinicUI();
  const phone = useIsPhone();
  const table = useMinWidth(1024);
  const toast = useToast();
  const { setRecall } = useStore();
  const rows = useRecallRows();
  const [tab, setTab] = useState<RecallStatus>("未連絡");
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState(false);

  const shown = useMemo(() => rows.filter(x => x.r.status === tab), [rows, tab]);
  const canSelect = tab !== "予約済み" && shown.length > 0;
  const selected = shown.filter(x => picked.has(x.p.id));
  const sendable = selected.filter(x => x.r.channel !== "電話").length;
  const callers = selected.length - sendable;

  useEffect(() => {
    if (!canSelect) setSelecting(false);
  }, [canSelect]);

  const changeTab = (t: RecallStatus) => {
    setTab(t);
    setPicked(new Set());
  };
  const endSelect = () => {
    setSelecting(false);
    setPicked(new Set());
  };
  const toggle = (id: string) => setPicked(s => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });
  const allPicked = shown.length > 0 && selected.length === shown.length;

  const act: RowActions = {
    send: x => {
      setRecall(x.p.id, "送信済み");
      toast(`${x.r.channel}で送りました`, { icon: Send, detail: `${x.p.name}さん・定期検診のご案内` });
    },
    resend: x => {
      setRecall(x.p.id, "送信済み");
      toast(`${x.r.channel}で再送しました`, { icon: Send, detail: `${x.p.name}さん` });
    },
    // 電話の方は「送る」ものがないので、かけ直したことだけを残す
    calledAgain: x => {
      setRecall(x.p.id, "送信済み");
      toast("電話で連絡済みにしました", { icon: Phone, detail: `${x.p.name}さん` });
    },
    called: x => {
      setRecall(x.p.id, "送信済み");
      toast("電話で連絡済みにしました", { detail: `${x.p.name}さん` });
    },
    hold: x => {
      setRecall(x.p.id, "保留");
      toast("保留にしました", { icon: PauseCircle, detail: `${x.p.name}さん` });
    },
    restore: x => {
      setRecall(x.p.id, "未連絡");
      toast("未連絡に戻しました", { detail: `${x.p.name}さん` });
    },
    book: x => ui.openNew({ patientId: x.p.id, serviceId: "sv01" }),
    openAppt: x => x.booked && ui.openAppointment(x.booked.id),
    openPatient: x => ui.go("patients", x.p.id),
  };

  const sendAll = (targets: RecallRow[]) => {
    for (const x of targets) setRecall(x.p.id, "送信済み");
    const by = ["LINE", "SMS", "メール"].map(c => [c, targets.filter(x => x.r.channel === c).length] as const).filter(([, n]) => n);
    toast(`${targets.length}人に${tab === "送信済み" ? "再送" : "送り"}ました`, { icon: Send, detail: by.map(([c, n]) => `${c} ${n}件`).join("・") });
    setSheet(false);
    endSelect();
  };

  const actions = canSelect ? (
    <Button variant="plain" size="sm" onClick={() => (selecting ? endSelect() : setSelecting(true))} className={cn(phone && "text-[17px]", phone && !selecting && "font-normal")}>
      {selecting ? "完了" : "選択"}
    </Button>
  ) : undefined;

  const counts = Object.fromEntries(STATUSES.map(s => [s, rows.filter(x => x.r.status === s).length])) as Record<RecallStatus, number>;

  return (
    <Page
      title="リコール"
      subtitle="定期検診の時期が前後30日の患者さん"
      back={ui.back}
      actions={actions}
    >
      <RecallSummary rows={rows} compact={!table} />

      <div className="mt-6">
        <Segmented
          value={tab}
          onChange={changeTab}
          full={phone}
          className={phone ? undefined : "w-[440px]"}
          options={STATUSES.map(s => ({ value: s, label: <SegLabel text={STATUS_LABEL[s]} n={counts[s]} /> }))}
        />
      </div>

      <section className="mt-4">
        <div className="flex h-7 items-end justify-between px-4 pb-1.5">
          <h3 className="text-footnote font-medium text-label2">
            {tab === "予約済み" ? "予約日の早い順" : "期限の早い順"}
          </h3>
          {selecting && (
            <button type="button" onClick={() => setPicked(allPicked ? new Set() : new Set(shown.map(x => x.p.id)))} className="text-footnote font-semibold text-accent">
              {allPicked ? "選択を解除" : "すべて選択"}
            </button>
          )}
        </div>
        {shown.length ? (
          <div className="overflow-hidden rounded-cell bg-surface">
            {table && (
              <div className={cn("hairline-b grid h-9 items-center gap-x-4 pl-4 pr-3 text-[12px] font-medium text-label3", TABLE_COLS)}>
                <span>患者</span>
                <span>{tab === "予約済み" ? "予約" : "期限"}</span>
                <span>前回の検診</span>
                <span>間隔</span>
                <span>連絡方法</span>
                <span className="sr-only">操作</span>
              </div>
            )}
            <AnimatePresence initial={false}>
              {(tab === "予約済み" ? [...shown].sort((a, b) => (a.booked?.date ?? "9").localeCompare(b.booked?.date ?? "9") || (a.booked?.start ?? 0) - (b.booked?.start ?? 0)) : shown).map(x => (
                <RecallRowView
                  key={x.p.id}
                  x={x}
                  table={table}
                  selecting={selecting}
                  checked={picked.has(x.p.id)}
                  onToggle={() => toggle(x.p.id)}
                  act={act}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={tab === "予約済み" ? CalendarCheck : Inbox}
            title={EMPTY[tab].title}
            message={EMPTY[tab].message}
            className="rounded-cell bg-surface"
          />
        )}
        {/* スマホでは浮いているバーの下に最後の行が隠れないよう、同じ高さだけ空ける */}
        {selecting && phone && <div aria-hidden className="h-[76px]" />}
        {!selecting && tab === "未連絡" && shown.length > 0 && (
          <p className="px-4 pt-1.5 text-footnote leading-[1.6] text-label2 [word-break:auto-phrase]">
            「選択」から、まとめて文面を確認して送れます。
          </p>
        )}
      </section>

      {/* まとめて送るバー：スマホはタブバーの上に浮かせ、PCは一覧の下に貼り付ける */}
      <AnimatePresence>
        {selecting && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.16 } }}
            transition={spring}
            className={cn("z-40", phone ? "fixed inset-x-3" : "sticky bottom-6 mt-6 flex justify-center")}
            style={phone ? { bottom: "calc(50px + env(safe-area-inset-bottom, 0px) + 10px)" } : undefined}
          >
            <div className={cn("material-thick flex items-center gap-3 rounded-full py-2 pl-5 pr-2 shadow-float", !phone && "min-w-[420px]")}>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium tnum">
                {selected.length ? `${selected.length}人を選択中` : "送る人を選んでください"}
                {callers > 0 && <span className="font-normal text-label2">（電話 {callers}人）</span>}
              </span>
              <Button variant="filled" size="md" icon={Send} disabled={!sendable} onClick={() => setSheet(true)}>
                {sendable ? `${sendable}人に${tab === "送信済み" ? "再送" : "送る"}` : "送る"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SendSheet open={sheet} rows={selected} resend={tab === "送信済み"} onClose={() => setSheet(false)} onSend={sendAll} />
    </Page>
  );
}
