import { useState, useMemo } from "react";
import {
  CheckCircle2, AlertCircle, Clock, Loader2, Search, Filter,
  Smartphone, Building2, Banknote, CreditCard, X, RefreshCw,
  TrendingUp, Activity,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_CONFIG: Record<string, { icon: any; label: string; pillClass: string; dotColor: string }> = {
  completed: { icon: CheckCircle2, label: "Completed", pillClass: "pill-success",  dotColor: "#10b981" },
  pending:   { icon: Clock,        label: "Pending",   pillClass: "pill-warning",  dotColor: "#f59e0b" },
  failed:    { icon: AlertCircle,  label: "Failed",    pillClass: "pill-danger",   dotColor: "#ef4444" },
  overdue:   { icon: AlertCircle,  label: "Overdue",   pillClass: "pill-danger",   dotColor: "#dc2626" },
};

const METHOD_CONFIG: Record<string, { icon: any; bg: string; label: string }> = {
  gcash:    { icon: Smartphone, bg: "#3b82f6", label: "GCash"    },
  paymaya:  { icon: Smartphone, bg: "#10b981", label: "Maya"     },
  instapay: { icon: Building2,  bg: "#0f6e56", label: "InstaPay" },
  cash:     { icon: Banknote,   bg: "#64748b", label: "Cash"     },
};

const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const CashierPaymentStatus = () => {
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [dateFrom, setDateFrom]       = useState("");
  const [dateTo, setDateTo]           = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ["cashier-payment-status"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data: paymentsList } = await supabase
        .from("payments").select("*").order("created_at", { ascending: false }).limit(200);
      if (!paymentsList?.length) return [];
      const vendorIds = [...new Set(paymentsList.map(p => p.vendor_id))];
      const { data: vendors } = await supabase.from("vendors")
        .select("id, user_id, stalls(stall_number, section)").in("id", vendorIds);
      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase.from("profiles")
        .select("user_id, first_name, last_name, contact_number").in("user_id", userIds);
      return paymentsList.map(p => {
        const vendor  = vendors?.find(v => v.id === p.vendor_id);
        const profile = profiles?.find(pr => pr.user_id === vendor?.user_id);
        const stall   = vendor?.stalls as any;
        return {
          ...p,
          vendor_name:  profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
          contact:      profile?.contact_number || "—",
          stall_number: stall?.stall_number || "—",
          section:      stall?.section || "General",
        };
      });
    },
  });

  const filtered = useMemo(() => payments.filter((p: any) => {
    const matchSearch = !search ||
      p.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
      p.stall_number.toLowerCase().includes(search.toLowerCase()) ||
      (p.reference_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.receipt_number   || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    const matchMethod = filterMethod === "all" || p.payment_method === filterMethod;
    const payDate = p.created_at?.split("T")[0];
    return matchSearch && matchStatus && matchMethod &&
      (!dateFrom || payDate >= dateFrom) && (!dateTo || payDate <= dateTo);
  }), [payments, search, filterStatus, filterMethod, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const todayPay = payments.filter((p: any) => p.created_at?.startsWith(today) && p.status === "completed");
    return {
      totalToday:    todayPay.reduce((s: number, p: any) => s + Number(p.amount), 0),
      countToday:    todayPay.length,
      countPending:  payments.filter((p: any) => p.status === "pending").length,
      countFailed:   payments.filter((p: any) => p.status === "failed").length,
      totalFiltered: filtered.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.amount), 0),
    };
  }, [payments, filtered, today]);

  const hasActiveFilters = filterStatus !== "all" || filterMethod !== "all" || dateFrom || dateTo;
  const clearFilters = () => { setFilterStatus("all"); setFilterMethod("all"); setDateFrom(""); setDateTo(""); setSearch(""); };

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-10 w-10 rounded-full bg-cashier-hero flex items-center justify-center shadow-hero">
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
      <p className="text-sm text-muted-foreground">Loading transactions…</p>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* ── Executive Header Banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 12px 32px rgba(15,110,86,0.12)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Cashier Terminal</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-100">Transaction Status</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Payment Status Directory</h1>
            <p className="text-xs text-white/70 mt-0.5">Monitor and track all vendor payment transactions</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="h-9 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 transition-colors border text-xs px-3.5 font-semibold">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh Log
          </Button>
        </div>
      </div>

      {/* ── 4 Top KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Today's Collection", value: fmt(stats.totalToday), sub: `${stats.countToday} transactions`, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30", icon: TrendingUp },
          { label: "Pending",            value: String(stats.countPending),       sub: "awaiting confirmation",          iconBg: "bg-amber-100",   iconColor: "#f59e0b", glow: "#f59e0b", gradient: "from-amber-50 to-amber-50/30",   icon: Clock       },
          { label: "Failed",             value: String(stats.countFailed),        sub: "this period",                   iconBg: "bg-rose-100",     iconColor: "#f43f5e", glow: "#f43f5e", gradient: "from-rose-50 to-rose-50/30",       icon: AlertCircle },
          { label: "Filtered Total",     value: fmt(stats.totalFiltered),         sub: `${filtered.length} records shown`, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/30",    icon: Activity    },
        ].map(c => (
          <div key={c.label}
               className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-3.5 hover:shadow-sm transition-all duration-300 group`}>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-xs ${c.iconBg}`}>
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

      {/* ── Search + Filter bar ───────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendor, stall, or reference…"
              className="h-9 pl-9 rounded-xl border bg-background text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className={`h-9 gap-1.5 rounded-xl text-xs ${showFilters ? "border-emerald-300 text-emerald-700 bg-emerald-50" : ""}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-[9px] text-white font-bold">
                {[filterStatus !== "all", filterMethod !== "all", !!dateFrom, !!dateTo].filter(Boolean).length}
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" className="h-9 gap-1.5 text-muted-foreground rounded-xl text-xs" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="rounded-2xl border bg-card p-3.5 shadow-xs">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                <select className="h-8 w-full rounded-xl border bg-background px-3 text-xs" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Method</label>
                <select className="h-8 w-full rounded-xl border bg-background px-3 text-xs" value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
                  <option value="all">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="paymaya">Maya</option>
                  <option value="instapay">InstaPay</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Date From</label>
                <Input type="date" className="h-8 rounded-xl text-xs" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={today} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Date To</label>
                <Input type="date" className="h-8 rounded-xl text-xs" value={dateTo} onChange={e => setDateTo(e.target.value)} max={today} />
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <p className="text-[10px] text-muted-foreground self-center">Quick:</p>
              {[
                { label: "Today",      from: today, to: today },
                { label: "This Week",  from: new Date(Date.now() - 6*86400000).toISOString().split("T")[0], to: today },
                { label: "This Month", from: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`, to: today },
              ].map(s => (
                <button key={s.label} onClick={() => { setDateFrom(s.from); setDateTo(s.to); }}
                  className={`rounded-lg border px-2.5 py-0.5 text-[11px] transition-colors ${
                    dateFrom === s.from && dateTo === s.to
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700 font-semibold"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Result count ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs">
        <p className="text-muted-foreground">
          Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
          <strong className="text-foreground">{payments.length}</strong> transactions
          {dateFrom && dateTo && ` · ${new Date(dateFrom).toLocaleDateString("en-PH")} – ${new Date(dateTo).toLocaleDateString("en-PH")}`}
        </p>
      </div>

      {/* ── Transaction table ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)" }}>
                {["Vendor","Stall","Period","Amount","Method","Type","Reference No.","Status","Date & Time"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-emerald-100 text-[11px] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p: any) => {
                const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                const methodCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, bg: "#6b7280", label: p.payment_method };
                const StatusIcon = statusCfg.icon;
                const MethodIcon = methodCfg.icon;
                return (
                  <tr key={p.id} className="hover:bg-emerald-50/40 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-foreground">{p.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">{p.contact}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono font-semibold text-foreground">{p.stall_number}</p>
                      <p className="text-xs text-muted-foreground">{p.section}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-mono font-bold text-foreground">₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: methodCfg.bg }}>
                          <MethodIcon className="h-3 w-3 text-white" />
                        </span>
                        <span className="text-xs text-muted-foreground">{methodCfg.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        p.payment_type === "staggered"
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}>
                        {p.payment_type === "staggered" ? "Partial" : "Full"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-foreground bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        {p.reference_number || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusCfg.pillClass}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: statusCfg.dotColor }} />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      <p>{new Date(p.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</p>
                      <p className="text-muted-foreground/60">{new Date(p.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</p>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                        <Search className="h-7 w-7 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-semibold">No payments found</p>
                        <p className="text-xs mt-0.5">Try adjusting your filters or search term</p>
                      </div>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="text-xs text-emerald-700 hover:underline font-medium">
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Footer summary ────────────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border bg-slate-50 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {filtered.filter((p: any) => p.status === "completed").length} completed
            </span>
            <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {filtered.filter((p: any) => p.status === "pending").length} pending
            </span>
            <span className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              {filtered.filter((p: any) => p.status === "failed").length} failed
            </span>
          </div>
          <p className="font-mono font-bold text-foreground text-sm">
            Total: <span className="text-emerald-700">{fmt(stats.totalFiltered)}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default CashierPaymentStatus;