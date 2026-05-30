import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Redirect, Link, useLocation } from "wouter";
import {
  Building2, ExternalLink, Copy, Power, PowerOff, Plus, RefreshCw, LogOut,
  Users, Calendar, KeyRound, Mail, Pencil, Trash2, PackagePlus, CreditCard,
  Puzzle, CheckCircle2, XCircle, LayoutDashboard, MoreHorizontal, ChevronRight,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";

interface ClinicSummary {
  id: string;
  name: string;
  slug: string | null;
  planType: string | null;
  isActive: boolean | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  appointmentCount: number;
  staffCount: number;
  addonKeys: string[];
  createdAt: string | null;
}

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  free:       { label: "フリー",         className: "bg-gray-100 text-gray-600" },
  starter:    { label: "スターター",     className: "bg-blue-100 text-blue-700" },
  pro:        { label: "プロ",           className: "bg-purple-100 text-purple-700" },
  enterprise: { label: "エンタープライズ", className: "bg-amber-100 text-amber-700" },
  partner:    { label: "パートナー",     className: "bg-green-100 text-green-700" },
};

interface PlanDefinition {
  id: string;
  key: string;
  name: string;
  price: number;
  maxAppointmentsPerMonth: number | null;
  maxStaff: number | null;
  features: string[] | null;
  isActive: boolean | null;
  sortOrder: number | null;
}

interface AddonDefinition {
  id: string;
  key: string;
  name: string;
  price: number;
  description: string | null;
  isActive: boolean | null;
  sortOrder: number | null;
}

interface ClinicAddon {
  id: string;
  clinicId: string;
  addonKey: string;
}

const emptyPlan = (): Partial<PlanDefinition> => ({
  key: "", name: "", price: 0, maxAppointmentsPerMonth: null, maxStaff: null,
  features: [], isActive: true, sortOrder: 0,
});

const emptyAddon = (): Partial<AddonDefinition> => ({
  key: "", name: "", price: 0, description: "", isActive: true, sortOrder: 0,
});

