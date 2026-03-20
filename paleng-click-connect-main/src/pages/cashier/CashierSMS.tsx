import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Users, Loader2, Search, MessageSquare, Bell,
  AlertTriangle, CheckCircle2, X, ChevronRight, Store, CheckCheck,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const MSG_TYPE_CONFIG = {
  message:  { label: "Message",  icon: MessageSquare, color: "bg-primary/10 text-primary"  },
  penalty:  { label: "Penalty",  icon: AlertTriangle, color: "bg-accent/10 text-accent"    },
  reminder: { label: "Reminder", icon: Bell,          color: "bg-amber-100 text-amber-700" },
};

const SECTIONS = ["All Vendors","General","Fish","Meat","Vegetables","Dry Goods","Bolante"];

const CashierSMS = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab,          setTab]          = useState<"direct"|"bulk">("direct");
  const [activeThread, setActiveThread] = useState<any>(null);
  const [msgBody,      setMsgBody]      = useState("");
  const [msgType,      setMsgType]      = useState<"message"|"reminder"|"penalty">("message");
  const [searchVendor, setSearchVendor] = useState("");
  const [showPicker,   setShowPicker]   = useState(false);
  // Bulk
  const [bulkTarget,   setBulkTarget]   = useState("All Vendors");
  const [bulkMsg,      setBulkMsg]      = useState("");
  const [bulkType,     setBulkType]     = useState<"reminder"|"penalty"|"message">("reminder");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── All vendors for picker ───────────────────────────────────────────────────
  const { data: allVendors = [] } = useQuery({
    queryKey: ["cashier-vendors-msg"],
    queryFn: async () => {
      const { data: vendors } = await supabase.from("vendors").select("user_id, stalls(stall_number, section)");
      const userIds = (vendors || []).map(v => v.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return (vendors || []).map(v => {
        const pr = profiles?.find(p => p.user_id === v.user_id);
        const st = v.stalls as any;
        return { user_id: v.user_id, name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number || "—", section: st?.section || "" };
      });
    },
  });

  // ── Threads ──────────────────────────────────────────────────────────────────
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ["cashier-threads", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: t } = await supabase
        .from("message_threads")
        .select("*")
        .eq("admin_id", user!.id)
        .order("last_at", { ascending: false });
      if (!t?.length) return [];
      const vids = t.map(x => x.vendor_id);
      const [profilesRes, unreadRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", vids),
        supabase.from("messages").select("thread_id").is("read_at", null).eq("recipient_id", user!.id),
      ]);
      const profiles = profilesRes.data || [];
      const unreadMap: Record<string,number> = {};
      (unreadRes.data || []).forEach(m => { unreadMap[m.thread_id] = (unreadMap[m.thread_id]||0)+1; });
      const { data: vendors } = await supabase.from("vendors").select("user_id, stalls(stall_number, section)").in("user_id", vids);
      return t.map(x => {
        const pr = profiles.find(p => p.user_id === x.vendor_id);
        const v  = vendors?.find(v => v.user_id === x.vendor_id);
        const st = v?.stalls as any;
        return { ...x, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number||"—", section: st?.section||"", unread: unreadMap[x.id]||0 };
      });
    },
  });

  // ── Messages ─────────────────────────────────────────────────────────────────
  const { data: messages = [] } = useQuery({
    queryKey: ["cashier-messages", activeThread?.id],
    enabled: !!activeThread?.id,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("thread_id", activeThread!.id).order("created_at", { ascending: true });
      return data || [];
    },
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (activeThread && user) {
      supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("thread_id", activeThread.id).eq("recipient_id", user.id).is("read_at", null)
        .then(() => queryClient.invalidateQueries({ queryKey: ["cashier-threads"] }));
    }
  }, [activeThread?.id]);

  // ── Start thread ─────────────────────────────────────────────────────────────
  const startThread = async (vendor: any) => {
    const { data: existing } = await supabase.from("message_threads").select("*").eq("vendor_id", vendor.user_id).eq("admin_id", user!.id).single();
    if (existing) { setActiveThread({ ...existing, vendor_name: vendor.name, stall: vendor.stall, section: vendor.section, unread: 0 }); setShowPicker(false); return; }
    const { data: thread } = await supabase.from("message_threads").insert({ vendor_id: vendor.user_id, admin_id: user!.id }).select().single();
    if (thread) { setActiveThread({ ...thread, vendor_name: vendor.name, stall: vendor.stall, section: vendor.section, unread: 0 }); queryClient.invalidateQueries({ queryKey: ["cashier-threads"] }); }
    setShowPicker(false);
  };

  // ── Send direct message ───────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!msgBody.trim() || !activeThread) throw new Error("Empty");
      await supabase.from("messages").insert({ thread_id: activeThread.id, sender_id: user!.id, recipient_id: activeThread.vendor_id, body: msgBody.trim(), type: msgType });
      await supabase.from("message_threads").update({ last_message: msgBody.trim(), last_at: new Date().toISOString() }).eq("id", activeThread.id);
      await supabase.from("notifications").insert({ user_id: activeThread.vendor_id, title: msgType === "penalty" ? "⚠️ Penalty Notice" : msgType === "reminder" ? "🔔 Payment Reminder" : "New Message from Cashier", message: msgBody.trim().slice(0,200), type: msgType === "penalty" ? "overdue" : msgType === "reminder" ? "reminder" : "info" });
    },
    onSuccess: () => { setMsgBody(""); queryClient.invalidateQueries({ queryKey: ["cashier-messages", activeThread?.id] }); queryClient.invalidateQueries({ queryKey: ["cashier-threads"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Send bulk ─────────────────────────────────────────────────────────────────
  const sendBulk = useMutation({
    mutationFn: async () => {
      if (!bulkMsg.trim()) throw new Error("Message is required");
      let targetVendors = allVendors;
      if (bulkTarget !== "All Vendors") {
        targetVendors = allVendors.filter((v: any) => v.section === bulkTarget);
      }
      if (!targetVendors.length) throw new Error("No vendors in selected group");
      // Send notification to each vendor
      const notifications = targetVendors.map((v: any) => ({
        user_id: v.user_id,
        title:   bulkType === "penalty" ? "⚠️ Penalty Notice" : bulkType === "reminder" ? "🔔 Payment Reminder" : "Message from Cashier",
        message: bulkMsg.trim(),
        type:    bulkType === "penalty" ? "overdue" : bulkType === "reminder" ? "reminder" : "info",
      }));
      const { error } = await supabase.from("notifications").insert(notifications);
      if (error) throw error;
      return targetVendors.length;
    },
    onSuccess: (count) => { toast.success(`Message sent to ${count} vendor${count > 1 ? "s" : ""}!`); setBulkMsg(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredVendors = allVendors.filter((v: any) =>
    v.name.toLowerCase().includes(searchVendor.toLowerCase()) || v.stall.toLowerCase().includes(searchVendor.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Messages & Reminders</h1>
        <p className="text-sm text-muted-foreground">Send direct messages or bulk reminders to vendors</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1 max-w-xs">
        <button onClick={() => setTab("direct")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab === "direct" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Direct
          {threads.filter((t: any) => t.unread > 0).length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
              {threads.filter((t: any) => t.unread > 0).length}
            </span>
          )}
        </button>
        <button onClick={() => setTab("bulk")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab === "bulk" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Users className="h-3.5 w-3.5" /> Bulk
        </button>
      </div>

      {/* ── DIRECT TAB ────────────────────────────────────────────────────────── */}
      {tab === "direct" && (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]" style={{ height: "560px" }}>
          {/* Thread list */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Conversations</p>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 rounded-lg" onClick={() => setShowPicker(true)}>
                <MessageSquare className="h-3 w-3" /> New
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {threadsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                  <MessageSquare className="h-7 w-7 opacity-20" />
                  <p className="text-xs">No conversations yet</p>
                  <button onClick={() => setShowPicker(true)} className="text-xs text-primary hover:underline">Start one</button>
                </div>
              ) : threads.map((t: any) => (
                <button key={t.id} onClick={() => setActiveThread(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors ${activeThread?.id === t.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Store className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${t.unread > 0 ? "font-bold" : "font-medium"} text-foreground`}>{t.vendor_name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                        {t.last_at ? new Date(t.last_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"}) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Stall {t.stall}</p>
                    {t.last_message && <p className="text-xs text-muted-foreground truncate">{t.last_message}</p>}
                  </div>
                  {t.unread > 0 && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{t.unread}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Chat */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden flex flex-col">
            {!activeThread ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
                <MessageSquare className="h-10 w-10 opacity-20" />
                <p className="font-medium">Select a conversation</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowPicker(true)}>
                  <MessageSquare className="h-3.5 w-3.5" /> New Message
                </Button>
              </div>
            ) : (
              <>
                <div className="border-b px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{activeThread.vendor_name}</p>
                    <p className="text-xs text-muted-foreground">Stall {activeThread.stall} · {activeThread.section}</p>
                  </div>
                  <button onClick={() => setActiveThread(null)} className="rounded-lg p-1.5 hover:bg-secondary">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m: any) => {
                    const isMe = m.sender_id === user?.id;
                    const typeCfg = MSG_TYPE_CONFIG[m.type as keyof typeof MSG_TYPE_CONFIG] || MSG_TYPE_CONFIG.message;
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[75%] space-y-1">
                          {!isMe && m.type !== "message" && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${typeCfg.color}`}>
                              <typeCfg.icon className="h-3 w-3" />{typeCfg.label}
                            </span>
                          )}
                          <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                            <p className="leading-relaxed">{m.body}</p>
                          </div>
                          <p className={`text-[10px] text-muted-foreground ${isMe ? "text-right" : "text-left"}`}>
                            {new Date(m.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}
                            {isMe && m.read_at && <CheckCheck className="inline h-3 w-3 ml-1 text-primary" />}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No messages yet.</p>}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t p-4 space-y-2">
                  <div className="flex gap-1.5">
                    {(["message","reminder","penalty"] as const).map(t => {
                      const cfg = MSG_TYPE_CONFIG[t];
                      return (
                        <button key={t} onClick={() => setMsgType(t)}
                          className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-all ${msgType === t ? `${cfg.color} border-current` : "border-border text-muted-foreground hover:bg-secondary"}`}>
                          <cfg.icon className="h-3 w-3" />{cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder="Type a message…" className="h-10 rounded-xl flex-1"
                      value={msgBody} onChange={e => setMsgBody(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendMessage.mutate()} />
                    <Button size="icon" className="h-10 w-10 rounded-xl shrink-0"
                      disabled={!msgBody.trim() || sendMessage.isPending} onClick={() => sendMessage.mutate()}>
                      {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── BULK TAB ─────────────────────────────────────────────────────────── */}
      {tab === "bulk" && (
        <div className="max-w-lg space-y-4">
          <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-5">
            <h3 className="font-semibold text-foreground">Send Bulk Notification</h3>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Send To</label>
              <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                value={bulkTarget} onChange={e => setBulkTarget(e.target.value)}>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">
                {bulkTarget === "All Vendors" ? `${allVendors.length} vendors` : `${allVendors.filter((v: any) => v.section === bulkTarget).length} vendors in ${bulkTarget} section`}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Message Type</label>
              <div className="flex gap-2 flex-wrap">
                {(["reminder","penalty","message"] as const).map(t => {
                  const cfg = MSG_TYPE_CONFIG[t];
                  return (
                    <button key={t} onClick={() => setBulkType(t)}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-all ${bulkType === t ? `${cfg.color} border-current` : "border-border text-muted-foreground hover:bg-secondary"}`}>
                      <cfg.icon className="h-3.5 w-3.5" />{cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Message</label>
              <Textarea
                placeholder={bulkType === "reminder" ? "e.g. This is a reminder that your stall fee for March 2026 is due. Please settle at the cashier or pay online." : bulkType === "penalty" ? "e.g. Your stall has an outstanding penalty due to late payment. Please settle immediately." : "Type your message…"}
                className="min-h-[100px] rounded-xl resize-none"
                value={bulkMsg}
                onChange={e => setBulkMsg(e.target.value)}
              />
            </div>

            {/* Preview */}
            {bulkMsg && (
              <div className="rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Preview notification</p>
                <p className="font-semibold text-foreground">{bulkType === "penalty" ? "⚠️ Penalty Notice" : bulkType === "reminder" ? "🔔 Payment Reminder" : "Message from Cashier"}</p>
                <p className="text-muted-foreground mt-0.5">{bulkMsg.slice(0, 120)}{bulkMsg.length > 120 ? "…" : ""}</p>
              </div>
            )}

            <Button size="lg" className="w-full gap-2 rounded-xl"
              onClick={() => sendBulk.mutate()}
              disabled={sendBulk.isPending || !bulkMsg.trim()}>
              {sendBulk.isPending
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                : <><Users className="h-4 w-4" /> Send to {bulkTarget === "All Vendors" ? `All ${allVendors.length} Vendors` : `${allVendors.filter((v: any) => v.section === bulkTarget).length} Vendors`}</>}
            </Button>
          </div>
        </div>
      )}

      {/* Vendor picker modal */}
      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowPicker(false)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="font-semibold text-foreground">Select Vendor</h3>
              <button onClick={() => setShowPicker(false)} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search vendor…" className="h-10 pl-9 rounded-xl" value={searchVendor} onChange={e => setSearchVendor(e.target.value)} />
              </div>
              <div className="max-h-64 overflow-y-auto divide-y rounded-xl border">
                {filteredVendors.map((v: any) => (
                  <button key={v.user_id} onClick={() => startThread(v)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors text-left">
                    <div>
                      <p className="text-sm font-medium text-foreground">{v.name}</p>
                      <p className="text-xs text-muted-foreground">Stall {v.stall} · {v.section}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {filteredVendors.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No vendors found</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierSMS;