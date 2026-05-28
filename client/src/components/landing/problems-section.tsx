import type { ComponentType } from "react";
import { ChevronRight, Phone, Users, FileText, BarChart3, RefreshCcw, Database, CalendarDays, Bell, MessageCircle } from "lucide-react";

const GREEN = "#C4B5A1";
const TEXT = "#0A0F1E";
const ILLUS_BG = "#EEF0F3";

const bigCards = [
  { label: "電話対応・予約管理の効率化",          icon: Phone,          iconColor: "#0e9488" },
  { label: "患者のエンゲージメント向上",           icon: Users,          iconColor: "#4f46e5" },
  { label: "DX・ペーパーレス化の実現",            icon: FileText,       iconColor: "#0284c7" },
];

const wideCards = [
  { label: "LINE連携でかんたん予約・リマインダー", icon: MessageCircle,  iconColor: "#06B04A" },
  { label: "データによる経営判断・改善計画",       icon: BarChart3,      iconColor: "#0e9488" },
  { label: "予約手続き全般の自動化",              icon: RefreshCcw,     iconColor: GREEN     },
  { label: "患者データの一元管理・可視化",         icon: Database,       iconColor: "#4f46e5" },
  { label: "複数スタッフ・担当医の管理",           icon: CalendarDays,   iconColor: "#0284c7" },
  { label: "リコール・定期健診の促進",             icon: Bell,           iconColor: "#db2777" },
  { label: "経営の意思決定へのデータ活用",         icon: BarChart3,      iconColor: GREEN     },
];

function ArrowCircle() {
  return (
    <div className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center shrink-0 group-hover:border-amber-400 group-hover:bg-amber-50 transition-colors">
      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-amber-700 transition-colors" />
    </div>
  );
}

function IllustrationArea({ icon: Icon, iconColor, tall = false }: {
  icon: ComponentType<{ style?: object }>;
  iconColor: string;
  tall?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center relative overflow-hidden shrink-0 ${tall ? "h-52 w-full" : "w-[148px] self-stretch"}`}
      style={{ backgroundColor: ILLUS_BG }}
    >
      <div className="absolute w-28 h-28 rounded-full opacity-10"
        style={{ backgroundColor: iconColor }} />
      <Icon style={{ color: iconColor, width: tall ? 52 : 42, height: tall ? 52 : 42, opacity: 0.9 }} />
    </div>
  );
}

export function ProblemsSection() {
  return (
    <section className="bg-white py-16 md:py-20">
      <div className="max-w-[1080px] mx-auto px-6">

        <div className="text-center mb-3">
          <h2 className="text-[26px] md:text-[38px] font-black tracking-tight" style={{ color: TEXT }}>
            <span style={{ color: GREEN }}>課題を解決するなら</span>Arche
          </h2>
        </div>
        <div className="text-center mb-10">
          <p className="text-[14.5px] text-gray-500">
            予約・受付をはじめ、医院運営に広がるさまざまな課題を解決に導きます
          </p>
        </div>

        {/* 上段：3カード（大） */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {bigCards.map((card) => (
            <a key={card.label} href="#features"
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer block">
              <IllustrationArea icon={card.icon} iconColor={card.iconColor} tall />
              <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-gray-100">
                <p className="text-[14.5px] font-bold leading-snug" style={{ color: TEXT }}>{card.label}</p>
                <ArrowCircle />
              </div>
            </a>
          ))}
        </div>

        {/* 下段：2列ワイドカード */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {wideCards.map((card) => (
            <a key={card.label} href="#features"
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer flex min-h-[110px]">
              <IllustrationArea icon={card.icon} iconColor={card.iconColor} />
              <div className="flex-1 flex items-center justify-between gap-4 px-6 py-5">
                <p className="text-[14.5px] font-bold leading-snug" style={{ color: TEXT }}>{card.label}</p>
                <ArrowCircle />
              </div>
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}
