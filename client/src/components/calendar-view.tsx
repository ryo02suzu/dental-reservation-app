import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay, parseISO, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Sun, Sunset, Eye, Ban, Clock, Users, Armchair, GripVertical, RotateCcw, Check, Minus } from "lucide-react";
import { AppointmentModal } from "@/components/appointment-modal";
import { getHolidayName } from "@/lib/holidays";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";

type DayAxis = "staff" | "chair";

type CalendarMode = "view" | "book" | "holiday";

// 休診エディタに未保存の変更があるかを画面遷移側（ボトムナビ等）から参照するためのフラグ
export const holidayEditorGuard = { dirty: false };

interface Patient { id: string; name: string; patientNumber: string; cancellationCount: number; noShowCount: number; recallIntervalMonths?: number }
interface Staff { id: string; name: string; role: string; showInCalendar?: boolean | null; employmentType?: string | null }
interface ShiftRecord { id: string; staffId: string; date: string; status: string }
interface Holiday { id: string; date: string; name?: string | null; reason?: string | null; startTime?: string | null; endTime?: string | null }
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
  staffId?: string;
  serviceId?: string;
  patientId: string;
  patient?: Patient;
  staff?: Staff;
}
interface BusinessHours {
  dayOfWeek: number;
  openTime?: string | null;
  closeTime?: string | null;
  afternoonOpenTime?: string | null;
  afternoonCloseTime?: string | null;
  isClosed: boolean;
}

const TREATMENT_COLOR_RULES: Array<{ match: string | RegExp; colors: { bar: string; bg: string; text: string } }> = [
  { match: /定期検診|予防|recall/i,      colors: { bar: "bg-blue-400",    bg: "bg-blue-50 dark:bg-blue-900/20",    text: "text-blue-900 dark:text-blue-200" } },
  { match: /クリーニング|PMTC|清掃/,      colors: { bar: "bg-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-900 dark:text-emerald-200" } },
  { match: /フッ素|フッ化/,               colors: { bar: "bg-cyan-400",    bg: "bg-cyan-50 dark:bg-cyan-900/20",    text: "text-cyan-900 dark:text-cyan-200" } },
  { match: /虫歯|CR充填/,                colors: { bar: "bg-red-400",     bg: "bg-red-50 dark:bg-red-900/20",      text: "text-red-900 dark:text-red-200" } },
  { match: /根管/,                       colors: { bar: "bg-pink-400",    bg: "bg-pink-50 dark:bg-pink-900/20",    text: "text-pink-900 dark:text-pink-200" } },
  { match: /歯周病|SRP|歯肉/,            colors: { bar: "bg-teal-400",    bg: "bg-teal-50 dark:bg-teal-900/20",    text: "text-teal-900 dark:text-teal-200" } },
  { match: /被せ物|詰め物|セット/,         colors: { bar: "bg-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20",  text: "text-amber-900 dark:text-amber-200" } },
  { match: /義歯|入れ歯/,                colors: { bar: "bg-slate-400",   bg: "bg-slate-50 dark:bg-slate-900/20",  text: "text-slate-900 dark:text-slate-200" } },
  { match: /親知らず/,                   colors: { bar: "bg-orange-500",  bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-900 dark:text-orange-200" } },
  { match: /抜歯/,                       colors: { bar: "bg-orange-400",  bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-900 dark:text-orange-200" } },
  { match: /ホワイトニング/,               colors: { bar: "bg-yellow-400",  bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-900 dark:text-yellow-200" } },
  { match: /セラミック|ラミネート/,         colors: { bar: "bg-violet-400",  bg: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-900 dark:text-violet-200" } },
  { match: /矯正|相談/,                  colors: { bar: "bg-purple-400",  bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-900 dark:text-purple-200" } },
  { match: /小児|子ども|乳歯/,            colors: { bar: "bg-green-400",   bg: "bg-green-50 dark:bg-green-900/20",  text: "text-green-900 dark:text-green-200" } },
  { match: /初診|検査/,                  colors: { bar: "bg-indigo-400",  bg: "bg-indigo-50 dark:bg-indigo-900/20", text: "text-indigo-900 dark:text-indigo-200" } },
];
const DEFAULT_COLOR = { bar: "bg-gray-400", bg: "bg-gray-50 dark:bg-gray-800/40", text: "text-gray-900 dark:text-gray-200" };
function getTreatmentColor(t: string) {
  for (const rule of TREATMENT_COLOR_RULES) {
    if (typeof rule.match === "string" ? t.includes(rule.match) : rule.match.test(t)) return rule.colors;
  }
  return DEFAULT_COLOR;
}

const SLOT_MINUTES = 30;
const SLOT_HEIGHT = 48;

function toMins(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── Concurrent appointment layout algorithm ───────────────────────────────
// 同じスタッフ列で時間が重なる予約を横並びに配置する
function layoutAppts(appts: Appointment[]): Array<{ appt: Appointment; left: number; width: number }> {
  if (appts.length === 0) return [];
  if (appts.length === 1) return [{ appt: appts[0], left: 0, width: 1 }];

  const ms = (a: Appointment) => toMins(a.startTime.slice(0, 5));
  const me = (a: Appointment) => a.endTime ? toMins(a.endTime.slice(0, 5)) : ms(a) + SLOT_MINUTES;

  const sorted = [...appts].sort((a, b) => ms(a) - ms(b));

  // 貪欲法で列番号を割り当て（列が空いたら再利用）
  const colEnd: number[] = [];
  const colOf = new Map<string, number>();

  for (const a of sorted) {
    const start = ms(a);
    const end = me(a);
    let col = colEnd.findIndex(e => e <= start);
    if (col < 0) { col = colEnd.length; colEnd.push(end); }
    else colEnd[col] = end;
    colOf.set(a.id, col);
  }

  return sorted.map(a => {
    const start = ms(a);
    const end = me(a);
    const col = colOf.get(a.id) ?? 0;
    // この予約と時間が重なる全予約の中で最大列番号を求める
    const concurrent = sorted.filter(b => ms(b) < end && me(b) > start);
    const maxCol = Math.max(...concurrent.map(b => colOf.get(b.id) ?? 0));
    const numCols = maxCol + 1;
    return { appt: a, left: col / numCols, width: 1 / numCols };
  });
}

function getSlotStatus(slot: string, hours: BusinessHours | undefined): "open" | "lunch" | "closed" {
  if (!hours || hours.isClosed) return "closed";
  const slotMins = toMins(slot);
  const morningOpen  = hours.openTime  ? toMins(hours.openTime)  : null;
  const morningClose = hours.closeTime ? toMins(hours.closeTime) : null;
  const afOpen  = hours.afternoonOpenTime  ? toMins(hours.afternoonOpenTime)  : null;
  const afClose = hours.afternoonCloseTime ? toMins(hours.afternoonCloseTime) : null;

  const inMorning = morningOpen !== null && morningClose !== null && slotMins >= morningOpen && slotMins < morningClose;
  const inAfternoon = afOpen !== null && afClose !== null && slotMins >= afOpen && slotMins < afClose;

  if (inMorning || inAfternoon) return "open";

  // Is it the gap (lunch break) between morning close and afternoon open?
  if (morningClose !== null && afOpen !== null && slotMins >= morningClose && slotMins < afOpen) return "lunch";

  return "closed";
}

function computeHourRange(hours: BusinessHours[]): { startHour: number; endHour: number } {
  const opens: number[] = [];
  const closes: number[] = [];
  for (const h of hours) {
    if (h.isClosed) continue;
    if (h.openTime) opens.push(Math.floor(toMins(h.openTime) / 60));
    if (h.afternoonCloseTime) closes.push(Math.ceil(toMins(h.afternoonCloseTime) / 60));
    else if (h.closeTime) closes.push(Math.ceil(toMins(h.closeTime) / 60));
  }
  return {
    startHour: opens.length > 0 ? Math.min(...opens) : 9,
    endHour: closes.length > 0 ? Math.max(...closes) : 18,
  };
}

export function CalendarView({ initialDate }: { initialDate?: Date }) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [currentDate, setCurrentDate] = useState(initialDate ?? new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [initialSlotData, setInitialSlotData] = useState<{ date: string; time: string; staffId?: string; patientId?: string; patientName?: string } | null>(null);
  const [filterStaffId, setFilterStaffId] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("view");
  const [dayAxis, setDayAxis] = useState<DayAxis>("staff");
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // 休診エディタに未保存の変更があるとき、モード切替で誤って破棄しないためのガード
  const holidayDirtyRef = useRef(false);
  const switchCalendarMode = (mode: CalendarMode) => {
    if (calendarMode === "holiday" && mode !== "holiday" && holidayDirtyRef.current) {
      if (!window.confirm("保存していない休診の変更があります。破棄して移動しますか？")) return;
      holidayDirtyRef.current = false;
    }
    setCalendarMode(mode);
  };

  const { data: businessHours = [], isLoading: businessHoursLoading } = useQuery<BusinessHours[]>({
    queryKey: ["/api/business-hours"],
  });

  const { data: clinicSettings } = useQuery<{ closedOnHolidays?: boolean; chairsCount?: number; slotIntervalMinutes?: number }>({
    queryKey: ["/api/clinic-settings"],
  });
  const closedOnHolidays = clinicSettings?.closedOnHolidays !== false;
  const chairsCount = clinicSettings?.chairsCount ?? 5;
  const slotIntervalMinutes = clinicSettings?.slotIntervalMinutes ?? 30;

  const { data: clinicHolidays = [] } = useQuery<Holiday[]>({
    queryKey: ["/api/holidays"],
  });

  const dateRange = useCallback(() => {
    if (viewMode === "day") {
      const d = format(currentDate, "yyyy-MM-dd");
      return { startDate: d, endDate: d };
    } else if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return { startDate: format(start, "yyyy-MM-dd"), endDate: format(addDays(start, 6), "yyyy-MM-dd") };
    } else {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      return { startDate: format(new Date(year, month, 1), "yyyy-MM-dd"), endDate: format(new Date(year, month + 1, 0), "yyyy-MM-dd") };
    }
  }, [viewMode, currentDate]);

  const range = dateRange();
  const { data: allAppointments = [], isLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", range],
    queryFn: async () => {
      const r = await fetch(`/api/appointments?startDate=${range.startDate}&endDate=${range.endDate}`, { credentials: "include" });
      if (!r.ok) throw new Error(`予約の取得に失敗しました (${r.status})`);
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
  });
  const { data: allStaff = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  // showInCalendar=false のスタッフをカレンダー列から除外（応答が配列でない場合も安全に）
  const staff = (Array.isArray(allStaff) ? allStaff : []).filter(s => s.showInCalendar !== false);

  // 承認済みシフト取得（非常勤・契約スタッフの出勤日特定に使用）
  const shiftMonth = format(currentDate, "yyyy-MM");
  const { data: approvedShifts = [] } = useQuery<ShiftRecord[]>({
    queryKey: ["/api/shifts", shiftMonth],
    queryFn: async () => {
      const r = await fetch(`/api/shifts?month=${shiftMonth}`, { credentials: "include" });
      if (!r.ok) throw new Error(`シフトの取得に失敗しました (${r.status})`);
      const d = await r.json();
      return Array.isArray(d) ? d : [];
    },
  });
  const approvedShiftSet = new Set<string>(
    (Array.isArray(approvedShifts) ? approvedShifts : []).filter(s => s.status === "approved").map(s => `${s.staffId}:${s.date}`)
  );

  // 日ビュー: 非常勤・契約スタッフはシフト承認済みの日のみ表示
  const currentDateStr = format(currentDate, "yyyy-MM-dd");
  const staffForDay = staff.filter(s => {
    if (s.employmentType !== "parttime" && s.employmentType !== "contract") return true;
    return approvedShiftSet.has(`${s.id}:${currentDateStr}`);
  });

  // スタッフフィルター適用（応答が配列でない場合も安全に）
  const safeAppointments = Array.isArray(allAppointments) ? allAppointments : [];
  const appointments = filterStaffId
    ? safeAppointments.filter(a => a.staffId === filterStaffId)
    : safeAppointments;

  const navigate = (dir: 1 | -1) => {
    if (viewMode === "day") setCurrentDate(prev => addDays(prev, dir));
    else if (viewMode === "week") setCurrentDate(prev => dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1));
    else setCurrentDate(prev => dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  // カレンダーの空き枠タップ：予約モードのときだけ新規予約を開く（閲覧モードでは何もしない）
  const handleSlotClick = (date: string, time: string, staffId?: string) => {
    if (calendarMode !== "book") return;
    setSelectedAppointment(null);
    setInitialSlotData({ date, time, staffId });
    setIsModalOpen(true);
  };

  // 予約詳細モーダル内の「次の予約」など、明示的な操作からの新規予約はモードに関係なく開く
  const handleModalSlotPick = (date: string, time: string, staffId?: string, patientId?: string, patientName?: string) => {
    setSelectedAppointment(null);
    setInitialSlotData({ date, time, staffId, patientId, patientName });
    setIsModalOpen(true);
  };

  const handleDayClick = (d: Date) => {
    setCurrentDate(d);
    setViewMode("day");
  };

  const handleApptClick = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setInitialSlotData(null);
    setIsModalOpen(true);
  };

  // ドラッグ移動：変更フィールドのみPUT（updateAppointmentは部分更新）
  const handleApptMove = useCallback(async (
    appt: Appointment,
    patch: { date: string; startTime: string; endTime: string; staffId?: string | null; chairNumber?: number | null },
  ) => {
    // 楽観的更新：即座にキャッシュを書き換えて待ち時間をゼロに見せる
    const queries = queryClient.getQueriesData<Appointment[]>({ queryKey: ["/api/appointments"] });
    const apply = (a: Appointment): Appointment => a.id === appt.id ? { ...a, ...patch } as Appointment : a;
    queries.forEach(([key, data]) => {
      if (Array.isArray(data)) queryClient.setQueryData(key, data.map(apply));
    });
    try {
      await apiRequest("PUT", `/api/appointments/${appt.id}`, patch);
    } catch (e: any) {
      const msg = String(e?.message || "").replace(/^\d+:\s*/, "");
      toast({ title: "移動できませんでした", description: msg, variant: "destructive" });
    } finally {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    }
  }, [queryClient, toast]);

  const handleNewBooking = (date: string, time: string) => {
    setSelectedAppointment(null);
    setInitialSlotData({ date, time });
    setIsModalOpen(true);
  };

  const headerTitle = viewMode === "day"
    ? format(currentDate, "yyyy年M月d日（E）", { locale: ja })
    : viewMode === "week"
    ? `${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "M月d日", { locale: ja })} 〜 ${format(addDays(startOfWeek(currentDate, { weekStartsOn: 0 }), 6), "M月d日", { locale: ja })}`
    : format(currentDate, "yyyy年M月", { locale: ja });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col px-3 md:px-6 py-2 border-b border-border bg-background shrink-0 gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {calendarMode === "holiday" ? (
            <h2 className="text-base md:text-lg font-bold tracking-tight min-w-0 flex-1 truncate leading-tight" data-testid="calendar-title">休診設定</h2>
          ) : (
          <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto sm:flex-1">
            <Button size="icon" variant="outline" className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 active:scale-95" onClick={() => navigate(-1)} data-testid="button-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-base md:text-lg font-bold tracking-tight text-center min-w-0 flex-1 truncate leading-tight md:flex-none md:min-w-[220px]" data-testid="calendar-title">{headerTitle}</h2>
            <Button size="icon" variant="outline" className="h-10 w-10 sm:h-9 sm:w-9 shrink-0 active:scale-95" onClick={() => navigate(1)} data-testid="button-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-10 sm:h-9 text-xs ml-0.5 shrink-0 active:scale-95">今日</Button>
          </div>
          )}
          {/* カレンダーモード切替（閲覧＝見るだけ / 予約＝空き枠タップで作成 / 休診＝まとめて編集） */}
          <div className="flex w-full sm:w-auto sm:shrink-0 border border-border rounded-lg overflow-hidden shadow-sm">
            {([
              { mode: "view" as CalendarMode, icon: Eye, label: "閲覧", activeCls: "bg-primary text-primary-foreground" },
              { mode: "book" as CalendarMode, icon: Plus, label: "予約", activeCls: "bg-primary text-primary-foreground" },
              { mode: "holiday" as CalendarMode, icon: Ban, label: "休診", activeCls: "bg-red-500 text-white" },
            ] as const).map(({ mode, icon: Icon, label, activeCls }, idx) => (
              <button
                key={mode}
                className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 h-10 sm:h-9 px-3 sm:px-3.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${idx > 0 ? "border-l border-border" : ""} ${calendarMode === mode ? `${activeCls} shadow-inner` : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                onClick={() => switchCalendarMode(mode)}
                data-testid={`calendar-mode-${mode}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 予約モードの案内（どのモードにいるかを常に分かりやすく） */}
        {calendarMode === "book" && (
          <div className="flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/25 px-2.5 py-1.5 text-[11px] font-medium text-foreground" data-testid="book-mode-hint">
            <Plus className="h-3 w-3 shrink-0" />
            予約モード：カレンダーの空き枠をタップすると新規予約を作成できます
          </div>
        )}

        {calendarMode !== "holiday" && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* ビュー切り替え */}
          <div className="flex border border-border rounded-md overflow-hidden w-fit">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                className={`px-3 md:px-3.5 h-10 sm:h-9 text-xs md:text-sm font-medium transition-colors active:scale-95 ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                onClick={() => setViewMode(mode)}
                data-testid={`view-${mode}`}
              >
                {mode === "day" ? "日" : mode === "week" ? "週" : "月"}
              </button>
            ))}
          </div>

          {/* 台帳の軸切替（日ビュー・PC/タブレットのみ）: スタッフ別 ⇄ ユニット別 */}
          {viewMode === "day" && !isMobile && (
            <div className="flex border border-border rounded-md overflow-hidden w-fit">
              {([
                { axis: "staff" as DayAxis, icon: Users, label: "スタッフ別" },
                { axis: "chair" as DayAxis, icon: Armchair, label: "ユニット別" },
              ] as const).map(({ axis, icon: Icon, label }, idx) => (
                <button
                  key={axis}
                  className={`flex items-center gap-1.5 px-3 h-10 sm:h-9 text-xs font-medium transition-colors active:scale-95 ${idx > 0 ? "border-l border-border" : ""} ${dayAxis === axis ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                  onClick={() => setDayAxis(axis)}
                  data-testid={`day-axis-${axis}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* スタッフ別フィルター（2名以上いる場合のみ表示） */}
          {staff.length >= 2 && (
            <div className="flex items-center gap-1 flex-wrap max-w-full">
              <span className="text-xs text-muted-foreground mr-1 shrink-0">担当：</span>
              <div className="flex border border-border rounded-md overflow-x-auto max-w-full">
                <button
                  className={`shrink-0 px-3 h-10 sm:h-9 text-xs font-medium transition-colors active:scale-95 ${filterStaffId === null ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                  onClick={() => setFilterStaffId(null)}
                  data-testid="filter-staff-all"
                >
                  全体
                </button>
                {staff.map(s => {
                  const isParttime = s.employmentType === "parttime" || s.employmentType === "contract";
                  const workingToday = !isParttime || approvedShiftSet.has(`${s.id}:${currentDateStr}`);
                  return (
                    <button
                      key={s.id}
                      className={`shrink-0 px-3 h-10 sm:h-9 text-xs font-medium transition-colors border-l border-border active:scale-95 ${filterStaffId === s.id ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                      onClick={() => setFilterStaffId(s.id)}
                      data-testid={`filter-staff-${s.id}`}
                    >
                      <span className={viewMode === "day" && isParttime && !workingToday ? "opacity-40" : ""}>
                        {s.name}
                      </span>
                      <span className="ml-1 text-[10px] opacity-60">{s.role === "doctor" ? "Dr." : "Hy."}</span>
                      {isParttime && <span className={`ml-1 text-[9px] font-bold ${filterStaffId === s.id ? "opacity-80" : "text-amber-500"}`}>非</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Content（モバイルは横方向の移動を完全に無効化＝縦スクロールのみ） */}
      <div className={`flex-1 ${calendarMode === "holiday" ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden md:overflow-auto"}`}>
        {calendarMode === "holiday" ? (
          <HolidayBatchEditor initialDate={currentDate} businessHours={businessHours} businessHoursLoading={businessHoursLoading} clinicHolidays={clinicHolidays} slotIntervalMinutes={slotIntervalMinutes} closedOnHolidays={closedOnHolidays} onDirtyChange={(d) => { holidayDirtyRef.current = d; holidayEditorGuard.dirty = d; }} />
        ) : isLoading ? (
          <div className="p-4 md:p-6 space-y-3">
            <Skeleton className="h-10 w-full rounded-lg" />
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : viewMode === "day" ? (
          <DayView currentDate={currentDate} appointments={appointments} staff={staffForDay} filterStaffId={filterStaffId} businessHours={businessHours} calendarMode={calendarMode} clinicHolidays={clinicHolidays} axis={dayAxis} chairsCount={chairsCount} slotIntervalMinutes={slotIntervalMinutes} isMobile={isMobile} onAppointmentClick={handleApptClick} onApptMove={handleApptMove} onNewBooking={handleNewBooking} onSlotClick={handleSlotClick} />
        ) : viewMode === "week" ? (
          <WeekView currentDate={currentDate} appointments={appointments} businessHours={businessHours} closedOnHolidays={closedOnHolidays} clinicHolidays={clinicHolidays} onAppointmentClick={handleApptClick} onDayClick={handleDayClick} />
        ) : (
          <MonthView currentDate={currentDate} appointments={appointments} businessHours={businessHours} closedOnHolidays={closedOnHolidays} clinicHolidays={clinicHolidays} onAppointmentClick={handleApptClick} onDayClick={handleDayClick} />
        )}
      </div>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        initialSlotData={initialSlotData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/appointments"] })}
        onSlotClick={handleModalSlotPick}
      />

    </div>
  );
}

// ─── Appointment Card ─────────────────────────────────────────────────────────
function ApptCard({ appt, height, onClick }: { appt: Appointment; height: number; onClick: () => void }) {
  const c = getTreatmentColor(appt.treatmentType || "");
  const isNewPatient = appt.visitType === "first" || (appt.treatmentType || "").includes("初診");
  return (
    <button
      className={`w-full text-left rounded overflow-hidden border border-border/60 shadow-sm flex ${c.bg} hover:brightness-95 transition-all`}
      style={{ height: `${height}px` }}
      onClick={e => { e.stopPropagation(); onClick(); }}
      data-testid={`appt-slot-${appt.id}`}
    >
      <div className={`w-1 shrink-0 ${c.bar}`} />
      <div className={`flex-1 px-1.5 py-1 overflow-hidden ${c.text}`}>
        {height >= 58 ? (
          <>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold truncate">{appt.patient?.name || "患者不明"}</span>
              {isNewPatient && <span className="text-[9px] bg-primary text-primary-foreground rounded px-0.5 shrink-0">初診</span>}
            </div>
            <div className="text-[10px] opacity-70 truncate mt-0.5">
              {appt.startTime.slice(0, 5)}〜{appt.endTime?.slice(0, 5)} {appt.treatmentType}
            </div>
          </>
        ) : height >= 36 ? (
          <div className="flex items-center gap-1 h-full">
            <span className="text-xs font-semibold truncate leading-tight">{appt.patient?.name || "患者不明"}</span>
            {isNewPatient && <span className="text-[9px] bg-primary text-primary-foreground rounded px-0.5 shrink-0">初診</span>}
            {appt.treatmentType && <span className="text-[10px] opacity-60 truncate shrink-0 hidden sm:block">{appt.treatmentType}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-1 h-full">
            <span className="text-[10px] font-semibold truncate leading-none">{appt.patient?.name || "患者不明"}</span>
            {isNewPatient && <span className="text-[9px] bg-primary text-primary-foreground rounded px-0.5 shrink-0">初診</span>}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── 休診まとめて編集エディタ（丸＝診療可能／棒線＝休診・保存で一括反映）──────
// 今日から翌月末までの日を横スワイプ（またはボタン）で移動しながら、
// 時間帯をタップで 〇⇄— に切り替え、最後に「保存」でまとめてサーバへ反映する。
// タブレット・PC・スマホで同じ操作体系。
type HolidayDayEdit = { allday: boolean; closed: Set<string> };
type EditorSlot = { start: string; end: string; status: "open" | "lunch" };
type EditorDay = {
  date: Date;
  dateStr: string;
  label: string;
  dow: number;
  holidayName: string | null;
  offReason: "none" | "regular" | "national";
  slots: EditorSlot[];
};

function HolidayBatchEditor({ initialDate, businessHours, businessHoursLoading, clinicHolidays, slotIntervalMinutes, closedOnHolidays, onDirtyChange }: {
  initialDate: Date;
  businessHours: BusinessHours[];
  businessHoursLoading: boolean;
  clinicHolidays: Holiday[];
  slotIntervalMinutes: number;
  closedOnHolidays: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [edits, setEdits] = useState<Record<string, HolidayDayEdit>>({});
  const scrollerRef = useRef<HTMLDivElement>(null); // グリッド全体の単一スクロール領域
  const today = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
  const curMonthIdx = today.getFullYear() * 12 + today.getMonth();
  // 初期表示月は「今月」を下限にクランプ（過去月では開かない）
  const initIdx = Math.max(initialDate.getFullYear() * 12 + initialDate.getMonth(), curMonthIdx);
  const [viewYear, setViewYear] = useState(Math.floor(initIdx / 12));
  const [viewMonth, setViewMonth] = useState(initIdx % 12);
  const [pickerOpen, setPickerOpen] = useState(false);

  const step = Math.min(60, Math.max(5, slotIntervalMinutes || 30));
  const holidayList = Array.isArray(clinicHolidays) ? clinicHolidays : [];
  const TIME_W = 52; // 左の時刻列の幅(px)
  const DAY_W = 68;  // 各日の列の幅(px)
  const todayStr = format(today, "yyyy-MM-dd");

  // 任意の日付の編集用データ（営業時間・スロット・休診理由）を構築する
  const buildDay = (d: Date): EditorDay => {
    const dow = d.getDay();
    const dateStr = format(d, "yyyy-MM-dd");
    const dayHours = businessHours.find(h => h.dayOfWeek === dow);
    const holidayName = getHolidayName(dateStr);
    const isRegularOff = !dayHours || dayHours.isClosed;
    const isNationalOff = !!holidayName && closedOnHolidays;
    const slots: EditorSlot[] = [];
    if (!isRegularOff && !isNationalOff) {
      const openMins = dayHours?.openTime ? toMins(dayHours.openTime) : null;
      const lastClose = dayHours?.afternoonCloseTime
        ? toMins(dayHours.afternoonCloseTime)
        : (dayHours?.closeTime ? toMins(dayHours.closeTime) : null);
      if (openMins !== null && lastClose !== null) {
        for (let m = openMins; m + step <= lastClose; m += step) {
          const start = minsToTime(m);
          const st = getSlotStatus(start, dayHours);
          if (st === "closed") continue;
          slots.push({ start, end: minsToTime(m + step), status: st });
        }
      }
    }
    return {
      date: new Date(d),
      dateStr,
      label: format(d, "M月d日（E）", { locale: ja }),
      dow,
      holidayName: holidayName ?? null,
      offReason: isRegularOff ? "regular" : isNationalOff ? "national" : "none",
      slots,
    };
  };

  // 表示中の月の「今日以降」の日だけを構築（過去日は表示しない）
  const days: EditorDay[] = (() => {
    const last = new Date(viewYear, viewMonth + 1, 0).getDate();
    const list: EditorDay[] = [];
    for (let dnum = 1; dnum <= last; dnum++) {
      const day = buildDay(new Date(viewYear, viewMonth, dnum));
      if (day.dateStr < todayStr) continue;
      list.push(day);
    }
    return list;
  })();

  const openStarts = (day: EditorDay) => day.slots.filter(s => s.status === "open").map(s => s.start);
  const viewIdx = viewYear * 12 + viewMonth;
  const isCurrentMonth = viewIdx <= curMonthIdx; // 今月（以前）＝これ以上戻れない

  // サーバに保存されている現状から、その日の編集初期値を作る
  const baseStateOf = (day: EditorDay): HolidayDayEdit => {
    const hs = holidayList.filter(h => h.date === day.dateStr);
    const allday = hs.some(h => !h.startTime);
    const closed = new Set<string>();
    for (const s of openStarts(day)) {
      const m = toMins(s);
      if (allday || hs.some(h => h.startTime && h.endTime && toMins(h.startTime.slice(0, 5)) <= m && m < toMins(h.endTime.slice(0, 5)))) {
        closed.add(s);
      }
    }
    return { allday, closed };
  };

  const stateOf = (day: EditorDay): HolidayDayEdit => edits[day.dateStr] ?? baseStateOf(day);

  const toggleSlot = (day: EditorDay, slot: string) => {
    setEdits(prev => {
      const cur = prev[day.dateStr] ?? baseStateOf(day);
      const closed = new Set(cur.closed);
      if (closed.has(slot)) closed.delete(slot); else closed.add(slot);
      return { ...prev, [day.dateStr]: { allday: false, closed } };
    });
  };

  const toggleAllday = (day: EditorDay) => {
    setEdits(prev => {
      const cur = prev[day.dateStr] ?? baseStateOf(day);
      const all = openStarts(day);
      const fullyOff = cur.allday || (all.length > 0 && all.every(s => cur.closed.has(s)));
      return {
        ...prev,
        [day.dateStr]: fullyOff
          ? { allday: false, closed: new Set<string>() }
          : { allday: true, closed: new Set(all) },
      };
    });
  };

  const sameState = (a: HolidayDayEdit, b: HolidayDayEdit) =>
    a.allday === b.allday && a.closed.size === b.closed.size && Array.from(a.closed).every(s => b.closed.has(s));

  // 編集は月をまたいで保持されるので、表示中の月に限らず全編集日を対象に差分判定
  const dirtyDates = Object.keys(edits).filter(ds => {
    const day = buildDay(new Date(ds + "T00:00:00"));
    return !sameState(edits[ds], baseStateOf(day));
  });
  const dirtyCount = dirtyDates.length;

  const hasDirty = dirtyCount > 0;
  useEffect(() => { onDirtyChange(hasDirty); }, [hasDirty]);
  useEffect(() => () => onDirtyChange(false), []);

  // タブを閉じる/リロードで未保存の変更が消える前に確認を出す
  useEffect(() => {
    if (!hasDirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDirty]);

  const handleSave = async () => {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    const targets = [...dirtyDates];
    let saved = 0;
    try {
      for (const ds of targets) {
        const day = buildDay(new Date(ds + "T00:00:00"));
        const desired = edits[ds];
        // 望みの状態を先に登録し、そのあと旧レコードを消す。
        // 途中でネットワークが切れても「休診が消えて予約が入ってしまう」事故を防ぐ順序。
        if (desired.allday) {
          await apiRequest("POST", "/api/holidays", { date: ds });
        } else {
          // 連続した休診コマは1つの時間帯レコードにまとめる
          const ranges: { start: string; end: string }[] = [];
          for (const s of day.slots) {
            if (s.status !== "open" || !desired.closed.has(s.start)) continue;
            const last = ranges[ranges.length - 1];
            if (last && last.end === s.start) last.end = s.end;
            else ranges.push({ start: s.start, end: s.end });
          }
          for (const r of ranges) {
            await apiRequest("POST", "/api/holidays", { date: ds, startTime: r.start, endTime: r.end });
          }
        }
        for (const h of holidayList.filter(h => h.date === ds)) {
          await apiRequest("DELETE", `/api/holidays/${h.id}`);
        }
        saved++;
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      // 保存した日の編集だけを消す（保存中に加えた別の編集は保持）
      setEdits(prev => {
        const next = { ...prev };
        for (const ds of targets) delete next[ds];
        return next;
      });
      toast({ title: "休診設定を保存しました", description: `設定した時間帯どおりに反映しました（対象 ${saved} 日）` });
    } catch (e: any) {
      const msg = String(e?.message || e).replace(/^\d+:\s*/, "");
      toast({ title: "保存に失敗しました", description: msg, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
    } finally {
      setSaving(false);
    }
  };

  // 月を切り替えたらスクロールを先頭へ戻す
  useEffect(() => {
    if (scrollerRef.current) { scrollerRef.current.scrollLeft = 0; scrollerRef.current.scrollTop = 0; }
  }, [viewYear, viewMonth]);

  // スワイプの方向ロック（斜め移動を無くす）。
  // 最初に動いた方向（縦／横）だけにスクロールを固定し、指でスクロールを直接駆動する。
  // touch-action:none でブラウザ標準の2Dスクロールを止め、指を離した後の慣性も自前で付ける。
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let axis: "x" | "y" | null = null;
    let sx = 0, sy = 0, lx = 0, ly = 0, vx = 0, vy = 0, lt = 0, raf = 0;
    const stopInertia = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { axis = null; return; }
      stopInertia();
      const t = e.touches[0];
      axis = null; sx = lx = t.clientX; sy = ly = t.clientY; vx = vy = 0; lt = e.timeStamp;
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!axis) {
        const dx = Math.abs(t.clientX - sx), dy = Math.abs(t.clientY - sy);
        if (dx < 6 && dy < 6) return;        // タップ／微小移動は無視（マスのタップを妨げない）
        axis = dx > dy ? "x" : "y";          // 動き始めた方向に固定
      }
      const dt = Math.max(1, e.timeStamp - lt);
      if (axis === "x") { const d = t.clientX - lx; el.scrollLeft -= d; vx = d / dt; }
      else { const d = t.clientY - ly; el.scrollTop -= d; vy = d / dt; }
      lx = t.clientX; ly = t.clientY; lt = e.timeStamp;
    };
    const onEnd = () => {
      const a = axis; axis = null;
      if (!a) return;
      const step = () => {
        if (a === "x") { if (Math.abs(vx) < 0.03) return; el.scrollLeft -= vx * 16; vx *= 0.94; }
        else { if (Math.abs(vy) < 0.03) return; el.scrollTop -= vy * 16; vy *= 0.94; }
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      stopInertia();
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const goMonth = (delta: number) => {
    const next = viewIdx + delta;
    if (next < curMonthIdx) return; // 今月より前へは戻さない
    setViewYear(Math.floor(next / 12));
    setViewMonth(next % 12);
  };

  const dayNamesJa = ["日", "月", "火", "水", "木", "金", "土"];

  // 全日の営業スロットを縦軸（時刻の行）に統一。各日はこの時刻に対して open/lunch/対象外 を持つ
  const axis: string[] = (() => {
    const set = new Set<string>();
    for (const d of days) for (const s of d.slots) set.add(s.start);
    return Array.from(set).sort();
  })();
  const statusByDay = new Map<string, Map<string, "open" | "lunch">>();
  for (const d of days) {
    const m = new Map<string, "open" | "lunch">();
    for (const s of d.slots) m.set(s.start, s.status);
    statusByDay.set(d.dateStr, m);
  }

  const gridCols = `${TIME_W}px repeat(${days.length}, ${DAY_W}px)`;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 月ナビ（月送り＋タップで年月ピッカー） */}
      <div className="shrink-0 border-b border-border px-3 md:px-6 py-2 flex items-center gap-2">
        <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 active:scale-95 disabled:opacity-30" onClick={() => goMonth(-1)} disabled={isCurrentMonth} data-testid="holiday-month-prev">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card hover:bg-accent active:scale-[0.99] transition-colors font-bold tracking-tight"
          data-testid="holiday-month-label"
        >
          {viewYear}年{viewMonth + 1}月
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
        <Button size="icon" variant="outline" className="h-9 w-9 shrink-0 active:scale-95" onClick={() => goMonth(1)} data-testid="holiday-month-next">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-9 text-xs shrink-0 active:scale-95" onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }} data-testid="holiday-month-today">今月</Button>
      </div>

      {/* 凡例 */}
      <div className="shrink-0 border-b border-border px-3 md:px-6 py-1.5">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          各マスをタップして
          <span className="inline-flex items-center gap-1 mx-1 font-semibold text-foreground"><span className="h-3 w-3 rounded-full bg-primary" />診療可能</span>
          ⇄
          <span className="inline-flex items-center gap-0.5 mx-1 font-semibold text-red-500"><Minus className="h-3.5 w-3.5" strokeWidth={3} />休診</span>
          。最後に「保存」で反映します。
        </p>
      </div>

      {/* 縦＝時刻／横＝日 のグリッド。
          ・日付ヘッダー行は上に固定（横スクロールに追従）
          ・時刻の列は左に固定（縦スクロールで一緒に動く）
          ・縦スクロール（vScroll: touch-action pan-y）と横スクロール（hScroll: pan-x）を
            別レイヤーに分離し、ブラウザ標準の軸ロックで斜め移動・位置リセットを防ぐ */}
      {businessHours.length === 0 && businessHoursLoading ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
          <div>
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-25 animate-pulse" />
            <p className="text-sm">診療時間を読み込み中...</p>
          </div>
        </div>
      ) : businessHours.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
          <div>
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-25" />
            <p className="text-sm font-medium">診療時間が設定されていません</p>
            <p className="text-xs mt-1 opacity-60">「設定」→診療時間 から登録してください</p>
          </div>
        </div>
      ) : axis.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-6 text-center text-muted-foreground">
          <div>
            <Ban className="h-9 w-9 mx-auto mb-2 opacity-25" />
            <p className="text-sm font-medium">この月に設定できる診療日がありません</p>
            <p className="text-xs mt-1 opacity-60">「今月」や月送りで別の月をご確認ください</p>
          </div>
        </div>
      ) : (
      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-auto touch-none pb-3" style={{ overscrollBehavior: "contain" }} data-testid="holiday-grid">
        <div className="grid w-max" style={{ gridTemplateColumns: gridCols }}>
          {/* 左上コーナー（上・左とも固定） */}
          <div className="sticky top-0 left-0 z-30 bg-background border-b border-r border-border" />
          {/* 日付ヘッダー（上に固定） */}
          {days.map((d) => {
            const isSun = d.dow === 0, isSat = d.dow === 6, isHol = !!d.holidayName;
            const isToday = d.dateStr === todayStr;
            const col = isSun || isHol ? "text-red-500" : isSat ? "text-blue-500" : "text-foreground";
            return (
              <div key={`h-${d.dateStr}`} className="sticky top-0 z-20 bg-background border-b border-l border-border/60 px-0.5 py-1 text-center">
                <div className={`text-[9px] leading-none ${isSun || isHol ? "text-red-500" : isSat ? "text-blue-500" : "text-muted-foreground"}`}>{dayNamesJa[d.dow]}</div>
                <div className={`text-[13px] font-bold leading-tight tabular-nums ${isToday ? "bg-primary text-primary-foreground rounded-md inline-block px-1.5" : col}`}>{d.date.getDate()}</div>
                {dirtyDates.includes(d.dateStr) && <span className="block mx-auto mt-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" />}
              </div>
            );
          })}

          {/* 終日行（左ラベルは左に固定） */}
          <div className="sticky left-0 z-10 bg-background border-b border-r border-border h-9 flex items-center justify-end pr-2 text-[10px] font-semibold text-muted-foreground">終日</div>
          {days.map(d => {
            const offDay = d.offReason !== "none";
            const cellBase = "h-9 border-b border-l border-border/40 flex items-center justify-center";
            if (offDay) return <div key={`a-${d.dateStr}`} className={`${cellBase} bg-muted/30 text-[9px] text-muted-foreground/50`}>休</div>;
            const allStarts = openStarts(d);
            const st = stateOf(d);
            const fullyOff = st.allday || (allStarts.length > 0 && allStarts.every(s => st.closed.has(s)));
            return (
              <button
                key={`a-${d.dateStr}`}
                onClick={() => toggleAllday(d)}
                disabled={saving || allStarts.length === 0}
                className={`${cellBase} transition-colors active:scale-95 disabled:opacity-40 ${fullyOff ? "bg-red-500" : "hover:bg-accent/50"}`}
                title="終日休診の切り替え"
                data-testid={`holiday-allday-${d.dateStr}`}
              >
                {fullyOff ? <Minus className="h-4 w-4 text-white" strokeWidth={3} /> : <ChevronDown className="h-4 w-4 text-muted-foreground/50" />}
              </button>
            );
          })}

          {/* 時刻ごとの行（左の時刻ラベルは左に固定） */}
          {axis.flatMap(t => [
            <div key={`t-${t}`} className="sticky left-0 z-10 bg-background border-b border-r border-border h-10 flex items-center justify-end pr-2 text-[11px] font-medium tabular-nums text-muted-foreground">{t}</div>,
            ...days.map(d => {
              const cellBase = "h-10 border-b border-l border-border/40 flex items-center justify-center";
              const status = statusByDay.get(d.dateStr)?.get(t);
              if (d.offReason !== "none" || !status) return <div key={`c-${d.dateStr}-${t}`} className={`${cellBase} bg-muted/25`} />;
              if (status === "lunch") return <div key={`c-${d.dateStr}-${t}`} className={`${cellBase} bg-muted/20 text-[9px] text-muted-foreground/50`}>昼</div>;
              const closed = stateOf(d).closed.has(t);
              return (
                <button
                  key={`c-${d.dateStr}-${t}`}
                  onClick={() => toggleSlot(d, t)}
                  disabled={saving}
                  className={`${cellBase} transition-colors active:bg-accent disabled:opacity-60 ${closed ? "bg-red-50 dark:bg-red-950/30" : "hover:bg-accent/40"}`}
                  data-testid={`holiday-slot-${d.dateStr}-${t}`}
                >
                  {closed
                    ? <Minus className="h-4 w-4 text-red-500" strokeWidth={3} />
                    : <span className="h-3.5 w-3.5 rounded-full bg-primary" />}
                </button>
              );
            }),
          ])}
        </div>
      </div>
      )}

      {/* 保存バー（まとめて反映／リセット） */}
      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur px-3 md:px-6 py-2.5 flex items-center gap-2.5">
        <span className={`text-xs flex-1 min-w-0 truncate ${dirtyCount > 0 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}`} data-testid="holiday-dirty-count">
          {dirtyCount > 0 ? `未保存：${dirtyCount}日を編集中` : "変更はありません"}
        </span>
        <Button variant="outline" className="h-10 active:scale-95" onClick={() => setEdits({})} disabled={dirtyCount === 0 || saving} data-testid="holiday-reset">
          <RotateCcw className="h-4 w-4 mr-1.5" />
          リセット
        </Button>
        <Button className="h-10 min-w-[120px] active:scale-95" onClick={handleSave} disabled={dirtyCount === 0 || saving} data-testid="holiday-save">
          <Check className="h-4 w-4 mr-1.5" />
          {saving ? "保存中..." : dirtyCount > 0 ? `保存（${dirtyCount}日）` : "保存"}
        </Button>
      </div>

      {pickerOpen && (
        <MonthYearPicker
          year={viewYear}
          month={viewMonth}
          curYear={today.getFullYear()}
          curMonth={today.getMonth()}
          maxYear={today.getFullYear() + 2}
          onClose={() => setPickerOpen(false)}
          onApply={(y, m) => { setViewYear(y); setViewMonth(m); setPickerOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── 年月スロットピッカー ───────────────────────────────────────────
function WheelColumn({ items, value, onChange }: {
  items: { value: number; label: string }[];
  value: number;
  onChange: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ITEM_H = 40;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, items.findIndex(i => i.value === value));
    el.scrollTop = idx * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)));
    const v = items[idx]?.value;
    if (v !== undefined && v !== value) onChange(v);
  };
  return (
    <div className="relative flex-1">
      {/* 中央のハイライト帯 */}
      <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 h-10 rounded-lg bg-primary/15 border border-primary/40 z-10" />
      <div ref={ref} onScroll={onScroll} className="h-[200px] overflow-y-auto snap-y snap-mandatory" style={{ scrollbarWidth: "none" }}>
        <div style={{ height: 80 }} />
        {items.map(it => (
          <button
            key={it.value}
            onClick={() => { onChange(it.value); ref.current?.scrollTo({ top: items.findIndex(x => x.value === it.value) * ITEM_H, behavior: "smooth" }); }}
            className={`h-10 w-full flex items-center justify-center snap-center text-base tabular-nums transition-colors ${it.value === value ? "font-bold text-foreground scale-110" : "text-muted-foreground/50"}`}
          >
            {it.label}
          </button>
        ))}
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
}

function MonthYearPicker({ year, month, curYear, curMonth, maxYear, onClose, onApply }: {
  year: number;
  month: number;
  curYear: number;
  curMonth: number;
  maxYear: number;
  onClose: () => void;
  onApply: (year: number, month: number) => void;
}) {
  const [y, setY] = useState(year);
  const [m, setM] = useState(month);
  const years: { value: number; label: string }[] = [];
  for (let yy = curYear; yy <= maxYear; yy++) years.push({ value: yy, label: `${yy}年` });
  // 今年を選んでいる時は今月以降だけ選べる（過去月は選択不可）
  const minMonth = y === curYear ? curMonth : 0;
  const months = Array.from({ length: 12 - minMonth }, (_, i) => ({ value: minMonth + i, label: `${minMonth + i + 1}月` }));
  // 年を変えて選択中の月が範囲外になったら先頭へ寄せる
  useEffect(() => {
    if (m < minMonth) setM(minMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [y]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40" onClick={onClose} data-testid="holiday-month-picker">
      <div className="w-full sm:max-w-xs bg-background rounded-t-2xl sm:rounded-2xl shadow-xl p-4 pb-6" onClick={e => e.stopPropagation()}>
        <p className="text-sm font-bold text-center mb-3">年月を選択</p>
        <div className="flex gap-3">
          <WheelColumn items={years} value={y} onChange={setY} />
          <WheelColumn key={`m-${minMonth}`} items={months} value={m < minMonth ? minMonth : m} onChange={setM} />
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1 h-11 active:scale-95" onClick={onClose}>キャンセル</Button>
          <Button className="flex-1 h-11 active:scale-95" onClick={() => onApply(Math.max(y, curYear), Math.max(m, minMonth))} data-testid="holiday-picker-apply">この月を表示</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────
function DayView({ currentDate, appointments, staff: allStaff, filterStaffId, businessHours, calendarMode, clinicHolidays, axis, chairsCount, slotIntervalMinutes, isMobile, onAppointmentClick, onApptMove, onNewBooking, onSlotClick }: {
  currentDate: Date;
  appointments: Appointment[];
  staff: Staff[];
  filterStaffId: string | null;
  businessHours: BusinessHours[];
  calendarMode: CalendarMode;
  clinicHolidays: Holiday[];
  axis: DayAxis;
  chairsCount: number;
  slotIntervalMinutes: number;
  isMobile: boolean;
  onAppointmentClick: (a: Appointment) => void;
  onApptMove: (a: Appointment, patch: { date: string; startTime: string; endTime: string; staffId?: string | null; chairNumber?: number | null }) => void;
  onNewBooking: (date: string, time: string) => void;
  onSlotClick: (date: string, time: string, staffId?: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState<number | null>(null);
  const [viewH, setViewH] = useState(0);
  const isToday = isSameDay(currentDate, new Date());
  // 予約の作成・ドラッグ移動は「予約」モードのときだけ（閲覧モードは見るだけ）
  const canBook = calendarMode === "book";

  // 表示領域の高さを測り、行の高さ算出に使う（少人数でも縦を埋めるため）
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setViewH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // スタッフフィルター適用：担当選択時はその列だけ表示
  const staff = filterStaffId ? allStaff.filter(s => s.id === filterStaffId) : allStaff;

  const dow = currentDate.getDay();
  const dayHours = businessHours.find(h => h.dayOfWeek === dow);
  const { startHour, endHour } = computeHourRange(businessHours.length > 0 ? businessHours : [{ dayOfWeek: 0, openTime: "09:00", closeTime: "18:00", isClosed: false }]);
  const isDayOff = !dayHours || dayHours.isClosed;
  const dateStr = format(currentDate, "yyyy-MM-dd");
  // この日の休診情報（表示専用。編集は「休診」モードのエディタで行う）
  const dayHolidays = (Array.isArray(clinicHolidays) ? clinicHolidays : []).filter(h => h.date === dateStr);
  const alldayHoliday = dayHolidays.find(h => !h.startTime);
  const isSlotHoliday = (slot: string) => {
    if (alldayHoliday) return true;
    const m = toMins(slot);
    return dayHolidays.some(h => h.startTime && h.endTime
      && toMins(h.startTime.slice(0, 5)) <= m && m < toMins(h.endTime.slice(0, 5)));
  };

  // 院の設定「時間刻み」を台帳のグリッドに反映（モジュール定数SLOT_MINUTESを局所的に上書き）
  const SLOT_MINUTES = Math.min(60, Math.max(5, slotIntervalMinutes || 30));

  const timeSlots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += SLOT_MINUTES) {
      timeSlots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  const calcNowTop = () => {
    if (!isToday) return null;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const startMins = startHour * 60;
    const endMins = endHour * 60;
    if (mins < startMins || mins > endMins) return null;
    return ((mins - startMins) / SLOT_MINUTES) * SLOT_HEIGHT;
  };

  useEffect(() => {
    setNowTop(calcNowTop());
    const timer = setInterval(() => setNowTop(calcNowTop()), 60000);
    return () => clearInterval(timer);
  }, [isToday, startHour]);

  // 横タイムライン：初期表示で現在時刻あたりまで横スクロール
  useEffect(() => {
    const t = calcNowTop();
    if (t !== null && scrollRef.current) {
      scrollRef.current.scrollLeft = Math.max(0, (t / SLOT_HEIGHT) * SLOT_WIDTH - 240);
    }
  }, []);

  const timeToMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const isHourStart = (slot: string) => slot.endsWith(":00");

  const todayAppts = (Array.isArray(appointments) ? appointments : []).filter(a => isSameDay(parseISO(a.date), currentDate));
  const activeAppts = todayAppts.filter(a => a.status !== "cancelled");
  const morningAppts = activeAppts.filter(a => parseInt(a.startTime) < 13);
  const afternoonAppts = activeAppts.filter(a => parseInt(a.startTime) >= 13);
  const morningCount = morningAppts.length;
  const afternoonCount = afternoonAppts.length;
  const morningNew = morningAppts.filter(a => (a.visitType === "first" || (a.treatmentType || "").includes("初診"))).length;
  const afternoonNew = afternoonAppts.filter(a => (a.visitType === "first" || (a.treatmentType || "").includes("初診"))).length;

  // ── 台帳の列を軸（スタッフ別／ユニット別）から構築 ──────────────────────────
  type Col = { key: string; label: string; sub: string; kind: "staff" | "chair" | "unassigned"; accent?: boolean };
  const hasUnassignedStaff = activeAppts.some(a => !a.staffId);
  const hasUnassignedChair = activeAppts.some(a => !a.chairNumber);
  let columns: Col[];
  if (axis === "chair") {
    const usedMax = activeAppts.reduce((m, a) => Math.max(m, a.chairNumber || 0), 0);
    const n = Math.max(chairsCount, usedMax, 1);
    columns = Array.from({ length: n }, (_, i) => ({ key: String(i + 1), label: `ユニット${i + 1}`, sub: "診療台", kind: "chair" as const }));
    if (hasUnassignedChair) columns.push({ key: "__none__", label: "未割当", sub: "台未設定", kind: "unassigned", accent: true });
  } else {
    columns = staff.map(s => ({ key: s.id, label: s.name, sub: s.role === "doctor" ? "歯科医師" : "衛生士", kind: "staff" as const }));
    if (hasUnassignedStaff && !filterStaffId) columns.push({ key: "__none__", label: "未割当", sub: "担当者未設定", kind: "unassigned", accent: true });
  }

  const colAppts = (col: Col): Appointment[] => {
    if (col.kind === "unassigned") return activeAppts.filter(a => axis === "chair" ? !a.chairNumber : !a.staffId);
    if (col.kind === "chair") return activeAppts.filter(a => a.chairNumber === Number(col.key));
    return activeAppts.filter(a => a.staffId === col.key);
  };

  const isContinuation = (appts: Appointment[], slot: string) =>
    appts.some(a => {
      const s = timeToMins(a.startTime.slice(0, 5));
      const e = a.endTime ? timeToMins(a.endTime.slice(0, 5)) : s + SLOT_MINUTES;
      return s < timeToMins(slot) && e > timeToMins(slot);
    });

  // ── 空き枠カウント（営業中スロットのうち予約で埋まっていない数）──────────────
  const openSlots = timeSlots.filter(s => getSlotStatus(s, dayHours) === "open");
  const realCols = columns.filter(c => c.kind !== "unassigned");
  let freeCount = 0;
  for (const col of realCols) {
    const appts = colAppts(col);
    for (const slot of openSlots) {
      const sm = timeToMins(slot);
      const covered = appts.some(a => {
        const as = timeToMins(a.startTime.slice(0, 5));
        const ae = a.endTime ? timeToMins(a.endTime.slice(0, 5)) : as + SLOT_MINUTES;
        return as <= sm && ae > sm;
      });
      if (!covered) freeCount++;
    }
  }

  // ── 横タイムライン台帳の寸法（時間=横／行=スタッフ・ユニット）──────────────
  const SLOT_WIDTH = Math.round((SLOT_MINUTES * 88) / 30); // 1コマの横幅(px)＝刻みに比例（30分=88px相当）
  const LABEL_WIDTH = 132;  // 左側の行ラベル幅(px)
  const HEADER_HEIGHT = 40; // 上部の時刻ヘッダー高さ(px)
  // 行の高さは画面高さと行数から動的に決定（少人数なら縦を程よく埋め、多人数ならスクロール）
  const ROW_HEIGHT = columns.length > 0
    ? Math.max(96, Math.min(160, Math.floor(((viewH || 640) - HEADER_HEIGHT) / columns.length)))
    : 120;
  const trackWidth = timeSlots.length * SLOT_WIDTH;

  // ── ドラッグ移動（上下=担当/ユニット変更、左右=時間変更）─────────────────────
  const dragMeta = useRef<{ appt: Appointment; durSlots: number; startX: number; startY: number; moved: boolean } | null>(null);
  const handlersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(null);
  const [drag, setDrag] = useState<{ apptId: string; durSlots: number; rowIndex: number; slotIndex: number } | null>(null);

  const locate = (clientX: number, clientY: number, durSlots: number) => {
    const grid = gridRef.current;
    if (!grid || columns.length === 0) return null;
    const rect = grid.getBoundingClientRect();
    let ri = Math.floor((clientY - rect.top) / ROW_HEIGHT);
    ri = Math.max(0, Math.min(columns.length - 1, ri));
    let si = Math.round((clientX - rect.left) / SLOT_WIDTH);
    si = Math.max(0, Math.min(timeSlots.length - durSlots, si));
    return { ri, si };
  };

  const onPointerMoveDoc = (e: PointerEvent) => {
    const m = dragMeta.current;
    if (!m) return;
    if (!m.moved) {
      if (Math.hypot(e.clientX - m.startX, e.clientY - m.startY) < 6) return;
      m.moved = true;
      document.body.style.userSelect = "none";
    }
    const loc = locate(e.clientX, e.clientY, m.durSlots);
    if (loc) setDrag({ apptId: m.appt.id, durSlots: m.durSlots, rowIndex: loc.ri, slotIndex: loc.si });
  };

  const removeDragListeners = () => {
    if (handlersRef.current) {
      document.removeEventListener("pointermove", handlersRef.current.move);
      document.removeEventListener("pointerup", handlersRef.current.up);
      handlersRef.current = null;
    }
    document.body.style.userSelect = "";
  };

  const onPointerUpDoc = (e: PointerEvent) => {
    removeDragListeners();
    const m = dragMeta.current;
    dragMeta.current = null;
    setDrag(null);
    if (!m) return;
    if (!m.moved) { onAppointmentClick(m.appt); return; }
    const loc = locate(e.clientX, e.clientY, m.durSlots);
    if (!loc) return;
    const col = columns[loc.ri];
    const newStart = minsToTime(startHour * 60 + loc.si * SLOT_MINUTES);
    const newEnd = minsToTime(startHour * 60 + (loc.si + m.durSlots) * SLOT_MINUTES);
    const sameTime = m.appt.startTime.slice(0, 5) === newStart;
    const sameCol = axis === "chair"
      ? (m.appt.chairNumber ?? null) === (col.kind === "unassigned" ? null : Number(col.key))
      : (m.appt.staffId ?? null) === (col.kind === "unassigned" ? null : col.key);
    if (sameTime && sameCol) return;
    const patch: { date: string; startTime: string; endTime: string; staffId?: string | null; chairNumber?: number | null } =
      { date: dateStr, startTime: newStart, endTime: newEnd };
    if (axis === "chair") patch.chairNumber = col.kind === "unassigned" ? null : Number(col.key);
    else patch.staffId = col.kind === "unassigned" ? null : col.key;
    onApptMove(m.appt, patch);
  };

  const startDrag = (e: React.PointerEvent, appt: Appointment) => {
    if (isMobile || !canBook || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    const s = timeToMins(appt.startTime.slice(0, 5));
    const en = appt.endTime ? timeToMins(appt.endTime.slice(0, 5)) : s + SLOT_MINUTES;
    const durSlots = Math.max(1, Math.round((en - s) / SLOT_MINUTES));
    dragMeta.current = { appt, durSlots, startX: e.clientX, startY: e.clientY, moved: false };
    handlersRef.current = { move: onPointerMoveDoc, up: onPointerUpDoc };
    document.addEventListener("pointermove", onPointerMoveDoc);
    document.addEventListener("pointerup", onPointerUpDoc);
  };

  useEffect(() => () => removeDragListeners(), []);

  // 休診の表示チップ（編集は「休診」モードで行う）
  const holidayChip = dayHolidays.length > 0 ? (
    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded border shrink-0 bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400" data-testid="day-holiday-chip">
      <Ban className="h-3 w-3" />
      {alldayHoliday ? "終日休診" : "一部休診"}
    </span>
  ) : null;

  const summaryBar = (
    <div className="flex items-center gap-4 px-4 md:px-6 py-2 bg-muted/30 border-b border-border text-sm shrink-0 overflow-x-auto">
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <Sun className="h-3.5 w-3.5" />午前 <strong className="text-foreground">{morningCount}</strong>件
        {morningNew > 0 && <span className="text-foreground text-xs font-medium ml-0.5">(初診{morningNew}名)</span>}
      </div>
      <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
        <Sunset className="h-3.5 w-3.5" />午後 <strong className="text-foreground">{afternoonCount}</strong>件
        {afternoonNew > 0 && <span className="text-foreground text-xs font-medium ml-0.5">(初診{afternoonNew}名)</span>}
      </div>
      <div className="text-muted-foreground shrink-0">計 <strong className="text-foreground">{activeAppts.length}</strong>件</div>
      {!isDayOff && <div className="text-foreground shrink-0">空き <strong>{freeCount}</strong>枠</div>}
      {dayHours?.openTime && (
        <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
          診療時間: {dayHours.openTime.slice(0,5)}〜{dayHours.closeTime?.slice(0,5) || ""}
          {dayHours.afternoonOpenTime && ` / ${dayHours.afternoonOpenTime.slice(0,5)}〜${dayHours.afternoonCloseTime?.slice(0,5) || ""}`}
        </div>
      )}
      {holidayChip && <div className="ml-auto">{holidayChip}</div>}
    </div>
  );

  // ── モバイル：時刻目盛り付き縦タイムライン（各時間の左に時刻＋その時間の予約）──
  if (isMobile) {
    const sorted = [...activeAppts].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const nowMinsRaw = new Date().getHours() * 60 + new Date().getMinutes();
    const suggestTime = () => {
      const open = dayHours?.openTime ? timeToMins(dayHours.openTime.slice(0, 5)) : startHour * 60;
      const close = dayHours?.closeTime ? timeToMins(dayHours.closeTime.slice(0, 5)) : endHour * 60;
      if (!isToday) return minsToTime(open);
      const now = new Date();
      let m = Math.ceil((now.getHours() * 60 + now.getMinutes()) / SLOT_MINUTES) * SLOT_MINUTES;
      if (m < open || m > close - SLOT_MINUTES) m = open;
      return minsToTime(m);
    };
    // 設定の「スロット間隔」に追従して時刻の目盛りを刻む（例: 30分なら 9:00, 9:30, …）
    const slotList: number[] = [];
    for (let t = startHour * 60; t + SLOT_MINUTES <= endHour * 60; t += SLOT_MINUTES) slotList.push(t);
    return (
      <div className="h-full flex flex-col bg-background relative">
        {summaryBar}
        {isDayOff ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center text-muted-foreground">
              <Ban className="h-9 w-9 mx-auto mb-2 opacity-25" />
              <p className="text-sm font-medium">定休日</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto pb-24" ref={scrollRef}>
            {slotList.map(t => {
              const label = minsToTime(t);
              const isHourRow = t % 60 === 0;
              const st = getSlotStatus(label, dayHours);
              const isLunch = st === "lunch";
              const list = sorted.filter(a => { const m = timeToMins(a.startTime.slice(0, 5)); return m >= t && m < t + SLOT_MINUTES; });
              const isNowRow = isToday && nowMinsRaw >= t && nowMinsRaw < t + SLOT_MINUTES;
              return (
                <div key={t} className="flex items-stretch border-b border-border/30 min-h-[44px]">
                  {/* 時刻ラベル（左・刻み単位。正時は濃く） */}
                  <div className={`w-14 shrink-0 pt-1.5 pr-2 text-right tabular-nums border-r border-border/40 ${isHourRow ? "text-xs font-semibold text-muted-foreground" : "text-[10px] text-muted-foreground/50"}`}>
                    {label}
                  </div>
                  {/* この枠の予約 */}
                  <div className="flex-1 min-w-0 p-1.5 space-y-1.5">
                    {isNowRow && (
                      <div className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="text-[10px] font-medium text-red-500">現在 {minsToTime(nowMinsRaw)}</span>
                      </div>
                    )}
                    {isLunch ? (
                      <div className="text-xs text-muted-foreground/50 py-1.5">昼休み</div>
                    ) : isSlotHoliday(label) && list.length === 0 ? (
                      <div className="flex items-center gap-1 text-xs text-red-400/90 py-1.5 select-none">
                        <Ban className="h-3 w-3" />休診
                      </div>
                    ) : list.length === 0 ? (
                      canBook ? (
                        <button
                          className="w-full flex items-center gap-1.5 text-xs font-medium text-muted-foreground/70 py-2 px-2.5 rounded-lg border border-dashed border-border/80 hover:border-primary/60 hover:text-foreground active:scale-[0.98] active:bg-primary/10 transition-all"
                          onClick={() => onNewBooking(dateStr, label)}
                          data-testid={`agenda-empty-${label}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          予約を追加
                        </button>
                      ) : (
                        <div className="text-xs text-muted-foreground/30 py-2 select-none">空き</div>
                      )
                    ) : list.map(appt => {
                      const c = getTreatmentColor(appt.treatmentType || "");
                      const isNewPatient = appt.visitType === "first" || (appt.treatmentType || "").includes("初診");
                      const start = appt.startTime.slice(0, 5);
                      return (
                        <button
                          key={appt.id}
                          className="w-full flex items-stretch rounded-lg border border-border/60 overflow-hidden bg-card active:brightness-95 transition-all shadow-sm"
                          onClick={() => onAppointmentClick(appt)}
                          data-testid={`agenda-appt-${appt.id}`}
                        >
                          <div className={`w-1.5 shrink-0 ${c.bar}`} />
                          <div className="flex-1 p-2.5 text-left min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-semibold">{start}〜{appt.endTime?.slice(0, 5)}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {appt.chairNumber ? `ユニット${appt.chairNumber}` : appt.staff?.name || "未割当"}
                              </span>
                            </div>
                            <div className="font-semibold mt-0.5 flex items-center gap-1.5 truncate">
                              <span className="truncate">{appt.patient?.name || "患者不明"}</span>
                              {isNewPatient && <span className="text-[9px] bg-primary text-primary-foreground rounded px-1 shrink-0">初診</span>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{appt.treatmentType}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {!isDayOff && canBook && (
          <button
            className="absolute bottom-5 right-5 z-30 flex items-center gap-2 h-14 px-5 rounded-full bg-primary text-primary-foreground shadow-lg font-medium transition-all duration-150 active:scale-90 active:shadow-md hover:shadow-xl"
            onClick={() => onNewBooking(dateStr, suggestTime())}
            data-testid="agenda-new-booking"
          >
            <Plus className="h-5 w-5" />新規予約
          </button>
        )}
      </div>
    );
  }

  if (isDayOff) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-6 px-6 py-2.5 bg-muted/30 border-b border-border text-sm shrink-0">
          <span className="text-muted-foreground">この日は定休日です</span>
          {holidayChip && <div className="ml-auto">{holidayChip}</div>}
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <Ban className="h-9 w-9 mx-auto mb-2 opacity-25" />
            <p className="text-sm font-medium">定休日</p>
            <p className="text-xs mt-1 opacity-60">診療時間設定で変更できます</p>
          </div>
        </div>
      </div>
    );
  }

  const nowLeft = nowTop === null ? null : (nowTop / SLOT_HEIGHT) * SLOT_WIDTH;
  const rowsHeight = Math.max(columns.length, 1) * ROW_HEIGHT;
  const lunchIdx = timeSlots.map((s, i) => (getSlotStatus(s, dayHours) === "lunch" ? i : -1)).filter(i => i >= 0);

  return (
    <div className="h-full flex flex-col bg-background">
      {summaryBar}

      <div className="overflow-auto flex-1" ref={scrollRef}>
        <div className="relative flex flex-col min-h-full select-none [-webkit-user-select:none] [-webkit-touch-callout:none]" style={{ width: LABEL_WIDTH + trackWidth }}>
          {/* 時刻ヘッダー（上部固定・正時のみ表示） */}
          <div className="sticky top-0 z-30 flex shrink-0 bg-background border-b border-border" style={{ height: HEADER_HEIGHT }}>
            <div className="sticky left-0 z-40 shrink-0 bg-background border-r border-border flex items-center justify-center text-xs font-semibold text-muted-foreground" style={{ width: LABEL_WIDTH }}>
              {axis === "chair" ? "ユニット" : "担当"}
            </div>
            <div className="relative" style={{ width: trackWidth }}>
              {timeSlots.map((slot, i) => isHourStart(slot) ? (
                <div
                  key={slot}
                  className="absolute top-0 bottom-0 flex items-center pl-2 text-sm font-semibold text-foreground border-l border-border/70"
                  style={{ left: i * SLOT_WIDTH, width: SLOT_WIDTH * (60 / SLOT_MINUTES) }}
                >
                  {slot}
                </div>
              ) : null)}
            </div>
          </div>

          {/* 本体：左ラベル列 + 右トラック領域 */}
          <div className="flex flex-1 min-h-0 items-start">
            {/* 行ラベル（左固定・横スクロール追従） */}
            <div className="sticky left-0 z-20 shrink-0 bg-background border-r border-border" style={{ width: LABEL_WIDTH }}>
              {columns.length === 0 ? (
                <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height: ROW_HEIGHT }}>
                  {axis === "chair" ? "ユニットなし" : "スタッフなし"}
                </div>
              ) : columns.map(col => (
                <div
                  key={col.key}
                  className={`flex items-center gap-2.5 px-3 border-b border-border ${col.accent ? "bg-amber-50 dark:bg-amber-900/20" : ""}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${col.accent ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100" : "bg-primary/15 text-primary"}`}>
                    {col.kind === "chair" ? col.key : col.label.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className={`text-sm font-semibold leading-tight truncate ${col.accent ? "text-amber-700 dark:text-amber-300" : ""}`}>{col.label}</div>
                    <div className={`text-[11px] truncate ${col.accent ? "text-amber-500" : "text-muted-foreground"}`}>{col.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* トラック領域（ドラッグ計算の基準要素・行の合計高さちょうど） */}
            <div className="relative shrink-0" ref={gridRef} style={{ width: trackWidth, height: rowsHeight }}>
              {/* 縦の時間グリッド（全高）。休診の時間帯は赤系で塗って一目で分かるように */}
              {timeSlots.map((slot, i) => {
                const st = getSlotStatus(slot, dayHours);
                const hour = isHourStart(slot);
                const hh = parseInt(slot, 10);
                const holidaySlot = st === "open" && isSlotHoliday(slot);
                return (
                  <div
                    key={slot}
                    className={`absolute top-0 bottom-0 ${hour ? "border-l border-border/60" : "border-l border-border/15"} ${holidaySlot ? "bg-red-100/60 dark:bg-red-950/25" : st === "closed" ? "bg-muted/30" : st === "lunch" ? "bg-muted/20" : hour && hh % 2 === 1 ? "bg-muted/[0.04]" : ""}`}
                    style={{ left: i * SLOT_WIDTH, width: SLOT_WIDTH }}
                  />
                );
              })}

              {/* 昼休みラベル（帯の中央に1つ） */}
              {lunchIdx.length > 0 && (
                <div
                  className="absolute z-[5] flex items-center justify-center pointer-events-none"
                  style={{ left: lunchIdx[0] * SLOT_WIDTH, width: lunchIdx.length * SLOT_WIDTH, top: 0, height: rowsHeight }}
                >
                  <span className="text-xs font-medium text-muted-foreground/50">昼休み</span>
                </div>
              )}

              {/* 行の背景＋クリックで予約セル */}
              {columns.map((col, ri) => (
                <div
                  key={col.key}
                  className={`absolute left-0 border-b border-border ${col.accent ? "bg-amber-50/20 dark:bg-amber-900/5" : ""}`}
                  style={{ top: ri * ROW_HEIGHT, height: ROW_HEIGHT, width: trackWidth }}
                >
                  {timeSlots.map((slot, i) => {
                    const st = getSlotStatus(slot, dayHours);
                    const clickable = st === "open" && canBook && !isSlotHoliday(slot);
                    return (
                      <div
                        key={slot}
                        className={`absolute top-0 bottom-0 ${clickable ? "cursor-pointer hover:bg-primary/10 active:bg-primary/20 transition-colors" : st === "closed" ? "pointer-events-none" : ""}`}
                        style={{ left: i * SLOT_WIDTH, width: SLOT_WIDTH }}
                        onClick={() => clickable && onSlotClick(dateStr, slot, col.kind === "staff" ? col.key : undefined)}
                        data-testid={clickable ? `slot-${col.key}-${slot}` : undefined}
                      />
                    );
                  })}
                </div>
              ))}

              {/* 現在時刻ライン（縦・全行を貫く） */}
              {nowLeft !== null && nowLeft >= 0 && nowLeft <= trackWidth && (
                <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: nowLeft }}>
                  <div className="w-0.5 h-full bg-red-500" />
                  <div className="absolute -left-[5px] -top-1 w-3 h-3 rounded-full bg-red-500 shadow" />
                </div>
              )}

              {/* ドラッグ先ゴースト */}
              {drag && (
                <div
                  className="absolute z-30 rounded-md border-2 border-dashed border-primary bg-primary/10 pointer-events-none"
                  style={{ left: drag.slotIndex * SLOT_WIDTH + 1, width: drag.durSlots * SLOT_WIDTH - 2, top: drag.rowIndex * ROW_HEIGHT + 3, height: ROW_HEIGHT - 6 }}
                />
              )}

              {/* 予約カード（同時刻の重なりは行内で上下に分割） */}
              {columns.map((col, ri) => {
                const appts = colAppts(col);
                return layoutAppts(appts).map(({ appt, left: vOff, width: vH }) => {
                  const s = timeToMins(appt.startTime.slice(0, 5)) - startHour * 60;
                  const e = appt.endTime ? timeToMins(appt.endTime.slice(0, 5)) - startHour * 60 : s + SLOT_MINUTES;
                  const left = (s / SLOT_MINUTES) * SLOT_WIDTH;
                  const width = Math.max(SLOT_WIDTH - 2, ((e - s) / SLOT_MINUTES) * SLOT_WIDTH - 2);
                  const top = ri * ROW_HEIGHT + vOff * (ROW_HEIGHT - 6) + 3;
                  const height = vH * (ROW_HEIGHT - 6);
                  const dimmed = drag?.apptId === appt.id;
                  return (
                    <div
                      key={appt.id}
                      className="absolute z-10 group touch-none"
                      style={{ left: left + 1, width, top, height }}
                      onPointerDown={canBook ? (ev) => startDrag(ev, appt) : undefined}
                    >
                      <div className={`h-full ${dimmed ? "opacity-40" : canBook ? "cursor-grab active:cursor-grabbing" : ""}`}>
                        {/* 予約モードではドラッグ移動（クリックはpointerup側で処理）、閲覧モードではタップで詳細 */}
                        <ApptCard appt={appt} height={height} onClick={canBook ? () => {} : () => onAppointmentClick(appt)} />
                      </div>
                      {!dimmed && canBook && <GripVertical className="absolute top-0.5 right-0.5 h-3 w-3 text-foreground/30 opacity-0 group-hover:opacity-100 pointer-events-none" />}
                    </div>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────
function WeekView({ currentDate, appointments, businessHours, closedOnHolidays, clinicHolidays, onAppointmentClick, onDayClick }: {
  currentDate: Date;
  appointments: Appointment[];
  businessHours: BusinessHours[];
  closedOnHolidays?: boolean;
  clinicHolidays: Holiday[];
  onAppointmentClick: (a: Appointment) => void;
  onDayClick: (d: Date) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="p-2 md:p-4 overflow-x-hidden md:overflow-x-auto">
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 md:min-w-[760px]">
        {days.map((day, i) => {
          const dow = day.getDay();
          const dateStr = format(day, "yyyy-MM-dd");
          const dayHours = businessHours.find(h => h.dayOfWeek === dow);
          const holidayName = getHolidayName(dateStr);
          const isHolidayClosed = !!holidayName && (closedOnHolidays !== false);
          const isDayOff = !dayHours || dayHours.isClosed || isHolidayClosed;
          const clinicHoliday = clinicHolidays.find(h => h.date === dateStr);
          const isPartialHoliday = clinicHoliday && clinicHoliday.startTime;
          const dayAppts = (Array.isArray(appointments) ? appointments : []).filter(a => isSameDay(parseISO(a.date), day)).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isToday = isSameDay(day, new Date());
          const isSat = i === 6;
          const isSun = i === 0;
          const morning = dayAppts.filter(a => parseInt(a.startTime) < 13).length;
          const afternoon = dayAppts.filter(a => parseInt(a.startTime) >= 13).length;

          const cellContent = (
            <div
              className={`rounded-lg border cursor-pointer hover:shadow-md transition-all active:scale-[0.99] min-h-[104px] md:min-h-[180px] flex flex-col
                ${isDayOff ? "bg-muted/30 border-border/40 opacity-70" : isToday ? "border-primary ring-1 ring-primary/30 bg-primary/5" : "border-border bg-card hover:bg-accent/30"}`}
              onClick={() => onDayClick(day)}
              data-testid={`week-day-${dateStr}`}
            >
              {/* Day header */}
              <div className={`px-3 pt-2.5 pb-1.5 border-b ${isToday ? "border-primary/20" : "border-border/50"}`}>
                <div className={`text-xs font-medium ${isSun || holidayName ? "text-red-500" : isSat ? "text-blue-500" : "text-muted-foreground"}`}>{dayNames[i]}</div>
                <div className={`text-xl font-bold leading-tight ${isToday ? "text-primary" : isSun || holidayName ? "text-red-500" : isSat ? "text-blue-500" : "text-foreground"}`}>
                  {format(day, "d")}
                </div>
                {holidayName && <div className="text-[10px] text-red-500 font-medium leading-tight truncate">{holidayName}</div>}
                {isDayOff && !holidayName ? (
                  <div className="mt-1">
                    <span className="text-[10px] bg-muted text-muted-foreground rounded px-1 py-0.5">休診</span>
                  </div>
                ) : clinicHoliday && !clinicHoliday.startTime ? (
                  <div className="mt-1">
                    <span className="text-[10px] bg-destructive/10 text-destructive rounded px-1 py-0.5">終日休診</span>
                  </div>
                ) : isPartialHoliday ? (
                  <div className="mt-1">
                    <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded px-1 py-0.5">一部休診</span>
                  </div>
                ) : dayAppts.length > 0 ? (
                  <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Sun className="h-2.5 w-2.5" />{morning}</span>
                    <span className="flex items-center gap-0.5"><Sunset className="h-2.5 w-2.5" />{afternoon}</span>
                  </div>
                ) : null}
              </div>

              {/* Appointments */}
              <div className="p-1.5 flex-1 space-y-0.5 overflow-hidden">
                {isDayOff
                  ? null
                  : dayAppts.length === 0
                  ? <p className="text-xs text-muted-foreground/50 text-center pt-3">予約なし</p>
                  : <>
                    {dayAppts.slice(0, 4).map(a => {
                      const c = getTreatmentColor(a.treatmentType || "");
                      return (
                        <div
                          key={a.id}
                          className={`flex items-center gap-1 rounded px-1 py-0.5 text-xs ${c.bg} ${c.text} overflow-hidden`}
                          onClick={e => { e.stopPropagation(); onAppointmentClick(a); }}
                        >
                          <div className={`w-1 h-3.5 rounded-full shrink-0 ${c.bar}`} />
                          <span className="font-mono text-[10px] shrink-0 opacity-70">{a.startTime.slice(0, 5)}</span>
                          <span className="truncate font-medium text-[11px]">{a.patient?.name || "—"}</span>
                        </div>
                      );
                    })}
                    {dayAppts.length > 4 && (
                      <p className="text-[10px] text-muted-foreground px-1">+{dayAppts.length - 4}件</p>
                    )}
                  </>
                }
              </div>
            </div>
          );

          return <div key={i}>{cellContent}</div>;
        })}
      </div>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────────
function MonthView({ currentDate, appointments, businessHours, closedOnHolidays, clinicHolidays, onAppointmentClick, onDayClick }: {
  currentDate: Date;
  appointments: Appointment[];
  businessHours: BusinessHours[];
  closedOnHolidays?: boolean;
  clinicHolidays: Holiday[];
  onAppointmentClick: (a: Appointment) => void;
  onDayClick: (d: Date) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const cells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="p-2 md:p-4 overflow-x-hidden md:overflow-x-auto">
      <div className="border border-border rounded-lg overflow-hidden md:min-w-[680px]">
        {/* Header row */}
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((d, i) => (
            <div key={d} className={`py-2 text-xs font-semibold text-center bg-muted/40 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-muted-foreground"} ${i < 6 ? "border-r border-border/50" : ""}`}>{d}</div>
          ))}
        </div>
        {/* Cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: cells }, (_, idx) => {
            const dayNum = idx - startPad + 1;
            if (dayNum < 1 || dayNum > lastDay.getDate()) {
              return <div key={idx} className={`min-h-[58px] md:min-h-[90px] bg-muted/20 ${idx % 7 < 6 ? "border-r border-border/30" : ""} border-b border-border/30`} />;
            }
            const date = new Date(year, month, dayNum);
            const dateStr = format(date, "yyyy-MM-dd");
            const dow = date.getDay();
            const dayHours = businessHours.find(h => h.dayOfWeek === dow);
            const holidayName = getHolidayName(dateStr);
            const isHolidayClosed = !!holidayName && (closedOnHolidays !== false);
            const isDayOff = !dayHours || dayHours.isClosed || isHolidayClosed;
            const clinicHoliday = clinicHolidays.find(h => h.date === dateStr);
            const isPartialHoliday = clinicHoliday && clinicHoliday.startTime;
            const dayAppts = (Array.isArray(appointments) ? appointments : []).filter(a => a.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isToday = isSameDay(date, new Date());
            const isSun = dow === 0;
            const isSat = dow === 6;

            const cellContent = (
              <div
                className={`min-h-[58px] md:min-h-[90px] p-1 md:p-1.5 cursor-pointer transition-colors hover:bg-accent/40
                  ${idx % 7 < 6 ? "border-r border-border/30" : ""} border-b border-border/30 ${isDayOff ? "bg-muted/30" : isToday ? "bg-primary/5" : ""}`}
                onClick={() => onDayClick(date)}
                data-testid={`month-day-${dateStr}`}
              >
                <div className={`text-sm font-semibold mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground" : (isSun || holidayName) ? "text-red-500" : isSat ? "text-blue-500" : isDayOff ? "text-muted-foreground" : ""}`}>
                  {dayNum}
                </div>
                {holidayName ? (
                  <div className="text-[9px] text-red-400 font-medium leading-tight truncate">{holidayName}</div>
                ) : isDayOff ? (
                  <span className="text-[9px] text-muted-foreground/60">休診</span>
                ) : clinicHoliday && !clinicHoliday.startTime ? (
                  <span className="text-[9px] bg-destructive/10 text-destructive rounded px-1 py-0.5">終日休診</span>
                ) : isPartialHoliday ? (
                  <div className="space-y-0.5">
                    <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 rounded px-1 py-0.5">一部休診</span>
                    {dayAppts.slice(0, 2).map(a => {
                      const c = getTreatmentColor(a.treatmentType || "");
                      return (
                        <div key={a.id} className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] overflow-hidden ${c.bg} ${c.text}`} onClick={e => { e.stopPropagation(); onAppointmentClick(a); }}>
                          <div className={`w-0.5 h-3 rounded-full shrink-0 ${c.bar}`} />
                          <span className="truncate">{a.patient?.name || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    {/* モバイル: 予約をドットで表示（画面幅にフィット・横スクロールなし） */}
                    {dayAppts.length > 0 && (
                      <div className="flex flex-wrap items-center gap-0.5 mt-0.5 md:hidden">
                        {dayAppts.slice(0, 5).map(a => {
                          const c = getTreatmentColor(a.treatmentType || "");
                          return <span key={a.id} className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.bar}`} />;
                        })}
                        {dayAppts.length > 5 && <span className="text-[8px] leading-none text-muted-foreground">+{dayAppts.length - 5}</span>}
                      </div>
                    )}
                    {/* デスクトップ: 時刻＋氏名のテキストチップ */}
                    <div className="hidden md:block space-y-0.5">
                      {dayAppts.slice(0, 3).map(a => {
                        const c = getTreatmentColor(a.treatmentType || "");
                        return (
                          <div
                            key={a.id}
                            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] overflow-hidden ${c.bg} ${c.text}`}
                            onClick={e => { e.stopPropagation(); onAppointmentClick(a); }}
                          >
                            <div className={`w-0.5 h-3 rounded-full shrink-0 ${c.bar}`} />
                            <span className="font-mono shrink-0 opacity-70">{a.startTime.slice(0, 5)}</span>
                            <span className="truncate">{a.patient?.name || a.treatmentType || "—"}</span>
                          </div>
                        );
                      })}
                      {dayAppts.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayAppts.length - 3}件</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );

            return <div key={idx}>{cellContent}</div>;
          })}
        </div>
      </div>
    </div>
  );
}
