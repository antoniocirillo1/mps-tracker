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

/** Salva (o aggiorna) una subscription nel DB */
export async function saveSubscription(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON();

  await supabaseRequest("/push_subscriptions", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    }),
  });
}

/** Recupera tutte le subscriptions attive */
export async function getSubscriptions(): Promise<PushSubscriptionRecord[]> {
  return (
    (await supabaseRequest<PushSubscriptionRecord[]>("/push_subscriptions")) ??
    []
  );
}

/** Invia una notifica push a tutti i dispositivi registrati */
export async function sendPushNotification(payload: {
  title: string;
  body: string;
  transactionId?: string;
  url?: string;
}): Promise<void> {
  const subscriptions = await getSubscriptions();

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    )
  );
}
