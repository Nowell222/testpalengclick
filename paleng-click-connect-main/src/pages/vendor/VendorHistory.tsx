import { useState, useMemo, useRef } from "react";
import {
  CheckCircle2, AlertCircle, Clock, Loader2, Search,
  CreditCard, Smartphone, Building2, Banknote, Filter,
  TrendingUp, X, LayoutList, Table2, Printer, Calendar,
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

// ── Month SOA print ──────────────────────────────────────────────────────────
const printMonthSOA = (data: {
  profile: any; stall: any; monthName: string; monthNum: number; year: number;
  payments: any[]; monthlyRate: number;
}) => {
  const { profile, stall, monthName, monthNum, year, payments, monthlyRate } = data;

  const completed  = payments.filter(p => p.status === "completed");
  const pending    = payments.filter(p => p.status === "pending");
  const totalPaid  = completed.reduce((s, p) => s + Number(p.amount), 0);
  const totalPend  = pending.reduce((s, p) => s + Number(p.amount), 0);
  const balance    = Math.max(0, monthlyRate - totalPaid);
  const isPaid     = totalPaid >= monthlyRate;

  const ML: Record<string,string> = { gcash:"GCash", paymaya:"Maya", instapay:"InstaPay", cash:"Cash at Cashier" };

  const txRows = payments.map(p => `
    <tr>
      <td>${new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td>
      <td>${new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</td>
      <td class="mono">${p.receipt_number || "—"}</td>
      <td class="mono">${p.reference_number || "—"}</td>
      <td>${ML[p.payment_method] || p.payment_method}</td>
      <td>${p.payment_type === "staggered" ? "Partial" : "Full"}</td>
      <td class="r mono ${p.status === "completed" ? "paid" : p.status === "pending" ? "pend" : "fail"}">${fmt(Number(p.amount))}</td>
      <td class="c status-${p.status}">${p.status === "completed" ? "✓ Confirmed" : p.status === "pending" ? "⏳ Pending" : "✗ Failed"}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>SOA — ${monthName} ${year} — ${profile?.first_name} ${profile?.last_name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:28px;max-width:720px;margin:0 auto}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
  .rep{font-size:8px;letter-spacing:2px;color:#666;text-transform:uppercase}
  .lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .ttl{font-size:18px;font-weight:bold;letter-spacing:1px;margin-top:5px}
  .sub{font-size:10px;color:#666;margin-top:2px}
  .period-badge{display:inline-block;background:#1a4a2e;color:#e8c86e;font-size:13px;font-weight:bold;letter-spacing:1px;padding:4px 18px;border-radius:4px;margin-top:6px}
  .info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:10px}
  .info-item label{font-size:8px;color:#666;text-transform:uppercase;letter-spacing:0.5px}
  .info-item p{font-weight:bold;font-size:11px;margin-top:2px}
  .summary{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:14px}
  .sum-box{border:1px solid #ddd;border-radius:4px;padding:8px;text-align:center}
  .sum-box .lbl{font-size:8px;text-transform:uppercase;letter-spacing:0.5px;color:#666}
  .sum-box .val{font-size:14px;font-weight:bold;font-family:monospace;margin-top:3px}
  .sum-box.paid .val{color:#27ae60} .sum-box.bal .val{color:${isPaid?"#27ae60":"#c0392b"}} .sum-box.pend .val{color:#d4a017}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  thead tr{background:#111;color:#fff}
  thead th{padding:6px 8px;text-align:left;font-size:10px}
  th.r,td.r{text-align:right} th.c,td.c{text-align:center}
  tbody tr{border-bottom:1px solid #eee}
  tbody td{padding:5px 8px;font-size:10px}
  .mono{font-family:monospace}
  .paid{color:#27ae60;font-weight:bold} .pend{color:#d4a017} .fail{color:#c0392b}
  .status-completed{color:#27ae60;font-weight:bold} .status-pending{color:#d4a017;font-weight:bold} .status-failed{color:#c0392b}
  .no-tx{text-align:center;padding:16px;color:#888;font-style:italic}
  .totals{border:2px solid #111;border-radius:4px;padding:12px;margin-bottom:16px}
  .t-row{display:flex;justify-content:space-between;padding:3px 0;font-size:11px}
  .t-row.big{font-size:14px;font-weight:bold;border-top:1px solid #ddd;margin-top:6px;padding-top:8px}
  .settled{color:#27ae60} .outstanding{color:#c0392b}
  .status-banner{text-align:center;padding:10px;border-radius:4px;margin-bottom:14px;font-size:13px;font-weight:bold}
  .status-banner.paid-banner{background:#d5f5e3;border:1px solid #27ae60;color:#1e8449}
  .status-banner.bal-banner{background:#fdecea;border:1px solid #c0392b;color:#c0392b}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-top:40px}
  .sig-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:9px;color:#555}
  .sig-name{font-weight:bold;font-size:10px;color:#111;text-transform:uppercase}
  .footer{margin-top:20px;text-align:center;font-size:8px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>

<div class="hdr">
  <div class="rep">Republic of the Philippines</div>
  <div class="lgu">Municipality of San Juan, Batangas · Office of the Municipal Treasurer</div>
  <div class="ttl">STATEMENT OF ACCOUNT</div>
  <div class="sub">Public Market Stall Rental</div>
  <div class="period-badge">${monthName.toUpperCase()} ${year}</div>
</div>

<div class="info">
  <div class="info-item"><label>Vendor Name</label><p>${profile?.first_name} ${profile?.last_name}</p></div>
  <div class="info-item"><label>Stall Number</label><p>${stall?.stall_number || "—"}</p></div>
  <div class="info-item"><label>Section</label><p>${stall?.section || "General"}</p></div>
  <div class="info-item"><label>Location</label><p>${stall?.location || "—"}</p></div>
  <div class="info-item"><label>Monthly Rate</label><p>${fmt(monthlyRate)}</p></div>
  <div class="info-item"><label>Date Printed</label><p>${new Date().toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}</p></div>
</div>

<div class="summary">
  <div class="sum-box"><div class="lbl">Monthly Due</div><div class="val">${fmt(monthlyRate)}</div></div>
  <div class="sum-box paid"><div class="lbl">Total Paid</div><div class="val">${fmt(totalPaid)}</div></div>
  <div class="sum-box pend"><div class="lbl">Pending</div><div class="val">${fmt(totalPend)}</div></div>
  <div class="sum-box bal"><div class="lbl">Balance</div><div class="val">${fmt(balance)}</div></div>
</div>

<div class="status-banner ${isPaid ? "paid-banner" : "bal-banner"}">
  ${isPaid ? `✓ ${monthName} ${year} is FULLY PAID` : `⚠ Outstanding Balance: ${fmt(balance)} for ${monthName} ${year}`}
</div>

<table>
  <thead>
    <tr>
      <th>Date</th><th>Time</th><th>Receipt No.</th><th>Reference No.</th>
      <th>Method</th><th>Type</th><th class="r">Amount</th><th class="c">Status</th>
    </tr>
  </thead>
  <tbody>
    ${payments.length > 0 ? txRows : `<tr><td colspan="8" class="no-tx">No transactions recorded for ${monthName} ${year}</td></tr>`}
  </tbody>
</table>

<div class="totals">
  <div class="t-row"><span>Monthly Fee Due (${monthName} ${year})</span><span class="mono">${fmt(monthlyRate)}</span></div>
  <div class="t-row"><span>Total Amount Paid</span><span class="mono settled">${fmt(totalPaid)}</span></div>
  ${totalPend > 0 ? `<div class="t-row"><span>Pending (awaiting confirmation)</span><span class="mono pend">${fmt(totalPend)}</span></div>` : ""}
  <div class="t-row big">
    <span>BALANCE DUE — ${monthName} ${year}</span>
    <span class="mono ${isPaid ? "settled" : "outstanding"}">${fmt(balance)}</span>
  </div>
</div>

<div class="sigs">
  <div><div style="height:36px"></div><div class="sig-line"><div class="sig-name">${profile?.first_name} ${profile?.last_name}</div>Vendor / Lessee</div></div>
  <div><div style="height:36px"></div><div class="sig-line"><div class="sig-name">Cashier</div>Prepared by</div></div>
  <div><div style="height:36px"></div><div class="sig-line"><div class="sig-name">Municipal Treasurer</div>Noted by</div></div>
</div>

<div class="footer">PALENG-CLICK System · Computer-generated document · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
};

// ── Main Component ───────────────────────────────────────────────────────────
const VendorHistory = () => {
  const { user }   = useAuth();
  const printRef   = useRef<HTMLIFrameElement>(null);
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [filterMethod,  setFilterMethod]  = useState("all");
  const [filterMonth,   setFilterMonth]   = useState<string>("all");   // "1"–"12" or "all"
  const [filterYear,    setFilterYear]    = useState<number>(currentYear);
  const [showFilters,   setShowFilters]   = useState(false);
  const [viewMode,      setViewMode]      = useState<"card" | "table">("card");

  const { data: queryData, isLoading } = useQuery({
    queryKey: ["vendor-history", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: vendor } = await supabase
        .from("vendors").select("id, stall_id, stalls(stall_number, section, monthly_rate, location)")
        .eq("user_id", user!.id).single();
      const { data: profile } = await supabase
        .from("profiles").select("first_name, last_name")
        .eq("user_id", user!.id).single();
      if (!vendor) return { payments: [], vendor: null, profile: null };
      const { data } = await supabase
        .from("payments").select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });
      return { payments: data || [], vendor, profile, stall: vendor.stalls as any };
    },
  });

  const payments    = queryData?.payments    || [];
  const vendorInfo  = queryData?.vendor;
  const profile     = queryData?.profile;
  const stall       = queryData?.stall;
  const monthlyRate = (stall as any)?.monthly_rate || 1450;

  // Available years from payment data
  const availableYears = useMemo(() => {
    const years = new Set<number>(payments.map((p: any) => p.period_year).filter(Boolean));
    years.add(currentYear);
    return [...years].sort((a, b) => b - a);
  }, [payments, currentYear]);

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
      const matchMonth  = filterMonth  === "all" || p.period_month === Number(filterMonth);
      const matchYear   = !p.period_year || p.period_year === filterYear;
      return matchSearch && matchStatus && matchMethod && matchMonth && matchYear;
    });
  }, [payments, search, filterStatus, filterMethod, filterMonth, filterYear]);

  // Payments for the selected month (for SOA print)
  const monthPayments = useMemo(() => {
    if (filterMonth === "all") return [];
    return payments.filter((p: any) =>
      p.period_month === Number(filterMonth) && p.period_year === filterYear
    );
  }, [payments, filterMonth, filterYear]);

  const hasFilters = filterStatus !== "all" || filterMethod !== "all" || !!search || filterMonth !== "all";
  const clearFilters = () => {
    setSearch(""); setFilterStatus("all"); setFilterMethod("all"); setFilterMonth("all");
  };

  const handlePrintMonthSOA = () => {
    if (filterMonth === "all" || !printRef.current) return;
    const frame = printRef.current;
    frame.srcdoc = printMonthSOA({
      profile, stall, monthlyRate,
      monthName: MONTHS[Number(filterMonth) - 1],
      monthNum:  Number(filterMonth),
      year:      filterYear,
      payments:  monthPayments,
    });
    frame.onload = () => setTimeout(() => frame.contentWindow?.print(), 300);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">
      <iframe ref={printRef} style={{ display: "none" }} title="print-month-soa" />

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 style={{ fontSize: "clamp(1.15rem, 5vw, 1.5rem)", fontWeight: 700 }}>Payment History</h1>
          <p className="text-sm text-muted-foreground">Complete record of all your stall payments</p>
        </div>
        {/* Print SOA for selected month */}
        {filterMonth !== "all" && (
          <Button variant="hero" className="gap-2 rounded-xl" onClick={handlePrintMonthSOA}>
            <Printer className="h-4 w-4" />
            Print {MONTHS[Number(filterMonth) - 1]} {filterYear} SOA
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {[
          { label: "Total Paid",   value: fmt(stats.totalPaid),    color: "text-success",   icon: TrendingUp    },
          { label: "Transactions", value: String(stats.total),     color: "text-foreground", icon: CreditCard   },
          { label: "Completed",    value: String(stats.completed), color: "text-success",   icon: CheckCircle2  },
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

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search reference, receipt…" className="h-10 pl-10 rounded-xl"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {/* Month quick-select */}
          <select
            className="h-10 rounded-xl border bg-background px-3 text-sm min-w-[130px]"
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
          >
            <option value="all">All Months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={String(i + 1)}>{m}</option>
            ))}
          </select>

          {/* Year quick-select */}
          <select
            className="h-10 rounded-xl border bg-background px-3 text-sm"
            value={filterYear}
            onChange={e => setFilterYear(Number(e.target.value))}
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* More filters button */}
          <Button variant="outline" size="sm"
            className={`h-10 gap-2 rounded-xl ${showFilters ? "border-primary text-primary bg-primary/5" : ""}`}
            onClick={() => setShowFilters(v => !v)}>
            <Filter className="h-4 w-4" /> More
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
            <button onClick={() => setViewMode("card")} title="Card view"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "card" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <LayoutList className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode("table")} title="Table view"
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                viewMode === "table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Table2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Expanded filters — status & method */}
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

        {/* Active filter summary pill */}
        {filterMonth !== "all" && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
            <Calendar className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-primary font-medium flex-1">
              Showing <strong>{MONTHS[Number(filterMonth) - 1]} {filterYear}</strong> — {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
              {filtered.filter((p: any) => p.status === "completed").length > 0 && (
                <span className="text-muted-foreground font-normal">
                  {" · "}Total paid: <span className="font-semibold text-success">
                    {fmt(filtered.filter((p: any) => p.status === "completed").reduce((s: number, p: any) => s + Number(p.amount), 0))}
                  </span>
                </span>
              )}
            </p>
            <Button size="sm" variant="hero" className="gap-1.5 h-8 rounded-lg shrink-0" onClick={handlePrintMonthSOA}>
              <Printer className="h-3.5 w-3.5" />
              Print SOA
            </Button>
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
          <p className="font-medium">
            {payments.length === 0
              ? "No payments yet"
              : filterMonth !== "all"
                ? `No payments found for ${MONTHS[Number(filterMonth) - 1]} ${filterYear}`
                : "No payments match your filters"}
          </p>
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

      {/* ── CARD VIEW ────────────────────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === "card" && (
        <div className="space-y-3">
          {filtered.map((p: any) => {
            const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
            const methodCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, color: "bg-muted", label: p.payment_method };
            const StatusIcon = statusCfg.icon;
            const MethodIcon = methodCfg.icon;

            return (
              <div key={p.id} className="rounded-2xl border bg-card shadow-civic overflow-hidden hover:shadow-md transition-shadow">
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

      {/* ── TABLE VIEW ───────────────────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === "table" && (
        <div className="rounded-2xl border bg-card shadow-civic" style={{ overflowX: "auto" }}>
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium text-foreground">
                        {new Date(p.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">
                      {fmt(Number(p.amount))}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`flex h-5 w-5 items-center justify-center rounded ${methodCfg.color}`}>
                          <MethodIcon className="h-3 w-3 text-white" />
                        </span>
                        <span className="text-muted-foreground text-xs">{methodCfg.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                        p.payment_type === "staggered"
                          ? "border-primary/20 bg-primary/5 text-primary"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}>
                        {p.payment_type === "staggered" ? "Partial" : "Full"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusCfg.badge}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.reference_number
                        ? <span className="bg-secondary px-2 py-0.5 rounded">{p.reference_number}</span>
                        : <span>—</span>}
                    </td>
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