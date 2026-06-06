export type ParsedTransaction = {
  id: string;
  rawMessage: string;
  amount: number | null;
  recipient: string;
  occurredAt: string | null;
  createdAt: string;
  status: "parsed" | "unparsed";
};

type TransactionPayload = {
  rawMessage?: string;
  [key: string]: unknown;
};

declare global {
  // Keeps local/dev data through hot reloads. This is temporary until Supabase.
  var mpsTransactions: ParsedTransaction[] | undefined;
}

const storage = globalThis.mpsTransactions ?? [];

globalThis.mpsTransactions = storage;

export function addTransaction(payload: TransactionPayload) {
  const rawMessage = String(payload.rawMessage ?? "").trim();
  const transaction = parseMpsMessage(rawMessage);

  storage.unshift(transaction);

  return transaction;
}

export function getTransactions() {
  return storage;
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
    status: isParsed ? "parsed" : "unparsed",
  };
}

function parseAmount(message: string) {
  const match = message.match(/operazione\s+di\s+([\d.,]+)\s*euro/i);

  if (!match) {
    return null;
  }

  const normalizedAmount = match[1].replace(",", ".");
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
  const occurredAt = new Date(
    now.getFullYear(),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );

  return Number.isNaN(occurredAt.getTime()) ? null : occurredAt.toISOString();
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
