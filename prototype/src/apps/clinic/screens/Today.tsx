import { useCallback, useRef, useState } from "react";
import { LayoutGroup } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { TODAY, TODAY_KEY } from "@/lib/clock";
import { mdw } from "@/lib/format";
import { useIsPhone, useIsWide } from "@/lib/media";
import { clinicPhase } from "@/data";
import { Button, IconButton, Page, cn } from "@/ui";
import { useClinicUI } from "../context";
import { useToday } from "./today/model";
import { Overview, type JumpTarget } from "./today/Overview";
import { AttentionList } from "./today/Attention";
import { WaitingList } from "./today/Waiting";
import { UnitGrid } from "./today/Units";
import { UpcomingList } from "./today/Upcoming";
import { Section } from "./today/parts";
import { useMinWidth, useStickyTop } from "./today/layout";

/**
 * 今日（受付のホーム）。ひと目で「誰が来ていて、次は誰か、誰が遅れているか、どのユニットが空いているか、
 * いま何をすればよいか」がわかるように、優先順に並べる。
 * スマホ・iPad縦：上から優先順の1列 / 1024px以上：左に「対応が必要・これから」、右にユニットと待合（右は画面に貼り付く）
 */
export default function TodayScreen({ param }: { param?: string }) {
  void param;
  const ui = useClinicUI();
  const phone = useIsPhone();
  const desktop = useMinWidth(1024);
  const wide = useIsWide();
  const t = useToday();
  const aside = useRef<HTMLDivElement>(null);
  const asideTop = useStickyTop(aside, 68);
  const [showDone, setShowDone] = useState(false);
  const phase = clinicPhase(t.now);

  const jump = useCallback((to: JumpTarget) => {
    if (to === "finished") setShowDone(true);
    const id = to === "finished" ? "today-upcoming" : `today-${to}`;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const subtitle = (
    <span className="flex flex-wrap items-baseline gap-x-2">
      <span className="tnum">{mdw(TODAY)}</span>
      <span className="whitespace-nowrap tnum">
        <span className="mr-2 text-label4" aria-hidden>·</span>
        {phase.label}
        {phase.detail ? `・${phase.detail}` : ""}
      </span>
    </span>
  );

  const actions = phone ? (
    <>
      <IconButton icon={Search} label="患者・予約を検索" variant="plain" onClick={ui.openSearch} />
      <IconButton icon={Plus} label="新規予約" variant="plain" onClick={() => ui.openNew({ date: TODAY_KEY })} />
    </>
  ) : (
    <Button size="sm" icon={Plus} onClick={() => ui.openNew({ date: TODAY_KEY })}>
      新規予約
    </Button>
  );

  const attention = (
    <Section id="today-attention" title="対応が必要" count={t.attention.length || undefined}>
      <AttentionList t={t} />
    </Section>
  );
  const waiting = (
    <Section id="today-waiting" title="待合" count={t.waiting.length || undefined}>
      <WaitingList t={t} />
    </Section>
  );
  const unitsBlock = (
    <Section id="today-units" title="ユニット">
      <UnitGrid t={t} className="grid-cols-2" />
    </Section>
  );
  const upcoming = (
    <Section
      id="today-upcoming"
      title="これから"
      count={t.upcoming.length}
      aside={
        <button type="button" onClick={() => ui.go("schedule")} className="-mr-1 rounded-md px-1 text-[15px] text-accent transition-opacity hover:opacity-70 active:opacity-40">
          予約台帳
        </button>
      }
    >
      <UpcomingList t={t} showDone={showDone} onToggleDone={() => setShowDone(v => !v)} />
    </Section>
  );

  return (
    <Page title="今日" subtitle={subtitle} actions={actions} back={ui.back}>
      <LayoutGroup id="today">
        {desktop ? (
          <>
            <Overview t={t} layout={wide ? "wide" : "desktop"} />
            <div className={cn("mt-8 grid items-start", wide ? "grid-cols-[minmax(0,1fr)_340px] gap-8" : "grid-cols-[minmax(0,1fr)_316px] gap-6")}>
              <div className="space-y-9">
                {attention}
                {upcoming}
              </div>
              <div ref={aside} className="sticky space-y-9" style={{ top: asideTop }}>
                {unitsBlock}
                {waiting}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-8">
            <Overview t={t} layout={phone ? "phone" : "tablet"} onJump={jump} />
            {attention}
            {waiting}
            {unitsBlock}
            {upcoming}
          </div>
        )}
      </LayoutGroup>
    </Page>
  );
}
