import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, CornerDownRight, Ellipsis, NotebookPen, Pin, PinOff, Plus, SquarePen, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { toothLabel } from "@/lib/format";
import { staff, staffById, type Memo, type Patient } from "@/data";
import { Avatar, Button, ListSection, Menu, MenuItem, MenuSeparator, cn, spring, springSoft, useToast } from "@/ui";
import { DentalChart } from "./DentalChart";
import { ALL_TEETH, memoWhen, type ToothKey } from "./util";
import { JpText } from "./Cautions";

const PAGE = 5;

export interface ComposeRequest {
  n: number;
  teeth: ToothKey[];
}

export const MemoSection = forwardRef<HTMLSpanElement, {
  p: Patient;
  memos: Memo[];
  compose: ComposeRequest | null;
  onCompose: () => void;
  onCloseCompose: () => void;
  onTooth: (k: ToothKey) => void;
}>(function MemoSection({ p, memos, compose, onCompose, onCloseCompose, onTooth }, ref) {
  const { updateMemo, removeMemo } = useStore();
  const toast = useToast();
  const [all, setAll] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const shown = all ? memos : memos.slice(0, PAGE);

  return (
    <ListSection
        header={<span ref={ref} className="scroll-mt-[76px]">診療メモ</span>}
        aside={!compose && memos.length > 0 ? (
          <button type="button" onClick={onCompose} className="-my-1 flex items-center gap-1 rounded-full px-2 py-1 text-footnote font-semibold text-accent transition-colors hover:bg-fill/10">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
            メモを書く
          </button>
        ) : undefined}
      >
        <AnimatePresence initial={false}>
          {compose && (
            <motion.div key={`c${compose.n}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={springSoft} className="overflow-hidden">
              <Composer p={p} initialTeeth={compose.teeth} onDone={onCloseCompose} />
            </motion.div>
          )}
        </AnimatePresence>
        {memos.length === 0 && !compose && (
          <div className="flex flex-col items-start gap-3 px-4 py-4 md:flex-row md:items-center">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">メモはまだありません</div>
              <p className="mt-0.5 text-footnote text-label2">処置の内容や次回の予定を書いておくと、受付・衛生士・歯科医師で共有できます。</p>
            </div>
            <Button variant="tinted" size="sm" icon={SquarePen} onClick={onCompose}>メモを書く</Button>
          </div>
        )}
        <AnimatePresence initial={false}>
          {shown.map(m => (
            <motion.div
              key={m.id}
              layout="position"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={springSoft}
              className="group relative"
            >
              <MemoItem
                m={m}
                onTooth={onTooth}
                onPin={() => {
                  updateMemo(m.id, { pinned: !m.pinned });
                  toast(m.pinned ? "固定を外しました" : "メモを固定しました", { icon: m.pinned ? PinOff : Pin, detail: m.pinned ? undefined : "注意事項の下に表示されます" });
                }}
                onDelete={() => setConfirmId(m.id)}
              />
              <AnimatePresence initial={false}>
                {confirmId === m.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={springSoft} className="overflow-hidden">
                    <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-[10px] bg-red/8 px-3 py-2.5">
                      <span className="min-w-0 flex-1 text-footnote font-medium text-red">このメモを削除しますか？</span>
                      <Button variant="gray" size="sm" onClick={() => setConfirmId(null)}>キャンセル</Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setConfirmId(null);
                          removeMemo(m.id);
                          toast("メモを削除しました", { icon: Trash2 });
                        }}
                      >
                        削除
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-[60px] right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
            </motion.div>
          ))}
        </AnimatePresence>
        {memos.length > PAGE && (
          <button type="button" onClick={() => setAll(v => !v)} className="hairline-t flex h-11 w-full items-center px-4 text-left text-[15px] text-accent transition-colors hover:bg-fill/[0.06] active:bg-fill/12">
            {all ? "少なく表示" : `すべて表示（${memos.length}件）`}
          </button>
        )}
    </ListSection>
  );
});

function MemoItem({ m, onTooth, onPin, onDelete }: { m: Memo; onTooth: (k: ToothKey) => void; onPin: () => void; onDelete: () => void }) {
  const s = staffById(m.staffId);
  return (
    <div className="flex gap-3 px-4 py-3.5">
      <Avatar name={s.name} tone={s.tone} size={32} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[14px] font-semibold">{s.name}</span>
          <span className="truncate text-caption text-label2">{s.role}</span>
          {m.pinned && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-caption font-semibold text-accent">
              <Pin className="h-3 w-3" strokeWidth={2.4} />
              固定
            </span>
          )}
          <span className="ml-auto shrink-0 pl-2 text-caption text-label2 tnum">{memoWhen(m)}</span>
          <Menu
            trigger={
              <button type="button" aria-label="メモの操作" className="-my-1 -mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-label3 transition-colors hover:bg-fill/10 hover:text-label2 data-[state=open]:bg-fill/12">
                <Ellipsis className="h-[18px] w-[18px]" strokeWidth={2.2} />
              </button>
            }
          >
            <MenuItem icon={m.pinned ? PinOff : Pin} onSelect={onPin}>{m.pinned ? "固定を外す" : "上に固定する"}</MenuItem>
            <MenuSeparator />
            <MenuItem icon={Trash2} destructive onSelect={onDelete}>削除</MenuItem>
          </Menu>
        </div>
        {m.pinned ? (
          // 固定したメモは上の注意事項に全文が出ているので、ここでは1行にたたむ
          <p className="mt-1 truncate text-[15px] leading-[1.65] text-label2">
            <span className="mr-1.5 text-footnote font-medium text-label3">注意事項に表示中</span>
            {m.body}
          </p>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-[1.65] text-label [word-break:auto-phrase]"><JpText text={m.body} /></p>
        )}
        {(m.teeth?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.teeth!.map(k => (
              <button
                key={k}
                type="button"
                onClick={() => onTooth(k)}
                className="rounded-[6px] bg-fill/12 px-1.5 py-[3px] text-[11px] font-semibold leading-none text-label2 transition-colors hover:bg-fill/18 hover:text-label"
                title="歯式で見る"
              >
                {toothLabel(k)}
              </button>
            ))}
          </div>
        )}
        {m.next && (
          <div className="mt-2 flex items-start gap-1.5 text-footnote text-label2">
            <CornerDownRight className="mt-[2px] h-3.5 w-3.5 shrink-0 text-label3" strokeWidth={2.2} />
            <span>
              <span className="font-medium text-label">次回</span>　{m.next}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 入力欄 ───────────────────────────────────────────────────────────────
function Composer({ p, initialTeeth, onDone }: { p: Patient; initialTeeth: ToothKey[]; onDone: () => void }) {
  const { addMemo, currentStaffId } = useStore();
  const toast = useToast();
  // 書く人の初期値はログイン中のスタッフ
  const [staffId, setStaffId] = useState(currentStaffId);
  const [body, setBody] = useState("");
  const [next, setNext] = useState("");
  const [teeth, setTeeth] = useState<ToothKey[]>(initialTeeth);
  const [picking, setPicking] = useState(initialTeeth.length > 0);
  const area = useRef<HTMLTextAreaElement>(null);
  const who = staffById(staffId);
  const picks = useMemo(() => new Set(teeth), [teeth]);

  useEffect(() => {
    const t = setTimeout(() => area.current?.focus({ preventScroll: true }), 260);
    return () => clearTimeout(t);
  }, []);

  const toggle = (k: ToothKey) => setTeeth(t => (t.includes(k) ? t.filter(x => x !== k) : [...t, k].sort((a, b) => ALL_TEETH.indexOf(a) - ALL_TEETH.indexOf(b))));
  const save = () => {
    const text = body.trim();
    if (!text) return;
    addMemo({ patientId: p.id, staffId, body: text, teeth: teeth.length ? teeth : undefined, next: next.trim() || undefined });
    toast("メモを保存しました", { icon: NotebookPen, detail: `${p.name}さん${teeth.length ? `・${teeth.map(toothLabel).join("、")}` : ""}` });
    onDone();
  };

  return (
    <div className="hairline-b bg-surface px-4 pb-4 pt-3.5">
      <div className="flex items-center gap-2">
        <span className="text-footnote text-label2">記入</span>
        <Menu
          align="start"
          trigger={
            <button type="button" className="-ml-1 flex h-8 items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[14px] font-medium transition-colors hover:bg-fill/10 data-[state=open]:bg-fill/12">
              <Avatar name={who.name} tone={who.tone} size={24} />
              {who.name}
              <span className="text-caption font-normal text-label2">{who.role}</span>
              <ChevronDown className="h-3.5 w-3.5 text-label3" strokeWidth={2.4} />
            </button>
          }
        >
          {staff.map(s => (
            <MenuItem key={s.id} icon={s.id === staffId ? Check : undefined} onSelect={() => setStaffId(s.id)}>
              {s.name}　<span className="text-label2">{s.role}</span>
            </MenuItem>
          ))}
        </Menu>
      </div>
      <textarea
        ref={area}
        value={body}
        onChange={e => setBody(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save(); }}
        rows={3}
        placeholder="処置の内容や申し送りを入力"
        className="mt-2.5 block w-full resize-none rounded-[10px] bg-fill/8 px-3 py-2.5 text-[16px] leading-[1.6] outline-none placeholder:text-label3 focus:bg-fill/6 md:text-[15px]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-footnote text-label2">歯</span>
        {teeth.map(k => (
          <button key={k} type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 rounded-[6px] bg-sand/30 py-[3px] pl-1.5 pr-1 text-[12px] font-semibold text-label transition-colors hover:bg-sand/45" aria-label={`${toothLabel(k)}を外す`}>
            {toothLabel(k)}
            <X className="h-3 w-3 text-label2" strokeWidth={2.6} />
          </button>
        ))}
        <button type="button" onClick={() => setPicking(v => !v)} className={cn("inline-flex items-center gap-1 rounded-[6px] px-1.5 py-[3px] text-[12px] font-semibold transition-colors", picking ? "bg-fill/16 text-label" : "text-accent hover:bg-fill/10")}>
          {picking ? "閉じる" : teeth.length ? "歯を追加" : "歯を選ぶ"}
        </button>
      </div>
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={springSoft} className="overflow-hidden">
            <div className="mt-3 rounded-[10px] bg-fill/6 px-2 py-2.5">
              <DentalChart teeth={p.teeth} picks={picks} onSelect={toggle} maxCell={26} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <label className="mt-3 flex items-center gap-3">
        <span className="shrink-0 text-footnote text-label2">次回</span>
        <input
          value={next}
          onChange={e => setNext(e.target.value)}
          placeholder="例：左下5番 CR・30分（なければ空欄）"
          className="h-9 min-w-0 flex-1 rounded-[9px] bg-fill/8 px-3 text-[16px] outline-none placeholder:text-label3 md:text-[14px]"
        />
      </label>
      <div className="mt-4 flex items-center justify-end gap-2">
        <span className="mr-auto hidden text-caption text-label3 md:inline">⌘↩︎ で保存</span>
        <Button variant="gray" size="sm" onClick={onDone}>キャンセル</Button>
        <motion.div layout transition={spring}>
          <Button size="sm" disabled={!body.trim()} onClick={save}>保存</Button>
        </motion.div>
      </div>
    </div>
  );
}
