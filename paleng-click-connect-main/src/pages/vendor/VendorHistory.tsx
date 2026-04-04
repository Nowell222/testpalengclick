import VendorBottomNav from "@/components/VendorBottomNav";
import { useState, useMemo, useRef } from "react";
import {
  CheckCircle2, AlertCircle, Clock, Loader2, Search,
  CreditCard, Smartphone, Building2, Banknote, Filter,
  TrendingUp, X, LayoutList, Table2, Printer, Calendar,
  ChevronDown, ChevronUp, Eye,
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

const DS = {
  gradientHeader: "linear-gradient(160deg, #0d2240 0%, #1a3a5f 45%, #1d4ed8 80%, #2563eb 100%)",
  blue900: "#0d2240",
  blue800: "#1a3a5f",
  blue600: "#2563eb",
  blue50:  "#eff6ff",
  blue100: "#dbeafe",
};

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",  label: "GCash"    },
  paymaya:  { icon: Smartphone, color: "bg-green-600", label: "Maya"     },
  instapay: { icon: Building2,  color: "bg-primary",   label: "InstaPay" },
  cash:     { icon: Banknote,   color: "bg-slate-500", label: "Cash"     },
};

const STATUS_CONFIG: Record<string, { icon: any; badge: string; text: string; label: string }> = {
  completed: { icon: CheckCircle2, badge: "bg-green-100 text-green-700 border-green-200",  text: "text-green-600",  label: "Completed" },
  pending:   { icon: Clock,        badge: "bg-amber-100 text-amber-700 border-amber-200",  text: "text-amber-600", label: "Pending"   },
  failed:    { icon: AlertCircle,  badge: "bg-red-100 text-red-700 border-red-200",        text: "text-red-500",   label: "Failed"    },
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

// ── Collapsible History Card ──────────────────────────────────────────────────
const HistoryCard = ({ p }: { p: any }) => {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
  const methodCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, color: "bg-slate-400", label: p.payment_method };
  const StatusIcon = statusCfg.icon;
  const MethodIcon = methodCfg.icon;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden shadow-sm"
      style={{ border: "1px solid #e2e8f0" }}>
      {/* Header row — always visible, click to expand */}
      <div
        className="flex items-start justify-between px-4 pt-4 pb-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            p.status === "completed" ? "bg-green-100" :
            p.status === "pending"   ? "bg-amber-100"  : "bg-red-100"
          }`}>
            <StatusIcon className={`h-5 w-5 ${statusCfg.text}`} />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">
              {p.period_month && p.period_year
                ? `${MONTHS[p.period_month - 1]} ${p.period_year}`
                : new Date(p.created_at).toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {new Date(p.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
              {" · "}
              {new Date(p.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold mt-1.5 ${statusCfg.badge}`}>
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1">
          <p className="font-mono text-lg font-black text-slate-900">{fmt(Number(p.amount))}</p>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center`}
            style={{ background: DS.blue50, border: `1px solid ${DS.blue100}` }}>
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5" style={{ color: DS.blue600 }} />
              : <ChevronDown className="h-3.5 w-3.5" style={{ color: DS.blue600 }} />}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <>
          <div className="h-px mx-4" style={{ background: "#f1f5f9" }} />
          <div className="flex items-center justify-between px-4 py-3 flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`flex h-5 w-5 items-center justify-center rounded ${methodCfg.color}`}>
                <MethodIcon className="h-3 w-3 text-white" />
              </div>
              <span className="text-xs text-slate-500">{methodCfg.label}</span>
            </div>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
              p.payment_type === "staggered"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}>
              {p.payment_type === "staggered" ? "Partial" : "Full Payment"}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {p.reference_number && (
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">Ref: {p.reference_number}</span>
              )}
              {p.receipt_number && (
                <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">RC: {p.receipt_number}</span>
              )}
            </div>
          </div>

          {p.status === "pending" && (
            <div className="mx-4 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
              <span>
                {p.is_submission
                  ? "Receipt submitted — awaiting cashier verification. Your payment will appear as Completed once confirmed."
                  : p.payment_method === "cash"
                    ? "Awaiting cashier confirmation. Bring your reference number to the cashier."
                    : "Payment processing. This will update automatically once confirmed."}
              </span>
            </div>
          )}
          {p.is_submission && p.receipt_url && (
            <div className="mx-4 mb-3">
              <a href={p.receipt_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5"
                style={{ background: DS.blue50, color: DS.blue600, border: `1px solid ${DS.blue100}` }}>
                <Eye className="h-3.5 w-3.5" /> View Uploaded Receipt
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const VendorHistory = () => {
  const { user }   = useAuth();
  const printRef   = useRef<HTMLIFrameElement>(null);
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [search,        setSearch]        = useState("");
  const [filterStatus,  setFilterStatus]  = useState("all");
  const [filterMethod,  setFilterMethod]  = useState("all");
  const [filterMonth,   setFilterMonth]   = useState<string>("all");
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

      // Fetch confirmed payments
      const { data: confirmedPayments } = await supabase
        .from("payments").select("*")
        .eq("vendor_id", vendor.id)
        .order("created_at", { ascending: false });

      // Fetch pending online submissions (not yet accepted by cashier)
      const { data: submissions } = await (supabase
        .from("payment_submissions" as any) as any)
        .select("*")
        .eq("vendor_id", vendor.id)
        .in("status", ["pending", "rejected"])
        .order("created_at", { ascending: false });

      // Normalise submissions to look like payment rows
      const pendingRows = (submissions || []).map((s: any) => ({
        id:             `sub_${s.id}`,
        vendor_id:      s.vendor_id,
        amount:         s.amount,
        status:         s.status === "rejected" ? "failed" : "pending",
        payment_method: s.payment_method || "instapay",
        payment_type:   s.payment_type   || "due",
        period_month:   s.period_month,
        period_year:    s.period_year,
        reference_number: s.ocr_reference || null,
        receipt_url:    s.receipt_url     || null,
        created_at:     s.created_at,
        is_submission:  true,   // flag so UI can show "Awaiting verification"
      }));

      // Merge: submissions first (pending on top), then confirmed
      const merged = [...pendingRows, ...(confirmedPayments || [])];

      return { payments: merged, vendor, profile, stall: vendor.stalls as any };
    },
  });

  const payments    = queryData?.payments    || [];
  const profile     = queryData?.profile;
  const stall       = queryData?.stall;
  const monthlyRate = (stall as any)?.monthly_rate || 1450;

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
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#2563eb" }} />
    </div>
  );

  return (
    <div className="space-y-0 -mx-4 -mt-4 lg:mx-0 lg:mt-0" style={{ "--page-pad": "32px" } as any}>
      <iframe ref={printRef} style={{ display: "none" }} title="print-month-soa" />

      {/* Mobile mini-hero header */}
      <div className="lg:hidden" style={{ background: DS.gradientHeader }}>
        <div className="px-5 pt-5 pb-5">
          <h1 className="text-2xl font-black text-white">Payment History</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>Complete record of all your stall payments</p>
          {/* Stats row */}
          <div className="flex gap-2.5 mt-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {[
              { label: "Total Paid",   value: fmt(stats.totalPaid) },
              { label: "Transactions", value: String(stats.total) },
              { label: "Completed",    value: String(stats.completed) },
              { label: "Pending",      value: String(stats.pending), amber: stats.pending > 0 },
            ].map(s => (
              <div key={s.label} className="shrink-0 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", minWidth: 100 }}>
                <p className="font-mono text-base font-black text-white" style={{ color: (s as any).amber ? "#fde68a" : "white" }}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between flex-wrap gap-3" style={{ padding: "28px 32px 0" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Payment History</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Complete record of all your stall payments</p>
        </div>
        {filterMonth !== "all" && (
          <Button variant="hero" className="gap-2 rounded-xl" onClick={handlePrintMonthSOA}>
            <Printer className="h-4 w-4" />
            Print {MONTHS[Number(filterMonth) - 1]} {filterYear} SOA
          </Button>
        )}
      </div>

      {/* Desktop summary cards */}
      <div className="hidden lg:grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ padding: "16px 32px 0" }}>
        {[
          { label: "Total Paid",   value: fmt(stats.totalPaid),    color: "#16a34a",  icon: TrendingUp,   bg: "#dcfce7" },
          { label: "Transactions", value: String(stats.total),     color: "#0f172a",  icon: CreditCard,   bg: "#f1f5f9" },
          { label: "Completed",    value: String(stats.completed), color: "#16a34a",  icon: CheckCircle2, bg: "#dcfce7" },
          { label: "Pending",      value: String(stats.pending),   color: stats.pending > 0 ? "#d97706" : "#64748b", icon: Clock, bg: stats.pending > 0 ? "#fef3c7" : "#f1f5f9" },
        ].map(c => (
          <div key={c.label} style={{ borderRadius: 16, border: "1px solid #e2e8f0", background: "#fff", padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "#94a3b8" }}>{c.label}</p>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <c.icon size={13} color={c.color} />
              </div>
            </div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 lg:bg-transparent lg:border-none lg:py-0" style={{ paddingLeft: "32px" } as any}>
        <div className="space-y-3">
          {/* Mobile: 2-row layout. Desktop: single flex row */}
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap">
            {/* Row 1 mobile: search full-width */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search reference, receipt…"
                className="h-10 pl-10 rounded-xl"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            {/* Row 2 mobile: month + year + more + view toggle in one row */}
            <div className="flex gap-2 items-center">
              {/* Month */}
              <select
                className="h-10 rounded-xl border bg-background px-3 text-sm flex-1 min-w-0"
                value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
                <option value="all">All Months</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>{m}</option>
                ))}
              </select>

              {/* Year */}
              <select
                className="h-10 rounded-xl border bg-background px-3 text-sm w-[80px]"
                value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              {/* More filters */}
              <Button variant="outline" size="sm"
                className={`h-10 gap-1.5 rounded-xl shrink-0 ${showFilters ? "border-blue-500 text-blue-600 bg-blue-50" : ""}`}
                onClick={() => setShowFilters(v => !v)}>
                <Filter className="h-4 w-4" /> <span className="hidden sm:inline">More</span>
                {(filterStatus !== "all" || filterMethod !== "all") && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                    {[filterStatus !== "all", filterMethod !== "all"].filter(Boolean).length}
                  </span>
                )}
              </Button>

              {/* Clear */}
              {hasFilters && (
                <Button variant="ghost" size="sm" className="h-10 gap-1.5 text-muted-foreground rounded-xl shrink-0 px-2" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}

              {/* View mode toggle */}
              <div className="flex items-center rounded-xl border bg-secondary p-1 gap-0.5 shrink-0">
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

          {/* Month filter active banner */}
          {filterMonth !== "all" && (
            <div className="flex items-center gap-2 rounded-xl border px-4 py-2.5"
              style={{ borderColor: DS.blue100, background: DS.blue50 }}>
              <Calendar className="h-4 w-4 shrink-0" style={{ color: DS.blue600 }} />
              <p className="text-sm flex-1" style={{ color: DS.blue600 }}>
                <strong>{MONTHS[Number(filterMonth) - 1]} {filterYear}</strong> — {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
                {filtered.filter((p: any) => p.status === "completed").length > 0 && (
                  <span className="text-slate-500 font-normal">
                    {" · "}Total paid: <span className="font-semibold text-green-600">
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
      </div>

      {/* Mobile filter chips */}
      <div className="lg:hidden flex gap-2 px-4 pb-2 overflow-x-auto bg-white" style={{ scrollbarWidth: "none" }}>
        {["all","completed","pending","failed"].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: filterStatus === s ? DS.blue900 : "white",
              color: filterStatus === s ? "white" : "#64748b",
              border: filterStatus === s ? `1.5px solid ${DS.blue900}` : "1.5px solid #e2e8f0",
            }}>
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="hidden lg:block text-sm text-muted-foreground" style={{ padding: "4px 32px 0" }}>
        Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
        <strong className="text-foreground">{payments.length}</strong> transactions
      </p>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3 text-muted-foreground mx-4 lg:mx-0">
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

      {/* ── CARD VIEW ─────────────────────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === "card" && (
        <div className="space-y-2.5 px-4 pb-4 lg:pb-8 lg:space-y-3"
          style={{ background: filtered.length > 0 ? "#f0f4f8" : "transparent", padding: "16px 32px 32px" }}
        >
          <div className="pt-2 lg:pt-0" />
          {filtered.map((p: any) => (
            <HistoryCard key={p.id} p={p} />
          ))}
          <div className="pb-2 lg:pb-0" />
        </div>
      )}

      {/* ── TABLE VIEW ────────────────────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === "table" && (
        <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto mx-4 lg:mx-8 lg:mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "#0d2240" }}>
                {["Date","Period","Amount","Method","Type","Status","Reference","Receipt"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap text-white" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p: any) => {
                const statusCfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
                const methodCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, color: "bg-slate-400", label: p.payment_method };
                const StatusIcon = statusCfg.icon;
                const MethodIcon = methodCfg.icon;

                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
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
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
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