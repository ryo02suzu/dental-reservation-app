import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Users, FileText, BarChart3, Settings, LayoutDashboard, LogOut, User, Building2, Bell, Lock, X, ChevronLeft, ChevronRight, Grid3x3, Clock, HelpCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ViewType } from "@/pages/home";
import { useAuth } from "@/hooks/use-auth";
import { useClinicAddons } from "@/hooks/use-clinic-addons";
import { usePlan } from "@/hooks/use-plan";
import { useToast } from "@/hooks/use-toast";
import { NotificationBell } from "@/components/notification-bell";

interface AppSidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType, date?: string) => void;
  onClose?: () => void;
}

type PlanFeature = "recall" | "report";

const menuItems: Array<{ id: ViewType; icon: React.ElementType; label: string; addonKey?: string; planFeature?: PlanFeature; group?: string }> = [
  { id: "dashboard", icon: LayoutDashboard, label: "ダッシュボード", group: "診療" },
  { id: "calendar", icon: Calendar, label: "カレンダー", group: "診療" },
  { id: "patients", icon: Users, label: "患者一覧", group: "診療" },
  { id: "records", icon: FileText, label: "診療メモ", group: "診療" },
  { id: "reports", icon: BarChart3, label: "レポート", planFeature: "report", group: "経営" },
  { id: "recall", icon: Bell, label: "リコール管理", addonKey: "recall", planFeature: "recall", group: "経営" },
  { id: "shiftboard", icon: Grid3x3, label: "シフト表", group: "スタッフ" },
  { id: "attendance", icon: Clock, label: "出退勤", group: "スタッフ" },
  { id: "settings", icon: Settings, label: "設定" },
];

function useCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const toggle = () => setCollapsed(v => {
    const next = !v;
    try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
    return next;
  });
  return [collapsed, toggle] as const;
}

