import { useState, useEffect, useRef, createContext, useContext, useCallback } from "react";
import liff from "@line/liff";
import { usePageMeta } from "@/hooks/use-page-meta";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  CheckCircle2, ClipboardList, Clock, User, Home,
  MessageSquare, HelpCircle, CalendarPlus, Eye, EyeOff,
} from "lucide-react";

// ── Clinic Color System ────────────────────────────────────────────────────────

interface ClinicColors { primary: string; light: string; border: string; header: string; }

const DEFAULT_COLORS: ClinicColors = {
  primary: "#C4B5A0",
  light: "#F5F1ED",
  border: "#E8E1D9",
  header: "#C8BAA8",
};

function hexToHsl(hex: string): [number, number, number] | null {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function computeClinicColors(primaryColor?: string | null): ClinicColors {
  if (!primaryColor || !primaryColor.startsWith("#") || primaryColor.length < 7) return DEFAULT_COLORS;
  const hsl = hexToHsl(primaryColor);
  if (!hsl) return DEFAULT_COLORS;
  const [h, s, l] = hsl;
  return {
    primary: primaryColor,
    light: `hsl(${h}, ${Math.max(s - 5, 20)}%, ${Math.min(l + 28, 96)}%)`,
    border: `hsl(${h}, ${Math.max(s - 5, 20)}%, ${Math.min(l + 16, 90)}%)`,
    header: `hsl(${h}, ${Math.max(s - 5, 20)}%, ${Math.max(l - 30, 22)}%)`,
  };
}

const ClinicColorContext = createContext<ClinicColors>(DEFAULT_COLORS);
function useClinicColors() { return useContext(ClinicColorContext); }

const DAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

function toYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function formatDateJP(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${DAY_JP[date.getDay()]}）`;
}
function generateTimeSlots(openTime: string, closeTime: string, intervalMins = 10): string[] {
  const slots: string[] = [];
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  let cur = oh * 60 + om;
  const end = ch * 60 + cm;
  while (cur < end) {
    slots.push(`${Math.floor(cur / 60).toString().padStart(2, "0")}:${(cur % 60).toString().padStart(2, "0")}`);
    cur += intervalMins;
  }
  return slots;
}

interface ClinicInfo {
  clinic: { id?: string; name: string; phone?: string; address?: string };
  hours: { dayOfWeek: number; openTime?: string; closeTime?: string; afternoonOpenTime?: string; afternoonCloseTime?: string; isClosed: boolean }[];
  holidays: { date: string; startTime?: string | null; endTime?: string | null }[];
  services: { id: string; name: string; description?: string; duration: number; price?: number; isActive: boolean }[];
  staff: { id: string; name: string; role: string }[];
  primaryColor?: string | null;
  slotIntervalMinutes?: number;
  bookingAdvanceDays?: number;
  bookingBufferMinutes?: number;
}
interface SlotInfo { available: boolean; slots: string[]; bookedSlots?: string[] }
interface PatientSession { loggedIn: boolean; patient?: { id: string; name: string; phone: string } }
interface SelectedService { id: string | null; name: string; duration: number; price?: number; description?: string }

type View = "top" | "auth" | "register" | "reset-password" | "service" | "datetime" | "confirm" | "success";

// ── Shared Layout Shell ───────────────────────────────────────────────────────

function PageShell({
  clinicName,
  patientName,
  loggedIn,
  onLoginClick,
  onLogout,
  currentView,
  onNavClick,
  children,
}: {
  clinicName: string;
  patientName: string;
  loggedIn: boolean;
  onLoginClick: () => void;
  onLogout: () => void;
  currentView: View;
  onNavClick: (v: View) => void;
  children: React.ReactNode;
}) {
  const { primary, light, border, header } = useClinicColors();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const sideNavItems = loggedIn
    ? [
        { icon: Home, label: "トップ", view: "top" as View },
        { icon: CalendarPlus, label: "新規予約", view: "service" as View },
        { icon: MessageSquare, label: "お問い合わせ", view: null },
        { icon: HelpCircle, label: "ヘルプ", view: null },
      ]
    : [
        { icon: Home, label: "トップ", view: "top" as View },
        { icon: CalendarPlus, label: "新規予約", view: "auth" as View },
        { icon: MessageSquare, label: "お問い合わせ", view: null },
        { icon: HelpCircle, label: "ヘルプ", view: null },
      ];

  const isActiveNav = (v: View | null) => {
    if (v === "top") return currentView === "top";
    if (v === "service" || v === "auth") return ["service", "datetime", "confirm", "auth", "register"].includes(currentView);
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F9F7F5" }}>
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-4 md:px-6 h-12 shrink-0"
        style={{ backgroundColor: header }}
      >
        <button
          onClick={() => onNavClick("top")}
          className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          data-testid="button-go-home"
        >
          <div
            className="w-7 h-7 rounded-full border-2 border-white/40 flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(255,255,255,0.25)" }}
          >
            <span className="text-white text-[10px] font-bold">歯</span>
          </div>
          <span className="text-white font-medium text-sm">{clinicName}</span>
        </button>

        {loggedIn ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex items-center gap-1.5 text-white hover:text-white/80 transition-colors"
              data-testid="button-user-menu"
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "rgba(255,255,255,0.25)", border: "1.5px solid rgba(255,255,255,0.5)" }}
              >
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium">{patientName}</span>
            </button>

            {showUserMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                {/* Dropdown */}
                <div
                  className="absolute right-0 top-full mt-2 w-40 rounded-lg shadow-lg border z-20 overflow-hidden"
                  style={{ backgroundColor: "white", borderColor: border }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: border }}>
                    <p className="text-xs text-gray-400">ログイン中</p>
                    <p className="text-sm font-medium text-gray-700 mt-0.5 truncate">{patientName}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); onLogout(); }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
                    data-testid="button-logout"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    ログアウト
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="text-white text-sm hover:text-white/80 transition-colors"
            data-testid="button-header-login"
          >
            ログイン
          </button>
        )}
      </header>

      {/* ─── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside
          className="w-44 shrink-0 border-r hidden md:block"
          style={{ backgroundColor: light, borderColor: border }}
        >
          <nav className="py-2">
            {sideNavItems.map((item) => (
              <button
                key={item.label}
                onClick={() => item.view ? onNavClick(item.view) : undefined}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors"
                style={{
                  color: isActiveNav(item.view) ? "#3D3530" : "#7A6F68",
                  fontWeight: isActiveNav(item.view) ? 600 : 400,
                  backgroundColor: isActiveNav(item.view) ? border : "transparent",
                }}
              >
                <item.icon className="w-4 h-4 shrink-0" style={{ color: isActiveNav(item.view) ? primary : "#A89B94" }} />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>

      {/* ─── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t py-4 text-center" style={{ borderColor: border, backgroundColor: "white" }}>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400 mb-1">
          <span className="hover:text-gray-600 cursor-pointer transition-colors">利用規約</span>
          <span className="hover:text-gray-600 cursor-pointer transition-colors">プライバシーポリシー</span>
          <span className="hover:text-gray-600 cursor-pointer transition-colors">外部送信ポリシー</span>
        </div>
        <p className="text-xs text-gray-300">Arche 予約システム</p>
      </footer>
    </div>
  );
}

// ── Top Page (landing) ────────────────────────────────────────────────────────

function TopPage({ onBookClick, loggedIn }: { onBookClick: () => void; loggedIn: boolean }) {
  const { primary, border } = useClinicColors();
  const menuItems = [
    { icon: CalendarPlus, label: "新規予約", action: onBookClick },
    { icon: MessageSquare, label: "お問い合わせ" },
    { icon: HelpCircle, label: "ヘルプ" },
  ];

  return (
    <div className="flex flex-col items-center pt-12 pb-8 px-4">
      {/* 予約する button */}
      <button
        onClick={onBookClick}
        className="w-full max-w-xs py-4 rounded-full text-white font-medium text-base shadow-sm transition-opacity hover:opacity-90 mb-12"
        style={{ backgroundColor: primary }}
        data-testid="button-book-top"
      >
        予約する
      </button>

      {/* マイページメニュー */}
      <div className="w-full max-w-lg">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">マイページメニュー</h2>
          <div className="h-px" style={{ backgroundColor: border }} />
        </div>
        <div className="space-y-0 rounded-lg overflow-hidden border" style={{ borderColor: border }}>
          {menuItems.map((item, i) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 transition-colors text-sm text-gray-700 border-b last:border-0"
              style={{ borderColor: border }}
              data-testid={`menu-${i}`}
            >
              <span className="flex items-center gap-3">
                <item.icon className="w-4 h-4" style={{ color: primary }} />
                {item.label}
              </span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Auth: Login ───────────────────────────────────────────────────────────────

function LoginPage({
  clinicInfo,
  onSuccess,
  onRegister,
  onResetPassword,
  isDemo,
}: {
  clinicInfo?: ClinicInfo;
  onSuccess: (name: string, phone: string) => void;
  onRegister: () => void;
  onResetPassword: () => void;
  isDemo?: boolean;
}) {
  const { primary, border } = useClinicColors();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const guestDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/demo/booking-guest", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("デモの開始に失敗しました");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/patient/me"] });
      onSuccess(data.patient.name, data.patient.phone ?? "");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/patient/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, password, clinicId: clinicInfo?.clinic.id }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/patient/me"] });
      onSuccess(data.patient.name, data.patient.phone ?? "");
      toast({ title: `${data.patient.name}様、おかえりなさい` });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col items-center pt-10 px-4 pb-8">
      <div className="w-full max-w-md">
        <h2 className="text-base font-semibold text-gray-800 mb-3">ログイン</h2>
        <div className="h-px mb-5" style={{ backgroundColor: border }} />

        <div className="space-y-3 mb-6">
          <div>
            <Input
              type="tel"
              placeholder="電話番号"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
              data-testid="input-login-phone"
            />
          </div>
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              placeholder="パスワード"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm pr-10"
              data-testid="input-login-password"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          className="w-full py-3.5 rounded-full text-white font-medium text-sm disabled:opacity-40 transition-opacity hover:opacity-90 mb-4"
          style={{ backgroundColor: primary }}
          disabled={!phone || !password || loginMutation.isPending}
          onClick={() => loginMutation.mutate()}
          data-testid="button-login-submit"
        >
          {loginMutation.isPending ? "ログイン中..." : "ログイン"}
        </button>

        <div className="text-center space-y-2">
          <button onClick={onResetPassword} className="text-xs text-gray-400 hover:text-gray-600 transition-colors block mx-auto" data-testid="button-forgot-password">
            パスワードを忘れた方はこちら
          </button>
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px" style={{ backgroundColor: border }} />
            <span className="text-xs text-gray-300">または</span>
            <div className="flex-1 h-px" style={{ backgroundColor: border }} />
          </div>
          <button
            onClick={onRegister}
            className="text-sm hover:opacity-70 transition-opacity"
            style={{ color: primary }}
            data-testid="button-go-register"
          >
            新規登録はこちら
          </button>
          {isDemo && (
            <>
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px" style={{ backgroundColor: border }} />
                <span className="text-xs text-gray-300">デモ体験</span>
                <div className="flex-1 h-px" style={{ backgroundColor: border }} />
              </div>
              <button
                onClick={() => guestDemoMutation.mutate()}
                disabled={guestDemoMutation.isPending}
                className="w-full py-3 rounded-full border text-sm font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
                style={{ borderColor: border, color: "#6b7280" }}
                data-testid="button-demo-guest"
              >
                {guestDemoMutation.isPending ? "準備中..." : "ログインなしでデモを体験する"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Auth: Register ────────────────────────────────────────────────────────────

function RegisterPage({
  clinicInfo,
  onSuccess,
  onLogin,
}: {
  clinicInfo?: ClinicInfo;
  onSuccess: (name: string, phone: string) => void;
  onLogin: () => void;
}) {
  const { primary, border } = useClinicColors();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [nameKana, setNameKana] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const kanaReadingRef = useRef<string>("");

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (password !== confirmPassword) throw new Error("パスワードが一致しません");
      if (password.length < 8) throw new Error("パスワードは8文字以上で設定してください");
      if (!/[a-zA-Z]/.test(password)) throw new Error("アルファベットを含めてください");
      if (!/[0-9]/.test(password)) throw new Error("数字を含めてください");
      const res = await fetch("/api/patient/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phone, password, name, nameKana, email, clinicId: clinicInfo?.clinic.id }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/patient/me"] });
      onSuccess(data.patient.name, data.patient.phone ?? "");
      toast({ title: "アカウントを作成しました" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col items-center pt-10 px-4 pb-8">
      <div className="w-full max-w-md">
        <h2 className="text-base font-semibold text-gray-800 mb-3">新規登録</h2>
        <div className="h-px mb-5" style={{ backgroundColor: border }} />

        <div className="space-y-3 mb-6">
          <div>
            <Input
              type="text"
              placeholder="お名前（山田 太郎）"
              value={name}
              onChange={e => setName(e.target.value)}
              onCompositionUpdate={e => {
                if (/^[\u3041-\u3096\u30a1-\u30f6ー\s　]+$/.test(e.data)) kanaReadingRef.current = e.data;
              }}
              onCompositionEnd={() => {
                const r = kanaReadingRef.current;
                if (r) {
                  const k = r.trim().replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
                  setNameKana(prev => prev.trim() ? prev.trim() + "　" + k : k);
                  kanaReadingRef.current = "";
                }
              }}
              className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
              data-testid="input-register-name"
            />
          </div>
          <div>
            <Input
              type="text"
              placeholder="フリガナ（ヤマダ タロウ）"
              value={nameKana}
              onChange={e => setNameKana(e.target.value)}
              className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
              data-testid="input-register-name-kana"
            />
          </div>
          {[
            { label: "電話番号", value: phone, setter: setPhone, type: "tel", placeholder: "電話番号（090-1234-5678）", testId: "input-register-phone" },
            { label: "メールアドレス", value: email, setter: setEmail, type: "email", placeholder: "メールアドレス（example@email.com）", testId: "input-register-email" },
          ].map(field => (
            <div key={field.label}>
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={field.value}
                onChange={e => field.setter(e.target.value)}
                className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
                data-testid={field.testId}
              />
            </div>
          ))}
          <div className="relative">
            <Input
              type={showPw ? "text" : "password"}
              placeholder="パスワード（英数字8文字以上）"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm pr-10"
              data-testid="input-register-password"
            />
            <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Input
            type="password"
            placeholder="パスワード（確認）"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
            data-testid="input-register-confirm"
          />
        </div>

        <button
          className="w-full py-3.5 rounded-full text-white font-medium text-sm disabled:opacity-40 transition-opacity hover:opacity-90 mb-4"
          style={{ backgroundColor: primary }}
          disabled={!name || !phone || !email || !password || !confirmPassword || registerMutation.isPending}
          onClick={() => registerMutation.mutate()}
          data-testid="button-register-submit"
        >
          {registerMutation.isPending ? "登録中..." : "アカウントを作成する"}
        </button>

        <div className="text-center">
          <button onClick={onLogin} className="text-xs text-gray-400 hover:text-gray-600 transition-colors" data-testid="button-go-login">
            すでにアカウントをお持ちの方はこちら
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Auth: Reset Password ──────────────────────────────────────────────────────

function ResetPasswordPage({
  clinicInfo,
  onLogin,
}: {
  clinicInfo?: ClinicInfo;
  onLogin: () => void;
}) {
  const { primary, border } = useClinicColors();
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("パスワードが一致しません");
      if (newPassword.length < 8) throw new Error("パスワードは8文字以上で設定してください");
      if (!/[a-zA-Z]/.test(newPassword)) throw new Error("アルファベットを含めてください");
      if (!/[0-9]/.test(newPassword)) throw new Error("数字を含めてください");
      const res = await fetch("/api/patient/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name, newPassword, clinicId: clinicInfo?.clinic.id }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      setDone(true);
      toast({ title: "パスワードを変更しました。新しいパスワードでログインしてください。" });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col items-center pt-10 px-4 pb-8">
      <div className="w-full max-w-md">
        <h2 className="text-base font-semibold text-gray-800 mb-3">パスワードの再設定</h2>
        <div className="h-px mb-5" style={{ backgroundColor: border }} />

        {done ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-gray-600">パスワードを変更しました。</p>
            <button
              onClick={onLogin}
              className="w-full py-3.5 rounded-full text-white font-medium text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: primary }}
              data-testid="button-go-login-after-reset"
            >
              ログイン画面へ
            </button>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-5">登録時の電話番号とお名前を入力して、新しいパスワードを設定してください。</p>
            <div className="space-y-3 mb-6">
              <Input
                type="tel"
                placeholder="電話番号"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
                data-testid="input-reset-phone"
              />
              <Input
                type="text"
                placeholder="お名前（登録時と同じ）"
                value={name}
                onChange={e => setName(e.target.value)}
                className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
                data-testid="input-reset-name"
              />
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  placeholder="新しいパスワード（英数字8文字以上）"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm pr-10"
                  data-testid="input-reset-new-password"
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Input
                type="password"
                placeholder="新しいパスワード（確認）"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white rounded-lg h-12 text-sm"
                data-testid="input-reset-confirm"
              />
            </div>
            <button
              className="w-full py-3.5 rounded-full text-white font-medium text-sm disabled:opacity-40 transition-opacity hover:opacity-90 mb-4"
              style={{ backgroundColor: primary }}
              disabled={!phone || !name || !newPassword || !confirmPassword || resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
              data-testid="button-reset-submit"
            >
              {resetMutation.isPending ? "変更中..." : "パスワードを変更する"}
            </button>
            <div className="text-center">
              <button onClick={onLogin} className="text-xs text-gray-400 hover:text-gray-600 transition-colors" data-testid="button-back-to-login">
                ログインに戻る
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Step: Service Selection ───────────────────────────────────────────────────

function ServiceSelectStep({
  services,
  onSelect,
}: {
  services: ClinicInfo["services"];
  onSelect: (s: SelectedService) => void;
}) {
  const { primary, border } = useClinicColors();
  const [expanded, setExpanded] = useState<string | null>(null);

  const fallbackServices: SelectedService[] = [
    { id: null, name: "定期検診・クリーニング", duration: 30, description: "歯のクリーニングと定期チェック" },
    { id: null, name: "むし歯治療", duration: 45, description: "虫歯の診断と治療" },
    { id: null, name: "ホワイトニング", duration: 60, description: "歯の白さを取り戻す施術" },
    { id: null, name: "矯正相談", duration: 30, description: "歯並びの相談・矯正治療の説明" },
    { id: null, name: "歯周病治療", duration: 45, description: "歯周病の診断と治療" },
    { id: null, name: "その他", duration: 30, description: "上記以外の治療・相談" },
  ];

  const displayServices: SelectedService[] = services && services.length > 0
    ? services.filter(s => s.isActive).map(s => ({ id: s.id, name: s.name, duration: s.duration, price: s.price, description: s.description }))
    : fallbackServices;

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">予約メニュー選択</h2>
      <div className="w-10 h-0.5 mb-4" style={{ backgroundColor: primary }} />

      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 flex gap-2">
        <span className="shrink-0 mt-0.5">ℹ</span>
        <span>診療内容をお選びください。複数選択はできません。</span>
      </div>

      <p className="text-xs text-gray-400 mb-3">※メニューを選択してください。</p>

      <div className="border rounded-lg overflow-hidden" style={{ borderColor: border }}>
        {displayServices.map((svc, i) => {
          const key = svc.id ?? svc.name;
          const isOpen = expanded === key;
          return (
            <div key={key} className="border-b last:border-0 bg-white" style={{ borderColor: border }}>
              <button
                className="w-full flex items-center justify-between px-4 py-4 text-sm text-left hover:bg-gray-50/60 transition-colors"
                onClick={() => setExpanded(isOpen ? null : key)}
                data-testid={`service-item-${i}`}
              >
                <span className="font-medium text-gray-700">{svc.name}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-300 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-4 pb-4 bg-gray-50/40 border-t" style={{ borderColor: border }}>
                  {svc.description && <p className="text-xs text-gray-500 mb-2 pt-3">{svc.description}</p>}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />所要時間 約{svc.duration}分
                    </span>
                    {svc.price != null && svc.price > 0 && (
                      <span className="text-xs text-gray-400">{svc.price.toLocaleString()}円（税込）</span>
                    )}
                  </div>
                  <button
                    className="w-full py-2.5 rounded-full text-white text-sm font-medium transition-opacity hover:opacity-90"
                    style={{ backgroundColor: primary }}
                    onClick={() => onSelect(svc)}
                    data-testid={`button-select-service-${i}`}
                  >
                    このメニューを選択する
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step: Date/Time Grid ──────────────────────────────────────────────────────

function DateTimeGridStep({
  apiBase,
  info,
  selectedService,
  onSelect,
  onChangeMenu,
}: {
  apiBase: string;
  info: ClinicInfo;
  selectedService: SelectedService;
  onSelect: (date: Date, time: string) => void;
  onChangeMenu: () => void;
}) {
  const { primary, light, border } = useClinicColors();
  const [weekOffset, setWeekOffset] = useState(0);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const advanceDays = info.bookingAdvanceDays ?? 60;
  const maxWeekOffset = Math.floor(advanceDays / 7);
  const lastAllowedDate = new Date(today);
  lastAllowedDate.setDate(today.getDate() + advanceDays);

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const dow = d.getDay();
    const isPast = d < today;
    const isBeyondAdvance = d > lastAllowedDate;
    const isHoliday = info.holidays.some(h => h.date === toYMD(d) && !h.startTime);
    const dayHours = info.hours.find(h => h.dayOfWeek === dow);
    const isClosed = isPast || isBeyondAdvance || isHoliday || !dayHours || dayHours.isClosed;
    return { date: d, isClosed, dow };
  });

  const openTimes = info.hours.filter(h => !h.isClosed && h.openTime).map(h => h.openTime!);
  const closeTimes = info.hours
    .filter(h => !h.isClosed)
    .flatMap(h => [h.afternoonCloseTime || h.closeTime].filter(Boolean) as string[]);
  const minOpen = openTimes.sort()[0] ?? "09:00";
  const maxClose = closeTimes.sort().reverse()[0] ?? "18:00";
  const allTimeSlots = generateTimeSlots(minOpen, maxClose, info.slotIntervalMinutes || 10);

  const slotQueries = useQueries({
    queries: weekDays.map(({ date, isClosed }) => ({
      queryKey: [apiBase + "/slots", toYMD(date)],
      queryFn: async (): Promise<SlotInfo> => {
        if (isClosed) return { available: false, slots: [] };
        const res = await fetch(`${apiBase}/slots?date=${toYMD(date)}`);
        return res.json();
      },
      staleTime: 60 * 1000,
      enabled: !isClosed,
    })),
  });

  const weekLabel = `${weekDays[0]?.date.getFullYear()}年${weekDays[0]?.date.getMonth() + 1}月${weekDays[0]?.date.getDate()}日（${DAY_JP[weekDays[0]?.dow]}）`;

  return (
    <div className="px-4 md:px-8 py-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">予約日時選択</h2>
      <div className="w-10 h-0.5 mb-4" style={{ backgroundColor: primary }} />

      <div className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 flex gap-2">
        <span className="shrink-0 mt-0.5">ℹ</span>
        <span>次ページで入力いただく情報は、お手続きが中断された際のご案内や、予約完了に向けたサポートを目的として利用させていただく場合がございます。あらかじめご了承の上、次ページへお進みください。</span>
      </div>

      {/* Selected service summary */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 mb-1.5">
          選択中のメニュー
          <span className="ml-3">所要時間目安 {selectedService.duration}分</span>
        </p>
        <div className="border rounded-lg p-3.5 bg-white" style={{ borderColor: border }}>
          <p className="text-sm font-semibold text-gray-800">{selectedService.name}</p>
          {selectedService.description && <p className="text-xs text-gray-400 mt-1">{selectedService.description}</p>}
          {selectedService.price != null && selectedService.price > 0 && (
            <p className="text-right text-xs text-gray-400 mt-1">{selectedService.price.toLocaleString()}円（税込）</p>
          )}
        </div>
        <button onClick={onChangeMenu} className="text-xs mt-1.5 hover:opacity-70 transition-opacity" style={{ color: primary }}>
          メニューを追加・変更する
        </button>
      </div>

      {/* Week nav */}
      <div className="flex items-center justify-between mb-1">
        <button
          onClick={() => setWeekOffset(o => Math.max(0, o - 1))}
          disabled={weekOffset === 0}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
          data-testid="button-prev-week"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm text-gray-700">{weekLabel}</span>
        <button
          onClick={() => setWeekOffset(o => Math.min(maxWeekOffset, o + 1))}
          disabled={weekOffset >= maxWeekOffset}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
          data-testid="button-next-week"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
      <p className="text-right text-xs text-gray-400 mb-2">※日本時間</p>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-gray-300">
        <table className="w-full text-xs border-collapse min-w-[480px]">
          <thead>
            <tr style={{ backgroundColor: light }}>
              <th className="border-r border-b border-gray-300 py-2 px-2 font-medium w-14 text-center">
                <span className="text-[10px] text-gray-500 leading-tight block">
                  {weekDays[0]?.date.getFullYear()}年<br />
                  {weekDays[0]?.date.getMonth() + 1}月
                </span>
              </th>
              {weekDays.map(({ date, dow, isClosed }) => (
                <th key={toYMD(date)}
                  className="border-r border-b border-gray-300 py-2 px-1 text-center font-bold last:border-r-0"
                  style={{ color: isClosed ? "#9CA3AF" : dow === 0 ? "#DC2626" : dow === 6 ? "#2563EB" : "#111827" }}>
                  {date.getDate()}<br />
                  <span className="font-normal text-[10px]">（{DAY_JP[dow]}）</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allTimeSlots.map((time) => {
              const isHour = time.endsWith(":00");
              return (
                <tr key={time} className={isHour ? "bg-gray-50 hover:bg-gray-100/60" : "bg-white hover:bg-gray-50/60"}
                  style={isHour ? { borderTop: "2px solid #9CA3AF" } : { borderTop: "1px solid #F3F4F6" }}>
                  <td className="border-r border-gray-200 py-1.5 px-2 text-center w-14 select-none">
                    {isHour
                      ? <span className="text-gray-800 font-bold text-xs">{time}</span>
                      : <span className="text-gray-400 text-[10px]">{time}</span>
                    }
                  </td>
                  {weekDays.map(({ date, isClosed }, di) => {
                    const q = slotQueries[di];
                    const isLoading = q.isLoading && !isClosed;
                    const slotData = q.data;
                    const isAvail = !isClosed && slotData && slotData.slots.some(s => s.slice(0, 5) === time);
                    const cellKey = `${toYMD(date)}-${time}`;
                    return (
                      <td key={toYMD(date)} className="border-r border-gray-200 py-1 px-1 text-center last:border-r-0"
                        style={isClosed ? { backgroundColor: "#F9FAFB" } : {}}>
                        {isClosed ? (
                          <span className="text-gray-200 text-xs select-none">—</span>
                        ) : isLoading ? (
                          <span className="block w-4 h-1.5 rounded bg-gray-200 animate-pulse mx-auto" />
                        ) : isAvail ? (
                          <button
                            onClick={() => onSelect(date, time)}
                            onMouseEnter={() => setHoveredCell(cellKey)}
                            onMouseLeave={() => setHoveredCell(null)}
                            className="w-full h-7 flex items-center justify-center rounded-md transition-all text-sm font-medium active:scale-90 active:opacity-70"
                            style={{
                              color: hoveredCell === cellKey ? "white" : "#111827",
                              backgroundColor: hoveredCell === cellKey ? primary : `${primary}1A`,
                              border: `1px solid ${primary}40`,
                            }}
                            data-testid={`slot-${toYMD(date)}-${time}`}
                          >
                            ○
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs select-none">×</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Step: Confirm ─────────────────────────────────────────────────────────────

function ConfirmStep({
  clinicName, patientName, selectedService, selectedDate, selectedTime,
  notes, onNotesChange, onBack, onSubmit, isPending,
}: {
  clinicName: string; patientName: string; selectedService: SelectedService;
  selectedDate: Date; selectedTime: string; notes: string;
  onNotesChange: (v: string) => void; onBack: () => void;
  onSubmit: () => void; isPending: boolean;
}) {
  const { primary, border } = useClinicColors();
  const [termsAgreed, setTermsAgreed] = useState(false);

  return (
    <div className="px-4 md:px-8 py-6 max-w-2xl">
      <div className="bg-[#FFF9F0] border border-[#F0E0B0] rounded-lg px-4 py-2.5 text-sm text-[#9A7A10] font-medium mb-5">
        まだ予約は完了していません。
      </div>

      {/* Booking summary */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">予約内容</h3>
          <button onClick={onBack} className="text-xs hover:opacity-70 transition-opacity" style={{ color: primary }}>修正する</button>
        </div>
        <div className="border rounded-lg p-4 bg-white space-y-3" style={{ borderColor: border }}>
          <p className="text-xs text-gray-400">{clinicName}</p>
          <div>
            <p className="text-xs text-gray-400 mb-1">予約メニュー</p>
            <div className="border rounded p-3" style={{ borderColor: border, backgroundColor: "#FAFAF9" }}>
              <p className="text-sm font-medium text-gray-800">{selectedService.name}</p>
              {selectedService.price != null && selectedService.price > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  通常支払価格: {selectedService.price.toLocaleString()}円（税込）
                </p>
              )}
            </div>
            {selectedService.price != null && selectedService.price > 0 && (
              <p className="text-right text-xs text-gray-400 mt-1">
                合計金額（通常支払）: {selectedService.price.toLocaleString()}円（税込）
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">予約日時</p>
            <p className="text-sm text-gray-700">{formatDateJP(selectedDate)} {selectedTime}〜（約{selectedService.duration}分）</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">合計金額</p>
            <p className="text-sm text-gray-700">
              {selectedService.price != null && selectedService.price > 0
                ? `${selectedService.price.toLocaleString()}円（税込）`
                : "院内でご確認ください"}
            </p>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            ※マイページからの予約変更は予約日時の24時間前まで、予約キャンセルは48時間前までとなります。
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="mb-5">
        <Label className="text-sm font-semibold text-gray-700 block mb-2">施術にあたってのご要望</Label>
        <Textarea
          value={notes}
          onChange={e => onNotesChange(e.target.value)}
          placeholder="ご要望や気になることがあればご記入ください（任意）"
          rows={4}
          className="resize-none border-[#E8E1D9] focus-visible:ring-[#C4B5A0]/30 focus-visible:border-[#C4B5A0] bg-white text-sm rounded-lg"
          data-testid="input-notes"
        />
      </div>

      {/* Cancellation policy */}
      <div className="border rounded-lg p-4 mb-5 text-xs text-gray-500 space-y-1.5 bg-[#FAFAF9]" style={{ borderColor: border }}>
        <p className="font-medium text-gray-600 mb-2">注意事項</p>
        <p>【予約変更】</p>
        <p>・24時間前まで：マイページから変更可能（無料）</p>
        <p>・24時間前以降：変更をご希望の場合はお電話ください。</p>
        <p>【キャンセル】</p>
        <p>・48時間前まで：マイページからキャンセル可能（無料）</p>
        <p>・48時間前以降：キャンセルをご希望の場合はお電話ください。</p>
        <p>【遅刻】</p>
        <p>・10分以上遅れた場合は診察ができない場合があります。</p>
        <p>・遅刻時は必ずお電話ください。</p>
      </div>

      {/* Terms checkbox */}
      <div className="flex items-start gap-3 mb-5">
        <Checkbox
          id="terms"
          checked={termsAgreed}
          onCheckedChange={v => setTermsAgreed(v === true)}
          className="mt-0.5"
          data-testid="checkbox-terms"
          style={{ borderColor: primary }}
        />
        <label htmlFor="terms" className="text-xs text-gray-500 cursor-pointer leading-relaxed">
          上記の【予約変更】【キャンセル】【遅刻】について必ずお読みください。確認した方はチェックを入れてください。
        </label>
      </div>

      {/* Submit */}
      <button
        className="w-full py-3.5 rounded-full text-white font-medium text-sm disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{ backgroundColor: primary }}
        disabled={!termsAgreed || isPending}
        onClick={onSubmit}
        data-testid="button-confirm-booking"
      >
        {isPending ? "予約中..." : "予約を確定する"}
      </button>
      <button onClick={onBack} className="w-full text-center text-xs mt-3 hover:opacity-70 transition-opacity block" style={{ color: primary }}>
        修正する
      </button>
    </div>
  );
}

// ── Step: Success ─────────────────────────────────────────────────────────────

function SuccessStep({
  clinicName, patientName, selectedService, selectedDate, selectedTime,
  bookedAppointment, apiBase, onNewBooking,
}: {
  clinicName: string; patientName: string; selectedService: SelectedService;
  selectedDate: Date; selectedTime: string; bookedAppointment: any;
  apiBase: string; onNewBooking: () => void;
}) {
  const { primary, light, border } = useClinicColors();
  const { toast } = useToast();
  const [showQ, setShowQ] = useState(false);
  const [qSent, setQSent] = useState(false);
  const [qChief, setQChief] = useState("");

  const questionnaireMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(apiBase + "/questionnaire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId: bookedAppointment?.appointment?.id || null, patientName, chiefComplaint: qChief || null }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => { setQSent(true); toast({ title: "問診票を送信しました" }); },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const isApprovalRequired = !!bookedAppointment?.requireApproval;

  return (
    <div className="px-4 md:px-8 py-6 max-w-md">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: light }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: primary }} />
        </div>
        {isApprovalRequired ? (
          <>
            <h2 className="text-lg font-semibold text-gray-800">仮予約を受け付けました</h2>
            <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">クリニックが予約を確認後、確定のご連絡をいたします。<br />しばらくお待ちください。</p>
          </>
        ) : (
          <h2 className="text-lg font-semibold text-gray-800">ご予約が完了しました</h2>
        )}
        <p className="text-xs text-gray-400 mt-1">予約番号: {bookedAppointment?.appointment?.id?.slice(0, 8).toUpperCase()}</p>
      </div>

      <div className="border rounded-lg p-4 mb-5 bg-white space-y-2.5" style={{ borderColor: border }}>
        <p className="text-xs text-gray-400 font-medium">{clinicName}</p>
        {[
          { label: "診療内容", value: selectedService.name },
          { label: "予約日時", value: `${formatDateJP(selectedDate)} ${selectedTime}〜` },
          { label: "お名前", value: `${patientName} 様` },
        ].map(row => (
          <div key={row.label} className="flex justify-between text-sm">
            <span className="text-gray-400">{row.label}</span>
            <span className="font-medium text-gray-700">{row.value}</span>
          </div>
        ))}
      </div>

      {qSent ? (
        <div className="flex items-center gap-2 p-3 rounded-lg text-sm text-green-700 mb-4" style={{ backgroundColor: "#F0FDF4", border: "1px solid #BBF7D0" }} data-testid="questionnaire-sent">
          <CheckCircle2 className="w-4 h-4 shrink-0" />問診票を送信しました。
        </div>
      ) : !showQ ? (
        <button className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border text-sm text-gray-600 mb-4 hover:bg-gray-50 transition-colors bg-white" style={{ borderColor: border }} onClick={() => setShowQ(true)} data-testid="button-open-questionnaire">
          <ClipboardList className="w-4 h-4" style={{ color: primary }} />問診票を事前に記入する（任意）
        </button>
      ) : (
        <div className="border rounded-lg p-4 mb-4 bg-white space-y-3" style={{ borderColor: border }}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700 flex items-center gap-1"><ClipboardList className="w-4 h-4" style={{ color: primary }} />問診票</span>
            <button onClick={() => setShowQ(false)} className="text-xs text-gray-400">閉じる</button>
          </div>
          <div>
            <Label className="text-xs text-gray-500 mb-1 block">主訴（来院の理由）</Label>
            <Textarea value={qChief} onChange={e => setQChief(e.target.value)} placeholder="例: 右上の奥歯が痛い" rows={2} data-testid="input-q-complaint" className="border-[#E8E1D9] text-sm resize-none rounded-lg" />
          </div>
          <div className="flex gap-2">
            <button className="flex-1 py-2 border rounded-full text-xs text-gray-500 hover:bg-gray-50 bg-white" style={{ borderColor: border }} onClick={() => setShowQ(false)}>スキップ</button>
            <button className="flex-1 py-2 rounded-full text-xs text-white disabled:opacity-40" style={{ backgroundColor: primary }} disabled={questionnaireMutation.isPending} onClick={() => questionnaireMutation.mutate()} data-testid="button-submit-questionnaire">
              {questionnaireMutation.isPending ? "送信中..." : "送信する"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Link href="/my-appointments">
          <button className="w-full py-3 rounded-full border text-sm text-gray-600 hover:bg-gray-50 transition-colors bg-white" style={{ borderColor: border }} data-testid="button-my-appointments">
            予約確認・変更はこちら
          </button>
        </Link>
        <button className="w-full py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors" onClick={onNewBooking} data-testid="button-new-booking">
          新しい予約をする
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function BookingPage({ slug }: { slug?: string }) {
  const { toast } = useToast();
  const apiBase = slug ? `/api/public/${slug}` : "/api/public";
  const qc = useQueryClient();

  const [view, setView] = useState<View>("top");
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [selectedService, setSelectedService] = useState<SelectedService | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const [bookedAppointment, setBookedAppointment] = useState<any>(null);
  const [liffLineUserId, setLiffLineUserId] = useState<string | null>(null);

  // ── LIFF initialization ──────────────────────────────────────────────────────
  useEffect(() => {
    const liffId = import.meta.env.VITE_LINE_LIFF_ID;
    if (!liffId) return;
    liff.init({ liffId }).then(() => {
      if (liff.isLoggedIn()) {
        liff.getProfile().then(profile => {
          setLiffLineUserId(profile.userId);
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  // Save LINE User ID after successful booking
  const saveLiffUserId = useCallback(async (lineUserId: string) => {
    if (!slug) return;
    try {
      await fetch(`/api/booking/${slug}/line-user-id`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lineUserId }),
      });
    } catch {}
  }, [slug]);

  const { data: session, isLoading: sessionLoading } = useQuery<PatientSession>({
    queryKey: ["/api/patient/me"],
    queryFn: async () => {
      const res = await fetch("/api/patient/me", { credentials: "include" });
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (session?.loggedIn && session.patient) {
      setPatientName(session.patient.name);
      setPatientPhone(session.patient.phone ?? "");
      if (view === "top" || view === "auth" || view === "register") {
        setView("top");
      }
    }
  }, [session]);

  const { data: info, isLoading: infoLoading } = useQuery<ClinicInfo>({
    queryKey: [apiBase + "/info"],
    queryFn: async () => {
      const res = await fetch(apiBase + "/info");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const clinicName = info?.clinic?.name || "歯科クリニック";
  usePageMeta({
    title: clinicName
      ? `${clinicName} オンライン予約 | Arche`
      : "オンライン予約 | Arche",
    description: clinicName
      ? `${clinicName}のオンライン予約ページです。診療メニュー・希望日時を選んでかんたんにご予約いただけます。Arche（Sourirette合同会社）提供。`
      : "歯科医院のオンライン予約ページ。診療メニュー・希望日時を選んでかんたんにご予約いただけます。",
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/patient/logout", { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient/me"] });
      setPatientName(""); setPatientPhone("");
      setView("top");
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const svc = selectedService!;
      const res = await fetch(apiBase + "/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName, patientPhone,
          date: toYMD(selectedDate!), startTime: selectedTime,
          treatmentType: svc.name, notes: notes || null,
          durationMinutes: svc.duration, serviceId: svc.id || null,
        }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "予約に失敗しました"); }
      return res.json();
    },
    onSuccess: (data) => {
      setBookedAppointment(data);
      setView("success");
      if (liffLineUserId) saveLiffUserId(liffLineUserId);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const loggedIn = !!session?.loggedIn;

  const handleBookClick = () => {
    if (loggedIn) setView("service");
    else setView("auth");
  };

  const handleAuthSuccess = (name: string, phone: string) => {
    setPatientName(name);
    setPatientPhone(phone);
    setView("service");
  };

  const resetBooking = () => {
    setSelectedService(null);
    setSelectedDate(null);
    setSelectedTime("");
    setNotes("");
    setBookedAppointment(null);
    setView("top");
  };

  const handleNavClick = (v: View) => {
    if (v === "service" && !loggedIn) setView("auth");
    else setView(v);
  };

  const colors = computeClinicColors(info?.primaryColor);

  if (sessionLoading || infoLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin border-gray-300" />
      </div>
    );
  }

  return (
    <ClinicColorContext.Provider value={colors}>
    <PageShell
      clinicName={clinicName}
      patientName={patientName}
      loggedIn={loggedIn}
      onLoginClick={() => setView("auth")}
      onLogout={() => logoutMutation.mutate()}
      currentView={view}
      onNavClick={handleNavClick}
    >
      {/* Step progress bar (for booking steps) */}
      {["service", "datetime", "confirm"].includes(view) && (
        <div
          className="flex items-center gap-0 px-6 py-2 border-b text-xs"
          style={{ borderColor: colors.border, backgroundColor: "white" }}
        >
          {[["service", "メニュー選択"], ["datetime", "日時選択"], ["confirm", "予約確定"]].map(([v, label], i) => {
            const views: View[] = ["service", "datetime", "confirm"];
            const idx = views.indexOf(view);
            const isActive = view === v;
            const isDone = idx > i;
            return (
              <div key={v} className="flex items-center">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: isDone || isActive ? colors.primary : colors.border,
                      color: isDone || isActive ? "white" : "#AAA",
                    }}
                  >
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span style={{ color: isActive ? "#2D2D2D" : "#AAA", fontWeight: isActive ? 600 : 400 }}>{label}</span>
                </div>
                {i < 2 && <ChevronRight className="w-3 h-3 text-gray-200 mx-2" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Back button for booking steps */}
      {["datetime", "confirm"].includes(view) && (
        <div className="px-4 md:px-8 pt-4">
          <button
            onClick={() => {
              if (view === "confirm") setView("datetime");
              else if (view === "datetime") setView("service");
            }}
            className="flex items-center gap-1 text-sm hover:opacity-70 transition-opacity"
            style={{ color: colors.primary }}
          >
            <ChevronLeft className="w-4 h-4" />
            戻る
          </button>
        </div>
      )}

      {/* Views */}
      {view === "top" && (
        <TopPage onBookClick={handleBookClick} loggedIn={loggedIn} />
      )}

      {view === "auth" && (
        <LoginPage
          clinicInfo={info}
          onSuccess={handleAuthSuccess}
          onRegister={() => setView("register")}
          onResetPassword={() => setView("reset-password")}
          isDemo={slug === "demo"}
        />
      )}

      {view === "reset-password" && (
        <ResetPasswordPage
          clinicInfo={info}
          onLogin={() => setView("auth")}
        />
      )}

      {view === "register" && (
        <RegisterPage
          clinicInfo={info}
          onSuccess={handleAuthSuccess}
          onLogin={() => setView("auth")}
        />
      )}

      {view === "service" && info && (
        <ServiceSelectStep
          services={info.services}
          onSelect={(svc) => { setSelectedService(svc); setView("datetime"); }}
        />
      )}

      {view === "service" && !info && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: colors.primary }} />
        </div>
      )}

      {view === "datetime" && info && selectedService && (
        <DateTimeGridStep
          apiBase={apiBase}
          info={info}
          selectedService={selectedService}
          onSelect={(date, time) => { setSelectedDate(date); setSelectedTime(time); setView("confirm"); }}
          onChangeMenu={() => setView("service")}
        />
      )}

      {view === "confirm" && selectedService && selectedDate && (
        <ConfirmStep
          clinicName={clinicName}
          patientName={patientName}
          selectedService={selectedService}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          notes={notes}
          onNotesChange={setNotes}
          onBack={() => setView("datetime")}
          onSubmit={() => bookMutation.mutate()}
          isPending={bookMutation.isPending}
        />
      )}

      {view === "success" && selectedService && selectedDate && (
        <SuccessStep
          clinicName={clinicName}
          patientName={patientName}
          selectedService={selectedService}
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          bookedAppointment={bookedAppointment}
          apiBase={apiBase}
          onNewBooking={resetBooking}
        />
      )}
    </PageShell>
    </ClinicColorContext.Provider>
  );
}
