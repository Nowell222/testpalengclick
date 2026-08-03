import {
  Users, DollarSign, Loader2, Store, CheckCircle2,
  CreditCard, ArrowRight, Smartphone, Banknote,
  Activity, FileBarChart, QrCode, AlertTriangle, ChevronRight,
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
    <div style={{ background: "rgba(15,110,86,0.95)", border: "1px solid rgba(52,211,153,0.4)", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 16px rgba(0,0,0,0.12)" }}>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ color: "#34d399", fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{fmt(payload[0].value)}</p>
    </div>
  );
};

const AdminDashboardHome = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    refetchInterval: 30000,
    queryFn: async () => {
      const now = new Date(), todayStr = now.toISOString().split("T")[0];
      const yearStart = `${now.getFullYear()}-01-01T00:00:00`;
      const currentYear = now.getFullYear(), currentMonth = now.getMonth() + 1;

      const [vendorsRes, allPaymentsRes, stallsRes, pendingRes] = await Promise.all([
        supabase.from("vendors").select("id,user_id,stalls(stall_number,section,monthly_rate,monthly_rate_2026)"),
        supabase.from("payments").select("*").gte("created_at", yearStart).order("created_at", { ascending: false }),
        supabase.from("stalls").select("id,status,section,monthly_rate,monthly_rate_2026"),
        supabase.from("payments").select("id").eq("status", "pending"),
      ]);

      const vendors = vendorsRes.data || [], allPayments = allPaymentsRes.data || [];
      const stalls = stallsRes.data || [], pendingCount = pendingRes.data?.length || 0;
      const completed = allPayments.filter(p => p.status === "completed");
      const todayPay = completed.filter(p => p.created_at?.startsWith(todayStr));

      const recent8 = allPayments.slice(0, 5);
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
        const st = v.stalls as any; const rate = st?.monthly_rate_2026 || st?.monthly_rate || 1450; const paid = monthPaidByVendor[v.id] || 0;
        if (paid >= rate) paidVendors++; else if (paid > 0) partialVendors++; else unpaidVendors++;
      });

      const unpaidList = vendors.filter(v => { const st = v.stalls as any; const rate = st?.monthly_rate_2026 || st?.monthly_rate || 1450; return (monthPaidByVendor[v.id] || 0) < rate; });
      const unpaidIds = unpaidList.map(v => v.user_id);
      const { data: unpaidProfiles } = await supabase.from("profiles").select("user_id,first_name,last_name").in("user_id", unpaidIds);
      const unpaidDetails = unpaidList.map(v => {
        const pr = unpaidProfiles?.find(p => p.user_id === v.user_id);
        const st = v.stalls as any; const rate = st?.monthly_rate_2026 || st?.monthly_rate || 1450; const paid = monthPaidByVendor[v.id] || 0;
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
    <div className="space-y-4">

      {/* ── Executive Header Banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 12px 32px rgba(15,110,86,0.12)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Admin Dashboard</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-100">{today.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Good {greeting}, Administrator 👋</h1>
            <p className="text-xs text-white/70 mt-0.5">Overview of San Juan Public Market collections and stall operations</p>
          </div>

          <div className="flex items-center gap-3">
            {d.pendingCount > 0 && (
              <Link to="/admin/payments" className="no-underline">
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold bg-amber-400/20 border border-amber-300/40 text-amber-200 hover:bg-amber-400/30 transition-all">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{d.pendingCount} Pending Payment{d.pendingCount > 1 ? "s" : ""}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-amber-300" />
                </div>
              </Link>
            )}

            <div className="rounded-xl px-4 py-2.5 text-right bg-white/10 border border-white/20 shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">Today's Collection</p>
              <p className="font-mono text-lg font-bold text-white leading-none mt-0.5">{fmt(d.totalToday)}</p>
              <p className="text-[10px] text-emerald-100/70 mt-0.5">{d.txToday} txs</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Top KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Revenue", value: fmt(d.totalCollected), sub: "All time collections", icon: DollarSign, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30" },
          { label: "Today's Revenue", value: fmt(d.totalToday), sub: `${d.txToday} transaction${d.txToday !== 1 ? "s" : ""}`, icon: Activity, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/30" },
          { label: "Active Vendors", value: String(d.totalVendors), sub: `${d.paidVendors} paid this month`, icon: Users, iconBg: "bg-violet-100", iconColor: "#a855f7", glow: "#a855f7", gradient: "from-violet-50 to-violet-50/30" },
          { label: "Stall Occupancy", value: `${d.occupiedStalls}/${d.totalStalls}`, sub: `${d.totalStalls > 0 ? Math.round(d.occupiedStalls / d.totalStalls * 100) : 0}% occupied`, icon: Store, iconBg: "bg-amber-100", iconColor: "#f59e0b", glow: "#f59e0b", gradient: "from-amber-50 to-amber-50/30" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-sm transition-all duration-300 group`}>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-sm ${c.iconBg}`}>
                <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[16px] font-bold text-foreground leading-tight">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main 2-Column Dashboard Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── LEFT COLUMN (7 Cols): Analytics & Quick Nav ────────────────────── */}
        <div className="lg:col-span-7 space-y-4">

          {/* Quick Action Navigation Bar */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Quick Navigation Shortcuts</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link to="/admin/users" className="flex items-center gap-2.5 rounded-xl border bg-emerald-700 text-white p-2.5 hover:bg-emerald-800 transition-colors no-underline">
                <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-semibold truncate">User Mgmt</span>
              </Link>

              {[
                { label: "Payments", to: "/admin/payments", icon: CreditCard, color: "text-blue-600 bg-blue-50 border-blue-100" },
                { label: "QR Codes", to: "/admin/qr-codes", icon: QrCode, color: "text-amber-600 bg-amber-50 border-amber-100" },
                { label: "Reports", to: "/admin/reports", icon: FileBarChart, color: "text-purple-600 bg-purple-50 border-purple-100" },
              ].map(a => (
                <Link key={a.to} to={a.to} className={`flex items-center gap-2.5 rounded-xl border ${a.color} p-2.5 hover:opacity-90 transition-opacity no-underline`}>
                  <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-xs">
                    <a.icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Monthly Collections Chart */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-600" />
                <p className="text-xs font-bold text-foreground">Monthly Collections — {d.currentYear}</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700">{fmt(d.totalCollected)} total</span>
            </div>
            
            <div className="p-4">
              <div className="relative">
                <svg style={{ position: "absolute", width: 0, height: 0 }}>
                  <defs>
                    <linearGradient id="adminBarPast" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: "#34d399", stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: "#10b981", stopOpacity: 0.8 }} />
                    </linearGradient>
                    <linearGradient id="adminBarCur" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" style={{ stopColor: "#0f6e56", stopOpacity: 1 }} />
                      <stop offset="100%" style={{ stopColor: "#065f46", stopOpacity: 0.9 }} />
                    </linearGradient>
                  </defs>
                </svg>
                <ResponsiveContainer width="100%" height={175}>
                  <BarChart data={d.monthlyData} barSize={16} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220,10%,55%)", fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={42} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {d.monthlyData.map((_: any, i: number) => (
                        <Cell key={i} fill={i === d.currentMonth - 1 ? "url(#adminBarCur)" : "url(#adminBarPast)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t mt-2">
                {[
                  { label: "Best Month", value: fmt(Math.max(...d.monthlyData.map((c: any) => c.amount))) },
                  { label: "Avg/Month", value: fmt(Math.round(d.monthlyData.filter((c: any) => c.amount > 0).reduce((s: number, c: any) => s + c.amount, 0) / Math.max(1, d.monthlyData.filter((c: any) => c.amount > 0).length))) },
                  { label: "This Month", value: fmt(d.monthlyData[d.currentMonth - 1]?.amount || 0) },
                ].map((s, i) => (
                  <div key={i} className="text-center p-1.5 rounded-lg bg-secondary/30">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{s.label}</p>
                    <p className="font-mono text-xs font-bold text-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Collections by Payment Method */}
          {Object.keys(d.methodMap).length > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-600" />
                  <p className="text-xs font-bold text-foreground">Collections by Method</p>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{fmt(methodTotal)} total</span>
              </div>
              <div className="p-3.5 grid grid-cols-2 gap-2.5">
                {Object.entries(d.methodMap).map(([method, amount]) => {
                  const pct = methodTotal > 0 ? Math.round((amount / methodTotal) * 100) : 0;
                  const cfg = METHOD_CFG[method] || { iconBg: "bg-secondary", iconText: "text-foreground", pillBg: "bg-secondary", bar: "#6b7280", label: method };
                  const Icon = method === "cash" ? Banknote : Smartphone;
                  return (
                    <div key={method} className="rounded-xl border p-2.5 bg-card flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-md flex items-center justify-center ${cfg.iconBg}`}>
                            <Icon className={`h-3.5 w-3.5 ${cfg.iconText}`} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold leading-none text-foreground">{cfg.label}</p>
                            <p className="font-mono text-xs font-bold text-foreground mt-0.5">{fmt(amount)}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.bar }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── RIGHT COLUMN (5 Cols): Operational Action Items & Activity Log ── */}
        <div className="lg:col-span-5 space-y-4">

          {/* Vendor Compliance Breakdown Gauge */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold text-foreground">Compliance — {MONTHS_FULL[d.currentMonth - 1]}</h3>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${collectionRate >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {collectionRate}% Paid
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden flex">
              {(() => {
                const t = d.totalVendors || 1; return (<>
                  <div className="h-full bg-emerald-500" style={{ width: `${d.paidVendors / t * 100}%` }} />
                  <div className="h-full bg-amber-400" style={{ width: `${d.partialVendors / t * 100}%` }} />
                  <div className="h-full bg-red-400" style={{ width: `${d.unpaidVendors / t * 100}%` }} />
                </>);
              })()}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs border-t pt-2">
              <div className="bg-emerald-50/60 rounded-lg p-1.5 border border-emerald-100">
                <p className="text-[9px] font-bold text-emerald-700 uppercase">Paid</p>
                <p className="font-bold text-emerald-800">{d.paidVendors}</p>
              </div>
              <div className="bg-amber-50/60 rounded-lg p-1.5 border border-amber-100">
                <p className="text-[9px] font-bold text-amber-700 uppercase">Partial</p>
                <p className="font-bold text-amber-800">{d.partialVendors}</p>
              </div>
              <div className="bg-red-50/60 rounded-lg p-1.5 border border-red-100">
                <p className="text-[9px] font-bold text-red-700 uppercase">Unpaid</p>
                <p className="font-bold text-red-800">{d.unpaidVendors}</p>
              </div>
            </div>
          </div>

          {/* Unpaid Vendors (Attention Required - Direct List) */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-red-50/50 to-transparent">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <h3 className="text-xs font-bold text-foreground">Unpaid Stalls ({d.unpaidDetails.length})</h3>
              </div>
              <Link to="/admin/reports?tab=vendors" className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1 no-underline">
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {d.unpaidDetails.length === 0 ? (
              <div className="p-4 text-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs font-semibold text-emerald-700">All vendors paid this month!</p>
              </div>
            ) : (
              <div className="divide-y max-h-[220px] overflow-y-auto">
                {d.unpaidDetails.slice(0, 4).map((v: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-secondary/30 transition-colors">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-bold text-foreground truncate">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">Stall {v.stall} · {v.section}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono text-xs font-bold ${v.isPartial ? "text-amber-600" : "text-red-500"}`}>{fmt(v.remaining)}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${v.isPartial ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                        {v.isPartial ? "Partial" : "Unpaid"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Stream */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                <h3 className="text-xs font-bold text-foreground">Recent Transactions</h3>
              </div>
              <Link to="/admin/payments" className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1 no-underline">
                All Logs <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {d.recentTx.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No transactions recorded yet</div>
            ) : (
              <div className="divide-y max-h-[260px] overflow-y-auto">
                {d.recentTx.map((t: any) => {
                  const isC = t.status === "completed", isP = t.status === "pending";
                  const cfg = METHOD_CFG[t.payment_method] || { iconBg: "bg-secondary", iconText: "text-foreground", pillBg: "bg-secondary", bar: "#6b7280", label: t.payment_method };
                  return (
                    <div key={t.id} className="p-3 hover:bg-secondary/30 transition-colors flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate">{t.vendor_name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.iconBg} ${cfg.iconText}`}>{cfg.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Stall {t.stall} · {new Date(t.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-foreground">{fmt(Number(t.amount))}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isC ? "bg-emerald-100 text-emerald-700" : isP ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                          {isC ? "Completed" : isP ? "Pending" : "Failed"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default AdminDashboardHome;