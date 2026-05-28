import { useState } from "react";
import { Building2, User, UserCircle2, ArrowRight, Loader2, Stethoscope, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type DemoRole = "admin" | "patient" | "staff" | null;

const roles = [
  {
    key: "admin" as const,
    icon: Building2,
    iconBg: "bg-[#1a1a2e]",
    iconColor: "text-white",
    label: "歯科医院 管理画面",
    sub: "院長・受付スタッフ向け",
    desc: "予約カレンダー・患者管理・シフト・売上レポートなど、クリニックの運営業務を一元管理できます。",
    features: ["予約カレンダー（日・週表示）", "患者台帳・来院履歴", "スタッフシフト管理", "リコール・リマインダー設定"],
    href: "/api/demo/admin",
    accent: "border-[#1a1a2e]/20 hover:border-[#1a1a2e]/40",
    badge: "管理者",
    badgeBg: "bg-[#1a1a2e] text-white",
  },
  {
    key: "patient" as const,
    icon: User,
    iconBg: "bg-[#C4B5A1]",
    iconColor: "text-white",
    label: "患者 マイページ",
    sub: "患者さん向け",
    desc: "オンライン予約・予約確認・来院履歴の確認が行えます。LINEやSMSでのリマインダー受け取りも設定できます。",
    features: ["オンライン予約（24時間）", "予約確認・キャンセル", "来院履歴・次回予約", "問診票の事前記入"],
    href: "/api/demo/patient",
    accent: "border-[#C4B5A1]/40 hover:border-[#C4B5A1]/80",
    badge: "患者",
    badgeBg: "bg-[#C4B5A1] text-white",
  },
  {
    key: "staff" as const,
    icon: UserCircle2,
    iconBg: "bg-emerald-600",
    iconColor: "text-white",
    label: "スタッフ マイページ",
    sub: "歯科医師・歯科衛生士向け",
    desc: "自分の担当予約・シフト確認・勤怠打刻ができるスタッフ専用ページ。スマホからも使えます。",
    features: ["担当予約の一覧・詳細", "シフト確認（週・月）", "出退勤 QR打刻", "シフト申請・希望提出"],
    href: "/api/demo/staff",
    accent: "border-emerald-200 hover:border-emerald-400",
    badge: "スタッフ",
    badgeBg: "bg-emerald-600 text-white",
  },
];

export default function DemoLoginPage() {
  const [loading, setLoading] = useState<DemoRole>(null);

  const handleClick = (key: DemoRole, href: string) => {
    setLoading(key);
    window.location.href = href;
  };

  return (
    <div className="min-h-screen bg-[#FAF5ED] flex flex-col">
      {/* Header */}
      <div className="border-b border-[#C4B5A1]/30 bg-white/70 backdrop-blur px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#1a1a2e] rounded-lg flex items-center justify-center">
          <Stethoscope className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-[#1a1a2e] text-sm tracking-tight">Arche</span>
        <span className="text-xs text-[#1a1a2e]/40 font-medium ml-1">デモ環境</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-3xl w-full">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-[#C4B5A1]/15 text-[#8a7a6a] text-xs font-semibold px-3 py-1.5 rounded-full mb-4 tracking-wide">
              ログイン不要・即体験
            </div>
            <h1 className="text-2xl font-black text-[#1a1a2e] mb-2 tracking-tight">
              どの画面を体験しますか？
            </h1>
            <p className="text-sm text-[#1a1a2e]/50">
              デモ用クリニック「デモ歯科クリニック」のデータで実際の操作感を体験できます。
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {roles.map((role) => {
              const Icon = role.icon;
              const isLoading = loading === role.key;
              return (
                <button
                  key={role.key}
                  data-testid={`demo-card-${role.key}`}
                  disabled={loading !== null}
                  onClick={() => handleClick(role.key, role.href)}
                  className={`group relative text-left bg-white rounded-2xl border-2 ${role.accent} transition-all duration-200 p-6 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C4B5A1]/40`}
                >
                  {/* Badge */}
                  <span className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full ${role.badgeBg}`}>
                    {role.badge}
                  </span>

                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-xl ${role.iconBg} flex items-center justify-center mb-4`}>
                    {isLoading
                      ? <Loader2 className={`w-5 h-5 ${role.iconColor} animate-spin`} />
                      : <Icon className={`w-5 h-5 ${role.iconColor}`} />
                    }
                  </div>

                  {/* Label */}
                  <div className="mb-1">
                    <p className="font-black text-[#1a1a2e] text-base leading-tight">{role.label}</p>
                    <p className="text-xs text-[#1a1a2e]/45 mt-0.5">{role.sub}</p>
                  </div>

                  {/* Desc */}
                  <p className="text-xs text-[#1a1a2e]/60 leading-relaxed mt-2 mb-4">{role.desc}</p>

                  {/* Features */}
                  <ul className="space-y-1 mb-5">
                    {role.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5 text-[11px] text-[#1a1a2e]/55">
                        <ChevronRight className="w-3 h-3 text-[#C4B5A1] shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className={`flex items-center gap-1.5 text-xs font-bold ${isLoading ? "text-[#1a1a2e]/40" : "text-[#1a1a2e] group-hover:gap-2.5"} transition-all`}>
                    {isLoading ? (
                      <span>読み込み中...</span>
                    ) : (
                      <>
                        この画面を体験する
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer note */}
          <p className="text-center text-[11px] text-[#1a1a2e]/30 mt-8">
            デモ環境のデータは実際の患者情報とは無関係です。メール送信・SMS送信は行われません。
          </p>
        </div>
      </div>
    </div>
  );
}
