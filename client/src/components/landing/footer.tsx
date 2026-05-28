import { Link } from "wouter";

const GREEN = "#C4B5A1";
const TEXT = "#1A1A2E";

const cols = [
  {
    heading: "Archeとは",
    links: [
      { label: "Archeの想い", href: "/contact" },
      { label: "機能の特長", href: "#features" },
      { label: "「使いやすさ」への取り組み", href: "#" },
      { label: "充実したサポート", href: "/contact" },
      { label: "セキュリティ", href: "/privacy" },
      { label: "よくある質問", href: "#" },
    ],
  },
  {
    heading: "解決できること",
    links: [
      { label: "電話対応の削減", href: "#features" },
      { label: "患者のエンゲージメント向上", href: "#features" },
      { label: "DX・ペーパーレス化の実現", href: "#features" },
      { label: "定期健診・リコール促進", href: "#features" },
      { label: "経営の意思決定へのデータ活用", href: "#features" },
    ],
  },
  {
    heading: "事例",
    links: [
      { label: "導入事例", href: "/contact" },
      { label: "活用事例", href: "/contact" },
    ],
    extra: {
      heading: "SmartHRコラム",
      links: [
        { label: "機能解説", href: "/contact" },
        { label: "導入ガイド", href: "/contact" },
      ],
    },
  },
  {
    heading: "ノウハウ・お役立ち",
    links: [
      { label: "資料ダウンロード", href: "/contact" },
      { label: "お問い合わせ", href: "/contact" },
    ],
    extra: {
      heading: "お知らせ",
      links: [
        { label: "プレスリリース", href: "/contact" },
        { label: "その他お知らせ", href: "/contact" },
      ],
    },
  },
];

export function Footer() {
  return (
    <footer style={{ backgroundColor: "#F7F8FA" }}>

      {/* メインフッターリンク */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-14 pb-10">

        {/* 上部：ロゴ＋説明 */}
        <div className="flex items-start justify-between gap-8 mb-10 pb-8 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1a1a2e" }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M8 2C5.5 2 4 3.8 4 5.5C4 7 4.8 8.2 5.5 9C6.2 9.8 6.5 10.5 6.5 11.5C6.5 12.3 7.1 13 8 13C8.9 13 9.5 12.3 9.5 11.5C9.5 10.5 9.8 9.8 10.5 9C11.2 8.2 12 7 12 5.5C12 3.8 10.5 2 8 2Z" fill={GREEN} />
              </svg>
            </div>
            <span className="font-black text-[17px] tracking-tight" style={{ color: "#1a1a2e" }}>Arche</span>
          </Link>
          <p className="text-[12px] text-gray-400 italic hidden md:block">dental-friendly</p>
        </div>

        {/* リンク列 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {cols.map((col) => (
            <div key={col.heading}>
              <p className="text-[12.5px] font-black mb-4 flex items-center gap-1.5" style={{ color: TEXT }}>
                {col.heading}
                <span className="text-gray-300">→</span>
              </p>
              <ul className="space-y-2.5 mb-5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"href" in link && link.href.startsWith("#") ? (
                      <a href={link.href} className="text-[12.5px] text-gray-500 hover:text-gray-800 transition-colors">{link.label}</a>
                    ) : (
                      <Link href={(link as any).href} className="text-[12.5px] text-gray-500 hover:text-gray-800 transition-colors">{link.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
              {col.extra && (
                <>
                  <p className="text-[12.5px] font-black mb-3 flex items-center gap-1.5" style={{ color: TEXT }}>
                    {col.extra.heading} <span className="text-gray-300">→</span>
                  </p>
                  <ul className="space-y-2.5">
                    {col.extra.links.map((link) => (
                      <li key={link.label}>
                        <Link href={link.href} className="text-[12.5px] text-gray-500 hover:text-gray-800 transition-colors">{link.label}</Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>

        {/* 機能リンク帯 */}
        <div className="border-t border-gray-200 pt-8 mb-8">
          <p className="text-[12px] font-bold mb-4 flex items-center gap-1.5" style={{ color: TEXT }}>
            機能 <span className="text-gray-300">→</span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { head: "予約管理", links: ["オンライン予約", "キャンセル待ち", "リマインダー", "スタッフ設定", "診療メニュー管理"] },
              { head: "患者管理", links: ["患者情報管理", "リコール配信", "問診票デジタル化", "来院履歴", "CSV出力"] },
              { head: "経営分析", links: ["売上ダッシュボード", "キャンセル率分析", "月次レポート", "スタッフ別実績"] },
              { head: "連携・セキュリティ", links: ["LINE連携", "SMS連携", "個人情報保護", "SSL暗号化"] },
            ].map((group) => (
              <div key={group.head}>
                <p className="text-[12px] font-bold text-gray-600 mb-2">{group.head}</p>
                <ul className="space-y-1.5">
                  {group.links.map((l) => (
                    <li key={l}>
                      <a href="#features" className="text-[11.5px] text-gray-400 hover:text-gray-700 transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* クイックリンク帯 */}
        <div className="flex flex-wrap gap-3 pb-8 border-b border-gray-200">
          {[
            { label: "資料ダウンロード", href: "/contact" },
            { label: "料金プラン", href: "#pricing" },
            { label: "デモを試す", href: "/demo-login" },
            { label: "無料トライアル", href: "/signup" },
          ].map((l) => (
            l.href.startsWith("#") ? (
              <a key={l.label} href={l.href}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[12.5px] font-medium border border-gray-300 text-gray-600 hover:border-gray-400 transition-all bg-white">
                {l.label} →
              </a>
            ) : (
              <Link key={l.label} href={l.href}>
                <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-[12.5px] font-medium border border-gray-300 text-gray-600 hover:border-gray-400 transition-all bg-white">
                  {l.label} →
                </span>
              </Link>
            )
          ))}
        </div>

        {/* 最下部 */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#1a1a2e" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2C5.5 2 4 3.8 4 5.5C4 7 4.8 8.2 5.5 9C6.2 9.8 6.5 10.5 6.5 11.5C6.5 12.3 7.1 13 8 13C8.9 13 9.5 12.3 9.5 11.5C9.5 10.5 9.8 9.8 10.5 9C11.2 8.2 12 7 12 5.5C12 3.8 10.5 2 8 2Z" fill={GREEN} />
                </svg>
              </div>
              <span className="font-black text-[14px]" style={{ color: "#1a1a2e" }}>Arche</span>
            </Link>
            <p className="text-[11px] text-gray-400">by Sourirette合同会社</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/contact" className="text-[11.5px] text-gray-400 hover:text-gray-600 transition-colors">サポート</Link>
            <Link href="/terms" className="text-[11.5px] text-gray-400 hover:text-gray-600 transition-colors">利用規約</Link>
            <Link href="/privacy" className="text-[11.5px] text-gray-400 hover:text-gray-600 transition-colors">プライバシーポリシー</Link>
            <a href="mailto:sourirette.consulting@gmail.com" className="text-[11.5px] text-gray-400 hover:text-gray-600 transition-colors">お問い合わせ</a>
          </div>
          <p className="text-[11px] text-gray-400">© 2026 Sourirette合同会社</p>
        </div>
      </div>
    </footer>
  );
}
