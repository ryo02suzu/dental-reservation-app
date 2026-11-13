import type { ReactNode } from "react";
import { addDays } from "date-fns";
import { Check, ChevronRight } from "lucide-react";
import { HOURS, clinic, clinicPhase, hoursFor, serviceById, services } from "@/data";
import type { Service } from "@/data";
import { duration, hm, mdw, yen } from "@/lib/format";
import { getHolidayName } from "@/lib/holidays";
import { ListSection, cn } from "@/ui";
import { CopyButton, SectionHeading } from "./ui";

// ─── 本日の受付状況 ─────────────────────────────────────────────────────────
function nextOpenDay(from: Date): Date {
  const d = addDays(from, 1);
  while (!hoursFor(d)) d.setDate(d.getDate() + 1);
  return d;
}

/** 「ただいま受付中・13:00まで」と本日の診療時間 */
export function TodayStatus({ at, className }: { at: Date; className?: string }) {
  const phase = clinicPhase(at);
  const h = hoursFor(at);
  const open = phase.kind === "am" || phase.kind === "pm";
  let head = "";
  let detail: string | undefined;
  switch (phase.kind) {
    case "am":
    case "pm":
      head = "ただいま受付中";
      detail = phase.detail;
      break;
    case "before":
      head = "受付開始前";
      detail = phase.detail;
      break;
    case "lunch":
      head = "昼休み中";
      detail = `${phase.detail?.replace("から", "")}から受付`;
      break;
    case "after":
      head = "本日の受付は終了しました";
      break;
    case "closed":
      head = "本日は休診日です";
      break;
  }
  const next = nextOpenDay(at);
  const nh = hoursFor(next)!;
  const line = h
    ? `本日 ${hm(h.am[0])}–${hm(h.am[1])} / ${hm(h.pm[0])}–${hm(h.pm[1])}`
    : `次の診療日は ${mdw(next)} ${hm(nh.am[0])}から`;
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[15px] leading-5">
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", open ? "bg-accent" : "bg-label4")} />
        <span className={cn("font-semibold", open ? "text-accent" : "text-label")}>{head}</span>
        {detail && <span className="text-label2 tnum">{detail}</span>}
      </div>
      <div className="mt-1 pl-4 text-footnote text-label2 tnum">
        {line}
        {phase.kind === "after" && <span>・次は {mdw(next)} {hm(nh.am[0])}から</span>}
      </div>
    </div>
  );
}

// ─── 診療時間の表 ───────────────────────────────────────────────────────────
const COLS: { wd: number; label: string }[] = [
  { wd: 1, label: "月" }, { wd: 2, label: "火" }, { wd: 3, label: "水" }, { wd: 4, label: "木" },
  { wd: 5, label: "金" }, { wd: 6, label: "土" }, { wd: 0, label: "日祝" },
];
const STD = HOURS[1]!;

