import { useMemo, useRef, useState } from "react";
import { CalendarPlus, Copy, Ellipsis, IdCard, Pencil, Pin, SquarePen, TriangleAlert } from "lucide-react";
import { isSameDay } from "date-fns";
import { useStore } from "@/lib/store";
import { TODAY, TODAY_KEY, useNow } from "@/lib/clock";
import { age, fromKey } from "@/lib/format";
import { serviceById, staffById, visitsOf, type Memo, type Patient } from "@/data";
import { Button, IconButton, ListSection, Menu, MenuItem, MenuSeparator, Page, Tag, cn } from "@/ui";
import { alertsOf } from "@/apps/clinic/helpers";
import { useClinicUI } from "@/apps/clinic/context";
import { useCopy, useWidth } from "./hooks";
import { isUpcoming, memoWhen, metaOf, riskOfMeta, ymd, type PatientMeta, type ToothKey } from "./util";
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
  const factCols = !phone && content >= 700 ? 6 : 3;

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

  const child = age(p.birth, TODAY) < 15;
  const isNew = m.visits === 0;

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
    <UpcomingSection p={p} m={m} upcoming={upcoming} now={now} onOpen={ui.openAppointment} onBook={book} onCopyPhone={() => copy(p.phone, "電話番号")} />
  );
  const chartEl = (
    <ListSection
      header={<span ref={chartHead} className="scroll-mt-[76px]">歯式</span>}
      aside={Object.keys(p.teeth).length > 0 ? <span className="text-footnote text-label2 tnum">記録 {Object.keys(p.teeth).length}本</span> : undefined}
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
        child={child}
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
          subtitle={
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{p.kana}</span>
              {isNew && upcoming[0]?.firstVisit && <Tag tone="accent">初診</Tag>}
            </span>
          }
          back={back}
          actions={actions}
        >
          <AttentionCard p={p} m={m} pinned={pinned} />
          <Facts p={p} m={m} cols={factCols} />
          {!barActions && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Button icon={CalendarPlus} onClick={book}>予約を取る</Button>
              <Button variant="gray" icon={SquarePen} onClick={() => openCompose()}>メモを書く</Button>
            </div>
          )}
          {twoCol ? (
            <div className="mt-5 grid grid-cols-[minmax(0,1fr)_288px] items-start gap-x-6">
              <div className="min-w-0">
                {upcomingEl}
                {chartEl}
                {memoEl}
                {historyEl}
              </div>
              <div className="sticky top-[60px] min-w-0">
                {contactEl}
                {statsEl}
              </div>
            </div>
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

// ─── 注意事項（いちばん上・赤） ───────────────────────────────────────────
function AttentionCard({ p, m, pinned }: { p: Patient; m: PatientMeta; pinned: Memo[] }) {
  const items = alertsOf(p).map(a => ({ label: a.label, red: a.tone === "red" }));
  const risk = riskOfMeta(m);
  if (risk >= 2) {
    const parts = [m.cancellations && `キャンセル ${m.cancellations}回`, m.noShows && `無断キャンセル ${m.noShows}回`].filter(Boolean);
    items.push({ label: `キャンセル歴：${parts.join("・")}`, red: risk >= 3 });
  }
  if (!items.length && !pinned.length && !p.memo) return null;
  const red = items.some(i => i.red);
  return (
    <div
      role={items.length ? "alert" : undefined}
      className={cn("rounded-card px-4 py-3.5", red ? "bg-red/8 shadow-[inset_0_0_0_1px_rgb(var(--red)/0.16)]" : "bg-surface")}
    >
      {items.length > 0 && (
        <>
          <div className={cn("flex items-center gap-1.5 text-footnote font-semibold", red ? "text-red" : "text-label2")}>
            <TriangleAlert className="h-4 w-4" strokeWidth={2.3} />
            注意事項
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            {items.map(i => (
              <li key={i.label} className="flex items-center gap-2">
                <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", i.red ? "bg-red" : "bg-label3")} />
                <span className={cn("text-[17px] leading-6 md:text-[16px]", i.red ? "font-semibold text-red" : "font-medium text-label")}>{i.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {pinned.map((x, i) => {
        const s = staffById(x.staffId);
        return (
          <div key={x.id} className={cn("flex gap-2.5", (items.length > 0 || i > 0) && "hairline-t mt-3 pt-3")}>
            <Pin className="mt-[3px] h-3.5 w-3.5 shrink-0 text-label2" strokeWidth={2.3} aria-label="固定メモ" />
            <div className="min-w-0">
              <p className="text-[15px] leading-[1.6] text-label">{x.body}</p>
              <p className="mt-0.5 text-caption text-label2">
                {s.name}（{s.role}）<span className="px-1 text-label4">·</span>
                {memoWhen(x)}
              </p>
            </div>
          </div>
        );
      })}
      {p.memo && (
        <div className={cn("flex gap-2.5 text-[15px] leading-[1.6]", (items.length > 0 || pinned.length > 0) && "hairline-t mt-3 pt-3")}>
          <span className="shrink-0 font-medium text-label2">申し送り</span>
          <span className="min-w-0 text-label">{p.memo}</span>
        </div>
      )}
    </div>
  );
}

// ─── 基本情報（年齢・生年月日・診察券番号・保険・初診日・来院回数） ─────────
function Facts({ p, m, cols }: { p: Patient; m: PatientMeta; cols: number }) {
  const facts: [string, string][] = [
    ["年齢・性別", `${age(p.birth, TODAY)}歳・${p.sex}`],
    ["生年月日", ymd(p.birth)],
    ["診察券番号", p.number],
    ["保険", p.insurance],
    ["初診日", isSameDay(p.firstVisit, TODAY) ? "今日" : ymd(p.firstVisit)],
    ["来院回数", `${m.visits}回`],
  ];
  return (
    <dl className="mt-3 grid gap-x-4 gap-y-3 rounded-card bg-surface px-4 py-3.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {facts.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="truncate text-caption text-label2">{k}</dt>
          <dd className="mt-0.5 truncate text-[15px] font-medium leading-5 tnum">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
