"use client";

import { useEffect, useState } from "react";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    buffer[i] = rawData.charCodeAt(i);
  }
  return buffer.buffer as ArrayBuffer;
}

function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function PushNotificationSetup() {
  // "idle" | "prompt" | "loading" | "granted" | "denied" | "unsupported"
  const [status, setStatus] = useState<
    "idle" | "prompt" | "loading" | "granted" | "denied" | "unsupported"
  >("idle");

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }

    // Registra il SW subito (non serve gesto utente per questo)
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});

    const current = Notification.permission;
    if (current === "granted") {
      // Già autorizzato: assicurati che la subscription sia salvata
      ensureSubscribed().then(() => setStatus("granted"));
    } else if (current === "denied") {
      setStatus("denied");
    } else {
      // "default" → mostra il banner
      setStatus("prompt");
    }
  }, []);

  async function ensureSubscribed() {
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });
    } catch (err) {
      console.warn("[push] ensureSubscribed failed:", err);
    }
  }

  // Chiamato dal tap del bottone — qui il gesto utente c'è
  async function handleEnable() {
    setStatus("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }
      await ensureSubscribed();
      setStatus("granted");
    } catch (err) {
      console.warn("[push] handleEnable failed:", err);
      setStatus("denied");
    }
  }

  // Non mostrare nulla se già ok, non supportato o ancora idle
  if (status === "granted" || status === "unsupported" || status === "idle") {
    return null;
  }

  if (status === "denied") {
    return null; // silenzioso — l'utente ha negato
  }

  // status === "prompt" | "loading"
  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        background: "#17202f",
        color: "#fff",
        borderRadius: "0.75rem",
        padding: "0.875rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.875rem",
        boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
        maxWidth: "calc(100vw - 2rem)",
        width: "max-content",
        fontSize: "0.875rem",
        fontFamily: "inherit",
      }}
    >
      <span>🔔</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>
        Attiva le notifiche per ricevere gli aggiornamenti sulle spese
      </span>
      <button
        onClick={handleEnable}
        disabled={status === "loading"}
        style={{
          background: "#0f8f8c",
          color: "#fff",
          border: "none",
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
          fontWeight: 600,
          fontSize: "0.8125rem",
          cursor: status === "loading" ? "not-allowed" : "pointer",
          opacity: status === "loading" ? 0.7 : 1,
          whiteSpace: "nowrap",
          fontFamily: "inherit",
        }}
      >
        {status === "loading" ? "..." : "Attiva"}
      </button>
    </div>
  );
}
