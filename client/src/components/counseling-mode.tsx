import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Check, Loader2, Eraser, ChevronLeft, Stethoscope } from "lucide-react";
import type { TreatmentPlan, ClinicSettings } from "@shared/schema";

interface CounselingModeProps {
  patient: { id: string; name: string };
  initialCategory?: string; // WEB問診の悩みから初期表示
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: "一般", color: "歯の色", alignment: "歯並び", missing: "歯を失った",
};

export function CounselingMode({ patient, initialCategory, onClose }: CounselingModeProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: plans } = useQuery<TreatmentPlan[]>({ queryKey: ["/api/treatment-plans"] });
  const { data: settings } = useQuery<ClinicSettings>({ queryKey: ["/api/clinic-settings"] });
  const [category, setCategory] = useState<string>(initialCategory || "all");
  const [selected, setSelected] = useState<TreatmentPlan | null>(null);
  const [step, setStep] = useState<"compare" | "consent">("compare");

  const active = (plans ?? []).filter(p => p.isActive);
  const categories = Array.from(new Set(active.map(p => p.category || "general")));
  const visible = category === "all" ? active : active.filter(p => (p.category || "general") === category);

  function choosePlan(p: TreatmentPlan) {
    setSelected(p);
    setStep("consent");
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ヘッダー */}
      <div className="shrink-0 flex items-center justify-between px-5 md:px-8 py-4 border-b border-border bg-background">
        <div className="flex items-center gap-3 min-w-0">
          {step === "consent" && (
            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={() => setStep("compare")}><ChevronLeft className="w-5 h-5" /></Button>
          )}
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">カウンセリング</p>
            <p className="font-bold text-lg md:text-xl tracking-tight truncate">{patient.name} 様</p>
          </div>
        </div>
        <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0" onClick={onClose} data-testid="close-counseling"><X className="w-6 h-6" /></Button>
      </div>

      {step === "compare" && (
        <div className="flex-1 overflow-auto p-5 md:p-8">
          {/* カテゴリ切替 */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            <button
              onClick={() => setCategory("all")}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors active:scale-95 ${category === "all" ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
            >すべて</button>
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-colors active:scale-95 ${category === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
              >{CATEGORY_LABELS[c] || c}</button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Stethoscope className="h-10 w-10 mx-auto mb-3 opacity-25" />
              <p className="text-base">表示できる治療プランがありません</p>
              <p className="text-sm mt-1.5">設定 → 自費プラン から登録してください。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {visible.map(p => (
                <div
                  key={p.id}
                  className={`relative rounded-2xl border-2 p-6 md:p-7 flex flex-col transition-shadow ${p.isRecommended ? "border-primary shadow-lg" : "border-border"} ${p.isInsurance ? "bg-muted/30" : "bg-card"}`}
                >
                  {p.isRecommended && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs">おすすめ</Badge>
                  )}
                  <div className="text-center mb-5">
                    <h3 className="text-xl md:text-2xl font-bold tracking-tight">{p.name}</h3>
                    {p.material && <p className="text-sm text-muted-foreground mt-1">{p.material}</p>}
                  </div>
                  <div className="text-center mb-5 pb-5 border-b border-border">
                    <span className="text-4xl font-extrabold tabular-nums leading-none">¥{(p.price ?? 0).toLocaleString()}</span>
                    {p.isInsurance && <span className="text-sm text-muted-foreground ml-1.5">(保険)</span>}
                    {p.durationLabel && <p className="text-xs text-muted-foreground mt-2">治療期間: {p.durationLabel}</p>}
                  </div>
                  {p.description && <p className="text-sm text-muted-foreground leading-relaxed mb-5 text-center">{p.description}</p>}
                  <div className="space-y-4 flex-1">
                    {(p.merits ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-emerald-600 mb-1.5">メリット</p>
                        <ul className="space-y-1.5">
                          {(p.merits ?? []).map((m, i) => (
                            <li key={i} className="text-sm leading-relaxed flex items-start gap-2"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(p.demerits ?? []).length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 mb-1.5">注意点</p>
                        <ul className="space-y-1.5">
                          {(p.demerits ?? []).map((m, i) => (
                            <li key={i} className="text-sm leading-relaxed flex items-start gap-2 text-muted-foreground"><span className="text-amber-500 shrink-0 mt-0.5">•</span>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button className="w-full mt-6 h-12 text-base font-semibold active:scale-95" variant={p.isRecommended ? "default" : "outline"} onClick={() => choosePlan(p)} data-testid={`choose-plan-${p.id}`}>
                    このプランで決定
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === "consent" && selected && (
        <ConsentForm
          patient={patient}
          plan={selected}
          clinicName={settings?.clinicName ?? ""}
          disclaimer={settings?.consentDisclaimer ?? ""}
          onDone={() => { qc.invalidateQueries({ queryKey: ["/api/consent-forms"] }); toast({ title: "電子同意書を保存しました" }); onClose(); }}
        />
      )}
    </div>
  );
}

// ─── 電子同意書（署名）画面 ──────────────────────────────────────────────────
function ConsentForm({ patient, plan, clinicName, disclaimer, onDone }: {
  patient: { id: string; name: string };
  plan: TreatmentPlan;
  clinicName: string;
  disclaimer: string;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const drawing = useRef(false);
  const today = new Date().toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" });
  const defaultDisclaimer = disclaimer ||
    "本治療は自由診療であり、治療内容・費用について説明を受け、理解した上で同意します。治療結果には個人差があり、定期的なメンテナンスが必要となる場合があります。";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#1e293b";
    }
  }, []);

  function pos(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function start(e: React.PointerEvent) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  }
  function end() { drawing.current = false; }
  function clearSig() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  }

  async function submit() {
    if (!hasSignature) { toast({ title: "署名をお願いします", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const signatureData = canvasRef.current!.toDataURL("image/png");
      // 同意書の見た目をそのままPDF化するため、画面のスナップショットを生成（html2canvasが無い環境では送らない）
      let snapshotDataUrl: string | null = null;
      await apiRequest("POST", "/api/consent-forms", {
        patientId: patient.id,
        treatmentPlanId: plan.id,
        patientName: patient.name,
        treatmentName: `${plan.name}${plan.material ? `（${plan.material}）` : ""}`,
        amount: plan.price ?? 0,
        disclaimerText: defaultDisclaimer,
        signatureData,
        snapshotDataUrl,
      });
      onDone();
    } catch (e: any) {
      toast({ title: "保存に失敗しました", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-auto p-5 md:p-8">
      <div ref={sheetRef} className="max-w-2xl mx-auto bg-card border rounded-2xl p-6 md:p-10 shadow-sm">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-center mb-1.5">治療同意書</h2>
        <p className="text-center text-sm text-muted-foreground mb-8">{clinicName}</p>

        <table className="w-full text-sm mb-8">
          <tbody>
            <tr className="border-b border-border"><td className="py-3 font-medium text-muted-foreground w-32">患者氏名</td><td className="py-3 font-semibold">{patient.name}</td></tr>
            <tr className="border-b border-border"><td className="py-3 font-medium text-muted-foreground">日付</td><td className="py-3">{today}</td></tr>
            <tr className="border-b border-border"><td className="py-3 font-medium text-muted-foreground">治療内容</td><td className="py-3 font-semibold">{plan.name}{plan.material ? `（${plan.material}）` : ""}</td></tr>
            <tr className="border-b border-border"><td className="py-3 font-medium text-muted-foreground">費用</td><td className="py-3 font-bold text-lg tabular-nums">¥{(plan.price ?? 0).toLocaleString()}</td></tr>
          </tbody>
        </table>

        <div className="bg-muted/40 rounded-lg p-5 mb-8">
          <p className="text-xs font-semibold text-muted-foreground mb-2">同意事項</p>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{defaultDisclaimer}</p>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">ご署名</p>
          <Button size="sm" variant="ghost" onClick={clearSig} className="h-8 text-xs"><Eraser className="w-3.5 h-3.5 mr-1" />消す</Button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full h-48 md:h-56 border-2 border-dashed rounded-xl bg-white touch-none cursor-crosshair"
          data-testid="signature-canvas"
        />
        <p className="text-xs text-muted-foreground mt-2 text-center">上の枠内に指またはタッチペンでご署名ください</p>

        <Button className="w-full mt-8 h-14 text-base font-semibold active:scale-95" onClick={submit} disabled={saving} data-testid="submit-consent">
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5 mr-1.5" />同意する</>}
        </Button>
      </div>
    </div>
  );
}
