import VendorBottomNav from "@/components/VendorBottomNav";
import { useState, useRef, useEffect } from "react";
import { Loader2, Megaphone, MessageSquare, Send, X, CheckCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DS = {
  gradientHeader: "linear-gradient(160deg, #0d2240 0%, #1a3a5f 45%, #1d4ed8 80%, #2563eb 100%)",
  blue900: "#0d2240",
  blue800: "#1a3a5f",
  blue600: "#2563eb",
  blue50:  "#eff6ff",
  blue100: "#dbeafe",
};

const MSG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  message:      { label: "Message",      color: "bg-blue-50 text-blue-700"    },
  penalty:      { label: "⚠️ Penalty",   color: "bg-red-100 text-red-700"     },
  reminder:     { label: "🔔 Reminder",  color: "bg-amber-100 text-amber-700" },
  announcement: { label: "Announcement", color: "bg-slate-100 text-slate-700" },
};

const VendorNews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab,     setTab]     = useState<"news" | "messages">("news");
  const [msgBody, setMsgBody] = useState("");
  const [thread,  setThread]  = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Announcements ─────────────────────────────────────────────────────────
  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["vendor-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ── Thread with admin ──────────────────────────────────────────────────────
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

  // ── Messages ───────────────────────────────────────────────────────────────
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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

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

  // SOA helpers (kept exactly as original)
  const parseSOA = (body: string) => {
    try { const d = JSON.parse(body); return d.__soa ? d : null; } catch { return null; }
  };
  const printSOA = (soa: any) => {
    const fmt = (n:number) => `₱${n.toLocaleString("en-PH",{minimumFractionDigits:2})}`;
    const rows = soa.rows.map((r:any) => `<tr class="${(r.isFuture&&!r.isPartial)?"future":""}"><td>${r.label} ${soa.year}</td><td class="r">${r.paid>0?fmt(r.paid):"—"}</td><td class="r ${r.balance>0&&!r.isAdvance&&!r.isFully?"bal":""}">${(r.isFully||r.isAdvance)?"₱0.00":fmt(r.balance)}</td><td class="c ${r.isAdvance?"advance":r.isFully?"paid":r.isPartial?"part":(r.isFuture&&!r.isPartial)?"upcoming":"unpaid"}">${r.isAdvance?"★ Advance":r.isFully?"✓ Paid":r.isPartial?"Partial":(r.isFuture&&!r.isPartial)?"Upcoming":"Unpaid"}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>SOA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}.hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}.rep{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase}.lgu{font-size:13px;font-weight:bold;margin:3px 0}.ttl{font-size:18px;font-weight:bold;margin-top:5px}.sub{font-size:10px;color:#666}.info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:12px}.info-item label{font-size:9px;color:#666;text-transform:uppercase}.info-item p{font-weight:bold;font-size:12px;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:14px}thead tr{background:#111;color:#fff}thead th{padding:7px 10px;text-align:left;font-size:11px}thead th.r{text-align:right}thead th.c{text-align:center}tbody tr{border-bottom:1px solid #eee}tbody tr.future{opacity:.4}tbody td{padding:6px 10px}td.r{text-align:right;font-family:monospace}td.c{text-align:center;font-size:11px;font-weight:bold}td.bal{color:#c0392b;font-weight:bold}td.paid{color:#27ae60}td.part{color:#2980b9}td.unpaid{color:#c0392b}td.upcoming{color:#888}.totals{border-top:2px solid #111;padding:10px 0}.t-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}.t-row.big{font-size:15px;font-weight:bold;border-top:1px solid #ddd;margin-top:4px;padding-top:8px}.footer{margin-top:24px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}</style></head><body><div class="hdr"><div class="rep">Republic of the Philippines</div><div class="lgu">Municipality of San Juan, Batangas · Office of the Municipal Treasurer</div><div class="ttl">STATEMENT OF ACCOUNT</div><div class="sub">Public Market Stall Rental — Fiscal Year ${soa.year}</div></div><div class="info"><div class="info-item"><label>Vendor Name</label><p>${soa.vendorName}</p></div><div class="info-item"><label>Stall Number</label><p>${soa.stall}</p></div><div class="info-item"><label>Section</label><p>${soa.section}</p></div><div class="info-item"><label>Monthly Rate</label><p>${fmt(soa.rate)}</p></div></div><table><thead><tr><th>Period</th><th class="r">Paid</th><th class="r">Balance</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="t-row"><span style="color:#555">Total Paid</span><span style="color:#27ae60;font-family:monospace;font-weight:bold">${fmt(soa.totalPaid)}</span></div><div class="t-row big"><span>TOTAL OUTSTANDING</span><span style="font-family:monospace;color:${soa.totalOut>0?"#c0392b":"#27ae60"}">${fmt(soa.totalOut)}</span></div></div><div class="footer">PALENG-CLICK · ${new Date().toLocaleString("en-PH")}</div></body></html>`;
    const frame = document.createElement("iframe"); frame.style.display="none"; document.body.appendChild(frame);
    frame.srcdoc=html; frame.onload=()=>{setTimeout(()=>{frame.contentWindow?.print();document.body.removeChild(frame);},300);};
  };

  return (
    <div className="-mx-4 -mt-4 lg:mx-0 lg:mt-0">
      {/* Hero — unified */}
      <div className="lg:rounded-2xl lg:mb-4" style={{ background: DS.gradientHeader }}>
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-black text-white">News & Messages</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>Announcements from the Treasurer's Office</p>
        </div>
      </div>

      {/* Tab bar — unified */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 lg:bg-transparent lg:border-none lg:px-0 lg:mb-4">
        <div className="flex gap-1 rounded-xl p-1"
          style={{ background: "#f1f5f9" }}>
          <button onClick={() => setTab("news")}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition-all"
            style={{
              background: tab === "news" ? "white" : "transparent",
              color: tab === "news" ? "#0f172a" : "#64748b",
              boxShadow: tab === "news" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>
            <Megaphone className="h-3.5 w-3.5" /> News
          </button>
          <button onClick={() => setTab("messages")}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition-all"
            style={{
              background: tab === "messages" ? "white" : "transparent",
              color: tab === "messages" ? "#0f172a" : "#64748b",
              boxShadow: tab === "messages" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>
            <MessageSquare className="h-3.5 w-3.5" /> Messages
            {unreadCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white font-bold"
                style={{ background: DS.blue600 }}>{unreadCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── NEWS TAB ──────────────────────────────────────────────────────── */}
      {tab === "news" && (
        newsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="px-4 pb-4 space-y-3 lg:px-0 lg:pb-0" style={{ background: "#f0f4f8" }}>
            <div className="pt-2 lg:pt-0" />
            {news.map((n: any) => (
              <div key={n.id} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #e2e8f0" }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: DS.blue50 }}>
                    <Megaphone className="h-4 w-4" style={{ color: DS.blue600 }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-slate-900 text-sm">{n.title}</h3>
                      <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                        {new Date(n.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{n.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {news.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-16 gap-2 text-muted-foreground"
                style={{ border: "1px solid #e2e8f0" }}>
                <Megaphone className="h-8 w-8 opacity-20" />
                <p className="text-sm">No announcements yet</p>
              </div>
            )}
            <div className="pb-2 lg:pb-0" />
          </div>
        )
      )}

      {/* ── MESSAGES TAB ──────────────────────────────────────────────────── */}
      {tab === "messages" && (
        <div className="px-4 pb-4 lg:px-0">
          <div className="rounded-2xl bg-white overflow-hidden flex flex-col"
            style={{ height: "520px", border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>

            {/* Chat header */}
            <div className="border-b px-5 py-3.5" style={{ background: "#f8fafc" }}>
              <p className="font-bold text-slate-900">Municipal Treasurer's Office</p>
              <p className="text-xs text-slate-400">Direct messages with admin</p>
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
                  const soa = parseSOA(m.body);
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`space-y-1 ${soa ? "w-full max-w-[95%]" : "max-w-[75%]"}`}>
                        {soa ? (
                          <div className="rounded-2xl border bg-card shadow-md overflow-hidden">
                            <div className="text-background text-center px-4 py-3" style={{ background: DS.blue900 }}>
                              <p className="text-[10px] tracking-widest uppercase opacity-60">Republic of the Philippines</p>
                              <p className="text-xs font-bold text-white">Municipality of San Juan, Batangas</p>
                              <p className="text-sm font-bold tracking-wide mt-1 text-white">STATEMENT OF ACCOUNT</p>
                              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>Fiscal Year {soa.year}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b text-xs" style={{ background: "#f8fafc" }}>
                              {[{l:"Vendor",v:soa.vendorName},{l:"Stall",v:soa.stall},{l:"Section",v:soa.section},{l:"Rate",v:`₱${soa.rate.toLocaleString("en-PH",{minimumFractionDigits:2})}/mo`}].map(x=>(
                                <div key={x.l}><p className="text-muted-foreground">{x.l}</p><p className="font-semibold text-foreground">{x.v}</p></div>
                              ))}
                            </div>
                            <div className="px-4 py-2">
                              <table className="w-full text-xs">
                                <thead><tr className="border-b">
                                  <th className="pb-1.5 text-left font-medium text-muted-foreground">Period</th>
                                  <th className="pb-1.5 text-right font-medium text-muted-foreground">Paid</th>
                                  <th className="pb-1.5 text-right font-medium text-muted-foreground">Balance</th>
                                  <th className="pb-1.5 text-center font-medium text-muted-foreground">Status</th>
                                </tr></thead>
                                <tbody className="divide-y">
                                  {soa.rows.map((r:any)=>(
                                    <tr key={r.month} className={r.isFuture?"opacity-40":""}>
                                      <td className="py-1 font-medium text-foreground">{r.label}</td>
                                      <td className="py-1 text-right font-mono">{r.paid>0?<span className="text-green-600">₱{r.paid.toLocaleString("en-PH",{minimumFractionDigits:2})}</span>:<span className="text-muted-foreground">—</span>}</td>
                                      <td className="py-1 text-right font-mono font-semibold">{(r.isFully||r.isAdvance)?<span className="text-green-600 font-mono">₱0.00</span>:<span className={r.isFuture&&!r.isPartial?"text-muted-foreground":"text-accent"}>₱{r.balance.toLocaleString("en-PH",{minimumFractionDigits:2})}</span>}</td>
                                      <td className="py-1 text-center">{r.isAdvance?<span className="text-blue-600 font-semibold">★ Advance</span>:r.isFully?<span className="text-green-600 font-semibold">✓ Paid</span>:r.isPartial?<span className="text-primary font-semibold">Partial</span>:(r.isFuture&&!r.isPartial)?<span className="text-muted-foreground">—</span>:<span className="text-accent font-semibold">Unpaid</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="border-t px-4 py-3 space-y-1 text-xs">
                              <div className="flex justify-between"><span className="text-muted-foreground">Total Paid ({soa.year})</span><span className="font-mono font-bold text-green-600">₱{soa.totalPaid.toLocaleString("en-PH",{minimumFractionDigits:2})}</span></div>
                              <div className="flex justify-between border-t pt-1"><span className="font-semibold text-foreground">TOTAL OUTSTANDING</span><span className={`font-mono font-bold text-base ${soa.totalOut>0?"text-accent":"text-green-600"}`}>₱{soa.totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}</span></div>
                            </div>
                            <div className="border-t px-4 py-2.5 flex items-center justify-between" style={{ background: "#f8fafc" }}>
                              <p className="text-[10px] text-muted-foreground">Received {new Date(m.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</p>
                              <button onClick={()=>printSOA(soa)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors">
                                <FileText className="h-3 w-3" /> Print / Save PDF
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                            isMe
                              ? "text-white rounded-br-sm"
                              : "text-slate-900 rounded-bl-sm"
                          }`}
                          style={{
                            background: isMe ? DS.blue800 : "#f1f5f9",
                          }}>
                            {!isMe && m.type !== "message" && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mb-1.5 ${typeCfg.color}`}>{typeCfg.label}</span>
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                          </div>
                        )}
                        <p className={`text-[10px] text-muted-foreground ${isMe ? "text-right" : "text-left"}`}>
                          {new Date(m.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                          {isMe && m.read_at && <CheckCheck className="inline h-3 w-3 ml-1 text-blue-500" />}
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
                  <button
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
                    style={{ background: DS.blue600 }}
                    disabled={!msgBody.trim() || sendReply.isPending}
                    onClick={() => sendReply.mutate()}>
                    {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unified bottom nav — mobile only */}
      <VendorBottomNav />
    </div>
  );
};

export default VendorNews;
