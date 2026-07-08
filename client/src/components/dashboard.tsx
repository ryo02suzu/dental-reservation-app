import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, AlertTriangle, CalendarPlus, ChevronRight, Stethoscope, ChevronLeft, UserCheck, RotateCcw, Trash2, Phone, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { AppointmentModal } from "@/components/appointment-modal";
import { format, addDays, subDays, isToday, differenceInMinutes, parse, addMinutes } from "date-fns";
import { ja } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  confirmationStatus: string;
  treatmentType: string;
  visitType?: string | null;
  chairNumber?: number;
  notes?: string;
  cancellationReason?: string;
  serviceId?: string;
  patient?: { id: string; name: string; patientNumber: string; phone?: string; cancellationCount: number; noShowCount: number; allergies?: string; medicalNotes?: string };
  staff?: { id: string; name: string; role: string };
}

type FilterType = "all" | "completed" | "cancelled";

const treatmentColors: Record<string, string> = {
  定期検診: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200",
  虫歯治療: "bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200",
  クリーニング: "bg-green-50 border-green-200 text-green-900 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200",
  矯正相談: "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-200",
  抜歯: "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-200",
};

// 治療種別の左アクセント（既存のtreatmentColors系の色のみ再利用）
// 治療種別のアクセント。色は増やさず、各行の治療名ピル（treatmentColors）が
// 種別の色分けを担うため、ここでは既存の中立トークンに統一する。
const treatmentAccent: Record<string, string> = {};

function StatCard({
  title,
  icon: Icon,
  iconClass,
  value,
  sub,
  ratio,
  ringColor,
  active,
  onClick,
  testId,
}: {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  value: number | string;
  sub?: string;
  ratio?: number; // 0..100、リング表示用
  ringColor?: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = ratio !== undefined ? Math.min(Math.max(ratio, 0), 100) : undefined;
  return (
    <button
      className={`group text-left w-full rounded-2xl border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "ring-2 ring-primary border-primary bg-card shadow-md" : "border-card-border bg-card hover:shadow-md hover:-translate-y-0.5"}`}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-xs md:text-sm font-medium text-muted-foreground leading-tight min-w-0 truncate">{title}</span>
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <div className={`text-3xl md:text-4xl font-bold tabular-nums leading-none ${active ? "text-primary" : ""}`}>{value}</div>
            {sub && <p className="text-xs text-muted-foreground mt-2 truncate">{sub}</p>}
          </div>
          {pct !== undefined ? (
            <div className="relative h-12 w-12 shrink-0">
              <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
                <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
                <circle
                  cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
                  className={ringColor ?? "stroke-primary"}
                  strokeDasharray={circ}
                  strokeDashoffset={circ - (circ * pct) / 100}
                  style={{ transition: "stroke-dashoffset 700ms ease" }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-muted-foreground">
                {Math.round(pct)}%
              </span>
            </div>
          ) : (
            active && <ChevronRight className="w-5 h-5 text-primary shrink-0 mb-1" />
          )}
        </div>
      </div>
    </button>
  );
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [initialSlotData, setInitialSlotData] = useState<{ date: string; time: string; staffId?: string; patientId?: string; patientName?: string } | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [cancelledSheetAppt, setCancelledSheetAppt] = useState<Appointment | null>(null);

  const dateStr = format(currentDate, "yyyy-MM-dd");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isTodaySelected = isToday(currentDate);

  const handleSlotClick = (date: string, time: string, staffId?: string, patientId?: string, patientName?: string) => {
    setSelectedAppointment(null);
    setInitialSlotData({ date, time, staffId, patientId, patientName });
    setIsModalOpen(true);
  };

  const handleApptClick = (appt: Appointment) => {
    if (appt.status === "cancelled" || appt.status === "no_show") {
      setCancelledSheetAppt(appt);
      return;
    }
    setSelectedAppointment(appt);
    setInitialSlotData(null);
    setIsModalOpen(true);
  };

  const { data: appointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", dateStr],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments?date=${dateStr}`);
      const d = await res.json();
      return Array.isArray(d) ? d : [];
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const appt = appointments.find(a => a.id === id);
      return (await apiRequest("PUT", `/api/appointments/${id}`, { ...appt, status: "completed" })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({ title: "診療完了にしました" });
    },
    onError: () => toast({ title: "更新に失敗しました", variant: "destructive" }),
  });

  const arriveNowMutation = useMutation({
    mutationFn: async (appt: Appointment) => {
      const now = new Date();
      const newStart = format(now, "HH:mm:ss");
      const orig = parse(`${appt.date} ${appt.startTime}`, "yyyy-MM-dd HH:mm:ss", new Date());
      const origEnd = parse(`${appt.date} ${appt.endTime}`, "yyyy-MM-dd HH:mm:ss", new Date());
      const durationMins = differenceInMinutes(origEnd, orig);
      const newEnd = format(addMinutes(now, durationMins), "HH:mm:ss");
      return (await apiRequest("PUT", `/api/appointments/${appt.id}`, {
        ...appt, status: "confirmed", date: format(now, "yyyy-MM-dd"), startTime: newStart, endTime: newEnd,
      })).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setCancelledSheetAppt(null);
      toast({ title: "受付しました。現在時刻で更新しました" });
    },
    onError: () => toast({ title: "更新に失敗しました", variant: "destructive" }),
  });

  const deleteApptMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setCancelledSheetAppt(null);
      toast({ title: "予約枠を削除しました" });
    },
    onError: () => toast({ title: "削除に失敗しました", variant: "destructive" }),
  });

  // 終了時間が過ぎた予約は自動的に完了扱いにする（UIのみ・DB更新なし）
  // 過去の日付はすべて終了扱い、未来の日付は時刻比較しない
  const nowTimeStr = format(new Date(), "HH:mm:ss");
  const isEffectivelyDone = (apt: Appointment) => {
    if (apt.status === "completed") return true;
    if (apt.status === "cancelled" || apt.status === "no_show") return false; // 無断キャンセルは完了に含めない
    if (dateStr < todayStr) return true; // 過去の日付はすべて完了扱い
    if (dateStr > todayStr) return false; // 未来の日付は完了としない
    return apt.endTime <= nowTimeStr; // 今日は時刻で判定
  };

  const isCancelledOrNoShow = (a: Appointment) => a.status === "cancelled" || a.status === "no_show";
  const total = appointments.filter(a => !isCancelledOrNoShow(a)).length;
  const completed = appointments.filter(a => isEffectivelyDone(a)).length;
  const cancelled = appointments.filter(isCancelledOrNoShow).length;
  const remaining = total - completed;
  const highRisk = appointments.filter(a => (a.patient?.cancellationCount ?? 0) + (a.patient?.noShowCount ?? 0) >= 3);
  const completionPct = total > 0 ? (completed / total) * 100 : 0;

  const filteredAppointments = appointments
    .filter(a => {
      if (activeFilter === "all") return !isCancelledOrNoShow(a);
      if (activeFilter === "completed") return isEffectivelyDone(a);
      if (activeFilter === "cancelled") return isCancelledOrNoShow(a);
      return true;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // 次の未完了予約（今日のみ強調）
  const nextUp = isTodaySelected
    ? appointments
        .filter(a => !isCancelledOrNoShow(a) && !isEffectivelyDone(a))
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0]
    : undefined;

  const dayLabel = isTodaySelected ? "本日" : format(currentDate, "M月d日(E)", { locale: ja });
  const filterLabel: Record<FilterType, string> = {
    all: `${dayLabel}の予約`,
    completed: "診療完了の予約",
    cancelled: `${dayLabel}のキャンセル一覧`,
  };

  const handleStatClick = (filter: FilterType) => {
    setActiveFilter(prev => prev === filter ? "all" : filter);
  };

  const treatmentBreakdown = Array.from(
    appointments
      .filter(a => a.status !== "cancelled")
      .reduce((m, a) => m.set(a.treatmentType, (m.get(a.treatmentType) ?? 0) + 1), new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* ─── Page header（固定）─────────────────────────── */}
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight">ダッシュボード</h1>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">
              {format(currentDate, "yyyy年M月d日（E）", { locale: ja })} の診療状況
            </p>
          </div>
          {/* 日付ナビゲーション（ヘッダー右） */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!isTodaySelected && (
              <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => { setCurrentDate(new Date()); setActiveFilter("all"); }} data-testid="btn-go-today">
                今日に戻る
              </Button>
            )}
            <button
              onClick={() => { setCurrentDate(d => subDays(d, 1)); setActiveFilter("all"); }}
              data-testid="btn-prev-day"
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors shrink-0 active:scale-95">
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <label className="relative h-9 px-3 rounded-lg border border-border flex items-center gap-1.5 cursor-pointer hover:bg-accent transition-colors" title="日付を選択">
              {isTodaySelected && <span className="text-primary text-xs font-bold">今日</span>}
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={dateStr}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setCurrentDate(parse(e.target.value, "yyyy-MM-dd", new Date()));
                  setActiveFilter("all");
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="input-dashboard-date"
              />
            </label>
            <button
              onClick={() => { setCurrentDate(d => addDays(d, 1)); setActiveFilter("all"); }}
              data-testid="btn-next-day"
              className="w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-accent transition-colors shrink-0 active:scale-95">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-5 md:space-y-6 flex-1">
        {/* ─── Hero: 主要指標 ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-2.5 md:gap-4">
          <StatCard
            title={`${dayLabel}の予約`}
            icon={Calendar}
            iconClass="text-muted-foreground"
            value={isLoading ? "…" : total}
            sub={total > 0 ? `完了 ${completed} / 残り ${remaining}` : "件の予約"}
            ratio={total > 0 ? completionPct : undefined}
            ringColor="stroke-primary"
            active={activeFilter === "all"}
            onClick={() => handleStatClick("all")}
            testId="stat-total"
          />
          <StatCard
            title="診療完了"
            icon={TrendingUp}
            iconClass="text-primary"
            value={isLoading ? "…" : completed}
            sub={total > 0 ? `達成率 ${Math.round(completionPct)}%` : "件"}
            ratio={total > 0 ? completionPct : undefined}
            ringColor="stroke-primary"
            active={activeFilter === "completed"}
            onClick={() => handleStatClick("completed")}
            testId="stat-completed"
          />
          <StatCard
            title="キャンセル"
            icon={AlertTriangle}
            iconClass="text-red-400"
            value={isLoading ? "…" : cancelled}
            sub={`${dayLabel}のキャンセル数`}
            active={activeFilter === "cancelled"}
            onClick={() => handleStatClick("cancelled")}
            testId="stat-cancelled"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* ─── 主役：予約リスト ───────────────────────── */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {/* 次の患者ハイライト（今日・未完了がある場合のみ） */}
            {!isLoading && nextUp && activeFilter === "all" && (
              <button
                onClick={() => handleApptClick(nextUp)}
                className="w-full text-left rounded-2xl border border-primary/40 bg-primary/5 p-4 md:p-5 transition-all hover:shadow-md active:scale-[0.99]"
                data-testid={`next-up-${nextUp.id}`}
              >
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-primary/15 px-3 py-2 shrink-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">次の診療</span>
                    <span className="text-xl md:text-2xl font-bold tabular-nums text-primary leading-none mt-0.5">{nextUp.startTime.slice(0, 5)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-base md:text-lg truncate">{nextUp.patient?.name || "不明"}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate mt-0.5">
                      {nextUp.treatmentType}{nextUp.staff && ` ・ ${nextUp.staff.name}`}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-primary shrink-0" />
                </div>
              </button>
            )}

            <Card className="rounded-2xl border-card-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{filterLabel[activeFilter]}</CardTitle>
                  <Badge variant="secondary" className="tabular-nums shrink-0">{filteredAppointments.length}件</Badge>
                </div>
                {activeFilter === "completed" && (
                  <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                    <Stethoscope className="w-3 h-3" />
                    本日完了した診療の一覧です
                  </p>
                )}
                {activeFilter === "cancelled" && (
                  <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" />
                    本日キャンセルされた予約の一覧です
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2.5">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                        <Skeleton className="h-11 w-1 rounded-full shrink-0" />
                        <Skeleton className="h-10 w-12 shrink-0 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="h-6 w-16 rounded-full shrink-0" />
                      </div>
                    ))}
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calendar className="h-10 w-10 mx-auto mb-3 opacity-25" />
                    <p className="text-sm">
                      {activeFilter === "completed" ? "診療完了の予約はありません" : activeFilter === "cancelled" ? `${dayLabel}のキャンセルはありません` : `${dayLabel}の予約はありません`}
                    </p>
                    {activeFilter === "all" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4 h-10"
                        onClick={() => handleSlotClick(dateStr, "09:00")}
                        data-testid="button-empty-new-appt"
                      >
                        <CalendarPlus className="w-4 h-4 mr-1.5" />
                        予約を作成
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredAppointments.map(apt => {
                      const isDone = isEffectivelyDone(apt);
                      const isActuallyCompleted = apt.status === "completed";
                      const canComplete = !isDone && apt.status !== "cancelled";
                      const accent = treatmentAccent[apt.treatmentType] || "bg-muted-foreground/30";
                      return (
                        <div
                          key={apt.id}
                          className="group flex items-stretch gap-3 p-3 rounded-xl border border-card-border bg-card transition-all cursor-pointer hover:shadow-sm hover:border-primary/30"
                          onClick={() => handleApptClick(apt)}
                          data-testid={`appt-${apt.id}`}
                        >
                          {/* 治療種別アクセント */}
                          <div className={`w-1 rounded-full shrink-0 ${accent}`} />
                          {/* 時間ブロック */}
                          <div className="flex flex-col items-center justify-center rounded-lg bg-muted px-2.5 py-1.5 w-16 shrink-0 leading-tight">
                            <span className="text-sm font-bold tabular-nums">{apt.startTime.slice(0, 5)}</span>
                            <span className="text-[10px] text-muted-foreground tabular-nums">{apt.endTime.slice(0, 5)}</span>
                          </div>
                          {/* 患者・治療 */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="font-semibold truncate text-sm flex items-center gap-1.5">
                              {(apt.visitType === "first" || (apt.treatmentType || "").includes("初診")) && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary text-primary-foreground">初診</span>}
                              <span className="truncate">{apt.patient?.name || "不明"}</span>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                              <span className={`px-1.5 py-0.5 rounded-md border text-[11px] ${treatmentColors[apt.treatmentType] || "bg-card border-border"}`}>{apt.treatmentType}</span>
                              {apt.staff && <span className="truncate">{apt.staff.name}</span>}
                            </div>
                          </div>
                          {/* アクション + ステータス */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canComplete && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 md:h-8 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={e => { e.stopPropagation(); completeMutation.mutate(apt.id); }}
                                disabled={completeMutation.isPending}
                                data-testid={`button-complete-${apt.id}`}
                              >
                                <Stethoscope className="w-3.5 h-3.5 mr-1" />完了
                              </Button>
                            )}
                            {isDone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 md:h-8 md:w-8"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleSlotClick(dateStr, "09:00", apt.staff?.id, apt.patient?.id, apt.patient?.name);
                                }}
                                title="次回予約を取る"
                                data-testid={`button-quick-next-${apt.id}`}
                              >
                                <CalendarPlus className="h-4 w-4" />
                              </Button>
                            )}
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${
                              apt.status === "no_show" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                              apt.status === "cancelled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                              isDone ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                              "bg-primary/20 text-primary-foreground dark:bg-primary/25 dark:text-primary"
                            }`}>
                              {apt.status === "no_show" ? "無断キャンセル" : apt.status === "cancelled" ? "キャンセル" : isDone && !isActuallyCompleted ? "時間経過" : isDone ? "完了" : "予約済"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ─── キャンセル/無断キャンセル クイックアクションシート ─── */}
          <Dialog open={!!cancelledSheetAppt} onOpenChange={open => { if (!open) setCancelledSheetAppt(null); }}>
            <DialogContent className="max-w-sm">
              {cancelledSheetAppt && (() => {
                const appt = cancelledSheetAppt;
                const isNoShow = appt.status === "no_show";
                const riskCount = (appt.patient?.cancellationCount ?? 0) + (appt.patient?.noShowCount ?? 0);
                const isHighRisk = riskCount >= 2;
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${isNoShow ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"}`}>
                          {isNoShow ? "無断キャンセル" : "キャンセル済み"}
                        </span>
                      </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 pt-1">
                      {/* 患者情報 */}
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm">{appt.patient?.name || "不明"}</p>
                            <p className="text-xs text-muted-foreground">{appt.patient?.patientNumber}</p>
                          </div>
                          {appt.patient?.phone && (
                            <a
                              href={`tel:${appt.patient.phone}`}
                              className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
                              data-testid="link-patient-phone"
                              onClick={e => e.stopPropagation()}
                            >
                              <Phone className="w-3 h-3" />{appt.patient.phone}
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          元の予約: {appt.startTime.slice(0, 5)} 〜 {appt.endTime.slice(0, 5)} / {appt.treatmentType}
                        </p>
                        {appt.cancellationReason && (
                          <p className="text-xs text-muted-foreground">理由: {appt.cancellationReason}</p>
                        )}
                      </div>

                      {/* リスクバッジ */}
                      {isHighRisk && (
                        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          過去にキャンセル {appt.patient?.cancellationCount}回・無断 {appt.patient?.noShowCount}回の履歴があります
                        </div>
                      )}

                      {/* アクションボタン */}
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        <Button
                          className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                          onClick={() => arriveNowMutation.mutate(appt)}
                          disabled={arriveNowMutation.isPending}
                          data-testid="button-arrive-now"
                        >
                          <UserCheck className="w-4 h-4" />
                          今来院された（現在時刻で受付）
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2"
                          onClick={() => {
                            setCancelledSheetAppt(null);
                            setTimeout(() => {
                              setSelectedAppointment(null);
                              setInitialSlotData({ date: dateStr, time: "09:00", staffId: appt.staff?.id, patientId: appt.patient?.id, patientName: appt.patient?.name });
                              setIsModalOpen(true);
                            }, 150);
                          }}
                          data-testid="button-rebook"
                        >
                          <RotateCcw className="w-4 h-4" />
                          別の日時で再予約する
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          onClick={() => deleteApptMutation.mutate(appt.id)}
                          disabled={deleteApptMutation.isPending}
                          data-testid="button-delete-appt"
                        >
                          <Trash2 className="w-4 h-4" />
                          枠を削除する
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </DialogContent>
          </Dialog>

          <AppointmentModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            appointment={selectedAppointment as any}
            initialSlotData={initialSlotData}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/appointments"] })}
            onSlotClick={handleSlotClick}
          />

          {/* ─── サイド情報 ───────────────────────────── */}
          <div className="space-y-4 md:space-y-6">
            {/* 進捗カード */}
            <Card className="rounded-2xl border-card-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">{dayLabel}の進捗</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <Skeleton className="h-20 w-full rounded-xl" />
                ) : total > 0 ? (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-3xl font-bold tabular-nums leading-none">{Math.round(completionPct)}<span className="text-lg text-muted-foreground">%</span></div>
                        <p className="text-xs text-muted-foreground mt-1">診療完了率</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold tabular-nums">{completed} <span className="text-muted-foreground font-normal">/ {total}件</span></div>
                        <p className="text-xs text-muted-foreground mt-1">残り {remaining}件</p>
                      </div>
                    </div>
                    <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-blue-500"
                        style={{ width: `${completionPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-25" />
                    <p className="text-xs">予約がありません</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 注意患者 */}
            {highRisk.length > 0 && (
              <Card className="rounded-2xl border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    注意患者（{highRisk.length}名）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {highRisk.map(apt => (
                      <button
                        key={apt.id}
                        className="w-full text-left flex items-center justify-between gap-2 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg p-2 transition-colors"
                        onClick={() => handleApptClick(apt)}
                        data-testid={`button-highrisk-${apt.id}`}
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{apt.patient?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            キャンセル {apt.patient?.cancellationCount}回 / 無断 {apt.patient?.noShowCount}回
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-red-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 治療種別 */}
            {total > 0 && (
              <Card className="rounded-2xl border-card-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">治療種別</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {treatmentBreakdown.map(([type, count]) => (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${treatmentAccent[type] || "bg-muted-foreground/40"}`} />
                            <span className="text-muted-foreground truncate">{type}</span>
                          </span>
                          <span className="font-semibold tabular-nums shrink-0 ml-2">{count}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${treatmentAccent[type] || "bg-primary"}`}
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
