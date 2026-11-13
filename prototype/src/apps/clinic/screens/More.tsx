import { ArrowUpRight, BarChart3, BellRing, CalendarClock, NotebookPen, Settings } from "lucide-react";
import { useRoute } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { clinic, staffById } from "@/data";
import { Avatar, ListRow, ListSection, Page } from "@/ui";
import { useClinicUI } from "../context";

/** スマホの「その他」タブ。PCではサイドバーに同じ項目が並ぶ */
export default function MoreScreen() {
  const { go } = useClinicUI();
  const { goApp } = useRoute();
  const { recalls, currentStaffId } = useStore();
  // ログインで選んだ人（PCのサイドバーと同じ）
  const me = staffById(currentStaffId) ?? staffById("s6");
  const pending = recalls.filter(r => r.status === "未連絡").length;
  return (
    <Page title="その他">
      <ListSection>
        <ListRow leading={<Avatar name={me.name} tone={me.tone} size={52} />} title={<span className="text-[19px] font-semibold">{me.name}</span>} subtitle={`${clinic.name} · ${me.role}`} chevron onClick={() => go("settings", "account")} inset={84} />
      </ListSection>
      <ListSection header="診療">
        <ListRow icon={NotebookPen} tone="sage" title="診療メモ" chevron onClick={() => go("records")} />
        <ListRow icon={BellRing} tone="clay" title="リコール" value={pending ? `未連絡 ${pending}` : undefined} chevron onClick={() => go("recall")} />
      </ListSection>
      <ListSection header="経営">
        <ListRow icon={BarChart3} tone="slate" title="レポート" chevron onClick={() => go("reports")} />
        <ListRow icon={CalendarClock} tone="ocean" title="シフト・勤怠" chevron onClick={() => go("staff")} />
      </ListSection>
      <ListSection>
        <ListRow icon={Settings} tone="graphite" title="設定" chevron onClick={() => go("settings")} />
      </ListSection>
      <ListSection footer="医院・患者・予約はすべて架空のサンプルです。">
        <ListRow icon={ArrowUpRight} tone="sand" title="プロトタイプのトップへ" onClick={() => goApp("launcher")} />
      </ListSection>
    </Page>
  );
}
