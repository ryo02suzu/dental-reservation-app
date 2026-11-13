import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, BellRing, CalendarClock, CalendarDays, Ellipsis, NotebookPen, Search, Settings, Sun, Users,
} from "lucide-react";
import { useRoute, type AppId } from "@/lib/nav";
import { useIsPhone } from "@/lib/media";
import { useStore } from "@/lib/store";
import { TODAY_KEY, useNow } from "@/lib/clock";
import { clinic, staff } from "@/data";
import { Avatar, PageInsetContext, cn, springPush } from "@/ui";
import { ArcheMark } from "@/apps/launcher/ArcheMark";
import { ClinicUICtx, type ClinicUI, type NewPrefill } from "./context";
import { isActive, statusOf } from "./helpers";
import Today from "./screens/Today";
import Schedule from "./screens/Schedule";
import Patients from "./screens/Patients";
import Notifications from "./screens/Notifications";
import More from "./screens/More";
import Records from "./screens/Records";
import Reports from "./screens/Reports";
import Recall from "./screens/Recall";
import StaffScreen from "./screens/StaffScreen";
import SettingsScreen from "./screens/Settings";
import { AppointmentSheet } from "./sheets/AppointmentSheet";
import { NewAppointmentSheet } from "./sheets/NewAppointmentSheet";
import { CommandPalette } from "./CommandPalette";
import type { LucideIcon } from "lucide-react";

type Icon = LucideIcon;
interface ScreenDef { title: string; icon: Icon; component: ComponentType<{ param?: string }>; tab: string }

export const CLINIC_SCREENS: Record<string, ScreenDef> = {
  today: { title: "今日", icon: Sun, component: Today, tab: "today" },
  schedule: { title: "予約台帳", icon: CalendarDays, component: Schedule, tab: "schedule" },
  patients: { title: "患者", icon: Users, component: Patients, tab: "patients" },
  notifications: { title: "お知らせ", icon: Bell, component: Notifications, tab: "notifications" },
  more: { title: "その他", icon: Ellipsis, component: More, tab: "more" },
  records: { title: "診療メモ", icon: NotebookPen, component: Records, tab: "more" },
  reports: { title: "レポート", icon: BarChart3, component: Reports, tab: "more" },
  recall: { title: "リコール", icon: BellRing, component: Recall, tab: "more" },
  staff: { title: "シフト・勤怠", icon: CalendarClock, component: StaffScreen, tab: "more" },
  settings: { title: "設定", icon: Settings, component: SettingsScreen, tab: "more" },
};
const TABS = ["today", "schedule", "patients", "notifications", "more"] as const;
const ROOTS = new Set<string>(TABS);

const SIDEBAR: { header?: string; items: string[] }[] = [
  { items: ["today", "schedule", "patients", "notifications"] },
  { header: "診療", items: ["records", "recall"] },
  { header: "経営", items: ["reports", "staff"] },
  { items: ["settings"] },
];

export default function ClinicApp() {
  const { route, go, goApp, setSheet } = useRoute();
  const phone = useIsPhone();
  const [prefill, setPrefill] = useState<NewPrefill | undefined>();
  const def = CLINIC_SCREENS[route.screen] ?? CLINIC_SCREENS.today;
  const screenKey = CLINIC_SCREENS[route.screen] ? route.screen : "today";

  // PCには「その他」タブがないので今日へ
  useEffect(() => {
    if (!phone && route.screen === "more") go("today", undefined, { replace: true });
  }, [phone, route.screen, go]);

  const ui: ClinicUI = useMemo(() => ({
    openAppointment: (id: string) => setSheet(`appt-${id}`),
    openNew: (p?: NewPrefill) => { setPrefill(p); setSheet("new"); },
    openSearch: () => setSheet("search"),
    go: (screen: string, param?: string) => go(screen, param),
    back: phone && !ROOTS.has(screenKey) ? { label: "その他", onClick: () => go("more") } : undefined,
    phone,
  }), [setSheet, go, phone, screenKey]);

  const sheet = route.sheet ?? "";
  const apptId = sheet.startsWith("appt-") ? sheet.slice(5) : null;

  return (
    <ClinicUICtx.Provider value={ui}>
      {phone ? (
        <PhoneLayout screenKey={screenKey} def={def} param={route.param} onTab={t => go(t)} />
      ) : (
        <DesktopLayout screenKey={screenKey} def={def} param={route.param} onNav={s => go(s)} onSearch={ui.openSearch} onExit={() => goApp("launcher" as AppId)} />
      )}
      <AppointmentSheet id={apptId} onClose={() => setSheet(undefined)} />
      <NewAppointmentSheet open={sheet === "new"} prefill={prefill} onClose={() => setSheet(undefined)} />
      <CommandPalette open={sheet === "search"} onClose={() => setSheet(undefined)} />
    </ClinicUICtx.Provider>
  );
}

