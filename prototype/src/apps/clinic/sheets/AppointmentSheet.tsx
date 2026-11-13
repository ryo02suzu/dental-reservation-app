import { Sheet } from "@/ui";

// 仮のシート（このあと作り込む）
export function AppointmentSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!id} onOpenChange={o => { if (!o) onClose(); }} title="予約の詳細" variant="inspector">
      <p className="py-8 text-center text-label2">準備中</p>
    </Sheet>
  );
}
