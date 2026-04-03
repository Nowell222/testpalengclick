import VendorBottomNav from "@/components/VendorBottomNav";
import { useRef, useState } from "react";
import { Loader2, Printer, Download, CheckCircle2, AlertCircle, TrendingUp, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  blue600: "#2563eb",
  blue50:  "#eff6ff",
  blue100: "#dbeafe",
};

// ─── Print HTML — kept exactly as original ────────────────────────────────────
const getPrintHTML = (data: any) => {
  const { profile, stall, rows, totalPaid, totalOutstanding, currentYear, monthlyRate } = data;
  const rowsHTML = rows.map((r: any) => `
    <tr class="${r.isFuture ? "future" : ""}">
      <td>${r.month} ${currentYear}</td>
      <td class="r">${fmt(r.due)}</td>
      <td class="r">${r.paid > 0 ? fmt(r.paid) : "—"}</td>
      <td class="r ${r.balance > 0 && !r.isFuture && !r.isAdvance ? "bal" : ""}">${(r.isFully || r.isAdvance) ? "₱0.00" : fmt(r.balance)}</td>
      <td class="c ${r.isAdvance ? "advance" : r.isFully ? "paid" : r.isPartial ? "part" : (r.isFuture && !r.isPartial) ? "upcoming" : "unpaid"}">
        ${r.isAdvance ? "★ Advance" : r.isFully ? "✓ Paid" : r.isPartial ? "Partial" : (r.isFuture && !r.isPartial) ? "Upcoming" : "Unpaid"}
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>SOA - ${profile?.first_name} ${profile?.last_name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:32px}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:18px}
  .rep{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase}
  .lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .ttl{font-size:18px;font-weight:bold;letter-spacing:1px;margin-top:5px}
  .sub{font-size:10px;color:#666;margin-top:2px}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;background:#f7f7f7;border:1px solid #ddd;border-radius:4px;padding:12px}
  .info-item label{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px}
  .info-item p{font-weight:bold;font-size:12px;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  thead tr{background:#111;color:#fff}
  thead th{padding:7px 10px;text-align:left;font-size:11px}
  thead th.r{text-align:right} thead th.c{text-align:center}
  tbody tr{border-bottom:1px solid #eee}
  tbody tr.future{opacity:.4}
  tbody td{padding:6px 10px}
  td.r{text-align:right;font-family:monospace}
  td.c{text-align:center;font-size:11px;font-weight:bold}
  td.bal{color:#c0392b;font-weight:bold}
  td.paid{color:#27ae60} td.part{color:#2980b9} td.unpaid{color:#c0392b} td.upcoming{color:#888}
  .totals{border-top:2px solid #111;padding-top:10px}
  .t-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
  .t-row.big{font-size:15px;font-weight:bold;border-top:1px solid #ddd;margin-top:4px;padding-top:8px}
  .t-row.big .v{color:#c0392b} .t-row.settled .v{color:#27ae60}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-top:48px}
  .sig-line{border-top:1px solid #111;padding-top:6px;text-align:center;font-size:10px;color:#555}
  .sig-name{font-weight:bold;font-size:11px;color:#111;text-transform:uppercase}
  .footer{margin-top:28px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines</div>
  <div class="lgu">Municipality of San Juan, Batangas · Office of the Municipal Treasurer</div>
  <div class="ttl">STATEMENT OF ACCOUNT</div>
  <div class="sub">Public Market Stall Rental — Fiscal Year ${currentYear}</div>
</div>
<div class="info">
  <div class="info-item"><label>Vendor Name</label><p>${profile?.first_name} ${profile?.last_name}</p></div>
  <div class="info-item"><label>Stall Number</label><p>${stall?.stall_number || "—"}</p></div>
  <div class="info-item"><label>Section</label><p>${stall?.section || "General"}</p></div>
  <div class="info-item"><label>Monthly Rate</label><p>${fmt(monthlyRate)}</p></div>
  <div class="info-item"><label>Location</label><p>${stall?.location || "—"}</p></div>
  <div class="info-item"><label>Date Printed</label><p>${new Date().toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}</p></div>
</div>
<table>
  <thead><tr><th>Period</th><th class="r">Amount Due</th><th class="r">Paid</th><th class="r">Balance</th><th class="c">Status</th></tr></thead>
  <tbody>${rowsHTML}</tbody>
</table>
<div class="totals">
  <div class="t-row"><span style="color:#555">Total Paid (${currentYear})</span><span class="v" style="color:#27ae60;font-family:monospace;font-weight:bold">${fmt(totalPaid)}</span></div>
  <div class="t-row big ${totalOutstanding === 0 ? "settled" : ""}"><span>TOTAL OUTSTANDING BALANCE</span><span class="v" style="font-family:monospace">${fmt(totalOutstanding)}</span></div>
</div>
<div class="sigs">
  <div><div style="height:40px"></div><div class="sig-line"><div class="sig-name">${profile?.first_name} ${profile?.last_name}</div>Vendor / Lessee</div></div>
  <div><div style="height:40px"></div><div class="sig-line"><div class="sig-name">Cashier</div>Prepared by</div></div>
  <div><div style="height:40px"></div><div class="sig-line"><div class="sig-name">Municipal Treasurer</div>Noted by</div></div>
</div>
<div class="footer">PALENG-CLICK System · Computer-generated · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
};

// ─── Component ─────────────────────────────────────────────────────────────────
const VendorStatement = () => {
  const { user }   = useAuth();
  const printRef   = useRef<HTMLIFrameElement>(null);
  const thisYear   = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(thisYear);

  const availableYears = Array.from({ length: 4 }, (_, i) => thisYear - i);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-statement", user?.id, selectedYear],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: vendor }  = await supabase.from("vendors").select("id, stall_id, stalls(stall_number, section, monthly_rate, location)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", user!.id).single();
      const [paymentsRes, schedulesRes] = await Promise.all([
        supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").eq("status", "completed").order("created_at", { ascending: true }),
        vendor?.stall_id ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", vendor.stall_id).eq("year", selectedYear) : Promise.resolve({ data: [] }),
      ]);
      return { vendor, profile, payments: paymentsRes.data || [], stall: vendor?.stalls as any, schedules: schedulesRes.data || [] };
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const stall       = data?.stall;
  const profile     = data?.profile;
  const payments    = data?.payments || [];
  const schedules   = data?.schedules || [];
  const defaultRate = stall?.monthly_rate || 1450;
  const getMonthFee = (month: number) => {
    const s = schedules.find((s: any) => s.month === month);
    return s ? Number(s.amount) : defaultRate;
  };
  const monthlyRate  = defaultRate;
  const currentYear  = selectedYear;
  const currentMonth = selectedYear === thisYear ? new Date().getMonth() + 1 : 12;

  const rawPaidMap: Record<number, number> = {};
  payments.filter((p: any) => p.period_year === selectedYear).forEach((p: any) => {
    if (p.period_month) rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
  });

  const displayPaidMap: Record<number, number> = {};
  let carryOver = 0;
  for (let m = 1; m <= 12; m++) {
    const due      = getMonthFee(m);
    const credited = (rawPaidMap[m] || 0) + carryOver;
    displayPaidMap[m] = credited;
    if (credited >= due) {
      carryOver = credited - due;
    } else {
      carryOver = 0;
    }
  }

  const totalPaid = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);

  const totalOutstanding = MONTHS.reduce((sum, _, i) => {
    const m = i + 1;
    if (m > currentMonth) return sum;
    const due  = getMonthFee(m);
    const paid = displayPaidMap[m] || 0;
    return sum + Math.max(0, due - paid);
  }, 0);

  const monthsPaid = MONTHS.filter((_, i) => {
    const m = i + 1;
    return (displayPaidMap[m] || 0) >= getMonthFee(m);
  }).length;

  const rows = MONTHS.map((month, i) => {
    const m        = i + 1;
    const due      = getMonthFee(m);
    const credited = displayPaidMap[m] || 0;
    const displayPaid = Math.min(credited, due);
    const balance     = Math.max(0, due - credited);
    const isAdvance  = m > currentMonth && credited >= due;
    const isFuture   = m > currentMonth && credited === 0;
    const isFully    = credited >= due && !isAdvance;
    const isPartial  = credited > 0 && credited < due;
    return { month, monthNum: m, due, paid: displayPaid, balance, isFully, isPartial, isAdvance, isFuture };
  });

  const printData = { profile, stall, rows, totalPaid, totalOutstanding, currentYear, monthlyRate: defaultRate };

  const doPrint = () => {
    const frame = printRef.current;
    if (!frame) return;
    frame.srcdoc = getPrintHTML(printData);
    frame.onload = () => setTimeout(() => frame.contentWindow?.print(), 300);
  };

  return (
    <div className="space-y-0 -mx-4 -mt-4 lg:mx-0 lg:mt-0 lg:space-y-6">
      <iframe ref={printRef} style={{ display: "none" }} title="print-soa" />

      {/* Mobile mini-hero */}
      <div className="lg:hidden" style={{ background: DS.gradientHeader }}>
        <div className="px-5 pt-5 pb-5">
          <h1 className="text-2xl font-black text-white">Statement of Account</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>Official summary of your stall rental</p>
          <div className="flex gap-2.5 mt-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {[
              { label: "Total Paid",   value: fmt(totalPaid), green: true },
              { label: "Months Paid",  value: `${monthsPaid}/${currentMonth}` },
              { label: "Outstanding",  value: fmt(totalOutstanding), green: totalOutstanding === 0 },
            ].map(s => (
              <div key={s.label} className="shrink-0 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)", minWidth: 100 }}>
                <p className="font-mono text-base font-black"
                  style={{ color: s.green ? "#4ade80" : "white" }}>{s.value}</p>
                <p className="text-[9px] uppercase tracking-wide mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Statement of Account</h1>
          <p className="text-sm text-muted-foreground">Official summary of your stall rental</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              className="h-10 appearance-none rounded-xl border bg-card pl-3 pr-8 text-sm font-medium text-foreground shadow-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
              {availableYears.map(y => (
                <option key={y} value={y}>{y}{y === thisYear ? " (Current)" : ""}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button variant="outline" className="gap-2 rounded-xl" onClick={doPrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <Button variant="hero" className="gap-2 rounded-xl" onClick={doPrint}>
            <Download className="h-4 w-4" /> Save PDF
          </Button>
        </div>
      </div>

      {/* Desktop summary cards */}
      <div className="hidden lg:grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Monthly Rate",   value: fmt(monthlyRate),        color: "text-foreground",  icon: Calendar,     bg: "bg-secondary"   },
          { label: "Total Paid",     value: fmt(totalPaid),          color: "text-green-600",   icon: TrendingUp,   bg: "bg-green-50"    },
          { label: "Months Paid",    value: `${monthsPaid} / ${currentMonth}`, color: monthsPaid === currentMonth ? "text-green-600" : "text-blue-600", icon: CheckCircle2, bg: monthsPaid === currentMonth ? "bg-green-50" : "bg-blue-50" },
          { label: "Outstanding",    value: fmt(totalOutstanding),   color: totalOutstanding === 0 ? "text-green-600" : "text-accent", icon: AlertCircle, bg: totalOutstanding === 0 ? "bg-green-50" : "bg-accent/10" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
            </div>
            <p className={`font-mono text-lg font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Mobile actions bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100 gap-3">
        <div className="relative flex-1 min-w-0">
          <select
            className="h-9 w-full appearance-none rounded-xl border bg-white pl-3 pr-7 text-sm font-medium text-slate-900 cursor-pointer focus:outline-none"
            value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}{y === thisYear ? " (Current)" : ""}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={doPrint}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={doPrint}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold text-white"
            style={{ background: DS.blue600 }}>
            <Download className="h-3.5 w-3.5" /> Save PDF
          </button>
        </div>
      </div>

      {/* SOA Document */}
      <div className="mx-3 lg:mx-0 my-3 lg:my-0 rounded-2xl border bg-card shadow-civic overflow-hidden lg:max-w-3xl">

        {/* Document header */}
        <div style={{ background: DS.blue900 }} className="text-center px-6 py-5 space-y-0.5">
          <p className="text-xs tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>Republic of the Philippines</p>
          <p className="text-sm font-bold text-white">Municipality of San Juan, Batangas</p>
          <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>Office of the Municipal Treasurer</p>
          <p className="text-xl font-bold tracking-wide mt-2 text-white">STATEMENT OF ACCOUNT</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>Public Market Stall Rental — Fiscal Year {currentYear}</p>
        </div>

        <div className="p-4 lg:p-6 space-y-5">
          {/* Vendor info */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm rounded-2xl px-4 py-4 sm:grid-cols-3"
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            {[
              { label: "Vendor Name",  value: `${profile?.first_name} ${profile?.last_name}` },
              { label: "Stall Number", value: stall?.stall_number || "—" },
              { label: "Section",      value: stall?.section || "General" },
              { label: "Location",     value: stall?.location || "—" },
              { label: "Monthly Rate", value: fmt(monthlyRate) },
              { label: "Date Printed", value: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                <p className="font-semibold text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Payment table — ORIGINAL debit/credit format preserved */}
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: DS.blue900 }}>
                  <th className="px-4 py-2.5 text-left font-medium text-white text-xs">Period</th>
                  <th className="px-4 py-2.5 text-right font-medium text-white text-xs">Amount Due</th>
                  <th className="px-4 py-2.5 text-right font-medium text-white text-xs">Paid</th>
                  <th className="px-4 py-2.5 text-right font-medium text-white text-xs">Balance</th>
                  <th className="px-4 py-2.5 text-center font-medium text-white text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(r => (
                  <tr key={r.monthNum} className={`transition-colors hover:bg-slate-50 ${r.isFuture ? "opacity-40" : ""}`}>
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.month} {currentYear}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-foreground">{fmt(r.due)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">
                      {r.paid > 0
                        ? <span className="text-green-600 font-semibold">{fmt(r.paid)}</span>
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">
                      {(r.isFully || r.isAdvance)
                        ? <span className="text-green-600 font-mono">₱0.00</span>
                        : <span className={r.isFuture && !r.isPartial ? "text-muted-foreground" : "text-accent"}>{fmt(r.balance)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {r.isAdvance ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          ✦ Advance
                        </span>
                      ) : r.isFully ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Paid
                        </span>
                      ) : r.isPartial ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                          Partial
                        </span>
                      ) : r.isFuture && !r.isPartial ? (
                        <span className="text-xs text-muted-foreground">Upcoming</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                          <AlertCircle className="h-3 w-3" /> Unpaid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals — original format preserved */}
          <div className="rounded-xl border px-5 py-4 space-y-2 text-sm"
            style={{ background: "#f8fafc", borderColor: "#e2e8f0" }}>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Paid ({currentYear})</span>
              <span className="font-mono font-bold text-green-600">{fmt(totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold text-foreground">TOTAL OUTSTANDING BALANCE</span>
              <span className={`font-mono text-xl font-bold ${totalOutstanding === 0 ? "text-green-600" : "text-accent"}`}>
                {fmt(totalOutstanding)}
              </span>
            </div>
          </div>

          {totalOutstanding === 0 && (
            <div className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: "#dcfce7", border: "1px solid #86efac" }}>
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-800">All stall fees for {currentYear} are fully settled. 🎉</p>
            </div>
          )}

          {totalOutstanding > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-accent shrink-0" />
                <p className="text-sm text-accent font-medium">You have an outstanding balance of {fmt(totalOutstanding)}</p>
              </div>
              <Link to="/vendor/pay">
                <Button size="sm" variant="hero" className="shrink-0">Pay Now</Button>
              </Link>
            </div>
          )}

          {/* Signature lines */}
          <div className="grid grid-cols-3 gap-6 pt-4">
            {[
              { name: `${profile?.first_name} ${profile?.last_name}`, role: "Vendor / Lessee" },
              { name: "Cashier",             role: "Prepared by" },
              { name: "Municipal Treasurer", role: "Noted by" },
            ].map(s => (
              <div key={s.role} className="text-center">
                <div className="h-10" />
                <div className="border-t border-foreground/30 pt-2">
                  <p className="text-xs font-bold text-foreground uppercase">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.role}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground/50 border-t pt-3">
            PALENG-CLICK System · Computer-generated document ·{" "}
            {new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>

      <div className="h-4 lg:hidden" />

      {/* Unified bottom nav — mobile only */}
      <VendorBottomNav />
    </div>
  );
};

export default VendorStatement;