import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, CalendarX2, Check, ChevronDown, ChevronRight, CircleSlash, Copy, TriangleAlert, Undo2, UserRoundCog } from "lucide-react";
import { useStore } from "@/lib/store";
import { useIsPhone } from "@/lib/media";
import { TODAY, TODAY_KEY, minutesOfDay, useNow } from "@/lib/clock";
import { ago, duration, fromKey, hm, md, mdw, relDay, toothLabel } from "@/lib/format";
import { patientById, serviceById, staff, staffById, unitById, units, visitsOf, type Appointment, type Memo, type Patient } from "@/data";
import { Avatar, Button, EmptyState, Menu, MenuItem, Sheet, StatusPill, Tag, cn, spring, springBouncy, tapSoft, useToast, type StatusKey } from "@/ui";
import { useClinicUI } from "../context";
import { LATE_GRACE, riskOf, statusOf } from "../helpers";
import {
  ageOf, eligibleStaff, markCompleted, openStarts, pickUnit, priceLabel, pushRecentPatient, sourceLabel, staffConflict, unitBusy, unitFits, unitRoleLabel,
  upcomingDays, recordedTimes,
} from "./logic";
import { Cautions } from "../screens/patients/Cautions";
import { AutoText, Chip, DayStrip, Head, Inset, KV, Reveal, RowSep, SlotGrid } from "./parts";
import type { LucideIcon } from "lucide-react";

const live = (a: Appointment) => a.status !== "cancelled" && a.status !== "no_show";
/** 医院側の理由で外した予約（患者のキャンセル回数には数えない） */
const CLINIC_SIDE = /^(お断り|医院都合)/;
const isClinicSide = (a: Appointment) => a.status === "cancelled" && CLINIC_SIDE.test(a.cancelReason ?? "");
const byTime = (x: Appointment, y: Appointment) => (x.date === y.date ? x.start - y.start : x.date < y.date ? -1 : 1);

/** この患者の、これからの予約（この予約を除く） */
function upcomingOf(appts: Appointment[], patientId: string, exclude: string, nowMin: number) {
  return appts
    .filter(x => x.patientId === patientId && x.id !== exclude && live(x) && x.status !== "completed" && (x.date > TODAY_KEY || (x.date === TODAY_KEY && x.end > nowMin)))
    .sort(byTime);
}

/** 予約の詳細。スマホは下からのシート、PC・iPadは右のインスペクタ */
export function AppointmentSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  // 閉じるアニメーションの間も中身を残す
  const [shown, setShown] = useState(id);
  if (id && id !== shown) setShown(id);
  const { appointments } = useStore();
  const a = shown ? appointments.find(x => x.id === shown) : undefined;
  const nowD = useNow(15_000);
  const next = useNextStep(a, nowD);

  useEffect(() => {
    if (id && a) pushRecentPatient(a.patientId);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet
      open={!!id}
      onOpenChange={o => { if (!o) onClose(); }}
      title="予約の詳細"
      variant="inspector"
      footer={a && next ? <Footer next={next} /> : undefined}
    >
      {a ? <Detail key={a.id} a={a} nowD={nowD} onClose={onClose} /> : <EmptyState icon={CalendarX2} title="予約が見つかりません" message="削除されたか、別の予約に置き換わった可能性があります。" />}
    </Sheet>
  );
}

// ─── 次の一手（下に固定する大きなボタン） ───────────────────────────────────
interface NextStep { label: string; run: () => void; disabled?: boolean; note?: string; secondary?: { label: string; run: () => void } }

function useNextStep(a: Appointment | undefined, nowD: Date): NextStep | null {
  const store = useStore();
  const toast = useToast();
  const ui = useClinicUI();
  if (!a) return null;
  const p = store.patients.find(x => x.id === a.patientId) ?? patientById(a.patientId);
  const st = statusOf(a, nowD);
  const isToday = a.date === TODAY_KEY;
  switch (st) {
    case "pending": {
      const via = p.line ? "LINE" : p.email ? "メール" : "SMS";
      return {
        label: "予約を確定",
        note: `Web予約のリクエストです。確定すると、${p.name}さんに${via}でお知らせが届きます。`,
        run: () => { store.setStatus(a.id, "confirmed"); toast("予約を確定しました", { detail: `${p.name}さんに${via}でお知らせしました` }); },
      };
    }
    case "confirmed":
    case "late":
      if (!isToday) return null; // 受付は当日だけ
      return { label: "受付する", run: () => { store.setStatus(a.id, "arrived"); toast("受付しました", { detail: `${p.name}さん・${hm(minutesOfDay(nowD))} 来院` }); } };
    case "arrived":
      return { label: "診療を開始", run: () => { store.setStatus(a.id, "in_progress"); toast("診療を開始しました", { detail: `${unitById(a.unitId).name}・${staffById(a.staffId).short}` }); } };
    case "in_progress":
      return {
        label: "完了にする",
        run: () => { markCompleted(a.id); store.setStatus(a.id, "completed"); toast("完了にしました", { detail: `${p.name}さんを会計へご案内ください` }); },
      };
    case "completed": {
      const book = () => ui.openNew({ patientId: a.patientId, serviceId: a.serviceId });
      const nowMin = minutesOfDay(nowD);
      const done = recordedTimes(a).done;
      const justDone = isToday && done != null && nowMin - done <= 30;
      const nx = upcomingOf(store.appointments, a.patientId, a.id, nowMin)[0];
      const note = justDone ? `${p.name}さんを会計へご案内ください。` : undefined;
      if (nx) {
        return {
          label: `次回 ${nx.date === TODAY_KEY ? "今日" : md(fromKey(nx.date))} ${hm(nx.start)} を確認`,
          run: () => ui.openAppointment(nx.id),
          note: `${note ?? ""}次回の予約はすでに入っています（${serviceById(nx.serviceId).short}）。`,
          secondary: { label: "さらに予約を取る", run: book },
        };
      }
      return { label: "次回の予約を取る", run: book, note };
    }
    case "cancelled":
    case "no_show":
      return { label: "予約を取り直す", run: () => ui.openNew({ patientId: a.patientId, serviceId: a.serviceId }) };
  }
}

