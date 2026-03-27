import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const PushNotificationBanner = () => {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("push-banner-dismissed") === "true");

  // Don't show if not supported, already subscribed, or dismissed
  if (!isSupported || isSubscribed || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("push-banner-dismissed", "true");
  };

  if (permission === "denied") return (
    <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm">
      <BellOff className="h-4 w-4 text-accent shrink-0" />
      <p className="text-muted-foreground flex-1">
        Push notifications are blocked. To enable, click the 🔒 lock icon in your browser address bar and allow notifications.
      </p>
      <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
    </div>
  );

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Enable Payment Notifications</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Get instant browser alerts + email receipts when the cashier confirms your payment.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" variant="hero" className="h-8 text-xs gap-1.5 rounded-lg" onClick={subscribe} disabled={isLoading}>
          {isLoading ? "Enabling…" : <><Bell className="h-3 w-3" /> Enable</>}
        </Button>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PushNotificationBanner;
