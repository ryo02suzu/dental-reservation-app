import { useState, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useClinicAddons } from "@/hooks/use-clinic-addons";
import { usePlan } from "@/hooks/use-plan";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, X, Copy, Check, RefreshCw, Calendar, Smartphone, Download, QrCode, Lock, GripVertical, CheckCircle, XCircle, Clock } from "lucide-react";
import { format, parseISO, addMonths, subMonths, startOfMonth } from "date-fns";
import { ja } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";

interface Clinic { id: string; name: string; slug?: string | null; phone?: string; email?: string; address?: string; description?: string }
interface Staff { id: string; name: string; role: string; jobTitle?: string | null; employmentType?: string | null; showInCalendar?: boolean | null; email?: string; phone?: string; maxConcurrentAppointments?: number; loginToken?: string | null; hourlyRate?: number | null; pin?: string | null }
interface Service { id: string; name: string; description?: string; duration: number; price: number; category?: string; isActive: boolean; staffRole?: string }
interface BusinessHours { id?: string; dayOfWeek: number; openTime?: string; closeTime?: string; afternoonOpenTime?: string; afternoonCloseTime?: string; isClosed: boolean }
interface Holiday { id: string; date: string; name?: string; reason?: string }
interface ClinicSettings {
  chairsCount: number; bookingAdvanceDays: number; bookingBufferMinutes: number;
  slotIntervalMinutes: number; maxConcurrentAppointments: number;
  allowDoubleBooking: boolean; enablePatientConfirmation: boolean; confirmationDeadlineHours: number; enableQrCheckin: boolean;
  requireAppointmentApproval?: boolean;
  closedOnHolidays?: boolean;
  enableReferral?: boolean;
  primaryColor?: string;
}

interface PlanInfo {
  planType: string;
  limits: { maxStaff: number; maxMonthlyAppointments: number; canExport: boolean; canLine: boolean; canRecall: boolean; canReport: boolean; label: string; price: string };
  usage: { staffCount: number; monthlyAppointments: number };
}

function NumericSelectOrCustom({
  value, onChange, options, unit, min = 0, testId,
}: {
  value: number; onChange: (v: number) => void; options: number[];
  unit?: string; min?: number; testId?: string;
}) {
  const inPreset = options.includes(value);
  const [showCustom, setShowCustom] = useState(!inPreset);

  const handleSelect = (v: string) => {
    if (v === "__custom__") {
      setShowCustom(true);
    } else {
      setShowCustom(false);
      onChange(parseInt(v));
    }
  };

  return (
    <div className="space-y-2">
      <Select value={showCustom ? "__custom__" : String(value)} onValueChange={handleSelect}>
        <SelectTrigger data-testid={testId}>
          <SelectValue>
            {showCustom ? `カスタム: ${value}${unit ?? ""}` : `${value}${unit ?? ""}`}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o} value={String(o)}>{o}{unit ?? ""}</SelectItem>
          ))}
          <SelectItem value="__custom__">カスタム入力...</SelectItem>
        </SelectContent>
      </Select>
      {showCustom && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={min}
            value={value}
            onChange={e => onChange(parseInt(e.target.value) || min)}
            className="w-28"
            autoFocus
          />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      )}
    </div>
  );
}

interface ReminderSettings {
  enableEmail: boolean;
  enableSms: boolean;
  enableLine: boolean;
  reminderHoursBefore: number;
  lineChannelAccessToken?: string;
  lineChannelSecret?: string;
  autoReminderEnabled?: boolean;
  reminderSendTime?: string;
}

const DAY_NAMES = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

export function SettingsView() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background">
        <h1 className="text-2xl font-bold tracking-tight">設定</h1>
      </div>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="clinic">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="clinic">クリニック情報</TabsTrigger>
            <TabsTrigger value="staff">スタッフ</TabsTrigger>
            <TabsTrigger value="services">診療メニュー</TabsTrigger>
            <TabsTrigger value="hours">診療時間</TabsTrigger>
            <TabsTrigger value="holidays">休診日</TabsTrigger>
            <TabsTrigger value="general">一般設定</TabsTrigger>
            <TabsTrigger value="reminders">リマインダー</TabsTrigger>
            <TabsTrigger value="calendar">カレンダー連携</TabsTrigger>
            <TabsTrigger value="export">データエクスポート</TabsTrigger>
            <TabsTrigger value="account">アカウント</TabsTrigger>
          </TabsList>
          <TabsContent value="clinic"><ClinicTab /></TabsContent>
          <TabsContent value="staff"><StaffTab /></TabsContent>
          <TabsContent value="services"><ServicesTab /></TabsContent>
          <TabsContent value="hours"><HoursTab /></TabsContent>
          <TabsContent value="holidays"><HolidaysTab /></TabsContent>
          <TabsContent value="general"><GeneralTab /></TabsContent>
          <TabsContent value="reminders"><ReminderTab /></TabsContent>
          <TabsContent value="calendar"><CalendarIntegrationTab /></TabsContent>
          <TabsContent value="export"><ExportTab /></TabsContent>
          <TabsContent value="account"><AccountTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Export Tab ─────────────────────────────────────────────────────────────
