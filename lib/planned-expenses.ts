import { supabaseRequest } from "@/lib/supabase";

export type PlannedExpense = {
  id: string;
  recipient: string;
  amount: number;
  dayOfMonth: number;
  createdAt: string;
  updatedAt: string;
};

type SupabasePlannedExpense = {
  id: string;
  recipient: string;
  amount: number | string;
  day_of_month: number;
  created_at: string;
  updated_at: string;
};

type PlannedExpensePayload = {
  recipient?: string;
  amount?: number | string;
  dayOfMonth?: number | string;
};

export async function getPlannedExpenses() {
  const expenses = await supabaseRequest<SupabasePlannedExpense[]>(
    "/planned_expenses?select=*&order=day_of_month.asc"
  );

  return expenses.map(fromSupabasePlannedExpense);
}

export async function addPlannedExpense(payload: PlannedExpensePayload) {
  const data = toSupabasePayload(payload);
  const [expense] = await supabaseRequest<SupabasePlannedExpense[]>(
    "/planned_expenses?select=*",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );

  return fromSupabasePlannedExpense(expense);
}

export async function updatePlannedExpense(
  id: string,
  payload: PlannedExpensePayload
) {
  const data = toSupabasePayload(payload);
  const [expense] = await supabaseRequest<SupabasePlannedExpense[]>(
    `/planned_expenses?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...data,
        updated_at: new Date().toISOString(),
      }),
    }
  );

  return fromSupabasePlannedExpense(expense);
}

export async function deletePlannedExpense(id: string) {
  await supabaseRequest<null>(
    `/planned_expenses?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  );
}

function toSupabasePayload(payload: PlannedExpensePayload) {
  const recipient = String(payload.recipient ?? "").trim();
  const amount = normalizeAmount(payload.amount);
  const dayOfMonth = Number(payload.dayOfMonth);

  if (
    !recipient ||
    amount === null ||
    !Number.isInteger(dayOfMonth) ||
    dayOfMonth < 1 ||
    dayOfMonth > 31
  ) {
    throw new Error("Planned expense is incomplete");
  }

  return {
    recipient,
    amount,
    day_of_month: dayOfMonth,
  };
}

function fromSupabasePlannedExpense(
  expense: SupabasePlannedExpense
): PlannedExpense {
  return {
    id: expense.id,
    recipient: expense.recipient,
    amount: Number(expense.amount),
    dayOfMonth: expense.day_of_month,
    createdAt: expense.created_at,
    updatedAt: expense.updated_at,
  };
}

function normalizeAmount(value: unknown) {
  const normalizedAmount = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const amount = Number.parseFloat(normalizedAmount);

  return Number.isFinite(amount) ? amount : null;
}
