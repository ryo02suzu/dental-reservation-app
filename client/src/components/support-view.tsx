import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Send, CheckCircle2, MessageCircle, Mail, ExternalLink } from "lucide-react";

const SUBJECTS = [
  "機能についてのご質問",
  "プラン・料金について",
  "不具合・エラーの報告",
  "オプション機能の追加依頼",
  "その他",
];

export function SupportView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: clinic } = useQuery<{ name: string }>({ queryKey: ["/api/clinic"] });

  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !message) {
      toast({ title: "種別とお問い合わせ内容を入力してください", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user?.username ?? "管理者",
          clinicName: clinic?.name ?? "",
          email: "（管理者画面より送信）",
          phone: "",
          subject,
          message: `【医院名】${clinic?.name ?? "不明"}\n【ユーザー名】${user?.username ?? "不明"}\n\n${message}`,
        }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      toast({ title: "送信に失敗しました。時間をおいて再度お試しください。", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-4 md:px-6 py-4 border-b border-border bg-background">
        <h1 className="text-xl font-bold tracking-tight">お問い合わせ・サポート</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sourirette サポートチームへご連絡ください</p>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-2xl">
        {submitted ? (
          <Card>
            <CardContent className="pt-10 pb-10 text-center space-y-4">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">お問い合わせを受け付けました</h2>
                <p className="text-sm text-muted-foreground mt-1">担当者より2営業日以内にご連絡いたします。</p>
              </div>
              <Button variant="outline" onClick={() => { setSubmitted(false); setSubject(""); setMessage(""); }}>
                別の件で問い合わせる
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                お問い合わせフォーム
              </CardTitle>
              <CardDescription>
                医院名・ユーザー名は自動的に送信されます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm">医院名</Label>
                    <Input value={clinic?.name ?? ""} disabled className="bg-muted/50 text-muted-foreground" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">ユーザー名</Label>
                    <Input value={user?.username ?? ""} disabled className="bg-muted/50 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">お問い合わせ種別 <span className="text-destructive">*</span></Label>
                  <Select onValueChange={setSubject}>
                    <SelectTrigger data-testid="select-support-subject">
                      <SelectValue placeholder="種別を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">お問い合わせ内容 <span className="text-destructive">*</span></Label>
                  <Textarea
                    data-testid="input-support-message"
                    placeholder="詳細をご記入ください"
                    rows={6}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full"
                  data-testid="button-submit-support"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      送信中...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2"><Send className="w-4 h-4" />送信する</span>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="w-4 h-4" />
              直接メールで問い合わせる
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              フォーム以外でもメールにて受け付けています。
            </p>
            <a
              href="mailto:sourirette.consulting@gmail.com"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
            >
              sourirette.consulting@gmail.com
              <ExternalLink className="w-3 h-3" />
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