/** 取り消した予約を、元の時間のまま戻せるか（まだ先の時刻で、ユニットが空いているときだけ） */
function useRestore(a: Appointment, nowD: Date) {
  const store = useStore();
  const toast = useToast();
  if (a.status !== "cancelled" && a.status !== "no_show") return null;
  const future = a.date > TODAY_KEY || (a.date === TODAY_KEY && a.start > minutesOfDay(nowD) + LATE_GRACE);
  if (!future || unitBusy(store.appointments, a.unitId, a.date, a.start, a.end, a.id)) return null;
  const p = store.patients.find(x => x.id === a.patientId) ?? patientById(a.patientId);
  return () => {
    store.updateAppointment(a.id, { status: "confirmed", cancelReason: undefined, arrivedAt: undefined, startedAt: undefined });
    if (a.status === "cancelled" && !isClinicSide(a)) store.updatePatient(p.id, { cancellations: Math.max(0, p.cancellations - 1) });
    if (a.status === "no_show") store.updatePatient(p.id, { noShows: Math.max(0, p.noShows - 1) });
    toast("元の時間に戻しました", { detail: `${p.name}さん・${mdw(fromKey(a.date))} ${hm(a.start)}` });
  };
}

function Footer({ next }: { next: NextStep }) {
  return (
    <div>
      {next.note && <p className="mb-3 text-[13px] leading-[1.6] text-label2 [word-break:auto-phrase]">{next.note}</p>}
      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={next.label}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={spring}
            className="flex gap-2"
          >
            {next.secondary && <Button size="lg" variant="gray" onClick={next.secondary.run} className="shrink-0 px-5">{next.secondary.label}</Button>}
            <Button size="lg" full onClick={next.run} disabled={next.disabled} className="min-w-0 flex-1">{next.label}</Button>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── 本文 ────────────────────────────────────────────────────────────────────
type Panel = "time" | "assign" | "cancel" | "decline" | null;

function Detail({ a, nowD, onClose }: { a: Appointment; nowD: Date; onClose: () => void }) {
  const phone = useIsPhone();
  const ui = useClinicUI();
  const store = useStore();
  const p = store.patients.find(x => x.id === a.patientId) ?? patientById(a.patientId);
  const sv = serviceById(a.serviceId);
  const st = staffById(a.staffId);
  const un = unitById(a.unitId);
  const status = statusOf(a, nowD);
  const date = fromKey(a.date);
  const pinned = useMemo(() => store.memos.filter(m => m.patientId === p.id && m.pinned), [store.memos, p.id]);
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (k: Exclude<Panel, null>) => setPanel(v => (v === k ? null : k));

  // PCでは最初のフォーカスを本文に置く（「閉じる」にリングが出ないように）
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!phone) root.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 状態が変わったら開いているパネルは閉じ、いちばん上（患者名と状態）を見せる
  const first = useRef(true);
  useEffect(() => {
    setPanel(null);
    if (first.current) { first.current = false; return; }
    let n = root.current?.parentElement ?? null;
    while (n && !/(auto|scroll)/.test(getComputedStyle(n).overflowY)) n = n.parentElement;
    n?.scrollTo({ top: 0, behavior: "smooth" });
  }, [a.status]);

  const notPast = a.date >= TODAY_KEY;
  // 予約の前（仮予約・予約・未来院）は日時・担当の変更とキャンセル。来院済みは担当・ユニットだけ
  const before = notPast && (status === "pending" || status === "confirmed" || status === "late");
  const restore = useRestore(a, nowD);
  const actions: { key: Exclude<Panel, null> | "restore"; label: string; icon: LucideIcon; red?: boolean }[] = [];
  if (before) actions.push({ key: "time", label: "日時を変更", icon: CalendarClock });
  if (before || (notPast && status === "arrived")) actions.push({ key: "assign", label: "担当・ユニット", icon: UserRoundCog });
  if (before) actions.push(status === "pending" ? { key: "decline", label: "お断りする", icon: CircleSlash, red: true } : { key: "cancel", label: "キャンセル", icon: CircleSlash, red: true });
  if (restore) actions.push({ key: "restore", label: "元の時間に戻す", icon: Undo2 });

  return (
    <div ref={root} tabIndex={-1} className="pt-1 outline-none">
      <PatientHeader p={p} onOpen={() => { onClose(); ui.go("patients", p.id); }} />
      <Cautions p={p} pinned={pinned} variant="sheet" className="mt-3" />

      {/* 予約の中身 */}
      <div className="mt-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={cn("font-bold tracking-[-0.02em] tnum", phone ? "text-[34px] leading-[40px]" : "text-[32px] leading-[38px]", (a.status === "cancelled" || a.status === "no_show") && "text-label2")}>
            {hm(a.start)}–{hm(a.end)}
          </div>
          <div className="mt-1 text-[15px] text-label2">
            {mdw(date)}
            <span className="text-label3">・</span>
            {relDay(date, TODAY)}
          </div>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={status} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={springBouncy} className="mt-2.5">
            <StatusPill status={status} />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="text-[17px] font-semibold leading-[22px] palt">{sv.name}</span>
        <Tag tone={sv.insurance ? "neutral" : "sand"}>{priceLabel(sv)}</Tag>
        {a.firstVisit && <Tag tone="accent">初診</Tag>}
        <span className="text-[15px] text-label2 tnum">{duration(a.end - a.start)}</span>
      </div>

      <Inset className="mt-4">
        <KV k="担当">
          <Avatar name={st.name} tone={st.tone} size={22} />
          <span className="truncate">{st.name}</span>
          <span className="shrink-0 text-label2">{st.role}</span>
        </KV>
        <KV k="ユニット">{un.name}</KV>
        <KV k="予約経路">{sourceLabel(a)}</KV>
        {a.note && (
          <KV k="予約メモ" align="start">
            <span className="text-right [word-break:auto-phrase]">{a.note}</span>
          </KV>
        )}
      </Inset>

      {/* 経過 */}
      <Head className="mt-7">経過</Head>
      {a.status === "cancelled" || a.status === "no_show" ? (
        <CancelledNote a={a} p={p} />
      ) : (
        <Inset className="px-4 pb-3 pt-3.5">
          <Timeline a={a} status={status} nowMin={minutesOfDay(nowD)} />
        </Inset>
      )}
      {status === "late" && <LateNote a={a} p={p} nowMin={minutesOfDay(nowD)} />}

      {/* 変更・キャンセル */}
      {actions.length > 0 && (
        <div className="mt-4">
          <div className="flex gap-2">
            {actions.map(x => (
              <ActionTile
                key={x.key}
                icon={x.icon}
                label={x.label}
                red={x.red}
                wide={actions.length === 1}
                active={panel === x.key}
                onClick={() => (x.key === "restore" ? restore?.() : toggle(x.key))}
              />
            ))}
          </div>
          <Reveal show={panel === "time"}>
            <ReschedulePanel a={a} onDone={() => setPanel(null)} />
          </Reveal>
          <Reveal show={panel === "assign"}>
            <AssignPanel a={a} />
          </Reveal>
          <Reveal show={panel === "cancel"}>
            <CancelPanel a={a} p={p} onDone={() => setPanel(null)} />
          </Reveal>
          <Reveal show={panel === "decline"}>
            <DeclinePanel a={a} p={p} onDone={() => setPanel(null)} />
          </Reveal>
        </div>
      )}

      <Memos a={a} p={p} />
      <History a={a} p={p} nowMin={minutesOfDay(nowD)} onAll={() => { onClose(); ui.go("patients", p.id); }} />
    </div>
  );
}

// ─── 患者 ────────────────────────────────────────────────────────────────────
function PatientHeader({ p, onOpen }: { p: Patient; onOpen: () => void }) {
  const phone = useIsPhone();
  const age = ageOf(p);
  const history = [p.cancellations > 0 && `キャンセル${p.cancellations}回`, p.noShows > 0 && `無断${p.noShows}回`].filter(Boolean).join("・");
  return (
    <motion.button
      whileTap={tapSoft}
      transition={{ type: "spring", stiffness: 600, damping: 34 }}
      onClick={onOpen}
      aria-label={`${p.name}さんの患者情報を開く`}
      className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-3.5 rounded-cell px-2 py-2 text-left transition-colors hover:bg-fill/[0.06] active:bg-fill/12"
    >
      <Avatar name={p.name} size={phone ? 56 : 52} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[20px] font-semibold leading-[25px] palt">{p.name}</span>
          {riskOf(p) >= 2 && <Tag className="shrink-0 tnum">{history}</Tag>}
        </div>
        <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2">{p.kana}</div>
        <div className="mt-px truncate text-[13px] leading-[18px] text-label2 tnum">
          {age === null ? "年齢未登録" : `${age}歳`}・{p.sex}・診察券 {p.number}
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-label4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
    </motion.button>
  );
}

// ─── 経過のタイムライン ─────────────────────────────────────────────────────
/** 済んだ段階の数（予約・来院・診療開始・完了） */
const DONE: Partial<Record<StatusKey, number>> = { pending: 0, confirmed: 1, late: 1, arrived: 2, in_progress: 3, completed: 4 };

function Timeline({ a, status, nowMin }: { a: Appointment; status: StatusKey; nowMin: number }) {
  const doneCount = DONE[status] ?? 1;
  const isToday = a.date === TODAY_KEY;
  const rec = recordedTimes(a);
  const done = rec.done;
  const steps: { label: string; detail: string; tone?: "red" | "accent" }[] = [
    { label: status === "pending" ? "仮予約" : "予約", detail: sourceLabel(a), tone: status === "pending" ? "accent" : undefined },
    {
      label: status === "late" ? "未来院" : "来院",
      detail: rec.arrived != null ? hm(rec.arrived)
        : status === "late" ? `${duration(Math.max(0, nowMin - a.start))}経過`
        : isToday && status === "confirmed" && a.start > nowMin && a.start - nowMin <= 60 ? `あと${a.start - nowMin}分` : "",
      tone: status === "late" ? "red" : undefined,
    },
    { label: "診療開始", detail: rec.started != null ? hm(rec.started) : status === "arrived" && a.arrivedAt != null ? `${Math.max(0, nowMin - a.arrivedAt)}分待ち` : "" },
    { label: "完了", detail: done != null ? hm(done) : status === "in_progress" && a.startedAt != null ? `${duration(Math.max(0, nowMin - a.startedAt))}経過` : "" },
  ];
  return (
    <ol className="grid grid-cols-4" aria-label="経過">
      {steps.map((s, i) => {
        const isDone = i < doneCount;
        const isNext = i === doneCount;
        const last = i === steps.length - 1;
        const check = last && status === "completed";
        return (
          <li key={i} className="relative min-w-0 pr-2">
            <div className="relative flex h-[18px] items-center">
              {check ? (
                <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy} className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-accent text-surface">
                  <Check className="h-3 w-3" strokeWidth={3.2} />
                </motion.span>
              ) : (
                <motion.span
                  layout
                  transition={spring}
                  className={cn(
                    "block rounded-full",
                    isDone ? "h-2.5 w-2.5 bg-accent"
                      : isNext ? cn("h-2.5 w-2.5 border-2 bg-transparent", s.tone === "red" ? "border-red" : "border-accent")
                      : "h-2 w-2 bg-label4",
                  )}
                />
              )}
              {!last && (
                <span aria-hidden className={cn("absolute left-4 right-1 top-1/2 h-[2px] -translate-y-1/2 rounded-full transition-colors duration-300", i + 1 < doneCount ? "bg-accent" : "bg-fill/16")} />
              )}
            </div>
            <div className={cn("mt-2 truncate text-[13px] font-semibold leading-[18px]", s.tone === "red" ? "text-red" : s.tone === "accent" ? "text-accent" : i <= doneCount ? "text-label" : "text-label3")}>{s.label}</div>
            <div className={cn("truncate text-[12px] leading-4 tnum", s.tone === "red" ? "text-red" : "text-label2")}>{s.detail || " "}</div>
          </li>
        );
      })}
    </ol>
  );
}

function CancelledNote({ a, p }: { a: Appointment; p: Patient }) {
  const noShow = a.status === "no_show";
  const declined = /^お断り/.test(a.cancelReason ?? "");
  return (
    <div className="flex gap-3 rounded-cell bg-red/8 px-4 py-3">
      <CircleSlash className="mt-[3px] h-[17px] w-[17px] shrink-0 text-red" strokeWidth={2.2} />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-[22px] text-red md:text-[14px] md:leading-5">{noShow ? "無断キャンセル" : declined ? "医院からお断りした予約" : "キャンセル済み"}</p>
        <p className="mt-0.5 text-[13px] leading-[1.6] text-label2 [word-break:auto-phrase]">
          {noShow
            ? `連絡なく来院されませんでした。${p.name}さんの無断キャンセルは${Math.max(1, p.noShows)}回目です。`
            : `理由：${(a.cancelReason ?? "入力なし").replace(/^お断り：/, "")}${isClinicSide(a) ? "（患者のキャンセル回数には数えません）" : ""}`}
        </p>
      </div>
    </div>
  );
}

/** 未来院：電話番号（コピー）と、無断キャンセルにする操作 */
function LateNote({ a, p, nowMin }: { a: Appointment; p: Patient; nowMin: number }) {
  const store = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(p.phone);
      toast("電話番号をコピーしました", { detail: p.phone, icon: Copy });
    } catch {
      toast("コピーできませんでした", { detail: "番号を長押しして選択してください", icon: Copy });
    }
  };
  const mark = () => {
    store.setStatus(a.id, "no_show");
    store.updatePatient(p.id, { noShows: p.noShows + 1 });
    toast("無断キャンセルにしました", { detail: `${p.name}さん・${hm(a.start)}の予約` });
  };
  return (
    <div className="mt-2 rounded-cell bg-red/8 px-4 py-3">
      <div className="flex gap-3">
        <TriangleAlert className="mt-[3px] h-[17px] w-[17px] shrink-0 text-red" strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-[22px] text-red md:text-[14px] md:leading-5">まだ来院されていません</p>
          <p className="mt-0.5 text-[13px] leading-[1.6] text-label2">{hm(a.start)}のご予約です。お電話で確認してください。</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="select-all text-[17px] font-semibold tnum md:text-[16px]">{p.phone}</span>
            <Button size="sm" variant="gray" icon={Copy} onClick={copy} className="bg-surface/70">コピー</Button>
          </div>
          {!confirm && (
            <Button size="sm" variant="destructiveTinted" className="mt-3 bg-red/12" onClick={() => setConfirm(true)}>無断キャンセルにする</Button>
          )}
          <Reveal show={confirm}>
            <p className="mt-3 text-[13px] leading-[1.6] text-label [word-break:auto-phrase]">
              無断キャンセルとして記録します。{p.name}さんの無断キャンセルは{p.noShows + 1}回目になります。
            </p>
            <div className="mt-2.5 flex gap-2">
              <Button size="md" variant="gray" onClick={() => setConfirm(false)} className="bg-surface/70">やめる</Button>
              <Button size="md" variant="destructive" className="flex-1" onClick={mark}>無断キャンセルにする</Button>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

// ─── 変更・キャンセル ─────────────────────────────────────────────────────────
function ActionTile({ icon: Icon, label, red, active, wide, onClick }: { icon: LucideIcon; label: string; red?: boolean; active?: boolean; wide?: boolean; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: wide ? 0.985 : 0.96 }}
      transition={{ type: "spring", stiffness: 700, damping: 32 }}
      onClick={onClick}
      aria-expanded={active}
      className={cn(
        "flex min-w-0 flex-1 items-center rounded-cell transition-colors duration-150",
        // 操作が1つだけのときは、大きなタイルではなく横長の行にする
        wide ? "h-11 justify-center gap-2 px-4" : "h-[60px] flex-col justify-center gap-1 px-1",
        active ? (red ? "bg-red/12" : "bg-sand/30") : "bg-fill/8 hover:bg-fill/12",
        red ? "text-red" : "text-accent",
      )}
    >
      <Icon className={wide ? "h-[18px] w-[18px]" : "h-[19px] w-[19px]"} strokeWidth={2} />
      <span className={cn("max-w-full truncate font-semibold leading-none", wide ? "text-[15px] md:text-[14px]" : "text-[12px]")}>{label}</span>
    </motion.button>
  );
}

