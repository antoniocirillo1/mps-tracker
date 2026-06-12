import { NextResponse } from "next/server";
import { saveSubscription } from "@/lib/push";

export async function POST(req: Request) {
  try {
    const sub = await req.json();
    await saveSubscription(sub as PushSubscription);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[push/subscribe]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
