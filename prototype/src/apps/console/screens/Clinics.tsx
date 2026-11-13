import { Hammer } from "lucide-react";
import { EmptyState, Page } from "@/ui";

// 仮の画面（このあと作り込む）
export default function ConsoleClinics({ param }: { param?: string }) {
  void param;
  return (
    <Page title="医院">
      <EmptyState icon={Hammer} title="準備中" message="この画面はこれから作ります" />
    </Page>
  );
}
