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


  // ── Send SOA as formatted chat card ─────────────────────────────────────────
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
        .select("id, stall_id, stalls(id, stall_number, section, monthly_rate, location)")
        .eq("user_id", activeThread.vendor_id)
        .single();

      if (!vendor) throw new Error("Vendor not found");
      const st          = vendor.stalls as any;
      const defaultRate = st?.monthly_rate || 1450;

      const [pmtsRes, schedulesRes] = await Promise.all([
        supabase.from("payments").select("period_month, amount").eq("vendor_id", vendor.id).eq("status", "completed").eq("period_year", yr),
        st?.id
          ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", st.id).eq("year", yr)
          : Promise.resolve({ data: [] }),
      ]);

      const pmts      = pmtsRes.data     || [];
      const schedules = schedulesRes.data || [];

      const getRate = (m: number): number => {
        const s = schedules.find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };
      const rate = defaultRate; // kept for SOA card display (stall default)

      // ── Raw paid map ───────────────────────────────────────────────────────
      const rawPm: Record<number,number> = {};
      (pmts||[]).forEach((p:any) => {
        if(p.period_month) rawPm[p.period_month] = (rawPm[p.period_month]||0) + Number(p.amount);
      });

      // ── Cascade excess payments forward (same logic as VendorStatement) ──
      const effMap: Record<number,number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m    = getRate(m);
        const credited = (rawPm[m] || 0) + carry;
        effMap[m] = credited;
        // Carry stops at partial month — must be fully paid before excess moves forward
        carry = credited >= due_m ? (credited - due_m) : 0;
      }

      const totalPaid = Object.values(rawPm).reduce((s,v)=>s+v, 0);
      const totalOut  = MF.reduce((sum,_,i)=>{
        const m=i+1; if(m>cm) return sum;
        return sum + Math.max(0, getRate(m) - (effMap[m]||0));
      }, 0);

      // ── Build rows with correct display values ──────────────────────────
      const soaData = {
        __soa: true,
        year: yr,
        stall: st?.stall_number||"—",
        section: st?.section||"General",
        location: st?.location||"—",
        vendorName: activeThread.vendor_name,
        rate,
        rows: MF.map((month,i)=>{
          const m         = i+1;
          const due_m     = getRate(m);
          const credited  = effMap[m] || 0;
          const displayPaid = Math.min(credited, due_m);  // cap at per-month rate for display
          const balance   = Math.max(0, due_m - credited);
          const isAdvance = m > cm && credited >= due_m;  // advance = future month covered
          const isFully   = credited >= due_m && !isAdvance;
          const isPartial = credited > 0 && credited < due_m && m <= cm;
          const isFuture  = m > cm && credited < due_m;
          return {
            month, label: month,
            due:       due_m,
            paid:      displayPaid,
            balance,
            isFully,
            isPartial,
            isAdvance,
            isFuture,
          };
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
        message: `Outstanding balance: ₱${totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}. Please check your messages.`,
        type: "overdue" as any,
      });
      // ── Auto follow-up message based on payment status ──────────────────
      const currentMonthName = ["January","February","March","April","May","June","July","August","September","October","November","December"][new Date().getMonth()];
      const overdueMonths = MF.slice(0, cm).filter((_,i) => {
        const m = i + 1;
        return (effMap[m] || 0) < getRate(m);
      });
      const partialMonths = MF.slice(0, cm).filter((_,i) => {
        const m = i + 1;
        const paid = effMap[m] || 0;
        return paid > 0 && paid < getRate(m);
      });

      let autoMsg = "";
      let autoType: "message" | "penalty" | "reminder" = "message";

      if (totalOut === 0) {
        // All paid
        autoMsg = `✅ Good news! Your Statement of Account for ${soaData.year} shows that all stall fees are fully settled. Thank you for your prompt payments, ${activeThread.vendor_name}! Your cooperation is greatly appreciated by the Municipal Treasurer's Office.`;
        autoType = "message";
      } else if (overdueMonths.length >= 3) {
        // 3 or more months unpaid — penalty warning
        const monthList = overdueMonths.slice(0, 5).join(", ");
        autoMsg = `⚠️ PENALTY NOTICE

Dear ${activeThread.vendor_name},

Our records show that your stall fee payments for the following month(s) are OVERDUE:
📌 ${monthList}

Total Outstanding Balance: ₱${totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}

As per market regulations, delayed payments are subject to penalty charges. You are hereby required to settle your outstanding balance immediately to avoid further penalties and possible stall suspension.

Please visit the Municipal Treasurer's Office or pay online through the PALENG-CLICK system.

Thank you.`;
        autoType = "penalty";
      } else if (partialMonths.length > 0 || overdueMonths.length > 0) {
        // Has some unpaid or partial
        const dueList = overdueMonths.slice(0, 3).join(", ");
        autoMsg = `🔔 PAYMENT REMINDER

Dear ${activeThread.vendor_name},

This is a friendly reminder that your stall fee for ${dueList || currentMonthName} has not been fully settled yet.

Outstanding Balance: ₱${totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}

Please settle your balance at your earliest convenience either by visiting the cashier or paying online through the PALENG-CLICK app.

Thank you for your cooperation.`;
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
        // Update notification to include the auto message summary
        await supabase.from("notifications").insert({
          user_id: activeThread.vendor_id,
          title: autoType === "penalty" ? "⚠️ Penalty Notice — Action Required" : autoType === "reminder" ? "🔔 Payment Reminder" : "✅ Payments Up to Date",
          message: autoMsg.replace(/\n/g, " ").slice(0, 200),
          type: autoType === "penalty" ? "overdue" as any : autoType === "reminder" ? "reminder" as any : "info" as any,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["admin-messages", activeThread.id] });
      queryClient.invalidateQueries({ queryKey: ["admin-threads"] });
      toast.success("SOA and follow-up message sent to vendor!");
    } catch(e:any) {
      toast.error(e.message||"Failed to send SOA");
    } finally {
      setSendingSOA(false);
    }
  };

  // ── Parse SOA message body ────────────────────────────────────────────────
  const parseSOA = (body: string) => {
    try { const d = JSON.parse(body); return d.__soa ? d : null; } catch { return null; }
  };

  // ── Print SOA from chat ───────────────────────────────────────────────────
  const printSOA = (soa: any) => {
    const MF = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const fmt = (n:number) => `₱${n.toLocaleString("en-PH",{minimumFractionDigits:2})}`;
    const rows = soa.rows.map((r:any) => `
      <tr class="${r.isFuture?"future":""}">
        <td>${r.label} ${soa.year}</td>
        <td class="r">${fmt(r.rate||soa.rate)}</td>
        <td class="r">${r.paid>0?fmt(r.paid):"—"}</td>
        <td class="r ${r.balance>0&&!r.isFuture?"bal":""}">${r.isFully?"—":fmt(r.balance)}</td>
        <td class="c ${r.isFully?"paid":r.isPartial?"part":r.isFuture?"upcoming":"unpaid"}">${r.isFully?"✓ Paid":r.isPartial?"Partial":r.isFuture?"Upcoming":"Unpaid"}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>SOA</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}
  .rep{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase}
  .lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .ttl{font-size:18px;font-weight:bold;margin-top:5px}
  .sub{font-size:10px;color:#666}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:12px}
  .info-item label{font-size:9px;color:#666;text-transform:uppercase}
  .info-item p{font-weight:bold;font-size:12px;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  thead tr{background:#111;color:#fff}
  thead th{padding:7px 10px;text-align:left;font-size:11px}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody tr{border-bottom:1px solid #eee}
  tbody tr.future{opacity:.4}
  tbody td{padding:6px 10px}
  td.r{text-align:right;font-family:monospace}
  td.c{text-align:center;font-size:11px;font-weight:bold}
  td.bal{color:#c0392b;font-weight:bold}
  td.paid{color:#27ae60} td.part{color:#2980b9} td.unpaid{color:#c0392b} td.upcoming{color:#888}
  .totals{border-top:2px solid #111;padding:10px 0}
  .t-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
  .t-row.big{font-size:15px;font-weight:bold;border-top:1px solid #ddd;margin-top:4px;padding-top:8px}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-top:48px}
  .sig-line{border-top:1px solid #111;padding-top:6px;text-align:center;font-size:10px;color:#555}
  .sig-name{font-weight:bold;font-size:11px;color:#111;text-transform:uppercase}
  .footer{margin-top:24px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines</div>
  <div class="lgu">Municipality of San Juan, Batangas · Office of the Municipal Treasurer</div>
  <div class="ttl">STATEMENT OF ACCOUNT</div>
  <div class="sub">Public Market Stall Rental — Fiscal Year ${soa.year}</div>
</div>
<div class="info">
  <div class="info-item"><label>Vendor Name</label><p>${soa.vendorName}</p></div>
  <div class="info-item"><label>Stall Number</label><p>${soa.stall}</p></div>
  <div class="info-item"><label>Section</label><p>${soa.section}</p></div>
  <div class="info-item"><label>Monthly Rate</label><p>${fmt(soa.rate)}</p></div>
  <div class="info-item"><label>Location</label><p>${soa.location}</p></div>
  <div class="info-item"><label>Date Printed</label><p>${new Date().toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}</p></div>
</div>
<table>
  <thead><tr><th>Period</th><th class="r">Amount Due</th><th class="r">Paid</th><th class="r">Balance</th><th class="c">Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div class="t-row"><span style="color:#555">Total Paid (${soa.year})</span><span style="color:#27ae60;font-family:monospace;font-weight:bold">${fmt(soa.totalPaid)}</span></div>
  <div class="t-row big"><span>TOTAL OUTSTANDING</span><span style="font-family:monospace;color:${soa.totalOut>0?"#c0392b":"#27ae60"}">${fmt(soa.totalOut)}</span></div>
</div>
<div class="sigs">
  <div><div style="height:40px"></div><div class="sig-line"><div class="sig-name">${soa.vendorName}</div>Vendor / Lessee</div></div>
  <div><div style="height:40px"></div><div class="sig-line"><div class="sig-name">Admin</div>Prepared by</div></div>
  <div><div style="height:40px"></div><div class="sig-line"><div class="sig-name">Municipal Treasurer</div>Noted by</div></div>
</div>
<div class="footer">PALENG-CLICK System · Sent via chat · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    document.body.appendChild(frame);
    frame.srcdoc = html;
    frame.onload = () => { setTimeout(()=>{ frame.contentWindow?.print(); document.body.removeChild(frame); },300); };
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
                    const soa = parseSOA(m.body);
                    return (
                      <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`space-y-1 ${soa ? "w-full max-w-[90%]" : "max-w-[75%]"}`}>
                          {soa ? (
                            /* ── SOA Card ── */
                            <div className="rounded-2xl border bg-card shadow-md overflow-hidden">
                              {/* SOA Header */}
                              <div className="bg-foreground text-background px-4 py-3 text-center">
                                <p className="text-[10px] tracking-widest uppercase opacity-60">Republic of the Philippines</p>
                                <p className="text-xs font-bold">Municipality of San Juan, Batangas</p>
                                <p className="text-sm font-bold tracking-wide mt-1">STATEMENT OF ACCOUNT</p>
                                <p className="text-[10px] opacity-50 mt-0.5">Fiscal Year {soa.year}</p>
                              </div>
                              {/* Vendor info */}
                              <div className="grid grid-cols-2 gap-2 px-4 py-3 bg-secondary/40 border-b text-xs">
                                {[
                                  {l:"Vendor", v:soa.vendorName},
                                  {l:"Stall",  v:soa.stall},
                                  {l:"Section",v:soa.section},
                                  {l:"Rate",   v:`₱${soa.rate.toLocaleString("en-PH",{minimumFractionDigits:2})}/mo`},
                                ].map(x=>(
                                  <div key={x.l}>
                                    <p className="text-muted-foreground">{x.l}</p>
                                    <p className="font-semibold text-foreground">{x.v}</p>
                                  </div>
                                ))}
                              </div>
                              {/* Month rows */}
                              <div className="px-4 py-2">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="pb-1.5 text-left font-medium text-muted-foreground">Period</th>
                                      <th className="pb-1.5 text-right font-medium text-muted-foreground">Paid</th>
                                      <th className="pb-1.5 text-right font-medium text-muted-foreground">Balance</th>
                                      <th className="pb-1.5 text-center font-medium text-muted-foreground">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {soa.rows.map((r:any)=>(
                                      <tr key={r.month} className={r.isFuture?"opacity-40":""}>
                                        <td className="py-1 font-medium text-foreground">{r.label}</td>
                                        <td className="py-1 text-right font-mono">
                                          {r.paid>0
                                            ? <span className="text-success">₱{r.paid.toLocaleString("en-PH",{minimumFractionDigits:2})}</span>
                                            : <span className="text-muted-foreground">—</span>}
                                        </td>
                                        <td className="py-1 text-right font-mono font-semibold">
                                          {(r.isFully||r.isAdvance)
                                            ? <span className="text-muted-foreground">—</span>
                                            : <span className={r.isFuture?"text-muted-foreground":"text-accent"}>₱{r.balance.toLocaleString("en-PH",{minimumFractionDigits:2})}</span>}
                                        </td>
                                        <td className="py-1 text-center">
                                          {r.isAdvance  ? <span className="text-blue-600 font-semibold">★ Advance</span>
                                          :r.isFully    ? <span className="text-success font-semibold">✓ Paid</span>
                                          :r.isPartial  ? <span className="text-primary font-semibold">Partial</span>
                                          :r.isFuture   ? <span className="text-muted-foreground">—</span>
                                          :<span className="text-accent font-semibold">Unpaid</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              {/* Totals */}
                              <div className="border-t px-4 py-3 space-y-1 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Total Paid ({soa.year})</span>
                                  <span className="font-mono font-bold text-success">₱{soa.totalPaid.toLocaleString("en-PH",{minimumFractionDigits:2})}</span>
                                </div>
                                <div className="flex justify-between border-t pt-1">
                                  <span className="font-semibold text-foreground">TOTAL OUTSTANDING</span>
                                  <span className={`font-mono font-bold text-base ${soa.totalOut>0?"text-accent":"text-success"}`}>₱{soa.totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}</span>
                                </div>
                              </div>
                              {/* Print button */}
                              <div className="border-t px-4 py-2.5 flex items-center justify-between bg-secondary/30">
                                <p className="text-[10px] text-muted-foreground">
                                  Sent {new Date(m.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}
                                </p>
                                <button onClick={()=>printSOA(soa)}
                                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium text-foreground hover:bg-secondary transition-colors">
                                  <FileText className="h-3 w-3" /> Print / Save PDF
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* ── Regular message bubble ── */
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
                              <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                            </div>
                          )}
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