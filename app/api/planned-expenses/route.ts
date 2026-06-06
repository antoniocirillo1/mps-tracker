import { NextResponse } from "next/server";
import {
  addPlannedExpense,
  getPlannedExpenses,
} from "@/lib/planned-expenses";

export async function GET() {
  try {
    return NextResponse.json(await getPlannedExpenses());
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to load planned expenses" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const expense = await addPlannedExpense(body);

    return NextResponse.json({ ok: true, expense });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { ok: false, error: "Unable to save planned expense" },
      { status: 400 }
    );
  }
}
