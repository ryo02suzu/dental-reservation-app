import { useState, useEffect, useRef } from "react";
import { ChevronDown, Menu, X, Calendar, Users, Bell, BarChart3, MessageCircle, Clock, Phone, RefreshCcw, Building2, Heart, Zap, ArrowRight } from "lucide-react";
import { Link, useLocation } from "wouter";

const DF_BEIGE = "#C4B5A1";
const NAVY = "#1a1a2e";

const dropdowns: Record<string, { icon: React.ElementType; label: string; desc: string; href: string }[]> = {
  "Archeとは": [
    { icon: Building2, label: "プロダクトについて", desc: "Archeのミッションと機能概要", href: "/about" },
    { icon: Heart, label: "私たちのビジョン", desc: "歯科業界DXへの思い", href: "/about#mission" },
    { icon: Zap, label: "Sourirette合同会社", desc: "会社・チームの紹介", href: "/about#company" },
  ],
  "機能": [
    { icon: Calendar, label: "オンライン予約", desc: "24時間Web予約で電話対応を削減", href: "/features#booking" },
    { icon: Users, label: "患者管理", desc: "来院履歴・情報を一元管理", href: "/features#patients" },
    { icon: Bell, label: "リコール機能", desc: "定期来院を自動で促進", href: "/features#recall" },
    { icon: MessageCircle, label: "リマインダー", desc: "無断キャンセルを大幅削減", href: "/features#reminder" },
    { icon: BarChart3, label: "経営分析", desc: "データで経営判断を高速化", href: "/features#analytics" },
    { icon: Clock, label: "スタッフ管理", desc: "QRログインで手軽な管理", href: "/features#staff" },
  ],
  "解決できること": [
    { icon: Phone, label: "電話対応の削減", desc: "オンライン予約でスタッフの電話負担を軽減", href: "/solutions#phone" },
    { icon: RefreshCcw, label: "定期来院の促進", desc: "リコール機能で定期健診の来院を自動促進", href: "/solutions#recall" },
    { icon: Bell, label: "無断キャンセル削減", desc: "リマインダーでうっかりキャンセルを防止", href: "/solutions#noshow" },
    { icon: BarChart3, label: "経営の見える化", desc: "リアルタイム分析で即断即決", href: "/solutions#data" },
  ],
};

function DropdownMenu({ items }: { items: typeof dropdowns[string] }) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[320px] bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50"
      style={{ animation: "fadeDropdown 0.15s ease" }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href}>
            <span className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors group">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${DF_BEIGE}20` }}>
                <Icon className="w-4 h-4" style={{ color: NAVY }} />
              </div>
              <div>
                <p className="text-[13px] font-bold text-gray-800 group-hover:text-gray-900">{item.label}</p>
                <p className="text-[11.5px] text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

