import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, CheckCircle2, Loader2, Banknote,
  User, ArrowLeft, Printer, AlertCircle, Receipt,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const MONTHS_FULL = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const printReceipt = (data: any) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Official Receipt</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:20px;max-width:320px}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:12px}
  .rep{font-size:9px;letter-spacing:1px;color:#666;text-transform:uppercase}
  .lgu{font-size:13px;font-weight:bold}
  .ttl{font-size:16px;font-weight:bold;margin-top:4px}
  .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ddd;font-size:11px}
  .row .lbl{color:#555} .row .val{font-weight:bold;text-align:right}
  .amt{text-align:center;border:2px solid #111;border-radius:4px;padding:10px;margin:12px 0}
  .amt .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555}
  .amt .value{font-size:22px;font-weight:bold;font-family:monospace;margin-top:2px}
  .sig{margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .sig-line{border-top:1px solid #111;padding-top:4px;text-align:center;font-size:9px;color:#555}
  .footer{margin-top:14px;text-align:center;font-size:9px;color:#888;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines</div>
  <div class="lgu">Municipality of San Juan, Batangas</div>
  <div class="rep" style="margin-top:2px">Office of the Municipal Treasurer</div>
  <div class="ttl">OFFICIAL RECEIPT</div>
</div>
<div class="row"><span class="lbl">Receipt No.</span><span class="val" style="font-family:monospace">${data.receiptNumber||"—"}</span></div>
<div class="row"><span class="lbl">Reference No.</span><span class="val" style="font-family:monospace;font-size:9px">${data.refNumber||"—"}</span></div>
<div class="row"><span class="lbl">Date & Time</span><span class="val">${new Date().toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"})}</span></div>
<div style="height:6px"></div>
<div class="row"><span class="lbl">Vendor</span><span class="val">${data.vendorName}</span></div>
<div class="row"><span class="lbl">Stall No.</span><span class="val">${data.stallNumber}</span></div>
<div class="row"><span class="lbl">Section</span><span class="val">${data.section}</span></div>
<div class="row"><span class="lbl">Billing Period</span><span class="val">${data.period}</span></div>
<div class="row"><span class="lbl">Payment Type</span><span class="val">${data.payType}</span></div>
<div class="row"><span class="lbl">Method</span><span class="val">Cash at Cashier</span></div>
<div class="amt">
  <div class="label">Amount Paid</div>
  <div class="value">${fmt(data.amount)}</div>
</div>
<div class="sig">
  <div><div style="height:28px"></div><div class="sig-line"><b>${data.vendorName}</b><br/>Vendor / Payor</div></div>
  <div><div style="height:28px"></div><div class="sig-line"><b>${data.cashierName}</b><br/>Cashier / Collector</div></div>
</div>
<div class="footer">This receipt is valid proof of payment.<br/>PALENG-CLICK · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
};

const CashierAcceptPayment = () => {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [step,        setStep]        = useState<1|2|3>(1);
  const [searchTerm,  setSearchTerm]  = useState("");
  const [searching,   setSearching]   = useState(false);
  const [vendor,      setVendor]      = useState<any>(null);
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear,  setPeriodYear]  = useState(new Date().getFullYear());
  const [payType,     setPayType]     = useState<"full"|"partial">("full");
  const [amount,      setAmount]      = useState("");
  const [note,        setNote]        = useState("");
  const [receiptData, setReceiptData] = useState<any>(null);

  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const { data: cashierProfile } = useQuery({
    queryKey: ["cashier-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", user!.id).single();
      return data;
    },
  });

  useEffect(() => {
    const vendorId = searchParams.get("vendorId");
    if (vendorId) loadVendorById(vendorId);
  }, [searchParams]);

  const loadVendorData = async (v: any) => {
    const stallId = v.stall_id;
    const [profileRes, paymentsRes, schedulesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", v.user_id).single(),
      supabase.from("payments").select("period_month, period_year, amount, status")
        .eq("vendor_id", v.id).eq("status", "completed").eq("period_year", currentYear),
      stallId
        ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", stallId).eq("year", currentYear)
        : Promise.resolve({ data: [] }),
    ]);

    const stall     = v.stalls as any;
    const profile   = profileRes.data;
    const payments  = paymentsRes.data || [];
    const schedules = schedulesRes.data || [];
    const defaultRate = stall?.monthly_rate || 1450;

    const paidMap: Record<number, number> = {};
    payments.forEach((p: any) => {
      if (p.period_month) paidMap[p.period_month] = (paidMap[p.period_month] || 0) + Number(p.amount);
    });

    const getMonthFee = (month: number) => {
      const s = schedules.find((s: any) => s.month === month);
      return s ? Number(s.amount) : defaultRate;
    };

    // Find first unpaid month
    let nextUnpaid = currentMonth;
    for (let m = 1; m <= currentMonth; m++) {
      if ((paidMap[m] || 0) < getMonthFee(m)) { nextUnpaid = m; break; }
    }

    setVendor({ ...v, stall, profile, paidMap, schedules, defaultRate, getMonthFee, nextUnpaid });
    setPeriodMonth(nextUnpaid);
    setStep(2);
  };

  const loadVendorById = async (vendorId: string) => {
    setSearching(true);
    const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("id", vendorId).single();
    if (v) await loadVendorData(v);
    setSearching(false);
  };

  const searchVendor = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setVendor(null);

    const { data: stalls } = await supabase.from("stalls").select("id").ilike("stall_number", `%${searchTerm.trim()}%`);
    if (stalls?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("stall_id", stalls[0].id).single();
      if (v) { await loadVendorData(v); setSearching(false); return; }
    }

    const { data: profiles } = await supabase.from("profiles").select("user_id")
      .or(`first_name.ilike.%${searchTerm.trim()}%,last_name.ilike.%${searchTerm.trim()}%`);
    if (profiles?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("user_id", profiles[0].user_id).single();
      if (v) { await loadVendorData(v); setSearching(false); return; }
    }

    toast.error("No vendor found. Try stall number (e.g. G-001) or vendor name.");
    setSearching(false);
  };

  const monthFee    = vendor ? vendor.getMonthFee(periodMonth) : 1450;
  const alreadyPaid = vendor ? (vendor.paidMap[periodMonth] || 0) : 0;
  const remaining   = Math.max(0, monthFee - alreadyPaid);
  const payAmount   = payType === "full" ? remaining : (Number(amount) || 0);
  const isOverpaying = payAmount > remaining;

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (payAmount <= 0)       throw new Error("Amount must be greater than 0");
      if (isOverpaying)         throw new Error(`Cannot exceed remaining balance of ${fmt(remaining)}`);
      if (payType === "partial" && (!amount || Number(amount) <= 0)) throw new Error("Enter a valid partial amount");

      const { data, error } = await supabase.from("payments").insert({
        vendor_id:      vendor.id,
        stall_id:       vendor.stall_id || null,
        amount:         payAmount,
        payment_method: "cash",
        payment_type:   payType === "full" ? "due" : "staggered",
        status:         "completed",
        processed_by:   user?.id,
        period_month:   periodMonth,
        period_year:    periodYear,
        notes:          note || null,
      } as any).select("reference_number, receipt_number").single();
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: vendor.user_id,
        title:   "✅ Payment Received",
        message: `Your cash payment of ${fmt(payAmount)} for ${MONTHS_FULL[periodMonth-1]} ${periodYear} has been recorded by the cashier.`,
        type:    "confirmation",
      });

      return data;
    },
    onSuccess: (data) => {
      const cashierName = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      setReceiptData({
        vendorName:    `${vendor.profile?.first_name} ${vendor.profile?.last_name}`,
        stallNumber:   vendor.stall?.stall_number || "—",
        section:       vendor.stall?.section || "General",
        amount:        payAmount,
        payType:       payType === "full" ? "Full Payment" : "Partial Payment",
        period:        `${MONTHS_FULL[periodMonth-1]} ${periodYear}`,
        periodMonth, periodYear,
        refNumber:     data.reference_number || "",
        receiptNumber: data.receipt_number   || "",
        cashierName,
      });
      setStep(3);
      ["vendor-statement","vendor-pay-info","vendor-history","cashier-dashboard","cashier-payment-status","admin-payments","admin-dashboard"].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = () => {
    setStep(1); setVendor(null); setSearchTerm(""); setAmount("");
    setNote(""); setReceiptData(null);
    setPeriodMonth(currentMonth); setPeriodYear(currentYear); setPayType("full");
  };

  // ── Step 3: Receipt ──────────────────────────────────────────────────────────
  if (step === 3 && receiptData) return (
    <div className="max-w-lg space-y-5">
      <div className="flex flex-col items-center text-center py-6 gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payment Recorded!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {fmt(receiptData.amount)} · {receiptData.vendorName} · {receiptData.period}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="bg-foreground text-background text-center px-5 py-4">
          <p className="text-[10px] tracking-widest uppercase opacity-60">Republic of the Philippines</p>
          <p className="text-sm font-bold">Municipality of San Juan, Batangas</p>
          <p className="text-lg font-bold tracking-wide mt-1">OFFICIAL RECEIPT</p>
          <p className="text-[10px] opacity-50">Public Market Stall Rental</p>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm">
          {[
            { label: "Receipt No.",    value: receiptData.receiptNumber || "—", mono: true },
            { label: "Reference No.",  value: receiptData.refNumber || "—",     mono: true },
            { label: "Date & Time",    value: new Date().toLocaleString("en-PH",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}) },
            { label: "Vendor",         value: receiptData.vendorName              },
            { label: "Stall",          value: `${receiptData.stallNumber} · ${receiptData.section}` },
            { label: "Billing Period", value: receiptData.period                  },
            { label: "Payment Type",   value: receiptData.payType                 },
            { label: "Method",         value: "Cash at Cashier"                   },
          ].map(r => (
            <div key={r.label} className="flex justify-between border-b border-dashed border-border pb-1.5">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-medium text-foreground text-right ${r.mono ? "font-mono text-xs" : ""}`}>{r.value}</span>
            </div>
          ))}
          <div className="rounded-xl bg-success/10 border border-success/20 p-4 text-center mt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount Paid</p>
            <p className="font-mono text-3xl font-bold text-success">{fmt(receiptData.amount)}</p>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>Cashier: <strong className="text-foreground">{receiptData.cashierName}</strong></span>
            <span>Vendor: <strong className="text-foreground">{receiptData.vendorName}</strong></span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="hero" className="flex-1 gap-2 rounded-xl" onClick={() => printReceipt(receiptData)}>
          <Printer className="h-4 w-4" /> Print Receipt
        </Button>
        <Button variant="outline" className="flex-1 gap-2 rounded-xl" onClick={reset}>
          <Receipt className="h-4 w-4" /> New Payment
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Accept Payment</h1>
        <p className="text-sm text-muted-foreground">Record cash payments from vendors at the cashier window</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-0">
        {[{n:1,label:"Find Vendor"},{n:2,label:"Billing"},{n:3,label:"Confirm"}].map((s,i)=>(
          <div key={s.n} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${step===s.n?"bg-primary text-primary-foreground":step>s.n?"bg-success text-white":"bg-secondary text-muted-foreground"}`}>
                {step>s.n?<CheckCircle2 className="h-4 w-4"/>:s.n}
              </div>
              <span className={`text-[10px] mt-1 font-medium ${step>=s.n?"text-foreground":"text-muted-foreground"}`}>{s.label}</span>
            </div>
            {i<2&&<div className={`h-px w-16 mx-1 mb-4 ${step>s.n?"bg-success":"bg-border"}`}/>}
          </div>
        ))}
      </div>

      {/* ── STEP 1 ─────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
          <div>
            <h3 className="font-semibold text-foreground">Find Vendor</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Search by stall number (e.g. G-001) or vendor name</p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="G-001 or vendor name…"
                className="h-11 pl-10 rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchVendor()}
                autoFocus
              />
            </div>
            <Button onClick={searchVendor} disabled={searching || !searchTerm.trim()} className="rounded-xl px-5">
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {searching && <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        </div>
      )}

      {/* ── STEP 2 ─────────────────────────────────────────────────────────── */}
      {step === 2 && vendor && (
        <div className="space-y-4">
          <button onClick={() => { setStep(1); setVendor(null); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to search
          </button>

          {/* Vendor info */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">{vendor.profile?.first_name} {vendor.profile?.last_name}</p>
                <p className="text-xs text-muted-foreground">
                  Stall <span className="font-mono font-semibold text-foreground">{vendor.stall?.stall_number}</span>
                  {" · "}{vendor.stall?.section}
                  {vendor.profile?.contact_number && ` · ${vendor.profile.contact_number}`}
                </p>
              </div>
            </div>

            {/* Mini SOA grid */}
            <div className="mt-4 rounded-xl bg-secondary/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Payment Status — {currentYear}
              </p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {MONTHS_FULL.slice(0, currentMonth).map((m, i) => {
                  const mo       = i + 1;
                  const fee      = vendor.getMonthFee(mo);
                  const paid     = vendor.paidMap[mo] || 0;
                  const isFully  = paid >= fee;
                  const isPartial= paid > 0 && paid < fee;
                  const isSelected = mo === periodMonth;
                  return (
                    <button key={m}
                      onClick={() => { setPeriodMonth(mo); setAmount(""); }}
                      className={`rounded-lg px-1.5 py-2 text-center text-xs transition-all border ${
                        isSelected ? "ring-2 ring-primary border-primary bg-primary/10" :
                        isFully    ? "border-success/20 bg-success/10" :
                        isPartial  ? "border-primary/20 bg-primary/5"  :
                                     "border-accent/20 bg-accent/5 hover:bg-accent/10"
                      }`}>
                      <p className="font-medium text-foreground">{m.slice(0,3)}</p>
                      <p className={`text-[10px] font-semibold mt-0.5 ${isFully?"text-success":isPartial?"text-primary":"text-accent"}`}>
                        {isFully?"✓":isPartial?"~":"✗"}
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">Tap a month to select billing period</p>
            </div>
          </div>

          {/* Billing period */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
            <h3 className="font-semibold text-foreground">Billing Period</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  value={periodMonth} onChange={e => { setPeriodMonth(Number(e.target.value)); setAmount(""); }}>
                  {MONTHS_FULL.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))}>
                  {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-xl border bg-secondary/30 px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Fee ({MONTHS_FULL[periodMonth-1]})</span>
                <span className="font-mono text-foreground">{fmt(monthFee)}</span>
              </div>
              {alreadyPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="font-mono text-success">− {fmt(alreadyPaid)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold text-foreground">{alreadyPaid > 0 ? "Remaining" : "Amount Due"}</span>
                <span className={`font-mono text-xl font-bold ${remaining === 0 ? "text-success" : "text-foreground"}`}>
                  {fmt(remaining)}
                </span>
              </div>
              {remaining === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> This month is fully paid
                </div>
              )}
            </div>
          </div>

          {/* Payment amount */}
          {remaining > 0 && (
            <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
              <h3 className="font-semibold text-foreground">Payment Amount</h3>
              <div className="flex rounded-xl bg-secondary p-1">
                <button onClick={() => { setPayType("full"); setAmount(""); }}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType==="full"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
                  Full Payment
                </button>
                <button onClick={() => setPayType("partial")}
                  className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType==="partial"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
                  Partial
                </button>
              </div>

              {payType === "full" ? (
                <div className="rounded-xl border border-success/20 bg-success/5 px-4 py-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">Full payment</span>
                  <span className="font-mono font-bold text-success text-xl">{fmt(remaining)}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Partial Amount (₱)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₱</span>
                    <Input type="number" placeholder={`Max ${fmt(remaining)}`}
                      className={`h-11 pl-7 rounded-xl font-mono text-lg ${isOverpaying?"border-accent":""}`}
                      value={amount} onChange={e => setAmount(e.target.value)} max={remaining} />
                  </div>
                  {isOverpaying && (
                    <p className="text-xs text-accent flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> Exceeds remaining balance of {fmt(remaining)}
                    </p>
                  )}
                  {amount && Number(amount) > 0 && !isOverpaying && (
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Remaining after</span>
                      <span className="font-mono text-accent">{fmt(remaining - Number(amount))} still due</span>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Note (optional)</Label>
                <Input placeholder="e.g. Paid with ₱2,000 bill" className="h-10 rounded-xl text-sm"
                  value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </div>
          )}

          {/* Summary + confirm */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-success" />
              <h3 className="font-semibold text-foreground">Payment Summary</h3>
            </div>
            <div className="space-y-2 text-sm">
              {[
                { label: "Vendor",         value: `${vendor.profile?.first_name} ${vendor.profile?.last_name}` },
                { label: "Stall",          value: vendor.stall?.stall_number },
                { label: "Billing Period", value: `${MONTHS_FULL[periodMonth-1]} ${periodYear}` },
                { label: "Type",           value: payType === "full" ? "Full Payment" : "Partial Payment" },
                { label: "Method",         value: "Cash at Cashier" },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium text-foreground">{r.value}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold text-foreground">Amount to Collect</span>
                <span className="font-mono text-2xl font-bold text-foreground">{fmt(payAmount)}</span>
              </div>
            </div>
            <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl"
              disabled={recordPayment.isPending || payAmount <= 0 || isOverpaying || (payType==="partial" && !amount)}
              onClick={() => recordPayment.mutate()}>
              {recordPayment.isPending
                ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
                : <><CheckCircle2 className="h-5 w-5" /> Confirm & Record — {fmt(payAmount)}</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierAcceptPayment;