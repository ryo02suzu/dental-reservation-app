import { useMemo, useState, type ReactNode } from "react";
import { ArrowRightLeft, ArrowUpRight, Building2, Check, ChevronRight, CircleMinus, CirclePause, CirclePlay, Mail, Puzzle, Send, Tag as TagIcon } from "lucide-react";
import type { ConsoleClinic, PlanKey } from "@/data";
import { TODAY, useNow } from "@/lib/clock";
import { mdw, yen } from "@/lib/format";
import { useIsPhone } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { Button, ListRow, ListSection, Page, Ring, SectionTitle, Surface, cn } from "@/ui";
import type { LucideIcon } from "lucide-react";
import { MrrChart, SegmentBar } from "./parts/charts";
import {
  DORMANT_DAYS, PLAN_ORDER, PLAN_STYLE, SETUP_ITEMS, addonMRR, attentionOf, clinicMRR, daysSince, mrrHistory, overviewStats, pct, planLabel, planMRR,
  setupDone, setupMissing, sinceSignup, weeksOf, when,
} from "./parts/model";
import { ProposalSheet } from "./parts/ProposalSheet";
import { useConsole, type ConsoleEvent, type ConsoleState } from "./parts/store";
import { ClinicMark, Delta, RowRule, Swatch } from "./parts/ui";

/** 運営コンソールの概要 */
export default function ConsoleOverview({ param }: { param?: string }) {
  void param;
  const s = useConsole();
  const phone = useIsPhone();
  const { goApp } = useRoute();
  const st = overviewStats(s);
  const history = useMemo(() => mrrHistory(s), [s]);

  return (
    <Page title="概要" subtitle={mdw(TODAY)}>
      <div className="grid gap-x-6 min-[1180px]:grid-cols-[minmax(0,1fr)_344px]">
        <div className="min-w-0">
          {/* MRR */}
          <Surface className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div>
                <div className="text-[13px] font-medium text-label2">MRR</div>
                <div className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.025em] tnum md:text-[38px]">{yen(st.mrr)}</div>
                <Delta value={st.mrrDelta} label={signedPct(st.mrrDelta)} compare="前月比" quiet={0.05} className="mt-2" />
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 pt-0.5 text-[13px] md:text-right">
                <dt className="text-label2">プラン</dt>
                <dd className="font-medium tnum">{yen(planMRR(s))}</dd>
                <dt className="text-label2">オプション</dt>
                <dd className="font-medium tnum">{yen(addonMRR(s))}</dd>
              </dl>
            </div>
            <MrrChart data={history} height={phone ? 176 : 212} className="mt-5" />
          </Surface>

          {/* 指標（1行の帯。iPhoneは2×2） */}
          <Metrics st={st} phone={phone} />

          <Attention s={s} />
        </div>

        <div className="min-w-0 md:grid md:grid-cols-2 md:gap-x-6 min-[1180px]:block">
          <PlanMix s={s} />
          <Activity s={s} />
        </div>
      </div>

      {phone && (
        <ListSection className="!mt-8" footer="医院・患者・予約はすべて架空のサンプルです。">
          <ListRow icon={ArrowUpRight} tone="sand" title="プロトタイプのトップへ" onClick={() => goApp("launcher")} />
        </ListSection>
      )}
    </Page>
  );
}

// ─── 指標の帯 ───────────────────────────────────────────────────────────────
const signedPct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v * 100).toFixed(1)}%`;
const signedPt = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v * 100).toFixed(1)}pt`;
const signedN = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v)}`;

function Metrics({ st, phone }: { st: ReturnType<typeof overviewStats>; phone: boolean }) {
  const items: { label: string; value: ReactNode; unit?: string; delta: ReactNode; hint: string }[] = [
    {
      label: "稼働中の医院",
      value: st.active,
      unit: `/ ${st.total}医院`,
      delta: <Delta value={st.activeDelta} label={signedN(st.activeDelta)} compare="30日前から" quiet={1} />,
      hint: `契約 ${st.total}医院のうち、停止中 ${st.stopped}医院`,
    },
    {
      label: "直近4週の予約",
      value: st.appts.toLocaleString("ja-JP"),
      unit: "件",
      delta: <Delta value={st.apptsDelta} label={signedPct(st.apptsDelta)} compare="前の4週比" quiet={0.05} />,
      hint: "全医院の合計（先週まで）",
    },
    {
      label: "Web予約率",
      value: (st.web * 100).toFixed(1),
      unit: "%",
      delta: <Delta value={st.webDelta} label={signedPt(st.webDelta)} compare="前の4週比" quiet={0.01} />,
      hint: "予約数で重み付けした、全医院の平均",
    },
    {
      label: "休眠",
      value: st.dormant,
      unit: "医院",
      delta: <Delta value={st.dormantDelta} label={signedN(st.dormantDelta)} compare="30日前から" quiet={1} good={false} alert />,
      hint: `稼働中で、最終利用から${DORMANT_DAYS}日以上たっている医院`,
    },
  ];
  return (
    <div className={cn("mt-3 grid overflow-hidden rounded-card bg-surface", phone ? "grid-cols-2" : "grid-cols-4")}>
      {items.map((it, i) => (
        <div key={it.label} title={it.hint} className="relative min-w-0 px-4 py-3 md:px-5 md:py-3.5">
          <div className="truncate whitespace-nowrap text-[12px] font-medium text-label2">{it.label}</div>
          <div className="mt-1 flex items-baseline gap-1 whitespace-nowrap">
            <span className="text-[24px] font-semibold leading-7 tracking-[-0.01em] tnum">{it.value}</span>
            {it.unit && <span className="truncate text-[13px] font-medium text-label2 tnum">{it.unit}</span>}
          </div>
          <div className="mt-1">{it.delta}</div>
          {(phone ? i % 2 === 1 : i > 0) && <span aria-hidden className="pointer-events-none absolute bottom-3 left-0 top-3 w-px origin-left scale-x-50 bg-sep/30" />}
          {phone && i >= 2 && <span aria-hidden className="pointer-events-none absolute left-4 right-4 top-0 h-px origin-top scale-y-50 bg-sep/30" />}
        </div>
      ))}
    </div>
  );
}

// ─── 対応が必要 ─────────────────────────────────────────────────────────────
function Attention({ s }: { s: ConsoleState }) {
  const { go } = useRoute();
  const t = useNow(60_000);
  const a = attentionOf(s);
  const [proposing, setProposing] = useState<ConsoleClinic | null>(null);
  const phone = useIsPhone();
  const open = (c: ConsoleClinic) => go("clinics", c.id);
  return (
    <section className="min-w-0">
      <SectionTitle className="!mt-8">
        対応が必要
        {a.count > 0 && <span className="ml-2 font-normal text-label3 tnum">{a.count}</span>}
      </SectionTitle>
      {a.count === 0 && <p className="rounded-cell bg-surface px-4 py-6 text-center text-[14px] text-label2">いま対応が必要な医院はありません。</p>}

      {a.setup.length > 0 && (
        <ListSection header="初期設定が終わっていない医院" className="!mt-0">
          {a.setup.map(c => (
            <AttentionRow
              key={c.id}
              clinic={c}
              onOpen={() => open(c)}
              subtitle={s.guides[c.id] ? `案内を送信済み · ${when(s.guides[c.id], t)}` : setupMissing(c).map(m => m.short).join("・")}
              aside={
                <span className="flex items-center gap-2 text-[13px] text-label2 tnum">
                  <Ring value={setupDone(c) / SETUP_ITEMS.length} size={20} stroke={3} />
                  {setupDone(c)}/{SETUP_ITEMS.length}
                </span>
              }
            />
          ))}
        </ListSection>
      )}

      {a.dormant.length > 0 && (
        <ListSection header={`最終利用から${DORMANT_DAYS}日以上`}>
          {a.dormant.map(c => {
            const sent = s.checkins[c.id];
            return (
              <AttentionRow
                key={c.id}
                clinic={c}
                onOpen={() => open(c)}
                subtitle={sent ? `確認メールを送信済み · ${when(sent, t)}` : `最終利用 ${mdw(c.lastActiveAt)}`}
                aside={
                  sent ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-label2">
                      <Check className="h-4 w-4 text-accent" strokeWidth={2.6} />
                      連絡済み
                    </span>
                  ) : (
                    <span className="text-[14px] font-semibold text-red tnum">{daysSince(c.lastActiveAt)}日</span>
                  )
                }
              />
            );
          })}
        </ListSection>
      )}

      {a.growth.length > 0 && (
        <ListSection header="フリープランで予約が増えている医院">
          {a.growth.map(c => {
            const p = s.proposals[c.id];
            const wk = weeksOf(c);
            const lastWeek = wk[wk.length - 1].count;
            const total = sinceSignup(c);
            return (
              <AttentionRow
                key={c.id}
                clinic={c}
                onOpen={() => open(c)}
                subtitle={p ? `${planLabel(p.plan)}プランを提案済み · ${when(p.at, t)}` : phone ? `登録${daysSince(c.createdAt)}日・予約${total}件` : `登録から${daysSince(c.createdAt)}日で予約${total}件 · 先週 ${lastWeek}件`}
                action={
                  p ? (
                    <span className="inline-flex shrink-0 items-center gap-1 pr-1 text-[13px] font-medium text-label2">
                      <Check className="h-4 w-4 text-accent" strokeWidth={2.6} />
                      提案済み
                    </span>
                  ) : (
                    <Button size="sm" variant="tinted" onClick={() => setProposing(c)}>{phone ? "提案する" : "アップグレードを提案"}</Button>
                  )
                }
              />
            );
          })}
        </ListSection>
      )}
      {proposing && <ProposalSheet clinic={proposing} open={!!proposing} onClose={() => setProposing(null)} />}
    </section>
  );
}

/** 対応が必要な医院の1行。行を押すと医院へ。右に任意の操作 */
function AttentionRow({ clinic, subtitle, aside, action, onOpen }: { clinic: ConsoleClinic; subtitle: ReactNode; aside?: ReactNode; action?: ReactNode; onOpen: () => void }) {
  return (
    <div className="group relative flex items-center">
      <button onClick={onOpen} className="flex min-h-[60px] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 pr-3 text-left transition-colors duration-100 hover:bg-fill/[0.06] active:bg-fill/16">
        <ClinicMark name={clinic.name} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] leading-[21px] md:text-[15px] md:leading-5">{clinic.name}</span>
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-label2">{subtitle}</span>
        </span>
        {aside}
        {!action && <ChevronRight className="h-[18px] w-[18px] shrink-0 text-label4" strokeWidth={2.4} />}
      </button>
      {action && <div className="shrink-0 pr-4">{action}</div>}
      <RowRule inset={60} />
    </div>
  );
}

// ─── プラン別 ───────────────────────────────────────────────────────────────
function PlanMix({ s }: { s: ConsoleState }) {
  const [hover, setHover] = useState<PlanKey | null>(null);
  const rows = PLAN_ORDER.map(p => {
    const list = s.clinics.filter(c => c.plan === p);
    return { plan: p, count: list.length, mrr: list.reduce((t, c) => t + clinicMRR(s, c), 0) };
  });
  const total = rows.reduce((t, r) => t + r.mrr, 0) || 1;
  const n = s.clinics.length;
  return (
    <section className="min-w-0">
      <SectionTitle className="!mt-8 min-[1180px]:!mt-0">
        プラン別
        <span className="ml-2 font-normal text-label3 tnum">{n}</span>
      </SectionTitle>
      <Surface>
        <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-x-3 gap-y-3 text-[12px] text-label2">
          <span>医院数</span>
          <SegmentBar label="プラン別の医院数" active={hover} onHover={setHover} parts={rows.map(r => ({ key: r.plan, value: r.count, className: PLAN_STYLE[r.plan].swatch, title: `${planLabel(r.plan)} ${r.count}医院` }))} />
          <span>MRR</span>
          <SegmentBar label="プラン別のMRR" active={hover} onHover={setHover} parts={rows.map(r => ({ key: r.plan, value: r.mrr, className: PLAN_STYLE[r.plan].swatch, title: `${planLabel(r.plan)} ${yen(r.mrr)}` }))} />
        </div>
        <div className="mt-4 hairline-t pt-1" onPointerLeave={() => setHover(null)}>
          {rows.map(r => (
            <div
              key={r.plan}
              onPointerEnter={() => setHover(r.plan)}
              className={cn("grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-2.5 rounded-[8px] py-[7px] text-[13px] transition-opacity", hover && hover !== r.plan && "opacity-45")}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Swatch plan={r.plan} />
                <span className="truncate text-label">{planLabel(r.plan)}</span>
              </span>
              <span className="w-[36px] text-right text-label2 tnum">{r.count}医院</span>
              <span className="w-[76px] text-right font-medium tnum">{yen(r.mrr)}</span>
              <span className="w-[34px] text-right text-label2 tnum">{pct(r.mrr / total)}</span>
            </div>
          ))}
        </div>
      </Surface>
    </section>
  );
}

// ─── 最近の動き ─────────────────────────────────────────────────────────────
const ICON: Record<ConsoleEvent["kind"], LucideIcon> = {
  signup: Building2,
  plan: ArrowRightLeft,
  addon_on: Puzzle,
  addon_off: CircleMinus,
  suspend: CirclePause,
  resume: CirclePlay,
  proposal: Send,
  guide: Mail,
  checkin: Mail,
  price: TagIcon,
  offer_on: Puzzle,
  offer_off: CirclePause,
};

function describe(e: ConsoleEvent, s: ConsoleState): { title: string; detail: string } {
  const c = e.clinicId ? s.clinics.find(x => x.id === e.clinicId) : undefined;
  const a = e.addon ? s.addons.find(x => x.key === e.addon) : undefined;
  switch (e.kind) {
    case "signup": return { title: c?.name ?? "", detail: `新規登録 · ${planLabel(e.to ?? "free")}プラン` };
    case "plan": return { title: c?.name ?? "", detail: `プラン変更 · ${planLabel(e.from!)} → ${planLabel(e.to!)}` };
    case "addon_on": return { title: c?.name ?? "", detail: `オプション追加 · ${a?.name ?? ""}` };
    case "addon_off": return { title: c?.name ?? "", detail: `オプション解約 · ${a?.name ?? ""}` };
    case "suspend": return { title: c?.name ?? "", detail: "利用を停止" };
    case "resume": return { title: c?.name ?? "", detail: "利用を再開" };
    case "proposal": return { title: c?.name ?? "", detail: `アップグレードを提案 · ${planLabel(e.to!)}` };
    case "guide": return { title: c?.name ?? "", detail: "初期設定の案内を送信" };
    case "checkin": return { title: c?.name ?? "", detail: "利用状況の確認メールを送信" };
    case "price": return { title: a?.name ?? "", detail: `料金を変更 · ${yen(e.prices![0])} → ${yen(e.prices![1])}` };
    case "offer_on": return { title: a?.name ?? "", detail: "提供を再開" };
    case "offer_off": return { title: a?.name ?? "", detail: "提供を停止" };
  }
}

function Activity({ s }: { s: ConsoleState }) {
  const { go } = useRoute();
  const t = useNow(30_000);
  const items = [...s.events].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 6);
  return (
    <section className="min-w-0">
      <SectionTitle className="!mt-8">最近の動き</SectionTitle>
      <ListSection className="!mt-0">
        {items.map(e => {
          const d = describe(e, s);
          const Icon = ICON[e.kind];
          return (
            <button
              key={e.id}
              onClick={() => (e.clinicId ? go("clinics", e.clinicId) : go("addons"))}
              className="group relative flex min-h-[56px] w-full items-center gap-3 py-2 pl-4 pr-4 text-left transition-colors duration-100 hover:bg-fill/[0.06] active:bg-fill/16"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fill/12 text-label2">
                <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium leading-5">{d.title}</span>
                <span className="block truncate text-[12px] leading-4 text-label2">{d.detail}</span>
              </span>
              <span className="shrink-0 self-start pt-0.5 text-[12px] text-label3 tnum">{when(e.at, t)}</span>
              <RowRule inset={56} />
            </button>
          );
        })}
      </ListSection>
    </section>
  );
}
