import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Copy, MessageCircle, Plus, UserPlus } from "lucide-react";
import { PLANS, addons, staff as staffList, staffById } from "@/data";
import { useStore } from "@/lib/store";
import { useRoute } from "@/lib/nav";
import { md, yen } from "@/lib/format";
import { TODAY } from "@/lib/clock";
import { addMonths } from "date-fns";
import { Avatar, Button, IconTile, ListRow, ListSection, Segmented, Sheet, Switch, Tag, cn, useToast } from "@/ui";
import { SheetField, SheetGroup, SwitchRow, TextRow, inputCls, useSaved } from "./parts";
import { patch, setSettings, useSettings, type Perm } from "./store";

const copy = async (text: string, toast: ReturnType<typeof useToast>, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${what}をコピーしました`, { icon: Copy, detail: text });
  } catch {
    toast("コピーできませんでした", { detail: "長押しで選択してコピーしてください" });
  }
};

// ─── 医院の情報 ─────────────────────────────────────────────────────────────
export function InfoPage() {
  const { info } = useSettings();
  const toast = useToast();
  const url = "arche.jp/r/hidamari-dental";
  return (
    <>
      <ListSection header="基本情報" footer="患者さんのWeb予約ページと、リマインドのメッセージに表示されます。">
        <TextRow label="医院名" value={info.name} onCommit={v => patch("info", { name: v })} />
        <TextRow label="院長" value={info.director} onCommit={v => patch("info", { director: v })} />
        <TextRow label="電話番号" value={info.phone} inputMode="tel" onCommit={v => patch("info", { phone: v })} />
      </ListSection>
      <ListSection header="所在地">
        <TextRow label="住所" value={info.address} onCommit={v => patch("info", { address: v })} />
        <TextRow label="アクセス" value={info.access} onCommit={v => patch("info", { access: v })} />
        <TextRow label="駐車場" value={info.parking} onCommit={v => patch("info", { parking: v })} />
      </ListSection>
      <ListSection header="Web予約ページ" footer="ホームページやGoogleマップの「予約」ボタンに、このアドレスを設定してください。">
        <ListRow
          title={<span className="tnum">{url}</span>}
          trailing={<Button size="sm" variant="gray" icon={Copy} onClick={() => copy(`https://${url}`, toast, "アドレス")}>コピー</Button>}
        />
      </ListSection>
    </>
  );
}

// ─── ユニット ───────────────────────────────────────────────────────────────
export function UnitsPage() {
  const { units } = useSettings();
  return (
    <ListSection header="ユニット（診療台）" footer="名前は予約台帳の列の見出しと、今日の画面に表示されます。ユニット1・2は歯科医師、3・4は歯科衛生士が主に使います。">
      {units.map((u, i) => (
        <TextRow
          key={u.id}
          label={u.short}
          value={u.name}
          hint={<span className="shrink-0 text-[13px] text-label3">{i < 2 ? "歯科医師" : "歯科衛生士"}</span>}
          onCommit={v => setSettings(s => ({ ...s, units: s.units.map(x => (x.id === u.id ? { ...x, name: v } : x)) }))}
        />
      ))}
    </ListSection>
  );
}

// ─── スタッフとアカウント ───────────────────────────────────────────────────
export function StaffPage() {
  const st = useSettings();
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("歯科衛生士");
  const [error, setError] = useState("");
  const row = st.staff.find(x => x.id === open);
  const s = open ? staffById(open) : null;
  const sendInvite = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) { setError("メールアドレスの形式で入力してください（例：name@example.jp）"); return; }
    setSettings(x => ({ ...x, invited: [...x.invited, { email: email.trim(), role }] }));
    toast("招待メールを送りました", { detail: email.trim() });
    setInvite(false); setEmail(""); setError("");
  };
  return (
    <>
      <ListSection header={`スタッフ ${staffList.length + st.invited.length}人`} footer="管理者は、設定・レポート・スタッフの管理ができます。">
        {st.staff.map(x => {
          const p = staffById(x.id);
          return (
            <ListRow
              key={x.id}
              leading={<Avatar name={p.name} tone={p.tone} size={36} />}
              inset={64}
              title={p.name}
              subtitle={p.role}
              value={x.perm === "管理者" ? "管理者" : undefined}
              chevron
              onClick={() => setOpen(x.id)}
            />
          );
        })}
        <AnimatePresence initial={false}>
          {st.invited.map(x => (
            <motion.div key={x.email} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="relative overflow-hidden">
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />
              <ListRow leading={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-fill/12 text-label3"><UserPlus className="h-[18px] w-[18px]" /></span>} inset={64} title={x.email} subtitle={`${x.role} · 招待中`} />
            </motion.div>
          ))}
        </AnimatePresence>
      </ListSection>
      <ListSection>
        <ListRow title={<span className="flex items-center gap-2 text-accent"><Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />スタッフを招待</span>} onClick={() => setInvite(true)} />
      </ListSection>

      <Sheet open={!!open} onOpenChange={o => !o && setOpen(null)} title="スタッフ" cancelLabel="閉じる">
        {row && s && (
          <>
            <div className="flex flex-col items-center pb-2 pt-3">
              <Avatar name={s.name} tone={s.tone} size={64} />
              <div className="mt-2 text-[20px] font-semibold">{s.name}</div>
              <div className="text-[14px] text-label2">{s.role} · {row.email}</div>
            </div>
            <SheetGroup header="権限" footer={row.perm === "管理者" ? "設定・レポート・スタッフの管理ができます。" : "予約・患者・今日の画面を使えます。設定は変更できません。"}>
              <div className="p-2">
                <Segmented<Perm>
                  full
                  value={row.perm}
                  onChange={v => { setSettings(x => ({ ...x, staff: x.staff.map(y => (y.id === row.id ? { ...y, perm: v } : y)) })); toast("変更を保存しました", { detail: `${s.name}：${v}` }); }}
                  options={[{ value: "管理者", label: "管理者" }, { value: "スタッフ", label: "スタッフ" }]}
                />
              </div>
            </SheetGroup>
            <SheetGroup footer="オンにすると、予約台帳とWeb予約で担当者として選べます。">
              <ListRow
                title="予約の担当者にする"
                trailing={<Switch checked={row.bookable} onChange={v => { setSettings(x => ({ ...x, staff: x.staff.map(y => (y.id === row.id ? { ...y, bookable: v } : y)) })); toast("変更を保存しました"); }} />}
              />
            </SheetGroup>
          </>
        )}
      </Sheet>

      <Sheet open={invite} onOpenChange={setInvite} title="スタッフを招待" cancelLabel="キャンセル" confirmLabel="送信" onConfirm={sendInvite} confirmDisabled={!email.trim()}>
        <SheetGroup footer={error ? <span className="text-red">{error}</span> : "招待メールのリンクから、パスワードを設定してログインします。"}>
          <SheetField label="メール">
            <input value={email} onChange={e => { setEmail(e.target.value); setError(""); }} inputMode="email" placeholder="name@example.jp" className={cn(inputCls, "text-right")} autoFocus />
          </SheetField>
          <SheetField label="職種">
            <span className="relative flex items-center text-label2">
              <select value={role} onChange={e => setRole(e.target.value)} className="appearance-none bg-transparent py-3 pr-5 text-right text-[16px] outline-none md:text-[15px]">
                {["歯科医師", "歯科衛生士", "歯科助手", "受付"].map(r => <option key={r}>{r}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4" />
            </span>
          </SheetField>
        </SheetGroup>
      </Sheet>
    </>
  );
}

// ─── LINE公式アカウント ─────────────────────────────────────────────────────
export function LinePage() {
  const { line } = useSettings();
  const { patients } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const linkedPatients = patients.filter(p => p.line).length;
  return (
    <>
      <section className="mt-2 rounded-cell bg-surface p-4">
        <div className="flex items-center gap-3">
          <IconTile icon={MessageCircle} tone="sage" size={44} />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">LINE公式アカウント</div>
            <div className="text-[14px] text-label2">{line.linked ? "@hidamari-dental" : "まだ連携していません"}</div>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={String(line.linked)} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              {line.linked ? <Tag tone="sand" icon={Check}>連携済み</Tag> : <Tag tone="outline">未連携</Tag>}
            </motion.span>
          </AnimatePresence>
        </div>
        {line.linked ? (
          <div className="mt-4 grid grid-cols-2 rounded-[10px] bg-fill/6 py-3 tnum">
            <div className="px-4"><div className="text-[12px] text-label2">友だち</div><div className="mt-0.5 text-[20px] font-semibold">1,284<span className="ml-0.5 text-[13px] font-medium text-label2">人</span></div></div>
            <div className="hairline-l px-4"><div className="text-[12px] text-label2">患者さんと連携</div><div className="mt-0.5 text-[20px] font-semibold">{linkedPatients}<span className="ml-0.5 text-[13px] font-medium text-label2">人</span></div></div>
          </div>
        ) : (
          <Button className="mt-4" full variant="filled" onClick={() => { patch("line", { linked: true }); toast("LINE公式アカウントと連携しました", { detail: "@hidamari-dental" }); }}>LINE公式アカウントと連携</Button>
        )}
      </section>
      <div className={cn("mt-5 transition-opacity", !line.linked && "pointer-events-none opacity-40")}>
        <ListSection header="LINEでできること" footer="患者さんが診察券番号で連携すると、予約の確認・変更とお知らせの受け取りがLINEでできるようになります。">
          <SwitchRow title="LINEから予約を受け付ける" checked={line.booking} onChange={v => patch("line", { booking: v })} />
          <SwitchRow title="リマインドをLINEで送る" checked={line.remind} onChange={v => patch("line", { remind: v })} />
          <SwitchRow title="リコールのご案内をLINEで送る" checked={line.recall} onChange={v => patch("line", { recall: v })} />
        </ListSection>
      </div>
      {line.linked && (
        <ListSection>
          <ListRow title="連携を解除" destructive onClick={() => setConfirm(true)} />
        </ListSection>
      )}
      <Sheet open={confirm} onOpenChange={setConfirm} title="連携を解除" cancelLabel="キャンセル">
        <p className="px-1 pt-2 text-[15px] leading-[1.7] text-label2">解除すると、LINEでのリマインド・リコールのご案内・予約の受付が止まります。リマインドはSMSとメールで届きます。</p>
        <div className="mt-5 space-y-2.5">
          <Button size="lg" variant="destructive" full onClick={() => { patch("line", { linked: false }); setConfirm(false); toast("LINE連携を解除しました"); }}>連携を解除する</Button>
        </div>
      </Sheet>
    </>
  );
}

// ─── プランとお支払い ───────────────────────────────────────────────────────
export function PlanPage() {
  const { plan } = useSettings();
  const toast = useToast();
  const saved = useSaved();
  const [choose, setChoose] = useState(false);
  const base = PLANS[plan.key].price ?? 0;
  const opts = addons.filter(a => plan.addons[a.key]).reduce((a, x) => a + x.price, 0);
  const next = addMonths(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), 1);
  const past = [1, 2, 3].map(i => addMonths(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), -i));
  return (
    <>
      <section className="mt-2 rounded-cell bg-surface p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[13px] font-medium text-label2">現在のプラン</div>
            <div className="mt-1 text-[28px] font-bold leading-8 palt">{PLANS[plan.key].label}</div>
          </div>
          <Button size="sm" variant="gray" onClick={() => setChoose(true)}>プランを変更</Button>
        </div>
        <div className="mt-4 space-y-1.5 text-[14px] tnum">
          <div className="flex justify-between"><span className="text-label2">基本料金</span><span>{PLANS[plan.key].price === null ? "個別見積もり" : `${yen(base)}/月`}</span></div>
          <div className="flex justify-between"><span className="text-label2">オプション</span><span>{yen(opts)}/月</span></div>
          <div className="hairline-t flex justify-between pt-2 text-[16px] font-semibold"><span>月額の合計（税別）</span><span>{yen(base + opts)}</span></div>
        </div>
      </section>
      <ListSection header="オプション" footer="変更は次回の請求から反映されます。">
        {addons.map(a => (
          <ListRow
            key={a.key}
            title={a.name}
            subtitle={`${a.description} · ${yen(a.price)}/月`}
            trailing={<Switch checked={!!plan.addons[a.key]} onChange={v => { setSettings(s => ({ ...s, plan: { ...s.plan, addons: { ...s.plan.addons, [a.key]: v } } })); saved(v ? `${a.name}を追加` : `${a.name}を停止`); }} label={a.name} />}
          />
        ))}
      </ListSection>
      <ListSection header="お支払い">
        <ListRow title="お支払い方法" value="VISA 末尾 4242" />
        <ListRow title="次回のお支払い" value={<span className="tnum">{md(next)} · {yen(base + opts)}</span>} />
      </ListSection>
      <ListSection header="請求の履歴">
        {past.map(d => (
          <ListRow key={d.getTime()} title={`${d.getMonth() + 1}月分`} subtitle={`${md(addMonths(d, 1))} お支払い済み`} value={<span className="tnum">{yen(19800 + 1980 * 3)}</span>} />
        ))}
      </ListSection>
      <Sheet open={choose} onOpenChange={setChoose} title="プランを変更">
        <SheetGroup footer="プランの変更は翌月1日から反映されます。">
          {(["standard", "pro", "enterprise"] as const).map(k => (
            <ListRow
              key={k}
              title={PLANS[k].label}
              subtitle={PLANS[k].price === null ? "ユニット10台以上・分院の管理" : k === "pro" ? "レポート・シフト・リコールの自動送信" : "予約台帳・Web予約・リマインド"}
              value={PLANS[k].price === null ? "お見積もり" : `${yen(PLANS[k].price!)}/月`}
              trailing={<Check className={cn("h-5 w-5 text-accent", plan.key !== k && "invisible")} strokeWidth={2.6} />}
              onClick={() => { setSettings(s => ({ ...s, plan: { ...s.plan, key: k } })); setChoose(false); toast("プランを変更しました", { detail: `${PLANS[k].label}（翌月1日から）` }); }}
            />
          ))}
        </SheetGroup>
      </Sheet>
    </>
  );
}

// ─── ヘルプ ─────────────────────────────────────────────────────────────────
const FAQ: [string, string][] = [
  ["Web予約を「仮予約」で受けるには", "設定 →「Web予約」→「確定の方法」で「医院が承認」を選びます。届いた予約は「今日」と「お知らせ」に承認待ちとして表示されます。"],
  ["休診日を臨時で追加するには", "設定 →「休診日」→「臨時休診日を追加」から日付を選びます。その日はWeb予約で選べなくなります。"],
  ["リマインドが届かない患者さんがいる", "LINE連携がなく、電話番号が携帯でない方にはSMSが届きません。患者の詳細でメールアドレスを登録してください。"],
  ["スタッフが退職したとき", "設定 →「スタッフとアカウント」でスタッフを選び、権限を外してください。過去の予約の担当者の記録は残ります。"],
  ["予約台帳の印刷", "予約台帳の右上のメニューから、日ごとの一覧をPDFで書き出せます。"],
];
export function HelpPage() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <>
      <ListSection header="よくある質問">
        {FAQ.map(([q, a], i) => (
          <div key={q} className="relative">
            <button onClick={() => setOpen(open === i ? null : i)} className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left hover:bg-fill/[0.06] md:min-h-[44px]" aria-expanded={open === i}>
              <span className="flex-1 text-[16px] md:text-[15px]">{q}</span>
              <ChevronDown className={cn("h-[18px] w-[18px] shrink-0 text-label3 transition-transform duration-200", open === i && "rotate-180")} strokeWidth={2.4} />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden px-4 text-[14px] leading-[1.7] text-label2">
                  <span className="block pb-3.5">{a}</span>
                </motion.p>
              )}
            </AnimatePresence>
            {i < FAQ.length - 1 && <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />}
          </div>
        ))}
      </ListSection>
      <ListSection header="Arche サポート" footer="電話番号はリンクになっていません。お手元の電話からおかけください。">
        <ListRow title="電話" value={<span className="tnum">0120-555-018</span>} />
        <ListRow title="受付時間" value="平日 10:00〜18:00" />
        <ListRow title="メール" value="support@arche.jp" />
      </ListSection>
    </>
  );
}

// ─── アカウント（その他タブの名前から） ────────────────────────────────────
export function AccountPage() {
  const { account } = useSettings();
  const { goApp } = useRoute();
  const toast = useToast();
  const me = staffById("s6");
  return (
    <>
      <section className="mt-2 flex flex-col items-center rounded-cell bg-surface px-4 py-6">
        <Avatar name={me.name} tone={me.tone} size={72} />
        <div className="mt-3 text-[22px] font-bold palt">{me.name}</div>
        <div className="text-[14px] text-label2">{me.role} · 管理者</div>
      </section>
      <ListSection header="ログイン">
        <ListRow title="メールアドレス" value="ishii@hidamari-dental.jp" />
        <ListRow title="パスワードを変更" chevron onClick={() => toast("再設定のメールを送りました", { detail: "ishii@hidamari-dental.jp" })} />
        <SwitchRow title="2段階認証" subtitle="ログインのときにSMSで確認コードを送ります" checked={account.twoFactor} onChange={v => patch("account", { twoFactor: v })} />
      </ListSection>
      <ListSection header="自分への通知">
        <SwitchRow title="Web予約が入ったとき" checked={account.notifyWeb} onChange={v => patch("account", { notifyWeb: v })} />
        <SwitchRow title="キャンセルがあったとき" checked={account.notifyCancel} onChange={v => patch("account", { notifyCancel: v })} />
      </ListSection>
      <ListSection>
        <ListRow title="ログアウト" destructive onClick={() => goApp("login")} />
      </ListSection>
    </>
  );
}
