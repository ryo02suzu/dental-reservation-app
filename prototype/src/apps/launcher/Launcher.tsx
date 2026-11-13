import type { ComponentType } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Building2, CalendarDays, LogIn, ScanLine, Smartphone } from "lucide-react";
import { useRoute, type AppId } from "@/lib/nav";
import { IconTile, springSoft, tapSoft } from "@/ui";
import type { TileTone } from "@/data";
import { ArcheMark } from "./ArcheMark";
import type { LucideIcon } from "lucide-react";

type Icon = LucideIcon;
const APPS: { app: AppId; title: string; body: string; where: string; icon: Icon; tone: TileTone }[] = [
  { app: "clinic", title: "医院スタッフ", body: "予約台帳、今日の受付、患者さんの情報。毎日いちばん使う画面です。", where: "iPhone・iPad・パソコン", icon: CalendarDays, tone: "sand" },
  { app: "patient", title: "患者さんのWeb予約", body: "初診・再診の予約から、予約の確認・変更まで。", where: "スマートフォン", icon: Smartphone, tone: "ocean" },
  { app: "kiosk", title: "院内の受付端末", body: "来院した患者さんが、自分で受付を済ませる画面です。", where: "受付のタブレット", icon: ScanLine, tone: "sage" },
  { app: "console", title: "運営コンソール", body: "契約医院、プラン、オプションの管理。", where: "パソコン", icon: Building2, tone: "graphite" },
  { app: "login", title: "ログイン", body: "スタッフがArcheに入るときの画面です。", where: "すべての端末", icon: LogIn, tone: "clay" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { ...springSoft, delay: 0.05 + i * 0.06 } }),
};

/** プロトタイプの入口。各アプリへ移動する */
export default function Launcher() {
  const { goApp } = useRoute();
  return (
    <div className="h-full overflow-y-auto bg-bg">
      <div className="mx-auto max-w-[980px] px-5 pb-16 pt-12 md:px-10 md:pt-20">
        <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp} className="flex items-center gap-3">
          <ArcheMark size={44} />
          <span className="text-[28px] font-semibold tracking-[-0.03em]">Arche</span>
        </motion.div>
        <motion.h1 initial="hidden" animate="show" custom={1} variants={fadeUp} className="mt-10 text-[38px] font-bold leading-[1.18] tracking-[-0.02em] palt md:text-[56px]">
          診療の流れが、
          <br />
          ひと目でわかる。
        </motion.h1>
        <motion.p initial="hidden" animate="show" custom={2} variants={fadeUp} className="mt-5 max-w-[34em] text-[17px] leading-[1.7] text-label2 md:text-[19px]">
          予約台帳から受付、患者さんのWeb予約まで。新しいArcheのデザインを、実際に触って確かめてください。
        </motion.p>

        <div className="mt-12 grid gap-3 md:mt-16 md:grid-cols-2 md:gap-4">
          {APPS.map((a, i) => (
            <motion.button
              key={a.app}
              initial="hidden"
              animate="show"
              custom={3 + i}
              variants={fadeUp}
              whileHover={{ y: -3 }}
              whileTap={tapSoft}
              onClick={() => goApp(a.app)}
              className={`group relative flex flex-col rounded-[22px] bg-surface p-5 text-left transition-shadow duration-300 hover:shadow-float md:p-6 ${i === 0 ? "md:col-span-2 md:flex-row md:items-center md:gap-8 md:p-8" : ""}`}
            >
              <IconTile icon={a.icon} tone={a.tone} size={i === 0 ? 56 : 44} />
              <div className={`mt-4 min-w-0 flex-1 ${i === 0 ? "md:mt-0" : ""}`}>
                <div className={`font-semibold tracking-[-0.01em] palt ${i === 0 ? "text-[22px] md:text-[26px]" : "text-[19px]"}`}>{a.title}</div>
                <p className="mt-1.5 text-[14px] leading-[1.65] text-label2 md:text-[15px]">{a.body}</p>
                <div className="mt-3 text-[12px] font-medium text-label3">{a.where}</div>
              </div>
              <ArrowUpRight className="absolute right-5 top-5 h-5 w-5 text-label3 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-accent md:right-6 md:top-6" strokeWidth={2} />
            </motion.button>
          ))}
        </div>

        <motion.p initial="hidden" animate="show" custom={9} variants={fadeUp} className="mt-12 text-center text-[12px] text-label3">
          表示している医院・患者・予約はすべて架空のサンプルです。
        </motion.p>
      </div>
    </div>
  );
}
