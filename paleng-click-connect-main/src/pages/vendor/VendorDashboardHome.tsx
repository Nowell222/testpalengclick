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
  blue50:  "#eff6ff",
  blue100: "#dbeafe",
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
          {/* Panel top bar */}
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
          <VendorBottomNav unreadNotifs={unreadNotifs} />
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
      const { data: payments } = await supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").order("created_at", { ascending: false });
      const { data: notifications } = await supabase.from("notifications").select("*").eq("user_id", user!.id).eq("read_status", false).order("created_at", { ascending: false }).limit(5);

      const stall        = vendor?.stalls as any;
      const defaultRate  = stall?.monthly_rate || 1450;
      const currentYear  = new Date().getFullYear();
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

      const totalPaidYear    = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);
      const monthsPaid       = Array.from({ length: currentMonth }, (_, i) => i + 1).filter(m => (effMap[m] || 0) >= getMonthFee(m)).length;
      const totalOutstanding = Array.from({ length: currentMonth }, (_, i) => i + 1).reduce((sum, m) => sum + Math.max(0, getMonthFee(m) - (effMap[m] || 0)), 0);

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
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const d            = data!;
  const stall        = d.stall;
  const vendor       = d.vendor;
  const profile      = d.profile;
  const monthlyRate  = d.monthlyRate;
  const currentMonth = new Date().getMonth() + 1;
  const paidPct      = monthlyRate > 0 ? Math.min(100, (d.paidThisMonth / monthlyRate) * 100) : 0;

  const handleTabClick = (tab: "balance" | "history" | "statement") => {
    setActiveTab(tab);
    if (tab === "history")   setShowHistoryPanel(true);
    if (tab === "statement") setShowStatementPanel(true);
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
    { label: "Payment History",      to: "/vendor/history",       icon: History   },
    { label: "Statement of Account", to: "/vendor/statement",     icon: FileText  },
    { label: "Stall Information",    to: "/vendor/stall",         icon: Store     },
    { label: "Notifications",        to: "/vendor/notifications", icon: Bell,     badge: d.unreadNotifs.length },
    { label: "News & Updates",       to: "/vendor/news",          icon: Newspaper },
  ];

  const tabs = [
    { key: "balance",   label: "Balance"   },
    { key: "history",   label: "History"   },
    { key: "statement", label: "Statement" },
  ] as const;

  /* ─── DESKTOP VIEW ──────────────────────────────────────────────────────────── */
  const DesktopView = () => (
    <div className="hidden lg:block space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hello, {profile?.first_name}! 👋</h1>
          <p className="text-sm text-muted-foreground">
            Stall {stall?.stall_number || "—"} · {stall?.section || "General"} Section ·{" "}
            {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {d.unreadNotifs.length > 0 && (
          <Link to="/vendor/notifications">
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors">
              <Bell className="h-4 w-4" />
              <span>{d.unreadNotifs.length} unread notification{d.unreadNotifs.length > 1 ? "s" : ""}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        )}
      </div>

      {/* Status Banner */}
      {d.isCurrentMonthPaid ? (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl border border-success/20 bg-success/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-semibold text-success">{MONTHS[currentMonth - 1]} {d.currentYear} — Paid ✓</p>
              <p className="text-xs text-muted-foreground">Your stall fee for this month is fully settled</p>
            </div>
          </div>
          {!d.allPaid && d.nextUnpaidMonth <= 12 && (
            <Link to="/vendor/pay">
              <Button size="sm" variant="outline" className="border-success/30 text-success hover:bg-success/10 shrink-0">
                Pay {MONTHS[d.nextUnpaidMonth - 1]} early <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          )}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl border border-accent/20 bg-accent/5 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 shrink-0">
              <AlertCircle className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-accent">
                {MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} {d.currentYear} — Payment Due
              </p>
              {d.paidThisMonth > 0
                ? <p className="text-xs text-muted-foreground">{fmt(d.paidThisMonth)} paid · {fmt(d.remainingThisMonth)} remaining</p>
                : <p className="text-xs text-muted-foreground">{fmt(monthlyRate)} due this month</p>}
            </div>
          </div>
          <Link to="/vendor/pay">
            <Button size="sm" variant="hero" className="shrink-0">Pay Now <ArrowRight className="ml-1.5 h-3 w-3" /></Button>
          </Link>
        </motion.div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <motion.div whileHover={{ y: -2 }} className="rounded-2xl border bg-card p-5 shadow-civic">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            {d.isCurrentMonthPaid ? "Next Bill" : "Amount Due"}
          </p>
          <p className="font-mono text-3xl font-bold text-foreground leading-none">
            {fmt(d.isCurrentMonthPaid ? monthlyRate : (d.remainingThisMonth || monthlyRate))}
          </p>
          <p className="text-sm text-muted-foreground mt-1.5">
            {d.isCurrentMonthPaid
              ? `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth + 1) - 1] || "All months paid"} ${d.currentYear}`
              : `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} ${d.currentYear}`}
          </p>
          {d.paidThisMonth > 0 && !d.isCurrentMonthPaid && (
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Paid so far</span><span>{fmt(d.paidThisMonth)}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${paidPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Remaining</span><span className="text-accent font-medium">{fmt(d.remainingThisMonth)}</span>
              </div>
            </div>
          )}
          <Link to="/vendor/pay" className="block mt-4">
            <Button variant="hero" size="lg" className="w-full">
              <CreditCard className="mr-2 h-4 w-4" />
              {d.isCurrentMonthPaid ? "Pay in Advance" : "Pay Now"}
            </Button>
          </Link>
        </motion.div>
        <div className="rounded-2xl border bg-card p-5 shadow-civic flex flex-col items-center text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Your Stall QR Code</p>
          <div className="rounded-xl border-2 border-dashed border-border p-3 bg-white">
            {vendor?.qr_code ? <QRCodeSVG value={vendor.qr_code} size={120} level="H" /> : <QrCode className="h-16 w-16 text-muted-foreground/30" />}
          </div>
          <p className="mt-2.5 font-semibold text-foreground text-sm">Stall {stall?.stall_number}</p>
          <p className="text-xs font-mono text-muted-foreground mt-0.5 break-all leading-relaxed">{vendor?.qr_code}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Monthly Rate",   value: fmt(monthlyRate),        sub: "per month",       icon: Calendar,     color: "text-foreground",  bg: "bg-secondary"  },
          { label: "Total Paid",     value: fmt(d.totalPaidYear),    sub: `${d.currentYear} so far`, icon: TrendingUp, color: "text-green-600",   bg: "bg-green-50"   },
          { label: "Months Settled", value: `${d.monthsPaid}/${d.currentMonth}`, sub: "paid in full", icon: CheckCircle2, color: d.monthsPaid === d.currentMonth ? "text-green-600" : "text-blue-600", bg: d.monthsPaid === d.currentMonth ? "bg-green-50" : "bg-blue-50" },
          { label: "Outstanding",    value: fmt(d.totalOutstanding), sub: "balance due",     icon: AlertCircle,  color: d.totalOutstanding === 0 ? "text-green-600" : "text-accent", bg: d.totalOutstanding === 0 ? "bg-green-50" : "bg-accent/10" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
            </div>
            <p className={`font-mono text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {/* Chart */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground">Payment Progress</h3>
                <p className="text-xs text-muted-foreground">Blue = paid · Gray = due</p>
              </div>
              <Link to="/vendor/statement"><Button variant="ghost" size="sm" className="text-primary h-7 text-xs gap-1">Full SOA <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
            {d.chartData.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-10">No payment data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={d.chartData} barGap={3} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={45} />
                  <Tooltip formatter={(v: number, name: string) => [fmt(v), name === "paid" ? "Paid" : "Due"]} contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }} />
                  <Bar dataKey="due"  fill="#e2e8f0" radius={[4,4,0,0]} name="due" />
                  <Bar dataKey="paid" fill="#2563eb" radius={[4,4,0,0]} name="paid" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent Payments — desktop collapsible */}
          <div className="rounded-2xl border bg-card shadow-civic">
            <div className="flex items-center justify-between border-b px-5 py-3.5">
              <h3 className="font-semibold text-foreground">Recent Payments</h3>
              <Link to="/vendor/history"><Button variant="ghost" size="sm" className="text-primary h-7 text-xs gap-1">View All <ArrowRight className="h-3 w-3" /></Button></Link>
            </div>
            <div className="divide-y">
              {(paymentsExpanded ? d.payments : d.payments.slice(0, 3)).map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${p.status === "completed" ? "bg-green-100" : p.status === "pending" ? "bg-amber-100" : "bg-red-100"}`}>
                    {p.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : p.status === "pending" ? <Clock className="h-4 w-4 text-amber-600" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : new Date(p.created_at).toLocaleDateString("en-PH")}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">{p.payment_method} · {p.payment_type === "staggered" ? "Partial" : "Full payment"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-bold text-foreground">{fmt(Number(p.amount))}</p>
                    <p className={`text-xs font-medium capitalize ${p.status === "completed" ? "text-green-600" : p.status === "pending" ? "text-amber-600" : "text-red-500"}`}>{p.status}</p>
                  </div>
                </div>
              ))}
              {d.payments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <CreditCard className="h-8 w-8 opacity-30" /><p className="text-sm">No payments recorded yet</p>
                  <Link to="/vendor/pay"><Button size="sm" variant="outline" className="mt-1">Make your first payment</Button></Link>
                </div>
              )}
            </div>
            {d.payments.length > 3 && (
              <button onClick={() => setPaymentsExpanded(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-t hover:bg-slate-50 transition-colors"
                style={{ color: DS.blue600 }}>
                {paymentsExpanded
                  ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> Show {d.payments.length - 3} more payments</>}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-4 shadow-civic h-fit">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Quick Links</p>
          <div className="space-y-0.5">
            {quickLinks.map(l => (
              <Link key={l.to} to={l.to} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                <div className="flex items-center gap-2.5"><l.icon className="h-4 w-4" />{l.label}</div>
                <div className="flex items-center gap-1.5">
                  {(l as any).badge ? (<span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{(l as any).badge}</span>) : null}
                  <ArrowRight className="h-3.5 w-3.5 opacity-40" />
                </div>
              </Link>
            ))}
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

        {/* Slide panels */}
        <SlidePanel open={showHistoryPanel} onClose={() => { setShowHistoryPanel(false); setActiveTab("balance"); }}
          title="Payment History" unreadNotifs={d.unreadNotifs.length}>
          <VendorHistory />
        </SlidePanel>
        <SlidePanel open={showStatementPanel} onClose={() => { setShowStatementPanel(false); setActiveTab("balance"); }}
          title="Statement of Account" unreadNotifs={d.unreadNotifs.length}>
          <VendorStatement />
        </SlidePanel>

        {/* ── Gradient hero ── */}
        <div style={{ background: DS.gradientHeader }}>

          {/* Clean header row — NO hamburger */}
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

          {/* 3-tab strip: Balance | History | Statement */}
          <div className="flex px-2">
            {tabs.map(t => (
              <button key={t.key} onClick={() => handleTabClick(t.key)}
                className="flex-1 py-2.5 text-xs transition-all"
                style={{
                  color: activeTab === t.key ? "#fff" : "rgba(255,255,255,0.55)",
                  fontWeight: activeTab === t.key ? 700 : 500,
                  background: "none", border: "none",
                  borderBottom: activeTab === t.key ? "2.5px solid #fff" : "2.5px solid transparent",
                  cursor: "pointer",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Balance zone */}
          <div className="px-5 py-4" style={{ background: "rgba(0,0,0,0.14)", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="text-[10px] uppercase tracking-[2px] flex items-center gap-1.5 mb-2"
              style={{ color: "rgba(255,255,255,0.65)" }}>
              <Clock className="h-3 w-3" />
              {d.isCurrentMonthPaid ? "Next Bill Amount" : "Amount Due This Month"}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-white font-black" style={{ fontSize: 32, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontSize: 20, fontWeight: 700 }}>₱</span>
                {(d.isCurrentMonthPaid ? monthlyRate : (d.remainingThisMonth || monthlyRate))
                  .toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </p>
              <Link to="/vendor/pay">
                <button className="flex items-center gap-1.5 bg-white font-bold text-sm rounded-full px-4 py-2"
                  style={{ color: DS.blue900 }}>
                  <CreditCard className="h-3.5 w-3.5" />
                  {d.isCurrentMonthPaid ? "Pay Advance" : "Pay Now"}
                </button>
              </Link>
            </div>
            {d.paidThisMonth > 0 && !d.isCurrentMonthPaid && (
              <div className="mt-3">
                <div className="flex justify-between mb-1">
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.65)" }}>Paid: <strong className="text-white">{fmt(d.paidThisMonth)}</strong></span>
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.65)" }}>Remaining: <strong className="text-white">{fmt(d.remainingThisMonth)}</strong></span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.2)" }}>
                  <div className="h-full rounded-full bg-green-400 transition-all" style={{ width: `${paidPct}%` }} />
                </div>
              </div>
            )}
            {d.isCurrentMonthPaid && (
              <div className="mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-300" />
                <span className="text-[11px] text-green-300 font-semibold">
                  {MONTHS[currentMonth - 1]} {d.currentYear} fully settled ✓
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── White body ── */}
        <div style={{ background: "#f0f4f8" }}>

          {/* Action grid */}
          <div className="bg-white px-4 pt-4 pb-3 mb-2">
            <div className="grid grid-cols-3 gap-1">
              {mobileActions.map(a => (
                <Link key={a.to} to={a.to}
                  className="flex flex-col items-center gap-1.5 py-2 rounded-xl transition-colors active:bg-slate-50">
                  <div className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: DS.blue50, border: `1px solid ${DS.blue100}` }}>
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

          {/* Payment status banner */}
          <div className="mx-3 mb-2">
            {d.isCurrentMonthPaid ? (
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: "#dcfce7", border: "1px solid #86efac" }}>
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
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
                style={{ background: "#fef3c7", border: "1px solid #fcd34d" }}>
                <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-900">
                    {MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} — Payment Due
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5 truncate">{fmt(d.remainingThisMonth || monthlyRate)} outstanding balance</p>
                </div>
                <Link to="/vendor/pay">
                  <button className="text-[11px] font-bold text-white bg-amber-600 rounded-xl px-3 py-1.5 shrink-0">Pay Now</button>
                </Link>
              </div>
            )}
          </div>

          {/* Stats scroll */}
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

          {/* QR Banner */}
          <div className="mx-3 mb-2 rounded-2xl overflow-hidden" style={{ background: DS.gradientCard }}>
            <div className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="text-white font-bold text-sm mb-1">Your Stall QR Code</p>
                <p className="text-[11px] mb-3 leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                  Show this to the cashier for payment processing at the market office.
                </p>
                <div className="inline-block rounded-xl px-3 py-1 text-[11px] font-semibold text-white"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)" }}>
                  Stall {stall?.stall_number || "—"} · {stall?.section || "General"} Section
                </div>
              </div>
              <div className="bg-white rounded-xl p-2 shrink-0">
                {vendor?.qr_code
                  ? <QRCodeSVG value={vendor.qr_code} size={90} level="H" />
                  : <div className="w-[90px] h-[90px] flex items-center justify-center"><QrCode className="h-12 w-12 text-slate-300" /></div>}
              </div>
            </div>
          </div>

          {/* Payment chart */}
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

          {/* Recent payments — collapsible, show 3 by default */}
          <div className="bg-white mb-2">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <p className="text-sm font-bold" style={{ color: DS.blue900 }}>Recent Payments</p>
              <button onClick={() => setShowHistoryPanel(true)} className="text-xs font-semibold flex items-center gap-1" style={{ color: DS.blue600 }}>
                View All ›
              </button>
            </div>
            <div>
              {shownPayments.map((p: any, i: number) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < shownPayments.length - 1 ? "0.5px solid #f8fafc" : "none" }}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${p.status === "completed" ? "bg-green-50" : p.status === "pending" ? "bg-amber-50" : "bg-red-50"}`}>
                    {p.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                      : p.status === "pending" ? <Clock className="h-5 w-5 text-amber-500" />
                      : <AlertCircle className="h-5 w-5 text-red-500" />}
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
                  <Link to="/vendor/pay">
                    <button className="mt-1 text-xs font-semibold text-white rounded-full px-4 py-2" style={{ background: DS.blue800 }}>Make your first payment</button>
                  </Link>
                </div>
              )}
            </div>
            {/* Expand / collapse toggle */}
            {d.payments.length > 3 && (
              <button onClick={() => setPaymentsExpanded(v => !v)}
                className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-t border-slate-50 hover:bg-slate-50 transition-colors"
                style={{ color: DS.blue600 }}>
                {paymentsExpanded
                  ? <><ChevronUp className="h-3.5 w-3.5" /> Show less</>
                  : <><ChevronDown className="h-3.5 w-3.5" /> Show {d.payments.length - 3} more</>}
              </button>
            )}
          </div>

        </div>

        {/* Unified bottom nav */}
        <VendorBottomNav unreadNotifs={d.unreadNotifs.length} />
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