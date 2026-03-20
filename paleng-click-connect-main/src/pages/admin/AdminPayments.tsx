import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Filter, Loader2, CheckCircle2, Clock, AlertCircle,
  Smartphone, Building2, Banknote, CreditCard, TrendingUp,
  DollarSign, X, RefreshCw, Download, Printer,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmt    = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtK   = (n: number) => n >= 1000 ? `₱${(n/1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;

const STATUS_CONFIG: Record<string, { icon: any; badge: string; label: string }> = {
  completed: { icon: CheckCircle2, badge: "bg-success/10 text-success border-success/20",  label: "Completed" },
  pending:   { icon: Clock,        badge: "bg-amber-100 text-amber-700 border-amber-200",  label: "Pending"   },
  failed:    { icon: AlertCircle,  badge: "bg-accent/10 text-accent border-accent/20",     label: "Failed"    },
  overdue:   { icon: AlertCircle,  badge: "bg-red-100 text-red-700 border-red-200",        label: "Overdue"   },
};

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",  label: "GCash"    },
  paymaya:  { icon: Smartphone, color: "bg-green-600", label: "Maya"     },
  instapay: { icon: Building2,  color: "bg-primary",   label: "InstaPay" },
  cash:     { icon: Banknote,   color: "bg-slate-500", label: "Cash"     },
};

// ─── Print helper ──────────────────────────────────────────────────────────────
const printTable = (payments: any[], title: string, subtitle: string) => {
  const rows = payments.map(p => `
    <tr>
      <td>${new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td>
      <td>${p.name}</td>
      <td class="mono">${p.stall}</td>
      <td>${p.period_month && p.period_year ? `${MONTHS_FULL[p.period_month-1]} ${p.period_year}` : "—"}</td>
      <td class="r mono">${fmt(Number(p.amount))}</td>
      <td>${p.payment_method === "paymaya" ? "Maya" : p.payment_method}</td>
      <td>${p.payment_type === "staggered" ? "Partial" : "Full"}</td>
      <td class="mono">${p.reference_number||"—"}</td>
      <td class="mono">${p.receipt_number||"—"}</td>
      <td class="${p.status}">${p.status}</td>
    </tr>`).join("");
  const total = payments.filter(p=>p.status==="completed").reduce((s,p)=>s+Number(p.amount),0);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
  .hdr .rep{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase}
  .hdr .lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .hdr .ttl{font-size:16px;font-weight:bold;margin-top:4px}
  .hdr .sub{font-size:10px;color:#666}
  table{width:100%;border-collapse:collapse}
  thead tr{background:#111;color:#fff}
  thead th{padding:6px 8px;text-align:left;font-size:10px}
  thead th.r{text-align:right}
  tbody tr{border-bottom:1px solid #eee}
  tbody td{padding:5px 8px}
  td.r{text-align:right} td.mono{font-family:monospace;font-size:10px}
  td.completed{color:#27ae60;font-weight:bold} td.pending{color:#d97706;font-weight:bold} td.failed{color:#c0392b;font-weight:bold}
  .sum{border-top:2px solid #111;padding:10px 8px;display:flex;justify-content:space-between;font-weight:bold;font-size:13px}
  .footer{margin-top:20px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines · Municipality of San Juan, Batangas</div>
  <div class="lgu">Office of the Municipal Treasurer</div>
  <div class="ttl">${title}</div>
  <div class="sub">${subtitle} · Printed: ${new Date().toLocaleString("en-PH")}</div>
</div>
<table>
  <thead><tr>
    <th>Date</th><th>Vendor</th><th>Stall</th><th>Period</th>
    <th class="r">Amount</th><th>Method</th><th>Type</th>
    <th>Reference</th><th>Receipt</th><th>Status</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="sum"><span>Total Completed — ${payments.filter(p=>p.status==="completed").length} transactions</span><span>${fmt(total)}</span></div>
<div class="footer">PALENG-CLICK System · Computer-generated · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
};

// ─── Component ─────────────────────────────────────────────────────────────────
const AdminPayments = () => {
  const queryClient = useQueryClient();
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterType,   setFilterType]   = useState("all");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [showFilters,  setShowFilters]  = useState(false);

  const today = new Date().toISOString().split("T")[0];

  // ── Fetch all payments ───────────────────────────────────────────────────────
  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-payments"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data: paymentsList } = await supabase
        .from("payments").select("*").order("created_at", { ascending: false });
      if (!paymentsList) return [];
      const vendorIds = [...new Set(paymentsList.map(p => p.vendor_id))];
      const { data: vendors } = await supabase
        .from("vendors").select("id, user_id, stalls(stall_number, section)").in("id", vendorIds);
      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return paymentsList.map(p => {
        const v  = vendors?.find(v => v.id === p.vendor_id);
        const pr = profiles?.find(pr => pr.user_id === v?.user_id);
        const st = v?.stalls as any;
        return {
          ...p,
          name:    pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
          stall:   st?.stall_number || "—",
          section: st?.section || "General",
        };
      });
    },
  });

  // ── Confirm pending payment ──────────────────────────────────────────────────
  const confirmPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment confirmed!"); queryClient.invalidateQueries({ queryKey: ["admin-payments"] }); },
    onError:   () => toast.error("Failed to confirm payment"),
  });

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return payments.filter((p: any) => {
      const matchSearch = !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.stall.toLowerCase().includes(search.toLowerCase()) ||
        (p.reference_number || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.receipt_number   || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      const matchMethod = filterMethod === "all" || p.payment_method === filterMethod;
      const matchType   = filterType   === "all" || p.payment_type === filterType;
      const d = p.created_at?.split("T")[0];
      const matchFrom = !dateFrom || d >= dateFrom;
      const matchTo   = !dateTo   || d <= dateTo;
      return matchSearch && matchStatus && matchMethod && matchType && matchFrom && matchTo;
    });
  }, [payments, search, filterStatus, filterMethod, filterType, dateFrom, dateTo]);

  // ── Stats ────────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = payments.filter((p: any) => p.status === "completed");
    const todayPay  = completed.filter((p: any) => p.created_at?.startsWith(today));
    const monthPay  = completed.filter((p: any) => {
      const d = new Date(p.created_at);
      return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
    });
    const pending = payments.filter((p: any) => p.status === "pending").length;

    // Monthly chart
    const monthlyMap: Record<number,number> = {};
    MONTHS.forEach((_,i) => { monthlyMap[i] = 0; });
    completed.filter((p: any) => new Date(p.created_at).getFullYear() === new Date().getFullYear())
      .forEach((p: any) => { const m = new Date(p.created_at).getMonth(); monthlyMap[m] = (monthlyMap[m]||0)+Number(p.amount); });
    const monthlyChart = MONTHS.map((m,i) => ({ month: m, amount: monthlyMap[i] }));

    return {
      totalAll:   completed.reduce((s: number, p: any) => s+Number(p.amount), 0),
      totalToday: todayPay.reduce((s: number, p: any) => s+Number(p.amount), 0),
      totalMonth: monthPay.reduce((s: number, p: any) => s+Number(p.amount), 0),
      totalFiltered: filtered.filter((p: any)=>p.status==="completed").reduce((s:number,p:any)=>s+Number(p.amount),0),
      pending, monthlyChart,
    };
  }, [payments, filtered, today]);

  const hasFilters = filterStatus !== "all" || filterMethod !== "all" || filterType !== "all" || !!dateFrom || !!dateTo;
  const clearFilters = () => { setFilterStatus("all"); setFilterMethod("all"); setFilterType("all"); setDateFrom(""); setDateTo(""); setSearch(""); };

  const setQuick = (type: string) => {
    const now = new Date(); const t = now.toISOString().split("T")[0];
    if (type === "today") { setDateFrom(t); setDateTo(t); }
    if (type === "week")  { const s=new Date(now); s.setDate(now.getDate()-6); setDateFrom(s.toISOString().split("T")[0]); setDateTo(t); }
    if (type === "month") { setDateFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`); setDateTo(t); }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Management</h1>
          <p className="text-sm text-muted-foreground">View, confirm, and export all stall payment records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="outline" className="gap-2 rounded-xl"
            onClick={() => printTable(filtered, "Payment Report", `${filtered.length} records`)}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "All Time",    value: fmt(stats.totalAll),      sub: `${payments.filter((p:any)=>p.status==="completed").length} completed`, icon: DollarSign, color: "text-success",    bg: "bg-success/10"  },
          { label: "This Month",  value: fmt(stats.totalMonth),    sub: `${new Date().toLocaleString("en-PH",{month:"long"})}`,             icon: TrendingUp,  color: "text-primary",    bg: "bg-primary/10"  },
          { label: "Today",       value: fmt(stats.totalToday),    sub: "collected today",                                                   icon: CreditCard,  color: "text-foreground",  bg: "bg-secondary"   },
          { label: "Pending",     value: String(stats.pending),    sub: "awaiting confirmation",                                             icon: Clock,       color: stats.pending > 0 ? "text-amber-600" : "text-muted-foreground", bg: stats.pending > 0 ? "bg-amber-100" : "bg-secondary" },
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

      {/* Monthly chart */}
      <div className="rounded-2xl border bg-card p-5 shadow-civic">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Monthly Collections — {new Date().getFullYear()}</h3>
            <p className="text-xs text-muted-foreground">{fmt(stats.totalAll)} collected this year</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.monthlyChart} barSize={22}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46} />
            <Tooltip formatter={(v: number) => [fmt(v), "Collected"]}
              contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }} />
            <Bar dataKey="amount" fill="hsl(185,60%,35%)" radius={[5,5,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendor, stall, reference…" className="h-10 pl-10 rounded-xl"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button variant="outline" size="sm"
            className={`h-10 gap-2 rounded-xl ${showFilters ? "border-primary text-primary bg-primary/5" : ""}`}
            onClick={() => setShowFilters(v => !v)}>
            <Filter className="h-4 w-4" /> Filters
            {hasFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                {[filterStatus!=="all",filterMethod!=="all",filterType!=="all",!!dateFrom,!!dateTo].filter(Boolean).length}
              </span>
            )}
          </Button>
          {(hasFilters || search) && (
            <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-muted-foreground rounded-xl" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="rounded-2xl border bg-card p-4 shadow-civic space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</label>
                <select className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Method</label>
                <select className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
                  value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
                  <option value="all">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="paymaya">Maya</option>
                  <option value="instapay">InstaPay</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</label>
                <select className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
                  value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="all">All Types</option>
                  <option value="due">Full</option>
                  <option value="staggered">Partial</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Quick Date</label>
                <div className="flex gap-1">
                  {[["today","Today"],["week","Week"],["month","Month"]].map(([k,l]) => (
                    <button key={k} onClick={() => setQuick(k)}
                      className="flex-1 rounded-lg border px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors">{l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" className="h-9 rounded-xl text-sm" value={dateFrom} max={today} onChange={e => setDateFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" className="h-9 rounded-xl text-sm" value={dateTo}   max={today} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
          <strong className="text-foreground">{payments.length}</strong> payments
          {(dateFrom || dateTo) && ` · ${dateFrom ? new Date(dateFrom).toLocaleDateString("en-PH",{month:"short",day:"numeric"}) : "…"} – ${dateTo ? new Date(dateTo).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}) : "…"}`}
        </p>
        {filtered.length > 0 && (
          <p className="text-sm font-mono font-semibold text-foreground">
            Filtered total: <span className="text-success">{fmt(stats.totalFiltered)}</span>
          </p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                {["Date","Vendor","Stall","Period","Amount","Method","Type","Reference","Receipt","Status","Action"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p: any) => {
                const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                const methodCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, color: "bg-muted", label: p.payment_method };
                const StatusIcon = statusCfg.icon;
                const MethodIcon = methodCfg.icon;

                return (
                  <tr key={p.id} className={`hover:bg-secondary/30 transition-colors ${p.status === "pending" ? "bg-amber-50/20" : ""}`}>
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-foreground font-medium text-xs">
                        {new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}
                      </p>
                    </td>

                    {/* Vendor */}
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground whitespace-nowrap">{p.name}</p>
                    </td>

                    {/* Stall */}
                    <td className="px-4 py-3">
                      <p className="font-mono font-medium text-foreground">{p.stall}</p>
                      <p className="text-xs text-muted-foreground">{p.section}</p>
                    </td>

                    {/* Period */}
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                      {p.period_month && p.period_year ? `${MONTHS_FULL[p.period_month-1]} ${p.period_year}` : "—"}
                    </td>

                    {/* Amount */}
                    <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                      {fmt(Number(p.amount))}
                    </td>

                    {/* Method */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`flex h-5 w-5 items-center justify-center rounded ${methodCfg.color}`}>
                          <MethodIcon className="h-3 w-3 text-white" />
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{methodCfg.label}</span>
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                        p.payment_type === "staggered"
                          ? "border-primary/20 bg-primary/5 text-primary"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}>
                        {p.payment_type === "staggered" ? "Partial" : p.payment_type === "manual" ? "Manual" : "Full"}
                      </span>
                    </td>

                    {/* Reference */}
                    <td className="px-4 py-3">
                      {p.reference_number
                        ? <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{p.reference_number}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Receipt */}
                    <td className="px-4 py-3">
                      {p.receipt_number
                        ? <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{p.receipt_number}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusCfg.badge}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3">
                      {p.status === "pending" ? (
                        <Button size="sm"
                          className="h-7 text-xs bg-success hover:bg-success/90 text-white rounded-lg"
                          disabled={confirmPayment.isPending}
                          onClick={() => confirmPayment.mutate(p.id)}>
                          Confirm
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-8 w-8 opacity-20" />
                      <p className="font-medium">No payments found</p>
                      <p className="text-xs">Try adjusting your filters or search term</p>
                      {hasFilters && (
                        <button onClick={clearFilters} className="text-xs text-primary hover:underline mt-1">Clear all filters</button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="border-t bg-secondary/30 px-5 py-3 flex items-center justify-between flex-wrap gap-2 text-sm">
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>{filtered.filter((p:any)=>p.status==="completed").length} completed</span>
              <span>{filtered.filter((p:any)=>p.status==="pending").length} pending</span>
              <span>{filtered.filter((p:any)=>p.status==="failed").length} failed</span>
            </div>
            <p className="font-mono font-bold text-foreground">
              Total Completed: <span className="text-success">{fmt(stats.totalFiltered)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPayments;