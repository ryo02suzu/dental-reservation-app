// 医院1件の詳細。PCでは右のインスペクタ、iPhone（と狭いPC）では横から積み重なる詳細画面の中身。
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Building2, Check, CircleAlert, CirclePause, Send, TrendingUp, X } from "lucide-react";
import type { ConsoleClinic } from "@/data";
import { useNow } from "@/lib/clock";
import { md, mdw, yen } from "@/lib/format";
import { useRoute } from "@/lib/nav";
import { Button, EmptyState, IconButton, ListRow, ListSection, Ring, Switch, cn, springBouncy, useToast } from "@/ui";
import {
  SETUP_ITEMS, addonOf, addonsTotal, clinicMRR, daysSince, isDormant, isGrowingFree, pct, planLabel, planPrice,
  recentOf, setupDone, setupMissing, suspendedAt, weeksOf, when, ymd, PLAN_STYLE,
} from "./model";
import { sendCheckin, sendGuide, setActive, setClinicAddon, setMemo, useConsole } from "./store";
import { WeekBars } from "./charts";
import { PlanSheet } from "./PlanSheet";
import { ProposalSheet } from "./ProposalSheet";
import { ClinicMark, ConfirmSheet, PlanTag, SheetGroup, StateText } from "./ui";

export function ClinicDetail({ id, variant, onClose }: { id: string; variant: "inspector" | "page"; onClose?: () => void }) {
  const s = useConsole();
  const c = s.clinics.find(x => x.id === id);
  const { route, setSheet, goApp } = useRoute();
  const toast = useToast();
  const t = useNow(30_000);
  const [proposing, setProposing] = useState(false);
  const [cancelAddon, setCancelAddon] = useState<string | null>(null);
  const [contract, setContract] = useState(false);
  if (!c) {
    return <EmptyState icon={Building2} title="医院が見つかりません" message="一覧から選び直してください。" />;
  }
  const inspector = variant === "inspector";
  const done = setupDone(c);
  const missing = setupMissing(c);
  const weeks = weeksOf(c);
  const { last4, prev4 } = recentOf(c);
  const extra = addonsTotal(s, c);
  const guide = s.guides[c.id];
  const checkin = s.checkins[c.id];
  const proposal = s.proposals[c.id];
  const dormant = isDormant(c);
  const growing = isGrowingFree(c);
  const isNew = daysSince(c.createdAt) < 56;

  // 追加はその場で。解約は請求が変わるので、確認のシートを出してから
  const toggleAddon = (key: string, on: boolean) => {
    const a = addonOf(s, key);
    if (!a) return;
    if (!on) return setCancelAddon(key);
    setClinicAddon(c.id, key, true);
    toast(`${a.name}を追加しました`, { detail: `${c.name} · ${yen(a.price)} / 月` });
  };
  const cancelling = cancelAddon ? addonOf(s, cancelAddon) : undefined;
  const confirmCancel = () => {
    if (!cancelling) return;
    setClinicAddon(c.id, cancelling.key, false);
    toast(`${cancelling.name}を解約しました`, { detail: c.name });
    setCancelAddon(null);
  };
  const monthly = planPrice(c.plan) + extra;
  const confirmContract = () => {
    setActive(c.id, !c.active);
    toast(c.active ? "利用を停止しました" : "利用を再開しました", { detail: c.active ? (monthly ? `${c.name} · 請求を止めました` : c.name) : monthly ? `${c.name} · ${yen(monthly)} / 月` : c.name });
    setContract(false);
  };
  const stoppedAt = c.active ? undefined : suspendedAt(s, c.id);
  const checkinSend = () => {
    sendCheckin(c.id);
    toast("利用状況の確認メールを送りました", { detail: `${c.name} · 院長あて` });
  };
  const guideSend = () => {
    sendGuide(c.id);
    toast("初期設定の案内を送りました", { detail: `${c.name} · ${missing.map(m => m.label).join("・")}` });
  };

  return (
    <div className={cn(inspector ? "pb-6" : "")}>
      {/* 見出し */}
      <div className={cn("flex items-start", inspector ? "gap-3" : "gap-4")}>
        <ClinicMark name={c.name} size={inspector ? 44 : 56} />
        <div className="min-w-0 flex-1">
          <h2 className={cn("palt", inspector ? "text-[17px] font-semibold leading-[22px]" : "text-title2")}>{c.name}</h2>
          <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-label2", inspector ? "mt-1 text-[13px]" : "mt-1.5 text-subhead")}>
            <PlanTag plan={c.plan} />
            <span>{c.city}</span>
            {!c.active && <StateText clinic={c} />}
          </div>
        </div>
        {inspector && onClose && <IconButton icon={X} label="閉じる" size="sm" onClick={onClose} className="-mr-1 -mt-0.5" />}
      </div>
      <p className={cn("text-label2 tnum", inspector ? "mt-3 text-[12px]" : "mt-3 text-footnote")}>
        {ymd(c.createdAt)}から利用 · 最終利用 {when(c.lastActiveAt, t)}
      </p>

      {/* 数字の帯 */}
      <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-cell bg-surface">
        {[
          { label: "ユニット", value: c.units, unit: "台" },
          { label: "スタッフ", value: c.setup.staff ? c.staff : "—", unit: c.setup.staff ? "名" : "" },
          { label: "4週の予約", value: last4.toLocaleString("ja-JP"), unit: "件" },
          { label: "Web予約", value: Math.round(c.webRatio * 100), unit: "%" },
        ].map((f, i) => (
          <div key={f.label} className={cn("min-w-0 px-3 py-2.5", i > 0 && "hairline-l")}>
            <div className="truncate text-[11px] font-medium text-label2">{f.label}</div>
            <div className="mt-0.5 whitespace-nowrap text-[17px] font-semibold leading-6 tnum">
              {f.value}
              <span className="ml-0.5 text-[11px] font-medium text-label2">{f.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* いま必要な対応 */}
      {(dormant || growing || !c.active) && (
        <ListSection>
          {!c.active && (
            <ListRow
              leading={<CirclePause className="h-[22px] w-[22px] shrink-0 text-label2" strokeWidth={2} />}
              inset={50}
              title="利用を停止しています"
              subtitle={stoppedAt ? `${md(stoppedAt)}から · 請求は止まっています` : "請求は止まっています"}
              trailing={<Button size="sm" variant="gray" onClick={() => setContract(true)}>再開する</Button>}
            />
          )}
          {dormant && (
            <ListRow
              leading={<CircleAlert className={cn("h-[22px] w-[22px] shrink-0", checkin ? "text-label3" : "text-red")} strokeWidth={2} />}
              inset={50}
              title={`${daysSince(c.lastActiveAt)}日間 利用がありません`}
              subtitle={checkin ? `確認のメールを送信済み · ${when(checkin, t)}` : `${mdw(c.lastActiveAt)}からログインなし`}
              trailing={
                checkin ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-label2">
                    <Check className="h-4 w-4 text-accent" strokeWidth={2.6} />
                    連絡済み
                  </span>
                ) : (
                  <Button size="sm" variant="gray" icon={Send} onClick={checkinSend}>連絡する</Button>
                )
              }
            />
          )}
          {growing && (
            <ListRow
              leading={<TrendingUp className="h-[22px] w-[22px] shrink-0 text-accent" strokeWidth={2} />}
              inset={50}
              title="予約が増えています"
              subtitle={proposal ? `${planLabel(proposal.plan)}プランを提案済み · ${when(proposal.at, t)}` : `フリープランで直近4週 ${last4}件`}
              trailing={
                proposal ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-label2">
                    <Check className="h-4 w-4 text-accent" strokeWidth={2.6} />
                    提案済み
                  </span>
                ) : (
                  <Button size="sm" variant="tinted" onClick={() => setProposing(true)}>提案する</Button>
                )
              }
            />
          )}
        </ListSection>
      )}

      {/* 初期設定（停止中は畳む） */}
      {c.active ? (
        <ListSection header="初期設定">
          <div className="relative flex items-center gap-3.5 px-4 py-3">
            <Ring value={done / SETUP_ITEMS.length} size={44} stroke={5}>
              <span className="text-[12px] font-semibold tnum">{done}/{SETUP_ITEMS.length}</span>
            </Ring>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">{done === SETUP_ITEMS.length ? "すべて完了しています" : `あと${SETUP_ITEMS.length - done}項目`}</div>
              <div className="mt-0.5 text-[13px] leading-[18px] text-label2">
                {done === SETUP_ITEMS.length ? "診療時間からLINE連携まで設定済み" : guide ? `案内を送信済み · ${when(guide, t)}` : `${missing.map(m => m.label).join("・")}が未完了`}
              </div>
            </div>
            <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />
          </div>
          {SETUP_ITEMS.map(item => {
            const ok = c.setup[item.key];
            return (
              <div key={item.key} className="group relative flex min-h-[40px] items-center gap-3 px-4 py-2">
                <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", ok ? "bg-accent text-surface" : "shadow-[inset_0_0_0_1.5px_rgb(var(--label-4))]")}>
                  {ok && <Check className="h-3 w-3" strokeWidth={3.2} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-label md:text-[14px]">{item.label}</span>
                {!ok && <span className="shrink-0 text-[13px] text-label3">{item.todo}</span>}
                <span aria-hidden className="pointer-events-none absolute bottom-0 left-12 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
              </div>
            );
          })}
          {done < SETUP_ITEMS.length && (
            <ListRow
              leading={<span className="flex w-5 shrink-0 justify-center"><Send className="h-[17px] w-[17px] text-accent" strokeWidth={2.1} /></span>}
              inset={48}
              title={<span className="text-accent">{guide ? "案内をもう一度送る" : "設定の案内を送る"}</span>}
              onClick={guideSend}
            />
          )}
        </ListSection>
      ) : (
        <ListSection header="初期設定">
          <ListRow title="停止中のため変更できません" value={<span className="tnum">{done}/{SETUP_ITEMS.length}</span>} />
        </ListSection>
      )}

      {/* プラン */}
      <ListSection header="プラン">
        <ListRow
          title={
            <span className="flex items-center gap-2">
              <span className="font-semibold">{planLabel(c.plan)}</span>
              <span className="text-label2 tnum">{yen(planPrice(c.plan))} / 月</span>
            </span>
          }
          subtitle={c.active ? PLAN_STYLE[c.plan].note : "停止中のため変更できません"}
          trailing={<Button size="sm" variant="gray" disabled={!c.active} onClick={() => setSheet("plan")}>プランを変更</Button>}
        />
      </ListSection>

      {/* オプション（停止中は畳む） */}
      {c.active ? (
        <ListSection
          header="オプション"
          aside={<span className="text-footnote text-label3 tnum">{c.addons.length}件 · {yen(extra)} / 月</span>}
          footer="追加すると、次回の請求から日割りで反映されます。"
        >
          {s.addons.map(a => {
            const on = c.addons.includes(a.key);
            const can = a.active || on;
            return (
              <ListRow
                key={a.key}
                title={a.name}
                subtitle={a.active ? `${yen(a.price)} / 月` : on ? `${yen(a.price)} / 月 · 提供を停止中` : "提供を停止中"}
                trailing={can ? <Switch checked={on} onChange={v => toggleAddon(a.key, v)} label={a.name} /> : <span className="shrink-0 text-[13px] text-label3">—</span>}
              />
            );
          })}
          <div className="relative flex min-h-[52px] items-center gap-3 bg-fill/[0.04] px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">この医院の月額</div>
              <div className="mt-0.5 truncate text-[12px] text-label2 tnum">プラン {yen(planPrice(c.plan))} ＋ オプション {yen(extra)}</div>
            </div>
            <span className="shrink-0 text-[17px] font-semibold tnum">{yen(clinicMRR(s, c))}</span>
          </div>
        </ListSection>
      ) : (
        <ListSection header="オプション">
          <ListRow
            title="停止中のため変更できません"
            subtitle={c.addons.length ? c.addons.map(k => addonOf(s, k)?.name).join("・") : "契約しているオプションはありません"}
            value={<span className="tnum">{c.addons.length}件</span>}
          />
        </ListSection>
      )}

      {/* 予約数 */}
      <ListSection header="予約数" aside={<span className="text-footnote text-label3">直近12週</span>}>
        <div className="px-4 pb-3.5 pt-3">
          <div className="flex items-end justify-between gap-3">
            <div className="tnum">
              <span className="text-[22px] font-semibold leading-none">{last4.toLocaleString("ja-JP")}</span>
              <span className="ml-1 text-[13px] text-label2">件 / 直近4週</span>
            </div>
            <div className="pb-0.5 text-right text-[12px] tnum">
              {!c.active ? (
                <span className="text-label3">{md(c.lastActiveAt)}から利用なし</span>
              ) : isNew && !prev4 ? (
                <span className="text-label3">{md(c.createdAt)}に登録</span>
              ) : (
                <>
                  <span className={cn("font-semibold", last4 >= prev4 ? "text-accent" : "text-label2")}>
                    {last4 >= prev4 ? "+" : "−"}
                    {pct(Math.abs(prev4 ? (last4 - prev4) / prev4 : 0), 1)}
                  </span>
                  <span className="ml-1 text-label3">前の4週から</span>
                </>
              )}
            </div>
          </div>
          <WeekBars key={c.id} weeks={weeks} className="mt-5" />
        </div>
      </ListSection>

      {/* サポート */}
      <ListSection
        header="サポート"
        footer={c.id === "c1" ? "医院のスタッフ画面を、サポート用に開きます。開いた記録が残ります。" : "医院のスタッフ画面を、サポート用に開きます。プロトタイプでは、ひだまり歯科クリニックの画面が開きます。"}
      >
        <ListRow
          title={<span className="text-accent">この医院の画面を開く</span>}
          trailing={<ArrowUpRight className="h-[18px] w-[18px] shrink-0 text-accent" strokeWidth={2.2} />}
          onClick={() => goApp("clinic")}
        />
      </ListSection>

      {/* メモ */}
      <ListSection header="メモ" footer="運営チームだけが見られます。入力した内容は自動で保存されます。">
        <MemoField key={c.id} clinic={c} initial={s.memos[c.id] ?? ""} />
      </ListSection>

      {/* 契約（いちばん下に。停止は赤、再開はふつうの操作） */}
      <ListSection
        header="契約"
        footer={c.active ? "停止しても、プラン・オプション・データはそのまま残ります。" : monthly ? `再開すると、${yen(monthly)} / 月の請求が始まります。` : "フリープランのため、再開しても請求はありません。"}
      >
        <ListRow
          title={c.active ? "利用を停止…" : <span className="text-accent">利用を再開…</span>}
          destructive={c.active}
          onClick={() => setContract(true)}
        />
      </ListSection>

      <PlanSheet clinic={c} open={route.sheet === "plan" && c.active} onClose={() => setSheet(undefined)} />
      <ConfirmSheet
        open={!!cancelling}
        onClose={() => setCancelAddon(null)}
        title="オプションを解約"
        confirmLabel="解約する"
        destructive
        onConfirm={confirmCancel}
      >
        {cancelling && (
          <>
            <p className="px-1 pb-1 text-[15px] leading-[1.7] [text-wrap:pretty] [word-break:auto-phrase]">
              <span className="font-semibold">{c.name}</span>の<span className="font-semibold">{cancelling.name}</span>を解約します。
              {!cancelling.active && "提供を停止しているため、解約すると再び追加することはできません。"}
            </p>
            <SheetGroup header="月額の変化" footer="解約は今日から有効です。差額は日割りで、次回の請求に反映されます。">
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] tnum">
                <span>
                  <span className="text-label2">{yen(monthly)}</span>
                  <span className="mx-1.5 text-label3">→</span>
                  <span className="font-semibold">{yen(monthly - cancelling.price)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-label2">−{yen(cancelling.price)}</span>
              </div>
            </SheetGroup>
          </>
        )}
      </ConfirmSheet>
      <ConfirmSheet
        open={contract}
        onClose={() => setContract(false)}
        title={c.active ? "利用を停止" : "利用を再開"}
        confirmLabel={c.active ? "利用を停止" : "利用を再開"}
        destructive={c.active}
        onConfirm={confirmContract}
      >
        <p className="px-1 pb-1 text-[15px] leading-[1.7] [text-wrap:pretty] [word-break:auto-phrase]">
          <span className="font-semibold">{c.name}</span>
          {c.active ? "の利用を停止します。" : "の利用を再開します。"}
        </p>
        <SheetGroup header={c.active ? "停止すると" : "再開すると"}>
          {(c.active
            ? [
                `スタッフ${c.setup.staff ? `${c.staff}名` : ""}がArcheにログインできなくなります`,
                "患者さんのWeb予約の受け付けを止めます",
                "プラン・オプション・予約のデータはそのまま残ります",
              ]
            : [
                "スタッフが、これまでと同じアカウントでログインできます",
                "患者さんのWeb予約の受け付けを再開します",
              ]
          ).map(line => (
            <div key={line} className="group relative flex min-h-[44px] items-center px-4 py-2.5 text-[15px] leading-[1.5]">
              {line}
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
            </div>
          ))}
        </SheetGroup>
        {monthly > 0 && <SheetGroup header="月額の変化" footer="差額は日割りで、次回の請求に反映されます。">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] tnum">
            <span>
              <span className="text-label2">{yen(c.active ? monthly : 0)}</span>
              <span className="mx-1.5 text-label3">→</span>
              <span className="font-semibold">{yen(c.active ? 0 : monthly)}</span>
            </span>
            <span className={cn("shrink-0 text-[14px] font-semibold", c.active ? "text-label2" : "text-accent")}>{c.active ? `−${yen(monthly)}` : `+${yen(monthly)}`}</span>
          </div>
        </SheetGroup>}
      </ConfirmSheet>
      <ProposalSheet clinic={c} open={proposing} onClose={() => setProposing(false)} />
    </div>
  );
}

function MemoField({ clinic, initial }: { clinic: ConsoleClinic; initial: string }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(72, el.scrollHeight)}px`;
  }, [v]);
  return (
    <textarea
      ref={ref}
      value={v}
      onChange={e => {
        setV(e.target.value);
        setMemo(clinic.id, e.target.value);
      }}
      rows={3}
      aria-label={`${clinic.name}のメモ`}
      placeholder="この医院についてのメモ"
      className="block w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-[1.65] outline-none placeholder:text-label3 md:text-[14px]"
    />
  );
}

/** 小さな完了の印（初期設定がそろったときなどに） */
export function DoneMark() {
  return (
    <AnimatePresence>
      <motion.span initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={springBouncy} className="inline-flex">
        <Check className="h-4 w-4 text-accent" strokeWidth={2.8} />
      </motion.span>
    </AnimatePresence>
  );
}