function Mark({ kind }: { kind: "open" | "short" | "closed" }) {
  if (kind === "closed") return <span aria-label="休診" className="block h-[1.5px] w-2.5 rounded-full bg-label4" />;
  if (kind === "short")
    return (
      <svg width="12" height="11" viewBox="0 0 12 11" aria-label="時間短縮" className="text-label">
        <path d="M6 1 11 10H1Z" fill="currentColor" />
      </svg>
    );
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-label="診療" className="text-label">
      <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** 日本の医院でおなじみの診療時間表（○＝診療・▲＝時間短縮・—＝休診）。今日の列を薄く塗る */
export function HoursTable({ at }: { at: Date }) {
  // 祝日は「日祝」の列
  const todayWd = getHolidayName(keyOf(at)) ? 0 : at.getDay();
  const sat = HOURS[6]!;
  const rows: { label: string; part: "am" | "pm" }[] = [
    { label: `${hm(STD.am[0])}–${hm(STD.am[1])}`, part: "am" },
    { label: `${hm(STD.pm[0])}–${hm(STD.pm[1])}`, part: "pm" },
  ];
  const kindOf = (wd: number, part: "am" | "pm") => {
    const h = HOURS[wd];
    if (!h) return "closed" as const;
    const [s, e] = h[part];
    return s === STD[part][0] && e === STD[part][1] ? ("open" as const) : ("short" as const);
  };
  const hl = (wd: number) => wd === todayWd;
  return (
    <div className="rounded-cell bg-surface px-3 pb-4 pt-3 md:px-4">
      <div role="table" aria-label="診療時間" className="grid grid-cols-[auto_repeat(7,minmax(0,1fr))] items-stretch">
        <div role="row" className="contents">
          <div role="columnheader" className="h-9" />
          {COLS.map(c => (
            <div
              key={c.wd}
              role="columnheader"
              className={cn(
                "flex h-9 items-center justify-center rounded-t-[10px] text-[13px] font-semibold",
                hl(c.wd) ? "bg-sand/20 text-accent" : "text-label2",
              )}
            >
              {c.label}
            </div>
          ))}
        </div>
        {rows.map((r, ri) => (
          <div key={r.part} role="row" className="contents">
            <div role="rowheader" className="flex h-11 items-center pr-3 text-[13px] text-label tnum">
              <span className="sr-only">{r.part === "am" ? "午前" : "午後"}</span>
              {r.label}
            </div>
            {COLS.map(c => (
              <div
                key={c.wd}
                role="cell"
                className={cn(
                  "flex h-11 items-center justify-center",
                  hl(c.wd) && "bg-sand/20",
                  hl(c.wd) && ri === rows.length - 1 && "rounded-b-[10px]",
                )}
              >
                <Mark kind={kindOf(c.wd, r.part)} />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-1 px-1 text-footnote leading-[1.6] text-label2">
        <p className="flex items-center gap-1.5 tnum">
          <svg width="10" height="9" viewBox="0 0 12 11" aria-hidden className="shrink-0 text-label2">
            <path d="M6 1 11 10H1Z" fill="currentColor" />
          </svg>
          土曜の午後は {hm(sat.pm[0])}–{hm(sat.pm[1])}
        </p>
        <p>休診日　{clinic.closedLabel}</p>
      </div>
    </div>
  );
}
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ─── アクセス・お問い合わせ ─────────────────────────────────────────────────
function InfoRow({ label, children, trailing }: { label: string; children: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="group relative flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-footnote text-label2">{label}</div>
        <div className="mt-0.5 text-[16px] leading-[22px] text-label md:text-[15px]">{children}</div>
      </div>
      {trailing}
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </div>
  );
}

export function AccessSection({ first }: { first?: boolean }) {
  return (
    <>
      <SectionHeading className={first ? "!mt-0" : undefined}>アクセス・お問い合わせ</SectionHeading>
      <ListSection footer="お電話は診療時間内にお願いします。" className="!mt-0">
        <InfoRow label="住所" trailing={<CopyButton text={clinic.address} what="住所" />}>
          {clinic.address.split(" ").map((part, i) => (
            <span key={i} className="whitespace-nowrap">
              {i > 0 && " "}
              {part}
            </span>
          ))}
        </InfoRow>
        <InfoRow label="最寄り駅">{clinic.access}</InfoRow>
        <InfoRow label="駐車場">{clinic.parking}</InfoRow>
        <InfoRow label="電話番号" trailing={<CopyButton text={clinic.phone} what="電話番号" />}>
          <span className="tnum">{clinic.phone}</span>
        </InfoRow>
      </ListSection>
    </>
  );
}

// ─── 診療メニュー ───────────────────────────────────────────────────────────
/** メニューの1行。予約の手順では押せる行（onClick）、ホームでは説明だけの行 */
export function MenuRow({ sv, onClick, selected, note, compact }: {
  sv: Service; onClick?: () => void; selected?: boolean; note?: ReactNode; compact?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      aria-pressed={onClick ? selected : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 px-4 text-left transition-colors duration-100",
        compact ? "min-h-[44px] py-2.5" : "min-h-[64px] py-3",
        onClick && "hover:bg-fill/[0.06] active:bg-fill/16",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className={cn("text-[16px] leading-[22px] md:text-[15px] md:leading-5", selected ? "font-semibold text-label" : "text-label")}>{sv.name}</div>
        {!compact && <div className="mt-0.5 text-[13px] leading-5 text-label2">{sv.description}</div>}
        {note && <div className="mt-1 text-[13px] font-medium leading-5 text-accent">{note}</div>}
      </div>
      <div className="shrink-0 text-right tnum">
        {compact ? (
          <div className="text-[15px] text-label2 md:text-[14px]">{sv.insurance ? duration(sv.minutes) : sv.price ? yen(sv.price) : "無料"}</div>
        ) : (
          <>
            <div className={cn("text-[15px] leading-5 md:text-[14px]", sv.insurance ? "text-label2" : "text-label")}>{sv.insurance ? "保険" : sv.price ? yen(sv.price) : "無料"}</div>
            <div className="mt-0.5 text-[13px] leading-[18px] text-label3">{duration(sv.minutes)}</div>
          </>
        )}
      </div>
      {onClick &&
        (selected ? (
          <Check className="h-[18px] w-[18px] shrink-0 text-accent" strokeWidth={2.6} />
        ) : (
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-label4" strokeWidth={2.4} />
        ))}
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </Tag>
  );
}

const INSURED = ["sv10", "sv01", "sv03", "sv04", "sv05", "sv06", "sv08", "sv07", "sv09"];
const SELF_PAY = services.filter(s => !s.insurance);

export function MenuOverview() {
  return (
    <>
      <SectionHeading>診療メニュー</SectionHeading>
      <ListSection header="保険診療" aside={<span className="pb-px text-footnote text-label3">所要時間の目安</span>} className="!mt-0">
        {INSURED.map(id => (
          <MenuRow key={id} sv={serviceById(id)} compact />
        ))}
      </ListSection>
      <ListSection header="自費診療" footer="自費診療の料金は税込です。保険診療の窓口負担は、年齢や所得により1〜3割です。">
        {SELF_PAY.map(s => (
          <MenuRow key={s.id} sv={s} />
        ))}
      </ListSection>
    </>
  );
}

export { nextOpenDay };
