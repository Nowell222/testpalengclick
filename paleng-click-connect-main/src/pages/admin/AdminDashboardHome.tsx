import { useState } from "react";
import {
  Users, DollarSign, AlertCircle, Loader2, Store, CheckCircle2,
  Clock, CreditCard, ArrowRight, Smartphone, Building2, Banknote,
  Activity, FileBarChart, QrCode, ChevronDown, ChevronUp,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtK = (n: number) => n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;

const METHOD_CFG: Record<string, { iconBg: string; iconText: string; pillBg: string; bar: string; label: string }> = {
  cash: { iconBg: "bg-slate-100", iconText: "text-slate-600", pillBg: "bg-slate-50", bar: "#64748b", label: "Cash" },
  gcash: { iconBg: "bg-blue-100", iconText: "text-blue-700", pillBg: "bg-blue-50", bar: "#3b82f6", label: "GCash" },
  paymaya: { iconBg: "bg-emerald-100", iconText: "text-emerald-700", pillBg: "bg-emerald-50", bar: "#10b981", label: "Maya" },
  instapay: { iconBg: "bg-indigo-100", iconText: "text-indigo-700", pillBg: "bg-indigo-50", bar: "#6366f1", label: "Instapay" },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,110,86,0.95)", border: "1px solid rgba(52,211,153,0.4)", borderRadius: 12, padding: "12px 16px", boxShadow: "0 8px 16px rgba(0,0,0,0.12)" }}>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ color: "#34d399", fontWeight: 600, fontFamily: "monospace", fontSize: 14 }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

const AdminDashboardHome = () => {
  const [showUnpaid, setShowUnpaid] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    refetchInterval: 30000,
    queryFn: async () => {
      const now = new Date(), todayStr = now.toISOString().split("T")[0];
      const yearStart = `${now.getFullYear()}-01-01T00:00:00`;
      const currentYear = now.getFullYear(), currentMonth = now.getMonth() + 1;

      const [vendorsRes, allPaymentsRes, stallsRes, pendingRes] = await Promise.all([
        supabase.from("vendors").select("id,user_id,stalls(stall_number,section,monthly_rate)"),
        supabase.from("payments").select("*").gte("created_at", yearStart).order("created_at", { ascending: false }),
        supabase.from("stalls").select("id,status,section,monthly_rate"),
        supabase.from("payments").select("id").eq("status", "pending"),
      ]);

      const vendors = vendorsRes.data || [], allPayments = allPaymentsRes.data || [];
      const stalls = stallsRes.data || [], pendingCount = pendingRes.data?.length || 0;
      const completed = allPayments.filter(p => p.status === "completed");
      const todayPay = completed.filter(p => p.created_at?.startsWith(todayStr));

      const recent8 = allPayments.slice(0, 8);
      const vids8 = [...new Set(recent8.map(p => p.vendor_id))];
      const { data: vend8 } = await supabase.from("vendors").select("id,user_id,stalls(stall_number,section)").in("id", vids8);
      const uids8 = vend8?.map(v => v.user_id) || [];
      const { data: prof8 } = await supabase.from("profiles").select("user_id,first_name,last_name").in("user_id", uids8);
      const recentTx = recent8.map(p => {
        const v = vend8?.find(v => v.id === p.vendor_id);
        const pr = prof8?.find(pr => pr.user_id === v?.user_id);
        const st = v?.stalls as any;
        return { ...p, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number || "—", section: st?.section || "" };
      });

      const monthlyMap: Record<number, number> = {};
      MONTHS_SHORT.forEach((_, i) => { monthlyMap[i] = 0; });
      completed.forEach(p => { const m = new Date(p.created_at).getMonth(); monthlyMap[m] = (monthlyMap[m] || 0) + Number(p.amount); });
      const monthlyData = MONTHS_SHORT.map((m, i) => ({ month: m, amount: monthlyMap[i] }));

      const methodMap: Record<string, number> = {};
      completed.forEach(p => { methodMap[p.payment_method] = (methodMap[p.payment_method] || 0) + Number(p.amount); });

      const monthPaidByVendor: Record<string, number> = {};
      completed.filter(p => p.period_month === currentMonth && p.period_year === currentYear)
        .forEach(p => { monthPaidByVendor[p.vendor_id] = (monthPaidByVendor[p.vendor_id] || 0) + Number(p.amount); });

      let paidVendors = 0, partialVendors = 0, unpaidVendors = 0;
      vendors.forEach(v => {
        const st = v.stalls as any; const rate = st?.monthly_rate || 1450; const paid = monthPaidByVendor[v.id] || 0;
        if (paid >= rate) paidVendors++; else if (paid > 0) partialVendors++; else unpaidVendors++;
      });

      const unpaidList = vendors.filter(v => { const st = v.stalls as any; return (monthPaidByVendor[v.id] || 0) < (st?.monthly_rate || 1450); });
      const unpaidIds = unpaidList.map(v => v.user_id);
      const { data: unpaidProfiles } = await supabase.from("profiles").select("user_id,first_name,last_name").in("user_id", unpaidIds);
      const unpaidDetails = unpaidList.map(v => {
        const pr = unpaidProfiles?.find(p => p.user_id === v.user_id);
        const st = v.stalls as any; const rate = st?.monthly_rate || 1450; const paid = monthPaidByVendor[v.id] || 0;
        return { name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number || "—", section: st?.section || "General", remaining: Math.max(0, rate - paid), isPartial: paid > 0 };
      });

      return {
        totalCollected: completed.reduce((s, p) => s + Number(p.amount), 0),
        totalToday: todayPay.reduce((s, p) => s + Number(p.amount), 0), txToday: todayPay.length,
        totalVendors: vendors.length, totalStalls: stalls.length,
        occupiedStalls: stalls.filter(s => s.status === "occupied").length,
        pendingCount, paidVendors, partialVendors, unpaidVendors,
        recentTx, monthlyData, methodMap, unpaidDetails, currentMonth, currentYear,
      };
    },
  });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "#0f6e56" }}>
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
      <p className="text-sm text-muted-foreground">Loading dashboard…</p>
    </div>
  );

  const d = data!;
  const collectionRate = d.totalVendors > 0 ? Math.round(d.paidVendors / d.totalVendors * 100) : 0;
  const methodTotal = Object.values(d.methodMap).reduce((s, v) => s + v, 0);
  const today = new Date();
  const greeting = today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening";

  return (
    <div className="space-y-3.5">

      {/* Hero */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 20px 48px rgba(15,110,86,0.15)" }}>
        {[[200, "-60px", "-60px", "top", "right"], [140, "-20px", "-20px", "top", "right"], [250, "-100px", "-60px", "bottom", "left"]].map(([sz, a, b, v, h], i) => (
          <div key={i} style={{ position: "absolute", [v as string]: a, [h as string]: b, width: sz, height: sz, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        ))}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2" style={{ color: "rgba(255,255,255,0.6)" }}>Admin Portal</p>
            <h1 className="text-[26px] font-bold text-white leading-tight">Good {greeting} 👋</h1>
            <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              <span className="inline-block w-1 h-1 rounded-full" style={{ background: "#34d399" }} />
              {today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="rounded-2xl px-5 py-4 text-right relative" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", minWidth: 165 }}>
            <div style={{ position: "absolute", top: 12, left: 12, width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.6)" }}>Today's Collection</p>
            <p className="font-mono text-[22px] font-bold text-white mt-1">{fmt(d.totalToday)}</p>
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{d.txToday} transaction{d.txToday !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="relative mt-5 rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Vendor compliance — {MONTHS_FULL[d.currentMonth - 1]}</p>
            <p className="text-[11px] font-bold text-white">{d.paidVendors}/{d.totalVendors} paid ({collectionRate}%)</p>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${collectionRate}%`, background: "linear-gradient(90deg,#34d399 0%,#6ee7b7 100%)" }} />
          </div>
        </div>
        {d.pendingCount > 0 && (
          <Link to="/admin/payments">
            <div className="mt-3.5 flex items-center gap-2.5 rounded-xl px-4 py-3 cursor-pointer group transition-all hover:scale-[1.02]" style={{ background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.35)" }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: "#fbbf24" }} />
              <span className="text-xs font-medium" style={{ color: "#fef08a" }}><strong className="text-sm">{d.pendingCount}</strong> pending payment{d.pendingCount > 1 ? "s" : ""} awaiting confirmation</span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto group-hover:translate-x-1 transition-transform" style={{ color: "#fbbf24" }} />
            </div>
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Collections", value: fmt(d.totalCollected), sub: "all time", icon: DollarSign, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30" },
          { label: "Today", value: fmt(d.totalToday), sub: `${d.txToday} transactions`, icon: Activity, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/30" },
          { label: "Active Vendors", value: String(d.totalVendors), sub: "registered", icon: Users, iconBg: "bg-violet-100", iconColor: "#a855f7", glow: "#a855f7", gradient: "from-violet-50 to-violet-50/30" },
          { label: "Stall Occupancy", value: `${d.occupiedStalls}/${d.totalStalls}`, sub: `${d.totalStalls > 0 ? Math.round(d.occupiedStalls / d.totalStalls * 100) : 0}% occupied`, icon: Store, iconBg: "bg-amber-100", iconColor: "#f59e0b", glow: "#f59e0b", gradient: "from-amber-50 to-amber-50/30" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-md transition-all duration-300 group`} style={{ minHeight: 110 }}>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-[0.08] blur-lg group-hover:opacity-[0.14] transition-opacity" style={{ background: c.glow }} />
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{c.label}</p>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${c.iconBg} group-hover:shadow-md transition-shadow`}>
                <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[17px] font-bold text-foreground leading-tight">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link to="/admin/users"
          className="relative overflow-hidden flex flex-col items-center justify-center gap-2 rounded-2xl text-white font-medium group hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
          style={{ minHeight: 88, background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", textDecoration: "none", boxShadow: "0 12px 32px rgba(15,110,86,0.2)" }}>
          <div style={{ position: "absolute", top: -25, right: -25, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div className="relative z-10 h-9 w-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform" style={{ background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.3)" }}>
            <Users className="h-4 w-4 text-white" />
          </div>
          <span className="relative z-10 text-[11px] font-semibold text-white text-center leading-tight">Manage Users</span>
        </Link>
        {[
          { label: "Payments", to: "/admin/payments", icon: CreditCard, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9" },
          { label: "QR Codes", to: "/admin/qr-codes", icon: QrCode, iconBg: "bg-amber-100", iconColor: "#f59e0b", glow: "#f59e0b" },
          { label: "Reports", to: "/admin/reports", icon: FileBarChart, iconBg: "bg-violet-100", iconColor: "#a855f7", glow: "#a855f7" },
        ].map(a => (
          <Link key={a.to} to={a.to}
            className="relative overflow-hidden flex items-center gap-3 rounded-2xl border border-border bg-card px-4 hover:shadow-md transition-all duration-300 group hover:scale-[1.02]"
            style={{ minHeight: 88, textDecoration: "none" }}>
            <div className="absolute -bottom-4 -right-4 w-14 h-14 rounded-full opacity-[0.06] blur-lg group-hover:opacity-[0.1] transition-opacity" style={{ background: a.glow }} />
            <div className={`relative z-10 h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${a.iconBg}`}>
              <a.icon className="h-4 w-4" style={{ color: a.iconColor }} />
            </div>
            <span className="relative z-10 text-[12px] font-semibold text-foreground">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Vendor Payment Rate */}
      <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md" />
            <p className="text-[13px] font-bold text-foreground">Vendor Payment Rate — {MONTHS_FULL[d.currentMonth - 1]} {d.currentYear}</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {[["bg-emerald-500", "Paid", d.paidVendors], ["bg-amber-400", "Partial", d.partialVendors], ["bg-red-400", "Unpaid", d.unpaidVendors]].map(([c, l, n]) => (
              <span key={l as string} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${c}`} /><span className="text-muted-foreground">{l}:</span><strong className="text-foreground">{n as number}</strong>
              </span>
            ))}
          </div>
        </div>
        <div className="px-5 py-4">
          <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
            {(() => {
              const t = d.totalVendors || 1; return (<>
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${d.paidVendors / t * 100}%` }} />
                <div className="h-full bg-amber-400 transition-all" style={{ width: `${d.partialVendors / t * 100}%` }} />
                <div className="h-full bg-red-400 transition-all" style={{ width: `${d.unpaidVendors / t * 100}%` }} />
              </>);
            })()}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{collectionRate}% collection rate</span>
            <span className={`font-semibold ${collectionRate >= 80 ? "text-emerald-600" : collectionRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
              {collectionRate >= 80 ? "On Track ✓" : collectionRate >= 50 ? "Moderate" : "Needs Attention"}
            </span>
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown */}
      {Object.keys(d.methodMap).length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md" />
              <p className="text-[13px] font-bold text-foreground">Collections by Payment Method</p>
            </div>
            <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>{fmt(methodTotal)} total</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {Object.entries(d.methodMap).map(([method, amount]) => {
              const pct = methodTotal > 0 ? Math.round((amount / methodTotal) * 100) : 0;
              const cfg = METHOD_CFG[method] || { iconBg: "bg-secondary", iconText: "text-foreground", pillBg: "bg-secondary", bar: "#6b7280", label: method };
              const Icon = method === "cash" ? Banknote : Smartphone;
              return (
                <div key={method} className="group relative overflow-hidden flex flex-col rounded-xl border border-border px-4 py-3.5 transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg,${cfg.pillBg} 0%,rgba(255,255,255,0) 100%)` }}>
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${cfg.iconBg}`}>
                        <Icon className={`h-4 w-4 ${cfg.iconText}`} />
                      </div>
                      <div>
                        <p className={`text-[11px] font-bold ${cfg.iconText}`}>{cfg.label}</p>
                        <p className="font-mono text-[14px] font-bold text-foreground mt-0.5">{fmt(amount)}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-bold ${cfg.iconText}`}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.bar }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Chart */}
      <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-600 shadow-md" />
            <p className="text-[13px] font-bold text-foreground">Monthly Collections — {d.currentYear}</p>
          </div>
          <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>{fmt(d.totalCollected)} total</span>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pt-4 pb-2">
          {[["#34d399", "Past months"], ["#0f6e56", "Current month"]].map(([c, l]) => (
            <div key={l} className="flex items-center gap-2"><div className="w-2 h-2 rounded-sm" style={{ background: c }} /><span className="text-[11px] font-medium text-muted-foreground">{l}</span></div>
          ))}
        </div>
        <div className="relative">
          <svg style={{ position: "absolute", width: 0, height: 0 }}>
            <defs>
              <linearGradient id="adminBarPast" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#34d399", stopOpacity: 1 }} /><stop offset="100%" style={{ stopColor: "#10b981", stopOpacity: 0.8 }} />
              </linearGradient>
              <linearGradient id="adminBarCur" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{ stopColor: "#0f6e56", stopOpacity: 1 }} /><stop offset="100%" style={{ stopColor: "#065f46", stopOpacity: 0.9 }} />
              </linearGradient>
            </defs>
          </svg>
          <div className="relative px-4 py-3" style={{ background: "rgba(240,253,250,0.3)" }}>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={d.monthlyData} barSize={18} margin={{ top: 10, right: 10, left: -8, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220,10%,55%)", fontWeight: 500 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                  {d.monthlyData.map((_: any, i: number) => (
                    <Cell key={i} fill={i === d.currentMonth - 1 ? "url(#adminBarCur)" : "url(#adminBarPast)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 px-4 pb-4 border-t">
          {[
            { label: "Best Month", value: fmt(Math.max(...d.monthlyData.map((c: any) => c.amount))) },
            { label: "Avg/Month", value: fmt(Math.round(d.monthlyData.filter((c: any) => c.amount > 0).reduce((s: number, c: any) => s + c.amount, 0) / Math.max(1, d.monthlyData.filter((c: any) => c.amount > 0).length))) },
            { label: "This Month", value: fmt(d.monthlyData[d.currentMonth - 1]?.amount || 0) },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center pt-3 px-2 gap-1.5 rounded-lg hover:bg-secondary/40 transition-colors">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="font-mono text-[12px] font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Unpaid This Month — collapsible */}
      <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        <div onClick={() => setShowUnpaid(v => !v)}
          className="flex items-center justify-between w-full px-5 py-4 border-b bg-gradient-to-r from-red-50/50 to-transparent hover:bg-secondary/30 transition-colors cursor-pointer select-none">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-red-400 shadow-md" />
            <h3 className="text-[13px] font-bold text-foreground">Unpaid This Month</h3>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">{d.unpaidVendors + d.partialVendors} vendors</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/reports?tab=vendors" onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition-all hover:shadow-md group"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", textDecoration: "none" }}>
              View all<ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
            {showUnpaid ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {showUnpaid && (d.unpaidDetails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 opacity-60" />
            <p className="text-sm font-medium text-emerald-600">All vendors paid this month!</p>
          </div>
        ) : (
          <div className="divide-y">
            {d.unpaidDetails.slice(0, 3).map((v: any, i: number) => (
              <div key={i} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-secondary/30 transition-colors">
                <div className="relative shrink-0">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold ${v.isPartial ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                    {v.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${v.isPartial ? "bg-amber-400" : "bg-red-500"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-foreground">{v.name}</p>
                  <p className="text-[10px] text-muted-foreground">Stall {v.stall} · {v.section}{v.isPartial ? " · Partially paid" : ""}</p>
                </div>
                <p className={`font-mono text-[13px] font-bold shrink-0 ${v.isPartial ? "text-amber-600" : "text-red-500"}`}>{fmt(v.remaining)}</p>
              </div>
            ))}
            {d.unpaidDetails.length > 3 && (
              <div className="px-5 py-3 text-center">
                <p className="text-xs text-muted-foreground">+{d.unpaidDetails.length - 3} more vendors with outstanding balance</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent Transactions — collapsible */}
      <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        <div onClick={() => setShowRecent(v => !v)}
          className="flex items-center justify-between w-full px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent hover:bg-secondary/30 transition-colors cursor-pointer select-none">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md" />
            <h3 className="text-[13px] font-bold text-foreground">Recent Transactions</h3>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
              {d.recentTx.length > 0 ? (showRecent ? `Showing 3 of ${d.recentTx.length}` : `${d.recentTx.length} recent — tap to expand`) : "No transactions"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/admin/payments" onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition-all hover:shadow-md group"
              style={{ background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)", textDecoration: "none" }}>
              View all<ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
            {showRecent ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        {showRecent && (d.recentTx.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2 text-muted-foreground">
            <CreditCard className="h-8 w-8 opacity-20" /><p className="text-sm">No transactions yet</p>
          </div>
        ) : (
          <div className="divide-y">
            <div className="hidden md:grid grid-cols-[50px_1fr_110px_110px_90px_80px] gap-4 px-5 py-3 bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <div>Status</div><div>Vendor</div><div>Method</div><div>Amount</div><div>Time</div><div>Type</div>
            </div>
            {d.recentTx.slice(0, 3).map((t: any) => {
              const isC = t.status === "completed", isP = t.status === "pending";
              const ini = t.vendor_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
              const cfg = METHOD_CFG[t.payment_method] || { iconBg: "bg-secondary", iconText: "text-foreground", pillBg: "bg-secondary", bar: "#6b7280", label: t.payment_method };
              return (<>
                <div key={t.id} className="hidden md:grid grid-cols-[50px_1fr_110px_110px_90px_80px] gap-4 px-5 py-3.5 items-center hover:bg-secondary/30 transition-colors border-t border-border/50">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${isC ? "bg-emerald-100 text-emerald-700" : isP ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{ini}</div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isC ? "bg-emerald-500" : isP ? "bg-amber-400 animate-pulse" : "bg-red-500"}`} />
                    </div>
                  </div>
                  <div><p className="text-[12px] font-bold text-foreground">{t.vendor_name}</p><p className="text-[10px] text-muted-foreground">Stall {t.stall} · {t.section}</p></div>
                  <div><span className={`inline-flex text-[10px] font-bold px-2.5 py-1 rounded-lg ${cfg.iconBg} ${cfg.iconText}`}>{cfg.label}</span></div>
                  <div><p className="font-mono text-[13px] font-bold text-foreground">{fmt(Number(t.amount))}</p></div>
                  <div><p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</p></div>
                  <div><span className={`text-[9px] font-bold px-2 py-1 rounded-full ${isC ? "bg-emerald-50 text-emerald-700" : isP ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>{isC ? "✓ Done" : isP ? "⏱ Pending" : "✗ Failed"}</span></div>
                </div>
                <div key={`m-${t.id}`} className="md:hidden flex items-start gap-3.5 px-4 py-3.5 hover:bg-secondary/30 transition-colors border-t">
                  <div className="relative shrink-0">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold ${isC ? "bg-emerald-100 text-emerald-700" : isP ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{ini}</div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isC ? "bg-emerald-500" : isP ? "bg-amber-400 animate-pulse" : "bg-red-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div><p className="text-[12px] font-bold text-foreground">{t.vendor_name}</p><p className="text-[10px] text-muted-foreground">Stall {t.stall} · {t.section}</p></div>
                      <p className="font-mono text-[12px] font-bold text-foreground shrink-0">{fmt(Number(t.amount))}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${cfg.iconBg} ${cfg.iconText}`}>{cfg.label}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${isC ? "bg-emerald-50 text-emerald-700" : isP ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}>{isC ? "Completed" : isP ? "Pending" : "Failed"}</span>
                    </div>
                  </div>
                </div>
              </>);
            })}
          </div>
        ))}
      </div>

    </div>
  );
};

export default AdminDashboardHome;