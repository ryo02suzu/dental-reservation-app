import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck } from "lucide-react";
import { useStore } from "@/lib/store";
import { TODAY_KEY } from "@/lib/clock";
import { fromKey, hm, md } from "@/lib/format";
import { Avatar, Button, Tag, cn, easeOut, springBouncy, tapSoft, useToast } from "@/ui";
import { useClinicUI } from "../../context";
import { remember } from "./memory";
import { hit } from "./parts";
import { mins, progressOf, type Today, type UnitState } from "./model";

/** ユニット（診療台）4台。診療中は白い面、空きは一段沈んだ面 */
export function UnitGrid({ t, className }: { t: Today; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      {t.units.map(u => <UnitTile key={u.unit.id} u={u} t={t} />)}
    </div>
  );
}

function UnitTile({ u, t }: { u: UnitState; t: Today }) {
  const { setStatus } = useStore();
  const ui = useClinicUI();
  const toast = useToast();
  const [pressed, setPressed] = useState(false);
  const busy = u.current;
  const state = busy ? `busy-${busy.a.id}` : u.done ? `done-${u.done.a.id}` : `idle-${u.next?.a.id ?? "none"}`;
  const target = busy ?? u.done ?? u.next;
  const open = () => (target ? ui.openAppointment(target.a.id) : ui.openNew({ date: TODAY_KEY, unitId: u.unit.id, staffId: u.staff.id }));
  const label = busy
    ? `${u.unit.name}：${busy.patient.name}さんが診療中。予約を開く`
    : u.done
      ? `${u.unit.name}：${u.done.patient.name}さんの診療が完了。予約を開く`
      : u.next
        ? `${u.unit.name}：空き。次の予約を開く`
        : `${u.unit.name}：空き。予約を入れる`;

  return (
    <motion.div
      animate={pressed ? tapSoft : { scale: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 32 }}
      className={cn(
        "relative min-h-[148px] rounded-card transition-colors duration-300",
        busy ? "bg-surface" : "bg-fill/8",
      )}
    >
      <button
        type="button"
        onClick={open}
        aria-label={label}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onPointerCancel={() => setPressed(false)}
        className="absolute inset-0 h-full w-full rounded-card transition-colors hover:bg-fill/4 focus-visible:outline-offset-[-2px]"
      />
      <div className="pointer-events-none relative flex h-full min-h-[148px] flex-col p-3">
        <div className="flex items-center justify-between gap-2 text-[12px] leading-4">
          <span className={cn("font-semibold", busy ? "text-label2" : "text-label3")}>{u.unit.name}</span>
          <span className="truncate text-label3">{u.staff.short}</span>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={state}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="flex min-h-0 flex-1 flex-col"
          >
            {busy ? (
              <Busy u={u} t={t} onDone={() => {
                setStatus(busy.a.id, "completed");
                remember(m => ({ done: { ...m.done, [u.unit.id]: { apptId: busy.a.id, at: t.now.getTime() } } }));
                toast("診療を完了しました", { detail: `${u.unit.name} · ${busy.patient.name}さん` });
              }} />
            ) : u.done ? (
              <Done
                u={u}
                onBook={() => ui.openNew({ patientId: u.done!.a.patientId, serviceId: u.done!.a.serviceId })}
                onOpenNext={() => u.doneNext && ui.openAppointment(u.doneNext.id)}
              />
            ) : (
              <Idle
                u={u}
                t={t}
                onStart={() => {
                  const nx = u.next!;
                  setStatus(nx.a.id, "in_progress");
                  toast("診療を開始しました", { detail: `${u.unit.name} · ${nx.patient.name}さん` });
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function Busy({ u, t, onDone }: { u: UnitState; t: Today; onDone: () => void }) {
  const r = u.current!;
  const p = progressOf(r, t.nowMin);
  const over = p.left < 0;
  return (
    <>
      <div className="mt-2.5 flex min-w-0 items-center gap-2">
        <motion.span layoutId={`seat-${r.a.id}`} className="block shrink-0 rounded-full" transition={{ type: "spring", stiffness: 380, damping: 36 }}>
          <Avatar name={r.patient.name} size={26} />
        </motion.span>
        <span className="truncate text-[16px] font-semibold leading-[21px] md:text-[15px] md:leading-5">{r.patient.name}</span>
      </div>
      <div className="mt-1 truncate text-[13px] leading-[18px] text-label2">{r.service.name}</div>
      <div className="mt-auto pt-3">
        <div className="h-1 overflow-hidden rounded-full bg-fill/16" role="progressbar" aria-valuemin={0} aria-valuemax={p.planned} aria-valuenow={Math.min(p.elapsed, p.planned)} aria-label="診療の経過">
          <div className={cn("h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700", over ? "bg-red" : "bg-accent")} style={{ width: `${Math.max(4, p.ratio * 100)}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={cn("whitespace-nowrap text-[13px] font-medium leading-[18px] tnum", over ? "text-red" : "text-label")}>
            {over ? `${mins(-p.left)}超過` : p.left === 0 ? "まもなく終了" : `あと${mins(p.left)}`}
          </span>
          <Button size="sm" variant="tinted" className={cn(hit, "pointer-events-auto -my-1 h-7 px-3")} onClick={onDone}>
            完了
          </Button>
        </div>
      </div>
    </>
  );
}

function Done({ u, onBook, onOpenNext }: { u: UnitState; onBook: () => void; onOpenNext: () => void }) {
  const r = u.done!;
  const nx = u.doneNext;
  return (
    <>
      <div className="mt-2.5 flex items-center gap-1.5">
        <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...springBouncy, delay: 0.08 }} className="flex">
          <CircleCheck className="h-[18px] w-[18px] text-accent" strokeWidth={2.2} />
        </motion.span>
        <span className="text-[16px] font-semibold leading-[21px] md:text-[15px] md:leading-5">完了</span>
      </div>
      <div className="mt-1 truncate text-[13px] leading-[18px] text-label2">{r.patient.name}さん</div>
      <div className="mt-auto pt-3">
        {/* 次回の予約がすでにあれば確認、なければ取る（会計のときに受付で次回を決める） */}
        <div className="truncate text-[12px] leading-4 text-label3 tnum">
          {nx ? `次回 ${nx.date === TODAY_KEY ? "今日" : md(fromKey(nx.date))} ${hm(nx.start)}` : "次回の予約はまだありません"}
        </div>
        <Button
          size="sm"
          variant="tinted"
          full
          className={cn(hit, "pointer-events-auto mt-1.5 h-7 px-2")}
          onClick={nx ? onOpenNext : onBook}
        >
          {nx ? "次回の予約を確認" : "次回の予約を取る"}
        </Button>
      </div>
    </>
  );
}

function Idle({ u, t, onStart }: { u: UnitState; t: Today; onStart: () => void }) {
  const nx = u.next;
  const here = nx?.a.status === "arrived";
  const wait = here ? Math.max(0, t.nowMin - (nx!.a.arrivedAt ?? t.nowMin)) : 0;
  return (
    <>
      <div className="mt-2.5 text-[16px] font-semibold leading-[21px] text-label2 md:text-[15px] md:leading-5">空き</div>
      <div className="mt-auto pt-3">
        {nx ? (
          <>
            <div className="text-[12px] leading-4 text-label3 tnum">次は {hm(nx.a.start)}</div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13px] font-medium leading-[18px] text-label">{nx.patient.name}さん</span>
              {here && <Tag className="shrink-0">来院済</Tag>}
            </div>
            {/* 次の患者さんがもう来ていれば、ここから呼び入れられる（待合まで目を移さなくてよい） */}
            {here && (
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="whitespace-nowrap text-[13px] font-medium leading-[18px] text-label tnum">{wait < 1 ? "いま来院" : `${mins(wait)}待ち`}</span>
                <Button size="sm" variant="tinted" className={cn(hit, "pointer-events-auto -my-1 h-7 px-3")} onClick={onStart}>
                  診療を開始
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-[13px] leading-[18px] text-label3">本日の予約はありません</div>
        )}
      </div>
    </>
  );
}
