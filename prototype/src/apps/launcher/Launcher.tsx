import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, CalendarDays, ChevronRight, LogIn, Moon, ScanLine, Smartphone, Sun, SunMoon } from "lucide-react";
import { useRoute, type AppId } from "@/lib/nav";
import { IconTile, Segmented, cn, springSoft } from "@/ui";
import type { TileTone } from "@/data";
import type { LucideIcon } from "lucide-react";
import { ArcheMark } from "./ArcheMark";
import { getLaunchOrigin, setLaunchOrigin, takeIntro } from "./launch";
import { ClinicBody, ConsoleBody, KioskBody, LoginBody, PatientBody, Widget, rise } from "./widgets";

const META: Record<Exclude<AppId, "launcher">, { label: string; icon: LucideIcon; tone: TileTone }> = {
  clinic: { label: "医院スタッフ", icon: CalendarDays, tone: "sand" },
  patient: { label: "患者さんのWeb予約", icon: Smartphone, tone: "ocean" },
  kiosk: { label: "院内の受付端末", icon: ScanLine, tone: "sage" },
  console: { label: "運営コンソール", icon: Building2, tone: "graphite" },
  login: { label: "ログイン", icon: LogIn, tone: "clay" },
};

/** 試してほしい流れ。押すと、その流れの最初の画面が開く */
const FLOWS: { apps: Exclude<AppId, "launcher">[]; title: string; body: string; app: AppId; screen?: string; param?: string }[] = [
  { apps: ["patient", "clinic"], title: "Web予約が医院に届く", body: "患者さんとして予約すると、医院の「今日」とお知らせにすぐ届きます", app: "patient", screen: "book", param: "type" },
  { apps: ["kiosk", "clinic"], title: "受付端末で受付する", body: "診察券番号を入れて受付すると、医院の待合に入ります", app: "kiosk" },
  { apps: ["clinic"], title: "来ていない患者さんに連絡する", body: "「今日」の未来院の行から、連絡の記録や予約の変更ができます", app: "clinic" },
  { apps: ["clinic"], title: "予約台帳の空き枠から予約する", body: "空いている時間を押すと、時刻とユニットが入った新規予約が開きます", app: "clinic", screen: "schedule" },
];

