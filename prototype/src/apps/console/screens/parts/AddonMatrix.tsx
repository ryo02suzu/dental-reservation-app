// 医院 × オプションの表（PC）。チェックを押すと、その医院のオプションを追加・解約する
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import type { ConsoleClinic } from "@/data";
import { yen } from "@/lib/format";
import { Tag, cn, springBouncy, useToast } from "@/ui";
import { addonMeta } from "./addonMeta";
import { addonMRR, addonStats, addonsTotal } from "./model";
import { CLINIC_KANA, setClinicAddon, useConsole } from "./store";
import { ClinicMark } from "./ui";

export function AddonMatrix({ onOpenClinic }: { onOpenClinic: (id: string) => void }) {
  const s = useConsole();
  const toast = useToast();
  const clinics = [...s.clinics].sort((a, b) => Number(b.active) - Number(a.active) || (CLINIC_KANA[a.id] ?? "").localeCompare(CLINIC_KANA[b.id] ?? "", "ja"));
  const template = `minmax(184px,1.6fr) repeat(${s.addons.length}, minmax(72px,1fr)) 96px`;

  const toggle = (c: ConsoleClinic, key: string) => {
    const a = s.addons.find(x => x.key === key)!;
    const on = !c.addons.includes(key);
    setClinicAddon(c.id, key, on);
    toast(on ? `${a.name}を追加しました` : `${a.name}を解約しました`, { detail: on ? `${c.name} · ${yen(a.price)} / 月` : c.name });
  };

  return (
    <div className="overflow-x-auto rounded-cell bg-surface">
      <div role="table" aria-label="医院ごとのオプション" className="min-w-[680px]">
        {/* 見出し */}
        <div role="row" className="hairline-b grid min-h-[52px] items-center gap-x-2 px-4 py-2" style={{ gridTemplateColumns: template }}>
          <div role="columnheader" className="text-[12px] font-medium text-label2">医院</div>
          {s.addons.map(a => (
            <div key={a.key} role="columnheader" className={cn("min-w-0 text-center leading-tight", !a.active && "opacity-55")} title={a.name}>
              <div className="truncate text-[12px] font-semibold text-label">{addonMeta(a.key).short}</div>
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
          on ? (disabled ? "bg-fill/30 text-surface" : "bg-accent text-surface") : disabled ? "shadow-[inset_0_0_0_1.5px_rgb(var(--label-4)/0.5)]" : "shadow-[inset_0_0_0_1.5px_rgb(var(--label-4))] group-hover/check:shadow-[inset_0_0_0_1.5px_rgb(var(--label-3))]",
        )}
      >
        <AnimatePresence initial={false}>
          {on && (
            <motion.span initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }} transition={springBouncy} className="flex">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
    </motion.button>
  );
}