function ExportTab() {
  const { canExport } = usePlan();

  const handleExportPatients = () => {
    window.open("/api/export/patients.csv", "_blank");
  };

  const handleExportAppointments = () => {
    window.open("/api/export/appointments.csv", "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>データエクスポート</CardTitle>
        <CardDescription>
          登録されているデータをCSV形式でダウンロードします。
          Excelなどの表計算ソフトで開くことができます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!canExport && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800" data-testid="export-plan-locked">
            <Lock className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">スターター以上のプランで利用できます</p>
              <p className="text-xs mt-0.5">データエクスポート機能をご利用いただくには、スタータープランへのアップグレードが必要です。</p>
            </div>
          </div>
        )}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-medium text-sm">患者データ</h3>
            <p className="text-sm text-muted-foreground">全ての患者情報（氏名、連絡先、備考など）をエクスポートします。</p>
          </div>
          <Button onClick={handleExportPatients} disabled={!canExport} data-testid="button-export-patients">
            CSVをダウンロード
          </Button>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <h3 className="font-medium text-sm">予約データ</h3>
            <p className="text-sm text-muted-foreground">全ての予約履歴（日付、患者名、ステータスなど）をエクスポートします。</p>
          </div>
          <Button onClick={handleExportAppointments} disabled={!canExport} data-testid="button-export-appointments">
            CSVをダウンロード
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Clinic Tab ──────────────────────────────────────────────────────────────
function ClinicTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: clinic, isLoading } = useQuery<Clinic>({ queryKey: ["/api/clinic"] });
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", description: "" });
  const [loaded, setLoaded] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const bookingUrl = clinic?.slug
    ? `${window.location.origin}/book/${clinic.slug}`
    : `${window.location.origin}/booking`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
  };

  if (clinic && !loaded) {
    setForm({ name: clinic.name || "", phone: clinic.phone || "", email: clinic.email || "", address: clinic.address || "", description: clinic.description || "" });
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("PUT", "/api/clinic", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clinic"] }); toast({ title: "クリニック情報を保存しました" }); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader><CardTitle>クリニック情報</CardTitle><CardDescription>クリニックの基本情報を設定します</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64" /> : (
          <div className="space-y-4 max-w-lg">
            <div>
              <Label className="mb-1.5 block">クリニック名</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} data-testid="input-clinic-name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">電話番号</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1.5 block">メール</Label>
                <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block">住所</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">クリニック紹介</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground block">患者向け予約ページURL</Label>
              <div className="flex gap-2">
                <Input
                  value={bookingUrl}
                  readOnly
                  className="font-mono text-xs bg-background"
                  data-testid="input-booking-url-clinic"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <Button variant="outline" size="icon" onClick={handleCopyUrl} data-testid="button-copy-booking-url-clinic">
                  {urlCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">このURLを患者さんに共有すると、オンライン予約ができます。</p>
            </div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-clinic">
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Shift Admin Card ─────────────────────────────────────────────────────────

interface ShiftEntry {
  id: string;
  staffId: string;
  patternId?: string | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  status: "requested" | "approved" | "rejected";
  notes?: string | null;
  staff?: { id: string; name: string };
}

interface ShiftPattern {
  id: string;
  clinicId: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean | null;
  sortOrder: number | null;
}

const SHIFT_STATUS_CFG = {
  requested: { label: "申請中", variant: "secondary" as const, icon: Clock },
  approved:  { label: "承認済", variant: "default"   as const, icon: CheckCircle },
  rejected:  { label: "却下",   variant: "destructive" as const, icon: XCircle },
};

function ShiftAdminCard({ staff }: { staff: Staff[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [monthBase, setMonthBase] = useState(() => startOfMonth(new Date()));
  const [filterStatus, setFilterStatus] = useState<"all" | "requested">("requested");

  const monthStr = format(monthBase, "yyyy-MM");
  const qKey = ["/api/shifts", monthStr];

  const { data: shifts = [], isLoading } = useQuery<ShiftEntry[]>({
    queryKey: qKey,
    queryFn: () => fetch(`/api/shifts?month=${monthStr}`).then(r => r.json()),
  });

  const { data: patterns = [] } = useQuery<ShiftPattern[]>({
    queryKey: ["/api/shift-patterns"],
    queryFn: () => fetch("/api/shift-patterns").then(r => r.json()),
  });
  const patternMap = Object.fromEntries(patterns.map(p => [p.id, p]));

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PUT", `/api/shifts/${id}`, { status }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey });
      toast({ title: "シフトを更新しました" });
    },
    onError: () => toast({ title: "エラー", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shifts/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qKey });
      toast({ title: "削除しました" });
    },
  });

  const staffMap = Object.fromEntries(staff.map(s => [s.id, s]));

  const filtered = filterStatus === "all" ? shifts : shifts.filter(s => s.status === filterStatus);
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

  // Group by date
  const byDate: Record<string, ShiftEntry[]> = {};
  for (const s of sorted) {
    if (!byDate[s.date]) byDate[s.date] = [];
    byDate[s.date].push(s);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Calendar className="w-4 h-4" />シフト管理</CardTitle>
          <CardDescription>スタッフからのシフト希望を確認・承認できます</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthBase(d => subMonths(d, 1))} className="p-1 rounded hover:bg-muted">
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
          <span className="text-sm font-semibold min-w-[80px] text-center">{format(monthBase, "yyyy年M月", { locale: ja })}</span>
          <button onClick={() => setMonthBase(d => addMonths(d, 1))} className="p-1 rounded hover:bg-muted">
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-1 mb-4">
          {(["requested", "all"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
              {s === "requested" ? `申請中 (${shifts.filter(x => x.status === "requested").length})` : "すべて"}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
            {filterStatus === "requested" ? "申請中のシフトはありません" : "この月のシフトデータはありません"}
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byDate).map(([date, entries]) => (
              <div key={date}>
                <p className="text-xs font-bold text-muted-foreground mb-1.5">
                  {format(parseISO(date), "M月d日（E）", { locale: ja })}
                </p>
                <div className="space-y-1.5">
                  {entries.map(entry => {
                    const s = staffMap[entry.staffId];
                    const cfg = SHIFT_STATUS_CFG[entry.status];
                    const pat = entry.patternId ? patternMap[entry.patternId] : null;
                    const timeLabel = pat
                      ? `${pat.name}（${pat.startTime.slice(0,5)}〜${pat.endTime.slice(0,5)}）`
                      : (entry.startTime ? `${entry.startTime.slice(0,5)}〜${entry.endTime?.slice(0,5) ?? ""}` : null);
                    return (
                      <div key={entry.id} className="flex items-center justify-between rounded-lg border px-3 py-2 bg-card">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium">{s?.name ?? "不明"}</p>
                            {timeLabel && <p className="text-xs text-muted-foreground font-medium">{timeLabel}</p>}
                            {entry.notes && <p className="text-xs text-muted-foreground">{entry.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                          {entry.status === "requested" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-300 hover:bg-green-50"
                                onClick={() => updateMut.mutate({ id: entry.id, status: "approved" })}
                                disabled={updateMut.isPending}
                                data-testid={`button-approve-shift-${entry.id}`}>
                                <CheckCircle className="w-3 h-3 mr-1" />承認
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
                                onClick={() => updateMut.mutate({ id: entry.id, status: "rejected" })}
                                disabled={updateMut.isPending}
                                data-testid={`button-reject-shift-${entry.id}`}>
                                <XCircle className="w-3 h-3 mr-1" />却下
                              </Button>
                            </>
                          )}
                          {entry.status !== "requested" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                              onClick={() => deleteMut.mutate(entry.id)}
                              disabled={deleteMut.isPending}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Shift Pattern Card ───────────────────────────────────────────────────────
function ShiftPatternCard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", startTime: "09:00", endTime: "13:00" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", startTime: "", endTime: "" });

  const { data: patterns = [], isLoading } = useQuery<ShiftPattern[]>({
    queryKey: ["/api/shift-patterns"],
    queryFn: () => fetch("/api/shift-patterns").then(r => r.json()),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/shift-patterns", data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shift-patterns"] });
      setForm({ name: "", startTime: "09:00", endTime: "13:00" });
      toast({ title: "シフトパターンを追加しました" });
    },
    onError: () => toast({ title: "エラーが発生しました", variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; startTime: string; endTime: string }) =>
      apiRequest("PUT", `/api/shift-patterns/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shift-patterns"] });
      setEditId(null);
      toast({ title: "更新しました" });
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiRequest("PUT", `/api/shift-patterns/${id}`, { isActive }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/shift-patterns"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/shift-patterns/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/shift-patterns"] });
      toast({ title: "削除しました" });
    },
  });

  function startEdit(p: ShiftPattern) {
    setEditId(p.id);
    setEditForm({ name: p.name, startTime: p.startTime.slice(0, 5), endTime: p.endTime.slice(0, 5) });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Clock className="w-4 h-4" />シフトパターン設定</CardTitle>
        <CardDescription>スタッフがシフト申請時に選択できる時間帯を定義します（例：午前、午後、全日）</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12" />)}</div>
        ) : patterns.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
            <Clock className="w-7 h-7 mx-auto mb-2 opacity-30" />
            まだパターンがありません。下から追加してください。
          </div>
        ) : (
          <div className="space-y-2">
            {patterns.map(p => (
              <div key={p.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${p.isActive === false ? "opacity-50" : ""}`}>
                {editId === p.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      className="h-7 w-24 text-sm" placeholder="名前" data-testid="input-pattern-edit-name" />
                    <Input type="time" value={editForm.startTime} onChange={e => setEditForm(f => ({ ...f, startTime: e.target.value }))}
                      className="h-7 w-28 text-sm" data-testid="input-pattern-edit-start" />
                    <span className="text-xs text-muted-foreground">〜</span>
                    <Input type="time" value={editForm.endTime} onChange={e => setEditForm(f => ({ ...f, endTime: e.target.value }))}
                      className="h-7 w-28 text-sm" data-testid="input-pattern-edit-end" />
                    <Button size="sm" className="h-7 px-2 text-xs" onClick={() => updateMut.mutate({ id: p.id, ...editForm })} disabled={!editForm.name || updateMut.isPending}>保存</Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditId(null)}>キャンセル</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.startTime.slice(0,5)} 〜 {p.endTime.slice(0,5)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={p.isActive ?? true}
                        onCheckedChange={v => toggleMut.mutate({ id: p.id, isActive: v })}
                        data-testid={`toggle-pattern-active-${p.id}`} />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        onClick={() => startEdit(p)} data-testid={`button-edit-pattern-${p.id}`}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600"
                        onClick={() => deleteMut.mutate(p.id)} disabled={deleteMut.isPending}
                        data-testid={`button-delete-pattern-${p.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add new pattern form */}
        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3">新しいパターンを追加</p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="flex-1 min-w-[100px]">
              <Label className="text-xs mb-1 block">パターン名</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例：午前" className="h-8 text-sm" data-testid="input-new-pattern-name" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">開始</Label>
              <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="h-8 text-sm w-28" data-testid="input-new-pattern-start" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">終了</Label>
              <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="h-8 text-sm w-28" data-testid="input-new-pattern-end" />
            </div>
            <Button size="sm" onClick={() => createMut.mutate(form)} disabled={!form.name || createMut.isPending}
              data-testid="button-add-pattern">
              <Plus className="w-3.5 h-3.5 mr-1" />追加
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Shift Management Tab ─────────────────────────────────────────────────────
function ShiftManagementTab() {
  const { data: staff = [] } = useQuery<Staff[]>({
    queryKey: ["/api/staff"],
    queryFn: () => fetch("/api/staff").then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      <ShiftPatternCard />
      <ShiftAdminCard staff={staff} />
    </div>
  );
}

// ─── Sortable Staff Row ──────────────────────────────────────────────────────
function SortableStaffRow({
  s,
  onEdit,
  onQr,
  onDelete,
}: {
  s: Staff;
  onEdit: (s: Staff) => void;
  onQr: (s: Staff) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? "bg-muted shadow-lg" : ""}>
      <TableCell className="w-8 px-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none p-1 rounded"
          data-testid={`drag-handle-${s.id}`}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{s.name}{s.jobTitle && <span className="ml-1.5 text-xs text-muted-foreground font-normal">（{s.jobTitle}）</span>}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span>{s.role === "doctor" ? "歯科医師" : s.role === "hygienist" ? "衛生士" : "助手"}</span>
          <span className={`text-xs font-medium ${s.employmentType === "parttime" ? "text-amber-600" : s.employmentType === "contract" ? "text-blue-600" : "text-muted-foreground"}`}>
            {s.employmentType === "parttime" ? "非常勤" : s.employmentType === "contract" ? "契約" : "常勤"}
          </span>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.email || s.phone || "—"}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => onQr(s)} data-testid={`button-qr-${s.id}`}>
            <QrCode className="h-3 w-3" />QR
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─── Staff Tab ──────────────────────────────────────────────────────────────
function StaffTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: serverStaff = [], isLoading } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  const [localStaff, setLocalStaff] = useState<Staff[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState({ name: "", role: "doctor", jobTitle: "", employmentType: "fulltime", showInCalendar: true, email: "", phone: "", maxConcurrentAppointments: 1, hourlyRate: "" as string | number, pin: "" });
  const [qrStaff, setQrStaff] = useState<Staff | null>(null);
  const [copied, setCopied] = useState(false);

  // サーバーからデータが来たらローカル状態を更新
  useEffect(() => { setLocalStaff(serverStaff); }, [serverStaff]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const payload = { ...data, hourlyRate: data.hourlyRate === "" ? null : Number(data.hourlyRate), pin: data.pin || null };
      return editingStaff
        ? apiRequest("PUT", `/api/staff/${editingStaff.id}`, payload)
        : apiRequest("POST", "/api/staff", payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/staff"] }); toast({ title: "保存しました" }); setIsDialogOpen(false); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/staff/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/staff"] }); toast({ title: "削除しました" }); },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => apiRequest("POST", "/api/staff/reorder", { orderedIds }),
    onError: () => { setLocalStaff(serverStaff); toast({ title: "並び替えに失敗しました", variant: "destructive" }); },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localStaff.findIndex(s => s.id === active.id);
    const newIndex = localStaff.findIndex(s => s.id === over.id);
    const newOrder = arrayMove(localStaff, oldIndex, newIndex);
    setLocalStaff(newOrder);
    reorderMutation.mutate(newOrder.map(s => s.id));
  };

  const generateTokenMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/staff/${id}/generate-token`).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/staff"] });
      setQrStaff(prev => prev ? { ...prev, loginToken: data.token } : prev);
      toast({ title: "QRコードを発行しました" });
    },
    onError: () => toast({ title: "エラー", description: "発行に失敗しました", variant: "destructive" }),
  });

  const openEdit = (s: Staff) => {
    setEditingStaff(s);
    setForm({ name: s.name, role: s.role, jobTitle: s.jobTitle || "", employmentType: s.employmentType || "fulltime", showInCalendar: s.showInCalendar !== false, email: s.email || "", phone: s.phone || "", maxConcurrentAppointments: s.maxConcurrentAppointments || 1, hourlyRate: s.hourlyRate || "", pin: s.pin || "" });
    setIsDialogOpen(true);
  };

  const openQr = (s: Staff) => setQrStaff(s);

  const staffLoginUrl = qrStaff?.loginToken
    ? `${window.location.origin}/staff-login/${qrStaff.loginToken}`
    : null;

  const copyUrl = () => {
    if (!staffLoginUrl) return;
    navigator.clipboard.writeText(staffLoginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (id: string) => {
    if (confirm("削除しますか？")) deleteMutation.mutate(id);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>スタッフ管理</CardTitle>
            <CardDescription>行をつかんでドラッグすると並び替えできます</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setEditingStaff(null); setForm({ name: "", role: "doctor", jobTitle: "", employmentType: "fulltime", showInCalendar: true, email: "", phone: "", maxConcurrentAppointments: 1, hourlyRate: "", pin: "" }); setIsDialogOpen(true); }} data-testid="button-add-staff">
            <Plus className="h-4 w-4 mr-1" />追加
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={localStaff.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>氏名</TableHead>
                      <TableHead>役職</TableHead>
                      <TableHead className="hidden md:table-cell">連絡先</TableHead>
                      <TableHead className="w-36">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localStaff.map(s => (
                      <SortableStaffRow key={s.id} s={s} onEdit={openEdit} onQr={openQr} onDelete={handleDelete} />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* スタッフ編集ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={v => !v && setIsDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingStaff ? "スタッフ編集" : "スタッフ追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="mb-1.5 block">氏名 *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="山田 花子" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5 block">役職区分</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="doctor">歯科医師</SelectItem><SelectItem value="hygienist">歯科衛生士</SelectItem><SelectItem value="assistant">歯科助手</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="mb-1.5 block">雇用形態</Label>
                <Select value={form.employmentType} onValueChange={v => setForm(p => ({ ...p, employmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fulltime">常勤</SelectItem>
                    <SelectItem value="parttime">非常勤</SelectItem>
                    <SelectItem value="contract">契約</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="mb-1.5 block">肩書き（任意）</Label>
              <Input value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} placeholder="例: 院長、主任衛生士" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5 block">メール</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><Label className="mb-1.5 block">電話</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="mb-1.5 block">同時対応人数</Label>
                <Select value={String(form.maxConcurrentAppointments)} onValueChange={v => setForm(p => ({ ...p, maxConcurrentAppointments: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1人</SelectItem><SelectItem value="2">2人</SelectItem>
                    <SelectItem value="3">3人</SelectItem><SelectItem value="4">4人</SelectItem><SelectItem value="5">5人</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="mb-1.5 block">時給（円）</Label>
                <Input type="number" value={form.hourlyRate} onChange={e => setForm(p => ({ ...p, hourlyRate: e.target.value ? parseInt(e.target.value) : "" }))} placeholder="1200" data-testid="input-hourly-rate" />
              </div>
              <div><Label className="mb-1.5 block">打刻PIN（4桁）</Label>
                <Input type="text" inputMode="numeric" maxLength={4} value={form.pin} onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setForm(p => ({ ...p, pin: v })); }} placeholder="1234" data-testid="input-pin" />
                <p className="text-[10px] text-gray-400 mt-1">QR出勤時の本人確認用</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">カレンダーに表示</p>
                <p className="text-xs text-muted-foreground">オフにすると予約カレンダーの列から除外されます</p>
              </div>
              <Switch checked={form.showInCalendar} onCheckedChange={v => setForm(p => ({ ...p, showInCalendar: v }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending}>{saveMutation.isPending ? "保存中..." : "保存"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QRコードダイアログ */}
      <Dialog open={!!qrStaff} onOpenChange={v => !v && setQrStaff(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              {qrStaff?.name}さんのスマホ用QR
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {staffLoginUrl ? (
              <>
                <div className="flex justify-center py-2">
                  <div className="p-4 bg-white border-2 border-gray-200 rounded-xl shadow-inner">
                    <QRCodeSVG value={staffLoginUrl} size={180} level="M" />
                  </div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
                  <p className="font-medium mb-0.5">使い方</p>
                  <ol className="text-xs space-y-0.5 text-green-700 list-decimal list-inside">
                    <li>スタッフのスマホでQRコードを読み取る</li>
                    <li>自動でログインされて予約一覧が開く</li>
                    <li>「ホーム画面に追加」でアプリ化できる</li>
                  </ol>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={copyUrl}>
                    {copied ? <Check className="w-3 h-3 mr-1 text-green-500" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copied ? "コピー済み" : "URLをコピー"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={() => qrStaff && generateTokenMutation.mutate(qrStaff.id)}
                    disabled={generateTokenMutation.isPending}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    再発行
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  再発行すると古いQRコードは無効になります
                </p>
              </>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                  <QrCode className="w-8 h-8 text-gray-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-700">QRコードが未発行です</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ボタンを押してQRコードを発行してください
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => qrStaff && generateTokenMutation.mutate(qrStaff.id)}
                  disabled={generateTokenMutation.isPending}
                  data-testid="button-generate-qr"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  {generateTokenMutation.isPending ? "発行中..." : "QRコードを発行する"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Service Templates ───────────────────────────────────────────────────────
const BUILTIN_TEMPLATES: ServiceTemplate[] = [
  { name: "定期検診", duration: 60, category: "予防", description: "歯の定期健診・クリーニング" },
  { name: "クリーニング", duration: 45, category: "予防", description: "専門的な歯のクリーニング" },
  { name: "虫歯治療", duration: 60, category: "治療", description: "虫歯の診断・治療" },
  { name: "根管治療", duration: 90, category: "治療", description: "神経・根の治療" },
  { name: "抜歯", duration: 30, category: "外科", description: "歯の抜歯処置" },
  { name: "親知らず抜歯", duration: 60, category: "外科", description: "親知らずの抜歯処置" },
  { name: "矯正相談", duration: 30, category: "矯正", description: "歯列矯正の相談・診断" },
  { name: "マウスピース矯正", duration: 60, category: "矯正", description: "マウスピース型矯正装置" },
  { name: "インプラント相談", duration: 45, category: "インプラント", description: "インプラント治療の相談" },
  { name: "ホワイトニング", duration: 60, category: "審美", description: "歯のホワイトニング" },
  { name: "セラミック治療", duration: 90, category: "審美", description: "セラミッククラウン・インレー" },
  { name: "入れ歯（義歯）", duration: 60, category: "補綴", description: "部分・総義歯の製作・調整" },
  { name: "小児歯科", duration: 45, category: "小児", description: "子ども向け歯科治療" },
  { name: "フッ素塗布", duration: 30, category: "予防", description: "フッ素による虫歯予防" },
  { name: "歯周病治療", duration: 60, category: "治療", description: "歯周病の診断・治療" },
  { name: "初診", duration: 60, category: "検査", description: "初回診察・検査" },
  { name: "レントゲン撮影", duration: 15, category: "検査", description: "口内レントゲン撮影" },
];

const STORAGE_KEY = "arche_service_templates";

interface ServiceTemplate { name: string; duration: number; category: string; description?: string }

function useServiceTemplates() {
  const [custom, setCustom] = useState<ServiceTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });

  const saveCustom = (list: ServiceTemplate[]) => {
    setCustom(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const all = useMemo(() => {
    const names = new Set(BUILTIN_TEMPLATES.map(t => t.name));
    const uniqueCustom = custom.filter(c => !names.has(c.name));
    return [...BUILTIN_TEMPLATES, ...uniqueCustom];
  }, [custom]);

  const addCustom = (t: ServiceTemplate) => {
    if (all.some(x => x.name === t.name)) return;
    saveCustom([...custom, t]);
  };

  const removeCustom = (name: string) => {
    saveCustom(custom.filter(c => c.name !== name));
  };

  return { all, custom, addCustom, removeCustom };
}

// Combobox for service name
function ServiceNameCombobox({ value, onChange, templates }: {
  value: string;
  onChange: (name: string, template?: ServiceTemplate) => void;
  templates: ServiceTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setInputValue(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(t => t.name.toLowerCase().includes(q));
  }, [inputValue, templates]);

  return (
    <div ref={ref} className="relative">
      <div className="flex">
        <Input
          value={inputValue}
          onChange={e => { setInputValue(e.target.value); onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="メニュー名を入力または選択"
          className="rounded-r-none"
          data-testid="input-service-name"
        />
        <button
          type="button"
          className="border border-l-0 border-input rounded-r-md px-2 bg-background hover:bg-accent transition-colors"
          onClick={() => setOpen(v => !v)}
        >
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
      {open && (
        <div className="absolute z-50 w-full mt-1 border border-border rounded-md bg-popover shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">候補なし（そのまま入力できます）</div>
          ) : (
            filtered.map(t => (
              <button
                key={t.name}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between gap-2"
                onMouseDown={e => {
                  e.preventDefault();
                  setInputValue(t.name);
                  onChange(t.name, t);
                  setOpen(false);
                }}
              >
                <span className="text-sm font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">{t.duration}分 · {t.category}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Services Tab ────────────────────────────────────────────────────────────
function ServicesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: services = [], isLoading } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { all: allTemplates, custom: customTemplates, addCustom, removeCustom } = useServiceTemplates();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({ name: "", description: "", duration: 30, price: 0, category: "", isActive: true, staffRole: "any" });
  const [newTemplate, setNewTemplate] = useState({ name: "", duration: 30, category: "" });

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => editingService
      ? apiRequest("PUT", `/api/services/${editingService.id}`, data)
      : apiRequest("POST", "/api/services", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/services"] }); toast({ title: "保存しました" }); setIsDialogOpen(false); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/services/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/services"] }); toast({ title: "削除しました" }); },
  });

  const openCreate = () => {
    setEditingService(null);
    setForm({ name: "", description: "", duration: 30, price: 0, category: "", isActive: true, staffRole: "any" });
    setIsDialogOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setForm({ name: s.name, description: s.description || "", duration: s.duration, price: s.price || 0, category: s.category || "", isActive: s.isActive ?? true, staffRole: s.staffRole || "any" });
    setIsDialogOpen(true);
  };

  const handleNameChange = (name: string, template?: ServiceTemplate) => {
    if (template) {
      setForm(p => ({ ...p, name, duration: template.duration, category: template.category, description: template.description || p.description }));
    } else {
      setForm(p => ({ ...p, name }));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div><CardTitle>診療メニュー</CardTitle><CardDescription>提供するサービスの管理</CardDescription></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsTemplateDialogOpen(true)}>
              候補の管理
            </Button>
            <Button size="sm" onClick={openCreate} data-testid="button-add-service">
              <Plus className="h-4 w-4 mr-1" />追加
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : services.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              診療メニューが登録されていません。「追加」ボタンから登録してください。
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>メニュー名</TableHead>
                  <TableHead className="w-20">時間</TableHead>
                  <TableHead className="hidden md:table-cell">カテゴリ</TableHead>
                  <TableHead className="w-16">状態</TableHead>
                  <TableHead className="w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <div>{s.name}</div>
                      {s.staffRole && s.staffRole !== "any" && (
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${s.staffRole === "doctor" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                          {s.staffRole === "doctor" ? "Dr.のみ" : "衛生士のみ"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{s.duration}分</TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{s.category || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                        {s.isActive ? "有効" : "無効"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Edit2 className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={v => !v && setIsDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingService ? "メニュー編集" : "メニュー追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">メニュー名 <span className="text-red-500">*</span></Label>
              <ServiceNameCombobox
                value={form.name}
                onChange={handleNameChange}
                templates={allTemplates}
              />
              <p className="text-xs text-muted-foreground mt-1">候補から選ぶと所要時間が自動入力されます</p>
            </div>
            <div><Label className="mb-1.5 block">説明</Label><Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="メニューの説明" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">所要時間 (分)</Label>
                <Select value={String(form.duration)} onValueChange={v => setForm(p => ({ ...p, duration: parseInt(v) }))}>
                  <SelectTrigger data-testid="select-duration"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[10,15,20,30,45,60,75,90,120].map(d => (
                      <SelectItem key={d} value={String(d)}>{d}分</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">担当職種</Label>
                <Select value={form.staffRole} onValueChange={v => setForm(p => ({ ...p, staffRole: v }))}>
                  <SelectTrigger data-testid="select-staff-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">どちらでも</SelectItem>
                    <SelectItem value="doctor">歯科医師のみ</SelectItem>
                    <SelectItem value="hygienist">歯科衛生士のみ</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">予約時のスタッフ絞り込みに使用</p>
              </div>
            </div>
            <div><Label className="mb-1.5 block">カテゴリ</Label><Input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} placeholder="予防、治療、外科..." /></div>
            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(p => ({ ...p, isActive: v }))} id="service-active" />
              <Label htmlFor="service-active">有効にする</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} data-testid="button-save-service">
                {saveMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Template Management Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={v => !v && setIsTemplateDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>メニュー名候補の管理</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* Add new custom */}
            <div className="p-3 border border-border rounded-md bg-muted/20 space-y-3">
              <p className="text-sm font-medium">候補を追加</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="mb-1 block text-xs">メニュー名</Label>
                  <Input
                    value={newTemplate.name}
                    onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                    placeholder="例：スポーツマウスガード"
                    data-testid="input-new-template-name"
                  />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">デフォルト時間 (分)</Label>
                  <Select value={String(newTemplate.duration)} onValueChange={v => setNewTemplate(p => ({ ...p, duration: parseInt(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10,15,20,30,45,60,75,90,120].map(d => (
                        <SelectItem key={d} value={String(d)}>{d}分</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1 block text-xs">カテゴリ</Label>
                  <Input
                    value={newTemplate.category}
                    onChange={e => setNewTemplate(p => ({ ...p, category: e.target.value }))}
                    placeholder="予防、治療..."
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  if (!newTemplate.name.trim()) return;
                  addCustom({ ...newTemplate, name: newTemplate.name.trim() });
                  setNewTemplate({ name: "", duration: 30, category: "" });
                  toast({ title: "候補を追加しました" });
                }}
                disabled={!newTemplate.name.trim()}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />追加
              </Button>
            </div>

            {/* Custom candidates */}
            {customTemplates.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">追加した候補</p>
                <div className="space-y-1.5">
                  {customTemplates.map(t => (
                    <div key={t.name} className="flex items-center justify-between gap-2 px-3 py-2 border border-border rounded-md bg-card">
                      <div>
                        <span className="text-sm font-medium">{t.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{t.duration}分 · {t.category}</span>
                      </div>
                      <button
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        onClick={() => { removeCustom(t.name); toast({ title: "候補を削除しました" }); }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Built-in list (read-only) */}
            <div>
              <p className="text-sm font-medium mb-2 text-muted-foreground">標準候補（変更不可）</p>
              <div className="flex flex-wrap gap-1.5">
                {BUILTIN_TEMPLATES.map(t => (
                  <span key={t.name} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                    {t.name} · {t.duration}分
                  </span>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>閉じる</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Hours Tab helpers ───────────────────────────────────────────────────────
const HOUR_TIME_OPTIONS = Array.from({ length: 34 }, (_, i) => {
  const totalMins = 360 + i * 30;
  const h = Math.floor(totalMins / 60).toString().padStart(2, "0");
  const m = (totalMins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
});

function TimeSelect({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId?: string }) {
  return (
    <Select value={value.slice(0, 5)} onValueChange={onChange}>
      <SelectTrigger className="w-24 h-8 text-sm" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HOUR_TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ─── Hours Tab ───────────────────────────────────────────────────────────────
function HoursTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: hours = [], isLoading } = useQuery<BusinessHours[]>({ queryKey: ["/api/business-hours"] });
  const [localHours, setLocalHours] = useState<BusinessHours[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (hours.length > 0 && !loaded) {
    const h = Array.from({ length: 7 }, (_, i) => {
      const existing = hours.find(h => h.dayOfWeek === i);
      return existing || { dayOfWeek: i, openTime: "09:00", closeTime: "18:00", isClosed: false };
    });
    setLocalHours(h);
    setLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/business-hours", localHours),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business-hours"] }); toast({ title: "診療時間を保存しました" }); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const update = (dayOfWeek: number, field: string, value: any) => {
    setLocalHours(prev => prev.map(h => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h));
  };

  const toggleMorning = (dayOfWeek: number, enabled: boolean) => {
    setLocalHours(prev => prev.map(h => h.dayOfWeek === dayOfWeek
      ? { ...h, openTime: enabled ? "09:00" : null, closeTime: enabled ? "12:30" : null }
      : h
    ));
  };

  const toggleAfternoon = (dayOfWeek: number, enabled: boolean) => {
    setLocalHours(prev => prev.map(h => h.dayOfWeek === dayOfWeek
      ? { ...h, afternoonOpenTime: enabled ? "14:00" : null, afternoonCloseTime: enabled ? "18:00" : null }
      : h
    ));
  };

  const applyToWeekdays = (sourceDow: number) => {
    const source = localHours.find(h => h.dayOfWeek === sourceDow);
    if (!source) return;
    setLocalHours(prev => prev.map(h =>
      h.dayOfWeek >= 1 && h.dayOfWeek <= 5
        ? { ...h, openTime: source.openTime, closeTime: source.closeTime, afternoonOpenTime: source.afternoonOpenTime, afternoonCloseTime: source.afternoonCloseTime, isClosed: source.isClosed }
        : h
    ));
  };

  const COL = "40px 48px 1fr 1fr 32px";

  return (
    <Card>
      <CardHeader>
        <CardTitle>診療時間</CardTitle>
        <CardDescription>午前・午後それぞれのトグルで診療時間帯を設定できます。平日の複製はコピーアイコンから。</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pb-5">
        {isLoading ? <Skeleton className="mx-5 h-64" /> : (
          <div className="mx-5 rounded-xl border border-border overflow-hidden">
            {/* ヘッダー行 */}
            <div
              className="grid items-center gap-3 px-4 py-2.5 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground"
              style={{ gridTemplateColumns: COL }}
            >
              <span>曜日</span>
              <span>診療</span>
              <span className="flex items-center gap-1.5"><span className="w-8 shrink-0" />午前</span>
              <span className="flex items-center gap-1.5"><span className="w-8 shrink-0" />午後</span>
              <span />
            </div>

            {/* データ行 */}
            {localHours.map((h, idx) => (
              <div
                key={h.dayOfWeek}
                className={`grid items-center gap-3 px-4 py-3 transition-colors border-b last:border-0 border-border/60
                  ${h.isClosed ? "bg-muted/20" : "bg-card hover:bg-muted/10"}`}
                style={{ gridTemplateColumns: COL }}
              >
                {/* 曜日 */}
                <span className={`text-sm font-bold tabular-nums
                  ${h.dayOfWeek === 0 ? "text-red-500" : h.dayOfWeek === 6 ? "text-blue-500" : "text-foreground"}`}>
                  {DAY_NAMES[h.dayOfWeek]}
                </span>

                {/* 診療スイッチ */}
                <Switch
                  checked={!h.isClosed}
                  onCheckedChange={v => update(h.dayOfWeek, "isClosed", !v)}
                  data-testid={`switch-day-${h.dayOfWeek}`}
                />

                {/* 午前・午後 */}
                {h.isClosed ? (
                  <span className="text-xs text-muted-foreground/50 col-span-2 italic">休診日</span>
                ) : (
                  <>
                    {/* 午前 */}
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={!!h.openTime}
                        onCheckedChange={v => toggleMorning(h.dayOfWeek, v)}
                        data-testid={`switch-morning-${h.dayOfWeek}`}
                      />
                      {h.openTime ? (
                        <div className="flex items-center gap-1">
                          <TimeSelect value={h.openTime} onChange={v => update(h.dayOfWeek, "openTime", v)} testId={`select-open-${h.dayOfWeek}`} />
                          <span className="text-muted-foreground text-xs shrink-0">〜</span>
                          <TimeSelect value={h.closeTime || "12:30"} onChange={v => update(h.dayOfWeek, "closeTime", v)} testId={`select-close-${h.dayOfWeek}`} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">なし</span>
                      )}
                    </div>

                    {/* 午後 */}
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={!!h.afternoonOpenTime}
                        onCheckedChange={v => toggleAfternoon(h.dayOfWeek, v)}
                        data-testid={`switch-afternoon-${h.dayOfWeek}`}
                      />
                      {h.afternoonOpenTime ? (
                        <div className="flex items-center gap-1">
                          <TimeSelect value={h.afternoonOpenTime} onChange={v => update(h.dayOfWeek, "afternoonOpenTime", v)} testId={`select-af-open-${h.dayOfWeek}`} />
                          <span className="text-muted-foreground text-xs shrink-0">〜</span>
                          <TimeSelect value={h.afternoonCloseTime || "18:00"} onChange={v => update(h.dayOfWeek, "afternoonCloseTime", v)} testId={`select-af-close-${h.dayOfWeek}`} />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">なし</span>
                      )}
                    </div>
                  </>
                )}

                {/* 平日一括複製 */}
                {h.dayOfWeek >= 1 && h.dayOfWeek <= 5 ? (
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => applyToWeekdays(h.dayOfWeek)}
                          className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          data-testid={`button-apply-weekdays-${h.dayOfWeek}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">平日全てに適用</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : <span />}
              </div>
            ))}
          </div>
        )}
        <div className="px-5 pt-4">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} data-testid="button-save-hours">
            {saveMutation.isPending ? "保存中..." : "保存"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Holidays Tab ────────────────────────────────────────────────────────────
function HolidaysTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: holidays = [], isLoading } = useQuery<Holiday[]>({ queryKey: ["/api/holidays"] });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState({ date: "", name: "", reason: "" });
  const [importYear, setImportYear] = useState(new Date().getFullYear());

  const saveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/holidays", form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/holidays"] }); toast({ title: "休診日を追加しました" }); setIsDialogOpen(false); setForm({ date: "", name: "", reason: "" }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/holidays/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/holidays"] }); toast({ title: "削除しました" }); },
  });

  const importMutation = useMutation({
    mutationFn: async (year: number) => {
      const jpHolidays: { date: string; name: string; reason: string }[] = await (await fetch(`/api/holidays/japan/${year}`)).json();
      if (!Array.isArray(jpHolidays)) throw new Error("取得に失敗しました");
      const res = await apiRequest("POST", "/api/holidays/batch", { holidays: jpHolidays });
      const result: { inserted: number; total: number } = await res.json();
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/holidays"] });
      if (data.inserted === 0) {
        toast({ title: `${importYear}年の祝日は既に登録済みです` });
      } else {
        toast({ title: `${importYear}年の祝日を${data.inserted}件追加しました` });
      }
    },
    onError: (e: any) => toast({ title: "取得エラー", description: e.message, variant: "destructive" }),
  });

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div><CardTitle>休診日管理</CardTitle><CardDescription>臨時休診日や国民の祝日の設定 — カレンダー画面からも直接設定できます</CardDescription></div>
        <Button size="sm" onClick={() => setIsDialogOpen(true)} data-testid="button-add-holiday">
          <Plus className="h-4 w-4 mr-1" />追加
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Japan public holiday import */}
        <div className="flex items-center gap-2 p-3 border border-border rounded-md bg-muted/20">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm flex-1">国民の祝日を自動取得</span>
          <Select value={String(importYear)} onValueChange={v => setImportYear(parseInt(v))}>
            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}年</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => importMutation.mutate(importYear)}
            disabled={importMutation.isPending}
            data-testid="button-import-holidays"
          >
            {importMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1">取得</span>
          </Button>
        </div>

        {isLoading ? <Skeleton className="h-32" /> : holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">休診日が登録されていません</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日付</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="hidden md:table-cell">種別</TableHead>
                <TableHead className="w-16">削除</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holidays.map(h => (
                <TableRow key={h.id}>
                  <TableCell className="font-mono">{h.date}</TableCell>
                  <TableCell>{h.name || "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{h.reason || "—"}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate(h.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog open={isDialogOpen} onOpenChange={v => !v && setIsDialogOpen(false)}>
        <DialogContent>
          <DialogHeader><DialogTitle>休診日の追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="mb-1.5 block">日付 *</Label><Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></div>
            <div><Label className="mb-1.5 block">名称</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="お盆休み、年末年始など" /></div>
            <div><Label className="mb-1.5 block">理由・メモ</Label><Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.date || saveMutation.isPending}>{saveMutation.isPending ? "保存中..." : "追加"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Calendar Integration Tab ─────────────────────────────────────────────────
function CalendarIntegrationTab() {
  const [copied, setCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const { data: clinic } = useQuery<{ slug?: string | null }>({ queryKey: ["/api/clinic"] });
  const icsUrl = `${window.location.origin}/api/calendar.ics`;
  const bookingUrl = clinic?.slug
    ? `${window.location.origin}/book/${clinic.slug}`
    : `${window.location.origin}/booking`;

  const handleCopy = () => {
    navigator.clipboard.writeText(icsUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopyBookingUrl = () => {
    navigator.clipboard.writeText(bookingUrl).then(() => {
      setQrCopied(true);
      setTimeout(() => setQrCopied(false), 2000);
    });
  };

  const handleDownloadQR = () => {
    const svg = document.getElementById("booking-qr-svg");
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "booking-qr.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Booking QR Code */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />患者向け予約ページ QRコード
          </CardTitle>
          <CardDescription>QRコードをスキャンすると予約ページに直接アクセスできます。印刷して受付や院内に掲示できます。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-white p-4 rounded-xl border shadow-sm">
              <QRCodeSVG
                id="booking-qr-svg"
                value={bookingUrl}
                size={160}
                level="M"
                includeMargin={false}
                data-testid="booking-qr-code"
              />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">予約ページURL</Label>
                <div className="flex gap-2">
                  <Input
                    value={bookingUrl}
                    readOnly
                    className="font-mono text-xs"
                    data-testid="input-booking-url"
                    onClick={e => (e.target as HTMLInputElement).select()}
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyBookingUrl} data-testid="button-copy-booking-url">
                    {qrCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <Button variant="outline" onClick={handleDownloadQR} data-testid="button-download-qr">
                <Download className="h-4 w-4 mr-2" />QRコードをダウンロード
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* iCal subscription */}
      <Card>
        <CardHeader>
          <CardTitle>カレンダー購読 URL</CardTitle>
          <CardDescription>このURLをカレンダーアプリに登録すると、予約情報が自動同期されます</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={icsUrl}
              readOnly
              className="font-mono text-xs"
              data-testid="input-ical-url"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <Button variant="outline" size="icon" onClick={handleCopy} data-testid="button-copy-ical-url">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ※ このURLは予約データを含みます。外部に公開しないようご注意ください。
          </p>
        </CardContent>
      </Card>

      {/* Google Calendar instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />Google カレンダーに追加する方法
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>上の購読 URL をコピーする</li>
            <li>Google カレンダー（PC版）を開き、左側の「他のカレンダー」横の <strong>+</strong> をクリック</li>
            <li>「URL で追加」を選択</li>
            <li>コピーした URL を貼り付けて「カレンダーを追加」をクリック</li>
            <li>スマートフォンの Google カレンダーアプリにも自動で反映されます</li>
          </ol>
        </CardContent>
      </Card>

      {/* iPhone instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />iPhone カレンダーに追加する方法
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>上の購読 URL をコピーする</li>
            <li>iPhone の「設定」アプリを開く</li>
            <li>「カレンダー」→「アカウント」→「アカウントを追加」→「その他」を選択</li>
            <li>「照会するカレンダーを追加」をタップ</li>
            <li>コピーした URL を貼り付けて「次へ」→「保存」をタップ</li>
          </ol>
        </CardContent>
      </Card>

      {/* Download as file */}
      <Card>
        <CardHeader>
          <CardTitle>ファイルとしてダウンロード</CardTitle>
          <CardDescription>カレンダーアプリに直接インポートする場合</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/api/calendar.ics" download>
            <Button variant="outline" data-testid="button-download-ical">
              <Calendar className="h-4 w-4 mr-2" />.ics ファイルをダウンロード
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── General Tab ─────────────────────────────────────────────────────────────
function GeneralTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery<ClinicSettings>({ queryKey: ["/api/clinic-settings"] });
  const [form, setForm] = useState<ClinicSettings>({
    chairsCount: 5, bookingAdvanceDays: 60, bookingBufferMinutes: 15,
    slotIntervalMinutes: 30, maxConcurrentAppointments: 1,
    allowDoubleBooking: false, enablePatientConfirmation: true, confirmationDeadlineHours: 24, enableQrCheckin: false,
    requireAppointmentApproval: false, closedOnHolidays: true, primaryColor: "#C4B5A0", enableReferral: true,
  });
  const { data: planInfo } = useQuery<PlanInfo>({ queryKey: ["/api/plan-info"] });
  const [loaded, setLoaded] = useState(false);

  if (settings && !loaded) { setForm(settings); setLoaded(true); }

  const saveMutation = useMutation({
    mutationFn: (data: ClinicSettings) => apiRequest("PUT", "/api/clinic-settings", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/clinic-settings"] }); toast({ title: "設定を保存しました" }); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  return (
    <>
    <Card>
      <CardHeader><CardTitle>一般設定</CardTitle><CardDescription>予約・クリニックの動作設定</CardDescription></CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-64" /> : (
          <div className="space-y-5 max-w-lg">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <div>
                <Label className="mb-1.5 block">同時予約受付数</Label>
                <NumericSelectOrCustom
                  value={form.maxConcurrentAppointments}
                  onChange={v => setForm(p => ({ ...p, maxConcurrentAppointments: v }))}
                  options={[1, 2, 3, 4, 5, 6, 8, 10]}
                  unit="件"
                  min={1}
                  testId="select-max-concurrent-appointments"
                />
                <p className="text-xs text-muted-foreground mt-1">同じ時間帯に同時受付できる予約の上限数。</p>
              </div>
              <div>
                <Label className="mb-1.5 block">予約スロット間隔</Label>
                <NumericSelectOrCustom
                  value={form.slotIntervalMinutes}
                  onChange={v => setForm(p => ({ ...p, slotIntervalMinutes: v }))}
                  options={[5, 10, 15, 20, 30, 60]}
                  unit="分おき"
                  min={1}
                  testId="select-slot-interval"
                />
                <p className="text-xs text-muted-foreground mt-1">患者が選べる開始時刻の間隔。例：30分おきなら9:00・9:30・10:00…</p>
              </div>
              <div>
                <Label className="mb-1.5 block">バッファ時間（準備・消毒）</Label>
                <NumericSelectOrCustom
                  value={form.bookingBufferMinutes}
                  onChange={v => setForm(p => ({ ...p, bookingBufferMinutes: v }))}
                  options={[0, 5, 10, 15, 20, 30, 45, 60]}
                  unit="分"
                  min={0}
                  testId="select-buffer-minutes"
                />
                <p className="text-xs text-muted-foreground mt-1">各予約の後に自動で確保するブランク時間。消毒・準備に使用。</p>
              </div>
              <div>
                <Label className="mb-1.5 block">予約可能日数（何日先まで）</Label>
                <NumericSelectOrCustom
                  value={form.bookingAdvanceDays}
                  onChange={v => setForm(p => ({ ...p, bookingAdvanceDays: v }))}
                  options={[7, 14, 30, 60, 90, 180, 365]}
                  unit="日先"
                  min={1}
                  testId="select-advance-days"
                />
              </div>
              <div>
                <Label className="mb-1.5 block">患者確認の期限</Label>
                <NumericSelectOrCustom
                  value={form.confirmationDeadlineHours}
                  onChange={v => setForm(p => ({ ...p, confirmationDeadlineHours: v }))}
                  options={[1, 2, 4, 6, 12, 24, 48, 72]}
                  unit="時間前"
                  min={1}
                  testId="select-confirmation-deadline"
                />
                <p className="text-xs text-muted-foreground mt-1">予約確認をこの時間前までに行わないと自動キャンセル。</p>
              </div>
            </div>
            <div className="space-y-3">
              {([
                { key: "allowDoubleBooking", label: "ダブルブッキングを許可する" },
                { key: "enablePatientConfirmation", label: "患者確認機能を有効にする" },
                { key: "enableQrCheckin", label: "QRチェックインを有効にする" },
                { key: "requireAppointmentApproval", label: "オンライン予約に承認を必要とする（仮予約フロー）" },
                { key: "closedOnHolidays", label: "祝日は休診にする" },
                { key: "enableReferral", label: "患者紹介コード機能を有効にする" },
              ] as const).map(item => (
                <div key={item.key} className="flex items-center gap-3">
                  <Switch
                    checked={!!form[item.key as keyof ClinicSettings]}
                    onCheckedChange={v => setForm(p => ({ ...p, [item.key]: v }))}
                    id={item.key}
                    data-testid={`switch-${item.key}`}
                  />
                  <Label htmlFor={item.key}>{item.label}</Label>
                </div>
              ))}
            </div>
            <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-settings">
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    {planInfo && (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>プラン情報</CardTitle>
          <CardDescription>現在のご契約プランと利用状況</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">現在のプラン：</span>
              <span className="font-bold text-base">{planInfo.limits.label}</span>
              <span className="text-sm text-muted-foreground">{planInfo.limits.price}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="border rounded-lg p-3">
                <div className="text-muted-foreground mb-1">スタッフ数</div>
                <div className="font-semibold">{planInfo.usage.staffCount} / {planInfo.limits.maxStaff === 999 ? "無制限" : `${planInfo.limits.maxStaff}名`}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-muted-foreground mb-1">今月の予約数</div>
                <div className="font-semibold">{planInfo.usage.monthlyAppointments} / {planInfo.limits.maxMonthlyAppointments >= 99999 ? "無制限" : `${planInfo.limits.maxMonthlyAppointments}件`}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-muted-foreground mb-1">データエクスポート</div>
                <div className={planInfo.limits.canExport ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>{planInfo.limits.canExport ? "利用可能" : "利用不可"}</div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-muted-foreground mb-1">LINE連携</div>
                <div className={planInfo.limits.canLine ? "text-green-600 font-semibold" : "text-red-500 font-semibold"}>{planInfo.limits.canLine ? "利用可能" : "利用不可"}</div>
              </div>
            </div>
            {planInfo.planType === "free" && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
                フリープランをご利用中です。より多くの機能をご利用いただくにはプランのアップグレードをご検討ください。
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )}
    </>
  );
}

// ─── Reminder Tab ─────────────────────────────────────────────────────────────
function ReminderTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasAddon } = useClinicAddons();
  const { data: settings, isLoading } = useQuery<ReminderSettings>({ queryKey: ["/api/reminder-settings"] });
  const [form, setForm] = useState<ReminderSettings>({
    enableEmail: true, enableSms: false, enableLine: false, reminderHoursBefore: 24,
    lineChannelAccessToken: "", lineChannelSecret: "", autoReminderEnabled: false, reminderSendTime: "09:00",
  });
  const [loaded, setLoaded] = useState(false);
  const [showLineSecret, setShowLineSecret] = useState(false);
  const [showLineToken, setShowLineToken] = useState(false);

  const { canLine } = usePlan();
  const hasSms = hasAddon("sms_pack");
  const hasLine = hasAddon("line_reminder") || canLine;

  if (settings && !loaded) { setForm({ ...form, ...settings }); setLoaded(true); }

  const saveMutation = useMutation({
    mutationFn: (data: ReminderSettings) => apiRequest("PUT", "/api/reminder-settings", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/reminder-settings"] }); toast({ title: "リマインダー設定を保存しました" }); },
  });

  const testMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reminder-settings/test", {}),
    onSuccess: () => toast({ title: "テストメールを送信しました", description: "登録されているクリニックのメールアドレスを確認してください" }),
    onError: (e: any) => toast({ title: "送信失敗", description: e.message, variant: "destructive" }),
  });

  const triggerMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/reminder-settings/trigger-now", {}),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "リマインダーを送信しました", description: data.message });
    },
    onError: (e: any) => toast({ title: "送信失敗", description: e.message, variant: "destructive" }),
  });

  const clinicSlug = window.location.hostname.includes("replit") ? "demo" : "demo";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>リマインダー設定</CardTitle><CardDescription>予約前の自動リマインダーを設定します</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-5 max-w-lg">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Switch
                  checked={!!form.autoReminderEnabled}
                  onCheckedChange={v => setForm(p => ({ ...p, autoReminderEnabled: v }))}
                  id="autoReminderEnabled"
                  data-testid="switch-auto-reminder"
                />
                <div>
                  <Label htmlFor="autoReminderEnabled" className="text-base font-medium">自動リマインダー</Label>
                  <p className="text-sm text-muted-foreground">毎日指定の時刻に翌日の予約患者へリマインダーを自動送信します</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">リマインド送信タイミング</Label>
                  <Select value={String(form.reminderHoursBefore)} onValueChange={v => setForm(p => ({ ...p, reminderHoursBefore: parseInt(v) }))}>
                    <SelectTrigger data-testid="select-reminder-hours"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">6時間前</SelectItem>
                      <SelectItem value="12">12時間前</SelectItem>
                      <SelectItem value="24">24時間前</SelectItem>
                      <SelectItem value="48">48時間前</SelectItem>
                      <SelectItem value="72">72時間前</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">自動送信時刻</Label>
                  <Input
                    type="time"
                    value={form.reminderSendTime || "09:00"}
                    onChange={e => setForm(p => ({ ...p, reminderSendTime: e.target.value }))}
                    data-testid="input-reminder-send-time"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">送信方法</Label>
                {([
                  { key: "enableEmail", label: "メールリマインダー", note: null, addonKey: null },
                  { key: "enableSms", label: "SMSリマインダー", note: "SMS送信にはTwilio設定が必要です（TWILIO_ACCOUNT_SID、TWILIO_AUTH_TOKEN、TWILIO_FROM_NUMBER 環境変数）", addonKey: "sms_pack" },
                  { key: "enableLine", label: "LINEリマインダー", note: null, addonKey: "line_reminder" },
                ] as const).map(item => {
                  const addonEnabled = !item.addonKey || (item.addonKey === "sms_pack" ? hasSms : hasLine);
                  return (
                    <div key={item.key}>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={!!form[item.key as keyof ReminderSettings]}
                          onCheckedChange={v => {
                            if (!addonEnabled) {
                              toast({ title: "このオプションは未契約です", description: "スーパー管理者に有効化を依頼してください。", variant: "destructive" });
                              return;
                            }
                            setForm(p => ({ ...p, [item.key]: v }));
                          }}
                          id={item.key}
                          disabled={!addonEnabled}
                          data-testid={`switch-${item.key}`}
                        />
                        <Label htmlFor={item.key} className={!addonEnabled ? "text-muted-foreground" : ""}>{item.label}</Label>
                        {!addonEnabled && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full ml-1">要オプション</span>}
                      </div>
                      {item.note && addonEnabled && (
                        <p className="text-xs text-muted-foreground mt-1 ml-11">{item.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-reminder">
                  {saveMutation.isPending ? "保存中..." : "保存"}
                </Button>
                <Button variant="outline" onClick={() => testMutation.mutate()} disabled={testMutation.isPending} data-testid="button-test-reminder">
                  {testMutation.isPending ? "送信中..." : "テストメール送信"}
                </Button>
                <Button variant="outline" onClick={() => triggerMutation.mutate()} disabled={triggerMutation.isPending} data-testid="button-trigger-reminders">
                  {triggerMutation.isPending ? "送信中..." : "今すぐ手動送信"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="relative">
        {!hasLine && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] z-10 rounded-lg flex flex-col items-center justify-center gap-3" data-testid="line-addon-locked">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center max-w-xs">
              <p className="font-semibold text-amber-900 mb-1">LINEリマインダーオプション未契約</p>
              <p className="text-xs text-amber-700">このオプションを使用するにはスーパー管理者に有効化を依頼してください。</p>
            </div>
          </div>
        )}
        <CardHeader>
          <CardTitle>LINE Messaging API 設定</CardTitle>
          <CardDescription>LINE公式アカウントを通じてリマインダーを送信するための設定です</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32" /> : (
            <div className="space-y-5 max-w-lg">
              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Webhookの設定方法</p>
                <p className="text-xs text-blue-600 dark:text-blue-300 mb-2">LINE Developersコンソールで以下のWebhook URLを設定してください：</p>
                <code className="text-xs bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded block break-all" data-testid="text-webhook-url">
                  {`${window.location.origin}/api/line/${clinicSlug}/webhook`}
                </code>
              </div>

              <div>
                <Label className="mb-1.5 block">Channel Access Token（チャネルアクセストークン）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showLineToken ? "text" : "password"}
                    placeholder="長期アクセストークンを入力..."
                    value={form.lineChannelAccessToken || ""}
                    onChange={e => setForm(p => ({ ...p, lineChannelAccessToken: e.target.value }))}
                    data-testid="input-line-channel-token"
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowLineToken(p => !p)} type="button">
                    {showLineToken ? "非表示" : "表示"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">LINE Developersコンソール → チャネル設定 → Messaging API → チャネルアクセストークン</p>
              </div>

              <div>
                <Label className="mb-1.5 block">Channel Secret（チャネルシークレット）</Label>
                <div className="flex gap-2">
                  <Input
                    type={showLineSecret ? "text" : "password"}
                    placeholder="チャネルシークレットを入力..."
                    value={form.lineChannelSecret || ""}
                    onChange={e => setForm(p => ({ ...p, lineChannelSecret: e.target.value }))}
                    data-testid="input-line-channel-secret"
                  />
                  <Button variant="outline" size="sm" onClick={() => setShowLineSecret(p => !p)} type="button">
                    {showLineSecret ? "非表示" : "表示"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">LINE Developersコンソール → チャネル基本設定 → チャネルシークレット</p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm font-medium mb-2">患者のLINE User ID登録について</p>
                <p className="text-xs text-muted-foreground">
                  患者がLINE公式アカウントを友達追加すると、Webhookで通知が届きます。
                  管理画面の患者詳細またはAPIを通じて、患者情報にLINE User IDを手動で紐付けることができます。
                  Line User IDが登録された患者のみ、LINEリマインダーが送信されます。
                </p>
              </div>

              <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} data-testid="button-save-line-settings">
                {saveMutation.isPending ? "保存中..." : "LINE設定を保存"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [usernameForm, setUsernameForm] = useState({ newUsername: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

  const usernameMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", "/api/account/username", { newUsername: usernameForm.newUsername });
      return res.json();
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/user"], updated);
      setUsernameForm({ newUsername: "" });
      toast({ title: "ユーザー名を変更しました" });
    },
    onError: async (err: any) => {
      toast({ title: err.message || "変更に失敗しました", variant: "destructive" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("新しいパスワードが一致しません");
      }
      const res = await apiRequest("PUT", "/api/account/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast({ title: "パスワードを変更しました" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "変更に失敗しました", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>ユーザー名の変更</CardTitle>
          <CardDescription>現在のユーザー名: <strong>{(user as any)?.username}</strong></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-username">新しいユーザー名</Label>
            <Input
              id="new-username"
              value={usernameForm.newUsername}
              onChange={e => setUsernameForm({ newUsername: e.target.value })}
              placeholder="新しいユーザー名"
              data-testid="input-new-username"
            />
          </div>
          <Button
            onClick={() => usernameMutation.mutate()}
            disabled={usernameMutation.isPending || !usernameForm.newUsername.trim()}
            data-testid="button-save-username"
          >
            {usernameMutation.isPending ? "変更中..." : "ユーザー名を変更"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>パスワードの変更</CardTitle>
          <CardDescription>安全のため、定期的にパスワードを変更することをおすすめします</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">現在のパスワード</Label>
            <Input
              id="current-password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
              placeholder="••••••••"
              data-testid="input-current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">新しいパスワード</Label>
            <Input
              id="new-password"
              type="password"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
              placeholder="6文字以上"
              data-testid="input-new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">新しいパスワード（確認）</Label>
            <Input
              id="confirm-password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder="もう一度入力"
              data-testid="input-confirm-password"
            />
          </div>
          <Button
            onClick={() => passwordMutation.mutate()}
            disabled={passwordMutation.isPending || !passwordForm.currentPassword || !passwordForm.newPassword}
            data-testid="button-save-password"
          >
            {passwordMutation.isPending ? "変更中..." : "パスワードを変更"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
