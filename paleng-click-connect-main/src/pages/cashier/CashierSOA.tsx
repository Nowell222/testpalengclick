import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Printer, Download, Loader2, User,
  CheckCircle2, AlertCircle, ChevronRight, X,
} from "lucide-react";
import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Helper: build SOA data for one vendor (with cascade + per-month fee schedules) ──
const buildSOA = (vendor: any, profile: any, payments: any[], schedules: any[] = []) => {
  const stall        = vendor.stalls as any;
  const defaultRate  = stall?.monthly_rate || 1450;
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Per-month fee: reads from fee schedules if set, else falls back to stall default rate
  const getMonthFee = (m: number): number => {
    const s = schedules.find((s: any) => s.month === m && s.year === currentYear);
    return s ? Number(s.amount) : defaultRate;
  };

  // ── STEP 1: Raw paid map from DB ─────────────────────────────────────────
  const rawPaidMap: Record<number, number> = {};
  (payments || [])
    .filter((p: any) => p.status === "completed" && p.period_year === currentYear)
    .forEach((p: any) => {
      if (p.period_month)
        rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
    });

  // ── STEP 2: Cascade using per-month fee — carry stops at partial month ───
  const effMap: Record<number, number> = {};
  let carry = 0;
  for (let m = 1; m <= 12; m++) {
    const due      = getMonthFee(m);
    const credited = (rawPaidMap[m] || 0) + carry;
    effMap[m]      = credited;
    carry          = credited >= due ? (credited - due) : 0;
  }

  // ── STEP 3: Summary totals ───────────────────────────────────────────────
  const totalPaid = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);

  const totalOutstanding = MONTHS.reduce((sum, _, i) => {
    const m = i + 1;
    if (m > currentMonth) return sum;
    return sum + Math.max(0, getMonthFee(m) - (effMap[m] || 0));
  }, 0);

  // ── STEP 4: Build rows with correct display values ───────────────────────
  const rows = MONTHS.map((name, i) => {
    const m           = i + 1;
    const due         = getMonthFee(m);
    const credited    = effMap[m] || 0;
    const displayPaid = Math.min(credited, due);
    const balance     = Math.max(0, due - credited);
    const isAdvance   = m > currentMonth && credited >= due;
    const isFully     = credited >= due && !isAdvance;
    const isPartial   = credited > 0 && credited < due && m <= currentMonth;
    const isFuture    = m > currentMonth && credited < due;
    return {
      month:    name,
      monthNum: m,
      due,
      paid:     displayPaid,
      balance,
      isFully,
      isPartial,
      isAdvance,
      isFuture,
    };
  });

  return {
    vendorId:   vendor.id,
    profile,
    stall,
    monthlyRate: defaultRate,
    currentYear,
    currentMonth,
    rows,
    totalPaid,
    totalOutstanding,
    allPayments: payments,
  };
};