export default function SuperAdminPage() {
  const { user, isLoading: authLoading, logoutMutation } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  // Dialogs: clinic management
  const [resetDialog, setResetDialog] = useState<{ clinicId: string; clinicName: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [emailDialog, setEmailDialog] = useState<{ clinicId: string; clinicName: string } | null>(null);
  const [resendKey, setResendKey] = useState("");
  const [showResendKey, setShowResendKey] = useState(false);
  const [addonDialog, setAddonDialog] = useState<{ clinicId: string; clinicName: string } | null>(null);

  // 未保存のプラン変更を追跡（clinicId → pendingPlanType）
  const [pendingPlans, setPendingPlans] = useState<Record<string, string>>({});

  // 医院削除確認ダイアログ
  const [deleteDialog, setDeleteDialog] = useState<{ clinicId: string; clinicName: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Dialogs: plan/addon definition
  const [planDialog, setPlanDialog] = useState<Partial<PlanDefinition> | null>(null);
  const [addonDefDialog, setAddonDefDialog] = useState<Partial<AddonDefinition> | null>(null);
  const [featuresText, setFeaturesText] = useState("");

  // ─── Queries ────────────────────────────────────────────────────────────────
  const { data: clinics, isLoading } = useQuery<ClinicSummary[]>({
    queryKey: ["/api/super-admin/clinics"],
    queryFn: async () => (await apiRequest("GET", "/api/super-admin/clinics")).json(),
    enabled: !!user?.isSuperAdmin,
  });

  const { data: planDefs = [], isLoading: plansLoading } = useQuery<PlanDefinition[]>({
    queryKey: ["/api/super-admin/plans"],
    queryFn: async () => (await apiRequest("GET", "/api/super-admin/plans")).json(),
    enabled: !!user?.isSuperAdmin,
  });

  const { data: addonDefs = [], isLoading: addonsLoading } = useQuery<AddonDefinition[]>({
    queryKey: ["/api/super-admin/addons"],
    queryFn: async () => (await apiRequest("GET", "/api/super-admin/addons")).json(),
    enabled: !!user?.isSuperAdmin,
  });

  const { data: clinicAddons = [] } = useQuery<ClinicAddon[]>({
    queryKey: ["/api/super-admin/clinics", addonDialog?.clinicId, "addons"],
    queryFn: async () => (await apiRequest("GET", `/api/super-admin/clinics/${addonDialog!.clinicId}/addons`)).json(),
    enabled: !!addonDialog?.clinicId,
  });

  // ─── Clinic mutations ────────────────────────────────────────────────────────
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      (await apiRequest("PATCH", `/api/super-admin/clinics/${id}/status`, { isActive })).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/super-admin/clinics"] }); toast({ title: "ステータスを更新しました" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const planMutation = useMutation({
    mutationFn: async ({ id, planType }: { id: string; planType: string }) =>
      (await apiRequest("PATCH", `/api/super-admin/clinics/${id}/plan`, { planType })).json(),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["/api/super-admin/clinics"] });
      qc.invalidateQueries({ queryKey: ["/api/my-plan"] });
      qc.invalidateQueries({ queryKey: ["/api/plan-info"] });
      setPendingPlans(prev => { const next = { ...prev }; delete next[id]; return next; });
      toast({ title: "プランを変更しました" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: async (id: string) =>
      (await apiRequest("POST", `/api/super-admin/clinics/${id}/impersonate`)).json(),
    onSuccess: (data) => {
      toast({ title: `${data.clinicName} の管理画面に移動します` });
      window.location.href = "/admin";
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) =>
      (await apiRequest("POST", `/api/super-admin/clinics/${id}/reset-admin-password`)).json(),
    onSuccess: (data) => setResetResult(data),
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteClinicMutation = useMutation({
    mutationFn: async (id: string) =>
      (await apiRequest("DELETE", `/api/super-admin/clinics/${id}`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/super-admin/clinics"] });
      setDeleteDialog(null);
      setDeleteConfirmText("");
      toast({ title: "医院を削除しました" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const saveEmailKeyMutation = useMutation({
    mutationFn: async ({ clinicId, resendApiKey }: { clinicId: string; resendApiKey: string }) =>
      (await apiRequest("PATCH", `/api/super-admin/clinics/${clinicId}/email-settings`, { resendApiKey })).json(),
    onSuccess: () => { toast({ title: "メール設定を保存しました" }); setEmailDialog(null); setResendKey(""); setShowResendKey(false); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const [pendingAddonKey, setPendingAddonKey] = useState<string | null>(null);
  const toggleClinicAddonMutation = useMutation({
    mutationFn: async ({ clinicId, addonKey, enabled }: { clinicId: string; addonKey: string; enabled: boolean }) => {
      setPendingAddonKey(addonKey);
      return (await apiRequest("PATCH", `/api/super-admin/clinics/${clinicId}/addons/${addonKey}`, { enabled })).json();
    },
    onSuccess: (_data, { clinicId }) => {
      qc.invalidateQueries({ queryKey: ["/api/super-admin/clinics", clinicId, "addons"] });
      qc.invalidateQueries({ queryKey: ["/api/my-plan"] });
      toast({ title: "オプションを更新しました" });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
    onSettled: () => setPendingAddonKey(null),
  });

  // ─── Plan definition mutations ───────────────────────────────────────────────
  const savePlanMutation = useMutation({
    mutationFn: async (data: Partial<PlanDefinition>) => {
      const features = featuresText.split("\n").map(s => s.trim()).filter(Boolean);
      const payload = { ...data, features };
      if (data.id) {
        return (await apiRequest("PATCH", `/api/super-admin/plans/${data.id}`, payload)).json();
      }
      return (await apiRequest("POST", "/api/super-admin/plans", payload)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/super-admin/plans"] });
      toast({ title: "プランを保存しました" });
      setPlanDialog(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/super-admin/plans/${id}`)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/super-admin/plans"] }); toast({ title: "プランを削除しました" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  // ─── Addon definition mutations ──────────────────────────────────────────────
  const saveAddonDefMutation = useMutation({
    mutationFn: async (data: Partial<AddonDefinition>) => {
      if (data.id) {
        return (await apiRequest("PATCH", `/api/super-admin/addons/${data.id}`, data)).json();
      }
      return (await apiRequest("POST", "/api/super-admin/addons", data)).json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/super-admin/addons"] });
      toast({ title: "オプションを保存しました" });
      setAddonDefDialog(null);
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteAddonDefMutation = useMutation({
    mutationFn: async (id: string) => (await apiRequest("DELETE", `/api/super-admin/addons/${id}`)).json(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/super-admin/addons"] }); toast({ title: "オプションを削除しました" }); },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const openEmailDialog = async (clinic: ClinicSummary) => {
    setResendKey(""); setShowResendKey(false);
    setEmailDialog({ clinicId: clinic.id, clinicName: clinic.name });
    try {
      const data = await (await apiRequest("GET", `/api/super-admin/clinics/${clinic.id}/email-settings`)).json();
      setResendKey(data.resendApiKey || "");
    } catch (_) {}
  };

  const openPlanDialog = (plan?: PlanDefinition) => {
    const p = plan ?? emptyPlan();
    setPlanDialog(p);
    setFeaturesText((p.features ?? []).join("\n"));
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/book/${slug}`);
    toast({ title: "URLをコピーしました" });
  };

  // ─── Plan options from DB (+ fallback to fixed list) ─────────────────────────
  const planOptions = planDefs.length > 0
    ? planDefs.filter(p => p.isActive)
    : [
        { key: "free", name: "フリー" },
        { key: "starter", name: "スターター" },
        { key: "pro", name: "プロ" },
        { key: "enterprise", name: "エンタープライズ" },
        { key: "partner", name: "パートナー（初期）" },
      ];

  // ─── Auth guards ──────────────────────────────────────────────────────────────
  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Redirect to="/login" />;
  if (!user.isSuperAdmin) return <Redirect to="/admin" />;

  const activeCount = clinics?.filter(c => c.isActive).length ?? 0;
  const totalAppts = clinics?.reduce((s, c) => s + c.appointmentCount, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Arche Console</h1>
              <p className="text-xs text-gray-500">運営ダッシュボード</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" asChild data-testid="button-add-clinic">
              <Link href="/signup"><Plus className="w-4 h-4 mr-1" />新規医院</Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate(undefined, { onSuccess: () => navigate("/login") })}
              data-testid="button-logout"
            >
              {logoutMutation.isPending
                ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                : <LogOut className="w-4 h-4 mr-1" />}
              ログアウト
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">総医院数</p><p className="text-3xl font-bold" data-testid="stat-total-clinics">{clinics?.length ?? 0}</p></div>
                <Building2 className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">稼働中</p><p className="text-3xl font-bold text-green-600" data-testid="stat-active-clinics">{activeCount}</p></div>
                <Users className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">プラン数</p><p className="text-3xl font-bold text-purple-600">{planDefs.length}</p></div>
                <CreditCard className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">総予約数</p><p className="text-3xl font-bold" data-testid="stat-total-appointments">{totalAppts}</p></div>
                <Calendar className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="clinics">
          <TabsList className="mb-4">
            <TabsTrigger value="clinics" data-testid="tab-clinics"><Building2 className="w-4 h-4 mr-1.5" />医院一覧</TabsTrigger>
            <TabsTrigger value="plans" data-testid="tab-plans"><CreditCard className="w-4 h-4 mr-1.5" />プラン管理</TabsTrigger>
            <TabsTrigger value="addons" data-testid="tab-addons"><Puzzle className="w-4 h-4 mr-1.5" />オプション管理</TabsTrigger>
          </TabsList>

          {/* ── 医院一覧 ── */}
          <TabsContent value="clinics">
            <Card>
              <CardHeader><CardTitle>医院一覧</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : !clinics?.length ? (
                  <div className="text-center py-12 text-gray-500">
                    <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>医院が登録されていません</p>
                    <Button className="mt-4" asChild><Link href="/signup">最初の医院を登録する</Link></Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {clinics.map((clinic) => {
                      const bookingUrl = clinic.slug ? `${window.location.origin}/book/${clinic.slug}` : null;
                      const currentPlan = clinic.planType ?? "free";
                      const displayPlan = pendingPlans[clinic.id] ?? currentPlan;
                      const hasPendingPlan = pendingPlans[clinic.id] !== undefined && pendingPlans[clinic.id] !== currentPlan;
                      const plan = PLAN_BADGE[displayPlan] ?? PLAN_BADGE.free;
                      return (
                        <div key={clinic.id} className={`border rounded-xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow ${hasPendingPlan ? "ring-2 ring-amber-400" : ""}`} data-testid={`card-clinic-${clinic.id}`}>
                          {/* カードヘッダー */}
                          <div className="p-4 pb-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap min-w-0">
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${clinic.isActive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`} data-testid={`badge-status-${clinic.id}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${clinic.isActive ? "bg-green-500" : "bg-red-400"}`} />
                                  {clinic.isActive ? "稼働中" : "停止中"}
                                </span>
                                {hasPendingPlan && (
                                  <span className="text-xs text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded-full">未保存</span>
                                )}
                              </div>
                              {/* プラン変更セレクタ（ローカル変更のみ・即時保存しない） */}
                              <Select
                                value={displayPlan}
                                onValueChange={(val) => setPendingPlans(prev => ({ ...prev, [clinic.id]: val }))}
                              >
                                <SelectTrigger className={`h-6 text-xs w-auto px-2 border-0 font-semibold ${plan.className} rounded-full`} data-testid={`select-plan-${clinic.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent align="end">
                                  {planOptions.map(p => (
                                    <SelectItem key={p.key} value={p.key}>{p.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <h3 className="font-bold text-gray-900 text-base mt-2 leading-tight" data-testid={`text-clinic-name-${clinic.id}`}>{clinic.name}</h3>
                            {clinic.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{clinic.address}</p>}

                            {/* 統計バッジ */}
                            <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-500">
                              {clinic.phone && <span className="flex items-center gap-1"><span>📞</span>{clinic.phone}</span>}
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{clinic.staffCount}名</span>
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{clinic.appointmentCount}件</span>
                            </div>

                            {/* 予約URL */}
                            {bookingUrl && (
                              <div className="flex items-center gap-1.5 mt-2">
                                <p className="text-xs text-gray-400 font-mono truncate flex-1" data-testid={`text-booking-url-${clinic.id}`}>/book/{clinic.slug}</p>
                                <button onClick={() => copyUrl(clinic.slug!)} className="text-gray-400 hover:text-gray-600 transition-colors" data-testid={`button-copy-url-${clinic.id}`}>
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors" data-testid={`button-open-booking-${clinic.id}`}>
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            )}

                            {/* アドオンバッジ */}
                            {clinic.addonKeys.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {clinic.addonKeys.map(k => (
                                  <span key={k} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{k}</span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* アクションフッター */}
                          <div className="border-t bg-gray-50 px-4 py-2.5 space-y-2">
                            {/* 未保存の変更がある時だけ保存バーを表示 */}
                            {hasPendingPlan && (
                              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                <span className="text-xs text-amber-700 flex-1">
                                  プランを <span className="font-semibold">{PLAN_BADGE[currentPlan]?.label ?? currentPlan}</span> → <span className="font-semibold">{PLAN_BADGE[displayPlan]?.label ?? displayPlan}</span> に変更
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => setPendingPlans(prev => { const next = { ...prev }; delete next[clinic.id]; return next; })}
                                  data-testid={`button-cancel-plan-${clinic.id}`}
                                >
                                  キャンセル
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs px-3 bg-amber-500 hover:bg-amber-600 text-white"
                                  onClick={() => planMutation.mutate({ id: clinic.id, planType: displayPlan })}
                                  disabled={planMutation.isPending}
                                  data-testid={`button-save-plan-${clinic.id}`}
                                >
                                  {planMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "保存"}
                                </Button>
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <Button
                                className="flex-1 bg-[#C4B5A0] hover:bg-[#b3a390] text-white font-medium"
                                size="sm"
                                onClick={() => impersonateMutation.mutate(clinic.id)}
                                disabled={impersonateMutation.isPending}
                                data-testid={`button-impersonate-${clinic.id}`}
                              >
                                {impersonateMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                ) : (
                                  <LayoutDashboard className="w-4 h-4 mr-1.5" />
                                )}
                                管理画面に入る
                                <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white"
                                onClick={() => setAddonDialog({ clinicId: clinic.id, clinicName: clinic.name })}
                                data-testid={`button-addons-${clinic.id}`}
                              >
                                <PackagePlus className="w-4 h-4 mr-1" />オプション
                              </Button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="bg-white px-2" data-testid={`button-more-${clinic.id}`}>
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => openEmailDialog(clinic)} data-testid={`menu-email-${clinic.id}`}>
                                    <Mail className="w-4 h-4 mr-2" />メール設定
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setResetResult(null); setResetDialog({ clinicId: clinic.id, clinicName: clinic.name }); }} data-testid={`menu-password-${clinic.id}`}>
                                    <KeyRound className="w-4 h-4 mr-2" />パスワード変更
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className={clinic.isActive ? "text-amber-600 focus:text-amber-600" : "text-green-600 focus:text-green-600"}
                                    onClick={() => toggleStatusMutation.mutate({ id: clinic.id, isActive: !clinic.isActive })}
                                    data-testid={`menu-toggle-status-${clinic.id}`}
                                  >
                                    {clinic.isActive
                                      ? <><PowerOff className="w-4 h-4 mr-2" />停止する</>
                                      : <><Power className="w-4 h-4 mr-2" />有効化する</>}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onClick={() => { setDeleteConfirmText(""); setDeleteDialog({ clinicId: clinic.id, clinicName: clinic.name }); }}
                                    data-testid={`menu-delete-${clinic.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />医院を削除
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── プラン管理 ── */}
          <TabsContent value="plans">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>プラン定義</CardTitle>
                <Button size="sm" onClick={() => openPlanDialog()} data-testid="button-add-plan">
                  <Plus className="w-4 h-4 mr-1" />プランを追加
                </Button>
              </CardHeader>
              <CardContent>
                {plansLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : !planDefs.length ? (
                  <div className="text-center py-10 text-gray-400">
                    <CreditCard className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">プランがまだ登録されていません</p>
                    <Button className="mt-3" size="sm" onClick={() => openPlanDialog()}>最初のプランを追加</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-3 font-medium">プラン名</th>
                          <th className="pb-2 pr-3 font-medium">key</th>
                          <th className="pb-2 pr-3 font-medium">月額</th>
                          <th className="pb-2 pr-3 font-medium">予約上限</th>
                          <th className="pb-2 pr-3 font-medium">スタッフ上限</th>
                          <th className="pb-2 pr-3 font-medium">順序</th>
                          <th className="pb-2 pr-3 font-medium">状態</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {planDefs.map((plan) => (
                          <tr key={plan.id} className="border-b last:border-0 hover:bg-gray-50" data-testid={`row-plan-${plan.id}`}>
                            <td className="py-2.5 pr-3 font-medium">{plan.name}</td>
                            <td className="py-2.5 pr-3 font-mono text-xs text-gray-500">{plan.key}</td>
                            <td className="py-2.5 pr-3">¥{plan.price.toLocaleString()}</td>
                            <td className="py-2.5 pr-3">{plan.maxAppointmentsPerMonth ?? "無制限"}</td>
                            <td className="py-2.5 pr-3">{plan.maxStaff ?? "無制限"}</td>
                            <td className="py-2.5 pr-3">{plan.sortOrder ?? 0}</td>
                            <td className="py-2.5 pr-3">
                              {plan.isActive
                                ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />有効</span>
                                : <span className="flex items-center gap-1 text-gray-400"><XCircle className="w-3.5 h-3.5" />無効</span>}
                            </td>
                            <td className="py-2.5">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => openPlanDialog(plan)} data-testid={`button-edit-plan-${plan.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { if (confirm(`プラン「${plan.name}」を削除しますか？`)) deletePlanMutation.mutate(plan.id); }} data-testid={`button-delete-plan-${plan.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── オプション管理 ── */}
          <TabsContent value="addons">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>オプション定義</CardTitle>
                <Button size="sm" onClick={() => setAddonDefDialog(emptyAddon())} data-testid="button-add-addon">
                  <Plus className="w-4 h-4 mr-1" />オプションを追加
                </Button>
              </CardHeader>
              <CardContent>
                {addonsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
                ) : !addonDefs.length ? (
                  <div className="text-center py-10 text-gray-400">
                    <Puzzle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">オプションがまだ登録されていません</p>
                    <Button className="mt-3" size="sm" onClick={() => setAddonDefDialog(emptyAddon())}>最初のオプションを追加</Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-gray-500">
                          <th className="pb-2 pr-3 font-medium">オプション名</th>
                          <th className="pb-2 pr-3 font-medium">key</th>
                          <th className="pb-2 pr-3 font-medium">月額</th>
                          <th className="pb-2 pr-3 font-medium">説明</th>
                          <th className="pb-2 pr-3 font-medium">順序</th>
                          <th className="pb-2 pr-3 font-medium">状態</th>
                          <th className="pb-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {addonDefs.map((addon) => (
                          <tr key={addon.id} className="border-b last:border-0 hover:bg-gray-50" data-testid={`row-addon-${addon.id}`}>
                            <td className="py-2.5 pr-3 font-medium">{addon.name}</td>
                            <td className="py-2.5 pr-3 font-mono text-xs text-gray-500">{addon.key}</td>
                            <td className="py-2.5 pr-3">¥{addon.price.toLocaleString()}</td>
                            <td className="py-2.5 pr-3 max-w-xs truncate text-gray-500">{addon.description ?? "—"}</td>
                            <td className="py-2.5 pr-3">{addon.sortOrder ?? 0}</td>
                            <td className="py-2.5 pr-3">
                              {addon.isActive
                                ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" />有効</span>
                                : <span className="flex items-center gap-1 text-gray-400"><XCircle className="w-3.5 h-3.5" />無効</span>}
                            </td>
                            <td className="py-2.5">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setAddonDefDialog(addon)} data-testid={`button-edit-addon-${addon.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => { if (confirm(`オプション「${addon.name}」を削除しますか？`)) deleteAddonDefMutation.mutate(addon.id); }} data-testid={`button-delete-addon-${addon.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── ダイアログ群 ───────────────────────────────────────────────────────── */}

      {/* 管理者パスワードリセット */}
      <Dialog open={!!resetDialog} onOpenChange={(o) => { if (!o) { setResetDialog(null); setResetResult(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>管理者パスワードリセット</DialogTitle></DialogHeader>
          {!resetResult ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600"><strong>{resetDialog?.clinicName}</strong> の管理者パスワードをリセットします。<br />新しい一時パスワードが生成されます。この操作は取り消せません。</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setResetDialog(null)}>キャンセル</Button>
                <Button variant="destructive" onClick={() => resetDialog && resetPasswordMutation.mutate(resetDialog.clinicId)} disabled={resetPasswordMutation.isPending} data-testid="button-confirm-reset-password">
                  {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "リセットする"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-amber-900">新しい一時パスワード</p>
                <p className="text-sm text-amber-800">ユーザー名: <strong>{resetResult.username}</strong></p>
                <p className="text-sm text-amber-800">パスワード: <strong className="font-mono text-base" data-testid="text-temp-password">{resetResult.tempPassword}</strong></p>
                <p className="text-xs text-amber-700 mt-2">このパスワードを医院管理者に安全な方法で伝えてください</p>
              </div>
              <Button className="w-full" onClick={() => { setResetDialog(null); setResetResult(null); }}>閉じる</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 医院削除確認 */}
      <Dialog open={!!deleteDialog} onOpenChange={(o) => { if (!o) { setDeleteDialog(null); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />医院を削除
            </DialogTitle>
            <DialogDescription>
              この操作は取り消せません。予約・患者・スタッフ・全データが完全に削除されます。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <strong>{deleteDialog?.clinicName}</strong> に紐づく全データ（予約・患者・スタッフ・設定）が削除されます。
            </div>
            <div>
              <Label className="mb-1.5 block text-sm">
                確認のため医院名を入力してください：
                <span className="font-mono font-bold ml-1">{deleteDialog?.clinicName}</span>
              </Label>
              <Input
                placeholder={deleteDialog?.clinicName ?? ""}
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                className="border-red-200 focus:border-red-400"
                data-testid="input-delete-confirm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setDeleteDialog(null); setDeleteConfirmText(""); }}>
                キャンセル
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== deleteDialog?.clinicName || deleteClinicMutation.isPending}
                onClick={() => deleteDialog && deleteClinicMutation.mutate(deleteDialog.clinicId)}
                data-testid="button-confirm-delete"
              >
                {deleteClinicMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                完全に削除する
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* メール設定 */}
      <Dialog open={!!emailDialog} onOpenChange={(o) => { if (!o) { setEmailDialog(null); setResendKey(""); setShowResendKey(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>メール設定</DialogTitle>
            <DialogDescription>{emailDialog?.clinicName} のResend APIキーを設定します</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Resend APIキー</Label>
              <div className="flex gap-2">
                <Input type={showResendKey ? "text" : "password"} placeholder="re_xxxxxxxxxxxx" value={resendKey} onChange={e => setResendKey(e.target.value)} data-testid="input-clinic-resend-key" />
                <Button variant="outline" size="sm" onClick={() => setShowResendKey(v => !v)} data-testid="button-toggle-clinic-resend-key">{showResendKey ? "非表示" : "表示"}</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">空欄にして保存するとキーを削除できます</p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setEmailDialog(null); setResendKey(""); setShowResendKey(false); }}>キャンセル</Button>
              <Button onClick={() => emailDialog && saveEmailKeyMutation.mutate({ clinicId: emailDialog.clinicId, resendApiKey: resendKey })} disabled={saveEmailKeyMutation.isPending} data-testid="button-save-clinic-resend-key">
                {saveEmailKeyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* クリニックオプション割り当て */}
      <Dialog open={!!addonDialog} onOpenChange={(o) => { if (!o) setAddonDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>オプション設定</DialogTitle>
            <DialogDescription>{addonDialog?.clinicName} に割り当てるオプションを選択してください</DialogDescription>
          </DialogHeader>
          {!addonDefs.length ? (
            <p className="text-sm text-gray-500 py-4 text-center">「オプション管理」タブでオプションを先に追加してください</p>
          ) : (
            <div className="space-y-3">
              {addonDefs.filter(a => a.isActive).map((addon) => {
                const isEnabled = clinicAddons.some(ca => ca.addonKey === addon.key);
                return (
                  <div key={addon.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`addon-row-${addon.key}`}>
                    <div>
                      <p className="font-medium text-sm">{addon.name}</p>
                      <p className="text-xs text-gray-500">¥{addon.price.toLocaleString()}/月 {addon.description ? `・${addon.description}` : ""}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      disabled={pendingAddonKey === addon.key}
                      onCheckedChange={(enabled) => addonDialog && toggleClinicAddonMutation.mutate({ clinicId: addonDialog.clinicId, addonKey: addon.key, enabled })}
                      data-testid={`switch-addon-${addon.key}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Button variant="outline" onClick={() => setAddonDialog(null)}>閉じる</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* プラン作成・編集 */}
      <Dialog open={!!planDialog} onOpenChange={(o) => { if (!o) setPlanDialog(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{planDialog?.id ? "プランを編集" : "プランを追加"}</DialogTitle>
          </DialogHeader>
          {planDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">プラン名 <span className="text-red-500">*</span></Label>
                  <Input value={planDialog.name ?? ""} onChange={e => setPlanDialog(p => ({ ...p!, name: e.target.value }))} placeholder="スタンダード" data-testid="input-plan-name" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">key（英数字・ハイフン） <span className="text-red-500">*</span></Label>
                  <Input value={planDialog.key ?? ""} onChange={e => setPlanDialog(p => ({ ...p!, key: e.target.value }))} placeholder="standard" data-testid="input-plan-key" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">月額（円）</Label>
                  <Input type="number" value={planDialog.price ?? 0} onChange={e => setPlanDialog(p => ({ ...p!, price: Number(e.target.value) }))} data-testid="input-plan-price" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">予約上限/月（空=無制限）</Label>
                  <Input type="number" value={planDialog.maxAppointmentsPerMonth ?? ""} onChange={e => setPlanDialog(p => ({ ...p!, maxAppointmentsPerMonth: e.target.value ? Number(e.target.value) : null }))} placeholder="空=無制限" data-testid="input-plan-max-appointments" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">スタッフ上限（空=無制限）</Label>
                  <Input type="number" value={planDialog.maxStaff ?? ""} onChange={e => setPlanDialog(p => ({ ...p!, maxStaff: e.target.value ? Number(e.target.value) : null }))} placeholder="空=無制限" data-testid="input-plan-max-staff" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">表示順序</Label>
                  <Input type="number" value={planDialog.sortOrder ?? 0} onChange={e => setPlanDialog(p => ({ ...p!, sortOrder: Number(e.target.value) }))} data-testid="input-plan-sort-order" />
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <Switch checked={planDialog.isActive ?? true} onCheckedChange={v => setPlanDialog(p => ({ ...p!, isActive: v }))} data-testid="switch-plan-active" />
                  <Label className="text-xs">有効</Label>
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs">機能一覧（1行1項目）</Label>
                <Textarea rows={4} value={featuresText} onChange={e => setFeaturesText(e.target.value)} placeholder={"メールリマインダー\nLINE通知\n問診票機能"} data-testid="textarea-plan-features" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPlanDialog(null)}>キャンセル</Button>
                <Button onClick={() => savePlanMutation.mutate(planDialog)} disabled={savePlanMutation.isPending || !planDialog.key || !planDialog.name} data-testid="button-save-plan">
                  {savePlanMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* オプション作成・編集 */}
      <Dialog open={!!addonDefDialog} onOpenChange={(o) => { if (!o) setAddonDefDialog(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{addonDefDialog?.id ? "オプションを編集" : "オプションを追加"}</DialogTitle>
          </DialogHeader>
          {addonDefDialog && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">オプション名 <span className="text-red-500">*</span></Label>
                  <Input value={addonDefDialog.name ?? ""} onChange={e => setAddonDefDialog(p => ({ ...p!, name: e.target.value }))} placeholder="SMS通知パック" data-testid="input-addon-name" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">key（英数字・ハイフン） <span className="text-red-500">*</span></Label>
                  <Input value={addonDefDialog.key ?? ""} onChange={e => setAddonDefDialog(p => ({ ...p!, key: e.target.value }))} placeholder="sms_pack" data-testid="input-addon-key" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1 block text-xs">月額（円）</Label>
                  <Input type="number" value={addonDefDialog.price ?? 0} onChange={e => setAddonDefDialog(p => ({ ...p!, price: Number(e.target.value) }))} data-testid="input-addon-price" />
                </div>
                <div>
                  <Label className="mb-1 block text-xs">表示順序</Label>
                  <Input type="number" value={addonDefDialog.sortOrder ?? 0} onChange={e => setAddonDefDialog(p => ({ ...p!, sortOrder: Number(e.target.value) }))} data-testid="input-addon-sort-order" />
                </div>
              </div>
              <div>
                <Label className="mb-1 block text-xs">説明</Label>
                <Input value={addonDefDialog.description ?? ""} onChange={e => setAddonDefDialog(p => ({ ...p!, description: e.target.value }))} placeholder="月100通のSMSリマインダーを送信" data-testid="input-addon-description" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={addonDefDialog.isActive ?? true} onCheckedChange={v => setAddonDefDialog(p => ({ ...p!, isActive: v }))} data-testid="switch-addon-active" />
                <Label className="text-xs">有効</Label>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAddonDefDialog(null)}>キャンセル</Button>
                <Button onClick={() => saveAddonDefMutation.mutate(addonDefDialog)} disabled={saveAddonDefMutation.isPending || !addonDefDialog.key || !addonDefDialog.name} data-testid="button-save-addon">
                  {saveAddonDefMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
