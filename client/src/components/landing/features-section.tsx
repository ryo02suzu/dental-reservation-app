import { useState } from "react";
import { Calendar, Users, Bell, BarChart3, Clock, Shield, ChevronRight } from "lucide-react";

const GREEN = "#C4B5A1";
const GREEN_LIGHT = "#FAF5ED";
const TEXT = "#1A1A2E";

const mainFeatures = [
  {
    id: "booking",
    badge: "オンライン予約",
    headline: "Arche 予約管理",
    sub: "幅広い業務を大幅に業務効率化\n受付・患者の満足度を改善",
    stat: "電話対応を最大 約85%削減",
    statNote: "※Archeご利用医院の平均値（2025年実績）",
    links: [
      { label: "オンライン予約（定番）", href: "#" },
      { label: "スタッフ・担当医設定", href: "#" },
      { label: "診療メニュー管理", href: "#" },
      { label: "キャンセル待ちリスト", href: "#" },
      { label: "リマインダー配信", href: "#" },
    ],
  },
  {
    id: "patients",
    badge: "患者・経営管理",
    headline: "Arche 患者管理",
    sub: "データにもとづく経営で\n患者満足度と来院数を最大化",
    stat: "定期健診来院数 平均 +38%向上",
    statNote: "※リコール機能利用医院の比較（2025年実績）",
    links: [
      { label: "患者情報一元管理（定番）", href: "#" },
      { label: "リコール自動配信（定番）", href: "#" },
      { label: "問診票デジタル化", href: "#" },
      { label: "経営分析ダッシュボード", href: "#" },
      { label: "データエクスポート", href: "#" },
    ],
  },
];

const subFeatures = [
  { icon: Clock, title: "キャンセル待ち", desc: "空き枠が出たら候補患者に自動連絡。取りこぼしゼロ。" },
  { icon: Shield, title: "セキュリティ", desc: "SSL暗号化・個人情報保護法準拠。国内サーバー管理。" },
  { icon: Bell, title: "LINE連携（オプション）", desc: "LINEで予約確認・リマインダーを送信。開封率が高い。" },
  { icon: Users, title: "複数スタッフ対応", desc: "担当医・衛生士ごとに予約枠を個別設定できます。" },
];

function FeatureMockup({ featureId }: { featureId: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden h-80 flex items-center justify-center">
      <div className="text-center p-8">
        {featureId === "booking" ? (
          <div className="space-y-2 text-left">
            {["09:00 田中 美咲 / 定期健診", "10:00 山田 由紀 / ホワイトニング", "10:30 鈴木 大輔 / 矯正相談", "11:00 伊藤 さくら / クリーニング", "14:00 佐藤 健太 / 虫歯治療"].map((line, i) => (
              <div key={i} className="text-[12px] px-3 py-2 rounded-lg" style={{ backgroundColor: i < 2 ? "#F3F4F6" : GREEN_LIGHT, color: i < 2 ? "#9CA3AF" : TEXT }}>
                {line}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {[["今月の予約", "247件"], ["リコール配信", "38名"], ["キャンセル率", "3.2%"]].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-50">
                <span className="text-[12px] text-gray-500">{label}</span>
                <span className="text-[16px] font-black" style={{ color: GREEN }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* ヘッダー */}
        <div className="text-center mb-14">
          <h2 className="text-[26px] md:text-[38px] font-black tracking-tight" style={{ color: TEXT }}>
            Archeのサービス
          </h2>
          <p className="mt-3 text-[15px] text-gray-500">
            歯科医院のあらゆる業務に対応できる豊富な機能で、あらゆる課題を解決します
          </p>
        </div>

        {/* メインフィーチャー2枚（SmartHRスタイルの分割レイアウト） */}
        <div className="space-y-16">
          {mainFeatures.map((feature, idx) => (
            <div key={feature.id}
              className={`grid md:grid-cols-2 gap-10 items-start ${idx % 2 === 1 ? "md:direction-rtl" : ""}`}>

              {/* 左：テキスト */}
              <div className={idx % 2 === 1 ? "md:order-2" : ""}>
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-bold mb-4"
                  style={{ backgroundColor: GREEN, color: "#2A221A" }}>
                  {feature.badge}
                </span>
                <h3 className="text-[24px] md:text-[30px] font-black leading-tight mb-2" style={{ color: GREEN }}>
                  {feature.headline}
                </h3>
                <p className="text-[15px] text-gray-600 mb-5 whitespace-pre-line">{feature.sub}</p>

                {/* 実績数値 */}
                <div className="bg-gray-50 rounded-xl p-4 mb-6 flex items-start gap-3">
                  <div>
                    <p className="text-[22px] font-black" style={{ color: TEXT }}>{feature.stat}</p>
                    <p className="text-[10.5px] text-gray-400 mt-0.5">{feature.statNote}</p>
                  </div>
                </div>

                {/* 機能リンク */}
                <div className="grid grid-cols-1 gap-2">
                  {feature.links.map((link) => (
                    <a key={link.label} href={link.href}
                      className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition-all group">
                      <span className="text-[13px] font-medium text-gray-700 group-hover:text-amber-700">{link.label}</span>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-amber-600" />
                    </a>
                  ))}
                </div>
              </div>

              {/* 右：モックアップ */}
              <div className={idx % 2 === 1 ? "md:order-1" : ""}>
                <FeatureMockup featureId={feature.id} />
              </div>
            </div>
          ))}
        </div>

        {/* サブ機能4枚 */}
        <div className="mt-16 pt-14 border-t border-gray-100">
          <h3 className="text-[18px] font-black mb-6 text-center" style={{ color: TEXT }}>主な機能</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {subFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-5 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4" style={{ color: GREEN }} />
                    <span className="text-[13.5px] font-bold" style={{ color: TEXT }}>{f.title}</span>
                  </div>
                  <p className="text-[12.5px] leading-[1.7] text-gray-500">{f.desc}</p>
                  <a href="#" className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold hover:opacity-70" style={{ color: GREEN }}>
                    詳しく見る →
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