// ─── スマホ：画面の積み重ね＋下のタブバー ─────────────────────────────────────
function depthOf(screen: string, param?: string) {
  return (ROOTS.has(screen) ? 0 : 1) + (param ? 1 : 0);
}

function PhoneLayout({ screenKey, def, param, onTab }: { screenKey: string; def: ScreenDef; param?: string; onTab: (t: string) => void }) {
  const prev = useRef({ screenKey, param });
  const d = depthOf(screenKey, param) - depthOf(prev.current.screenKey, prev.current.param);
  const sameTab = CLINIC_SCREENS[prev.current.screenKey]?.tab === def.tab;
  const dir = sameTab ? Math.sign(d) : 0;
  useEffect(() => { prev.current = { screenKey, param }; }, [screenKey, param]);
  const Screen = def.component;
  return (
    <PageInsetContext.Provider value={{ bottom: 50 }}>
      <div className="relative h-full overflow-hidden bg-bg">
        <AnimatePresence initial={false} custom={dir}>
          <motion.div
            key={`${screenKey}:${param ?? ""}`}
            custom={dir}
            variants={{
              enter: (k: number) => (k > 0 ? { x: "100%", boxShadow: "-12px 0 30px rgba(0,0,0,0.12)" } : k < 0 ? { x: "-28%", opacity: 0.9 } : { opacity: 0 }),
              center: { x: 0, opacity: 1, boxShadow: "0 0 0 rgba(0,0,0,0)" },
              exit: (k: number) => (k > 0 ? { x: "-28%", opacity: 0.9 } : k < 0 ? { x: "100%" } : { opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={dir === 0 ? { duration: 0.12 } : springPush}
            className="absolute inset-0 bg-bg"
            style={{ zIndex: dir >= 0 ? 2 : 1 }}
          >
            <Screen param={param} />
          </motion.div>
        </AnimatePresence>
        <TabBar active={def.tab} onTab={onTab} />
      </div>
    </PageInsetContext.Provider>
  );
}

function TabBar({ active, onTab }: { active: string; onTab: (t: string) => void }) {
  const { notices } = useStore();
  const unread = notices.filter(n => !n.read).length;
  return (
    <nav className="material hairline-t absolute inset-x-0 bottom-0 z-40 safe-b" aria-label="メインメニュー">
      <div className="flex h-[50px] items-stretch">
        {TABS.map(t => {
          const d = CLINIC_SCREENS[t];
          const on = active === t;
          const Icon = d.icon;
          return (
            <button key={t} onClick={() => onTab(t)} className={cn("relative flex flex-1 flex-col items-center justify-center gap-[3px] pt-1 transition-colors", on ? "text-accent" : "text-label3")} aria-current={on ? "page" : undefined}>
              <span className="relative">
                <Icon className="h-[25px] w-[25px]" strokeWidth={on ? 2.2 : 1.8} />
                {t === "notifications" && unread > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-red px-1 text-[11px] font-semibold text-white tnum ring-2 ring-material">{unread}</span>
                )}
              </span>
              <span className={cn("text-[10px] leading-none", on ? "font-semibold" : "font-medium")}>{d.title === "予約台帳" ? "台帳" : d.title}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── PC：サイドバー＋本文 ───────────────────────────────────────────────────
function DesktopLayout({ screenKey, def, param, onNav, onSearch, onExit }: {
  screenKey: string; def: ScreenDef; param?: string; onNav: (s: string) => void; onSearch: () => void; onExit: () => void;
}) {
  const Screen = def.component;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onSearch(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSearch]);
  return (
    <div className="flex h-full bg-bg">
      <Sidebar active={screenKey} onNav={onNav} onSearch={onSearch} onExit={onExit} />
      <main className="relative min-w-0 flex-1">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={screenKey}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
          >
            <Screen param={param} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Sidebar({ active, onNav, onSearch, onExit }: { active: string; onNav: (s: string) => void; onSearch: () => void; onExit: () => void }) {
  const { appointments, notices, recalls } = useStore();
  const now = useNow();
  const remaining = appointments.filter(a => a.date === TODAY_KEY && isActive(a) && a.status !== "completed" && statusOf(a, now) !== "completed").length;
  const counts: Record<string, number | undefined> = {
    schedule: remaining || undefined,
    notifications: notices.filter(n => !n.read).length || undefined,
    recall: recalls.filter(r => r.status === "未連絡").length || undefined,
  };
  const me = staff.find(s => s.role === "受付")!;
  return (
    <aside className="hairline-r flex w-[248px] shrink-0 flex-col bg-surface2/80 lg:w-[264px]">
      <div className="flex items-center gap-2.5 px-4 pb-3 pt-5">
        <ArcheMark size={34} />
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-tight">{clinic.name}</div>
          <div className="text-[12px] text-label2">プロプラン · ユニット4台</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <button onClick={onSearch} className="flex h-8 w-full items-center gap-2 rounded-[9px] bg-fill/12 px-2.5 text-[13px] text-label2 transition-colors hover:bg-fill/16">
          <Search className="h-[15px] w-[15px]" strokeWidth={2.2} />
          患者・予約を検索
          <kbd className="ml-auto rounded-[5px] bg-surface px-1.5 py-px font-sans text-[11px] text-label3 shadow-[0_0_0_0.5px_rgb(var(--separator)/0.4)]">⌘K</kbd>
        </button>
      </div>
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {SIDEBAR.map((g, gi) => (
          <div key={gi} className={cn(gi > 0 && "mt-4")}>
            {g.header && <div className="px-2.5 pb-1 text-[11px] font-semibold text-label3">{g.header}</div>}
            {g.items.map(id => {
              const d = CLINIC_SCREENS[id];
              const on = active === id;
              const Icon = d.icon;
              const n = counts[id];
              return (
                <button
                  key={id}
                  onClick={() => onNav(id)}
                  aria-current={on ? "page" : undefined}
                  className={cn("relative flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] transition-colors", on ? "font-semibold text-label" : "text-label hover:bg-fill/8")}
                >
                  {on && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-[8px] bg-fill/14" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <Icon className={cn("relative h-[18px] w-[18px]", on ? "text-accent" : "text-label2")} strokeWidth={on ? 2.2 : 1.9} />
                  <span className="relative">{d.title}</span>
                  {n !== undefined && (
                    <span className={cn("relative ml-auto text-[12px] font-semibold tnum", id === "notifications" ? "rounded-full bg-red px-1.5 text-white" : "text-label3")}>{n}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="hairline-t flex items-center gap-2.5 px-4 py-3">
        <Avatar name={me.name} tone={me.tone} size={30} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold leading-tight">{me.name}</div>
          <div className="text-[11px] text-label2">{me.role}</div>
        </div>
        <button onClick={onExit} className="rounded-md px-1.5 py-1 text-[11px] text-label3 hover:bg-fill/10 hover:text-label2" title="プロトタイプのトップへ">
          トップへ
        </button>
      </div>
    </aside>
  );
}
