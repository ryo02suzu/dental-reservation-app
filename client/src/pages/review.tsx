import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ReviewConfig {
  clinicName: string;
  threshold: number;
  googleReviewUrl: string | null;
  headline: string;
  positiveMessage: string;
  negativeMessage: string;
  thanksMessage: string;
}

export default function ReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [step, setStep] = useState<"rate" | "positive" | "negative" | "done">("rate");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [config, setConfig] = useState<ReviewConfig | null>(null);

  const { data, isLoading, isError } = useQuery<ReviewConfig>({
    queryKey: ["/api/public/review", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/review/${slug}`);
      if (!res.ok) throw new Error("not found");
      const json = await res.json();
      setConfig(json);
      return json;
    },
  });

  const cfg = config || data;

  async function submit(selectedRating: number, fb?: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/review/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: selectedRating, feedback: fb }),
      });
      const json = await res.json();
      if (json.routedToGoogle && json.googleReviewUrl) {
        // 高評価: Googleの口コミへ誘導
        setStep("positive");
        setTimeout(() => { window.location.href = json.googleReviewUrl; }, 2500);
      } else if (json.routedToGoogle) {
        setStep("done"); // GoogleURL未設定でも高評価のお礼
      } else {
        setStep("done");
      }
    } catch {
      alert("送信に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  function handleStarClick(value: number) {
    setRating(value);
    if (!cfg) return;
    if (value >= cfg.threshold) {
      // 高評価 → 即送信してGoogle誘導
      submit(value);
    } else {
      // 低評価 → 匿名フォーム展開
      setStep("negative");
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isError || !cfg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-6">
        <div className="text-center text-slate-500">
          <p className="text-lg font-medium">アンケートを表示できません</p>
          <p className="text-sm mt-2">URLをご確認ください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 p-5">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 sm:p-10">
        <p className="text-center text-sm font-medium text-slate-500 mb-6">{cfg.clinicName}</p>

        {step === "rate" && (
          <>
            <h1 className="text-2xl font-bold text-center text-slate-800 mb-3 leading-relaxed">
              {cfg.headline}
            </h1>
            <p className="text-center text-sm text-slate-500 mb-8">
              本日のご満足度はいかがでしたか？
            </p>
            <div className="flex justify-center gap-1.5 sm:gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={submitting}
                  onMouseEnter={() => setHover(v)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => handleStarClick(v)}
                  className="p-1.5 rounded-full transition-transform duration-150 hover:scale-125 active:scale-110 disabled:opacity-50"
                  aria-label={`${v}つ星`}
                  data-testid={`star-${v}`}
                >
                  <Star
                    className={`w-12 h-12 transition-colors duration-150 ${
                      v <= (hover || rating)
                        ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                        : "text-slate-200"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-slate-400">星をタップして評価してください</p>
            {submitting && (
              <div className="flex justify-center mt-5">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}
          </>
        )}

        {step === "positive" && (
          <div className="text-center py-8">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-5" />
            <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">{cfg.positiveMessage}</p>
            <div className="flex items-center justify-center gap-2 mt-6 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Googleの口コミページへ移動します…
            </div>
          </div>
        )}

        {step === "negative" && (
          <div className="py-2">
            <div className="flex justify-center gap-1.5 mb-5">
              {[1, 2, 3, 4, 5].map((v) => (
                <Star key={v} className={`w-7 h-7 ${v <= rating ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
              ))}
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-5 whitespace-pre-wrap text-center">
              {cfg.negativeMessage}
            </p>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="具体的なご意見をお聞かせください（匿名で院長に届きます）"
              rows={5}
              className="mb-4 text-base rounded-xl resize-none"
              data-testid="feedback-input"
            />
            <Button
              className="w-full h-12 text-base rounded-xl"
              disabled={submitting || !feedback.trim()}
              onClick={() => submit(rating, feedback.trim())}
              data-testid="submit-feedback"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "送信する"}
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-10">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-5" />
            <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap">{cfg.thanksMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
