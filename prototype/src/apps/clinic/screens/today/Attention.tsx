import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CircleCheck, Circle, Ellipsis, IdCard, NotebookPen, Send, UserX } from "lucide-react";
import { useStore } from "@/lib/store";
import { hm } from "@/lib/format";
import { staff as STAFF, type Patient } from "@/data";
import { Avatar, Button, IconButton, Menu, MenuItem, MenuSeparator, StatusPill, Tag, cn, easeOut, useToast } from "@/ui";
import { useClinicUI } from "../../context";
import { riskOf } from "../../helpers";
import { remember } from "./memory";
import { Group, Item, PhoneCopy, RowShell, hit, useFresh } from "./parts";
import { mins, riskText, type Attention as Att, type Today } from "./model";

const channelOf = (p: Patient) => (p.line ? "LINE" : p.email ? "メール" : "SMS");
const reception = STAFF.find(s => s.role === "受付")!;

/** 対応が必要：未来院・注意事項・Web予約の承認待ち・初診の準備。1件に1つの主な操作 */
export function AttentionList({ t }: { t: Today }) {
  const fresh = useFresh(t.attention.map(x => x.key));
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {t.attention.length ? (
        <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <Group>
            <AnimatePresence initial={false}>
              {t.attention.map(x => (
                <Item key={x.key} inset={60} fresh={fresh(x.key)}>
                  <AttentionRow x={x} t={t} />
                </Item>
              ))}
            </AnimatePresence>
          </Group>
        </motion.div>
      ) : (
        <motion.div key="empty" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: easeOut }}>
          <Group>
            <div className="flex items-center gap-3 px-4 py-4">
              <CircleCheck className="h-7 w-7 shrink-0 text-accent" strokeWidth={1.8} />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold leading-5">対応が必要な予約はありません</div>
                <div className="mt-0.5 text-[13px] leading-[18px] text-label2">未来院・承認待ち・初診の準備・注意事項があると、ここに表示します。</div>
              </div>
            </div>
          </Group>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AttentionRow({ x, t }: { x: Att; t: Today }) {
  const { setStatus, addMemo } = useStore();
  const ui = useClinicUI();
  const toast = useToast();
  const { a, patient, service, staff, unit } = x.row;
  const where = `${unit.name} ${staff.short}`;
  const open = () => ui.openAppointment(a.id);
  const lead = <Avatar name={patient.name} size={32} />;
  const name = <span className="truncate text-[16px] font-semibold leading-[21px] md:text-[15px] md:leading-5">{patient.name}</span>;
  const line = "mt-0.5 truncate text-[13px] leading-[18px] text-label2 tnum";
  const common = { onOpen: open, lead, label: `${patient.name}さん ${hm(a.start)}の予約を開く` };

  if (x.kind === "late") {
    const risk = riskOf(patient);
    return (
      <RowShell
        {...common}
        title={<span className="flex min-w-0 items-center gap-1.5">{name}<StatusPill status="late" compact /></span>}
        actions={
          <>
            <Button
              size="sm"
              variant="tinted"
              className={hit}
              onClick={() => {
                setStatus(a.id, "arrived");
                toast("受付しました", { detail: `${patient.name}さん・${hm(a.start)}の予約` });
              }}
            >
              来院
            </Button>
            <Menu trigger={<IconButton icon={Ellipsis} label="ほかの操作" size="sm" variant="gray" className={hit} />}>
              <MenuItem icon={CalendarDays} onSelect={open}>予約を開く</MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={UserX}
                destructive
                onSelect={() => {
                  setStatus(a.id, "no_show");
                  toast("無断キャンセルにしました", { icon: UserX, detail: `${patient.name}さん・${hm(a.start)}の予約` });
                }}
              >
                無断キャンセルにする
              </MenuItem>
            </Menu>
          </>
        }
      >
        <div className={line}>
          {hm(a.start)}の予約・<span className="font-medium text-red">{mins(x.row.overdue)}経過</span> · {where} · {service.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] leading-[18px]">
          <PhoneCopy phone={patient.phone} />
          {risk >= 2 && <span className="text-label3">{riskText(patient.cancellations, patient.noShows)}</span>}
        </div>
      </RowShell>
    );
  }

  if (x.kind === "alert") {
    return (
      <RowShell
        {...common}
        title={name}
        actions={
          <Button
            size="sm"
            variant="tinted"
            className={hit}
            onClick={() => {
              addMemo({ patientId: patient.id, apptId: a.id, staffId: reception.id, body: [x.labels.join("・"), x.prep].filter(Boolean).join("。") });
              remember(m => ({ handedOff: { ...m.handedOff, [a.id]: true } }));
              toast("申し送りました", { icon: NotebookPen, detail: `${staff.name}さんへ・${hm(a.start)} ${patient.name}さん` });
            }}
          >
            申し送る
          </Button>
        }
      >
        <div className="mt-0.5 flex flex-wrap gap-1">
          {x.labels.map(l => <Tag key={l} tone="red">{l}</Tag>)}
        </div>
        <div className={cn(line, "mt-1")}>
          <span className="font-medium text-label">{hm(a.start)}</span> · {service.name} · {where}
        </div>
        {x.prep && <div className="mt-0.5 text-[13px] leading-[18px] text-label3">{x.prep}</div>}
      </RowShell>
    );
  }

  if (x.kind === "pending") {
    const ago = x.requested ? Math.max(0, Math.round((t.now.getTime() - x.requested.getTime()) / 60_000)) : undefined;
    return (
      <RowShell
        {...common}
        label={`${patient.name}さんのWeb予約を開く`}
        title={<span className="flex min-w-0 items-center gap-1.5">{name}<StatusPill status="pending" compact /></span>}
        actions={
          <Button
            size="sm"
            variant="tinted"
            className={hit}
            onClick={() => {
              setStatus(a.id, "confirmed");
              toast("予約を承認しました", { detail: `${patient.name}さんに確定をお知らせしました（${channelOf(patient)}）` });
            }}
          >
            承認する
          </Button>
        }
      >
        <div className={line}>
          <span className="font-medium text-label">{hm(a.start)}〜{hm(a.end)}</span> · {service.name}
        </div>
        <div className={line}>
          {where} · Web予約{ago === undefined ? "" : ago < 1 ? "・たった今" : ago < 60 ? `・${ago}分前` : `・${Math.floor(ago / 60)}時間前`}
        </div>
      </RowShell>
    );
  }

  // 初診：来院前は問診票、来院したら保険証
  const formStep = x.step === "form";
  return (
    <RowShell
      {...common}
      label={`${patient.name}さん（初診）の予約を開く`}
      title={<span className="flex min-w-0 items-center gap-1.5">{name}<Tag tone="accent" className="shrink-0">初診</Tag></span>}
      actions={
        formStep ? (
          <Button
            size="sm"
            variant="tinted"
            className={hit}
            onClick={() => {
              remember(m => ({ formSent: { ...m.formSent, [a.id]: true } }));
              toast("問診票を送信しました", { icon: Send, detail: `${patient.name}さん・${channelOf(patient)}` });
            }}
          >
            問診票を送る
          </Button>
        ) : (
          <Button
            size="sm"
            variant="tinted"
            className={hit}
            onClick={() => {
              remember(m => ({ insurance: { ...m.insurance, [a.id]: true } }));
              toast("保険証を確認しました", { icon: IdCard, detail: `${patient.name}さん・${patient.insurance}` });
            }}
          >
            保険証を確認
          </Button>
        )
      }
    >
      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13px] leading-[18px]">
        <Check1 done={!formStep} label={formStep ? "問診票 未回答" : "問診票 回答済み"} />
        <Check1 done={false} label={formStep ? "保険証は来院時に確認" : "保険証 未確認"} />
      </div>
      <div className={line}>
        <span className="font-medium text-label">{hm(a.start)}〜{hm(a.end)}</span> · {service.name} · {where}
      </div>
    </RowShell>
  );
}

/** 準備のチェック項目（済み＝チェック、未＝白丸） */
function Check1({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", done ? "text-label2" : "text-label")}>
      {done ? <CircleCheck className="h-3.5 w-3.5 text-accent" strokeWidth={2.2} /> : <Circle className="h-3.5 w-3.5 text-label3" strokeWidth={2.2} />}
      {label}
    </span>
  );
}

