import { NextResponse } from "next/server";
import { sendPushNotification, getSubscriptions } from "@/lib/push";

// GET /api/push/test — chiama da browser per testare il send
export async function GET() {
  try {
    const subs = await getSubscriptions();
    console.log("[push/test] subscriptions found:", subs.length);

    await sendPushNotification({
      title: "Test notifica 🔔",
      body: "Se vedi questo, le notifiche funzionano!",
      url: "/",
    });

    return NextResponse.json({ ok: true, subscriptionsCount: subs.length });
  } catch (error) {
    console.error("[push/test] error:", error);
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
