import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import type { Addon } from "@/data";
import { yen } from "@/lib/format";
import { useIsPhone } from "@/lib/media";
import { useRoute } from "@/lib/nav";
import { IconTile, ListSection, Page, SectionTitle, Switch, cn, springSoft, useToast } from "@/ui";
import { AddonMatrix } from "./parts/AddonMatrix";
import { AddonSheet } from "./parts/AddonSheet";
import { addonMeta } from "./parts/addonMeta";
import { addonMRR, addonStats } from "./parts/model";
import { setOffered, useConsole, type ConsoleState } from "./parts/store";
import { RowRule } from "./parts/ui";

/** オプション（提供しているオプションの一覧・料金・導入状況） */
export default function ConsoleAddons({ param }: { param?: string }) {
  void param;
  const s = useConsole();
  const phone = useIsPhone();
  const { go } = useRoute();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const offered = s.addons.filter(a => a.active).length;
  const users = s.clinics.filter(c => c.addons.length > 0).length;

  const toggleOffer = (a: Addon, on: boolean) => {
    const st = addonStats(s, a.key);
    setOffered(a.key, on);
    toast(on ? `${a.name}の提供を再開しました` : `${a.name}の提供を停止しました`, {
      detail: on ? "新しい医院も申し込めます" : st.count ? `導入中の${st.count}医院は、そのまま使えます` : "新しい申し込みを受け付けません",
    });
  };

  return (
    <Page title="オプション" subtitle={`提供中 ${offered} / ${s.addons.length}件 · 導入 ${users}医院 · 売上 ${yen(addonMRR(s))} / 月`}>
      {phone ? (
        <ListSection footer="オプションを押すと、料金の変更と導入している医院を確認できます。">
          {s.addons.map(a => (
            <PhoneAddonRow key={a.key} a={a} s={s} onOpen={() => setEditing(a.key)} onOffer={v => toggleOffer(a, v)} />
          ))}
        </ListSection>
      ) : (
        <>
          <Catalog s={s} onOpen={setEditing} onOffer={toggleOffer} />
          <SectionTitle className="!mt-10" aside={<span className="text-footnote text-label2">チェックを押すと追加・解約できます</span>}>医院ごとの導入状況</SectionTitle>
          <AddonMatrix onOpenClinic={id => go("clinics", id)} />
        </>
      )}
      <AddonSheet addonKey={editing} onClose={() => setEditing(null)} />
    </Page>
  );
}

/** 導入の割合を表す細い帯 */
function Adoption({ count, total, className }: { count: number; total: number; className?: string }) {
  return (
    <span className={cn("block h-1 overflow-hidden rounded-full bg-fill/16", className)} aria-hidden>
      <motion.span className="block h-full rounded-full bg-accent" initial={false} animate={{ width: `${(count / Math.max(1, total)) * 100}%` }} transition={springSoft} />
    </span>
  );
}

// ─── PC：一覧（表の形） ───────────────────────────────────────────────────
const CATALOG_COLS = "minmax(0,1fr) 112px 184px 112px 64px";

function Catalog({ s, onOpen, onOffer }: { s: ConsoleState; onOpen: (k: string) => void; onOffer: (a: Addon, on: boolean) => void }) {
  const n = s.clinics.length;
  return (
    <div role="table" aria-label="オプション" className="overflow-hidden rounded-cell bg-surface">
      <div role="row" className="hairline-b grid h-9 items-center gap-x-4 px-4 text-[12px] font-medium text-label2" style={{ gridTemplateColumns: CATALOG_COLS }}>
        <span role="columnheader" className="pl-12">オプション</span>
        <span role="columnheader" className="text-right">月額</span>
        <span role="columnheader">導入</span>
        <span role="columnheader" className="text-right">売上 / 月</span>
        <span role="columnheader" className="text-right">提供中</span>
      </div>
      {s.addons.map(a => {
        const st = addonStats(s, a.key);
        const m = addonMeta(a.key);
        return (
          <div
            key={a.key}
            role="row"
            tabIndex={0}
            onClick={() => onOpen(a.key)}
            onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(a.key))}
            className="group relative grid min-h-[64px] cursor-default items-center gap-x-4 px-4 py-2.5 outline-none transition-colors duration-100 hover:bg-fill/[0.05] focus-visible:bg-fill/[0.06]"
            style={{ gridTemplateColumns: CATALOG_COLS }}
          >
            <div role="cell" className="flex min-w-0 items-center gap-3">
              <span className={cn("transition-opacity", !a.active && "opacity-45")}><IconTile icon={m.icon} tone={m.tone} size={32} /></span>
              <div className="min-w-0">
                <div className={cn("truncate text-[15px] font-medium", !a.active && "text-label2")}>{a.name}</div>
                <div className="truncate text-[13px] text-label2">{a.active ? a.description : "提供を停止中（導入中の医院はそのまま使えます）"}</div>
              </div>
            </div>
            <div role="cell" className="flex items-center justify-end gap-1.5 text-[14px] tnum">
              <Pencil className="h-3.5 w-3.5 text-label3 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2.2} />
              {yen(a.price)}
            </div>
            <div role="cell" className="min-w-0">
              <div className="flex items-baseline justify-between text-[13px] tnum">
                <span><span className="font-semibold">{st.count}</span><span className="text-label2"> / {n} 医院</span></span>
                <span className="text-[12px] text-label3">{Math.round((st.count / n) * 100)}%</span>
              </div>
              <Adoption count={st.count} total={n} className="mt-1.5" />
            </div>
            <div role="cell" className="text-right text-[14px] font-medium tnum">{yen(st.revenue)}</div>
            <div role="cell" className="flex justify-end" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
              <Switch checked={a.active} onChange={v => onOffer(a, v)} label={`${a.name}を提供する`} />
            </div>
            <RowRule inset={64} />
          </div>
        );
      })}
    </div>
  );
}

// ─── iPhone：1行ずつ ─────────────────────────────────────────────────────
function PhoneAddonRow({ a, s, onOpen, onOffer }: { a: Addon; s: ConsoleState; onOpen: () => void; onOffer: (v: boolean) => void }) {
  const st = addonStats(s, a.key);
  const m = addonMeta(a.key);
  const n = s.clinics.length;
  return (
    <div className="group relative flex items-start">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-3 text-left transition-colors duration-100 active:bg-fill/16">
        <span className={cn("pt-0.5", !a.active && "opacity-45")}><IconTile icon={m.icon} tone={m.tone} /></span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[16px] font-medium leading-[21px]", !a.active && "text-label2")}>{a.name}</span>
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-label2">{a.active ? a.description : "提供を停止中"}</span>
          <Meta>
            <span className="font-medium text-label">{yen(a.price)}</span> / 月 · 導入 <span className="font-medium text-label">{st.count}</span> / {n} 医院
          </Meta>
          <Adoption count={st.count} total={n} className="mt-2 w-full max-w-[220px]" />
        </span>
      </button>
      <div className="shrink-0 pr-4 pt-3.5">
        <Switch checked={a.active} onChange={onOffer} label={`${a.name}を提供する`} />
      </div>
      <RowRule inset={60} />
    </div>
  );
}
const Meta = ({ children }: { children: ReactNode }) => <span className="mt-1.5 block text-[13px] text-label2 tnum">{children}</span>;
