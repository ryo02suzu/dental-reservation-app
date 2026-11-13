import { createRoot } from "react-dom/client";
import { useRef, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { FrozenRoute, useRoute, type AppId, type Route } from "@/lib/nav";
import { getLaunchOrigin, type LaunchOrigin } from "@/apps/launcher/launch";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/ui";
import Launcher from "@/apps/launcher/Launcher";
import ClinicApp from "@/apps/clinic/ClinicApp";
import PatientApp from "@/apps/patient/PatientApp";
import ConsoleApp from "@/apps/console/ConsoleApp";
import LoginApp from "@/apps/auth/Login";
import KioskApp from "@/apps/kiosk/Checkin";

const APPS: Record<AppId, ComponentType> = {
  launcher: Launcher,
  clinic: ClinicApp,
  patient: PatientApp,
  console: ConsoleApp,
  login: LoginApp,
  kiosk: KioskApp,
};

// ─── アプリの切り替え ─────────────────────────────────────────────────────
// 入口のウィジェットから開くときは、その四角から広がって開く（iPhoneでアプリを開く動き）。
// 入口へ戻るときは、同じ四角へ縮んで戻る。それ以外の切り替えは静かに溶けるだけ。
type Kind = "open" | "close" | "fade";
interface Switch { kind: Kind; origin: LaunchOrigin | null }

const FULL = "inset(0px 0px 0px 0px round 0px)";
function insetOf(o: LaunchOrigin) {
  const stage = document.getElementById("arche-stage");
  const w = stage?.clientWidth ?? window.innerWidth;
  const h = stage?.clientHeight ?? window.innerHeight;
  const { top, left, width, height } = o.rect;
  return `inset(${top}px ${Math.max(0, w - left - width)}px ${Math.max(0, h - top - height)}px ${left}px round ${o.radius}px)`;
}
const centerOf = (o: LaunchOrigin | null) => (o ? `${o.rect.left + o.rect.width / 2}px ${o.rect.top + o.rect.height / 2}px` : "50% 50%");
const ZOOM = { type: "spring", stiffness: 290, damping: 32, mass: 1 } as const;

const layer = {
  initial: (m: Switch) =>
    m.kind === "open" && m.origin
      ? { clipPath: insetOf(m.origin), scale: 0.93, opacity: 0 }
      : m.kind === "close"
        ? { clipPath: FULL, scale: 0.965, opacity: 0.45 }
        : { clipPath: FULL, scale: 0.985, opacity: 0 },
  animate: (m: Switch) => ({
    clipPath: FULL,
    scale: 1,
    opacity: 1,
    transition: m.kind === "fade" ? { type: "spring", stiffness: 360, damping: 34 } : { ...ZOOM, opacity: { duration: m.kind === "open" ? 0.14 : 0.32 } },
  }),
  exit: (m: Switch) =>
    m.kind === "open"
      ? { scale: 0.965, opacity: 0.4, transition: { ...ZOOM, opacity: { duration: 0.32 } } }
      : m.kind === "close" && m.origin
        ? { clipPath: insetOf(m.origin), scale: 0.93, opacity: 0, transition: { ...ZOOM, opacity: { duration: 0.2, delay: 0.16 } } }
        : { opacity: 0, transition: { duration: 0.12 } },
};

let current: Switch = { kind: "fade", origin: null };

/** 1つのアプリの層。消えていく間は、消える前の場所（#）のまま描き続ける */
function Layer({ children }: { children: ReactNode }) {
  const isPresent = useIsPresent();
  const { route } = useRoute();
  const last = useRef<Route>(route);
  if (isPresent) last.current = route;
  const m = current;
  // 開くときは新しいアプリが上、戻るときは消えていくアプリが上
  const z = isPresent ? (m.kind === "close" ? 1 : 2) : m.kind === "close" ? 2 : 1;
  return (
    <motion.div
      custom={m}
      variants={layer}
      initial="initial"
      animate="animate"
      exit="exit"
      className="absolute inset-0 overflow-hidden bg-bg"
      style={{ zIndex: z, transformOrigin: centerOf(m.origin) }}
    >
      <FrozenRoute value={isPresent ? null : last.current}>{children}</FrozenRoute>
    </motion.div>
  );
}

function Root() {
  const { route } = useRoute();
  const reduce = useReducedMotion();
  const prev = useRef(route.app);
  if (prev.current !== route.app) {
    const o = getLaunchOrigin();
    const from = prev.current;
    const to = route.app;
    const kind: Kind = reduce || !o ? "fade" : from === "launcher" && to === o.app ? "open" : to === "launcher" && from === o.app ? "close" : "fade";
    current = { kind, origin: o };
    prev.current = to;
  }
  const App = APPS[route.app];
  return (
    <div id="arche-stage" className="relative h-full overflow-hidden">
      <AnimatePresence initial={false} custom={current}>
        <Layer key={route.app}>
          <App />
        </Layer>
      </AnimatePresence>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <StoreProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </StoreProvider>
  </MotionConfig>,
);
