import VendorBottomNav from "@/components/VendorBottomNav";
import { useState } from "react";
import { Bell, BellOff, CreditCard, Megaphone, AlertTriangle, Loader2, X, Printer, CheckCircle2, Info, CheckCheck, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";

const DS = {
  gradientHeader: "linear-gradient(160deg, #0d2240 0%, #1a3a5f 45%, #1d4ed8 80%, #2563eb 100%)",
  blue900: "#0d2240",
  blue600: "#2563eb",
  blue50:  "#eff6ff",
  blue100: "#dbeafe",
};

const TYPE_ICON:  Record<string, any>    = { reminder: Bell, confirmation: CreditCard, announcement: Megaphone, overdue: AlertTriangle, info: Bell };
const TYPE_STYLE: Record<string, { bg: string; icon: string }> = {
  reminder:     { bg: "#dbeafe", icon: "#2563eb" },
  confirmation: { bg: "#dcfce7", icon: "#16a34a" },
  announcement: { bg: "#f1f5f9", icon: "#64748b" },
  overdue:      { bg: "#fee2e2", icon: "#dc2626" },
  info:         { bg: "#dbeafe", icon: "#2563eb" },
};

const parseReceiptFromMessage = (message: string): Record<string, string> | null => {
  if (!message?.includes("•")) return null;
  const lines  = message.split("\n").filter(l => l.trim().startsWith("•"));
  if (lines.length < 3) return null;
  const result: Record<string, string> = {};
  lines.forEach(line => {
    const clean = line.replace("•", "").trim();
    const idx   = clean.indexOf(":");
    if (idx === -1) return;
    result[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
  });
  return Object.keys(result).length >= 3 ? result : null;
};

const printReceipt = (title: string, details: Record<string, string>, amount: string) => {
  const rows = Object.entries(details)
    .filter(([k]) => k !== "Amount Paid" && k !== "Amount")
    .map(([k, v]) => `<div class="row"><span class="lbl">${k}</span><span class="val">${v}</span></div>`)
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px;max-width:320px}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
  .rep{font-size:9px;letter-spacing:1px;color:#666;text-transform:uppercase}
  .lgu{font-size:13px;font-weight:bold}
  .ttl{font-size:16px;font-weight:bold;margin-top:4px}
  .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ddd;font-size:11px}
  .lbl{color:#555} .val{font-weight:bold;text-align:right;max-width:55%}
  .amt{text-align:center;border:2px solid #111;border-radius:4px;padding:10px;margin:12px 0}
  .amt .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555}
  .amt .value{font-size:22px;font-weight:bold;font-family:monospace;margin-top:2px}
  .footer{margin-top:14px;text-align:center;font-size:9px;color:#888;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines</div>
  <div class="lgu">Municipality of San Juan, Batangas</div>
  <div class="rep" style="margin-top:2px">Office of the Municipal Treasurer</div>
  <div class="ttl">OFFICIAL RECEIPT</div>
</div>
${rows}
<div class="amt">
  <div class="label">Amount Paid</div>
  <div class="value">${amount}</div>
</div>
<div class="footer">PALENG-CLICK · Valid proof of payment · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
};

// ─── Receipt Modal ─────────────────────────────────────────────────────────────
const ReceiptModal = ({ notification, onClose }: { notification: any; onClose: () => void }) => {
  const details    = parseReceiptFromMessage(notification.message);
  if (!details) return null;
  const isRejection = notification.title?.includes("Rejected") || notification.title?.includes("❌");
  const amount      = details["Amount Paid"] || details["Amount"] || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {isRejection ? (
          <div className="bg-red-600 text-white text-center px-5 py-4 space-y-0.5">
            <p className="text-[9px] tracking-[3px] uppercase opacity-70">Municipality of San Juan, Batangas</p>
            <p className="text-lg font-bold tracking-widest mt-1">❌ PAYMENT REJECTED</p>
            <p className="text-[9px] opacity-70">Public Market Stall Rental</p>
          </div>
        ) : (
          <div className="text-white text-center px-5 py-4 space-y-0.5" style={{ background: DS.blue900 }}>
            <p className="text-[9px] tracking-[3px] uppercase opacity-50">Republic of the Philippines</p>
            <p className="text-xs font-bold">Municipality of San Juan, Batangas</p>
            <p className="text-[9px] opacity-40">Office of the Municipal Treasurer</p>
            <p className="text-lg font-bold tracking-widest mt-1">OFFICIAL RECEIPT</p>
            <p className="text-[9px] opacity-40">Public Market Stall Rental</p>
          </div>
        )}
        <div className="divide-y">
          {Object.entries(details)
            .filter(([k]) => k !== "Amount Paid" && k !== "Amount")
            .map(([key, value]) => (
              <div key={key} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-xs text-muted-foreground shrink-0">{key}</span>
                <span className={`text-xs font-semibold text-foreground text-right ml-3 ${key.includes("No.") || key.includes("Ref") ? "font-mono" : ""}`}>{value as string}</span>
              </div>
            ))}
        </div>
        {isRejection ? (
          <div className="mx-4 my-3 rounded-xl border-2 border-red-200 bg-red-50 py-4 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Rejected Amount</p>
            <p className="font-mono text-3xl font-bold text-red-600">{amount}</p>
            <p className="text-xs text-red-400 mt-1">This payment was not processed</p>
          </div>
        ) : (
          <div className="mx-4 my-3 rounded-xl py-4 text-center"
            style={{ background: "#dcfce7", border: "2px solid #86efac" }}>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Amount Paid</p>
            <p className="font-mono text-3xl font-bold text-green-700">{amount}</p>
          </div>
        )}
        {isRejection && (
          <div className="mx-4 mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Please contact the cashier or try paying again through another method.
          </div>
        )}
        <p className="text-center text-[9px] text-muted-foreground/50 border-t px-4 py-2">
          PALENG-CLICK · {new Date(notification.created_at).toLocaleString("en-PH")}
        </p>
        <div className="flex gap-3 p-4 border-t">
          {!isRejection && (
            <Button variant="hero" className="flex-1 gap-2 rounded-xl"
              onClick={() => printReceipt(notification.title, details, amount)}>
              <Printer className="h-4 w-4" /> Print Receipt
            </Button>
          )}
          <Button variant="outline" className={`gap-2 rounded-xl ${isRejection ? "flex-1" : ""}`} onClick={onClose}>
            <X className="h-4 w-4" /> Close
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Push Settings Panel ───────────────────────────────────────────────────────
const PushSettingsPanel = () => {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return (
    <div className="flex items-center gap-3 rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
      <BellOff className="h-4 w-4 shrink-0" />
      Push notifications are not supported in this browser.
    </div>
  );

  return (
    <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
      isSubscribed ? "bg-green-50 border border-green-200" : "bg-blue-50 border border-blue-200"
    }`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isSubscribed ? "bg-green-100" : "bg-blue-100"}`}>
        {isSubscribed ? <BellRing className="h-4 w-4 text-green-600" /> : <Bell className="h-4 w-4 text-blue-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold ${isSubscribed ? "text-green-800" : "text-slate-900"}`}>
          {isSubscribed ? "Push Notifications Active" : "Enable Push Notifications"}
        </p>
        <p className="text-xs text-muted-foreground">
          {isSubscribed
            ? "You'll receive alerts even when not logged in."
            : permission === "denied"
              ? "Blocked in browser. Click the 🔒 lock icon in the address bar to allow."
              : "Get instant payment alerts on your device."}
        </p>
      </div>
      {permission !== "denied" && (
        <Button
          size="sm"
          variant={isSubscribed ? "outline" : "hero"}
          className="h-8 text-xs gap-1.5 rounded-lg shrink-0"
          disabled={isLoading}
          onClick={isSubscribed ? unsubscribe : subscribe}
        >
          {isLoading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : isSubscribed
              ? <><BellOff className="h-3.5 w-3.5" /> Disable</>
              : <><Bell className="h-3.5 w-3.5" /> Enable</>}
        </Button>
      )}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
const VendorNotifications = () => {
  const { user }       = useAuth();
  const queryClient    = useQueryClient();
  const [selected, setSelected] = useState<any>(null);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["vendor-notifications", user?.id],
    enabled: !!user,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*")
        .eq("user_id", user!.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ read_status: true }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications")
        .update({ read_status: true })
        .eq("user_id", user!.id)
        .eq("read_status", false);
    },
    onSuccess: () => {
      toast.success("All notifications marked as read.");
      queryClient.invalidateQueries({ queryKey: ["vendor-notifications"] });
    },
  });

  const handleClick = (n: any) => {
    if (!n.read_status) markRead.mutate(n.id);
    const isRejection = n.title?.includes("Rejected") || n.title?.includes("❌");
    if ((n.type === "confirmation" || isRejection) && parseReceiptFromMessage(n.message)) {
      setSelected(n);
    }
  };

  const unreadCount = notifications.filter((n: any) => !n.read_status).length;

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#2563eb" }} />
    </div>
  );

  return (
    <div className="-mx-4 -mt-4 lg:mx-0 lg:mt-0">
      {selected && <ReceiptModal notification={selected} onClose={() => setSelected(null)} />}

      {/* Mobile mini-hero */}
      <div className="lg:hidden" style={{ background: DS.gradientHeader }}>
        <div className="px-5 pt-5 pb-5">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">Notifications</h1>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>Payment confirmations, reminders, alerts</p>
            </div>
            {unreadCount > 0 && (
              <button
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
                disabled={markAllRead.isPending}
                onClick={() => markAllRead.mutate()}>
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read ({unreadCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between flex-wrap gap-3" style={{ padding: "28px 32px 0" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Notifications</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Payment confirmations, reminders, and announcements</p>
        </div>
        {unreadCount > 0 && (
          <Button
            size="sm" variant="outline"
            className="gap-2 rounded-xl h-9 text-xs"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read ({unreadCount})
          </Button>
        )}
      </div>

      <div className="px-4 py-4 lg:px-8 lg:py-5 lg:pb-8 space-y-3">
        {/* Push notification settings */}
        <PushSettingsPanel />

        {/* Hint */}
        {notifications.some((n: any) => {
          const isRej = n.title?.includes("Rejected") || n.title?.includes("❌");
          return (n.type === "confirmation" || isRej) && parseReceiptFromMessage(n.message);
        }) && (
          <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
            style={{ background: DS.blue50, border: `1px solid ${DS.blue100}`, color: DS.blue600 }}>
            <Info className="h-3.5 w-3.5 shrink-0" />
            Tap any payment notification to view and print your receipt.
          </div>
        )}

        {/* Notification list */}
        <div className="space-y-2.5">
          {notifications.map((n: any) => {
            const Icon        = TYPE_ICON[n.type]  || Bell;
            const style       = TYPE_STYLE[n.type] || TYPE_STYLE.info;
            const isRejection = n.title?.includes("Rejected") || n.title?.includes("❌");
            const hasReceipt  = (n.type === "confirmation" || isRejection) && !!parseReceiptFromMessage(n.message);

            return (
              <div key={n.id}
                onClick={() => handleClick(n)}
                className={`rounded-2xl bg-white overflow-hidden transition-all ${
                  hasReceipt ? "cursor-pointer hover:shadow-md active:scale-[0.99]" : "cursor-default"
                }`}
                style={{
                  border: !n.read_status ? `1.5px solid ${DS.blue600}` : "1px solid #e2e8f0",
                  borderLeft: !n.read_status ? `4px solid ${DS.blue600}` : undefined,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}>
                <div className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: isRejection ? "#fee2e2" : style.bg }}>
                    <Icon className="h-4 w-4" style={{ color: isRejection ? "#dc2626" : style.icon }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-sm font-bold ${!n.read_status ? "text-slate-900" : "text-slate-500"}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {new Date(n.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 leading-relaxed line-clamp-3">
                      {n.message?.split("\n")[0]}
                    </p>
                    {hasReceipt && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-bold"
                        style={{ color: isRejection ? "#dc2626" : DS.blue600 }}>
                        <CreditCard className="h-3 w-3" />
                        {isRejection ? "Tap to view rejection details" : "Tap to view & print receipt"}
                      </div>
                    )}
                    {!n.read_status && (
                      <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: DS.blue50, color: DS.blue600 }}>
                        NEW
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-20" />
              <p className="font-medium">No notifications yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Unified bottom nav — mobile only */}
      <VendorBottomNav />
    </div>
  );
};

export default VendorNotifications;