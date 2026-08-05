import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Trash2, Loader2, Megaphone, MessageSquare, Send,
  AlertTriangle, Bell, X, Search, ChevronRight,
  CheckCheck, Store, FileText, Pin, Tag, Users,
  Clock, Eye, TrendingUp, Newspaper, Filter,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ── Constants ──────────────────────────────────────────────────────────────────
const MSG_TYPE_CONFIG = {
  message: { label: "Message", icon: MessageSquare, color: "bg-green-700/10 text-green-700" },
  penalty: { label: "Urgent", icon: AlertTriangle, color: "bg-accent/10 text-accent" },
  reminder: { label: "Reminder", icon: Bell, color: "bg-amber-100 text-amber-700" },
  announcement: { label: "Announcement", icon: Megaphone, color: "bg-secondary text-foreground" },
};

const ANNOUNCEMENT_TYPES = [
  { value: "announcement", label: "📢 Announcement", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "notice", label: "📋 Notice", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "reminder", label: "🔔 Reminder", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "urgent", label: "🚨 Urgent", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "event", label: "📅 Event", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "fee_update", label: "💰 Fee Update", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
];

const TYPE_STYLE: Record<string, string> = {
  announcement: "bg-blue-100 text-blue-700 border-blue-200",
  notice: "bg-slate-100 text-slate-700 border-slate-200",
  reminder: "bg-amber-100 text-amber-700 border-amber-200",
  urgent: "bg-red-100 text-red-700 border-red-200",
  event: "bg-purple-100 text-purple-700 border-purple-200",
  fee_update: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const TYPE_LABEL: Record<string, string> = {
  announcement: "📢 Announcement",
  notice: "📋 Notice",
  reminder: "🔔 Reminder",
  urgent: "🚨 Urgent",
  event: "📅 Event",
  fee_update: "💰 Fee Update",
};

// ── Thread hooks ───────────────────────────────────────────────────────────────
const useThreads = (adminId: string) => useQuery({
  queryKey: ["admin-threads", adminId],
  enabled: !!adminId,
  refetchInterval: 5000,
  queryFn: async () => {
    const { data: threads } = await supabase
      .from("message_threads").select("*").eq("admin_id", adminId).order("last_at", { ascending: false });
    if (!threads?.length) return [];
    const vendorUserIds = threads.map(t => t.vendor_id);
    const [profilesRes, unreadRes] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", vendorUserIds),
      supabase.from("messages").select("thread_id, id").is("read_at", null).eq("recipient_id", adminId),
    ]);
    const profiles = profilesRes.data || [];
    const unreadMap: Record<string, number> = {};
    (unreadRes.data || []).forEach(m => { unreadMap[m.thread_id] = (unreadMap[m.thread_id] || 0) + 1; });
    const { data: vendors } = await supabase.from("vendors").select("user_id, stalls(stall_number, section)").in("user_id", vendorUserIds);
    return threads.map(t => {
      const pr = profiles.find(p => p.user_id === t.vendor_id);
      const v = vendors?.find(v => v.user_id === t.vendor_id);
      const st = v?.stalls as any;
      return { ...t, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number || "—", section: st?.section || "", unread: unreadMap[t.id] || 0 };
    });
  },
});

const useMessages = (threadId: string | null) => useQuery({
  queryKey: ["admin-messages", threadId],
  enabled: !!threadId,
  refetchInterval: 3000,
  queryFn: async () => {
    const { data } = await supabase.from("messages").select("*").eq("thread_id", threadId!).order("created_at", { ascending: true });
    return data || [];
  },
});

