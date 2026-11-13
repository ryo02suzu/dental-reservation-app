import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, TriangleAlert, UserRoundPlus } from "lucide-react";
import { useStore } from "@/lib/store";
import { useIsPhone } from "@/lib/media";
import { TODAY, TODAY_KEY, minutesOfDay, now } from "@/lib/clock";
import { ago, fromKey, hm, matchesPatient, mdw, toKatakana } from "@/lib/format";
import { serviceById, services, staffById, unitById, units, type ApptSource, type InsuranceType, type Patient, type Service } from "@/data";
import { Avatar, Button, FieldRow, SearchField, Segmented, Sheet, Tag, cn, spring, useToast } from "@/ui";
import type { NewPrefill } from "../context";
import { alertsOf } from "../helpers";
import {
  ageOf, eligibleStaff, markDeskBooked, markNoBirth, openStarts, pickStaff, pickUnit, priceLabel, pushRecentPatient, staffConflict, unitBusy,
  upcomingDays, visitLabel, type DayOption,
} from "./logic";
import { AutoText, Chip, DayStrip, Inset, Reveal, RowSep, SlotGrid, Title } from "./parts";

type Source = Extract<ApptSource, "phone" | "walkin" | "line">;
const SOURCES: { value: Source; label: string }[] = [
  { value: "phone", label: "電話" },
  { value: "walkin", label: "来院時" },
  { value: "line", label: "LINE" },
];
const CATEGORIES: Service["category"][] = ["予防", "一般", "歯周", "外科", "補綴", "小児", "審美", "相談"];
const FIRST_VISIT = "sv10";
const CHECKUPS = new Set(["sv01", "sv02", "sv09"]);

interface Form {
  patientId?: string;
  /** この画面で登録した新しい患者さん（初診） */
  registered: boolean;
  serviceId?: string;
  day: string;
  start?: number;
  unitId?: string;
  staffId?: string;
  note: string;
  source: Source;
  /** 表示している日付の数（「その先」で増える） */
  span: number;
}

