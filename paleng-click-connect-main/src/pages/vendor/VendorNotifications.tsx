import { useState } from "react";
import { Bell, CreditCard, Megaphone, AlertTriangle, Loader2, X, Printer, CheckCircle2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Config ────────────────────────────────────────────────────────────────────
const TYPE_ICON:  Record<string, any>    = { reminder: Bell, confirmation: CreditCard, announcement: Megaphone, overdue: AlertTriangle, info: Bell };
const TYPE_STYLE: Record<string, string> = {
  reminder:     "bg-primary/10 text-primary",
  confirmation: "bg-success/10 text-success",
  announcement: "bg-secondary text-muted-foreground",
  overdue:      "bg-accent/10 text-accent",
  info:         "bg-primary/10 text-primary",
};

// ─── Parse receipt details from notification message ───────────────────────────
// The cashier notification message uses bullet format:
// "• Vendor: John Doe\n• Stall: G-001 — General\n• Amount Paid: ₱1,450.00\n..."
const parseReceiptFromMessage = (message: string): Record<string, string> | null => {
  if (!message?.includes("•")) return null;
  const lines  = message.split("\n").filter(l => l.trim().startsWith("•"));
  if (lines.length < 3) return null;
  const result: Record<string, string> = {};
  lines.forEach(line => {
    const clean = line.replace("•", "").trim();
    const idx   = clean.indexOf(":");
    if (idx === -1) return;
    const key   = clean.slice(0, idx).trim();
    const value = clean.slice(idx + 1).trim();
    result[key] = value;
  });
  return Object.keys(result).length >= 3 ? result : null;
};

// ─── Print receipt ─────────────────────────────────────────────────────────────
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
  const details = parseReceiptFromMessage(notification.message);
  if (!details) return null;

  const amount = details["Amount Paid"] || details["Amount"] || "—";

  // Separate header fields from detail rows
  const headerFields = ["Vendor", "Stall"];
  const detailFields = Object.entries(details).filter(([k]) => !headerFields.includes(k) && k !== "Amount Paid" && k !== "Amount");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Receipt document */}
        <div className="bg-foreground text-background text-center px-5 py-4 space-y-0.5">
          <p className="text-[9px] tracking-[3px] uppercase opacity-50">Republic of the Philippines</p>
          <p className="text-xs font-bold">Municipality of San Juan, Batangas</p>
          <p className="text-[9px] opacity-40">Office of the Municipal Treasurer</p>
          <p className="text-lg font-bold tracking-widest mt-1">OFFICIAL RECEIPT</p>
          <p className="text-[9px] opacity-40">Public Market Stall Rental</p>
        </div>

        {/* Details */}
        <div className="divide-y">
          {Object.entries(details)
            .filter(([k]) => k !== "Amount Paid" && k !== "Amount")
            .map(([key, value]) => (
              <div key={key} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-xs text-muted-foreground shrink-0">{key}</span>
                <span className={`text-xs font-semibold text-foreground text-right ml-3 ${
                  key.includes("No.") || key.includes("Ref") ? "font-mono" : ""
                }`}>{value}</span>
              </div>
            ))}
        </div>

        {/* Amount */}
        <div className="mx-4 my-3 rounded-xl border-2 border-success/30 bg-success/5 py-4 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Amount Paid</p>
          <p className="font-mono text-3xl font-bold text-success">{amount}</p>
        </div>

        <p className="text-center text-[9px] text-muted-foreground/50 border-t px-4 py-2">
          PALENG-CLICK · {new Date(notification.created_at).toLocaleString("en-PH")}
        </p>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t">
          <Button variant="hero" className="flex-1 gap-2 rounded-xl"
            onClick={() => printReceipt(notification.title, details, amount)}>
            <Printer className="h-4 w-4" /> Print Receipt
          </Button>
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
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

  const handleClick = (n: any) => {
    if (!n.read_status) markRead.mutate(n.id);
    // Only open receipt modal for confirmation type with parseable details
    if (n.type === "confirmation" && parseReceiptFromMessage(n.message)) {
      setSelected(n);
    }
  };

  const unreadCount = notifications.filter((n: any) => !n.read_status).length;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {selected && <ReceiptModal notification={selected} onClose={() => setSelected(null)} />}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground">Payment confirmations, reminders, and announcements</p>
        </div>
        {unreadCount > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {unreadCount}
          </span>
        )}
      </div>

      {/* Hint for confirmation notifications */}
      {notifications.some((n: any) => n.type === "confirmation" && parseReceiptFromMessage(n.message)) && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Tap any payment confirmation to view and print the receipt.
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n: any) => {
          const Icon        = TYPE_ICON[n.type]  || Bell;
          const styleClass  = TYPE_STYLE[n.type] || TYPE_STYLE.info;
          const hasReceipt  = n.type === "confirmation" && !!parseReceiptFromMessage(n.message);

          return (
            <div key={n.id}
              onClick={() => handleClick(n)}
              className={`rounded-2xl border bg-card p-4 shadow-civic transition-all ${
                hasReceipt ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0" : "cursor-default"
              } ${!n.read_status ? "border-l-4 border-l-primary" : ""}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styleClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-sm font-semibold ${!n.read_status ? "text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {new Date(n.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {n.message?.split("\n")[0]}
                  </p>
                  {hasReceipt && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
                      <CreditCard className="h-3 w-3" />
                      Tap to view receipt
                    </div>
                  )}
                  {!n.read_status && (
                    <span className="mt-1.5 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      New
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
  );
};

export default VendorNotifications;