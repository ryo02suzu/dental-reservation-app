import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { addMonths, differenceInCalendarDays } from "date-fns";
import { BellRing, CalendarPlus, Check, ChevronsUpDown, Copy, History, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { TODAY, TODAY_KEY, minutesOfDay } from "@/lib/clock";
import { ago, fromKey, hm, md, mdw, relDay, wd } from "@/lib/format";
import { serviceById, staffById, unitById, type Appointment, type Patient } from "@/data";
import { Button, ListSection, Menu, MenuItem, StatusPill, Tag, cn, tapSoft, useToast, type StatusKey } from "@/ui";
import { statusOf } from "@/apps/clinic/helpers";
import { dateSmart, riskOfMeta, ymd, type PatientMeta } from "./util";

function ShowAll({ open, total, onClick }: { open: boolean; total: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="hairline-t flex h-11 w-full items-center px-4 text-left text-[15px] text-accent transition-colors hover:bg-fill/[0.06] active:bg-fill/12 md:text-[14px]">
      {open ? "少なく表示" : `すべて表示（${total}件）`}
    </button>
  );
}

const Sep = ({ left = 16 }: { left?: number }) => (
  <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" style={{ left }} />
);

// ─── 次回の予約 ───────────────────────────────────────────────────────────
function DateTile({ d, today }: { d: Date; today: boolean }) {
  return (
    <div className={cn("flex h-[58px] w-12 shrink-0 flex-col items-center justify-center rounded-[11px]", today ? "bg-sand/30" : "bg-fill/8")}>
      <span className="text-[11px] font-semibold leading-none text-label2 tnum">{d.getMonth() + 1}月</span>
      <span className="mt-[5px] text-[22px] font-semibold leading-none tracking-[-0.01em] tnum">{d.getDate()}</span>
      <span className="mt-[5px] text-[11px] leading-none text-label2">{wd(d)}</span>
    </div>
  );
}

export function UpcomingSection({ p, m, upcoming, now, onOpen, onBook, onCopyPhone }: {
  p: Patient; m: PatientMeta; upcoming: Appointment[]; now: Date;
  onOpen: (id: string) => void; onBook: () => void; onCopyPhone: () => void;
}) {
  const [all, setAll] = useState(false);
  const [hero, ...rest] = upcoming;
  const shown = all ? rest : rest.slice(0, 3);
  return (
    <ListSection header="次回の予約" aside={upcoming.length > 1 ? <span className="text-footnote text-label2 tnum">{upcoming.length}件</span> : undefined}>
      {!hero ? (
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium">予定されている予約はありません</div>
            <p className="mt-0.5 text-footnote text-label2">{m.lastVisit ? `前回の来院は${ago(m.lastVisit, TODAY)}（${md(m.lastVisit)}）です。` : "まだ来院の記録がありません。"}</p>
          </div>
          <Button variant="tinted" size="sm" icon={CalendarPlus} onClick={onBook}>予約を取る</Button>
        </div>
      ) : (
        <>
          <HeroRow a={hero} p={p} now={now} onOpen={onOpen} onCopyPhone={onCopyPhone} />
          {shown.map(a => <CompactRow key={a.id} a={a} now={now} onOpen={onOpen} />)}
          {rest.length > 3 && <ShowAll open={all} total={upcoming.length} onClick={() => setAll(v => !v)} />}
        </>
      )}
    </ListSection>
  );
}

function HeroRow({ a, p, now, onOpen, onCopyPhone }: { a: Appointment; p: Patient; now: Date; onOpen: (id: string) => void; onCopyPhone: () => void }) {
  const s = serviceById(a.serviceId);
  const st = staffById(a.staffId);
  const u = unitById(a.unitId);
  const status = statusOf(a, now);
  const d = fromKey(a.date);
  const today = a.date === TODAY_KEY;
  const late = status === "late";
  return (
    <div className="group relative">
      <motion.button
        type="button"
        whileTap={tapSoft}
        transition={{ type: "spring", stiffness: 600, damping: 34 }}
        onClick={() => onOpen(a.id)}
        className="flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-fill/[0.05] active:bg-fill/12"
      >
        <DateTile d={d} today={today} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[17px] font-semibold leading-[22px] md:text-[16px]">{s.name}</span>
                {a.firstVisit && <Tag tone="accent" className="shrink-0">初診</Tag>}
              </div>
              <div className="mt-1 text-footnote text-label2 tnum">
                <span className={cn(today && "font-semibold text-label")}>{relDay(d, TODAY)}</span>
                <span className="px-1 text-label4">·</span>
                {hm(a.start)}–{hm(a.end)}
              </div>
              <div className="mt-0.5 truncate text-footnote text-label2">{st.name}<span className="px-1 text-label4">·</span>{u.name}</div>
            </div>
            <StatusPill status={status} compact className="mt-0.5" />
          </div>
          {a.note && <p className="mt-2 text-footnote leading-[1.55] text-label">{a.note}</p>}
          {late && <p className="mt-2 text-footnote font-medium text-red tnum">予約時刻（{hm(a.start)}）から{minutesOfDay(now) - a.start}分たっています</p>}
        </div>
      </motion.button>
      {late && (
        <div className="-mt-1.5 flex items-center gap-2 pb-3.5 pl-[78px] pr-4">
          <Button variant="tinted" size="sm" icon={Copy} onClick={onCopyPhone}>電話番号をコピー</Button>
          <span className="truncate text-footnote text-label2 tnum">{p.phone}</span>
        </div>
      )}
      <Sep />
    </div>
  );
}

function CompactRow({ a, now, onOpen }: { a: Appointment; now: Date; onOpen: (id: string) => void }) {
  const s = serviceById(a.serviceId);
  const st = staffById(a.staffId);
  const u = unitById(a.unitId);
  return (
    <button
      type="button"
      onClick={() => onOpen(a.id)}
      className="group relative grid min-h-[44px] w-full grid-cols-[7.4em_2.8em_minmax(0,1fr)_auto] items-center gap-x-2 px-4 py-2 text-left text-footnote transition-colors hover:bg-fill/[0.05] active:bg-fill/12"
    >
      <span className="tnum">{mdw(fromKey(a.date))}</span>
      <span className="font-semibold tnum">{hm(a.start)}</span>
      <span className="truncate text-label2">
        {s.name}
        <span className="px-1 text-label4">·</span>
        {st.short}
        <span className="px-1 text-label4">·</span>
        {u.short}
      </span>
      <StatusPill status={statusOf(a, now)} compact />
      <Sep />
    </button>
  );
}

// ─── 来院履歴 ─────────────────────────────────────────────────────────────
export interface HistItem {
  id: string;
  date: Date;
  title: string;
  staffId: string;
  note?: string;
  status?: StatusKey;
  apptId?: string;
}

export function HistorySection({ items, upcomingFirst, onOpen }: { items: HistItem[]; upcomingFirst?: Appointment; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 5);
  return (
    <ListSection header="来院履歴" aside={items.length ? <span className="text-footnote text-label2 tnum">{items.length}件</span> : undefined}>
      {items.length === 0 ? (
        <div className="flex items-start gap-3 px-4 py-3.5">
          <History className="mt-0.5 h-[18px] w-[18px] shrink-0 text-label3" strokeWidth={2} />
          <div className="min-w-0">
            <div className="text-[15px] font-medium">来院の記録はまだありません</div>
            <p className="mt-0.5 text-footnote text-label2">
              {upcomingFirst
                ? `${relDay(fromKey(upcomingFirst.date), TODAY)} ${hm(upcomingFirst.start)} の${serviceById(upcomingFirst.serviceId).short}が、最初の来院になります。`
                : "来院すると、ここに日付と内容が並びます。"}
            </p>
          </div>
        </div>
      ) : (
        shown.map(h => <HistRow key={h.id} h={h} onOpen={onOpen} />)
      )}
      {items.length > 5 && <ShowAll open={all} total={items.length} onClick={() => setAll(v => !v)} />}
    </ListSection>
  );
}

function HistRow({ h, onOpen }: { h: HistItem; onOpen: (id: string) => void }) {
  const st = staffById(h.staffId);
  const off = h.status && h.status !== "completed";
  const inner = (
    <>
      <span className="w-[7.4em] shrink-0 pt-px text-footnote text-label2 tnum">{dateSmart(h.date)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate text-[15px] font-medium leading-5 md:text-[14px]", off && "text-label2")}>{h.title}</span>
          {off && <StatusPill status={h.status!} compact className="ml-auto" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-footnote leading-[1.55] text-label2">
          {st.short}
          {h.note && (
            <>
              <span className="px-1 text-label4">·</span>
              {h.note}
            </>
          )}
        </p>
      </div>
    </>
  );
  const cls = "group relative flex w-full items-start gap-3 px-4 py-3 text-left";
  return h.apptId ? (
    <button type="button" onClick={() => onOpen(h.apptId!)} className={cn(cls, "transition-colors hover:bg-fill/[0.05] active:bg-fill/12")}>
      {inner}
      <Sep />
    </button>
  ) : (
    <div className={cls}>
      {inner}
      <Sep />
    </div>
  );
}

// ─── 連絡先 ───────────────────────────────────────────────────────────────
function Field({ label, children, action }: { label: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="group relative flex min-h-[58px] items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-caption text-label2">{label}</div>
        <div className="mt-0.5 truncate text-[16px] leading-[21px] md:text-[15px] md:leading-5">{children}</div>
      </div>
      {action}
      <Sep />
    </div>
  );
}

function CopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="-mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-accent transition-colors hover:bg-fill/10 active:bg-fill/16">
      <Copy className="h-[17px] w-[17px]" strokeWidth={2.1} />
    </button>
  );
}

export function ContactSection({ p, onCopy }: { p: Patient; onCopy: (text: string, what: string) => void }) {
  const toast = useToast();
  return (
    <ListSection header="連絡先">
      <Field label="電話" action={<CopyButton label="電話番号をコピー" onClick={() => onCopy(p.phone, "電話番号")} />}>
        <span className="tnum">{p.phone}</span>
      </Field>
      <Field label="メール" action={p.email ? <CopyButton label="メールアドレスをコピー" onClick={() => onCopy(p.email!, "メールアドレス")} /> : undefined}>
        {p.email ?? <span className="text-label3">登録なし</span>}
      </Field>
      <Field
        label="LINE"
        action={
          p.line ? (
            <Check className="mr-1 h-[18px] w-[18px] shrink-0 text-label3" strokeWidth={2.4} />
          ) : (
            <Button variant="tinted" size="sm" icon={Send} onClick={() => toast("LINE連携の案内を送りました", { icon: Send, detail: `SMS・${p.phone}` })}>案内を送る</Button>
          )
        }
      >
        {p.line ? "連携済み（予約の確認・リマインドをLINEで送信）" : <span className="text-label2">未連携</span>}
      </Field>
    </ListSection>
  );
}

// ─── 来院の記録・リコール ─────────────────────────────────────────────────
function Num({ label, value, unit, sub, red }: { label: string; value: string; unit?: string; sub?: string; red?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-caption text-label2">{label}</div>
      <div className={cn("mt-1 flex items-baseline gap-0.5", red && "text-red")}>
        <span className="text-[20px] font-semibold leading-6 tracking-[-0.01em] tnum">{value}</span>
        {unit && <span className={cn("text-footnote font-medium", red ? "text-red" : "text-label2")}>{unit}</span>}
      </div>
      {sub && <div className="mt-0.5 truncate text-caption text-label2 tnum">{sub}</div>}
    </div>
  );
}

const RECALL_OPTIONS = [3, 4, 6] as const;

export function StatsSection({ p, m }: { p: Patient; m: PatientMeta }) {
  const { updatePatient, recalls } = useStore();
  const toast = useToast();
  const risky = riskOfMeta(m) >= 2;
  const recall = recalls.find(r => r.patientId === p.id);
  const days = m.nextRecall ? differenceInCalendarDays(m.nextRecall, TODAY) : undefined;
  const due = days !== undefined && Math.abs(days) <= 30;
  return (
    <ListSection header="来院の記録">
      <div className="group relative grid grid-cols-[auto_auto_auto] justify-between gap-x-4 px-4 py-3.5">
        <Num label="最終来院" value={m.lastVisit ? ago(m.lastVisit, TODAY) : "—"} sub={m.lastVisit ? md(m.lastVisit) : "来院なし"} />
        <Num label="キャンセル" value={String(m.cancellations)} unit="回" red={risky && m.cancellations > 0} />
        <Num label="無断キャンセル" value={String(m.noShows)} unit="回" red={risky && m.noShows > 0} />
        <Sep />
      </div>
      <div className="group relative flex min-h-[44px] items-center gap-3 px-4 py-1.5">
        <span className="flex-1 text-[15px] md:text-[14px]">リコール間隔</span>
        <Menu
          trigger={
            <button type="button" className="-mr-2 flex h-8 items-center gap-1 rounded-full px-2 text-[15px] text-accent transition-colors hover:bg-fill/10 data-[state=open]:bg-fill/12 md:text-[14px]">
              {p.recallMonths}か月ごと
              <ChevronsUpDown className="h-3.5 w-3.5" strokeWidth={2.4} />
            </button>
          }
        >
          {RECALL_OPTIONS.map(n => (
            <MenuItem
              key={n}
              icon={p.recallMonths === n ? Check : undefined}
              onSelect={() => {
                if (n === p.recallMonths) return;
                updatePatient(p.id, { recallMonths: n, nextRecall: m.lastVisit ? addMonths(m.lastVisit, n) : undefined });
                toast(`リコールを${n}か月ごとにしました`, { icon: BellRing, detail: m.lastVisit ? `次回の目安 ${ymd(addMonths(m.lastVisit, n))}` : undefined });
              }}
            >
              {n}か月ごと
            </MenuItem>
          ))}
        </Menu>
        <Sep />
      </div>
      <div className="group relative flex min-h-[44px] items-center gap-3 px-4 py-2.5">
        <span className="flex-1 text-[15px] md:text-[14px]">次回リコール</span>
        <span className={cn("text-right text-[15px] tnum md:text-[14px]", due ? "font-semibold text-label" : "text-label2")}>
          {m.nextRecall ? (
            <>
              {dateSmart(m.nextRecall)}
              {due && days !== undefined && <span className="ml-1.5 font-normal text-label2">{relDay(m.nextRecall, TODAY)}</span>}
            </>
          ) : (
            "初回の来院後に決まります"
          )}
        </span>
        <Sep />
      </div>
      {recall && (
        <div className="group relative flex min-h-[44px] items-center gap-3 px-4 py-2.5">
          <span className="flex-1 text-[15px] md:text-[14px]">リコールの案内</span>
          <span className="text-right text-[15px] text-label2 tnum md:text-[14px]">
            <span className={cn(recall.status === "未連絡" && "font-semibold text-label")}>{recall.status}</span>
            <span className="px-1 text-label4">·</span>
            {recall.channel}
            {recall.sentAt && recall.status !== "未連絡" && <span className="ml-1">{md(recall.sentAt)}</span>}
          </span>
          <Sep />
        </div>
      )}
    </ListSection>
  );
}
