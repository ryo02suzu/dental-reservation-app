// 院内の受付端末（待合室のタブレットで、患者さんが自分で受付する）
// 1画面に1つの判断。文字と押す面を大きく、言葉は丁寧に。受付はストアを通すので、医院アプリの「今日」にそのまま反映される。
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, CircleHelp } from "lucide-react";
import { patientById, type Appointment } from "@/data";
import { minutesOfDay, now, useNow } from "@/lib/clock";
import { hm } from "@/lib/format";
import { useRoute } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { springSoft } from "@/ui";
import { Attract } from "./parts/Attract";
import { Already, Choose, Confirm, Done, Entry, Help, Method, NotFound, Scan } from "./parts/Screens";
import { firstOfMonth, matchByNumber, matchByPhone, nextReceipt, type Match } from "./parts/lookup";

type Via = "scan" | "number" | "phone";
type Step =
  | { k: "attract" }
  | { k: "method" }
  | { k: "scan" }
  | { k: "number" }
  | { k: "phone" }
  | { k: "choose"; apptIds: string[] }
  | { k: "confirm"; apptId: string; via: Via }
  | { k: "already"; apptId: string }
  | { k: "done"; apptId: string; receipt: number; insurance: boolean }
  | { k: "notfound"; via: Via; patientId?: string }
  | { k: "help"; back: Step };

const IDLE_MS = 90_000; // 操作がないまま放置されたら待受にもどる

