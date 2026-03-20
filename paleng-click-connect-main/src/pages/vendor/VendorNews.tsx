import { useState, useRef, useEffect } from "react";
import { Loader2, Megaphone, MessageSquare, Send, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MSG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  message:      { label: "Message",      color: "bg-primary/10 text-primary"   },
  penalty:      { label: "⚠️ Penalty",   color: "bg-accent/10 text-accent"     },
  reminder:     { label: "🔔 Reminder",  color: "bg-amber-100 text-amber-700"  },
  announcement: { label: "Announcement", color: "bg-secondary text-foreground" },
};

const VendorNews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab,     setTab]     = useState<"news" | "messages">("news");
  const [msgBody, setMsgBody] = useState("");
  const [thread,  setThread]  = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Announcements ────────────────────────────────────────────────────────────
  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["vendor-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ── Thread with admin ─────────────────────────────────────────────────────────
  const { data: threadData } = useQuery({
    queryKey: ["vendor-thread", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase
        .from("message_threads")
        .select("*")
        .eq("vendor_id", user!.id)
        .order("last_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => { if (threadData) setThread(threadData); }, [threadData]);

  // ── Messages in thread ────────────────────────────────────────────────────────
  const { data: messages = [] } = useQuery({
    queryKey: ["vendor-messages", thread?.id],
    enabled: !!thread?.id,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", thread!.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // Auto scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Mark read on open
  useEffect(() => {
    if (thread && user && tab === "messages") {
      supabase.from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("thread_id", thread.id)
        .eq("recipient_id", user.id)
        .is("read_at", null)
        .then(() => queryClient.invalidateQueries({ queryKey: ["vendor-thread"] }));
    }
  }, [thread?.id, tab]);

  // Unread count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["vendor-unread", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      if (!thread?.id) return 0;
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("thread_id", thread.id)
        .eq("recipient_id", user!.id)
        .is("read_at", null);
      return count || 0;
    },
  });

  // ── Send reply ────────────────────────────────────────────────────────────────
  const sendReply = useMutation({
    mutationFn: async () => {
      if (!msgBody.trim() || !thread) throw new Error("No message or thread");
      const { error } = await supabase.from("messages").insert({
        thread_id:    thread.id,
        sender_id:    user!.id,
        recipient_id: thread.admin_id,
        body:         msgBody.trim(),
        type:         "message",
      });
      if (error) throw error;
      await supabase.from("message_threads")
        .update({ last_message: msgBody.trim(), last_at: new Date().toISOString() })
        .eq("id", thread.id);
    },
    onSuccess: () => {
      setMsgBody("");
      queryClient.invalidateQueries({ queryKey: ["vendor-messages", thread?.id] });
    },
    onError: (e: any) => console.error(e.message),
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">News & Messages</h1>
        <p className="text-sm text-muted-foreground">Announcements from the Municipal Treasurer's Office</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1 max-w-xs">
        <button onClick={() => setTab("news")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab === "news" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Megaphone className="h-3.5 w-3.5" /> News
        </button>
        <button onClick={() => setTab("messages")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab === "messages" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Messages
          {unreadCount > 0 && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">{unreadCount}</span>
          )}
        </button>
      </div>

      {/* ── NEWS TAB ──────────────────────────────────────────────────────────── */}
      {tab === "news" && (
        newsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {news.map((n: any) => (
              <div key={n.id} className="rounded-2xl border bg-card p-5 shadow-civic">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Megaphone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{n.title}</h3>
                      <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                        {new Date(n.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{n.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {news.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-2 text-muted-foreground">
                <Megaphone className="h-8 w-8 opacity-20" />
                <p className="text-sm">No announcements yet</p>
              </div>
            )}
          </div>
        )
      )}

      {/* ── MESSAGES TAB ─────────────────────────────────────────────────────── */}
      {tab === "messages" && (
        <div className="rounded-2xl border bg-card shadow-civic overflow-hidden flex flex-col" style={{ height: "520px" }}>

          {/* Chat header */}
          <div className="border-b bg-secondary/40 px-5 py-3.5">
            <p className="font-semibold text-foreground">Municipal Treasurer's Office</p>
            <p className="text-xs text-muted-foreground">Direct messages with the admin</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!thread ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <MessageSquare className="h-8 w-8 opacity-20" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs text-center max-w-xs">The admin will initiate a conversation. You'll see messages here and receive notifications.</p>
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">No messages yet in this conversation.</p>
            ) : (
              messages.map((m: any) => {
                const isMe   = m.sender_id === user?.id;
                const typeCfg = MSG_TYPE_CONFIG[m.type] || MSG_TYPE_CONFIG.message;
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[75%] space-y-1">
                      {!isMe && m.type !== "message" && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${typeCfg.color}`}>
                          {typeCfg.label}
                        </span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-secondary text-foreground rounded-bl-sm"
                      }`}>
                        <p className="leading-relaxed">{m.body}</p>
                      </div>
                      <p className={`text-[10px] text-muted-foreground ${isMe ? "text-right" : "text-left"}`}>
                        {new Date(m.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                        {isMe && m.read_at && <CheckCheck className="inline h-3 w-3 ml-1 text-primary" />}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply input */}
          {thread && (
            <div className="border-t p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type your reply…"
                  className="h-10 rounded-xl flex-1"
                  value={msgBody}
                  onChange={e => setMsgBody(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply.mutate()}
                />
                <Button size="icon" className="h-10 w-10 rounded-xl shrink-0"
                  disabled={!msgBody.trim() || sendReply.isPending}
                  onClick={() => sendReply.mutate()}>
                  {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VendorNews;