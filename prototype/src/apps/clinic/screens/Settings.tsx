import { useMemo, useState, type ComponentType } from "react";
import {
  Building2, CalendarOff, Clock, CreditCard, Globe, HelpCircle, LogOut, MessageCircle, Armchair, BellRing, Stethoscope, Users,
} from "lucide-react";
import { useRoute } from "@/lib/nav";
import { hm } from "@/lib/format";
import { staff as staffList } from "@/data";
import { PLANS } from "@/data";
import { IconTile, ListRow, ListSection, Page, SearchField, cn } from "@/ui";
import { ArcheMark } from "@/apps/launcher/ArcheMark";
import { useClinicUI } from "../context";
import { AccountPage, HelpPage, InfoPage, LinePage, PlanPage, StaffPage, UnitsPage } from "./settings/pages";
import { HolidaysPage, HoursPage } from "./settings/schedulePages";
import { MenuPage, RemindersPage, WebPage } from "./settings/bookingPages";
import { useTwoPane } from "./settings/parts";
import { useSettings, type SettingsState } from "./settings/store";
import type { LucideIcon } from "lucide-react";
import type { TileTone } from "@/data";

interface Item { key: string; title: string; icon: LucideIcon; tone: TileTone; page: ComponentType; value?: (s: SettingsState) => string | undefined }

const GROUPS: { header: string; items: Item[] }[] = [
  {
    header: "医院",
    items: [
      { key: "info", title: "医院の情報", icon: Building2, tone: "sand", page: InfoPage },
      {
        key: "hours", title: "診療時間", icon: Clock, tone: "ocean", page: HoursPage,
        value: s => {
          const open = Object.values(s.hours).filter(h => h.open);
          if (!open.length) return "なし";
          return `${hm(Math.min(...open.map(h => h.am[0])))}–${hm(Math.max(...open.map(h => h.pm[1])))}`;
        },
      },
      { key: "holidays", title: "休診日", icon: CalendarOff, tone: "clay", page: HolidaysPage, value: s => [1, 2, 3, 4, 5, 6, 0].filter(d => !s.hours[d].open).map(d => "日月火水木金土"[d]).concat(s.holidays.national ? ["祝"] : []).join("・") || "なし" },
      { key: "units", title: "ユニット", icon: Armchair, tone: "slate", page: UnitsPage, value: s => `${s.units.length}台` },
    ],
  },
  {
    header: "予約",
    items: [
      { key: "menu", title: "診療メニュー", icon: Stethoscope, tone: "sage", page: MenuPage, value: s => `${s.menu.length}件` },
      { key: "web", title: "Web予約", icon: Globe, tone: "ocean", page: WebPage, value: s => (s.web.enabled ? "受付中" : "停止中") },
      { key: "reminders", title: "リマインド通知", icon: BellRing, tone: "amber", page: RemindersPage, value: s => [s.reminders.dayBefore && "前日", s.reminders.sameDay && "当日"].filter(Boolean).join("・") || "オフ" },
    ],
  },
  { header: "スタッフ", items: [{ key: "staff", title: "スタッフとアカウント", icon: Users, tone: "plum", page: StaffPage, value: s => `${staffList.length + s.invited.length}人` }] },
  { header: "連携", items: [{ key: "line", title: "LINE公式アカウント", icon: MessageCircle, tone: "sage", page: LinePage, value: s => (s.line.linked ? "連携済み" : "未連携") }] },
  {
    header: "その他",
    items: [
      { key: "plan", title: "プランとお支払い", icon: CreditCard, tone: "graphite", page: PlanPage, value: s => PLANS[s.plan.key].label },
      { key: "help", title: "ヘルプ", icon: HelpCircle, tone: "slate", page: HelpPage },
    ],
  },
];
const ALL = GROUPS.flatMap(g => g.items);
const EXTRA: Record<string, { title: string; page: ComponentType }> = { account: { title: "アカウント", page: AccountPage } };
const pageOf = (k?: string) => ALL.find(i => i.key === k) ?? (k && EXTRA[k] ? { key: k, ...EXTRA[k] } : undefined);

