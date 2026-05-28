import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, AlertTriangle, CalendarPlus, ChevronRight, Stethoscope, ChevronLeft, UserCheck, RotateCcw, Trash2, Phone, AlertCircle } from "lucide-react";
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

function StatCard({
  title,
  icon: Icon,
  iconClass,
  value,
  sub,
  barValue,
  barColor,
  active,
  onClick,
  testId,
}: {
  title: string;
  icon: React.ElementType;
  iconClass: string;
  value: number | string;
  sub?: string;
  barValue?: number;
  barColor?: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      className={`text-left w-full rounded-xl border transition-all duration-150 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "ring-2 ring-primary shadow-md bg-card" : "bg-card hover:bg-accent/30"}`}
      onClick={onClick}
      data-testid={testId}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className={`text-3xl font-bold ${active ? "text-primary" : ""}`}>{value}</div>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          {active && <ChevronRight className="w-4 h-4 text-primary mb-1" />}
        </div>
        {barValue !== undefined && barValue >= 0 && (
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor ?? "bg-primary"}`}
              style={{ width: `${Math.min(barValue, 100)}%` }}
            />
          </div>
        )}
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
      return res.json();
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
        ...appt, status: "confirmed", startTime: newStart, endTime: newEnd,
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
    if (apt.status === "cancelled") return false;
    if (dateStr < todayStr) return true; // 過去の日付はすべて完了扱い
    if (dateStr > todayStr) return false; // 未来の日付は完了としない
    return apt.endTime <= nowTimeStr; // 今日は時刻で判定
  };

  const isCancelledOrNoShow = (a: Appointment) => a.status === "cancelled" || a.status === "no_show";
  const total = appointments.filter(a => !isCancelledOrNoShow(a)).length;
  const completed = appointments.filter(a => isEffectivelyDone(a)).length;
  const cancelled = appointments.filter(isCancelledOrNoShow).length;
  const highRisk = appointments.filter(a => (a.patient?.cancellationCount ?? 0) + (a.patient?.noShowCount ?? 0) >= 3);

  const filteredAppointments = appointments
    .filter(a => {
      if (activeFilter === "all") return !isCancelledOrNoShow(a);
      if (activeFilter === "completed") return isEffectivelyDone(a);
      if (activeFilter === "cancelled") return isCancelledOrNoShow(a);
      return true;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dayLabel = isTodaySelected ? "本日" : format(currentDate, "M月d日(E)", { locale: ja });
  const filterLabel: Record<FilterType, string> = {
    all: `${dayLabel}の予約`,
    completed: "診療完了の予約",
    cancelled: `${dayLabel}のキャンセル一覧`,
  };

  const handleStatClick = (filter: FilterType) => {
    setActiveFilter(prev => prev === filter ? "all" : filter);
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">ダッシュボード</h1>
          {!isTodaySelected && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setCurrentDate(new Date()); setActiveFilter("all"); }} data-testid="btn-go-today">
              今日に戻る
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => { setCurrentDate(d => subDays(d, 1)); setActiveFilter("all"); }}
            data-testid="btn-prev-day"
            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-accent transition-colors shrink-0">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-foreground">
              {isTodaySelected && <span className="text-primary mr-1.5 text-xs font-bold">今日</span>}
              {format(currentDate, "yyyy年M月d日（E）", { locale: ja })}
            </p>
            <p className="text-xs text-muted-foreground">予約状況</p>
          </div>
          <button
            onClick={() => { setCurrentDate(d => addDays(d, 1)); setActiveFilter("all"); }}
            data-testid="btn-next-day"
            className="w-7 h-7 rounded-lg border flex items-center justify-center hover:bg-accent transition-colors shrink-0">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-5 flex-1">
        {/* ─── Stats Grid ─────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title={`${dayLabel}の予約`}
            icon={Calendar}
            iconClass="text-muted-foreground"
            value={isLoading ? "…" : total}
            sub={total > 0 ? `完了 ${Math.round((completed / total) * 100)}%` : "件"}
            barValue={total > 0 ? (completed / total) * 100 : undefined}
            barColor="bg-primary"
            active={activeFilter === "all"}
            onClick={() => handleStatClick("all")}
            testId="stat-total"
          />
          <StatCard
            title="診療完了"
            icon={TrendingUp}
            iconClass="text-primary"
            value={isLoading ? "…" : completed}
            sub={total > 0 ? `残り ${total - completed} 件` : "件"}
            barValue={total > 0 ? (completed / total) * 100 : undefined}
            barColor="bg-blue-500"
            active={activeFilter === "completed"}
            onClick={() => handleStatClick("completed")}
            testId="stat-completed"
          />
          <StatCard
            title="キャンセル"
            icon={AlertTriangle}
            iconClass="text-red-400"
            value={isLoading ? "…" : cancelled}
            sub="本日のキャンセル数"
            active={activeFilter === "cancelled"}
            onClick={() => handleStatClick("cancelled")}
            testId="stat-cancelled"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-5">
          {/* ─── Appointment List ───────────────────────── */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{filterLabel[activeFilter]}</CardTitle>
                  <span className="text-xs text-muted-foreground">{filteredAppointments.length}件</span>
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
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : filteredAppointments.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <Calendar className="h-9 w-9 mx-auto mb-2 opacity-25" />
                    <p className="text-sm">
                      {activeFilter === "completed" ? "診療完了の予約はありません" : activeFilter === "cancelled" ? `${dayLabel}のキャンセルはありません` : `${dayLabel}の予約はありません`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredAppointments.map(apt => {
                      const isDone = isEffectivelyDone(apt);
                      const isActuallyCompleted = apt.status === "completed";
                      const canComplete = !isDone && apt.status !== "cancelled";
                      return (
                        <div
                          key={apt.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer hover:brightness-95 ${treatmentColors[apt.treatmentType] || "bg-card border-border"}`}
                          onClick={() => handleApptClick(apt)}
                          data-testid={`appt-${apt.id}`}
                        >
                          <div className="text-xs font-mono font-semibold w-20 shrink-0 text-muted-foreground">
                            {apt.startTime.slice(0, 5)}<br />{apt.endTime.slice(0, 5)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate text-sm">{apt.patient?.name || "不明"}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                              <span>{apt.treatmentType}</span>
                              {apt.staff && <span>• {apt.staff.name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {canComplete && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={e => { e.stopPropagation(); completeMutation.mutate(apt.id); }}
                                disabled={completeMutation.isPending}
                                data-testid={`button-complete-${apt.id}`}
                              >
                                <Stethoscope className="w-3 h-3 mr-1" />完了
                              </Button>
                            )}
                            {isDone && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleSlotClick(dateStr, "09:00", apt.staff?.id, apt.patient?.id, apt.patient?.name);
                                }}
                                title="次回予約を取る"
                                data-testid={`button-quick-next-${apt.id}`}
                              >
                                <CalendarPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                              apt.status === "no_show" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                              apt.status === "cancelled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                              isDone ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                              "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
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
                          className="w-full justify-start gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
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

          {/* ─── Right column ───────────────────────────── */}
          <div className="space-y-4">
            {total > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{dayLabel}の進捗</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">診療完了</span>
                      <span className="font-semibold">{completed}<span className="text-muted-foreground font-normal"> / {total}件</span></span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 bg-blue-500"
                        style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {highRisk.length > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    注意患者（{highRisk.length}名）
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {highRisk.map(apt => (
                      <button
                        key={apt.id}
                        className="w-full text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/10 rounded p-1 -m-1 transition-colors"
                        onClick={() => handleApptClick(apt)}
                        data-testid={`button-highrisk-${apt.id}`}
                      >
                        <div className="font-medium">{apt.patient?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          キャンセル {apt.patient?.cancellationCount}回 / 無断 {apt.patient?.noShowCount}回
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {total > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">治療種別</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {Array.from(
                      appointments
                        .filter(a => a.status !== "cancelled")
                        .reduce((m, a) => m.set(a.treatmentType, (m.get(a.treatmentType) ?? 0) + 1), new Map<string, number>())
                    )
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground truncate">{type}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                            <span className="font-medium w-5 text-right">{count}</span>
                          </div>
                        </div>
                      ))
                    }
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
