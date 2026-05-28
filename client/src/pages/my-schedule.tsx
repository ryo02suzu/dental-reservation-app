import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format, addDays, subDays, startOfWeek, isToday, isTomorrow,
  parseISO, addWeeks, subWeeks, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isBefore, startOfDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Calendar, Clock, User,
  Phone, RefreshCw, ChevronDown, ChevronUp, AlertTriangle,
  UserCheck, Ban, Hash, Camera, X, Loader2, Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

// ─── Types ──────────────────────────────────────────────────────────────────

interface StaffMe { id: string; name: string; role: string; clinicId: string }
interface Clinic  { name: string }

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  treatmentType: string;
  status: string;
  confirmationStatus: string;
  chairNumber?: number;
  notes?: string;
  staffId?: string;
  patient?: {
    name: string; nameKana?: string; phone?: string; patientNumber?: string;
    dateOfBirth?: string; allergies?: string; medicalNotes?: string; lastVisitDate?: string;
  };
  staff?: { name: string; role: string };
}

interface Shift {
  id: string;
  date: string;
  patternId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status: "requested" | "approved" | "rejected";
  notes?: string | null;
}

interface ShiftPattern {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:     { label: "仮予約",    color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-300" },
  confirmed:   { label: "確定",      color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-300" },
  arrived:     { label: "来院済",    color: "text-green-700",  bg: "bg-green-50",   border: "border-green-300" },
  in_progress: { label: "診察中",    color: "text-purple-700", bg: "bg-purple-50",  border: "border-purple-300" },
  completed:   { label: "完了",      color: "text-gray-500",   bg: "bg-gray-50",    border: "border-gray-200" },
  no_show:     { label: "未来院",    color: "text-red-700",    bg: "bg-red-50",     border: "border-red-300" },
  cancelled:   { label: "キャンセル", color: "text-gray-400",  bg: "bg-gray-50",    border: "border-gray-200" },
};

const TREAT_COLOR: Record<string, string> = {
  定期検診: "bg-blue-100 text-blue-800",
  虫歯治療: "bg-red-100 text-red-800",
  クリーニング: "bg-emerald-100 text-emerald-800",
  矯正相談: "bg-purple-100 text-purple-800",
  抜歯: "bg-orange-100 text-orange-800",
  根管治療: "bg-pink-100 text-pink-800",
  ホワイトニング: "bg-yellow-100 text-yellow-800",
  歯周病治療: "bg-teal-100 text-teal-800",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDayLabel(date: Date) {
  if (isToday(date)) return "今日";
  if (isTomorrow(date)) return "明日";
  return format(date, "M月d日（E）", { locale: ja });
}

function calcAge(dob: string) {
  const b = parseISO(dob); const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() - b.getMonth() < 0 || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a;
}

function nowMinutes() {
  const n = new Date(); return n.getHours() * 60 + n.getMinutes();
}

function toMinutes(t: string) {
  const [h, m] = t.split(":").map(Number); return h * 60 + m;
}

// ─── Status action buttons ───────────────────────────────────────────────────

function nextActions(status: string) {
  if (status === "pending" || status === "confirmed")
    return [
      { status: "arrived", label: "来院", Icon: UserCheck, cls: "bg-green-500 hover:bg-green-600 text-white" },
      { status: "no_show", label: "未来院", Icon: Ban,     cls: "bg-red-100 hover:bg-red-200 text-red-700" },
    ];
  return [];
}

// ─── Appointment Card (shared) ───────────────────────────────────────────────

function ApptCard({ appt, queryKey, showStaff = false }: {
  appt: Appointment;
  queryKey: (string | undefined)[];
  showStaff?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [noteText, setNoteText] = useState(appt.notes ?? "");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const qc = useQueryClient();

  const st = STATUS_CFG[appt.status] ?? STATUS_CFG.confirmed;
  const tc = TREAT_COLOR[appt.treatmentType] ?? "bg-gray-100 text-gray-700";
  const faded = appt.status === "completed" || appt.status === "cancelled";
  const actions = nextActions(appt.status);

  const statusMut = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PATCH", `/api/staff/appointments/${appt.id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  async function saveNote() {
    setNoteSaving(true);
    await apiRequest("PATCH", `/api/staff/appointments/${appt.id}/notes`, { notes: noteText });
    setNoteSaving(false); setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
    qc.invalidateQueries({ queryKey });
  }

  return (
    <div
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all
        ${faded ? "opacity-60" : ""}
        ${appt.status === "in_progress" ? "border-purple-300 ring-1 ring-purple-200" : st.border}`}
      data-testid={`appt-card-${appt.id}`}
    >
      {/* Header row */}
      <button className="w-full text-left" onClick={() => setOpen(v => !v)}>
        <div className={`px-4 py-2.5 flex items-center justify-between ${st.bg}`}>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span className="font-mono font-bold text-sm text-gray-900">
              {appt.startTime.slice(0, 5)}
            </span>
            <span className="text-gray-400 text-xs">〜 {appt.endTime?.slice(0, 5)}</span>
            {appt.chairNumber && (
              <span className="text-xs text-gray-400 ml-1">ユニット{appt.chairNumber}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${st.color} ${st.bg} ${st.border}`}>
              {st.label}
            </span>
            {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="font-semibold text-gray-900 truncate">{appt.patient?.name ?? "患者不明"}</span>
            {appt.patient?.patientNumber && (
              <span className="text-xs text-gray-400 shrink-0">{appt.patient.patientNumber}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {showStaff && appt.staff?.name && (
              <span className="text-xs text-gray-400">{appt.staff.name}</span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tc}`}>
              {appt.treatmentType || "未分類"}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t border-gray-100">
          <div className="px-4 py-3 space-y-2 bg-gray-50">
            {appt.patient?.nameKana && <p className="text-xs text-gray-500">{appt.patient.nameKana}</p>}
            <div className="flex flex-wrap gap-3 text-xs text-gray-600">
              {appt.patient?.dateOfBirth && (
                <span>生年月日: {appt.patient.dateOfBirth}（{calcAge(appt.patient.dateOfBirth)}歳）</span>
              )}
              {appt.patient?.lastVisitDate && (
                <span>最終来院: {appt.patient.lastVisitDate}</span>
              )}
            </div>
            {appt.patient?.allergies && (
              <div className="flex items-start gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <span className="text-xs text-red-700 font-medium">アレルギー: {appt.patient.allergies}</span>
              </div>
            )}
            {appt.patient?.medicalNotes && (
              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-xs text-amber-800">{appt.patient.medicalNotes}</span>
              </div>
            )}
            {appt.patient?.phone && (
              <a
                href={`tel:${appt.patient.phone}`}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm"
                data-testid={`link-phone-${appt.id}`}
              >
                <Phone className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-gray-800">{appt.patient.phone}</span>
                <span className="text-xs text-primary ml-auto">タップで発信</span>
              </a>
            )}
          </div>

          {actions.length > 0 && (
            <div className="px-4 py-3 flex gap-2 flex-wrap border-t border-gray-100">
              {actions.map(a => (
                <button
                  key={a.status}
                  onClick={() => statusMut.mutate(a.status)}
                  disabled={statusMut.isPending}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${a.cls} disabled:opacity-50`}
                  data-testid={`btn-status-${appt.id}-${a.status}`}
                >
                  <a.Icon className="w-4 h-4" /> {a.label}
                </button>
              ))}
            </div>
          )}

          <div className="px-4 pb-4 pt-2 border-t border-gray-100 space-y-2">
            <p className="text-xs font-medium text-gray-500">メモ</p>
            <Textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="引き継ぎ・申し送りなど..."
              className="text-sm min-h-[64px] resize-none"
              data-testid={`textarea-note-${appt.id}`}
            />
            <div className="flex items-center justify-between">
              {noteSaved && <span className="text-xs text-green-600">保存しました</span>}
              <Button size="sm" className="ml-auto h-8 text-xs" onClick={saveNote} disabled={noteSaving}>
                {noteSaving && <RefreshCw className="w-3 h-3 animate-spin mr-1" />}保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Unit Status Panel ────────────────────────────────────────────────────────

function UnitPanel({ appointments }: { appointments: Appointment[] }) {
  const now = nowMinutes();

  const chairs = Array.from(
    new Set(appointments.map(a => a.chairNumber).filter(Boolean))
  ).sort((a, b) => (a ?? 0) - (b ?? 0)) as number[];

  if (chairs.length === 0) return null;

  function getChairState(chair: number) {
    const appts = appointments
      .filter(a => a.chairNumber === chair && a.status !== "cancelled")
      .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const active = appts.find(a => a.status === "in_progress");
    if (active) return { state: "in_progress", appt: active };

    const arrived = appts.find(a => a.status === "arrived");
    if (arrived) return { state: "arrived", appt: arrived };

    const upcoming = appts.find(a => {
      const start = toMinutes(a.startTime);
      return (a.status === "confirmed" || a.status === "pending") &&
        start > now && start - now <= 20;
    });
    if (upcoming) return { state: "upcoming", appt: upcoming };

    const next = appts.find(a =>
      (a.status === "confirmed" || a.status === "pending") && toMinutes(a.startTime) > now
    );
    if (next) return { state: "next", appt: next };

    return { state: "free", appt: null };
  }

  const STATE_STYLE: Record<string, { bg: string; dot: string; label: string; textColor: string }> = {
    in_progress: { bg: "bg-red-50 border-red-300",    dot: "bg-red-500 animate-pulse", label: "診察中",  textColor: "text-red-700" },
    arrived:     { bg: "bg-green-50 border-green-300", dot: "bg-green-500",             label: "来院済",  textColor: "text-green-700" },
    upcoming:    { bg: "bg-amber-50 border-amber-300", dot: "bg-amber-400 animate-pulse", label: "準備！", textColor: "text-amber-700" },
    next:        { bg: "bg-blue-50 border-blue-200",   dot: "bg-blue-400",              label: "予定あり", textColor: "text-blue-600" },
    free:        { bg: "bg-gray-50 border-gray-200",   dot: "bg-gray-300",              label: "空き",    textColor: "text-gray-400" },
  };

  return (
    <div className="bg-white border-b px-3 py-3">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">ユニット状態</p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(chairs.length, 4)}, 1fr)` }}>
        {chairs.map(chair => {
          const { state, appt } = getChairState(chair);
          const sty = STATE_STYLE[state];
          return (
            <div key={chair} className={`border rounded-xl p-2.5 flex flex-col gap-1 ${sty.bg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Hash className="w-3 h-3 text-gray-400" />
                  <span className="text-xs font-bold text-gray-700">{chair}</span>
                </div>
                <span className={`w-2 h-2 rounded-full ${sty.dot}`} />
              </div>
              <span className={`text-xs font-bold ${sty.textColor}`}>{sty.label}</span>
              {appt && (
                <>
                  <span className="text-[11px] text-gray-600 font-mono leading-none">
                    {appt.startTime.slice(0, 5)}
                  </span>
                  <span className="text-[11px] text-gray-700 leading-tight truncate">
                    {appt.patient?.name ?? "—"}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full text-center ${TREAT_COLOR[appt.treatmentType] ?? "bg-gray-100 text-gray-600"}`}>
                    {appt.treatmentType || "—"}
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alert Banner ────────────────────────────────────────────────────────────

function AlertBanner({ appointments }: { appointments: Appointment[] }) {
  const [now, setNow] = useState(nowMinutes());
  useEffect(() => {
    const id = setInterval(() => setNow(nowMinutes()), 30_000);
    return () => clearInterval(id);
  }, []);

  const soon = appointments.filter(a => {
    const start = toMinutes(a.startTime);
    return (a.status === "confirmed" || a.status === "pending") &&
      start > now && start - now <= 15;
  }).sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (soon.length === 0) return null;

  return (
    <div className="mx-3 mt-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="text-sm font-bold text-amber-800">まもなく開始</span>
      </div>
      {soon.map(a => (
        <div key={a.id} className="flex items-center gap-2 text-sm text-amber-900">
          <span className="font-mono font-bold">{a.startTime.slice(0, 5)}</span>
          {a.chairNumber && <span className="text-xs bg-amber-200 text-amber-800 rounded-full px-2 py-0.5">ユニット{a.chairNumber}</span>}
          <span className="font-medium truncate">{a.patient?.name ?? "—"}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ml-auto shrink-0 ${TREAT_COLOR[a.treatmentType] ?? "bg-gray-100 text-gray-700"}`}>
            {a.treatmentType}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Assistant View ───────────────────────────────────────────────────────────

function AssistantView({ me, clinic }: { me: StaffMe; clinic: Clinic | undefined }) {
  const qc = useQueryClient();
  const qKey = ["/api/staff/all-today-appointments"];

  const { data: appts = [], isLoading, refetch } = useQuery<Appointment[]>({
    queryKey: qKey,
    queryFn: () => fetch("/api/staff/all-today-appointments", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60_000,
  });

  const sorted = [...appts]
    .filter(a => a.status !== "cancelled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const doneCount = sorted.filter(a => a.status === "completed" || a.status === "no_show").length;
  const totalCount = sorted.length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="px-4 pt-3 pb-2.5">
          <p className="text-xs text-gray-400">{clinic?.name ?? ""}</p>
          <h1 className="text-base font-bold text-gray-900">
            {me.name}
            <span className="ml-1.5 text-xs font-normal text-gray-500">歯科助手</span>
          </h1>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>本日の進捗</span>
            <span className="font-bold text-gray-700">{doneCount} / {totalCount} 件完了</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
        </div>
      </header>

      {/* Unit status panel */}
      {!isLoading && <UnitPanel appointments={sorted} />}

      {/* Alert banner */}
      {!isLoading && <AlertBanner appointments={sorted} />}

      {/* Refresh button */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">本日の全予約</p>
        <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400"
          onClick={() => refetch()}>
          <RefreshCw className="w-3 h-3 mr-1" />更新
        </Button>
      </div>

      {/* Timeline */}
      <main className="flex-1 px-3 pb-8 space-y-2.5">
        {isLoading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
            <Calendar className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-medium text-gray-500">本日の予約はありません</p>
          </div>
        ) : (
          sorted.map(appt => (
            <ApptCard key={appt.id} appt={appt} queryKey={qKey} showStaff={true} />
          ))
        )}
      </main>
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────

function WeekView({ weekStart, appointments, onDaySelect, selectedDate }: {
  weekStart: Date;
  appointments: Appointment[];
  onDaySelect: (date: Date) => void;
  selectedDate?: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-7 gap-1 px-3 py-3">
      {days.map(day => {
        const ds = format(day, "yyyy-MM-dd");
        const count = appointments.filter(a => a.date === ds).length;
        const today = isToday(day);
        const isSelected = selectedDate === ds;
        const dayOfWeek = format(day, "E", { locale: ja });
        const isSun = day.getDay() === 0;
        const isSat = day.getDay() === 6;
        return (
          <button key={ds} onClick={() => onDaySelect(day)} data-testid={`btn-week-day-${ds}`}
            className={`flex flex-col items-center py-2 px-1 rounded-xl transition-colors ${
              isSelected ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
              today ? "bg-primary/10 text-primary" :
              "bg-gray-50 active:bg-gray-100"
            }`}>
            <span className={`text-[10px] font-medium ${
              isSelected ? "text-primary-foreground/70" :
              today ? "text-primary/70" :
              isSun ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-500"
            }`}>
              {dayOfWeek}
            </span>
            <span className={`text-base font-bold ${
              isSelected ? "text-primary-foreground" :
              today ? "text-primary" :
              "text-gray-800"
            }`}>{format(day, "d")}</span>
            {count > 0 ? (
              <span className={`text-[10px] font-bold mt-0.5 ${
                isSelected ? "text-primary-foreground/70" :
                today ? "text-primary/70" :
                "text-primary"
              }`}>{count}件</span>
            ) : (
              <span className="text-[10px] mt-0.5 opacity-0">0</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Clock-In Widget ──────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string; staffId: string; date: string;
  clockIn: string | null; clockOut: string | null;
  breakStart: string | null; breakEnd: string | null;
}

function ClockInWidget() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [now, setNow] = useState(new Date());
  const [showClockOutConfirm, setShowClockOutConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: attendance } = useQuery<AttendanceRecord | null>({
    queryKey: ["/api/staff/my-attendance"],
    queryFn: () => fetch("/api/staff/my-attendance", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 10000,
  });

  const clockOutMut = useMutation({
    mutationFn: () => fetch("/api/staff/clock-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(r => { if (!r.ok) throw new Error("打刻エラー"); return r.json(); }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/staff/my-attendance"] }); setShowClockOutConfirm(false); },
  });
  const breakStartMut = useMutation({
    mutationFn: () => fetch("/api/staff/break-start", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(r => { if (!r.ok) throw new Error("エラー"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/staff/my-attendance"] }),
  });
  const breakEndMut = useMutation({
    mutationFn: () => fetch("/api/staff/break-end", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(r => { if (!r.ok) throw new Error("エラー"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/staff/my-attendance"] }),
  });
  const cancelClockOutMut = useMutation({
    mutationFn: () => fetch("/api/staff/cancel-clock-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).then(r => { if (!r.ok) throw new Error("エラー"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/staff/my-attendance"] }),
  });

  const notClockedIn = !attendance || !attendance.clockIn;
  const isClockedIn = !!attendance?.clockIn && !attendance.clockOut;
  const isClockedOut = !!attendance?.clockOut;
  const isOnBreak = isClockedIn && !!attendance?.breakStart && !attendance?.breakEnd;

  function elapsed(from: string | null) {
    if (!from) return "00:00:00";
    const diff = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function fmtTime(ts: string | null) {
    if (!ts) return "--:--";
    return format(new Date(ts), "HH:mm:ss");
  }

  return (
    <div className="px-4 py-2 border-t bg-gradient-to-r from-gray-50 to-white">
      <div className="flex items-center gap-3">
        <div className="text-center shrink-0">
          <p className="text-2xl font-mono font-bold text-gray-900 tabular-nums leading-none" data-testid="text-current-time">
            {format(now, "HH:mm:ss")}
          </p>
          <p className="text-[9px] text-gray-400 mt-0.5">{format(now, "M月d日(E)", { locale: ja })}</p>
        </div>

        <div className="flex-1 min-w-0">
          {notClockedIn && (
            <button onClick={() => { setShowScanner(true); setScanError(""); }}
              data-testid="button-open-qr-scanner"
              className="w-full flex items-center justify-center gap-2 py-2 bg-primary/10 hover:bg-primary/15 active:bg-primary/20 rounded-xl transition-colors">
              <Camera className="w-4 h-4 text-primary" />
              <p className="text-xs font-bold text-primary">QRスキャンで出勤</p>
            </button>
          )}

          {isClockedIn && !isOnBreak && (
            <div className="flex gap-1.5">
              <button onClick={() => breakStartMut.mutate()} disabled={breakStartMut.isPending}
                data-testid="button-break-start"
                className="flex-1 py-2 rounded-xl bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200 active:bg-amber-200 transition-colors">
                休憩
              </button>
              <button onClick={() => setShowClockOutConfirm(true)}
                data-testid="button-clock-out"
                className="flex-1 py-2 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors">
                退勤打刻
              </button>
            </div>
          )}

          {isOnBreak && (
            <button onClick={() => breakEndMut.mutate()} disabled={breakEndMut.isPending}
              data-testid="button-break-end"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-bold shadow-sm animate-pulse transition-colors">
              休憩終了
            </button>
          )}

          {isClockedOut && (
            <div className="flex items-center gap-2">
              <div className="text-center py-1.5 bg-gray-100 rounded-xl flex-1">
                <p className="text-xs font-bold text-gray-500">退勤済み</p>
              </div>
              <button onClick={() => cancelClockOutMut.mutate()}
                disabled={cancelClockOutMut.isPending}
                className="px-2.5 py-1.5 text-[10px] font-bold text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                data-testid="button-cancel-clock-out-undo">
                {cancelClockOutMut.isPending ? "..." : "取消"}
              </button>
            </div>
          )}
        </div>

        {isClockedIn && (
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400">{isOnBreak ? "休憩中" : "勤務中"}</p>
            <p className={`text-sm font-mono font-bold tabular-nums ${isOnBreak ? "text-amber-500" : "text-emerald-600"}`}
              data-testid="text-elapsed-time">
              {isOnBreak ? elapsed(attendance?.breakStart ?? null) : elapsed(attendance?.clockIn ?? null)}
            </p>
          </div>
        )}

        {isClockedOut && attendance && (
          <div className="text-right shrink-0">
            <p className="text-[9px] text-gray-400">出勤</p>
            <p className="text-[11px] font-mono font-bold text-gray-600">{fmtTime(attendance.clockIn)}</p>
            <p className="text-[9px] text-gray-400">退勤</p>
            <p className="text-[11px] font-mono font-bold text-gray-600">{fmtTime(attendance.clockOut)}</p>
          </div>
        )}
      </div>

      {showClockOutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowClockOutConfirm(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-xs w-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">退勤しますか？</h3>
              <p className="text-sm text-gray-500 mt-1">勤務時間: {elapsed(attendance?.clockIn ?? null)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowClockOutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold"
                data-testid="button-cancel-clock-out">
                キャンセル
              </button>
              <button onClick={() => clockOutMut.mutate()} disabled={clockOutMut.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold disabled:opacity-50"
                data-testid="button-confirm-clock-out">
                {clockOutMut.isPending ? "処理中..." : "退勤する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <QrScannerModal
          onClose={() => setShowScanner(false)}
          onScan={(url) => {
            setShowScanner(false);
            const match = url.match(/\/qr-clock-in\/([a-f0-9]+)/);
            if (match) {
              navigate(`/qr-clock-in/${match[1]}`);
            } else {
              setScanError("無効なQRコードです");
            }
          }}
        />
      )}

      {scanError && (
        <div className="mt-1 px-2">
          <p className="text-[10px] text-red-500 text-center">{scanError}</p>
        </div>
      )}
    </div>
  );
}

function QrScannerModal({ onClose, onScan }: { onClose: () => void; onScan: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");

  function stopAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    rafRef.current = null;
    streamRef.current = null;
  }

  useEffect(() => {
    let mounted = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus("scanning");
          tick();
        }
      } catch (err: any) {
        if (!mounted) return;
        const msg = err?.name === "NotAllowedError"
          ? "カメラの許可が必要です。ブラウザの設定からカメラを許可してください。"
          : err?.name === "NotFoundError"
          ? "カメラが見つかりません。"
          : "カメラを起動できませんでした。";
        setError(msg);
        setStatus("error");
      }
    }

    async function tick() {
      if (!mounted || doneRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      try {
        const jsQR = (await import("jsqr")).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert"
        });
        if (code && code.data && !doneRef.current) {
          doneRef.current = true;
          stopAll();
          onScan(code.data);
          return;
        }
      } catch { }
      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();
    return () => {
      mounted = false;
      stopAll();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-4 max-w-sm w-full shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-900">QRコードをスキャン</h3>
          <button onClick={() => { stopAll(); onClose(); }}
            className="p-1 rounded-lg hover:bg-gray-100" data-testid="btn-close-scanner">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        {status === "error" ? (
          <div className="text-center py-8">
            <Camera className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-red-500 px-2">{error}</p>
          </div>
        ) : (
          <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            {status === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-52 border-2 border-white/70 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
          </div>
        )}
        <p className="text-[10px] text-gray-400 text-center mt-3">管理者画面のQRコードにカメラを向けてください</p>
      </div>
    </div>
  );
}

// ─── Shift View (シフトボード風) ───────────────────────────────────────────────

const PATTERN_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-100", ring: "ring-blue-400", text: "text-blue-700" },
  { bg: "bg-emerald-500", light: "bg-emerald-100", ring: "ring-emerald-400", text: "text-emerald-700" },
  { bg: "bg-amber-500", light: "bg-amber-100", ring: "ring-amber-400", text: "text-amber-700" },
  { bg: "bg-purple-500", light: "bg-purple-100", ring: "ring-purple-400", text: "text-purple-700" },
  { bg: "bg-rose-500", light: "bg-rose-100", ring: "ring-rose-400", text: "text-rose-700" },
  { bg: "bg-cyan-500", light: "bg-cyan-100", ring: "ring-cyan-400", text: "text-cyan-700" },
];

function ShiftView({ me }: { me: StaffMe }) {
  const qc = useQueryClient();
  const [monthBase, setMonthBase] = useState(() => startOfMonth(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [activeDayForPattern, setActiveDayForPattern] = useState<string | null>(null);

  const monthStr = format(monthBase, "yyyy-MM");
  const qKey = ["/api/staff/my-shifts", monthStr];

  const { data: shifts = [], isLoading } = useQuery<Shift[]>({
    queryKey: qKey,
    queryFn: () => fetch(`/api/staff/my-shifts?month=${monthStr}`, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    staleTime: 0,
  });
  const { data: patterns = [] } = useQuery<ShiftPattern[]>({
    queryKey: ["/api/staff/shift-patterns"],
    queryFn: () => fetch("/api/staff/shift-patterns", { credentials: "include" }).then(r => r.json()),
  });
  const { data: holidays = [] } = useQuery<{ id: string; date: string; name?: string }[]>({
    queryKey: ["/api/staff/holidays"],
    queryFn: () => fetch("/api/staff/holidays", { credentials: "include" }).then(r => r.json()),
  });
  const { data: jpHolidays = [] } = useQuery<{ date: string; name: string }[]>({
    queryKey: ["/api/holidays/japan", monthBase.getFullYear()],
    queryFn: () => fetch(`/api/holidays/japan/${monthBase.getFullYear()}`, { credentials: "include" }).then(r => r.json()),
  });

  const activePatterns = patterns.filter(p => p.isActive !== false);
  const patternMap = Object.fromEntries(patterns.map(p => [p.id, p]));
  const patternColorMap = Object.fromEntries(activePatterns.map((p, i) => [p.id, PATTERN_COLORS[i % PATTERN_COLORS.length]]));
  const holidaySet = new Set([...holidays.map(h => h.date), ...jpHolidays.map(h => h.date)]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/staff/my-shifts/${id}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: qKey }),
  });

  async function submitDay(ds: string, patternId: string) {
    setSubmitting(true);
    try {
      const existing = shiftByDate[ds];
      if (existing && existing.status === "rejected") {
        await fetch(`/api/staff/my-shifts/${existing.id}`, { method: "DELETE" });
      }
      const pat = patternMap[patternId];
      await fetch("/api/staff/my-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dates: [ds],
          patternId,
          startTime: pat?.startTime || undefined,
          endTime: pat?.endTime || undefined,
        }),
      });
      setActiveDayForPattern(null);
      qc.invalidateQueries({ queryKey: qKey });
    } finally { setSubmitting(false); }
  }

  async function submitDayNoPattern(ds: string) {
    setSubmitting(true);
    try {
      const existing = shiftByDate[ds];
      if (existing && existing.status === "rejected") {
        await fetch(`/api/staff/my-shifts/${existing.id}`, { method: "DELETE" });
      }
      await fetch("/api/staff/my-shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dates: [ds] }),
      });
      setActiveDayForPattern(null);
      qc.invalidateQueries({ queryKey: qKey });
    } finally { setSubmitting(false); }
  }

  const monthStart = startOfMonth(monthBase);
  const monthEnd = endOfMonth(monthBase);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = (monthStart.getDay() + 6) % 7;
  const shiftByDate = Object.fromEntries(shifts.map(s => [s.date, s]));
  const today = startOfDay(new Date());
  const isPast = (d: Date) => isBefore(d, today);

  const approvedCount = shifts.filter(s => s.status === "approved").length;
  const requestedCount = shifts.filter(s => s.status === "requested").length;
  const totalHours = shifts.filter(s => s.status === "approved").reduce((acc, s) => {
    if (s.startTime && s.endTime) {
      const [sh, sm] = s.startTime.split(":").map(Number);
      const [eh, em] = s.endTime.split(":").map(Number);
      return acc + (eh + em / 60) - (sh + sm / 60);
    }
    return acc;
  }, 0);

  function handleDayTap(ds: string, d: Date) {
    if (isPast(d)) return;
    const existing = shiftByDate[ds];
    if (existing && existing.status !== "rejected") return;
    if (activePatterns.length > 0) {
      setActiveDayForPattern(prev => prev === ds ? null : ds);
    } else {
      submitDayNoPattern(ds);
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Month nav */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => setMonthBase(d => subMonths(d, 1))} className="p-1.5 rounded-lg active:bg-gray-100" data-testid="btn-prev-month">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <span className="text-sm font-bold text-gray-800">{format(monthBase, "yyyy年M月", { locale: ja })}</span>
        <button onClick={() => setMonthBase(d => addMonths(d, 1))} className="p-1.5 rounded-lg active:bg-gray-100" data-testid="btn-next-month">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary */}
        <div className="px-4 pt-3 pb-1">
          <div className="flex items-center gap-3 bg-white rounded-2xl border shadow-sm px-4 py-2.5">
            <div className="flex-1 text-center border-r">
              <p className="text-xl font-bold text-emerald-600">{approvedCount}</p>
              <p className="text-[9px] text-gray-500 font-medium">確定</p>
            </div>
            <div className="flex-1 text-center border-r">
              <p className="text-xl font-bold text-amber-500">{requestedCount}</p>
              <p className="text-[9px] text-gray-500 font-medium">申請中</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xl font-bold text-primary">{totalHours.toFixed(0)}<span className="text-sm font-normal">h</span></p>
              <p className="text-[9px] text-gray-500 font-medium">合計</p>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="px-4 pt-2 pb-1">
          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="grid grid-cols-7">
              {["月","火","水","木","金","土","日"].map(d => (
                <div key={d} className={`text-center text-[10px] font-bold py-2 ${d === "日" ? "text-red-500" : d === "土" ? "text-blue-500" : "text-gray-400"}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t">
              {Array(startDow).fill(null).map((_, i) => <div key={`b-${i}`} className="h-[60px]" />)}
              {days.map(d => {
                const ds = format(d, "yyyy-MM-dd");
                const shift = shiftByDate[ds];
                const isActive = activeDayForPattern === ds;
                const past = isPast(d);
                const dow = d.getDay();
                const isSun = dow === 0; const isSat = dow === 6;
                const isHol = holidaySet.has(ds) || isSun;
                const pat = shift?.patternId ? patternMap[shift.patternId] : null;
                const patCol = shift?.patternId ? patternColorMap[shift.patternId] : null;

                return (
                  <button
                    key={ds}
                    onClick={() => handleDayTap(ds, d)}
                    disabled={past || (!!shift && shift.status !== "rejected") || submitting}
                    className={`h-[60px] flex flex-col items-center justify-center border-t border-l first:border-l-0 relative select-none transition-all
                      ${past ? "opacity-30" : ""}
                      ${!past && !shift ? "active:bg-gray-100" : ""}
                      ${isHol && !shift ? "bg-gray-50/80" : ""}
                      ${isActive ? "bg-primary/10 ring-2 ring-primary ring-inset" : ""}`}
                    data-testid={`shift-day-${ds}`}
                  >
                    <span className={`text-xs font-semibold leading-tight
                      ${isToday(d) ? "text-primary font-bold" : isSun || holidaySet.has(ds) ? "text-red-500" : isSat ? "text-blue-500" : "text-gray-700"}`}>
                      {format(d, "d")}
                    </span>

                    <div className="mt-1">
                      {shift ? (
                        shift.status === "approved" ? (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${patCol?.bg ?? "bg-emerald-500"}`}>
                            <span className="text-[9px] font-bold text-white leading-none">{pat?.name?.charAt(0) ?? "✓"}</span>
                          </div>
                        ) : shift.status === "requested" ? (
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center bg-white border-2 ${patCol ? patCol.ring + " ring-0 " + `border-current ${patCol.text}` : "border-amber-400"}`}>
                            <span className={`text-[9px] font-bold leading-none ${patCol?.text ?? "text-amber-600"}`}>{pat?.name?.charAt(0) ?? "?"}</span>
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-gray-200">
                            <span className="text-[10px] text-gray-500">✕</span>
                          </div>
                        )
                      ) : isHol ? (
                        <span className="text-[9px] text-gray-400">休</span>
                      ) : (
                        <div className="w-7 h-7 rounded-full border-2 border-dashed border-gray-200" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 pt-1 pb-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
          {activePatterns.map((p, i) => {
            const c = PATTERN_COLORS[i % PATTERN_COLORS.length];
            return <span key={p.id} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-full ${c.bg}`} />{p.name}</span>;
          })}
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-dashed border-gray-200" />空き</span>
        </div>

        {/* Per-day pattern picker (sticky bottom) */}
        {activeDayForPattern && activePatterns.length > 0 && (
          <div className="sticky bottom-0 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-10">
            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-800">
                  {format(parseISO(activeDayForPattern), "M月d日（E）", { locale: ja })} の時間帯を選択
                </p>
                <button onClick={() => setActiveDayForPattern(null)} className="text-xs text-gray-400 hover:text-red-500" data-testid="btn-cancel-pattern">キャンセル</button>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {activePatterns.map((p, i) => {
                  const c = PATTERN_COLORS[i % PATTERN_COLORS.length];
                  return (
                    <button key={p.id}
                      onClick={() => submitDay(activeDayForPattern, p.id)}
                      disabled={submitting}
                      data-testid={`button-select-pattern-${p.id}`}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-white border-gray-200 active:bg-gray-50 disabled:opacity-50 transition-all">
                      <span className={`w-4 h-4 rounded-full shrink-0 ${c.bg}`} />
                      <div className="text-left">
                        <p className="text-xs font-bold leading-tight text-gray-800">{p.name}</p>
                        <p className="text-[9px] leading-tight text-gray-400">{p.startTime.slice(0,5)}-{p.endTime.slice(0,5)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Existing shifts */}
        <div className="px-4 pt-3 pb-8">
          <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-wider">提出済みシフト</p>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl border animate-pulse" />)}</div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">カレンダーで日付をタップして提出</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {shifts.sort((a, b) => a.date.localeCompare(b.date)).map(s => {
                const pat = s.patternId ? patternMap[s.patternId] : null;
                const patCol = s.patternId ? patternColorMap[s.patternId] : null;
                const isApproved = s.status === "approved";
                const isRequested = s.status === "requested";
                const isRejected = s.status === "rejected";
                const dow = parseISO(s.date).getDay();
                return (
                  <div key={s.id} className="bg-white rounded-xl border px-3 py-2.5 flex items-center gap-3"
                    data-testid={`shift-entry-${s.id}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isApproved ? patCol?.bg ?? "bg-emerald-500"
                        : isRequested ? "bg-white border-2 " + (patCol ? `${patCol.text} border-current` : "border-amber-400")
                        : "bg-gray-200"
                    }`}>
                      <span className={`text-[11px] font-bold ${isApproved ? "text-white" : isRequested ? patCol?.text ?? "text-amber-600" : "text-gray-500"}`}>
                        {pat?.name?.charAt(0) ?? (isRejected ? "✕" : "?")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{format(parseISO(s.date), "M/d(E)", { locale: ja })}</p>
                      {pat && <p className="text-[11px] text-gray-500">{pat.name} {pat.startTime.slice(0,5)}-{pat.endTime.slice(0,5)}</p>}
                      {s.notes && <p className="text-[10px] text-gray-400 truncate">{s.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isApproved ? "bg-emerald-100 text-emerald-700" : isRequested ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                      }`}>
                        {isApproved ? "確定" : isRequested ? "申請中" : "却下"}
                      </span>
                      {(isRequested || isRejected) && (
                        <button onClick={() => deleteMut.mutate(s.id)} disabled={deleteMut.isPending}
                          className="w-6 h-6 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 active:bg-red-50"
                          data-testid={`button-delete-shift-${s.id}`}>✕</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Doctor / Hygienist View ──────────────────────────────────────────────────

function AttendanceHistoryView() {
  const [monthBase, setMonthBase] = useState(() => startOfMonth(new Date()));
  const monthStr = format(monthBase, "yyyy-MM");
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ clockIn: "", clockOut: "", breakStart: "", breakEnd: "" });
  const [editError, setEditError] = useState("");

  const { data, isLoading, refetch } = useQuery<{ records: AttendanceRecord[]; hourlyRate: number | null }>({
    queryKey: ["/api/staff/my-attendance-history", monthStr],
    queryFn: () => fetch(`/api/staff/my-attendance-history?month=${monthStr}`, { credentials: "include" }).then(r => r.json()),
  });

  const saveRateMut = useMutation({
    mutationFn: async (rate: number | null) => {
      const r = await fetch("/api/staff/my-hourly-rate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hourlyRate: rate }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.message || "保存エラー");
      return body;
    },
    onSuccess: () => {
      refetch();
      setEditingRate(false);
      setSaveError("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
    onError: (e: any) => {
      setSaveError(e.message || "保存できませんでした");
    },
  });

  const editMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: typeof editForm }) => {
      const r = await fetch(`/api/staff/my-attendance/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "更新エラー");
      return data;
    },
    onSuccess: () => {
      refetch();
      setEditingRecordId(null);
      setEditError("");
    },
    onError: (e: any) => setEditError(e.message || "更新できませんでした"),
  });

  function openEdit(r: AttendanceRecord) {
    setEditingRecordId(r.id);
    setEditError("");
    setEditForm({
      clockIn: r.clockIn ? format(new Date(r.clockIn), "HH:mm") : "",
      clockOut: r.clockOut ? format(new Date(r.clockOut), "HH:mm") : "",
      breakStart: r.breakStart ? format(new Date(r.breakStart), "HH:mm") : "",
      breakEnd: r.breakEnd ? format(new Date(r.breakEnd), "HH:mm") : "",
    });
  }

  const records = data?.records ?? [];
  const hourlyRate = data?.hourlyRate ?? null;

  const totalHours = records.reduce((acc, r) => {
    if (!r.clockIn || !r.clockOut) return acc;
    const total = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 3600000;
    let breakH = 0;
    if (r.breakStart && r.breakEnd) breakH = (new Date(r.breakEnd).getTime() - new Date(r.breakStart).getTime()) / 3600000;
    return acc + Math.max(0, total - breakH);
  }, 0);

  const totalPay = hourlyRate ? Math.round(totalHours * hourlyRate) : null;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => setMonthBase(d => subMonths(d, 1))} className="p-1.5 rounded-lg active:bg-gray-100" data-testid="btn-att-prev">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <span className="text-sm font-bold text-gray-800">{format(monthBase, "yyyy年M月", { locale: ja })}</span>
        <button onClick={() => setMonthBase(d => addMonths(d, 1))} className="p-1.5 rounded-lg active:bg-gray-100" data-testid="btn-att-next">
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-3 bg-white rounded-2xl border shadow-sm px-4 py-2.5">
          <div className="flex-1 text-center border-r">
            <p className="text-xl font-bold text-blue-600">{records.length}</p>
            <p className="text-[9px] text-gray-500 font-medium">出勤日数</p>
          </div>
          <div className="flex-1 text-center border-r">
            <p className="text-xl font-bold text-primary">{totalHours.toFixed(1)}<span className="text-sm font-normal">h</span></p>
            <p className="text-[9px] text-gray-500 font-medium">合計時間</p>
          </div>
          <div className="flex-1 text-center">
            {totalPay !== null ? (
              <>
                <p className="text-xl font-bold text-emerald-600">¥{totalPay.toLocaleString()}</p>
                <p className="text-[9px] text-gray-500 font-medium">給与見込み</p>
              </>
            ) : (
              <>
                <p className="text-xl font-bold text-gray-400">—</p>
                <p className="text-[9px] text-gray-500 font-medium">時給未設定</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-2 pb-1">
        <div className={`rounded-xl border-2 p-3 transition-colors ${
          saveSuccess ? "border-emerald-300 bg-emerald-50" :
          editingRate ? "border-primary/40 bg-primary/5" :
          hourlyRate ? "border-gray-200 bg-white" : "border-dashed border-amber-300 bg-amber-50"
        }`}>
          {saveSuccess ? (
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="text-sm font-bold text-emerald-600">✓ 時給を保存しました</span>
            </div>
          ) : editingRate ? (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">時給を入力</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-500">¥</span>
                <input
                  type="number"
                  value={rateInput}
                  onChange={e => { setRateInput(e.target.value); setSaveError(""); }}
                  className="flex-1 text-lg font-bold border-2 border-primary/30 rounded-lg px-3 py-2 text-center focus:outline-none focus:border-primary"
                  data-testid="input-hourly-rate"
                  placeholder="1500"
                  autoFocus
                  min="0"
                  max="99999"
                />
                <span className="text-sm text-gray-500">円/時</span>
              </div>
              {saveError && <p className="text-xs text-red-500 mt-1.5">{saveError}</p>}
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={() => { setSaveError(""); setEditingRate(false); }}
                  className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 font-medium"
                  data-testid="btn-cancel-hourly-rate">
                  キャンセル
                </button>
                <button
                  onClick={() => {
                    const v = rateInput.trim() ? Number(rateInput) : null;
                    if (v !== null && (isNaN(v) || v < 0 || v > 99999)) {
                      setSaveError("0〜99999の値を入力してください");
                      return;
                    }
                    saveRateMut.mutate(v);
                  }}
                  disabled={saveRateMut.isPending}
                  className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50"
                  data-testid="btn-save-hourly-rate">
                  {saveRateMut.isPending ? "保存中..." : "保存する"}
                </button>
              </div>
            </div>
          ) : hourlyRate ? (
            <button
              onClick={() => { setRateInput(String(hourlyRate)); setEditingRate(true); }}
              className="w-full flex items-center justify-between"
              data-testid="btn-edit-hourly-rate">
              <div className="text-left">
                <p className="text-[10px] text-gray-400 font-medium">設定中の時給</p>
                <p className="text-lg font-bold text-gray-900">¥{hourlyRate.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-1">/ 時間</span></p>
              </div>
              <span className="text-xs text-primary font-bold px-2 py-1 bg-primary/10 rounded-lg">変更</span>
            </button>
          ) : (
            <button
              onClick={() => { setRateInput(""); setEditingRate(true); }}
              className="w-full flex items-center gap-3"
              data-testid="btn-edit-hourly-rate">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-base">¥</span>
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-amber-700">時給を設定してください</p>
                <p className="text-[10px] text-amber-600">設定すると給与見込みが計算されます</p>
              </div>
              <span className="text-xs text-amber-700 font-bold px-2 py-1 bg-amber-100 rounded-lg shrink-0">設定</span>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 pt-2 pb-8">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-white rounded-xl border animate-pulse" />)}</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">この月の打刻記録はありません</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {records.sort((a, b) => a.date.localeCompare(b.date)).map(r => {
              const hours = r.clockIn && r.clockOut
                ? (() => {
                    const t = (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 3600000;
                    let b = 0;
                    if (r.breakStart && r.breakEnd) b = (new Date(r.breakEnd).getTime() - new Date(r.breakStart).getTime()) / 3600000;
                    return Math.max(0, t - b);
                  })()
                : 0;
              const isEditing = editingRecordId === r.id;
              return (
                <div key={r.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${isEditing ? "border-primary/40" : ""}`}
                  data-testid={`att-history-${r.date}`}>
                  {/* 通常表示行 */}
                  <div className="px-3 py-2.5 flex items-center gap-3">
                    <div className="text-center shrink-0 w-12">
                      <p className="text-sm font-bold text-gray-800">{format(parseISO(r.date), "M/d")}</p>
                      <p className="text-[9px] text-gray-400">{format(parseISO(r.date), "E", { locale: ja })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-medium">{r.clockIn ? format(new Date(r.clockIn), "HH:mm") : "--:--"}</span>
                        <span className="text-gray-300">→</span>
                        <span className="font-medium">{r.clockOut ? format(new Date(r.clockOut), "HH:mm") : "--:--"}</span>
                      </div>
                      {r.breakStart && (
                        <p className="text-[10px] text-amber-500 mt-0.5">
                          休憩 {format(new Date(r.breakStart), "HH:mm")}〜{r.breakEnd ? format(new Date(r.breakEnd), "HH:mm") : ""}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div>
                        <p className="text-sm font-bold text-blue-600">{hours.toFixed(1)}<span className="text-[10px] font-normal text-gray-400">h</span></p>
                        {hourlyRate && <p className="text-[10px] text-emerald-600">¥{Math.round(hours * hourlyRate).toLocaleString()}</p>}
                      </div>
                      <button
                        onClick={() => isEditing ? setEditingRecordId(null) : openEdit(r)}
                        data-testid={`btn-edit-att-${r.date}`}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isEditing ? "bg-primary/10 text-primary" : "bg-gray-50 text-gray-400 hover:text-primary hover:bg-primary/5"}`}>
                        {isEditing ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* インライン編集フォーム */}
                  {isEditing && (
                    <div className="px-3 pb-3 pt-0 border-t border-primary/10 bg-primary/[0.02]">
                      <p className="text-[10px] text-primary font-bold mb-2 pt-2">打刻時刻を修正</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-2">
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium block mb-1">出勤</label>
                          <input type="time" value={editForm.clockIn}
                            onChange={e => setEditForm(p => ({ ...p, clockIn: e.target.value }))}
                            data-testid="input-edit-clock-in"
                            className="w-full text-sm border rounded-lg px-2 py-1.5 text-center font-mono focus:outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium block mb-1">退勤</label>
                          <input type="time" value={editForm.clockOut}
                            onChange={e => setEditForm(p => ({ ...p, clockOut: e.target.value }))}
                            data-testid="input-edit-clock-out"
                            className="w-full text-sm border rounded-lg px-2 py-1.5 text-center font-mono focus:outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium block mb-1">休憩 開始</label>
                          <input type="time" value={editForm.breakStart}
                            onChange={e => setEditForm(p => ({ ...p, breakStart: e.target.value }))}
                            data-testid="input-edit-break-start"
                            className="w-full text-sm border rounded-lg px-2 py-1.5 text-center font-mono focus:outline-none focus:border-primary" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 font-medium block mb-1">休憩 終了</label>
                          <input type="time" value={editForm.breakEnd}
                            onChange={e => setEditForm(p => ({ ...p, breakEnd: e.target.value }))}
                            data-testid="input-edit-break-end"
                            className="w-full text-sm border rounded-lg px-2 py-1.5 text-center font-mono focus:outline-none focus:border-primary" />
                        </div>
                      </div>
                      {editError && <p className="text-[11px] text-red-500 mb-1.5">{editError}</p>}
                      <button
                        onClick={() => editMut.mutate({ id: r.id, body: editForm })}
                        disabled={editMut.isPending}
                        data-testid={`btn-save-att-${r.date}`}
                        className="w-full py-2 rounded-lg bg-primary text-white text-sm font-bold disabled:opacity-50">
                        {editMut.isPending ? "保存中..." : "修正を保存"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DoctorHygienistView({ me, clinic }: { me: StaffMe; clinic: Clinic | undefined }) {
  const [view, setView] = useState<"day" | "week" | "shift" | "attendance">("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekBase, setWeekBase] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedWeekDay, setSelectedWeekDay] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const weekEnd = addDays(weekBase, 6);
  const weekStartStr = format(weekBase, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const qKey = ["/api/staff/my-appointments", weekStartStr, weekEndStr];

  const { data: weekAppts = [], isLoading: weekLoading } = useQuery<Appointment[]>({
    queryKey: qKey,
    queryFn: () => fetch(`/api/staff/my-appointments?startDate=${weekStartStr}&endDate=${weekEndStr}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!me,
    refetchInterval: 60_000,
  });

  const dayAppts = weekAppts.filter(a => a.date === dateStr).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const activeCount = dayAppts.filter(a => !["completed", "cancelled", "no_show"].includes(a.status)).length;
  const pendingCount = dayAppts.filter(a => a.status === "pending").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="px-4 pt-3 pb-2">
          <p className="text-xs text-gray-400">{clinic?.name ?? ""}</p>
          <h1 className="text-base font-bold text-gray-900">
            {me.name}
            <span className="ml-1.5 text-xs font-normal text-gray-500">
              {me.role === "doctor" ? "歯科医師" : me.role === "hygienist" ? "衛生士" : me.role}
            </span>
          </h1>
        </div>
        <ClockInWidget />
        <div className="px-4 pb-2 flex gap-1">
          {(["day", "week", "shift", "attendance"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              data-testid={`btn-view-${v}`}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-colors ${view === v ? "bg-primary text-primary-foreground" : "bg-gray-100 text-gray-500"}`}>
              {v === "day" ? "日" : v === "week" ? "週" : v === "shift" ? "シフト" : "勤怠"}
            </button>
          ))}
        </div>
      </header>

      {view === "attendance" ? (
        <AttendanceHistoryView />
      ) : view === "shift" ? (
        <ShiftView me={me} />
      ) : view === "week" ? (
        <div className="flex-1">
          <div className="bg-white border-b">
            <div className="flex items-center justify-between px-4 py-2">
              <button onClick={() => { setWeekBase(d => subWeeks(d, 1)); setSelectedWeekDay(null); }} data-testid="btn-prev-week">
                <ChevronLeft className="w-5 h-5 text-gray-500" />
              </button>
              <span className="text-sm font-semibold text-gray-700">
                {format(weekBase, "M月d日", { locale: ja })} 〜 {format(weekEnd, "M月d日（E）", { locale: ja })}
              </span>
              <button onClick={() => { setWeekBase(d => addWeeks(d, 1)); setSelectedWeekDay(null); }} data-testid="btn-next-week">
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <WeekView weekStart={weekBase} appointments={weekAppts}
              selectedDate={selectedWeekDay ?? undefined}
              onDaySelect={day => {
                const ds = format(day, "yyyy-MM-dd");
                setSelectedWeekDay(prev => prev === ds ? null : ds);
                setCurrentDate(day);
              }} />
          </div>
          <div className="p-4 space-y-3 pb-8">
            {weekLoading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-white rounded-xl animate-pulse border" />)}</div>
            ) : weekAppts.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>この週の担当予約はありません</p>
              </div>
            ) : ((() => {
              const daysToShow = selectedWeekDay
                ? [parseISO(selectedWeekDay)]
                : Array.from({ length: 7 }, (_, i) => addDays(weekBase, i));
              return daysToShow.map(day => {
                const ds = format(day, "yyyy-MM-dd");
                const da = weekAppts.filter(a => a.date === ds).sort((a, b) => a.startTime.localeCompare(b.startTime));
                if (da.length === 0 && selectedWeekDay) {
                  return (
                    <div key={ds} className="text-center py-8 text-gray-400">
                      <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{getDayLabel(day)}の予約はありません</p>
                    </div>
                  );
                }
                if (da.length === 0) return null;
                return (
                  <div key={ds}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isToday(day) ? "bg-primary text-primary-foreground" : "bg-gray-200 text-gray-600"}`}>
                        {getDayLabel(day)}
                      </span>
                      {selectedWeekDay && (
                        <button onClick={() => { setCurrentDate(day); setView("day"); }}
                          className="text-[10px] text-primary font-bold ml-auto" data-testid="btn-goto-day-view">
                          日表示 →
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {da.map(a => {
                        const st = STATUS_CFG[a.status] ?? STATUS_CFG.confirmed;
                        return (
                          <button key={a.id}
                            onClick={() => { setCurrentDate(parseISO(a.date)); setView("day"); }}
                            className="w-full bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 text-left shadow-sm active:bg-gray-50">
                            <div className="text-center shrink-0">
                              <p className="font-mono font-bold text-sm text-gray-900">{a.startTime.slice(0,5)}</p>
                              <p className="text-[10px] text-gray-400">{a.endTime?.slice(0,5)}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 truncate text-sm">{a.patient?.name ?? "患者不明"}</p>
                              <p className="text-xs text-gray-500 truncate">{a.treatmentType}</p>
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 border ${st.color} ${st.bg} ${st.border}`}>
                              {st.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })())
          }
          </div>
        </div>
      ) : (
        <>
          <div className="bg-white border-b px-4 py-2.5 flex items-center justify-between">
            <Button size="icon" variant="outline" className="h-8 w-8"
              onClick={() => setCurrentDate(d => subDays(d, 1))} data-testid="button-prev-day">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <button className="flex flex-col items-center" onClick={() => setCurrentDate(new Date())} data-testid="btn-today">
              <span className="text-lg font-bold text-gray-900">{getDayLabel(currentDate)}</span>
              {!isToday(currentDate) && (
                <span className="text-xs text-gray-400">{format(currentDate, "yyyy年M月d日")}</span>
              )}
            </button>
            <Button size="icon" variant="outline" className="h-8 w-8"
              onClick={() => setCurrentDate(d => addDays(d, 1))} data-testid="button-next-day">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="bg-white border-b px-4 py-2 flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-gray-600">計 <strong className="text-gray-900">{dayAppts.length}</strong> 件</span>
            </div>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">残 <strong className="text-gray-900">{activeCount}</strong> 件</span>
            {pendingCount > 0 && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                仮予約 {pendingCount}件
              </Badge>
            )}
            <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs text-gray-400"
              onClick={() => qc.invalidateQueries({ queryKey: qKey })}>
              <RefreshCw className="w-3 h-3 mr-1" />更新
            </Button>
          </div>

          <main className="flex-1 p-4 space-y-3 pb-8">
            {weekLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-24 animate-pulse border" />)}
              </div>
            ) : dayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
                <Calendar className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-medium text-gray-500">予約はありません</p>
                <p className="text-sm mt-1">この日の担当予約はありません</p>
              </div>
            ) : (
              dayAppts.map(appt => (
                <ApptCard key={appt.id} appt={appt} queryKey={qKey} />
              ))
            )}
          </main>
        </>
      )}
    </div>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function MySchedulePage() {
  const { data: me, isLoading: meLoading, isError: meError } = useQuery<StaffMe>({
    queryKey: ["/api/staff/me"],
    queryFn: () => fetch("/api/staff/me", { credentials: "include" }).then(r => { if (!r.ok) throw new Error("unauthorized"); return r.json(); }),
    retry: false,
  });

  const { data: clinic } = useQuery<Clinic>({
    queryKey: ["/api/staff/clinic-info"],
    queryFn: () => fetch("/api/staff/clinic-info", { credentials: "include" }).then(r => r.json()),
    enabled: !!me,
  });

  const [, navigate] = useLocation();

  if (meLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center text-gray-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
        <p className="text-sm">読み込み中...</p>
      </div>
    </div>
  );

  if (meError || !me) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-600 mb-4">ログインが必要です</p>
        <Button onClick={() => navigate("/login")}>ログイン画面へ</Button>
      </div>
    </div>
  );

  if (me.role === "assistant") {
    return <AssistantView me={me} clinic={clinic} />;
  }

  return <DoctorHygienistView me={me} clinic={clinic} />;
}