export default function KioskApp() {
  const { goApp } = useRoute();
  const store = useStore();
  const [step, setStep] = useState<Step>({ k: "attract" });
  const [dir, setDir] = useState(1);
  const [entryError, setEntryError] = useState<{ message: string; key: number } | undefined>();
  const [called, setCalled] = useState(false);

  const to = useCallback((s: Step, d = 1) => {
    setDir(d);
    setEntryError(undefined);
    setStep(s);
  }, []);
  const home = useCallback(() => { setCalled(false); to({ k: "attract" }, -1); }, [to]);

  // 放置されたら最初の画面にもどす（完了画面は自分で10秒後にもどる）
  const idle = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (step.k === "attract" || step.k === "done") return;
    const reset = () => { clearTimeout(idle.current); idle.current = setTimeout(home, IDLE_MS); };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => { clearTimeout(idle.current); window.removeEventListener("pointerdown", reset); window.removeEventListener("keydown", reset); };
  }, [step, home]);

  const fromMatch = (m: Match, via: Via) => {
    if (m.kind === "ok") to({ k: "confirm", apptId: m.appt.id, via });
    else if (m.kind === "already") to({ k: "already", apptId: m.appt.id });
    else if (m.kind === "noAppt") to({ k: "notfound", via, patientId: m.patient.id });
    else to({ k: "notfound", via });
  };

  const submitNumber = (v: string) => {
    const m = matchByNumber(store.appointments, store.patients, v, minutesOfDay(now()));
    if (m.kind === "unknown") {
      setEntryError({ message: `診察券番号 ${v} は見つかりませんでした。\n番号をお確かめのうえ、もう一度入力してください。`, key: Date.now() });
      return;
    }
    fromMatch(m, "number");
  };
  const submitPhone = (v: string) => {
    const { candidates } = matchByPhone(store.appointments, store.patients, v, minutesOfDay(now()));
    if (!candidates.length) { to({ k: "notfound", via: "phone" }); return; }
    if (candidates.length === 1) { fromMatch(candidates[0].match, "phone"); return; }
    const ids = candidates.flatMap(c => (c.match.kind === "ok" || c.match.kind === "already" ? [c.match.appt.id] : []));
    to({ k: "choose", apptIds: ids });
  };

  const checkIn = (a: Appointment) => {
    const receipt = nextReceipt(store.appointments);
    const insurance = firstOfMonth(store.appointments, patientById(a.patientId), a);
    store.setStatus(a.id, "arrived");
    to({ k: "done", apptId: a.id, receipt, insurance });
  };

  const callStaff = () => {
    store.addNotice({ kind: "system", title: "受付端末からの呼び出し", body: "待合室の受付端末で、患者さんがスタッフを呼んでいます。" });
    setCalled(true);
  };

  const back = (): (() => void) | undefined => {
    switch (step.k) {
      case "method": return () => to({ k: "attract" }, -1);
      case "scan": case "number": case "phone": return () => to({ k: "method" }, -1);
      case "choose": return () => to({ k: "phone" }, -1);
      case "confirm": return () => to({ k: step.via }, -1);
      case "notfound": return () => to({ k: "method" }, -1);
      case "help": return () => { setCalled(false); to(step.back, -1); };
      default: return undefined;
    }
  };
  const apptOf = (id: string) => store.appointments.find(a => a.id === id)!;

  let body: React.ReactNode = null;
  switch (step.k) {
    case "method": body = <Method onPick={k => to({ k })} />; break;
    case "scan": body = <Scan onResult={a => (a ? to({ k: "confirm", apptId: a.id, via: "scan" }) : to({ k: "notfound", via: "scan" }))} onUseNumber={() => to({ k: "number" })} />; break;
    case "number":
    case "phone":
      body = <Entry key={step.k} mode={step.k} onSubmit={step.k === "number" ? submitNumber : submitPhone} error={entryError} onClearError={() => setEntryError(undefined)} />;
      break;
    case "choose": {
      const list = step.apptIds.map(id => apptOf(id)).map(appt => ({ appt, patient: patientById(appt.patientId) }));
      body = <Choose candidates={list} onPick={id => { const a = apptOf(id); fromMatch(a.status === "confirmed" || a.status === "pending" ? { kind: "ok", appt: a } : { kind: "already", appt: a }, "phone"); }} />;
      break;
    }
    case "confirm": body = <Confirm appt={apptOf(step.apptId)} onConfirm={() => checkIn(apptOf(step.apptId))} onWrong={() => to({ k: "help", back: step })} />; break;
    case "already": body = <Already appt={apptOf(step.apptId)} onHome={home} />; break;
    case "done": body = <Done appt={apptOf(step.apptId)} receipt={step.receipt} insurance={step.insurance} onHome={home} />; break;
    case "notfound":
      body = (
        <NotFound
          name={step.patientId ? patientById(step.patientId).name : undefined}
          retryLabel={step.via === "scan" ? "番号で受付する" : "もう一度入力する"}
          onRetry={() => to({ k: step.via === "scan" ? "number" : step.via }, -1)}
          onHelp={() => { to({ k: "help", back: step }); callStaff(); }}
        />
      );
      break;
    case "help": body = <Help called={called} onCall={callStaff} onHome={home} />; break;
  }

  const onBack = back();
  const showHelp = step.k !== "help" && step.k !== "done" && step.k !== "already";

  return (
    <div className="h-full overflow-hidden bg-bg text-label">
      <AnimatePresence mode="wait" initial={false}>
        {step.k === "attract" ? (
          <motion.div key="attract" className="h-full overflow-y-auto" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            <Attract onStart={() => to({ k: "method" })} onExit={() => goApp("launcher")} onHelp={() => to({ k: "help", back: { k: "attract" } })} />
          </motion.div>
        ) : (
          <motion.div key="flow" className="flex h-full flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}>
            <Header onBack={onBack} onHelp={showHelp ? () => to({ k: "help", back: step }) : undefined} />
            <main className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <AnimatePresence mode="wait" initial={false} custom={dir}>
                <motion.div
                  key={stepKey(step)}
                  custom={dir}
                  variants={{
                    enter: (d: number) => ({ opacity: 0, x: d * 36 }),
                    center: { opacity: 1, x: 0, transition: springSoft },
                    exit: (d: number) => ({ opacity: 0, x: d * -24, transition: { duration: 0.14 } }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="mx-auto flex min-h-full max-w-[1180px] flex-col justify-center px-6 pb-10 pt-2 md:max-w-[680px] md:px-12 md:pb-[10vh] lg:max-w-[1180px] lg:px-16 lg:pb-[7vh]"
                >
                  {body}
                </motion.div>
              </AnimatePresence>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const stepKey = (s: Step) => ("apptId" in s ? `${s.k}-${s.apptId}` : s.k);

function Header({ onBack, onHelp }: { onBack?: () => void; onHelp?: () => void }) {
  const t = useNow(1000);
  return (
    <header className="flex h-[84px] shrink-0 items-center justify-between gap-3 px-4 md:h-[104px] md:px-8 lg:px-12">
      <div className="flex-1">
        {onBack && (
          <button type="button" onClick={onBack} className="flex h-16 items-center gap-1 rounded-full bg-fill/12 pl-3 pr-6 text-[19px] font-semibold transition-colors active:bg-fill/20 md:text-[20px]">
            <ChevronLeft className="h-7 w-7" strokeWidth={2.4} />
            もどる
          </button>
        )}
      </div>
      <div className="hidden text-[20px] font-semibold tnum text-label2 md:block">{hm(minutesOfDay(t))}</div>
      <div className="flex flex-1 justify-end">
        {onHelp && (
          <button type="button" onClick={onHelp} className="flex h-16 items-center gap-2 rounded-full px-5 text-[18px] font-semibold text-accent transition-colors hover:bg-fill/8 active:bg-fill/12 md:text-[19px]">
            <CircleHelp className="h-6 w-6" strokeWidth={2.2} />
            <span className="hidden sm:inline">わからないときは</span>
            <span className="sm:hidden">ヘルプ</span>
          </button>
        )}
      </div>
    </header>
  );
}
