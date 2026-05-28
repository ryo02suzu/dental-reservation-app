import { useState } from "react";
import { Plus, Minus } from "lucide-react";

const GREEN = "#C4B5A1";
const TEXT = "#1A1A2E";

const faqs = [
  {
    q: "無料プランはどこまで使えますか？",
    a: "スタッフ1名・月間予約100件まで永久無料でご利用いただけます。オンライン予約ページ・患者管理・メールリマインダーなど基本機能は全て含まれています。",
  },
  {
    q: "ITが苦手でも使えますか？",
    a: "はい。Archeは歯科医師・スタッフの方が専門知識なしで使えるよう設計されています。初期設定は平均15分以内で完了します。",
  },
  {
    q: "既存の予約システムから移行できますか？",
    a: "はい。患者データをCSVでインポートする機能があります。移行サポートも承りますので、お気軽にお問い合わせください。",
  },
  {
    q: "患者の個人情報は安全ですか？",
    a: "個人情報保護法に準拠しています。全通信はSSL/TLS暗号化、データは国内サーバーに保管。第三者へのデータ提供は一切行いません。",
  },
  {
    q: "月の途中でプランを変更できますか？",
    a: "はい、いつでも変更可能です。アップグレードは即日反映、ダウングレードは翌月から適用。違約金・手数料は一切かかりません。",
  },
  {
    q: "LINE連携はできますか？",
    a: "LINE公式アカウントとの連携アドオン（月額¥1,980）をご利用いただけます。予約確認・リマインダーをLINEで送信できます。",
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button className="w-full flex items-center justify-between gap-6 py-6 text-left" onClick={() => setOpen(!open)}>
        <span className="text-[15px] md:text-[16px] font-bold transition-colors"
          style={{ color: open ? GREEN : TEXT }}>
          {q}
        </span>
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all"
          style={{
            backgroundColor: open ? GREEN : "#F3F4F6",
            color: open ? "white" : "#9CA3AF",
          }}>
          {open ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-48 pb-6" : "max-h-0"}`}>
        <p className="text-[14.5px] leading-[1.9] text-gray-500">{a}</p>
      </div>
    </div>
  );
}

export function FaqSection() {
  return (
    <section style={{ backgroundColor: "#F7F8FA" }} className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-[12px] font-bold tracking-widest uppercase mb-4" style={{ color: GREEN }}>FAQ</p>
          <h2 className="text-[28px] md:text-[40px] font-black tracking-tight" style={{ color: TEXT }}>
            よくある質問
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-8">
          {faqs.map((faq) => (
            <FaqItem key={faq.q} q={faq.q} a={faq.a} />
          ))}
        </div>

        <p className="mt-8 text-center text-[14px] text-gray-400">
          他にご不明点があれば{" "}
          <a href="/contact" className="font-bold underline underline-offset-2 hover:opacity-70" style={{ color: GREEN }}>
            お問い合わせ
          </a>{" "}
          ください。
        </p>
      </div>
    </section>
  );
}
