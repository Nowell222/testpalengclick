import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Loader2, Megaphone, MessageSquare, Send,
  Users, AlertTriangle, Bell, X, Search, ChevronRight,
  Clock, CheckCheck, Store, FileText,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const MSG_TYPE_CONFIG = {
  message:      { label: "Message",      icon: MessageSquare, color: "bg-primary/10 text-primary"   },
  penalty:      { label: "Penalty",      icon: AlertTriangle, color: "bg-accent/10 text-accent"     },
  reminder:     { label: "Reminder",     icon: Bell,          color: "bg-amber-100 text-amber-700"  },
  announcement: { label: "Announcement", icon: Megaphone,     color: "bg-secondary text-foreground" },
};

// ─── Thread list (all vendor conversations) ─────────────────────────────────────
const useThreads = (adminId: string) => useQuery({
  queryKey: ["admin-threads", adminId],
  enabled: !!adminId,
  refetchInterval: 5000,
  queryFn: async () => {
    const { data: threads } = await supabase
      .from("message_threads")
      .select("*")
      .eq("admin_id", adminId)
      .order("last_at", { ascending: false });

    if (!threads?.length) return [];

    const vendorUserIds = threads.map(t => t.vendor_id);
    const [profilesRes, unreadRes] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", vendorUserIds),
      supabase.from("messages").select("thread_id, id").is("read_at", null).eq("recipient_id", adminId),
    ]);

    const profiles = profilesRes.data || [];
    const unreadMap: Record<string, number> = {};
    (unreadRes.data || []).forEach(m => {
      unreadMap[m.thread_id] = (unreadMap[m.thread_id] || 0) + 1;
    });

    // Get stall info for vendors
    const { data: vendors } = await supabase
      .from("vendors")
      .select("user_id, stalls(stall_number, section)")
      .in("user_id", vendorUserIds);

    return threads.map(t => {
      const pr = profiles.find(p => p.user_id === t.vendor_id);
      const v  = vendors?.find(v => v.user_id === t.vendor_id);
      const st = v?.stalls as any;
      return {
        ...t,
        vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
        stall: st?.stall_number || "—",
        section: st?.section || "",
        unread: unreadMap[t.id] || 0,
      };
    });
  },
});

// ─── Messages in a thread ────────────────────────────────────────────────────────
const useMessages = (threadId: string | null) => useQuery({
  queryKey: ["admin-messages", threadId],
  enabled: !!threadId,
  refetchInterval: 3000,
  queryFn: async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId!)
      .order("created_at", { ascending: true });
    return data || [];
  },
});

