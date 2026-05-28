import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay, parseISO, addMonths, subMonths, addWeeks, subWeeks } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Plus, Sun, Sunset, Eye, Ban, Trash2, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AppointmentModal } from "@/components/appointment-modal";
import { getHolidayName, isHoliday } from "@/lib/holidays";
import { apiRequest } from "@/lib/queryClient";

type CalendarMode = "view" | "book" | "holiday";

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

function addMinutes(time: string, mins: number): string {
  const total = toMins(time) + mins;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getPresetTimes(bh: BusinessHours | undefined, preset: "morning" | "afternoon"): [string, string] {
  if (preset === "morning") {
    const start = bh?.openTime?.slice(0, 5) ?? "09:00";
    if (bh?.closeTime && bh?.afternoonOpenTime) {
      return [start, bh.closeTime.slice(0, 5)];
    } else if (bh?.closeTime) {
      const endMins = toMins(bh.closeTime.slice(0, 5));
      const startMins = toMins(start);
      const mid = Math.round((startMins + endMins) / 2 / 30) * 30;
      return [start, `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`];
    }
    return [start, "13:00"];
  } else {
    if (bh?.afternoonOpenTime && bh?.afternoonCloseTime) {
      return [bh.afternoonOpenTime.slice(0, 5), bh.afternoonCloseTime.slice(0, 5)];
    } else if (bh?.afternoonOpenTime && bh?.closeTime) {
      return [bh.afternoonOpenTime.slice(0, 5), bh.closeTime.slice(0, 5)];
    } else if (bh?.openTime && bh?.closeTime) {
      const startMins = toMins(bh.openTime.slice(0, 5));
      const endMins = toMins(bh.closeTime.slice(0, 5));
      const mid = Math.round((startMins + endMins) / 2 / 30) * 30;
      const midStr = `${String(Math.floor(mid / 60)).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
      return [midStr, bh.closeTime.slice(0, 5)];
    }
    return ["13:00", "18:00"];
  }
}

// 30分刻みの時間選択肢（06:00〜23:30）
const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 23; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 23) TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:30`);
}
TIME_OPTIONS.push("23:30");

function HolidayPopoverContent({
  dateLabel, dateStr, dayHours, clinicHoliday, onQuickSave, onCustomSave, onDelete, onClose,
}: {
  dateLabel: string;
  dateStr: string;
  dayHours: BusinessHours | undefined;
  clinicHoliday: Holiday | undefined;
  onQuickSave: (preset: "morning" | "afternoon" | "allday") => Promise<void>;
  onCustomSave: (startTime: string, endTime: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [morningStart, morningEnd] = getPresetTimes(dayHours, "morning");
  const [afternoonStart, afternoonEnd] = getPresetTimes(dayHours, "afternoon");
  const [customStart, setCustomStart] = useState(morningStart);
  const [customEnd, setCustomEnd] = useState(morningEnd);
  const [saving, setSaving] = useState(false);

  const handleQuick = async (preset: "morning" | "afternoon" | "allday") => {
    setSaving(true);
    try { await onQuickSave(preset); } finally { setSaving(false); }
    onClose();
  };
  const handleCustom = async () => {
    if (!customStart || !customEnd || customStart >= customEnd) return;
    setSaving(true);
    try { await onCustomSave(customStart, customEnd); } finally { setSaving(false); }
    onClose();
  };
  const handleDelete = async () => {
    setSaving(true);
    try { await onDelete(); } finally { setSaving(false); }
    onClose();
  };

  const selClass = "flex-1 min-w-0 h-7 rounded border border-border bg-background text-xs px-1 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-2.5">
      <p className="text-xs font-semibold text-foreground">{dateLabel} の休診設定</p>
      <div className="grid grid-cols-3 gap-1">
        <button
          className="flex flex-col items-center gap-0.5 rounded-md border border-border py-2 px-1 text-[11px] font-medium hover:bg-accent transition-colors disabled:opacity-50"
          onClick={() => handleQuick("morning")} disabled={saving}
          data-testid={`holiday-morning-${dateStr}`}
        >
          <Sun className="h-3.5 w-3.5 text-amber-500" />
          <span>午前</span>
          <span className="text-[9px] text-muted-foreground">{morningStart}〜{morningEnd}</span>
        </button>
        <button
          className="flex flex-col items-center gap-0.5 rounded-md border border-border py-2 px-1 text-[11px] font-medium hover:bg-accent transition-colors disabled:opacity-50"
          onClick={() => handleQuick("afternoon")} disabled={saving}
          data-testid={`holiday-afternoon-${dateStr}`}
        >
          <Sunset className="h-3.5 w-3.5 text-orange-500" />
          <span>午後</span>
          <span className="text-[9px] text-muted-foreground">{afternoonStart}〜{afternoonEnd}</span>
        </button>
        <button
          className="flex flex-col items-center gap-0.5 rounded-md border border-border py-2 px-1 text-[11px] font-medium hover:bg-accent transition-colors disabled:opacity-50"
          onClick={() => handleQuick("allday")} disabled={saving}
          data-testid={`holiday-allday-${dateStr}`}
        >
          <Ban className="h-3.5 w-3.5 text-destructive" />
          <span>終日</span>
          <span className="text-[9px] text-muted-foreground">全日</span>
        </button>
      </div>
      {/* カスタム時間帯 */}
      <div className="flex items-center gap-1 pt-0.5 border-t border-border/50">
        <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
        <select value={customStart} onChange={e => setCustomStart(e.target.value)} className={selClass} data-testid={`holiday-custom-start-${dateStr}`}>
          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="text-[10px] text-muted-foreground shrink-0">〜</span>
        <select value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={selClass} data-testid={`holiday-custom-end-${dateStr}`}>
          {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          onClick={handleCustom}
          disabled={saving || customStart >= customEnd}
          className="shrink-0 h-7 px-2 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
          data-testid={`holiday-custom-confirm-${dateStr}`}
        >
          確定
        </button>
      </div>
      {clinicHoliday && (
        <button
          className="w-full flex items-center justify-center gap-1.5 rounded-md border border-destructive/40 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
          onClick={handleDelete} disabled={saving}
          data-testid={`holiday-delete-${dateStr}`}
        >
          <Trash2 className="h-3 w-3" />休診を解除
        </button>
      )}
    </div>
  );
}

export function CalendarView({ initialDate }: { initialDate?: Date }) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [currentDate, setCurrentDate] = useState(initialDate ?? new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [initialSlotData, setInitialSlotData] = useState<{ date: string; time: string; staffId?: string; patientId?: string; patientName?: string } | null>(null);
  const [filterStaffId, setFilterStaffId] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("view");
  const [holidayModalDate, setHolidayModalDate] = useState<string | null>(null);
  const [holidayModalInitialTime, setHolidayModalInitialTime] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: businessHours = [] } = useQuery<BusinessHours[]>({
    queryKey: ["/api/business-hours"],
  });

  const createHolidayMutation = useMutation({
    mutationFn: (body: { date: string; startTime?: string; endTime?: string; reason?: string }) =>
      apiRequest("POST", "/api/holidays", body),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/holidays/${id}`),
  });

  const handleHolidayQuickSave = useCallback(async (
    date: string,
    preset: "morning" | "afternoon" | "allday",
    dayOfWeek: number,
    existingId?: string,
  ) => {
    if (existingId) {
      await apiRequest("DELETE", `/api/holidays/${existingId}`);
    }
    const bh = businessHours.find(h => h.dayOfWeek === dayOfWeek);
    if (preset === "allday") {
      await createHolidayMutation.mutateAsync({ date });
    } else {
      const [startTime, endTime] = getPresetTimes(bh, preset);
      await createHolidayMutation.mutateAsync({ date, startTime, endTime });
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
  }, [businessHours, createHolidayMutation, queryClient]);

  const handleHolidayCustomSave = useCallback(async (
    date: string,
    startTime: string,
    endTime: string,
    existingId?: string,
  ) => {
    if (existingId) {
      await apiRequest("DELETE", `/api/holidays/${existingId}`);
    }
    await createHolidayMutation.mutateAsync({ date, startTime, endTime });
    await queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
  }, [createHolidayMutation, queryClient]);

  const { data: clinicSettings } = useQuery<{ closedOnHolidays?: boolean }>({
    queryKey: ["/api/clinic-settings"],
  });
  const closedOnHolidays = clinicSettings?.closedOnHolidays !== false;

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
    queryFn: () => fetch(`/api/appointments?startDate=${range.startDate}&endDate=${range.endDate}`).then(r => r.json()),
  });
  const { data: allStaff = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  // showInCalendar=false のスタッフをカレンダー列から除外
  const staff = allStaff.filter(s => s.showInCalendar !== false);

  // 承認済みシフト取得（非常勤・契約スタッフの出勤日特定に使用）
  const shiftMonth = format(currentDate, "yyyy-MM");
  const { data: approvedShifts = [] } = useQuery<ShiftRecord[]>({
    queryKey: ["/api/shifts", shiftMonth],
    queryFn: () => fetch(`/api/shifts?month=${shiftMonth}`).then(r => r.json()),
  });
  const approvedShiftSet = new Set<string>(
    approvedShifts.filter(s => s.status === "approved").map(s => `${s.staffId}:${s.date}`)
  );

  // 日ビュー: 非常勤・契約スタッフはシフト承認済みの日のみ表示
  const currentDateStr = format(currentDate, "yyyy-MM-dd");
  const staffForDay = staff.filter(s => {
    if (s.employmentType !== "parttime" && s.employmentType !== "contract") return true;
    return approvedShiftSet.has(`${s.id}:${currentDateStr}`);
  });

  // スタッフフィルター適用
  const appointments = filterStaffId
    ? allAppointments.filter(a => a.staffId === filterStaffId)
    : allAppointments;

  const navigate = (dir: 1 | -1) => {
    if (viewMode === "day") setCurrentDate(prev => addDays(prev, dir));
    else if (viewMode === "week") setCurrentDate(prev => dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1));
    else setCurrentDate(prev => dir === 1 ? addMonths(prev, 1) : subMonths(prev, 1));
  };

  const handleSlotClick = (date: string, time: string, staffId?: string) => {
    if (calendarMode === "book") {
      setSelectedAppointment(null);
      setInitialSlotData({ date, time, staffId });
      setIsModalOpen(true);
    } else if (calendarMode === "holiday") {
      setHolidayModalDate(date);
      setHolidayModalInitialTime(time);
    }
    // view mode: do nothing
  };

  const handleDayClick = (d: Date) => {
    if (calendarMode !== "holiday") {
      setCurrentDate(d);
      setViewMode("day");
    }
    // holiday mode: handled by popover inside WeekView/MonthView
  };

  const handleApptClick = (appt: Appointment) => {
    setSelectedAppointment(appt);
    setInitialSlotData(null);
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigate(-1)} data-testid="button-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-sm md:text-base font-semibold text-center min-w-0 truncate max-w-[140px] md:max-w-none md:min-w-[220px]" data-testid="calendar-title">{headerTitle}</h2>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => navigate(1)} data-testid="button-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="h-8 text-xs ml-0.5">今日</Button>
          </div>
          {/* カレンダーモード切替 */}
          <div className="flex border border-border rounded-md overflow-hidden">
            {([
              { mode: "view" as CalendarMode, icon: Eye, label: "閲覧" },
              { mode: "book" as CalendarMode, icon: Plus, label: "予約" },
              { mode: "holiday" as CalendarMode, icon: Ban, label: "休診" },
            ] as const).map(({ mode, icon: Icon, label }, idx) => (
              <button
                key={mode}
                className={`flex items-center gap-1.5 h-9 px-3 text-xs font-medium transition-colors ${idx > 0 ? "border-l border-border" : ""} ${calendarMode === mode ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                onClick={() => setCalendarMode(mode)}
                data-testid={`calendar-mode-${mode}`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* ビュー切り替え */}
          <div className="flex border border-border rounded-md overflow-hidden w-fit">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                className={`px-2.5 md:px-3 py-1.5 text-xs md:text-sm font-medium transition-colors ${viewMode === mode ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                onClick={() => setViewMode(mode)}
                data-testid={`view-${mode}`}
              >
                {mode === "day" ? "日" : mode === "week" ? "週" : "月"}
              </button>
            ))}
          </div>

          {/* スタッフ別フィルター（2名以上いる場合のみ表示） */}
          {staff.length >= 2 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">担当：</span>
              <div className="flex border border-border rounded-md overflow-hidden">
                <button
                  className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${filterStaffId === null ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
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
                      className={`px-2.5 py-1.5 text-xs font-medium transition-colors border-l border-border ${filterStaffId === s.id ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : viewMode === "day" ? (
          <DayView currentDate={currentDate} appointments={appointments} staff={staffForDay} filterStaffId={filterStaffId} businessHours={businessHours} calendarMode={calendarMode} clinicHolidays={clinicHolidays} onAppointmentClick={handleApptClick} onSlotClick={handleSlotClick} onHolidayQuickSave={handleHolidayQuickSave} onHolidayCustomSave={handleHolidayCustomSave} onHolidayDelete={async (id) => { await deleteHolidayMutation.mutateAsync(id); await queryClient.invalidateQueries({ queryKey: ["/api/holidays"] }); }} />
        ) : viewMode === "week" ? (
          <WeekView currentDate={currentDate} appointments={appointments} businessHours={businessHours} closedOnHolidays={closedOnHolidays} clinicHolidays={clinicHolidays} calendarMode={calendarMode} onAppointmentClick={handleApptClick} onDayClick={handleDayClick} onHolidayQuickSave={handleHolidayQuickSave} onHolidayCustomSave={handleHolidayCustomSave} onHolidayDelete={async (id) => { await deleteHolidayMutation.mutateAsync(id); await queryClient.invalidateQueries({ queryKey: ["/api/holidays"] }); }} onHolidayDetailOpen={(date) => { setHolidayModalDate(date); setHolidayModalInitialTime(null); }} />
        ) : (
          <MonthView currentDate={currentDate} appointments={appointments} businessHours={businessHours} closedOnHolidays={closedOnHolidays} clinicHolidays={clinicHolidays} calendarMode={calendarMode} onAppointmentClick={handleApptClick} onDayClick={handleDayClick} onHolidayQuickSave={handleHolidayQuickSave} onHolidayCustomSave={handleHolidayCustomSave} onHolidayDelete={async (id) => { await deleteHolidayMutation.mutateAsync(id); await queryClient.invalidateQueries({ queryKey: ["/api/holidays"] }); }} onHolidayDetailOpen={(date) => { setHolidayModalDate(date); setHolidayModalInitialTime(null); }} />
        )}
      </div>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        initialSlotData={initialSlotData}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/appointments"] })}
        onSlotClick={handleSlotClick}
      />

      <SpotHolidayModal
        date={holidayModalDate}
        initialTime={holidayModalInitialTime}
        businessHours={businessHours}
        existingHoliday={holidayModalDate ? (clinicHolidays.find(h => h.date === holidayModalDate) ?? null) : null}
        onClose={() => { setHolidayModalDate(null); setHolidayModalInitialTime(null); }}
        onSaved={() => { queryClient.invalidateQueries({ queryKey: ["/api/holidays"] }); setHolidayModalDate(null); setHolidayModalInitialTime(null); }}
      />
    </div>
  );
}

// ─── Appointment Card ─────────────────────────────────────────────────────────
function ApptCard({ appt, height, onClick }: { appt: Appointment; height: number; onClick: () => void }) {
  const c = getTreatmentColor(appt.treatmentType || "");
  const isNewPatient = (appt.treatmentType || "").includes("初診");
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
              {isNewPatient && <span className="text-[9px] bg-emerald-500 text-white rounded px-0.5 shrink-0">新患</span>}
            </div>
            <div className="text-[10px] opacity-70 truncate mt-0.5">
              {appt.startTime.slice(0, 5)}〜{appt.endTime?.slice(0, 5)} {appt.treatmentType}
            </div>
          </>
        ) : height >= 36 ? (
          <div className="flex items-center gap-1 h-full">
            <span className="text-xs font-semibold truncate leading-tight">{appt.patient?.name || "患者不明"}</span>
            {isNewPatient && <span className="text-[9px] bg-emerald-500 text-white rounded px-0.5 shrink-0">新患</span>}
            {appt.treatmentType && <span className="text-[10px] opacity-60 truncate shrink-0 hidden sm:block">{appt.treatmentType}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-1 h-full">
            <span className="text-[10px] font-semibold truncate leading-none">{appt.patient?.name || "患者不明"}</span>
            {isNewPatient && <span className="text-[9px] bg-emerald-500 text-white rounded px-0.5 shrink-0">新患</span>}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Day View ────────────────────────────────────────────────────────────────
function DayView({ currentDate, appointments, staff: allStaff, filterStaffId, businessHours, calendarMode, clinicHolidays, onAppointmentClick, onSlotClick, onHolidayQuickSave, onHolidayCustomSave, onHolidayDelete }: {
  currentDate: Date;
  appointments: Appointment[];
  staff: Staff[];
  filterStaffId: string | null;
  businessHours: BusinessHours[];
  calendarMode: CalendarMode;
  clinicHolidays: Holiday[];
  onAppointmentClick: (a: Appointment) => void;
  onSlotClick: (date: string, time: string, staffId?: string) => void;
  onHolidayQuickSave: (date: string, preset: "morning" | "afternoon" | "allday", dayOfWeek: number) => Promise<void>;
  onHolidayCustomSave: (date: string, startTime: string, endTime: string) => Promise<void>;
  onHolidayDelete: (id: string) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState<number | null>(null);
  const [holidayPopoverOpen, setHolidayPopoverOpen] = useState(false);
  const isToday = isSameDay(currentDate, new Date());

  // スタッフフィルター適用：担当選択時はその列だけ表示
  const staff = filterStaffId ? allStaff.filter(s => s.id === filterStaffId) : allStaff;

  const dow = currentDate.getDay();
  const dayHours = businessHours.find(h => h.dayOfWeek === dow);
  const { startHour, endHour } = computeHourRange(businessHours.length > 0 ? businessHours : [{ dayOfWeek: 0, openTime: "09:00", closeTime: "18:00", isClosed: false }]);
  const isDayOff = !dayHours || dayHours.isClosed;
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const clinicHoliday = clinicHolidays.find(h => h.date === dateStr);
  const dateLabel = format(currentDate, "M月d日(E)", { locale: ja });

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

  useEffect(() => {
    if (nowTop !== null && scrollRef.current) {
      scrollRef.current.scrollTop = Math.max(0, nowTop - 120);
    }
  }, []);

  const todayAppts = appointments.filter(a => isSameDay(parseISO(a.date), currentDate));
  const activeAppts = todayAppts.filter(a => a.status !== "cancelled");
  const morningAppts = activeAppts.filter(a => parseInt(a.startTime) < 13);
  const afternoonAppts = activeAppts.filter(a => parseInt(a.startTime) >= 13);
  const morningCount = morningAppts.length;
  const afternoonCount = afternoonAppts.length;
  const morningNew = morningAppts.filter(a => (a.treatmentType || "").includes("初診")).length;
  const afternoonNew = afternoonAppts.filter(a => (a.treatmentType || "").includes("初診")).length;
  const unassignedAppts = todayAppts.filter(a => !a.staffId);
  const hasUnassigned = unassignedAppts.length > 0;
  const totalCols = (staff.length || 1) + (hasUnassigned ? 1 : 0);

  const timeToMins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const getAppts = (staffId: string, slot: string) => todayAppts.filter(a => a.staffId === staffId && a.startTime.slice(0, 5) === slot);
  const getUnassignedAppts = (slot: string) => unassignedAppts.filter(a => a.startTime.slice(0, 5) === slot);
  const isContinuation = (appts: Appointment[], slot: string) =>
    appts.some(a => {
      const s = timeToMins(a.startTime.slice(0, 5));
      const e = a.endTime ? timeToMins(a.endTime.slice(0, 5)) : s + SLOT_MINUTES;
      return s < timeToMins(slot) && e > timeToMins(slot);
    });
  const getHeight = (appt: Appointment) => {
    const s = timeToMins(appt.startTime.slice(0, 5));
    const e = appt.endTime ? timeToMins(appt.endTime.slice(0, 5)) : s + SLOT_MINUTES;
    return Math.max(1, (e - s) / SLOT_MINUTES) * SLOT_HEIGHT - 4;
  };
  const isHourStart = (slot: string) => slot.endsWith(":00");

  const holidayButton = (
    <Popover open={holidayPopoverOpen} onOpenChange={setHolidayPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors shrink-0 ${clinicHoliday ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400" : "border-border text-muted-foreground hover:bg-muted/60"}`}
          data-testid="day-holiday-button"
        >
          <Ban className="h-3 w-3" />
          {clinicHoliday ? "休診中" : "休診設定"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-56" align="end">
        <HolidayPopoverContent
          dateLabel={dateLabel}
          dateStr={dateStr}
          dayHours={dayHours}
          clinicHoliday={clinicHoliday}
          onQuickSave={async (preset) => { await onHolidayQuickSave(dateStr, preset, dow); setHolidayPopoverOpen(false); }}
          onCustomSave={async (s, e) => { await onHolidayCustomSave(dateStr, s, e); setHolidayPopoverOpen(false); }}
          onDelete={async () => { if (clinicHoliday) { await onHolidayDelete(clinicHoliday.id); setHolidayPopoverOpen(false); } }}
          onClose={() => setHolidayPopoverOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );

  if (isDayOff) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center gap-6 px-6 py-2.5 bg-muted/30 border-b border-border text-sm shrink-0">
          <span className="text-muted-foreground">この日は定休日です</span>
          <div className="ml-auto">{holidayButton}</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="text-4xl mb-3">🏥</div>
            <p className="font-medium">定休日</p>
            <p className="text-sm mt-1 opacity-60">診療時間設定で変更できます</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Summary */}
      <div className="flex items-center gap-4 px-4 md:px-6 py-2 bg-muted/30 border-b border-border text-sm shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
          <Sun className="h-3.5 w-3.5" />午前 <strong className="text-foreground">{morningCount}</strong>件
          {morningNew > 0 && <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium ml-0.5">(新患{morningNew}名)</span>}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
          <Sunset className="h-3.5 w-3.5" />午後 <strong className="text-foreground">{afternoonCount}</strong>件
          {afternoonNew > 0 && <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium ml-0.5">(新患{afternoonNew}名)</span>}
        </div>
        <div className="text-muted-foreground shrink-0">計 <strong className="text-foreground">{activeAppts.length}</strong>件</div>
        {hasUnassigned && <div className="text-amber-600 dark:text-amber-400 font-medium shrink-0">未割当 <strong>{unassignedAppts.filter(a => a.status !== "cancelled").length}</strong>件</div>}
        {dayHours?.openTime && (
          <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
            診療時間: {dayHours.openTime.slice(0,5)}〜{dayHours.closeTime?.slice(0,5) || ""}
            {dayHours.afternoonOpenTime && ` / ${dayHours.afternoonOpenTime.slice(0,5)}〜${dayHours.afternoonCloseTime?.slice(0,5) || ""}`}
          </div>
        )}
        <div className="ml-auto">{holidayButton}</div>
      </div>

      <div className="overflow-auto flex-1" ref={scrollRef}>
        <div className="min-w-[600px] relative">
          {/* Header */}
          <div className="sticky top-0 z-30 bg-background border-b border-border grid" style={{ gridTemplateColumns: `64px repeat(${totalCols}, 1fr)` }}>
            <div className="p-2 text-xs font-medium text-muted-foreground text-center bg-muted/40 border-r border-border">時間</div>
            {staff.length === 0 && !hasUnassigned
              ? <div className="p-3 text-sm font-medium text-center bg-muted/40">スタッフなし</div>
              : staff.map(s => (
                <div key={s.id} className="p-2.5 text-center bg-muted/40 border-r border-border last:border-r-0">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.role === "doctor" ? "歯科医師" : "衛生士"}</div>
                </div>
              ))
            }
            {hasUnassigned && (
              <div className="p-2.5 text-center bg-amber-50 dark:bg-amber-900/20">
                <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">未割り当て</div>
                <div className="text-xs text-amber-500">担当者未設定</div>
              </div>
            )}
          </div>

          {/* Grid wrapper – now-line is relative to this, not the outer container */}
          <div className="relative">
          {/* Now line */}
          {nowTop !== null && (
            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${nowTop}px` }}>
              <div className="flex items-center">
                <div className="w-16 flex justify-end pr-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                </div>
                <div className="flex-1 h-0.5 bg-red-500 opacity-80" />
              </div>
            </div>
          )}

          {/* Grid – absolute positioning to prevent column drift */}
          <div className="flex" style={{ height: `${timeSlots.length * SLOT_HEIGHT}px` }}>
            {/* Time column */}
            <div className="w-16 shrink-0 relative border-r border-border">
              {timeSlots.map((slot, i) => (
                <div
                  key={slot}
                  className={`absolute left-0 right-0 border-b ${isHourStart(slot) ? "border-border/30 text-foreground font-semibold" : "border-border text-muted-foreground/50"} flex items-start justify-center pt-0.5 text-xs font-mono select-none`}
                  style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                >
                  {isHourStart(slot) ? slot : ""}
                </div>
              ))}
            </div>

            {/* Staff columns */}
            <div className="flex-1 flex min-w-0">
              {staff.length === 0 && !hasUnassigned ? (
                <div className="flex-1 relative">
                  {timeSlots.map((slot, i) => {
                    const st = getSlotStatus(slot, dayHours);
                    return (
                      <div
                        key={slot}
                        className={`absolute left-0 right-0 border-b ${isHourStart(slot) ? "border-border/30" : "border-border"} ${st === "lunch" ? "bg-muted/30" : st === "closed" ? "bg-muted/40" : ""}`}
                        style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                      >
                        {st === "lunch" && (
                          <div className="h-full flex items-center justify-center pointer-events-none">
                            <span className="text-[10px] text-muted-foreground/40">昼休み</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  {staff.map(s => {
                    const sAppts = todayAppts.filter(a => a.staffId === s.id);
                    return (
                      <div key={s.id} className="flex-1 relative border-l border-border/40 min-w-0">
                        {/* Background grid slots */}
                        {timeSlots.map((slot, i) => {
                          const st = getSlotStatus(slot, dayHours);
                          const isClosed = st === "closed";
                          const isLunch = st === "lunch";
                          const cont = isContinuation(sAppts, slot);
                          return (
                            <div
                              key={slot}
                              className={`absolute left-0 right-0 border-b ${isHourStart(slot) ? "border-border/30" : "border-border"} ${isClosed ? "bg-muted/40 pointer-events-none" : isLunch ? "bg-muted/30" : cont ? "" : calendarMode !== "view" ? "cursor-pointer hover:bg-primary/5" : ""}`}
                              style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                              onClick={() => !isClosed && !isLunch && !cont && calendarMode !== "view" && onSlotClick(dateStr, slot, s.id)}
                              data-testid={!isClosed && !isLunch && !cont ? `slot-${s.id}-${slot}` : undefined}
                            >
                              {isLunch && (
                                <div className="h-full flex items-center justify-center pointer-events-none">
                                  <span className="text-[10px] text-muted-foreground/40">昼休み</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {/* Appointment cards – concurrent appointments rendered side-by-side */}
                        {layoutAppts(sAppts).map(({ appt, left, width }) => {
                          const startMins = timeToMins(appt.startTime.slice(0, 5)) - startHour * 60;
                          const endMins = appt.endTime
                            ? timeToMins(appt.endTime.slice(0, 5)) - startHour * 60
                            : startMins + SLOT_MINUTES;
                          const top = (startMins / SLOT_MINUTES) * SLOT_HEIGHT;
                          const height = Math.max(SLOT_HEIGHT - 4, ((endMins - startMins) / SLOT_MINUTES) * SLOT_HEIGHT - 4);
                          const GAP = 1;
                          return (
                            <div key={appt.id} className="absolute z-10" style={{
                              top: top + 2,
                              height,
                              left: `calc(${left * 100}% + ${GAP}px)`,
                              width: `calc(${width * 100}% - ${GAP * 2}px)`,
                            }}>
                              <ApptCard appt={appt} height={height} onClick={() => onAppointmentClick(appt)} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {hasUnassigned && (
                    <div className="flex-1 relative border-l border-border/40 bg-amber-50/20 dark:bg-amber-900/5 min-w-0">
                      {timeSlots.map((slot, i) => {
                        const st = getSlotStatus(slot, dayHours);
                        const isClosed = st === "closed";
                        const isLunch = st === "lunch";
                        const cont = isContinuation(unassignedAppts, slot);
                        return (
                          <div
                            key={slot}
                            className={`absolute left-0 right-0 border-b ${isHourStart(slot) ? "border-border/30" : "border-border"} ${isClosed ? "bg-muted/40 pointer-events-none" : isLunch ? "bg-amber-50/50 dark:bg-amber-900/10" : cont ? "bg-amber-50/20 dark:bg-amber-900/5" : calendarMode !== "view" ? "cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20" : ""}`}
                            style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                            onClick={() => !isClosed && !isLunch && !cont && calendarMode !== "view" && onSlotClick(dateStr, slot)}
                          />
                        );
                      })}
                      {layoutAppts(unassignedAppts).map(({ appt, left, width }) => {
                        const startMins = timeToMins(appt.startTime.slice(0, 5)) - startHour * 60;
                        const endMins = appt.endTime
                          ? timeToMins(appt.endTime.slice(0, 5)) - startHour * 60
                          : startMins + SLOT_MINUTES;
                        const top = (startMins / SLOT_MINUTES) * SLOT_HEIGHT;
                        const height = Math.max(SLOT_HEIGHT - 4, ((endMins - startMins) / SLOT_MINUTES) * SLOT_HEIGHT - 4);
                        const GAP = 1;
                        return (
                          <div key={appt.id} className="absolute z-10" style={{
                            top: top + 2,
                            height,
                            left: `calc(${left * 100}% + ${GAP}px)`,
                            width: `calc(${width * 100}% - ${GAP * 2}px)`,
                          }}>
                            <ApptCard appt={appt} height={height} onClick={() => onAppointmentClick(appt)} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          </div>{/* end grid wrapper relative */}
        </div>
      </div>
    </div>
  );
}

// ─── Week View ───────────────────────────────────────────────────────────────
function WeekView({ currentDate, appointments, businessHours, closedOnHolidays, clinicHolidays, calendarMode, onAppointmentClick, onDayClick, onHolidayQuickSave, onHolidayCustomSave, onHolidayDelete, onHolidayDetailOpen }: {
  currentDate: Date;
  appointments: Appointment[];
  businessHours: BusinessHours[];
  closedOnHolidays?: boolean;
  clinicHolidays: Holiday[];
  calendarMode: CalendarMode;
  onAppointmentClick: (a: Appointment) => void;
  onDayClick: (d: Date) => void;
  onHolidayQuickSave: (date: string, preset: "morning" | "afternoon" | "allday", dayOfWeek: number, existingId?: string) => Promise<void>;
  onHolidayCustomSave: (date: string, startTime: string, endTime: string, existingId?: string) => Promise<void>;
  onHolidayDelete: (id: string) => Promise<void>;
  onHolidayDetailOpen: (date: string) => void;
}) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const [popoverDate, setPopoverDate] = useState<string | null>(null);

  return (
    <div className="p-4">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day, i) => {
          const dow = day.getDay();
          const dateStr = format(day, "yyyy-MM-dd");
          const dayHours = businessHours.find(h => h.dayOfWeek === dow);
          const holidayName = getHolidayName(dateStr);
          const isHolidayClosed = !!holidayName && (closedOnHolidays !== false);
          const isDayOff = !dayHours || dayHours.isClosed || isHolidayClosed;
          const clinicHoliday = clinicHolidays.find(h => h.date === dateStr);
          const isPartialHoliday = clinicHoliday && clinicHoliday.startTime;
          const dayAppts = appointments.filter(a => isSameDay(parseISO(a.date), day)).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const isToday = isSameDay(day, new Date());
          const isSat = i === 6;
          const isSun = i === 0;
          const morning = dayAppts.filter(a => parseInt(a.startTime) < 13).length;
          const afternoon = dayAppts.filter(a => parseInt(a.startTime) >= 13).length;

          const isPopOpen = popoverDate === dateStr;
          const [morningStart, morningEnd] = getPresetTimes(dayHours, "morning");
          const [afternoonStart, afternoonEnd] = getPresetTimes(dayHours, "afternoon");

          const cellContent = (
            <div
              className={`rounded-lg border cursor-pointer hover:shadow-md transition-all min-h-[180px] flex flex-col
                ${isDayOff ? "bg-muted/30 border-border/40 opacity-70" : calendarMode === "holiday" ? (isPopOpen ? "ring-2 ring-destructive/60 border-destructive/40" : "hover:ring-2 hover:ring-destructive/40") : isToday ? "border-primary ring-1 ring-primary/30 bg-primary/5" : "border-border bg-card hover:bg-accent/30"}`}
              onClick={() => calendarMode === "holiday" ? setPopoverDate(isPopOpen ? null : dateStr) : onDayClick(day)}
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
                          onClick={e => {
                            if (calendarMode === "holiday") { e.stopPropagation(); setPopoverDate(isPopOpen ? null : dateStr); return; }
                            e.stopPropagation(); onAppointmentClick(a);
                          }}
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

          if (calendarMode !== "holiday") {
            return <div key={i}>{cellContent}</div>;
          }

          return (
            <Popover key={i} open={isPopOpen} onOpenChange={open => !open && setPopoverDate(null)}>
              <PopoverTrigger asChild>{cellContent}</PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="start" side="bottom" onClick={e => e.stopPropagation()}>
                <HolidayPopoverContent
                  dateLabel={format(day, "M月d日（E）", { locale: ja })}
                  dateStr={dateStr}
                  dayHours={businessHours.find(h => h.dayOfWeek === dow)}
                  clinicHoliday={clinicHoliday}
                  onQuickSave={async (preset) => onHolidayQuickSave(dateStr, preset, dow, clinicHoliday?.id)}
                  onCustomSave={async (start, end) => onHolidayCustomSave(dateStr, start, end, clinicHoliday?.id)}
                  onDelete={async () => onHolidayDelete(clinicHoliday!.id)}
                  onClose={() => setPopoverDate(null)}
                />
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

// ─── Month View ──────────────────────────────────────────────────────────────
function MonthView({ currentDate, appointments, businessHours, closedOnHolidays, clinicHolidays, calendarMode, onAppointmentClick, onDayClick, onHolidayQuickSave, onHolidayCustomSave, onHolidayDelete, onHolidayDetailOpen }: {
  currentDate: Date;
  appointments: Appointment[];
  businessHours: BusinessHours[];
  closedOnHolidays?: boolean;
  clinicHolidays: Holiday[];
  calendarMode: CalendarMode;
  onAppointmentClick: (a: Appointment) => void;
  onDayClick: (d: Date) => void;
  onHolidayQuickSave: (date: string, preset: "morning" | "afternoon" | "allday", dayOfWeek: number, existingId?: string) => Promise<void>;
  onHolidayCustomSave: (date: string, startTime: string, endTime: string, existingId?: string) => Promise<void>;
  onHolidayDelete: (id: string) => Promise<void>;
  onHolidayDetailOpen: (date: string) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const [popoverDate, setPopoverDate] = useState<string | null>(null);
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const cells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7;
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="p-4">
      <div className="border border-border rounded-lg overflow-hidden">
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
              return <div key={idx} className={`min-h-[90px] bg-muted/20 ${idx % 7 < 6 ? "border-r border-border/30" : ""} border-b border-border/30`} />;
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
            const dayAppts = appointments.filter(a => a.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
            const isToday = isSameDay(date, new Date());
            const isSun = dow === 0;
            const isSat = dow === 6;

            const isPopOpen = popoverDate === dateStr;
            const [morningStart, morningEnd] = getPresetTimes(dayHours, "morning");
            const [afternoonStart, afternoonEnd] = getPresetTimes(dayHours, "afternoon");

            const cellContent = (
              <div
                className={`min-h-[90px] p-1.5 cursor-pointer transition-colors
                  ${calendarMode === "holiday" ? (isPopOpen ? "bg-destructive/5 ring-1 ring-inset ring-destructive/40" : "hover:bg-destructive/5") : "hover:bg-accent/40"}
                  ${idx % 7 < 6 ? "border-r border-border/30" : ""} border-b border-border/30 ${isDayOff ? "bg-muted/30" : isToday ? "bg-primary/5" : ""}`}
                onClick={() => calendarMode === "holiday" ? setPopoverDate(isPopOpen ? null : dateStr) : onDayClick(date)}
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
                        <div key={a.id} className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] overflow-hidden ${c.bg} ${c.text}`} onClick={e => {
                          if (calendarMode === "holiday") { e.stopPropagation(); setPopoverDate(isPopOpen ? null : dateStr); return; }
                          e.stopPropagation(); onAppointmentClick(a);
                        }}>
                          <div className={`w-0.5 h-3 rounded-full shrink-0 ${c.bar}`} />
                          <span className="truncate">{a.patient?.name || "—"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {dayAppts.slice(0, 3).map(a => {
                      const c = getTreatmentColor(a.treatmentType || "");
                      return (
                        <div
                          key={a.id}
                          className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] overflow-hidden ${c.bg} ${c.text}`}
                          onClick={e => {
                            if (calendarMode === "holiday") { e.stopPropagation(); setPopoverDate(isPopOpen ? null : dateStr); return; }
                            e.stopPropagation(); onAppointmentClick(a);
                          }}
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
                )}
              </div>
            );

            if (calendarMode !== "holiday") {
              return <div key={idx}>{cellContent}</div>;
            }

              return (
              <Popover key={idx} open={isPopOpen} onOpenChange={open => !open && setPopoverDate(null)}>
                <PopoverTrigger asChild>{cellContent}</PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start" side="bottom" onClick={e => e.stopPropagation()}>
                  <HolidayPopoverContent
                    dateLabel={format(date, "M月d日（E）", { locale: ja })}
                    dateStr={dateStr}
                    dayHours={businessHours.find(h => h.dayOfWeek === dow)}
                    clinicHoliday={clinicHoliday}
                    onQuickSave={async (preset) => onHolidayQuickSave(dateStr, preset, dow, clinicHoliday?.id)}
                    onCustomSave={async (start, end) => onHolidayCustomSave(dateStr, start, end, clinicHoliday?.id)}
                    onDelete={async () => onHolidayDelete(clinicHoliday!.id)}
                    onClose={() => setPopoverDate(null)}
                  />
                </PopoverContent>
              </Popover>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SpotHolidayModal ────────────────────────────────────────────────────────
function SpotHolidayModal({
  date,
  initialTime,
  businessHours,
  existingHoliday,
  onClose,
  onSaved,
}: {
  date: string | null;
  initialTime?: string | null;
  businessHours: BusinessHours[];
  existingHoliday: Holiday | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");
  const [reason, setReason] = useState("");

  // モーダルが開くたびに既存データをリセット
  useEffect(() => {
    if (date) {
      if (existingHoliday) {
        setAllDay(!existingHoliday.startTime);
        setStartTime(existingHoliday.startTime?.slice(0, 5) ?? "09:00");
        setEndTime(existingHoliday.endTime?.slice(0, 5) ?? "12:00");
        setReason(existingHoliday.reason ?? "");
      } else if (initialTime) {
        setAllDay(false);
        setStartTime(initialTime.slice(0, 5));
        setEndTime(addMinutes(initialTime.slice(0, 5), 60));
        setReason("");
      } else {
        setAllDay(true);
        setStartTime("09:00");
        setEndTime("12:00");
        setReason("");
      }
    }
  }, [date, existingHoliday, initialTime]);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/holidays", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      onSaved();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      onSaved();
    },
  });

  if (!date) return null;

  // 診療時間内の30分刻みの時間リストを生成
  const timeOptions: string[] = [];
  for (let h = 7; h <= 20; h++) {
    for (const m of [0, 30]) {
      timeOptions.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  const displayDate = (() => {
    try { return format(new Date(date + "T00:00:00"), "yyyy年M月d日（E）", { locale: ja }); } catch { return date; }
  })();

  const handleSave = () => {
    createMutation.mutate({
      date,
      reason: reason || undefined,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
    });
  };

  return (
    <Dialog open={!!date} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{displayDate} の休診設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* 終日トグル */}
          <div className="flex items-center justify-between">
            <Label htmlFor="allday-switch" className="text-sm font-medium">終日休診</Label>
            <Switch
              id="allday-switch"
              checked={allDay}
              onCheckedChange={setAllDay}
              data-testid="switch-allday"
            />
          </div>

          {/* 時間帯指定（終日OFFの時のみ） */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">開始時間</Label>
                <Select value={startTime} onValueChange={setStartTime}>
                  <SelectTrigger data-testid="select-start-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">終了時間</Label>
                <Select value={endTime} onValueChange={setEndTime}>
                  <SelectTrigger data-testid="select-end-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* 理由 */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">理由（任意）</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="例：院長外出、研修など"
              className="h-20 resize-none text-sm"
              data-testid="input-holiday-reason"
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2">
          {existingHoliday && (
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate(existingHoliday.id)}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-holiday"
            >
              削除する
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending}
            data-testid="button-save-holiday"
          >
            設定する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
