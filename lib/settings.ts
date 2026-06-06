import { supabaseRequest } from "@/lib/supabase";

export type TrackerSettings = {
  salaryAnchorDate: string;
  monthlyIncome: number;
  savingsGoal: number;
  updatedAt: string;
};

type SupabaseSettings = {
  id: string;
  salary_anchor_date: string;
  monthly_income: number | string;
  savings_goal: number | string;
  updated_at: string;
};

type SettingsPayload = {
  salaryAnchorDate?: string;
  monthlyIncome?: number | string;
  savingsGoal?: number | string;
};

const SETTINGS_ID = "main";
const DEFAULT_MONTHLY_INCOME = 1930;
const DEFAULT_SAVINGS_GOAL = 300;

export async function getTrackerSettings() {
  const settings = await supabaseRequest<SupabaseSettings[]>(
    `/tracker_settings?id=eq.${SETTINGS_ID}&select=*`
  );

  if (settings.length === 0) {
    return getDefaultSettings();
  }

  return fromSupabaseSettings(settings[0]);
}

export async function updateTrackerSettings(payload: SettingsPayload) {
  const salaryAnchorDate = String(payload.salaryAnchorDate ?? "").trim();
  const monthlyIncome = normalizeAmount(
    payload.monthlyIncome ?? DEFAULT_MONTHLY_INCOME
  );
  const savingsGoal = normalizeAmount(payload.savingsGoal ?? DEFAULT_SAVINGS_GOAL);

  if (!salaryAnchorDate || monthlyIncome === null || savingsGoal === null) {
    throw new Error("Tracker settings are incomplete");
  }

  const [settings] = await supabaseRequest<SupabaseSettings[]>(
    "/tracker_settings?on_conflict=id&select=*",
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        id: SETTINGS_ID,
        salary_anchor_date: salaryAnchorDate,
        monthly_income: monthlyIncome,
        savings_goal: savingsGoal,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  return fromSupabaseSettings(settings);
}

function getDefaultSettings(): TrackerSettings {
  return {
    salaryAnchorDate: getSalaryPeriodStartDateKey(),
    monthlyIncome: DEFAULT_MONTHLY_INCOME,
    savingsGoal: DEFAULT_SAVINGS_GOAL,
    updatedAt: new Date().toISOString(),
  };
}

function fromSupabaseSettings(settings: SupabaseSettings): TrackerSettings {
  return {
    salaryAnchorDate: settings.salary_anchor_date,
    monthlyIncome: Number(settings.monthly_income),
    savingsGoal: Number(settings.savings_goal),
    updatedAt: settings.updated_at,
  };
}

function normalizeAmount(value: unknown) {
  const normalizedAmount = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const amount = Number.parseFloat(normalizedAmount);

  return Number.isFinite(amount) ? amount : null;
}

function getSalaryPeriodStartDateKey() {
  const today = new Date();
  const startDate = new Date(today);

  startDate.setDate(20);

  if (today.getDate() < 20) {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  return getLocalDayKey(startDate);
}

function getLocalDayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
