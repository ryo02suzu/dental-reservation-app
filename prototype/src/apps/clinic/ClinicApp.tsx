import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3, Bell, BellRing, CalendarClock, CalendarDays, Ellipsis, NotebookPen, PanelLeft, Search, Settings, Sun, Users,
} from "lucide-react";
import { useRoute, type AppId } from "@/lib/nav";
import { useIsPhone, useIsWide } from "@/lib/media";
import { useStore } from "@/lib/store";
import { TODAY_KEY, useNow } from "@/lib/clock";
import { hm } from "@/lib/format";
import { clinic, hoursFor, staff } from "@/data";
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
/** サイドバーの幅。畳むとアイコンだけの細い列になる（iPad幅では最初から畳む） */
const SIDEBAR_W = 264;
const RAIL_W = 64;

function DesktopLayout({ screenKey, def, param, onNav, onSearch, onExit }: {
  screenKey: string; def: ScreenDef; param?: string; onNav: (s: string) => void; onSearch: () => void; onExit: () => void;
}) {
  const Screen = def.component;
  const wide = useIsWide();
  // 利用者が切り替えたらそれを優先。幅の段階が変わったら既定（広い画面は開く、iPad幅は畳む）に戻す
  const [override, setOverride] = useState<boolean | null>(null);
  useEffect(() => setOverride(null), [wide]);
  const collapsed = override ?? !wide;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onSearch(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSearch]);
  return (
    <div className="flex h-full bg-bg">
      <Sidebar active={screenKey} collapsed={collapsed} onToggle={() => setOverride(!collapsed)} onNav={onNav} onSearch={onSearch} onExit={onExit} />
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

function Sidebar({ active, collapsed, onToggle, onNav, onSearch, onExit }: {
  active: string; collapsed: boolean; onToggle: () => void; onNav: (s: string) => void; onSearch: () => void; onExit: () => void;
}) {
  const { notices, recalls, currentStaffId } = useStore();
  const now = useNow(60_000);
  // 件数は「対応が必要なもの」だけに出す（未読のお知らせ・未連絡のリコール）。赤はスマホのタブバーのバッジだけに使う
  const counts: Record<string, number | undefined> = {
    notifications: notices.filter(n => !n.read).length || undefined,
    recall: recalls.filter(r => r.status === "未連絡").length || undefined,
  };
  const me = staff.find(s => s.id === currentStaffId) ?? staff.find(s => s.role === "受付")!;
  const h = hoursFor(now);
  const hours = h ? `本日 ${hm(h.am[0])}〜${hm(h.pm[1])}` : "本日は休診日";
  const fade = cn("transition-opacity duration-200", collapsed && "pointer-events-none opacity-0");
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? RAIL_W : SIDEBAR_W }}
      transition={{ type: "spring", stiffness: 420, damping: 42 }}
      className="hairline-r relative shrink-0 overflow-hidden bg-surface2/80"
      aria-label="メインメニュー"
    >
      {/* 中身は開いたときの幅で固定し、畳むと右側が隠れる（アイコンの位置は動かない） */}
      <div className="flex h-full flex-col" style={{ width: SIDEBAR_W }}>
        <div className="flex h-[52px] shrink-0 items-center px-3.5">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "サイドバーを開く" : "サイドバーを畳む"}
            aria-expanded={!collapsed}
            title={collapsed ? "サイドバーを開く" : "サイドバーを畳む"}
            className="flex h-9 w-9 items-center justify-center rounded-[9px] text-label2 transition-colors hover:bg-fill/10 hover:text-label active:bg-fill/16"
          >
            <PanelLeft className="h-[19px] w-[19px]" strokeWidth={1.9} />
          </button>
        </div>
        <div className="flex items-center gap-2.5 px-[15px] pb-3">
          <ArcheMark size={34} />
          <div className={cn("min-w-0", fade)}>
            <div className="truncate text-[14px] font-semibold leading-tight">{clinic.name}</div>
            <div className="text-[12px] text-label2 tnum">{hours}</div>
          </div>
        </div>
        <div className="px-3 pb-2">
          <button
            onClick={onSearch}
            title="患者・予約を検索（⌘K）"
            className={cn("flex h-8 items-center gap-2 overflow-hidden whitespace-nowrap rounded-[9px] bg-fill/12 px-[11px] text-[13px] text-label2 transition-[width,background-color] hover:bg-fill/16", collapsed ? "w-10" : "w-full")}
          >
            <Search className="h-[15px] w-[15px] shrink-0" strokeWidth={2.2} />
            <span className={fade}>患者・予約を検索</span>
            <kbd className={cn("ml-auto rounded-[5px] bg-surface px-1.5 py-px font-sans text-[11px] text-label3 shadow-[0_0_0_0.5px_rgb(var(--separator)/0.4)]", fade)}>⌘K</kbd>
          </button>
        </div>
        <nav className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
          {SIDEBAR.map((g, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-4")}>
              {g.header && (
                <div className="relative h-5 px-2.5 text-[11px] font-semibold leading-5 text-label3">
                  <span className={fade}>{g.header}</span>
                  {/* 畳んだときは見出しの代わりに短い区切り線 */}
                  <span aria-hidden className={cn("absolute left-2.5 top-1/2 h-px w-5 origin-top scale-y-50 bg-sep/40 transition-opacity duration-200", collapsed ? "opacity-100" : "opacity-0")} />
                </div>
              )}
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
                    aria-label={n ? `${d.title}（${n}件）` : d.title}
                    title={collapsed ? (n ? `${d.title}（${n}件）` : d.title) : undefined}
                    className={cn(
                      "relative flex h-[34px] items-center gap-2.5 whitespace-nowrap rounded-[8px] px-[11px] text-[14px] transition-[width,background-color]",
                      collapsed ? "w-10" : "w-full",
                      on ? "font-semibold text-label" : "text-label hover:bg-fill/8",
                    )}
                  >
                    {on && <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-[8px] bg-fill/14" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    <span className="relative flex shrink-0">
                      <Icon className={cn("h-[18px] w-[18px]", on ? "text-accent" : "text-label2")} strokeWidth={on ? 2.2 : 1.9} />
                      {n !== undefined && collapsed && <span aria-hidden className="absolute -right-[3px] -top-[2px] h-[7px] w-[7px] rounded-full bg-label2 ring-2 ring-surface2" />}
                    </span>
                    <span className={cn("relative", fade)}>{d.title}</span>
                    {n !== undefined && <span className={cn("relative ml-auto text-[12px] font-semibold text-label3 tnum", fade)}>{n}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="hairline-t flex items-center gap-2.5 px-[17px] py-3">
          <span title={collapsed ? `${me.name}（${me.role}）` : undefined} className="flex shrink-0">
            <Avatar name={me.name} tone={me.tone} size={30} />
          </span>
          <div className={cn("min-w-0 flex-1", fade)}>
            <div className="truncate text-[13px] font-semibold leading-tight">{me.name}</div>
            <div className="text-[11px] text-label2">{me.role}</div>
          </div>
          <button onClick={onExit} tabIndex={collapsed ? -1 : undefined} className={cn("rounded-md px-1.5 py-1 text-[11px] text-label3 hover:bg-fill/10 hover:text-label2", fade)} title="プロトタイプのトップへ">
            トップへ
          </button>
        </div>
      </div>
    </motion.aside>
  );
}
