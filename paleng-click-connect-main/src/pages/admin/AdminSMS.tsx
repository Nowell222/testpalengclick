import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Users, CheckCircle2, Clock, Loader2,
  MessageSquare, Bell, AlertCircle, Megaphone, Search,
  TrendingUp, Activity,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const TYPE_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string; border: string }> = {
  reminder:     { label: "Payment Reminder",    icon: Bell,        bg: "bg-amber-100",    text: "text-amber-700",  border: "border-amber-200"  },
  overdue:      { label: "Overdue Alert",        icon: AlertCircle, bg: "bg-red-100",      text: "text-red-700",    border: "border-red-200"    },
  confirmation: { label: "Payment Confirmation", icon: CheckCircle2,bg: "bg-emerald-100",  text: "text-emerald-700",border: "border-emerald-200"},
  announcement: { label: "Announcement",         icon: Megaphone,   bg: "bg-secondary",    text: "text-foreground", border: "border-border"     },
};

const STATUS_BADGE: Record<string, string> = {
  delivered: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  failed:    "bg-red-50 text-red-600 border-red-200",
};

const TEMPLATES: Record<string, string> = {
  reminder:     "Dear Vendor, this is a friendly reminder that your stall fee for this month is due. Please settle your payment at the Treasurer's Office or via PALENG-CLICK. Thank you.",
  overdue:      "Dear Vendor, your stall payment account is overdue. Please settle your outstanding balance immediately to avoid penalties. Contact us at the Municipal Treasurer's Office.",
  confirmation: "Dear Vendor, your payment has been received and confirmed. Thank you for settling your stall fee on time. Keep your receipt for your records.",
  announcement: "Dear Vendor, this is an announcement from the Municipal Treasurer's Office. Please visit the market office for important updates regarding your stall.",
};

const AdminSMS = () => {
  const { user, role } = useAuth();
  const isReadOnly = role === "eemo";
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"send" | "bulk" | "logs">(isReadOnly ? "logs" : "send");
  const [recipient, setRecipient] = useState("");
  const [messageType, setMessageType] = useState("reminder");
  const [message, setMessage] = useState(TEMPLATES.reminder);

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
        recipient, message, type: messageType as any, status: "delivered", sent_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SMS logged successfully!");
      queryClient.invalidateQueries({ queryKey: ["sms-logs"] });
      setRecipient(""); setMessage(TEMPLATES[messageType] || "");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const logStats = {
    total: logs.length,
    delivered: logs.filter((l: any) => l.status === "delivered").length,
    pending:   logs.filter((l: any) => l.status === "pending").length,
    failed:    logs.filter((l: any) => l.status === "failed").length,
  };

  const TABS: { key: "send" | "bulk" | "logs"; label: string; icon: any }[] = isReadOnly 
    ? [{ key: "logs",  label: "SMS Logs",    icon: MessageSquare }]
    : [
        { key: "send",  label: "Single SMS",  icon: Send         },
        { key: "bulk",  label: "Bulk SMS",    icon: Users        },
        { key: "logs",  label: "SMS Logs",    icon: MessageSquare },
      ];

  return (
    <div className="space-y-4">

      {/* ── Executive Header Banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 12px 32px rgba(15,110,86,0.12)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Admin Portal</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-100">Communications</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">SMS Management</h1>
            <p className="text-xs text-white/70 mt-0.5">Send payment reminders, alerts, and official announcements to vendors</p>
          </div>
          <div className="rounded-xl px-4 py-2 text-right bg-white/10 border border-white/20 shrink-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">Messages Sent</p>
            <p className="font-mono text-lg font-bold text-white leading-none mt-0.5">{logStats.delivered}</p>
            <p className="text-[10px] text-emerald-100/70 mt-0.5">{logStats.total} total logged</p>
          </div>
        </div>
      </div>

      {/* ── 3 Top KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Delivered", value: String(logStats.delivered), icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30" },
          { label: "Pending", value: String(logStats.pending), icon: Clock, iconBg: logStats.pending > 0 ? "bg-amber-100" : "bg-secondary", iconColor: logStats.pending > 0 ? "#f59e0b" : "hsl(220,10%,55%)", glow: logStats.pending > 0 ? "#f59e0b" : "transparent", gradient: logStats.pending > 0 ? "from-amber-50 to-amber-50/30" : "from-secondary to-secondary/30" },
          { label: "Failed", value: String(logStats.failed), icon: AlertCircle, iconBg: logStats.failed > 0 ? "bg-rose-100" : "bg-secondary", iconColor: logStats.failed > 0 ? "#f43f5e" : "hsl(220,10%,55%)", glow: logStats.failed > 0 ? "#f43f5e" : "transparent", gradient: logStats.failed > 0 ? "from-rose-50 to-rose-50/30" : "from-secondary to-secondary/30" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-3.5 hover:shadow-sm transition-all duration-300 group`}>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-xs ${c.iconBg}`}>
                <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[16px] font-bold text-foreground leading-tight">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              tab === key ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-3.5 w-3.5"/>{label}
          </button>
        ))}
      </div>

      {/* ── COMPOSE (send / bulk) ────────────────────────────────────────── */}
      {(tab === "send" || tab === "bulk") && (
        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          {/* Compose panel */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
              <div>
                <p className="text-[13px] font-bold text-foreground">Compose Message</p>
                <p className="text-xs text-muted-foreground">{tab === "bulk" ? "Send to multiple vendors" : "Send to one recipient"}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {tab === "bulk" ? "Recipients" : "Recipient"}
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                  <Input placeholder={tab==="bulk"?"Leave blank to send to all vendors…":"Phone number or vendor name…"}
                    className="h-11 pl-10 rounded-xl" value={recipient} onChange={e=>setRecipient(e.target.value)}/>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={key} onClick={() => { setMessageType(key); setMessage(TEMPLATES[key] || ""); }}
                        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-xs font-medium text-left transition-all ${
                          messageType === key
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                        }`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bg} ${cfg.text}`}>
                          <Icon className="h-3.5 w-3.5"/>
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
                <Textarea placeholder="Type your message or select a type above to load a template…"
                  className="min-h-[120px] rounded-xl resize-none" value={message} onChange={e=>setMessage(e.target.value)}/>
              </div>

              {/* Preview */}
              {message && (
                <div className="rounded-xl border border-primary/10 bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preview</p>
                  <p className="text-sm font-semibold text-foreground">
                    {TYPE_CONFIG[messageType]?.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{message.slice(0,120)}{message.length>120?"…":""}</p>
                </div>
              )}

              <Button size="lg" className="w-full gap-2 rounded-xl" onClick={()=>sendSMS.mutate()} disabled={sendSMS.isPending}>
                {sendSMS.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin"/> Sending…</>
                  : <><Send className="h-4 w-4"/> {tab==="bulk"?"Send to All Vendors":"Send SMS"}</>}
              </Button>
            </div>
          </div>

          {/* Quick templates sidebar */}
          <div className="space-y-4">
            <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
                <p className="text-[13px] font-bold text-foreground">Quick Templates</p>
              </div>
              <div className="p-3 space-y-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button key={key} onClick={() => { setMessageType(key); setMessage(TEMPLATES[key] || ""); }}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left hover:bg-secondary/40 hover:border-primary/20 transition-all ${messageType===key?"border-primary/30 bg-primary/5":""}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cfg.bg} ${cfg.text}`}>
                        <Icon className="h-4 w-4"/>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{cfg.label}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]">{TEMPLATES[key]?.slice(0,40)}…</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Log summary card */}
            <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
                <p className="text-[13px] font-bold text-foreground">Log Summary</p>
              </div>
              <div className="p-4 space-y-1">
                {[
                  { label:"Total Sent",  value:logStats.total,     dot:"bg-foreground" },
                  { label:"Delivered",   value:logStats.delivered, dot:"bg-emerald-500" },
                  { label:"Pending",     value:logStats.pending,   dot:"bg-amber-400" },
                  { label:"Failed",      value:logStats.failed,    dot:"bg-red-500" },
                ].map(s=>(
                  <div key={s.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className={`h-2 w-2 rounded-full ${s.dot}`}/>{s.label}
                    </span>
                    <span className="text-sm font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LOGS TAB ─────────────────────────────────────────────────────── */}
      {tab === "logs" && (
        <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
              <h3 className="text-[13px] font-bold text-foreground">SMS Logs</h3>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{background:"rgba(16,185,129,0.1)",color:"#10b981"}}>{logStats.total} messages</span>
            </div>
            <div className="flex gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE.delivered}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>{logStats.delivered} delivered
              </span>
              {logStats.pending > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE.pending}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"/>{logStats.pending} pending
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                  {["Recipient","Type","Message","Status","Sent At"].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((l: any) => {
                  const cfg = TYPE_CONFIG[l.type] || TYPE_CONFIG.announcement;
                  const Icon = cfg.icon;
                  return (
                    <tr key={l.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{l.recipient}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                          <Icon className="h-3 w-3"/>{cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[240px]">
                        <p className="truncate text-xs">{l.message}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[l.status] || STATUS_BADGE.pending}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${l.status==="delivered"?"bg-emerald-500":l.status==="pending"?"bg-amber-400 animate-pulse":"bg-red-500"}`}/>
                          {l.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.sent_at).toLocaleString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                      </td>
                    </tr>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                          <MessageSquare className="h-7 w-7 text-slate-400"/>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">No SMS logs yet</p>
                          <p className="text-xs mt-0.5">Messages sent will appear here</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {logs.length > 0 && (
            <div className="border-t bg-secondary/30 px-5 py-3 flex justify-between text-xs text-muted-foreground">
              <span>{logs.length} total entries</span>
              <span className="text-emerald-700 font-medium">{logStats.delivered} delivered successfully</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminSMS;