import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Footprints, Globe, MessageCircle, Phone } from "lucide-react";
import { useStore } from "@/lib/store";
import { hm } from "@/lib/format";
import { Button, StatusPill, Tag, cn, easeOut, useToast, type StatusKey } from "@/ui";
import { useClinicUI } from "../../context";
import { alertsOf } from "../../helpers";
import { Group, Item, RowShell, hit, useFresh } from "./parts";
import { CHECKIN_WINDOW, type Row, type Today } from "./model";

const SOURCE_ICON = { web: Globe, line: MessageCircle, phone: Phone, walkin: Footprints } as const;
const SOURCE_LABEL = { web: "Web予約", line: "LINE", phone: "電話", walkin: "飛び込み" } as const;

/** これから：来院前の予約を時刻順に。午前・午後に分け、昼休みと「いま」を挟む */
export function UpcomingList({ t, showDone, onToggleDone }: { t: Today; showDone: boolean; onToggleDone: () => void }) {
  const h = t.hours;
  const lunch = h ? h.am[1] : 780;
  const am = t.upcoming.filter(r => r.a.start < lunch);
  const pm = t.upcoming.filter(r => r.a.start >= lunch);
  const fresh = useFresh(t.upcoming.map(r => r.a.id));

  // 「いま」の線：最初の「これから始まる予約」の前に置く。午前中に午前の残りがすべて過ぎている（未来院だけ）なら午前の最後、
  // 来院前の予約がすべて過ぎていれば、その最後に置く
  const firstFuture = t.upcoming.find(r => r.a.start >= t.nowMin);
  const marker: { list: "am" | "pm"; before?: string } | null = firstFuture
    ? firstFuture.a.start >= lunch && t.nowMin < lunch && am.length
      ? { list: "am" }
      : { list: firstFuture.a.start < lunch ? "am" : "pm", before: firstFuture.a.id }
    : t.upcoming.length
      ? { list: pm.length ? "pm" : "am" }
      : null;

  const group = (list: Row[], name: "am" | "pm") => {
    const out: JSX.Element[] = [];
    const here = marker?.list === name ? marker : null;
    for (const r of list) {
      const before = here?.before === r.a.id;
      if (before) out.push(<NowMarker key="now" t={t} />);
      out.push(
        <Item key={r.a.id} inset={80} sep={!before} fresh={fresh(r.a.id)}>
          <TimeRow r={r} t={t} />
        </Item>,
      );
    }
    if (here && !here.before) out.push(<NowMarker key="now" t={t} />);
    return (
      <Group>
        <AnimatePresence initial={false}>{out}</AnimatePresence>
      </Group>
    );
  };

  return (
    <div>
      {t.finished.length > 0 && <Finished t={t} open={showDone} onToggle={onToggleDone} />}
      {am.length > 0 && (
        <>
          <SubHeader first={t.finished.length === 0}>午前</SubHeader>
          {group(am, "am")}
        </>
      )}
      {am.length > 0 && pm.length > 0 && h && (
        <div className="hatch mt-3 flex h-8 items-center gap-2 rounded-[10px] px-4 text-[12px] leading-4 text-label3 tnum" aria-label={`昼休み ${hm(h.am[1])}〜${hm(h.pm[0])}`}>
          <span className="font-medium text-label2">昼休み</span>
          <span>{hm(h.am[1])}〜{hm(h.pm[0])}</span>
        </div>
      )}
      {pm.length > 0 && (
        <>
          <SubHeader first={t.finished.length === 0 && am.length === 0}>午後</SubHeader>
          {group(pm, "pm")}
        </>
      )}
      {t.upcoming.length === 0 && (
        <Group className={cn(t.finished.length > 0 && "mt-3")}>
          <div className="px-4 py-3.5 text-[15px] leading-5 text-label2">このあと来院予定の予約はありません</div>
        </Group>
      )}
    </div>
  );
}

function SubHeader({ children, first }: { children: string; first?: boolean }) {
  return <h3 className={cn("px-4 pb-1.5 text-footnote font-medium text-label2", first ? "pt-0" : "pt-5")}>{children}</h3>;
}

/** いまの位置。予定表アプリの現在時刻の線と同じ考え方 */
function NowMarker({ t }: { t: Today }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative flex h-6 items-center gap-3 px-4"
      role="separator"
      aria-label={`現在 ${hm(t.nowMin)}`}
    >
      <span className="w-[3.25rem] text-[12px] font-semibold leading-none text-accent tnum">{hm(t.nowMin)}</span>
      <span className="relative h-[1.5px] flex-1 rounded-full bg-accent/60">
        <span className="absolute -left-[3px] -top-[2.25px] h-1.5 w-1.5 rounded-full bg-accent" />
      </span>
    </motion.div>
  );
}

/** 予約1件（時刻 | 患者・内容 | 状態や操作） */
export function TimeRow({ r, t, muted }: { r: Row; t: Today; muted?: boolean }) {
  const { setStatus } = useStore();
  const ui = useClinicUI();
  const toast = useToast();
  const { a, patient, service, staff, unit } = r;
  const Src = SOURCE_ICON[a.source];
  const red = alertsOf(patient).filter(x => x.tone === "red");
  const canCheckin = !muted && a.status === "confirmed" && a.start - t.nowMin <= CHECKIN_WINDOW;
  const pill: StatusKey | undefined = muted ? a.status : r.late ? "late" : a.status === "pending" ? "pending" : undefined;
  return (
    <RowShell
      onOpen={() => ui.openAppointment(a.id)}
      label={`${hm(a.start)} ${patient.name}さんの予約を開く`}
      leadWidth={52}
      muted={muted}
      lead={<span className={cn("text-[16px] font-semibold leading-5 tnum", r.late && "text-red")}>{hm(a.start)}</span>}
      leadBelow={<span className="block text-[12px] leading-4 text-label3 tnum">{hm(a.end)}</span>}
      title={
        <span className="flex min-w-0 items-center gap-1.5">
          <span className={cn("truncate text-[16px] font-medium leading-[21px] md:text-[15px] md:leading-5", a.status === "cancelled" && "line-through decoration-red/50")}>{patient.name}</span>
          {!muted && pill && <StatusPill status={pill} compact />}
          {a.firstVisit && <Tag tone="accent" className="shrink-0">初診</Tag>}
        </span>
      }
      actions={
        canCheckin ? (
          <Button
            size="sm"
            variant="tinted"
            className={hit}
            onClick={() => {
              setStatus(a.id, "arrived");
              toast("受付しました", { detail: `${patient.name}さん・${hm(a.start)}の予約` });
            }}
          >
            受付する
          </Button>
        ) : muted && pill ? (
          <span className="flex h-8 items-center"><StatusPill status={pill} compact /></span>
        ) : undefined
      }
    >
      <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] leading-[18px] text-label2">
        <span className="truncate">{service.name}</span>
        <span className="text-label4">·</span>
        <span className="shrink-0">{staff.short}</span>
        <span className="text-label4">·</span>
        <span className="shrink-0 tnum">{unit.short}</span>
        <Src className="ml-0.5 h-3.5 w-3.5 shrink-0 text-label3" strokeWidth={2} aria-label={SOURCE_LABEL[a.source]} />
      </div>
      {!muted && (red.length > 0 || a.note) && (
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
          {red.slice(0, 2).map(x => <Tag key={x.label} tone="red">{x.label}</Tag>)}
          {a.note && <span className="min-w-0 truncate text-[12px] leading-4 text-label3">{a.note}</span>}
        </div>
      )}
    </RowShell>
  );
}

/** 終わった予約（完了・無断キャンセル・キャンセル）。押すと開く */
function Finished({ t, open, onToggle }: { t: Today; open: boolean; onToggle: () => void }) {
  const n = (s: string) => t.finished.filter(r => r.a.status === s).length;
  const parts = [n("completed") && `完了 ${n("completed")}`, n("no_show") && `無断キャンセル ${n("no_show")}`, n("cancelled") && `キャンセル ${n("cancelled")}`].filter(Boolean);
  return (
    <Group className="mb-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-fill/4 active:bg-fill/12"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[16px] leading-[21px] md:text-[15px] md:leading-5">
            終わった予約 <span className="tnum text-label2">{t.finished.length}件</span>
          </div>
          <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2 tnum">{parts.join("・")}</div>
        </div>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.25, ease: easeOut }} className="flex shrink-0">
          <ChevronRight className="h-[18px] w-[18px] text-label3" strokeWidth={2.4} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.36, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="hairline-t">
              {t.finished.map(r => (
                <div key={r.a.id} className="group/item relative">
                  <span aria-hidden className="pointer-events-none absolute right-0 top-0 z-[2] h-px origin-top scale-y-50 bg-sep/30 group-first/item:hidden" style={{ left: 80 }} />
                  <TimeRow r={r} t={t} muted />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Group>
  );
}
