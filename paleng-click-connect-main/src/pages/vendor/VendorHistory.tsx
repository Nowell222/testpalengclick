import { useState, useMemo } from "react";
import {
  CheckCircle2, AlertCircle, Clock, Loader2, Search,
  CreditCard, Smartphone, Building2, Banknote, Filter,
  TrendingUp, X, LayoutList, Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",  label: "GCash"    },
  paymaya:  { icon: Smartphone, color: "bg-green-600", label: "Maya"     },
  instapay: { icon: Building2,  color: "bg-primary",   label: "InstaPay" },
  cash:     { icon: Banknote,   color: "bg-slate-500", label: "Cash"     },
};

const STATUS_CONFIG: Record<string, { icon: any; badge: string; text: string; label: string }> = {
  completed: { icon: CheckCircle2, badge: "bg-success/10 text-success border-success/20",  text: "text-success",   label: "Completed" },
  pending:   { icon: Clock,        badge: "bg-amber-100 text-amber-700 border-amber-200",  text: "text-amber-600", label: "Pending"   },
  failed:    { icon: AlertCircle,  badge: "bg-accent/10 text-accent border-accent/20",     text: "text-accent",    label: "Failed"    },
};

const VendorHistory = () => {
  const { user } = useAuth();
  const [search,       setSearch]       = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [showFilters,  setShowFilters]  = useState(false);
  const [viewMode,     setViewMode]     = useState<"card" | "table">("card");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["vendor-history", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: vendor } = await supabase.from("vendors").select("id").eq("user_id", user!.id).single();
      if (!vendor) return [];
      const { data } = await supabase.from("payments").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const completed = payments.filter((p: any) => p.status === "completed");
    return {
      totalPaid: completed.reduce((s: number, p: any) => s + Number(p.amount), 0),
      completed: completed.length,
      pending:   payments.filter((p: any) => p.status === "pending").length,
      total:     payments.length,
    };
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((p: any) => {
      const period = p.period_month && p.period_year
        ? `${MONTHS[p.period_month - 1]} ${p.period_year}`.toLowerCase() : "";
      const matchSearch = !search ||
        period.includes(search.toLowerCase()) ||
        (p.reference_number || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.receipt_number   || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.payment_method   || "").toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      const matchMethod = filterMethod === "all" || p.payment_method === filterMethod;
      return matchSearch && matchStatus && matchMethod;
    });
  }, [payments, search, filterStatus, filterMethod]);

  const hasFilters = filterStatus !== "all" || filterMethod !== "all" || !!search;
  const clearFilters = () => { setSearch(""); setFilterStatus("all"); setFilterMethod("all"); };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
        <p className="text-sm text-muted-foreground">Complete record of all your stall payments</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Paid",   value: fmt(stats.totalPaid),    color: "text-success",  icon: TrendingUp    },
          { label: "Transactions", value: String(stats.total),     color: "text-foreground",icon: CreditCard   },
          { label: "Completed",    value: String(stats.completed), color: "text-success",  icon: CheckCircle2  },
          { label: "Pending",      value: String(stats.pending),   color: stats.pending > 0 ? "text-amber-600" : "text-muted-foreground", icon: Clock },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
            </div>
            <p className={`font-mono text-lg font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter + view toggle */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search period, reference…" className="h-10 pl-10 rounded-xl"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Filter button */}
          <Button variant="outline" size="sm"
            className={`h-10 gap-2 rounded-xl ${showFilters ? "border-primary text-primary bg-primary/5" : ""}`}
            onClick={() => setShowFilters(v => !v)}>
            <Filter className="h-4 w-4" /> Filter
            {(filterStatus !== "all" || filterMethod !== "all") && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                {[filterStatus !== "all", filterMethod !== "all"].filter(Boolean).length}
              </span>
            )}
          </Button>

          {/* Clear */}
          {hasFilters && (
            <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-muted-foreground rounded-xl" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}

          {/* View mode toggle */}
          <div className="flex items-center rounded-xl border bg-secondary p-1 gap-0.5 ml-auto">
            <button
              onClick={() => setViewMode("card")}
              title="Card view"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "card" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table view"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="rounded-2xl border bg-card p-4 shadow-civic grid grid-cols-2 gap-3">
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
          </div>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
        <strong className="text-foreground">{payments.length}</strong> transactions
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3 text-muted-foreground">
          <CreditCard className="h-10 w-10 opacity-20" />
          <p className="font-medium">{payments.length === 0 ? "No payments yet" : "No payments match your filters"}</p>
          {payments.length === 0 && (
            <Link to="/vendor/pay">
              <Button size="sm" variant="outline" className="mt-1">Make your first payment</Button>
            </Link>
          )}
          {hasFilters && payments.length > 0 && (
            <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
          )}
        </div>
      )}

      {/* ── CARD VIEW ────────────────────────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === "card" && (
        <div className="space-y-3">
          {filtered.map((p: any) => {
            const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
            const methodCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, color: "bg-muted", label: p.payment_method };
            const StatusIcon = statusCfg.icon;
            const MethodIcon = methodCfg.icon;

            return (
              <div key={p.id} className="rounded-2xl border bg-card shadow-civic overflow-hidden hover:shadow-md transition-shadow">
                {/* Top row */}
                <div className="flex items-start justify-between px-5 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      p.status === "completed" ? "bg-success/10" :
                      p.status === "pending"   ? "bg-amber-100"  : "bg-accent/10"
                    }`}>
                      <StatusIcon className={`h-4 w-4 ${statusCfg.text}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {p.period_month && p.period_year
                          ? `${MONTHS[p.period_month - 1]} ${p.period_year}`
                          : new Date(p.created_at).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(p.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                        {" · "}
                        {new Date(p.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xl font-bold text-foreground">{fmt(Number(p.amount))}</p>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold mt-1 ${statusCfg.badge}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </div>
                </div>

                <div className="h-px bg-border mx-5" />

                {/* Detail row */}
                <div className="flex items-center justify-between px-5 py-3 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`flex h-5 w-5 items-center justify-center rounded ${methodCfg.color}`}>
                      <MethodIcon className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-xs text-muted-foreground">{methodCfg.label}</span>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    p.payment_type === "staggered"
                      ? "border-primary/20 bg-primary/5 text-primary"
                      : "border-border bg-secondary text-muted-foreground"
                  }`}>
                    {p.payment_type === "staggered" ? "Partial" : "Full Payment"}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {p.reference_number && (
                      <span className="font-mono bg-secondary px-2 py-0.5 rounded">Ref: {p.reference_number}</span>
                    )}
                    {p.receipt_number && (
                      <span className="font-mono bg-secondary px-2 py-0.5 rounded">RC: {p.receipt_number}</span>
                    )}
                  </div>
                </div>

                {/* Pending notice */}
                {p.status === "pending" && (
                  <div className="mx-5 mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    {p.payment_method === "cash"
                      ? "Awaiting cashier confirmation. Bring your reference number to the cashier."
                      : "Payment processing. This will update automatically once confirmed."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── TABLE VIEW ───────────────────────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === "table" && (
        <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                {["Date","Period","Amount","Method","Type","Status","Reference","Receipt"].map(h => (
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
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(p.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>

                    {/* Period */}
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {p.period_month && p.period_year
                        ? `${MONTHS[p.period_month - 1]} ${p.period_year}`
                        : "—"}
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
                        <span className="text-muted-foreground text-xs">{methodCfg.label}</span>
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                        p.payment_type === "staggered"
                          ? "border-primary/20 bg-primary/5 text-primary"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}>
                        {p.payment_type === "staggered" ? "Partial" : "Full"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusCfg.badge}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Reference */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.reference_number
                        ? <span className="bg-secondary px-2 py-0.5 rounded">{p.reference_number}</span>
                        : <span>—</span>}
                    </td>

                    {/* Receipt */}
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.receipt_number
                        ? <span className="bg-secondary px-2 py-0.5 rounded">{p.receipt_number}</span>
                        : <span>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Table footer total */}
          <div className="border-t bg-secondary/30 px-5 py-3 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{filtered.length} transactions</span>
            <span className="font-mono font-bold text-foreground">
              Total paid: {fmt(filtered.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.amount), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorHistory;