import { Sheet } from "@/ui";
import type { NewPrefill } from "../context";

// 仮のシート（このあと作り込む）
export function NewAppointmentSheet({ open, prefill, onClose }: { open: boolean; prefill?: NewPrefill; onClose: () => void }) {
  void prefill;
  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }} title="新規予約" confirmLabel="追加" onConfirm={onClose}>
      <p className="py-8 text-center text-label2">準備中</p>
    </Sheet>
  );
}
