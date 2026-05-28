import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Search, Trash2, AlertTriangle, CalendarPlus, Loader2, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Patient {
  id: string;
  patientNumber: string;
  name: string;
  nameKana?: string;
  phone?: string;
  cancellationCount: number;
  noShowCount: number;
  recallIntervalMonths?: number;
}

interface Staff { id: string; name: string; role: string }
interface Service { id: string; name: string; duration: number; price: number; isActive: boolean; staffRole?: string }

interface Appointment {
  id?: string;
  patientId: string;
  staffId?: string;
  serviceId?: string;
  date: string;
  startTime: string;
  endTime: string;
  treatmentType: string;
  status: string;
  confirmationStatus?: string;
  notes?: string;
  updatedAt?: string;
  patient?: Patient;
  staff?: Staff;
}

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  initialSlotData?: { date: string; time: string; staffId?: string; patientId?: string; patientName?: string } | null;
  onSaved?: () => void;
  onSlotClick?: (date: string, time: string, staffId?: string, patientId?: string, patientName?: string) => void;
}

function hiraToKata(str: string) {
  return str.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}
function kataToHira(str: string) {
  return str.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}
function normalize(str: string) {
  return str.replace(/[\s\-]/g, "").toLowerCase();
}

const STATUS_OPTIONS = [
  { value: "confirmed", label: "確定" },
  { value: "pending", label: "仮予約" },
  { value: "cancelled", label: "キャンセル" },
  { value: "completed", label: "完了" },
  { value: "no_show", label: "無断キャンセル" },
];

export function AppointmentModal({ isOpen, onClose, appointment, initialSlotData, onSaved, onSlotClick }: AppointmentModalProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patients = [] } = useQuery<Patient[]>({ queryKey: ["/api/patients"] });
  const { data: staff = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });
  const { data: services = [] } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const { data: questionnaire } = useQuery<any>({
    queryKey: ["/api/questionnaires/by-appointment", appointment?.id],
    enabled: !!appointment?.id,
  });

  const [searchValue, setSearchValue] = useState("");
  const [isNewPatient, setIsNewPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({ name: "", nameKana: "", phone: "", email: "" });
  const [form, setForm] = useState({
    patientId: "",
    staffId: "",
    serviceId: "",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "10:00",
    treatmentType: "定期検診",
    status: "confirmed",
    notes: "",
  });

  const [showRecallPrompt, setShowRecallPrompt] = useState(false);
  const [nextRecallDate, setNextRecallDate] = useState("");
  const [showQuestionnaire, setShowQuestionnaire] = useState(false);
  const [recallInterval, setRecallInterval] = useState(6);
  const [recallPatientInfo, setRecallPatientInfo] = useState<{ id: string; name: string } | null>(null);
  const versionRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (appointment) {
      versionRef.current = appointment.updatedAt;
      setForm({
        patientId: appointment.patientId || "",
        staffId: appointment.staffId || "",
        serviceId: appointment.serviceId || "",
        date: appointment.date || new Date().toISOString().split("T")[0],
        startTime: appointment.startTime?.slice(0, 5) || "09:00",
        endTime: appointment.endTime?.slice(0, 5) || "10:00",
        treatmentType: appointment.treatmentType || "",
        status: appointment.status || "confirmed",
        notes: appointment.notes || "",
      });
      setSearchValue(appointment.patient?.name || "");
    } else if (initialSlotData) {
      setForm({
        patientId: initialSlotData.patientId || "",
        date: initialSlotData.date,
        startTime: initialSlotData.time,
        endTime: calcEndTime(initialSlotData.time, 60),
        staffId: initialSlotData.staffId || "",
        serviceId: "",
        treatmentType: "",
        status: "confirmed",
        notes: "",
      });
      setSearchValue(initialSlotData.patientName || "");
    } else {
      setForm({
        patientId: "", staffId: "", serviceId: "",
        date: new Date().toISOString().split("T")[0],
        startTime: "09:00", endTime: "10:00",
        treatmentType: "", status: "confirmed",
        notes: "",
      });
      setSearchValue("");
    }
    setIsNewPatient(false);
    setNewPatient({ name: "", nameKana: "", phone: "", email: "" });
    setShowQuestionnaire(false);
  }, [appointment, initialSlotData, isOpen]);

  const handleNextAppointment = () => {
    if (!appointment) return;
    const nextData = {
      date: new Date().toISOString().split("T")[0],
      time: "09:00",
      staffId: appointment.staffId || undefined,
      patientId: appointment.patientId,
      patientName: appointment.patient?.name
    };
    onClose();
    // Use a small timeout to ensure the current modal is closed before opening the new one
    setTimeout(() => {
      onSlotClick?.(nextData.date, nextData.time, nextData.staffId, nextData.patientId, nextData.patientName);
    }, 100);
  };

  function calcEndTime(startTime: string, durationMin: number): string {
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + durationMin;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  const filteredPatients = useMemo(() => {
    if (!searchValue.trim()) return [];
    const raw = normalize(searchValue);
    const hira = normalize(kataToHira(searchValue));
    const kata = normalize(hiraToKata(searchValue));
    const phoneQ = searchValue.replace(/\D/g, "");

    const matched = patients.filter(p => {
      const name = normalize(p.name);
      const kana = normalize(p.nameKana || "");
      const phone = (p.phone || "").replace(/\D/g, "");
      const num = (p.patientNumber || "").toLowerCase();
      return [raw, hira, kata].some(v =>
        name.includes(v) || kana.includes(v) || num.includes(v)
      ) || (phoneQ && phone.includes(phoneQ));
    });

    // 前方一致・完全一致を先に表示
    const score = (p: typeof patients[0]) => {
      const name = normalize(p.name);
      const kana = normalize(p.nameKana || "");
      for (const v of [raw, hira, kata]) {
        if (name === v || kana === v) return 0;
        if (name.startsWith(v) || kana.startsWith(v)) return 1;
      }
      return 2;
    };
    return matched.sort((a, b) => score(a) - score(b)).slice(0, 8);
  }, [patients, searchValue]);

  const selectedPatient = patients.find(p => p.id === form.patientId);
  const isHighRisk = selectedPatient && ((selectedPatient.cancellationCount || 0) + (selectedPatient.noShowCount || 0)) >= 3;

  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { newPatient?: typeof newPatient }) => {
      let patientId = data.patientId;
      if (isNewPatient && data.newPatient?.name) {
        const npRes = await apiRequest("POST", "/api/patients", {
          name: data.newPatient.name,
          nameKana: data.newPatient.nameKana,
          phone: data.newPatient.phone,
          email: data.newPatient.email,
        });
        const np = await npRes.json();
        patientId = np.id;
      }
      const payload: Record<string, any> = {
        patientId,
        staffId: data.staffId || undefined,
        serviceId: data.serviceId || undefined,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        treatmentType: data.treatmentType,
        status: data.status,
        notes: data.notes,
      };
      if (appointment?.id) {
        if (versionRef.current) payload._updatedAt = versionRef.current;
        return apiRequest("PUT", `/api/appointments/${appointment.id}`, payload);
      } else {
        return apiRequest("POST", "/api/appointments", payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({ title: appointment?.id ? "予約を更新しました" : "予約を作成しました" });
      
      // If marked as completed, prompt for recall
      if (form.status === "completed" && form.patientId) {
        const p = patients.find(p => p.id === form.patientId);
        if (p) {
          const interval = p.recallIntervalMonths || 6;
          const nextDate = new Date();
          nextDate.setMonth(nextDate.getMonth() + interval);
          setNextRecallDate(nextDate.toISOString().split("T")[0]);
          setRecallInterval(interval);
          setRecallPatientInfo({ id: p.id, name: p.name });
          onClose();   // メインダイアログを先に閉じる
          onSaved?.(); // カレンダーを更新
          setTimeout(() => setShowRecallPrompt(true), 250); // アニメーション後にリコール表示
          return;
        }
      }

      onClose();
      onSaved?.();
    },
    onError: async (err: any) => {
      try {
        const body = await err.response?.json?.();
        if (body?.code === "concurrent_edit") {
          toast({
            title: "⚠️ 同時編集の競合",
            description: body.message,
            variant: "destructive",
          });
          queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
          onClose();
          return;
        }
        toast({ title: "エラー", description: body?.message || err.message, variant: "destructive" });
      } catch {
        toast({ title: "エラー", description: err.message, variant: "destructive" });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/appointments/${appointment?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({ title: "予約を削除しました" });
      onClose();
      onSaved?.();
    },
  });

  const updateRecallMutation = useMutation({
    mutationFn: (data: { id: string; nextRecallDate: string; recallIntervalMonths: number }) => 
      apiRequest("PUT", `/api/patients/${data.id}/recall`, { 
        nextRecallDate: data.nextRecallDate, 
        recallIntervalMonths: data.recallIntervalMonths 
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recall"] });
      toast({ title: "リコール設定を保存しました" });
      setShowRecallPrompt(false);
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const handleServiceChange = (serviceId: string) => {
    const svc = services.find(s => s.id === serviceId);
    setForm(prev => {
      const updatedForm = {
        ...prev,
        serviceId,
        treatmentType: svc ? svc.name : prev.treatmentType,
        endTime: svc ? calcEndTime(prev.startTime, svc.duration) : prev.endTime,
      };
      if (svc?.staffRole && svc.staffRole !== "any") {
        const roleMap: Record<string, string> = { doctor: "doctor", hygienist: "hygienist" };
        const requiredRole = roleMap[svc.staffRole];
        if (requiredRole) {
          const currentStaff = staff.find(s => s.id === prev.staffId);
          if (currentStaff && currentStaff.role !== requiredRole) {
            updatedForm.staffId = "";
          }
        }
      }
      return updatedForm;
    });
  };

  const selectedService = services.find(s => s.id === form.serviceId);
  const filteredStaff = selectedService?.staffRole && selectedService.staffRole !== "any"
    ? staff.filter(s => s.role === selectedService.staffRole)
    : staff;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[calc(100%-32px)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{appointment?.id ? "予約の編集" : "新規予約"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient */}
          <div>
            <Label className="mb-2 block">患者 <span className="text-red-500">*</span></Label>
            {!isNewPatient ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="患者名・カナ・患者番号・電話番号で検索"
                    value={searchValue}
                    onChange={e => setSearchValue(e.target.value)}
                    data-testid="input-patient-search"
                  />
                </div>
                {searchValue && filteredPatients.length > 0 && !form.patientId && (
                  <div className="border border-border rounded-md divide-y max-h-40 overflow-y-auto bg-popover">
                    {filteredPatients.map(p => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
                        onClick={() => {
                          setForm(prev => ({ ...prev, patientId: p.id }));
                          setSearchValue(p.name);
                        }}
                        data-testid={`patient-option-${p.id}`}
                      >
                        <span className="font-medium">{p.name}</span>
                        {p.nameKana && <span className="text-muted-foreground ml-2 text-xs">{p.nameKana}</span>}
                        <span className="text-muted-foreground ml-2 text-xs">{p.patientNumber}</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.patientId && (
                  <div className="flex items-center justify-between p-2 bg-accent rounded-md">
                    <div className="text-sm">
                      <span className="font-medium">{selectedPatient?.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{selectedPatient?.patientNumber}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setForm(prev => ({ ...prev, patientId: "" })); setSearchValue(""); }}>
                      変更
                    </Button>
                  </div>
                )}
                {isHighRisk && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md text-sm text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>キャンセル{selectedPatient?.cancellationCount}回・無断{selectedPatient?.noShowCount}回の履歴があります</span>
                  </div>
                )}
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => setIsNewPatient(true)}
                >
                  新規患者として登録する
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-3 border border-border rounded-md bg-muted/30">
                <p className="text-sm font-medium">新規患者情報</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">氏名 *</Label>
                    <Input
                      value={newPatient.name}
                      onChange={e => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="山田 太郎"
                      data-testid="input-new-patient-name"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">カナ</Label>
                    <Input
                      value={newPatient.nameKana}
                      onChange={e => setNewPatient(prev => ({ ...prev, nameKana: e.target.value }))}
                      placeholder="ヤマダ タロウ"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">電話番号</Label>
                    <Input
                      value={newPatient.phone}
                      onChange={e => setNewPatient(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="090-0000-0000"
                    />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">メール</Label>
                    <Input
                      value={newPatient.email}
                      onChange={e => setNewPatient(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setIsNewPatient(false)}>
                  既存患者から選択する
                </button>
              </div>
            )}
          </div>

          <Separator />

          {/* Date / Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="mb-1.5 block text-sm">日付</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                data-testid="input-date"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">開始時間</Label>
              <Input
                type="time"
                value={form.startTime}
                onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                data-testid="input-start-time"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">終了時間</Label>
              <Input
                type="time"
                value={form.endTime}
                onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                data-testid="input-end-time"
              />
            </div>
          </div>

          {/* Staff / Service */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-sm">担当者
                {selectedService?.staffRole && selectedService.staffRole !== "any" && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded font-medium ${selectedService.staffRole === "doctor" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                    {selectedService.staffRole === "doctor" ? "Dr.のみ" : "衛生士のみ"}
                  </span>
                )}
              </Label>
              <Select value={form.staffId} onValueChange={v => setForm(prev => ({ ...prev, staffId: v }))}>
                <SelectTrigger data-testid="select-staff">
                  <SelectValue placeholder="担当者を選択" />
                </SelectTrigger>
                <SelectContent>
                  {filteredStaff.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.role === "doctor" ? "歯科医師" : "衛生士"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">診療メニュー</Label>
              <Select value={form.serviceId} onValueChange={handleServiceChange}>
                <SelectTrigger data-testid="select-service">
                  <SelectValue placeholder="メニューを選択" />
                </SelectTrigger>
                <SelectContent>
                  {services.filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration}分)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Status / treatmentType fallback */}
          <div className="grid grid-cols-2 gap-3">
            {!form.serviceId && (
              <div>
                <Label className="mb-1.5 block text-sm">治療内容（メモ）</Label>
                <Input
                  value={form.treatmentType}
                  onChange={e => setForm(prev => ({ ...prev, treatmentType: e.target.value }))}
                  placeholder="診療メニューを選択するか入力"
                  data-testid="input-treatment-type"
                />
              </div>
            )}
            <div className={form.serviceId ? "col-span-2" : ""}>
              <Label className="mb-1.5 block text-sm">ステータス</Label>
              <Select value={form.status} onValueChange={v => setForm(prev => ({ ...prev, status: v }))}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm">メモ</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="備考・注意事項"
              rows={2}
              data-testid="input-notes"
            />
          </div>

          {/* Questionnaire */}
          {questionnaire && (
            <div className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted text-sm font-medium"
                onClick={() => setShowQuestionnaire(v => !v)}
                data-testid="button-toggle-questionnaire"
              >
                <span className="flex items-center gap-1.5"><ClipboardList className="w-4 h-4 text-primary" />問診票あり</span>
                {showQuestionnaire ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showQuestionnaire && (
                <div className="p-3 space-y-2 text-sm" data-testid="questionnaire-detail">
                  {questionnaire.chiefComplaint && <div><span className="text-muted-foreground">主訴：</span>{questionnaire.chiefComplaint}</div>}
                  {(questionnaire.painLevel !== null && questionnaire.painLevel !== undefined) && <div><span className="text-muted-foreground">痛みの強さ：</span>{questionnaire.painLevel}/10{questionnaire.painLocation && ` （${questionnaire.painLocation}）`}</div>}
                  {questionnaire.medicalHistory && <div><span className="text-muted-foreground">既往歴：</span>{questionnaire.medicalHistory}</div>}
                  {questionnaire.currentMedications && <div><span className="text-muted-foreground">服用中の薬：</span>{questionnaire.currentMedications}</div>}
                  {questionnaire.allergies && <div><span className="text-muted-foreground">アレルギー：</span>{questionnaire.allergies}</div>}
                  {questionnaire.isPregnant && <div className="text-amber-600 font-medium">妊娠中</div>}
                  {questionnaire.lastDentalVisit && <div><span className="text-muted-foreground">最終歯科受診：</span>{{within_1m:"1ヶ月以内",within_3m:"3ヶ月以内",within_6m:"6ヶ月以内",over_1y:"1年以上前",first_time:"初めて"}[questionnaire.lastDentalVisit as string] || questionnaire.lastDentalVisit}</div>}
                  {questionnaire.brushingFrequency && <div><span className="text-muted-foreground">歯磨き頻度：</span>{{after_meals:"毎食後",twice_daily:"1日2回",once_daily:"1日1回",irregular:"不規則"}[questionnaire.brushingFrequency as string] || questionnaire.brushingFrequency}</div>}
                  {(questionnaire.anxietyLevel !== null && questionnaire.anxietyLevel !== undefined) && <div><span className="text-muted-foreground">治療への不安：</span>{questionnaire.anxietyLevel}/5</div>}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-2">
              {appointment?.id && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  削除
                </Button>
              )}
              {appointment?.id && (appointment.status === "completed" || appointment.status === "confirmed") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextAppointment}
                  data-testid="button-next-appointment"
                >
                  <CalendarPlus className="h-4 w-4 mr-1" />
                  次回予約を取る
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={onClose}>閉じる</Button>
              <Button
                onClick={() => saveMutation.mutate({ ...form, newPatient: isNewPatient ? newPatient : undefined })}
                disabled={saveMutation.isPending || (!form.patientId && !isNewPatient)}
                data-testid="button-save"
              >
                {saveMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Recall Prompt Dialog */}
    <Dialog open={showRecallPrompt} onOpenChange={(v) => !v && setShowRecallPrompt(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>リコール設定: {recallPatientInfo?.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">診療が完了しました。次回の定期検診予定日を設定してください。</p>
          <div className="space-y-2">
            <Label htmlFor="prompt-recall-date">次回リコール予定日</Label>
            <Input 
              id="prompt-recall-date"
              type="date" 
              value={nextRecallDate} 
              onChange={(e) => setNextRecallDate(e.target.value)} 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt-recall-interval">リコール間隔（ヶ月）</Label>
            <Input 
              id="prompt-recall-interval"
              type="number" 
              min="1"
              max="24"
              value={recallInterval} 
              onChange={(e) => setRecallInterval(parseInt(e.target.value) || 6)} 
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowRecallPrompt(false)}>
            スキップ
          </Button>
          <Button 
            onClick={() => updateRecallMutation.mutate({ 
              id: recallPatientInfo?.id || "", 
              nextRecallDate, 
              recallIntervalMonths: recallInterval 
            })}
            disabled={updateRecallMutation.isPending}
            data-testid="button-save-recall-prompt"
          >
            {updateRecallMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
