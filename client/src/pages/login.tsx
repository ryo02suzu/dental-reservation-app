import { usePageMeta } from "@/hooks/use-page-meta";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Stethoscope, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  usePageMeta({
    title: "ログイン | Arche — 歯科医院向けクラウド管理システム",
    description: "Arche 医院管理者ログインページ。歯科医院向けクラウド予約・患者管理システムにログインしてください。",
  });
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const { data: setupStatus } = useQuery<{ setupNeeded: boolean }>({
    queryKey: ["/api/auth/setup-needed"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/setup-needed");
      return res.json();
    },
  });

  useEffect(() => {
    if (!user) return;
    // 運営(スーパー管理者)はArche Console(全医院一覧)へ、
    // 医院管理者は自院の管理画面へ振り分ける。
    if ((user as any).isSuperAdmin) {
      setLocation("/super-admin");
    } else {
      setLocation("/admin");
    }
  }, [user, setLocation]);

  useEffect(() => {
    if (setupStatus?.setupNeeded) setLocation("/setup");
  }, [setupStatus, setLocation]);

  const form = useForm({
    resolver: zodResolver(insertUserSchema),
    defaultValues: { username: "", password: "" },
  });

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg mb-2">
            <Stethoscope className="w-7 h-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Arche</h1>
          <p className="text-sm text-muted-foreground">次世代予約管理システム</p>
        </div>

        <Card className="border-none shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl font-bold text-center">ログイン</CardTitle>
            <CardDescription className="text-center">
              ユーザー名とパスワードを入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => loginMutation.mutate({ ...data, rememberMe }))}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ユーザー名</FormLabel>
                      <FormControl>
                        <Input placeholder="admin" {...field} data-testid="input-username" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>パスワード</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            {...field}
                            data-testid="input-password"
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            tabIndex={-1}
                            data-testid="button-toggle-password"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <Checkbox
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                    data-testid="checkbox-remember-me"
                  />
                  ログイン状態を保持する
                </label>
                {loginMutation.isError && (
                  <p className="text-sm text-destructive text-center">
                    ユーザー名またはパスワードが正しくありません
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "ログイン中..." : "ログイン"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
