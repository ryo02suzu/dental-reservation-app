import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { Drawer } from "vaul";
import { useIsPhone } from "@/lib/media";
import { cn } from "./cn";
import { spring } from "./motion";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  /** 左上（既定は「閉じる」） */
  cancelLabel?: string;
  /** 右上の確定ボタン（太字） */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  /** 下に固定する領域（大きなボタンなど） */
  footer?: ReactNode;
  /** sheet=スマホは下から・PCは中央 / inspector=PCでは右側のパネル */
  variant?: "sheet" | "inspector";
  size?: "md" | "lg";
}

/** スマホでは下から出るシート（つまみ付き・下げて閉じる）、PCでは中央のパネルまたは右側のインスペクタ */
export function Sheet(props: SheetProps) {
  const phone = useIsPhone();
  if (phone) return <PhoneSheet {...props} />;
  return props.variant === "inspector" ? <Inspector {...props} /> : <CenterSheet {...props} />;
}

function Header({ title, cancelLabel, onCancel, confirmLabel, onConfirm, confirmDisabled, TitleTag }: {
  title: string; cancelLabel?: string; onCancel: () => void; confirmLabel?: string; onConfirm?: () => void; confirmDisabled?: boolean;
  TitleTag: typeof Dialog.Title;
}) {
  return (
    <div className="relative flex h-[52px] shrink-0 items-center justify-between px-4">
      <button onClick={onCancel} className="relative z-10 text-[17px] text-accent transition-opacity active:opacity-40">
        {cancelLabel ?? "閉じる"}
      </button>
      <TitleTag className="absolute inset-x-0 mx-auto w-fit max-w-[56%] truncate text-[17px] font-semibold palt">{title}</TitleTag>
      {confirmLabel ? (
        <button
          onClick={onConfirm}
          disabled={confirmDisabled}
          className="relative z-10 text-[17px] font-semibold text-accent transition-opacity active:opacity-40 disabled:opacity-30"
        >
          {confirmLabel}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function PhoneSheet({ open, onOpenChange, title, children, cancelLabel, confirmLabel, onConfirm, confirmDisabled, footer }: SheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/40" />
        <Drawer.Content aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[94dvh] flex-col rounded-t-sheet bg-elevated outline-none">
          <div className="mx-auto mt-[7px] h-[5px] w-9 shrink-0 rounded-full bg-label4" />
          <Header
            title={title}
            cancelLabel={cancelLabel}
            onCancel={() => onOpenChange(false)}
            confirmLabel={confirmLabel}
            onConfirm={onConfirm}
            confirmDisabled={confirmDisabled}
            TitleTag={Drawer.Title as unknown as typeof Dialog.Title}
          />
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">{children}</div>
          {footer && <div className="hairline-t shrink-0 bg-elevated px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">{footer}</div>}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function CenterSheet({ open, onOpenChange, title, children, cancelLabel, confirmLabel, onConfirm, confirmDisabled, footer, size = "md" }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[60] bg-black/25"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className={cn(
                  "fixed inset-0 z-[61] m-auto flex h-fit max-h-[86vh] flex-col overflow-hidden rounded-[20px] bg-elevated shadow-pop outline-none",
                  size === "lg" ? "w-[min(760px,94vw)]" : "w-[min(560px,92vw)]",
                )}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 6, transition: { duration: 0.14 } }}
                transition={spring}
              >
                <Header
                  title={title}
                  cancelLabel={cancelLabel}
                  onCancel={() => onOpenChange(false)}
                  confirmLabel={confirmLabel}
                  onConfirm={onConfirm}
                  confirmDisabled={confirmDisabled}
                  TitleTag={Dialog.Title}
                />
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
                {footer && <div className="hairline-t shrink-0 px-5 pb-5 pt-4">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function Inspector({ open, onOpenChange, title, children, cancelLabel, confirmLabel, onConfirm, confirmDisabled, footer }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[60] bg-black/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed bottom-3 right-3 top-3 z-[61] flex w-[420px] flex-col overflow-hidden rounded-[20px] bg-elevated shadow-pop outline-none"
                initial={{ opacity: 0, x: 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, transition: { duration: 0.14 } }}
                transition={spring}
              >
                <Header
                  title={title}
                  cancelLabel={cancelLabel}
                  onCancel={() => onOpenChange(false)}
                  confirmLabel={confirmLabel}
                  onConfirm={onConfirm}
                  confirmDisabled={confirmDisabled}
                  TitleTag={Dialog.Title}
                />
                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
                {footer && <div className="hairline-t shrink-0 px-5 pb-5 pt-4">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