function ReschedulePanel({ a, onDone }: { a: Appointment; onDone: () => void }) {
  const store = useStore();
  const toast = useToast();
  const phone = useIsPhone();
  const p = store.patients.find(x => x.id === a.patientId) ?? patientById(a.patientId);
  const sv = serviceById(a.serviceId);
  const minutes = a.end - a.start;
  const days = useMemo(() => upcomingDays(14), []);
  const others = useMemo(() => store.appointments.filter(x => x.id !== a.id), [store.appointments, a.id]);
  const counts = useMemo(() => Object.fromEntries(days.filter(d => d.open).map(d => [d.key, openStarts(d.date, minutes, others, sv.by).size])), [days, minutes, others, sv.by]);
  const [day, setDay] = useState(() => days.find(d => d.key === a.date && d.open)?.key ?? days.find(d => d.open && counts[d.key] > 0)?.key ?? days[0].key);
  const [start, setStart] = useState<number | undefined>();
  const dayOpt = days.find(d => d.key === day) ?? days[0];
  const avail = useMemo(() => openStarts(dayOpt.date, minutes, others, sv.by), [dayOpt, minutes, others, sv.by]);
  const same = day === a.date && start === a.start;
  const unitId = start !== undefined ? pickUnit(others, sv, day, start, start + minutes, a.unitId) : undefined;
  const clash = start !== undefined ? staffConflict(others, a.staffId, day, start, start + minutes) : undefined;

  const apply = () => {
    if (start === undefined || !unitId) return;
    store.updateAppointment(a.id, { date: day, start, end: start + minutes, unitId });
    toast("日時を変更しました", { detail: `${mdw(fromKey(day))} ${hm(start)}–${hm(start + minutes)}・${unitById(unitId).name}` });
    onDone();
  };

  return (
    <div className="pt-4">
      <DayStrip days={days} value={day} counts={counts} onChange={k => { setDay(k); setStart(undefined); }} />
      <div className="mt-3">
        <SlotGrid
          day={dayOpt.date}
          minutes={minutes}
          available={avail}
          value={start}
          current={day === a.date ? a.start : undefined}
          onChange={setStart}
          cols={phone ? "grid-cols-4" : "grid-cols-5"}
        />
      </div>
      <div className="mt-4">
        <Button full size="md" disabled={start === undefined || same} onClick={apply} className="h-11">
          {start === undefined ? "時刻を選んでください" : same ? "現在と同じ日時です" : `${mdw(fromKey(day))} ${hm(start)} に変更`}
        </Button>
        {start !== undefined && !same && (unitId !== a.unitId || clash) && (
          <p className="mt-2 text-center text-[12px] leading-[1.6] text-label2 [word-break:auto-phrase]">
            {unitId !== a.unitId && unitId && `${unitById(a.unitId).name}が埋まっているため、${unitById(unitId).name}に移ります。`}
            {clash && `${staffById(a.staffId).short}はこの時間に別の予約があります（並行診療）。`}
          </p>
        )}
      </div>
    </div>
  );
}