/** プロトタイプの入口。各アプリの「いま」を小さなウィジェットで見せ、押すとそこから広がって開く */
export default function Launcher() {
  const { goApp } = useRoute();
  const scroller = useRef<HTMLDivElement>(null);
  const intro = useMemo(() => takeIntro(), []);

  // アプリから戻ってきたときは、開いたときのスクロール位置に戻す（縮んで戻る先の位置をそろえる）
  useLayoutEffect(() => {
    const o = getLaunchOrigin();
    if (o && scroller.current) scroller.current.scrollTop = o.scrollTop;
  }, []);

  const open = (app: AppId, el: HTMLElement, radius: number, screen?: string, param?: string) => {
    const stage = document.getElementById("arche-stage")?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setLaunchOrigin({
      app,
      rect: { top: r.top - (stage?.top ?? 0), left: r.left - (stage?.left ?? 0), width: r.width, height: r.height },
      radius,
      scrollTop: scroller.current?.scrollTop ?? 0,
    });
    goApp(app, screen, param);
  };
  const widget = (app: Exclude<AppId, "launcher">) => ({ ...META[app], onOpen: (el: HTMLElement) => open(app, el, 22), intro });

  return (
    <div ref={scroller} className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[1080px] px-4 pb-16 pt-10 md:px-8 md:pt-16">
        <header className="flex items-center gap-3.5">
          <motion.span initial={intro ? { opacity: 0, scale: 0.9 } : false} animate={{ opacity: 1, scale: 1 }} transition={springSoft}>
            <ArcheMark size={48} draw={intro} />
          </motion.span>
          <motion.div className="min-w-0 flex-1" initial={intro ? { opacity: 0, x: -6 } : false} animate={{ opacity: 1, x: 0 }} transition={{ ...springSoft, delay: 0.1 }}>
            <h1 className="text-[30px] font-bold leading-none tracking-[-0.02em]">Arche</h1>
            <p className="mt-1.5 text-subhead text-label2">デザインのプロトタイプ</p>
          </motion.div>
          <ThemeSwitch />
        </header>

        <motion.p
          className="mt-6 max-w-[36em] text-[15px] leading-[1.75] text-label2 [text-wrap:pretty] [word-break:auto-phrase] md:text-[16px]"
          initial={intro ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          歯科医院の予約システムを、ゼロから作り直しました。どの画面も実際に操作でき、変えた内容はほかの画面にもその場で反映されます。
        </motion.p>

        <section className="mt-8 grid grid-cols-2 gap-3 md:mt-10 md:grid-cols-4 md:gap-4">
          <Widget {...widget("clinic")} index={0} className="col-span-2 min-h-[300px] md:row-span-2 md:min-h-[416px]" aside="今日">
            <ClinicBody intro={intro} />
          </Widget>
          <Widget {...widget("patient")} label="Web予約" index={1} className="min-h-[178px] md:min-h-[200px]">
            <PatientBody />
          </Widget>
          <Widget {...widget("kiosk")} label="受付端末" index={2} className="min-h-[178px] md:min-h-[200px]">
            <KioskBody />
          </Widget>
          <Widget {...widget("console")} label="運営" index={3} className="min-h-[178px] md:min-h-[200px]">
            <ConsoleBody />
          </Widget>
          <Widget {...widget("login")} index={4} className="min-h-[178px] md:min-h-[200px]">
            <LoginBody />
          </Widget>
        </section>

        <section className="mt-10 md:mt-12">
          <h2 className="px-4 pb-1.5 text-footnote font-medium text-label2">試してほしい流れ</h2>
          <motion.div
            className="overflow-hidden rounded-card bg-surface md:grid md:grid-cols-2"
            variants={rise}
            custom={5}
            initial={intro ? "hidden" : false}
            animate="show"
          >
            {FLOWS.map((f, i) => (
              <FlowRow key={f.title} f={f} last={i === FLOWS.length - 1} lastRowMd={i >= FLOWS.length - 2} odd={i % 2 === 1} onOpen={el => open(f.app, el, 12, f.screen, f.param)} />
            ))}
          </motion.div>
        </section>

        <footer className="mt-8 space-y-1 px-4 text-[12px] leading-[1.6] text-label3 [word-break:auto-phrase]">
          <p>表示している医院・患者・予約は、すべて架空のサンプルです。</p>
          <p>デモの時刻は、開いた日の 10:42 から実際の時間どおりに進みます。</p>
        </footer>
      </div>
    </div>
  );
}

function FlowRow({ f, last, lastRowMd, odd, onOpen }: { f: (typeof FLOWS)[number]; last: boolean; lastRowMd: boolean; odd: boolean; onOpen: (el: HTMLElement) => void }) {
  return (
    <motion.button
      type="button"
      onClick={e => onOpen(e.currentTarget)}
      whileTap={{ scale: 0.985 }}
      whileHover="hover"
      className={cn(
        "group relative flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-100 hover:bg-fill/6 active:bg-fill/10 md:px-5",
        odd && "md:hairline-l",
      )}
    >
      <span className="flex w-[66px] shrink-0 items-center gap-1">
        {f.apps.map((a, i) => (
          <span key={a} className="flex items-center gap-1">
            {i > 0 && <ArrowRight className="h-3 w-3 text-label3" strokeWidth={2.4} />}
            <IconTile icon={META[a].icon} tone={META[a].tone} size={26} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold palt md:text-[15px]">{f.title}</span>
        <span className="mt-0.5 block text-[13px] leading-[1.55] text-label2 [text-wrap:pretty] [word-break:auto-phrase]">{f.body}</span>
      </span>
      <motion.span variants={{ hover: { x: 2 } }}>
        <ChevronRight className="h-[18px] w-[18px] shrink-0 text-label4" strokeWidth={2.4} />
      </motion.span>
      {!last && <span aria-hidden className={cn("pointer-events-none absolute bottom-0 left-4 right-0 h-px origin-bottom scale-y-50 bg-sep/30 md:left-5", lastRowMd && "md:hidden")} />}
    </motion.button>
  );
}

type Theme = "auto" | "light" | "dark";
/** 表示の明るさ（自動・ライト・ダーク）。切り替えはなめらかに溶けるように */
function ThemeSwitch() {
  const [t, setT] = useState<Theme>(() => {
    const v = document.documentElement.dataset.theme;
    return v === "light" || v === "dark" ? v : "auto";
  });
  const apply = (v: Theme) => {
    const run = () => {
      if (v === "auto") delete document.documentElement.dataset.theme;
      else document.documentElement.dataset.theme = v;
      setT(v);
    };
    const d = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    try {
      if (d.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) d.startViewTransition(run);
      else run();
    } catch {
      run();
    }
  };
  const icon = (I: LucideIcon, label: string): ReactNode => (
    <span className="flex items-center" title={label}>
      <I className="h-[15px] w-[15px]" strokeWidth={2.2} />
      <span className="sr-only">{label}</span>
    </span>
  );
  return (
    <Segmented
      size="sm"
      value={t}
      onChange={apply}
      className="shrink-0"
      options={[
        { value: "auto", label: icon(SunMoon, "自動") },
        { value: "light", label: icon(Sun, "ライト") },
        { value: "dark", label: icon(Moon, "ダーク") },
      ]}
    />
  );
}
