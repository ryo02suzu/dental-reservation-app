import { GraduationCap, Building2, Stethoscope, ImageIcon, Users } from "lucide-react";

const GREEN = "#C4B5A1";
const GREEN_LIGHT = "#FAF5ED";
const TEXT = "#1A1A2E";
const NAVY = "#1a1a2e";

export function FounderSection() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 md:gap-16 items-center">

          {/* 左：テキスト */}
          <div className="flex flex-col gap-5">
            <p className="text-[12px] font-bold tracking-widest uppercase" style={{ color: GREEN }}>
              開発者について
            </p>
            <h2 className="text-[28px] md:text-[36px] font-black tracking-tight leading-[1.2]" style={{ color: TEXT }}>
              現場を知る人間が、<br />現場のために作りました。
            </h2>
            <p className="text-[15px] leading-[1.9] text-gray-500">
              開発者は2002年生まれの現役歯学部5年生。親が歯科医院を開業しており、
              幼少期から受付の電話対応・手書き管理の大変さを間近で見てきました。
            </p>
            <p className="text-[15px] leading-[1.9] text-gray-500">
              歯学部で患者・スタッフ・院長それぞれの視点を学ぶ中で確信したのは、
              <strong style={{ color: TEXT }} className="font-bold">「歯科の現場を知っている人間が作らなければ、本当に使えるシステムにはならない」</strong>ということ。
              現在は親の医院でβ版の実証実験を進めながら、開発を続けています。
            </p>

            <div className="grid gap-3 mt-2">
              {[
                { icon: GraduationCap, title: "歯学部在籍（5年生）", desc: "臨床知識と患者動線を理解した上で機能を設計" },
                { icon: Building2, title: "親の医院での実地検証", desc: "実際に使いながらフィードバックをもとに改善中" },
                { icon: Stethoscope, title: "21名の現役開業医に監修いただいています", desc: "親・知人の開業医・大学非常勤講師（歯科）など、現場視点で機能・UIを監修" },
              ].map((badge) => {
                const Icon = badge.icon;
                return (
                  <div key={badge.title} className="flex items-start gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: GREEN_LIGHT }}>
                      <Icon className="w-4 h-4" style={{ color: GREEN }} strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="text-[13.5px] font-black" style={{ color: TEXT }}>{badge.title}</p>
                      <p className="text-[12.5px] text-gray-500 mt-0.5">{badge.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* フィードバック提供者バッジ */}
            <div className="flex flex-wrap gap-2 mt-1">
              {["開業医（院長）", "開業医（知人）", "大学非常勤講師（歯科）"].map((role) => (
                <span key={role} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold border"
                  style={{ borderColor: `${GREEN}60`, color: NAVY, backgroundColor: GREEN_LIGHT }}>
                  <Users className="w-3 h-3" style={{ color: GREEN }} />
                  {role}
                </span>
              ))}
            </div>
            <p className="text-[11.5px] text-gray-400 -mt-2">↑ フィードバックをいただいている歯科医師の属性</p>
          </div>

          {/* 右：写真 */}
          <div className="relative flex justify-center">
            <div className="relative">
              <div className="w-72 h-96 md:w-80 md:h-[420px] rounded-3xl flex flex-col items-center justify-center bg-gray-100 border border-gray-200 border-dashed">
                <ImageIcon className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-[12px] text-gray-400 text-center px-6">代表者の写真（後日差し替え）</p>
              </div>
              <div className="absolute -bottom-5 -right-5 bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.1)] border border-gray-100 px-6 py-4">
                <p className="text-[30px] font-black leading-none" style={{ color: GREEN }}>5年生</p>
                <p className="text-[11.5px] text-gray-400 mt-1">歯学部在籍中</p>
              </div>
              <div className="absolute -top-4 -left-4 bg-white rounded-xl shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-gray-100 px-4 py-3">
                <p className="text-[10.5px] text-gray-400 mb-0.5">監修</p>
                <p className="text-[13px] font-black" style={{ color: TEXT }}>開業医 21名</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
