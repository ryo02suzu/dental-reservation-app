import { Sheet } from "@/ui";

// 仮の全体検索（このあと作り込む）
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }} title="検索">
      <p className="py-8 text-center text-label2">準備中</p>
    </Sheet>
  );
}
