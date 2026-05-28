import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StaffLoginPage() {
  const params = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [staffName, setStaffName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!params.token) {
      setStatus("error");
      setErrorMsg("QRコードが無効です");
      return;
    }

    fetch(`/api/staff-auth/${params.token}`)
      .then(async r => {
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          throw new Error(data.message || "ログインに失敗しました");
        }
        return r.json();
      })
      .then(data => {
        setStaffName(data.name);
        setStatus("success");
        setTimeout(() => navigate("/my-schedule"), 1500);
      })
      .catch(e => {
        setStatus("error");
        setErrorMsg(e.message);
      });
  }, [params.token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-amber-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
        <div className="mb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
            {status === "loading" && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
            {status === "success" && <CheckCircle2 className="w-8 h-8 text-primary" />}
            {status === "error" && <XCircle className="w-8 h-8 text-red-500" />}
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {status === "loading" && "ログイン中..."}
            {status === "success" && `おかえりなさい、${staffName}さん`}
            {status === "error" && "ログインできません"}
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            {status === "loading" && "QRコードを確認しています"}
            {status === "success" && "スケジュール画面に移動します..."}
            {status === "error" && errorMsg}
          </p>
        </div>
        {status === "success" && (
          <Button className="w-full mt-4" onClick={() => navigate("/my-schedule")}>
            スケジュールを見る
          </Button>
        )}
        {status === "error" && (
          <p className="text-sm text-muted-foreground mt-4">
            QRコードが古い場合は、院長に再発行を依頼してください
          </p>
        )}
      </div>
    </div>
  );
}
