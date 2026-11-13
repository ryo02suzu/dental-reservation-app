import { createRoot } from "react-dom/client";
import type { ComponentType } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useRoute, type AppId } from "@/lib/nav";
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

function Root() {
  const { route } = useRoute();
  const App = APPS[route.app];
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={route.app}
        className="h-full"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.01, transition: { duration: 0.12 } }}
        transition={{ type: "spring", stiffness: 360, damping: 34 }}
      >
        <App />
      </motion.div>
    </AnimatePresence>
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
