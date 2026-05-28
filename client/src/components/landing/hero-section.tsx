import { Link } from "wouter";
import { Download, ArrowRight } from "lucide-react";

const GREEN = "#C4B5A1";
const NAVY = "#1a1a2e";

const categories = [
  {
    label: "予約効率化",
    items: ["電話対応の削減", "ペーパレス化でコスト改善", "各種予約の電子化"],
  },
  {
    label: "患者管理",
    items: ["定着・来院数改善", "エンゲージメント向上", "リコール自律促進", "優良患者の発掘"],
  },
  {
    label: "データ活用",
    items: ["経営指標の可視化", "データドリブン経営", "経営判断の迅速化", "キャッシュフロー改善"],
  },
];

function DeviceMockup() {
  const rows = [
    { time: "09:00", name: "田中 美咲", menu: "定期健診", done: true },
    { time: "10:00", name: "山田 由紀", menu: "ホワイトニング", done: false },
    { time: "10:30", name: "鈴木 大輔", menu: "矯正相談", done: false },
    { time: "11:00", name: "伊藤 さくら", menu: "クリーニング", done: false },
    { time: "14:00", name: "佐藤 健太", menu: "虫歯治療", done: false },
  ];

  return (
    <div className="relative select-none" style={{ paddingBottom: "68%" }}>

      {/* ════ ノートPC ════ */}
      <div className="absolute bottom-0 right-0 w-[88%]">
        <div className="rounded-t-[10px] overflow-hidden"
          style={{ border: "8px solid #2d2d2d", backgroundColor: "#2d2d2d" }}>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f0f0f0]">
            <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-400" />
              <div className="w-2 h-2 rounded-full bg-yellow-400" />
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div className="flex-1 bg-white rounded-md px-2 py-0.5 flex items-center gap-1.5 mx-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: GREEN }} />
              <span className="text-[8px] text-gray-400 truncate">arche.jp/admin</span>
            </div>
          </div>

          <div className="bg-white overflow-hidden" style={{ maxHeight: "180px" }}>
            <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-[4px] flex items-center justify-center" style={{ backgroundColor: GREEN }}>
                  <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2C5.5 2 4 3.8 4 5.5C4 7 4.8 8.2 5.5 9C6.2 9.8 6.5 10.5 6.5 11.5C6.5 12.3 7.1 13 8 13C8.9 13 9.5 12.3 9.5 11.5C9.5 10.5 9.8 9.8 10.5 9C11.2 8.2 12 7 12 5.5C12 3.8 10.5 2 8 2Z" fill="white"/>
                  </svg>
                </div>
                <span className="text-[8px] font-black" style={{ color: GREEN }}>Arche</span>
              </div>
              <div className="flex gap-2 ml-2">
                {["予約管理", "患者管理", "分析"].map((t, i) => (
                  <span key={t} className="text-[7px] px-2 py-0.5 rounded font-medium"
                    style={i === 0
                      ? { backgroundColor: GREEN, color: "white" }
                      : { color: "#9CA3AF" }}>
                    {t}
                  </span>
                ))}
              </div>
              <div className="ml-auto flex gap-2">
                <div className="w-12 h-1.5 rounded-full bg-gray-100" />
                <div className="w-8 h-1.5 rounded-full bg-gray-100" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 px-3 pt-2 pb-1">
              {[["本日の予約", "12件"], ["今月来院", "247名"], ["電話削減", "大幅に"]].map(([l, v]) => (
                <div key={l} className="bg-gray-50 rounded-md px-2 py-1.5">
                  <p className="text-[6px] text-gray-400">{l}</p>
                  <p className="text-[11px] font-black" style={{ color: GREEN }}>{v}</p>
                </div>
              ))}
            </div>

            <div className="px-3 space-y-1 py-1">
              {rows.map((r) => (
                <div key={r.time} className="flex items-center gap-2 px-2 py-1 rounded"
                  style={{ backgroundColor: r.done ? "#F9FAFB" : "#FAF5ED" }}>
                  <span className="text-[7px] font-bold font-mono w-6 shrink-0"
                    style={{ color: r.done ? "#D1D5DB" : GREEN }}>{r.time}</span>
                  <span className="text-[7.5px] font-semibold flex-1 truncate"
                    style={{ color: r.done ? "#9CA3AF" : "#111" }}>{r.name}</span>
                  <span className="text-[6.5px] text-gray-400 hidden sm:block">{r.menu}</span>
                  <span className="text-[6px] px-1 py-0.5 rounded font-medium shrink-0"
                    style={r.done
                      ? { backgroundColor: "#F3F4F6", color: "#9CA3AF" }
                      : { backgroundColor: "#FAF0E0", color: GREEN }}>
                    {r.done ? "完了" : "予定"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mx-3 mt-1 px-2 py-1 rounded text-[6.5px] font-medium"
              style={{ backgroundColor: "#FAF5ED", color: GREEN }}>
              🔔 山田 由紀さんに15分前リマインダーを自動送信しました
            </div>
          </div>
        </div>

        <div className="h-[10px] rounded-b-[6px]" style={{ backgroundColor: "#c8c8c8" }} />
        <div className="h-[4px] rounded-b-[8px] mx-auto" style={{ width: "40%", backgroundColor: "#b0b0b0" }} />
      </div>

      {/* ════ スマホ（左下に重なる） ════ */}
      <div className="absolute bottom-[14px] left-0 w-[30%]"
        style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))" }}>
        <div className="rounded-[18px] overflow-hidden"
          style={{ border: "5px solid #1a1a1a", backgroundColor: "#1a1a1a" }}>
          <div className="h-3 flex items-center justify-center bg-[#1a1a1a]">
            <div className="w-8 h-1 rounded-full bg-[#333]" />
          </div>

          <div className="bg-white">
            <div className="flex justify-between px-2 py-0.5" style={{ backgroundColor: GREEN }}>
              <span className="text-[5px] text-white font-medium">Arche</span>
              <span className="text-[5px] text-white">予約管理</span>
            </div>

            <div className="p-2">
              <div className="flex items-center gap-1.5 mb-2 p-1.5 rounded-lg bg-gray-50">
                <div className="w-7 h-7 rounded-full bg-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                  <span className="text-[8px] text-gray-400">写真</span>
                </div>
                <div>
                  <p className="text-[7px] font-black" style={{ color: "#111" }}>山田 由紀</p>
                  <p className="text-[6px] text-gray-400">ホワイトニング / 10:00</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[5.5px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: GREEN }}>予定</span>
                </div>
              </div>

              <p className="text-[6px] font-bold text-gray-400 mb-1">次の予約</p>
              {[
                { time: "10:30", name: "鈴木 大輔", menu: "矯正相談" },
                { time: "11:00", name: "伊藤 さくら", menu: "クリーニング" },
              ].map((r) => (
                <div key={r.time} className="flex items-center gap-1.5 py-1 border-b border-gray-50">
                  <span className="text-[6px] font-bold" style={{ color: GREEN }}>{r.time}</span>
                  <span className="text-[6.5px] font-medium text-gray-700 flex-1">{r.name}</span>
                  <span className="text-[5.5px] text-gray-400">{r.menu}</span>
                </div>
              ))}

              <div className="mt-1.5 px-2 py-1 rounded-lg text-[5.5px] font-medium" style={{ backgroundColor: "#FAF5ED", color: GREEN }}>
                🔔 新規予約が入りました
              </div>
            </div>
          </div>

          <div className="h-2.5 flex items-center justify-center bg-white">
            <div className="w-6 h-0.5 rounded-full bg-gray-300" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <>
      {/* ══════════════════════════════════════
          ヒーロー
          ══════════════════════════════════════ */}
      <section
        className="relative overflow-hidden pt-[62px] md:pt-[96px]"
        style={{
          background: "linear-gradient(135deg, #8B7A68 0%, #C4B5A1 50%, #D8CFC5 80%, #E8E3DC80 100%)",
        }}
      >
        {/* 装飾 */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)" }} />
        <div className="absolute -bottom-20 -left-20 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)" }} />
        <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }} />

        {/* コンテンツ */}
        <div className="relative z-10 max-w-[1160px] mx-auto px-5 pb-10 pt-8 md:pb-14 md:pt-12">

          {/* モバイル：縦積み / デスクトップ：左テキスト + 右CTA絶対配置 */}
          <div className="md:max-w-[50%]">
            {/* タグライン */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-[13px] font-bold px-3 py-[3px] rounded"
                style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#fff" }}>
                業務効率化
              </span>
              <span className="text-[14px] text-white">×</span>
              <span className="text-[13px] font-bold px-3 py-[3px] rounded"
                style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#fff" }}>
                患者管理
              </span>
              <span className="text-[13px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                で医院を伸ばす
              </span>
            </div>

            {/* 大見出し */}
            <h1
              className="font-black text-white leading-[1.12] tracking-[-0.02em] mb-6"
              style={{ fontSize: "clamp(32px, 5.5vw, 68px)" }}
            >
              データで導く、<br />
              スマートな<br />
              歯科経営へ。
            </h1>

            {/* CTA（モバイルのみここに表示） */}
            <div className="flex flex-col sm:flex-row gap-3 md:hidden mb-8">
              <Link href="/demo-login">
                <span className="flex items-center justify-center gap-2 rounded-[14px] px-5 py-3.5 cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
                  style={{ backgroundColor: "#F5C400" }}>
                  <Download className="w-4 h-4 shrink-0 text-gray-900" />
                  <span className="text-[15px] font-black text-gray-900">デモを見る</span>
                </span>
              </Link>
              <Link href="/signup">
                <span className="flex items-center justify-center gap-2 rounded-[14px] px-5 py-3.5 bg-white cursor-pointer shadow-[0_4px_20px_rgba(0,0,0,0.18)]">
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: GREEN }} />
                  <span className="text-[15px] font-black text-gray-900">無料トライアル</span>
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* CTA ピル2つ（デスクトップのみ絶対配置） */}
        <div className="hidden md:flex absolute top-[108px] right-[5%] lg:right-[8%] flex-col gap-3 z-20">
          <Link href="/demo-login">
            <span className="flex items-center gap-3 rounded-[18px] px-5 py-3 cursor-pointer hover:opacity-95 transition-opacity shadow-[0_4px_20px_rgba(0,0,0,0.18)] min-w-[220px]"
              style={{ backgroundColor: "#F5C400" }}>
              <div className="flex-1">
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: "#7A5F00" }}>
                  いつでも見られる！
                </p>
                <p className="text-[15px] font-black text-gray-900 flex items-center gap-1.5">
                  <Download className="w-4 h-4 shrink-0" />
                  デモを見る
                </p>
              </div>
            </span>
          </Link>

          <Link href="/signup">
            <span className="flex items-center gap-3 rounded-[18px] px-5 py-3 bg-white cursor-pointer hover:bg-gray-50 transition-colors shadow-[0_4px_20px_rgba(0,0,0,0.18)] min-w-[220px]">
              <div className="flex-1">
                <p className="text-[10px] font-semibold mb-0.5" style={{ color: GREEN }}>
                  使いやすさを実感！
                </p>
                <p className="text-[15px] font-black text-gray-900 flex items-center gap-1.5">
                  <ArrowRight className="w-4 h-4 shrink-0" style={{ color: GREEN }} />
                  無料トライアル
                </p>
              </div>
            </span>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════
          「ひとつで解決」セクション
          ══════════════════════════════════════ */}
      <section className="bg-white py-12 md:py-16 border-b border-gray-100">
        <div className="max-w-[1160px] mx-auto px-5">
          <div className="grid md:grid-cols-[0.85fr_1fr] gap-10 lg:gap-16 items-center">

            {/* デバイスモックアップ */}
            <div className="w-full max-w-[420px] mx-auto md:max-w-none">
              <DeviceMockup />
            </div>

            {/* テキスト */}
            <div>
              <h2 className="text-[22px] md:text-[26px] font-black text-gray-900 mb-7">
                Archeひとつで、すべて解決！
              </h2>

              <div className="space-y-5">
                {categories.map((cat) => (
                  <div key={cat.label} className="flex items-start gap-3">
                    <span
                      className="shrink-0 text-[12px] font-bold text-white px-3 py-[5px] rounded mt-0.5 whitespace-nowrap"
                      style={{ backgroundColor: GREEN }}
                    >
                      {cat.label}
                    </span>
                    <p className="text-[13.5px] text-gray-600 leading-[1.85]">
                      {cat.items.join(" ／ ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
