"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";

export const ORDERS_REFRESH_EVENT = "crafteey:orders-refresh";

export default function PushRegistrar() {
  const { getToken } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles: { remove: () => Promise<void> }[] = [];
    let cancelled = false;

    (async () => {
      try {
        await PushNotifications.createChannel({
          id: "orders",
          name: "New orders",
          importance: 5,
          vibration: true,
        });

        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted" || cancelled) return;

        handles.push(
          await PushNotifications.addListener("registration", (t) => {
            apiFetch(getToken, "/api/vendor/push-token", {
              method: "POST",
              body: JSON.stringify({ token: t.value }),
            }).catch(() => {});
          }),
          // App open: Android shows no banner, so refresh the order screens instead
          await PushNotifications.addListener("pushNotificationReceived", () => {
            window.dispatchEvent(new Event(ORDERS_REFRESH_EVENT));
          }),
          // Notification tapped
          await PushNotifications.addListener("pushNotificationActionPerformed", (a) => {
            const orderId = a.notification.data?.orderId;
            router.push(orderId ? `/dashboard/orders/${orderId}` : "/dashboard/orders");
          })
        );

        await PushNotifications.register();
      } catch (err) {
        console.error("push setup failed", err);
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove());
    };
  }, [getToken, router]);

  return null;
}