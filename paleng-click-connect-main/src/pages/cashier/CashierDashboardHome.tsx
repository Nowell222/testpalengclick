import { DollarSign, Users, Clock, CheckCircle2, Loader2, CreditCard, Search, FileText, TrendingUp, AlertCircle, ArrowRight, Banknote, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fmt    = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const CashierDashboardHome = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cashier-dashboard"],
    refetchInterval: 15000,
    queryFn: async () => {
      const now        = new Date();
      const todayStr   = now.toISOString().split("T")[0];
      const yearStart  = `${now.getFullYear()}-01-01T00:00:00`;
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 6);

      // Fetch all payments this year
      const { data: allPayments } = await supabase
        .from("payments")
        .select("*")
        .gte("created_at", yearStart)
        .order("created_at", { ascending: false });

      const payments = allPayments || [];
      const completed = payments.filter(p => p.status === "completed");
      const pending   = payments.filter(p => p.status === "pending");

      // Today
      const todayPay   = completed.filter(p => p.created_at?.startsWith(todayStr));
      const totalToday = todayPay.reduce((s, p) => s + Number(p.amount), 0);

      // This week
      const weekPay   = completed.filter(p => new Date(p.created_at) >= weekStart);
      const totalWeek = weekPay.reduce((s, p) => s + Number(p.amount), 0);

      // This month
      const monthPay   = completed.filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const totalMonth = monthPay.reduce((s, p) => s + Number(p.amount), 0);

      // Weekly bar chart (last 7 days)
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
        day:    DAYS[new Date(date).getDay()],
        date,
        amount,
      }));

      // Monthly totals
      const monthlyMap: Record<number, number> = {};
      MONTHS.forEach((_, i) => { monthlyMap[i] = 0; });
      completed.forEach(p => {
        const m = new Date(p.created_at).getMonth();
        monthlyMap[m] = (monthlyMap[m] || 0) + Number(p.amount);
      });
      const monthlyData = MONTHS.map((m, i) => ({ month: m, amount: monthlyMap[i] }));

      // Method breakdown today
      const methodBreakdown: Record<string, number> = {};
      todayPay.forEach(p => {
        methodBreakdown[p.payment_method] = (methodBreakdown[p.payment_method] || 0) + Number(p.amount);
      });

      // Recent 8 payments with vendor info
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

      // Vendor payment status this month
      const { data: allVendors } = await supabase
        .from("vendors").select("id, stalls(monthly_rate)");
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

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cashier Terminal</h1>
          <p className="text-sm text-muted-foreground">
            {today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        {d.pendingCount > 0 && (
          <Link to="/cashier/accept">
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
              <Clock className="h-4 w-4" />
              <span><strong>{d.pendingCount}</strong> pending payment{d.pendingCount > 1 ? "s" : ""} awaiting confirmation</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        )}
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: "Today's Collection",
            value: fmt(d.totalToday),
            sub:   `${d.txToday} transaction${d.txToday !== 1 ? "s" : ""}`,
            icon:  DollarSign,
            color: "text-success",
            bg:    "bg-success/10",
          },
          {
            label: "This Week",
            value: fmt(d.totalWeek),
            sub:   `${d.txWeek} transactions`,
            icon:  TrendingUp,
            color: "text-primary",
            bg:    "bg-primary/10",
          },
          {
            label: "This Month",
            value: fmt(d.totalMonth),
            sub:   `${d.txMonth} transactions`,
            icon:  CreditCard,
            color: "text-foreground",
            bg:    "bg-secondary",
          },
          {
            label: "Vendors Paid",
            value: `${d.paidVendors} / ${d.totalVendors}`,
            sub:   `this month`,
            icon:  Users,
            color: d.paidVendors === d.totalVendors ? "text-success" : "text-accent",
            bg:    d.paidVendors === d.totalVendors ? "bg-success/10" : "bg-accent/10",
          },
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

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Accept Payment",  to: "/cashier/accept",  icon: CreditCard, primary: true  },
          { label: "Search Vendor",   to: "/cashier/search",  icon: Search,     primary: false },
          { label: "Payment Status",  to: "/cashier/status",  icon: Clock,      primary: false },
          { label: "Print SOA",       to: "/cashier/soa",     icon: FileText,   primary: false },
        ].map(a => (
          <Link
            key={a.to}
            to={a.to}
            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border p-5 text-center transition-all hover:-translate-y-0.5 hover:shadow-md ${
              a.primary
                ? "bg-primary border-primary text-primary-foreground hover:bg-primary/90"
                : "bg-card hover:bg-secondary/50 text-foreground"
            }`}
          >
            <a.icon className={`h-6 w-6 ${a.primary ? "text-primary-foreground" : "text-primary"}`} />
            <span className={`text-sm font-semibold ${a.primary ? "text-primary-foreground" : "text-foreground"}`}>
              {a.label}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Weekly collections bar chart */}
        <div className="rounded-2xl border bg-card p-5 shadow-civic">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Collections — Last 7 Days</h3>
              <p className="text-xs text-muted-foreground">{fmt(d.totalWeek)} this week</p>
            </div>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.chartData} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                formatter={(v: number) => [fmt(v), "Collected"]}
                contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }}
              />
              <Bar dataKey="amount" fill="hsl(185,60%,35%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly collections line */}
        <div className="rounded-2xl border bg-card p-5 shadow-civic">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Monthly Collections — {today.getFullYear()}</h3>
              <p className="text-xs text-muted-foreground">{fmt(d.totalMonth)} this month</p>
            </div>
            <CreditCard className="h-4 w-4 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.monthlyData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={45} />
              <Tooltip
                formatter={(v: number) => [fmt(v), "Collected"]}
                contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }}
              />
              <Bar dataKey="amount" fill="hsl(215,60%,40%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom row: Today's method breakdown + Recent activity ─────────── */}
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">

        {/* Today's breakdown by method */}
        <div className="rounded-2xl border bg-card p-5 shadow-civic">
          <h3 className="font-semibold text-foreground mb-4">Today by Method</h3>
          {Object.keys(d.methodBreakdown).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
              <DollarSign className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No collections today yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(d.methodBreakdown).map(([method, amount]) => {
                const total  = Object.values(d.methodBreakdown).reduce((s, v) => s + v, 0);
                const pct    = total > 0 ? (amount / total * 100) : 0;
                const Icon   = method === "cash" ? Banknote : Smartphone;
                const color  = method === "cash" ? "bg-slate-500" : method === "gcash" ? "bg-blue-500" : method === "paymaya" ? "bg-green-600" : "bg-primary";
                const label  = method === "paymaya" ? "Maya" : method.charAt(0).toUpperCase() + method.slice(1);
                return (
                  <div key={method}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 text-sm">
                        <div className={`flex h-5 w-5 items-center justify-center rounded ${color}`}>
                          <Icon className="h-3 w-3 text-white" />
                        </div>
                        <span className="text-muted-foreground">{label}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold text-foreground">{fmt(amount)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="border-t pt-3 flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-mono font-bold text-foreground">{fmt(d.totalToday)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="rounded-2xl border bg-card shadow-civic">
          <div className="flex items-center justify-between border-b px-5 py-3.5">
            <h3 className="font-semibold text-foreground">Recent Transactions</h3>
            <Link to="/cashier/status">
              <Button variant="ghost" size="sm" className="text-primary h-7 text-xs gap-1">
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
                  <p className="font-mono text-sm font-bold text-foreground">
                    {fmt(Number(r.amount))}
                  </p>
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
    </div>
  );
};

export default CashierDashboardHome;