import { DollarSign, Users, Clock, CheckCircle2, Loader2, CreditCard, Search, FileText, TrendingUp, AlertCircle, ArrowRight, Banknote, Smartphone, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fmt    = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const CashierDashboardHome = () => {
  const [showMonthly, setShowMonthly] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cashier-dashboard"],
    refetchInterval: 15000,
    queryFn: async () => {
      const now        = new Date();
      const todayStr   = now.toISOString().split("T")[0];
      const yearStart  = `${now.getFullYear()}-01-01T00:00:00`;
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 6);

      const { data: allPayments } = await supabase
        .from("payments")
        .select("*")
        .gte("created_at", yearStart)
        .order("created_at", { ascending: false });

      const payments  = allPayments || [];
      const completed = payments.filter(p => p.status === "completed");
      const pending   = payments.filter(p => p.status === "pending");

      const todayPay   = completed.filter(p => p.created_at?.startsWith(todayStr));
      const totalToday = todayPay.reduce((s, p) => s + Number(p.amount), 0);

      const weekPay   = completed.filter(p => new Date(p.created_at) >= weekStart);
      const totalWeek = weekPay.reduce((s, p) => s + Number(p.amount), 0);

      const monthPay   = completed.filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const totalMonth = monthPay.reduce((s, p) => s + Number(p.amount), 0);

      const weekChart: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        weekChart[d.toISOString().split("T")[0]] = 0;
      }
      weekPay.forEach(p => {
        const k = p.created_at?.split("T")[0];
        if (k && weekChart[k] !== undefined) weekChart[k] += Number(p.amount);
      });
      const chartData = Object.entries(weekChart).map(([date, amount]) => ({
        day: DAYS[new Date(date).getDay()], date, amount,
      }));

      const monthlyMap: Record<number, number> = {};
      MONTHS.forEach((_, i) => { monthlyMap[i] = 0; });
      completed.forEach(p => {
        const m = new Date(p.created_at).getMonth();
        monthlyMap[m] = (monthlyMap[m] || 0) + Number(p.amount);
      });
      const monthlyData = MONTHS.map((m, i) => ({ month: m, amount: monthlyMap[i] }));

      const methodBreakdown: Record<string, number> = {};
      todayPay.forEach(p => {
        methodBreakdown[p.payment_method] = (methodBreakdown[p.payment_method] || 0) + Number(p.amount);
      });

      const recent8 = payments.slice(0, 8);
      let recentList: any[] = [];
      if (recent8.length) {
        const vendorIds = [...new Set(recent8.map(p => p.vendor_id))];
        const { data: vendors } = await supabase
          .from("vendors").select("id, user_id, stalls(stall_number, section)").in("id", vendorIds);
        const userIds = vendors?.map(v => v.user_id) || [];
        const { data: profiles } = await supabase
          .from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
        recentList = recent8.map(p => {
          const v  = vendors?.find(v => v.id === p.vendor_id);
          const pr = profiles?.find(pr => pr.user_id === v?.user_id);
          const st = v?.stalls as any;
          return { ...p, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number || "—", section: st?.section || "" };
        });
      }

      const { data: allVendors } = await supabase.from("vendors").select("id, stalls(monthly_rate)");
      const totalVendors  = allVendors?.length || 0;
      const paidVendorIds = new Set(monthPay.map(p => p.vendor_id));
      const paidVendors   = paidVendorIds.size;

      return {
        totalToday, txToday: todayPay.length,
        totalWeek,  txWeek:  weekPay.length,
        totalMonth, txMonth: monthPay.length,
        pendingCount: pending.length,
        chartData, monthlyData, methodBreakdown,
        recentList, totalVendors, paidVendors,
      };
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const d = data!;
  const today = new Date();
  const methodTotal = Object.values(d.methodBreakdown).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cashier Terminal</h1>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {d.pendingCount > 0 && (
          <Link to="/cashier/accept">
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100 transition-colors">
              <Clock className="h-4 w-4" />
              <span><strong>{d.pendingCount}</strong> pending {d.pendingCount > 1 ? "payments" : "payment"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Today's Collection", value: fmt(d.totalToday), sub: `${d.txToday} transaction${d.txToday !== 1 ? "s" : ""}`, icon: DollarSign, color: "text-success",  bg: "bg-success/10" },
          { label: "This Week",          value: fmt(d.totalWeek),  sub: `${d.txWeek} transactions`,                               icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "This Month",         value: fmt(d.totalMonth), sub: `${d.txMonth} transactions`,                               icon: CreditCard, color: "text-foreground",bg: "bg-secondary"  },
          { label: "Vendors Paid",       value: `${d.paidVendors}/${d.totalVendors}`, sub: "this month",                         icon: Users,      color: d.paidVendors === d.totalVendors ? "text-success" : "text-accent", bg: d.paidVendors === d.totalVendors ? "bg-success/10" : "bg-accent/10" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-3">
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

      {/* Today's Method Breakdown — compact inline, above quick actions */}
      {Object.keys(d.methodBreakdown).length > 0 && (
        <div className="rounded-2xl border bg-card p-4 shadow-civic">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Today by Payment Method</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(d.methodBreakdown).map(([method, amount]) => {
              const pct  = methodTotal > 0 ? (amount / methodTotal * 100) : 0;
              const Icon = method === "cash" ? Banknote : Smartphone;
              const colorMap: Record<string, string> = { cash: "bg-slate-500", gcash: "bg-blue-500", paymaya: "bg-green-600", instapay: "bg-emerald-700" };
              const color = colorMap[method] || "bg-emerald-600";
              const label = method === "paymaya" ? "Maya" : method.charAt(0).toUpperCase() + method.slice(1);
              return (
                <div key={method} className="flex items-center gap-2 rounded-xl border bg-secondary/40 px-3 py-2 flex-1 min-w-[120px]">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label} · {pct.toFixed(0)}%</p>
                    <p className="font-mono text-sm font-bold text-foreground truncate">{fmt(amount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accept Payment — primary full-width */}
      <Link to="/cashier/accept"
        className="flex items-center justify-center gap-3 rounded-2xl bg-primary border border-primary text-primary-foreground p-4 hover:bg-primary/90 hover:-translate-y-0.5 transition-all shadow-civic">
        <CreditCard className="h-5 w-5" />
        <span className="text-base font-semibold">Accept Payment</span>
        <ArrowRight className="h-4 w-4 ml-auto" />
      </Link>

      {/* Other Quick Actions — compact 3-col row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Search Vendor",  to: "/cashier/search", icon: Search   },
          { label: "Payment Status", to: "/cashier/status", icon: Clock    },
          { label: "Print SOA",      to: "/cashier/soa",    icon: FileText },
        ].map(a => (
          <Link key={a.to} to={a.to}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-3 hover:bg-emerald-50 hover:border-emerald-200 hover:-translate-y-0.5 transition-all shadow-civic text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50">
              <a.icon className="h-4 w-4 text-emerald-700" />
            </div>
            <span className="text-xs font-semibold text-foreground leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Primary: 7-day chart */}
      <div className="rounded-2xl border bg-card p-5 shadow-civic">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Collections — Last 7 Days</h3>
            <p className="text-xs text-muted-foreground">{fmt(d.totalWeek)} this week</p>
          </div>
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        </div>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={d.chartData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={45} />
            <Tooltip formatter={(v: number) => [fmt(v), "Collected"]}
              contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }} />
            <Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary: monthly chart — collapsible on mobile */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <button
          onClick={() => setShowMonthly(v => !v)}
          className="flex items-center justify-between w-full px-5 py-3.5 hover:bg-secondary/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <span className="font-semibold text-foreground text-sm">Monthly Collections — {today.getFullYear()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{fmt(d.totalMonth)} this month</span>
            {showMonthly ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>
        {showMonthly && (
          <div className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={d.monthlyData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={45} />
                <Tooltip formatter={(v: number) => [fmt(v), "Collected"]}
                  contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }} />
                <Bar dataKey="amount" fill="#1a3a2e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl border bg-card shadow-civic">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <h3 className="font-semibold text-foreground">Recent Transactions</h3>
          <Link to="/cashier/status">
            <Button variant="ghost" size="sm" className="text-emerald-700 h-7 text-xs gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="divide-y">
          {d.recentList.map((r: any) => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                r.status === "completed" ? "bg-success/10" :
                r.status === "pending"   ? "bg-amber-100"  : "bg-accent/10"
              }`}>
                {r.status === "completed"
                  ? <CheckCircle2 className="h-4 w-4 text-success" />
                  : r.status === "pending"
                  ? <Clock className="h-4 w-4 text-amber-600" />
                  : <AlertCircle className="h-4 w-4 text-accent" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{r.vendor_name}</p>
                <p className="text-xs text-muted-foreground">
                  Stall {r.stall} · {r.section} · <span className="capitalize">{r.payment_method}</span>
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-sm font-bold text-foreground">{fmt(Number(r.amount))}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          {d.recentList.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
              <CreditCard className="h-8 w-8 opacity-30" />
              <p className="text-sm">No transactions yet today</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default CashierDashboardHome;
