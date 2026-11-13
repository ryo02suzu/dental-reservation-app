import type { ComponentType, ReactNode } from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import { cn } from "./cn";
import type { LucideIcon } from "lucide-react";

/** iOSのコンテキストメニュー風のドロップダウン（文字は左、アイコンは右） */
export function Menu({ trigger, children, align = "end" }: { trigger: ReactNode; children: ReactNode; align?: "start" | "end" | "center" }) {
  return (
    <DM.Root>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          sideOffset={6}
          className="material-thick z-[80] min-w-[220px] overflow-hidden rounded-[13px] py-1 shadow-pop outline-none data-[state=open]:animate-[menuIn_160ms_cubic-bezier(0.22,1,0.36,1)]"
        >
          {children}
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  );
}

export function MenuItem({ children, icon: Icon, onSelect, destructive }: {
  children: ReactNode; icon?: LucideIcon; onSelect?: () => void; destructive?: boolean;
}) {
  return (
    <DM.Item
      onSelect={onSelect}
      className={cn(
        "mx-1 flex h-9 cursor-default select-none items-center justify-between gap-6 rounded-[8px] px-3 text-[15px] outline-none data-[highlighted]:bg-fill/16",
        destructive ? "text-red" : "text-label",
      )}
    >
      <span className="truncate">{children}</span>
      {Icon && <Icon className="h-[17px] w-[17px] shrink-0 opacity-80" strokeWidth={2} />}
    </DM.Item>
  );
}

export const MenuSeparator = () => <DM.Separator className="my-1 h-[5px] bg-fill/8" />;
