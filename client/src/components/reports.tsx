import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell,
} from "recharts";
import {
  BarChart3, TrendingUp, Users, Calendar, TrendingDown, Minus, Activity,
  Download, Lightbulb, Clock, AlertTriangle, CheckCircle2, Star, Lock,
} from "lucide-react";
import { usePlan } from "@/hooks/use-plan";
import { Link } from "wouter";

interface ReportData {
  thisMonth: {
    totalAppointments: number;
    newPatients: number;
    revenue: number;
    cancellationRate: number;
    cancelledCount: number;
    noShowCount: number;
    completedCount: number;
  };
  lastMonth: {
    totalAppointments: number;
    newPatients: number;
    revenue: number;
    cancellationRate: number;
  };
  staffCapacity: Array<{ staff: string; capacity: number; booked: number; percentage: number }>;
  treatmentTypeStats: Array<{ type: string; count: number; percentage: number }>;
  timeSlotStats: Array<{ time: string; count: number; percentage: number }>;
  monthlyTrend?: Array<{ label: string; appointments: number; newPatients: number; revenue: number; cancellations: number }>;
}

function Trend({ current, prev, reverse = false }: { current: number; prev: number; reverse?: boolean }) {
  if (current === prev) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  const isGood = reverse ? current < prev : current > prev;
  if (isGood) return <TrendingUp className="h-3.5 w-3.5 text-green-600" />;
  return <TrendingDown className="h-3.5 w-3.5 text-red-600" />;
}

function KpiCard({ title, icon: Icon, iconClass, value, sub, trend, onClick, active }: {
  title: string; icon: React.ElementType; iconClass: string;
  value: string | number; sub: React.ReactNode; trend?: React.ReactNode;
  onClick?: () => void; active?: boolean;
}) {
  return (
    <Card
      className={`cursor-pointer transition-all duration-150 hover:shadow-md ${active ? "ring-2 ring-primary shadow-md" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-3xl font-bold ${active ? "text-primary" : ""}`} data-testid={`report-${title}`}>{value}</div>
        {trend && <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">{trend}</div>}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {active && <p className="text-[10px] text-primary mt-1.5 font-medium">▼ 詳細を表示中</p>}
      </CardContent>
    </Card>
  );
}

function InsightCard({ icon: Icon, color, text }: { icon: React.ElementType; color: string; text: string }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${color}`}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" />
      <p className="text-sm leading-snug">{text}</p>
    </div>
  );
}

function exportCSV(data: ReportData) {
  const rows: string[][] = [];
  rows.push(["# 月次サマリー"]);
  rows.push(["項目", "今月", "先月"]);
  rows.push(["予約数", String(data.thisMonth.totalAppointments), String(data.lastMonth.totalAppointments)]);
  rows.push(["新規患者", String(data.thisMonth.newPatients), String(data.lastMonth.newPatients)]);
  rows.push(["キャンセル率", `${data.thisMonth.cancellationRate}%`, `${data.lastMonth.cancellationRate}%`]);
  rows.push([]);
  rows.push(["# 治療種別"]);
  rows.push(["種別", "件数", "割合"]);
  data.treatmentTypeStats.forEach(s => rows.push([s.type, String(s.count), `${s.percentage}%`]));
  rows.push([]);
  rows.push(["# 時間帯別"]);
  rows.push(["時間帯", "件数"]);
  data.timeSlotStats.forEach(s => rows.push([s.time, String(s.count)]));
  rows.push([]);
  rows.push(["# スタッフ別"]);
  rows.push(["担当者", "予約件数", "稼働率"]);
  data.staffCapacity.forEach(s => rows.push([s.staff, String(s.booked), `${s.percentage}%`]));
  rows.push([]);
  rows.push(["# 月次推移"]);
  rows.push(["月", "予約数", "新患数", "キャンセル"]);
  (data.monthlyTrend ?? []).forEach(m => rows.push([m.label, String(m.appointments), String(m.newPatients), String(m.cancellations)]));

  const bom = "\uFEFF";
  const csv = bom + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `arche-report-${new Date().toISOString().slice(0, 7)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildInsights(data: ReportData): Array<{ icon: React.ElementType; color: string; text: string }> {
  const insights: Array<{ icon: React.ElementType; color: string; text: string }> = [];
  const { thisMonth: tm, lastMonth: lm } = data;

  if (tm.totalAppointments > lm.totalAppointments) {
    insights.push({ icon: TrendingUp, color: "border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300", text: `今月の予約数は先月より ${tm.totalAppointments - lm.totalAppointments} 件増加しています。` });
  } else if (tm.totalAppointments < lm.totalAppointments) {
    insights.push({ icon: TrendingDown, color: "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300", text: `今月の予約数は先月より ${lm.totalAppointments - tm.totalAppointments} 件減少しています。集客施策を検討してみましょう。` });
  }

  if (tm.cancellationRate > 15) {
    insights.push({ icon: AlertTriangle, color: "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300", text: `キャンセル率が ${tm.cancellationRate}% と高めです。リマインダー機能の活用をお勧めします。` });
  } else if (tm.cancellationRate < lm.cancellationRate && lm.cancellationRate > 0) {
    insights.push({ icon: CheckCircle2, color: "border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300", text: `キャンセル率が先月の ${lm.cancellationRate}% から ${tm.cancellationRate}% に改善しました。` });
  }

  const peakSlot = [...data.timeSlotStats].sort((a, b) => b.count - a.count)[0];
  if (peakSlot) {
    insights.push({ icon: Clock, color: "border-blue-200 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300", text: `今月のピーク時間は ${peakSlot.time} 台（${peakSlot.count} 件）です。この時間帯のスタッフ配置を確認しましょう。` });
  }

  const topTreatment = [...data.treatmentTypeStats].sort((a, b) => b.count - a.count)[0];
  if (topTreatment) {
    insights.push({ icon: Star, color: "border-purple-200 bg-purple-50 text-purple-800 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300", text: `最も多い治療は「${topTreatment.type}」（${topTreatment.count} 件・${topTreatment.percentage}%）です。` });
  }

  if (tm.newPatients >= 5) {
    insights.push({ icon: Users, color: "border-green-200 bg-green-50 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300", text: `今月 ${tm.newPatients} 名の新規患者が来院しました。初診フォローアップのタイミングを忘れずに。` });
  }

  return insights;
}

const BAR_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function ReportsLocked() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight">レポート</h1>
          <Lock className="w-4 h-4 text-muted-foreground ml-1" />
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">経営分析・傾向レポート</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">プロプランで利用可能</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            経営分析レポートでは、月次予約数・新患数・キャンセル率・スタッフ稼働率などを
            グラフで確認できます。プロプランにアップグレードしてご活用ください。
          </p>
          <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm font-medium mb-3">レポートで確認できること</p>
            {["月次予約数・新患数の推移", "キャンセル率・直前キャンセルの傾向", "スタッフ別稼働率", "人気の診療メニュー分析", "AI診断によるインサイト提案"].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Button asChild className="w-full">
            <Link href="/contact">プロプランへのアップグレードを相談する</Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-3">プロプラン ¥9,800/月</p>
        </div>
      </div>
    </div>
  );
}

type KpiKey = "appointments" | "newPatients" | "cancellation" | "utilization" | null;

export function Reports() {
  const { canReport } = usePlan();
  const [activeKpi, setActiveKpi] = useState<KpiKey>(null);
  const handleKpiClick = (key: KpiKey) => setActiveKpi(prev => prev === key ? null : key);
  const { data, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports"],
    enabled: canReport,
  });

  if (!canReport) return <ReportsLocked />;

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <div className="px-4 md:px-6 py-4 border-b border-border">
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { thisMonth: tm, lastMonth: lm } = data;
  const insights = buildInsights(data);

  const totalCapacity = data.staffCapacity.reduce((s, r) => s + r.capacity, 0);
  const totalBooked = data.staffCapacity.reduce((s, r) => s + r.booked, 0);
  const utilizationRate = totalCapacity > 0 ? Math.round((totalBooked / totalCapacity) * 100) : 0;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">レポート</h1>
            <p className="text-sm text-muted-foreground mt-0.5">今月と先月の比較・傾向分析</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(data)}
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-1.5" />
            CSVエクスポート
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-5">
        {/* ─── KPI Cards ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            title="今月の予約"
            icon={Calendar}
            iconClass="text-muted-foreground"
            value={tm.totalAppointments}
            trend={<><Trend current={tm.totalAppointments} prev={lm.totalAppointments} />先月比 {tm.totalAppointments - lm.totalAppointments >= 0 ? "+" : ""}{tm.totalAppointments - lm.totalAppointments}件</>}
            sub={undefined}
            active={activeKpi === "appointments"}
            onClick={() => handleKpiClick("appointments")}
          />
          <KpiCard
            title="新規患者"
            icon={Users}
            iconClass="text-blue-500"
            value={tm.newPatients}
            trend={<><Trend current={tm.newPatients} prev={lm.newPatients} />先月比 {tm.newPatients - lm.newPatients >= 0 ? "+" : ""}{tm.newPatients - lm.newPatients}名</>}
            sub={undefined}
            active={activeKpi === "newPatients"}
            onClick={() => handleKpiClick("newPatients")}
          />
          <KpiCard
            title="キャンセル率"
            icon={TrendingDown}
            iconClass="text-red-500"
            value={`${tm.cancellationRate}%`}
            trend={<><Trend current={lm.cancellationRate} prev={tm.cancellationRate} />先月 {lm.cancellationRate}%</>}
            sub={`キャンセル ${tm.cancelledCount}件 / 無断 ${tm.noShowCount}件`}
            active={activeKpi === "cancellation"}
            onClick={() => handleKpiClick("cancellation")}
          />
          <KpiCard
            title="診療台稼働率"
            icon={Activity}
            iconClass={utilizationRate >= 100 ? "text-amber-500" : "text-emerald-500"}
            value={`${utilizationRate}%`}
            trend={utilizationRate >= 110
              ? <span className="text-amber-600 text-xs font-medium">予約が枠を超えています</span>
              : utilizationRate >= 80
              ? <span className="text-emerald-600 text-xs font-medium">良好な稼働状況です</span>
              : <span className="text-muted-foreground text-xs">枠に余裕があります</span>
            }
            sub={`${totalBooked}件 / ${totalCapacity}枠`}
            active={activeKpi === "utilization"}
            onClick={() => handleKpiClick("utilization")}
          />
        </div>

        {/* ─── KPI Detail Panel ───────────────────────────── */}
        {activeKpi === "appointments" && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">今月の予約 — 内訳</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-600">{tm.completedCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">診療完了</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{tm.totalAppointments - tm.completedCount - tm.cancelledCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">予約済（未来）</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{tm.cancelledCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">キャンセル</div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden flex">
                <div className="h-full bg-blue-500 transition-all" style={{ width: `${tm.totalAppointments > 0 ? (tm.completedCount / tm.totalAppointments) * 100 : 0}%` }} />
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${tm.totalAppointments > 0 ? ((tm.totalAppointments - tm.completedCount - tm.cancelledCount) / tm.totalAppointments) * 100 : 0}%` }} />
                <div className="h-full bg-red-400 transition-all" style={{ width: `${tm.totalAppointments > 0 ? (tm.cancelledCount / tm.totalAppointments) * 100 : 0}%` }} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />完了</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />予約済</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />キャンセル</span>
              </div>
            </CardContent>
          </Card>
        )}
        {activeKpi === "newPatients" && (
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">新規患者 — 先月比較</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{tm.newPatients}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">今月</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-muted-foreground">{lm.newPatients}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">先月</div>
                </div>
              </div>
              <div className="mt-3 p-2 rounded bg-blue-100 dark:bg-blue-900/20 text-xs text-blue-800 dark:text-blue-300 text-center">
                {tm.newPatients > lm.newPatients
                  ? `先月より ${tm.newPatients - lm.newPatients} 名増加 ✓ 集客効果が出ています`
                  : tm.newPatients < lm.newPatients
                  ? `先月より ${lm.newPatients - tm.newPatients} 名減少 — 集客施策を検討しましょう`
                  : "先月と同数です"}
              </div>
            </CardContent>
          </Card>
        )}
        {activeKpi === "cancellation" && (
          <Card className="border-red-200 bg-red-50/50 dark:bg-red-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">キャンセル率 — 内訳</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-red-600">{tm.cancellationRate}%</div>
                  <div className="text-xs text-muted-foreground mt-0.5">今月のキャンセル率</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{tm.cancelledCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">キャンセル件数</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-800">{tm.noShowCount}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">無断キャンセル</div>
                </div>
              </div>
              <div className="mt-3 p-2 rounded bg-red-100 dark:bg-red-900/20 text-xs text-red-800 dark:text-red-300 text-center">
                {tm.cancellationRate > lm.cancellationRate
                  ? `先月（${lm.cancellationRate}%）より悪化 — リマインダー設定を確認してください`
                  : `先月（${lm.cancellationRate}%）より改善 ✓`}
              </div>
            </CardContent>
          </Card>
        )}
        {activeKpi === "utilization" && (
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">診療台稼働率 — スタッフ別内訳</CardTitle>
              <CardDescription className="text-xs">今月の予約枠に対する実予約数の割合（100%超＝枠外で対応）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.staffCapacity.map(s => (
                  <div key={s.staff}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{s.staff}</span>
                      <span className={`text-sm font-bold tabular-nums ${s.percentage >= 110 ? "text-amber-600" : s.percentage >= 80 ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {s.percentage}%
                        <span className="text-xs font-normal text-muted-foreground ml-1.5">({s.booked}/{s.capacity}枠)</span>
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${s.percentage >= 110 ? "bg-amber-400" : s.percentage >= 80 ? "bg-emerald-500" : "bg-emerald-300"}`}
                        style={{ width: `${Math.min(s.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-2 rounded bg-emerald-100 dark:bg-emerald-900/20 text-xs text-emerald-800 dark:text-emerald-300 text-center">
                クリニック全体 {totalBooked}件 / {totalCapacity}枠 = <span className="font-bold">{utilizationRate}%</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Insights ───────────────────────────────────── */}
        {insights.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                自動インサイト
              </CardTitle>
              <CardDescription>データから検出された気づき</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-2">
                {insights.map((ins, i) => (
                  <InsightCard key={i} icon={ins.icon} color={ins.color} text={ins.text} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Tabs ───────────────────────────────────────── */}
        <Tabs defaultValue="trend">
          <TabsList className="mb-4">
            <TabsTrigger value="trend" data-testid="tab-trend">月次推移</TabsTrigger>
            <TabsTrigger value="breakdown" data-testid="tab-breakdown">内訳分析</TabsTrigger>
            <TabsTrigger value="staff" data-testid="tab-staff">スタッフ</TabsTrigger>
          </TabsList>

          {/* ── 月次推移タブ ── */}
          <TabsContent value="trend" className="space-y-4 mt-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">予約数の推移（過去6ヶ月）</CardTitle>
                <CardDescription>今月を含む6ヶ月間の月別予約数と新規患者数</CardDescription>
              </CardHeader>
              <CardContent>
                {(data.monthlyTrend ?? []).every(m => m.appointments === 0) ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">データが蓄積されると推移グラフが表示されます</div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.monthlyTrend ?? []} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = { appointments: "予約数", newPatients: "新規患者", cancellations: "キャンセル" };
                          return [`${value}件`, labels[name] ?? name];
                        }}
                      />
                      <Legend formatter={(value: string) => ({ appointments: "予約数", newPatients: "新規患者", cancellations: "キャンセル" } as Record<string, string>)[value] ?? value} />
                      <Bar dataKey="appointments" fill="#6366f1" radius={[4, 4, 0, 0]} name="appointments" />
                      <Bar dataKey="newPatients" fill="#22c55e" radius={[4, 4, 0, 0]} name="newPatients" />
                      <Bar dataKey="cancellations" fill="#ef4444" radius={[4, 4, 0, 0]} name="cancellations" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

          </TabsContent>

          {/* ── 内訳分析タブ ── */}
          <TabsContent value="breakdown" className="space-y-4 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">治療種別内訳</CardTitle>
                  <CardDescription>今月の治療メニュー別件数</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.treatmentTypeStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">データなし</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={[...data.treatmentTypeStats].sort((a,b) => b.count - a.count)} layout="vertical" margin={{ top: 0, right: 32, left: 4, bottom: 0 }}>
                          <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                          <YAxis type="category" dataKey="type" tick={{ fontSize: 11 }} width={80} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [`${v}件`, "件数"]}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {[...data.treatmentTypeStats].sort((a, b) => b.count - a.count).map((_, i) => (
                              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-3 space-y-1.5">
                        {[...data.treatmentTypeStats].sort((a,b) => b.count - a.count).map((s, i) => (
                          <div key={s.type} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                              <span className="text-muted-foreground">{s.type}</span>
                            </div>
                            <span className="font-medium">{s.count}件 ({s.percentage}%)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">時間帯別予約数</CardTitle>
                  <CardDescription>ピーク時間の確認</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.timeSlotStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">データなし</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={data.timeSlotStats} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number) => [`${v}件`, "予約数"]}
                          />
                          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-2 space-y-1">
                        {[...data.timeSlotStats].sort((a,b) => b.count - a.count).slice(0, 3).map((s, i) => (
                          <div key={s.time} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono w-12">{s.time}</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${s.percentage}%` }} />
                            </div>
                            <span className="font-medium text-foreground w-8 text-right">{s.count}件</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">今月の詳細</CardTitle>
                  <CardDescription>ステータス別件数</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mt-1">
                    {[
                      { label: "診療完了", value: tm.completedCount, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
                      { label: "キャンセル", value: tm.cancelledCount, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/20" },
                      { label: "無断キャンセル", value: tm.noShowCount, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20" },
                    ].map(item => (
                      <div key={item.label} className={`text-center p-3 rounded-lg ${item.bg}`}>
                        <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
                        <div className="text-xs text-muted-foreground mt-1">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── スタッフタブ ── */}
          <TabsContent value="staff" className="mt-0">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">スタッフ別担当件数</CardTitle>
                <CardDescription>今月の担当予約件数と稼働状況</CardDescription>
              </CardHeader>
              <CardContent>
                {data.staffCapacity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">スタッフデータなし</p>
                ) : (
                  <div className="space-y-5">
                    <ResponsiveContainer width="100%" height={Math.max(160, data.staffCapacity.length * 50)}>
                      <BarChart data={data.staffCapacity} layout="vertical" margin={{ top: 0, right: 48, left: 8, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                        <YAxis type="category" dataKey="staff" tick={{ fontSize: 12 }} width={80} />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: number) => [`${v}件`, "担当件数"]}
                        />
                        <Bar dataKey="booked" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 11, formatter: (v: number) => `${v}件` }}>
                          {data.staffCapacity.map((s, i) => (
                            <Cell
                              key={i}
                              fill={s.percentage > 80 ? "#ef4444" : s.percentage > 50 ? "#f59e0b" : "#22c55e"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="space-y-3">
                      {data.staffCapacity.map(s => (
                        <div key={s.staff}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{s.staff}</span>
                            <span className="text-muted-foreground text-xs">{s.booked}件（稼働率 {s.percentage}%）</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${s.percentage > 80 ? "bg-red-500" : s.percentage > 50 ? "bg-amber-500" : "bg-green-500"}`}
                              style={{ width: `${Math.min(s.percentage, 100)}%` }}
                            />
                          </div>
                          {s.percentage > 80 && (
                            <p className="text-xs text-red-600 mt-0.5">稼働率が高めです。担当調整を検討してください。</p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-green-500" />0〜50%</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-amber-500" />51〜80%</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-red-500" />81%以上</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
