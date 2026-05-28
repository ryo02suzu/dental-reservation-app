import type { ComponentType } from "react";
import {
  ChevronRight, Calendar, Users, BarChart3, Bell, MessageCircle,
  FileText, Clock, TrendingUp, Database, RefreshCcw, Star,
  LayoutDashboard, Settings, CheckCircle2, AlertCircle, HelpCircle,
} from "lucide-react";

const GREEN = "#C4B5A1";
const TEXT = "#0A0F1E";

/* ──────────────────────────────────────────
   共通：ミニサイドバー
   実際のAppSidebarと同じアイコン構成
────────────────────────────────────────── */
const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, active: false },
  { icon: Calendar,        active: false },
  { icon: Users,           active: false },
  { icon: Bell,            active: false },
  { icon: FileText,        active: false },
  { icon: BarChart3,       active: false },
  { icon: Settings,        active: false },
  { icon: HelpCircle,      active: false },
];

function MiniSidebar({ activeIdx = 0 }: { activeIdx?: number }) {
  return (
    <div className="w-12 shrink-0 h-full flex flex-col bg-[#1a1a2e] border-r border-white/10">
      {/* ロゴ */}
      <div className="h-10 flex items-center justify-center border-b border-white/10">
        <span className="text-[10px] font-black text-white">DF</span>
      </div>
      {/* メニュー */}
      <div className="flex flex-col gap-0.5 px-1.5 pt-2">
        {SIDEBAR_ITEMS.map(({ icon: Icon }, i) => (
          <div key={i}
            className={`flex items-center justify-center rounded-md w-9 h-9 ${i === activeIdx ? "bg-white/20 text-white" : "text-white/40"}`}>
            <Icon className="w-4 h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   モックアップ①：ダッシュボード（予約管理）
────────────────────────────────────────── */
const TREATMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "定期検診":   { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" },
  "虫歯治療":   { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" },
  "クリーニング":{ bg: "#FAF5ED", text: "#7A6245", border: "#DDD0BF" },
  "矯正相談":   { bg: "#faf5ff", text: "#7c3aed", border: "#e9d5ff" },
  "抜歯":       { bg: "#fff7ed", text: "#c2410c", border: "#fed7aa" },
};

const DEMO_APPTS = [
  { time: "09:00", name: "田中　健一",  type: "定期検診",    status: "confirmed" },
  { time: "10:30", name: "鈴木　美咲",  type: "クリーニング", status: "confirmed" },
  { time: "11:00", name: "山田　太郎",  type: "虫歯治療",    status: "pending"   },
  { time: "14:00", name: "佐藤　花子",  type: "矯正相談",    status: "confirmed" },
  { time: "15:30", name: "伊藤　翔",    type: "抜歯",        status: "pending"   },
];

function BookingMockup() {
  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 w-full flex flex-col" style={{ height: 360 }}>
      {/* ブラウザバー */}
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center gap-2 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        </div>
        <div className="flex-1 bg-white rounded text-[10px] text-gray-400 text-center py-0.5 mx-8 border border-gray-200">
          app.arche.jp
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <MiniSidebar activeIdx={0} />

        {/* メインコンテンツ */}
        <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
          {/* ヘッダー */}
          <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 shrink-0 flex items-center justify-between">
            <p className="text-[12px] font-black text-gray-800">ダッシュボード</p>
            <span className="text-[10px] text-gray-400">2026/04/03（金）</span>
          </div>

          {/* 統計カード */}
          <div className="grid grid-cols-3 gap-2 px-3 pt-3 pb-2 shrink-0">
            {[
              { label: "今日の予約", value: "12件", color: GREEN },
              { label: "確認待ち",   value: "3件",  color: "#d97706" },
              { label: "完了済み",   value: "7件",  color: "#0284c7" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-lg border border-gray-100 px-2.5 py-2">
                <p className="text-[9px] text-gray-400 mb-1">{label}</p>
                <p className="text-[16px] font-black" style={{ color }}>{value}</p>
              </div>
            ))}
          </div>

          {/* 予約リスト */}
          <div className="flex-1 overflow-hidden px-3 pb-3">
            <p className="text-[10px] font-bold text-gray-500 mb-1.5">本日の予約</p>
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {DEMO_APPTS.map((a) => {
                const c = TREATMENT_COLORS[a.type] ?? { bg: "#f9fafb", text: "#374151", border: "#e5e7eb" };
                return (
                  <div key={a.time} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="text-[10px] font-bold text-gray-400 w-9 shrink-0">{a.time}</span>
                    <span className="text-[11px] font-bold text-gray-700 flex-1 truncate">{a.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border shrink-0"
                      style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>
                      {a.type}
                    </span>
                    {a.status === "confirmed"
                      ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                      : <AlertCircle  className="w-3.5 h-3.5 shrink-0 text-amber-400" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   モックアップ②：患者一覧（患者管理）
────────────────────────────────────────── */
const DEMO_PATIENTS = [
  { no: "P0124", name: "田中　健一", age: 40, last: "2026/02/15", recall: "2026/06", tag: "定期" },
  { no: "P0089", name: "鈴木　美咲", age: 34, last: "2026/03/01", recall: "2026/07", tag: "定期" },
  { no: "P0211", name: "山田　太郎", age: 52, last: "2026/01/20", recall: "未設定",  tag: "初診" },
  { no: "P0055", name: "佐藤　花子", age: 28, last: "2026/03/22", recall: "2026/09", tag: "定期" },
];

function PatientMockup() {
  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 w-full flex flex-col" style={{ height: 360 }}>
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center gap-2 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        </div>
        <div className="flex-1 bg-white rounded text-[10px] text-gray-400 text-center py-0.5 mx-8 border border-gray-200">
          app.arche.jp
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <MiniSidebar activeIdx={2} />

        <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
          <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 shrink-0 flex items-center justify-between">
            <p className="text-[12px] font-black text-gray-800">患者一覧</p>
            <div className="flex items-center gap-2">
              <div className="text-[9px] bg-gray-100 rounded px-2 py-1 text-gray-500">🔍 検索…</div>
              <span className="text-[9px] font-bold px-2 py-1 rounded" style={{ backgroundColor: GREEN, color: "#2A221A" }}>+ 新規登録</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden px-3 pt-3 pb-3">
            {/* 患者数サマリー */}
            <div className="flex gap-2 mb-2">
              {[["総患者数", "287名"], ["今月の新患", "23名"], ["リコール対象", "41名"]].map(([k, v]) => (
                <div key={k} className="bg-white rounded-lg border border-gray-100 px-2.5 py-1.5 flex-1">
                  <p className="text-[9px] text-gray-400">{k}</p>
                  <p className="text-[13px] font-black text-gray-800">{v}</p>
                </div>
              ))}
            </div>

            {/* 患者カードリスト */}
            <div className="bg-white rounded-lg border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {/* ヘッダー行 */}
              <div className="grid grid-cols-5 px-3 py-1.5 bg-gray-50">
                {["患者番号", "氏名", "年齢", "最終来院", "リコール"].map((h) => (
                  <p key={h} className="text-[9px] font-bold text-gray-400">{h}</p>
                ))}
              </div>
              {DEMO_PATIENTS.map((p) => (
                <div key={p.no} className="grid grid-cols-5 items-center px-3 py-2">
                  <span className="text-[9px] text-gray-400 font-mono">{p.no}</span>
                  <span className="text-[11px] font-bold text-gray-700">{p.name}</span>
                  <span className="text-[10px] text-gray-500">{p.age}歳</span>
                  <span className="text-[9px] text-gray-400">{p.last}</span>
                  <span className="text-[9px] font-bold"
                    style={{ color: p.recall === "未設定" ? "#dc2626" : GREEN }}>
                    {p.recall}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   モックアップ③：レポート（経営分析）
────────────────────────────────────────── */
const MONTHLY = [
  { m: "10月", v: 62 }, { m: "11月", v: 74 }, { m: "12月", v: 68 },
  { m: "1月",  v: 81 }, { m: "2月",  v: 75 }, { m: "3月",  v: 90 },
];

function AnalyticsMockup() {
  const max = 90;
  return (
    <div className="bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200 w-full flex flex-col" style={{ height: 360 }}>
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center gap-2 shrink-0">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        </div>
        <div className="flex-1 bg-white rounded text-[10px] text-gray-400 text-center py-0.5 mx-8 border border-gray-200">
          app.arche.jp
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <MiniSidebar activeIdx={5} />

        <div className="flex-1 bg-gray-50 overflow-hidden flex flex-col">
          <div className="px-4 pt-3 pb-2 bg-white border-b border-gray-100 shrink-0">
            <p className="text-[12px] font-black text-gray-800">レポート</p>
          </div>

          <div className="flex-1 overflow-hidden px-3 pt-3 pb-3 flex flex-col gap-2">
            {/* KPIカード */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              {[
                { label: "今月売上",   value: "¥3.0M", delta: "+12%", up: true },
                { label: "今月来院数", value: "148名",  delta: "+8%",  up: true },
                { label: "新患数",     value: "23名",   delta: "+15%", up: true },
              ].map(({ label, value, delta, up }) => (
                <div key={label} className="bg-white rounded-lg border border-gray-100 px-2.5 py-2">
                  <p className="text-[9px] text-gray-400 mb-0.5">{label}</p>
                  <p className="text-[14px] font-black text-gray-800">{value}</p>
                  <p className="text-[9px] font-bold" style={{ color: up ? GREEN : "#dc2626" }}>{delta}</p>
                </div>
              ))}
            </div>

            {/* 棒グラフ */}
            <div className="bg-white rounded-lg border border-gray-100 px-3 pt-2.5 pb-3 flex-1">
              <p className="text-[10px] font-bold text-gray-500 mb-3">月別来院数</p>
              <div className="flex items-end gap-2" style={{ height: 100 }}>
                {MONTHLY.map(({ m, v }) => (
                  <div key={m} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[8px] text-gray-400">{v}</span>
                    <div className="w-full rounded-t-sm transition-all"
                      style={{ height: `${(v / max) * 80}px`, backgroundColor: m === "3月" ? GREEN : "#D8CFC5" }} />
                    <span className="text-[8px] text-gray-400">{m}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   共通UIパーツ
────────────────────────────────────────── */
function ArrowRow() {
  return (
    <div className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center shrink-0 group-hover/row:border-amber-400 group-hover/row:bg-amber-50 transition-colors">
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover/row:text-amber-700 transition-colors" />
    </div>
  );
}

function FeatureRow({ icon: Icon, label, badge }: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}) {
  return (
    <a href="#features"
      className="group/row flex items-center gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors last:border-b-0">
      <Icon className="w-4 h-4 shrink-0 text-gray-400" />
      <span className="flex-1 text-[13.5px] font-semibold text-gray-700">{label}</span>
      {badge && (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: GREEN, color: "#2A221A" }}>{badge}</span>
      )}
      <ArrowRow />
    </a>
  );
}

function StatBar({ label, value, color, width }: { label: string; value: string; color: string; width: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-gray-500 w-12 shrink-0">{label}</span>
      <div className="h-5 rounded-sm" style={{ width, backgroundColor: color }} />
      <span className="text-[11px] text-gray-600 font-bold">{value}</span>
    </div>
  );
}

/* ──────────────────────────────────────────
   モジュール定義
────────────────────────────────────────── */
const modules = [
  {
    bg: "white",
    name: "Arche",
    service: "予約管理",
    description: "電話対応をゼロに近づける\n24時間オンライン予約を実現",
    stat: { before: "", after: "", label: "電話予約をオンライン予約に切り替え" },
    features: [
      { icon: Calendar,      label: "オンライン予約受付",   badge: "定番" },
      { icon: MessageCircle, label: "LINE連携予約",         badge: "定番" },
      { icon: Bell,          label: "リマインダー自動送信",  badge: undefined },
      { icon: RefreshCcw,    label: "キャンセル・変更管理", badge: undefined },
      { icon: Clock,         label: "スタッフ・シフト管理", badge: undefined },
      { icon: FileText,      label: "問診票デジタル化",     badge: undefined },
    ],
    Mockup: BookingMockup,
  },
  {
    bg: "#F7F8FA",
    name: "Arche",
    service: "患者管理",
    description: "来院から退院まで一元管理\n患者ケアの質を向上させる",
    stat: { before: "", after: "", label: "患者データをひとつに集約" },
    features: [
      { icon: Users,    label: "患者データベース",      badge: "定番" },
      { icon: Bell,     label: "リコール・定期健診管理", badge: "定番" },
      { icon: FileText, label: "来院履歴・治療記録",    badge: undefined },
      { icon: Star,     label: "患者満足度管理",        badge: undefined },
      { icon: Database, label: "問診データ管理",        badge: undefined },
      { icon: Clock,    label: "待ち時間の可視化",      badge: undefined },
    ],
    Mockup: PatientMockup,
  },
  {
    bg: "white",
    name: "Arche",
    service: "経営分析",
    description: "データにもとづく経営判断で\n医院のパフォーマンスを最大化",
    stat: { before: "", after: "", label: "経営データをリアルタイムで把握" },
    features: [
      { icon: BarChart3,  label: "売上・来院統計",      badge: "定番" },
      { icon: TrendingUp, label: "スタッフ稼働分析",    badge: undefined },
      { icon: Users,      label: "新患・リピート分析",  badge: undefined },
      { icon: Bell,       label: "リコール達成率",      badge: undefined },
      { icon: FileText,   label: "月次レポート自動生成", badge: undefined },
      { icon: Database,   label: "データエクスポート",   badge: undefined },
    ],
    Mockup: AnalyticsMockup,
  },
];

/* ──────────────────────────────────────────
   セクション本体
────────────────────────────────────────── */
export function ServiceModulesSection() {
  return (
    <div>
      {/* ヘッダー */}
      <section className="bg-white pt-20 pb-6">
        <div className="text-center">
          <h2 className="text-[26px] md:text-[38px] font-black tracking-tight" style={{ color: TEXT }}>
            Archeの<span style={{ color: GREEN }}>サービス</span>
          </h2>
          <p className="text-[14.5px] text-gray-500 mt-3">
            予約・患者・経営をひとつにまとめた豊富な機能で、あらゆる課題を解決します
          </p>
        </div>
      </section>

      {modules.map(({ bg, name, service, description, stat, features, Mockup }) => (
        <section key={service} style={{ backgroundColor: bg }} className="py-16 overflow-hidden">
          <div className="max-w-[1080px] mx-auto px-6">
            <div className="flex flex-col lg:flex-row items-start gap-10">

              {/* 左：テキスト */}
              <div className="w-full lg:w-[420px] shrink-0">
                <h3 className="text-[28px] md:text-[36px] font-black leading-tight mb-3">
                  <span style={{ color: GREEN }}>{name}</span>
                  <br />
                  <span style={{ color: TEXT }}>{service}</span>
                </h3>
                <p className="text-[14.5px] text-gray-600 leading-[1.8] mb-5 whitespace-pre-line">{description}</p>

                <a href="#features"
                  className="inline-flex items-center gap-2 border border-gray-300 rounded-full px-6 py-2.5 text-[14px] font-bold text-gray-700 hover:border-amber-400 hover:text-amber-700 transition-colors mb-7">
                  詳しく見る
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: GREEN }}>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "#2A221A" }} />
                  </div>
                </a>

                {stat.before ? (
                  <div className="mb-7 bg-gray-50 rounded-xl px-4 pt-3 pb-4 border border-gray-100">
                    <div className="flex flex-col gap-2 mb-3">
                      <StatBar label="導入前" value={stat.before} color="#d1d5db" width="100%" />
                      <StatBar label="導入後" value={stat.after}  color={GREEN}    width="25%"  />
                    </div>
                    <p className="text-[16px] font-black" style={{ color: TEXT }}>{stat.label}</p>
                  </div>
                ) : (
                  <div className="mb-7 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                    <p className="text-[16px] font-black" style={{ color: TEXT }}>{stat.label}</p>
                  </div>
                )}

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="divide-y divide-gray-100">
                      {features.slice(0, 3).map((f) => <FeatureRow key={f.label} {...f} />)}
                    </div>
                    <div className="divide-y divide-gray-100">
                      {features.slice(3).map((f) => <FeatureRow key={f.label} {...f} />)}
                    </div>
                  </div>
                  <div className="border-t border-gray-100">
                    <a href="#features"
                      className="flex items-center justify-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <span className="text-[13px] font-bold" style={{ color: GREEN }}>もっと見る</span>
                      <ChevronRight className="w-4 h-4" style={{ color: GREEN }} />
                    </a>
                  </div>
                </div>
              </div>

              {/* 右：UIモックアップ */}
              <div className="w-full lg:flex-1">
                <Mockup />
              </div>

            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
