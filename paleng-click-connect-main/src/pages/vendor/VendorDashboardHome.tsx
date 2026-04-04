import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, QrCode, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Clock, FileText, Bell, Newspaper, Store,
  History, TrendingUp, Calendar, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";

import VendorHistory   from "./VendorHistory";
import VendorStatement from "./VendorStatement";
import VendorBottomNav from "../../components/VendorBottomNav";
import { M } from "vitest/dist/chunks/reporters.d.BFLkQcL6.js";

const MONTHS       = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const DS = {
  gradientHeader: "linear-gradient(160deg, #0d2240 0%, #1a3a5f 45%, #1d4ed8 80%, #2563eb 100%)",
  gradientCard:   "linear-gradient(135deg, #1a3a5f 0%, #2563eb 100%)",
  blue900: "#0d2240",
  blue800: "#1a3a5f",
  blue700: "#1d4ed8",
  blue600: "#2563eb",
  blue400: "#60a5fa",
  blue50:  "#eff6ff",
  blue100: "#dbeafe",
  slate50: "#f8fafc",
  slate100:"#f1f5f9",
  slate200:"#e2e8f0",
  slate900:"#0f172a",
  green600:"#16a34a",
  green500:"#22c55e",
  green100:"#dcfce7",
  amber600:"#d97706",
  amber100:"#fef3c7",
};

