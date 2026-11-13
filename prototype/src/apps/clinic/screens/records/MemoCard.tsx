import { forwardRef } from "react";
import { motion } from "framer-motion";
import { CornerDownRight, Pin } from "lucide-react";
import { useStore } from "@/lib/store";
import { fromKey, hm, md, toothLabel } from "@/lib/format";
import { patientById, serviceById, staffById, type Memo } from "@/data";
import { Avatar, Tag, cn, springSoft, useToast } from "@/ui";
import { useClinicUI } from "@/apps/clinic/context";
import { sortTeeth } from "./util";

/** 診療メモ1件。患者・時刻・本文・歯・次回・書いた人、右上にピン留め */
export const MemoCard = forwardRef<HTMLDivElement, { m: Memo; showDate?: boolean; fresh?: boolean }>(function MemoCard({ m, showDate, fresh }, ref) {
  const ui = useClinicUI();
  const toast = useToast();
  const { updateMemo, appointments } = useStore();
  const p = patientById(m.patientId);
  const author = staffById(m.staffId);
  const appt = m.apptId ? appointments.find(a => a.id === m.apptId) : undefined;
  const svc = appt ? serviceById(appt.serviceId).short : undefined;
  const toPatient = () => ui.go("patients", p.id);

  return (
    <motion.div
      ref={ref}
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={springSoft}
      className="group relative overflow-hidden"
    >
      <motion.div
        initial={fresh ? { backgroundColor: "rgb(var(--sand) / 0.22)" } : false}
        animate={{ backgroundColor: "rgb(var(--sand) / 0)" }}
        transition={{ duration: 1.6, delay: 0.4 }}
        className="flex gap-3 py-3.5 pl-4 pr-3"
      >
        <button type="button" onClick={toPatient} aria-label={`${p.name}さんの詳細`} className="h-9 shrink-0 rounded-full transition-opacity active:opacity-60">
          <Avatar name={p.name} size={36} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-[36px] items-start gap-2">
            <div className="min-w-0 flex-1">
              <button type="button" onClick={toPatient} className="block max-w-full truncate text-left text-[16px] font-semibold leading-[21px] hover:underline hover:decoration-label4 hover:underline-offset-2 md:text-[15px] md:leading-5">
                {p.name}
              </button>
              <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2 tnum md:text-[12px] md:leading-4">
                {showDate ? `${md(fromKey(m.date))} ` : ""}
                {hm(m.at)}
                {svc ? `・${svc}` : ""}
              </div>
            </div>
            <button
              type="button"
              aria-pressed={!!m.pinned}
              aria-label={m.pinned ? "ピン留めを外す" : "ピン留めする"}
              title={m.pinned ? "ピン留めを外す" : "ピン留めする"}
              onClick={() => {
                updateMemo(m.id, { pinned: !m.pinned });
                toast(m.pinned ? "ピン留めを外しました" : "ピン留めしました", { icon: Pin, detail: `${p.name}さんのメモ` });
              }}
              className={cn(
                "-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-fill/10",
                m.pinned ? "text-accent" : "text-label4 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100",
              )}
            >
              <Pin className={cn("h-[17px] w-[17px]", m.pinned && "fill-current")} strokeWidth={2} />
            </button>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap text-[15px] leading-[1.7] text-label [word-break:auto-phrase] md:text-[14px]">{m.body}</p>
          {m.teeth && m.teeth.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {sortTeeth(m.teeth).map(t => <Tag key={t} tone="outline">{toothLabel(t)}</Tag>)}
            </div>
          )}
          {m.next && (
            <div className="mt-2 flex items-start gap-1.5 text-[14px] leading-[1.6] text-label md:text-[13px]">
              <CornerDownRight className="mt-[3px] h-3.5 w-3.5 shrink-0 text-label3" strokeWidth={2.2} />
              <span><span className="text-label2">次回：</span>{m.next}</span>
            </div>
          )}
          <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-label2">
            <Avatar name={author.name} tone={author.tone} size={18} />
            <span className="truncate">{author.name}</span>
            <span className="text-label4">·</span>
            <span className="shrink-0 text-label3">{author.role}</span>
          </div>
        </div>
      </motion.div>
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-[64px] right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
    </motion.div>
  );
});
