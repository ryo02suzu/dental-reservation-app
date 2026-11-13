import { AnimatePresence, motion } from "framer-motion";
import { BellRing, CalendarPlus, Check, ExternalLink, Settings2, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { TODAY_KEY } from "@/lib/clock";
import { fromKey, hm, mdw } from "@/lib/format";
import { patientById, unitById, type Notice } from "@/data";
import { Button, IconTile, cn, useToast } from "@/ui";
import { ApptRow } from "@/apps/clinic/ApptRow";
import { useClinicUI } from "@/apps/clinic/context";
import { KIND, noticeStamp } from "./util";

/** PC（1024px以上）の右側：選んだお知らせの詳細と、その場でできる操作 */
export function NoticePreview({ n, now, unread }: { n?: Notice; now: Date; unread: number }) {
  return (
    <div className="rounded-card bg-surface">
      <AnimatePresence mode="wait" initial={false}>
        {n ? (
          <motion.div key={n.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.18 }}>
            <Detail n={n} now={now} />
          </motion.div>
        ) : (
          <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[320px] flex-col items-center justify-center px-8 py-16 text-center">
            <div className="text-[17px] font-semibold">{unread ? `未読が${unread}件あります` : "すべて確認済みです"}</div>
            <p className="mt-1 max-w-[30ch] text-[14px] text-label2">左の一覧からお知らせを選ぶと、ここに詳細と関連する予約が表示されます。</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Detail({ n, now }: { n: Notice; now: Date }) {
  const ui = useClinicUI();
  const toast = useToast();
  const { appointments, setStatus, readNotice } = useStore();
  const k = KIND[n.kind];
  const appt = n.apptId ? appointments.find(a => a.id === n.apptId) : undefined;
  const p = appt ? patientById(appt.patientId) : undefined;
  const slotOpen = n.kind === "cancel" && appt && appt.date >= TODAY_KEY;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3">
        <IconTile icon={k.icon} tone={k.tone} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-label2">{k.label}</div>
          <div className="text-[13px] text-label3 tnum">{noticeStamp(n.at, now)}</div>
        </div>
        {!n.read && (
          <Button variant="gray" size="sm" icon={Check} onClick={() => readNotice(n.id)}>既読にする</Button>
        )}
      </div>
      <h2 className="mt-5 text-title3 palt">{n.title}</h2>
      <p className="mt-2 text-[15px] leading-[1.7] text-label [word-break:auto-phrase]">{n.body}</p>

      {appt && (
        <div className="mt-6">
          <div className="pb-1.5 text-footnote font-medium text-label2">{appt.status === "cancelled" ? "キャンセルされた予約" : "予約"}</div>
          <div className="hairline overflow-hidden rounded-cell">
            <ApptRow appt={appt} showDate={appt.date === TODAY_KEY ? undefined : mdw(fromKey(appt.date)).replace(/（.）/, "")} onClick={() => ui.openAppointment(appt.id)} />
          </div>
        </div>
      )}
      {slotOpen && appt && (
        <p className="mt-3 text-[14px] leading-[1.6] text-label2">
          空いた枠：{appt.date === TODAY_KEY ? "本日" : mdw(fromKey(appt.date))} <span className="tnum">{hm(appt.start)}〜{hm(appt.end)}</span>・{unitById(appt.unitId).name}
        </p>
      )}

      <div className={cn("flex flex-wrap gap-2", appt || slotOpen ? "mt-5" : "mt-6")}>
        {appt?.status === "pending" && (
          <Button
            variant="filled"
            icon={Check}
            onClick={() => {
              setStatus(appt.id, "confirmed");
              readNotice(n.id);
              toast("予約を確定しました", { detail: `${p?.name}さん・${mdw(fromKey(appt.date))} ${hm(appt.start)}` });
            }}
          >
            承認する
          </Button>
        )}
        {slotOpen && appt && (
          <Button variant="filled" icon={CalendarPlus} onClick={() => ui.openNew({ date: appt.date, start: appt.start, unitId: appt.unitId, staffId: appt.staffId })}>
            この枠に予約を入れる
          </Button>
        )}
        {appt && (
          <Button variant={appt.status === "pending" || slotOpen ? "gray" : "tinted"} icon={ExternalLink} onClick={() => ui.openAppointment(appt.id)}>
            予約を開く
          </Button>
        )}
        {p && (
          <Button variant="gray" icon={UserRound} onClick={() => ui.go("patients", p.id)}>患者の詳細</Button>
        )}
        {n.kind === "recall" && (
          <Button variant="gray" icon={BellRing} onClick={() => ui.go("recall")}>リコールを開く</Button>
        )}
        {(n.kind === "system" || n.kind === "remind") && (
          <Button variant="gray" icon={Settings2} onClick={() => ui.go("settings")}>{n.kind === "remind" ? "リマインドの設定" : "設定を開く"}</Button>
        )}
      </div>
    </div>
  );
}