export function AppSidebar({ activeView, onViewChange, onClose }: AppSidebarProps) {
  const handleNotifViewChange = (view: string, date?: string) => onViewChange(view as ViewType, date);
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const { hasAddon, isLoading: addonsLoading } = useClinicAddons();
  const { canRecall, canReport, isPro } = usePlan();
  const [collapsed, toggleCollapsed] = useCollapsed();

  const { data: clinic } = useQuery<{ name: string }>({ queryKey: ["/api/clinic"] });
  const isPlanLocked = (feature?: PlanFeature) => {
    if (!feature) return false;
    if (feature === "recall") return !canRecall;
    if (feature === "report") return !canReport;
    return false;
  };

  const handleNavClick = (item: typeof menuItems[number]) => {
    if (item.planFeature && isPlanLocked(item.planFeature)) {
      toast({
        title: "上位プランが必要です",
        description: `「${item.label}」はプロプラン以上でご利用いただけます。`,
        variant: "destructive",
      });
      return;
    }
    if (item.addonKey && !isPro && !addonsLoading && !hasAddon(item.addonKey) && (!item.planFeature || isPlanLocked(item.planFeature))) {
      toast({
        title: "このオプションは未契約です",
        description: `「${item.label}」を使用するには運営に有効化を依頼してください。`,
        variant: "destructive",
      });
      return;
    }
    onViewChange(item.id);
  };

  // グループラベル表示用：直前アイテムのグループと比較
  const renderNavItems = () => {
    const elements: React.ReactNode[] = [];
    let lastGroup: string | undefined = undefined;

    for (const item of menuItems) {
      const Icon = item.icon;
      const isActive = activeView === item.id;
      const planLocked = isPlanLocked(item.planFeature);
      const addonLocked = !!item.addonKey && !isPro && !addonsLoading && !hasAddon(item.addonKey) && (!item.planFeature || planLocked);
      const isLocked = planLocked || addonLocked;

      // グループが切り替わったらラベルを挿入（collapsed時は区切り線）
      if (item.group && item.group !== lastGroup) {
        if (collapsed) {
          if (lastGroup !== undefined) {
            elements.push(<div key={`sep-${item.group}`} className="my-2 mx-2 h-px bg-sidebar-border" />);
          }
        } else {
          elements.push(
            <div key={`group-${item.group}`} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.14em] px-3 pt-5 pb-2 select-none first:pt-1">
              {item.group}
            </div>
          );
        }
      }
      lastGroup = item.group;

      const btn = (
        <button
          key={item.id}
          className={`group relative w-full h-11 flex items-center rounded-xl transition-all duration-200 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-primary
            ${collapsed ? "justify-center px-0" : "px-3"}
            ${isActive
              ? "bg-primary/10 text-primary font-semibold"
              : "text-foreground/80 hover:bg-sidebar-accent hover:text-foreground font-medium"}
            ${isLocked ? "opacity-50" : ""}`}
          onClick={() => handleNavClick(item)}
          data-testid={`nav-${item.id}`}
        >
          {/* アクティブインジケーター */}
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-primary" />
          )}
          <Icon className={`w-[18px] h-[18px] shrink-0 ${collapsed ? "" : "mr-3"}`} />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-sm">{item.label}</span>
              {isLocked && <Lock className="w-3.5 h-3.5 ml-auto opacity-70" data-testid={`lock-${item.id}`} />}
            </>
          )}
        </button>
      );

      if (collapsed) {
        elements.push(
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <div className="relative">{btn}</div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{item.label}{isLocked ? "（プロプラン以上）" : ""}</TooltipContent>
          </Tooltip>
        );
      } else {
        elements.push(<div key={item.id}>{btn}</div>);
      }
    }
    return elements;
  };

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={`bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 h-full transition-[width] duration-300 ease-in-out
          ${collapsed ? "w-16" : "w-64"}`}
        data-testid="sidebar"
      >
        {/* ─── Brand / context ─────────────────────────── */}
        <div className={`border-b border-sidebar-border flex items-center justify-between shrink-0 h-[65px] ${collapsed ? "px-2" : "px-4"}`}>
          {collapsed ? (
            <div className="mx-auto h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
              A
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-base shrink-0">
                A
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold leading-tight tracking-tight">Arche</h1>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">{clinic?.name ?? "クリニック"}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-0.5 ml-auto">
            <NotificationBell collapsed={collapsed} onViewChange={handleNotifViewChange} />
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:flex w-8 h-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg"
              onClick={toggleCollapsed}
              data-testid="button-toggle-sidebar"
              title={collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon" className="md:hidden w-8 h-8 rounded-lg" onClick={onClose} data-testid="button-close-sidebar">
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* ─── Navigation ──────────────────────────────── */}
        <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}>
          {renderNavItems()}
        </nav>

        {/* ─── Footer ──────────────────────────────────── */}
        <div className={`border-t border-sidebar-border space-y-1 shrink-0 py-3 ${collapsed ? "px-2" : "px-3"}`}>
          {user && !collapsed && (
            <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1.5 rounded-xl bg-sidebar-accent/60">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{user.username}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {(user as any)?.isSuperAdmin ? "運営" : "管理者"}
                </p>
              </div>
            </div>
          )}

          {(user as any)?.isSuperAdmin && (
            collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" className="w-full h-10 justify-center px-0 text-muted-foreground rounded-xl" asChild data-testid="button-super-admin">
                    <Link href="/super-admin"><Building2 className="w-[18px] h-[18px]" /></Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">全医院管理</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" className="w-full h-10 rounded-xl justify-start text-sm font-medium text-muted-foreground hover:text-foreground" asChild data-testid="button-super-admin">
                <Link href="/super-admin">
                  <Building2 className="w-[18px] h-[18px] mr-3 shrink-0" />
                  全医院管理
                </Link>
              </Button>
            )
          )}

          {/* お問い合わせ */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="w-full h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-sidebar-accent"
                  onClick={() => onViewChange("support" as ViewType)}
                  data-testid="nav-support"
                >
                  <HelpCircle className="w-[18px] h-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">お問い合わせ</TooltipContent>
            </Tooltip>
          ) : (
            <button
              className="w-full h-10 flex items-center gap-3 px-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-sidebar-accent"
              onClick={() => onViewChange("support" as ViewType)}
              data-testid="nav-support"
            >
              <HelpCircle className="w-[18px] h-[18px] shrink-0" />
              お問い合わせ
            </button>
          )}

          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full h-10 justify-center px-0 text-muted-foreground hover:text-destructive rounded-xl"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  data-testid="button-logout"
                >
                  <LogOut className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">ログアウト</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              className="w-full h-10 rounded-xl justify-start text-sm font-medium text-muted-foreground hover:text-destructive"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="w-[18px] h-[18px] mr-3 shrink-0" />
              ログアウト
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
