import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// ── Your VAPID public key — generate at: https://vapidkeys.com ───────────────
// After generating, also set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Supabase secrets
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output.buffer as ArrayBuffer;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed,  setIsSubscribed]  = useState(false);
  const [isSupported,   setIsSupported]   = useState(false);
  const [isLoading,     setIsLoading]     = useState(false);
  const [permission,    setPermission]    = useState<NotificationPermission>("default");

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!isSupported || !user) return;
    checkSubscription();
    registerServiceWorker();
  }, [isSupported, user]);

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[Push] Service worker registered:", reg.scope);
    } catch (err) {
      console.error("[Push] SW registration failed:", err);
    }
  };

  const checkSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.error("[Push] Check subscription failed:", err);
    }
  };

  const subscribe = async (): Promise<boolean> => {
    if (!user || !VAPID_PUBLIC_KEY) {
      toast.error("Push notifications not configured. Contact admin.");
      return false;
    }

    setIsLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Notification permission denied. Please allow notifications in your browser settings.");
        return false;
      }

      // Get SW registration
      const reg = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Save subscription to Supabase
      const subJson = subscription.toJSON() as any;
      const { error } = await (supabase.from("push_subscriptions" as any) as any).upsert({
        user_id:      user.id,
        endpoint:     subscription.endpoint,
        subscription: subJson,
      }, { onConflict: "user_id,endpoint" });

      if (error) throw error;

      setIsSubscribed(true);
      toast.success("✅ Push notifications enabled! You'll be notified when payments are confirmed.");
      return true;
    } catch (err: any) {
      console.error("[Push] Subscribe failed:", err);
      toast.error(`Failed to enable notifications: ${err.message}`);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await (supabase.from("push_subscriptions" as any) as any)
          .delete()
          .eq("user_id", user?.id)
          .eq("endpoint", sub.endpoint);
      }
      setIsSubscribed(false);
      toast.success("Push notifications disabled.");
    } catch (err: any) {
      toast.error(`Failed to disable: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe };
};
