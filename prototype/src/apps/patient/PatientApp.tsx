import { createContext, useContext, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, PresenceContext, motion, useIsPresent } from "framer-motion";
import { useRoute } from "@/lib/nav";
import { springPush } from "@/ui";
import Home from "./screens/Home";
import Booking from "./screens/Booking";
import Mine from "./screens/Mine";

const SCREENS: Record<string, ComponentType<{ param?: string }>> = { home: Home, book: Booking, mine: Mine };
const ORDER = ["home", "book", "mine"];

/** Web予約の入力途中の内容（画面をまたいで持つ） */
export interface BookingDraft {
  visit?: "first" | "return";
  serviceId?: string;
  date?: string;
  start?: number;
  name: string;
  kana: string;
  phone: string;
  email: string;
  number: string; // 再診の診察券番号
  note: string;
}
const emptyDraft: BookingDraft = { name: "", kana: "", phone: "", email: "", number: "", note: "" };

const DraftCtx = createContext<{ draft: BookingDraft; setDraft: (p: Partial<BookingDraft>) => void; reset: () => void } | null>(null);
export function useDraft() {
  const v = useContext(DraftCtx);
  if (!v) throw new Error("DraftCtx がありません");
  return v;
}

/** 患者さん向けのWeb予約アプリの土台 */
export default function PatientApp() {
  const { route } = useRoute();
  const [draft, set] = useState<BookingDraft>(emptyDraft);
  const ctx = useMemo(() => ({ draft, setDraft: (p: Partial<BookingDraft>) => set(d => ({ ...d, ...p })), reset: () => set(emptyDraft) }), [draft]);
  const key = SCREENS[route.screen] ? route.screen : "home";
  const Screen = SCREENS[key];
  return (
    <DraftCtx.Provider value={ctx}>
      <Stack k={`${key}:${route.param ?? ""}`} order={ORDER.indexOf(key) * 10 + stepIndex(route.param)}>
        <Screen param={route.param} />
      </Stack>
    </DraftCtx.Provider>
  );
}

const STEPS = ["type", "menu", "time", "info", "confirm", "done"];
const stepIndex = (p?: string) => Math.max(0, STEPS.indexOf(p ?? ""));

function Stack({ k, order, children }: { k: string; order: number; children: ReactNode }) {
  // 向き（進む＝1／戻る＝-1）は、画面（k）が変わった描画でだけ決める。
  // 抜けていく途中で再描画されても向きが 0 に戻らないようにするため。
  const [state, setState] = useState({ k, order, dir: 0 });
  let dir = state.dir;
  if (state.k !== k) {
    dir = Math.sign(order - state.order);
    setState({ k, order, dir });
  }
  return (
    <div className="relative h-full overflow-hidden bg-bg">
      <AnimatePresence initial={false} custom={dir}>
        <Layer key={k} dir={dir}>
          {children}
        </Layer>
      </AnimatePresence>
    </div>
  );
}

const layerVariants = {
  enter: (d: number) => (d > 0 ? { x: "100%" } : d < 0 ? { x: "-28%", opacity: 0.9 } : { opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => (d > 0 ? { x: "-28%", opacity: 0.9 } : d < 0 ? { x: "100%" } : { opacity: 0 }),
};

/** 積み重ねの1枚。抜けていく面は操作を受けない（万一残っても下の画面をふさがない） */
function Layer({ dir, children }: { dir: number; children: ReactNode }) {
  const present = useIsPresent();
  // 抜けていく面には、AnimatePresence が「いまの」向きを渡してくれる
  const presence = useContext(PresenceContext);
  const d = present ? dir : typeof presence?.custom === "number" ? presence.custom : dir;
  return (
    <motion.div
      custom={d}
      variants={layerVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={d === 0 ? { duration: 0.15 } : springPush}
      className="absolute inset-0 bg-bg"
      style={{ zIndex: present ? 2 : d > 0 ? 1 : 3, pointerEvents: present ? "auto" : "none" }}
    >
      {children}
    </motion.div>
  );
}
