import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { CheckCircle, XCircle, Loader2, User, Lock, LogIn, LogOut, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

interface StaffEntry { id: string; name: string; role: string; hasPin: boolean; status: string }

type Step =
  | "loading"
  | "prompt-login"
  | "select-staff"
  | "enter-pin"
  | "submitting"
  | "success"
  | "error";

export default function QrClockInPage() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";

  const [step, setStep] = useState<Step>("loading");
  const [staffList, setStaffList] = useState<StaffEntry[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffEntry | null>(null);
  const [action, setAction] = useState<"clock-in" | "clock-out">("clock-in");
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorSource, setErrorSource] = useState<"token" | "clock">("clock");
  const [resultName, setResultName] = useState("");
  const [resultAction, setResultAction] = useState<"clock-in" | "clock-out">("clock-in");

  async function init() {
    setStep("loading");

    // QRトークンの検証と同時にスタッフセッションを確認
    const [staffRes, qrRes] = await Promise.all([
      fetch("/api/staff/me").catch(() => null),
      fetch("/api/public/qr-staff-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token }),
      }).catch(() => null),
    ]);

    // QRトークン検証エラー
    if (!qrRes || !qrRes.ok) {
      const data = qrRes ? await qrRes.json().catch(() => ({})) : {};
      setErrorMsg(data.message || "QRコードが無効です");
      setErrorSource("token");
      setStep("error");
      return;
    }

    const qrData = await qrRes.json();

    // スタッフセッションがあればそのまま自動打刻
    if (staffRes && staffRes.ok) {
      await doAutoClock();
      return;
    }

    // ログインしていない → ログイン誘導画面
    setStaffList(qrData.staff || []);
    setStep("prompt-login");
  }

  async function doAutoClock() {
    setStep("submitting");
    try {
      const r = await fetch("/api/staff/qr-auto-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token }),
      });
      const data = await r.json();
      if (!r.ok) {
        setErrorMsg(data.message || "打刻エラー");
        setErrorSource("clock");
        setStep("error");
        return;
      }
      setResultName(data.staffName || "");
      setResultAction(data.action);
      setStep("success");
    } catch {
      setErrorMsg("通信エラー");
      setErrorSource("clock");
      setStep("error");
    }
  }

  function loadStaffList() {
    setStep("loading");
    fetch("/api/public/qr-staff-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ qrToken: token }),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) {
        setErrorMsg(data.message || "QRコードが無効です");
        setErrorSource("token");
        setStep("error");
        return;
      }
      setStaffList(data.staff || []);
      setStep("select-staff");
    }).catch(() => {
      setErrorMsg("通信エラー");
      setErrorSource("token");
      setStep("error");
    });
  }

  useEffect(() => { init(); }, [token]);

  function handleSelectStaff(s: StaffEntry, act: "clock-in" | "clock-out") {
    setSelectedStaff(s);
    setAction(act);
    if (s.hasPin) {
      setPin("");
      setErrorMsg("");
      setStep("enter-pin");
    } else {
      doClock(s.id, "", act);
    }
  }

  function handlePinSubmit() {
    if (!selectedStaff || pin.length < 4) return;
    doClock(selectedStaff.id, pin, action);
  }

  async function doClock(staffId: string, pinCode: string, act: "clock-in" | "clock-out") {
    setStep("submitting");
    const endpoint = act === "clock-in" ? "/api/public/qr-clock-in" : "/api/public/qr-clock-out";
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrToken: token, staffId, pin: pinCode || undefined }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.message?.includes("PIN")) {
          setErrorMsg(data.message);
          setStep("enter-pin");
          setPin("");
          return;
        }
        setErrorMsg(data.message || "打刻エラー");
        setErrorSource("clock");
        setStep("error");
        return;
      }
      setResultName(data.staffName || selectedStaff?.name || "");
      setResultAction(act);
      setStep("success");
    } catch {
      setErrorMsg("通信エラー");
      setStep("error");
    }
  }

  function resetToList() {
    setSelectedStaff(null);
    setPin("");
    setErrorMsg("");
    loadStaffList();
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case "doctor": return "医師";
      case "hygienist": return "歯科衛生士";
      case "assistant": return "歯科助手";
      case "receptionist": return "受付";
      default: return role;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "clocked_in": return { label: "勤務中", color: "bg-emerald-100 text-emerald-700" };
      case "clocked_out": return { label: "退勤済", color: "bg-gray-100 text-gray-500" };
      default: return { label: "未出勤", color: "bg-blue-50 text-blue-600" };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">

        {/* ロード中 */}
        {step === "loading" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3 text-primary" />
            <p className="text-gray-500">読み込み中...</p>
          </div>
        )}

        {/* 送信中 */}
        {step === "submitting" && (
          <div className="text-center py-8">
            <Loader2 className="w-16 h-16 animate-spin mx-auto mb-4 text-emerald-500" />
            <h2 className="text-xl font-bold text-gray-900">打刻中...</h2>
          </div>
        )}

        {/* ログイン誘導（未ログイン時） */}
        {step === "prompt-login" && (
          <>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">マイページでログインして打刻</h2>
              <p className="text-sm text-gray-500 mt-1.5">
                あなた専用のマイページからログインすると、<br />名前の選択なしで即打刻できます
              </p>
            </div>

            <a
              href="/my-schedule"
              data-testid="btn-go-to-mypage"
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-white font-bold text-sm mb-3 active:bg-primary/90 transition-colors">
              <LogIn className="w-4 h-4" />
              マイページへログイン
            </a>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400">または</span>
              </div>
            </div>

            <button
              onClick={() => setStep("select-staff")}
              data-testid="btn-use-list"
              className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium active:bg-gray-50 transition-colors">
              スタッフ一覧から選んで打刻
            </button>
          </>
        )}

        {/* スタッフ選択（未ログイン・従来フロー） */}
        {step === "select-staff" && (
          <>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">出退勤打刻</h2>
              <p className="text-sm text-gray-500 mt-1">{format(new Date(), "yyyy年M月d日(E)", { locale: ja })}</p>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {staffList.map(s => {
                const badge = statusBadge(s.status);
                const canClockIn = s.status === "not_clocked_in";
                const canClockOut = s.status === "clocked_in";
                const done = s.status === "clocked_out";
                return (
                  <div key={s.id} className={`rounded-xl border ${done ? "border-gray-100 bg-gray-50" : "border-gray-200"}`}>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-gray-100" : "bg-primary/10"}`}>
                        <span className={`text-sm font-bold ${done ? "text-gray-400" : "text-primary"}`}>{s.name.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${done ? "text-gray-400" : "text-gray-900"}`}>{s.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400">{roleLabel(s.role)}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.color}`}>{badge.label}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {canClockIn && (
                          <button onClick={() => handleSelectStaff(s, "clock-in")}
                            data-testid={`btn-clock-in-${s.id}`}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-bold active:bg-emerald-600 transition-colors">
                            <LogIn className="w-3.5 h-3.5" />出勤
                          </button>
                        )}
                        {canClockOut && (
                          <button onClick={() => handleSelectStaff(s, "clock-out")}
                            data-testid={`btn-clock-out-${s.id}`}
                            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-500 text-white text-xs font-bold active:bg-red-600 transition-colors">
                            <LogOut className="w-3.5 h-3.5" />退勤
                          </button>
                        )}
                      </div>
                    </div>
                    {s.hasPin && (canClockIn || canClockOut) && (
                      <div className="px-4 pb-2">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1"><Lock className="w-3 h-3" />PIN認証あり</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* PIN入力 */}
        {step === "enter-pin" && selectedStaff && (
          <>
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">{selectedStaff.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {action === "clock-in" ? "出勤" : "退勤"}のPINを入力
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4 text-center">
                <p className="text-sm text-red-600">{errorMsg}</p>
              </div>
            )}

            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-bold transition-all ${
                  pin.length > i ? "border-primary bg-primary/5 text-gray-900" : "border-gray-200 text-transparent"
                }`}>
                  {pin[i] ? "●" : ""}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "del"].map((n, i) => {
                if (n === null) return <div key={i} />;
                if (n === "del") return (
                  <button key="del" onClick={() => setPin(p => p.slice(0, -1))}
                    data-testid="btn-pin-delete"
                    className="py-3 rounded-xl bg-gray-100 text-gray-600 font-bold active:bg-gray-200 transition-colors">
                    ←
                  </button>
                );
                return (
                  <button key={n} onClick={() => { const np = pin.length < 4 ? pin + n : pin; setPin(np); if (np.length === 4 && selectedStaff) { setTimeout(() => { doClock(selectedStaff.id, np, action); }, 150); } }}
                    data-testid={`btn-pin-${n}`}
                    className="py-3 rounded-xl bg-gray-50 border text-lg font-bold text-gray-800 active:bg-primary/10 transition-colors">
                    {n}
                  </button>
                );
              })}
            </div>

            <button onClick={() => resetToList()}
              data-testid="btn-back-staff-list"
              className="w-full py-2 mt-2 text-sm text-gray-400 hover:text-gray-600">
              ← スタッフ選択に戻る
            </button>
          </>
        )}

        {/* 成功 */}
        {step === "success" && (
          <div className="text-center py-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${resultAction === "clock-in" ? "bg-emerald-100" : "bg-blue-100"}`}>
              <CheckCircle className={`w-12 h-12 ${resultAction === "clock-in" ? "text-emerald-500" : "text-blue-500"}`} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {resultAction === "clock-in" ? "出勤打刻完了" : "退勤打刻完了"}
            </h2>
            <p className="text-sm text-gray-500 mb-1">{resultName}さん</p>
            <p className={`text-2xl font-mono font-bold mb-4 ${resultAction === "clock-in" ? "text-emerald-600" : "text-blue-600"}`}>
              {format(new Date(), "HH:mm:ss")}
            </p>
            <p className="text-xs text-gray-400 mb-6">{format(new Date(), "yyyy年M月d日(E)", { locale: ja })}</p>
            <button onClick={() => resetToList()}
              data-testid="btn-another-staff"
              className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-bold active:bg-gray-200 transition-colors">
              別のスタッフの打刻
            </button>
          </div>
        )}

        {/* エラー */}
        {step === "error" && (
          <div className="text-center py-4">
            {errorSource === "token" ? (
              <>
                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-12 h-12 text-amber-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">QRコードが期限切れです</h2>
                <p className="text-sm text-gray-500 mb-2">このQRコードは無効になっています。</p>
                <p className="text-sm text-amber-600 font-medium mb-6">受付の画面でQRを更新してから<br/>もう一度スキャンしてください</p>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 mb-4 text-left">
                  <p className="text-xs text-amber-700 font-bold mb-1">受付スタッフへ</p>
                  <p className="text-xs text-amber-600">管理画面の「QR更新」ボタンを押してQRコードを新しくしてください</p>
                </div>
                <button
                  onClick={() => window.history.back()}
                  data-testid="btn-go-back"
                  className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-bold active:bg-gray-200 mb-2">
                  ← 前の画面に戻る
                </button>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">打刻エラー</h2>
                <p className="text-sm text-red-500 mb-6">{errorMsg}</p>
                <button onClick={() => resetToList()}
                  data-testid="btn-retry"
                  className="w-full py-3 rounded-xl bg-primary text-white font-bold active:bg-primary/90">
                  やり直す
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
