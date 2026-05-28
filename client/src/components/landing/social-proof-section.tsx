import { Link } from "wouter";
import { FlaskConical, ArrowRight, GraduationCap, Stethoscope } from "lucide-react";

const PRIMARY = "#C4B5A1";
const TEXT = "#0A0F1E";
const LIGHT_BG = "#FAF5ED";
const NAVY = "#1a1a2e";

const clinicTypes = [
  "一般歯科", "小児歯科", "矯正歯科", "口腔外科",
  "審美歯科", "インプラント", "訪問歯科", "ホワイトニング",
  "一般歯科", "小児歯科", "矯正歯科", "口腔外科",
  "審美歯科", "インプラント", "訪問歯科", "ホワイトニング",
];

export function SocialProofSection() {
  return (
    <section style={{ backgroundColor: LIGHT_BG }} className="py-20 md:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* 上部：開発経緯 */}
        <div className="mb-16">
          <p className="text-[13px] font-bold text-gray-400 mb-4 tracking-widest uppercase">開発の背景</p>
          <div className="flex flex-col md:flex-row md:items-start gap-8 md:gap-16">
            <div className="md:max-w-xl">
              <h2 className="text-[26px] md:text-[34px] font-black tracking-tight leading-[1.2] mb-4" style={{ color: TEXT }}>
                1院の現場から、<br />21名の開業医が監修しています。
              </h2>
              <p className="text-[15px] leading-[1.9] text-gray-600">
                開発者は現役の歯学部5年生。親が歯科医院を経営しており、幼少期から受付の電話対応・手書き管理の大変さを間近で見てきました。
                <br /><br />
                機能設計には、親をはじめ知人の開業医・大学の非常勤講師（歯科）など<strong className="font-bold" style={{ color: TEXT }}>21名の現役開業医に監修</strong>いただいており、現場の視点を徹底的に反映しています。
              </p>
            </div>
            <div className="flex flex-wrap gap-8 md:gap-10 md:pt-2 shrink-0">
              {[
                { value: "β版", label: "現在の提供状況" },
                { value: "0円", label: "初期費用" },
                { value: "21名", label: "監修した現役開業医" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[30px] md:text-[36px] font-black leading-none" style={{ color: PRIMARY }}>{s.value}</p>
                  <p className="text-[12px] text-gray-400 mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 診療科目ティッカー */}
        <div className="overflow-hidden mb-16 -mx-6 lg:-mx-8">
          <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-3 px-6 lg:px-8">対応診療科目</p>
          <div className="flex gap-3 py-3" style={{
            animation: "ticker 25s linear infinite",
            width: "max-content",
          }}>
            {clinicTypes.map((type, i) => (
              <span key={`${type}-${i}`}
                className="shrink-0 px-5 py-2.5 bg-white rounded-full text-[13px] font-medium text-gray-600 border border-amber-100 whitespace-nowrap shadow-sm">
                {type}
              </span>
            ))}
          </div>
        </div>

        {/* カード3枚 */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[22px] md:text-[28px] font-black" style={{ color: TEXT }}>開発・検証の体制</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-5">

            {/* カード1：実証実験 */}
            <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
              <div className="h-44 flex items-center justify-center" style={{ backgroundColor: LIGHT_BG }}>
                <div className="text-center px-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${PRIMARY}25` }}>
                    <FlaskConical className="w-6 h-6" style={{ color: NAVY }} />
                  </div>
                  <p className="text-[12px] font-bold" style={{ color: NAVY }}>β版・実証実験中</p>
                  <p className="text-[11px] text-gray-400 mt-1">親の歯科医院にて検証</p>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col gap-3">
                <span className="inline-flex self-start items-center px-3 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: PRIMARY, color: "#2A221A" }}>
                  実証実験中
                </span>
                <p className="text-[14px] font-bold leading-[1.7]" style={{ color: TEXT }}>
                  「親の医院で実際に使いながら改善を続けています。電話が確実に減ってきています。」
                </p>
                <div className="mt-auto pt-3 border-t border-gray-100">
                  <p className="text-[12px] font-bold" style={{ color: TEXT }}>開発者</p>
                  <p className="text-[11px] text-gray-400">歯学部5年生 / 一般歯科（親の医院）</p>
                </div>
              </div>
            </div>

            {/* カード2：歯科医師フィードバック */}
            <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden flex flex-col hover:shadow-lg transition-shadow">
              <div className="h-44 flex items-center justify-center" style={{ backgroundColor: LIGHT_BG }}>
                <div className="text-center px-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: `${PRIMARY}25` }}>
                    <Stethoscope className="w-6 h-6" style={{ color: NAVY }} />
                  </div>
                  <p className="text-[12px] font-bold" style={{ color: NAVY }}>21名の開業医が監修</p>
                  <p className="text-[11px] text-gray-400 mt-1">開業医・大学非常勤講師など</p>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col gap-3">
                <span className="inline-flex self-start items-center px-3 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#EEF2FF", color: NAVY }}>
                  21名の現役開業医が監修
                </span>
                <p className="text-[14px] font-bold leading-[1.7]" style={{ color: TEXT }}>
                  親・知人の開業医・大学の非常勤講師（歯科）を中心に、21名の現役歯科医師から機能・UIへの監修を受けながら設計しています。
                </p>
                <div className="mt-auto pt-3 border-t border-gray-100">
                  <p className="text-[12px] font-bold" style={{ color: TEXT }}>監修体制</p>
                  <p className="text-[11px] text-gray-400">開業医 / 大学非常勤講師（歯科）など 21名</p>
                </div>
              </div>
            </div>

            {/* カード3：βテスター募集 */}
            <div className="rounded-2xl overflow-hidden flex flex-col hover:shadow-lg transition-shadow" style={{ backgroundColor: NAVY }}>
              <div className="h-44 flex items-center justify-center" style={{ backgroundColor: `${NAVY}cc` }}>
                <div className="text-center px-4">
                  <p className="text-[28px] font-black text-white mb-1">早期<br />アクセス</p>
                  <p className="text-[11px]" style={{ color: `${PRIMARY}` }}>βテスター募集中</p>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col gap-3">
                <span className="inline-flex self-start items-center px-3 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: PRIMARY, color: "#2A221A" }}>
                  参加者募集
                </span>
                <p className="text-[14px] font-bold leading-[1.7] text-white">
                  「最初に使ってくれた医院の声が、このシステムを育てます。ぜひ一緒に作ってください。」
                </p>
                <div className="mt-auto">
                  <Link href="/signup">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-bold cursor-pointer hover:opacity-80 transition-opacity" style={{ color: PRIMARY }}>
                      βテスターとして参加する <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
