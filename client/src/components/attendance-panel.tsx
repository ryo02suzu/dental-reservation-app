import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subMonths, addMonths, startOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import {
  Clock, Coffee, LogIn, LogOut, UserCheck, Users, QrCode, Edit2, ChevronLeft, ChevronRight, FileText, X, Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { apiRequest } from "@/lib/queryClient";

interface Staff { id: string; name: string; role: string; showInCalendar?: boolean | null; hourlyRate?: number | null }

interface AttendanceRecord {
  id: string; staffId: string; date: string;
  clockIn: string | null; clockOut: string | null;
  breakStart: string | null; breakEnd: string | null;
  notes?: string | null;
  staff?: Staff;
}

const ROLE_CFG: Record<string, { dot: string; label: string }> = {
  doctor:    { dot: "bg-blue-500",    label: "Dr" },
  hygienist: { dot: "bg-emerald-500", label: "DH" },
  assistant: { dot: "bg-orange-400",  label: "DA" },
};

function calcHours(clockIn: string | null, clockOut: string | null, breakStart: string | null, breakEnd: string | null) {
  if (!clockIn || !clockOut) return 0;
  const total = (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 3600000;
  let breakHours = 0;
  if (breakStart && breakEnd) {
    breakHours = (new Date(breakEnd).getTime() - new Date(breakStart).getTime()) / 3600000;
  }
  return Math.max(0, total - breakHours);
}

export function AttendancePanel() {
  const [tab, setTab] = useState<"today" | "report">("today");
  return (
    <div className="flex-1 overflow-auto flex flex-col">
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="flex">
          <button onClick={() => setTab("today")}
            className={`flex-1 py-2.5 text-sm font-bold border-b-2 transition-colors ${tab === "today" ? "border-primary text-primary" : "border-transparent text-gray-400"}`}
            data-testid="tab-attendance-today">
            本日の出退勤
          </button>
          <button onClick={() => setTab("report")}
            className={`flex-1 py-2.5 text-sm font-bold border-b-2 transition-colors ${tab === "report" ? "border-primary text-primary" : "border-transparent text-gray-400"}`}
            data-testid="tab-attendance-report">
            月次レポート
          </button>
        </div>
      </div>
      {tab === "today" ? <TodayView /> : <MonthlyReport />}
    </div>
  );
}

function TodayView() {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const eventSourceRef = useRef<EventSource | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    function connect() {
      if (cancelled) return;
      const es = new EventSource("/api/attendance/stream");
      eventSourceRef.current = es;
      es.onmessage = () => {
        qc.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      };
      es.onerror = () => {
        es.close();
        if (!cancelled) setTimeout(connect, 5000);
      };
    }
    connect();
    return () => { cancelled = true; eventSourceRef.current?.close(); };
  }, [qc]);

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ["/api/attendance/today"],
    queryFn: () => fetch("/api/attendance/today").then(r => r.json()),
    refetchInterval: 3000,
  });

  const { data: staffList = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  const { data: qrData, refetch: refetchQr } = useQuery<{ token: string; expiresAt: number }>({
    queryKey: ["/api/attendance/qr-token"],
    queryFn: () => fetch("/api/attendance/qr-token").then(r => r.json()),
    refetchInterval: 30000,
  });

  function elapsed(from: string | null, to?: string | null) {
    if (!from) return "--:--:--";
    const end = to ? new Date(to).getTime() : now.getTime();
    const diff = Math.max(0, Math.floor((end - new Date(from).getTime()) / 1000));
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function fmtTime(ts: string | null) {
    if (!ts) return "--:--:--";
    return format(new Date(ts), "HH:mm:ss");
  }

  const clockedIn = records.filter(r => r.clockIn && !r.clockOut);
  const onBreak = records.filter(r => r.clockIn && !r.clockOut && r.breakStart && !r.breakEnd);
  const clockedOut = records.filter(r => r.clockOut);
  const notClockedIn = staffList.filter(s =>
    s.showInCalendar !== false && !records.some(r => r.staffId === s.id)
  );

  const qrUrl = qrData?.token
    ? `${window.location.origin}/qr-clock-in/${qrData.token}`
    : null;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">出退勤状況</h2>
            <p className="text-xs text-muted-foreground">{format(now, "yyyy年M月d日(E)", { locale: ja })}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-mono font-bold text-gray-900 tabular-nums" data-testid="text-admin-clock">
              {format(now, "HH:mm:ss")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-600" data-testid="text-count-working">{clockedIn.length}</p>
            <p className="text-xs text-emerald-700 font-medium">勤務中</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-amber-600" data-testid="text-count-break">{onBreak.length}</p>
            <p className="text-xs text-amber-700 font-medium">休憩中</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-gray-600" data-testid="text-count-done">{clockedOut.length}</p>
            <p className="text-xs text-gray-500 font-medium">退勤済</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{notClockedIn.length}</p>
            <p className="text-xs text-blue-700 font-medium">未出勤</p>
          </div>
        </div>

        {qrUrl && (
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white border-2 border-gray-200 rounded-xl shadow-inner shrink-0">
                <QRCodeSVG value={qrUrl} size={140} level="M" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-2">
                  <QrCode className="w-4 h-4 text-primary" />
                  出退勤打刻用QRコード
                </h3>
                <p className="text-xs text-gray-500 mb-2">スタッフがスマホでスキャンして出勤・退勤打刻します</p>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => { navigator.clipboard.writeText(qrUrl!); }}
                    className="flex-1 text-xs font-bold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/5 active:bg-primary/10 transition-colors"
                    data-testid="btn-copy-qr-url">
                    URLをコピー
                  </button>
                  <button onClick={() => refetchQr()}
                    className="flex-1 text-xs font-bold text-emerald-700 border border-emerald-300 rounded-lg px-3 py-1.5 hover:bg-emerald-50 active:bg-emerald-100 transition-colors"
                    data-testid="btn-refresh-qr">
                    QR更新
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
                  <p>30秒ごとに自動更新 / 手動更新も可能</p>
                  <p className="text-gray-400 mt-0.5">受付のタブレットやPCに表示してください</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {clockedIn.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />勤務中
            </h3>
            <div className="space-y-1.5">
              {clockedIn.map(r => {
                const staff = r.staff || staffList.find(s => s.id === r.staffId);
                const role = ROLE_CFG[staff?.role ?? ""] || ROLE_CFG.assistant;
                const isBreak = !!r.breakStart && !r.breakEnd;
                return (
                  <div key={r.id}
                    className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 transition-colors ${isBreak ? "border-amber-200 bg-amber-50/30" : ""}`}
                    data-testid={`attendance-row-${r.staffId}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${role.dot}`}>
                      {role.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{staff?.name ?? "?"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <LogIn className="w-2.5 h-2.5" />{fmtTime(r.clockIn)}
                        </span>
                        {isBreak && (
                          <span className="text-[10px] text-amber-500 flex items-center gap-0.5 font-semibold animate-pulse">
                            <Coffee className="w-2.5 h-2.5" />休憩中 {fmtTime(r.breakStart)}〜
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {isBreak ? (
                        <div>
                          <p className="text-[9px] text-amber-500 font-medium">休憩経過</p>
                          <p className="text-lg font-mono font-bold text-amber-500 tabular-nums leading-tight"
                            data-testid={`elapsed-break-${r.staffId}`}>
                            {elapsed(r.breakStart)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-[9px] text-emerald-500 font-medium">勤務時間</p>
                          <p className="text-lg font-mono font-bold text-emerald-600 tabular-nums leading-tight"
                            data-testid={`elapsed-work-${r.staffId}`}>
                            {elapsed(r.clockIn)}
                          </p>
                        </div>
                      )}
                    </div>
                    <button onClick={() => setEditingRecord(r)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      data-testid={`button-edit-attendance-${r.staffId}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isBreak ? "bg-amber-400 animate-pulse" : "bg-emerald-400 animate-pulse"}`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {clockedOut.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <LogOut className="w-3.5 h-3.5" />退勤済み
            </h3>
            <div className="space-y-1.5">
              {clockedOut.map(r => {
                const staff = r.staff || staffList.find(s => s.id === r.staffId);
                const role = ROLE_CFG[staff?.role ?? ""] || ROLE_CFG.assistant;
                return (
                  <div key={r.id} className="bg-white rounded-xl border px-4 py-2.5 flex items-center gap-3 opacity-60"
                    data-testid={`attendance-done-${r.staffId}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${role.dot}`}>
                      {role.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-600">{staff?.name ?? "?"}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 shrink-0">
                      <span className="flex items-center gap-0.5"><LogIn className="w-3 h-3" />{fmtTime(r.clockIn)}</span>
                      <span>→</span>
                      <span className="flex items-center gap-0.5"><LogOut className="w-3 h-3" />{fmtTime(r.clockOut)}</span>
                      <span className="font-mono font-bold text-gray-700">{elapsed(r.clockIn, r.clockOut)}</span>
                    </div>
                    <button onClick={() => setEditingRecord(r)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                      data-testid={`button-edit-done-${r.staffId}`}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {notClockedIn.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />未出勤
            </h3>
            <div className="flex flex-wrap gap-2">
              {notClockedIn.map(s => {
                const role = ROLE_CFG[s.role] || ROLE_CFG.assistant;
                return (
                  <div key={s.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5"
                    data-testid={`attendance-absent-${s.id}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold ${role.dot}`}>
                      {role.label}
                    </div>
                    <span className="text-xs text-gray-500">{s.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-10 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-spin opacity-30" />
            <p className="text-sm">読み込み中...</p>
          </div>
        )}
      </div>

      {editingRecord && (
        <EditAttendanceModal record={editingRecord} staffList={staffList} onClose={() => setEditingRecord(null)} />
      )}
    </div>
  );
}

function EditAttendanceModal({ record, staffList, onClose }: { record: AttendanceRecord; staffList: Staff[]; onClose: () => void }) {
  const qc = useQueryClient();
  const staff = record.staff || staffList.find(s => s.id === record.staffId);
  const [clockIn, setClockIn] = useState(record.clockIn ? format(new Date(record.clockIn), "HH:mm") : "");
  const [clockOut, setClockOut] = useState(record.clockOut ? format(new Date(record.clockOut), "HH:mm") : "");
  const [breakStart, setBreakStart] = useState(record.breakStart ? format(new Date(record.breakStart), "HH:mm") : "");
  const [breakEnd, setBreakEnd] = useState(record.breakEnd ? format(new Date(record.breakEnd), "HH:mm") : "");

  function toIso(dateStr: string, time: string) {
    if (!time) return null;
    return new Date(`${dateStr}T${time}:00`).toISOString();
  }

  const saveMut = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/attendance/${record.id}`, {
      clockIn: toIso(record.date, clockIn),
      clockOut: clockOut ? toIso(record.date, clockOut) : null,
      breakStart: breakStart ? toIso(record.date, breakStart) : null,
      breakEnd: breakEnd ? toIso(record.date, breakEnd) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">打刻編集</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{staff?.name} — {record.date}</p>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">出勤時刻</label>
            <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" data-testid="input-edit-clock-in" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">退勤時刻</label>
            <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" data-testid="input-edit-clock-out" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">休憩開始</label>
            <input type="time" value={breakStart} onChange={e => setBreakStart(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" data-testid="input-edit-break-start" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">休憩終了</label>
            <input type="time" value={breakEnd} onChange={e => setBreakEnd(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm" data-testid="input-edit-break-end" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-bold">キャンセル</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !clockIn}
            className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
            data-testid="button-save-edit-attendance">
            {saveMut.isPending ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthlyReport() {
  const [monthBase, setMonthBase] = useState(() => startOfMonth(new Date()));
  const monthStr = format(monthBase, "yyyy-MM");

  const { data, isLoading } = useQuery<{ records: AttendanceRecord[]; staff: Staff[] }>({
    queryKey: ["/api/attendance/monthly", monthStr],
    queryFn: () => fetch(`/api/attendance/monthly?month=${monthStr}`).then(r => r.json()),
  });

  const records = data?.records ?? [];
  const staffList = data?.staff ?? [];

  const staffSummary = staffList
    .filter(s => s.showInCalendar !== false)
    .map(s => {
      const myRecords = records.filter(r => r.staffId === s.id);
      const totalDays = myRecords.length;
      const totalHours = myRecords.reduce((acc, r) => acc + calcHours(r.clockIn, r.clockOut, r.breakStart, r.breakEnd), 0);
      const pay = s.hourlyRate ? Math.round(totalHours * s.hourlyRate) : null;
      return { staff: s, totalDays, totalHours, pay };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const grandTotalHours = staffSummary.reduce((acc, s) => acc + s.totalHours, 0);
  const grandTotalPay = staffSummary.reduce((acc, s) => acc + (s.pay ?? 0), 0);

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <button onClick={() => setMonthBase(d => subMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100" data-testid="btn-report-prev">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
          <h2 className="text-lg font-bold text-gray-900">{format(monthBase, "yyyy年M月", { locale: ja })} 給与レポート</h2>
          <button onClick={() => setMonthBase(d => addMonths(d, 1))} className="p-1.5 rounded-lg hover:bg-gray-100" data-testid="btn-report-next">
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{grandTotalHours.toFixed(1)}<span className="text-sm font-normal">h</span></p>
            <p className="text-xs text-blue-700 font-medium">総勤務時間</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{grandTotalPay > 0 ? `¥${grandTotalPay.toLocaleString()}` : "—"}</p>
            <p className="text-xs text-emerald-700 font-medium">給与合計見込み</p>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 animate-spin opacity-30" />
            <p className="text-sm">読み込み中...</p>
          </div>
        ) : staffSummary.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">データがありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {staffSummary.map(({ staff: s, totalDays, totalHours, pay }) => {
              const role = ROLE_CFG[s.role] || ROLE_CFG.assistant;
              return (
                <div key={s.id} className="bg-white rounded-xl border px-4 py-3 flex items-center gap-3"
                  data-testid={`report-row-${s.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${role.dot}`}>
                    {role.label}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">{s.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {s.hourlyRate ? `時給 ¥${s.hourlyRate.toLocaleString()}` : "時給未設定"}
                    </p>
                  </div>
                  <div className="text-center shrink-0 px-2">
                    <p className="text-sm font-bold text-gray-800">{totalDays}<span className="text-[10px] font-normal text-gray-400">日</span></p>
                  </div>
                  <div className="text-center shrink-0 px-2">
                    <p className="text-sm font-bold text-blue-600">{totalHours.toFixed(1)}<span className="text-[10px] font-normal text-gray-400">h</span></p>
                  </div>
                  <div className="text-right shrink-0 min-w-[80px]">
                    {pay !== null ? (
                      <p className="text-sm font-bold text-emerald-600">¥{pay.toLocaleString()}</p>
                    ) : (
                      <p className="text-xs text-gray-400">—</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
