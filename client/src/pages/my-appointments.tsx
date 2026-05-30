import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Calendar, Clock, ChevronLeft, ChevronRight, LogOut,
  Home, CalendarDays, User, Edit2, CalendarClock, Search, LogIn, UserPlus, Phone,
  Ticket, CalendarPlus, FileCheck, FileText, Receipt, CreditCard, MessageSquare,
  HelpCircle, Copy, Check, Users, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const BEIGE = "#C4B5A0";

const DAY_JP = ["日", "月", "火", "水", "木", "金", "土"];

function formatDateJP(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${DAY_JP[d.getDay()]}）`;
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  confirmed:   { label: "確定",       color: "bg-green-100 text-green-800" },
  pending:     { label: "確認中",     color: "bg-amber-100 text-amber-800" },
  cancelled:   { label: "キャンセル", color: "bg-red-100 text-red-800" },
  completed:   { label: "来院済",     color: "bg-blue-100 text-blue-800" },
  no_show:     { label: "無断欠席",   color: "bg-gray-100 text-gray-700" },
};

interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  treatmentType: string;
  status: string;
  notes?: string;
}

interface PatientSession {
  loggedIn: boolean;
  patient?: { id: string; name: string; phone: string; referralCode?: string; referralCount?: number };
}

interface SlotInfo { available: boolean; slots: string[] }

interface ClinicInfo {
  clinic: { id: string; name: string; slug?: string; phone?: string; address?: string; email?: string };
  enableReferral?: boolean;
}

type AuthTab = "lookup" | "login" | "register";
type ActiveView = "top" | "history" | "ticket" | "consent" | "estimate" | "receipt" | "referral" | "payment" | "profile" | "contact" | "help";

interface NavItem {
  id: ActiveView | null;
  label: string;
  icon: React.ElementType;
  href?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "top",      label: "トップ",             icon: Home },
  { id: "history",  label: "予約履歴",           icon: CalendarDays },
  { id: "ticket",   label: "チケット",           icon: Ticket },
  { id: null,       label: "新規予約",           icon: CalendarPlus,    href: "/booking" },
  { id: "consent",  label: "同意書",             icon: FileCheck },
  { id: "estimate", label: "見積書",             icon: FileText },
  { id: "receipt",  label: "領収書",             icon: Receipt },
  { id: "referral", label: "友人紹介",           icon: Users },
  { id: "payment",  label: "クレジットカード情報", icon: CreditCard },
  { id: "profile",  label: "登録情報の確認・変更", icon: User },
  { id: "contact",  label: "お問い合わせ",       icon: MessageSquare },
  { id: "help",     label: "ヘルプ",             icon: HelpCircle },
];

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-full mb-4 flex items-center justify-center" style={{ backgroundColor: `${BEIGE}20` }}>
        <Icon className="w-6 h-6" style={{ color: BEIGE }} />
      </div>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {sub && <p className="text-xs text-gray-400 mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}

function SectionHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <button onClick={onBack} className="text-gray-400 hover:text-gray-600 md:hidden">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <h2 className="text-base font-medium text-gray-800">{title}</h2>
    </div>
  );
}

const FAQ_ITEMS = [
  { q: "予約のキャンセルはいつまで可能ですか？", a: "予約日の前日まで本システムよりキャンセル可能です。当日のキャンセルはお電話にてご連絡ください。" },
  { q: "予約変更はできますか？", a: "「予約履歴」から日時を変更することができます。空き状況によっては希望の日時に変更できない場合があります。" },
  { q: "初診の場合は何を持参すればよいですか？", a: "健康保険証をお持ちください。お薬を服用中の方はお薬手帳もご持参ください。" },
  { q: "診療時間を教えてください。", a: "各クリニックの診療時間はトップページよりご確認ください。祝日や年末年始は変更になる場合があります。" },
  { q: "問診票はいつ記入しますか？", a: "初診時は来院後に記入していただきます。事前に問診票をご提出いただくことも可能です。" },
];

export default function MyAppointmentsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [phone, setPhone] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [authTab, setAuthTab] = useState<AuthTab>("login");
  const [authPhone, setAuthPhone] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [authName, setAuthName] = useState("");
  const [authNameKana, setAuthNameKana] = useState("");
  const kanaReadingRef = useRef<string>("");
  const [authConfirmPassword, setAuthConfirmPassword] = useState("");
  const [authEmail, setAuthEmail] = useState("");

  const [activeView, setActiveView] = useState<ActiveView>("top");
  const [copiedLink, setCopiedLink] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileDob, setProfileDob] = useState("");

  const [showReset, setShowReset] = useState(false);
  const [resetPhone, setResetPhone] = useState("");
  const [resetName, setResetName] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetDone, setResetDone] = useState(false);

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const { data: session, isLoading: sessionLoading } = useQuery<PatientSession>({
    queryKey: ["/api/patient/me"],
    queryFn: async () => {
      const res = await fetch("/api/patient/me", { credentials: "include" });
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  const { data: sessionAppointments, isLoading: sessionApptLoading, refetch: refetchSession } = useQuery<Appointment[]>({
    queryKey: ["/api/patient/appointments"],
    queryFn: async () => {
      const res = await fetch("/api/patient/appointments", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: session?.loggedIn === true,
  });

  const { data: phoneAppointments, isLoading: phoneApptLoading, refetch: refetchPhone } = useQuery<Appointment[]>({
    queryKey: ["/api/public/my-appointments", searchPhone],
    queryFn: async () => {
      if (!searchPhone) return [];
      const res = await fetch(`/api/public/my-appointments?phone=${encodeURIComponent(searchPhone)}`);
      return res.json();
    },
    enabled: !!searchPhone && !session?.loggedIn,
  });

  const { data: clinicInfo } = useQuery<ClinicInfo>({
    queryKey: ["/api/public/info"],
    queryFn: async () => {
      const res = await fetch("/api/public/info");
      return res.json();
    },
    staleTime: 10 * 60 * 1000,
  });

  const { data: slotInfo, isLoading: slotsLoading } = useQuery<SlotInfo>({
    queryKey: ["/api/public/slots", rescheduleDate, rescheduleTarget?.id],
    queryFn: async () => {
      const params = new URLSearchParams({ date: rescheduleDate });
      if (rescheduleTarget?.id) params.set("excludeAppointmentId", rescheduleTarget.id);
      const res = await fetch(`/api/public/slots?${params}`);
      return res.json();
    },
    enabled: !!rescheduleDate && !!rescheduleTarget,
    staleTime: 30 * 1000,
  });

  const appointments = session?.loggedIn ? sessionAppointments : phoneAppointments;
  const isLoading = sessionLoading || (session?.loggedIn ? sessionApptLoading : phoneApptLoading);
  const refetch = () => { if (session?.loggedIn) refetchSession(); else refetchPhone(); };

  const logoutMutation = useMutation({
    mutationFn: async () => { await fetch("/api/patient/logout", { method: "POST", credentials: "include" }); },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["/api/patient/appointments"] });
      qc.invalidateQueries({ queryKey: ["/api/patient/me"] });
      setSearchPhone(""); setPhone(""); setActiveView("top");
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/patient/login", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ phone: authPhone, password: authPassword, rememberMe }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/patient/me"] });
      toast({ title: `${data.patient.name}様、おかえりなさい` });
      setAuthPhone(""); setAuthPassword("");
    },
    onError: (err: Error) => { toast({ title: err.message, variant: "destructive" }); },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (authPassword !== authConfirmPassword) throw new Error("パスワードが一致しません");
      if (authPassword.length < 8) throw new Error("パスワードは8文字以上で設定してください");
      if (!/[a-zA-Z]/.test(authPassword)) throw new Error("パスワードにはアルファベットを含めてください");
      if (!/[0-9]/.test(authPassword)) throw new Error("パスワードには数字を含めてください");
      const res = await fetch("/api/patient/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ phone: authPhone, password: authPassword, name: authName, nameKana: authNameKana, email: authEmail }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patient/me"] });
      toast({ title: "アカウントを作成しました" });
      setAuthPhone(""); setAuthPassword(""); setAuthName(""); setAuthConfirmPassword(""); setAuthEmail("");
    },
    onError: (err: Error) => { toast({ title: err.message, variant: "destructive" }); },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      if (resetNewPassword !== resetConfirm) throw new Error("パスワードが一致しません");
      if (resetNewPassword.length < 8) throw new Error("パスワードは8文字以上で設定してください");
      if (!/[a-zA-Z]/.test(resetNewPassword)) throw new Error("パスワードにはアルファベットを含めてください");
      if (!/[0-9]/.test(resetNewPassword)) throw new Error("パスワードには数字を含めてください");
      const res = await fetch("/api/patient/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: resetPhone, name: resetName, newPassword: resetNewPassword }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      return res.json();
    },
    onSuccess: () => { setResetDone(true); toast({ title: "パスワードを変更しました。ログインしてください。" }); },
    onError: (err: Error) => { toast({ title: err.message, variant: "destructive" }); },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const url = session?.loggedIn ? `/api/patient/cancel/${id}` : `/api/public/cancel/${id}`;
      const body = session?.loggedIn ? { cancellationReason: reason || null } : { phone: searchPhone, cancellationReason: reason || null };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "キャンセルに失敗しました"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "予約をキャンセルしました" }); refetch(); setCancelTarget(null); setCancelReason(""); },
    onError: (err: Error) => { toast({ title: err.message, variant: "destructive" }); setCancelTarget(null); setCancelReason(""); },
  });

  const rescheduleMutation = useMutation({
    mutationFn: async ({ id, date, time }: { id: string; date: string; time: string }) => {
      const res = await fetch(`/api/patient/reschedule/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ date, startTime: time }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "変更に失敗しました"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "予約を変更しました" }); refetch(); setRescheduleTarget(null); setRescheduleDate(""); setRescheduleTime(""); },
    onError: (err: Error) => { toast({ title: err.message, variant: "destructive" }); },
  });

  const profileMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {};
      if (profileName.trim()) body.name = profileName.trim();
      if (profilePhone.trim()) body.phone = profilePhone.trim();
      if (profileDob.trim()) body.dateOfBirth = profileDob.trim();
      const res = await fetch("/api/patient/profile", {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message || "更新に失敗しました"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "プロフィールを更新しました" }); qc.invalidateQueries({ queryKey: ["/api/patient/me"] }); setShowProfileEdit(false); },
    onError: (err: Error) => { toast({ title: err.message, variant: "destructive" }); },
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = appointments?.filter(a => a.status !== "cancelled" && a.status !== "completed" && new Date(a.date + "T00:00:00") >= today) ?? [];
  const past = appointments?.filter(a => a.status === "completed" || a.status === "cancelled" || new Date(a.date + "T00:00:00") < today) ?? [];
  const completed = appointments?.filter(a => a.status === "completed") ?? [];

  const showPhoneResults = !session?.loggedIn && !!searchPhone;
  const clinicName = clinicInfo?.clinic?.name ?? "歯科クリニック";
  const clinicSlug = (clinicInfo?.clinic as any)?.slug ?? "demo";
  const referralUrl = typeof window !== "undefined" ? `${window.location.origin}/book/${clinicSlug}` : "";

  const openReschedule = (appt: Appointment) => { setRescheduleTarget(appt); setRescheduleDate(appt.date); setRescheduleTime(appt.startTime?.slice(0, 5) ?? ""); };
  const openProfileEdit = () => { setProfileName(session?.patient?.name ?? ""); setProfilePhone(session?.patient?.phone ?? ""); setProfileDob(""); setShowProfileEdit(true); };

  const referralUrlWithCode = session?.patient?.referralCode
    ? `${referralUrl}?ref=${session.patient.referralCode}`
    : referralUrl;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralUrlWithCode).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      toast({ title: "リンクをコピーしました" });
    });
  };

  function AppointmentCard({ appt }: { appt: Appointment }) {
    const status = STATUS_MAP[appt.status] ?? { label: appt.status, color: "bg-gray-100 text-gray-700" };
    const canModify = appt.status !== "cancelled" && appt.status !== "completed";
    return (
      <div className="border border-gray-200 rounded-xl p-4 bg-white" data-testid={`card-appointment-${appt.id}`}>
        <div className="flex justify-between items-start mb-3">
          <span className="font-medium text-sm text-gray-800">{appt.treatmentType}</span>
          <Badge className={cn("text-xs font-normal", status.color)}>{status.label}</Badge>
        </div>
        <div className="space-y-1.5 text-sm text-gray-500 mb-3">
          <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 shrink-0" /><span>{formatDateJP(appt.date)}</span></div>
          <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 shrink-0" /><span>{appt.startTime?.slice(0, 5)} 〜 {appt.endTime?.slice(0, 5)}</span></div>
        </div>
        {appt.notes && <p className="text-xs text-gray-400 mb-3 bg-gray-50 rounded-lg p-2">{appt.notes}</p>}
        {canModify && (
          <div className="flex gap-2">
            {session?.loggedIn && (
              <button onClick={() => openReschedule(appt)} className="flex-1 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1" data-testid={`button-reschedule-${appt.id}`}>
                <CalendarClock className="w-3.5 h-3.5" /> 日時を変更
              </button>
            )}
            <button onClick={() => { setCancelTarget(appt.id); setCancelReason(""); }} className="flex-1 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors" data-testid={`button-cancel-${appt.id}`}>
              キャンセル
            </button>
          </div>
        )}
      </div>
    );
  }

  function NavItemRow({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
    const inner = (
      <div className={cn("flex items-center gap-3 px-1 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left w-full", isActive && "bg-[#F5F1ED]")} data-testid={`menu-${item.id ?? "booking"}`}>
        <item.icon className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="flex-1 text-sm text-gray-700">{item.label}</span>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    );
    if (item.href) {
      return <Link href={item.href}>{inner}</Link>;
    }
    return <button onClick={onClick} className="w-full text-left">{inner}</button>;
  }

  function SidebarItem({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
    const inner = (
      <div
        className={cn("w-full flex items-center gap-3 px-5 py-3 text-sm text-left transition-colors", isActive ? "text-gray-900 font-medium" : "text-gray-600 hover:bg-gray-50")}
        style={isActive ? { backgroundColor: "#F5F1ED" } : {}}
        data-testid={`nav-${item.id ?? "new-booking"}`}
      >
        <item.icon className="w-4 h-4 text-gray-400 shrink-0" />
        <span>{item.label}</span>
      </div>
    );
    if (item.href) {
      return <Link href={item.href}>{inner}</Link>;
    }
    return <button className="w-full" onClick={onClick}>{inner}</button>;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ─── Header ─────────────────────────────── */}
      <header className="sticky top-0 z-20 px-5 py-3.5 flex items-center justify-between" style={{ backgroundColor: BEIGE }}>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full border-2 border-white/50 bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">歯</span>
          </div>
          <span className="text-white font-medium text-sm tracking-wide">{clinicName}</span>
        </div>
        {session?.loggedIn && (
          <div className="flex items-center gap-2.5">
            <span className="text-white/90 text-sm hidden sm:block">{session.patient?.name} 様</span>
            <div className="w-8 h-8 rounded-full bg-white/30 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-semibold">{session.patient?.name?.slice(0, 1)}</span>
            </div>
          </div>
        )}
      </header>

      {/* ─── Not logged in ───────────────────────── */}
      {!sessionLoading && !session?.loggedIn && !showPhoneResults && (
        <div className="max-w-sm mx-auto px-4 pt-10 pb-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${BEIGE}25` }}>
              <CalendarDays className="w-8 h-8" style={{ color: BEIGE }} />
            </div>
            <h1 className="text-xl font-semibold text-gray-800">マイページ</h1>
            <p className="text-sm text-gray-500 mt-1.5">予約の確認・変更ができます</p>
          </div>

          <a
            href="/api/demo/patient"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-medium mb-6 transition-opacity hover:opacity-85 border"
            style={{ backgroundColor: `${BEIGE}18`, borderColor: `${BEIGE}60`, color: BEIGE }}
            data-testid="button-demo-patient"
          >
            <span className="text-base">🦷</span>
            デモ患者として体験する
          </a>

          <div className="flex border-b border-gray-200 mb-6">
            {([
              { key: "login",   label: "ログイン",   icon: <LogIn className="w-3.5 h-3.5" /> },
              { key: "register", label: "新規登録",  icon: <UserPlus className="w-3.5 h-3.5" /> },
              { key: "lookup",  label: "電話で検索", icon: <Search className="w-3.5 h-3.5" /> },
            ] as { key: AuthTab; label: string; icon: JSX.Element }[]).map(tab => (
              <button
                key={tab.key}
                onClick={() => setAuthTab(tab.key)}
                className={cn("flex-1 flex items-center justify-center gap-1.5 pb-3 text-xs font-medium transition-colors border-b-2 -mb-px")}
                style={authTab === tab.key ? { borderBottomColor: BEIGE, color: BEIGE } : { borderBottomColor: "transparent", color: "#9CA3AF" }}
                data-testid={`tab-${tab.key}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {authTab === "lookup" && (
              <motion.div key="lookup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <p className="text-xs text-gray-500">予約時の電話番号で過去の予約を確認できます</p>
                <div className="space-y-2">
                  <Label htmlFor="search-phone" className="text-sm text-gray-700 flex items-center gap-2"><Phone className="w-4 h-4" /> 電話番号</Label>
                  <Input id="search-phone" type="tel" placeholder="090-1234-5678" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === "Enter" && setSearchPhone(phone)} className="border-gray-200" data-testid="input-search-phone" />
                </div>
                <button onClick={() => setSearchPhone(phone)} disabled={phone.trim().length < 10} className="w-full py-3 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-40" style={{ backgroundColor: BEIGE }} data-testid="button-search">
                  予約を検索する
                </button>
              </motion.div>
            )}

            {authTab === "login" && !showReset && (
              <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-phone" className="text-sm text-gray-700">電話番号</Label>
                  <Input id="login-phone" type="tel" placeholder="090-1234-5678" value={authPhone} onChange={e => setAuthPhone(e.target.value)} className="border-gray-200" data-testid="input-login-phone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password" className="text-sm text-gray-700">パスワード</Label>
                  <Input id="login-password" type="password" placeholder="パスワードを入力" value={authPassword} onChange={e => setAuthPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && loginMutation.mutate()} className="border-gray-200" data-testid="input-login-password" />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                  <Checkbox checked={rememberMe} onCheckedChange={v => setRememberMe(v === true)} data-testid="checkbox-remember-me" />
                  ログイン状態を保持する
                </label>
                <button className="w-full py-3 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-40" style={{ backgroundColor: BEIGE }} disabled={!authPhone || !authPassword || loginMutation.isPending} onClick={() => loginMutation.mutate()} data-testid="button-login-submit">
                  {loginMutation.isPending ? "ログイン中..." : "ログイン"}
                </button>
                <button className="w-full text-xs text-gray-400 hover:text-gray-600 underline" onClick={() => { setShowReset(true); setResetPhone(authPhone); setResetDone(false); }} data-testid="button-forgot-password">
                  パスワードを忘れた方
                </button>
              </motion.div>
            )}

            {authTab === "login" && showReset && (
              <motion.div key="reset" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {resetDone ? (
                  <div className="text-center space-y-4 py-2">
                    <p className="text-sm text-green-600 font-medium">パスワードを変更しました</p>
                    <button className="w-full py-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50" onClick={() => { setShowReset(false); setResetDone(false); setResetPhone(""); setResetNewPassword(""); setResetConfirm(""); }} data-testid="button-back-to-login">ログインへ戻る</button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-700">パスワードのリセット</p>
                    <div className="space-y-2">
                      <Label htmlFor="reset-phone" className="text-sm text-gray-700">登録済みの電話番号</Label>
                      <Input id="reset-phone" type="tel" placeholder="090-1234-5678" value={resetPhone} onChange={e => setResetPhone(e.target.value)} className="border-gray-200" data-testid="input-reset-phone" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reset-name" className="text-sm text-gray-700">登録済みのお名前</Label>
                      <Input id="reset-name" placeholder="山田 太郎" value={resetName} onChange={e => setResetName(e.target.value)} className="border-gray-200" data-testid="input-reset-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reset-new-pw" className="text-sm text-gray-700">新しいパスワード（英数字8文字以上）</Label>
                      <Input id="reset-new-pw" type="password" placeholder="新しいパスワード" value={resetNewPassword} onChange={e => setResetNewPassword(e.target.value)} className="border-gray-200" data-testid="input-reset-new-password" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reset-confirm" className="text-sm text-gray-700">新しいパスワード（確認）</Label>
                      <Input id="reset-confirm" type="password" placeholder="もう一度入力" value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} className="border-gray-200" data-testid="input-reset-confirm" />
                    </div>
                    <button className="w-full py-3 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ backgroundColor: BEIGE }} disabled={!resetPhone || !resetName || !resetNewPassword || !resetConfirm || resetPasswordMutation.isPending} onClick={() => resetPasswordMutation.mutate()} data-testid="button-reset-submit">
                      {resetPasswordMutation.isPending ? "変更中..." : "パスワードを変更する"}
                    </button>
                    <button className="w-full text-xs text-gray-400 hover:text-gray-600 underline" onClick={() => { setShowReset(false); setResetName(""); setResetNewPassword(""); setResetConfirm(""); }} data-testid="button-cancel-reset">← ログインに戻る</button>
                  </>
                )}
              </motion.div>
            )}

            {authTab === "register" && (
              <motion.div key="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                <p className="text-xs text-gray-500">次回から自動でご予約一覧を表示します</p>
                <div className="space-y-2">
                  <Label htmlFor="reg-name" className="text-sm text-gray-700">お名前</Label>
                  <Input
                    id="reg-name"
                    placeholder="山田 太郎"
                    value={authName}
                    onChange={e => setAuthName(e.target.value)}
                    onCompositionUpdate={e => {
                      if (/^[\u3041-\u3096\u30a1-\u30f6ー\s　]+$/.test(e.data)) kanaReadingRef.current = e.data;
                    }}
                    onCompositionEnd={() => {
                      const r = kanaReadingRef.current;
                      if (r) {
                        const k = r.trim().replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
                        setAuthNameKana(prev => prev.trim() ? prev.trim() + "　" + k : k);
                        kanaReadingRef.current = "";
                      }
                    }}
                    className="border-gray-200"
                    data-testid="input-register-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-name-kana" className="text-sm text-gray-700">フリガナ</Label>
                  <Input id="reg-name-kana" placeholder="ヤマダ タロウ" value={authNameKana} onChange={e => setAuthNameKana(e.target.value)} className="border-gray-200" data-testid="input-register-name-kana" />
                </div>
                <div className="space-y-2"><Label htmlFor="reg-phone" className="text-sm text-gray-700">電話番号</Label><Input id="reg-phone" type="tel" placeholder="090-1234-5678" value={authPhone} onChange={e => setAuthPhone(e.target.value)} className="border-gray-200" data-testid="input-register-phone" /></div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email" className="text-sm text-gray-700">メールアドレス</Label>
                  <Input id="reg-email" type="email" placeholder="example@email.com" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="border-gray-200" data-testid="input-register-email" />
                  <p className="text-xs text-gray-400">予約リマインダーをお送りします</p>
                </div>
                <div className="space-y-2"><Label htmlFor="reg-password" className="text-sm text-gray-700">パスワード（英数字8文字以上）</Label><Input id="reg-password" type="password" placeholder="パスワードを設定" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="border-gray-200" data-testid="input-register-password" /></div>
                <div className="space-y-2"><Label htmlFor="reg-confirm" className="text-sm text-gray-700">パスワード（確認）</Label><Input id="reg-confirm" type="password" placeholder="もう一度入力" value={authConfirmPassword} onChange={e => setAuthConfirmPassword(e.target.value)} className="border-gray-200" data-testid="input-register-confirm" /></div>
                <button className="w-full py-3 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ backgroundColor: BEIGE }} disabled={!authName || !authPhone || !authEmail || !authPassword || !authConfirmPassword || registerMutation.isPending} onClick={() => registerMutation.mutate()} data-testid="button-register-submit">
                  {registerMutation.isPending ? "登録中..." : "アカウントを作成"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-6 text-center">
            <Link href="/booking" className="text-sm hover:underline" style={{ color: BEIGE }}>新しく予約する →</Link>
          </div>
        </div>
      )}

      {/* ─── Phone search results ─────────────────── */}
      {!session?.loggedIn && showPhoneResults && (
        <div className="max-w-sm mx-auto px-4 pt-8 pb-8">
          <button onClick={() => { setSearchPhone(""); setPhone(""); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ChevronLeft className="w-4 h-4" /> 戻る
          </button>
          <h2 className="text-base font-medium text-gray-800 mb-2">予約一覧</h2>
          <div className="border-b border-gray-200 mb-4" />
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BEIGE, borderTopColor: "transparent" }} /></div>
          ) : appointments?.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">予約が見つかりませんでした</p>
          ) : (
            <div className="space-y-3">{[...upcoming, ...past].map(appt => <AppointmentCard key={appt.id} appt={appt} />)}</div>
          )}
          <div className="mt-6 text-center"><Link href="/booking" className="text-sm hover:underline" style={{ color: BEIGE }}>新しく予約する →</Link></div>
        </div>
      )}

      {/* ─── Logged in: sidebar + main ──────────────── */}
      {session?.loggedIn && (
        <div className="flex min-h-[calc(100vh-56px)]">

          {/* Sidebar (desktop) */}
          <aside className="hidden md:flex flex-col w-52 border-r border-gray-100 bg-white shrink-0">
            <nav className="py-2" data-testid="sidebar-nav" data-loaded={clinicInfo !== undefined ? "true" : "false"}>
              {NAV_ITEMS.filter(item => item.id !== "referral" || (clinicInfo !== undefined ? (clinicInfo.enableReferral ?? true) : true)).map(item => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  isActive={item.id !== null && activeView === item.id}
                  onClick={() => item.id && setActiveView(item.id)}
                />
              ))}
              <div className="border-t border-gray-100 mt-2 pt-2">
                <button onClick={() => logoutMutation.mutate()} className="w-full flex items-center gap-3 px-5 py-3 text-sm text-left text-gray-600 hover:bg-gray-50 transition-colors" data-testid="button-logout">
                  <LogOut className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>ログアウト</span>
                </button>
              </div>
            </nav>
          </aside>

          {/* Mobile nav (bottom tabs - show top-level items only) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-10">
            {[NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[3], NAV_ITEMS[9]].map(item => {
              const isActive = item.id !== null && activeView === item.id;
              const inner = (
                <div className="flex flex-col items-center gap-1 py-2.5 text-xs transition-colors" style={isActive ? { color: BEIGE } : { color: "#9CA3AF" }}>
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px]">{item.label.length > 5 ? item.label.slice(0, 5) + "…" : item.label}</span>
                </div>
              );
              if (item.href) return <Link key={item.label} href={item.href} className="flex-1 flex justify-center">{inner}</Link>;
              return (
                <button key={item.label} className="flex-1" onClick={() => item.id && setActiveView(item.id)}>{inner}</button>
              );
            })}
            <button className="flex-1 flex flex-col items-center gap-1 py-2.5 text-[#9CA3AF]" onClick={() => logoutMutation.mutate()}>
              <LogOut className="w-5 h-5" />
              <span className="text-[10px]">ログアウト</span>
            </button>
          </div>

          {/* Main content */}
          <main className="flex-1 px-6 py-8 pb-24 md:pb-8 max-w-2xl">

            {/* ── TOP ── */}
            {activeView === "top" && (
              <motion.div key="top" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <p className="text-lg font-medium text-gray-800 mb-6">{session.patient?.name}様</p>
                <Link href="/booking">
                  <button className="w-full py-4 rounded-xl text-white text-base font-medium mb-8 transition-opacity hover:opacity-90" style={{ backgroundColor: BEIGE }} data-testid="button-book-new">
                    予約する
                  </button>
                </Link>

                {/* Next appointment */}
                <div className="mb-8">
                  <h2 className="text-sm font-medium text-gray-800 mb-2">次回の予約</h2>
                  <div className="border-b border-gray-200 mb-4" />
                  {isLoading ? (
                    <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BEIGE, borderTopColor: "transparent" }} /></div>
                  ) : upcoming.length > 0 ? (
                    <AppointmentCard appt={upcoming[0]} />
                  ) : (
                    <p className="text-sm text-gray-400">予約はありません</p>
                  )}
                </div>

                {/* My page menu */}
                <div>
                  <h2 className="text-sm font-medium text-gray-800 mb-2">マイページメニュー</h2>
                  <div className="border-b border-gray-200 mb-1" />
                  {NAV_ITEMS.filter(item => item.id !== "top" && (item.id !== "referral" || (clinicInfo !== undefined ? (clinicInfo.enableReferral ?? true) : true))).map(item => (
                    <NavItemRow
                      key={item.label}
                      item={item}
                      isActive={item.id !== null && activeView === item.id}
                      onClick={() => item.id && setActiveView(item.id)}
                    />
                  ))}
                  <button onClick={() => logoutMutation.mutate()} className="w-full flex items-center gap-3 px-1 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left md:hidden" data-testid="button-logout-menu">
                    <LogOut className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="flex-1 text-sm text-gray-700">ログアウト</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── HISTORY ── */}
            {activeView === "history" && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="予約履歴" />
                {isLoading ? (
                  <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BEIGE, borderTopColor: "transparent" }} /></div>
                ) : [...upcoming, ...past].length === 0 ? (
                  <EmptyState icon={CalendarDays} title="予約履歴はありません" />
                ) : (
                  <div className="space-y-3">
                    {upcoming.length > 0 && (<><p className="text-xs font-medium text-gray-400 uppercase tracking-wide">今後の予約</p>{upcoming.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}</>)}
                    {past.length > 0 && (<><p className="text-xs font-medium text-gray-400 uppercase tracking-wide mt-6">過去の予約</p>{past.map(appt => <AppointmentCard key={appt.id} appt={appt} />)}</>)}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── TICKET ── */}
            {activeView === "ticket" && (
              <motion.div key="ticket" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="チケット" />
                <EmptyState icon={Ticket} title="チケットはありません" sub="施術チケットをお持ちの場合はクリニックスタッフまでお問い合わせください。" />
              </motion.div>
            )}

            {/* ── CONSENT ── */}
            {activeView === "consent" && (
              <motion.div key="consent" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="同意書" />
                <div className="space-y-3">
                  <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BEIGE}20` }}>
                      <FileCheck className="w-5 h-5" style={{ color: BEIGE }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">初診問診票</p>
                      <p className="text-xs text-gray-400 mt-0.5">来院前にご記入いただくことができます</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                  <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:bg-gray-50 cursor-pointer transition-colors">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BEIGE}20` }}>
                      <FileCheck className="w-5 h-5" style={{ color: BEIGE }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">治療同意書</p>
                      <p className="text-xs text-gray-400 mt-0.5">治療内容についての同意書です</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                  <p className="text-xs text-gray-400 text-center pt-2">※ 同意書の詳細はクリニックスタッフまでお問い合わせください</p>
                </div>
              </motion.div>
            )}

            {/* ── ESTIMATE ── */}
            {activeView === "estimate" && (
              <motion.div key="estimate" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="見積書" />
                <EmptyState icon={FileText} title="見積書はありません" sub="治療の見積書が発行された場合、こちらに表示されます。詳細はクリニックスタッフにお問い合わせください。" />
              </motion.div>
            )}

            {/* ── RECEIPT ── */}
            {activeView === "receipt" && (
              <motion.div key="receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="領収書" />
                {completed.length === 0 ? (
                  <EmptyState icon={Receipt} title="領収書はありません" sub="来院後、こちらに来院履歴が表示されます。" />
                ) : (
                  <div className="space-y-3">
                    {completed.map(appt => (
                      <div key={appt.id} className="border border-gray-200 rounded-xl p-4 flex items-center gap-3" data-testid={`receipt-${appt.id}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BEIGE}20` }}>
                          <Receipt className="w-5 h-5" style={{ color: BEIGE }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">{appt.treatmentType}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatDateJP(appt.date)}</p>
                        </div>
                        <span className="text-xs text-gray-400">来院済</span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 text-center pt-2">※ 詳細な領収書が必要な場合はクリニックスタッフまでお申し付けください</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── REFERRAL ── */}
            {activeView === "referral" && (
              <motion.div key="referral" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="友人紹介" />
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${BEIGE}20` }}>
                      <Users className="w-7 h-7" style={{ color: BEIGE }} />
                    </div>
                    <h3 className="font-medium text-gray-800 mb-2">ご友人・ご家族をご紹介ください</h3>
                    <p className="text-xs text-gray-500 max-w-xs mx-auto">紹介コードまたはリンクをシェアしてください。</p>
                  </div>

                  {/* 個人紹介コード */}
                  {session?.patient?.referralCode && (
                    <div className="rounded-xl overflow-hidden border border-gray-200">
                      <div className="px-4 py-2.5 text-xs font-medium text-gray-500" style={{ backgroundColor: `${BEIGE}12` }}>
                        あなたの紹介コード
                      </div>
                      <div className="px-4 py-4 bg-white flex items-center justify-between">
                        <span className="text-3xl font-bold tracking-[0.2em]" style={{ color: BEIGE }} data-testid="text-referral-code">
                          {session.patient.referralCode}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(session.patient!.referralCode!);
                            toast({ title: "コードをコピーしました" });
                          }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90"
                          style={{ backgroundColor: BEIGE }}
                          data-testid="button-copy-code"
                        >
                          <Copy className="w-3.5 h-3.5" /> コード
                        </button>
                      </div>
                      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          紹介実績：<span className="font-semibold text-gray-700" data-testid="text-referral-count">{session.patient.referralCount ?? 0}</span> 人
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 紹介URL */}
                  <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                    <p className="text-xs text-gray-500 mb-2">紹介リンク（コード付き）</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-700 flex-1 truncate font-mono bg-white border border-gray-200 rounded-lg px-3 py-2">
                        {referralUrlWithCode}
                      </p>
                      <button
                        onClick={copyReferralLink}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-medium transition-opacity hover:opacity-90 shrink-0"
                        style={{ backgroundColor: BEIGE }}
                        data-testid="button-copy-referral"
                      >
                        {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedLink ? "コピー済" : "リンク"}
                      </button>
                    </div>
                  </div>

                  <Link href={referralUrlWithCode} className="w-full">
                    <div className="flex items-center justify-center gap-2 py-3 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                      予約ページを開く
                    </div>
                  </Link>
                </div>
              </motion.div>
            )}

            {/* ── PAYMENT ── */}
            {activeView === "payment" && (
              <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="クレジットカード情報" />
                <EmptyState icon={CreditCard} title="クレジットカード情報はありません" sub="お支払いはクリニック窓口にて承っております。現金・各種クレジットカードをご利用いただけます。" />
              </motion.div>
            )}

            {/* ── PROFILE ── */}
            {activeView === "profile" && (
              <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="登録情報の確認・変更" />
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-xs text-gray-400 mb-0.5">お名前</p>
                    <p className="text-sm font-medium text-gray-800">{session.patient?.name}</p>
                  </div>
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-xs text-gray-400 mb-0.5">電話番号</p>
                    <p className="text-sm font-medium text-gray-800">{session.patient?.phone}</p>
                  </div>
                  <div className="px-5 py-4">
                    <button onClick={openProfileEdit} className="w-full py-3 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2" data-testid="button-edit-profile">
                      <Edit2 className="w-3.5 h-3.5" /> 編集する
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── CONTACT ── */}
            {activeView === "contact" && (
              <motion.div key="contact" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="お問い合わせ" />
                {contactSent ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: `${BEIGE}20` }}>
                      <Check className="w-7 h-7" style={{ color: BEIGE }} />
                    </div>
                    <p className="font-medium text-gray-800 mb-2">送信が完了しました</p>
                    <p className="text-sm text-gray-500 mb-6">内容を確認後、ご連絡いたします。</p>
                    <button onClick={() => setContactSent(false)} className="text-sm underline" style={{ color: BEIGE }}>新しいお問い合わせ</button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {clinicInfo?.clinic?.phone && (
                      <div className="border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${BEIGE}20` }}>
                          <Phone className="w-5 h-5" style={{ color: BEIGE }} />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">お電話</p>
                          <p className="text-sm font-medium text-gray-800">{clinicInfo.clinic.phone}</p>
                        </div>
                      </div>
                    )}
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-gray-700">メッセージでのお問い合わせ</p>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-700">お名前</Label>
                        <Input placeholder={session.patient?.name ?? "山田 太郎"} value={contactName} onChange={e => setContactName(e.target.value)} className="border-gray-200" data-testid="input-contact-name" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-700">メールアドレス</Label>
                        <Input type="email" placeholder="example@email.com" value={contactEmail} onChange={e => setContactEmail(e.target.value)} className="border-gray-200" data-testid="input-contact-email" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-gray-700">お問い合わせ内容</Label>
                        <Textarea placeholder="お問い合わせの内容をご記入ください" rows={4} value={contactMessage} onChange={e => setContactMessage(e.target.value)} className="border-gray-200 text-sm" data-testid="input-contact-message" />
                      </div>
                      <button
                        className="w-full py-3 rounded-lg text-white text-sm font-medium disabled:opacity-40 transition-opacity hover:opacity-90"
                        style={{ backgroundColor: BEIGE }}
                        disabled={!contactMessage.trim()}
                        onClick={() => setContactSent(true)}
                        data-testid="button-contact-submit"
                      >
                        送信する
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── HELP ── */}
            {activeView === "help" && (
              <motion.div key="help" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <SectionHeader onBack={() => setActiveView("top")} title="ヘルプ" />
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 mb-4">よくあるご質問</p>
                  {FAQ_ITEMS.map((faq, i) => (
                    <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                        data-testid={`faq-${i}`}
                      >
                        <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: BEIGE }}>Q</span>
                        <span className="text-sm text-gray-700 flex-1">{faq.q}</span>
                        <ChevronRight className={cn("w-4 h-4 text-gray-300 shrink-0 transition-transform mt-0.5", openFaq === i && "rotate-90")} />
                      </button>
                      {openFaq === i && (
                        <div className="px-4 pb-4 flex gap-3 border-t border-gray-100 pt-3 bg-gray-50">
                          <span className="text-xs font-bold mt-0.5 shrink-0" style={{ color: "#B8A99A" }}>A</span>
                          <p className="text-sm text-gray-600">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </main>
        </div>
      )}

      {/* Footer */}
      <div className="hidden md:block text-center py-8 text-xs text-gray-300">
        {clinicName} · 予約管理システム
      </div>

      {/* ─── Dialogs ─────────────────────────────── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={open => { if (!open) { setCancelTarget(null); setCancelReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>予約をキャンセルしますか？</AlertDialogTitle>
            <AlertDialogDescription>この操作は取り消せません。キャンセル後は再度ご予約ください。</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-2">
            <Label htmlFor="cancel-reason" className="text-sm mb-1 block">キャンセル理由（任意）</Label>
            <Textarea id="cancel-reason" placeholder="例：体調不良、日程変更など" value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} className="text-sm" data-testid="input-cancel-reason" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => cancelTarget && cancelMutation.mutate({ id: cancelTarget, reason: cancelReason })} data-testid="button-confirm-cancel">
              キャンセルする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!rescheduleTarget} onOpenChange={open => { if (!open) { setRescheduleTarget(null); setRescheduleDate(""); setRescheduleTime(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CalendarClock className="w-4 h-4" /> 予約日時を変更</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reschedule-date">新しい日付</Label>
              <Input id="reschedule-date" type="date" value={rescheduleDate} min={toYMD(new Date())} onChange={e => { setRescheduleDate(e.target.value); setRescheduleTime(""); }} data-testid="input-reschedule-date" />
            </div>
            {rescheduleDate && (
              <div className="space-y-2">
                <Label>時間を選択</Label>
                {slotsLoading && <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BEIGE, borderTopColor: "transparent" }} /></div>}
                {!slotsLoading && (!slotInfo?.slots || slotInfo.slots.length === 0) && <p className="text-sm text-gray-400 text-center py-2">この日は空きがありません</p>}
                {!slotsLoading && slotInfo?.slots && slotInfo.slots.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                    {slotInfo.slots.map(slot => (
                      <button key={slot} onClick={() => setRescheduleTime(slot)} className={cn("py-2 rounded-lg border text-xs font-medium transition-all", rescheduleTime === slot ? "text-white" : "border-gray-200 bg-white hover:border-gray-300 text-gray-700")} style={rescheduleTime === slot ? { backgroundColor: BEIGE, borderColor: BEIGE } : {}} data-testid={`slot-${slot}`}>
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button className="w-full py-3 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ backgroundColor: BEIGE }} disabled={!rescheduleDate || !rescheduleTime || rescheduleMutation.isPending} onClick={() => rescheduleTarget && rescheduleMutation.mutate({ id: rescheduleTarget.id, date: rescheduleDate, time: rescheduleTime })} data-testid="button-confirm-reschedule">
              {rescheduleMutation.isPending ? "変更中..." : "変更を確定する"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showProfileEdit} onOpenChange={open => { if (!open) setShowProfileEdit(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Edit2 className="w-4 h-4" /> プロフィール編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">お名前</Label>
              <Input id="profile-name" placeholder={session?.patient?.name ?? ""} value={profileName} onChange={e => setProfileName(e.target.value)} data-testid="input-profile-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">電話番号</Label>
              <Input id="profile-phone" type="tel" placeholder={session?.patient?.phone ?? ""} value={profilePhone} onChange={e => setProfilePhone(e.target.value)} data-testid="input-profile-phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-dob">生年月日（任意）</Label>
              <Input id="profile-dob" type="date" value={profileDob} onChange={e => setProfileDob(e.target.value)} data-testid="input-profile-dob" />
            </div>
            <button className="w-full py-3 rounded-lg text-white text-sm font-medium disabled:opacity-40" style={{ backgroundColor: BEIGE }} disabled={profileMutation.isPending || (!profileName.trim() && !profilePhone.trim() && !profileDob.trim())} onClick={() => profileMutation.mutate()} data-testid="button-save-profile">
              {profileMutation.isPending ? "保存中..." : "保存する"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
