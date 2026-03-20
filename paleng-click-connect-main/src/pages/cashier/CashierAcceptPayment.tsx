import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, CheckCircle2, CreditCard, Loader2, Banknote,
  User, ArrowLeft, Printer, AlertCircle, Receipt,
  Smartphone, Building2, Clock, X,
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

const METHOD_ICON: Record<string, any> = {
  gcash: Smartphone, paymaya: Smartphone, instapay: Building2, cash: Banknote,
};
const METHOD_COLOR: Record<string, string> = {
  gcash: "bg-blue-500", paymaya: "bg-green-600", instapay: "bg-primary", cash: "bg-slate-500",
};
const METHOD_LABEL: Record<string, string> = {
  gcash: "GCash", paymaya: "Maya", instapay: "InstaPay", cash: "Cash",
};

// ─── Print receipt ─────────────────────────────────────────────────────────────
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
<div class="row"><span class="lbl">Method</span><span class="val">${data.method}</span></div>
<div class="amt">
  <div class="label">Amount Paid</div>
  <div class="value">${fmt(data.amount)}</div>
</div>
<div class="sig">
  <div><div style="height:28px"></div><div class="sig-line"><b>${data.vendorName}</b><br/>Vendor / Payor</div></div>
  <div><div style="height:28px"></div><div class="sig-line"><b>${data.cashierName}</b><br/>Cashier / Collector</div></div>
</div>
<div class="footer">PALENG-CLICK · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
};

