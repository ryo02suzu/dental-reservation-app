import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertClinicSchema } from "@shared/schema";
import { Check, ChevronRight, Stethoscope } from "lucide-react";

const adminSchema = z.object({
  username: z.string().min(3, "ユーザー名は3文字以上で入力してください"),
  password: z.string().min(6, "パスワードは6文字以上で入力してください"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "パスワードが一致しません",
  path: ["confirmPassword"],
});

type Step = 1 | 2 | 3;

export default function SetupPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);

  const clinicForm = useForm<z.infer<typeof insertClinicSchema>>({
    resolver: zodResolver(insertClinicSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
    },
  });

  const adminForm = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onClinicSubmit = async () => {
    setStep(3);
  };

  const onAdminSubmit = async (data: z.infer<typeof adminSchema>) => {
    try {
      const clinicData = clinicForm.getValues();
      await apiRequest("POST", "/api/auth/setup", {
        username: data.username,
        password: data.password,
        clinicName: clinicData.name,
        clinicPhone: clinicData.phone || "",
        clinicAddress: clinicData.address || "",
      });
      toast({
        title: "セットアップ完了",
        description: "管理者アカウントを作成しました。ログインしてください。",
      });
      setTimeout(() => setLocation("/login"), 800);
    } catch (error: any) {
      toast({
        title: "エラー",
        description: error.message || "管理者アカウントの作成に失敗しました",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg mb-2">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Arche</h1>
          <p className="text-muted-foreground">次世代型歯科医院予約管理システム</p>
        </div>

        <div className="flex justify-between items-center px-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div 
                data-testid={`step-indicator-${s}`}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s ? "bg-primary text-primary-foreground" : 
                  step > s ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 mx-2 ${step > s ? "bg-primary/20" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>Archeへようこそ</CardTitle>
              <CardDescription>
                セットアップを開始して、クリニックの管理をスマートに。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                このウィザードでは、クリニックの基本情報の設定と、最初の管理者アカウントの作成を行います。
              </p>
              <div className="bg-primary/5 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-primary/10 p-1 rounded">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-xs">クラウドベースの予約管理</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-primary/10 p-1 rounded">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-xs">直感的なカレンダーUI</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-primary/10 p-1 rounded">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-xs">電子カルテ・患者管理統合</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={() => setStep(2)} 
                className="w-full"
                data-testid="button-next"
              >
                はじめる
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>クリニック情報</CardTitle>
              <CardDescription>
                クリニックの基本情報を入力してください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...clinicForm}>
                <form className="space-y-4">
                  <FormField
                    control={clinicForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>クリニック名 <span className="text-destructive">*</span></FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="〇〇歯科医院" 
                            data-testid="input-clinic-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clinicForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>電話番号</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value ?? ""}
                            placeholder="03-1234-5678" 
                            data-testid="input-clinic-phone"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={clinicForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>住所</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            value={field.value ?? ""}
                            placeholder="東京都渋谷区..." 
                            data-testid="input-clinic-address"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={clinicForm.handleSubmit(onClinicSubmit)} 
                className="w-full"
                data-testid="button-next"
                disabled={!clinicForm.formState.isValid}
              >
                次へ
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-none shadow-xl">
            <CardHeader>
              <CardTitle>管理者アカウント作成</CardTitle>
              <CardDescription>
                システムにログインするための管理者アカウントを作成します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...adminForm}>
                <form className="space-y-4">
                  <FormField
                    control={adminForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ユーザー名</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="admin" 
                            data-testid="input-admin-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>パスワード</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="password" 
                            data-testid="input-admin-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={adminForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>パスワード（確認）</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            type="password" 
                            data-testid="input-admin-password-confirm"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={adminForm.handleSubmit(onAdminSubmit)} 
                className="w-full"
                data-testid="button-complete"
              >
                セットアップを完了する
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
