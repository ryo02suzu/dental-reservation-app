import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface PlanLimits {
  maxStaff: number;
  maxMonthlyAppointments: number;
  canExport: boolean;
  canEmail: boolean;
  canSms: boolean;
  canLine: boolean;
  canRecall: boolean;
  canReport: boolean;
  label: string;
  price: string;
}

interface PlanInfo {
  planType: string;
  limits: PlanLimits;
  usage: { staffCount: number; monthlyAppointments: number };
}

export function usePlan() {
  const { user } = useAuth();

  const { data } = useQuery<PlanInfo>({
    queryKey: ["/api/my-plan"],
    enabled: !!user,
    staleTime: 0,
  });

  const planType = data?.planType ?? "free";
  const limits = data?.limits;

  return {
    planType,
    limits,
    canRecall: limits?.canRecall ?? false,
    canReport: limits?.canReport ?? false,
    canLine: limits?.canLine ?? false,
    canSms: limits?.canSms ?? false,
    canEmail: limits?.canEmail ?? true,
    canExport: limits?.canExport ?? false,
    isPro: ["pro", "enterprise", "partner"].includes(planType),
    // スタンダード相当以上（CSV出力・SMSが使える層）。旧"starter"も後方互換で含める。
    isStandard: ["standard", "starter", "pro", "enterprise", "partner"].includes(planType),
    isFree: planType === "free",
    planLabel: limits?.label ?? "フリー",
  };
}
