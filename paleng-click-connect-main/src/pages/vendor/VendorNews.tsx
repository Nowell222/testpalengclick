import VendorBottomNav from "@/components/VendorBottomNav";
import { useState, useRef, useEffect } from "react";
import {
  Loader2, Megaphone, MessageSquare, Send, X, CheckCheck,
  FileText, Pin, Clock, AlertTriangle, Bell, Calendar, Tag,
  ChevronDown, ChevronUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Design tokens matching the vendor app ─────────────────────────────────────
const DS = {
  gradientHeader: "linear-gradient(160deg, #0d2240 0%, #1a3a5f 45%, #1d4ed8 80%, #2563eb 100%)",
  blue900: "#0d2240", blue800: "#1a3a5f", blue600: "#2563eb", blue50: "#eff6ff", blue100: "#dbeafe",
};

const MSG_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  message:      { label: "Message",      color: "bg-blue-50 text-blue-700"    },
  penalty:      { label: "⚠️ Penalty",   color: "bg-red-100 text-red-700"     },
  reminder:     { label: "🔔 Reminder",  color: "bg-amber-100 text-amber-700" },
  announcement: { label: "Announcement", color: "bg-slate-100 text-slate-700" },
};

// ── Announcement type config ──────────────────────────────────────────────────
const ANN_TYPE: Record<string, { label: string; icon: string; headerBg: string; badgeBg: string; badgeText: string }> = {
  announcement: { label: "Announcement", icon: "📢", headerBg: "linear-gradient(135deg,#1e3a8a,#2563eb)", badgeBg: "#dbeafe", badgeText: "#1d4ed8" },
  notice:       { label: "Notice",       icon: "📋", headerBg: "linear-gradient(135deg,#334155,#64748b)", badgeBg: "#f1f5f9", badgeText: "#475569" },
  reminder:     { label: "Reminder",     icon: "🔔", headerBg: "linear-gradient(135deg,#92400e,#d97706)", badgeBg: "#fef3c7", badgeText: "#92400e" },
  urgent:       { label: "URGENT",       icon: "🚨", headerBg: "linear-gradient(135deg,#7f1d1d,#dc2626)", badgeBg: "#fee2e2", badgeText: "#991b1b" },
  event:        { label: "Event",        icon: "📅", headerBg: "linear-gradient(135deg,#4c1d95,#7c3aed)", badgeBg: "#ede9fe", badgeText: "#5b21b6" },
  fee_update:   { label: "Fee Update",   icon: "💰", headerBg: "linear-gradient(135deg,#064e3b,#059669)", badgeBg: "#d1fae5", badgeText: "#065f46" },
};

const getAnnType = (n: any) => ANN_TYPE[n.type] || ANN_TYPE.announcement;

