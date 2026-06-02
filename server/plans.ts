export interface PlanLimits {
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

// 実質「無制限」を表す番兵値（UI上は「無制限」と表示する）
export const UNLIMITED = 999999;

// ─────────────────────────────────────────────────────────────────────────────
// 料金プラン定義（これがプラン制限の唯一の正本 / source of truth）
//
//  フリー        ¥0       お試し・客寄せ。基本機能＋メール通知のみ。
//  スタンダード  ¥9,800   一般的な医院の主力。SMS・CSV出力まで。
//  プロ          ¥19,800  本命。LINE通知・リコール・レポートの“稼ぐ”3点セット。
//  エンタープライズ 要相談  複数医院・法人向け（機能はプロと同等＋商談ベース）。
//  パートナー     ¥0       初期協力医院向けの全機能無料枠（今泉歯科など）。
// ─────────────────────────────────────────────────────────────────────────────
export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxStaff: 1,
    maxMonthlyAppointments: 50,
    canExport: false,
    canEmail: true,
    canSms: false,
    canLine: false,
    canRecall: false,
    canReport: false,
    label: "フリー",
    price: "¥0",
  },
  standard: {
    maxStaff: 5,
    maxMonthlyAppointments: UNLIMITED,
    canExport: true,
    canEmail: true,
    canSms: true,
    canLine: false,
    canRecall: false,
    canReport: false,
    label: "スタンダード",
    price: "¥9,800/月",
  },
  pro: {
    maxStaff: UNLIMITED,
    maxMonthlyAppointments: UNLIMITED,
    canExport: true,
    canEmail: true,
    canSms: true,
    canLine: true,
    canRecall: true,
    canReport: true,
    label: "プロ",
    price: "¥19,800/月",
  },
  enterprise: {
    maxStaff: UNLIMITED,
    maxMonthlyAppointments: UNLIMITED,
    canExport: true,
    canEmail: true,
    canSms: true,
    canLine: true,
    canRecall: true,
    canReport: true,
    label: "エンタープライズ",
    price: "要相談",
  },
  partner: {
    maxStaff: UNLIMITED,
    maxMonthlyAppointments: UNLIMITED,
    canExport: true,
    canEmail: true,
    canSms: true,
    canLine: true,
    canRecall: true,
    canReport: true,
    label: "パートナー",
    price: "¥0（初期パートナー）",
  },
};

// 旧プランキーからの後方互換マッピング（DBに古い値が残っていても破綻しないように）
const PLAN_ALIASES: Record<string, string> = {
  starter: "standard",
};

export function normalizePlanType(planType?: string | null): string {
  const key = (planType || "free").toLowerCase();
  if (PLAN_LIMITS[key]) return key;
  if (PLAN_ALIASES[key]) return PLAN_ALIASES[key];
  return "free";
}

export function getPlanLimits(planType?: string | null): PlanLimits {
  return PLAN_LIMITS[normalizePlanType(planType)];
}

// 運営UIで選択肢として出すプラン一覧（順序付き）
export const PLAN_OPTIONS = [
  { key: "free", name: "フリー" },
  { key: "standard", name: "スタンダード" },
  { key: "pro", name: "プロ" },
  { key: "enterprise", name: "エンタープライズ" },
  { key: "partner", name: "パートナー（初期）" },
] as const;

interface PlanDefLookup {
  getPlanDefinitionByKey(key: string): Promise<{ maxStaff?: number | null; maxAppointmentsPerMonth?: number | null } | undefined>;
}

// プラン上限。DBのplan_definitionsに上書き値があれば数値上限のみ反映する。
// 機能フラグ（canLine等）はコードの正本を常に優先する。
export async function getPlanLimitsFromDB(storage: PlanDefLookup, planType: string): Promise<PlanLimits> {
  const base = getPlanLimits(planType);
  try {
    const dbPlan = await storage.getPlanDefinitionByKey(normalizePlanType(planType));
    if (!dbPlan) return base;
    return {
      ...base,
      ...(dbPlan.maxStaff != null ? { maxStaff: dbPlan.maxStaff } : {}),
      ...(dbPlan.maxAppointmentsPerMonth != null ? { maxMonthlyAppointments: dbPlan.maxAppointmentsPerMonth } : {}),
    };
  } catch {
    return base;
  }
}
