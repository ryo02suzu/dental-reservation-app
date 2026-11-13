import { Hammer } from "lucide-react";
import { EmptyState, Page } from "@/ui";

// 仮の画面（このあと作り込む）
export default function LoginApp() {
  return (
    <Page title="ログイン">
      <EmptyState icon={Hammer} title="準備中" message="この画面はこれから作ります" />
    </Page>
  );
}
