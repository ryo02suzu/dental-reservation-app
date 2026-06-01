import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Plus, Trash2, Pencil, MessageCircle, Copy, ExternalLink, Inbox } from "lucide-react";
import type { FollowUpTemplate, ReviewSettings, ReviewResponse, TreatmentPlan, Service } from "@shared/schema";

// ════════════════════════════════════════════════════════════════════════════
// 機能1: LINE自動フォローアップ＆リコール設定
// ════════════════════════════════════════════════════════════════════════════
export function FollowUpTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: templates, isLoading } = useQuery<FollowUpTemplate[]>({ queryKey: ["/api/follow-up-templates"] });
  const { data: services } = useQuery<Service[]>({ queryKey: ["/api/services"] });
  const [editing, setEditing] = useState<Partial<FollowUpTemplate> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<FollowUpTemplate>) =>
      data.id ? apiRequest("PUT", `/api/follow-up-templates/${data.id}`, data)
              : apiRequest("POST", "/api/follow-up-templates", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/follow-up-templates"] }); setEditing(null); toast({ title: "保存しました" }); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/follow-up-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/follow-up-templates"] }); toast({ title: "削除しました" }); },
  });

  const serviceName = (id?: string | null) => id ? (services?.find(s => s.id === id)?.name ?? "（不明なメニュー）") : "既定（すべてのメニュー）";

  function newTemplate() {
    setEditing({
      name: "", kind: "checkup", enabled: true,
      serviceId: null,
      followUpEnabled: true, followUpDelayHours: 24, followUpSendAtTime: "18:00", followUpMessage: "",
      recallEnabled: false, recallDelayMonths: 6, recallSendAtTime: "10:00", recallMessage: "",
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" />自動フォローアップ＆リコール</CardTitle>
            <CardDescription>予約を「完了」にすると、メニューに応じてLINE（未連携時はメール）で自動フォローします。スタッフの追加操作は不要です。</CardDescription>
          </div>
          <Button onClick={newTemplate} size="sm" data-testid="button-new-followup"><Plus className="w-4 h-4 mr-1" />テンプレート追加</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40" /> : (
          <div className="space-y-3">
            {(!templates || templates.length === 0) && !editing && (
              <div className="text-center py-10 text-muted-foreground">
                <MessageCircle className="h-9 w-9 mx-auto mb-2 opacity-25" />
                <p className="text-sm">まだテンプレートがありません</p>
                <p className="text-xs mt-1">「テンプレート追加」からメニュー別の自動フォロー設定を作成してください。</p>
              </div>
            )}
            {templates?.map(t => (
              <div key={t.id} className="border rounded-lg p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{t.name || serviceName(t.serviceId)}</span>
                    <Badge variant={t.enabled ? "default" : "secondary"}>{t.enabled ? "有効" : "無効"}</Badge>
                    <Badge variant="outline">{t.kind === "surgical" ? "外科・抜歯系" : "検診・クリーニング系"}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">対象: {serviceName(t.serviceId)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.followUpEnabled && `フォロー: 完了${t.followUpDelayHours}時間後 ${t.followUpSendAtTime}`}
                    {t.followUpEnabled && t.recallEnabled && " / "}
                    {t.recallEnabled && `リコール: ${t.recallDelayMonths}ヶ月後 ${t.recallSendAtTime}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
            ))}

            {editing && (
              <div className="border-2 border-primary/30 rounded-lg p-4 space-y-4 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm mb-1.5 block">テンプレート名</Label>
                    <Input className="h-10" value={editing.name ?? ""} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} placeholder="例: 抜歯後フォロー" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">対象メニュー</Label>
                    <Select value={editing.serviceId ?? "all"} onValueChange={v => setEditing(p => ({ ...p!, serviceId: v === "all" ? null : v }))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">既定（すべてのメニュー）</SelectItem>
                        {services?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">種別</Label>
                    <Select value={editing.kind ?? "checkup"} onValueChange={v => setEditing(p => ({ ...p!, kind: v }))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="surgical">外科・抜歯系（翌日に容体確認）</SelectItem>
                        <SelectItem value="checkup">検診・クリーニング系（お礼＋リコール）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3 pt-7">
                    <Switch checked={!!editing.enabled} onCheckedChange={v => setEditing(p => ({ ...p!, enabled: v }))} id="fu-enabled" />
                    <Label htmlFor="fu-enabled">このテンプレートを有効にする</Label>
                  </div>
                </div>

                {/* フォローアップ */}
                <div className="border-t pt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={!!editing.followUpEnabled} onCheckedChange={v => setEditing(p => ({ ...p!, followUpEnabled: v }))} id="fu-follow" />
                    <Label htmlFor="fu-follow" className="font-semibold">フォローアップを送る</Label>
                  </div>
                  {editing.followUpEnabled && (
                    <div className="pl-2 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm mb-1.5 block">完了から何時間後</Label>
                          <Input type="number" min={0} className="h-10" value={editing.followUpDelayHours ?? 24} onChange={e => setEditing(p => ({ ...p!, followUpDelayHours: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <Label className="text-sm mb-1.5 block">送信時刻</Label>
                          <Input type="time" className="h-10" value={editing.followUpSendAtTime ?? "18:00"} onChange={e => setEditing(p => ({ ...p!, followUpSendAtTime: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">メッセージ（空欄なら既定文を使用。{"{patientName}"} {"{clinicName}"} が使えます）</Label>
                        <Textarea rows={3} value={editing.followUpMessage ?? ""} onChange={e => setEditing(p => ({ ...p!, followUpMessage: e.target.value }))}
                          placeholder="昨日はお疲れ様でした。お痛みや出血は落ち着きましたか？" />
                      </div>
                    </div>
                  )}
                </div>

                {/* リコール */}
                <div className="border-t pt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={!!editing.recallEnabled} onCheckedChange={v => setEditing(p => ({ ...p!, recallEnabled: v }))} id="fu-recall" />
                    <Label htmlFor="fu-recall" className="font-semibold">数ヶ月後にリコールを送る</Label>
                  </div>
                  {editing.recallEnabled && (
                    <div className="pl-2 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm mb-1.5 block">何ヶ月後</Label>
                          <Input type="number" min={1} className="h-10" value={editing.recallDelayMonths ?? 6} onChange={e => setEditing(p => ({ ...p!, recallDelayMonths: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <Label className="text-sm mb-1.5 block">送信時刻</Label>
                          <Input type="time" className="h-10" value={editing.recallSendAtTime ?? "10:00"} onChange={e => setEditing(p => ({ ...p!, recallSendAtTime: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">リコールメッセージ（空欄なら既定文）</Label>
                        <Textarea rows={3} value={editing.recallMessage ?? ""} onChange={e => setEditing(p => ({ ...p!, recallMessage: e.target.value }))}
                          placeholder="定期検診の時期になりました。お口の健康維持のためご予約をお待ちしております。" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button className="h-10" onClick={() => saveMutation.mutate(editing)} disabled={saveMutation.isPending || !editing.name}>保存</Button>
                  <Button className="h-10" variant="outline" onClick={() => setEditing(null)}>キャンセル</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 機能2: スマート口コミ誘導＆不満吸収
// ════════════════════════════════════════════════════════════════════════════
export function ReviewTab({ clinicSlug }: { clinicSlug?: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery<ReviewSettings>({ queryKey: ["/api/review-settings"] });
  const { data: responses } = useQuery<ReviewResponse[]>({ queryKey: ["/api/review-responses"] });
  const [form, setForm] = useState<Partial<ReviewSettings> | null>(null);
  const f = form ?? settings ?? {};

  const saveMutation = useMutation({
    mutationFn: (data: Partial<ReviewSettings>) => apiRequest("PUT", "/api/review-settings", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/review-settings"] }); toast({ title: "保存しました" }); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });
  const readMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/review-responses/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/review-responses"] }),
  });

  const reviewUrl = clinicSlug ? `${window.location.origin}/review/${clinicSlug}` : "";
  const upd = (patch: Partial<ReviewSettings>) => setForm({ ...f, ...patch });

  const feedbacks = responses?.filter(r => !r.routedToGoogle && r.feedback) ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Star className="w-5 h-5" />口コミ誘導＆ご意見の吸収</CardTitle>
          <CardDescription>高評価の患者さんはGoogle口コミへ、それ未満の方は院長直通の匿名フォームへ誘導します。</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64" /> : (
            <div className="space-y-5 max-w-xl">
              {reviewUrl && (
                <div className="bg-muted/40 border rounded-lg p-4">
                  <Label className="text-sm mb-1.5 block text-muted-foreground">患者用アンケートURL（QRコードやLINEに設置）</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={reviewUrl} className="h-10 text-sm" />
                    <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => { navigator.clipboard.writeText(reviewUrl); toast({ title: "URLをコピーしました" }); }}>
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-10 w-10 shrink-0" onClick={() => window.open(reviewUrl, "_blank")}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Switch checked={!!f.enabled} onCheckedChange={v => upd({ enabled: v })} id="rv-enabled" />
                <Label htmlFor="rv-enabled">アンケートを受け付ける</Label>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Google誘導の閾値（この星数以上でGoogleへ）</Label>
                <Select value={String(f.threshold ?? 4)} onValueChange={v => upd({ threshold: Number(v) })}>
                  <SelectTrigger className="h-10 max-w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>★{n} 以上</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">Googleマップ 口コミ投稿用URL</Label>
                <Input className="h-10" value={f.googleReviewUrl ?? ""} onChange={e => upd({ googleReviewUrl: e.target.value })}
                  placeholder="https://g.page/r/..." />
                <p className="text-xs text-muted-foreground mt-1.5">Googleビジネスプロフィールの「クチコミを書く」リンクを貼り付けてください。</p>
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">見出し</Label>
                <Input className="h-10" value={f.headline ?? ""} onChange={e => upd({ headline: e.target.value })} />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">高評価時のメッセージ</Label>
                <Textarea rows={2} value={f.positiveMessage ?? ""} onChange={e => upd({ positiveMessage: e.target.value })} />
              </div>
              <div>
                <Label className="text-sm mb-1.5 block">低評価時のメッセージ（匿名フォームの案内）</Label>
                <Textarea rows={2} value={f.negativeMessage ?? ""} onChange={e => upd({ negativeMessage: e.target.value })} />
              </div>
              <Button className="h-10" onClick={() => saveMutation.mutate(f)} disabled={saveMutation.isPending}>保存</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>院長直通・匿名のご意見</CardTitle>
          <CardDescription>低評価の方から届いた改善のご意見です。</CardDescription>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Inbox className="h-9 w-9 mx-auto mb-2 opacity-25" />
              <p className="text-sm">まだご意見はありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feedbacks.map(r => (
                <div key={r.id} className={`border rounded-lg p-4 ${!r.isRead ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200" : ""}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(v => <Star key={v} className={`w-3.5 h-3.5 ${v <= (r.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />)}
                      {!r.isRead && <Badge variant="default" className="ml-1 text-[10px]">未読</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleString("ja-JP") : ""}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.feedback}</p>
                  {!r.isRead && (
                    <Button size="sm" variant="ghost" className="mt-2 h-7 text-xs" onClick={() => readMutation.mutate(r.id)}>既読にする</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 機能3: 自費診療プラン（比較表カード）の管理
// ════════════════════════════════════════════════════════════════════════════
export function TreatmentPlansTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: plans, isLoading } = useQuery<TreatmentPlan[]>({ queryKey: ["/api/treatment-plans"] });
  const [editing, setEditing] = useState<Partial<TreatmentPlan> | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<TreatmentPlan>) =>
      data.id ? apiRequest("PUT", `/api/treatment-plans/${data.id}`, data)
              : apiRequest("POST", "/api/treatment-plans", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/treatment-plans"] }); setEditing(null); toast({ title: "保存しました" }); },
    onError: (e: any) => toast({ title: "エラー", description: e.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/treatment-plans/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/treatment-plans"] }); toast({ title: "削除しました" }); },
  });

  function newPlan() {
    setEditing({ name: "", category: "general", material: "", price: 0, durationLabel: "", description: "",
      merits: [], demerits: [], isInsurance: false, isRecommended: false, isActive: true });
  }
  const setArr = (key: "merits" | "demerits", text: string) =>
    setEditing(p => ({ ...p!, [key]: text.split("\n").map(s => s.trim()).filter(Boolean) }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>自費診療プラン（カウンセリング比較表）</CardTitle>
            <CardDescription>カウンセリングモードで患者さんに見せる比較表のカードを登録します。</CardDescription>
          </div>
          <Button onClick={newPlan} size="sm"><Plus className="w-4 h-4 mr-1" />プラン追加</Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40" /> : (
          <div className="space-y-3">
            {(!plans || plans.length === 0) && !editing && (
              <div className="text-center py-10 text-muted-foreground">
                <Inbox className="h-9 w-9 mx-auto mb-2 opacity-25" />
                <p className="text-sm">まだプランがありません</p>
                <p className="text-xs mt-1">「プラン追加」から登録してください。</p>
              </div>
            )}
            {plans?.map(p => (
              <div key={p.id} className="border rounded-lg p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{p.name}</span>
                    {p.isInsurance && <Badge variant="secondary">保険</Badge>}
                    {p.isRecommended && <Badge>おすすめ</Badge>}
                    {!p.isActive && <Badge variant="outline">非表示</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.material && `${p.material}・`}¥{(p.price ?? 0).toLocaleString()}{p.durationLabel && `・${p.durationLabel}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
            ))}

            {editing && (
              <div className="border-2 border-primary/30 rounded-lg p-4 space-y-3 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm mb-1.5 block">プラン名</Label>
                    <Input className="h-10" value={editing.name ?? ""} onChange={e => setEditing(p => ({ ...p!, name: e.target.value }))} placeholder="例: オールセラミック" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">材質</Label>
                    <Input className="h-10" value={editing.material ?? ""} onChange={e => setEditing(p => ({ ...p!, material: e.target.value }))} placeholder="例: セラミック" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">価格（円）</Label>
                    <Input type="number" min={0} className="h-10" value={editing.price ?? 0} onChange={e => setEditing(p => ({ ...p!, price: Number(e.target.value) }))} />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">治療期間の目安</Label>
                    <Input className="h-10" value={editing.durationLabel ?? ""} onChange={e => setEditing(p => ({ ...p!, durationLabel: e.target.value }))} placeholder="例: 2〜3週間" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">悩みカテゴリ</Label>
                    <Select value={editing.category ?? "general"} onValueChange={v => setEditing(p => ({ ...p!, category: v }))}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">一般</SelectItem>
                        <SelectItem value="color">歯の色（ホワイトニング/審美）</SelectItem>
                        <SelectItem value="alignment">歯並び（矯正）</SelectItem>
                        <SelectItem value="missing">歯を失った（インプラント/入れ歯）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">説明</Label>
                  <Textarea rows={2} value={editing.description ?? ""} onChange={e => setEditing(p => ({ ...p!, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm mb-1.5 block">メリット（1行に1つ）</Label>
                    <Textarea rows={3} value={(editing.merits ?? []).join("\n")} onChange={e => setArr("merits", e.target.value)} placeholder="自然な見た目\n変色しにくい" />
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">デメリット（1行に1つ）</Label>
                    <Textarea rows={3} value={(editing.demerits ?? []).join("\n")} onChange={e => setArr("demerits", e.target.value)} placeholder="自費診療\n強い衝撃で割れることがある" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-5">
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editing.isInsurance} onCheckedChange={v => setEditing(p => ({ ...p!, isInsurance: v }))} id="tp-ins" />
                    <Label htmlFor="tp-ins">保険診療</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!!editing.isRecommended} onCheckedChange={v => setEditing(p => ({ ...p!, isRecommended: v }))} id="tp-rec" />
                    <Label htmlFor="tp-rec">おすすめ表示</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={editing.isActive !== false} onCheckedChange={v => setEditing(p => ({ ...p!, isActive: v }))} id="tp-act" />
                    <Label htmlFor="tp-act">表示する</Label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="h-10" onClick={() => saveMutation.mutate(editing)} disabled={saveMutation.isPending || !editing.name}>保存</Button>
                  <Button className="h-10" variant="outline" onClick={() => setEditing(null)}>キャンセル</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
