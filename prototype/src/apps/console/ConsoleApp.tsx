import type { ComponentType } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, LayoutGrid, Puzzle } from "lucide-react";
import { useRoute } from "@/lib/nav";
import { useIsPhone } from "@/lib/media";
import { PageInsetContext, cn } from "@/ui";
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
      <aside className="hairline-r flex w-[232px] shrink-0 flex-col bg-surface2/80">
        <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
          <ArcheMark size={30} />
          <div>
            <div className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">Arche Console</div>
            <div className="text-[12px] text-label2">Sourirette 合同会社</div>
          </div>
        </div>
        <nav className="flex-1 px-3">
          {ORDER.map(id => {
            const s = SCREENS[id];
            const on = key === id;
            return (
              <button key={id} onClick={() => go(id)} className={cn("relative flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-[14px]", on ? "font-semibold" : "hover:bg-fill/8")}>
                {on && <motion.span layoutId="console-active" className="absolute inset-0 rounded-[8px] bg-fill/14" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                <s.icon className={cn("relative h-[18px] w-[18px]", on ? "text-accent" : "text-label2")} strokeWidth={on ? 2.2 : 1.9} />
                <span className="relative">{s.title}</span>
              </button>
            );
          })}
        </nav>
        <button onClick={() => goApp("launcher")} className="hairline-t px-4 py-3 text-left text-[12px] text-label3 hover:text-label2">プロトタイプのトップへ</button>
      </aside>
      <main className="relative min-w-0 flex-1">{body}</main>
    </div>
  );
}