/** 設定。スマホ・iPad縦は iOS の設定のように積み重ね、広い画面は macOS のシステム設定のように左右2列 */
export default function SettingsScreen({ param }: { param?: string }) {
  const ui = useClinicUI();
  const two = useTwoPane();
  const { go } = useRoute();
  const sub = pageOf(param);

  if (two) {
    const cur = sub ?? ALL[0];
    const Body = cur.page;
    return (
      <div className="flex h-full bg-bg">
        <SettingsSidebar active={cur.key} onPick={k => go("settings", k, { replace: true })} />
        <div className="min-w-0 flex-1">
          <Page key={cur.key} title={cur.title}>
            <div className="max-w-[680px]"><Body /></div>
          </Page>
        </div>
      </div>
    );
  }

  if (sub) {
    const Body = sub.page;
    return (
      <Page title={sub.title} back={{ label: "設定", onClick: () => go("settings") }}>
        <div className="mx-auto max-w-[680px]"><Body /></div>
      </Page>
    );
  }
  return (
    <Page title="設定" back={ui.back}>
      <div className="mx-auto max-w-[680px]">
        <RootList onPick={k => go("settings", k)} />
      </div>
    </Page>
  );
}

/** スマホの最初の画面（iOSの設定と同じ並び） */
function RootList({ onPick }: { onPick: (k: string) => void }) {
  const s = useSettings();
  const { goApp } = useRoute();
  return (
    <>
      <ListSection>
        <ListRow
          leading={<ArcheMark size={52} />}
          inset={84}
          title={<span className="text-[19px] font-semibold">{s.info.name}</span>}
          subtitle={`${PLANS[s.plan.key].label}プラン · ユニット${s.units.length}台`}
          chevron
          onClick={() => onPick("info")}
        />
      </ListSection>
      {GROUPS.map(g => (
        <ListSection key={g.header} header={g.header}>
          {g.items.map(i => (
            <ListRow key={i.key} icon={i.icon} tone={i.tone} title={i.title} value={i.value?.(s)} chevron onClick={() => onPick(i.key)} />
          ))}
        </ListSection>
      ))}
      <ListSection>
        <ListRow icon={LogOut} tone="graphite" title="ログアウト" destructive onClick={() => goApp("login")} />
      </ListSection>
    </>
  );
}

/** 広い画面の左の列（macOS のシステム設定のサイドバー） */
function SettingsSidebar({ active, onPick }: { active: string; onPick: (k: string) => void }) {
  const s = useSettings();
  const { goApp } = useRoute();
  const [q, setQ] = useState("");
  const groups = useMemo(() => {
    const t = q.trim();
    return t ? GROUPS.map(g => ({ ...g, items: g.items.filter(i => i.title.includes(t) || g.header.includes(t)) })).filter(g => g.items.length) : GROUPS;
  }, [q]);
  return (
    <aside className="hairline-r flex w-[280px] shrink-0 flex-col bg-surface2/60">
      <div className="px-4 pb-3 pt-5">
        <h1 className="text-[22px] font-bold leading-7 palt">設定</h1>
        <SearchField value={q} onChange={setQ} placeholder="設定を検索" className="mt-3" />
      </div>
      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        <button
          onClick={() => onPick("info")}
          className="mb-2 flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-fill/8"
        >
          <ArcheMark size={36} />
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-semibold leading-5">{s.info.name}</span>
            <span className="block truncate text-[12px] leading-4 text-label2">{PLANS[s.plan.key].label}プラン · ユニット{s.units.length}台</span>
          </span>
        </button>
        {groups.map(g => (
          <div key={g.header} className="mt-3">
            <div className="px-2.5 pb-1 text-[11px] font-semibold text-label3">{g.header}</div>
            {g.items.map(i => {
              const on = active === i.key;
              return (
                <button
                  key={i.key}
                  onClick={() => onPick(i.key)}
                  aria-current={on ? "page" : undefined}
                  className={cn("flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[14px] transition-colors", on ? "bg-fill/14 font-semibold" : "hover:bg-fill/8")}
                >
                  <IconTile icon={i.icon} tone={i.tone} size={22} />
                  <span className="min-w-0 flex-1 truncate">{i.title}</span>
                </button>
              );
            })}
          </div>
        ))}
        {!groups.length && <p className="px-2.5 pt-4 text-[13px] text-label2">「{q}」に当てはまる設定はありません</p>}
        <div className="mt-3">
          <button onClick={() => goApp("login")} className="flex h-[34px] w-full items-center gap-2.5 rounded-[8px] px-2 text-left text-[14px] text-red transition-colors hover:bg-fill/8">
            <IconTile icon={LogOut} tone="graphite" size={22} />
            ログアウト
          </button>
        </div>
      </nav>
    </aside>
  );
}
