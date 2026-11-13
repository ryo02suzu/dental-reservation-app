import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, ExternalLink } from "lucide-react";
import { clinic, patientById, serviceById, type Service } from "@/data";
import { useStore } from "@/lib/store";
import { useRoute } from "@/lib/nav";
import { TODAY, TODAY_KEY } from "@/lib/clock";
import { duration, fromKey, hm, mdw, relDay, yen } from "@/lib/format";
import { Avatar, Button, IconButton, ListRow, ListSection, Segmented, Sheet, Stepper, Switch, Tag, cn, useToast } from "@/ui";
import { SheetField, SheetGroup, StepperRow, SwitchRow, inputCls, useSaved } from "./parts";
import { patch, setSettings, useSettings, type MenuItem } from "./store";

const CATEGORIES: Service["category"][] = ["予防", "一般", "歯周", "外科", "補綴", "小児", "審美", "相談"];
const CATEGORY_TITLE: Record<Service["category"], string> = {
  予防: "予防・定期検診", 一般: "一般歯科", 歯周: "歯周病", 外科: "口腔外科", 補綴: "被せ物・入れ歯", 小児: "小児歯科", 審美: "審美・ホワイトニング", 相談: "初診・相談",
};
const priceText = (m: MenuItem) => (m.insurance ? "保険" : m.price ? yen(m.price) : "無料");

// ─── 診療メニュー ───────────────────────────────────────────────────────────
export function MenuPage() {
  const { menu } = useSettings();
  const [open, setOpen] = useState<string | null>(null);
  const hidden = menu.filter(m => !m.web).length;
  return (
    <>
      <p className="px-4 pb-1 pt-2 text-[13px] leading-[1.6] text-label2 tnum">
        {menu.length}件のメニュー · Web予約に表示 {menu.length - hidden}件
      </p>
      {CATEGORIES.map(c => {
        const items = menu.filter(m => m.category === c);
        if (!items.length) return null;
        return (
          <ListSection key={c} header={CATEGORY_TITLE[c]}>
            {items.map(m => (
              <ListRow
                key={m.id}
                title={m.name}
                subtitle={
                  <span className="tnum">
                    {duration(m.minutes)} · {m.by === "Dr" ? "歯科医師" : "歯科衛生士"}
                    {!m.web && <span className="text-label3"> · Web予約に表示しない</span>}
                  </span>
                }
                trailing={m.insurance ? <Tag tone="outline">保険</Tag> : <span className="flex items-center gap-1.5"><Tag tone="sand">自費</Tag><span className="text-[14px] text-label2 tnum">{priceText(m)}</span></span>}
                chevron
                onClick={() => setOpen(m.id)}
              />
            ))}
          </ListSection>
        );
      })}
      <MenuSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}

function MenuSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { menu } = useSettings();
  const toast = useToast();
  const [d, setD] = useState<MenuItem | null>(null);
  const [priceStr, setPriceStr] = useState("");
  useEffect(() => {
    const m = menu.find(x => x.id === id);
    if (m) { setD(m); setPriceStr(m.price ? String(m.price) : "0"); }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = () => {
    if (!d) return;
    const price = Number(priceStr.replace(/[^\d]/g, "")) || 0;
    const next: MenuItem = { ...d, name: d.name.trim() || serviceById(d.id).name, price: d.insurance ? undefined : price };
    setSettings(s => ({ ...s, menu: s.menu.map(m => (m.id === next.id ? next : m)) }));
    toast("変更を保存しました", { detail: `${next.name} · ${duration(next.minutes)} · ${priceText(next)}` });
    onClose();
  };
  return (
    <Sheet open={!!id} onOpenChange={o => !o && onClose()} title="メニューを編集" cancelLabel="キャンセル" confirmLabel="完了" onConfirm={done}>
      {d && (
        <>
          <SheetGroup>
            <SheetField label="名前">
              <input value={d.name} onChange={e => setD({ ...d, name: e.target.value })} className={cn(inputCls, "text-right")} />
            </SheetField>
            <ListRow title="所要時間" trailing={<Stepper value={d.minutes} min={15} max={180} step={15} format={duration} onChange={v => setD({ ...d, minutes: v })} />} />
          </SheetGroup>
          <SheetGroup header="区分" footer={d.insurance ? "保険診療は、窓口で負担割合に応じた金額をお預かりします。" : "Web予約のメニュー一覧に「目安の料金」として表示されます。0円にすると「無料」と表示されます。"}>
            <div className="p-2">
              <Segmented full value={d.insurance ? "ins" : "self"} onChange={v => setD({ ...d, insurance: v === "ins" })} options={[{ value: "ins", label: "保険診療" }, { value: "self", label: "自費診療" }]} />
            </div>
            <AnimatePresence initial={false}>
              {!d.insurance && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="hairline-t overflow-hidden">
                  <SheetField label="料金（税込）">
                    <input value={priceStr ? yen(Number(priceStr)) : ""} placeholder="¥0" inputMode="numeric" onChange={e => setPriceStr(e.target.value.replace(/[^\d]/g, "").slice(0, 7))} className={cn(inputCls, "text-right tnum")} />
                  </SheetField>
                </motion.div>
              )}
            </AnimatePresence>
          </SheetGroup>
          <SheetGroup footer={d.web ? "患者さんがWeb予約で選べます。" : "電話・窓口でのみ予約を受けます（治療の続きなど）。"}>
            <ListRow title="Web予約に表示" trailing={<Switch checked={d.web} onChange={v => setD({ ...d, web: v })} label="Web予約に表示" />} />
          </SheetGroup>
          <SheetGroup header="患者さんへの説明" footer="Web予約でメニューを選ぶときに表示されます。">
            <textarea value={d.description} rows={2} onChange={e => setD({ ...d, description: e.target.value })} className="block w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-[1.6] outline-none md:text-[15px]" />
          </SheetGroup>
        </>
      )}
    </Sheet>
  );
}

// ─── Web予約 ────────────────────────────────────────────────────────────────
export function WebPage() {
  const { web } = useSettings();
  const toast = useToast();
  const saved = useSaved();
  const { goApp } = useRoute();
  const off = !web.enabled;
  const url = "arche.jp/r/hidamari-dental";
  return (
    <>
      <ListSection footer={web.enabled ? "患者さんは24時間、空いている時間からご予約できます。" : "予約ページには「現在はお電話でのみ受け付けています」と表示されます。"}>
        <SwitchRow title="Web予約を受け付ける" checked={web.enabled} onChange={v => patch("web", { enabled: v })} />
        <ListRow
          title={<span className="tnum text-label2">{url}</span>}
          trailing={
            <div className="flex gap-1.5">
              <Button size="sm" variant="gray" icon={Copy} onClick={async () => { try { await navigator.clipboard.writeText(`https://${url}`); toast("アドレスをコピーしました", { icon: Copy }); } catch { toast("コピーできませんでした"); } }}>コピー</Button>
              <IconButton size="sm" icon={ExternalLink} label="予約ページを開く" onClick={() => goApp("patient")} />
            </div>
          }
        />
      </ListSection>
      <div className={cn("mt-5 transition-opacity duration-200", off && "pointer-events-none opacity-40")} aria-disabled={off}>
        <ListSection header="受け付ける範囲">
          <StepperRow title="何日先まで" value={web.daysAhead} min={1} max={90} step={1} format={v => `${v}日`} onChange={v => patch("web", { daysAhead: v })} />
          <SwitchRow title="当日の予約" subtitle="空きがあれば、今日の予約も受け付けます" checked={web.sameDay} onChange={v => patch("web", { sameDay: v })} />
          <StepperRow title="締め切り" subtitle="予約時刻の何時間前まで" value={web.cutoffHours} min={1} max={48} step={1} format={v => `${v}時間前`} onChange={v => patch("web", { cutoffHours: v })} />
          <SwitchRow title="初診のWeb予約" subtitle="初めての方も予約できます" checked={web.firstVisit} onChange={v => patch("web", { firstVisit: v })} />
        </ListSection>
        <ListSection
          header="確定の方法"
          footer={web.confirm === "auto" ? "空いている枠なら、その場で予約が確定し、患者さんに確定のお知らせが届きます。" : "Web予約は「仮予約」として届き、医院が承認すると確定します。承認待ちは「今日」と「お知らせ」に表示されます。"}
        >
          <div className="p-2">
            <Segmented full value={web.confirm} onChange={v => { patch("web", { confirm: v }); saved(v === "auto" ? "自動で確定" : "医院が承認"); }} options={[{ value: "auto", label: "自動で確定" }, { value: "manual", label: "医院が承認" }]} />
          </div>
        </ListSection>
        <ListSection header="キャンセル・変更" footer="期限を過ぎると、予約ページに医院の電話番号を表示して、お電話での連絡をお願いします。">
          <StepperRow title="受付の期限" subtitle="予約の何時間前まで" value={web.cancelHours} min={0} max={72} step={6} format={v => (v === 0 ? "直前まで" : `${v}時間前`)} onChange={v => patch("web", { cancelHours: v })} />
        </ListSection>
      </div>
    </>
  );
}

// ─── リマインド通知 ─────────────────────────────────────────────────────────
type Channel = "line" | "sms" | "mail";

export function RemindersPage() {
  const { reminders, line, info } = useSettings();
  const { appointments, patients } = useStore();
  const [ch, setCh] = useState<Channel>("line");
  const lineCount = patients.filter(p => p.line).length;
  // プレビューには、実際に入っている次の予約を使う
  const sample = useMemo(() => {
    const next = appointments.filter(x => x.date > TODAY_KEY && x.status === "confirmed").sort((x, y) => x.date.localeCompare(y.date) || x.start - y.start);
    const a = next.find(x => x.date === next[0].date && x.start >= 600) ?? next[0];
    return { a, p: patientById(a.patientId), s: serviceById(a.serviceId) };
  }, [appointments]);
  const day = fromKey(sample.a.date);
  const timing = reminders.dayBefore ? (relDay(day, TODAY) === "明日" ? "明日" : "") : "本日";
  const when = reminders.dayBefore ? `${mdw(day)} ${hm(sample.a.start)}` : hm(sample.a.start);
  const body = `${sample.p.name}さま\n${info.name}です。${timing ? `${timing} ` : ""}${when}から「${sample.s.name}」のご予約をいただいています。\n変更・キャンセルは下のリンクからお手続きください。お気をつけてお越しください。`;
  const none = !reminders.dayBefore && !reminders.sameDay;
  return (
    <>
      <ListSection header="送るタイミング" footer={none ? "どちらもオフのため、リマインドは送られません。" : "予約の確定・変更のお知らせは、この設定に関係なく送ります。"}>
        <SwitchRow title="前日 18:00" subtitle="翌日に予約がある方へ" checked={reminders.dayBefore} onChange={v => patch("reminders", { dayBefore: v })} />
        <SwitchRow title="当日 2時間前" subtitle="予約の2時間前に送ります" checked={reminders.sameDay} onChange={v => patch("reminders", { sameDay: v })} />
      </ListSection>
      <ListSection header="送る方法" footer="LINEを優先し、LINE連携のない方にはSMS、携帯の番号がない方にはメールで送ります。">
        <SwitchRow title="LINE" subtitle={line.linked ? `連携済みの患者さん ${lineCount}人` : "LINE公式アカウントが未連携です"} checked={reminders.line && line.linked} disabled={!line.linked} onChange={v => patch("reminders", { line: v })} />
        <SwitchRow title="SMS" subtitle="1通 3円（プロプランは月300通まで無料）" checked={reminders.sms} onChange={v => patch("reminders", { sms: v })} />
        <SwitchRow title="メール" checked={reminders.mail} onChange={v => patch("reminders", { mail: v })} />
      </ListSection>

      <ListSection header="メッセージのプレビュー" aside={<Segmented size="sm" value={ch} onChange={setCh} options={[{ value: "line", label: "LINE" }, { value: "sms", label: "SMS" }, { value: "mail", label: "メール" }]} />}>
        <div className="bg-fill/6 px-4 py-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={ch} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }}>
              {ch === "mail" ? (
                <div className="mx-auto max-w-[460px] rounded-[12px] bg-surface p-4 shadow-thumb">
                  <div className="text-[12px] text-label2">差出人：{info.name}</div>
                  <div className="mt-1 text-[15px] font-semibold">{reminders.dayBefore ? "【明日】" : "【本日】"}ご予約のお知らせ</div>
                  <div className="hairline-t mt-3 whitespace-pre-line pt-3 text-[14px] leading-[1.7]">{body}</div>
                  <div className="mt-3 text-[14px] text-accent">予約の確認・変更</div>
                </div>
              ) : (
                <div className="flex items-end gap-2">
                  {ch === "line" && <Avatar name={clinic.name} tone="sand" size={32} />}
                  <div className="max-w-[340px]">
                    {ch === "line" && <div className="mb-1 text-[12px] text-label2">{info.name}</div>}
                    <div className={cn("whitespace-pre-line rounded-[18px] px-3.5 py-2.5 text-[14px] leading-[1.65]", ch === "line" ? "rounded-bl-[6px] bg-surface shadow-thumb" : "rounded-bl-[6px] bg-fill/16")}>
                      {ch === "sms" ? `【${info.name}】${body.split("\n").slice(1).join("\n")}\nhttps://arche.jp/r/hd` : body}
                    </div>
                  </div>
                  <span className="pb-1 text-[11px] text-label3 tnum">{reminders.dayBefore ? "18:00" : hm(Math.max(0, sample.a.start - 120))}</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </ListSection>
      <p className="px-4 pt-1.5 text-footnote text-label2 tnum">次の診療日の実際の予約（{sample.p.name}さん）で表示しています。</p>
    </>
  );
}
