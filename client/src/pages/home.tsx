import { useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Dashboard } from "@/components/dashboard";
import { CalendarView } from "@/components/calendar-view";
import { PatientList } from "@/components/patient-list";
import { MedicalRecords } from "@/components/medical-records";
import { Reports } from "@/components/reports";
import { SettingsView } from "@/components/settings-view";
import { RecallView } from "@/components/recall-view";
import { SupportView } from "@/components/support-view";
import { LayoutDashboard, Calendar, Users, Settings, MoreHorizontal, ArrowLeft, Eye, Menu, Grid3x3 } from "lucide-react";
import { ShiftBoardView } from "@/components/shift-board-view";
import { AttendancePanel } from "@/components/attendance-panel";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export type ViewType = "dashboard" | "calendar" | "patients" | "records" | "reports" | "settings" | "recall" | "support" | "shiftboard" | "attendance";

const BOTTOM_NAV = [
  { id: "dashboard" as ViewType, icon: LayoutDashboard, label: "ホーム" },
  { id: "calendar" as ViewType, icon: Calendar, label: "予約" },
  { id: "patients" as ViewType, icon: Users, label: "患者" },
  { id: "settings" as ViewType, icon: Settings, label: "設定" },
];

export default function Home() {
  const [activeView, setActiveView] = useState<ViewType>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calendarInitialDate, setCalendarInitialDate] = useState<Date | undefined>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data: clinic } = useQuery<{ name: string }>({ queryKey: ["/api/clinic"] });
  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ["/api/appointments/pending-count"],
    refetchInterval: 60 * 1000,
  });
  const pendingCount = pendingData?.count ?? 0;

  const { data: impersonation } = useQuery<{ active: boolean; clinicId: string | null; clinicName: string | null }>({
    queryKey: ["/api/super-admin/impersonate/status"],
    retry: false,
  });

  const exitImpersonateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/super-admin/impersonate/exit"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clinic"] });
      navigate("/super-admin");
    },
  });

  const handleViewChange = (view: ViewType, date?: string) => {
    setActiveView(view);
    setSidebarOpen(false);
    if (date) setCalendarInitialDate(new Date(date));
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {impersonation?.active && (
        <div className="shrink-0 bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm z-50" data-testid="banner-impersonation">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 shrink-0" />
            <span className="truncate">
              <span className="font-semibold">{impersonation.clinicName}</span> の管理画面を閲覧中
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-amber-900 border-amber-200 bg-amber-100 hover:bg-amber-200 h-7 text-xs shrink-0"
            onClick={() => exitImpersonateMutation.mutate()}
            disabled={exitImpersonateMutation.isPending}
            data-testid="button-exit-impersonation"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">全医院管理に戻る</span>
            <span className="sm:hidden">戻る</span>
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`
          fixed inset-y-0 left-0 z-50 md:static md:z-auto md:flex md:shrink-0
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}>
          <AppSidebar
            activeView={activeView}
            onViewChange={handleViewChange}
            onClose={() => setSidebarOpen(false)}
          />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <header className="md:hidden flex items-center gap-3 px-4 h-14 border-b bg-background shrink-0">
            <Button variant="ghost" size="icon" className="shrink-0 -ml-2" onClick={() => setSidebarOpen(true)} data-testid="button-open-sidebar">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-semibold text-sm truncate flex-1">{clinic?.name ?? "Arche"}</span>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col pb-16 md:pb-0">
            {activeView === "dashboard" && <Dashboard />}
            {activeView === "calendar" && <CalendarView key={calendarInitialDate?.toISOString() ?? "default"} initialDate={calendarInitialDate} />}
            {activeView === "patients" && <PatientList />}
            {activeView === "records" && <MedicalRecords />}
            {activeView === "reports" && <Reports />}
            {activeView === "settings" && <SettingsView />}
            {activeView === "recall" && <RecallView />}
            {activeView === "support" && <SupportView />}
            {activeView === "shiftboard" && <ShiftBoardView />}
            {activeView === "attendance" && <AttendancePanel />}
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border flex items-stretch" style={{ height: "calc(64px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="mobile-bottom-nav">
        {BOTTOM_NAV.map(({ id, icon: Icon, label }) => {
          const isActive = activeView === id;
          const hasBadge = (id === "calendar" || id === "dashboard") && pendingCount > 0;
          return (
            <button
              key={id}
              onClick={() => handleViewChange(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors
                ${isActive ? "text-primary" : "text-muted-foreground"}`}
              data-testid={`bottom-nav-${id}`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors"
          data-testid="bottom-nav-more"
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">メニュー</span>
        </button>
      </nav>
    </div>
  );
}
