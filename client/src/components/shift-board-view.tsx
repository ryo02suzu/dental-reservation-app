import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  addWeeks, subWeeks, startOfWeek, addDays, parseISO, isToday, getDay,
} from "date-fns";
import { ja } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Plus, Clock, Settings, CheckCircle, XCircle,
  Trash2, AlertTriangle, Printer, CheckCheck, Users, Stethoscope, Calendar, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Staff {
  id: string; name: string; role: string;
  employmentType?: string | null;
  showInCalendar?: boolean | null;
  sortOrder?: number;
}
interface ShiftEntry {
  id: string; staffId: string; patternId?: string | null;
  date: string; startTime?: string | null; endTime?: string | null;
  status: "requested" | "approved" | "rejected";
  notes?: string | null;
}
interface ShiftPattern {
  id: string; clinicId: string; name: string;
  startTime: string; endTime: string;
  isActive: boolean | null; sortOrder: number | null;
}
interface ClinicHoliday { id: string; date: string; name?: string | null }

const DOW_JP = ["日", "月", "火", "水", "木", "金", "土"];

const PATTERN_PALETTE = [
  { bg: "bg-blue-100", text: "text-blue-700", bar: "bg-blue-500", border: "border-blue-400" },
  { bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500", border: "border-emerald-400" },
  { bg: "bg-amber-100", text: "text-amber-700", bar: "bg-amber-500", border: "border-amber-400" },
  { bg: "bg-purple-100", text: "text-purple-700", bar: "bg-purple-500", border: "border-purple-400" },
  { bg: "bg-rose-100", text: "text-rose-700", bar: "bg-rose-500", border: "border-rose-400" },
  { bg: "bg-cyan-100", text: "text-cyan-700", bar: "bg-cyan-500", border: "border-cyan-400" },
];

const ROLE_CFG: Record<string, { dot: string; label: string; bg: string }> = {
  doctor:    { dot: "bg-blue-500",    label: "Dr",  bg: "bg-blue-50/50" },
  hygienist: { dot: "bg-emerald-500", label: "DH",  bg: "bg-emerald-50/50" },
  assistant: { dot: "bg-orange-400",  label: "DA",  bg: "bg-orange-50/50" },
};

const EMP_LABEL: Record<string, string> = { fulltime: "常勤", parttime: "非常勤", contract: "契約" };

function getMinStaff(): { doctor: number; hygienist: number } {
  try { const v = localStorage.getItem("shift-min-staff"); if (v) return JSON.parse(v); } catch {}
  return { doctor: 1, hygienist: 1 };
}

function timeToH(t: string | null | undefined) {
  if (!t) return 0; const [h, m] = t.split(":").map(Number); return h + m / 60;
}

type ViewMode = "week" | "month";

export function ShiftBoardView() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekBase, setWeekBase] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [monthBase, setMonthBase] = useState(() => startOfMonth(new Date()));
  const [showPatternDlg, setShowPatternDlg] = useState(false);
  const [showMinStaffDlg, setShowMinStaffDlg] = useState(false);
  const [openCell, setOpenCell] = useState<string | null>(null);
  const [minStaff, setMinStaff] = useState(getMinStaff);

  const weekEndDay = addDays(weekBase, 6);
  const weekStartStr = format(weekBase, "yyyy-MM-dd");
  const weekEndStr = format(weekEndDay, "yyyy-MM-dd");
  const monthStr = format(monthBase, "yyyy-MM");
  const year = viewMode === "week" ? weekBase.getFullYear() : monthBase.getFullYear();

  const days = viewMode === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(weekBase, i))
    : eachDayOfInterval({ start: startOfMonth(monthBase), end: endOfMonth(monthBase) });

  const shiftsQueryKey = viewMode === "week"
    ? ["/api/shifts", "week", weekStartStr, weekEndStr]
    : ["/api/shifts", monthStr];
  const shiftsUrl = viewMode === "week"
    ? `/api/shifts?startDate=${weekStartStr}&endDate=${weekEndStr}`
    : `/api/shifts?month=${monthStr}`;

  const apptCountsMonthStr = viewMode === "week"
    ? format(weekBase, "yyyy-MM")
    : monthStr;

  const { data: staffList = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  const { data: shifts = [], isLoading } = useQuery<ShiftEntry[]>({
    queryKey: shiftsQueryKey,
    queryFn: () => fetch(shiftsUrl, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    staleTime: 0,
    refetchInterval: 30 * 1000,
  });
  const { data: patterns = [] } = useQuery<ShiftPattern[]>({ queryKey: ["/api/shift-patterns"] });
  const { data: clinicHolidays = [] } = useQuery<ClinicHoliday[]>({ queryKey: ["/api/holidays"] });
  const { data: jpHolidays = [] } = useQuery<{ date: string; name: string }[]>({
    queryKey: ["/api/holidays/japan", year],
    queryFn: () => fetch(`/api/holidays/japan/${year}`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: apptCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/shifts/appointment-counts", apptCountsMonthStr],
    queryFn: () => fetch(`/api/shifts/appointment-counts?month=${apptCountsMonthStr}`, { credentials: "include" }).then(r => r.json()),
    staleTime: 0,
    refetchInterval: 30 * 1000,
  });

  const activePatterns = patterns.filter(p => p.isActive !== false);
  const patternMap = useMemo(() => Object.fromEntries(patterns.map(p => [p.id, p])), [patterns]);
  const patternColorMap = useMemo(() => {
    const m: Record<string, typeof PATTERN_PALETTE[0]> = {};
    activePatterns.forEach((p, i) => { m[p.id] = PATTERN_PALETTE[i % PATTERN_PALETTE.length]; });
    return m;
  }, [activePatterns]);

  const visibleStaff = staffList.filter(s => s.showInCalendar !== false).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const holidaySet = useMemo(() => {
    const s = new Set<string>();
    clinicHolidays.forEach(h => s.add(h.date));
    jpHolidays.forEach(h => s.add(h.date));
    return s;
  }, [clinicHolidays, jpHolidays]);

  const holidayNames = useMemo(() => {
    const m: Record<string, string> = {};
    clinicHolidays.forEach(h => { if (h.name) m[h.date] = h.name; });
    jpHolidays.forEach(h => m[h.date] = h.name);
    return m;
  }, [clinicHolidays, jpHolidays]);

  const shiftMap = useMemo(() => {
    const m: Record<string, ShiftEntry[]> = {};
    for (const s of shifts) { const k = `${s.staffId}|${s.date}`; if (!m[k]) m[k] = []; m[k].push(s); }
    return m;
  }, [shifts]);

  const staffSummary = useMemo(() => {
    const m: Record<string, { approved: number; requested: number; hours: number }> = {};
    for (const st of visibleStaff) m[st.id] = { approved: 0, requested: 0, hours: 0 };
    for (const s of shifts) {
      if (!m[s.staffId]) continue;
      if (s.status === "approved") { m[s.staffId].approved++; const h = timeToH(s.endTime) - timeToH(s.startTime); if (h > 0) m[s.staffId].hours += h; }
      else if (s.status === "requested") m[s.staffId].requested++;
    }
    return m;
  }, [shifts, visibleStaff]);

  const dailySummary = useMemo(() => {
    const m: Record<string, { total: number; doctor: number; hygienist: number }> = {};
    for (const d of days) m[format(d, "yyyy-MM-dd")] = { total: 0, doctor: 0, hygienist: 0 };
    for (const s of shifts) {
      if (s.status !== "approved" || !m[s.date]) continue;
      m[s.date].total++;
      const st = staffList.find(x => x.id === s.staffId);
      if (st?.role === "doctor") m[s.date].doctor++;
      else if (st?.role === "hygienist") m[s.date].hygienist++;
    }
    return m;
  }, [shifts, staffList, days]);

  const createMut = useMutation({
    mutationFn: (d: { staffId: string; date: string; patternId?: string; startTime?: string; endTime?: string }) =>
      apiRequest("POST", "/api/shifts", { ...d, status: "approved" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shifts"] });
      setOpenCell(null);
      toast({ title: "シフトを追加しました" });
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PUT", `/api/shifts/${id}`, { status }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shifts"] }); toast({ title: "更新しました" }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shifts/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shifts"] }); toast({ title: "削除しました" }); },
  });
  const batchMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/shifts/batch-approve", { month: monthStr }).then(r => r.json()),
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["/api/shifts"] }); toast({ title: `${d.approved}件を一括承認` }); },
  });

  function quickAssign(staffId: string, date: string, patternId: string) {
    const pat = patternMap[patternId];
    createMut.mutate({ staffId, date, patternId, startTime: pat?.startTime, endTime: pat?.endTime });
  }

  function handleDelete(entry: ShiftEntry) {
    const cnt = apptCounts[`${entry.staffId}|${entry.date}`] || 0;
    if (cnt > 0) {
      const name = staffList.find(s => s.id === entry.staffId)?.name ?? "";
      if (!window.confirm(`⚠️ ${name}は${entry.date}に${cnt}件の予約があります。削除しますか？`)) return;
    }
    deleteMut.mutate(entry.id);
  }

  const requestedCount = shifts.filter(s => s.status === "requested").length;
  const isWeek = viewMode === "week";

  const headerLabel = isWeek
    ? `${format(weekBase, "M/d(E)", { locale: ja })} 〜 ${format(addDays(weekBase, 6), "M/d(E)", { locale: ja })}`
    : format(monthBase, "yyyy年M月", { locale: ja });

  function navPrev() {
    if (isWeek) setWeekBase(d => subWeeks(d, 1));
    else setMonthBase(d => subMonths(d, 1));
  }
  function navNext() {
    if (isWeek) setWeekBase(d => addWeeks(d, 1));
    else setMonthBase(d => addMonths(d, 1));
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible">
      {/* Header */}
      <div className="shrink-0 bg-white border-b px-4 md:px-6 py-3 space-y-2 print:py-1 print:px-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button onClick={navPrev} className="p-1.5 rounded-lg hover:bg-muted print:hidden" data-testid="shiftboard-prev"><ChevronLeft className="w-5 h-5" /></button>
            <span className="text-sm font-bold min-w-[160px] text-center">{headerLabel}</span>
            <button onClick={navNext} className="p-1.5 rounded-lg hover:bg-muted print:hidden" data-testid="shiftboard-next"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-1.5 print:hidden">
            <div className="flex bg-muted rounded-lg p-0.5 mr-1">
              <button onClick={() => setViewMode("week")} data-testid="btn-view-week"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${isWeek ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>週</button>
              <button onClick={() => setViewMode("month")} data-testid="btn-view-month"
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${!isWeek ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>月</button>
            </div>
            {requestedCount > 0 && (
              <Button size="sm" onClick={() => batchMut.mutate()} disabled={batchMut.isPending} data-testid="button-batch-approve"
                className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs">
                <CheckCheck className="w-3.5 h-3.5 mr-1" />一括承認({requestedCount})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-xs" data-testid="button-print"><Printer className="w-3.5 h-3.5 mr-1" />印刷</Button>
            <Button variant="outline" size="sm" onClick={() => setShowMinStaffDlg(true)} className="h-8 text-xs" data-testid="button-min-staff-settings"><Users className="w-3.5 h-3.5 mr-1" />必要人数</Button>
            <Button variant="outline" size="sm" onClick={() => setShowPatternDlg(true)} className="h-8 text-xs" data-testid="button-open-pattern-settings"><Settings className="w-3.5 h-3.5 mr-1" />パターン</Button>
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap print:text-[7px]">
          {activePatterns.map((p, i) => {
            const c = PATTERN_PALETTE[i % PATTERN_PALETTE.length];
            return <span key={p.id} className="flex items-center gap-1"><span className={`w-3 h-2 rounded-sm ${c.bar}`} />{p.name}</span>;
          })}
          <span className="text-muted-foreground/50">|</span>
          <span>Dr最低{minStaff.doctor}名 / DH最低{minStaff.hygienist}名</span>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
      ) : (
        <div className="flex-1 overflow-auto print:overflow-visible">
          <table className="border-collapse w-full">
            <thead className="sticky top-0 z-20 bg-white print:relative">
              <tr>
                <th className="sticky left-0 z-30 bg-white border-b-2 border-r px-3 py-2 text-left min-w-[150px] w-[150px]">
                  <span className="text-xs font-bold text-muted-foreground">スタッフ</span>
                </th>
                {days.map(d => {
                  const ds = format(d, "yyyy-MM-dd");
                  const dow = getDay(d);
                  const isSun = dow === 0; const isSat = dow === 6;
                  const isHol = holidaySet.has(ds) || isSun;
                  const today = isToday(d);
                  const summary = dailySummary[ds];
                  const drShort = !isHol && summary && summary.doctor < minStaff.doctor;
                  const dhShort = !isHol && summary && summary.hygienist < minStaff.hygienist;
                  return (
                    <th key={ds} className={`border-b-2 border-r py-1.5 text-center ${isWeek ? "px-1" : "px-0 min-w-[44px]"}
                      ${isHol ? "bg-red-50/50" : today ? "bg-primary/5" : ""}`}
                      title={holidayNames[ds]}>
                      <div className={`text-[10px] font-semibold ${isWeek ? "text-xs" : ""} ${isSun || holidaySet.has(ds) ? "text-red-500" : isSat ? "text-blue-500" : "text-muted-foreground"}`}>
                        {isWeek ? format(d, "M/d(E)", { locale: ja }) : <>{DOW_JP[dow]}</>}
                      </div>
                      {!isWeek && (
                        <div className={`text-sm font-bold ${today ? "text-primary" : isSun || holidaySet.has(ds) ? "text-red-500" : isSat ? "text-blue-500" : ""}`}>{format(d, "d")}</div>
                      )}
                      {holidayNames[ds] && isWeek && <div className="text-[9px] text-red-400 truncate max-w-[80px]">{holidayNames[ds]}</div>}
                      {!isHol && summary && (
                        <div className="mt-0.5 space-y-0 leading-none">
                          <span className={`text-[9px] font-bold ${drShort ? "text-red-500" : "text-blue-500"}`}>Dr{summary.doctor}</span>
                          <span className="text-[8px] text-muted-foreground mx-0.5">/</span>
                          <span className={`text-[9px] font-bold ${dhShort ? "text-red-500" : "text-emerald-500"}`}>DH{summary.hygienist}</span>
                          {(drShort || dhShort) && <AlertTriangle className="w-2.5 h-2.5 text-red-500 mx-auto mt-0.5" />}
                        </div>
                      )}
                    </th>
                  );
                })}
                <th className="sticky right-0 z-30 bg-white border-b-2 border-l px-2 py-2 text-center min-w-[70px] w-[70px] print:min-w-[50px]">
                  <span className="text-xs font-bold text-muted-foreground">合計</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map(staff => {
                const role = ROLE_CFG[staff.role] || ROLE_CFG.assistant;
                const summary = staffSummary[staff.id] || { approved: 0, requested: 0, hours: 0 };
                return (
                  <tr key={staff.id} className="group">
                    <td className={`sticky left-0 z-10 bg-white border-b border-r px-3 py-2 ${role.bg}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${role.dot}`}>
                          {role.label}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate leading-tight">{staff.name}</p>
                          <p className="text-[10px] text-muted-foreground">{EMP_LABEL[staff.employmentType ?? "fulltime"] ?? ""}</p>
                        </div>
                      </div>
                    </td>
                    {days.map(d => {
                      const ds = format(d, "yyyy-MM-dd");
                      const dow = getDay(d);
                      const isSun = dow === 0;
                      const isHol = holidaySet.has(ds) || isSun;
                      const today = isToday(d);
                      const cellShifts = shiftMap[`${staff.id}|${ds}`] ?? [];
                      const approved = cellShifts.find(s => s.status === "approved");
                      const requested = cellShifts.find(s => s.status === "requested");
                      const entry = approved || requested;
                      const pat = entry?.patternId ? patternMap[entry.patternId] : null;
                      const patColor = entry?.patternId ? patternColorMap[entry.patternId] : null;
                      const hasAppts = (apptCounts[`${staff.id}|${ds}`] || 0) > 0;
                      const cellKey = `${staff.id}|${ds}`;
                      const isOpen = openCell === cellKey;

                      return (
                        <td key={ds} className={`border-b border-r p-0.5 ${isWeek ? "" : ""} ${isHol && !entry ? "bg-gray-100/60" : today ? "bg-primary/[0.03]" : ""}`}>
                          <Popover open={isOpen} onOpenChange={o => { if (!o) setOpenCell(null); }}>
                            <PopoverTrigger asChild>
                              <button
                                onClick={() => setOpenCell(isOpen ? null : cellKey)}
                                className={`w-full rounded-md transition-all relative ${isWeek ? "h-[52px]" : "h-9"} ${
                                  !entry && !isHol ? "hover:bg-gray-100 hover:ring-1 hover:ring-gray-200" : ""
                                }`}
                                data-testid={`cell-${staff.id}-${ds}`}
                              >
                                {isHol && !entry ? (
                                  <span className="text-[10px] text-gray-400 font-medium">休</span>
                                ) : entry ? (
                                  <div className={`w-full h-full rounded-md flex flex-col items-center justify-center px-0.5 ${
                                    entry.status === "approved"
                                      ? patColor ? patColor.bg : "bg-emerald-100"
                                      : "bg-white border-2 border-dashed " + (patColor ? patColor.border : "border-amber-300")
                                  }`}>
                                    {pat ? (
                                      <>
                                        <span className={`text-[11px] font-bold leading-tight ${isWeek ? "text-xs" : ""} ${patColor?.text ?? "text-gray-700"}`}>{pat.name}</span>
                                        {isWeek && <span className={`text-[9px] leading-tight ${patColor?.text ?? "text-gray-500"} opacity-70`}>{pat.startTime.slice(0,5)}-{pat.endTime.slice(0,5)}</span>}
                                      </>
                                    ) : (
                                      <span className="text-[10px] font-bold text-gray-600">出勤</span>
                                    )}
                                    {entry.status === "requested" && (
                                      <span className="text-[8px] text-amber-600 font-bold leading-none">申請</span>
                                    )}
                                  </div>
                                ) : (
                                  <Plus className={`mx-auto text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity ${isWeek ? "w-5 h-5" : "w-3 h-3"}`} />
                                )}
                                {hasAppts && entry && (
                                  <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-blue-500 rounded-full" title="予約あり" />
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="p-2 print:hidden" align="center" side="bottom"
                              style={{ width: entry ? "auto" : `${Math.max(activePatterns.length * 56 + 16, 120)}px`, minWidth: 120 }}>
                              <CellActions
                                staffName={staff.name}
                                date={ds}
                                entry={entry}
                                cellShifts={cellShifts}
                                patterns={activePatterns}
                                patternMap={patternMap}
                                patternColorMap={patternColorMap}
                                onQuickAssign={(pid) => quickAssign(staff.id, ds, pid)}
                                onApprove={id => { updateMut.mutate({ id, status: "approved" }); setOpenCell(null); }}
                                onReject={id => { updateMut.mutate({ id, status: "rejected" }); setOpenCell(null); }}
                                onDelete={s => { handleDelete(s); setOpenCell(null); }}
                                isAdding={createMut.isPending}
                                apptCount={apptCounts[`${staff.id}|${ds}`] || 0}
                                isHoliday={isHol}
                                holidayName={holidayNames[ds]}
                              />
                            </PopoverContent>
                          </Popover>
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 bg-white border-b border-l px-2 py-1 text-center">
                      <div className="text-xs font-bold">{summary.approved}<span className="text-[10px] text-muted-foreground font-normal">日</span></div>
                      {summary.hours > 0 && <div className="text-[10px] text-muted-foreground">{summary.hours.toFixed(0)}h</div>}
                      {summary.requested > 0 && <div className="text-[10px] text-amber-600 font-semibold">+{summary.requested}申請</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showPatternDlg} onOpenChange={setShowPatternDlg}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Clock className="w-4 h-4" />シフトパターン設定</DialogTitle></DialogHeader>
          <PatternManager />
        </DialogContent>
      </Dialog>
      <Dialog open={showMinStaffDlg} onOpenChange={setShowMinStaffDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Users className="w-4 h-4" />最低必要人数</DialogTitle></DialogHeader>
          <MinStaffDlg current={minStaff} onSave={c => { setMinStaff(c); localStorage.setItem("shift-min-staff", JSON.stringify(c)); setShowMinStaffDlg(false); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CellActions({
  staffName, date, entry, cellShifts, patterns, patternMap, patternColorMap,
  onQuickAssign, onApprove, onReject, onDelete, isAdding, apptCount, isHoliday, holidayName,
}: {
  staffName: string; date: string; entry: ShiftEntry | undefined; cellShifts: ShiftEntry[];
  patterns: ShiftPattern[]; patternMap: Record<string, ShiftPattern>;
  patternColorMap: Record<string, typeof PATTERN_PALETTE[0]>;
  onQuickAssign: (pid: string) => void; onApprove: (id: string) => void;
  onReject: (id: string) => void; onDelete: (s: ShiftEntry) => void;
  isAdding: boolean; apptCount: number; isHoliday: boolean; holidayName?: string;
}) {
  const dateLabel = format(parseISO(date), "M/d(E)", { locale: ja });

  if (!entry) {
    return (
      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5">{staffName} — {dateLabel}</p>
        {isHoliday && <p className="text-[9px] text-red-500 mb-1">{holidayName || "休診日"}</p>}
        {patterns.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {patterns.map(p => {
              const c = patternColorMap[p.id];
              return (
                <button key={p.id} onClick={() => onQuickAssign(p.id)} disabled={isAdding}
                  className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg border transition-colors hover:shadow-sm ${c?.bg ?? "bg-gray-100"} ${c?.border ?? "border-gray-200"}`}
                  data-testid={`quick-assign-${p.id}`}>
                  <span className={`text-xs font-bold ${c?.text ?? "text-gray-700"}`}>{p.name}</span>
                  <span className="text-[9px] text-muted-foreground">{p.startTime.slice(0,5)}-{p.endTime.slice(0,5)}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <Button size="sm" className="w-full h-7 text-xs" onClick={() => onQuickAssign("")} disabled={isAdding}>
            <Plus className="w-3 h-3 mr-1" />出勤を追加
          </Button>
        )}
      </div>
    );
  }

  const pat = entry.patternId ? patternMap[entry.patternId] : null;
  const c = entry.patternId ? patternColorMap[entry.patternId] : null;

  return (
    <div className="space-y-2 min-w-[140px]">
      <p className="text-[10px] text-muted-foreground">{staffName} — {dateLabel}</p>
      {apptCount > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-blue-600"><Stethoscope className="w-3 h-3" />予約{apptCount}件</div>
      )}
      <div className={`rounded-lg px-3 py-2 ${entry.status === "approved" ? c?.bg ?? "bg-emerald-100" : "bg-amber-50 border border-amber-200"}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className={`text-xs font-bold ${entry.status === "approved" ? c?.text ?? "text-emerald-700" : "text-amber-700"}`}>
              {entry.status === "approved" ? "承認済" : "申請中"}
            </span>
            {pat && <span className="text-[10px] text-muted-foreground ml-1.5">{pat.name} {pat.startTime.slice(0,5)}-{pat.endTime.slice(0,5)}</span>}
          </div>
        </div>
        {entry.notes && <p className="text-[9px] text-muted-foreground mt-1">{entry.notes}</p>}
      </div>
      <div className="flex gap-1">
        {entry.status === "requested" && (
          <>
            <Button size="sm" className="h-7 flex-1 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => onApprove(entry.id)}
              data-testid={`approve-${entry.id}`}><CheckCircle className="w-3 h-3 mr-0.5" />承認</Button>
            <Button size="sm" variant="outline" className="h-7 flex-1 text-xs text-red-600 border-red-300" onClick={() => onReject(entry.id)}
              data-testid={`reject-${entry.id}`}><XCircle className="w-3 h-3 mr-0.5" />却下</Button>
          </>
        )}
        <Button size="sm" variant="ghost" className="h-7 px-2 text-gray-400 hover:text-red-500" onClick={() => onDelete(entry)}
          data-testid={`delete-${entry.id}`}><Trash2 className="w-3 h-3" /></Button>
      </div>
    </div>
  );
}

function MinStaffDlg({ current, onSave }: { current: { doctor: number; hygienist: number }; onSave: (v: { doctor: number; hygienist: number }) => void }) {
  const [d, setD] = useState(current.doctor);
  const [h, setH] = useState(current.hygienist);
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">平日に最低限必要な人数。不足日は赤くハイライトされます。</p>
      <div className="flex gap-4">
        <div className="flex-1"><Label className="text-xs mb-1 block">ドクター</Label><Input type="number" min={0} max={10} value={d} onChange={e => setD(Number(e.target.value))} className="h-9" data-testid="input-min-doctor" /></div>
        <div className="flex-1"><Label className="text-xs mb-1 block">衛生士</Label><Input type="number" min={0} max={10} value={h} onChange={e => setH(Number(e.target.value))} className="h-9" data-testid="input-min-hygienist" /></div>
      </div>
      <Button className="w-full" onClick={() => onSave({ doctor: d, hygienist: h })} data-testid="button-save-min-staff">保存</Button>
    </div>
  );
}

function PatternManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", startTime: "09:00", endTime: "13:00" });
  const { data: patterns = [], isLoading } = useQuery<ShiftPattern[]>({ queryKey: ["/api/shift-patterns"] });
  const createMut = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/shift-patterns", data).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shift-patterns"] }); setForm({ name: "", startTime: "09:00", endTime: "13:00" }); toast({ title: "追加しました" }); },
  });
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PUT", `/api/shift-patterns/${id}`, { isActive }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/shift-patterns"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shift-patterns/${id}`).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/shift-patterns"] }); toast({ title: "削除しました" }); },
  });

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">スタッフがシフト申請時に選択できる時間帯パターン</p>
      {isLoading ? <Skeleton className="h-20" /> : patterns.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg border-dashed">パターン未登録</div>
      ) : (
        <div className="space-y-2">
          {patterns.map((p, i) => {
            const c = PATTERN_PALETTE[i % PATTERN_PALETTE.length];
            return (
              <div key={p.id} className={`flex items-center justify-between rounded-lg border px-3 py-2.5 ${p.isActive === false ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-8 rounded-sm ${c.bar}`} />
                  <div>
                    <p className="text-sm font-bold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.startTime.slice(0,5)} 〜 {p.endTime.slice(0,5)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch checked={p.isActive ?? true} onCheckedChange={v => toggleMut.mutate({ id: p.id, isActive: v })} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600"
                    onClick={() => deleteMut.mutate(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="border-t pt-3 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground">新しいパターン</p>
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[80px]">
            <Label className="text-xs mb-1 block">名前</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例：午前" className="h-8 text-sm" data-testid="dialog-pattern-name" />
          </div>
          <div><Label className="text-xs mb-1 block">開始</Label><Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="h-8 text-sm w-24" data-testid="dialog-pattern-start" /></div>
          <div><Label className="text-xs mb-1 block">終了</Label><Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="h-8 text-sm w-24" data-testid="dialog-pattern-end" /></div>
          <Button size="sm" onClick={() => createMut.mutate(form)} disabled={!form.name || createMut.isPending} data-testid="dialog-add-pattern">
            <Plus className="w-3.5 h-3.5 mr-1" />追加
          </Button>
        </div>
      </div>
    </div>
  );
}