function AssignPanel({ a }: { a: Appointment }) {
  const store = useStore();
  const toast = useToast();
  const sv = serviceById(a.serviceId);
  const people = eligibleStaff(sv);
  const others = store.appointments.filter(x => x.id !== a.id);
  return (
    <div className="pt-4">
      <div className="px-1 text-[13px] font-semibold">担当</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {people.map(s => {
          const busy = staffConflict(others, s.id, a.date, a.start, a.end);
          return (
            <Chip
              key={s.id}
              selected={a.staffId === s.id}
              onClick={() => {
                if (a.staffId === s.id) return;
                store.updateAppointment(a.id, { staffId: s.id });
                toast("担当を変更しました", { detail: `${s.name}（${s.role}）` });
              }}
              className="pl-1.5"
            >
              <Avatar name={s.name} tone={s.tone} size={24} />
              {s.name}
              {busy && a.staffId !== s.id && <span className="text-[11px] font-normal opacity-60">予約あり</span>}
            </Chip>
          );
        })}
      </div>
      <div className="mt-4 px-1 text-[13px] font-semibold">ユニット</div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {units.map(u => {
          const fits = unitFits(sv, u.id);
          const busy = unitBusy(others, u.id, a.date, a.start, a.end);
          const on = a.unitId === u.id;
          return (
            <motion.button
              key={u.id}
              type="button"
              disabled={(busy || !fits) && !on}
              whileTap={busy || !fits ? undefined : { scale: 0.96 }}
              onClick={() => {
                if (on) return;
                store.updateAppointment(a.id, { unitId: u.id });
                toast("ユニットを変更しました", { detail: `${u.name}・${hm(a.start)}–${hm(a.end)}` });
              }}
              className={cn(
                "flex h-[52px] flex-col items-center justify-center rounded-[10px] transition-colors md:h-12",
                on ? "bg-ink text-onink" : busy || !fits ? "text-label3" : "bg-fill/8 text-label hover:bg-fill/14",
              )}
            >
              <span className={cn("text-[14px] leading-tight", on ? "font-semibold" : "font-medium")}>{u.name}</span>
              <span className={cn("mt-0.5 text-[11px] leading-tight", on ? "text-onink/70" : "text-label3")}>{on ? "現在" : !fits ? unitRoleLabel(u.id) : busy ? "使用中" : "空き"}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const REASONS = [
  { label: "体調不良", value: "体調不良のため" },
  { label: "仕事の都合", value: "仕事の都合" },
  { label: "日程の変更", value: "日程の変更希望" },
  { label: "医院都合", value: "医院都合" },
  { label: "その他", value: "その他" },
];

function CancelPanel({ a, p, onDone }: { a: Appointment; p: Patient; onDone: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const confirm = () => {
    if (!reason) return;
    const cancelReason = reason === "その他" ? other.trim() || "その他" : reason;
    store.updateAppointment(a.id, { status: "cancelled", cancelReason });
    // 医院の都合で外したものは、患者のキャンセル回数に数えない
    if (reason !== "医院都合") store.updatePatient(p.id, { cancellations: p.cancellations + 1 });
    toast("予約をキャンセルしました", { detail: `${p.name}さん・${mdw(fromKey(a.date))} ${hm(a.start)}` });
    onDone();
  };
  return (
    <div className="mt-3 rounded-cell bg-red/8 px-4 pb-4 pt-3.5">
      <p className="text-[15px] font-semibold leading-[22px] md:text-[14px] md:leading-5">この予約をキャンセルします</p>
      <p className="mt-0.5 text-[13px] leading-[1.6] text-label2 [word-break:auto-phrase]">
        {reason === "医院都合" ? "医院の都合のため、患者のキャンセル回数には数えません。台帳から予約が外れ、枠が空きます。" : "理由を選んでください。台帳から予約が外れ、枠が空きます。"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {REASONS.map(r => (
          <Chip key={r.value} selected={reason === r.value} onClick={() => setReason(r.value)} className={cn(reason !== r.value && "bg-surface/80 hover:bg-surface")}>
            {r.label}
          </Chip>
        ))}
      </div>
      <Reveal show={reason === "その他"}>
        <input
          value={other}
          onChange={e => setOther(e.target.value)}
          placeholder="理由を入力（任意）"
          className="mt-3 h-11 w-full rounded-[10px] bg-surface/80 px-3 text-[16px] outline-none placeholder:text-label3 md:h-9 md:text-[14px]"
        />
      </Reveal>
      <div className="mt-4 flex gap-2">
        <Button variant="gray" onClick={onDone} className="bg-surface/80">やめる</Button>
        <Button variant="destructive" className="flex-1" disabled={!reason} onClick={confirm}>予約をキャンセル</Button>
      </div>
    </div>
  );
}

const DECLINE = ["枠が埋まった", "メニュー対象外", "その他"];

/** 仮予約（Web予約のリクエスト）を医院からお断りする。患者のキャンセル回数には数えない */
function DeclinePanel({ a, p, onDone }: { a: Appointment; p: Patient; onDone: () => void }) {
  const store = useStore();
  const toast = useToast();
  const [reason, setReason] = useState<string | null>(null);
  const via = p.line ? "LINE" : "SMS";
  const confirm = () => {
    if (!reason) return;
    store.updateAppointment(a.id, { status: "cancelled", cancelReason: `お断り：${reason}` });
    toast("仮予約をお断りしました", { detail: `${p.name}さんに${via}でお知らせしました` });
    onDone();
  };
  return (
    <div className="mt-3 rounded-cell bg-red/8 px-4 pb-4 pt-3.5">
      <p className="text-[15px] font-semibold leading-[22px] md:text-[14px] md:leading-5">このWeb予約をお断りします</p>
      <p className="mt-0.5 text-[13px] leading-[1.6] text-label2 [word-break:auto-phrase]">{p.name}さんに{via}でお知らせが届きます。患者のキャンセル回数には数えません。</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DECLINE.map(r => (
          <Chip key={r} selected={reason === r} onClick={() => setReason(r)} className={cn(reason !== r && "bg-surface/80 hover:bg-surface")}>
            {r}
          </Chip>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <Button variant="gray" onClick={onDone} className="bg-surface/80">やめる</Button>
        <Button variant="destructive" className="flex-1" disabled={!reason} onClick={confirm}>お断りする</Button>
      </div>
    </div>
  );
}

// ─── 診療メモ ────────────────────────────────────────────────────────────────
function Memos({ a, p }: { a: Appointment; p: Patient }) {
  const store = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  // 書く人：ログイン中のスタッフ。受付なら、この予約の担当を初期値にする（診療中に衛生士が書くことが多い）
  const me = staffById(store.currentStaffId);
  const [writer, setWriter] = useState(me.role === "受付" ? a.staffId : me.id);
  const who = staffById(writer);
  const list = store.memos
    .filter(m => m.apptId === a.id)
    .sort((x, y) => (x.date === y.date ? y.at - x.at : x.date < y.date ? 1 : -1));
  const add = () => {
    const body = draft.trim();
    if (!body) return;
    store.addMemo({ patientId: p.id, apptId: a.id, staffId: writer, body });
    setDraft("");
    toast("メモを追加しました", { detail: `${p.name}さん・${sv(a)}` });
  };
  return (
    <section className="mt-7">
      <Head aside={list.length > 0 ? <span className="text-[12px] text-label3 tnum">{list.length}件</span> : undefined}>診療メモ</Head>
      <Inset>
        <AnimatePresence initial={false}>
          {list.map(m => (
            <motion.div key={m.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={spring} className="overflow-hidden">
              <MemoItem m={m} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div className={cn("px-4 pb-2 pt-2.5", list.length > 0 && "hairline-t")}>
          <div className="flex items-center gap-1.5 text-[12px] text-label2">
            記入
            <Menu
              align="start"
              trigger={
                <button type="button" className="-my-1 flex h-7 items-center gap-1 rounded-full py-0.5 pl-0.5 pr-1.5 font-medium text-label transition-colors hover:bg-fill/10 data-[state=open]:bg-fill/12">
                  <Avatar name={who.name} tone={who.tone} size={18} />
                  {who.name}
                  <ChevronDown className="h-3 w-3 text-label3" strokeWidth={2.6} />
                </button>
              }
            >
              {staff.map(x => (
                <MenuItem key={x.id} icon={x.id === writer ? Check : undefined} onSelect={() => setWriter(x.id)}>
                  {x.name}　<span className="text-label2">{x.role}</span>
                </MenuItem>
              ))}
            </Menu>
          </div>
          <div className="flex items-end gap-2">
            <AutoText value={draft} onChange={setDraft} onSubmit={add} minRows={1} placeholder="この予約のメモを追加" className="py-[7px]" />
            <Button size="sm" variant={draft.trim() ? "filled" : "gray"} disabled={!draft.trim()} onClick={add} className="mb-[3px] shrink-0">
              追加
            </Button>
          </div>
        </div>
      </Inset>
    </section>
  );
}
const sv = (a: Appointment) => serviceById(a.serviceId).short;

function MemoItem({ m }: { m: Memo }) {
  const s = staffById(m.staffId);
  return (
    <div className="group/row relative px-4 py-3">
      <p className="text-[15px] leading-[1.65] md:text-[14px] [word-break:auto-phrase]">{m.body}</p>
      {(m.teeth?.length || m.next) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {m.teeth?.map(t => <Tag key={t}>{toothLabel(t)}</Tag>)}
          {m.next && <span className="text-[13px] text-label2">次回：{m.next}</span>}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1.5 text-[12px] text-label2 tnum">
        <Avatar name={s.name} tone={s.tone} size={18} />
        <span>{s.name}</span>
        <span className="text-label4">·</span>
        <span>{m.date === TODAY_KEY ? hm(m.at) : `${md(fromKey(m.date))} ${hm(m.at)}`}</span>
      </div>
      <RowSep />
    </div>
  );
}

// ─── 今後の予約・最近の来院 ─────────────────────────────────────────────────
function History({ a, p, nowMin, onAll }: { a: Appointment; p: Patient; nowMin: number; onAll: () => void }) {
  const store = useStore();
  const ui = useClinicUI();
  const upcoming = upcomingOf(store.appointments, p.id, a.id, nowMin).slice(0, 2);
  const past = useMemo(() => {
    const fromStore = store.appointments
      .filter(x => x.patientId === p.id && x.id !== a.id && x.status === "completed")
      .map(x => ({
        id: x.id as string | undefined,
        date: fromKey(x.date),
        serviceId: x.serviceId,
        staffId: x.staffId,
        note: store.memos.find(m => m.apptId === x.id)?.body ?? x.note,
      }));
    const older = visitsOf(p).map(v => ({ id: undefined as string | undefined, date: v.date, serviceId: v.serviceId, staffId: v.staffId, note: v.note as string | undefined }));
    return [...fromStore, ...older].sort((x, y) => y.date.getTime() - x.date.getTime()).slice(0, 3);
  }, [store.appointments, store.memos, p, a.id]);

  return (
    <>
      {upcoming.length > 0 && (
        <section className="mt-7">
          <Head>今後の予約</Head>
          <Inset>
            {upcoming.map(x => (
              <button key={x.id} onClick={() => ui.openAppointment(x.id)} className="group/row relative flex min-h-[44px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-fill/[0.06] active:bg-fill/12">
                <span className="shrink-0 text-[15px] font-medium tnum md:text-[14px]">{mdw(fromKey(x.date))} {hm(x.start)}</span>
                <span className="min-w-0 flex-1 truncate text-right text-[15px] text-label2 md:text-[14px]">{serviceById(x.serviceId).name}</span>
                {x.status === "pending" && <StatusPill status="pending" compact />}
                <ChevronRight className="h-4 w-4 shrink-0 text-label4" strokeWidth={2.4} />
                <RowSep />
              </button>
            ))}
          </Inset>
        </section>
      )}
      <section className="mt-7">
        <Head aside={<button onClick={onAll} className="text-[13px] font-medium text-accent transition-opacity active:opacity-50">すべて見る</button>}>最近の来院</Head>
        {past.length === 0 ? (
          <Inset className="px-4 py-3.5 text-[14px] text-label2">これまでの来院記録はありません</Inset>
        ) : (
          <Inset>
            {past.map((v, i) => {
              const s = staffById(v.staffId);
              const Row = v.id ? "button" : "div";
              return (
                <Row
                  key={v.id ?? `v${i}`}
                  onClick={v.id ? () => ui.openAppointment(v.id!) : undefined}
                  className={cn("group/row relative flex w-full items-center gap-2 px-4 py-2.5 text-left", v.id && "transition-colors hover:bg-fill/[0.06] active:bg-fill/12")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[15px] leading-5 md:text-[14px]">{serviceById(v.serviceId).name}</span>
                      <span className="shrink-0 text-[13px] text-label2 tnum">{md(v.date)}</span>
                    </div>
                    <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[13px] leading-[18px] text-label2">
                      <span className="truncate">{v.note ?? "メモなし"}</span>
                      <span className="shrink-0 tnum">{s.short}・{ago(v.date, TODAY)}</span>
                    </div>
                  </div>
                  {v.id ? <ChevronRight className="h-4 w-4 shrink-0 text-label4" strokeWidth={2.4} /> : <span className="w-4 shrink-0" />}
                  <RowSep />
                </Row>
              );
            })}
          </Inset>
        )}
      </section>
    </>
  );
}
