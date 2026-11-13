import { useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, Check, Copy, Ellipsis, IdCard, Pencil, Send, SquarePen } from "lucide-react";
import { isSameDay } from "date-fns";
import { useStore } from "@/lib/store";
import { TODAY, TODAY_KEY, useNow } from "@/lib/clock";
import { fromKey, hm } from "@/lib/format";
import { serviceById, visitsOf, type Appointment, type Patient } from "@/data";
import { Button, IconButton, ListSection, Menu, MenuItem, MenuSeparator, Page, cn, springBouncy, useToast } from "@/ui";
import { useClinicUI } from "@/apps/clinic/context";
import { ageOf } from "@/apps/clinic/sheets/logic";
import { useCopy, useWidth } from "./hooks";
import { cancelSummary, isUpcoming, metaOf, ymd, type PatientMeta, type ToothKey } from "./util";
import { Cautions } from "./Cautions";
import { ChartCard } from "./DentalChart";
import { MemoSection, type ComposeRequest } from "./MemoSection";
import { ContactSection, HistorySection, StatsSection, UpcomingSection, type HistItem } from "./Sections";
import { EditPatientSheet } from "./PatientSheets";

export function PatientDetail({ p, back }: { p: Patient; back?: { label: string; onClick: () => void } }) {
  const ui = useClinicUI();
  const { appointments, memos: allMemos } = useStore();
  const now = useNow(20_000);
  const copy = useCopy();
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const phone = ui.phone;
  const content = width - (phone ? 32 : 64);
  const twoCol = !phone && content >= 736;
  const barActions = !phone && width >= 600;
  const factCols = phone || content < 520 ? 2 : content >= 700 ? 6 : 3;

  const mine = useMemo(() => appointments.filter(a => a.patientId === p.id), [appointments, p.id]);
  const m = useMemo(() => metaOf(p, mine), [p, mine]);
  const upcoming = useMemo(
    () => mine.filter(isUpcoming).sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1)),
    [mine],
  );
  const memos = useMemo(
    () => allMemos.filter(x => x.patientId === p.id).sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || (a.date === b.date ? b.at - a.at : a.date < b.date ? 1 : -1)),
    [allMemos, p.id],
  );
  const pinned = useMemo(() => memos.filter(x => x.pinned), [memos]);
  const visits = useMemo(() => visitsOf(p), [p]);
  const history = useMemo<HistItem[]>(() => {
    const memoByAppt = new Map(memos.filter(x => x.apptId).map(x => [x.apptId!, x]));
    const done = mine
      .filter(a => (a.status === "completed" || a.status === "cancelled" || a.status === "no_show") && a.date <= TODAY_KEY)
      .sort((a, b) => (a.date === b.date ? b.start - a.start : a.date < b.date ? 1 : -1))
      .map(a => ({
        id: a.id,
        date: fromKey(a.date),
        title: serviceById(a.serviceId).name,
        staffId: a.staffId,
        note: a.status === "cancelled" ? a.cancelReason : a.status === "no_show" ? "連絡なく来院されませんでした" : memoByAppt.get(a.id)?.body ?? a.note,
        status: a.status,
        apptId: a.id,
      }));
    return [...done, ...visits.map((v, i) => ({ id: `v${i}`, date: v.date, title: serviceById(v.serviceId).name, staffId: v.staffId, note: v.note }))];
  }, [mine, memos, visits]);

  const [tooth, setTooth] = useState<ToothKey | null>(null);
  const [compose, setCompose] = useState<ComposeRequest | null>(null);
  const [editing, setEditing] = useState(false);
  const memoHead = useRef<HTMLSpanElement>(null);
  const chartHead = useRef<HTMLSpanElement>(null);

  const book = () => ui.openNew({ patientId: p.id });
  const openCompose = (teeth: ToothKey[] = []) => {
    setCompose(c => ({ n: (c?.n ?? 0) + 1, teeth }));
    requestAnimationFrame(() => memoHead.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const focusTooth = (k: ToothKey) => {
    setTooth(k);
    requestAnimationFrame(() => chartHead.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const years = ageOf(p);
  const isNew = m.visits === 0;
  // 12歳未満で歯式の記録がないときは、乳歯・混合歯列なので永久歯の図は出さない
  const young = years !== null && years < 12;
  const showChart = !young || Object.keys(p.teeth).length > 0;
  const firstAppt = isNew ? upcoming.find(a => a.firstVisit) : undefined;

  const more = (
    <Menu trigger={<IconButton icon={Ellipsis} size="sm" label="その他の操作" />}>
      <MenuItem icon={Copy} onSelect={() => copy(p.phone, "電話番号")}>電話番号をコピー</MenuItem>
      <MenuItem icon={IdCard} onSelect={() => copy(p.number, "診察券番号")}>診察券番号をコピー</MenuItem>
      {phone && <MenuItem icon={CalendarPlus} onSelect={book}>予約を取る</MenuItem>}
      <MenuSeparator />
      <MenuItem icon={Pencil} onSelect={() => setEditing(true)}>患者情報を編集</MenuItem>
    </Menu>
  );
  const actions = barActions ? (
    <>
      <Button variant="gray" size="sm" icon={SquarePen} onClick={() => openCompose()}>メモを書く</Button>
      <Button size="sm" icon={CalendarPlus} onClick={book}>予約を取る</Button>
      {more}
    </>
  ) : (
    more
  );

  const upcomingEl = (
    <UpcomingSection p={p} m={m} upcoming={upcoming} now={now} onOpen={ui.openAppointment} onBook={book} onCopyPhone={() => copy(p.phone, "電話番号")} stacked={content < 520} />
  );
  const treated = Object.values(p.teeth).filter(x => x && x !== "観察").length;
  const chartEl = !showChart ? (
    <ListSection header={<span ref={chartHead} className="scroll-mt-[76px]">歯式</span>}>
      <p className="px-4 py-3.5 text-[15px] leading-[1.6] text-label2 md:text-[14px]">{years}歳のため乳歯・混合歯列です。乳歯（A〜E）の記録はカルテで確認してください。</p>
    </ListSection>
  ) : (
    <ListSection
      header={<span ref={chartHead} className="scroll-mt-[76px]">{young ? "歯式（永久歯）" : "歯式"}</span>}
      aside={treated > 0 ? <span className="text-footnote text-label2 tnum">処置歴あり {treated}本</span> : undefined}
    >
      <ChartCard
        p={p}
        memos={memos}
        visits={visits}
        appts={mine}
        selected={tooth}
        onSelect={setTooth}
        onWriteMemo={k => openCompose([k])}
        onOpenAppt={ui.openAppointment}
        young={young}
        firstExam={isNew}
      />
    </ListSection>
  );
  const memoEl = (
    <MemoSection ref={memoHead} p={p} memos={memos} compose={compose} onCompose={() => openCompose()} onCloseCompose={() => setCompose(null)} onTooth={focusTooth} />
  );
  const historyEl = <HistorySection items={history} upcomingFirst={isNew ? upcoming[0] : undefined} onOpen={ui.openAppointment} />;
  const contactEl = <ContactSection p={p} onCopy={copy} />;
  const statsEl = <StatsSection p={p} m={m} />;

  return (
    <div ref={wrapRef} className="h-full">
      {width > 0 && (
        <Page
          title={p.name}
          subtitle={p.kana}
          back={back}
          actions={actions}
        >
          <Cautions p={p} pinned={pinned} variant="page" />
          {firstAppt && <FirstVisitPrep p={p} a={firstAppt} className={cn((p.memo || pinned.length || p.allergies.length || p.conditions.length) && "mt-3")} />}
          <Facts p={p} m={m} cols={factCols} first={!!firstAppt} />
          {!barActions && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Button icon={CalendarPlus} onClick={book}>予約を取る</Button>
              <Button variant="gray" icon={SquarePen} onClick={() => openCompose()}>メモを書く</Button>
            </div>
          )}
          {twoCol ? (
            <>
              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_288px] items-start gap-x-6">
                <div className="min-w-0">{upcomingEl}</div>
                <div className="min-w-0">{contactEl}</div>
              </div>
              {chartEl}
              <div className="grid grid-cols-[minmax(0,1fr)_288px] items-start gap-x-6">
                <div className="min-w-0">
                  {memoEl}
                  {historyEl}
                </div>
                <div className="sticky top-[60px] min-w-0">{statsEl}</div>
              </div>
            </>
          ) : (
            <>
              {upcomingEl}
              {contactEl}
              {chartEl}
              {memoEl}
              {historyEl}
              {statsEl}
            </>
          )}
        </Page>
      )}
      <EditPatientSheet p={p} open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

// ─── 初診の準備（問診票・保険証） ─────────────────────────────────────────
// 問診票の回答状況は予約IDから決める（今日の画面と同じ決め方）。確認したことはこの画面を離れても覚えておく。
const prep = { sent: new Set<string>(), checked: new Set<string>() };
const prepSubs = new Set<() => void>();
let prepVersion = 0;
const bump = () => { prepVersion++; prepSubs.forEach(f => f()); };
const usePrep = () => useSyncExternalStore(cb => { prepSubs.add(cb); return () => { prepSubs.delete(cb); }; }, () => prepVersion);
function formAnswered(apptId: string) {
  let n = 0;
  for (const c of apptId) n += c.charCodeAt(0);
  return n % 2 === 0;
}

function FirstVisitPrep({ p, a, className }: { p: Patient; a: Appointment; className?: string }) {
  usePrep();
  const toast = useToast();
  const answered = formAnswered(a.id);
  const sent = prep.sent.has(a.id);
  const checked = prep.checked.has(a.id) || a.status === "in_progress" || a.status === "completed";
  const when = a.date === TODAY_KEY ? `今日 ${hm(a.start)}` : `${ymd(fromKey(a.date))} ${hm(a.start)}`;
  return (
    <div className={cn("rounded-card bg-surface", className)}>
      <div className="px-4 pb-1 pt-3.5">
        <div className="text-footnote font-semibold text-label2">初診の準備</div>
        <p className="mt-0.5 text-caption text-label2 tnum">{when}の初診・カウンセリングまでに確認します。</p>
      </div>
      <PrepRow
        done={answered}
        label="問診票"
        value={answered ? "Webで回答済み" : sent ? "送信済み・回答待ち" : "未回答"}
        action={!answered && !sent ? (
          <Button size="sm" variant="tinted" icon={Send} onClick={() => { prep.sent.add(a.id); bump(); toast("問診票を送信しました", { icon: Send, detail: `${p.name}さん・${p.line ? "LINE" : "SMS"}` }); }}>
            問診票を送る
          </Button>
        ) : undefined}
      />
      <PrepRow
        done={checked}
        label="保険証・マイナ保険証"
        value={checked ? `確認済み（${p.insurance}）` : "来院時に確認"}
        action={!checked ? (
          <Button size="sm" variant="tinted" icon={IdCard} onClick={() => { prep.checked.add(a.id); bump(); toast("保険証を確認しました", { icon: IdCard, detail: `${p.name}さん・${p.insurance}` }); }}>
            確認した
          </Button>
        ) : undefined}
      />
    </div>
  );
}

function PrepRow({ done, label, value, action }: { done: boolean; label: string; value: string; action?: ReactNode }) {
  return (
    <div className="group relative flex min-h-[52px] items-center gap-3 px-4 py-2">
      <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full", done ? "bg-accent text-surface" : "ring-[1.5px] ring-inset ring-label3")}>
        <AnimatePresence initial={false}>
          {done && (
            <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] leading-5">{label}</div>
        <div className={cn("truncate text-footnote", done ? "text-label2" : "font-medium text-label")}>{value}</div>
      </div>
      {action}
      <span aria-hidden className="pointer-events-none absolute left-[50px] right-0 top-0 h-px origin-top scale-y-50 bg-sep/30" />
    </div>
  );
}

// ─── 基本情報（年齢・生年月日・診察券番号・保険・初診日・来院回数） ─────────
function Facts({ p, m, cols, first }: { p: Patient; m: PatientMeta; cols: number; first: boolean }) {
  const years = ageOf(p);
  const facts: [string, string][] = [
    ["年齢・性別", `${years === null ? "年齢未登録" : `${years}歳`}・${p.sex}`],
    ["生年月日", years === null ? "未登録" : ymd(p.birth)],
    ["診察券番号", p.number],
    ["保険", p.insurance],
    // まだ来院していない初診の人は「予定」
    ["初診日", isSameDay(p.firstVisit, TODAY) ? (first && m.visits === 0 ? "今日（予定）" : "今日") : ymd(p.firstVisit)],
    ["来院回数", m.visits === 0 ? "まだありません" : `${m.visits}回`],
  ];
  const cancels = cancelSummary(m);
  return (
    <div className="mt-3 rounded-card bg-surface px-4 py-3.5">
      <dl
        className={cn(cols === 6 ? "flex justify-between gap-x-5" : "grid gap-x-4 gap-y-3")}
        style={cols === 6 ? undefined : { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {facts.map(([k, v]) => (
          <div key={k} className={cn("min-w-0", cols === 6 && "shrink")}>
            <dt className="truncate text-caption text-label2">{k}</dt>
            <dd className="mt-0.5 truncate text-[15px] font-medium leading-5 tnum">{v}</dd>
          </div>
        ))}
      </dl>
      {cancels && <p className="hairline-t mt-3 pt-2.5 text-footnote text-label2 tnum">{cancels}</p>}
    </div>
  );
}
