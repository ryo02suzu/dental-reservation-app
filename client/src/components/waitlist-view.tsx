import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Clock, CheckCircle2, XCircle, Trash2, Loader2, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface WaitlistEntry {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  preferredDate?: string;
  preferredTimeFrom?: string;
  preferredTimeTo?: string;
  notes?: string;
  status: "waiting" | "notified" | "booked" | "cancelled";
  notifiedAt?: string;
  createdAt: string;
}

const statusLabels = {
  waiting: "待機中",
  notified: "通知済み",
  booked: "予約済み",
  cancelled: "キャンセル",
};

const statusColors = {
  waiting: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  notified: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  booked: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export function WaitlistView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: waitlist = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["/api/waitlist"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => 
      apiRequest("PUT", `/api/waitlist/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waitlist"] });
      toast({ title: "ステータスを更新しました" });
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/waitlist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waitlist"] });
      toast({ title: "削除しました" });
    },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border bg-background">
        <h1 className="text-2xl font-bold tracking-tight">キャンセル待ち</h1>
        <p className="text-muted-foreground text-sm mt-0.5">予約の空きを待っている患者一覧</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              キャンセル待ちリスト
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : waitlist.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mb-3 opacity-20" />
                <p>現在、キャンセル待ちの患者様はいません</p>
              </div>
            ) : (
              <Table data-testid="waitlist-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>登録日</TableHead>
                    <TableHead>患者名</TableHead>
                    <TableHead>連絡先</TableHead>
                    <TableHead>希望日</TableHead>
                    <TableHead>ステータス</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waitlist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(entry.createdAt), "yyyy/MM/dd HH:mm")}
                      </TableCell>
                      <TableCell className="font-medium">{entry.patientName}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{entry.patientPhone}</div>
                          {entry.patientEmail && <div className="text-xs text-muted-foreground">{entry.patientEmail}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.preferredDate ? format(parseISO(entry.preferredDate), "yyyy/MM/dd") : "指定なし"}
                        {(entry.preferredTimeFrom || entry.preferredTimeTo) && (
                          <div className="text-xs text-muted-foreground">
                            {entry.preferredTimeFrom?.slice(0, 5)} - {entry.preferredTimeTo?.slice(0, 5)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="secondary" className={statusColors[entry.status]}>
                            {statusLabels[entry.status]}
                          </Badge>
                          {entry.notifiedAt && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(entry.notifiedAt), "M/d HH:mm")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {entry.status === "waiting" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "notified" })}
                              title="通知済みにする"
                            >
                              通知
                            </Button>
                          )}
                          {entry.status !== "booked" && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "booked" })}
                              title="予約済みにする"
                            >
                              予約
                            </Button>
                          )}
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="text-destructive"
                            onClick={() => { if(confirm("削除しますか？")) deleteMutation.mutate(entry.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
