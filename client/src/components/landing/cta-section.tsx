import { MessageSquare, Calculator, ArrowRight, ImageIcon } from "lucide-react";
import { Link } from "wouter";

const GREEN = "#C4B5A1";
const TEXT = "#1A1A2E";

const options = [
  {
    icon: MessageSquare,
    title: "お問い合わせ",
    desc: "あなたのお悩みに専門スタッフがお答えします",
    href: "/contact",
    label: "お問い合わせ →",
  },
  {
    icon: Calculator,
    title: "デモを見る",
    desc: "実際の画面を触って、使いやすさを確認できます",
    href: "/demo-login",
    label: "デモを試す →",
  },
  {
    icon: ArrowRight,
    title: "無料トライアル",
    desc: "14日間の無料トライアルで実際の機能をお試しいただけます",
    href: "/signup",
    label: "今すぐ始める →",
  },
];

export function CTASection() {
  return (
    <section style={{ backgroundColor: "#1a1a2e" }} className="overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-[1fr_300px] gap-10 items-end py-14 md:py-16">

          {/* 左：テキスト */}
          <div>
            <h2 className="text-[28px] md:text-[40px] font-black text-white leading-[1.2] mb-3">
              お気軽に<br />ご相談ください
            </h2>
            <p className="text-[15px] leading-[1.8]" style={{ color: "rgba(255,255,255,0.65)" }}>
              Arche導入に関するご相談、見積もりのご依頼、<br />
              トライアルを受け付けています。
            </p>
          </div>

          {/* 右：人物イラストプレースホルダー */}
          <div className="hidden md:flex justify-end">
            <div className="w-64 h-48 rounded-2xl flex flex-col items-center justify-center gap-2"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "2px dashed rgba(255,255,255,0.2)" }}>
              <ImageIcon className="w-8 h-8" style={{ color: "rgba(255,255,255,0.3)" }} />
              <p className="text-[11px] text-center" style={{ color: "rgba(255,255,255,0.3)" }}>スタッフイラスト<br />（後日差し替え）</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3カードバンド */}
      <div className="bg-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {options.map((opt) => {
              const Icon = opt.icon;
              return (
                <Link key={opt.title} href={opt.href}>
                  <span className="flex items-start gap-4 p-5 rounded-2xl bg-white hover:bg-gray-50 transition-all cursor-pointer group block">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "#FAF5ED" }}>
                      <Icon className="w-4 h-4" style={{ color: GREEN }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[14px] font-black" style={{ color: TEXT }}>{opt.title}</p>
                        <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-[16px]">→</span>
                      </div>
                      <p className="text-[12px] text-gray-500 mt-1 leading-snug">{opt.desc}</p>
                    </div>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
