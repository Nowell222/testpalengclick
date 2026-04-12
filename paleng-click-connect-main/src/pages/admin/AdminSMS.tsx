import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Users, CheckCircle2, Clock, Loader2,
  MessageSquare, Bell, AlertCircle, Megaphone, Search,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  reminder:     { label: "Payment Reminder",    icon: Bell,          color: "text-amber-600",  badge: "bg-amber-100 text-amber-700 border-amber-200"     },
  overdue:      { label: "Overdue Alert",        icon: AlertCircle,   color: "text-red-600",    badge: "bg-red-100 text-red-700 border-red-200"           },
  confirmation: { label: "Payment Confirmation", icon: CheckCircle2,  color: "text-green-700",  badge: "bg-green-700/10 text-green-700 border-green-200"  },
  announcement: { label: "Announcement",         icon: Megaphone,     color: "text-foreground", badge: "bg-secondary text-foreground border-border"       },
};

const STATUS_BADGE: Record<string, string> = {
  delivered: "bg-green-700/10 text-green-700 border-green-200",
  pending:   "bg-amber-100 text-amber-700 border-amber-200",
  failed:    "bg-red-100 text-red-700 border-red-200",
};

const AdminSMS = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"send" | "bulk" | "logs">("send");
  const [recipient, setRecipient] = useState("");
  const [messageType, setMessageType] = useState("reminder");
  const [message, setMessage] = useState("");

  const TEMPLATES: Record<string, string> = {
    reminder:     "Dear Vendor, this is a friendly reminder that your stall fee for this month is due. Please settle your payment at the Treasurer's Office or via PALENG-CLICK. Thank you.",
    overdue:      "Dear Vendor, your stall payment account is overdue. Please settle your outstanding balance immediately to avoid penalties. Contact us at the Municipal Treasurer's Office.",
    confirmation: "Dear Vendor, your payment has been received and confirmed. Thank you for settling your stall fee on time. Keep your receipt for your records.",
    announcement: "Dear Vendor, this is an announcement from the Municipal Treasurer's Office. Please visit the market office for important updates regarding your stall.",
  };

  const { data: logs = [] } = useQuery({
    queryKey: ["sms-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("sms_logs").select("*").order("sent_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const sendSMS = useMutation({
    mutationFn: async () => {
      if (!recipient.trim()) throw new Error("Recipient is required");
      if (!message.trim())   throw new Error("Message cannot be empty");
      const { error } = await supabase.from("sms_logs").insert({
        recipient,
        message,
        type: messageType as any,
        status: "delivered",
        sent_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SMS logged successfully!");
      queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
      setRecipient("");
      setMessage("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const TAB_ITEMS = [
    { key: "send",  label: "Single SMS",  icon: Send     },
    { key: "bulk",  label: "Bulk SMS",    icon: Users    },
    { key: "logs",  label: "SMS Logs",    icon: MessageSquare },
  ] as const;

  const logStats = {
    total:     logs.length,
    delivered: logs.filter((l: any) => l.status === "delivered").length,
    pending:   logs.filter((l: any) => l.status === "pending").length,
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-2xl overflow-hidden shadow-civic">
        <div className="bg-cashier-hero px-6 py-5 flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">SMS Management</h1>
            <p className="text-sm text-white/60">Send reminders, confirmations, and announcements to vendors</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-xl bg-white/10 border border-white/20 px-3 py-2">
            <MessageSquare className="h-4 w-4 text-white" />
            <span className="text-sm font-semibold text-white">{logStats.delivered}</span>
            <span className="text-xs text-white/60">delivered</span>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-civic w-fit">
        {TAB_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === key
                ? "bg-green-700 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {(tab === "send" || tab === "bulk") && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">

          {/* Compose form */}
          <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-700/10">
                <Send className="h-4 w-4 text-green-700" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Compose Message</p>
                <p className="text-xs text-muted-foreground">{tab === "bulk" ? "Send to multiple vendors" : "Send to one recipient"}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {tab === "bulk" ? "Recipients" : "Recipient"}
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={tab === "bulk" ? "Leave blank to send to all vendors…" : "Phone number or vendor name…"}
                  className="h-11 pl-10 rounded-xl border-border focus:ring-2 focus:ring-green-500/20"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => { setMessageType(key); setMessage(TEMPLATES[key] || ""); }}
                      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium text-left transition-all ${
                        messageType === key
                          ? "border-green-600 bg-green-700/8 ring-2 ring-green-500/20 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${cfg.badge}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message</Label>
                <span className="text-xs text-muted-foreground">{message.length} chars</span>
              </div>
              <Textarea
                placeholder="Type your message or select a type above to load a template…"
                className="min-h-[120px] rounded-xl resize-none focus:ring-2 focus:ring-green-500/20"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <Button
              size="lg"
              className="w-full gap-2 rounded-xl bg-green-700 hover:bg-green-800 text-white transition-all"
              onClick={() => sendSMS.mutate()}
              disabled={sendSMS.isPending}
            >
              {sendSMS.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Send className="h-4 w-4" /> {tab === "bulk" ? "Send to All Vendors" : "Send SMS"}</>
              }
            </Button>
          </div>

          {/* Quick templates sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card p-4 shadow-civic">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Templates</p>
              <div className="space-y-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={key}
                      onClick={() => { setMessageType(key); setMessage(TEMPLATES[key] || ""); }}
                      className="w-full flex items-center gap-3 rounded-xl border p-3 text-left hover:bg-secondary/40 hover:border-green-200 transition-all group"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.badge}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{TEMPLATES[key]?.slice(0, 45)}…</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-civic space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Log Summary</p>
              {[
                { label: "Total Sent",  value: logStats.total,     color: "text-foreground" },
                { label: "Delivered",   value: logStats.delivered, color: "text-green-700"  },
                { label: "Pending",     value: logStats.pending,   color: "text-amber-600"  },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4 bg-secondary/30">
            <div>
              <h3 className="font-semibold text-foreground">SMS Logs</h3>
              <p className="text-xs text-muted-foreground">{logStats.total} messages sent total</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className={`rounded-full border px-2.5 py-0.5 font-medium ${STATUS_BADGE.delivered}`}>
                {logStats.delivered} delivered
              </span>
              {logStats.pending > 0 && (
                <span className={`rounded-full border px-2.5 py-0.5 font-medium ${STATUS_BADGE.pending}`}>
                  {logStats.pending} pending
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/40">
                  {["Recipient", "Type", "Message", "Status", "Sent At"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((l: any) => {
                  const typeCfg = TYPE_CONFIG[l.type] || TYPE_CONFIG.announcement;
                  const TypeIcon = typeCfg.icon;
                  return (
                    <tr key={l.id} className="hover:bg-green-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{l.recipient}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeCfg.badge}`}>
                          <TypeIcon className="h-3 w-3" />
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[240px]">
                        <p className="truncate text-xs">{l.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[l.status] || STATUS_BADGE.pending}`}>
                          {l.status === "delivered"
                            ? <CheckCircle2 className="h-3 w-3" />
                            : <Clock className="h-3 w-3" />}
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.sent_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <MessageSquare className="h-8 w-8 opacity-20" />
                        <p className="font-medium">No SMS logs yet</p>
                        <p className="text-xs">Messages sent will appear here</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSMS;