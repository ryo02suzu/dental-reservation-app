import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, differenceInDays } from "date-fns";
import { ja } from "date-fns/locale";
import { Bell, Calendar, Settings2, Loader2, SendHorizonal, CheckCircle2, AlertCircle, Mail, MailX, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { usePlan } from "@/hooks/use-plan";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Patient {
  id: string;
  name: string;
  email?: string;
  phone: string;
  lastVisitDate?: string;
  nextRecallDate?: string;
  recallIntervalMonths: number;
  lastRecallSentAt?: string;
}

function RecallLocked() {
  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-xl font-bold tracking-tight">リコール管理</h1>
          <Lock className="w-4 h-4 text-muted-foreground ml-1" />
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">定期来院の促進・再診管理</p>
      </div>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">プロプランで利用可能</h2>
          <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
            リコール管理機能で定期検診の未来院患者へ自動メールを送り、
            再診率を向上させましょう。プロプランにアップグレードしてご活用ください。
          </p>
          <div className="bg-muted/50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm font-medium mb-3">リコール管理でできること</p>
            {["定期来院の未来院患者を自動抽出", "リコールメールのワンクリック送信", "リコール間隔の個別設定（3〜12ヶ月）", "最終来院日・次回来院予定の管理", "送信履歴の確認"].map(f => (
              <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <Button asChild className="w-full">
            <Link href="/contact">プロプランへのアップグレードを相談する</Link>
          </Button>
          <p className="text-xs text-muted-foreground mt-3">プロプラン ¥9,800/月</p>
        </div>
      </div>
    </div>
  );
}

export function RecallView() {
  const { canRecall } = usePlan();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [nextRecallDate, setNextRecallDate] = useState("");
  const [recallInterval, setRecallInterval] = useState(6);
  const [filter, setFilter] = useState<"all" | "unsent" | "sent">("all");

  const { data: recallPatients = [], isLoading } = useQuery<Patient[]>({
    queryKey: ["/api/recall"],
    enabled: canRecall,
  });

  const sendRecallMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/recall/${id}/send`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall"] });
      toast({ title: "通知を送信しました" });
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const bulkSendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/recall/send-bulk");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall"] });
      toast({ title: data.message || "一括送信しました" });
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const updateRecallMutation = useMutation({
    mutationFn: (data: { id: string; nextRecallDate: string; recallIntervalMonths: number }) =>
      apiRequest("PUT", `/api/patients/${data.id}/recall`, {
        nextRecallDate: data.nextRecallDate,
        recallIntervalMonths: data.recallIntervalMonths,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recall"] });
      queryClient.invalidateQueries({ queryKey: ["/api/patients"] });
      toast({ title: "リコール設定を更新しました" });
      setSelectedPatient(null);
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const openSettings = (p: Patient) => {
    setSelectedPatient(p);
    setNextRecallDate(p.nextRecallDate || "");
    setRecallInterval(p.recallIntervalMonths || 6);
  };

  const unsentCount = recallPatients.filter(p => !p.lastRecallSentAt).length;
  const sentCount = recallPatients.filter(p => !!p.lastRecallSentAt).length;

  const filtered = recallPatients.filter(p => {
    if (filter === "unsent") return !p.lastRecallSentAt;
    if (filter === "sent") return !!p.lastRecallSentAt;
    return true;
  });

  const getDaysInfo = (p: Patient) => {
    if (!p.nextRecallDate) return null;
    const days = differenceInDays(parseISO(p.nextRecallDate), new Date());
    if (days < 0) return { label: `${Math.abs(days)}日超過`, cls: "text-red-600 dark:text-red-400 font-semibold" };
    if (days <= 7) return { label: `あと${days}日`, cls: "text-amber-600 dark:text-amber-400 font-semibold" };
    return { label: `あと${days}日`, cls: "text-muted-foreground" };
  };

  if (!canRecall) return <RecallLocked />;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-background">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">リコール管理</h1>
            <p className="text-muted-foreground text-sm mt-0.5">定期検診の案内が必要な患者一覧</p>
          </div>
          {unsentCount > 0 && (
            <Button
              onClick={() => {
                if (confirm(`未送信の${unsentCount}名にリコール通知を一括送信しますか？`)) bulkSendMutation.mutate();
              }}
              disabled={bulkSendMutation.isPending}
              data-testid="button-bulk-send-recall"
            >
              {bulkSendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <SendHorizonal className="h-4 w-4 mr-2" />
              )}
              未送信 {unsentCount}名に一括送信
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  案内対象者（30日以内または超過）
                </CardTitle>
                <CardDescription className="mt-1">
                  次回の定期検診予定日が近づいている、または過ぎている患者様です。
                </CardDescription>
              </div>
              <div className="flex border border-border rounded-md overflow-hidden shrink-0">
                {([
                  { key: "all", label: `すべて (${recallPatients.length})` },
                  { key: "unsent", label: `未送信 (${unsentCount})` },
                  { key: "sent", label: `送信済み (${sentCount})` },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === key ? "bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-accent"}`}
                    onClick={() => setFilter(key)}
                    data-testid={`recall-filter-${key}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mb-3 opacity-20" />
                <p>
                  {filter === "unsent" ? "未送信の患者様はいません" :
                   filter === "sent" ? "送信済みの患者様はいません" :
                   "現在、案内対象の患者様はいません"}
                </p>
              </div>
            ) : (
              <Table data-testid="recall-list">
                <TableHeader>
                  <TableRow>
                    <TableHead>患者名</TableHead>
                    <TableHead>最終来院</TableHead>
                    <TableHead>次回予定</TableHead>
                    <TableHead>通知状況</TableHead>
                    <TableHead>メール</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => {
                    const daysInfo = getDaysInfo(p);
                    const hasSent = !!p.lastRecallSentAt;
                    return (
                      <TableRow key={p.id} data-testid={`recall-row-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {p.lastVisitDate ? format(parseISO(p.lastVisitDate), "yyyy/MM/dd") : "—"}
                        </TableCell>
                        <TableCell>
                          {p.nextRecallDate ? (
                            <div>
                              <div className="text-sm">{format(parseISO(p.nextRecallDate), "yyyy/MM/dd")}</div>
                              {daysInfo && <div className={`text-xs ${daysInfo.cls}`}>{daysInfo.label}</div>}
                            </div>
                          ) : <span className="text-muted-foreground text-sm">未設定</span>}
                        </TableCell>
                        <TableCell>
                          {hasSent ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                              <div>
                                <div className="text-xs font-medium text-green-700 dark:text-green-400">送信済み</div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(p.lastRecallSentAt!), "M/d HH:mm", { locale: ja })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">未送信</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {p.email ? (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 text-green-500 shrink-0" />
                              <span className="truncate max-w-[130px]">{p.email}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MailX className="h-3 w-3 text-red-400 shrink-0" />
                              <span>未登録</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!hasSent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendRecallMutation.mutate(p.id)}
                                disabled={sendRecallMutation.isPending}
                                data-testid={`button-send-recall-${p.id}`}
                              >
                                {sendRecallMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3 mr-1" />}
                                送信
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openSettings(p)}
                              data-testid={`button-recall-settings-${p.id}`}
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>リコール設定: {selectedPatient?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="next-date">次回リコール予定日</Label>
              <Input
                id="next-date"
                type="date"
                value={nextRecallDate}
                onChange={(e) => setNextRecallDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interval">リコール間隔（ヶ月）</Label>
              <Input
                id="interval"
                type="number"
                min="1"
                max="24"
                value={recallInterval}
                onChange={(e) => setRecallInterval(parseInt(e.target.value) || 6)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPatient(null)}>キャンセル</Button>
            <Button
              onClick={() => updateRecallMutation.mutate({
                id: selectedPatient!.id,
                nextRecallDate,
                recallIntervalMonths: recallInterval,
              })}
              disabled={updateRecallMutation.isPending}
              data-testid="button-save-recall"
            >
              {updateRecallMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