/** 新規予約。PCは中央の大きなダイアログ、スマホは背の高いシート。1枚のフォームを上から順に埋めていく */
export function NewAppointmentSheet({ open, prefill, onClose }: { open: boolean; prefill?: NewPrefill; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const phone = useIsPhone();
  const [form, setForm] = useState<Form>(() => initForm(prefill, store));
  // 開くたびに、渡された値から作り直す
  const [wasOpen, setWasOpen] = useState(open);
  const [session, setSession] = useState(0);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(initForm(prefill, store));
      setSession(s => s + 1);
    }
  }
  const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));

  const patient = form.patientId ? store.patients.find(p => p.id === form.patientId) : undefined;
  const sv = form.serviceId ? serviceById(form.serviceId) : undefined;
  const minutes = sv?.minutes ?? 30;
  const days = useMemo(() => upcomingDays(form.span), [form.span]);
  const dayOpt = days.find(d => d.key === form.day && d.open) ?? days.find(d => d.open)!;
  const avail = useMemo(() => openStarts(dayOpt.date, minutes, store.appointments), [dayOpt, minutes, store.appointments]);
  const start = form.start !== undefined && avail.has(form.start) ? form.start : undefined;
  const lostStart = form.start !== undefined && start === undefined;
  const end = start !== undefined ? start + minutes : undefined;
  const unitId = sv && start !== undefined ? pickUnit(store.appointments, sv, dayOpt.key, start, start + minutes, form.unitId) : undefined;
  const staffId = sv && start !== undefined && unitId ? pickStaff(store.appointments, sv, unitId, dayOpt.key, start, start + minutes, form.staffId) : undefined;
  const firstVisit = form.registered || form.serviceId === FIRST_VISIT || (!!patient && patient.visits === 0);
  const ready = !!patient && !!sv && start !== undefined && !!unitId && !!staffId;

  const submit = () => {
    if (!ready || !patient || !sv || start === undefined || !unitId || !staffId) return;
    const a = store.addAppointment({
      date: dayOpt.key, start, end: start + sv.minutes, patientId: patient.id, serviceId: sv.id, staffId, unitId,
      status: "confirmed", source: form.source, firstVisit, note: form.note.trim() || undefined,
    });
    if (form.source === "walkin") markDeskBooked(a.id);
    if (CHECKUPS.has(sv.id) && store.recalls.some(r => r.patientId === patient.id && r.status !== "予約済み")) store.setRecall(patient.id, "予約済み");
    pushRecentPatient(patient.id);
    toast("予約を登録しました", { detail: `${patient.name}さん・${mdw(dayOpt.date)} ${hm(start)}` });
    onClose();
  };

  const summary = [
    `${mdw(dayOpt.date)}${start !== undefined && end !== undefined ? ` ${hm(start)}–${hm(end)}` : ""}`,
    sv?.short,
    start !== undefined && unitId ? unitById(unitId).name : undefined,
    start !== undefined && staffId ? staffById(staffId).short : undefined,
  ].filter(Boolean).join("・");
  const missing = [!patient && "患者さん", !sv && "メニュー", start === undefined && "時間"].filter(Boolean) as string[];

  return (
    <Sheet
      open={open}
      onOpenChange={o => { if (!o) onClose(); }}
      title="新規予約"
      cancelLabel="キャンセル"
      size="lg"
      footer={
        <div className={cn(phone ? "space-y-3" : "flex items-center gap-5")}>
          <div className="min-w-0 flex-1">
            <div className={cn("truncate text-[13px] leading-[18px]", patient ? "text-label2" : "text-label3")}>
              {patient ? `${patient.name}さん${firstVisit ? "・初診" : ""}` : "患者さん未選択"}
            </div>
            <div className={cn("mt-0.5 truncate text-[15px] font-medium leading-5 tnum md:text-[16px] md:leading-[22px]", missing.length && "text-label2")}>
              {missing.length ? `${missing.join("・")}を選んでください` : summary}
            </div>
          </div>
          <Button size="lg" disabled={!ready} onClick={submit} className={cn(phone ? "w-full" : "px-8")}>
            予約を登録
          </Button>
        </div>
      }
    >
      <Body
        key={session}
        form={form}
        set={set}
        patient={patient}
        sv={sv}
        days={days}
        dayOpt={dayOpt}
        avail={avail}
        start={start}
        lostStart={lostStart}
        unitId={unitId}
        staffId={staffId}
      />
    </Sheet>
  );
}

function initForm(pf: NewPrefill | undefined, store: ReturnType<typeof useStore>): Form {
  const days = upcomingDays(21);
  const p = pf?.patientId ? store.patients.find(x => x.id === pf.patientId) : undefined;
  const span = pf?.date && pf.date > days[days.length - 1].key ? 63 : 21;
  const all = span === 21 ? days : upcomingDays(span);
  const okDay = pf?.date && all.some(d => d.key === pf.date && d.open) ? pf.date : undefined;
  // 今日はもう空きがなければ次の診療日から
  const firstFree = all.find(d => d.open && openStarts(d.date, 30, store.appointments).size > 0)?.key ?? all.find(d => d.open)!.key;
  // 今日来院している患者さんの「次回の予約」は窓口（来院時）での予約
  const here = !!p && store.appointments.some(a => a.patientId === p.id && a.date === TODAY_KEY && (a.status === "completed" || a.status === "in_progress" || a.status === "arrived"));
  return {
    patientId: p?.id,
    registered: false,
    serviceId: pf?.serviceId ?? (p && p.visits === 0 ? FIRST_VISIT : undefined),
    day: okDay ?? firstFree,
    start: pf?.start,
    unitId: pf?.unitId,
    staffId: pf?.staffId,
    note: "",
    source: here ? "walkin" : "phone",
    span,
  };
}

