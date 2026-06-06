import { NextResponse } from "next/server";

type TransactionPayload = {
  rawMessage?: string;
  [key: string]: unknown;
};

type StoredTransaction = TransactionPayload & {
  createdAt: string;
};

const memory: StoredTransaction[] = [];

export async function POST(req: Request) {
  const body = (await req.json()) as TransactionPayload;
  const rawMessage = String(body.rawMessage ?? "");

  memory.push({
    ...body,
    createdAt: new Date().toISOString(),
  });

  console.log("NEW TRANSACTION:", rawMessage);

  return NextResponse.json({ ok: true, rawMessage });
}

export async function GET() {
  return NextResponse.json(memory);
}
