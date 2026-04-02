import { motion } from "framer-motion";
import {
  CreditCard, QrCode, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Clock, FileText, Bell, Newspaper, Store,
  History, TrendingUp, Calendar, Home, ReceiptText, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";

const MONTHS       = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

/* ─────────────────────────────────────────────────────────────────────────── */
/* GCash-style mobile shell — renders the dashboard inside a phone-like frame  */
/* ─────────────────────────────────────────────────────────────────────────── */

const VendorDashboardHome = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"balance" | "history" | "statement" | "news">("balance");

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-dashboard", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: vendor }  = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      const { data: payments } = await supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").order("created_at", { ascending: false });
      const { data: notifications } = await supabase.from("notifications").select("*").eq("user_id", user!.id).eq("read_status", false).order("created_at", { ascending: false }).limit(5);

      const stall        = vendor?.stalls as any;
      const defaultRate  = stall?.monthly_rate || 1450;
      const currentYear  = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const { data: schedules } = stall?.id
        ? await (supabase.from("stall_fee_schedules" as any) as any)
            .select("*").eq("stall_id", stall.id).eq("year", currentYear)
        : { data: [] };

      const getMonthFee = (m: number): number => {
        const s = (schedules || []).find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };

      const rawPaidMap: Record<number, number> = {};
      (payments || [])
        .filter(p => p.status === "completed" && p.period_year === currentYear)
        .forEach(p => {
          if (p.period_month)
            rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
        });

      const effMap: Record<number, number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m    = getMonthFee(m);
        const credited = (rawPaidMap[m] || 0) + carry;
        effMap[m]      = credited;
        carry          = credited >= due_m ? (credited - due_m) : 0;
      }

      const currentMonthFee    = getMonthFee(currentMonth);
      const paidThisMonth      = effMap[currentMonth] || 0;
      const isCurrentMonthPaid = paidThisMonth >= currentMonthFee;
      const remainingThisMonth = Math.max(0, currentMonthFee - paidThisMonth);
      const monthlyRate        = currentMonthFee;

      let nextUnpaidMonth = currentMonth;
      for (let m = 1; m <= 12; m++) {
        if ((effMap[m] || 0) < getMonthFee(m)) { nextUnpaidMonth = m; break; }
        if (m === 12) nextUnpaidMonth = 13;
      }

      const totalPaidYear = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);
      const monthsPaid    = Array.from({ length: currentMonth }, (_, i) => i + 1)
        .filter(m => (effMap[m] || 0) >= getMonthFee(m)).length;
      const totalOutstanding = Array.from({ length: currentMonth }, (_, i) => i + 1)
        .reduce((sum, m) => sum + Math.max(0, getMonthFee(m) - (effMap[m] || 0)), 0);

      const chartData = MONTHS_SHORT.slice(0, currentMonth).map((m, i) => ({
        month: m,
        paid:  Math.min(effMap[i + 1] || 0, getMonthFee(i + 1)),
        due:   getMonthFee(i + 1),
      }));

      return {
        vendor, profile, stall, monthlyRate,
        payments: (payments || []).slice(0, 8),
        isCurrentMonthPaid, paidThisMonth, remainingThisMonth,
        nextUnpaidMonth, allPaid: nextUnpaidMonth > 12,
        totalPaidYear, monthsPaid, totalOutstanding,
        chartData, currentMonth, currentYear,
        unreadNotifs: notifications || [],
      };
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const d           = data!;
  const stall       = d.stall;
  const vendor      = d.vendor;
  const profile     = d.profile;
  const monthlyRate = d.monthlyRate;
  const currentMonth = new Date().getMonth() + 1;
  const paidPct      = monthlyRate > 0 ? Math.min(100, (d.paidThisMonth / monthlyRate) * 100) : 0;

  /* ── Action buttons config ───────────────────────────────────────────────── */
  const actions = [
    { label: "Pay Online",  to: "/vendor/pay",           icon: CreditCard },
    { label: "History",     to: "/vendor/history",       icon: History    },
    { label: "Statement",   to: "/vendor/statement",     icon: FileText   },
    { label: "Stall Info",  to: "/vendor/stall",         icon: Store      },
    { label: "Alerts",      to: "/vendor/notifications", icon: Bell, badge: d.unreadNotifs.length },
    { label: "News",        to: "/vendor/news",          icon: Newspaper  },
  ];

  /* ── Tab content switcher ────────────────────────────────────────────────── */
  const tabs = [
    { key: "balance",   label: "Balance"   },
    { key: "history",   label: "History"   },
    { key: "statement", label: "Statement" },
    { key: "news",      label: "News"      },
  ] as const;

  return (
    /* ── Outer wrapper: centers the phone frame on desktop, full-bleed on mobile ── */
    <div className="flex justify-center items-start min-h-screen bg-[#eef2f7] -m-7 p-0 lg:py-8 lg:px-4">

      {/* ── Phone frame shell ── */}
      <div
        className="w-full max-w-[390px] lg:rounded-[44px] lg:border-2 lg:border-slate-200 overflow-hidden flex flex-col"
        style={{ minHeight: "100dvh", background: "#f0f4f8", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* HEADER ZONE — deep navy gradient like GCash blue banner          */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div style={{ background: "linear-gradient(160deg, #1a3a5f 0%, #1d5799 55%, #2563eb 100%)", paddingBottom: 0 }}>

          {/* Top bar: brand + notification badge */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                <Store className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm tracking-wide">PALENG-CLICK</p>
                <p className="text-[9px] tracking-[2px] uppercase" style={{ color: "rgba(255,255,255,0.6)" }}>Vendor Portal</p>
              </div>
            </div>
            {d.unreadNotifs.length > 0 ? (
              <Link to="/vendor/notifications">
                <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white text-xs font-semibold" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}>
                  <span className="w-2 h-2 rounded-full bg-red-400 block" />
                  {d.unreadNotifs.length} Alerts
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white text-xs font-semibold" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
                <CheckCircle2 className="h-3 w-3 text-green-300" />
                All clear
              </div>
            )}
          </div>

          {/* Greeting row */}
          <div className="flex items-center justify-between px-5 pb-4">
            <div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.75)" }}>
                {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <p className="text-white text-xl font-bold mt-0.5">
                Hello, {profile?.first_name || "Vendor"}! 👋
              </p>
            </div>
            <div className="rounded-xl px-3 py-2 text-right" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <p className="text-[9px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>Your Stall</p>
              <p className="text-white text-sm font-bold">{stall?.stall_number || "—"} · {stall?.section || "General"}</p>
            </div>
          </div>

          {/* Tab strip — like Wallet / Save / Borrow / Invest */}
          <div className="flex px-2">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className="flex-1 py-2.5 text-xs font-medium transition-all"
                style={{
                  color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.55)",
                  fontWeight: activeTab === t.key ? 700 : 500,
                  borderBottom: activeTab === t.key ? "2.5px solid #fff" : "2.5px solid transparent",
                  background: "none",
                  border: "none",
                  borderBottom: activeTab === t.key ? "2.5px solid #fff" : "2.5px solid transparent",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Balance / Amount Due card ── */}
          <div className="px-5 py-4" style={{ background: "rgba(0,0,0,0.12)", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
            <p className="text-[10px] uppercase tracking-[2px] flex items-center gap-1.5 mb-2" style={{ color: "rgba(255,255,255,0.65)" }}>
              <Clock className="h-3 w-3" />
              {d.isCurrentMonthPaid ? "Next Bill Amount" : "Amount Due This Month"}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-white font-black" style={{ fontSize: 32, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>₱</span>
                {d.isCurrentMonthPaid
                  ? monthlyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })
                  : (d.remainingThisMonth || monthlyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
              <Link to="/vendor/pay">
                <button className="flex items-center gap-1.5 bg-white text-[#1a3a5f] font-bold text-sm rounded-full px-4 py-2">
                  <CreditCard className="h-3.5 w-3.5" />
                  {d.isCurrentMonthPaid ? "Pay Advance" : "Pay Now"}
                </button>
              </Link>
            </div>

            {/* Progress bar — shown when partial */}
            {d.paidThisMonth > 0 && !d.isCurrentMonthPaid && (
              <div className="mt-3">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Paid: <strong className="text-white">{fmt(d.paidThisMonth)}</strong>
                  </span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Remaining: <strong className="text-white">{fmt(d.remainingThisMonth)}</strong>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
                  <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            )}

            {/* Paid confirmation */}
            {d.isCurrentMonthPaid && (
              <div className="mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />
                <span className="text-[11px] text-green-300 font-semibold">{MONTHS[currentMonth - 1]} {d.currentYear} fully settled ✓</span>
              </div>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* BODY — white sections with gray gaps                            */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="flex-1 overflow-y-auto" style={{ background: "#f0f4f8" }}>

          {/* ── Quick Action Icons (like Send / Load / Transfer / Bills) ── */}
          <div className="bg-white px-4 pt-4 pb-3 mb-2">
            <div className="grid grid-cols-4 gap-1">
              {actions.map(a => (
                <Link key={a.to} to={a.to} className="flex flex-col items-center gap-1.5 py-2 rounded-xl transition-colors active:bg-slate-50">
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#e8f0fe", border: "1px solid #c7d8f8" }}>
                    <a.icon className="h-6 w-6 text-[#1a3a5f]" />
                    {a.badge ? (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-white">
                        {a.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: "#1a3a5f" }}>{a.label}</span>
                </Link>
              ))}
              {/* Two spacer slots to keep grid alignment */}
              <div /><div />
            </div>
          </div>

          {/* ── Payment Status Banner ── */}
          <div className="mx-3 mb-2">
            {d.isCurrentMonthPaid ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: "#dcfce7", border: "1px solid #86efac" }}
              >
                <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-700" />
                </div>
                <div className="flex-1">
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
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: "#fef3c7", border: "1px solid #fcd34d" }}
              >
                <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-900">
                    {MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} — Payment Due
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5 truncate">
                    {fmt(d.remainingThisMonth || monthlyRate)} outstanding balance
                  </p>
                </div>
                <Link to="/vendor/pay">
                  <button className="text-[11px] font-bold text-white bg-amber-600 rounded-xl px-3 py-1.5 shrink-0">
                    Pay Now
                  </button>
                </Link>
              </motion.div>
            )}
          </div>

          {/* ── Summary Stats (horizontal scroll like "Explore the App") ── */}
          <div>
            <div className="flex items-center justify-between px-4 pt-2 pb-2">
              <p className="text-sm font-bold" style={{ color: "#1a3a5f" }}>Your Summary</p>
              <Link to="/vendor/statement" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#2563eb" }}>
                View SOA <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex gap-2.5 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {[
                { label: "Total Paid",     value: fmt(d.totalPaidYear), sub: `${d.currentYear} so far`, bg: "#dcfce7", iconColor: "#16a34a", icon: TrendingUp },
                { label: "Months Settled", value: `${d.monthsPaid}/${d.currentMonth}`,  sub: "paid in full",   bg: "#e8f0fe", iconColor: "#2563eb", icon: Calendar },
                { label: "Outstanding",    value: fmt(d.totalOutstanding), sub: "balance due",  bg: d.totalOutstanding === 0 ? "#dcfce7" : "#fef3c7", iconColor: d.totalOutstanding === 0 ? "#16a34a" : "#d97706", icon: AlertCircle },
                { label: "Monthly Rate",   value: fmt(monthlyRate),    sub: "per month",     bg: "#f1f5f9", iconColor: "#475569", icon: CreditCard },
              ].map(s => (
                <div key={s.label} className="shrink-0 bg-white rounded-2xl p-3 border border-slate-100" style={{ width: 130 }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: s.bg }}>
                    <s.icon className="h-4 w-4" style={{ color: s.iconColor } as any} />
                  </div>
                  <p className="font-black text-[15px] text-slate-900 leading-tight" style={{ fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── QR Code Banner (like the GSave banner) ── */}
          <div className="mx-3 mb-2 rounded-2xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1a3a5f 0%, #2563eb 100%)" }}>
            <div className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="text-white font-bold text-sm mb-1">Your Stall QR Code</p>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Show this to the cashier for payment processing at the market office.
                </p>
                <div className="inline-block rounded-xl px-3 py-1 text-[11px] font-semibold text-white" style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  Stall {stall?.stall_number || "—"} · {stall?.section || "General"} Section
                </div>
              </div>
              <div className="bg-white rounded-xl p-2 shrink-0">
                {vendor?.qr_code
                  ? <QRCodeSVG value={vendor.qr_code} size={90} level="H" />
                  : <div className="w-[90px] h-[90px] flex items-center justify-center">
                      <QrCode className="h-12 w-12 text-slate-300" />
                    </div>}
              </div>
            </div>
          </div>

          {/* ── Payment Progress Chart ── */}
          <div className="bg-white mx-0 mb-2 px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold" style={{ color: "#1a3a5f" }}>Payment Progress</p>
                <p className="text-[11px] text-slate-500">Paid (teal) vs Due (gray) · {d.currentYear}</p>
              </div>
              <Link to="/vendor/statement">
                <span className="text-xs font-semibold" style={{ color: "#2563eb" }}>Full SOA ›</span>
              </Link>
            </div>
            {d.chartData.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No payment data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={d.chartData} barGap={3} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmt(v), name === "paid" ? "Paid" : "Due"]}
                    contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                  />
                  <Bar dataKey="due"  fill="#e2e8f0" radius={[4,4,0,0]} name="due" />
                  <Bar dataKey="paid" fill="#1d9e75" radius={[4,4,0,0]} name="paid" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Recent Payments ── */}
          <div className="bg-white mb-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <p className="text-sm font-bold" style={{ color: "#1a3a5f" }}>Recent Payments</p>
              <Link to="/vendor/history" className="text-xs font-semibold flex items-center gap-1" style={{ color: "#2563eb" }}>
                View All ›
              </Link>
            </div>
            <div>
              {d.payments.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: i < d.payments.length - 1 ? "0.5px solid #f8fafc" : "none" }}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    p.status === "completed" ? "bg-green-50" : p.status === "pending" ? "bg-amber-50" : "bg-red-50"
                  }`}>
                    {p.status === "completed"
                      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                      : p.status === "pending"
                      ? <Clock className="h-5 w-5 text-amber-500" />
                      : <AlertCircle className="h-5 w-5 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {p.period_month && p.period_year
                        ? `${MONTHS[p.period_month - 1]} ${p.period_year}`
                        : new Date(p.created_at).toLocaleDateString("en-PH")}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 capitalize">
                      {p.payment_method} · {p.payment_type === "staggered" ? "Partial" : "Full payment"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900" style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(Number(p.amount))}</p>
                    <p className={`text-[10px] font-semibold capitalize mt-0.5 ${
                      p.status === "completed" ? "text-green-600" : p.status === "pending" ? "text-amber-500" : "text-red-500"
                    }`}>{p.status}</p>
                  </div>
                </div>
              ))}
              {d.payments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                  <CreditCard className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No payments recorded yet</p>
                  <Link to="/vendor/pay">
                    <button className="mt-1 text-xs font-semibold text-white bg-[#1a3a5f] rounded-full px-4 py-2">Make your first payment</button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 80 }} />
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* BOTTOM NAV — GCash style with raised center QR button            */}
        {/* ════════════════════════════════════════════════════════════════ */}
        <div className="bg-white border-t border-slate-100 flex items-center justify-around px-2 pb-3 pt-2 sticky bottom-0" style={{ zIndex: 10 }}>
          <Link to="/vendor" className="flex flex-col items-center gap-1 px-3 py-1">
            <Home className="h-5 w-5 text-[#1a3a5f]" />
            <span className="text-[10px] font-bold text-[#1a3a5f]">Home</span>
          </Link>
          <Link to="/vendor/notifications" className="flex flex-col items-center gap-1 px-3 py-1 relative">
            <Bell className="h-5 w-5 text-slate-400" />
            {d.unreadNotifs.length > 0 && (
              <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-red-500 border border-white" />
            )}
            <span className="text-[10px] font-medium text-slate-400">Inbox</span>
          </Link>

          {/* Centre QR button — raised */}
          <div className="flex flex-col items-center gap-1 -mt-5">
            <Link to="/vendor/stall">
              <div className="w-14 h-14 rounded-full flex items-center justify-center border-4 border-[#f0f4f8]" style={{ background: "linear-gradient(135deg, #1a3a5f, #2563eb)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>
                <QrCode className="h-6 w-6 text-white" />
              </div>
            </Link>
            <span className="text-[10px] font-medium text-slate-400">My QR</span>
          </div>

          <Link to="/vendor/history" className="flex flex-col items-center gap-1 px-3 py-1">
            <ReceiptText className="h-5 w-5 text-slate-400" />
            <span className="text-[10px] font-medium text-slate-400">Payments</span>
          </Link>
          <Link to="/vendor/statement" className="flex flex-col items-center gap-1 px-3 py-1">
            <User className="h-5 w-5 text-slate-400" />
            <span className="text-[10px] font-medium text-slate-400">Profile</span>
          </Link>
        </div>

      </div>
    </div>
  );
};

export default VendorDashboardHome;