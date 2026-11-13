// 医院1件の詳細。PCでは右のインスペクタ、iPhone（と狭いPC）では横から積み重なる詳細画面の中身。
import { useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Building2, Check, CircleAlert, Send, TrendingUp, X } from "lucide-react";
import type { ConsoleClinic } from "@/data";
import { useNow } from "@/lib/clock";
import { md, mdw, yen } from "@/lib/format";
import { useRoute } from "@/lib/nav";
import { Button, EmptyState, IconButton, ListRow, ListSection, Ring, Switch, cn, springBouncy, useToast } from "@/ui";
import {
  SETUP_ITEMS, addonOf, addonsTotal, clinicMRR, daysSince, isDormant, isGrowingFree, pct, planLabel, planPrice,
  recentOf, setupDone, setupMissing, weeksOf, when, ymd, PLAN_STYLE,
} from "./model";
import { sendGuide, setClinicAddon, setMemo, useConsole } from "./store";
import { WeekBars } from "./charts";
import { PlanSheet } from "./PlanSheet";
import { ProposalSheet } from "./ProposalSheet";
import { ClinicMark, PlanTag, StateText } from "./ui";

export function ClinicDetail({ id, variant, onClose }: { id: string; variant: "inspector" | "page"; onClose?: () => void }) {
  const s = useConsole();
  const c = s.clinics.find(x => x.id === id);
  const { route, setSheet, goApp } = useRoute();
  const toast = useToast();
  const t = useNow(30_000);
  const [proposing, setProposing] = useState(false);
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
  const proposal = s.proposals[c.id];
  const dormant = isDormant(c);
  const growing = isGrowingFree(c);
  const isNew = daysSince(c.createdAt) < 56;

  const toggleAddon = (key: string, on: boolean) => {
    const a = addonOf(s, key);
    if (!a) return;
    setClinicAddon(c.id, key, on);
    toast(on ? `${a.name}を追加しました` : `${a.name}を解約しました`, { detail: on ? `${c.name} · ${yen(a.price)} / 月` : c.name });
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
          { label: "スタッフ", value: c.staff, unit: "名" },
          { label: "30日の予約", value: c.appts30d.toLocaleString("ja-JP"), unit: "件" },
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
      {(dormant || growing) && (
        <ListSection>
          {dormant && (
            <ListRow
              leading={<CircleAlert className={cn("h-[22px] w-[22px] shrink-0", c.active ? "text-red" : "text-label3")} strokeWidth={2} />}
              inset={50}
              title={c.active ? `${daysSince(c.lastActiveAt)}日間 利用がありません` : "利用を停止しています"}
              subtitle={c.active ? `${mdw(c.lastActiveAt)}から、管理画面へのログインがありません` : `最終利用は${md(c.lastActiveAt)}（${daysSince(c.lastActiveAt)}日前）`}
            />
          )}
          {growing && (
            <ListRow
              leading={<TrendingUp className="h-[22px] w-[22px] shrink-0 text-accent" strokeWidth={2} />}
              inset={50}
              title="フリープランで予約が増えています"
              subtitle={proposal ? `${md(proposal.at)}に${planLabel(proposal.plan)}プランを提案済み` : `直近4週で${last4}件`}
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

      {/* 初期設定 */}
      <ListSection header="初期設定" aside={<span className="text-footnote text-label3 tnum">{done} / {SETUP_ITEMS.length}</span>}>
        <div className="relative flex items-center gap-3.5 px-4 py-3">
          <Ring value={done / SETUP_ITEMS.length} size={44} stroke={5}>
            <span className="text-[12px] font-semibold tnum">{done}/{SETUP_ITEMS.length}</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{done === SETUP_ITEMS.length ? "すべて完了しています" : `あと${SETUP_ITEMS.length - done}項目`}</div>
            <div className="mt-0.5 truncate text-[13px] text-label2">
              {done === SETUP_ITEMS.length ? "診療時間からLINE連携まで設定済み" : guide ? `${md(guide)} ${when(guide, t)}に案内を送りました` : missing.map(m => m.short).join("・")}
            </div>
          </div>
          {done < SETUP_ITEMS.length && c.active && (
            <Button size="sm" variant="gray" icon={Send} onClick={guideSend}>{guide ? "再送" : "案内を送る"}</Button>
          )}
          <span aria-hidden className="pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30" />
        </div>
        {SETUP_ITEMS.map(item => {
          const ok = c.setup[item.key];
          return (
            <div key={item.key} className="group relative flex min-h-[40px] items-center gap-3 px-4 py-2">
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full", ok ? "bg-accent text-surface" : "shadow-[inset_0_0_0_1.5px_rgb(var(--label-4))]")}>
                {ok && <Check className="h-3 w-3" strokeWidth={3.2} />}
              </span>
              <span className={cn("min-w-0 flex-1 truncate text-[15px] md:text-[14px]", ok ? "text-label" : "text-label")}>{item.label}</span>
              {!ok && <span className="shrink-0 text-[13px] text-label3">{item.todo}</span>}
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-12 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" />
            </div>
          );
        })}
      </ListSection>

      {/* プラン */}
      <ListSection header="プラン">
        <ListRow
          title={
            <span className="flex items-center gap-2">
              <span className="font-semibold">{planLabel(c.plan)}</span>
              <span className="text-label2 tnum">{yen(planPrice(c.plan))} / 月</span>
            </span>
          }
          subtitle={PLAN_STYLE[c.plan].note}
          trailing={<Button size="sm" variant="gray" onClick={() => setSheet("plan")}>プランを変更</Button>}
        />
      </ListSection>

      {/* オプション */}
      <ListSection
        header="オプション"
        aside={<span className="text-footnote text-label3 tnum">{c.addons.length}件 · {yen(extra)} / 月</span>}
        footer={
          c.active ? (
            <span className="tnum">
              この医院の月額 <span className="font-semibold text-label">{yen(clinicMRR(s, c))}</span>（プラン {yen(planPrice(c.plan))} ＋ オプション {yen(extra)}）
            </span>
          ) : (
            "停止中の医院は、オプションを変更できません。"
          )
        }
      >
        {s.addons.map(a => {
          const on = c.addons.includes(a.key);
          const can = c.active && (a.active || on);
          return (
            <ListRow
              key={a.key}
              title={a.name}
              subtitle={a.active ? `${yen(a.price)} / 月` : on ? `${yen(a.price)} / 月 · 提供を停止中` : "提供を停止中"}
              trailing={can ? <Switch checked={on} onChange={v => toggleAddon(a.key, v)} label={a.name} /> : <span className="shrink-0 text-[13px] text-label3">{on ? "利用中" : "—"}</span>}
            />
          );
        })}
      </ListSection>

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
                  <span className={cn("font-semibold", last4 >= prev4 ? "text-accent" : "text-red")}>
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

      <PlanSheet clinic={c} open={route.sheet === "plan"} onClose={() => setSheet(undefined)} />
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
