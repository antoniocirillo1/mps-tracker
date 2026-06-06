export type ParsedTransaction = {
  id: string;
  rawMessage: string;
  amount: number | null;
  recipient: string;
  occurredAt: string | null;
  createdAt: string;
  source: "sms" | "manual";
  status: "parsed" | "unparsed";
};

type TransactionPayload = {
  rawMessage?: string;
  amount?: number | string;
  recipient?: string;
  occurredAt?: string;
  source?: "sms" | "manual";
  [key: string]: unknown;
};

type SupabaseTransaction = {
  id: string;
  raw_message: string | null;
  amount: number | string | null;
  recipient: string;
  occurred_at: string;
  source: "sms" | "manual";
  created_at: string;
};

type InsertTransaction = {
  raw_message: string | null;
  amount: number | null;
  recipient: string;
  occurred_at: string;
  source: "sms" | "manual";
};

export async function addTransaction(payload: TransactionPayload) {
  const transaction =
    payload.source === "manual"
      ? parseManualTransaction(payload)
      : parseMpsMessage(String(payload.rawMessage ?? "").trim());

  const [savedTransaction] = await supabaseRequest<SupabaseTransaction[]>(
    "/transactions?select=*",
    {
      method: "POST",
      body: JSON.stringify(toInsertTransaction(transaction)),
    }
  );

  return fromSupabaseTransaction(savedTransaction);
}

export async function getTransactions() {
  const transactions = await supabaseRequest<SupabaseTransaction[]>(
    "/transactions?select=*&order=occurred_at.desc"
  );

  return transactions.map(fromSupabaseTransaction);
}

function parseMpsMessage(rawMessage: string): ParsedTransaction {
  const createdAt = new Date().toISOString();
  const amount = parseAmount(rawMessage);
  const occurredAt = parseOccurredAt(rawMessage);
  const recipient = parseRecipient(rawMessage);
  const isParsed = amount !== null && occurredAt !== null && recipient !== null;

  return {
    id: crypto.randomUUID(),
    rawMessage,
    amount,
    recipient: recipient ?? "Da classificare",
    occurredAt,
    createdAt,
    source: "sms",
    status: isParsed ? "parsed" : "unparsed",
  };
}

function parseManualTransaction(payload: TransactionPayload): ParsedTransaction {
  const recipient = String(payload.recipient ?? "").trim();
  const amount = normalizeAmount(payload.amount);
  const occurredAt = String(payload.occurredAt ?? "").trim();

  if (!recipient || amount === null || !occurredAt) {
    throw new Error("Manual transaction is incomplete");
  }

  return {
    id: crypto.randomUUID(),
    rawMessage: `Inserimento manuale: ${recipient}`,
    amount,
    recipient,
    occurredAt,
    createdAt: new Date().toISOString(),
    source: "manual",
    status: "parsed",
  };
}

function parseAmount(message: string) {
  const match = message.match(/operazione\s+di\s+([\d.,]+)\s*euro/i);

  if (!match) {
    return null;
  }

  return normalizeAmount(match[1]);
}

function normalizeAmount(value: unknown) {
  const normalizedAmount = String(value ?? "").replace(",", ".");
  const amount = Number.parseFloat(normalizedAmount);

  return Number.isFinite(amount) ? amount : null;
}

function parseOccurredAt(message: string) {
  const match = message.match(/(\d{1,2})\/(\d{1,2}),\s*ore\s*(\d{1,2})[.:](\d{2})/i);

  if (!match) {
    return null;
  }

  const [, day, month, hour, minute] = match;
  const now = new Date();
  const year = now.getFullYear();
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const hourNumber = Number(hour);
  const minuteNumber = Number(minute);
  const occurredAt = new Date(
    year,
    monthNumber - 1,
    dayNumber,
    hourNumber,
    minuteNumber
  );

  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  return `${year}-${padDatePart(monthNumber)}-${padDatePart(dayNumber)}T${padDatePart(hourNumber)}:${padDatePart(minuteNumber)}:00`;
}

function parseRecipient(message: string) {
  const details = message.match(/\(([^)]*)\)/)?.[1];

  if (!details) {
    return null;
  }

  const parts = details
    .split(" - ")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts[1] ?? null;
}

function toInsertTransaction(
  transaction: ParsedTransaction
): InsertTransaction {
  return {
    raw_message: transaction.rawMessage,
    amount: transaction.amount,
    recipient: transaction.recipient,
    occurred_at: transaction.occurredAt ?? toLocalDateTime(new Date()),
    source: transaction.source,
  };
}

function fromSupabaseTransaction(
  transaction: SupabaseTransaction
): ParsedTransaction {
  return {
    id: transaction.id,
    rawMessage: transaction.raw_message ?? "",
    amount:
      transaction.amount === null ? null : Number.parseFloat(String(transaction.amount)),
    recipient: transaction.recipient,
    occurredAt: transaction.occurred_at,
    createdAt: transaction.created_at,
    source: transaction.source,
    status: transaction.amount === null ? "unparsed" : "parsed",
  };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing Supabase environment variables");
  }

  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed: ${message}`);
  }

  return (await response.json()) as T;
}

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

function toLocalDateTime(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:00`;
}
