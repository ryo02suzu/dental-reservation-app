import { useEffect, useMemo } from "react";
import { useIsPresent } from "framer-motion";
import { useRoute } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { demoDraft, hasFinishedBooking, isReady, isStep, useBooking, type Step } from "./parts/booking";
import { StepType } from "./parts/StepType";
import { StepMenu } from "./parts/StepMenu";
import { StepTime } from "./parts/StepTime";
import { StepInfo } from "./parts/StepInfo";
import { StepConfirm } from "./parts/StepConfirm";
import { StepDone } from "./parts/StepDone";

/**
 * Web予約の手順（#patient--book--<手順>）。type → menu → time → info → confirm → done。
 * 途中の手順を # で直接開いて内容が足りないときは、現実的な下書き（再診・定期検診）で埋めて表示する。
 */
export default function Booking({ param }: { param?: string }) {
  const { go } = useRoute();
  const { draft, setDraft, reset } = useBooking();
  const { appointments } = useStore();
  const step: Step = isStep(param) ? param : "type";

  useEffect(() => {
    if (!isStep(param)) go("book", "type", { replace: true });
  }, [param, go]);

  const ready = isReady(step, draft);
  // 確定したあとに（ブラウザの「戻る」などで）手順の画面へ戻ってきたとき。確定済みの内容を
  // もう一度見せると二重予約の入口になるので、最初の手順なら新しい予約として始め、それ以外はホームへ。
  // 抜けていく途中の画面（確認→完了で後ろに下がる確認画面など）では判定しない
  const present = useIsPresent();
  const stale = present && (step !== "done" ? !!draft.apptId : !ready && hasFinishedBooking());
  useEffect(() => {
    if (!stale) return;
    if (step === "type") reset();
    else {
      if (step !== "done") reset();
      go("home", undefined, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stale]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demo = useMemo(() => (ready || stale ? null : demoDraft(appointments)), [ready, stale]);
  useEffect(() => {
    if (demo) setDraft(demo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  const d = demo ? { ...draft, ...demo } : draft;
  if (stale && step !== "type") return <div className="h-full bg-bg" />;

  switch (step) {
    case "type":
      return <StepType d={d} />;
    case "menu":
      return <StepMenu d={d} />;
    case "time":
      return <StepTime d={d} />;
    case "info":
      return <StepInfo d={d} />;
    case "confirm":
      return <StepConfirm d={d} />;
    case "done":
      return <StepDone d={d} />;
  }
}