// ── Slide Panel ────────────────────────────────────────────────────────────────
const SlidePanel = ({
  open, onClose, title, children, unreadNotifs = 0,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; unreadNotifs?: number }) => (
  <AnimatePresence>
    {open && (
      <>
        <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 lg:hidden" style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={onClose} />
        <motion.div key="pn" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed inset-0 z-50 lg:hidden flex flex-col bg-white" style={{ overflowY: "auto" }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4 sticky top-0 z-10"
            style={{ background: DS.gradientHeader }}>
            <h2 className="text-xl font-black text-white">{title}</h2>
            <button onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}>
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
          <div className="flex-1 min-h-0 p-4" style={{ paddingBottom: 80 }}>
            {children}
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const VendorDashboardHome = () => {
  const { user } = useAuth();

  const [activeTab,          setActiveTab]          = useState<"balance" | "history" | "statement">("balance");
  const [showHistoryPanel,   setShowHistoryPanel]   = useState(false);
  const [showStatementPanel, setShowStatementPanel] = useState(false);
  const [paymentsExpanded,   setPaymentsExpanded]   = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-dashboard", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: vendor }   = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile }  = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      const { data: confirmedPayments } = await supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").order("created_at", { ascending: false });
      const { data: submissions } = await (supabase.from("payment_submissions" as any) as any)
        .select("*").eq("vendor_id", vendor?.id || "").in("status", ["pending", "rejected"]).order("created_at", { ascending: false });
      const pendingRows = (submissions || []).map((s: any) => ({
        id: `sub_${s.id}`, amount: s.amount, status: s.status === "rejected" ? "failed" : "pending",
        payment_method: s.payment_method || "instapay", payment_type: s.payment_type || "due",
        period_month: s.period_month, period_year: s.period_year, created_at: s.created_at, is_submission: true,
      }));
      const payments = [...pendingRows, ...(confirmedPayments || [])];
      const { data: notifications } = await supabase.from("notifications").select("*")
        .eq("user_id", user!.id).eq("read_status", false).order("created_at", { ascending: false }).limit(5);
      const stall = vendor?.stalls as any;
      const defaultRate = stall?.monthly_rate || 1450;
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const { data: schedules } = stall?.id
        ? await (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", stall.id).eq("year", currentYear)
        : { data: [] };
      const getMonthFee = (m: number): number => {
        const s = (schedules || []).find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };
      const rawPaidMap: Record<number, number> = {};
      (payments || []).filter(p => p.status === "completed" && p.period_year === currentYear).forEach(p => {
        if (p.period_month) rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
      });
      const effMap: Record<number, number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m = getMonthFee(m);
        const credited = (rawPaidMap[m] || 0) + carry;
        effMap[m] = credited;
        carry = credited >= due_m ? (credited - due_m) : 0;
      }
      const currentMonthFee = getMonthFee(currentMonth);
      const paidThisMonth = effMap[currentMonth] || 0;
      const isCurrentMonthPaid = paidThisMonth >= currentMonthFee;
      const remainingThisMonth = Math.max(0, currentMonthFee - paidThisMonth);
      const monthlyRate = currentMonthFee;
      let nextUnpaidMonth = currentMonth;
      for (let m = 1; m <= 12; m++) {
        if ((effMap[m] || 0) < getMonthFee(m)) { nextUnpaidMonth = m; break; }
        if (m === 12) nextUnpaidMonth = 13;
      }
      const totalPaidYear = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);
      const monthsPaid = Array.from({ length: currentMonth }, (_, i) => i + 1).filter(m => (effMap[m] || 0) >= getMonthFee(m)).length;
      const totalOutstanding = Array.from({ length: currentMonth }, (_, i) => i + 1).reduce((sum, m) => sum + Math.max(0, getMonthFee(m) - (effMap[m] || 0)), 0);
      const chartData = MONTHS_SHORT.slice(0, currentMonth).map((m, i) => ({
        month: m,
        paid:  Math.min(effMap[i + 1] || 0, getMonthFee(i + 1)),
        due:   getMonthFee(i + 1),
      }));
      return {
        vendor, profile, stall, monthlyRate, payments: (payments || []).slice(0, 8),
        isCurrentMonthPaid, paidThisMonth, remainingThisMonth, nextUnpaidMonth,
        allPaid: nextUnpaidMonth > 12, totalPaidYear, monthsPaid, totalOutstanding,
        chartData, currentMonth, currentYear, unreadNotifs: notifications || [],
      };
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: DS.blue600 }} />
    </div>
  );

  const d = data!;
  const stall = d.stall;
  const vendor = d.vendor;
  const profile = d.profile;
  const monthlyRate = d.monthlyRate;
  const currentMonth = new Date().getMonth() + 1;
  const paidPct = monthlyRate > 0 ? Math.min(100, (d.paidThisMonth / monthlyRate) * 100) : 0;

  const handleTabClick = (tab: "balance" | "history" | "statement") => {
    setActiveTab(tab);
    // On mobile, open slide panels. On desktop, navigate to pages.
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      if (tab === "history")   window.location.href = "/vendor/history";
      if (tab === "statement") window.location.href = "/vendor/statement";
    } else {
      if (tab === "history")   setShowHistoryPanel(true);
      if (tab === "statement") setShowStatementPanel(true);
    }
  };

  const mobileActions = [
    { label: "Pay Online",  to: "/vendor/pay",           icon: CreditCard },
    { label: "History",     to: "/vendor/history",       icon: History    },
    { label: "Statement",   to: "/vendor/statement",     icon: FileText   },
    { label: "Stall Info",  to: "/vendor/stall",         icon: Store      },
    { label: "Alerts",      to: "/vendor/notifications", icon: Bell,  badge: d.unreadNotifs.length },
    { label: "News",        to: "/vendor/news",          icon: Newspaper  },
  ];

  const quickLinks = [
    { label: "Pay Online",            to: "/vendor/pay",           icon: CreditCard },
    { label: "Payment History",       to: "/vendor/history",       icon: History   },
    { label: "Statement of Account",  to: "/vendor/statement",     icon: FileText  },
    { label: "Stall Information",     to: "/vendor/stall",         icon: Store     },
    { label: "Notifications",         to: "/vendor/notifications", icon: Bell,     badge: d.unreadNotifs.length },
    { label: "News & Updates",        to: "/vendor/news",          icon: Newspaper },
  ];

  const tabs = [
    { key: "balance",   label: "Balance"   },
    { key: "history",   label: "History"   },
    { key: "statement", label: "Statement" },
  ] as const;

  const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  /* ─── DESKTOP VIEW ──────────────────────────────────────────────────────────── */
  const DesktopView = () => (
    <div className="hidden lg:block">
      {/* ── HERO HEADER ── */}
      <div style={{ background: DS.gradientHeader, borderRadius: "0 0 0 0", padding: "28px 32px 0", marginBottom: 0 }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>
              Hello, {profile?.first_name}! 👋
            </div>
          </div>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "flex-end",
            padding: "10px 16px", background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)", borderRadius: 16,
          }}>
            <div style={{ fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.5)" }}>Your Stall</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginTop: 2 }}>
              {stall?.stall_number || "—"} · {stall?.section || "General"} Section
            </div>
          </div>
        </div>

        {/* Hero stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            {
              icon: <Clock size={10} />, label: "NEXT BILL AMOUNT",
              value: fmt(d.isCurrentMonthPaid ? monthlyRate : (d.remainingThisMonth || monthlyRate)),
              sub: d.isCurrentMonthPaid
                ? `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth + 1) - 1] || "All paid"} ${d.currentYear}`
                : `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} ${d.currentYear}`,
            },
            {
              icon: <TrendingUp size={10} />, label: "TOTAL PAID (2026)",
              value: fmt(d.totalPaidYear),
              badge: `↑ ${d.monthsPaid}/${d.currentMonth} months`, badgeColor: "green",
            },
            {
              icon: <CheckCircle2 size={10} />, label: "OUTSTANDING",
              value: fmt(d.totalOutstanding),
              badge: d.totalOutstanding === 0 ? "✓ Fully Settled" : `${fmt(d.totalOutstanding)} due`,
              badgeColor: d.totalOutstanding === 0 ? "green" : "amber",
            },
          ].map((c, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 16, padding: "18px 20px", position: "relative", overflow: "hidden",
            }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
                {c.icon}{c.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", fontFamily: "'JetBrains Mono', monospace", letterSpacing: -1, lineHeight: 1, marginBottom: 6 }}>
                {c.value}
              </div>
              {c.sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>{c.sub}</div>}
              {c.badge && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 9px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: c.badgeColor === "green" ? "rgba(74,222,128,0.2)" : "rgba(251,191,36,0.2)",
                  color: c.badgeColor === "green" ? "#4ade80" : "#fbbf24",
                }}>{c.badge}</span>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => handleTabClick(t.key)} style={{
              padding: "12px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "none", border: "none", fontFamily: "inherit",
              color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.45)",
              borderBottom: activeTab === t.key ? "2.5px solid #fff" : "2.5px solid transparent",
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── BODY GRID ── */}
      <div style={{ padding: "24px 32px", display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignContent: "start" }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Status banner */}
          {d.isCurrentMonthPaid ? (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
              background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle2 size={18} color="#16a34a" strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>
                  {MONTHS[currentMonth - 1]} {d.currentYear} — Paid ✓
                </div>
                <div style={{ fontSize: 11, color: "#16a34a", marginTop: 2 }}>Your stall fee for this month is fully settled</div>
              </div>
              {!d.allPaid && d.nextUnpaidMonth <= 12 && (
                <Link to="/vendor/pay" style={{ flexShrink: 0 }}>
                  <button style={{
                    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg,#15803d,#16a34a)",
                    fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "inherit",
                  }}>Pay {MONTHS[d.nextUnpaidMonth - 1]} Early →</button>
                </Link>
              )}
            </div>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
              background: DS.amber100, border: "1px solid #fcd34d", borderRadius: 14,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fde68a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={18} color={DS.amber600} strokeWidth={2.5} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                  {MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} {d.currentYear} — Payment Due
                </div>
                <div style={{ fontSize: 11, color: DS.amber600, marginTop: 2 }}>{fmt(d.remainingThisMonth || monthlyRate)} outstanding balance</div>
              </div>
              <Link to="/vendor/pay" style={{ flexShrink: 0 }}>
                <button style={{
                  padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: DS.gradientHeader, fontSize: 12, fontWeight: 700, color: "#fff", fontFamily: "inherit",
                }}>Pay Now →</button>
              </Link>
            </div>
          )}

          {/* Stats grid — styled like image 7 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {[
              { label: "Monthly Rate",   value: fmt(monthlyRate),        sub: "per month",              color: DS.slate900,  iconColor: "#64748b", bg: DS.slate100, icon: Calendar    },
              { label: "Total Paid",     value: fmt(d.totalPaidYear),    sub: `${d.currentYear} so far`, color: DS.green600,  iconColor: DS.green600, bg: "#dcfce7",  icon: TrendingUp  },
              { label: "Months Settled", value: `${d.monthsPaid}/${d.currentMonth}`, sub: "paid in full", color: d.monthsPaid === d.currentMonth ? DS.green600 : DS.blue600, iconColor: d.monthsPaid === d.currentMonth ? DS.green600 : DS.blue600, bg: d.monthsPaid === d.currentMonth ? "#dcfce7" : DS.blue100, icon: CheckCircle2 },
              { label: "Outstanding",    value: fmt(d.totalOutstanding), sub: "balance due",             color: d.totalOutstanding === 0 ? DS.green600 : DS.amber600, iconColor: d.totalOutstanding === 0 ? DS.green600 : DS.amber600, bg: d.totalOutstanding === 0 ? "#dcfce7" : DS.amber100, icon: AlertCircle },
            ].map(c => (
              <div key={c.label} style={{
                background: "#fff", border: `1px solid ${DS.slate200}`,
                borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#94a3b8", fontWeight: 700 }}>{c.label}</div>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <c.icon size={13} color={c.iconColor} />
                  </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: "'JetBrains Mono',monospace", letterSpacing: -0.5 }}>{c.value}</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Payment Progress card — styled like image 7 */}
          <div style={{ background: "#fff", border: `1px solid ${DS.slate200}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: DS.slate900 }}>Payment Progress</div>
              <Link to="/vendor/statement" style={{ fontSize: 12, fontWeight: 700, color: DS.blue600, display: "flex", alignItems: "center", gap: 3, textDecoration: "none" }}>
                Full SOA →
              </Link>
            </div>
            <div style={{ padding: "0 20px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
                {[{ bg: DS.blue600, label: "Paid" }, { bg: DS.green500, label: "Current" }, { bg: DS.slate200, label: "Due" }].map(l => (
                  <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748b" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.bg }} />{l.label}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {MONTH_LABELS.map((m, i) => {
                  const mn = i + 1;
                  const isPaid = mn < currentMonth && d.chartData.find((c: any) => c.month === m) && (d.chartData.find((c: any) => c.month === m)?.paid || 0) >= (d.chartData.find((c: any) => c.month === m)?.due || 1);
                  const isCurrent = mn === currentMonth;
                  return (
                    <div key={m} style={{
                      flex: 1, padding: "7px 4px", borderRadius: 6,
                      fontSize: 9, fontWeight: 700, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5,
                      background: isPaid ? DS.blue600 : isCurrent ? DS.green500 : DS.slate200,
                      color: (isPaid || isCurrent) ? "#fff" : "#64748b",
                    }}>{m}</div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recent Activity card — styled like image 7 */}
          <div style={{ background: "#fff", border: `1px solid ${DS.slate200}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0", marginBottom: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: DS.slate900 }}>Recent Activity</div>
              <Link to="/vendor/history" style={{ fontSize: 12, fontWeight: 700, color: DS.blue600, textDecoration: "none" }}>View All →</Link>
            </div>
            <div>
              {(paymentsExpanded ? d.payments : d.payments.slice(0, 3)).map((p: any, idx: number) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "13px 20px",
                  borderBottom: "1px solid #f1f5f9", transition: "background 0.12s",
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: p.status === "completed" ? DS.green100 : p.status === "pending" ? DS.amber100 : "#fee2e2",
                  }}>
                    {p.status === "completed" ? <CheckCircle2 size={16} color={DS.green600} /> : p.status === "pending" ? <Clock size={16} color={DS.amber600} /> : <AlertCircle size={16} color="#dc2626" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                      {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : new Date(p.created_at).toLocaleDateString("en-PH")} — {p.status === "completed" ? "Confirmed" : p.status === "pending" ? "Pending Review" : "Failed"}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {p.payment_method === "gcash" ? "GCash" : p.payment_method === "instapay" ? "InstaPay" : p.payment_method} · {new Date(p.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} · {new Date(p.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace",
                      color: p.status === "completed" ? DS.green600 : p.status === "pending" ? DS.amber600 : "#dc2626",
                    }}>{fmt(Number(p.amount))}</div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4, marginTop: 4,
                      padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                      background: p.status === "completed" ? DS.green100 : p.status === "pending" ? DS.amber100 : "#fee2e2",
                      color: p.status === "completed" ? DS.green600 : p.status === "pending" ? DS.amber600 : "#dc2626",
                    }}>{p.status === "completed" ? "✓ Completed" : p.status === "pending" ? "⏳ Pending" : "✗ Failed"}</span>
                  </div>
                </div>
              ))}
              {d.payments.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#94a3b8" }}>
                  <CreditCard size={32} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
                  <p style={{ fontSize: 13 }}>No payments recorded yet</p>
                </div>
              )}
            </div>
            {d.payments.length > 3 && (
              <button onClick={() => setPaymentsExpanded(v => !v)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "12px", fontSize: 12, fontWeight: 700, color: DS.blue600,
                background: "none", border: "none", borderTop: `1px solid ${DS.slate100}`,
                cursor: "pointer", fontFamily: "inherit",
              }}>
                {paymentsExpanded ? <><ChevronUp size={14} />Show less</> : <><ChevronDown size={14} />Show {d.payments.length - 3} more payments</>}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Next Bill card */}
          <div style={{
            background: DS.gradientHeader, borderRadius: 14, padding: "22px 24px",
            color: "#fff", boxShadow: "0 4px 16px rgba(13,34,64,0.2)",
          }}>
            <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>Next Bill Amount</div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", fontFamily: "'JetBrains Mono',monospace", letterSpacing: -1.5, lineHeight: 1 }}>
              {fmt(d.isCurrentMonthPaid ? monthlyRate : (d.remainingThisMonth || monthlyRate))}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 6, marginBottom: 20 }}>
              {MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1] || "All paid"} {d.currentYear}
            </div>
            <Link to="/vendor/pay">
              <button style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: 13, background: "#fff", borderRadius: 10, border: "none",
                fontSize: 14, fontWeight: 700, color: DS.blue900, cursor: "pointer",
                boxShadow: "0 2px 12px rgba(0,0,0,0.15)", fontFamily: "inherit",
              }}>
                <CreditCard size={16} /> Pay in Advance
              </button>
            </Link>
          </div>

          {/* QR Code card */}
          <div style={{ background: "#fff", border: `1px solid ${DS.slate200}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px 12px", fontSize: 14, fontWeight: 800, color: DS.slate900 }}>Your Stall QR Code</div>
            <div style={{ textAlign: "center", padding: "0 20px 20px" }}>
              <div style={{
                width: 128, height: 128, background: DS.slate100, border: `2px dashed ${DS.slate200}`,
                borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px",
              }}>
                {vendor?.qr_code ? <QRCodeSVG value={vendor.qr_code} size={108} level="H" /> : <QrCode size={40} color="#94a3b8" />}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 3 }}>Stall {stall?.stall_number}</div>
              <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace", marginBottom: 14, wordBreak: "break-all" }}>
                {vendor?.qr_code ? `${vendor.qr_code.slice(0, 32)}...` : "No QR assigned"}
              </div>
              <button style={{
                width: "100%", padding: "9px 0", borderRadius: 8,
                background: DS.blue50, border: `1px solid ${DS.blue100}`,
                fontSize: 12, fontWeight: 700, color: DS.blue700, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                ↓ Download QR Code
              </button>
            </div>
          </div>

          {/* Quick Links card — 3 grid like image 7 */}
          <div style={{ background: "#fff", border: `1px solid ${DS.slate200}`, borderRadius: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.05)", padding: "16px 20px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: DS.slate900, marginBottom: 14 }}>Quick Links</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {[
                { label: "Pay Online", to: "/vendor/pay",       icon: CreditCard },
                { label: "History",    to: "/vendor/history",   icon: History    },
                { label: "Statement",  to: "/vendor/statement", icon: FileText   },
              ].map(l => (
                <Link key={l.to} to={l.to} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "14px 8px", borderRadius: 12,
                    background: DS.blue50, border: `1px solid ${DS.blue100}`, cursor: "pointer",
                    transition: "all 0.15s",
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, background: "#fff",
                      border: `1px solid ${DS.blue100}`, display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}>
                      <l.icon size={17} color={DS.blue800} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: DS.blue900, textAlign: "center", lineHeight: 1.3 }}>{l.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* ─── MOBILE VIEW ───────────────────────────────────────────────────────────── */
  const MobileView = () => {
    const shownPayments = paymentsExpanded ? d.payments : d.payments.slice(0, 3);
    return (
      <div className="block lg:hidden -mx-4 -mt-4">
        <SlidePanel open={showHistoryPanel} onClose={() => { setShowHistoryPanel(false); setActiveTab("balance"); }}
          title="Payment History" unreadNotifs={d.unreadNotifs.length}><VendorHistory /></SlidePanel>
        <SlidePanel open={showStatementPanel} onClose={() => { setShowStatementPanel(false); setActiveTab("balance"); }}
          title="Statement of Account" unreadNotifs={d.unreadNotifs.length}><VendorStatement /></SlidePanel>

        {/* Gradient hero */}
        <div style={{ background: DS.gradientHeader }}>
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <p className="text-white text-xl font-bold mt-0.5">Hello, {profile?.first_name || "Vendor"}! 👋</p>
            </div>
            <div className="rounded-xl px-3 py-2 text-right"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>Your Stall</p>
              <p className="text-white text-sm font-bold">{stall?.stall_number || "—"} · {stall?.section || "General"}</p>
            </div>
          </div>
          <div className="flex px-2">
            {tabs.map(t => (
              <button key={t.key} onClick={() => handleTabClick(t.key)} className="flex-1 py-2.5 text-xs transition-all"
                style={{
                  color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.55)", fontWeight: activeTab === t.key ? 700 : 500,
                  background: "none", border: "none", borderBottom: activeTab === t.key ? "2.5px solid #fff" : "2.5px solid transparent", cursor: "pointer",
                }}>{t.label}</button>
            ))}
          </div>
          <div className="px-5 py-4" style={{ background: "rgba(0,0,0,0.14)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="text-[10px] uppercase tracking-[2px] flex items-center gap-1.5 mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>
              <Clock className="h-3 w-3" />{d.isCurrentMonthPaid ? "Next Bill Amount" : "Amount Due This Month"}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-white font-black" style={{ fontSize: 32, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>₱</span>
                {(d.isCurrentMonthPaid ? monthlyRate : (d.remainingThisMonth || monthlyRate)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
              <Link to="/vendor/pay">
                <button className="flex items-center gap-1.5 bg-white font-bold text-sm rounded-full px-4 py-2" style={{ color: DS.blue900 }}>
                  <CreditCard className="h-3.5 w-3.5" />{d.isCurrentMonthPaid ? "Pay Advance" : "Pay Now"}
                </button>
              </Link>
            </div>
            {d.isCurrentMonthPaid && (
              <div className="mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />
                <span className="text-[11px] text-green-300 font-semibold">{MONTHS[currentMonth - 1]} {d.currentYear} fully settled ✓</span>
              </div>
            )}
          </div>
        </div>

        {/* White body */}
        <div style={{ background: "#f0f4f8" }}>
          <div className="bg-white px-4 pt-4 pb-3 mb-2">
            <div className="grid grid-cols-3 gap-1">
              {mobileActions.map(a => (
                <Link key={a.to} to={a.to} className="flex flex-col items-center gap-1.5 py-2 rounded-xl transition-colors active:bg-slate-50">
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: DS.blue50, border: `1px solid ${DS.blue100}` }}>
                    <a.icon className="h-6 w-6" style={{ color: DS.blue800 }} />
                    {(a as any).badge ? (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                        {(a as any).badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: DS.blue900 }}>{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="mx-3 mb-2">
            {d.isCurrentMonthPaid ? (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#dcfce7", border: "1px solid #86efac" }}>
                <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-green-800">{MONTHS[currentMonth - 1]} {d.currentYear} — Paid ✓</p>
                  <p className="text-[11px] text-green-700 mt-0.5">Stall fee fully settled for this month</p>
                </div>
                {!d.allPaid && d.nextUnpaidMonth <= 12 && (
                  <Link to="/vendor/pay">
                    <button className="text-[11px] font-bold text-white bg-green-700 rounded-xl px-3 py-1.5 shrink-0">
                      Pay {MONTHS[d.nextUnpaidMonth - 1].slice(0, 3)} early
                    </button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "#fef3c7", border: "1px solid #fcd34d" }}>
                <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-900">{MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} — Payment Due</p>
                  <p className="text-[11px] text-amber-800 mt-0.5 truncate">{fmt(d.remainingThisMonth || monthlyRate)} outstanding</p>
                </div>
                <Link to="/vendor/pay">
                  <button className="text-[11px] font-bold text-white bg-amber-600 rounded-xl px-3 py-1.5 shrink-0">Pay Now</button>
                </Link>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between px-4 pt-2 pb-2">
              <p className="text-sm font-bold" style={{ color: DS.blue900 }}>Your Summary</p>
              <button onClick={() => setShowStatementPanel(true)} className="text-xs font-semibold flex items-center gap-1" style={{ color: DS.blue600 }}>
                View SOA <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex gap-2.5 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {[
                { label: "Total Paid",     value: fmt(d.totalPaidYear),    bg: "#dcfce7", iconColor: "#16a34a", icon: TrendingUp  },
                { label: "Months Settled", value: `${d.monthsPaid}/${d.currentMonth}`, bg: "#dbeafe", iconColor: "#2563eb", icon: Calendar   },
                { label: "Outstanding",    value: fmt(d.totalOutstanding), bg: d.totalOutstanding === 0 ? "#dcfce7" : "#fef3c7", iconColor: d.totalOutstanding === 0 ? "#16a34a" : "#d97706", icon: AlertCircle },
                { label: "Monthly Rate",   value: fmt(monthlyRate),        bg: "#f1f5f9", iconColor: "#475569", icon: CreditCard },
              ].map(s => (
                <div key={s.label} className="shrink-0 bg-white rounded-2xl p-3 border border-slate-100" style={{ width: 128 }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: s.bg }}>
                    <s.icon className="h-4 w-4" style={{ color: s.iconColor } as any} />
                  </div>
                  <p className="font-black text-[15px] text-slate-900 leading-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
                  <p className="text-[9.5px] text-slate-400 mt-0.5 uppercase tracking-wide font-semibold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-3 mb-2 rounded-2xl overflow-hidden" style={{ background: DS.gradientCard }}>
            <div className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="text-white font-bold text-sm mb-1">Your Stall QR Code</p>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>Show this to the cashier for payment processing.</p>
                <div className="inline-block rounded-xl px-3 py-1 text-[11px] font-semibold text-white" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  Stall {stall?.stall_number || "—"} · {stall?.section || "General"} Section
                </div>
              </div>
              <div className="bg-white rounded-xl p-2 shrink-0">
                {vendor?.qr_code ? <QRCodeSVG value={vendor.qr_code} size={90} level="H" /> : <div className="w-[90px] h-[90px] flex items-center justify-center"><QrCode className="h-12 w-12 text-slate-300" /></div>}
              </div>
            </div>
          </div>

          <div className="bg-white mb-2 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: DS.blue900 }}>Payment Progress</p>
                <p className="text-[11px] text-slate-500">Paid (blue) vs Due (gray) · {d.currentYear}</p>
              </div>
              <button onClick={() => setShowStatementPanel(true)} className="text-xs font-semibold" style={{ color: DS.blue600 }}>Full SOA ›</button>
            </div>
            {d.chartData.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No payment data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={d.chartData} barGap={3} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v: number, name: string) => [fmt(v), name === "paid" ? "Paid" : "Due"]} contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Bar dataKey="due"  fill="#e2e8f0" radius={[4,4,0,0]} name="due" />
                  <Bar dataKey="paid" fill="#2563eb" radius={[4,4,0,0]} name="paid" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white mb-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <p className="text-sm font-bold" style={{ color: DS.blue900 }}>Recent Payments</p>
              <button onClick={() => setShowHistoryPanel(true)} className="text-xs font-semibold flex items-center gap-1" style={{ color: DS.blue600 }}>View All ›</button>
            </div>
            <div>
              {shownPayments.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < shownPayments.length - 1 ? "0.5px solid #f8fafc" : "none" }}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${p.status === "completed" ? "bg-green-50" : p.status === "pending" ? "bg-amber-50" : "bg-red-50"}`}>
                    {p.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : p.status === "pending" ? <Clock className="h-5 w-5 text-amber-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : new Date(p.created_at).toLocaleDateString("en-PH")}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{p.payment_method} · {p.payment_type === "staggered" ? "Partial" : "Full payment"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(Number(p.amount))}</p>
                    <p className={`text-[10px] font-semibold capitalize mt-0.5 ${p.status === "completed" ? "text-green-600" : p.status === "pending" ? "text-amber-500" : "text-red-500"}`}>{p.status}</p>
                  </div>
                </div>
              ))}
              {d.payments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                  <CreditCard className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No payments recorded yet</p>
                  <Link to="/vendor/pay"><button className="mt-1 text-xs font-semibold text-white rounded-full px-4 py-2" style={{ background: DS.blue800 }}>Make your first payment</button></Link>
                </div>
              )}
            </div>
            {d.payments.length > 3 && (
              <button onClick={() => setPaymentsExpanded(v => !v)} className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-t border-slate-50 hover:bg-slate-50 transition-colors" style={{ color: DS.blue600 }}>
                {paymentsExpanded ? <><ChevronUp className="h-3.5 w-3.5" />Show less</> : <><ChevronDown className="h-3.5 w-3.5" />Show {d.payments.length - 3} more</>}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <DesktopView />
      <MobileView />
    </>
  );
};

export default VendorDashboardHome;
