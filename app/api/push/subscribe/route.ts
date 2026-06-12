import { NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    await saveSubscription(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push/subscribe]", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
