import { NextResponse } from "next/server";
import { addTransaction, getTransactions } from "@/lib/transactions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const transaction = await addTransaction(body);

    console.log("NEW TRANSACTION:", transaction.rawMessage);

    return NextResponse.json({ ok: true, transaction });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to save transaction" },
      { status: 400 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json(await getTransactions());
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to load transactions" },
      { status: 500 }
    );
  }
}
