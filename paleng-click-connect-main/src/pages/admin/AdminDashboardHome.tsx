import { motion } from "framer-motion";
import {
  Users, TrendingUp, DollarSign, AlertCircle, Loader2,
  Store, CheckCircle2, Clock, CreditCard, ArrowRight,
  Smartphone, Building2, Banknote, Activity, BarChart2,
  UserCheck, CalendarDays,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt  = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtK = (n: number) => n >= 1000 ? `₱${(n / 1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",  label: "GCash"    },
  paymaya:  { icon: Smartphone, color: "bg-green-600", label: "Maya"     },
  instapay: { icon: Building2,  color: "bg-primary",   label: "InstaPay" },
  cash:     { icon: Banknote,   color: "bg-slate-500", label: "Cash"     },
};

const PIE_COLORS = ["#1e3a5f","#2563eb","#059669","#b45309"];

const AdminDashboardHome = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    refetchInterval: 30000,
    queryFn: async () => {
      const now          = new Date();
      const todayStr     = now.toISOString().split("T")[0];
      const yearStart    = `${now.getFullYear()}-01-01T00:00:00`;
      const currentYear  = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const [vendorsRes, allPaymentsRes, stallsRes, pendingRes] = await Promise.all([
        supabase.from("vendors").select("id, user_id, stalls(stall_number, section, monthly_rate)"),
        supabase.from("payments").select("*").gte("created_at", yearStart).order("created_at", { ascending: false }),
        supabase.from("stalls").select("id, status, section, monthly_rate"),
        supabase.from("payments").select("id").eq("status", "pending"),
      ]);

      const vendors       = vendorsRes.data    || [];
      const allPayments   = allPaymentsRes.data || [];
      const stalls        = stallsRes.data      || [];
      const pendingCount  = pendingRes.data?.length || 0;

      const completed     = allPayments.filter(p => p.status === "completed");
      const todayPay      = completed.filter(p => p.created_at?.startsWith(todayStr));

      const recent8       = allPayments.slice(0, 8);
      const vendorIds8    = [...new Set(recent8.map(p => p.vendor_id))];
      const { data: vend8 } = await supabase.from("vendors").select("id, user_id, stalls(stall_number, section)").in("id", vendorIds8);
      const uids8           = vend8?.map(v => v.user_id) || [];
      const { data: prof8 } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", uids8);

      const recentTx = recent8.map(p => {
        const v  = vend8?.find(v => v.id === p.vendor_id);
        const pr = prof8?.find(pr => pr.user_id === v?.user_id);
        const st = v?.stalls as any;
        return { ...p, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number || "—", section: st?.section || "" };
      });

      const monthlyMap: Record<number, number> = {};
      MONTHS_SHORT.forEach((_, i) => { monthlyMap[i] = 0; });
      completed.forEach(p => {
        const m = new Date(p.created_at).getMonth();
        monthlyMap[m] = (monthlyMap[m] || 0) + Number(p.amount);
      });
      const monthlyData = MONTHS_SHORT.map((m, i) => ({ month: m, amount: monthlyMap[i] }));

      const methodMap: Record<string, number> = {};
      completed.forEach(p => { methodMap[p.payment_method] = (methodMap[p.payment_method] || 0) + Number(p.amount); });
      const methodData = Object.entries(methodMap).map(([method, amount]) => ({
        method: method === "paymaya" ? "Maya" : method.charAt(0).toUpperCase() + method.slice(1),
        amount,
      }));

      const monthPaidByVendor: Record<string, number> = {};
      completed.filter(p => p.period_month === currentMonth && p.period_year === currentYear)
        .forEach(p => { monthPaidByVendor[p.vendor_id] = (monthPaidByVendor[p.vendor_id] || 0) + Number(p.amount); });

      let paidVendors = 0, partialVendors = 0, unpaidVendors = 0;
      vendors.forEach(v => {
        const st   = v.stalls as any;
        const rate = st?.monthly_rate || 1450;
        const paid = monthPaidByVendor[v.id] || 0;
        if (paid >= rate) paidVendors++;
        else if (paid > 0) partialVendors++;
        else unpaidVendors++;
      });

      const unpaidList = vendors
        .filter(v => {
          const st   = v.stalls as any;
          const rate = st?.monthly_rate || 1450;
          return (monthPaidByVendor[v.id] || 0) < rate;
        })
        .slice(0, 6);

      const unpaidVendorIds  = unpaidList.map(v => v.user_id);
      const { data: unpaidProfiles } = await supabase
        .from("profiles").select("user_id, first_name, last_name").in("user_id", unpaidVendorIds);

      const unpaidDetails = unpaidList.map(v => {
        const pr   = unpaidProfiles?.find(p => p.user_id === v.user_id);
        const st   = v.stalls as any;
        const rate = st?.monthly_rate || 1450;
        const paid = monthPaidByVendor[v.id] || 0;
        return {
          name:      pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
          stall:     st?.stall_number || "—",
          section:   st?.section || "General",
          remaining: Math.max(0, rate - paid),
          isPartial: paid > 0,
        };
      });

      return {
        totalCollected:   completed.reduce((s, p) => s + Number(p.amount), 0),
        totalToday:       todayPay.reduce((s, p) => s + Number(p.amount), 0),
        txToday:          todayPay.length,
        totalVendors:     vendors.length,
        totalStalls:      stalls.length,
        occupiedStalls:   stalls.filter(s => s.status === "occupied").length,
        pendingCount,
        paidVendors, partialVendors, unpaidVendors,
        recentTx, monthlyData, methodData, unpaidDetails,
        currentMonth, currentYear,
      };
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const d = data!;
  const collectionRate = d.totalVendors > 0 ? Math.round(d.paidVendors / d.totalVendors * 100) : 0;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <CalendarDays className="h-3.5 w-3.5" />
            {new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {d.pendingCount > 0 ? (
          <Link to="/admin/payments">
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 transition-colors">
              <Clock className="h-4 w-4" />
              <span><strong>{d.pendingCount}</strong> pending payment{d.pendingCount > 1 ? "s" : ""}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            <span>All payments up to date</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Collections",  value: fmt(d.totalCollected),  sub: "all time",                    icon: DollarSign, color: "text-success",  bg: "bg-success/10" },
          { label: "Today's Collection", value: fmt(d.totalToday),      sub: `${d.txToday} transactions`,   icon: Activity,   color: "text-blue-600", bg: "bg-blue-50"    },
          { label: "Active Vendors",     value: String(d.totalVendors), sub: "registered vendors",          icon: Users,      color: "text-foreground",bg: "bg-secondary"  },
          { label: "Stall Occupancy",    value: `${d.occupiedStalls}/${d.totalStalls}`, sub: `${d.totalStalls > 0 ? Math.round(d.occupiedStalls/d.totalStalls*100) : 0}% occupied`, icon: Store, color: d.occupiedStalls === d.totalStalls ? "text-success" : "text-blue-600", bg: d.occupiedStalls === d.totalStalls ? "bg-success/10" : "bg-blue-50" },
        ].map((c, i) => (
          <motion.div key={c.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
            </div>
            <p className={`font-mono text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions — moved up directly below KPIs */}
      <div className="rounded-2xl border bg-card p-4 shadow-civic">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Manage Users",  to: "/admin/users",    icon: Users,      desc: "Add or edit accounts" },
            { label: "View Payments", to: "/admin/payments", icon: CreditCard, desc: "All payment records"  },
            { label: "QR Codes",      to: "/admin/qr-codes", icon: Store,      desc: "Manage stall QRs"     },
            { label: "Reports",       to: "/admin/reports",  icon: TrendingUp, desc: "Analytics & exports"  },
          ].map(a => (
            <Link key={a.to} to={a.to}
              className="flex items-center gap-3 rounded-xl border bg-secondary/30 p-3 hover:bg-blue-50 hover:border-blue-200 hover:-translate-y-0.5 transition-all">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <a.icon className="h-4 w-4 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground leading-tight">{a.label}</p>
                <p className="text-xs text-muted-foreground truncate">{a.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Vendor Payment Rate Banner */}
      <div className="rounded-2xl border bg-card p-5 shadow-civic">
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-foreground">Vendor Payment Rate — {MONTHS_FULL[d.currentMonth - 1]} {d.currentYear}</h3>
            </div>
            <p className="text-xs text-muted-foreground">{d.paidVendors} of {d.totalVendors} vendors paid in full</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {[
              { label: "Paid",    count: d.paidVendors,    color: "bg-success"  },
              { label: "Partial", count: d.partialVendors, color: "bg-blue-500" },
              { label: "Unpaid",  count: d.unpaidVendors,  color: "bg-accent"   },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                <span className="text-muted-foreground text-xs">{s.label}</span>
                <span className="font-bold text-foreground">{s.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
          {(() => {
            const total = d.totalVendors || 1;
            return (<>
              <div className="h-full bg-success transition-all" style={{ width: `${d.paidVendors/total*100}%` }} />
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${d.partialVendors/total*100}%` }} />
              <div className="h-full bg-accent transition-all"   style={{ width: `${d.unpaidVendors/total*100}%` }} />
            </>);
          })()}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">{collectionRate}% collection rate this month</p>
          <span className={`text-xs font-semibold ${collectionRate >= 80 ? "text-success" : collectionRate >= 50 ? "text-blue-600" : "text-accent"}`}>
            {collectionRate >= 80 ? "On Track" : collectionRate >= 50 ? "Moderate" : "Needs Attention"}
          </span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-2xl border bg-card p-5 shadow-civic">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Monthly Collections — {d.currentYear}</h3>
              <p className="text-xs text-muted-foreground">{fmt(d.totalCollected)} collected this year</p>
            </div>
            <BarChart2 className="h-4 w-4 text-blue-600" />
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={d.monthlyData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={48} />
              <Tooltip formatter={(v: number) => [fmt(v), "Collected"]}
                contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }} />
              <Bar dataKey="amount" fill="#2563eb" radius={[6,6,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-civic">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">By Method</h3>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </div>
          {d.methodData.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">No data yet</p>
          ) : (
            <>
              {/* Desktop pie */}
              <div className="hidden sm:block">
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={d.methodData} dataKey="amount" nameKey="method"
                      cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                      {d.methodData.map((_: any, i: number) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => fmt(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Mobile stacked bar */}
              <div className="sm:hidden mb-4">
                <p className="text-xs text-muted-foreground mb-2">Payment breakdown</p>
                <div className="h-5 w-full rounded-full overflow-hidden flex">
                  {(() => {
                    const total = d.methodData.reduce((s: number, m: any) => s + m.amount, 0) || 1;
                    return d.methodData.map((m: any, i: number) => (
                      <div key={m.method} style={{ width: `${m.amount/total*100}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    ));
                  })()}
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {d.methodData.map((m: any, i: number) => (
                  <div key={m.method} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{m.method}</span>
                    </span>
                    <span className="font-mono font-medium text-foreground">{fmt(m.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom row — Unpaid first on mobile via order */}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">

        {/* Unpaid vendors — order-first forces it above recent tx on mobile */}
        <div className="rounded-2xl border bg-card shadow-civic order-first lg:order-none">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-foreground">Unpaid This Month</h3>
            </div>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
              {d.unpaidVendors + d.partialVendors}
            </span>
          </div>
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {d.unpaidDetails.map((v: any, i: number) => (
              <div key={i} className="flex items-start justify-between px-5 py-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-start gap-2.5">
                  <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${v.isPartial ? "bg-blue-50" : "bg-accent/10"}`}>
                    <AlertCircle className={`h-3.5 w-3.5 ${v.isPartial ? "text-blue-600" : "text-accent"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">Stall {v.stall} · {v.section}</p>
                    {v.isPartial && <span className="text-xs text-blue-600">Partially paid</span>}
                  </div>
                </div>
                <p className={`font-mono text-sm font-bold shrink-0 ${v.isPartial ? "text-blue-600" : "text-accent"}`}>
                  {fmt(v.remaining)}
                </p>
              </div>
            ))}
            {d.unpaidDetails.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle2 className="h-8 w-8 text-success opacity-60" />
                <p className="text-sm font-medium text-success">All vendors paid this month!</p>
              </div>
            )}
          </div>
          {(d.unpaidVendors + d.partialVendors) > 6 && (
            <div className="border-t px-5 py-3">
              <p className="text-xs text-center text-muted-foreground">
                +{(d.unpaidVendors + d.partialVendors) - 6} more vendors with outstanding balance
              </p>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="rounded-2xl border bg-card shadow-civic">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h3 className="font-semibold text-foreground">Recent Transactions</h3>
            <Link to="/admin/payments">
              <Button variant="ghost" size="sm" className="text-blue-600 h-7 text-xs gap-1">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="divide-y">
            {d.recentTx.map((t: any) => {
              const methodCfg = METHOD_CONFIG[t.payment_method] || { icon: CreditCard, color: "bg-muted", label: t.payment_method };
              const MethodIcon = methodCfg.icon;
              return (
                <div key={t.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    t.status === "completed" ? "bg-success/10" :
                    t.status === "pending"   ? "bg-amber-100"  : "bg-accent/10"
                  }`}>
                    {t.status === "completed"
                      ? <CheckCircle2 className="h-4 w-4 text-success" />
                      : t.status === "pending"
                      ? <Clock className="h-4 w-4 text-amber-600" />
                      : <AlertCircle className="h-4 w-4 text-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.vendor_name}</p>
                    <p className="text-xs text-muted-foreground">Stall {t.stall} · {t.section}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <div className={`flex h-5 w-5 items-center justify-center rounded ${methodCfg.color}`}>
                      <MethodIcon className="h-3 w-3 text-white" />
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-foreground">{fmt(Number(t.amount))}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            {d.recentTx.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <CreditCard className="h-8 w-8 opacity-20" />
                <p className="text-sm">No transactions yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminDashboardHome;
