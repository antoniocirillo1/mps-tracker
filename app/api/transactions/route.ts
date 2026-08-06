import { NextResponse } from "next/server";
import { addTransaction, getTransactions } from "@/lib/transactions";
import { sendPushNotification } from "@/lib/push";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const transaction = await addTransaction(body);

    console.log("NEW TRANSACTION:", transaction.rawMessage);

    const label = transaction.recipient ?? "Nuova transazione";

    const amount = transaction.amount
      ? new Intl.NumberFormat("it-IT", {
          style: "currency",
          currency: "EUR",
        }).format(Math.abs(transaction.amount))
      : "";

    await sendPushNotification({
      title: "Hai appena speso altri soldi 💸",
      body: amount ? `${label}, ${amount}` : label,
      transactionId: transaction.id,
      url: "/",
    });

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
