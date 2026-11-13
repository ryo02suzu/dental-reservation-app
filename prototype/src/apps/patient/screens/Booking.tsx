import { useEffect, useMemo } from "react";
import { useRoute } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { demoDraft, isReady, isStep, useBooking, type Step } from "./parts/booking";
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
  const { draft, setDraft } = useBooking();
  const { appointments } = useStore();
  const step: Step = isStep(param) ? param : "type";

  useEffect(() => {
    if (!isStep(param)) go("book", "type", { replace: true });
  }, [param, go]);

  const ready = isReady(step, draft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const demo = useMemo(() => (ready ? null : demoDraft(appointments)), [ready]);
  useEffect(() => {
    if (demo) setDraft(demo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo]);
  const d = demo ? { ...draft, ...demo } : draft;

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
