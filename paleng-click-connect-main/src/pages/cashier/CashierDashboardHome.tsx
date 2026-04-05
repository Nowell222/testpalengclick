import {
  DollarSign, Users, Clock, CheckCircle2, Loader2, CreditCard, Search,
  FileText, TrendingUp, AlertCircle, ArrowRight, Banknote, Smartphone,
  ChevronDown, ChevronUp, Building2, Receipt, Send, BarChart2, Shield,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar,
} from "recharts";
import { useState } from "react";

const C = {
  primary:    "#1E4DB7",
  primaryDk:  "#163A8F",
  primaryLt:  "#3A6FE2",
  primaryPale:"#EBF0FB",
  primaryMid: "#C7D6F5",
  gold:       "#B45309",
  goldPale:   "#FEF3C7",
  success:    "#0F7B52",
  successPale:"#E8F7F2",
  amber:      "#B45309",
  amberPale:  "#FEF3C7",
  text:       "#0F1F4B",
  textMid:    "#4A5679",
  textLight:  "#8895B3",
  border:     "#D6E0F5",
  bg:         "#F3F6FB",
  card:       "#FFFFFF",
  red:        "#C0392B",
  redPale:    "#FEECEB",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const fmt    = (n: number) => `\u20B1${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{
    fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const,
    color: C.textLight, marginBottom: 10,
  }}>{children}</div>
);

const KpiCard = ({ label, value, sub, icon: Icon, accent, accentPale }: {
  label: string; value: string; sub: string;
  icon: React.ElementType; accent: string; accentPale: string;
}) => (
  <div style={{
    background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
    padding: "16px 18px",
    boxShadow: "0 2px 8px rgba(30,77,183,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    position: "relative" as const, overflow: "hidden",
  }}>
    <div style={{
      position: "absolute" as const, left: 0, top: 0, bottom: 0,
      width: 4, borderRadius: "14px 0 0 14px", background: accent,
    }} />
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
      <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: C.textLight }}>
        {label}
      </p>
      <div style={{
        width: 32, height: 32, borderRadius: 9, background: accentPale, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={15} color={accent} />
      </div>
    </div>
    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 19, fontWeight: 700, color: C.text, marginBottom: 4 }}>
      {value}
    </p>
    <span style={{ fontSize: 11, color: C.textLight }}>{sub}</span>
  </div>
);

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
        .from("payments").select("*").gte("created_at", yearStart).order("created_at", { ascending: false });

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
        totalToday, txToday: todayPay.length, totalWeek, txWeek: weekPay.length,
        totalMonth, txMonth: monthPay.length, pendingCount: pending.length,
        chartData, monthlyData, methodBreakdown, recentList, totalVendors, paidVendors,
      };
    },
  });

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 320, flexDirection: "column" as const, gap: 12 }}>
      <Loader2 size={28} color={C.primary} style={{ animation: "spin 1s linear infinite" }} />
      <p style={{ fontSize: 12, color: C.textLight, letterSpacing: 1 }}>Loading Treasury Data...</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  const d = data!;
  const today = new Date();
  const methodTotal = Object.values(d.methodBreakdown).reduce((s, v) => s + v, 0);
  const paidPct = d.totalVendors > 0 ? Math.round(d.paidVendors / d.totalVendors * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column" as const, gap: 20, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <style>{`
        .c-fade{animation:fadeUp 0.35s ease both}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        .c-tile:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(30,77,183,0.15)!important}
        .c-tile{transition:transform 0.15s,box-shadow 0.15s;text-decoration:none!important}
        .c-primary:hover{background:${C.primaryLt}!important;transform:translateY(-2px);box-shadow:0 10px 28px rgba(30,77,183,0.3)!important}
        .c-primary{transition:all 0.15s;text-decoration:none!important}
        .c-txrow:hover{background:${C.primaryPale}!important}
        .c-txrow{transition:background 0.12s}
        .c-viewall{text-decoration:none!important;display:flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;color:${C.primary}}
        .c-btn:hover{background:${C.primaryPale}!important}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
      `}</style>

      {/* Header */}
      <div className="c-fade" style={{
        background: `linear-gradient(135deg, ${C.primaryDk} 0%, ${C.primary} 55%, ${C.primaryLt} 100%)`,
        borderRadius: 16, padding: "20px 22px",
        boxShadow: `0 4px 20px rgba(30,77,183,0.25)`,
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 12,
      }}>
        <div>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(255,255,255,0.15)", borderRadius: 7, padding: "4px 10px",
            fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.85)",
            textTransform: "uppercase" as const, marginBottom: 6,
          }}>
            <Shield size={9} /> Municipal Treasury Office
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0, letterSpacing: -0.3 }}>
            Cashier Terminal
          </h1>
          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 3, marginBottom: 0 }}>
            {today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {d.pendingCount > 0 && (
            <Link to="/cashier/accept" style={{ textDecoration: "none" }}>
              <div style={{
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 10, padding: "8px 14px",
                display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
              }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FBBF24", boxShadow: "0 0 6px #FBBF24" }} />
                <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{d.pendingCount} Pending</span>
                <ArrowRight size={13} color="rgba(255,255,255,0.7)" />
              </div>
            </Link>
          )}
          <div style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ADE80", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        <KpiCard label="Today's Collection" value={fmt(d.totalToday)}
          sub={`${d.txToday} transaction${d.txToday !== 1 ? "s" : ""}`}
          icon={DollarSign} accent={C.primary} accentPale={C.primaryPale} />
        <KpiCard label="This Week" value={fmt(d.totalWeek)}
          sub={`${d.txWeek} transactions`}
          icon={TrendingUp} accent={C.primaryLt} accentPale={C.primaryPale} />
        <KpiCard label="This Month" value={fmt(d.totalMonth)}
          sub={`${d.txMonth} transactions`}
          icon={CreditCard} accent={C.gold} accentPale={C.goldPale} />
        <KpiCard label="Vendors Paid" value={`${d.paidVendors}/${d.totalVendors}`}
          sub={`${paidPct}% compliance this month`}
          icon={Users}
          accent={d.paidVendors === d.totalVendors ? C.success : C.amber}
          accentPale={d.paidVendors === d.totalVendors ? C.successPale : C.amberPale} />
      </div>

      {/* Payment Method Breakdown */}
      {Object.keys(d.methodBreakdown).length > 0 && (
        <div style={{
          background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
          padding: "16px 18px", boxShadow: "0 2px 8px rgba(30,77,183,0.06)",
        }}>
          <SectionLabel>Today by Payment Method</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 10 }}>
            {Object.entries(d.methodBreakdown).map(([method, amount]) => {
              const pct  = methodTotal > 0 ? (amount / methodTotal * 100) : 0;
              const Icon = method === "cash" ? Banknote : method === "instapay" ? Building2 : Smartphone;
              const colorMap: Record<string, string> = {
                cash: "#475569", gcash: C.primary, paymaya: "#059669", instapay: "#7C3AED",
              };
              const bg = colorMap[method] || C.primary;
              const label = method === "paymaya" ? "Maya" : method === "instapay" ? "InstaPay" : method.charAt(0).toUpperCase() + method.slice(1);
              return (
                <div key={method} style={{
                  flex: "1 1 130px", display: "flex", alignItems: "center", gap: 10,
                  background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 13px",
                }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: bg, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} color="#fff" />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, color: C.textLight, marginBottom: 2 }}>{label} · {pct.toFixed(0)}%</p>
                    <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13.5, fontWeight: 700, color: C.text }}>{fmt(amount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRIMARY ACTION */}
      <Link to="/cashier/accept" className="c-primary" style={{
        display: "flex", alignItems: "center", gap: 14,
        background: `linear-gradient(135deg, ${C.primaryDk} 0%, ${C.primary} 100%)`,
        borderRadius: 16, padding: "18px 22px",
        boxShadow: `0 6px 20px rgba(30,77,183,0.25)`,
      }}>
        <div style={{
          width: 50, height: 50, borderRadius: 14, flexShrink: 0,
          background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <CreditCard size={24} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", margin: 0 }}>Accept Vendor Payment</p>
          <p style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
            Process stall fees · Cash · GCash · InstaPay
          </p>
        </div>
        <div style={{
          width: 38, height: 38, borderRadius: 11, flexShrink: 0,
          background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ArrowRight size={18} color="#fff" />
        </div>
      </Link>

      {/* Quick Actions */}
      <div>
        <SectionLabel>Quick Actions</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Search Vendor",  desc: "Find by name/stall",    to: "/cashier/search",  icon: Search,   accent: C.primary,  pale: C.primaryPale },
            { label: "Payment Status", desc: "Verify payments",        to: "/cashier/status",  icon: Receipt,  accent: "#7C3AED",  pale: "#F5F0FF" },
            { label: "Print SOA",      desc: "Statement of account",   to: "/cashier/soa",     icon: FileText, accent: C.success,  pale: C.successPale },
            { label: "SMS Reminders",  desc: "Send payment alerts",    to: "/cashier/sms",     icon: Send,     accent: C.gold,     pale: C.goldPale },
            { label: "Reports",        desc: "Analytics & export",     to: "/cashier/reports", icon: BarChart2,accent: "#0E7490",  pale: "#E0F9FF" },
          ].map(a => (
            <Link key={a.to} to={a.to} className="c-tile" style={{
              display: "flex", flexDirection: "column" as const, alignItems: "center",
              background: C.card, borderRadius: 13, border: `1px solid ${C.border}`,
              padding: "16px 8px", textAlign: "center" as const,
              boxShadow: "0 2px 6px rgba(30,77,183,0.05)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: a.pale, marginBottom: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <a.icon size={18} color={a.accent} />
              </div>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: C.text, margin: 0 }}>{a.label}</p>
              <p style={{ fontSize: 9.5, color: C.textLight, marginTop: 3 }}>{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Weekly Chart */}
      <div style={{
        background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
        padding: "18px 20px", boxShadow: "0 2px 8px rgba(30,77,183,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
              <TrendingUp size={14} color={C.primary} />
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>Weekly Collections</p>
            </div>
            <p style={{ fontSize: 11, color: C.textLight }}>Last 7 days · {fmt(d.totalWeek)} total</p>
          </div>
          <div style={{
            background: C.primaryPale, border: `1px solid ${C.primaryMid}`, borderRadius: 8,
            padding: "4px 10px", fontSize: 10, fontWeight: 700, color: C.primary,
          }}>7 Days</div>
        </div>
        <ResponsiveContainer width="100%" height={175}>
          <AreaChart data={d.chartData}>
            <defs>
              <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.primary} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={C.primary} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.textLight }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: C.textLight }} tickFormatter={v => v >= 1000 ? `\u20B1${v/1000}k` : `\u20B1${v}`} axisLine={false} tickLine={false} width={46} />
            <Tooltip formatter={(v: number) => [fmt(v), "Collected"]}
              contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12, background: C.card }} />
            <Area type="monotone" dataKey="amount" stroke={C.primary} strokeWidth={2.5} fill="url(#aGrad)"
              dot={{ fill: C.primary, strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: C.primary }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Chart collapsible */}
      <div style={{
        background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
        overflow: "hidden", boxShadow: "0 2px 8px rgba(30,77,183,0.06)",
      }}>
        <button onClick={() => setShowMonthly(v => !v)} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "16px 20px", background: "none", border: "none",
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart2 size={14} color={C.primaryLt} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              Monthly Collections — {today.getFullYear()}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: C.textLight }}>{fmt(d.totalMonth)} this month</span>
            {showMonthly ? <ChevronUp size={15} color={C.textLight} /> : <ChevronDown size={15} color={C.textLight} />}
          </div>
        </button>
        {showMonthly && (
          <div style={{ padding: "0 20px 18px" }}>
            <div style={{ height: 1, background: C.border, marginBottom: 16 }} />
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={d.monthlyData} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: C.textLight }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: C.textLight }} tickFormatter={v => v >= 1000 ? `\u20B1${v/1000}k` : `\u20B1${v}`} axisLine={false} tickLine={false} width={46} />
                <Tooltip formatter={(v: number) => [fmt(v), "Collected"]}
                  contentStyle={{ borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <Bar dataKey="amount" fill={C.primaryMid} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div style={{
        background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
        overflow: "hidden", boxShadow: "0 2px 8px rgba(30,77,183,0.06)",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: `1px solid ${C.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <Clock size={14} color={C.primary} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Recent Transactions</span>
          </div>
          <Link to="/cashier/status" className="c-viewall">
            View All <ArrowRight size={12} />
          </Link>
        </div>

        {d.recentList.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", padding: "40px 20px", gap: 10 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: C.primaryPale, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CreditCard size={20} color={C.primary} />
            </div>
            <p style={{ fontSize: 13, color: C.textLight }}>No transactions recorded today</p>
          </div>
        ) : (
          d.recentList.map((r: any, idx: number) => {
            const isCompleted = r.status === "completed";
            const isPending   = r.status === "pending";
            return (
              <div key={r.id} className="c-txrow" style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 20px",
                borderBottom: idx < d.recentList.length - 1 ? `1px solid ${C.border}` : "none",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: isCompleted ? C.successPale : isPending ? C.amberPale : C.redPale,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isCompleted ? <CheckCircle2 size={16} color={C.success} />
                    : isPending ? <Clock size={16} color={C.amber} />
                    : <AlertCircle size={16} color={C.red} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2, whiteSpace: "nowrap" as const, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.vendor_name}
                  </p>
                  <p style={{ fontSize: 10.5, color: C.textLight }}>
                    Stall {r.stall}{r.section && ` · ${r.section}`} · <span style={{ textTransform: "capitalize" as const }}>{r.payment_method}</span>
                  </p>
                </div>
                <div style={{ textAlign: "right" as const, flexShrink: 0 }}>
                  <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, fontWeight: 700, color: C.text }}>
                    {fmt(Number(r.amount))}
                  </p>
                  <p style={{ fontSize: 10, color: C.textLight, marginTop: 2 }}>
                    {new Date(r.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div style={{
                  padding: "3px 9px", borderRadius: 20, flexShrink: 0,
                  fontSize: 9.5, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5,
                  background: isCompleted ? C.successPale : isPending ? C.amberPale : C.redPale,
                  color: isCompleted ? C.success : isPending ? C.amber : C.red,
                  border: `1px solid ${isCompleted ? "#A7F3D0" : isPending ? "#FDE68A" : "#FECACA"}`,
                }}>
                  {r.status}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "4px 0 8px" }}>
        <Shield size={10} color={C.textLight} />
        <span style={{ fontSize: 9.5, color: C.textLight, letterSpacing: 1 }}>
          Municipal Treasury Office · San Juan, Batangas · Secured System
        </span>
      </div>

    </div>
  );
};

export default CashierDashboardHome;