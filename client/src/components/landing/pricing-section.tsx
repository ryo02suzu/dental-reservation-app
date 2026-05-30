import { Check, Minus } from "lucide-react";
import { Link } from "wouter";

const GREEN = "#C4B5A1";
const GREEN_DARK = "#8B7B68";
const NAVY = "#0D112A";
const TEXT = "#1A1A2E";

const plans = [
  {
    name: "フリー",
    price: "¥0",
    period: "永久無料",
    desc: "小規模医院・お試しに",
    cta: "今すぐ始める",
    ctaHref: "/signup",
    highlight: false,
    features: [
      { label: "スタッフ 1名", ok: true },
      { label: "月間予約 50件", ok: true },
      { label: "オンライン予約ページ", ok: true },
      { label: "メールリマインダー", ok: true },
      { label: "患者管理", ok: true },
      { label: "SMS・LINE通知", ok: false },
      { label: "データエクスポート", ok: false },
      { label: "リコール・経営分析", ok: false },
    ],
  },
  {
    name: "スタンダード",
    price: "¥9,800",
    period: "/月（税込）",
    desc: "成長中の医院に最適",
    cta: "14日間無料で試す",
    ctaHref: "/signup",
    highlight: false,
    features: [
      { label: "スタッフ 5名", ok: true },
      { label: "月間予約 無制限", ok: true },
      { label: "オンライン予約ページ", ok: true },
      { label: "メール＋SMSリマインダー", ok: true },
      { label: "患者管理", ok: true },
      { label: "データエクスポート", ok: true },
      { label: "LINE通知", ok: false },
      { label: "リコール・経営分析", ok: false },
    ],
  },
  {
    name: "プロ",
    price: "¥19,800",
    period: "/月（税込）",
    desc: "本格運用したい医院に",
    cta: "14日間無料で試す",
    ctaHref: "/signup",
    highlight: true,
    badge: "おすすめ",
    features: [
      { label: "スタッフ 無制限", ok: true },
      { label: "月間予約 無制限", ok: true },
      { label: "メール＋SMSリマインダー", ok: true },
      { label: "LINEリマインダー", ok: true },
      { label: "データエクスポート", ok: true },
      { label: "リコール機能", ok: true },
      { label: "経営分析ダッシュボード", ok: true },
      { label: "全機能フル搭載", ok: true },
    ],
  },
  {
    name: "エンタープライズ",
    price: "要相談",
    period: "グループ・法人向け",
    desc: "複数院・大規模医院に",
    cta: "お問い合わせ",
    ctaHref: "/contact",
    highlight: false,
    features: [
      { label: "複数院一括管理", ok: true },
      { label: "プロの全機能", ok: true },
      { label: "専任サポート担当", ok: true },
      { label: "カスタム開発対応", ok: true },
      { label: "SLA保証", ok: true },
      { label: "請求書払い", ok: true },
      { label: "カスタムレポート", ok: true },
      { label: "API連携", ok: true },
    ],
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* ヘッダー */}
        <div className="text-center mb-14">
          <p className="text-[12px] font-bold tracking-widest uppercase mb-4" style={{ color: GREEN }}>
            料金プラン
          </p>
          <h2 className="text-[30px] md:text-[44px] font-black tracking-tight" style={{ color: TEXT }}>
            医院規模に合わせて選べる
          </h2>
          <p className="mt-4 text-[16px] text-gray-500">
            無料から始めて、成長に合わせてアップグレード。<br />
            違約金・初期費用は一切かかりません。
          </p>
        </div>

        {/* カードグリッド */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {plans.map((plan) => (
            <div key={plan.name}
              className={`relative flex flex-col rounded-2xl overflow-hidden border ${
                plan.highlight
                  ? "shadow-2xl"
                  : "border-gray-200 shadow-sm hover:shadow-md transition-shadow"
              }`}
              style={plan.highlight ? { backgroundColor: NAVY, borderColor: NAVY } : { backgroundColor: "white" }}>

              {plan.highlight && plan.badge && (
                <div className="absolute top-4 right-4">
                  <span className="px-2.5 py-1 text-[10.5px] font-black rounded-full"
                    style={{ backgroundColor: GREEN, color: "white" }}>
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* プランヘッダー */}
              <div className="px-6 pt-8 pb-6">
                <p className="text-[11px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: plan.highlight ? "rgba(255,255,255,0.4)" : "#9CA3AF" }}>
                  {plan.name}
                </p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[34px] font-black"
                    style={{ color: plan.highlight ? "white" : TEXT }}>
                    {plan.price}
                  </span>
                </div>
                <p className="text-[11px]"
                  style={{ color: plan.highlight ? "rgba(255,255,255,0.35)" : "#9CA3AF" }}>
                  {plan.period}
                </p>
                <p className="mt-3 text-[12.5px] font-medium"
                  style={{ color: plan.highlight ? "rgba(255,255,255,0.55)" : "#6B7280" }}>
                  {plan.desc}
                </p>
              </div>

              {/* 区切り */}
              <div className="mx-6 h-px" style={{ backgroundColor: plan.highlight ? "rgba(255,255,255,0.08)" : "#F3F4F6" }} />

              {/* 機能リスト */}
              <ul className="px-6 py-6 space-y-3 flex-1">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2.5">
                    {f.ok
                      ? <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: plan.highlight ? "rgba(255,255,255,0.6)" : GREEN }} strokeWidth={2.5} />
                      : <Minus className="w-4 h-4 mt-0.5 shrink-0 opacity-20" style={{ color: plan.highlight ? "white" : "#9CA3AF" }} />
                    }
                    <span className="text-[12.5px]"
                      style={{
                        color: plan.highlight
                          ? (f.ok ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.2)")
                          : (f.ok ? "#374151" : "#D1D5DB"),
                      }}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <div className="px-6 pb-8">
                <Link href={plan.ctaHref}>
                  <span className={`block text-center py-3 rounded-xl text-[13.5px] font-bold transition-all ${
                    plan.highlight
                      ? "bg-white hover:bg-gray-100"
                      : "text-white hover:opacity-90"
                  }`}
                    style={plan.highlight ? { color: NAVY } : { backgroundColor: GREEN }}>
                    {plan.cta}
                  </span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[12.5px] text-gray-400">
          全プラン14日間無料トライアル · クレジットカード不要 · 途中解約いつでもOK
        </p>
      </div>
    </section>
  );
}
