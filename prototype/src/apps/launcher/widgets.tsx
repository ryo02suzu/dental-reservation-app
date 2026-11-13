// 入口に並べるウィジェット。どれもストアの実際のデータを、その場で小さく見せる（画像は使わない）。
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ME, hoursFor, patientById, serviceById, units, type Appointment, type TileTone } from "@/data";
import { TODAY, TODAY_KEY, minutesOfDay, useNow } from "@/lib/clock";
import { fromKey, hm, mdw, relDay } from "@/lib/format";
import { useStore } from "@/lib/store";
import { IconTile, Sparkline, StatusPill, cn, spring, springSoft } from "@/ui";
import { isActive, statusOf, useDay } from "@/apps/clinic/helpers";
import { useConsole } from "@/apps/console/screens/parts/store";
import { mrrHistory, totalMRR } from "@/apps/console/screens/parts/model";
import { ArcheMark } from "./ArcheMark";

/** ウィジェットの登場（最初の一度だけ）。i は並び順 */
export const rise: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: (i: number) => ({ opacity: 1, y: 0, scale: 1, transition: { ...springSoft, delay: 0.12 + i * 0.05 } }),
};

/** ウィジェットの枠。全体が1つのボタンで、押すとアプリが開く */
export function Widget({
  label, icon, tone, onOpen, index, intro, className, children, aside,
}: {
  label: string;
  icon: LucideIcon;
  tone: TileTone;
  onOpen: (el: HTMLElement) => void;
  index: number;
  intro: boolean;
  className?: string;
  children: ReactNode;
  /** 見出しの右に出す小さな情報（時刻など） */
  aside?: ReactNode;
}) {
  return (
    <motion.button
      type="button"
      aria-label={`${label}を開く`}
      onClick={e => onOpen(e.currentTarget)}
      variants={rise}
      custom={index}
      initial={intro ? "hidden" : false}
      animate="show"
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      className={cn(
        "group relative flex min-w-0 flex-col overflow-hidden rounded-[22px] bg-surface p-4 text-left outline-none transition-shadow duration-300",
        "focus-visible:ring-2 focus-visible:ring-accent/60 md:p-5 [@media(hover:hover)]:hover:shadow-float",
        className,
      )}
    >
      <span className="flex w-full items-center gap-2">
        <IconTile icon={icon} tone={tone} size={24} />
        <span className="min-w-0 truncate text-[13px] font-semibold">{label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] text-label3 tnum">
          {aside}
          <motion.span variants={{ hover: { x: 2 } }} transition={spring}>
            <ChevronRight className="h-4 w-4 text-label4" strokeWidth={2.4} />
          </motion.span>
        </span>
      </span>
      {children}
    </motion.button>
  );
}