// ── Main Component ─────────────────────────────────────────────────────────────
const AdminNews = () => {
  const { user, role } = useAuth();
  const isReadOnly = role === "eemo";
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"announcements" | "messages">("announcements");
  const [showCreate, setShowCreate] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [annType, setAnnType] = useState("announcement");
  const [isPinned, setIsPinned] = useState(false);
  const [targetSection, setTargetSection] = useState("all");
  const [activeThread, setActiveThread] = useState<any>(null);
  const [msgBody, setMsgBody] = useState("");
  const [msgType, setMsgType] = useState<"message" | "penalty" | "reminder">("message");
  const [searchVendor, setSearchVendor] = useState("");
  const [showNewMsg, setShowNewMsg] = useState(false);
  const [sendingSOA, setSendingSOA] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SECTIONS = [
    "All Vendors",
    "Building I - 1st Floor",
    "Building II - 1st Floor",
    "Building I - 2nd Floor",
    "Building II - 2nd Floor",
    "Bldg 1 & 2 Bolante",
    "Outside the Building - Bolante",
    "New Building - Mojica",
    "New Building - Kalayaan",
    "Meat Stalls",
    "Fish Stalls",
    "Egg and Dried Fish",
    "Eatery 2nd Floor",
    "Vegetable Section",
    "Vegetable Section - Extension"
  ];

  // ── Push helper ──────────────────────────────────────────────────────────────
  const sendMessagePush = async (vendorUserId: string, pushTitle: string, pushBody: string, urlPath = "/vendor/notifications") => {
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-vendor`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
        body: JSON.stringify({ vendor_user_id: vendorUserId, _push_only: true, _push_title: pushTitle, _push_body: pushBody, _url: urlPath }),
      });
    } catch { }
  };

  // ── Announcements query ──────────────────────────────────────────────────────
  const { data: news = [], isLoading: newsLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: threads = [], isLoading: threadsLoading } = useThreads(user?.id || "");
  const { data: messages = [] } = useMessages(activeThread?.id || null);

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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    if (activeThread && user && !isReadOnly) {
      supabase.from("messages").update({ read_at: new Date().toISOString() })
        .eq("thread_id", activeThread.id).eq("recipient_id", user.id).is("read_at", null)
        .then(() => queryClient.invalidateQueries({ queryKey: ["admin-threads"] }));
    }
  }, [activeThread?.id, isReadOnly]);

  // ── Derived stats ─────────────────────────────────────────────────────────────
  const totalReach = allVendors.length || 0;
  const pinnedCount = news.filter((n: any) => n.is_pinned).length;
  const urgentCount = news.filter((n: any) => n.type === "urgent").length;

  const filteredNews = filterType === "all" ? news : news.filter((n: any) => (n.type || "announcement") === filterType);

  // ── Create announcement ───────────────────────────────────────────────────────
  const createNews = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !content.trim()) throw new Error("Title and content are required");
      const { error } = await supabase.from("announcements").insert({
        title, content, published_by: user?.id,
        // Extra fields — add these columns via migration if needed; they fail silently otherwise
        type: annType, is_pinned: isPinned, target_section: targetSection === "all" ? null : targetSection,
      } as any);
      if (error) throw error;

      // Target specific vendors or all
      let vendorQuery = supabase.from("vendors").select("user_id, stalls(section)");
      const { data: vendors } = await vendorQuery;

      const targetedVendors = targetSection === "all"
        ? (vendors || [])
        : (vendors || []).filter((v: any) => (v.stalls as any)?.section === targetSection);

      if (targetedVendors.length) {
        await supabase.from("notifications").insert(
          targetedVendors.map(v => ({
            user_id: v.user_id, title, message: content.slice(0, 200), type: "announcement",
          }))
        );
        try {
          const anonKey = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY || "";
          const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || "";
          for (const v of targetedVendors) {
            fetch(`${supabaseUrl}/functions/v1/notify-vendor`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "apikey": anonKey, "Authorization": `Bearer ${anonKey}` },
              body: JSON.stringify({
                vendor_user_id: v.user_id, _push_only: true,
                _push_title: `${TYPE_LABEL[annType] || "📢"} ${title}`, _push_body: content.slice(0, 120),
              }),
            }).catch(() => { });
          }
        } catch { }
      }
    },
    onSuccess: () => {
      toast.success(`Announcement published! ${targetSection === "all" ? "All vendors" : targetSection} notified.`);
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setShowCreate(false); setTitle(""); setContent(""); setAnnType("announcement"); setIsPinned(false); setTargetSection("all");
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

  const startThread = async (vendor: any) => {
    const { data: existing } = await supabase.from("message_threads").select("*").eq("vendor_id", vendor.user_id).eq("admin_id", user!.id).single();
    if (existing) { setActiveThread({ ...existing, vendor_name: vendor.name, stall: vendor.stall, section: vendor.section, unread: 0 }); setShowNewMsg(false); return; }
    const { data: thread } = await supabase.from("message_threads").insert({ vendor_id: vendor.user_id, admin_id: user!.id }).select().single();
    if (thread) { setActiveThread({ ...thread, vendor_name: vendor.name, stall: vendor.stall, section: vendor.section, unread: 0 }); queryClient.invalidateQueries({ queryKey: ["admin-threads"] }); }
    setShowNewMsg(false);
  };

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!msgBody.trim() || !activeThread) throw new Error("Empty message");
      const { error } = await supabase.from("messages").insert({ thread_id: activeThread.id, sender_id: user!.id, recipient_id: activeThread.vendor_id, body: msgBody.trim(), type: msgType });
      if (error) throw error;
      await supabase.from("message_threads").update({ last_message: msgBody.trim(), last_at: new Date().toISOString() }).eq("id", activeThread.id);
      const notifTitle = msgType === "penalty" ? "⚠️ Urgent Notice" : msgType === "reminder" ? "🔔 Payment Reminder" : "💬 New Message from Admin";
      await supabase.from("notifications").insert({ user_id: activeThread.vendor_id, title: notifTitle, message: msgBody.trim().slice(0, 200), type: msgType === "penalty" ? "overdue" : msgType === "reminder" ? "reminder" : "info" });
      await sendMessagePush(activeThread.vendor_id, notifTitle, msgBody.trim().slice(0, 120));
    },
    onSuccess: () => {
      setMsgBody("");
      queryClient.invalidateQueries({ queryKey: ["admin-messages", activeThread?.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-threads"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── SOA with auto follow-up message (restored from original) ─────────────────
  const sendSOA = async () => {
    if (!activeThread) return;
    setSendingSOA(true);
    try {
      const MF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const yr = new Date().getFullYear();
      const cm = new Date().getMonth() + 1;

      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, stall_id, stalls(id, stall_number, section, monthly_rate, location)")
        .eq("user_id", activeThread.vendor_id)
        .single();

      if (!vendor) throw new Error("Vendor not found");
      const st = vendor.stalls as any;
      const defaultRate = st?.monthly_rate || 1450;

      const [pmtsRes, schedulesRes] = await Promise.all([
        supabase.from("payments").select("period_month, amount").eq("vendor_id", vendor.id).eq("status", "completed").eq("period_year", yr),
        st?.id
          ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", st.id).eq("year", yr)
          : Promise.resolve({ data: [] }),
      ]);

      const pmts = pmtsRes.data || [];
      const schedules = schedulesRes.data || [];

      const getRate = (m: number): number => {
        const s = schedules.find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };
      const rate = defaultRate;

      // ── Raw paid map ──────────────────────────────────────────────────────
      const rawPm: Record<number, number> = {};
      (pmts || []).forEach((p: any) => {
        if (p.period_month) rawPm[p.period_month] = (rawPm[p.period_month] || 0) + Number(p.amount);
      });

      // ── Cascade excess payments forward ───────────────────────────────────
      const effMap: Record<number, number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m = getRate(m);
        const credited = (rawPm[m] || 0) + carry;
        effMap[m] = credited;
        carry = credited >= due_m ? (credited - due_m) : 0;
      }

      const totalPaid = Object.values(rawPm).reduce((s, v) => s + v, 0);
      const totalOut = MF.reduce((sum, _, i) => {
        const m = i + 1; if (m > cm) return sum;
        return sum + Math.max(0, getRate(m) - (effMap[m] || 0));
      }, 0);

      const soaData = {
        __soa: true,
        year: yr,
        stall: st?.stall_number || "—",
        section: st?.section || "General",
        location: st?.location || "—",
        vendorName: activeThread.vendor_name,
        rate,
        rows: MF.map((month, i) => {
          const m = i + 1;
          const due_m = getRate(m);
          const credited = effMap[m] || 0;
          const displayPaid = Math.min(credited, due_m);
          const balance = Math.max(0, due_m - credited);
          const isAdvance = m > cm && credited >= due_m;
          const isFuture = m > cm && credited === 0;
          const isFully = credited >= due_m && !isAdvance;
          const isPartial = credited > 0 && credited < due_m;
          return { month, label: month, due: due_m, paid: displayPaid, balance, isFully, isPartial, isAdvance, isFuture };
        }),
        totalPaid,
        totalOut,
        printedAt: new Date().toISOString(),
      };

      const body = JSON.stringify(soaData);

      await (supabase.from("messages") as any).insert({
        thread_id: activeThread.id, sender_id: user!.id,
        recipient_id: activeThread.vendor_id, body, type: "penalty",
      });
      await (supabase.from("message_threads") as any)
        .update({ last_message: "📋 Statement of Account sent", last_at: new Date().toISOString() })
        .eq("id", activeThread.id);
      await supabase.from("notifications").insert({
        user_id: activeThread.vendor_id,
        title: "📋 Statement of Account",
        message: `Outstanding balance: ₱${totalOut.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. Please check your messages.`,
        type: "overdue" as any,
      });
      await sendMessagePush(
        activeThread.vendor_id,
        "📋 Statement of Account",
        `Outstanding balance: ₱${totalOut.toLocaleString("en-PH", { minimumFractionDigits: 2 })}. Please check your messages.`,
        "/vendor/notifications",
      );

      // ── Auto follow-up message based on payment status ────────────────────
      const currentMonthName = MF[new Date().getMonth()];
      const overdueMonths = MF.slice(0, cm).filter((_, i) => {
        const m = i + 1;
        return (effMap[m] || 0) < getRate(m);
      });
      const partialMonths = MF.slice(0, cm).filter((_, i) => {
        const m = i + 1;
        const paid = effMap[m] || 0;
        return paid > 0 && paid < getRate(m);
      });

      let autoMsg = "";
      let autoType: "message" | "penalty" | "reminder" = "message";

      if (totalOut === 0) {
        autoMsg = `✅ Good news! Your Statement of Account for ${soaData.year} shows that all stall fees are fully settled. Thank you for your prompt payments, ${activeThread.vendor_name}! Your cooperation is greatly appreciated by the Municipal Treasurer's Office.`;
        autoType = "message";
      } else if (overdueMonths.length >= 3) {
        const monthList = overdueMonths.slice(0, 5).join(", ");
        autoMsg = `⚠️ URGENT PAYMENT NOTICE\n\nDear ${activeThread.vendor_name},\n\nOur records show that your stall fee payments for the following month(s) are OVERDUE:\n📌 ${monthList}\n\nTotal Outstanding Balance: ₱${totalOut.toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n\nYou are hereby required to settle your outstanding balance immediately to avoid possible stall suspension.\n\nPlease visit the Municipal Treasurer's Office or pay online through the PALENG-CLICK system.\n\nThank you.`;
        autoType = "penalty";
      } else if (partialMonths.length > 0 || overdueMonths.length > 0) {
        const dueList = overdueMonths.slice(0, 3).join(", ");
        autoMsg = `🔔 PAYMENT REMINDER\n\nDear ${activeThread.vendor_name},\n\nThis is a friendly reminder that your stall fee for ${dueList || currentMonthName} has not been fully settled yet.\n\nOutstanding Balance: ₱${totalOut.toLocaleString("en-PH", { minimumFractionDigits: 2 })}\n\nPlease settle your balance at your earliest convenience either by visiting the cashier or paying online through the PALENG-CLICK app.\n\nThank you for your cooperation.`;
        autoType = "reminder";
      }

      if (autoMsg) {
        // Small delay so SOA card appears first
        await new Promise(r => setTimeout(r, 800));
        await (supabase.from("messages") as any).insert({
          thread_id: activeThread.id,
          sender_id: user!.id,
          recipient_id: activeThread.vendor_id,
          body: autoMsg,
          type: autoType,
        });
        await (supabase.from("message_threads") as any)
          .update({ last_message: autoMsg.slice(0, 60) + "...", last_at: new Date().toISOString() })
          .eq("id", activeThread.id);
        const autoNotifTitle =
          autoType === "penalty" ? "⚠️ Urgent Notice — Action Required" :
            autoType === "reminder" ? "🔔 Payment Reminder" :
              "✅ Payments Up to Date";
        await supabase.from("notifications").insert({
          user_id: activeThread.vendor_id,
          title: autoNotifTitle,
          message: autoMsg.replace(/\n/g, " ").slice(0, 200),
          type: autoType === "penalty" ? "overdue" as any : autoType === "reminder" ? "reminder" as any : "info" as any,
        });
        await sendMessagePush(
          activeThread.vendor_id,
          autoNotifTitle,
          autoMsg.replace(/\n/g, " ").slice(0, 120),
          "/vendor/notifications",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["admin-messages", activeThread.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-threads"] });
      toast.success("SOA and follow-up message sent to vendor!");
    } catch (e: any) {
      toast.error(e.message || "Failed to send SOA");
    } finally {
      setSendingSOA(false);
    }
  };

  const parseSOA = (body: string) => { try { const d = JSON.parse(body); return d.__soa ? d : null; } catch { return null; } };

  const printSOA = (soa: any) => {
    const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
    const rows = soa.rows.map((r: any) => `<tr class="${r.isFuture ? "future" : ""}"><td>${r.label} ${soa.year}</td><td class="r">${fmt(r.rate || soa.rate)}</td><td class="r">${r.paid > 0 ? fmt(r.paid) : "—"}</td><td class="r ${r.balance > 0 && !r.isFuture ? "bal" : ""}">${r.isFully ? "—" : fmt(r.balance)}</td><td class="c ${r.isFully ? "paid" : r.isPartial ? "part" : r.isFuture ? "upcoming" : "unpaid"}">${r.isFully ? "✓ Paid" : r.isPartial ? "Partial" : r.isFuture ? "Upcoming" : "Unpaid"}</td></tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>SOA</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}.hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}.ttl{font-size:18px;font-weight:bold;margin-top:5px}.info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:12px}.info-item label{font-size:9px;color:#666;text-transform:uppercase}.info-item p{font-weight:bold;font-size:12px;margin-top:2px}table{width:100%;border-collapse:collapse;margin-bottom:14px}thead tr{background:#111;color:#fff}thead th{padding:7px 10px;text-align:left;font-size:11px}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:6px 10px;border-bottom:1px solid #eee}td.r{text-align:right;font-family:monospace}td.c{text-align:center;font-size:11px;font-weight:bold}td.bal{color:#c0392b;font-weight:bold}td.paid{color:#27ae60}td.unpaid{color:#c0392b}.totals{border-top:2px solid #111;padding:10px 0}.t-row{display:flex;justify-content:space-between;padding:4px 0}.t-row.big{font-size:15px;font-weight:bold;border-top:1px solid #ddd;margin-top:4px;padding-top:8px}</style></head><body><div class="hdr"><div style="font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase">Republic of the Philippines</div><div style="font-size:13px;font-weight:bold;margin:3px 0">Municipality of San Juan, Batangas · Office of the Municipal Treasurer</div><div class="ttl">STATEMENT OF ACCOUNT</div><div style="font-size:10px;color:#666">Public Market Stall Rental — Fiscal Year ${soa.year}</div></div><div class="info"><div class="info-item"><label>Vendor Name</label><p>${soa.vendorName}</p></div><div class="info-item"><label>Stall Number</label><p>${soa.stall}</p></div><div class="info-item"><label>Section</label><p>${soa.section}</p></div><div class="info-item"><label>Monthly Rate</label><p>${fmt(soa.rate)}</p></div></div><table><thead><tr><th>Period</th><th class="r">Amount Due</th><th class="r">Paid</th><th class="r">Balance</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div class="t-row"><span style="color:#555">Total Paid</span><span style="color:#27ae60;font-family:monospace;font-weight:bold">${fmt(soa.totalPaid)}</span></div><div class="t-row big"><span>TOTAL OUTSTANDING</span><span style="font-family:monospace;color:${soa.totalOut > 0 ? "#c0392b" : "#27ae60"}">${fmt(soa.totalOut)}</span></div></div></body></html>`;
    const frame = document.createElement("iframe"); frame.style.display = "none"; document.body.appendChild(frame);
    frame.srcdoc = html; frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
  };

  const filteredVendors = allVendors.filter((v: any) => v.name.toLowerCase().includes(searchVendor.toLowerCase()) || v.stall.toLowerCase().includes(searchVendor.toLowerCase()));
  const totalUnread = threads.filter((t: any) => t.unread > 0).length;

  return (
    <div className="space-y-5">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 20px 48px rgba(15,110,86,0.15)" }}>
        <div className="px-6 py-5 flex items-start justify-between flex-wrap gap-4 relative overflow-hidden">
          <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
          <div className="relative">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Admin Portal</p>
            <h1 className="text-2xl font-bold text-white">News & Inbox</h1>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Publish announcements and send direct messages to vendors</p>
          </div>
          <div className="relative flex items-center gap-2">
            {tab === "announcements" && !isReadOnly && (
              <Button onClick={() => setShowCreate(true)} className="gap-2 rounded-xl border-white/20 bg-white/15 text-white hover:bg-white/25 border">
                <Plus className="h-4 w-4" /> New Announcement
              </Button>
            )}
            {tab === "messages" && !isReadOnly && (
              <Button onClick={() => setShowNewMsg(true)} className="gap-2 rounded-xl border-white/20 bg-white/15 text-white hover:bg-white/25 border">
                <MessageSquare className="h-4 w-4" /> New Message
              </Button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
          {[
            { label: "Total Posted", value: news.length, icon: Newspaper },
            { label: "Vendors Reached", value: totalReach, icon: Users },
            { label: "Urgent Notices", value: urgentCount, icon: AlertTriangle },
          ].map((s, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <s.icon className="h-4 w-4 shrink-0" style={{ color: "rgba(255,255,255,0.5)" }} />
              <div>
                <p className="text-lg font-bold text-white leading-none">{s.value}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl border bg-card p-1 shadow-sm w-fit">
        <button onClick={() => setTab("announcements")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "announcements" ? "bg-green-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}>
          <Megaphone className="h-3.5 w-3.5" /> Announcements
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold">{news.length}</span>
        </button>
        <button onClick={() => setTab("messages")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "messages" ? "bg-green-700 text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"}`}>
          <MessageSquare className="h-3.5 w-3.5" /> Messages
          {totalUnread > 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-green-700 text-[10px] font-bold">{totalUnread}</span>}
        </button>
      </div>

      {/* ═══════════════════ ANNOUNCEMENTS TAB ═══════════════════════════════ */}
      {tab === "announcements" && (
        <div className="space-y-4">

          {/* ── Create form ─────────────────────────────────────────────────── */}
          <AnimatePresence>
            {showCreate && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50/60 to-transparent px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div>
                      <h3 className="font-bold text-foreground text-sm">New Announcement</h3>
                      <p className="text-xs text-muted-foreground">Will be sent as a push notification to vendors</p>
                    </div>
                  </div>
                  <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
                </div>

                <div className="p-6 space-y-5">
                  {/* Type + Pin row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" /> Announcement Type
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {ANNOUNCEMENT_TYPES.map(t => (
                          <button key={t.value} onClick={() => setAnnType(t.value)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-all ${annType === t.value ? t.color + " ring-2 ring-offset-1 ring-current" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> Target Audience
                      </Label>
                      <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                        value={targetSection} onChange={e => setTargetSection(e.target.value)}>
                        {SECTIONS.map(s => <option key={s} value={s === "All Vendors" ? "all" : s}>{s}</option>)}
                      </select>
                      <p className="text-[10px] text-muted-foreground">
                        {targetSection === "all" ? `Notify all ${totalReach} vendors` : `Notify vendors in ${targetSection} only`}
                      </p>
                    </div>
                  </div>

                  {/* Pin toggle */}
                  <div className="flex items-center gap-3 rounded-xl border bg-secondary/30 px-4 py-3">
                    <button onClick={() => setIsPinned(v => !v)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${isPinned ? "bg-amber-100 text-amber-600" : "bg-secondary text-muted-foreground hover:bg-amber-50 hover:text-amber-500"}`}>
                      <Pin className="h-4 w-4" />
                    </button>
                    <div>
                      <p className="text-sm font-medium text-foreground">Pin this announcement</p>
                      <p className="text-xs text-muted-foreground">Pinned posts appear at the top of the vendor news feed</p>
                    </div>
                    {isPinned && <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">📌 Pinned</span>}
                  </div>

                  {/* Title */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title <span className="text-accent normal-case">*</span></Label>
                    <Input placeholder="e.g. Market Holiday Closure on June 12" className="h-11 rounded-xl" value={title} onChange={e => setTitle(e.target.value)} />
                    <p className="text-[10px] text-muted-foreground text-right">{title.length}/120 characters</p>
                  </div>

                  {/* Content */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Content <span className="text-accent normal-case">*</span></Label>
                    <Textarea placeholder="Write your full announcement here. Be clear about dates, actions required, and who is affected…"
                      className="min-h-[140px] rounded-xl resize-none" value={content} onChange={e => setContent(e.target.value)} />
                    <p className="text-[10px] text-muted-foreground text-right">{content.length} characters</p>
                  </div>

                  {/* Preview chip */}
                  {(title || annType) && (
                    <div className="rounded-xl border bg-secondary/30 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Push Notification Preview</p>
                      <div className="flex items-start gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-700">
                          <Megaphone className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{TYPE_LABEL[annType]} {title || "Announcement Title"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{content ? content.slice(0, 100) + (content.length > 100 ? "…" : "") : "Your announcement content will appear here…"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2 border-t">
                    <Button onClick={() => createNews.mutate()} disabled={createNews.isPending || !title.trim() || !content.trim()} className="gap-2 rounded-xl">
                      {createNews.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Publish & Notify {targetSection === "all" ? "All" : targetSection}
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Filter bar ────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Filter className="h-3.5 w-3.5" /> Filter:
            </div>
            <button onClick={() => setFilterType("all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${filterType === "all" ? "border-green-700 bg-green-700/10 text-green-700" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              All ({news.length})
            </button>
            {ANNOUNCEMENT_TYPES.map(t => {
              const count = news.filter((n: any) => (n.type || "announcement") === t.value).length;
              if (count === 0) return null;
              return (
                <button key={t.value} onClick={() => setFilterType(t.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${filterType === t.value ? t.color + " ring-1 ring-current" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                  {t.label} ({count})
                </button>
              );
            })}
          </div>

          {/* ── Announcements table ────────────────────────────────────────────── */}
          {newsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-green-700" /></div>
          ) : filteredNews.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3 text-muted-foreground">
              <Megaphone className="h-10 w-10 opacity-20" />
              <p className="font-medium">{news.length === 0 ? "No announcements yet" : "No announcements match this filter"}</p>
              {news.length === 0 && <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>Create first announcement</Button>}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              {/* Table header */}
              <div className="border-b" style={{ background: "linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)" }}>
                <div className="grid px-5 py-3.5 text-xs font-semibold text-emerald-100 uppercase tracking-wider"
                  style={{ gridTemplateColumns: "auto 1fr 120px 110px 90px 80px" }}>
                  <div className="pr-4">Type</div>
                  <div>Title & Content</div>
                  <div>Target</div>
                  <div>Date Posted</div>
                  <div className="text-center">Status</div>
                  <div className="text-center">Actions</div>
                </div>
              </div>

              {/* Table rows */}
              <div className="divide-y">
                {filteredNews.map((n: any) => {
                  const nType = n.type || "announcement";
                  const typeStyle = TYPE_STYLE[nType] || TYPE_STYLE.announcement;
                  const typeLabel = TYPE_LABEL[nType] || "📢 Announcement";
                  const isPin = n.is_pinned;
                  const target = n.target_section || "All Vendors";

                  return (
                    <div key={n.id} className={`grid items-start px-5 py-4 hover:bg-emerald-50/30 transition-colors gap-x-4 ${isPin ? "bg-amber-50/30" : ""}`}
                      style={{ gridTemplateColumns: "auto 1fr 120px 110px 90px 80px" }}>

                      {/* Type badge */}
                      <div className="pt-0.5 pr-4">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold whitespace-nowrap ${typeStyle}`}>
                          {typeLabel}
                        </span>
                      </div>

                      {/* Title + content */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isPin && <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                          <p className="font-semibold text-foreground text-sm leading-snug">{n.title}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{n.content}</p>
                      </div>

                      {/* Target */}
                      <div className="pt-0.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          <Users className="h-3 w-3" />
                          <span className="truncate max-w-[90px]">{target === "all" ? "All Vendors" : target}</span>
                        </span>
                      </div>

                      {/* Date */}
                      <div className="pt-0.5">
                        <p className="text-xs text-foreground font-medium">
                          {new Date(n.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(n.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="pt-0.5 flex justify-center">
                        <span className="inline-flex items-center gap-1 rounded-full border bg-emerald-50 border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Published
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="pt-0.5 flex justify-center">
                        {!isReadOnly ? (
                          <button onClick={() => deleteNews.mutate(n.id)}
                            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/10 hover:text-accent transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="border-t bg-secondary/30 px-5 py-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Showing <strong className="text-foreground">{filteredNews.length}</strong> of <strong className="text-foreground">{news.length}</strong> announcements
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Pin className="h-3 w-3 text-amber-500" /> {pinnedCount} pinned</span>
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {totalReach} vendors</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ MESSAGES TAB ═══════════════════════════════════ */}
      {tab === "messages" && (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr]" style={{ height: "620px" }}>

          {/* Thread list */}
          <div className="rounded-2xl border bg-card overflow-hidden flex flex-col shadow-sm">
            <div className="border-b px-4 py-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Conversations</p>
              <span className="text-xs text-muted-foreground">{threads.length} vendors</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y">
              {threadsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-green-700" /></div>
              ) : threads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                  <MessageSquare className="h-8 w-8 opacity-20" />
                  <p>No conversations yet</p>
                  <button onClick={() => setShowNewMsg(true)} className="text-xs text-green-700 hover:underline">Start one</button>
                </div>
              ) : threads.map((t: any) => (
                <button key={t.id} onClick={() => setActiveThread(t)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/50 transition-colors ${activeThread?.id === t.id ? "bg-green-700/5 border-l-2 border-l-green-700" : ""}`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-700/10">
                    <Store className="h-4 w-4 text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-sm truncate ${t.unread > 0 ? "font-bold text-foreground" : "font-medium text-foreground"}`}>{t.vendor_name}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {t.last_at ? new Date(t.last_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Stall {t.stall} · {t.section}</p>
                    {t.last_message && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_message}</p>}
                  </div>
                  {t.unread > 0 && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-700 text-[10px] font-bold text-white">{t.unread}</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="rounded-2xl border bg-card overflow-hidden flex flex-col shadow-sm">
            {!activeThread ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                  <MessageSquare className="h-8 w-8 opacity-30" />
                </div>
                <p className="font-medium">Select a conversation</p>
                <p className="text-xs text-center max-w-xs">Or start a new message to a vendor. You can also send Statements of Account directly from here.</p>
                <Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={() => setShowNewMsg(true)}>
                  <Plus className="h-3.5 w-3.5" /> New Message
                </Button>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="border-b px-5 py-4 flex items-center justify-between bg-secondary/20">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-700/10">
                      <Store className="h-4 w-4 text-green-700" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{activeThread.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">Stall {activeThread.stall} · {activeThread.section}</p>
                    </div>
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
                    const soa = parseSOA(m.body);
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`space-y-1 ${soa ? "w-full max-w-[90%]" : "max-w-[75%]"}`}>
                          {soa ? (
                            <div className="rounded-2xl border bg-card shadow-md overflow-hidden">
                              <div className="bg-foreground text-background px-4 py-3 text-center">
                                <p className="text-[10px] tracking-widest uppercase opacity-60">Republic of the Philippines</p>
                                <p className="text-xs font-bold">Municipality of San Juan, Batangas</p>
                                <p className="text-sm font-bold tracking-wide mt-1">STATEMENT OF ACCOUNT</p>
                                <p className="text-[10px] opacity-50 mt-0.5">Fiscal Year {soa.year}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 px-4 py-3 bg-secondary/40 border-b text-xs">
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
                                        <td className="py-1 text-right font-mono">{r.paid > 0 ? <span className="text-success">₱{r.paid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span> : <span className="text-muted-foreground">—</span>}</td>
                                        <td className="py-1 text-right font-mono font-semibold">{(r.isFully || r.isAdvance) ? <span className="text-success font-mono">₱0.00</span> : <span className={r.isFuture && !r.isPartial ? "text-muted-foreground" : "text-accent"}>₱{r.balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>}</td>
                                        <td className="py-1 text-center">{r.isAdvance ? <span className="text-green-700 font-semibold"> Advance</span> : r.isFully ? <span className="text-success font-semibold">✓ Paid</span> : r.isPartial ? <span className="text-green-700 font-semibold">Partial</span> : (r.isFuture && !r.isPartial) ? <span className="text-muted-foreground">Upcoming</span> : <span className="text-accent font-semibold">Unpaid</span>}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="border-t px-4 py-3 space-y-1 text-xs">
                                <div className="flex justify-between"><span className="text-muted-foreground">Total Paid ({soa.year})</span><span className="font-mono font-bold text-success">₱{soa.totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                                <div className="flex justify-between border-t pt-1"><span className="font-semibold text-foreground">TOTAL OUTSTANDING</span><span className={`font-mono font-bold text-base ${soa.totalOut > 0 ? "text-accent" : "text-success"}`}>₱{soa.totalOut.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span></div>
                              </div>
                              <div className="border-t px-4 py-2.5 flex items-center justify-between bg-secondary/30">
                                <p className="text-[10px] text-muted-foreground">Sent {new Date(m.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                                <button onClick={() => printSOA(soa)} className="flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors">
                                  <FileText className="h-3 w-3" /> Print / Save PDF
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className={`rounded-2xl px-4 py-2.5 text-sm ${isMe ? "bg-green-700 text-white rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                              {!isMe && m.type !== "message" && (
                                <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold mb-1.5 ${typeCfg.color}`}>
                                  <typeCfg.icon className="h-3 w-3" /> {typeCfg.label}
                                </div>
                              )}
                              <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                            </div>
                          )}
                          <p className={`text-[10px] text-muted-foreground ${isMe ? "text-right" : "text-left"}`}>
                            {new Date(m.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                            {isMe && m.read_at && <CheckCheck className="inline h-3 w-3 ml-1 text-green-700" />}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Start the conversation.</p>}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                {!isReadOnly ? (
                  <div className="border-t p-4 space-y-3">
                    <button onClick={sendSOA} disabled={sendingSOA}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5 text-sm font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50">
                      {sendingSOA ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" /> Generating SOA…</> : <><FileText className="h-4 w-4" /> Send Statement of Account (SOA)</>}
                    </button>
                    <div className="flex gap-1.5 flex-wrap">
                      {(["message"/*,"penalty"*/, "reminder"] as const).map(t => {
                        const cfg = MSG_TYPE_CONFIG[t];
                        return (
                          <button key={t} onClick={() => setMsgType(t)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${msgType === t ? `${cfg.color} border-current` : "border-border text-muted-foreground hover:bg-secondary"}`}>
                            <cfg.icon className="h-3 w-3" /> {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder={msgType === "penalty" ? "Describe the urgent notice…" : msgType === "reminder" ? "Payment reminder message…" : "Type a message…"}
                        className="h-10 rounded-xl flex-1" value={msgBody} onChange={e => setMsgBody(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage.mutate()} />
                      <Button size="icon" className="h-10 w-10 rounded-xl shrink-0"
                        disabled={!msgBody.trim() || sendMessage.isPending} onClick={() => sendMessage.mutate()}>
                        {sendMessage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-t p-4 text-center text-xs text-muted-foreground bg-secondary/10">
                    Viewing mode. Sending messages and Statement of Account is disabled.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── New Message Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewMsg && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowNewMsg(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-card rounded-2xl border shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="font-semibold text-foreground">New Message</h3>
                  <p className="text-xs text-muted-foreground">Select a vendor to start a conversation</p>
                </div>
                <button onClick={() => setShowNewMsg(false)} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
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
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-700/10">
                          <Store className="h-4 w-4 text-green-700" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{v.name}</p>
                          <p className="text-xs text-muted-foreground">Stall {v.stall} · {v.section}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                  {filteredVendors.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">No vendors found</p>}
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