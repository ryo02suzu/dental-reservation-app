import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2, CheckCircle2, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function CheckinPage() {
  const { slug } = useParams<{ slug: string }>();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ patientName: string; time: string; already: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<{ clinicName: string }>({
    queryKey: ["/api/public/checkin", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/checkin/${slug}`);
      if (!res.ok) throw new Error("unavailable");
      return res.json();
    },
  });

  async function submit() {
    if (!phone.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/checkin/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || "チェックインに失敗しました"); return; }
      setResult({ patientName: json.patientName, time: json.time, already: json.alreadyCheckedIn });
    } catch {
      setError("通信エラーが発生しました。受付スタッフにお声がけください。");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center text-slate-500">
          <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">チェックインを利用できません</p>
          <p className="text-sm mt-1">受付スタッフにお声がけください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-5">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <p className="text-center text-sm text-slate-500 mb-1">{data.clinicName}</p>

        {!result ? (
          <>
            <h1 className="text-xl font-bold text-center text-slate-800 mb-2">受付チェックイン</h1>
            <p className="text-center text-sm text-slate-500 mb-6">
              ご予約時の電話番号を入力して、来院をお知らせください。
            </p>
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="090-1234-5678"
              className="text-center text-lg h-12 mb-3"
              data-testid="checkin-phone"
            />
            {error && <p className="text-sm text-red-500 text-center mb-3">{error}</p>}
            <Button className="w-full h-12 text-base" onClick={submit} disabled={submitting || !phone.trim()} data-testid="checkin-submit">
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "チェックイン"}
            </Button>
          </>
        ) : (
          <div className="text-center py-6">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
            <p className="text-xl font-bold text-slate-800">{result.patientName} 様</p>
            <p className="text-slate-600 mt-2">
              {result.already ? "すでにチェックイン済みです。" : "チェックインが完了しました。"}
            </p>
            {result.time && <p className="text-sm text-slate-500 mt-1">ご予約時間: {result.time}〜</p>}
            <p className="text-sm text-slate-500 mt-4">待合室でお待ちください。</p>
          </div>
        )}
      </div>
    </div>
  );
}