// ─── Main Component ─────────────────────────────────────────────────────────────
const AdminNews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab,         setTab]         = useState<"announcements" | "messages">("announcements");
  const [showCreate,  setShowCreate]  = useState(false);
  const [title,       setTitle]       = useState("");
  const [content,     setContent]     = useState("");
  const [activeThread,setActiveThread]= useState<any>(null);
  const [msgBody,     setMsgBody]     = useState("");
  const [msgType,     setMsgType]     = useState<"message"|"penalty"|"reminder">("message");
  const [searchVendor,setSearchVendor]= useState("");
  const [showNewMsg,  setShowNewMsg]  = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: threads = [], isLoading: threadsLoading } = useThreads(user?.id || "");
  const { data: messages = [] } = useMessages(activeThread?.id || null);

  // Fetch all vendors for new message
  const { data: allVendors = [] } = useQuery({
    queryKey: ["all-vendors-msg"],
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
    enabled: showNewMsg,
  });

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark messages as read when opening thread
  useEffect(() => {
    if (activeThread && user) {
      supabase.from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", activeThread.id)
        .eq("recipient_id", user.id)
        .is("read_at", null)
        .then(() => queryClient.invalidateQueries({ queryKey: ["admin-threads"] }));
    }
  }, [activeThread?.id]);

  // ── Create announcement ────────────────────────────────────────────────────────
  const createNews = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !content.trim()) throw new Error("Title and content are required");
      const { error } = await supabase.from("announcements").insert({ title, content, published_by: user?.id });
      if (error) throw error;
      // Also send notification to all vendors
      const { data: vendors } = await supabase.from("vendors").select("user_id");
      if (vendors?.length) {
        await supabase.from("notifications").insert(
          vendors.map(v => ({
            user_id: v.user_id,
            title,
            message: content.slice(0, 200),
            type: "announcement",
          }))
        );
      }
    },
    onSuccess: () => {
      toast.success("Announcement published and sent to all vendors!");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setShowCreate(false); setTitle(""); setContent("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteNews = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); queryClient.invalidateQueries({ queryKey: ["announcements"] }); },
  });

  // ── Start new thread ───────────────────────────────────────────────────────────
  const startThread = async (vendor: any) => {
    // Check if thread already exists
    const { data: existing } = await supabase
      .from("message_threads")
      .select("*")
      .eq("vendor_id", vendor.user_id)
      .eq("admin_id", user!.id)
      .single();

    if (existing) {
      setActiveThread({ ...existing, vendor_name: vendor.name, stall: vendor.stall, section: vendor.section, unread: 0 });
      setShowNewMsg(false);
      return;
    }

    const { data: thread } = await supabase
      .from("message_threads")
      .insert({ vendor_id: vendor.user_id, admin_id: user!.id })
      .select()
      .single();

    if (thread) {
      setActiveThread({ ...thread, vendor_name: vendor.name, stall: vendor.stall, section: vendor.section, unread: 0 });
      queryClient.invalidateQueries({ queryKey: ["admin-threads"] });
    }
    setShowNewMsg(false);
  };

  // ── Send message ───────────────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!msgBody.trim() || !activeThread) throw new Error("Empty message");
      const { error } = await supabase.from("messages").insert({
        thread_id:    activeThread.id,
        sender_id:    user!.id,
        recipient_id: activeThread.vendor_id,
        body:         msgBody.trim(),
        type:         msgType,
      });
      if (error) throw error;
      // Update thread last message
      await supabase.from("message_threads")
        .update({ last_message: msgBody.trim(), last_at: new Date().toISOString() })
        .eq("id", activeThread.id);
      // Send notification to vendor
      await supabase.from("notifications").insert({
        user_id: activeThread.vendor_id,
        title:   msgType === "penalty" ? "⚠️ Penalty Notice" : msgType === "reminder" ? "🔔 Payment Reminder" : "New Message",
        message: msgBody.trim().slice(0, 200),
        type:    msgType === "penalty" ? "overdue" : msgType === "reminder" ? "reminder" : "info",
      });
    },
    onSuccess: () => {
      setMsgBody("");
      queryClient.invalidateQueries({ queryKey: ["admin-messages", activeThread?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-threads"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  // ── Send SOA as chat message ───────────────────────────────────────────────
  const [sendingSOA, setSendingSOA] = useState(false);

  const sendSOA = async () => {
    if (!activeThread) return;
    setSendingSOA(true);
    try {
      const MF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      const yr = new Date().getFullYear();
      const cm = new Date().getMonth() + 1;

      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, stalls(stall_number, section, monthly_rate)")
        .eq("user_id", activeThread.vendor_id)
        .single();

      if (!vendor) throw new Error("Vendor not found");
      const st   = vendor.stalls as any;
      const rate = st?.monthly_rate || 1450;

      const { data: pmts } = await supabase
        .from("payments")
        .select("period_month, amount")
        .eq("vendor_id", vendor.id)
        .eq("status", "completed")
        .eq("period_year", yr);

      const pm: Record<number,number> = {};
      (pmts||[]).forEach((p:any) => { if(p.period_month) pm[p.period_month]=(pm[p.period_month]||0)+Number(p.amount); });

      const totalPaid = Object.values(pm).reduce((s,v)=>s+v,0);
      const totalOut  = MF.reduce((sum,_,i)=>{ const m=i+1; if(m>cm) return sum; return sum+Math.max(0,rate-(pm[m]||0)); },0);

      const rows = MF.slice(0,cm).map((m,i)=>{
        const month=i+1, paid=pm[month]||0, bal=Math.max(0,rate-paid);
        const icon = paid>=rate?"✅":paid>0?"⚠️":"❌";
        const stat = paid>=rate?"Paid":paid>0?`Partial (₱${paid.toLocaleString("en-PH",{minimumFractionDigits:2})} paid)`:"Unpaid";
        const due  = bal>0&&paid<rate?` — ₱${bal.toLocaleString("en-PH",{minimumFractionDigits:2})} due`:"";
        return `${icon} ${m}: ${stat}${due}`;
      });

      const body = [
        `📋 STATEMENT OF ACCOUNT — ${yr}`,
        `Stall: ${st?.stall_number||"—"} | ${st?.section||"General"} Section`,
        `Monthly Rate: ₱${rate.toLocaleString("en-PH",{minimumFractionDigits:2})}`,
        ``,
        ...rows,
        ``,
        `Total Paid:    ₱${totalPaid.toLocaleString("en-PH",{minimumFractionDigits:2})}`,
        `Outstanding:   ₱${totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}`,
        ``,
        totalOut>0?"⚠️ Please settle your outstanding balance at the earliest convenience.":"✅ All stall fees are fully settled. Thank you!",
      ].join("\n");

      await (supabase.from("messages") as any).insert({
        thread_id: activeThread.id, sender_id: user!.id,
        recipient_id: activeThread.vendor_id, body, type: "penalty",
      });
      await (supabase.from("message_threads") as any)
        .update({ last_message: "📋 SOA sent", last_at: new Date().toISOString() })
        .eq("id", activeThread.id);
      await supabase.from("notifications").insert({
        user_id: activeThread.vendor_id,
        title: "📋 Statement of Account",
        message: `You have an outstanding balance of ₱${totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}. Check your messages.`,
        type: "overdue" as any,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-messages", activeThread.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-threads"] });
      toast.success("SOA sent to vendor!");
    } catch(e:any) {
      toast.error(e.message||"Failed to send SOA");
    } finally {
      setSendingSOA(false);
    }
  };

  const filteredVendors = allVendors.filter((v: any) =>
    v.name.toLowerCase().includes(searchVendor.toLowerCase()) ||
    v.stall.toLowerCase().includes(searchVendor.toLowerCase())
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">News & Messages</h1>
          <p className="text-sm text-muted-foreground">Publish announcements and send direct messages to vendors</p>
        </div>
        {tab === "announcements" && (
          <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-xl">
            <Plus className="h-4 w-4" /> New Announcement
          </Button>
        )}
        {tab === "messages" && (
          <Button onClick={() => setShowNewMsg(true)} className="gap-2 rounded-xl">
            <MessageSquare className="h-4 w-4" /> New Message
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1 max-w-xs">
        <button onClick={() => setTab("announcements")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab === "announcements" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Megaphone className="h-3.5 w-3.5" /> Announcements
        </button>
        <button onClick={() => setTab("messages")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab === "messages" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Messages
          {threads.filter((t: any) => t.unread > 0).length > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
              {threads.filter((t: any) => t.unread > 0).length}
            </span>
          )}
        </button>
      </div>

      {/* ── ANNOUNCEMENTS TAB ─────────────────────────────────────────────────── */}
      {tab === "announcements" && (
        <div className="space-y-5">
          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl border bg-card shadow-civic overflow-hidden">
                <div className="flex items-center justify-between border-b bg-secondary/40 px-6 py-4">
                  <div>
                    <h3 className="font-semibold text-foreground">New Announcement</h3>
                    <p className="text-xs text-muted-foreground">Will be sent as a notification to all vendors</p>
                  </div>
                  <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 hover:bg-secondary">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input placeholder="Announcement title" className="h-11 rounded-xl" value={title} onChange={e => setTitle(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Content</Label>
                    <Textarea placeholder="Write your announcement…" className="min-h-[120px] rounded-xl resize-none" value={content} onChange={e => setContent(e.target.value)} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => createNews.mutate()} disabled={createNews.isPending} className="gap-2 rounded-xl">
                      {createNews.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Publish & Notify All
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {newsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-4">
              {news.map((n: any) => (
                <div key={n.id} className="rounded-2xl border bg-card p-5 shadow-civic hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Megaphone className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{n.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(n.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => deleteNews.mutate(n.id)}
                      className="rounded-lg p-1.5 hover:bg-accent/10 text-muted-foreground hover:text-accent transition-colors shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed pl-12">{n.content}</p>
                </div>
              ))}
              {news.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3 text-muted-foreground">
                  <Megaphone className="h-10 w-10 opacity-20" />
                  <p className="font-medium">No announcements yet</p>
                  <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>Create first announcement</Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MESSAGES TAB ──────────────────────────────────────────────────────── */}
      {tab === "messages" && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]" style={{ height: "600px" }}>

          {/* Thread list */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden flex flex-col">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {threadsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                  <MessageSquare className="h-8 w-8 opacity-20" />
                  <p>No conversations yet</p>
                  <button onClick={() => setShowNewMsg(true)} className="text-xs text-primary hover:underline">Start one</button>
                </div>
              ) : (
                threads.map((t: any) => (
                  <button key={t.id} onClick={() => setActiveThread(t)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors ${activeThread?.id === t.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Store className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm truncate ${t.unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{t.vendor_name}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                          {t.last_at ? new Date(t.last_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"}) : ""}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Stall {t.stall}</p>
                      {t.last_message && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_message}</p>}
                    </div>
                    {t.unread > 0 && (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">{t.unread}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden flex flex-col">
            {!activeThread ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
                <MessageSquare className="h-10 w-10 opacity-20" />
                <p className="font-medium">Select a conversation</p>
                <p className="text-xs">or start a new message to a vendor</p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => setShowNewMsg(true)}>
                  <Plus className="h-3.5 w-3.5" /> New Message
                </Button>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="border-b px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{activeThread.vendor_name}</p>
                    <p className="text-xs text-muted-foreground">Stall {activeThread.stall} · {activeThread.section}</p>
                  </div>
                  <button onClick={() => setActiveThread(null)} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m: any) => {
                    const isMe = m.sender_id === user?.id;
                    const typeCfg = MSG_TYPE_CONFIG[m.type as keyof typeof MSG_TYPE_CONFIG] || MSG_TYPE_CONFIG.message;
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] space-y-1`}>
                          {!isMe && m.type !== "message" && (
                            <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${typeCfg.color}`}>
                              <typeCfg.icon className="h-3 w-3" />
                              {typeCfg.label}
                            </div>
                          )}
                          <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-secondary text-foreground rounded-bl-sm"
                          }`}>
                            {!isMe && m.type !== "message" && (
                              <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold mb-1.5 ${typeCfg.color}`}>
                                <typeCfg.icon className="h-3 w-3" />
                                {typeCfg.label}
                              </div>
                            )}
                            <p className="leading-relaxed">{m.body}</p>
                          </div>
                          <p className={`text-[10px] text-muted-foreground ${isMe ? "text-right" : "text-left"}`}>
                            {new Date(m.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                            {isMe && m.read_at && <CheckCheck className="inline h-3 w-3 ml-1 text-primary" />}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Start the conversation.</p>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Message type selector + input */}
                <div className="border-t p-4 space-y-3">
                  {/* SOA quick-send button */}
                  <button
                    onClick={sendSOA}
                    disabled={sendingSOA}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
                  >
                    {sendingSOA
                      ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" /> Generating SOA...</>
                      : <><FileText className="h-4 w-4" /> Send Statement of Account (SOA)</>}
                  </button>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["message","penalty","reminder"] as const).map(t => {
                      const cfg = MSG_TYPE_CONFIG[t];
                      return (
                        <button key={t} onClick={() => setMsgType(t)}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                            msgType === t ? `${cfg.color} border-current` : "border-border text-muted-foreground hover:bg-secondary"
                          }`}>
                          <cfg.icon className="h-3 w-3" />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder={msgType === "penalty" ? "Describe the penalty…" : msgType === "reminder" ? "Payment reminder message…" : "Type a message…"}
                      className="h-10 rounded-xl flex-1"
                      value={msgBody}
                      onChange={e => setMsgBody(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage.mutate()}
                    />
                    <Button size="icon" className="h-10 w-10 rounded-xl shrink-0"
                      disabled={!msgBody.trim() || sendMessage.isPending}
                      onClick={() => sendMessage.mutate()}>
                      {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New Message Modal */}
      <AnimatePresence>
        {showNewMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setShowNewMsg(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card rounded-2xl border shadow-xl w-full max-w-md overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-5 py-4">
                <h3 className="font-semibold text-foreground">New Message</h3>
                <button onClick={() => setShowNewMsg(false)} className="rounded-lg p-1.5 hover:bg-secondary">
                  <X className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search vendor by name or stall…" className="h-10 pl-9 rounded-xl"
                    value={searchVendor} onChange={e => setSearchVendor(e.target.value)} />
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
                  {filteredVendors.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">No vendors found</p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminNews;