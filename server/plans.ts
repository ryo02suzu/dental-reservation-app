export interface PlanLimits {
  maxStaff: number;
  maxMonthlyAppointments: number;
  canExport: boolean;
  canLine: boolean;
  canRecall: boolean;
  canReport: boolean;
  label: string;
  price: string;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxStaff: 1,
    maxMonthlyAppointments: 100,
    canExport: false,
    canLine: false,
    canRecall: false,
    canReport: false,
    label: "フリー",
    price: "¥0",
  },
  starter: {
    maxStaff: 3,
    maxMonthlyAppointments: 99999,
    canExport: true,
    canLine: false,
    canRecall: false,
    canReport: false,
    label: "スターター",
    price: "¥4,980/月",
  },
  pro: {
    maxStaff: 99999,
    maxMonthlyAppointments: 99999,
    canExport: true,
    canLine: true,
    canRecall: true,
    canReport: true,
    label: "プロ",
    price: "¥9,800/月",
  },
  enterprise: {
    maxStaff: 99999,
    maxMonthlyAppointments: 99999,
    canExport: true,
    canLine: true,
    canRecall: true,
    canReport: true,
    label: "エンタープライズ",
    price: "要相談",
  },
  partner: {
    maxStaff: 99999,
    maxMonthlyAppointments: 99999,
    canExport: true,
    canLine: true,
    canRecall: true,
    canReport: true,
    label: "パートナー",
    price: "¥0（初期パートナー）",
  },
};

export function getPlanLimits(planType: string): PlanLimits {
  return PLAN_LIMITS[planType] ?? PLAN_LIMITS.free;
}

interface PlanDefLookup {
  getPlanDefinitionByKey(key: string): Promise<{ maxStaff?: number | null; maxAppointmentsPerMonth?: number | null } | undefined>;
}

export async function getPlanLimitsFromDB(storage: PlanDefLookup, planType: string): Promise<PlanLimits> {
  const base = PLAN_LIMITS[planType] ?? PLAN_LIMITS.free;
  try {
    const dbPlan = await storage.getPlanDefinitionByKey(planType);
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
