import { useState, useMemo } from "react";
import { CheckCircle2, AlertCircle, Clock, Loader2, Search, Filter, Smartphone, Building2, Banknote, CreditCard, X, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_CONFIG: Record<string, { icon: any; label: string; badge: string; text: string }> = {
  completed: { icon: CheckCircle2, label: "Completed", badge: "bg-success/10 text-success border-success/20",   text: "text-success" },
  pending:   { icon: Clock,        label: "Pending",   badge: "bg-amber-100 text-amber-700 border-amber-200",   text: "text-amber-600" },
  failed:    { icon: AlertCircle,  label: "Failed",    badge: "bg-accent/10 text-accent border-accent/20",      text: "text-accent" },
  overdue:   { icon: AlertCircle,  label: "Overdue",   badge: "bg-red-100 text-red-700 border-red-200",         text: "text-red-600" },
};

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",   label: "GCash" },
  paymaya:  { icon: Smartphone, color: "bg-green-600",  label: "Maya" },
  instapay: { icon: Building2,  color: "bg-primary",    label: "InstaPay" },
  cash:     { icon: Banknote,   color: "bg-slate-500",  label: "Cash" },
};

const CashierPaymentStatus = () => {
  const [search, setSearch]         = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMethod, setFilterMethod] = useState("all");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const { data: payments = [], isLoading, refetch } = useQuery({
    queryKey: ["cashier-payment-status"],
    refetchInterval: 8000,
    queryFn: async () => {
      const { data: paymentsList } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!paymentsList?.length) return [];

      const vendorIds = [...new Set(paymentsList.map(p => p.vendor_id))];
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, user_id, stalls(stall_number, section)")
        .in("id", vendorIds);

      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, contact_number")
        .in("user_id", userIds);

      return paymentsList.map(p => {
        const vendor  = vendors?.find(v => v.id === p.vendor_id);
        const profile = profiles?.find(pr => pr.user_id === vendor?.user_id);
        const stall   = vendor?.stalls as any;
        return {
          ...p,
          vendor_name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
          contact:     profile?.contact_number || "—",
          stall_number: stall?.stall_number || "—",
          section:     stall?.section || "General",
        };
      });
    },
  });

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return payments.filter((p: any) => {
      const matchSearch =
        !search ||
        p.vendor_name.toLowerCase().includes(search.toLowerCase()) ||
        p.stall_number.toLowerCase().includes(search.toLowerCase()) ||
        (p.reference_number || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.receipt_number || "").toLowerCase().includes(search.toLowerCase());

      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      const matchMethod = filterMethod === "all" || p.payment_method === filterMethod;

      const payDate = p.created_at?.split("T")[0];
      const matchFrom = !dateFrom || payDate >= dateFrom;
      const matchTo   = !dateTo   || payDate <= dateTo;

      return matchSearch && matchStatus && matchMethod && matchFrom && matchTo;
    });
  }, [payments, search, filterStatus, filterMethod, dateFrom, dateTo]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todayPayments = payments.filter((p: any) => p.created_at?.startsWith(today) && p.status === "completed");
    return {
      totalToday:   todayPayments.reduce((s: number, p: any) => s + Number(p.amount), 0),
      countToday:   todayPayments.length,
      countPending: payments.filter((p: any) => p.status === "pending").length,
      countFailed:  payments.filter((p: any) => p.status === "failed").length,
      totalFiltered: filtered.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.amount), 0),
    };
  }, [payments, filtered, today]);

  const hasActiveFilters = filterStatus !== "all" || filterMethod !== "all" || dateFrom || dateTo;

  const clearFilters = () => {
    setFilterStatus("all");
    setFilterMethod("all");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payment Status</h1>
          <p className="text-sm text-muted-foreground">Monitor and track all vendor payment transactions</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4 shadow-civic">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Today's Collection</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-success">
            ₱{stats.totalToday.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{stats.countToday} transactions</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-civic">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-amber-600">{stats.countPending}</p>
          <p className="text-xs text-muted-foreground mt-0.5">awaiting confirmation</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-civic">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Failed</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-accent">{stats.countFailed}</p>
          <p className="text-xs text-muted-foreground mt-0.5">this period</p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-civic">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Filtered Total</p>
          <p className="mt-1.5 font-mono text-xl font-bold text-foreground">
            ₱{stats.totalFiltered.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} records shown</p>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vendor, stall, or reference number..."
              className="h-10 pl-10 rounded-xl"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Toggle filters */}
          <Button
            variant="outline"
            size="sm"
            className={`h-10 gap-2 rounded-xl ${showFilters ? "border-primary text-primary bg-primary/5" : ""}`}
            onClick={() => setShowFilters(v => !v)}
          >
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {[filterStatus !== "all", filterMethod !== "all", !!dateFrom, !!dateTo].filter(Boolean).length}
              </span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-muted-foreground rounded-xl" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* Status filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
                <select
                  className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              {/* Method filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Method</label>
                <select
                  className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
                  value={filterMethod}
                  onChange={e => setFilterMethod(e.target.value)}
                >
                  <option value="all">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="gcash">GCash</option>
                  <option value="paymaya">Maya</option>
                  <option value="instapay">InstaPay</option>
                </select>
              </div>

              {/* Date from */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date From</label>
                <Input
                  type="date"
                  className="h-9 rounded-xl text-sm"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  max={today}
                />
              </div>

              {/* Date to */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date To</label>
                <Input
                  type="date"
                  className="h-9 rounded-xl text-sm"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  max={today}
                />
              </div>
            </div>

            {/* Quick date shortcuts */}
            <div className="mt-3 flex flex-wrap gap-2">
              <p className="text-xs text-muted-foreground self-center">Quick:</p>
              {[
                { label: "Today",      from: today,                               to: today },
                { label: "This Week",  from: new Date(Date.now() - 6*86400000).toISOString().split("T")[0], to: today },
                { label: "This Month", from: `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,"0")}-01`, to: today },
              ].map(s => (
                <button
                  key={s.label}
                  onClick={() => { setDateFrom(s.from); setDateTo(s.to); }}
                  className={`rounded-lg border px-3 py-1 text-xs transition-colors ${
                    dateFrom === s.from && dateTo === s.to
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
          <strong className="text-foreground">{payments.length}</strong> transactions
          {dateFrom && dateTo && ` · ${new Date(dateFrom).toLocaleDateString("en-PH")} – ${new Date(dateTo).toLocaleDateString("en-PH")}`}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stall</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference No.</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Receipt No.</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date & Time</th>
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
                  {/* Vendor */}
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{p.vendor_name}</p>
                    <p className="text-xs text-muted-foreground">{p.contact}</p>
                  </td>

                  {/* Stall */}
                  <td className="px-4 py-3">
                    <p className="font-mono font-medium text-foreground">{p.stall_number}</p>
                    <p className="text-xs text-muted-foreground">{p.section}</p>
                  </td>

                  {/* Period */}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {p.period_month && p.period_year
                      ? `${MONTHS[p.period_month - 1]} ${p.period_year}`
                      : "—"}
                  </td>

                  {/* Amount */}
                  <td className="px-4 py-3">
                    <p className="font-mono font-bold text-foreground">
                      ₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </p>
                  </td>

                  {/* Method */}
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`flex h-5 w-5 items-center justify-center rounded ${methodCfg.color}`}>
                        <MethodIcon className="h-3 w-3 text-white" />
                      </span>
                      <span className="text-muted-foreground">{methodCfg.label}</span>
                    </span>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      p.payment_type === "staggered"
                        ? "border-primary/20 bg-primary/5 text-primary"
                        : "border-border bg-secondary text-muted-foreground"
                    }`}>
                      {p.payment_type === "staggered" ? "Partial" : "Full"}
                    </span>
                  </td>

                  {/* Reference */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-foreground bg-secondary px-2 py-0.5 rounded">
                      {p.reference_number || "—"}
                    </span>
                  </td>

                  {/* Receipt */}
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-foreground bg-secondary px-2 py-0.5 rounded">
                      {p.receipt_number || "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusCfg.badge}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusCfg.label}
                    </span>
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                    <p>{new Date(p.created_at).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</p>
                    <p className="text-muted-foreground/70">{new Date(p.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</p>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Search className="h-8 w-8 opacity-30" />
                    <p className="font-medium">No payments found</p>
                    <p className="text-xs">Try adjusting your filters or search term</p>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="mt-2 text-xs text-primary hover:underline">
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

      {/* Footer summary */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border bg-secondary/30 px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {filtered.filter((p: any) => p.status === "completed").length} completed ·{" "}
            {filtered.filter((p: any) => p.status === "pending").length} pending ·{" "}
            {filtered.filter((p: any) => p.status === "failed").length} failed
          </p>
          <p className="font-mono font-semibold text-foreground">
            Total Completed: ₱{stats.totalFiltered.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        </div>
      )}
    </div>
  );
};

export default CashierPaymentStatus;