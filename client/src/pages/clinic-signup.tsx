import { usePageMeta } from "@/hooks/use-page-meta";
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, CheckCircle2, Copy, ExternalLink, ChevronRight, Loader2, CheckCircle, XCircle, MapPin, Check } from "lucide-react";
import { Link } from "wouter";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "-")
    .replace(/[^\w\-]/g, "")
    .replace(/\-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

export default function ClinicSignupPage() {
  usePageMeta({
    title: "無料で医院を登録 | Arche — 歯科医院向けクラウド予約管理",
    description: "Archeに歯科医院を無料登録。初期費用ゼロ・クレジットカード不要。最短3分で予約ページが発行されます。Sourirette合同会社提供の歯科医院向けクラウドシステム。",
    keywords: "歯科 予約システム 無料登録,歯科医院 クラウド 始め方,歯科 オンライン予約 導入,Arche 登録",
  });
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [phone, setPhone] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [postalLookingUp, setPostalLookingUp] = useState(false);
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"free" | "starter" | "pro" | "enterprise">("free");
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [done, setDone] = useState<{ bookingUrl: string; clinicName: string } | null>(null);

  const toggleAddon = (key: string) =>
    setSelectedAddons(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  useEffect(() => {
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clinics/check-slug?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setSlugAvailable(data.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [slug]);

  const registerMutation = useMutation({
    mutationFn: async () => {
      if (adminPassword !== adminPasswordConfirm) {
        throw new Error("パスワードが一致しません");
      }
      if (adminPassword.length < 6) {
        throw new Error("パスワードは6文字以上で設定してください");
      }
      if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
        throw new Error("スラッグは英小文字・数字・ハイフンのみ使用できます");
      }
      const res = await fetch("/api/clinics/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug, phone, address, email, adminUsername, adminPassword, planType: selectedPlan, addonKeys: selectedAddons }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      return res.json();
    },
    onSuccess: (data) => {
      const origin = window.location.origin;
      setDone({ bookingUrl: `${origin}/book/${data.clinic.slug}`, clinicName: data.clinic.name });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const handlePostalCode = async (v: string) => {
    const digits = v.replace(/[^0-9]/g, "").slice(0, 7);
    setPostalCode(digits);
    if (digits.length === 7) {
      setPostalLookingUp(true);
      try {
        const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`);
        const data = await res.json();
        if (data.results?.[0]) {
          const r = data.results[0];
          setAddress(`${r.address1}${r.address2}${r.address3}`);
        } else {
          toast({ title: "住所が見つかりませんでした", variant: "destructive" });
        }
      } catch {
        toast({ title: "住所の取得に失敗しました", variant: "destructive" });
      } finally {
        setPostalLookingUp(false);
      }
    }
  };

  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManuallyEdited) {
      setSlug(slugify(v));
    }
  };

  const handleSlugChange = (v: string) => {
    setSlugManuallyEdited(true);
    setSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const copyUrl = () => {
    if (done?.bookingUrl) {
      navigator.clipboard.writeText(done.bookingUrl);
      toast({ title: "URLをコピーしました" });
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="pt-8 pb-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">登録完了！</h2>
              <p className="text-gray-600">{done.clinicName} の予約システムが作成されました</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left space-y-2">
              <p className="text-sm font-medium text-blue-900">患者向け予約URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-blue-800 break-all bg-white rounded border px-3 py-2 font-mono">
                  {done.bookingUrl}
                </code>
                <Button variant="outline" size="icon" onClick={copyUrl} data-testid="button-copy-url">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-blue-700">このURLを患者様にお知らせください</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
              <p className="text-sm font-medium text-amber-900 mb-1">管理者ログイン情報</p>
              <p className="text-sm text-amber-800">ユーザー名: <strong>{adminUsername}</strong></p>
              <p className="text-xs text-amber-700 mt-1">管理者画面にログインして、スタッフや診療メニューを設定してください</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button asChild data-testid="button-open-booking">
                <a href={done.bookingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  予約ページを確認する
                </a>
              </Button>
              <Button variant="outline" asChild data-testid="button-go-admin">
                <Link href="/login">
                  管理者画面へログイン
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Arche</h1>
          <p className="text-gray-600 mt-1">歯科医院予約管理システム - 新規医院登録</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>医院情報</CardTitle>
            <CardDescription>予約ページに表示される情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">医院名 *</Label>
              <Input
                id="name"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="例：さくら歯科クリニック"
                data-testid="input-clinic-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">
                予約URLスラッグ *
                <span className="text-xs text-gray-500 ml-2">（英小文字・数字・ハイフンのみ）</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 shrink-0">/book/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  placeholder="sakura-dental"
                  data-testid="input-slug"
                />
              </div>
              {slug && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-blue-600">
                    予約URL: {window.location.origin}/book/{slug}
                  </p>
                  {slugChecking && (
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />確認中...
                    </span>
                  )}
                  {!slugChecking && slugAvailable === true && (
                    <span className="text-xs text-green-600 flex items-center gap-1" data-testid="slug-available">
                      <CheckCircle className="w-3 h-3" />利用可能
                    </span>
                  )}
                  {!slugChecking && slugAvailable === false && (
                    <span className="text-xs text-red-600 flex items-center gap-1" data-testid="slug-taken">
                      <XCircle className="w-3 h-3" />使用済み
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="03-1234-5678"
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="info@example.com"
                  data-testid="input-email"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="postalCode">郵便番号</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 shrink-0">〒</span>
                <Input
                  id="postalCode"
                  value={postalCode}
                  onChange={e => handlePostalCode(e.target.value)}
                  placeholder="1234567（ハイフン不要）"
                  maxLength={7}
                  data-testid="input-postal-code"
                  className="max-w-[200px]"
                />
                {postalLookingUp && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />検索中...
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">住所</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="郵便番号を入力すると自動入力されます"
                  data-testid="input-address"
                  className="pl-9"
                />
              </div>
              {address && (
                <p className="text-xs text-gray-400">番地・建物名は手動で追記してください</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>管理者アカウント</CardTitle>
            <CardDescription>この医院の管理者アカウントを作成します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="adminUsername">管理者ユーザー名 *</Label>
              <Input
                id="adminUsername"
                value={adminUsername}
                onChange={e => setAdminUsername(e.target.value)}
                placeholder="admin"
                data-testid="input-admin-username"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adminPassword">パスワード *</Label>
                <Input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="6文字以上"
                  data-testid="input-admin-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adminPasswordConfirm">パスワード（確認）*</Label>
                <Input
                  id="adminPasswordConfirm"
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={e => setAdminPasswordConfirm(e.target.value)}
                  placeholder="パスワードを再入力"
                  data-testid="input-admin-password-confirm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Selection */}
        <Card>
          <CardHeader>
            <CardTitle>プランを選択</CardTitle>
            <CardDescription>後からスーパー管理者が変更できます</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { id: "free", label: "フリー", price: "¥0", desc: "スタッフ2名・月100件まで", highlight: false },
                { id: "starter", label: "スターター", price: "¥4,980/月", desc: "スタッフ5名・月500件まで", highlight: false },
                { id: "pro", label: "プロ", price: "¥9,800/月", desc: "スタッフ15名・月2,000件まで", highlight: true },
                { id: "enterprise", label: "エンタープライズ", price: "¥19,800/月", desc: "スタッフ・件数 無制限", highlight: false },
              ].map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  data-testid={`plan-${plan.id}`}
                  onClick={() => setSelectedPlan(plan.id as any)}
                  className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                    selectedPlan === plan.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute top-2 right-2 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">人気</span>
                  )}
                  {selectedPlan === plan.id && (
                    <Check className="absolute top-3 right-3 w-4 h-4 text-blue-600" />
                  )}
                  <p className="font-semibold text-gray-900">{plan.label}</p>
                  <p className="text-lg font-bold text-blue-700 mt-0.5">{plan.price}</p>
                  <p className="text-xs text-gray-500 mt-1">{plan.desc}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Addon Selection */}
        <Card>
          <CardHeader>
            <CardTitle>オプション機能</CardTitle>
            <CardDescription>必要な機能を追加できます（後から変更可能）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { key: "recall", name: "患者リコール機能", price: "¥1,980/月", desc: "定期検診の自動リマインド管理" },
                { key: "waitlist", name: "キャンセル待ち機能", price: "¥980/月", desc: "キャンセル発生時に次の患者へ自動通知" },
                { key: "line_reminder", name: "LINEリマインダー", price: "¥1,980/月", desc: "LINE公式アカウントで予約リマインダー送信" },
                { key: "sms_pack", name: "SMS通知パック", price: "¥1,980/月", desc: "SMSで予約確認・リマインダーを送信" },
                { key: "questionnaire", name: "問診票機能", price: "¥1,980/月", desc: "来院前のWeb問診票作成・管理" },
              ].map((addon) => {
                const checked = selectedAddons.includes(addon.key);
                return (
                  <button
                    key={addon.key}
                    type="button"
                    data-testid={`addon-${addon.key}`}
                    onClick={() => toggleAddon(addon.key)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                      checked ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors ${
                      checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
                    }`}>
                      {checked && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{addon.name}</p>
                      <p className="text-xs text-gray-500 truncate">{addon.desc}</p>
                    </div>
                    <span className="text-sm font-semibold text-blue-700 shrink-0">{addon.price}</span>
                  </button>
                );
              })}
            </div>
            {selectedAddons.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                <p className="text-xs text-blue-700 font-medium">
                  選択中のオプション月額: ¥{selectedAddons.reduce((sum, key) => {
                    const prices: Record<string, number> = { recall: 1980, waitlist: 980, line_reminder: 1980, sms_pack: 1980, questionnaire: 1980 };
                    return sum + (prices[key] ?? 0);
                  }, 0).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 text-base"
          onClick={() => registerMutation.mutate()}
          disabled={!name || !slug || !adminUsername || !adminPassword || registerMutation.isPending || slugAvailable === false || slugChecking}
          data-testid="button-register-clinic"
        >
          {registerMutation.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />登録中...</>
          ) : (
            <><ChevronRight className="w-4 h-4 mr-2" />医院を登録する</>
          )}
        </Button>

        <p className="text-center text-sm text-gray-500">
          すでに登録済みの方は
          <Link href="/login" className="text-blue-600 hover:underline ml-1">
            こちらからログイン
          </Link>
        </p>
      </div>
    </div>
  );
}
