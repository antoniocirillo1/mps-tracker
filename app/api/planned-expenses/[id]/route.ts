import { NextResponse } from "next/server";
import {
  deletePlannedExpense,
  updatePlannedExpense,
} from "@/lib/planned-expenses";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const expense = await updatePlannedExpense(id, body);

    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to update planned expense" },
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
    await deletePlannedExpense(id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to delete planned expense" },
      { status: 400 }
    );
  }
}
