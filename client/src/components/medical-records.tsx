import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, StickyNote, X, Phone, User, Hash, ChevronRight, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Patient {
  id: string;
  name: string;
  nameKana?: string;
  patientNumber: string;
  phone?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
}
interface Staff { id: string; name: string; role: string }
interface MedicalRecord {
  id: string;
  date: string;
  notes?: string;
  patientId?: string;
  staffId?: string;
  patient?: Patient;
  staff?: Staff;
}

function normalize(str: string) { return str.replace(/[\s\-]/g, "").toLowerCase(); }
function kataToHira(str: string) { return str.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)); }
function hiraToKata(str: string) { return str.replace(/[\u3041-\u3096]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60)); }

function PatientCombobox({ patients, value, onChange }: { patients: Patient[]; value: string; onChange: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const selected = patients.find(p => p.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const raw = normalize(search);
    const hira = normalize(kataToHira(search));
    const kata = normalize(hiraToKata(search));
    const phoneQ = search.replace(/\D/g, "");
    const matched = patients.filter(p => {
      const name = normalize(p.name);
      const kana = normalize(p.nameKana || "");
      const num = (p.patientNumber || "").toLowerCase();
      return [raw, hira, kata].some(v => name.includes(v) || kana.includes(v) || num.includes(v))
        || (phoneQ.length >= 4 && (p.phone || "").replace(/\D/g, "").includes(phoneQ));
    });
    const score = (p: Patient) => {
      const name = normalize(p.name);
      const kana = normalize(p.nameKana || "");
      for (const v of [raw, hira, kata]) {
        if (name === v || kana === v) return 0;
        if (name.startsWith(v) || kana.startsWith(v)) return 1;
      }
      return 2;
    };
    return matched.sort((a, b) => score(a) - score(b)).slice(0, 8);
  }, [patients, search]);

  if (selected) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border border-border rounded-md bg-accent/50">
        <div className="text-sm">
          <span className="font-medium">{selected.name}</span>
          <span className="text-muted-foreground ml-2 text-xs">{selected.patientNumber}</span>
        </div>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => { onChange(""); setSearch(""); }}>
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input className="pl-9" placeholder="患者名・カナ・患者番号で検索" value={search}
        onChange={e => setSearch(e.target.value)} data-testid="input-memo-patient-search" autoComplete="off" />
      {search && filtered.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full border border-border rounded-md shadow-md bg-popover divide-y divide-border max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent transition-colors text-sm"
              onMouseDown={e => { e.preventDefault(); onChange(p.id); setSearch(""); }}>
              <span className="font-medium">{p.name}</span>
              {p.nameKana && <span className="text-muted-foreground ml-2 text-xs">{p.nameKana}</span>}
              <span className="text-muted-foreground ml-2 text-xs">{p.patientNumber}</span>
            </button>
          ))}
        </div>
      )}
      {search && filtered.length === 0 && (
        <div className="absolute z-50 top-full mt-1 w-full border border-border rounded-md shadow-md bg-popover px-3 py-2 text-sm text-muted-foreground">
          該当する患者が見つかりません
        </div>
      )}
    </div>
  );
}

function PatientPanel({
  patient, records, staff, onClose, onAddMemo, onDeleteRecord,
}: {
  patient: Patient;
  records: MedicalRecord[];
  staff: Staff[];
  onClose: () => void;
  onAddMemo: (patientId: string) => void;
  onDeleteRecord: (id: string) => void;
}) {
  const patientRecords = records
    .filter(r => r.patientId === patient.id || r.patient?.id === patient.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* ヘッダー */}
      <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-base leading-tight truncate">{patient.name}</div>
            {patient.nameKana && <div className="text-xs text-muted-foreground">{patient.nameKana}</div>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onClose} data-testid="button-close-patient-panel">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* 患者情報 */}
      <div className="px-5 py-4 border-b border-border shrink-0 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">患者番号</span>
          <span className="font-medium ml-auto">{patient.patientNumber || "—"}</span>
        </div>
        {patient.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">電話番号</span>
            <a href={`tel:${patient.phone}`} className="font-medium ml-auto text-primary hover:underline" data-testid="link-patient-phone">
              {patient.phone}
            </a>
          </div>
        )}
        {patient.dateOfBirth && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground ml-5">生年月日</span>
            <span className="font-medium ml-auto">{patient.dateOfBirth}</span>
          </div>
        )}
      </div>

      {/* メモ履歴 */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">受付メモ履歴 ({patientRecords.length}件)</span>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onAddMemo(patient.id)} data-testid="button-add-memo-from-panel">
            <Plus className="h-3.5 w-3.5 mr-1" />
            追加
          </Button>
        </div>

        {patientRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-5">
            <StickyNote className="h-10 w-10 mb-2 opacity-25" />
            <p className="text-sm">この患者のメモはありません</p>
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-3">
            {patientRecords.map(r => {
              const staffName = staff.find(s => s.id === r.staffId)?.name || r.staff?.name;
              return (
                <div key={r.id} className="rounded-lg border border-border bg-card p-3 group" data-testid={`panel-record-${r.id}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{r.date}</span>
                      {staffName && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{staffName}</span>
                      )}
                    </div>
                    {confirmDeleteId === r.id ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-red-600">削除しますか？</span>
                        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={() => { onDeleteRecord(r.id); setConfirmDeleteId(null); }}>
                          はい
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>
                          いいえ
                        </Button>
                      </div>
                    ) : (
                      <Button size="icon" variant="ghost" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setConfirmDeleteId(r.id)} data-testid={`button-delete-record-${r.id}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-line leading-relaxed">{r.notes || <span className="text-muted-foreground italic">メモなし</span>}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function MedicalRecords() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [form, setForm] = useState({
    patientId: "", staffId: "",
    date: new Date().toISOString().split("T")[0],
    notes: "", diagnosis: "", treatment: "", treatmentDetails: "", toothNumber: "", cost: 0,
  });
  const { data: records = [], isLoading } = useQuery<MedicalRecord[]>({ queryKey: ["/api/medical-records"] });
  const { data: patients = [] } = useQuery<Patient[]>({ queryKey: ["/api/patients"] });
  const { data: staff = [] } = useQuery<Staff[]>({ queryKey: ["/api/staff"] });

  const selectedPatient = patients.find(p => p.id === selectedPatientId) ?? null;

  const patientRows = useMemo(() => {
    const map = new Map<string, { patient: Patient; latestDate: string; latestNotes: string; count: number; latestStaff?: Staff }>();
    for (const r of records) {
      const pid = r.patient?.id ?? r.patientId ?? "__no_patient__";
      const existing = map.get(pid);
      if (!existing || r.date > existing.latestDate) {
        map.set(pid, {
          patient: r.patient ?? { id: pid, name: "—", patientNumber: "" } as Patient,
          latestDate: r.date,
          latestNotes: r.notes ?? "",
          count: (existing?.count ?? 0) + 1,
          latestStaff: r.staff,
        });
      } else {
        existing.count += 1;
      }
    }
    const rows = Array.from(map.values()).sort((a, b) => b.latestDate.localeCompare(a.latestDate));
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(row =>
      (row.patient.name || "").toLowerCase().includes(q) ||
      (row.patient.patientNumber || "").toLowerCase().includes(q) ||
      (row.latestNotes || "").toLowerCase().includes(q)
    );
  }, [records, search]);

  const resetForm = (patientId = "") => setForm({
    patientId, staffId: "",
    date: new Date().toISOString().split("T")[0],
    notes: "", diagnosis: "", treatment: "", treatmentDetails: "", toothNumber: "", cost: 0,
  });

  const openAddMemo = (patientId = "") => {
    resetForm(patientId);
    setIsDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => apiRequest("POST", "/api/medical-records", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-records"] });
      toast({ title: "受付メモを保存しました" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/medical-records/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/medical-records"] });
      toast({ title: "メモを削除しました" });
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const panelOpen = !!selectedPatient;

  return (
    <div className="flex h-full overflow-hidden">
      {/* メインリスト */}
      <div className={`flex flex-col min-w-0 transition-all duration-300 ${panelOpen ? "flex-[1] hidden md:flex" : "flex-1"}`}>
        <div className="px-4 md:px-6 py-4 border-b border-border bg-background flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">受付メモ</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{patientRows.length}人 / {records.length}件 — 来院時の申し送り・次回予定などを記録</p>
          </div>
          <Button onClick={() => openAddMemo()} data-testid="button-add-record">
            <Plus className="h-4 w-4 mr-1" />
            メモを追加
          </Button>
        </div>

        <div className="px-4 md:px-6 py-3 border-b border-border">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="患者名・メモ内容で検索" value={search}
              onChange={e => setSearch(e.target.value)} data-testid="input-record-search" />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
          ) : patientRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <StickyNote className="h-12 w-12 mb-3 opacity-30" />
              <p>{search ? "検索結果が見つかりません" : "受付メモがありません"}</p>
              <p className="text-xs mt-1">来院時の申し送りや次回予定を記録できます</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">最終更新</TableHead>
                  <TableHead>患者</TableHead>
                  <TableHead className="hidden md:table-cell w-24">担当</TableHead>
                  <TableHead>最新メモ</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientRows.map(row => {
                  const isSelected = row.patient.id === selectedPatientId;
                  return (
                    <TableRow
                      key={row.patient.id}
                      className={`cursor-pointer transition-colors hover:bg-accent/60 ${isSelected ? "bg-primary/5 hover:bg-primary/10" : ""}`}
                      onClick={() => setSelectedPatientId(row.patient.id)}
                      data-testid={`record-row-${row.patient.id}`}
                    >
                      <TableCell className="text-sm font-mono text-muted-foreground">{row.latestDate}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{row.patient.name || "—"}</div>
                          {row.count > 1 && (
                            <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">{row.count}件</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">{row.patient.patientNumber}</div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{row.latestStaff?.name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[240px]">
                        <p className="line-clamp-2 whitespace-pre-line">{row.latestNotes || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* 患者パネル（スライドイン） */}
      {panelOpen && (
        <>
          {/* モバイル：全画面オーバーレイ */}
          <div className="fixed inset-0 z-40 md:hidden bg-background flex flex-col">
            <PatientPanel
              patient={selectedPatient!}
              records={records}
              staff={staff}
              onClose={() => setSelectedPatientId(null)}
              onAddMemo={openAddMemo}
              onDeleteRecord={id => deleteMutation.mutate(id)}
            />
          </div>
          {/* デスクトップ：右側パネル */}
          <div className="hidden md:flex flex-col w-80 lg:w-96 shrink-0 border-l border-border overflow-hidden">
            <PatientPanel
              patient={selectedPatient!}
              records={records}
              staff={staff}
              onClose={() => setSelectedPatientId(null)}
              onAddMemo={openAddMemo}
              onDeleteRecord={id => deleteMutation.mutate(id)}
            />
          </div>
        </>
      )}

      {/* 新規メモ追加ダイアログ */}
      <Dialog open={isDialogOpen} onOpenChange={v => !v && setIsDialogOpen(false)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>受付メモを追加</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block text-sm">患者 <span className="text-red-500">*</span></Label>
              <PatientCombobox patients={patients} value={form.patientId} onChange={v => setForm(p => ({ ...p, patientId: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">担当者</Label>
                <Select value={form.staffId} onValueChange={v => setForm(p => ({ ...p, staffId: v }))}>
                  <SelectTrigger><SelectValue placeholder="担当者を選択" /></SelectTrigger>
                  <SelectContent>
                    {staff.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">日付</Label>
                <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">メモ</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={4}
                placeholder={"例：次回は親知らず抜歯予定\n痛み訴えあり、至急対応\n次回は月曜希望"} data-testid="input-diagnosis" />
              <p className="text-xs text-muted-foreground mt-1">来院時の申し送り・次回予定・患者からの要望など</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.patientId || saveMutation.isPending} data-testid="button-save-record">
                {saveMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
