import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Ellipsis, Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { hm } from "@/lib/format";
import { Avatar, Button, IconButton, Menu, MenuItem, MenuSeparator, cn, easeOut, useToast } from "@/ui";
import { useClinicUI } from "../../context";
import { Group, Item, RowShell, hit, useFresh } from "./parts";
import { mins, progressOf, type Row, type Today, type UnitState } from "./model";

/** 待合：来院した順。待ち時間はその場で進む */
export function WaitingList({ t }: { t: Today }) {
  const fresh = useFresh(t.waiting.map(r => r.a.id));
  const [ask, setAsk] = useState<string | null>(null);
  if (!t.waiting.length) {
    return (
      <Group>
        <div className="px-4 py-3.5 text-[15px] leading-5 text-label2">待合にいる患者さんはいません</div>
      </Group>
    );
  }
  return (
    <Group>
      <AnimatePresence initial={false}>
        {t.waiting.map(r => (
          <Item key={r.a.id} inset={60} fresh={fresh(r.a.id)}>
            <WaitingRow r={r} t={t} unit={t.units.find(u => u.unit.id === r.a.unitId)!} asking={ask === r.a.id} onAsk={v => setAsk(v ? r.a.id : null)} />
          </Item>
        ))}
      </AnimatePresence>
    </Group>
  );
}

function WaitingRow({ r, t, unit, asking, onAsk }: { r: Row; t: Today; unit: UnitState; asking: boolean; onAsk: (v: boolean) => void }) {
  const { setStatus } = useStore();
  const ui = useClinicUI();
  const toast = useToast();
  const { a, patient, service, staff } = r;
  const wait = Math.max(0, t.nowMin - (a.arrivedAt ?? t.nowMin));
  // 予約時刻を過ぎて、来院から15分以上お待たせしているときだけ赤で知らせる
  const overdue = wait >= 15 && t.nowMin >= a.start;
  const busy = unit.current;
  const left = busy ? progressOf(busy, t.nowMin).left : 0;

  const start = () => {
    setStatus(a.id, "in_progress");
    toast("診療を開始しました", { detail: `${unit.unit.name}・${patient.name}さん` });
  };

  return (
    <>
      <RowShell
        onOpen={() => ui.openAppointment(a.id)}
        label={`${patient.name}さん ${hm(a.start)}の予約を開く`}
        lead={
          <motion.span layoutId={`seat-${a.id}`} className="block shrink-0 rounded-full" transition={{ type: "spring", stiffness: 380, damping: 36 }}>
            <Avatar name={patient.name} size={32} />
          </motion.span>
        }
        title={<span className="truncate text-[16px] font-semibold leading-[21px] md:text-[15px] md:leading-5">{patient.name}</span>}
        actions={
          <>
            <Button size="sm" variant="tinted" className={hit} onClick={() => (busy ? onAsk(!asking) : start())} aria-expanded={busy ? asking : undefined}>
              診療を開始
            </Button>
            <Menu trigger={<IconButton icon={Ellipsis} label="ほかの操作" size="sm" variant="gray" className={hit} />}>
              <MenuItem icon={CalendarDays} onSelect={() => ui.openAppointment(a.id)}>予約を開く</MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={Undo2}
                onSelect={() => {
                  setStatus(a.id, "confirmed");
                  toast("受付を取り消しました", { icon: Undo2, detail: `${patient.name}さん・${hm(a.start)}の予約` });
                }}
              >
                受付を取り消す
              </MenuItem>
            </Menu>
          </>
        }
      >
        <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2 tnum">
          <span className={cn("font-medium", overdue ? "text-red" : "text-label")}>{wait < 1 ? "いま来院" : `${mins(wait)}待ち`}</span>
          {" · "}
          {hm(a.start)}の予約
        </div>
        <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label2">
          {unit.unit.name} {staff.short} · {service.name}
        </div>
        {busy && (
          <div className="mt-0.5 truncate text-[13px] leading-[18px] text-label3 tnum">
            {unit.unit.name}は使用中・{left > 0 ? `あと${mins(left)}` : "終了予定を過ぎています"}
          </div>
        )}
      </RowShell>
      <AnimatePresence initial={false}>
        {asking && busy && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="pb-3.5 pl-[60px] pr-4">
              <div className="rounded-[10px] bg-fill/8 px-3 py-2.5">
                <p className="text-[13px] leading-[19px] text-label">
                  {unit.unit.name}は<span className="whitespace-nowrap">{busy.patient.name}さん</span>が診療中です。
                  <span className="mt-0.5 block text-label2">前の診療を完了にしてから始めますか？</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="filled"
                    className={hit}
                    onClick={() => {
                      setStatus(busy.a.id, "completed");
                      onAsk(false);
                      start();
                    }}
                  >
                    完了にして開始
                  </Button>
                  <Button size="sm" variant="gray" className={hit} onClick={() => onAsk(false)}>
                    やめる
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
