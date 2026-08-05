import webpush from "web-push";
import { supabaseRequest } from "@/lib/supabase";

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL!}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export interface PushSubscriptionRecord {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface RawSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSubscription(sub: RawSubscriptionBody): Promise<void> {
  await supabaseRequest("/push_subscriptions", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh,
      auth: sub.keys?.auth,
    }),
  });
}

export async function getSubscriptions(): Promise<PushSubscriptionRecord[]> {
  return (
    (await supabaseRequest<PushSubscriptionRecord[]>("/push_subscriptions")) ?? []
  );
}

export async function sendPushNotification(payload: {
  title: string;
  body: string;
  transactionId?: string;
  url?: string;
}): Promise<void> {
  const subscriptions = await getSubscriptions();
  console.log(`[push] sending to ${subscriptions.length} subscription(s)`);

  const results = await Promise.allSettled(
    subscriptions.map((sub) => {
      console.log(`[push] sending to endpoint: ${sub.endpoint.slice(0, 60)}...`);
      return webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    })
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`[push] failed for subscription ${i}:`, result.reason);
    } else {
      console.log(`[push] success for subscription ${i}, statusCode:`, result.value.statusCode);
    }
  });
}