const VendorNews = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab,          setTab]          = useState<"news" | "messages">("news");
  const [msgBody,      setMsgBody]      = useState("");
  const [thread,       setThread]       = useState<any>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Announcements ──────────────────────────────────────────────────────────
  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["vendor-announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // ── Thread + messages ──────────────────────────────────────────────────────
  const { data: threadData } = useQuery({
    queryKey: ["vendor-thread", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase.from("message_threads")
        .select("*").eq("vendor_id", user!.id).order("last_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });
  useEffect(() => { if (threadData) setThread(threadData); }, [threadData]);

  const { data: messages = [] } = useQuery({
    queryKey: ["vendor-messages", thread?.id],
    enabled: !!thread?.id,
    refetchInterval: 3000,
    queryFn: async () => {
      const { data } = await supabase.from("messages").select("*").eq("thread_id", thread!.id).order("created_at", { ascending: true });
      return data || [];
    },
  });

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (thread && user && tab === "messages") {
      supabase.from("messages").update({ read_at: new Date().toISOString() })
        .eq("thread_id", thread.id).eq("recipient_id", user.id).is("read_at", null)
        .then(() => queryClient.invalidateQueries({ queryKey: ["vendor-thread"] }));
    }
  }, [thread?.id, tab]);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["vendor-unread", user?.id, thread?.id],
    enabled: !!user && !!thread?.id,
    refetchInterval: 5000,
    queryFn: async () => {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("thread_id", thread!.id).eq("recipient_id", user!.id).is("read_at", null);
      return count || 0;
    },
  });

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!msgBody.trim() || !thread) throw new Error("No message or thread");
      const { error } = await supabase.from("messages").insert({
        thread_id: thread.id, sender_id: user!.id, recipient_id: thread.admin_id,
        body: msgBody.trim(), type: "message",
      });
      if (error) throw error;
      await supabase.from("message_threads").update({ last_message: msgBody.trim(), last_at: new Date().toISOString() }).eq("id", thread.id);
    },
    onSuccess: () => { setMsgBody(""); queryClient.invalidateQueries({ queryKey: ["vendor-messages", thread?.id] }); },
    onError: (e: any) => console.error(e.message),
  });

  const parseSOA = (body: string) => { try { const d = JSON.parse(body); return d.__soa ? d : null; } catch { return null; } };
  const printSOA = (soa: any) => {
    const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
    const rows = soa.rows.map((r: any) => `<tr class="${(r.isFuture && !r.isPartial) ? "future" : ""}"><td>${r.label} ${soa.year}</td><td class="r">${r.paid > 0 ? fmt(r.paid) : "—"}</td><td class="r ${r.balance > 0 && !r.isAdvance && !r.isFully ? "bal" : ""}">${(r.isFully || r.isAdvance) ? "₱0.00" : fmt(r.balance)}</td><td class="c ${r.isAdvance ? "advance" : r.isFully ? "paid" : r.isPartial ? "part" : (r.isFuture && !r.isPartial) ? "upcoming" : "unpaid"}">${r.isAdvance ? " Advance" : r.isFully ? "✓ Paid" : r.isPartial ? "Partial" : (r.isFuture && !r.isPartial) ? "Upcoming" : "Unpaid"}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>SOA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}.hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}.ttl{font-size:18px;font-weight:bold;margin-top:5px}.info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:12px}.info-item label{font-size:9px;color:#666;text-transform:uppercase}.info-item p{font-weight:bold;font-size:12px;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:14px}thead tr{background:#111;color:#fff}thead th{padding:7px 10px;text-align:left;font-size:11px}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:6px 10px;border-bottom:1px solid #eee}td.r{text-align:right;font-family:monospace}td.c{text-align:center;font-size:11px;font-weight:bold}td.bal{color:#c0392b;font-weight:bold}td.paid{color:#27ae60}td.unpaid{color:#c0392b}.totals{border-top:2px solid #111;padding:10px 0}.t-row{display:flex;justify-content:space-between;padding:4px 0}.t-row.big{font-size:15px;font-weight:bold;border-top:1px solid #ddd;margin-top:4px;padding-top:8px}</style></head><body><div class="hdr"><div style="font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase">Republic of the Philippines</div><div style="font-size:13px;font-weight:bold;margin:3px 0">Municipality of San Juan, Batangas · Office of the Municipal Treasurer</div><div class="ttl">STATEMENT OF ACCOUNT</div></div><div class="info"><div class="info-item"><label>Vendor</label><p>${soa.vendorName}</p></div><div class="info-item"><label>Stall</label><p>${soa.stall}</p></div><div class="info-item"><label>Section</label><p>${soa.section}</p></div><div class="info-item"><label>Rate</label><p>${fmt(soa.rate)}/mo</p></div></div><table><thead><tr><th>Period</th><th class="r">Paid</th><th class="r">Balance</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="t-row"><span style="color:#555">Total Paid</span><span style="color:#27ae60;font-family:monospace;font-weight:bold">${fmt(soa.totalPaid)}</span></div><div class="t-row big"><span>TOTAL OUTSTANDING</span><span style="font-family:monospace;color:${soa.totalOut > 0 ? "#c0392b" : "#27ae60"}">${fmt(soa.totalOut)}</span></div></div></body></html>`;
    const frame = document.createElement("iframe"); frame.style.display = "none"; document.body.appendChild(frame);
    frame.srcdoc = html; frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
  };

  // Sort: pinned first, then by date
  const sortedNews = [...news].sort((a: any, b: any) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const urgentNews   = sortedNews.filter((n: any) => n.type === "urgent");
  const pinnedNews   = sortedNews.filter((n: any) => n.is_pinned && n.type !== "urgent");
  const regularNews  = sortedNews.filter((n: any) => !n.is_pinned && n.type !== "urgent");

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
  const formatRelative = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days/7)} week${Math.floor(days/7) > 1 ? "s" : ""} ago`;
    return formatDate(d);
  };

  // ── News card component ────────────────────────────────────────────────────
  const NewsCard = ({ n, featured = false }: { n: any; featured?: boolean }) => {
    const cfg = getAnnType(n);
    const isExpanded = expandedId === n.id;
    const isLong = n.content?.length > 160;

    if (featured) {
      return (
        <div style={{ background: cfg.headerBg, borderRadius: 16, padding: "24px 28px", marginBottom: 16, position: "relative", overflow: "hidden" }}>
          {/* Decorative circle */}
          <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.1)", pointerEvents: "none" }}/>
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "20px 20px", pointerEvents: "none" }}/>

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {n.is_pinned && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase", border: "1px solid rgba(255,255,255,0.25)" }}>
                  📌 Pinned
                </span>
              )}
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 10, fontWeight: 700, border: "1px solid rgba(255,255,255,0.25)" }}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginBottom: 10 }}>{n.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, maxWidth: 600 }}>
              {isExpanded || !isLong ? n.content : n.content.slice(0, 160) + "…"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                <Clock size={11}/> {formatDate(n.created_at)} · {formatRelative(n.created_at)}
              </span>
              {n.target_section && n.target_section !== "all" && (
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  <Users size={11}/> {n.target_section}
                </span>
              )}
              {isLong && (
                <button onClick={() => setExpandedId(isExpanded ? null : n.id)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 8, background: "#fff", fontSize: 11, fontWeight: 700, color: DS.blue900, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  {isExpanded ? <><ChevronUp size={12}/> Show Less</> : <><ChevronDown size={12}/> Read More</>}
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", transition: "all 0.15s" }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 14px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLDivElement).style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; (e.currentTarget as HTMLDivElement).style.transform = "none"; }}>

        {/* Color header strip */}
        <div style={{ height: 6, background: cfg.headerBg }}/>

        <div style={{ padding: "16px 18px" }}>
          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {n.is_pinned && <Pin size={12} style={{ color: "#f59e0b", flexShrink: 0 }}/>}
              <span style={{ padding: "3px 9px", borderRadius: 999, background: cfg.badgeBg, color: cfg.badgeText, fontSize: 10, fontWeight: 700 }}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <span style={{ fontSize: 10, color: "#94a3b8", flexShrink: 0 }}>{formatRelative(n.created_at)}</span>
          </div>

          {/* Title */}
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", lineHeight: 1.4, marginBottom: 8 }}>{n.title}</div>

          {/* Content */}
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
            {isExpanded || !isLong ? n.content : n.content.slice(0, 140) + "…"}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#94a3b8" }}>
                <Clock size={10}/> {formatDate(n.created_at)}
              </span>
              {n.target_section && n.target_section !== "all" && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#94a3b8" }}>
                  <Users size={10}/> {n.target_section}
                </span>
              )}
            </div>
            {isLong && (
              <button onClick={() => setExpandedId(isExpanded ? null : n.id)}
                style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: DS.blue600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                {isExpanded ? <><ChevronUp size={12}/> Show Less</> : <><ChevronDown size={12}/> Read More</>}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="-mx-4 -mt-4 lg:mx-0 lg:mt-0">

      {/* ── Mobile header ─────────────────────────────────────────────────── */}
      <div className="lg:hidden" style={{ background: DS.gradientHeader }}>
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-black text-white">News & Messages</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>Announcements from the Treasurer's Office</p>
          {urgentNews.length > 0 && (
            <div style={{ marginTop: 10, background: "rgba(220,38,38,0.25)", border: "1px solid rgba(220,38,38,0.4)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} style={{ color: "#fca5a5", flexShrink: 0 }}/>
              <p style={{ fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>{urgentNews.length} urgent notice{urgentNews.length > 1 ? "s" : ""} — tap to view</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop header ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex items-start justify-between px-8 pt-6 pb-2">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Market News & Announcements</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Stay informed with the latest updates from the market administration</p>
        </div>
        {urgentNews.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 10, padding: "8px 14px" }}>
            <AlertTriangle size={14} style={{ color: "#dc2626", flexShrink: 0 }}/>
            <p style={{ fontSize: 12, color: "#991b1b", fontWeight: 700 }}>{urgentNews.length} Urgent Notice{urgentNews.length > 1 ? "s" : ""}</p>
          </div>
        )}
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 bg-white border-b border-slate-100 lg:hidden">
        <div className="flex gap-1 rounded-xl p-1" style={{ background: "#f1f5f9" }}>
          {[{ key: "news", label: "News", icon: Megaphone }, { key: "messages", label: "Messages", icon: MessageSquare }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-bold transition-all"
              style={{ background: tab === t.key ? "white" : "transparent", color: tab === t.key ? "#0f172a" : "#64748b", boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
              <t.icon size={14}/> {t.label}
              {t.key === "messages" && unreadCount > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999 }}>{unreadCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop tab strip */}
      <div className="hidden lg:flex px-8 pt-4 gap-2">
        {[{ key: "news", label: "News", icon: Megaphone }, { key: "messages", label: "Messages", icon: MessageSquare }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: "inherit", background: tab === t.key ? DS.blue600 : "transparent", color: tab === t.key ? "#fff" : "#64748b" }}>
            <t.icon size={14}/> {t.label}
            {t.key === "messages" && unreadCount > 0 && (
              <span style={{ background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 999 }}>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════ NEWS TAB ════════════════════════════════════════ */}
      {tab === "news" && (
        newsLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" style={{ color: DS.blue600 }}/></div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "#94a3b8" }}>
            <Megaphone size={32} style={{ opacity: 0.2 }}/>
            <p style={{ fontSize: 14 }}>No announcements yet</p>
          </div>
        ) : (
          <>
            {/* ── Mobile list ─────────────────────────────────────────────── */}
            <div className="lg:hidden px-4 pb-24 space-y-3 pt-3" style={{ background: "#f0f4f8" }}>
              {urgentNews.map((n: any) => <NewsCard key={n.id} n={n} featured/>)}
              {pinnedNews.map((n: any) => <NewsCard key={n.id} n={n} featured/>)}
              {regularNews.map((n: any) => <NewsCard key={n.id} n={n}/>)}
            </div>

            {/* ── Desktop layout ───────────────────────────────────────────── */}
            <div className="hidden lg:block" style={{ padding: "16px 32px 40px" }}>

              {/* Urgent alerts */}
              {urgentNews.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  {urgentNews.map((n: any) => <NewsCard key={n.id} n={n} featured/>)}
                </div>
              )}

              {/* Pinned featured */}
              {pinnedNews.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  {pinnedNews.map((n: any) => <NewsCard key={n.id} n={n} featured/>)}
                </div>
              )}

              {/* Regular news — table-style list for easy scanning */}
              {regularNews.length > 0 && (
                <div>
                  {/* Section label */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <div style={{ height: 1, flex: 1, background: "#e2e8f0" }}/>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1.2 }}>All Posts ({regularNews.length})</span>
                    <div style={{ height: 1, flex: 1, background: "#e2e8f0" }}/>
                  </div>

                  {/* Compact table */}
                  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                    {/* Table header */}
                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 130px 110px", gap: "0 16px", padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      {["Type", "Title & Details", "Audience", "Date"].map(h => (
                        <div key={h} style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#94a3b8" }}>{h}</div>
                      ))}
                    </div>

                    {/* Table rows */}
                    {regularNews.map((n: any, idx: number) => {
                      const cfg = getAnnType(n);
                      const isExpanded = expandedId === n.id;
                      const isLong = n.content?.length > 120;
                      return (
                        <div key={n.id} style={{
                          display: "grid", gridTemplateColumns: "130px 1fr 130px 110px", gap: "0 16px",
                          padding: "14px 20px", borderBottom: idx < regularNews.length - 1 ? "1px solid #f1f5f9" : "none",
                          background: "#fff", transition: "background 0.1s",
                        }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}>

                          {/* Type */}
                          <div style={{ paddingTop: 2 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: cfg.badgeBg, color: cfg.badgeText, fontSize: 11, fontWeight: 700 }}>
                              {cfg.icon} {cfg.label}
                            </span>
                          </div>

                          {/* Title + content */}
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {n.is_pinned && <Pin size={12} style={{ color: "#f59e0b", flexShrink: 0 }}/>}
                              <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.4 }}>{n.title}</p>
                            </div>
                            <p style={{ fontSize: 12, color: "#64748b", marginTop: 4, lineHeight: 1.6 }}>
                              {isExpanded || !isLong ? n.content : n.content.slice(0, 120) + "…"}
                            </p>
                            {isLong && (
                              <button onClick={() => setExpandedId(isExpanded ? null : n.id)}
                                style={{ display: "inline-flex", alignItems: "center", gap: 3, marginTop: 4, fontSize: 11, fontWeight: 700, color: DS.blue600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                                {isExpanded ? <><ChevronUp size={11}/> Show less</> : <><ChevronDown size={11}/> Read more</>}
                              </button>
                            )}
                          </div>

                          {/* Audience */}
                          <div style={{ paddingTop: 2 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#64748b" }}>
                              <Users size={11}/>
                              {n.target_section && n.target_section !== "all" ? n.target_section : "All Vendors"}
                            </span>
                          </div>

                          {/* Date */}
                          <div style={{ paddingTop: 2 }}>
                            <p style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>
                              {new Date(n.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{formatRelative(n.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )
      )}

      {/* ═══════════════════ MESSAGES TAB ════════════════════════════════════ */}
      {tab === "messages" && (
        <div className="px-4 pb-24 lg:px-8 lg:pb-8 lg:pt-5">
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
                  <MessageSquare className="h-8 w-8 opacity-20"/>
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs text-center max-w-xs">The admin will initiate a conversation. You'll see messages here and receive notifications.</p>
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No messages yet in this conversation.</p>
              ) : (
                messages.map((m: any) => {
                  const isMe = m.sender_id === user?.id;
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
                              {[{ l: "Vendor", v: soa.vendorName }, { l: "Stall", v: soa.stall }, { l: "Section", v: soa.section }, { l: "Rate", v: `₱${soa.rate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}/mo` }].map(x => (
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
                                  {soa.rows.map((r: any) => (
                                    <tr key={r.month} className={r.isFuture ? "opacity-40" : ""}>
                                      <td className="py-1 font-medium text-foreground">{r.label}</td>
                                      <td className="py-1 text-right font-mono">{r.paid > 0 ? <span className="text-green-600">₱{r.paid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span> : <span className="text-muted-foreground">—</span>}</td>
                                      <td className="py-1 text-right font-mono font-semibold">{(r.isFully || r.isAdvance) ? <span className="text-green-600">₱0.00</span> : <span className={r.isFuture && !r.isPartial ? "text-muted-foreground" : "text-accent"}>₱{r.balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>}</td>
                                      <td className="py-1 text-center">{r.isAdvance ? <span className="text-blue-600 font-semibold"> Advance</span> : r.isFully ? <span className="text-green-600 font-semibold">✓ Paid</span> : r.isPartial ? <span className="text-primary font-semibold">Partial</span> : (r.isFuture && !r.isPartial) ? <span className="text-muted-foreground">—</span> : <span className="text-accent font-semibold">Unpaid</span>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div className="border-t px-4 py-3 space-y-1 text-xs">
                              <div className="flex justify-between"><span className="text-muted-foreground">Total Paid ({soa.year})</span><span className="font-mono font-bold text-green-600">₱{soa.totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                              <div className="flex justify-between border-t pt-1"><span className="font-semibold text-foreground">TOTAL OUTSTANDING</span><span className={`font-mono font-bold text-base ${soa.totalOut > 0 ? "text-accent" : "text-green-600"}`}>₱{soa.totalOut.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                            </div>
                            <div className="border-t px-4 py-2.5 flex items-center justify-between" style={{ background: "#f8fafc" }}>
                              <p className="text-[10px] text-muted-foreground">Received {new Date(m.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                              <button onClick={() => printSOA(soa)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors">
                                <FileText className="h-3 w-3"/> Print / Save PDF
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? "text-white rounded-br-sm" : "text-slate-900 rounded-bl-sm"}`}
                            style={{ background: isMe ? DS.blue800 : "#f1f5f9" }}>
                            {!isMe && m.type !== "message" && (
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold mb-1.5 ${typeCfg.color}`}>{typeCfg.label}</span>
                            )}
                            <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                          </div>
                        )}
                        <p className={`text-[10px] text-muted-foreground ${isMe ? "text-right" : "text-left"}`}>
                          {new Date(m.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                          {isMe && m.read_at && <CheckCheck className="inline h-3 w-3 ml-1 text-blue-500"/>}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef}/>
            </div>

            {/* Input */}
            {thread && (
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input placeholder="Type your reply…" className="h-10 rounded-xl flex-1"
                    value={msgBody} onChange={e => setMsgBody(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendReply.mutate()}/>
                  <button className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 disabled:opacity-50"
                    style={{ background: DS.blue600 }}
                    disabled={!msgBody.trim() || sendReply.isPending}
                    onClick={() => sendReply.mutate()}>
                    {sendReply.isPending ? <Loader2 className="h-4 w-4 animate-spin text-white"/> : <Send className="h-4 w-4 text-white"/>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <VendorBottomNav/>
    </div>
  );
};

export default VendorNews;