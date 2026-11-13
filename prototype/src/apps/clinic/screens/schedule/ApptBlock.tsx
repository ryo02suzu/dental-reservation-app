// 台帳の予約ブロック。淡い面＋左端3pxの担当者の色（カレンダーの慣習。ここだけ色帯を使う）
import { memo } from "react";
import { motion } from "framer-motion";
import { Check, Globe, MessageCircle } from "lucide-react";
import type { Appointment, Service, TileTone } from "@/data";
import { minutesOfDay } from "@/lib/clock";
import { hm } from "@/lib/format";
import { STATUS, cn, tapSoft, type StatusKey } from "@/ui";
import { alertsOf, expand, statusOf } from "../../helpers";
import { TONE_EDGE, TONE_FILL, type ColumnMode } from "./model";

export interface BlockLook {
  /** 面（不透明。罫線が透けないように地の色を敷く） */
  box: string;
  /** 面の上に重ねる色 */
  tint?: string;
  /** 左端の色帯 */
  edge?: string;
  name: string;
  sub: string;
  info: string;
}

const PENDING_HATCH = "[background-image:repeating-linear-gradient(-45deg,rgb(var(--sand)/0.2)_0_3px,transparent_3px_8px)]";

/** 状態ごとの見た目（StatusPill と同じ約束：仮予約＝斜線＋破線、来院済＝砂色の淡い面、診療中＝砂色、完了＝薄く、未来院＝赤い輪郭） */
export function blockLook(sk: StatusKey, tone: TileTone): BlockLook {
  switch (sk) {
    case "pending":
      return { box: cn("bg-surface border border-dashed border-accent/60", PENDING_HATCH), name: "text-label", sub: "text-label2", info: "text-accent" };
    case "arrived":
      return { box: "bg-surface", tint: "bg-sand/32", edge: TONE_EDGE[tone], name: "text-label", sub: "text-label2", info: "text-accent" };
    case "in_progress":
      return { box: "bg-sand", edge: TONE_EDGE[tone], name: "text-onsand", sub: "text-onsand/72", info: "text-onsand/72" };
    case "completed":
      return { box: "bg-surface", tint: "bg-fill/8", edge: cn(TONE_EDGE[tone], "opacity-40"), name: "text-label2", sub: "text-label3", info: "text-label3" };
    case "late":
      return { box: "bg-surface shadow-[inset_0_0_0_1px_rgb(var(--red)/0.7)]", tint: TONE_FILL[tone], edge: TONE_EDGE[tone], name: "text-label", sub: "text-label2", info: "text-red" };
    case "cancelled":
    case "no_show":
      return { box: "bg-surface shadow-[inset_0_0_0_1px_rgb(var(--separator)/0.2)]", tint: "bg-fill/4", name: "text-label3 line-through decoration-red/55", sub: "text-label3", info: "text-red/85" };
    default:
      return { box: "bg-surface", tint: TONE_FILL[tone], edge: TONE_EDGE[tone], name: "text-label", sub: "text-label2", info: "text-label2" };
  }
}

/** 台帳に出すメニュー名。初診は「初診」の札が付くので、名前の後半（カウンセリング）を出す */
export function serviceLabel(a: Appointment, s: Service): string {
  if (a.firstVisit && s.name.startsWith("初診・")) return s.name.slice(3);
  return s.short;
}

/** 3段目に出す、状態に応じた一言 */
function infoText(a: Appointment, sk: StatusKey, now: Date): string {
  const range = `${hm(a.start)}–${hm(a.end)}`;
  const m = minutesOfDay(now);
  switch (sk) {
    case "pending": return `${range} · 承認待ち`;
    case "arrived": return a.arrivedAt !== undefined ? `${range} · 待合 ${Math.max(0, m - a.arrivedAt)}分` : `${range} · 来院済`;
    case "in_progress": return a.startedAt !== undefined ? `診療中 · ${hm(a.startedAt)}〜` : `${range} · 診療中`;
    case "completed": return `${range} · 完了`;
    case "late": return `${range} · ${Math.max(0, m - a.start)}分経過`;
    case "cancelled": return a.cancelReason ? `キャンセル · ${a.cancelReason}` : "キャンセル";
    case "no_show": return "無断キャンセル";
    default: return range;
  }
}

const SRC = { web: Globe, line: MessageCircle } as const;
const SRC_LABEL = { web: "Web予約", line: "LINE" } as const;

/** 名前の右に並べる印（未来院・初診・注意事項・予約経路） */
function Marks({ a, sk, compact }: { a: Appointment; sk: StatusKey; compact?: boolean }) {
  const { patient } = expand(a);
  const alerts = alertsOf(patient);
  const red = alerts.some(x => x.tone === "red");
  const onSand = sk === "in_progress";
  const gone = sk === "cancelled" || sk === "no_show";
  const done = sk === "completed";
  const Src = !done && (a.source === "web" || a.source === "line") ? SRC[a.source] : null;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-[5px] pl-1.5">
      {sk === "late" && <span className="text-[11px] font-semibold leading-4 text-red">未来院</span>}
      {a.firstVisit && !gone && !done && (
        <span className={cn("rounded-[4px] px-[5px] text-[10px] font-semibold leading-[15px]", onSand ? "bg-onsand/14 text-onsand" : "bg-sand/45 text-label")}>初診</span>
      )}
      {alerts.length > 0 && !gone && !done && (
        <span className={cn("h-[6px] w-[6px] rounded-full", red ? "bg-red" : onSand ? "bg-onsand/45" : "bg-label3")} title={alerts.map(x => x.label).join("・")} />
      )}
      {Src && !compact && <Src className={cn("h-3 w-3", onSand ? "text-onsand/60" : "text-label3")} strokeWidth={2.2} aria-label={SRC_LABEL[a.source as "web" | "line"]} />}
      {done && <Check className="h-3 w-3 text-label3" strokeWidth={2.6} aria-label="完了" />}
    </span>
  );
}

const ROLE_SHORT: Record<string, string> = { 院長: "院長", 歯科医師: "Dr", 歯科衛生士: "DH", 歯科助手: "助手", 受付: "受付" };
export const roleShort = (r: string) => ROLE_SHORT[r] ?? r;

export const ApptBlock = memo(function ApptBlock({ a, top, height, lane, lanes, mode, now, onOpen }: {
  a: Appointment;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  mode: ColumnMode;
  now: Date;
  onOpen: (id: string) => void;
}) {
  const { patient, service, staff, unit } = expand(a);
  const sk = statusOf(a, now);
  const look = blockLook(sk, staff.tone);
  const tier = height < 30 ? 1 : height < 54 ? 2 : height < 74 ? 3 : 4;
  const who = mode === "unit" ? staff.short : unit.short;
  const gone = sk === "cancelled" || sk === "no_show";
  const svc = serviceLabel(a, service);
  const w = 100 / lanes;
  return (
    <motion.button
      type="button"
      data-block=""
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
      transition={{ type: "spring", stiffness: 520, damping: 40 }}
      whileTap={tapSoft}
      onClick={e => { e.stopPropagation(); onOpen(a.id); }}
      aria-label={`${hm(a.start)}から${hm(a.end)} ${patient.name} ${service.name} ${staff.name} ${unit.name} ${STATUS[sk].label}`}
      className={cn(
        "group absolute z-[1] overflow-hidden rounded-[6px] text-left outline-offset-1 transition-[filter] duration-150 hover:z-[2] hover:brightness-[0.97]",
        look.box,
      )}
      style={{ top, height, left: `calc(${lane * w}% + 2px)`, width: `calc(${w}% - ${lanes > 1 ? 4 : 7}px)` }}
    >
      {look.tint && <span aria-hidden className={cn("absolute inset-0", look.tint)} />}
      {look.edge && <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px]", look.edge)} />}
      {tier === 1 ? (
        <span className="relative flex h-full min-w-0 items-center gap-1.5 pl-[9px] pr-1.5">
          <span className={cn("min-w-0 truncate text-[12px] font-semibold leading-4", look.name)}>{patient.name}</span>
          <span className={cn("min-w-0 shrink-[3] truncate text-[11px] leading-4", look.sub)}>{gone ? (sk === "no_show" ? "無断キャンセル" : "キャンセル") : svc}</span>
          <Marks a={a} sk={sk} compact />
        </span>
      ) : (
        <span className="relative flex h-full min-w-0 flex-col pl-[9px] pr-1.5 pt-[3px]">
          <span className="flex min-w-0 items-center">
            <span className={cn("min-w-0 truncate text-[13px] font-semibold leading-4", look.name)}>{patient.name}</span>
            <Marks a={a} sk={sk} />
          </span>
          <span className={cn("mt-px truncate text-[12px] leading-[15px]", look.sub)}>
            {gone && tier === 2 ? infoText(a, sk, now) : `${svc} · ${who}`}
          </span>
          {tier >= 3 && <span className={cn("mt-px truncate text-[11px] leading-[14px] tnum", look.info)}>{infoText(a, sk, now)}</span>}
          {tier >= 4 && a.note && !gone && (
            <span className={cn("mt-1 line-clamp-2 text-[11px] leading-[14px]", sk === "in_progress" ? "text-onsand/72" : "text-label2")}>{a.note}</span>
          )}
        </span>
      )}
    </motion.button>
  );
});
