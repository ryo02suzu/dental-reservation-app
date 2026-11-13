import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Building2, CalendarDays, ChevronRight, LogIn, ScanLine, Smartphone } from "lucide-react";
import { useRoute, type AppId } from "@/lib/nav";
import { IconTile } from "@/ui";
import type { TileTone } from "@/data";
import type { LucideIcon } from "lucide-react";
import { ArcheMark } from "./ArcheMark";

// 説明文は文節で折り返す（<wbr> と word-break: auto-phrase）
const APPS: { app: AppId; title: string; body: ReactNode; where: string; icon: LucideIcon; tone: TileTone }[] = [
  { app: "clinic", title: "医院スタッフ", body: <>予約台帳、<wbr />今日の受付、<wbr />患者さんの情報。<wbr />毎日いちばん<wbr />使う画面です。</>, where: "iPhone・iPad・パソコン", icon: CalendarDays, tone: "sand" },
  { app: "login", title: "ログイン", body: <>スタッフが<wbr />Archeに入るときの<wbr />画面です。</>, where: "すべての端末", icon: LogIn, tone: "clay" },
  { app: "patient", title: "患者さんのWeb予約", body: <>初診・再診の予約から、<wbr />予約の確認・変更まで。</>, where: "スマートフォン", icon: Smartphone, tone: "ocean" },
  { app: "kiosk", title: "院内の受付端末", body: <>来院した患者さんが、<wbr />自分で受付を<wbr />済ませる画面です。</>, where: "受付のタブレット", icon: ScanLine, tone: "sage" },
  { app: "console", title: "運営コンソール", body: <>契約医院、<wbr />プラン、<wbr />オプションの管理。</>, where: "パソコン・iPhone", icon: Building2, tone: "graphite" },
];

/** プロトタイプの入口。各アプリへ移動する */
export default function Launcher() {
  const { goApp } = useRoute();
  const [main, ...rest] = APPS;
  return (
    <motion.div className="h-full overflow-y-auto bg-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div className="mx-auto max-w-[680px] px-4 pb-16 pt-12 md:px-8 md:pt-20">
        <header className="flex items-center gap-3.5 px-1">
          <ArcheMark size={52} />
          <div>
            <h1 className="text-large font-bold leading-none tracking-[-0.01em]">Arche</h1>
            <p className="mt-1.5 text-subhead text-label2">デザインのプロトタイプ</p>
          </div>
        </header>

        <section className="mt-10">
          <div className="overflow-hidden rounded-card bg-surface">
            <AppRow a={main} large onOpen={() => goApp(main.app)} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="px-4 pb-1.5 text-footnote font-medium text-label2">そのほかの画面</h2>
          <div className="overflow-hidden rounded-card bg-surface">
            {rest.map(a => (
              <AppRow key={a.app} a={a} onOpen={() => goApp(a.app)} />
            ))}
          </div>
          <p className="px-4 pt-2 text-footnote text-label2 [text-wrap:pretty] [word-break:auto-phrase]">表示している医院・患者・予約は<wbr />すべて架空のサンプルです。</p>
        </section>
      </div>
    </motion.div>
  );
}

function AppRow({ a, large, onOpen }: { a: (typeof APPS)[number]; large?: boolean; onOpen: () => void }) {
  const tile = large ? 52 : 40;
  return (
    <button
      onClick={onOpen}
      className="group relative flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-100 hover:bg-fill/6 active:bg-fill/12 md:gap-4 md:px-5"
    >
      <IconTile icon={a.icon} tone={a.tone} size={tile} />
      <span className="min-w-0 flex-1">
        <span className={large ? "block text-title3 font-semibold palt" : "block text-[17px] font-semibold palt md:text-[16px]"}>{a.title}</span>
        <span className="mt-0.5 block text-[14px] leading-[1.6] text-label2 [text-wrap:pretty] [word-break:auto-phrase]">{a.body}</span>
        <span className="mt-0.5 block text-[12px] text-label3">{a.where}</span>
      </span>
      <ChevronRight className="h-[18px] w-[18px] shrink-0 text-label4" strokeWidth={2.4} />
      <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-px origin-bottom scale-y-50 bg-sep/30 group-last:hidden" style={{ left: tile + 30 }} />
    </button>
  );
}
