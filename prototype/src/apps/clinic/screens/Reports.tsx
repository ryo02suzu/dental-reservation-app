import { Hammer } from "lucide-react";
import { EmptyState, Page } from "@/ui";
import { useClinicUI } from "../context";

// 仮の画面（このあと作り込む）
export default function ReportsScreen({ param }: { param?: string }) {
  const ui = useClinicUI();
  void param;
  return (
    <Page title="レポート" back={ui.back}>
      <EmptyState icon={Hammer} title="準備中" message="この画面はこれから作ります" />
    </Page>
  );
}