const navLinks = [
  { label: "Archeとは", href: "/about", dropdown: true },
  { label: "機能", href: "/features", dropdown: true },
  { label: "開発ストーリー", href: "/cases", dropdown: false },
  { label: "解決できること", href: "/solutions", dropdown: true },
  { label: "料金", href: "/pricing", dropdown: false },
];

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [location] = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 4);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setActiveDropdown(null);
  }, [location]);

  function handleMouseEnter(label: string) {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (dropdowns[label]) setActiveDropdown(label);
  }

  function handleMouseLeave() {
    timerRef.current = setTimeout(() => setActiveDropdown(null), 120);
  }

  return (
    <>
      <style>{`
        @keyframes fadeDropdown {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <div className="fixed top-0 left-0 right-0 z-50">

        {/* ── 上部ユーティリティバー（デスクトップのみ） ── */}
        <div className="hidden md:block bg-white border-b border-gray-200/60">
          <div className="max-w-[1160px] mx-auto px-5 h-[34px] flex items-center justify-between">
            <span className="text-[12px] text-gray-500">歯科医院専用クラウド予約・管理システム</span>
            <div className="flex items-center gap-6">
              {[
                { label: "コラム", href: "#" },
                { label: "お知らせ", href: "#" },
                { label: "サポート", href: "/contact" },
                { label: "会社情報", href: "/about" },
              ].map((l) => (
                <Link key={l.label} href={l.href}>
                  <span className="text-[12px] text-gray-500 hover:text-gray-700 transition-colors cursor-pointer whitespace-nowrap">{l.label}</span>
                </Link>
              ))}
              <Link href="/login">
                <span className="text-[12px] text-gray-500 hover:text-gray-700 font-medium flex items-center gap-0.5 cursor-pointer">
                  ログイン <span className="text-[11px]">⇒</span>
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* ── メインナビ ── */}
        <nav className={`bg-white transition-shadow duration-150 ${scrolled ? "shadow-[0_1px_6px_rgba(0,0,0,0.10)]" : "border-b border-gray-200/60"}`}>
          <div className="max-w-[1160px] mx-auto px-5">
            <div className="flex items-center h-[62px] gap-10">

              {/* ロゴ */}
              <Link href="/">
                <span className="flex items-center gap-2 shrink-0 mr-2 cursor-pointer">
                  <div className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center" style={{ backgroundColor: NAVY }}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2C5.5 2 4 3.8 4 5.5C4 7 4.8 8.2 5.5 9C6.2 9.8 6.5 10.5 6.5 11.5C6.5 12.3 7.1 13 8 13C8.9 13 9.5 12.3 9.5 11.5C9.5 10.5 9.8 9.8 10.5 9C11.2 8.2 12 7 12 5.5C12 3.8 10.5 2 8 2Z" fill={DF_BEIGE} />
                    </svg>
                  </div>
                  <span className="text-[18px] font-black tracking-tight" style={{ color: NAVY }}>Arche</span>
                </span>
              </Link>

              {/* ナビリンク */}
              <div className="hidden lg:flex items-center gap-7">
                {navLinks.map((link) => {
                  const isActive = location === link.href || location.startsWith(link.href + "#");
                  return (
                    <div
                      key={link.label}
                      className="relative"
                      onMouseEnter={() => handleMouseEnter(link.label)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <Link href={link.href}>
                        <span
                          className="flex items-center gap-[3px] text-[13.5px] font-medium whitespace-nowrap cursor-pointer transition-colors"
                          style={{ color: isActive ? NAVY : "#4B5563" }}
                        >
                          {link.label}
                          {link.dropdown && (
                            <ChevronDown
                              className="w-[14px] h-[14px] mt-px transition-transform"
                              style={{
                                color: "#9CA3AF",
                                transform: activeDropdown === link.label ? "rotate(180deg)" : "rotate(0deg)",
                              }}
                            />
                          )}
                        </span>
                      </Link>
                      {link.dropdown && activeDropdown === link.label && (
                        <div onMouseEnter={() => handleMouseEnter(link.label)} onMouseLeave={handleMouseLeave}>
                          <DropdownMenu items={dropdowns[link.label]} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* CTA ボタン */}
              <div className="hidden lg:flex items-center gap-2.5 ml-auto">
                <Link href="/demo-login">
                  <span className="inline-flex items-center px-[18px] h-[40px] rounded-full text-[13px] font-bold text-white hover:opacity-85 transition-opacity whitespace-nowrap cursor-pointer" style={{ backgroundColor: NAVY }}>
                    デモを見る
                  </span>
                </Link>
                <Link href="/signup">
                  <span className="inline-flex items-center px-[18px] h-[40px] rounded-full text-[13px] font-bold hover:opacity-90 transition-opacity whitespace-nowrap cursor-pointer" style={{ backgroundColor: DF_BEIGE, color: "#2A221A" }}>
                    無料で始める
                  </span>
                </Link>
              </div>

              {/* ハンバーガー（モバイル） */}
              <button className="lg:hidden ml-auto p-1" onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X className="w-5 h-5 text-gray-700" /> : <Menu className="w-5 h-5 text-gray-700" />}
              </button>
            </div>
          </div>

          {/* モバイルメニュー */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-gray-100 bg-white">
              <div className="px-5 py-4 space-y-1">
                {navLinks.map((link) => (
                  <Link key={link.label} href={link.href}>
                    <span className="flex items-center justify-between py-3 text-[15px] font-medium text-gray-700 border-b border-gray-100 cursor-pointer" onClick={() => setMobileOpen(false)}>
                      {link.label}
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </span>
                  </Link>
                ))}
                <div className="pt-4 space-y-2">
                  <Link href="/demo-login">
                    <span className="block text-center py-3 rounded-full text-[14px] font-bold text-white cursor-pointer" style={{ backgroundColor: NAVY }} onClick={() => setMobileOpen(false)}>
                      デモを見る
                    </span>
                  </Link>
                  <Link href="/signup">
                    <span className="block text-center py-3 rounded-full text-[14px] font-bold cursor-pointer" style={{ backgroundColor: DF_BEIGE, color: "#2A221A" }} onClick={() => setMobileOpen(false)}>
                      無料で始める
                    </span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </nav>
      </div>
    </>
  );
}