// ═══════════════════════════════════════════════════════════════════════════════
// WALK-IN PAYMENT TAB
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
  const [note,        setNote]        = useState("");
  const [receiptData, setReceiptData] = useState<any>(null);

  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const loadVendorData = async (v: any) => {
    const stallId = v.stall_id;
    const [profileRes, paymentsRes, schedulesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", v.user_id).single(),
      supabase.from("payments").select("period_month, amount")
        .eq("vendor_id", v.id).eq("status", "completed").eq("period_year", currentYear),
      stallId
        ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", stallId).eq("year", currentYear)
        : Promise.resolve({ data: [] }),
    ]);
    const stall     = v.stalls as any;
    const profile   = profileRes.data;
    const payments  = paymentsRes.data || [];
    const schedules = schedulesRes.data || [];
    const defRate   = stall?.monthly_rate || 1450;

    const paidMap: Record<number,number> = {};
    payments.forEach((p: any) => {
      if (p.period_month) paidMap[p.period_month] = (paidMap[p.period_month]||0) + Number(p.amount);
    });

    const getMonthFee = (m: number) => {
      const s = schedules.find((s: any) => s.month === m);
      return s ? Number(s.amount) : defRate;
    };

    let nextUnpaid = currentMonth;
    for (let m = 1; m <= currentMonth; m++) {
      if ((paidMap[m]||0) < getMonthFee(m)) { nextUnpaid = m; break; }
    }

    setVendor({ ...v, stall, profile, paidMap, schedules, defRate, getMonthFee, nextUnpaid });
    setPeriodMonth(nextUnpaid);
    setAmount("");
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

    toast.error("No vendor found. Try stall number (e.g. G-001) or name.");
    setSearching(false);
  };

  const monthFee     = vendor ? vendor.getMonthFee(periodMonth) : 1450;
  const alreadyPaid  = vendor ? (vendor.paidMap[periodMonth]||0) : 0;
  const remaining    = Math.max(0, monthFee - alreadyPaid);
  const payAmount    = payType === "full" ? remaining : (Number(amount)||0);
  const isOverpaying = payAmount > remaining;

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (payAmount <= 0)   throw new Error("Amount must be greater than 0");
      if (isOverpaying)     throw new Error(`Cannot exceed remaining balance of ${fmt(remaining)}`);
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
        notes:          note || null,
      } as any).select("reference_number, receipt_number").single();
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: vendor.user_id,
        title:   "✅ Payment Received",
        message: `Cash payment of ${fmt(payAmount)} for ${MONTHS_FULL[periodMonth-1]} ${periodYear} recorded by cashier.`,
        type:    "confirmation",
      });
      return data;
    },
    onSuccess: (data) => {
      const cashierName = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      setReceiptData({
        vendorName: `${vendor.profile?.first_name} ${vendor.profile?.last_name}`,
        stallNumber: vendor.stall?.stall_number||"—",
        section: vendor.stall?.section||"General",
        amount: payAmount,
        payType: payType==="full"?"Full Payment":"Partial Payment",
        period: `${MONTHS_FULL[periodMonth-1]} ${periodYear}`,
        method: "Cash at Cashier",
        refNumber: data.reference_number||"",
        receiptNumber: data.receipt_number||"",
        cashierName,
      });
      ["vendor-statement","vendor-pay-info","vendor-history","cashier-dashboard","cashier-payment-status","admin-payments","admin-dashboard"].forEach(k =>
        queryClient.invalidateQueries({ queryKey: [k] })
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = () => {
    setVendor(null); setSearchTerm(""); setAmount(""); setNote("");
    setReceiptData(null); setPeriodMonth(currentMonth); setPeriodYear(currentYear); setPayType("full");
  };

  // Receipt screen
  if (receiptData) return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center py-4 gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Payment Recorded!</h3>
          <p className="text-sm text-muted-foreground">{fmt(receiptData.amount)} · {receiptData.vendorName} · {receiptData.period}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="bg-foreground text-background text-center px-5 py-3">
          <p className="text-[10px] tracking-widest uppercase opacity-60">Municipality of San Juan, Batangas</p>
          <p className="font-bold tracking-wide mt-0.5">OFFICIAL RECEIPT</p>
        </div>
        <div className="px-5 py-4 space-y-2 text-sm">
          {[
            { label:"Receipt No.", value:receiptData.receiptNumber||"—", mono:true },
            { label:"Vendor",      value:receiptData.vendorName           },
            { label:"Stall",       value:`${receiptData.stallNumber} · ${receiptData.section}` },
            { label:"Period",      value:receiptData.period               },
            { label:"Type",        value:receiptData.payType              },
            { label:"Method",      value:receiptData.method               },
          ].map(r=>(
            <div key={r.label} className="flex justify-between border-b border-dashed border-border pb-1.5">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-medium text-foreground ${r.mono?"font-mono text-xs":""}`}>{r.value}</span>
            </div>
          ))}
          <div className="rounded-xl bg-success/10 border border-success/20 p-3 text-center mt-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Amount Paid</p>
            <p className="font-mono text-2xl font-bold text-success">{fmt(receiptData.amount)}</p>
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
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Stall number (G-001) or vendor name…"
            className="h-11 pl-10 rounded-xl"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key==="Enter" && searchVendor()} />
        </div>
        <Button onClick={searchVendor} disabled={searching||!searchTerm.trim()} className="rounded-xl px-5">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {vendor && (
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={reset}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {searching && !vendor && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {vendor && (
        <>
          {/* Vendor info */}
          <div className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">{vendor.profile?.first_name} {vendor.profile?.last_name}</p>
                <p className="text-xs text-muted-foreground">
                  Stall <span className="font-mono font-semibold">{vendor.stall?.stall_number}</span>
                  {" · "}{vendor.stall?.section}
                  {vendor.profile?.contact_number && ` · ${vendor.profile.contact_number}`}
                </p>
              </div>
            </div>

            {/* Month grid */}
            <div className="rounded-xl bg-secondary/40 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Payment Status — tap to select period</p>
              <div className="grid grid-cols-4 gap-1.5">
                {MONTHS_FULL.slice(0, currentMonth).map((m, i) => {
                  const mo       = i+1;
                  const fee      = vendor.getMonthFee(mo);
                  const paid     = vendor.paidMap[mo]||0;
                  const isFully  = paid >= fee;
                  const isPartial= paid>0 && paid<fee;
                  const isSelected = mo === periodMonth;
                  return (
                    <button key={m} onClick={() => { setPeriodMonth(mo); setAmount(""); }}
                      className={`rounded-lg px-1 py-2 text-center text-xs transition-all border ${
                        isSelected  ? "ring-2 ring-primary border-primary bg-primary/10" :
                        isFully     ? "border-success/20 bg-success/10" :
                        isPartial   ? "border-primary/20 bg-primary/5"  :
                                      "border-accent/20 bg-accent/5 hover:bg-accent/10"
                      }`}>
                      <p className="font-medium text-foreground">{m.slice(0,3)}</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${isFully?"text-success":isPartial?"text-primary":"text-accent"}`}>
                        {isFully?"✓":isPartial?"~":"✗"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Billing period select */}
          <div className="rounded-2xl border bg-card p-4 shadow-civic space-y-3">
            <h3 className="font-semibold text-foreground text-sm">Billing Period & Amount</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Month</Label>
                <select className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
                  value={periodMonth} onChange={e => { setPeriodMonth(Number(e.target.value)); setAmount(""); }}>
                  {MONTHS_FULL.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year</Label>
                <select className="h-9 w-full rounded-xl border bg-background px-3 text-sm"
                  value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))}>
                  {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-xl border bg-secondary/30 px-3 py-2.5 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fee ({MONTHS_FULL[periodMonth-1]})</span>
                <span className="font-mono text-foreground">{fmt(monthFee)}</span>
              </div>
              {alreadyPaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Already Paid</span>
                  <span className="font-mono text-success">− {fmt(alreadyPaid)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-1.5">
                <span className="font-semibold text-foreground">Balance Due</span>
                <span className={`font-mono text-lg font-bold ${remaining===0?"text-success":"text-foreground"}`}>{fmt(remaining)}</span>
              </div>
              {remaining===0 && <p className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5"/>Fully paid</p>}
            </div>

            {remaining > 0 && (
              <>
                <div className="flex rounded-xl bg-secondary p-1">
                  <button onClick={() => { setPayType("full"); setAmount(""); }}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${payType==="full"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
                    Full ({fmt(remaining)})
                  </button>
                  <button onClick={() => setPayType("partial")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-all ${payType==="partial"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
                    Partial
                  </button>
                </div>

                {payType === "partial" && (
                  <div className="space-y-1.5">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₱</span>
                      <Input type="number" placeholder={`Max ${fmt(remaining)}`}
                        className={`h-10 pl-7 rounded-xl font-mono ${isOverpaying?"border-accent":""}`}
                        value={amount} onChange={e => setAmount(e.target.value)} max={remaining} />
                    </div>
                    {isOverpaying && <p className="text-xs text-accent flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5"/>Exceeds {fmt(remaining)}</p>}
                  </div>
                )}

                <Input placeholder="Note (optional)" className="h-9 rounded-xl text-sm"
                  value={note} onChange={e => setNote(e.target.value)} />

                <Button variant="hero" className="w-full gap-2 rounded-xl"
                  disabled={recordPayment.isPending||payAmount<=0||isOverpaying||(payType==="partial"&&!amount)}
                  onClick={() => recordPayment.mutate()}>
                  {recordPayment.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin"/>Processing…</>
                    : <><CheckCircle2 className="h-4 w-4"/>Collect {fmt(payAmount)} — Cash</>}
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
  const [tab, setTab] = useState<"online"|"manual"|"walkin">("online");

  // ── Online payments (pending) ────────────────────────────────────────────────
  const { data: pendingPayments = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["cashier-pending"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: payments } = await supabase
        .from("payments").select("*").eq("status", "pending").order("created_at", { ascending: false });
      if (!payments?.length) return [];
      const vendorIds = [...new Set(payments.map(p => p.vendor_id))];
      const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number, section)").in("id", vendorIds);
      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return payments.map(p => {
        const v  = vendors?.find(v => v.id === p.vendor_id);
        const pr = profiles?.find(pr => pr.user_id === v?.user_id);
        const st = v?.stalls as any;
        return { ...p, vendor_name: pr?`${pr.first_name} ${pr.last_name}`:"Unknown", stall: st?.stall_number||"—", section: st?.section||"" };
      });
    },
  });

  const confirmPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment confirmed!");
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: () => toast.error("Failed to confirm"),
  });

  const rejectPayment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payments").update({ status: "failed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Payment rejected"); refetchPending(); },
    onError: () => toast.error("Failed to reject"),
  });

  // ── Manual (old) ──────────────────────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [vendor,     setVendor]     = useState<any>(null);
  const [amount,     setAmount]     = useState("");
  const [method,     setMethod]     = useState("cash");
  const [done,       setDone]       = useState(false);
  const [refNum,     setRefNum]     = useState("");
  const [searching,  setSearching]  = useState(false);

  useEffect(() => {
    const vendorId = searchParams.get("vendorId");
    if (vendorId) { setTab("walkin"); }
  }, [searchParams]);

  const searchVendorManual = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const { data: stalls } = await supabase.from("stalls").select("id, stall_number, section, monthly_rate").ilike("stall_number", `%${searchTerm}%`);
    if (stalls?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("stall_id", stalls[0].id).single();
      if (v) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", v.user_id).single();
        setVendor({ ...v, stall: v.stalls, profile }); setAmount(String(stalls[0].monthly_rate)); setSearching(false); return;
      }
    }
    const { data: profiles } = await supabase.from("profiles").select("*").or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
    if (profiles?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("user_id", profiles[0].user_id).single();
      if (v) {
        setVendor({ ...v, stall: v.stalls, profile: profiles[0] }); setAmount(String((v.stalls as any)?.monthly_rate||1450)); setSearching(false); return;
      }
    }
    toast.error("Vendor not found"); setSearching(false);
  };

  const recordManual = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("payments").insert({
        vendor_id: vendor.id, stall_id: vendor.stall_id||null,
        amount: Number(amount), payment_method: method, payment_type: "due",
        status: "completed", processed_by: user?.id,
        period_month: new Date().getMonth()+1, period_year: new Date().getFullYear(),
      }).select("reference_number, receipt_number").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setRefNum(data.reference_number||""); setDone(true);
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-payment-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Cashier profile for receipt
  const { data: cashierProfile } = useQuery({
    queryKey: ["cashier-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", user!.id).single();
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Accept Payment</h1>
        <p className="text-sm text-muted-foreground">Confirm online payments or record cash payments from vendors</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-secondary p-1 max-w-md">
        {[
          { id:"online",  label:"Online Payments", badge: pendingPayments.length },
          { id:"walkin",  label:"Walk-in / Cash"   },
          { id:"manual",  label:"Quick Manual"     },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${tab===t.id?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>
            {t.label}
            {t.badge ? (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── ONLINE PAYMENTS TAB ──────────────────────────────────────────────── */}
      {tab === "online" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{pendingPayments.length}</strong> pending payment{pendingPayments.length!==1?"s":""} awaiting confirmation
            </p>
            <button onClick={() => refetchPending()} className="text-xs text-primary hover:underline">Refresh</button>
          </div>

          {pendingLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
          ) : pendingPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-2 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 opacity-20"/>
              <p className="font-medium">No pending payments</p>
              <p className="text-xs">All online payments are confirmed</p>
            </div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-secondary/50">
                    {["Vendor","Stall","Period","Amount","Method","Time","Action"].map(h=>(
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingPayments.map((p: any) => {
                    const MI = METHOD_ICON[p.payment_method] || CreditCard;
                    return (
                      <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{p.vendor_name}</td>
                        <td className="px-4 py-3 font-mono text-foreground">{p.stall}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—"}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">{fmt(Number(p.amount))}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`flex h-5 w-5 items-center justify-center rounded ${METHOD_COLOR[p.payment_method]||"bg-muted"}`}>
                              <MI className="h-3 w-3 text-white"/>
                            </span>
                            <span className="text-xs text-muted-foreground">{METHOD_LABEL[p.payment_method]||p.payment_method}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Button size="sm"
                              className="h-7 text-xs bg-success hover:bg-success/90 text-white rounded-lg gap-1"
                              disabled={confirmPayment.isPending}
                              onClick={() => confirmPayment.mutate(p.id)}>
                              <CheckCircle2 className="h-3 w-3"/> Confirm
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-7 text-xs text-accent border-accent/30 hover:bg-accent/10 rounded-lg gap-1"
                              disabled={rejectPayment.isPending}
                              onClick={() => rejectPayment.mutate(p.id)}>
                              <X className="h-3 w-3"/> Reject
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
      )}

      {/* ── WALK-IN CASH TAB ─────────────────────────────────────────────────── */}
      {tab === "walkin" && (
        <WalkInPayment cashierProfile={cashierProfile} />
      )}

      {/* ── QUICK MANUAL TAB (original) ──────────────────────────────────────── */}
      {tab === "manual" && (
        done ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success"/>
            </div>
            <h2 className="text-xl font-bold text-foreground">Payment Recorded!</h2>
            <p className="mt-1 text-muted-foreground">{fmt(Number(amount))} from {vendor?.profile?.first_name} {vendor?.profile?.last_name}</p>
            <p className="mt-1 text-sm text-muted-foreground">Receipt: {refNum}</p>
            <Button className="mt-5" onClick={() => { setDone(false); setVendor(null); setSearchTerm(""); setAmount(""); }}>
              New Payment
            </Button>
          </div>
        ) : (
          <div className="max-w-lg space-y-4">
            <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-3">
              <Label>Search Vendor</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
                  <Input placeholder="Name or stall number…" className="h-11 pl-10 rounded-xl"
                    value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => e.key==="Enter" && searchVendorManual()}/>
                </div>
                <Button onClick={searchVendorManual} disabled={searching} className="rounded-xl">
                  {searching ? <Loader2 className="h-4 w-4 animate-spin"/> : "Search"}
                </Button>
              </div>
            </div>

            {searching && !vendor && <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>}

            {vendor && (
              <>
                <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-3">
                  <h3 className="font-semibold text-foreground">Vendor Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-muted-foreground">Name</p><p className="font-medium text-foreground">{vendor.profile?.first_name} {vendor.profile?.last_name}</p></div>
                    <div><p className="text-muted-foreground">Stall</p><p className="font-mono font-medium text-foreground">{(vendor.stall as any)?.stall_number}</p></div>
                    <div><p className="text-muted-foreground">Section</p><p className="font-medium text-foreground">{(vendor.stall as any)?.section}</p></div>
                    <div><p className="text-muted-foreground">Contact</p><p className="font-medium text-foreground">{vendor.profile?.contact_number||"—"}</p></div>
                  </div>
                </div>
                <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
                  <h3 className="font-semibold text-foreground">Payment Details</h3>
                  <div className="space-y-1.5">
                    <Label>Amount (₱)</Label>
                    <Input value={amount} onChange={e => setAmount(e.target.value)} className="h-11 rounded-xl font-mono"/>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={method} onChange={e => setMethod(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="gcash">GCash</option>
                      <option value="paymaya">PayMaya</option>
                    </select>
                  </div>
                  <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl"
                    onClick={() => recordManual.mutate()} disabled={recordManual.isPending}>
                    {recordManual.isPending ? <Loader2 className="h-5 w-5 animate-spin"/> : <CreditCard className="h-5 w-5"/>}
                    Record Payment
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