// ─── 本文 ────────────────────────────────────────────────────────────────────
function Body({ form, set, patient, sv, days, dayOpt, avail, start, lostStart, unitId, staffId }: {
  form: Form;
  set: (p: Partial<Form>) => void;
  patient?: Patient;
  sv?: Service;
  days: DayOption[];
  dayOpt: DayOption;
  avail: Set<number>;
  start?: number;
  lostStart: boolean;
  unitId?: string;
  staffId?: string;
}) {
  const phone = useIsPhone();
  const store = useStore();
  const root = useRef<HTMLDivElement>(null);
  // PC：患者さんが決まっていれば本文に、決まっていなければ検索欄にフォーカス（検索欄は autoFocus）
  useLayoutEffect(() => {
    if (!phone && form.patientId) root.current?.focus({ preventScroll: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const minutes = sv?.minutes ?? 30;
  const counts = useMemo(
    () => Object.fromEntries(days.filter(d => d.open).map(d => [d.key, openStarts(d.date, minutes, store.appointments).size])),
    [days, minutes, store.appointments],
  );
  return (
    <div ref={root} tabIndex={-1} className={cn("pt-1 outline-none", phone ? "min-h-[calc(94dvh-206px)]" : "min-h-[calc(86vh-176px)]")}>
      <PatientSection
        patient={patient}
        registered={form.registered}
        onPick={(id, registered) => {
          const p = store.patients.find(x => x.id === id);
          pushRecentPatient(id);
          set({ patientId: id, registered, serviceId: form.serviceId ?? (registered || p?.visits === 0 ? FIRST_VISIT : undefined) });
        }}
        onClear={() => set({ patientId: undefined, registered: false })}
      />

      <MenuSection patient={patient} value={form.serviceId} onChange={id => set({ serviceId: id })} />

      <section className="mt-8">
        <Title aside={<span className="text-[12px] text-label2 tnum">{sv ? `${sv.minutes}分の空き` : "30分の空き"}</span>}>日時</Title>
        <DayStrip
          days={days}
          value={dayOpt.key}
          counts={counts}
          onChange={k => set({ day: k, start: undefined })}
          onMore={form.span < 84 ? () => set({ span: form.span + 21 }) : undefined}
        />
        <div className="mt-4">
          <SlotGrid day={dayOpt.date} minutes={minutes} available={avail} value={start} onChange={t => set({ start: t })} />
        </div>
        {!sv && <p className="mt-3 px-1 text-[12px] leading-[1.6] text-label2">メニューを選ぶと、その長さで空いている時間を表示します。</p>}
        {lostStart && sv && form.start !== undefined && (
          <p className="mt-3 px-1 text-[13px] leading-[1.6] text-red [word-break:auto-phrase]">
            {hm(form.start)}からは{sv.minutes}分の空きがありません。別の時間を選んでください。
          </p>
        )}
        <Reveal show={start !== undefined && !!unitId && !!staffId && !!sv}>
          {start !== undefined && unitId && staffId && sv && (
            <Assignment
              sv={sv}
              day={dayOpt.key}
              start={start}
              unitId={unitId}
              staffId={staffId}
              onUnit={u => set({ unitId: u })}
              onStaff={s => set({ staffId: s })}
            />
          )}
        </Reveal>
      </section>

      <section className={cn("mt-8", !phone && "grid grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-6")}>
        <div>
          <Title>予約経路</Title>
          <Segmented full value={form.source} onChange={v => set({ source: v })} options={SOURCES} />
          <p className="mt-1.5 px-1 text-[12px] leading-[1.6] text-label3">
            {form.source === "walkin" ? "窓口で次回の予約を取ったとき" : form.source === "phone" ? "お電話で予約を受けたとき" : "LINEのメッセージで受けたとき"}
          </p>
        </div>
        <div className={cn(phone && "mt-6")}>
          <Title aside={<span className="text-[12px] text-label3">任意</span>}>メモ</Title>
          <Inset className="px-4 py-2">
            <AutoText value={form.note} onChange={v => set({ note: v })} minRows={2} placeholder="例：冷たいものがしみる、保護者同伴" />
          </Inset>
        </div>
      </section>
    </div>
  );
}

// ─── 1. 患者 ─────────────────────────────────────────────────────────────────
function PatientSection({ patient, registered, onPick, onClear }: {
  patient?: Patient; registered: boolean; onPick: (id: string, registered: boolean) => void; onClear: () => void;
}) {
  const phone = useIsPhone();
  const store = useStore();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) {
      // 空欄のときは、今日来院した患者さん（窓口で次回の予約を取ることが多い）
      const nowMin = minutesOfDay(now());
      const seen = store.appointments
        .filter(a => a.date === TODAY_KEY && (a.status === "completed" || a.status === "in_progress" || a.status === "arrived") && a.start <= nowMin + 60)
        .sort((x, y) => y.start - x.start)
        .map(a => a.patientId);
      return [...new Set(seen)].slice(0, 4).map(id => store.patients.find(p => p.id === id)!).filter(Boolean);
    }
    const kq = toKatakana(query).replace(/\s/g, "");
    const nq = query.replace(/\s/g, "");
    const rank = (p: Patient) => (p.name.replace(/\s/g, "").startsWith(nq) || p.kana.replace(/\s/g, "").startsWith(kq) ? 0 : 1);
    return store.patients.filter(p => matchesPatient(p, query)).sort((a, b) => rank(a) - rank(b) || a.kana.localeCompare(b.kana, "ja")).slice(0, 6);
  }, [q, store.patients, store.appointments]);

  return (
    <section className="relative">
      <Title>患者</Title>
      <AnimatePresence mode="popLayout" initial={false}>
        {patient ? (
          <motion.div key="chip" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={spring}>
            <PatientChip p={patient} registered={registered} onClear={() => { onClear(); setCreating(false); }} />
          </motion.div>
        ) : creating ? (
          <motion.div key="new" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}>
            <NewPatientForm seed={q} onCancel={() => setCreating(false)} onDone={p => onPick(p.id, true)} onPickExisting={id => onPick(id, false)} />
          </motion.div>
        ) : (
          <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <SearchField value={q} onChange={setQ} placeholder="氏名・ふりがな・番号で検索" autoFocus={!phone} />
            <Inset className="mt-2">
              {!q.trim() && results.length > 0 && <div className="px-4 pb-1 pt-2.5 text-[12px] font-medium text-label2">今日来院した患者さん</div>}
              {results.map(p => (
                <PatientOption key={p.id} p={p} q={q} onClick={() => onPick(p.id, false)} />
              ))}
              {q.trim() && results.length === 0 && (
                <div className="group/row relative px-4 py-3 text-[14px] text-label2">
                  「{q.trim()}」に一致する患者さんはいません
                  <RowSep />
                </div>
              )}
              <button
                onClick={() => setCreating(true)}
                className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left text-accent transition-colors hover:bg-fill/[0.06] active:bg-fill/12 md:min-h-[44px]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand/30">
                  <UserRoundPlus className="h-[17px] w-[17px]" strokeWidth={2.1} />
                </span>
                <span className="text-[16px] font-medium md:text-[15px]">新しい患者さんを登録</span>
              </button>
            </Inset>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function PatientOption({ p, q, onClick }: { p: Patient; q: string; onClick: () => void }) {
  const store = useStore();
  const phone = useIsPhone();
  const age = ageOf(p);
  const alerts = alertsOf(p).filter(x => x.tone === "red");
  const visit = visitLabel(store.appointments, p, minutesOfDay(now()), phone);
  const digits = /\d{2,}/.test(q);
  return (
    <button onClick={onClick} className="group/row relative flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-fill/[0.06] active:bg-fill/12 md:min-h-[54px]">
      <Avatar name={p.name} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[16px] font-medium leading-[21px] md:text-[15px] md:leading-5">{p.name}</span>
          <span className="truncate text-[12px] text-label2">{p.kana}</span>
        </div>
        <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2 tnum">
          {age === null ? "" : `${age}歳`}
          {(!phone || digits) && <>{age === null ? "" : "・"}診察券 {p.number}</>}
          <span className="text-label4">・</span>
          {digits && p.phone.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ? p.phone : visit}
        </div>
      </div>
      {alerts.length > 0 && <TriangleAlert className="h-4 w-4 shrink-0 text-red" strokeWidth={2.2} aria-label="注意事項あり" />}
      <RowSep left={64} />
    </button>
  );
}

function nextOf(appts: ReturnType<typeof useStore>["appointments"], patientId: string) {
  const nowMin = minutesOfDay(now());
  const n = appts
    .filter(a => a.patientId === patientId && (a.status === "confirmed" || a.status === "pending") && (a.date > TODAY_KEY || (a.date === TODAY_KEY && a.start > nowMin)))
    .sort((x, y) => (x.date === y.date ? x.start - y.start : x.date < y.date ? -1 : 1))[0];
  return n ? { d: fromKey(n.date), start: n.start, serviceId: n.serviceId } : undefined;
}

function PatientChip({ p, registered, onClear }: { p: Patient; registered: boolean; onClear: () => void }) {
  const store = useStore();
  const age = ageOf(p);
  const alerts = alertsOf(p);
  const next = nextOf(store.appointments, p.id);
  return (
    <Inset className="flex items-start gap-3 px-4 py-3">
      <Avatar name={p.name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[17px] font-semibold leading-[22px] palt">{p.name}</span>
          {(registered || p.visits === 0) && <Tag tone="accent">初診</Tag>}
        </div>
        <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2 tnum">
          {p.kana}・{age === null ? "年齢未登録" : `${age}歳`}・{p.sex}・診察券 {p.number}
        </div>
        {alerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {alerts.map(x => <Tag key={x.label} tone={x.tone === "red" ? "red" : "neutral"}>{x.label}</Tag>)}
          </div>
        )}
        {next && (
          <p className="mt-2 text-[13px] leading-[18px] text-label2 tnum">
            次回の予約あり：{mdw(next.d)} {hm(next.start)} {serviceById(next.serviceId).short}
          </p>
        )}
      </div>
      <button onClick={onClear} className="-mr-1 shrink-0 rounded-full px-2 py-1 text-[15px] text-accent transition-opacity active:opacity-50 md:text-[14px]">
        変更
      </button>
    </Inset>
  );
}

const KANA = /^[ぁ-ゖァ-ヺー・\s　]+$/;

function NewPatientForm({ seed, onCancel, onDone, onPickExisting }: {
  seed: string; onCancel: () => void; onDone: (p: Patient) => void; onPickExisting: (id: string) => void;
}) {
  const store = useStore();
  const toast = useToast();
  const s = seed.trim();
  const [name, setName] = useState(s && !KANA.test(s) && !/\d/.test(s) ? s : "");
  const [kana, setKana] = useState(s && KANA.test(s) ? s : "");
  const [tel, setTel] = useState(/^[\d\-\s]+$/.test(s) ? s : "");
  const [birth, setBirth] = useState("");
  const [sex, setSex] = useState<Patient["sex"] | null>(null);
  const [tried, setTried] = useState(false);

  const digits = tel.replace(/\D/g, "");
  const error =
    !name.trim() ? "氏名を入力してください"
    : !kana.trim() ? "ふりがなを入力してください"
    : !KANA.test(kana.trim()) ? "ふりがなは、ひらがなかカタカナで入力してください"
    : !digits ? "電話番号を入力してください"
    : /[^\d\-\s()]/.test(tel) || digits.length < 10 || digits.length > 11 ? "電話番号は数字10〜11桁で入力してください"
    : !sex ? "性別を選んでください"
    : null;
  const dup = digits.length >= 10 ? store.patients.find(p => p.phone.replace(/\D/g, "") === digits) : undefined;

  const submit = () => {
    setTried(true);
    if (error) return;
    const b = birth ? fromKey(birth) : TODAY;
    const years = birth ? Math.floor((TODAY.getTime() - b.getTime()) / (365.25 * 86_400_000)) : 30;
    const insurance: InsuranceType = years < 15 ? "子ども医療証" : years >= 75 ? "後期高齢者" : "社保本人";
    const p = store.addPatient({
      name: tidy(name), kana: tidy(toKatakana(kana)), sex: sex!, birth: b, phone: formatTel(digits), insurance,
      firstVisit: TODAY, visits: 0, recallMonths: 3, cancellations: 0, noShows: 0, line: false, allergies: [], conditions: [], teeth: {},
    });
    if (!birth) markNoBirth(p.id);
    toast("患者さんを登録しました", { detail: `${p.name}さん・診察券 ${p.number}` });
    onDone(p);
  };

  return (
    <div>
      <Inset>
        <FieldRow label="氏名" value={name} onChange={setName} placeholder="山田 花子" />
        <FieldRow label="ふりがな" value={kana} onChange={setKana} placeholder="やまだ はなこ" />
        <FieldRow label="電話番号" value={tel} onChange={setTel} placeholder="090-1234-5678" type="tel" inputMode="tel" />
        <label className="group relative flex min-h-[48px] items-center gap-3 px-4">
          <span className="w-[6.5em] shrink-0 text-[16px] text-label md:text-[15px]">生年月日</span>
          <input
            type="date"
            value={birth}
            max={TODAY_KEY}
            onChange={e => setBirth(e.target.value)}
            className={cn("min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none md:text-[15px]", !birth && "text-label3")}
          />
          <span className="shrink-0 text-[13px] text-label3">任意</span>
          <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />
        </label>
        <div className="flex min-h-[52px] items-center gap-3 px-4 py-2">
          <span className="w-[6.5em] shrink-0 text-[16px] text-label md:text-[15px]">性別</span>
          <div className="flex gap-2">
            {(["女性", "男性"] as const).map(x => (
              <Chip key={x} selected={sex === x} onClick={() => setSex(x)} className="min-w-[4.5rem]">{x}</Chip>
            ))}
          </div>
        </div>
      </Inset>
      {dup && (
        <div className="mt-2 flex items-center gap-3 rounded-cell bg-sand/20 px-4 py-2.5">
          <p className="min-w-0 flex-1 text-[13px] leading-[1.6] text-label">
            同じ電話番号の患者さんがいます：<span className="font-semibold">{dup.name}</span>（診察券 {dup.number}）
          </p>
          <Button size="sm" variant="tinted" onClick={() => onPickExisting(dup.id)}>この方を選ぶ</Button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {tried && error && (
          <motion.p key={error} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 px-1 text-[13px] text-red">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      <p className="mt-2 px-1 text-[12px] leading-[1.6] text-label3">保険証・問診票は初診の受付で確認します。</p>
      <div className="mt-3 flex gap-2">
        <Button variant="gray" onClick={onCancel}>やめる</Button>
        <Button variant="filled" icon={Plus} className="flex-1" onClick={submit}>登録して選ぶ</Button>
      </div>
    </div>
  );
}

const tidy = (s: string) => s.replace(/　/g, " ").replace(/\s+/g, " ").trim();
function formatTel(d: string) {
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (/^0[36]/.test(d)) return `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// ─── 2. メニュー ─────────────────────────────────────────────────────────────
/** PCでは2列に分けて並べる（行の数がほぼ同じになる分け方） */
const MENU_COLUMNS: Service["category"][][] = [["予防", "一般", "歯周", "外科"], ["補綴", "小児", "審美", "相談"]];

function MenuSection({ patient, value, onChange }: { patient?: Patient; value?: string; onChange: (id: string) => void }) {
  const phone = useIsPhone();
  const [editing, setEditing] = useState(!value);
  // 外から決まったとき（新しい患者さん→初診 など）も畳む
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value) setEditing(false);
  }
  const sv = value ? serviceById(value) : undefined;
  const open = editing || !sv;
  const caution = sv && patient && sv.category === "外科" ? surgicalCaution(patient) : null;
  const columns = phone ? [CATEGORIES] : MENU_COLUMNS;
  return (
    <section className="relative mt-8">
      <Title aside={sv && !open ? <button onClick={() => setEditing(true)} className="text-[15px] text-accent active:opacity-50 md:text-[14px]">変更</button> : undefined}>
        メニュー
      </Title>
      <AnimatePresence mode="popLayout" initial={false}>
        {open ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} className={cn(!phone && "grid grid-cols-2 items-start gap-4")}>
            {columns.map((cats, ci) => (
              <Inset key={ci}>
                {cats.map(cat =>
                  services.filter(x => x.category === cat).map((x, i, arr) => (
                    <MenuRow key={x.id} s={x} cat={i === 0 ? cat : undefined} groupEnd={i === arr.length - 1} selected={x.id === value} onClick={() => { onChange(x.id); setEditing(false); }} />
                  )),
                )}
              </Inset>
            ))}
          </motion.div>
        ) : (
          sv && (
            <motion.div key="chosen" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={spring}>
              <Inset>
                <button onClick={() => setEditing(true)} className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-fill/[0.06] active:bg-fill/12">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[17px] font-semibold leading-[22px] palt">{sv.name}</div>
                    <div className="mt-0.5 truncate text-[13px] text-label2">{sv.description}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[15px] font-medium tnum">{sv.minutes}分</div>
                    <div className={cn("text-[12px] tnum", sv.insurance ? "text-label2" : "text-accent")}>{priceLabel(sv)}</div>
                  </div>
                </button>
              </Inset>
            </motion.div>
          )
        )}
      </AnimatePresence>
      {caution && (
        <div className="mt-2 flex gap-2.5 rounded-cell bg-red/8 px-4 py-2.5">
          <TriangleAlert className="mt-[2px] h-4 w-4 shrink-0 text-red" strokeWidth={2.2} />
          <p className="text-[13px] leading-[1.6] text-label [word-break:auto-phrase]">{caution}</p>
        </div>
      )}
    </section>
  );
}

function surgicalCaution(p: Patient): string | null {
  const c = p.conditions.join("、");
  if (/抗凝固/.test(c)) return "抗凝固薬を服用中です。抜歯の前に服薬状況（PT-INR）を確認してください。";
  if (/BP製剤/.test(c)) return "骨粗しょう症の薬（BP製剤）を服用中です。抜歯の可否を歯科医師に確認してください。";
  return null;
}

/** メニューの1行：左に分類（グループの最初の行だけ）、名前と「30分・保険」 */
function MenuRow({ s, cat, groupEnd, selected, onClick }: { s: Service; cat?: string; groupEnd: boolean; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn("group/row relative flex w-full items-start gap-2 py-2.5 pl-4 pr-3 text-left transition-colors hover:bg-fill/[0.06] active:bg-fill/12", selected && "bg-sand/20")}
    >
      <span className="w-9 shrink-0 pt-px text-[12px] font-medium leading-5 text-label2">{cat}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] leading-[21px] md:text-[14px] md:leading-5">{s.name}</span>
        <span className="mt-0.5 block text-[12px] leading-4 text-label2 tnum">
          {s.minutes}分<span className="text-label4">・</span>
          <span className={cn(!s.insurance && "text-accent")}>{priceLabel(s)}</span>
        </span>
      </span>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center self-center">
        {selected && <Check className="h-[18px] w-[18px] text-accent" strokeWidth={2.6} />}
      </span>
      <RowSep left={groupEnd ? 16 : 60} />
    </button>
  );
}

// ─── 3. 日時：ユニットと担当 ────────────────────────────────────────────────
function Assignment({ sv, day, start, unitId, staffId, onUnit, onStaff }: {
  sv: Service; day: string; start: number; unitId: string; staffId: string; onUnit: (u: string) => void; onStaff: (s: string) => void;
}) {
  const store = useStore();
  const [edit, setEdit] = useState<"unit" | "staff" | null>(null);
  const end = start + sv.minutes;
  const st = staffById(staffId);
  const clash = staffConflict(store.appointments, staffId, day, start, end);
  return (
    <Inset className="mt-4">
      <Line onEdit={() => setEdit(e => (e === "unit" ? null : "unit"))} editing={edit === "unit"}>
        <span className="font-medium">{unitById(unitId).name}</span>が空いています
      </Line>
      <Reveal show={edit === "unit"}>
        <div className="grid grid-cols-4 gap-2 px-4 pb-3 pt-1">
          {units.map(u => {
            const busy = unitBusy(store.appointments, u.id, day, start, end);
            const on = u.id === unitId;
            return (
              <button
                key={u.id}
                disabled={busy}
                onClick={() => { onUnit(u.id); setEdit(null); }}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-[10px] transition-colors",
                  on ? "bg-ink text-onink" : busy ? "text-label3" : "bg-surface text-label hover:bg-surface/70",
                )}
              >
                <span className={cn("text-[14px] leading-tight", on ? "font-semibold" : "font-medium")}>{u.name}</span>
                <span className={cn("mt-0.5 text-[11px] leading-tight", on ? "text-onink/70" : "text-label3")}>{busy ? "使用中" : on ? "選択中" : "空き"}</span>
              </button>
            );
          })}
        </div>
      </Reveal>
      <Line onEdit={() => setEdit(e => (e === "staff" ? null : "staff"))} editing={edit === "staff"}>
        <span className="text-label2">担当</span>
        <Avatar name={st.name} tone={st.tone} size={22} className="ml-2" />
        <span className="ml-1.5 font-medium">{st.name}</span>
        <span className="ml-1.5 text-label2">{st.role}</span>
      </Line>
      <Reveal show={edit === "staff"}>
        <div className="flex flex-wrap gap-2 px-4 pb-3 pt-1">
          {eligibleStaff(sv).map(s => {
            const busy = staffConflict(store.appointments, s.id, day, start, end);
            return (
              <Chip key={s.id} selected={s.id === staffId} onClick={() => { onStaff(s.id); setEdit(null); }} className={cn("pl-1.5", s.id !== staffId && "bg-surface hover:bg-surface/70")}>
                <Avatar name={s.name} tone={s.tone} size={24} />
                {s.name}
                {busy && <span className="text-[11px] font-normal opacity-60">予約あり</span>}
              </Chip>
            );
          })}
        </div>
      </Reveal>
      {clash && (
        <p className="px-4 pb-3 text-[12px] leading-[1.6] text-label2">
          {st.short}はこの時間に{unitById(clash.unitId).name}の予約もあります（並行診療）。
        </p>
      )}
    </Inset>
  );
}

function Line({ children, onEdit, editing }: { children: ReactNode; onEdit: () => void; editing: boolean }) {
  return (
    <div className="group/row relative flex min-h-[48px] items-center gap-3 px-4 py-2 md:min-h-[44px]">
      <div className="flex min-w-0 flex-1 items-center truncate text-[16px] md:text-[15px]">{children}</div>
      <button onClick={onEdit} aria-expanded={editing} className="shrink-0 rounded-full px-2 py-1 text-[15px] text-accent transition-opacity active:opacity-50 md:text-[14px]">
        {editing ? "閉じる" : "変更"}
      </button>
      <RowSep />
    </div>
  );
}