// ─── Print styles (injected into a hidden iframe) ─────────────────────────────
const getPrintHTML = (soa: any) => {
  const rows = soa.rows.map((r: any) => `
    <tr class="${r.isFuture ? "future" : ""}">
      <td>${r.month} ${soa.currentYear}</td>
      <td class="num">₱${r.due.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
      <td class="num">${r.paid > 0 ? `₱${r.paid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}</td>
      <td class="num ${r.balance > 0 && !r.isFuture && !r.isAdvance ? "bal" : ""}">
        ${(r.isFully || r.isAdvance) ? "—" : `₱${r.balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
      </td>
      <td class="status ${r.isAdvance ? "advance" : r.isFully ? "paid" : r.isPartial ? "partial" : r.isFuture ? "future-s" : "unpaid"}">
        ${r.isAdvance ? "Advance" : r.isFully ? "✓ Paid" : r.isPartial ? "Partial" : r.isFuture ? "Upcoming" : "Unpaid"}
      </td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>SOA — ${soa.profile?.first_name} ${soa.profile?.last_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 32px; }
    .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 20px; }
    .header .republic { font-size: 10px; letter-spacing: 2px; color: #555; text-transform: uppercase; }
    .header .lgu { font-size: 13px; font-weight: bold; margin: 4px 0; }
    .header .title { font-size: 18px; font-weight: bold; letter-spacing: 1px; margin-top: 6px; }
    .header .subtitle { font-size: 10px; color: #555; margin-top: 2px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; padding: 12px; background: #f7f7f7; border: 1px solid #ddd; border-radius: 6px; }
    .info-item label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .info-item p { font-weight: bold; font-size: 13px; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #1a1a1a; color: white; }
    thead th { padding: 8px 10px; text-align: left; font-size: 11px; letter-spacing: 0.5px; }
    thead th.num { text-align: right; }
    tbody tr { border-bottom: 1px solid #e5e5e5; }
    tbody tr.future { opacity: 0.45; }
    tbody td { padding: 7px 10px; }
    td.num { text-align: right; font-family: monospace; }
    td.bal { color: #c0392b; font-weight: bold; }
    td.status { text-align: center; font-size: 11px; font-weight: bold; }
    td.paid { color: #27ae60; }
    td.partial { color: #2980b9; }
    td.unpaid { color: #c0392b; }
    td.advance { color: #1a56db; }
    td.future-s { color: #888; }
    .totals { border-top: 2px solid #1a1a1a; padding-top: 12px; margin-top: 4px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 10px; font-size: 12px; }
    .totals-row.outstanding { font-size: 15px; font-weight: bold; border-top: 1px solid #ddd; margin-top: 4px; padding-top: 8px; }
    .totals-row .lbl { color: #555; }
    .totals-row .val { font-family: monospace; font-weight: bold; }
    .totals-row.outstanding .val { color: #c0392b; }
    .totals-row.total-paid .val { color: #27ae60; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 32px; margin-top: 48px; }
    .sig-line { border-top: 1px solid #1a1a1a; padding-top: 6px; text-align: center; font-size: 10px; color: #555; }
    .sig-name { font-weight: bold; font-size: 12px; color: #1a1a1a; text-transform: uppercase; }
    .footer { margin-top: 32px; text-align: center; font-size: 9px; color: #aaa; border-top: 1px solid #ddd; padding-top: 10px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="republic">Republic of the Philippines</div>
    <div class="lgu">Municipality of San Juan, Batangas</div>
    <div class="lgu">Office of the Municipal Treasurer</div>
    <div class="title">STATEMENT OF ACCOUNT</div>
    <div class="subtitle">Public Market Stall Rental — Fiscal Year ${soa.currentYear}</div>
  </div>

  <div class="info-grid">
    <div class="info-item"><label>Vendor Name</label><p>${soa.profile?.first_name} ${soa.profile?.last_name}</p></div>
    <div class="info-item"><label>Stall Number</label><p>${soa.stall?.stall_number || "—"}</p></div>
    <div class="info-item"><label>Section</label><p>${soa.stall?.section || "General"}</p></div>
    <div class="info-item"><label>Monthly Rate</label><p>₱${Number(soa.monthlyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p></div>
    <div class="info-item"><label>Location</label><p>${soa.stall?.location || "—"}</p></div>
    <div class="info-item"><label>Date Printed</label><p>${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</p></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Period</th>
        <th class="num">Amount Due</th>
        <th class="num">Amount Paid</th>
        <th class="num">Balance</th>
        <th style="text-align:center">Status</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="totals-row total-paid">
      <span class="lbl">Total Paid (${soa.currentYear})</span>
      <span class="val">₱${soa.totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
    </div>
    <div class="totals-row outstanding">
      <span class="lbl">TOTAL OUTSTANDING BALANCE</span>
      <span class="val">₱${soa.totalOutstanding.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
    </div>
  </div>

  <div class="signatures">
    <div>
      <div style="height:40px"></div>
      <div class="sig-line">
        <div class="sig-name">${soa.profile?.first_name} ${soa.profile?.last_name}</div>
        Vendor / Lessee
      </div>
    </div>
    <div>
      <div style="height:40px"></div>
      <div class="sig-line">
        <div class="sig-name">Cashier</div>
        Prepared by
      </div>
    </div>
    <div>
      <div style="height:40px"></div>
      <div class="sig-line">
        <div class="sig-name">Municipal Treasurer</div>
        Noted by
      </div>
    </div>
  </div>

  <div class="footer">
    This is a computer-generated document. Printed on ${new Date().toLocaleString("en-PH")} · PALENG-CLICK System
  </div>
</body>
</html>`;
};

// ─── Component ────────────────────────────────────────────────────────────────
const CashierSOA = () => {
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [printing, setPrinting] = useState(false);
  const printFrameRef           = useRef<HTMLIFrameElement>(null);

  // Fetch ALL vendors at once for instant search
  const { data: allVendors = [], isLoading } = useQuery({
    queryKey: ["cashier-soa-vendors"],
    queryFn: async () => {
      const { data: vendorList } = await supabase
        .from("vendors")
        .select("id, user_id, stalls(stall_number, section, monthly_rate, location)");
      if (!vendorList) return [];

      const userIds = vendorList.map(v => v.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, contact_number, address, status")
        .in("user_id", userIds);

      return vendorList.map(v => {
        const profile = profiles?.find(p => p.user_id === v.user_id);
        const stall   = v.stalls as any;
        return {
          ...v,
          profile,
          stall,
          displayName: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
          stallNumber: stall?.stall_number || "—",
          section:     stall?.section || "General",
        };
      });
    },
  });

  // Filtered vendor list
  const filtered = useMemo(() => {
    if (!search.trim()) return allVendors;
    const q = search.toLowerCase();
    return allVendors.filter((v: any) =>
      v.displayName.toLowerCase().includes(q) ||
      v.stallNumber.toLowerCase().includes(q) ||
      v.section.toLowerCase().includes(q)
    );
  }, [allVendors, search]);

  // Load SOA for selected vendor (including per-month fee schedules)
  const loadSOA = async (vendor: any) => {
    const currentYear = new Date().getFullYear();
    const [paymentsRes, schedulesRes] = await Promise.all([
      supabase.from("payments").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: true }),
      vendor.stall?.id
        ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", vendor.stall.id).eq("year", currentYear)
        : Promise.resolve({ data: [] }),
    ]);
    const soa = buildSOA(vendor, vendor.profile, paymentsRes.data || [], schedulesRes.data || []);
    setSelected(soa);
  };

  // Print
  const handlePrint = () => {
    if (!selected) return;
    setPrinting(true);
    const html  = getPrintHTML(selected);
    const frame = printFrameRef.current;
    if (!frame) return;
    frame.srcdoc = html;
    frame.onload = () => {
      setTimeout(() => {
        frame.contentWindow?.print();
        setPrinting(false);
      }, 300);
    };
  };

  // Save as PDF (uses browser print-to-PDF)
  const handleSavePDF = () => {
    if (!selected) return;
    setPrinting(true);
    toast.info("In the print dialog, choose 'Save as PDF' as the destination.");
    const html  = getPrintHTML(selected);
    const frame = printFrameRef.current;
    if (!frame) return;
    frame.srcdoc = html;
    frame.onload = () => {
      setTimeout(() => {
        frame.contentWindow?.print();
        setPrinting(false);
      }, 300);
    };
  };

  return (
    <div className="space-y-6">
      {/* Hidden print iframe */}
      <iframe ref={printFrameRef} style={{ display: "none" }} title="print-frame" />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Statement of Account</h1>
        <p className="text-sm text-muted-foreground">Search vendors, view their SOA, and print or save as PDF</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ── LEFT: Vendor list ───────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or stall..."
              className="h-11 pl-10 rounded-xl"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <div className="border-b bg-secondary/50 px-4 py-2.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {filtered.length} vendor{filtered.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {filtered.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => loadSOA(v)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors ${
                      selected?.vendorId === v.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{v.displayName}</p>
                      <p className="text-xs text-muted-foreground">Stall {v.stallNumber} · {v.section}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">No vendors found</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: SOA Preview ───────────────────────────────────────────── */}
        <div>
          {!selected ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-card shadow-civic h-64 text-center gap-3">
              <Search className="h-10 w-10 text-muted-foreground/30" />
              <p className="font-medium text-muted-foreground">Select a vendor to view their SOA</p>
              <p className="text-sm text-muted-foreground/70">Click any vendor on the left</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Action bar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="font-bold text-foreground">{selected.profile?.first_name} {selected.profile?.last_name}</h2>
                  <p className="text-sm text-muted-foreground">Stall {selected.stall?.stall_number} · {selected.stall?.section}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2 rounded-xl" onClick={handlePrint} disabled={printing}>
                    {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    Print
                  </Button>
                  <Button variant="hero" className="gap-2 rounded-xl" onClick={handleSavePDF} disabled={printing}>
                    <Download className="h-4 w-4" />
                    Save as PDF
                  </Button>
                  <button onClick={() => setSelected(null)} className="rounded-xl p-2 hover:bg-secondary transition-colors">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* SOA Document Preview */}
              <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
                {/* Document header */}
                <div className="bg-foreground text-background px-6 py-5 text-center space-y-0.5">
                  <p className="text-xs tracking-widest uppercase opacity-70">Republic of the Philippines</p>
                  <p className="text-sm font-bold">Municipality of San Juan, Batangas</p>
                  <p className="text-sm font-bold">Office of the Municipal Treasurer</p>
                  <p className="text-xl font-bold tracking-wide mt-2">STATEMENT OF ACCOUNT</p>
                  <p className="text-xs opacity-60 mt-1">Public Market Stall Rental — Fiscal Year {selected.currentYear}</p>
                </div>

                <div className="p-6 space-y-5">
                  {/* Vendor info grid */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm rounded-xl bg-secondary/40 p-4 sm:grid-cols-3">
                    {[
                      { label: "Vendor Name",  value: `${selected.profile?.first_name} ${selected.profile?.last_name}` },
                      { label: "Stall Number", value: selected.stall?.stall_number || "—" },
                      { label: "Section",      value: selected.stall?.section || "General" },
                      { label: "Location",     value: selected.stall?.location || "—" },
                      { label: "Monthly Rate", value: `₱${Number(selected.monthlyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` },
                      { label: "Date Printed", value: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
                        <p className="font-semibold text-foreground mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Payment table */}
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-secondary/60 border-b">
                          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Period</th>
                          <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Amount Due</th>
                          <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Amount Paid</th>
                          <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Balance</th>
                          <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selected.rows.map((r: any) => (
                          <tr key={r.monthNum} className={`transition-colors hover:bg-secondary/20 ${r.isFuture ? "opacity-40" : ""}`}>
                            <td className="px-4 py-2.5 text-foreground font-medium">
                              {r.month} {selected.currentYear}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-foreground">
                              ₱{r.due.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono">
                              {r.paid > 0
                                ? <span className="text-success font-semibold">₱{r.paid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-semibold">
                              {(r.isFully || r.isAdvance)
                                ? <span className="text-muted-foreground">—</span>
                                : <span className={r.isFuture ? "text-muted-foreground" : "text-accent"}>
                                    ₱{r.balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                  </span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {r.isAdvance ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                                  Advance
                                </span>
                              ) : r.isFully ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-semibold text-success">
                                  <CheckCircle2 className="h-3 w-3" /> Paid
                                </span>
                              ) : r.isPartial ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                  Partial
                                </span>
                              ) : r.isFuture ? (
                                <span className="text-xs text-muted-foreground">Upcoming</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
                                  <AlertCircle className="h-3 w-3" /> Unpaid
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Totals */}
                  <div className="rounded-xl border bg-secondary/30 p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Paid ({selected.currentYear})</span>
                      <span className="font-mono font-bold text-success">
                        ₱{selected.totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between border-t pt-2">
                      <span className="font-semibold text-foreground">TOTAL OUTSTANDING BALANCE</span>
                      <span className={`font-mono text-lg font-bold ${selected.totalOutstanding > 0 ? "text-accent" : "text-success"}`}>
                        ₱{selected.totalOutstanding.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Signature lines */}
                  <div className="grid grid-cols-3 gap-6 pt-4">
                    {[
                      { name: `${selected.profile?.first_name} ${selected.profile?.last_name}`, role: "Vendor / Lessee" },
                      { name: "Cashier",             role: "Prepared by" },
                      { name: "Municipal Treasurer", role: "Noted by" },
                    ].map(s => (
                      <div key={s.role} className="text-center">
                        <div className="h-10" />
                        <div className="border-t border-foreground/40 pt-2">
                          <p className="text-xs font-bold text-foreground uppercase">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.role}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer note */}
                  <p className="text-center text-xs text-muted-foreground/60 border-t pt-3">
                    This is a computer-generated document · PALENG-CLICK System ·{" "}
                    {new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashierSOA;