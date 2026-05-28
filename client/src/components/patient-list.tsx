import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, Phone, Mail, Trash2, Edit2, AlertTriangle, CalendarCheck, ArrowUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";

interface Patient {
  id: string;
  patientNumber: string;
  name: string;
  nameKana?: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  allergies?: string;
  medicalNotes?: string;
  cancellationCount: number;
  noShowCount: number;
  nextRecallDate?: string;
  recallIntervalMonths: number;
  createdAt?: string;
}

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
}

const defaultForm = {
  name: "", nameKana: "", phone: "", email: "",
  dateOfBirth: "", gender: "", address: "", allergies: "", medicalNotes: "",
};

type SortType = "number" | "kana" | "created";

export function PatientList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("number");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedRecallPatient, setSelectedRecallPatient] = useState<Patient | null>(null);
  const [nextRecallDate, setNextRecallDate] = useState("");
  const [recallInterval, setRecallInterval] = useState(6);
  const [form, setForm] = useState(defaultForm);
  const kanaReadingRef = useRef<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: patients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/patients", debouncedSearch],
    queryFn: async () => {
      const url = debouncedSearch.trim()
        ? `/api/patients?search=${encodeURIComponent(debouncedSearch.trim())}`
        : "/api/patients";
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    return [...patients].sort((a, b) => {
      if (sortBy === "number") {
        const na = parseInt((a.patientNumber || "P-9999").replace("P-", ""), 10);
        const nb = parseInt((b.patientNumber || "P-9999").replace("P-", ""), 10);
        return na - nb;
      }
      if (sortBy === "kana") {
        return (a.nameKana || a.name).localeCompare(b.nameKana || b.name, "ja");
      }
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });
  }, [patients, sortBy]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (editingPatient) {
        return apiRequest("PUT", `/api/patients/${editingPatient.id}`, data);
      }
      return apiRequest("POST", "/api/patients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({ title: editingPatient ? "患者情報を更新しました" : "患者を登録しました" });
      setIsDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/patients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({ title: "患者を削除しました" });
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
      toast({ title: "リコール設定を更新しました" });
      setSelectedRecallPatient(null);
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const openRecallSettings = (p: Patient) => {
    setSelectedRecallPatient(p);
    setNextRecallDate(p.nextRecallDate || "");
    setRecallInterval(p.recallIntervalMonths || 6);
  };

  const openCreate = () => {
    setEditingPatient(null);
    setForm(defaultForm);
    setIsDialogOpen(true);
  };

  const openEdit = (p: Patient) => {
    setEditingPatient(p);
    setForm({
      name: p.name, nameKana: p.nameKana || "", phone: p.phone || "",
      email: p.email || "", dateOfBirth: p.dateOfBirth || "", gender: p.gender || "",
      address: p.address || "", allergies: p.allergies || "", medicalNotes: p.medicalNotes || "",
    });
    setIsDialogOpen(true);
  };

  const isHighRisk = (p: Patient) => (p.cancellationCount || 0) + (p.noShowCount || 0) >= 3;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">患者一覧</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{patients.length}名登録済み</p>
        </div>
        <Button onClick={openCreate} data-testid="button-add-patient">
          <Plus className="h-4 w-4 mr-1" />
          新規患者登録
        </Button>
      </div>

      <div className="px-4 md:px-6 py-3 border-b border-border flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="患者名・カナ・番号・電話番号で検索"
            value={search}
            onChange={e => setSearch(e.target.value)}
            data-testid="input-patient-search"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortType)}>
            <SelectTrigger className="h-9 w-36 text-sm" data-testid="select-sort-patients">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">患者番号順</SelectItem>
              <SelectItem value="kana">五十音順</SelectItem>
              <SelectItem value="created">登録日順</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="p-4 md:p-6 space-y-3">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Users className="h-12 w-12 mb-3 opacity-30" />
            <p>{search ? "検索結果が見つかりません" : "患者が登録されていません"}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">患者番号</TableHead>
                <TableHead>氏名</TableHead>
                <TableHead className="hidden md:table-cell">生年月日 / 年齢</TableHead>
                <TableHead className="hidden sm:table-cell">連絡先</TableHead>
                <TableHead className="hidden lg:table-cell">キャンセル履歴</TableHead>
                <TableHead className="w-20">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const age = calcAge(p.dateOfBirth);
                const risk = isHighRisk(p);
                return (
                  <TableRow key={p.id} className="group" data-testid={`patient-row-${p.id}`}>
                    <TableCell className="font-mono text-sm">{p.patientNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {p.name}
                            {risk && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                          </div>
                          {p.nameKana && <div className="text-xs text-muted-foreground">{p.nameKana}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {p.dateOfBirth ? `${p.dateOfBirth}（${age}歳）` : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="space-y-0.5">
                        {p.phone && <div className="text-sm flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</div>}
                        {p.email && <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {risk ? (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          キャンセル{p.cancellationCount}回・無断{p.noShowCount}回
                        </span>
                      ) : (
                        <span className="text-muted-foreground">問題なし</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openRecallSettings(p)}
                          title="リコール設定"
                          data-testid={`button-recall-settings-${p.id}`}
                        >
                          <CalendarCheck className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(p)} data-testid={`edit-patient-${p.id}`}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => { if (confirm("削除しますか？")) deleteMutation.mutate(p.id); }}
                          data-testid={`delete-patient-${p.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={v => !v && setIsDialogOpen(false)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPatient ? "患者情報の編集" : "新規患者登録"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* 氏名 ＆ カナ */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">氏名 *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  onCompositionUpdate={e => {
                    const kanaOnly = e.data.replace(/[^\u3041-\u3096\u30a1-\u30f6ー\s　]/g, "").trim();
                    if (kanaOnly) kanaReadingRef.current = kanaOnly;
                  }}
                  onCompositionEnd={e => {
                    const r = kanaReadingRef.current;
                    if (r) {
                      const k = r.replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
                      setForm(p => ({ ...p, nameKana: p.nameKana ? p.nameKana.trim() + "　" + k : k }));
                    }
                    kanaReadingRef.current = "";
                  }}
                  placeholder="山田 太郎"
                  data-testid="input-name"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">カナ</Label>
                <Input value={form.nameKana} onChange={e => setForm(p => ({ ...p, nameKana: e.target.value }))} placeholder="ヤマダ タロウ" />
              </div>
            </div>
            {/* 生年月日 ＆ 性別 — flexで幅を自動配分 */}
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <Label className="mb-1.5 block text-sm">生年月日</Label>
                <Input type="date" value={form.dateOfBirth} onChange={e => setForm(p => ({ ...p, dateOfBirth: e.target.value }))} className="w-full" />
              </div>
              <div className="w-28 shrink-0">
                <Label className="mb-1.5 block text-sm">性別</Label>
                <Select value={form.gender} onValueChange={v => setForm(p => ({ ...p, gender: v }))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男性</SelectItem>
                    <SelectItem value="female">女性</SelectItem>
                    <SelectItem value="other">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* 電話番号 ＆ メール */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-sm">電話番号</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="090-0000-0000" />
              </div>
              <div>
                <Label className="mb-1.5 block text-sm">メールアドレス</Label>
                <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="email@example.com" />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">住所</Label>
              <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="東京都渋谷区..." />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">アレルギー・禁忌</Label>
              <Input value={form.allergies} onChange={e => setForm(p => ({ ...p, allergies: e.target.value }))} placeholder="例: ペニシリン、ラテックス" />
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">備考・既往歴</Label>
              <Textarea value={form.medicalNotes} onChange={e => setForm(p => ({ ...p, medicalNotes: e.target.value }))} rows={3} placeholder="既往歴や注意事項" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>キャンセル</Button>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || saveMutation.isPending} data-testid="button-save-patient">
                {saveMutation.isPending ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recall Settings Dialog */}
      <Dialog open={!!selectedRecallPatient} onOpenChange={(open) => !open && setSelectedRecallPatient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>リコール設定: {selectedRecallPatient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="next-recall-date">次回リコール予定日</Label>
              <Input 
                id="next-recall-date"
                type="date" 
                value={nextRecallDate} 
                onChange={(e) => setNextRecallDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recall-interval">リコール間隔（ヶ月）</Label>
              <Input 
                id="recall-interval"
                type="number" 
                min="1"
                max="24"
                value={recallInterval} 
                onChange={(e) => setRecallInterval(parseInt(e.target.value) || 6)} 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setSelectedRecallPatient(null)}>キャンセル</Button>
            <Button 
              onClick={() => updateRecallMutation.mutate({ 
                id: selectedRecallPatient!.id, 
                nextRecallDate, 
                recallIntervalMonths: recallInterval 
              })}
              disabled={updateRecallMutation.isPending}
              data-testid="button-save-recall"
            >
              保存
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Users({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
