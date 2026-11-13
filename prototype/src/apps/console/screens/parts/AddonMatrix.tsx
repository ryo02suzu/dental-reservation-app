// 医院 × オプションの表（PC）。チェックを押すと、その医院のオプションを追加・解約する
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ConsoleClinic } from "@/data";
import { yen } from "@/lib/format";
import { useState } from "react";
import { Tag, cn, springBouncy, useToast } from "@/ui";
import { addonMeta } from "./addonMeta";
import { addonMRR, addonStats, addonsTotal, clinicMRR } from "./model";
import { CLINIC_KANA, setClinicAddon, useConsole } from "./store";
import { ClinicMark, ConfirmSheet, SheetGroup } from "./ui";

export function AddonMatrix({ onOpenClinic }: { onOpenClinic: (id: string) => void }) {
  const s = useConsole();
  const toast = useToast();
  const clinics = [...s.clinics].sort((a, b) => Number(b.active) - Number(a.active) || (CLINIC_KANA[a.id] ?? "").localeCompare(CLINIC_KANA[b.id] ?? "", "ja"));
  const template = `minmax(160px,1.6fr) repeat(${s.addons.length}, minmax(80px,1fr)) 80px`;

  const [cancel, setCancel] = useState<{ clinic: ConsoleClinic; key: string } | null>(null);
  // 追加はその場で。解約は請求が変わるので確認してから
  const toggle = (c: ConsoleClinic, key: string) => {
    const a = s.addons.find(x => x.key === key)!;
    if (c.addons.includes(key)) return setCancel({ clinic: c, key });
    setClinicAddon(c.id, key, true);
    toast(`${a.name}を追加しました`, { detail: `${c.name} · ${yen(a.price)} / 月` });
  };
  const ca = cancel ? s.addons.find(x => x.key === cancel.key) : undefined;
  const cc = cancel ? s.clinics.find(x => x.id === cancel.clinic.id) : undefined;
  const confirmCancel = () => {
    if (!ca || !cc) return;
    setClinicAddon(cc.id, ca.key, false);
    toast(`${ca.name}を解約しました`, { detail: cc.name });
    setCancel(null);
  };

  return (
    <div className="overflow-x-auto rounded-cell bg-surface">
      <div role="table" aria-label="医院ごとのオプション" className="min-w-[640px]">
        {/* 見出し */}
        <div role="row" className="hairline-b grid min-h-[52px] items-center gap-x-2 px-4 py-2" style={{ gridTemplateColumns: template }}>
          <div role="columnheader" className="text-[12px] font-medium text-label2">医院</div>
          {s.addons.map(a => (
            <div key={a.key} role="columnheader" className={cn("min-w-0 text-center leading-tight", !a.active && "opacity-55")} title={a.name}>
              <div className="whitespace-nowrap text-[12px] font-semibold tracking-[-0.02em] text-label">{addonMeta(a.key).short}</div>
              <div className="mt-0.5 truncate text-[11px] text-label3 tnum">{a.active ? yen(a.price) : "提供停止"}</div>
            </div>
          ))}
          <div role="columnheader" className="text-right text-[12px] font-medium text-label2">月額</div>
        </div>

        {clinics.map(c => {
          const total = addonsTotal(s, c);
          return (
            <div key={c.id} role="row" className={cn("group relative grid min-h-[48px] items-center gap-x-2 px-4 py-1.5", !c.active && "text-label2")} style={{ gridTemplateColumns: template }}>
              <button role="rowheader" onClick={() => onOpenClinic(c.id)} className="flex min-w-0 items-center gap-2.5 rounded-[8px] py-1 text-left hover:text-accent">
                <ClinicMark name={c.name} size={26} className={cn(!c.active && "opacity-50")} />
                <span className="truncate text-[14px]">{c.name}</span>
                {!c.active && <Tag tone="outline" className="shrink-0">停止中</Tag>}
              </button>
              {s.addons.map(a => {
                const on = c.addons.includes(a.key);
                const can = c.active && (a.active || on);
                return (
                  <div key={a.key} role="cell" className="flex justify-center">
                    <CheckToggle
                      on={on}
                      disabled={!can}
                      label={`${c.name}の${a.name}`}
                      hint={!c.active ? "停止中の医院は変更できません" : !a.active && !on ? "提供を停止しています" : undefined}
                      onToggle={() => toggle(c, a.key)}
                    />
                  </div>
                );
              })}
              <div role="cell" className={cn("text-right text-[14px] tnum", total ? "font-medium" : "text-label3")}>{total ? yen(total) : "—"}</div>
              <span aria-hidden className="pointer-events-none absolute bottom-0 left-[52px] right-0 h-px origin-bottom scale-y-50 bg-sep/30" />
            </div>
          );
        })}

        {/* 列の合計 */}
        <div role="row" className="grid min-h-[56px] items-center gap-x-2 bg-fill/[0.04] px-4 py-2" style={{ gridTemplateColumns: template }}>
          <div role="rowheader" className="text-[13px] font-semibold">合計</div>
          {s.addons.map(a => {
            const st = addonStats(s, a.key);
            return (
              <div key={a.key} role="cell" className="text-center leading-tight tnum">
                <div className="text-[13px] font-semibold">{st.count}医院</div>
                <div className="mt-0.5 text-[11px] text-label2">{yen(st.revenue)}</div>
              </div>
            );
          })}
          <div role="cell" className="text-right text-[15px] font-semibold tnum">{yen(addonMRR(s))}</div>
        </div>
      </div>
      <ConfirmSheet open={!!cancel} onClose={() => setCancel(null)} title="オプションを解約" confirmLabel="解約する" destructive onConfirm={confirmCancel}>
        {ca && cc && (
          <>
            <p className="px-1 pb-1 text-[15px] leading-[1.7] [text-wrap:pretty] [word-break:auto-phrase]">
              <span className="font-semibold">{cc.name}</span>の<span className="font-semibold">{ca.name}</span>を解約します。
              {!ca.active && "提供を停止しているため、解約すると再び追加することはできません。"}
            </p>
            <SheetGroup header="月額の変化" footer="解約は今日から有効です。差額は日割りで、次回の請求に反映されます。">
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] tnum">
                <span>
                  <span className="text-label2">{yen(clinicMRR(s, cc))}</span>
                  <span className="mx-1.5 text-label3">→</span>
                  <span className="font-semibold">{yen(clinicMRR(s, cc) - ca.price)}</span>
                </span>
                <span className="shrink-0 text-[14px] font-semibold text-label2">−{yen(ca.price)}</span>
              </div>
            </SheetGroup>
          </>
        )}
      </ConfirmSheet>
    </div>
  );
}

function CheckToggle({ on, disabled, label, hint, onToggle }: { on: boolean; disabled?: boolean; label: string; hint?: string; onToggle: () => void }) {
  return (
    <motion.button
      role="checkbox"
      aria-checked={on}
      aria-label={label}
      title={hint}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.86 }}
      onClick={onToggle}
      className={cn(
        "group/check relative flex h-9 w-9 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed",
        !disabled && "hover:bg-fill/10",
      )}
    >
      <span
        className={cn(
          "flex h-[22px] w-[22px] items-center justify-center rounded-full transition-colors duration-150",
          on ? (disabled ? "text-label3" : "text-label") : disabled ? "" : "shadow-[inset_0_0_0_1.5px_rgb(var(--label-4)/0.6)] group-hover/check:shadow-[inset_0_0_0_1.5px_rgb(var(--label-3))]",
        )}
      >
        <AnimatePresence initial={false}>
          {on && (
            <motion.span initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={springBouncy} className="flex">
              <Check className="h-[18px] w-[18px]" strokeWidth={2.6} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
