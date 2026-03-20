import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, CheckCircle2, CreditCard, Loader2, Printer,
  Smartphone, Building2, Banknote, Clock, Store, X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const METHOD_LABELS: Record<string, string> = {
  cash:"Cash", gcash:"GCash", paymaya:"Maya", instapay:"InstaPay / Bank",
};

// ─── Print receipt ──────────────────────────────────────────────────────────────
const printReceipt = (r: any) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Receipt</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:24px;max-width:320px;margin:0 auto}
.hdr{text-align:center;padding-bottom:12px;margin-bottom:12px;border-bottom:2px solid #111}
.rep{font-size:8px;letter-spacing:2px;color:#666;text-transform:uppercase}
.lgu{font-size:12px;font-weight:bold;margin:2px 0}
.ttl{font-size:16px;font-weight:bold;margin-top:6px;letter-spacing:1px}
.sub{font-size:9px;color:#666}
.status{background:#e8f8f0;border:1px solid #27ae60;border-radius:4px;color:#27ae60;font-weight:bold;font-size:12px;text-align:center;padding:6px;margin:10px 0}
.row{display:flex;justify-content:space-between;padding:4px 0;font-size:11px}
.row .lbl{color:#666}
.row .val{font-weight:bold;text-align:right;max-width:60%}
.divider{border-top:1px dashed #aaa;margin:8px 0}
.big-amt{display:flex;justify-content:space-between;font-size:17px;font-weight:bold;border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin:8px 0;padding:8px 0}
.ref-box{border:1px dashed #aaa;border-radius:4px;padding:8px;text-align:center;margin:10px 0}
.ref-box .lbl{font-size:9px;color:#888;margin-bottom:4px}
.ref-box .val{font-family:monospace;font-size:14px;font-weight:bold;letter-spacing:1px}
.footer{text-align:center;font-size:9px;color:#888;margin-top:14px;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines</div>
  <div class="lgu">Municipality of San Juan, Batangas</div>
  <div class="lgu">Office of the Municipal Treasurer</div>
  <div class="ttl">OFFICIAL RECEIPT</div>
  <div class="sub">Public Market Stall Rental</div>
</div>
<div class="status">✓ PAYMENT CONFIRMED</div>
<div class="row"><span class="lbl">Date</span><span class="val">${new Date(r.processedAt).toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}</span></div>
<div class="row"><span class="lbl">Time</span><span class="val">${new Date(r.processedAt).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</span></div>
<div class="divider"></div>
<div class="row"><span class="lbl">Vendor</span><span class="val">${r.vendorName}</span></div>
<div class="row"><span class="lbl">Stall No.</span><span class="val">${r.stall}</span></div>
<div class="row"><span class="lbl">Section</span><span class="val">${r.section}</span></div>
<div class="row"><span class="lbl">For Period</span><span class="val">${MONTHS[r.periodMonth-1]} ${r.periodYear}</span></div>
<div class="row"><span class="lbl">Method</span><span class="val">${METHOD_LABELS[r.method]||r.method}</span></div>
<div class="row"><span class="lbl">Type</span><span class="val">${r.payType==="staggered"?"Partial Payment":"Full Payment"}</span></div>
<div class="divider"></div>
<div class="big-amt"><span>AMOUNT PAID</span><span>${fmt(r.amount)}</span></div>
<div class="row"><span class="lbl">Reference No.</span><span class="val" style="font-family:monospace">${r.referenceNumber||"—"}</span></div>
<div class="row"><span class="lbl">Receipt No.</span><span class="val" style="font-family:monospace">${r.receiptNumber||"—"}</span></div>
<div class="ref-box"><div class="lbl">Reference for Verification</div><div class="val">${r.referenceNumber||r.receiptNumber||"—"}</div></div>
<div class="footer">PALENG-CLICK System · Computer-generated receipt<br/>${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(()=>{ frame.contentWindow?.print(); document.body.removeChild(frame); },300); };
};

// ─── Send notification ──────────────────────────────────────────────────────────
const sendPaymentNotification = async (vendorUserId: string, r: any) => {
  const period = `${MONTHS[r.periodMonth-1]} ${r.periodYear}`;
  await supabase.from("notifications").insert({
    user_id: vendorUserId,
    title:   `✅ Payment Confirmed — ${period}`,
    message: `Your stall fee of ${fmt(r.amount)} for ${period} has been received and confirmed. Method: ${METHOD_LABELS[r.method]||r.method} · Stall: ${r.stall} · Ref: ${r.referenceNumber||"—"}`,
    type:    "confirmation" as any,
  });
};

// ─── Component ─────────────────────────────────────────────────────────────────
const CashierAcceptPayment = () => {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [tab,         setTab]         = useState<"manual"|"pending">("manual");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [vendor,      setVendor]      = useState<any>(null);
  const [amount,      setAmount]      = useState("");
  const [method,      setMethod]      = useState("cash");
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth()+1);
  const [periodYear,  setPeriodYear]  = useState(new Date().getFullYear());
  const [payType,     setPayType]     = useState<"due"|"staggered">("due");
  const [done,        setDone]        = useState(false);
  const [receipt,     setReceipt]     = useState<any>(null);
  const [searching,   setSearching]   = useState(false);

  useEffect(()=>{ const id=searchParams.get("vendorId"); if(id) loadVendorById(id); },[searchParams]);

  const loadVendorById = async (id: string) => {
    setSearching(true);
    const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("id",id).single();
    if (v) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id",v.user_id).single();
      setVendor({...v, stall:v.stalls, profile});
      setAmount(String((v.stalls as any)?.monthly_rate||1450));
    }
    setSearching(false);
  };

  const searchVendor = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const { data: stalls } = await supabase.from("stalls").select("id, stall_number, section, monthly_rate").ilike("stall_number",`%${searchTerm}%`);
    if (stalls?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("stall_id",stalls[0].id).single();
      if (v) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("user_id",v.user_id).single();
        setVendor({...v, stall:v.stalls, profile}); setAmount(String(stalls[0].monthly_rate)); setSearching(false); return;
      }
    }
    const { data: profiles } = await supabase.from("profiles").select("*").or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
    if (profiles?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("user_id",profiles[0].user_id).single();
      if (v) { setVendor({...v, stall:v.stalls, profile:profiles[0]}); setAmount(String((v.stalls as any)?.monthly_rate||1450)); setSearching(false); return; }
    }
    toast.error("Vendor not found"); setSearching(false);
  };

  // Fetch pending payments
  const { data: pendingPayments=[], isLoading: pendingLoading } = useQuery({
    queryKey: ["cashier-pending"],
    enabled: tab==="pending",
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: pmts } = await supabase.from("payments").select("*").eq("status","pending").order("created_at",{ascending:false});
      if (!pmts?.length) return [];
      const vids = [...new Set(pmts.map(p=>p.vendor_id))];
      const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number, section)").in("id",vids);
      const uids = vendors?.map(v=>v.user_id)||[];
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id",uids);
      return pmts.map(p=>{
        const v=vendors?.find(v=>v.id===p.vendor_id), pr=profiles?.find(pr=>pr.user_id===v?.user_id), st=v?.stalls as any;
        return {...p, vendor_name:pr?`${pr.first_name} ${pr.last_name}`:"Unknown", vendor_user_id:v?.user_id, stall:st?.stall_number||"—", section:st?.section||"General"};
      });
    },
  });

  // Record manual payment
  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!vendor||!amount) throw new Error("Missing vendor or amount");
      const { data, error } = await supabase.from("payments").insert({
        vendor_id:vendor.id, stall_id:vendor.stall_id||null, amount:Number(amount),
        payment_method:method, payment_type:payType, status:"completed",
        processed_by:user?.id, period_month:periodMonth, period_year:periodYear,
      }).select("id, reference_number, receipt_number, created_at").single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      const st = vendor.stall as any;
      const r = {
        vendorName:`${vendor.profile?.first_name} ${vendor.profile?.last_name}`,
        stall:st?.stall_number||"—", section:st?.section||"General",
        amount:Number(amount), method, payType, periodMonth, periodYear,
        referenceNumber:data.reference_number||"", receiptNumber:data.receipt_number||"",
        processedAt:data.created_at||new Date().toISOString(),
      };
      setReceipt(r); setDone(true);
      await sendPaymentNotification(vendor.user_id, r);
      queryClient.invalidateQueries({ queryKey:["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey:["cashier-payment-status"] });
      queryClient.invalidateQueries({ queryKey:["admin-payments"] });
      queryClient.invalidateQueries({ queryKey:["vendor-history"] });
      queryClient.invalidateQueries({ queryKey:["vendor-dashboard"] });
    },
    onError:(e:any)=>toast.error(e.message),
  });

  // Confirm pending
  const confirmPending = useMutation({
    mutationFn: async (p:any) => {
      const { error } = await supabase.from("payments").update({status:"completed",processed_by:user?.id}).eq("id",p.id);
      if (error) throw error; return p;
    },
    onSuccess: async (p) => {
      const r = {
        vendorName:p.vendor_name, stall:p.stall, section:p.section,
        amount:Number(p.amount), method:p.payment_method, payType:p.payment_type,
        periodMonth:p.period_month||new Date().getMonth()+1, periodYear:p.period_year||new Date().getFullYear(),
        referenceNumber:p.reference_number||"", receiptNumber:p.receipt_number||"",
        processedAt:new Date().toISOString(),
      };
      setReceipt(r); setDone(true); setTab("manual");
      if (p.vendor_user_id) await sendPaymentNotification(p.vendor_user_id, r);
      queryClient.invalidateQueries({ queryKey:["cashier-pending"] });
      queryClient.invalidateQueries({ queryKey:["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey:["admin-payments"] });
      queryClient.invalidateQueries({ queryKey:["vendor-history"] });
      queryClient.invalidateQueries({ queryKey:["vendor-dashboard"] });
    },
    onError:(e:any)=>toast.error(e.message),
  });

  const reset = () => {
    setDone(false); setVendor(null); setSearchTerm(""); setAmount(""); setReceipt(null);
    setMethod("cash"); setPayType("due"); setPeriodMonth(new Date().getMonth()+1); setPeriodYear(new Date().getFullYear());
  };

  // ── Receipt / Success screen ─────────────────────────────────────────────────
  if (done && receipt) return (
    <div className="max-w-md mx-auto space-y-5">
      <div className="flex flex-col items-center py-6 gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Payment Confirmed!</h2>
        <p className="text-sm text-muted-foreground">Notification sent to {receipt.vendorName}</p>
      </div>

      {/* Receipt card */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="bg-foreground text-background text-center px-5 py-4">
          <p className="text-[10px] tracking-widest uppercase opacity-60">Republic of the Philippines</p>
          <p className="text-xs font-bold">Municipality of San Juan, Batangas</p>
          <p className="text-xs font-bold">Office of the Municipal Treasurer</p>
          <p className="text-lg font-bold tracking-wide mt-1">OFFICIAL RECEIPT</p>
          <p className="text-[10px] opacity-50 mt-0.5">Public Market Stall Rental</p>
        </div>
        <div className="bg-success/10 border-b border-success/20 px-5 py-2 flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success"/>
          <span className="text-sm font-bold text-success">PAYMENT CONFIRMED</span>
        </div>
        <div className="px-5 py-4 space-y-2.5 text-sm">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Date & Time</span>
            <span className="font-medium">
              {new Date(receipt.processedAt).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}
              {" · "}
              {new Date(receipt.processedAt).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}
            </span>
          </div>
          {[
            {l:"Vendor",     v:receipt.vendorName},
            {l:"Stall No.",  v:receipt.stall},
            {l:"Section",    v:receipt.section},
            {l:"For Period", v:`${MONTHS[receipt.periodMonth-1]} ${receipt.periodYear}`},
            {l:"Method",     v:METHOD_LABELS[receipt.method]||receipt.method},
            {l:"Type",       v:receipt.payType==="staggered"?"Partial Payment":"Full Payment"},
          ].map(r=>(
            <div key={r.l} className="flex justify-between">
              <span className="text-muted-foreground">{r.l}</span>
              <span className="font-medium text-foreground">{r.v}</span>
            </div>
          ))}
          <div className="h-px bg-border"/>
          <div className="flex justify-between items-center py-1">
            <span className="font-bold text-foreground">AMOUNT PAID</span>
            <span className="font-mono text-2xl font-bold text-success">{fmt(receipt.amount)}</span>
          </div>
          <div className="h-px bg-border"/>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Reference No.</span>
            <span className="font-mono font-bold text-foreground">{receipt.referenceNumber||"—"}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Receipt No.</span>
            <span className="font-mono font-bold text-foreground">{receipt.receiptNumber||"—"}</span>
          </div>
          <div className="rounded-xl border-2 border-dashed border-border p-3 text-center mt-1">
            <p className="text-xs text-muted-foreground mb-1">Reference for Verification</p>
            <p className="font-mono text-base font-bold text-foreground tracking-widest">
              {receipt.referenceNumber||receipt.receiptNumber||"—"}
            </p>
          </div>
          <p className="text-center text-[10px] text-muted-foreground">
            Computer-generated receipt · PALENG-CLICK System
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2 rounded-xl" onClick={()=>printReceipt(receipt)}>
          <Printer className="h-4 w-4"/> Print Receipt
        </Button>
        <Button variant="hero" className="flex-1 gap-2 rounded-xl" onClick={reset}>
          <CreditCard className="h-4 w-4"/> New Payment
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Accept Payment</h1>
        <p className="text-sm text-muted-foreground">Confirm cash and online payments — notification sent automatically</p>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1 max-w-xs">
        <button onClick={()=>setTab("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab==="manual"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
          <CreditCard className="h-3.5 w-3.5"/> Manual Entry
        </button>
        <button onClick={()=>setTab("pending")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${tab==="pending"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5"/> Pending
          {pendingPayments.length>0&&(
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] text-white font-bold">
              {pendingPayments.length}
            </span>
          )}
        </button>
      </div>

      {/* ── MANUAL ENTRY ──────────────────────────────────────────────────────── */}
      {tab==="manual"&&(
        <div className="space-y-5">
          {/* Search */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-3">
            <p className="text-sm font-semibold text-foreground">Search Vendor</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                <Input placeholder="Name or stall number…" className="h-11 pl-10 rounded-xl"
                  value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&searchVendor()}/>
              </div>
              <Button onClick={searchVendor} disabled={searching} className="h-11 rounded-xl">
                {searching?<Loader2 className="h-4 w-4 animate-spin"/>:"Search"}
              </Button>
            </div>
          </div>

          {searching&&!vendor&&<div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}

          {vendor&&(
            <>
              {/* Vendor info */}
              <div className="rounded-2xl border bg-card p-5 shadow-civic">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Store className="h-5 w-5 text-primary"/>
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{vendor.profile?.first_name} {vendor.profile?.last_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Stall <span className="font-mono font-semibold">{(vendor.stall as any)?.stall_number}</span>
                        {" · "}{(vendor.stall as any)?.section}
                      </p>
                      <p className="text-xs text-muted-foreground">{vendor.profile?.contact_number||"—"}</p>
                    </div>
                  </div>
                  <button onClick={()=>setVendor(null)} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
                    <X className="h-4 w-4 text-muted-foreground"/>
                  </button>
                </div>
              </div>

              {/* Payment form */}
              <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
                <p className="text-sm font-semibold text-foreground">Payment Details</p>

                {/* Period */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Billing Month</Label>
                    <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                      value={periodMonth} onChange={e=>setPeriodMonth(Number(e.target.value))}>
                      {MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Year</Label>
                    <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                      value={periodYear} onChange={e=>setPeriodYear(Number(e.target.value))}>
                      {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                {/* Amount */}
                <div className="space-y-1.5">
                  <Label>Amount (₱)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₱</span>
                    <Input type="number" className="h-11 rounded-xl pl-7 font-mono text-lg"
                      value={amount} onChange={e=>setAmount(e.target.value)}/>
                  </div>
                </div>

                {/* Method */}
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {id:"cash",     label:"Cash",            icon:Banknote,   bg:"bg-slate-500"},
                      {id:"gcash",    label:"GCash",           icon:Smartphone, bg:"bg-blue-500"},
                      {id:"paymaya",  label:"Maya",            icon:Smartphone, bg:"bg-green-600"},
                      {id:"instapay", label:"InstaPay / Bank", icon:Building2,  bg:"bg-primary"},
                    ].map(m=>(
                      <button key={m.id} onClick={()=>setMethod(m.id)}
                        className={`flex items-center gap-2.5 rounded-xl border p-3 text-sm font-medium transition-all ${method===m.id?"border-primary bg-primary/5 ring-2 ring-primary/20":"bg-card hover:bg-secondary/40"}`}>
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${m.bg}`}>
                          <m.icon className="h-3.5 w-3.5 text-white"/>
                        </div>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment type */}
                <div className="flex rounded-xl bg-secondary p-1">
                  <button onClick={()=>setPayType("due")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType==="due"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
                    Full Payment
                  </button>
                  <button onClick={()=>setPayType("staggered")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType==="staggered"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
                    Partial
                  </button>
                </div>

                {/* Summary */}
                <div className="rounded-xl bg-secondary/50 px-4 py-3 flex justify-between text-sm">
                  <span className="text-muted-foreground">{MONTHS[periodMonth-1]} {periodYear} · {METHOD_LABELS[method]}</span>
                  <span className="font-mono font-bold text-foreground">{amount?fmt(Number(amount)):"—"}</span>
                </div>

                <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl"
                  onClick={()=>recordPayment.mutate()} disabled={recordPayment.isPending||!vendor||!amount}>
                  {recordPayment.isPending
                    ? <><Loader2 className="h-5 w-5 animate-spin"/> Processing…</>
                    : <><CheckCircle2 className="h-5 w-5"/> Confirm & Record Payment</>}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PENDING PAYMENTS ─────────────────────────────────────────────────── */}
      {tab==="pending"&&(
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">{pendingPayments.length}</strong> payments awaiting confirmation
          </p>
          {pendingLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
          ) : pendingPayments.length===0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 text-success opacity-60"/>
              <p className="font-medium">No pending payments</p>
            </div>
          ) : pendingPayments.map((p:any)=>(
            <div key={p.id} className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <div className="flex items-start justify-between px-5 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Clock className="h-4 w-4 text-amber-600"/>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{p.vendor_name}</p>
                    <p className="text-xs text-muted-foreground">Stall <span className="font-mono">{p.stall}</span> · {p.section}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}
                      {" · "}{new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xl font-bold text-foreground">{fmt(Number(p.amount))}</p>
                  <p className="text-xs text-muted-foreground">{p.period_month?`${MONTHS[p.period_month-1]} ${p.period_year}`:"—"}</p>
                </div>
              </div>
              <div className="h-px bg-border mx-5"/>
              <div className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="bg-secondary px-2 py-0.5 rounded capitalize">{METHOD_LABELS[p.payment_method]||p.payment_method}</span>
                  <span className="bg-secondary px-2 py-0.5 rounded">{p.payment_type==="staggered"?"Partial":"Full"}</span>
                  {p.reference_number&&<span className="font-mono bg-secondary px-2 py-0.5 rounded">Ref: {p.reference_number}</span>}
                </div>
                <Button size="sm"
                  className="h-8 bg-success hover:bg-success/90 text-white rounded-xl gap-1.5 shrink-0"
                  disabled={confirmPending.isPending}
                  onClick={()=>confirmPending.mutate(p)}>
                  {confirmPending.isPending?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:<CheckCircle2 className="h-3.5 w-3.5"/>}
                  Confirm
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CashierAcceptPayment;