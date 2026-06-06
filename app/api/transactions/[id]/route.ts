import { NextResponse } from "next/server";
import {
  deleteTransaction,
  updateTransaction,
} from "@/lib/transactions";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const transaction = await updateTransaction(id, body);

    return NextResponse.json({ ok: true, transaction });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to update transaction" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTransaction(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to delete transaction" },
      { status: 400 }
    );
  }
}
