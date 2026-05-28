const GREEN = "#C4B5A1";
const TEAL_LIGHT = "#FAF5ED";
const TEAL_BORDER = "#DDD0BF";
const TEXT = "#0A0F1E";
const NAVY = "#1a1a2e";

const AVATAR_COLORS = ["#8B7355", "#0e7490", "#7c3aed", "#db2777", "#ea580c", "#7A6245", "#0369a1"];

function Avatar({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <div
      className="rounded-full border-2 border-white flex items-center justify-center shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill="white" opacity="0.9" />
        <path d="M4 20c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      </svg>
    </div>
  );
}

export function ValuePropsSection() {
  return (
    <section className="bg-white py-16 md:py-24 overflow-hidden">
      <div className="max-w-[1080px] mx-auto px-6">

        {/* 見出し */}
        <div className="text-center mb-4">
          <h2 className="text-[28px] md:text-[40px] font-black tracking-tight leading-[1.25]" style={{ color: TEXT }}>
            スマートに
            <span style={{ color: GREEN }}>医院経営を後押しする</span>
            仕組み
          </h2>
        </div>
        <div className="text-center mb-12 md:mb-16 max-w-lg mx-auto">
          <p className="text-[14.5px] leading-[1.9] text-gray-500">
            予約業務を効率化しながら、自然と蓄まった患者データを一元管理。<br />
            最新・正確なデータを活用し、医院のパフォーマンスを改善します。
          </p>
        </div>

        {/* モバイル：シンプルカード3枚 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:hidden">
          {[
            { title: "予約管理", sub: "業務を大幅効率化", desc: "あらゆる業務をミスなく、カンタンに。患者満足度を改善します。" },
            { title: "患者データベース", sub: "患者データの一元管理", desc: "来院から退院まで最新データを網羅的に収集・管理します。" },
            { title: "経営分析", sub: "データで経営改善", desc: "データにもとづく経営で医院のパフォーマンスを最大化します。" },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl p-6 border border-gray-100 text-center" style={{ backgroundColor: TEAL_LIGHT }}>
              <p className="text-[11px] font-bold text-gray-400 mb-1">{item.sub}</p>
              <p className="text-[18px] font-black mb-3" style={{ color: NAVY }}>{item.title}</p>
              <p className="text-[13px] text-gray-500 leading-[1.7]">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* デスクトップ：ベン図（md以上のみ表示） */}
        <div className="hidden md:block">
          <div className="relative flex items-center justify-center">

            {/* 「患者データの一元管理」ピル */}
            <div className="absolute top-[-1px] left-1/2 -translate-x-1/2 z-30">
              <span
                className="inline-flex items-center px-5 py-[7px] rounded-full text-[13px] font-bold text-white whitespace-nowrap shadow-md"
                style={{ backgroundColor: GREEN }}
              >
                患者データの一元管理
              </span>
            </div>

            {/* 左の大きな円 */}
            <div
              className="relative flex flex-col items-center justify-center text-center rounded-full shrink-0 pt-6"
              style={{
                width: 272,
                height: 272,
                backgroundColor: TEAL_LIGHT,
                border: `1.5px solid ${TEAL_BORDER}`,
                zIndex: 1,
              }}
            >
              <p className="text-[12px] text-gray-500 mb-2">業務を大幅効率化</p>
              <p className="font-black leading-[1.1]" style={{ fontSize: 26, color: GREEN }}>
                Arche
              </p>
              <p className="font-black leading-[1.1] mb-3" style={{ fontSize: 26, color: GREEN }}>
                予約管理
              </p>
              <p className="text-[11.5px] text-gray-500 leading-snug px-6">
                あらゆる業務をミスなく、<br />カンタンに<br />患者満足度を改善
              </p>
            </div>

            {/* 中央の重なり要素 */}
            <div
              className="relative flex flex-col items-center justify-center text-center shrink-0"
              style={{
                width: 210,
                height: 210,
                backgroundColor: "white",
                border: `2px dashed ${TEAL_BORDER}`,
                borderRadius: "50%",
                marginLeft: -56,
                marginRight: -56,
                zIndex: 2,
                boxShadow: "0 0 0 6px white",
              }}
            >
              <div className="flex flex-col items-center gap-1 mb-2">
                <div className="flex items-end justify-center gap-0.5 mb-1">
                  {[10, 16, 12, 18, 14].map((h, i) => (
                    <div key={i} className="w-2.5 rounded-t-sm"
                      style={{ height: h, backgroundColor: i % 2 === 0 ? "#D8CFC5" : "#C4B5A1", opacity: 0.8 }} />
                  ))}
                </div>
                <div className="flex items-center -space-x-1.5">
                  {AVATAR_COLORS.slice(0, 4).map((c, i) => (
                    <Avatar key={i} color={c} size={26} />
                  ))}
                </div>
                <div className="flex items-center -space-x-1.5">
                  {AVATAR_COLORS.slice(2, 6).map((c, i) => (
                    <Avatar key={i} color={c} size={26} />
                  ))}
                </div>
              </div>

              <p className="text-[14px] font-black" style={{ color: TEXT }}>患者データベース</p>
              <p className="text-[10px] text-gray-400 mt-1 leading-snug px-3">
                来院から退院まで<br />最新データを網羅的に収集
              </p>
            </div>

            {/* 右の大きな円 */}
            <div
              className="relative flex flex-col items-center justify-center text-center rounded-full shrink-0 pt-6"
              style={{
                width: 272,
                height: 272,
                backgroundColor: TEAL_LIGHT,
                border: `1.5px solid ${TEAL_BORDER}`,
                zIndex: 1,
              }}
            >
              <p className="text-[12px] text-gray-500 mb-2">データで経営改善</p>
              <p className="font-black leading-[1.1]" style={{ fontSize: 26, color: GREEN }}>
                Arche
              </p>
              <p className="font-black leading-[1.1] mb-3" style={{ fontSize: 26, color: GREEN }}>
                経営分析
              </p>
              <p className="text-[11.5px] text-gray-500 leading-snug px-6">
                データにもとづく経営で<br />医院のパフォーマンス<br />を最大化
              </p>
            </div>
          </div>
        </div>

        {/* CTAリンク */}
        <div className="flex items-center justify-center gap-8 mt-12 md:mt-16">
          <a href="#features"
            className="text-[13.5px] font-bold underline underline-offset-4 hover:opacity-70 transition-opacity"
            style={{ color: GREEN }}>
            Archeの特長 →
          </a>
          <a href="#pricing"
            className="text-[13.5px] font-bold underline underline-offset-4 hover:opacity-70 transition-opacity"
            style={{ color: GREEN }}>
            料金プラン →
          </a>
        </div>
      </div>
    </section>
  );
}
