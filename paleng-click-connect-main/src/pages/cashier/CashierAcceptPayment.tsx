import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, CheckCircle2, CreditCard, Loader2, Banknote,
  User, Printer, AlertCircle, Receipt, Smartphone,
  Building2, X, RefreshCw, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const METHOD_CONFIG: Record<string,{icon:any;color:string;label:string}> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",  label: "GCash"     },
  paymaya:  { icon: Smartphone, color: "bg-green-600", label: "Maya"      },
  instapay: { icon: Building2,  color: "bg-primary",   label: "InstaPay"  },
  cash:     { icon: Banknote,   color: "bg-slate-500", label: "Cash"      },
};

// ─── Print receipt ──────────────────────────────────────────────────────────────
const doPrint = (d: any) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Official Receipt</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:24px;max-width:340px;margin:0 auto}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:14px}
  .rep{font-size:8px;letter-spacing:2px;color:#666;text-transform:uppercase}
  .lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .ttl{font-size:17px;font-weight:bold;letter-spacing:.5px;margin-top:4px}
  .sub{font-size:9px;color:#666;margin-top:1px}
  .row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px dashed #ddd}
  .row:last-child{border-bottom:none}
  .lbl{color:#555;font-size:10px} .val{font-weight:bold;text-align:right;font-size:11px}
  .val.mono{font-family:monospace;font-size:10px}
  .amt-box{text-align:center;border:2px solid #111;border-radius:6px;padding:12px;margin:14px 0}
  .amt-box .label{font-size:8px;text-transform:uppercase;letter-spacing:1.5px;color:#666}
  .amt-box .value{font-size:26px;font-weight:bold;font-family:monospace;margin-top:3px}
  .sigs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:32px}
  .sig-line{border-top:1px solid #111;padding-top:5px;text-align:center;font-size:9px;color:#555}
  .sig-name{font-weight:bold;font-size:10px;color:#111;text-transform:uppercase}
  .footer{margin-top:18px;text-align:center;font-size:8px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
  .badge{display:inline-block;border:1px solid #111;border-radius:4px;padding:2px 8px;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines</div>
  <div class="lgu">Municipality of San Juan, Batangas</div>
  <div class="rep" style="margin-top:2px">Office of the Municipal Treasurer · Public Market Division</div>
  <div class="ttl">OFFICIAL RECEIPT</div>
  <div class="sub">Public Market Stall Rental Payment</div>
</div>
<div class="row"><span class="lbl">Receipt No.</span><span class="val mono">${d.receiptNumber||"—"}</span></div>
<div class="row"><span class="lbl">Reference No.</span><span class="val mono">${d.refNumber||"—"}</span></div>
<div class="row"><span class="lbl">Date</span><span class="val">${new Date().toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}</span></div>
<div class="row"><span class="lbl">Time</span><span class="val">${new Date().toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</span></div>
<div style="height:8px"></div>
<div class="row"><span class="lbl">Vendor Name</span><span class="val">${d.vendorName}</span></div>
<div class="row"><span class="lbl">Stall Number</span><span class="val mono">${d.stallNumber}</span></div>
<div class="row"><span class="lbl">Section</span><span class="val">${d.section}</span></div>
<div class="row"><span class="lbl">Billing Period</span><span class="val">${d.period}</span></div>
<div class="row"><span class="lbl">Payment Type</span><span class="val">${d.payType}</span></div>
<div class="row"><span class="lbl">Payment Method</span><span class="val">${d.method}</span></div>
<div class="row"><span class="lbl">Processed by</span><span class="val">${d.cashierName}</span></div>
<div class="amt-box">
  <div class="label">Amount Paid</div>
  <div class="value">${fmt(d.amount)}</div>
</div>
<div class="sigs">
  <div><div style="height:32px"></div><div class="sig-line"><div class="sig-name">${d.vendorName}</div>Vendor / Payor</div></div>
  <div><div style="height:32px"></div><div class="sig-line"><div class="sig-name">${d.cashierName}</div>Cashier / Collector</div></div>
</div>
<div class="footer">This is your official proof of payment. Please keep for your records.<br/>PALENG-CLICK Market Payment System · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
};

// ─── Receipt Card component (shared across all tabs) ──────────────────────────
const ReceiptCard = ({ data, onNew }: { data: any; onNew: () => void }) => (
  <div className="max-w-sm mx-auto space-y-4">
    {/* Success header */}
    <div className="flex flex-col items-center text-center py-4 gap-2">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <div>
        <h3 className="text-xl font-bold text-foreground">Payment Recorded!</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {fmt(data.amount)} · {data.vendorName} · {data.period}
        </p>
      </div>
    </div>

    {/* Receipt document */}
    <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
      {/* Header */}
      <div className="bg-foreground text-background text-center px-5 py-4 space-y-0.5">
        <p className="text-[9px] tracking-[3px] uppercase opacity-50">Republic of the Philippines</p>
        <p className="text-xs font-bold">Municipality of San Juan, Batangas</p>
        <p className="text-[9px] opacity-50">Office of the Municipal Treasurer</p>
        <p className="text-lg font-bold tracking-widest mt-1">OFFICIAL RECEIPT</p>
        <p className="text-[9px] opacity-40">Public Market Stall Rental</p>
      </div>

      {/* Receipt details */}
      <div className="divide-y">
        {[
          { label: "Receipt No.",    value: data.receiptNumber || "—", mono: true  },
          { label: "Reference No.",  value: data.refNumber     || "—", mono: true  },
          { label: "Date & Time",    value: new Date().toLocaleString("en-PH",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}) },
          { label: "Vendor",         value: data.vendorName              },
          { label: "Stall",          value: `${data.stallNumber} · ${data.section}` },
          { label: "Billing Period", value: data.period                  },
          { label: "Payment Type",   value: data.payType                 },
          { label: "Method",         value: data.method                  },
          { label: "Processed by",   value: data.cashierName             },
        ].map(r => (
          <div key={r.label} className="flex items-center justify-between px-5 py-2.5">
            <span className="text-xs text-muted-foreground">{r.label}</span>
            <span className={`text-sm font-semibold text-foreground text-right ${r.mono ? "font-mono text-xs" : ""}`}>{r.value}</span>
          </div>
        ))}
      </div>

      {/* Amount box */}
      <div className="mx-4 my-3 rounded-xl border-2 border-success/30 bg-success/5 py-4 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Amount Paid</p>
        <p className="font-mono text-3xl font-bold text-success">{fmt(data.amount)}</p>
      </div>

      {/* Signature lines */}
      <div className="grid grid-cols-2 gap-4 px-5 py-4">
        {[{name: data.vendorName, role: "Vendor / Payor"},{name: data.cashierName, role: "Cashier / Collector"}].map(s => (
          <div key={s.role} className="text-center">
            <div className="h-8" />
            <div className="border-t border-foreground/30 pt-1.5">
              <p className="text-[10px] font-bold text-foreground uppercase truncate">{s.name}</p>
              <p className="text-[10px] text-muted-foreground">{s.role}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-[9px] text-muted-foreground/50 border-t px-4 py-2">
        PALENG-CLICK · Computer-generated receipt · {new Date().toLocaleString("en-PH")}
      </p>
    </div>

    {/* Actions */}
    <div className="flex gap-3">
      <Button variant="hero" className="flex-1 gap-2 rounded-xl" onClick={() => doPrint(data)}>
        <Printer className="h-4 w-4" /> Print Receipt
      </Button>
      <Button variant="outline" className="flex-1 gap-2 rounded-xl" onClick={onNew}>
        <Receipt className="h-4 w-4" /> New Payment
      </Button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// WALK-IN PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════
const WalkInPayment = ({ cashierProfile }: { cashierProfile: any }) => {
  const { user }    = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm,  setSearchTerm]  = useState("");
  const [searching,   setSearching]   = useState(false);
  const [vendor,      setVendor]      = useState<any>(null);
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear,  setPeriodYear]  = useState(new Date().getFullYear());
  const [payType,     setPayType]     = useState<"full"|"partial">("full");
  const [amount,      setAmount]      = useState("");
  const [receiptData, setReceiptData] = useState<any>(null);

  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const loadVendorData = async (v: any) => {
    const [profileRes, paymentsRes, schedulesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", v.user_id).single(),
      supabase.from("payments").select("period_month, amount")
        .eq("vendor_id", v.id).eq("status", "completed").eq("period_year", currentYear),
      v.stall_id
        ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", v.stall_id).eq("year", currentYear)
        : Promise.resolve({ data: [] }),
    ]);
    const stall     = v.stalls as any;
    const profile   = profileRes.data;
    const payments  = paymentsRes.data || [];
    const schedules = schedulesRes.data || [];
    const defRate   = stall?.monthly_rate || 1450;

    const rawPaidMap: Record<number,number> = {};
    payments.forEach((p: any) => {
      if (p.period_month) rawPaidMap[p.period_month] = (rawPaidMap[p.period_month]||0) + Number(p.amount);
    });

    const getMonthFee = (m: number) => {
      const s = schedules.find((s: any) => s.month === m);
      return s ? Number(s.amount) : defRate;
    };

    // Cascade excess payments forward
    // Rule: carry only moves to next month if current month is FULLY paid
    const paidMap: Record<number,number> = {};
    let carry = 0;
    for (let m = 1; m <= 12; m++) {
      const due_m    = getMonthFee(m);
      const credited = (rawPaidMap[m] || 0) + carry;
      paidMap[m]     = credited;
      carry          = credited >= due_m ? (credited - due_m) : 0;
    }

    let nextUnpaid = currentMonth;
    for (let m = 1; m <= currentMonth; m++) {
      if ((paidMap[m]||0) < getMonthFee(m)) { nextUnpaid = m; break; }
      if (m === currentMonth) nextUnpaid = currentMonth + 1;
    }

    setVendor({ ...v, stall, profile, paidMap, getMonthFee, nextUnpaid });
    setPeriodMonth(nextUnpaid);
    setAmount("");
  };

  const searchVendor = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true); setVendor(null);
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
    toast.error("No vendor found. Try stall number (e.g. G-001) or name.");
    setSearching(false);
  };

  const monthFee    = vendor ? vendor.getMonthFee(periodMonth) : 1450;
  const alreadyPaid = vendor ? (vendor.paidMap[periodMonth]||0) : 0;
  const remaining   = Math.max(0, monthFee - alreadyPaid);
  const payAmount   = payType === "full" ? remaining : (Number(amount)||0);
  const isOverpay   = payAmount > remaining;

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (payAmount <= 0) throw new Error("Amount must be greater than 0");
      if (isOverpay)      throw new Error(`Cannot exceed remaining balance of ${fmt(remaining)}`);
      if (payType==="partial" && (!amount||Number(amount)<=0)) throw new Error("Enter a valid partial amount");
      const { data, error } = await supabase.from("payments").insert({
        vendor_id:      vendor.id,
        stall_id:       vendor.stall_id || null,
        amount:         payAmount,
        payment_method: "cash",
        payment_type:   payType==="full" ? "due" : "staggered",
        status:         "completed",
        processed_by:   user?.id,
        period_month:   periodMonth,
        period_year:    periodYear,
      }).select("reference_number, receipt_number").single();
      if (error) throw error;
      const cn1 = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      await supabase.from("notifications").insert({
        user_id: vendor.user_id,
        title:   "✅ Cash Payment Received",
        message: `Your stall fee payment has been received and recorded by the cashier.

Payment Details:
• Vendor: ${vendor.profile?.first_name} ${vendor.profile?.last_name}
• Stall: ${vendor.stall?.stall_number} — ${vendor.stall?.section}
• Amount Paid: ${fmt(payAmount)}
• Billing Period: ${MONTHS_FULL[periodMonth-1]} ${periodYear}
• Payment Type: ${payType === "full" ? "Full Payment" : "Partial Payment"}
• Payment Method: Cash at Cashier
• Receipt No.: ${data.receipt_number || "—"}
• Reference No.: ${data.reference_number || "—"}
• Processed by: ${cn1}
• Date & Time: ${new Date().toLocaleString("en-PH", {year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}

Please keep your receipt as proof of payment. Thank you!`,
        type:    "confirmation",
      });
      return data;
    },
    onSuccess: (data) => {
      const cn = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      setReceiptData({
        vendorName:    `${vendor.profile?.first_name} ${vendor.profile?.last_name}`,
        stallNumber:   vendor.stall?.stall_number||"—",
        section:       vendor.stall?.section||"General",
        amount:        payAmount,
        payType:       payType==="full"?"Full Payment":"Partial Payment",
        period:        `${MONTHS_FULL[periodMonth-1]} ${periodYear}`,
        method:        "Cash at Cashier",
        refNumber:     data.reference_number||"",
        receiptNumber: data.receipt_number||"",
        cashierName:   cn,
      });
      ["vendor-statement","vendor-pay-info","vendor-history","cashier-dashboard","cashier-payment-status","admin-payments","admin-dashboard"]
        .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = () => {
    setVendor(null); setSearchTerm(""); setAmount("");
    setReceiptData(null); setPeriodMonth(currentMonth); setPeriodYear(currentYear); setPayType("full");
  };

  if (receiptData) return <ReceiptCard data={receiptData} onNew={reset} />;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by stall number (G-001) or vendor name…"
            className="h-11 pl-10 rounded-xl"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key==="Enter" && searchVendor()} />
        </div>
        <Button onClick={searchVendor} disabled={searching||!searchTerm.trim()} className="rounded-xl px-5 gap-1.5">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {vendor && (
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={reset} title="Clear">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {searching && !vendor && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}

      {vendor && (
        <>
          {/* Vendor card */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
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

            {/* Month tiles */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Payment Status — tap to select period
              </p>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {MONTHS_FULL.slice(0, currentMonth).map((m, i) => {
                  const mo       = i + 1;
                  const fee      = vendor.getMonthFee(mo);
                  const paid     = vendor.paidMap[mo]||0;
                  const isFully  = paid >= fee;
                  const isPartial= paid>0 && paid<fee;
                  const isSel    = mo === periodMonth;
                  return (
                    <button key={m} onClick={() => { setPeriodMonth(mo); setAmount(""); }}
                      className={`rounded-xl px-1 py-2.5 text-center text-xs transition-all border-2 ${
                        isSel     ? "border-primary bg-primary/10 shadow-sm" :
                        isFully   ? "border-success/30 bg-success/10"        :
                        isPartial ? "border-primary/20 bg-primary/5"         :
                                    "border-accent/20 bg-accent/5 hover:border-accent/40"
                      }`}>
                      <p className={`font-semibold ${isSel?"text-primary":"text-foreground"}`}>{m.slice(0,3)}</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${isFully?"text-success":isPartial?"text-primary":"text-accent"}`}>
                        {isFully?"✓ Paid":isPartial?"Partial":"Unpaid"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Billing & amount */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
            <h3 className="font-semibold text-foreground">Billing Period & Payment</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Month</Label>
                <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={periodMonth} onChange={e => { setPeriodMonth(Number(e.target.value)); setAmount(""); }}>
                  {MONTHS_FULL.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Year</Label>
                <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))}>
                  {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-xl border bg-secondary/40 px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Fee ({MONTHS_FULL[periodMonth-1]})</span>
                <span className="font-mono text-foreground">{fmt(monthFee)}</span>
              </div>
              {alreadyPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="font-mono text-success font-semibold">− {fmt(alreadyPaid)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold text-foreground">Balance Due</span>
                <span className={`font-mono text-xl font-bold ${remaining===0?"text-success":"text-foreground"}`}>{fmt(remaining)}</span>
              </div>
              {remaining===0 && (
                <p className="text-xs text-success flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5"/>This month is fully paid</p>
              )}
            </div>

            {remaining > 0 && (
              <>
                {/* Full / Partial toggle */}
                <div className="flex rounded-xl bg-secondary p-1">
                  <button onClick={() => { setPayType("full"); setAmount(""); }}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType==="full"?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>
                    Full — {fmt(remaining)}
                  </button>
                  <button onClick={() => setPayType("partial")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType==="partial"?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>
                    Partial Payment
                  </button>
                </div>

                {payType === "partial" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₱</span>
                      <Input type="number" placeholder={`Enter amount (max ${fmt(remaining)})`}
                        className={`h-11 pl-8 rounded-xl font-mono text-lg ${isOverpay?"border-accent ring-1 ring-accent":""}`}
                        value={amount} onChange={e => setAmount(e.target.value)} max={remaining} />
                    </div>
                    {isOverpay && (
                      <p className="text-xs text-accent flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5"/> Cannot exceed {fmt(remaining)}
                      </p>
                    )}
                    {amount && Number(amount)>0 && !isOverpay && Number(amount)<remaining && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        After this payment: <strong>{fmt(remaining - Number(amount))}</strong> still remaining for {MONTHS_FULL[periodMonth-1]}
                      </div>
                    )}
                  </div>
                )}

                <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl"
                  disabled={recordPayment.isPending||payAmount<=0||isOverpay||(payType==="partial"&&!amount)}
                  onClick={() => recordPayment.mutate()}>
                  {recordPayment.isPending
                    ? <><Loader2 className="h-5 w-5 animate-spin"/>Processing…</>
                    : <><Banknote className="h-5 w-5"/>Collect {fmt(payAmount)} — Cash</>}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const CashierAcceptPayment = () => {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [tab, setTab]  = useState<"online"|"walkin"|"manual">("online");

  // Cashier profile
  const { data: cashierProfile } = useQuery({
    queryKey: ["cashier-profile", user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", user!.id).single();
      return data;
    },
  });

  useEffect(() => {
    if (searchParams.get("vendorId")) setTab("walkin");
  }, [searchParams]);

  // ── Pending online payments ────────────────────────────────────────────────
  const { data: pending=[], isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["cashier-pending"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: payments } = await supabase.from("payments").select("*").eq("status","pending").order("created_at",{ascending:false});
      if (!payments?.length) return [];
      const vendorIds = [...new Set(payments.map(p=>p.vendor_id))];
      const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number, section)").in("id", vendorIds);
      const userIds = vendors?.map(v=>v.user_id)||[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return payments.map(p => {
        const v  = vendors?.find(v=>v.id===p.vendor_id);
        const pr = profiles?.find(pr=>pr.user_id===v?.user_id);
        const st = v?.stalls as any;
        return { ...p, vendor_name: pr?`${pr.first_name} ${pr.last_name}`:"Unknown", stall: st?.stall_number||"—", section: st?.section||"" };
      });
    },
  });

  // Online confirm/reject
  const [onlineReceipt, setOnlineReceipt] = useState<any>(null);

  const confirmPayment = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("payments").update({ status: "completed", processed_by: user?.id }).eq("id", p.id);
      if (error) throw error;
      // Resolve actual auth user_id from vendor record
      const { data: vendorRow } = await supabase.from("vendors").select("user_id").eq("id", p.vendor_id).single();
      const recipientUserId = vendorRow?.user_id;
      const cn2 = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      if (recipientUserId) {
        // Get stall info for the notification
        const { data: vendorInfo } = await supabase.from("vendors").select("stalls(stall_number, section)").eq("user_id", recipientUserId).single();
        const stallInfo = vendorInfo?.stalls as any;
        await supabase.from("notifications").insert({
          user_id: recipientUserId,
          title:   "✅ Online Payment Confirmed",
          message: `Your online payment has been confirmed and processed by the cashier.

Payment Details:
• Vendor: ${p.vendor_name}
• Stall: ${p.stall} — ${p.section}
• Amount Paid: ${fmt(Number(p.amount))}
• Billing Period: ${p.period_month ? MONTHS_FULL[p.period_month-1] : "—"} ${p.period_year || ""}
• Payment Method: ${METHOD_CONFIG[p.payment_method]?.label || p.payment_method}
• Payment Type: ${p.payment_type === "staggered" ? "Partial Payment" : "Full Payment"}
• Reference No.: ${p.reference_number || "—"}
• Receipt No.: ${p.receipt_number || "—"}
• Confirmed by: ${cn2}
• Date & Time: ${new Date().toLocaleString("en-PH", {year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}

Your payment is now complete. Thank you!`,
          type:    "confirmation",
        });
      }
      return p;
    },
    onSuccess: (p: any) => {
      const cn = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      setOnlineReceipt({
        vendorName:    p.vendor_name,
        stallNumber:   p.stall,
        section:       p.section,
        amount:        Number(p.amount),
        payType:       p.payment_type==="staggered"?"Partial Payment":"Full Payment",
        period:        p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—",
        method:        METHOD_CONFIG[p.payment_method]?.label||p.payment_method,
        refNumber:     p.reference_number||"",
        receiptNumber: p.receipt_number||"",
        cashierName:   cn,
      });
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      toast.success("Payment confirmed!");
    },
    onError: () => toast.error("Failed to confirm"),
  });

  const rejectPayment = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("payments").update({ status: "failed" }).eq("id", p.id);
      if (error) throw error;
      // Resolve vendor user_id for notification
      const { data: vendorRow } = await supabase.from("vendors").select("user_id").eq("id", p.vendor_id).single();
      const recipientUserId = vendorRow?.user_id;
      const cn = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      if (recipientUserId) {
        await supabase.from("notifications").insert({
          user_id: recipientUserId,
          title:   "❌ Payment Rejected",
          message: `Your ${METHOD_CONFIG[p.payment_method]?.label || p.payment_method} payment has been rejected by the cashier.

Payment Details:
• Vendor: ${p.vendor_name}
• Stall: ${p.stall} — ${p.section}
• Amount: ${fmt(Number(p.amount))}
• Billing Period: ${p.period_month ? MONTHS_FULL[p.period_month-1] : "—"} ${p.period_year || ""}
• Payment Method: ${METHOD_CONFIG[p.payment_method]?.label || p.payment_method}
• Reference No.: ${p.reference_number || "—"}
• Rejected by: ${cn}
• Date & Time: ${new Date().toLocaleString("en-PH", {year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}

Please contact the cashier or try paying again through another method.`,
          type: "overdue" as any,
        });
      }
    },
    onSuccess: () => { toast.success("Payment rejected — vendor notified."); refetchPending(); queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] }); },
    onError:   () => toast.error("Failed to reject"),
  });

  // ── Manual (quick) state ────────────────────────────────────────────────────
  const [manualSearch, setManualSearch] = useState("");
  const [manualVendor, setManualVendor] = useState<any>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [manualMethod, setManualMethod] = useState("cash");
  const [manualSearching, setManualSearching] = useState(false);
  const [manualReceipt, setManualReceipt] = useState<any>(null);

  const searchManual = async () => {
    if (!manualSearch.trim()) return;
    setManualSearching(true); setManualVendor(null);
    const { data: stalls } = await supabase.from("stalls").select("id, stall_number, section, monthly_rate").ilike("stall_number",`%${manualSearch}%`);
    if (stalls?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("stall_id", stalls[0].id).single();
      if (v) { const { data: pr } = await supabase.from("profiles").select("*").eq("user_id", v.user_id).single(); setManualVendor({...v,stall:v.stalls,profile:pr}); setManualAmount(String(stalls[0].monthly_rate)); setManualSearching(false); return; }
    }
    const { data: profiles } = await supabase.from("profiles").select("*").or(`first_name.ilike.%${manualSearch}%,last_name.ilike.%${manualSearch}%`);
    if (profiles?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("user_id", profiles[0].user_id).single();
      if (v) { setManualVendor({...v,stall:v.stalls,profile:profiles[0]}); setManualAmount(String((v.stalls as any)?.monthly_rate||1450)); setManualSearching(false); return; }
    }
    toast.error("Vendor not found"); setManualSearching(false);
  };

  const recordManual = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("payments").insert({
        vendor_id: manualVendor.id, stall_id: manualVendor.stall_id||null,
        amount: Number(manualAmount), payment_method: manualMethod,
        payment_type: "due", status: "completed", processed_by: user?.id,
        period_month: new Date().getMonth()+1, period_year: new Date().getFullYear(),
      }).select("reference_number, receipt_number").single();
      if (error) throw error;
      const cn3 = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      const now3 = new Date();
      await supabase.from("notifications").insert({
        user_id: manualVendor.user_id,
        title:   "✅ Payment Recorded by Cashier",
        message: `Your stall fee payment has been recorded by the cashier.

Payment Details:
• Vendor: ${manualVendor.profile?.first_name} ${manualVendor.profile?.last_name}
• Stall: ${(manualVendor.stall as any)?.stall_number} — ${(manualVendor.stall as any)?.section}
• Amount Paid: ${fmt(Number(manualAmount))}
• Billing Period: ${MONTHS_FULL[now3.getMonth()]} ${now3.getFullYear()}
• Payment Method: ${METHOD_CONFIG[manualMethod]?.label || manualMethod}
• Payment Type: Full Payment
• Receipt No.: ${data.receipt_number || "—"}
• Reference No.: ${data.reference_number || "—"}
• Processed by: ${cn3}
• Date & Time: ${now3.toLocaleString("en-PH", {year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}

Please keep your receipt as proof of payment. Thank you!`,
        type:    "confirmation",
      });
      return data;
    },
    onSuccess: (data) => {
      const cn = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      const now = new Date();
      setManualReceipt({
        vendorName:    `${manualVendor.profile?.first_name} ${manualVendor.profile?.last_name}`,
        stallNumber:   (manualVendor.stall as any)?.stall_number||"—",
        section:       (manualVendor.stall as any)?.section||"General",
        amount:        Number(manualAmount),
        payType:       "Full Payment",
        period:        `${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`,
        method:        METHOD_CONFIG[manualMethod]?.label||manualMethod,
        refNumber:     data.reference_number||"",
        receiptNumber: data.receipt_number||"",
        cashierName:   cn,
      });
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetManual = () => { setManualVendor(null); setManualSearch(""); setManualAmount(""); setManualReceipt(null); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Accept Payment</h1>
        <p className="text-sm text-muted-foreground">Confirm online payments, process walk-in cash, or record manually</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-secondary p-1">
        {[
          { id:"online",  label:"Online Payments", badge: pending.length },
          { id:"walkin",  label:"Walk-in / Cash"   },
          { id:"manual",  label:"Quick Manual"     },
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-medium transition-all ${tab===t.id?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {t.badge ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── ONLINE PAYMENTS ──────────────────────────────────────────────────── */}
      {tab==="online" && (
        onlineReceipt ? (
          <ReceiptCard data={onlineReceipt} onNew={() => setOnlineReceipt(null)} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{pending.length}</strong> pending payment{pending.length!==1?"s":""} awaiting confirmation
              </p>
              <button onClick={()=>refetchPending()} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <RefreshCw className="h-3 w-3"/>Refresh
              </button>
            </div>

            {pendingLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
            ) : pending.length===0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-2 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 opacity-20"/>
                <p className="font-medium">No pending payments</p>
                <p className="text-xs">All online payments are confirmed</p>
              </div>
            ) : (
              <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/50">
                      {["Vendor","Stall","Period","Amount","Method","Time","Action"].map(h=>(
                        <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pending.map((p:any) => {
                      const mc = METHOD_CONFIG[p.payment_method]||{icon:CreditCard,color:"bg-muted",label:p.payment_method};
                      const MI = mc.icon;
                      return (
                        <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{p.vendor_name}</td>
                          <td className="px-4 py-3 font-mono text-foreground">{p.stall}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—"}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">{fmt(Number(p.amount))}</td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`flex h-5 w-5 items-center justify-center rounded ${mc.color}`}><MI className="h-3 w-3 text-white"/></span>
                              <span className="text-xs text-muted-foreground">{mc.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1.5">
                              <Button size="sm"
                                className="h-7 text-xs bg-success hover:bg-success/90 text-white rounded-lg gap-1"
                                disabled={confirmPayment.isPending}
                                onClick={() => confirmPayment.mutate(p)}>
                                <CheckCircle2 className="h-3 w-3"/>Confirm
                              </Button>
                              <Button size="sm" variant="outline"
                                className="h-7 text-xs text-accent border-accent/30 hover:bg-accent/10 rounded-lg gap-1"
                                disabled={rejectPayment.isPending}
                                onClick={() => rejectPayment.mutate(p)}>
                                <X className="h-3 w-3"/>Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}

      {/* ── WALK-IN CASH ─────────────────────────────────────────────────────── */}
      {tab==="walkin" && <WalkInPayment cashierProfile={cashierProfile} />}

      {/* ── QUICK MANUAL ─────────────────────────────────────────────────────── */}
      {tab==="manual" && (
        manualReceipt ? (
          <ReceiptCard data={manualReceipt} onNew={resetManual} />
        ) : (
          <div className="max-w-lg space-y-4">
            <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-3">
              <h3 className="font-semibold text-foreground">Search Vendor</h3>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                  <Input placeholder="Name or stall number…" className="h-11 pl-10 rounded-xl"
                    value={manualSearch} onChange={e=>setManualSearch(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&searchManual()}/>
                </div>
                <Button onClick={searchManual} disabled={manualSearching} className="rounded-xl">
                  {manualSearching?<Loader2 className="h-4 w-4 animate-spin"/>:"Search"}
                </Button>
              </div>
            </div>

            {manualSearching&&!manualVendor&&<div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}

            {manualVendor && (
              <>
                <div className="rounded-2xl border bg-card p-5 shadow-civic">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10"><User className="h-4 w-4 text-primary"/></div>
                    <div>
                      <p className="font-semibold text-foreground">{manualVendor.profile?.first_name} {manualVendor.profile?.last_name}</p>
                      <p className="text-xs text-muted-foreground">Stall <span className="font-mono">{(manualVendor.stall as any)?.stall_number}</span> · {(manualVendor.stall as any)?.section}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                    <div><p>Contact</p><p className="font-medium text-foreground">{manualVendor.profile?.contact_number||"—"}</p></div>
                    <div><p>Default Rate</p><p className="font-mono font-medium text-foreground">{fmt((manualVendor.stall as any)?.monthly_rate||1450)}</p></div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
                  <h3 className="font-semibold text-foreground">Payment Details</h3>
                  <div className="space-y-1.5">
                    <Label>Amount (₱)</Label>
                    <Input value={manualAmount} onChange={e=>setManualAmount(e.target.value)} className="h-11 rounded-xl font-mono text-lg" placeholder="0.00"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={manualMethod} onChange={e=>setManualMethod(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="paymaya">Maya</option>
                      <option value="instapay">InstaPay</option>
                    </select>
                  </div>
                  <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl"
                    onClick={()=>recordManual.mutate()} disabled={recordManual.isPending||!manualAmount}>
                    {recordManual.isPending?<><Loader2 className="h-5 w-5 animate-spin"/>Recording…</>:<><CreditCard className="h-5 w-5"/>Record Payment — {manualAmount?fmt(Number(manualAmount)):"₱0.00"}</>}
                  </Button>
                </div>
              </>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default CashierAcceptPayment;