import { ArrowRight, ImageIcon } from "lucide-react";
import { Link } from "wouter";

const GREEN = "#C4B5A1";
const GREEN_LIGHT = "#FAF5ED";
const TEXT = "#1A1A2E";

const reasons = [
  {
    num: "1",
    title: "使いやすいから",
    sub: "現場に自然と浸透し、活用できる",
    link: "「使いやすさ」への取り組み",
  },
  {
    num: "2",
    title: "患者とのコミュニケーションを",
    sub: "自動化して業務がはかどる",
    link: "リコール・リマインダー機能",
  },
  {
    num: "3",
    title: "低コスト・即日開始で",
    sub: "導入・拡張がしやすい",
    link: "料金プランを見る",
  },
];

const steps = [
  { num: "STEP 1", title: "無料登録", desc: "メールアドレスで即登録。クレジットカード不要。" },
  { num: "STEP 2", title: "初期設定", desc: "診療メニュー・スタッフ・営業時間を設定。約15分で完了。" },
  { num: "STEP 3", title: "予約ページ公開", desc: "あなた専用のURLを患者様に共有するだけ。" },
  { num: "STEP 4", title: "予約が入ってくる", desc: "24時間自動で予約受付。あとは診療に集中。" },
  { num: "STEP 5", title: "運用サポート", desc: "運用開始後も専任サポートがフォローします。" },
];

export function HowItWorksSection() {
  return (
    <>
      {/* ── 選ばれる理由 ── */}
      <section id="how-it-works" style={{ backgroundColor: GREEN_LIGHT }} className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-[26px] md:text-[38px] font-black tracking-tight" style={{ color: TEXT }}>
              Archeが選ばれる理由
            </h2>
          </div>

          {/* 三列：左イラスト | 中央リスト | 右イラスト */}
          <div className="grid md:grid-cols-[1fr_2fr_1fr] gap-6 items-center">

            {/* 左イラスト */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="w-48 h-56 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center gap-3">
                <ImageIcon className="w-8 h-8 text-gray-200" />
                <p className="text-[11px] text-gray-300 text-center px-3">スタッフがスムーズに<br />使いこなすイメージ</p>
              </div>
            </div>

            {/* 中央：番号付きリスト（SmartHR完全再現） */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {reasons.map((r, i) => (
                <div key={r.num}
                  className={`px-8 py-7 flex items-start gap-5 ${i < reasons.length - 1 ? "border-b border-gray-100" : ""}`}>
                  {/* 番号サークル */}
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-[16px] font-black"
                    style={{ backgroundColor: GREEN, color: "#2A221A" }}>
                    {r.num}
                  </div>
                  <div>
                    <p className="text-[15px] font-bold text-gray-700">{r.title}</p>
                    <p className="text-[17px] font-black mt-0.5" style={{ color: GREEN }}>{r.sub}</p>
                    <a href={i === 2 ? "#pricing" : "#features"}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-bold border border-gray-200 text-gray-700 hover:border-amber-300 hover:text-amber-700 transition-all">
                      {r.link} →
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* 右イラスト */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="w-48 h-56 rounded-2xl bg-white border border-gray-100 flex flex-col items-center justify-center gap-3">
                <ImageIcon className="w-8 h-8 text-gray-200" />
                <p className="text-[11px] text-gray-300 text-center px-3">院長・患者が<br />喜ぶシーンのイメージ</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 導入の流れ ── */}
      <section className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-[26px] md:text-[36px] font-black tracking-tight" style={{ color: TEXT }}>
              導入までの流れ
            </h2>
            <p className="mt-3 text-[15px] text-gray-500">最短<strong style={{ color: GREEN }}>15分</strong>で運用開始できます</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
            {steps.map((step, i) => (
              <div key={step.num} className="relative bg-gray-50 rounded-2xl p-5 border border-gray-100">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-5 h-5 text-gray-300" />
                  </div>
                )}
                <p className="text-[11px] font-bold tracking-wider mb-2" style={{ color: GREEN }}>{step.num}</p>
                <h3 className="text-[14px] font-black mb-1.5" style={{ color: TEXT }}>{step.title}</h3>
                <p className="text-[12px] leading-[1.7] text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link href="/contact">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-bold border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-all mr-3">
                お問い合わせはこちら →
              </span>
            </Link>
            <Link href="/signup">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-[13px] font-bold hover:opacity-90 transition-all"
                style={{ backgroundColor: GREEN, color: "#2A221A" }}>
                無料トライアルを始める →
              </span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
