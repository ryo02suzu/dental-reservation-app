import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, LayoutGrid, Puzzle } from "lucide-react";
import { useRoute } from "@/lib/nav";
import { useIsPhone } from "@/lib/media";
import { Avatar, PageInsetContext, cn } from "@/ui";
import { ArcheMark } from "@/apps/launcher/ArcheMark";
import Overview from "./screens/Overview";
import Clinics from "./screens/Clinics";
import Addons from "./screens/Addons";
import type { LucideIcon } from "lucide-react";

type Icon = LucideIcon;
const SCREENS: Record<string, { title: string; icon: Icon; component: ComponentType<{ param?: string }> }> = {
  overview: { title: "概要", icon: LayoutGrid, component: Overview },
  clinics: { title: "医院", icon: Building2, component: Clinics },
  addons: { title: "オプション", icon: Puzzle, component: Addons },
};
const ORDER = ["overview", "clinics", "addons"];
/** ログインしている運営のスタッフ（架空） */
const OPERATOR = { name: "三浦 千尋", role: "カスタマーサクセス", tone: "sage" as const };

/** 運営（Sourirette）向けコンソールの土台 */
export default function ConsoleApp() {
  const { route, go, goApp } = useRoute();
  const phone = useIsPhone();
  const key = SCREENS[route.screen] ? route.screen : "overview";
  const Screen = SCREENS[key].component;

  const body = (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={key} className="absolute inset-0" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.08 } }} transition={{ type: "spring", stiffness: 420, damping: 40 }}>
        <Screen param={route.param} />
      </motion.div>
    </AnimatePresence>
  );

  if (phone) {
    return (
      <PageInsetContext.Provider value={{ bottom: 50 }}>
        <div className="relative h-full overflow-hidden bg-bg">
          {body}
          <nav className="material hairline-t absolute inset-x-0 bottom-0 z-40 safe-b">
            <div className="flex h-[50px]">
              {ORDER.map(id => {
                const s = SCREENS[id];
                const on = key === id;
                return (
                  <button key={id} onClick={() => go(id)} className={cn("flex flex-1 flex-col items-center justify-center gap-[3px] pt-1", on ? "text-accent" : "text-label3")}>
                    <s.icon className="h-[24px] w-[24px]" strokeWidth={on ? 2.2 : 1.8} />
                    <span className={cn("text-[10px] leading-none", on ? "font-semibold" : "font-medium")}>{s.title}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </PageInsetContext.Provider>
    );
  }

  return (
    <div className="flex h-full bg-bg">
      <aside className="hairline-r flex w-[264px] shrink-0 flex-col bg-surface2/80">
        <div className="flex items-center gap-2.5 px-[15px] pb-4 pt-5">
          <ArcheMark size={34} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold leading-tight">Arche</div>
            <div className="truncate text-[12px] text-label2">運営コンソール · Sourirette</div>
          </div>
        </div>
        <nav className="flex-1 px-3">
          {ORDER.map(id => {
            const s = SCREENS[id];
            const on = key === id;
            return (
              <button key={id} onClick={() => go(id)} aria-current={on ? "page" : undefined} className={cn("relative flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-[11px] text-[14px]", on ? "font-semibold" : "hover:bg-fill/8")}>
                {on && <motion.span layoutId="console-active" className="absolute inset-0 rounded-[8px] bg-fill/14" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <s.icon className={cn("relative h-[18px] w-[18px]", on ? "text-accent" : "text-label2")} strokeWidth={on ? 2.2 : 1.9} />
                <span className="relative">{s.title}</span>
              </button>
            );
          })}
        </nav>
        <div className="hairline-t flex items-center gap-2.5 px-[17px] py-3">
          <Avatar name={OPERATOR.name} tone={OPERATOR.tone} size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-tight">{OPERATOR.name}</div>
            <div className="text-[11px] text-label2">{OPERATOR.role}</div>
          </div>
          <button onClick={() => goApp("launcher")} className="rounded-md px-1.5 py-1 text-[11px] text-label3 hover:bg-fill/10 hover:text-label2" title="プロトタイプのトップへ">
            トップへ
          </button>
        </div>
      </aside>
      <main className="relative min-w-0 flex-1">{body}</main>
    </div>
  );
}
