import { Fragment, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { weekly } from "@/data";
import { useStore } from "@/lib/store";
import { useIsPhone } from "@/lib/media";
import { Page, Segmented, cn } from "@/ui";
import { useClinicUI } from "../context";
import { Card, Heatmap, MetricTile, STACK_TONES, ShareList, StackBar, WeeklyChart, WeeklyLegend, heatmapSummary } from "./reports/charts";
import { breakdown, headline, metricsFor, rangeOf, type Period } from "./reports/model";

/** 院長向けのレポート。ヘルスケアやスクリーンタイムのように、事実を数字とグラフで静かに見せる */
export default function ReportsScreen({ param }: { param?: string }) {
  const ui = useClinicUI();
  const phone = useIsPhone();
  const { appointments } = useStore();
  const [period, setPeriod] = useState<Period>(param === "week" ? "week" : "month");
  const range = rangeOf(period);
  const metrics = useMemo(() => metricsFor(period), [period]);
  const b = useMemo(() => breakdown(appointments, period), [appointments, period]);
  const compare = period === "month" ? "前の30日比" : "先週比";
  const scope = period === "month" ? "直近30日" : "今週";
  const cols = phone ? 2 : 4;
  const rows: (typeof metrics)[] = [];
  for (let i = 0; i < metrics.length; i += cols) rows.push(metrics.slice(i, i + cols));
  const selfShare = Math.round(b.insurance.selfShare * 100);

  return (
    <Page
      title="レポート"
      back={ui.back}
      subtitle={<span className="tnum">{range.label}<span className="text-label3"> · {range.compare}</span></span>}
      accessory={
        <Segmented
          value={period}
          onChange={setPeriod}
          options={[{ value: "week", label: "週" }, { value: "month", label: "月" }]}
          className={phone ? "w-full" : "w-[220px]"}
          full={phone}
        />
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={period} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ duration: 0.2 }}>
          <p className={cn("max-w-[36em] text-label palt", phone ? "text-[17px] leading-[1.6]" : "text-[19px] font-medium leading-[1.6]")}>{headline(period)}</p>

          <section aria-label="主な指標" className="mt-5 rounded-card bg-surface px-4 md:px-5">
            {rows.map((r, ri) => (
              <div key={ri} className={cn("grid gap-x-4 py-4 md:gap-x-6 md:py-5", ri > 0 && "hairline-t")} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {r.map(m => <MetricTile key={m.key} m={m} compare={compare} compact={phone} />)}
              </div>
            ))}
          </section>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-flow-dense lg:grid-cols-2 xl:grid-cols-3">
            <Card
              title="週ごとの来院数"
              detail={`今週 ${weekly[weekly.length - 1].visits}人`}
              aside={<WeeklyLegend />}
              className="lg:col-span-2"
            >
              <WeeklyChart height={phone ? 176 : 212} />
            </Card>

            <Card title="予約の経路" detail={`${scope}の予約 ${b.sourceTotal}件`}>
              <StackBar rows={b.sources} />
              <ul className="mt-4">
                {b.sources.map((r, i) => (
                  <li key={r.label} className={cn("flex h-10 items-center gap-2.5 text-[14px]", i > 0 && "hairline-t")}>
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STACK_TONES[i])} />
                    <span className="flex-1">{r.label}</span>
                    <span className="tnum text-label2"><span className="font-semibold text-label">{r.value}</span>件</span>
                    <span className="w-[3.2em] text-right tnum text-label2">{Math.round(r.share * 100)}%</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="曜日×時間の混み具合" detail="ユニット稼働率 · 直近12週の平均" className="lg:col-span-2" footer={heatmapSummary()}>
              <Heatmap compact={phone} />
            </Card>

            <Card
              title="キャンセルの理由"
              detail={`${scope} · 連絡のあったキャンセル`}
              footer="無断キャンセルは理由がわからないため含めていません。"
            >
              {b.reasons.length ? <ShareList rows={b.reasons} tone="neutral" showCount={false} /> : <p className="py-6 text-center text-[14px] text-label2">この期間のキャンセルはありません</p>}
            </Card>

            <Card title="メニューの内訳" detail={`${scope}の予約 ${b.total}件 · 診療の種類別`} className="xl:col-span-2">
              <div>
                {b.categories.length ? <><div className="hidden xl:block"><ShareList rows={b.categories} inline /></div><div className="xl:hidden"><ShareList rows={b.categories} /></div></> : <p className="py-6 text-center text-[14px] text-label2">この期間の予約はありません</p>}
              </div>
            </Card>

            <Card title="保険診療と自費診療" detail={`${scope}の予約 ${b.total}件`}>
              <div className="flex items-baseline justify-between tnum">
                <div>
                  <div className="text-[13px] font-medium text-label2">保険</div>
                  <div className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em]">{100 - selfShare}<span className="ml-0.5 text-[14px] font-medium text-label2">%</span></div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-medium text-label2">自費</div>
                  <div className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] text-accent">{selfShare}<span className="ml-0.5 text-[14px] font-medium text-label2">%</span></div>
                </div>
              </div>
              <div className="mt-3">
                <StackBar
                  rows={[{ label: "保険", value: b.insurance.ins, share: 1 - b.insurance.selfShare }, { label: "自費", value: b.insurance.self, share: b.insurance.selfShare }]}
                  tones={["bg-fill/24", "bg-accent"]}
                />
              </div>
              <div className="mt-5 text-[13px] font-medium text-label2">自費のメニュー</div>
              <ul className="mt-1">
                {b.selfPayMenus.map((r, i) => (
                  <Fragment key={r.label}>
                    <li className={cn("flex h-10 items-center gap-3 text-[14px]", i > 0 && "hairline-t")}>
                      <span className="min-w-0 flex-1 truncate">{r.label}</span>
                      <span className="tnum text-label2"><span className="font-semibold text-label">{r.value}</span>件</span>
                    </li>
                  </Fragment>
                ))}
                {!b.selfPayMenus.length && <li className="py-3 text-[14px] text-label2">この期間の自費診療はありません</li>}
              </ul>
            </Card>
          </div>
        </motion.div>
      </AnimatePresence>
    </Page>
  );
}
