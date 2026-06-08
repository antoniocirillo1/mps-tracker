import { supabaseRequest } from "@/lib/supabase";

export type ParsedTransaction = {
  id: string;
  rawMessage: string;
  amount: number | null;
  recipient: string;
  occurredAt: string | null;
  createdAt: string;
  source: TransactionSource;
  status: "parsed" | "unparsed";
};

type TransactionSource = "sms" | "manual" | "email";

type TransactionPayload = {
  rawMessage?: string;
  emailSubject?: string;
  emailBody?: string;
  emailDate?: string;
  amount?: number | string;
  recipient?: string;
  occurredAt?: string;
  source?: TransactionSource;
  [key: string]: unknown;
};

type SupabaseTransaction = {
  id: string;
  raw_message: string | null;
  amount: number | string | null;
  recipient: string;
  occurred_at: string;
  source: TransactionSource;
  created_at: string;
};

type InsertTransaction = {
  raw_message: string | null;
  amount: number | null;
  recipient: string;
  occurred_at: string;
  source: TransactionSource;
};

export async function addTransaction(payload: TransactionPayload) {
  const transaction = parseTransaction(payload);

  const [savedTransaction] = await supabaseRequest<SupabaseTransaction[]>(
    "/transactions?select=*",
    {
      method: "POST",
      body: JSON.stringify(toInsertTransaction(transaction)),
    }
  );

  return fromSupabaseTransaction(savedTransaction);
}

function parseTransaction(payload: TransactionPayload) {
  if (payload.source === "manual") {
    return parseManualTransaction(payload);
  }

  if (payload.source === "email") {
    return parseMpsEmail(payload);
  }

  return parseMpsMessage(String(payload.rawMessage ?? "").trim());
}

export async function getTransactions() {
  const transactions = await supabaseRequest<SupabaseTransaction[]>(
    "/transactions?select=*&order=occurred_at.desc"
  );

  return transactions.map(fromSupabaseTransaction);
}

export async function updateTransaction(
  id: string,
  payload: Pick<TransactionPayload, "amount" | "recipient" | "occurredAt">
) {
  const recipient = String(payload.recipient ?? "").trim();
  const amount = normalizeAmount(payload.amount);
  const occurredAt = String(payload.occurredAt ?? "").trim();

  if (!recipient || amount === null || !occurredAt) {
    throw new Error("Transaction update is incomplete");
  }

  const [transaction] = await supabaseRequest<SupabaseTransaction[]>(
    `/transactions?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: "PATCH",
      body: JSON.stringify({
        amount,
        recipient,
        occurred_at: occurredAt,
      }),
    }
  );

  return fromSupabaseTransaction(transaction);
}

export async function deleteTransaction(id: string) {
  await supabaseRequest<null>(
    `/transactions?id=eq.${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Prefer: "return=minimal",
      },
    }
  );
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

// Riconosce se la mail è un accredito ricevuto (entrata)
function isReceivedEmail(subject: string): boolean {
  return subject.toLowerCase().includes("accredito in conto");
}

function parseMpsEmail(payload: TransactionPayload): ParsedTransaction {
  const subject = String(payload.emailSubject ?? "").trim();
  const body = normalizeWhitespace(String(payload.emailBody ?? "").trim());
  const rawMessage = [subject, body].filter(Boolean).join("\n\n");
  const parsedAmount = parseEmailAmount(body);
  const occurredAt = parseEmailOccurredAt(body, payload.emailDate);
  const isParsed = parsedAmount !== null && occurredAt !== null;

  // Se è un accredito, l'amount è NEGATIVO (entrata → si sottrae al totale spese)
  const amount =
    parsedAmount !== null
      ? isReceivedEmail(subject)
        ? -Math.abs(parsedAmount)
        : Math.abs(parsedAmount)
      : null;

  const recipient = isReceivedEmail(subject)
    ? formatReceivedRecipient(body)     // per gli accrediti prendiamo il mittente
    : parseEmailRecipient(body); // per i bonifici prendiamo la causale

  return {
    id: crypto.randomUUID(),
    rawMessage,
    amount,
    recipient: recipient ?? (isReceivedEmail(subject) ? "Accredito MPS" : "Bonifico MPS"),
    occurredAt,
    createdAt: new Date().toISOString(),
    source: "email",
    status: isParsed ? "parsed" : "unparsed",
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
  const normalizedAmount = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const amount = Number.parseFloat(normalizedAmount);

  return Number.isFinite(amount) ? amount : null;
}

function parseEmailAmount(message: string) {
  const match = message.match(/Importo\s+([\d.,]+)\s*(?:€|EUR)?/i);

  return match ? normalizeAmount(match[1]) : null;
}

function parseEmailRecipient(message: string) {
  const match = message.match(/Causale\s+(.+?)(?:\s{2,}|$)/i);

  return match?.[1]?.trim() || null;
}
function formatReceivedRecipient(message: string) {
  const sender = parseEmailSender(message);
  const causale = parseEmailRecipient(message); // riusa il parser della causale

  if (causale && sender) return `${causale} - ${sender}`;
  if (causale) return causale;
  if (sender) return sender;
  return null;
}
// Nuovo parser per il mittente negli accrediti
function parseEmailSender(message: string) {
  const match = message.match(/Ordinante\s+(.+?)(?:\s{2,}|$)/i);

  return match?.[1]?.trim() || null;
}

function parseEmailOccurredAt(message: string, emailDate: unknown) {
  const dateMatch =
    message.match(/Bonifico istantaneo inserito il\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i) ??
    message.match(/Data di accredito\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i) ??
    message.match(/Data operazione\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i); // ← formato accrediti

  if (!dateMatch) {
    return null;
  }

  const [, day, month, year] = dateMatch;
  const receivedAt = new Date(String(emailDate ?? ""));
  const hour = Number.isNaN(receivedAt.getTime()) ? 0 : receivedAt.getHours();
  const minute = Number.isNaN(receivedAt.getTime()) ? 0 : receivedAt.getMinutes();

  return `${year}-${padDatePart(Number(month))}-${padDatePart(Number(day))}T${padDatePart(hour)}:${padDatePart(minute)}:00`;
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
  const occurredAt = new Date(year, monthNumber - 1, dayNumber, hourNumber, minuteNumber);

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

function normalizeWhitespace(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
}

function toInsertTransaction(transaction: ParsedTransaction): InsertTransaction {
  return {
    raw_message: transaction.rawMessage,
    amount: transaction.amount,
    recipient: transaction.recipient,
    occurred_at: transaction.occurredAt ?? toLocalDateTime(new Date()),
    source: transaction.source,
  };
}

function fromSupabaseTransaction(transaction: SupabaseTransaction): ParsedTransaction {
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

function padDatePart(value: number) {
  return value.toString().padStart(2, "0");
}

function toLocalDateTime(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}T${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}:00`;
}