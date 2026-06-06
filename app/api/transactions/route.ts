import { NextResponse } from "next/server";
import { addTransaction, getTransactions } from "@/lib/transactions";

export async function POST(req: Request) {
  const body = await req.json();
  const transaction = addTransaction(body);

  console.log("NEW TRANSACTION:", transaction.rawMessage);

  return NextResponse.json({ ok: true, transaction });
}

export async function GET() {
  return NextResponse.json(getTransactions());
}
