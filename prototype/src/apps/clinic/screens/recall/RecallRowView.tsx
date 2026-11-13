import { forwardRef } from "react";
import { motion } from "framer-motion";
import {
  CalendarPlus, Check, Ellipsis, ExternalLink, Mail, MessageCircle, MessageSquareText, Pause, Phone, RotateCcw, Send, Undo2, UserRound,
} from "lucide-react";
import { fromKey, hm, md, mdw } from "@/lib/format";
import type { RecallItem } from "@/data";
import { Avatar, Button, IconButton, Menu, MenuItem, MenuSeparator, cn, springSoft } from "@/ui";
import { dueLabel, type RecallRow } from "./model";
import type { LucideIcon } from "lucide-react";

export const CHANNEL_ICON: Record<RecallItem["channel"], LucideIcon> = { LINE: MessageCircle, SMS: MessageSquareText, メール: Mail, 電話: Phone };

export interface RowActions {
  send: (x: RecallRow) => void;
  resend: (x: RecallRow) => void;
  calledAgain: (x: RecallRow) => void;
  called: (x: RecallRow) => void;
  hold: (x: RecallRow) => void;
  restore: (x: RecallRow) => void;
  book: (x: RecallRow) => void;
  openAppt: (x: RecallRow) => void;
  openPatient: (x: RecallRow) => void;
}

/** PCの表の列（見出しと行で共通） */
export const TABLE_COLS = "grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,0.85fr)_3.5rem_minmax(0,1.2fr)_13rem]";

/** リコール1人分の行。phone=縦積み、table=PCの表 */
export const RecallRowView = forwardRef<HTMLDivElement, {
  x: RecallRow;
  table: boolean;
  selecting: boolean;
  checked: boolean;
  onToggle: () => void;
  act: RowActions;
}>(function RecallRowView({ x, table, selecting, checked, onToggle, act }, ref) {
  const { r, p } = x;
  const due = dueLabel(x);
  // 期限切れは赤にしない（「いま注意が必要」ではない）。超過の日数だけ太くして目に留まるようにする
  const dueNode = (
    <>
      {due.date}
      <span className={cn(due.overdue && r.status === "未連絡" ? "font-semibold text-label" : "text-label2")}>・{due.rest}</span>
    </>
  );
  const Ch = CHANNEL_ICON[r.channel];
  const lastText = md(x.lastCheckup);
  const sentText = r.sentAt ? `${md(r.sentAt)}に${r.channel === "電話" ? "連絡" : "送信"}` : undefined;
  const bookedText = x.booked ? `${mdw(fromKey(x.booked.date))} ${hm(x.booked.start)}` : undefined;
  const onRow = selecting ? onToggle : r.status === "予約済み" && x.booked ? () => act.openAppt(x) : () => act.openPatient(x);

  const ic = table;
  const primary = selecting ? null : r.status === "未連絡" ? (
    r.channel === "電話"
      ? <Button variant="tinted" size="sm" icon={ic ? Phone : undefined} onClick={() => act.called(x)}>電話した</Button>
      : <Button variant="tinted" size="sm" icon={ic ? Send : undefined} onClick={() => act.send(x)}>送る</Button>
  ) : r.status === "送信済み" ? (
    r.channel === "電話"
      ? <Button variant="gray" size="sm" icon={ic ? Phone : undefined} onClick={() => act.calledAgain(x)}>電話した</Button>
      : <Button variant="gray" size="sm" icon={ic ? RotateCcw : undefined} onClick={() => act.resend(x)}>再送</Button>
  ) : r.status === "保留" ? (
    <Button variant="gray" size="sm" icon={ic ? Undo2 : undefined} onClick={() => act.restore(x)}>戻す</Button>
  ) : table && x.booked ? (
    <Button variant="plain" size="sm" icon={ExternalLink} onClick={() => act.openAppt(x)}>予約を開く</Button>
  ) : null;

  const menu = selecting ? null : (
    <Menu trigger={<IconButton icon={Ellipsis} label="ほかの操作" variant="plain" size="sm" className="text-label2" />}>
      {r.status === "予約済み" && x.booked
        ? <MenuItem icon={ExternalLink} onSelect={() => act.openAppt(x)}>予約を開く</MenuItem>
        : <MenuItem icon={CalendarPlus} onSelect={() => act.book(x)}>予約を取る</MenuItem>}
      <MenuItem icon={UserRound} onSelect={() => act.openPatient(x)}>患者の詳細</MenuItem>
      {(r.status === "未連絡" || r.status === "送信済み") && (
        <>
          <MenuSeparator />
          {r.channel !== "電話" && <MenuItem icon={Phone} onSelect={() => act.called(x)}>電話した</MenuItem>}
          {r.status === "送信済み" && <MenuItem icon={Undo2} onSelect={() => act.restore(x)}>未連絡に戻す</MenuItem>}
          <MenuItem icon={Pause} onSelect={() => act.hold(x)}>保留にする</MenuItem>
        </>
      )}
    </Menu>
  );

  const check = (
    <motion.span
      initial={false}
      animate={{ width: selecting ? 22 : 0, marginRight: selecting ? 0 : -12, opacity: selecting ? 1 : 0 }}
      transition={springSoft}
      className="flex shrink-0 items-center overflow-hidden"
      aria-hidden
    >
      <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors", checked ? "bg-accent text-surface" : "shadow-[inset_0_0_0_1.5px_rgb(var(--label-3))]")}>
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3.2} />}
      </span>
    </motion.span>
  );

  const identity = (
    <>
      {check}
      <Avatar name={p.name} size={table ? 32 : 40} />
      <div className="min-w-0 flex-1">
        <div className={cn("truncate font-medium text-label", table ? "text-[14px] leading-5" : "text-[16px] leading-[21px]")}>{p.name}</div>
        {table ? (
          <div className="truncate text-[12px] leading-4 text-label3">{p.kana}</div>
        ) : (
          <>
            <div className={cn("mt-0.5 truncate text-[13px] leading-[18px] tnum", "text-label")}>
              {r.status === "予約済み" ? (bookedText ? `予約 ${bookedText}` : "予約済み") : <>期限 {dueNode}</>}
            </div>
            <div className="mt-px flex min-w-0 items-center gap-1 truncate text-[12px] leading-4 text-label3 tnum">
              <Ch className="h-3 w-3 shrink-0" strokeWidth={2.2} />
              <span className="truncate">
                {r.channel}
                {r.status === "予約済み" || r.status === "送信済み" ? (sentText ? `・${sentText}` : "") : `・前回 ${lastText}`}
              </span>
            </div>
          </>
        )}
      </div>
    </>
  );

  const body = table ? (
    <div className={cn("grid min-h-[56px] items-center gap-x-4 py-2 pl-4 pr-3", TABLE_COLS)}>
      <div className="flex min-w-0 items-center gap-3">{identity}</div>
      <div className="truncate text-[14px] tnum text-label">
        {r.status === "予約済み" ? bookedText ?? "予約済み" : dueNode}
        {r.status === "予約済み" && <div className="truncate text-[12px] text-label3">期限 {md(r.due)}</div>}
      </div>
      <div className="truncate text-[14px] text-label2 tnum">{lastText}</div>
      <div className="text-[14px] text-label2 tnum">{p.recallMonths}か月</div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-[14px] text-label2">
          <Ch className="h-[15px] w-[15px] shrink-0 text-label3" strokeWidth={2} />
          <span className="truncate">{r.channel}</span>
        </div>
        {sentText && <div className="truncate pl-[21px] text-[12px] text-label3 tnum">{sentText}</div>}
      </div>
      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
        {primary}
        {!selecting && r.status !== "予約済み" && (
          <Button variant="plain" size="sm" onClick={() => act.book(x)} className="!text-label2 hover:!text-accent">予約を取る</Button>
        )}
        {menu}
      </div>
    </div>
  ) : (
    <div className="flex min-h-[76px] items-center gap-3 py-3 pl-4 pr-2">
      {identity}
      <div className="flex shrink-0 items-center gap-0.5" onClick={e => e.stopPropagation()}>
        {primary}
        {menu}
      </div>
    </div>
  );

  return (
    <motion.div
      ref={ref}
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0, transition: { ...springSoft, opacity: { duration: 0.12 } } }}
      transition={springSoft}
      onClick={onRow}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRow(); } }}
      aria-pressed={selecting ? checked : undefined}
      className={cn(
        "group relative cursor-default overflow-hidden text-left outline-none transition-colors duration-100",
        selecting && checked ? "bg-sand/14" : "hover:bg-fill/[0.05] active:bg-fill/12",
      )}
    >
      {body}
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 transition-[left] duration-200 group-last:hidden" style={{ left: (table ? 60 : 68) + (selecting ? 34 : 0) }} />
    </motion.div>
  );
});