/** 数字が変わったときだけ、縦に入れ替わる */
export function RollNumber({ value, className }: { value: number | string; className?: string }) {
  return (
    <span className={cn("relative inline-flex overflow-hidden tnum", className)}>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={String(value)} initial={{ y: "70%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "-70%", opacity: 0 }} transition={spring}>
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// ─── 医院スタッフ：今日のようす ──────────────────────────────────────────
export function ClinicBody({ intro }: { intro: boolean }) {
  const now = useNow(15_000);
  const day = useDay(TODAY_KEY);
  const nowMin = minutesOfDay(now);
  const active = day.filter(isActive);
  const late = active.filter(a => statusOf(a, now) === "late").length;
  const stats = [
    { label: "予約", value: active.length },
    { label: "待合", value: active.filter(a => a.status === "arrived").length },
    { label: "診療中", value: active.filter(a => a.status === "in_progress").length },
    { label: "未来院", value: late, red: late > 0 },
  ];
  const next = active.filter(a => (a.status === "confirmed" || a.status === "pending") && a.start >= nowMin && statusOf(a, now) !== "late")[0];
  // 大きな画面では「これから」を数件出す（待合の人・まだ来ていない人・これから来る人）
  const upcoming = active.filter(a => (a.status === "arrived" || a.status === "confirmed" || a.status === "pending") && a.end > nowMin).slice(0, 4);
  return (
    <span className="mt-3 flex w-full flex-1 flex-col">
      <span className="text-[14px] leading-[1.6] text-label2 [text-wrap:pretty] [word-break:auto-phrase]">
        予約台帳、今日の受付、患者さんの情報。毎日いちばん使う画面です。
      </span>
      <span className="mt-4 grid grid-cols-4 gap-2">
        {stats.map(s => (
          <span key={s.label} className="flex flex-col">
            <span className="text-[11px] font-medium text-label2">{s.label}</span>
            <RollNumber value={s.value} className={cn("mt-0.5 text-[26px] font-semibold leading-[30px] tracking-[-0.01em]", s.red && "text-red")} />
          </span>
        ))}
      </span>
      <DayMap day={day} now={now} intro={intro} />
      <span className="mt-5 hidden md:block">
        <span className="block text-[11px] font-medium text-label2">これから</span>
        {upcoming.map(a => {
          const st = statusOf(a, now);
          return (
            <span key={a.id} className="hairline-b flex h-[34px] items-center gap-3 text-[13px] last:shadow-none">
              <span className="w-10 shrink-0 font-semibold tnum">{hm(a.start)}</span>
              <span className="min-w-0 flex-1 truncate">
                {patientById(a.patientId).name}
                <span className="text-label2">・{serviceById(a.serviceId).short}</span>
              </span>
              {st !== "confirmed" && <StatusPill status={st} compact />}
            </span>
          );
        })}
      </span>
      <span className="mt-auto flex items-center gap-1.5 pt-4 text-[13px] text-label2 md:hidden">
        {next ? (
          <>
            <span className="shrink-0 font-semibold text-label">次は {hm(next.start)}</span>
            <span className="min-w-0 truncate">
              {patientById(next.patientId).name}さん・{serviceById(next.serviceId).short}
            </span>
          </>
        ) : (
          <span>今日の予約は、すべて受付が済んでいます</span>
        )}
      </span>
      <span className="mt-auto hidden pt-4 text-[12px] text-label3 md:block">iPhone・iPad・パソコン</span>
    </span>
  );
}

/** ユニット4台の、今日の埋まり具合。いまの時刻に赤い線 */
function DayMap({ day, now, intro }: { day: Appointment[]; now: Date; intro: boolean }) {
  const h = hoursFor(TODAY);
  if (!h) return null;
  const start = h.am[0];
  const end = h.pm[1];
  const span = end - start;
  const at = (m: number) => ((m - start) / span) * 100;
  const nowMin = minutesOfDay(now);
  const showNow = nowMin >= start && nowMin <= end;
  const tone = (a: Appointment) => {
    const st = statusOf(a, now);
    if (st === "late") return "bg-red";
    if (st === "in_progress") return "bg-accent";
    if (st === "arrived") return "bg-accent/45";
    if (st === "completed") return "bg-sand/80";
    return "bg-fill/28";
  };
  return (
    <span className="relative mt-5 block w-full pl-7">
      {units.map((u, ui) => (
        <span key={u.id} className="relative mb-[5px] block h-[7px]">
          <span className="absolute -left-7 top-1/2 -translate-y-1/2 text-[10px] font-medium leading-none text-label3 tnum">{u.short}</span>
          <span className="absolute inset-0 overflow-hidden rounded-full bg-fill/10">
            <span className="hatch absolute inset-y-0" style={{ left: `${at(h.am[1])}%`, width: `${at(h.pm[0]) - at(h.am[1])}%` }} />
            {day
              .filter(a => a.unitId === u.id && isActive(a))
              .map(a => (
                <motion.span
                  key={a.id}
                  className={cn("absolute inset-y-0 rounded-full", tone(a))}
                  style={{ left: `${at(a.start)}%`, width: `calc(${at(a.end) - at(a.start)}% - 2px)`, originX: 0 }}
                  initial={intro ? { scaleX: 0, opacity: 0 } : false}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ ...springSoft, delay: 0.35 + ui * 0.06 }}
                />
              ))}
          </span>
        </span>
      ))}
      {showNow && (
        <motion.span
          className="pointer-events-none absolute -bottom-0.5 -top-4 w-0"
          style={{ left: `calc(1.75rem + (100% - 1.75rem) * ${(nowMin - start) / span})` }}
          initial={intro ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.3 }}
        >
          <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] font-semibold leading-none text-red tnum">{hm(nowMin)}</span>
          <span className="absolute bottom-0 top-3 w-px -translate-x-1/2 bg-red" />
        </motion.span>
      )}
      <span className="relative mt-1 block h-3 text-[10px] leading-none text-label3 tnum">
        {[start, h.am[1], h.pm[0], end].map((m, i) => (
          <span key={m} className={cn("absolute", i === 0 ? "" : i === 3 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${at(m)}%` }}>
            {hm(m)}
          </span>
        ))}
      </span>
    </span>
  );
}

// ─── 患者さんのWeb予約：本人の次回予約 ───────────────────────────────────
export function PatientBody() {
  const { appointments } = useStore();
  const next = appointments
    .filter(a => a.patientId === ME.id && a.date >= TODAY_KEY && (a.status === "confirmed" || a.status === "pending"))
    .sort((a, b) => (a.date === b.date ? a.start - b.start : a.date < b.date ? -1 : 1))[0];
  return (
    <span className="mt-3 flex w-full flex-1 flex-col">
      <span className="text-[11px] font-medium text-label2">次回のご予約</span>
      {next ? (
        <>
          <span className="mt-1 text-[13px] font-semibold text-accent">{relDay(fromKey(next.date), TODAY)}</span>
          <span className="text-[19px] font-semibold leading-tight tracking-[-0.01em] tnum palt">{mdw(fromKey(next.date))}</span>
          <span className="mt-0.5 truncate text-[13px] text-label2 tnum">
            {hm(next.start)}・{serviceById(next.serviceId).short}
          </span>
        </>
      ) : (
        <span className="mt-1 text-[15px] font-semibold">ご予約はありません</span>
      )}
      <span className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="rounded-full bg-ink px-3 py-[5px] text-[12px] font-semibold text-onink">予約する</span>
        <span className="truncate text-[11px] text-label3">スマートフォン</span>
      </span>
    </span>
  );
}

// ─── 受付端末：いまの時刻と受付ボタン ─────────────────────────────────────
export function KioskBody() {
  const now = useNow(10_000);
  return (
    <span className="mt-3 flex w-full flex-1 flex-col">
      <span className="text-[11px] font-medium text-label2">{mdw(now)}</span>
      <RollNumber value={hm(minutesOfDay(now))} className="mt-0.5 text-[34px] font-semibold leading-[40px] tracking-[-0.02em]" />
      <span className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="rounded-full px-3 py-[5px] text-[12px] font-semibold text-label shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.35)]">受付する</span>
        <span className="truncate text-[11px] text-label3">タブレット</span>
      </span>
    </span>
  );
}

// ─── 運営コンソール：月の売上の推移 ───────────────────────────────────────
export function ConsoleBody() {
  const s = useConsole();
  const hist = mrrHistory(s).map(x => x.value);
  const active = s.clinics.filter(c => c.active).length;
  return (
    <span className="mt-3 flex w-full flex-1 flex-col">
      <span className="text-[11px] font-medium text-label2">月の売上（MRR）</span>
      <RollNumber value={`¥${totalMRR(s).toLocaleString("ja-JP")}`} className="mt-0.5 text-[21px] font-semibold leading-tight tracking-[-0.01em]" />
      <Sparkline data={hist} width={150} height={34} strokeWidth={1.75} className="mt-2 text-accent" />
      <span className="mt-auto flex items-center justify-between gap-2 pt-2">
        <span className="text-[12px] text-label2 tnum">契約医院 {active}</span>
        <span className="truncate text-[11px] text-label3">パソコン</span>
      </span>
    </span>
  );
}

// ─── ログイン：PINの点（マウスを乗せると順に埋まる） ─────────────────────────
export function LoginBody() {
  return (
    <span className="mt-3 flex w-full flex-1 flex-col">
      <span className="flex items-center gap-2.5">
        <ArcheMark size={30} />
        <span className="text-[13px] leading-snug text-label2">スタッフの<br />サインイン</span>
      </span>
      <span className="mt-4 flex gap-3" aria-hidden>
        {[0, 1, 2, 3].map(i => (
          <motion.span
            key={i}
            className="h-3 w-3 rounded-full shadow-[inset_0_0_0_1.5px_rgb(var(--label)/0.5)]"
            variants={{
              show: { backgroundColor: "rgba(0, 0, 0, 0)", scale: 1, transition: { duration: 0.2 } },
              hover: { backgroundColor: "rgb(var(--label) / 0.85)", scale: [1, 1.18, 1], transition: { delay: 0.06 + i * 0.09, duration: 0.28 } },
            }}
          />
        ))}
      </span>
      <span className="mt-auto pt-3 text-[12px] text-label2">PINで本人を確認</span>
    </span>
  );
}
