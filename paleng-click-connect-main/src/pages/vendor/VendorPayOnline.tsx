import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CreditCard, Smartphone, Building2, Banknote, CheckCircle2,
  Loader2, AlertTriangle, QrCode, ExternalLink, Copy,
  RefreshCw, ArrowLeft, ChevronRight, Wallet,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Gateway = "gcash" | "paymaya" | "instapay" | "cash";
interface PayMongoSource { id: string; checkout_url: string; status: string; }

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const PAYMONGO_TYPE: Record<string, string> = {
  gcash: "gcash", paymaya: "paymaya", instapay: "qrph",
};

const GATEWAYS: { id: Gateway; label: string; sub: string; icon: any; iconBg: string; }[] = [
  { id: "gcash",    label: "GCash",             sub: "Scan QR or tap to open app",  icon: Smartphone, iconBg: "bg-blue-500"   },
  { id: "paymaya",  label: "Maya",              sub: "Scan QR or tap to open app",  icon: Smartphone, iconBg: "bg-green-600"  },
  { id: "instapay", label: "InstaPay / QR Ph",  sub: "Any bank or e-wallet app",    icon: Building2,  iconBg: "bg-primary"    },
  { id: "cash",     label: "Cash at Cashier",   sub: "Visit the market cashier",    icon: Banknote,   iconBg: "bg-slate-500"  },
];

// ─── Step indicator ─────────────────────────────────────────────────────────────
const Steps = ({ current }: { current: 1 | 2 | 3 }) => (
  <div className="flex items-center gap-0 mb-6">
    {[
      { n: 1, label: "Review" },
      { n: 2, label: "Choose" },
      { n: 3, label: "Pay"    },
    ].map((s, i) => (
      <div key={s.n} className="flex items-center">
        <div className="flex flex-col items-center">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
            current === s.n  ? "bg-primary text-primary-foreground" :
            current > s.n    ? "bg-success text-white" :
            "bg-secondary text-muted-foreground"
          }`}>
            {current > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
          </div>
          <span className={`text-[10px] mt-1 font-medium ${current >= s.n ? "text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
        </div>
        {i < 2 && (
          <div className={`h-px w-12 mx-1 mb-4 transition-all ${current > s.n ? "bg-success" : "bg-border"}`} />
        )}
      </div>
    ))}
  </div>
);

// ─── Component ─────────────────────────────────────────────────────────────────
const VendorPayOnline = () => {
  const { user }       = useAuth();
  const queryClient    = useQueryClient();

  const [step,           setStep]           = useState<1 | 2 | 3>(1);
  const [selected,       setSelected]       = useState<Gateway | null>(null);
  const [payType,        setPayType]        = useState<"full" | "staggered">("full");
  const [staggeredAmount,setStaggeredAmount]= useState("");
  const [confirmed,      setConfirmed]      = useState(false);
  const [refNumber,      setRefNumber]      = useState("");
  const [paymongoSource, setPaymongoSource] = useState<PayMongoSource | null>(null);
  const [showQR,         setShowQR]         = useState(false);
  const [pollingActive,  setPollingActive]  = useState(false);
  const [pendingPayId,   setPendingPayId]   = useState<string | null>(null);

  // ── Fetch billing info ────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-pay-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase.from("vendors").select("id, stall_id, stalls(id, stall_number, section, monthly_rate)").eq("user_id", user!.id).single();
      if (!vendor) return null;

      const stall       = vendor.stalls as any;
      const defaultRate = stall?.monthly_rate || 1450;
      const currentYear = new Date().getFullYear();

      const [paymentsRes, schedulesRes] = await Promise.all([
        supabase.from("payments").select("period_month, period_year, amount, status")
          .eq("vendor_id", vendor.id).eq("status", "completed").eq("period_year", currentYear),
        stall?.id
          ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", stall.id).eq("year", currentYear)
          : Promise.resolve({ data: [] }),
      ]);

      const payments  = paymentsRes.data  || [];
      const schedules = schedulesRes.data || [];

      // Per-month fee: reads from fee schedule if set, else stall default
      const getMonthFee = (m: number): number => {
        const s = schedules.find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };

      // ── STEP 1: Build raw paid map from DB ──────────────────────────────
      const rawPaidMap: Record<number, number> = {};
      (payments || []).forEach(p => {
        if (p.period_month) {
          rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
        }
      });

      // ── STEP 2: Cascade using per-month fees — carry stops at partial ───
      const effectiveMap: Record<number, number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m    = getMonthFee(m);
        const credited = (rawPaidMap[m] || 0) + carry;
        effectiveMap[m] = credited;
        carry           = credited >= due_m ? (credited - due_m) : 0;
      }

      // ── STEP 3: Build monthPaidMap (capped at per-month rate) ───────────
      const monthPaidMap: Record<number, number> = {};
      for (let m = 1; m <= 12; m++) {
        monthPaidMap[m] = Math.min(effectiveMap[m], getMonthFee(m));
      }

      // ── STEP 4: Find first month not yet fully covered ──────────────────
      let nextUnpaidMonth = 1;
      for (let m = 1; m <= 12; m++) {
        if (effectiveMap[m] < getMonthFee(m)) { nextUnpaidMonth = m; break; }
        if (m === 12) nextUnpaidMonth = 13;
      }

      const monthlyRate      = getMonthFee(nextUnpaidMonth);
      const paidForNextMonth = effectiveMap[nextUnpaidMonth] || 0;
      const remainingBalance = Math.max(0, monthlyRate - paidForNextMonth);

      return {
        vendor,
        stall,
        monthlyRate,
        monthPaidMap,
        nextUnpaidMonth,
        paidForNextMonth,
        remainingBalance,
        allPaid: nextUnpaidMonth > 12,
      };
    },
  });

  const stall            = data?.stall;
  const monthlyRate      = data?.monthlyRate || 1450;
  const nextUnpaidMonth  = data?.nextUnpaidMonth || (new Date().getMonth() + 1);
  const remainingBalance = data?.remainingBalance || monthlyRate;
  const paidForNextMonth = data?.paidForNextMonth || 0;
  const payAmount        = payType === "full" ? remainingBalance : Number(staggeredAmount || 0);
  const isAdvance        = nextUnpaidMonth > new Date().getMonth() + 1;

  // ── Create pending payment ────────────────────────────────────────────────
  const createPendingPayment = async (): Promise<string> => {
    const { data: payment, error } = await supabase.from("payments").insert({
      vendor_id:      data!.vendor.id,
      stall_id:       data!.vendor.stall_id || null,
      amount:         payAmount,
      payment_method: selected as any,
      payment_type:   payType === "full" ? "due" : "staggered",
      status:         "pending",
      period_month:   nextUnpaidMonth,
      period_year:    new Date().getFullYear(),
    }).select("id, reference_number").single();
    if (error) throw error;
    return payment.id;
  };

  // ── Create PayMongo source ────────────────────────────────────────────────
  const createPayMongoSource = async (paymentDbId: string): Promise<PayMongoSource> => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-paymongo-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        amount:        payAmount,
        currency:      "PHP",
        type:          PAYMONGO_TYPE[selected!],
        payment_db_id: paymentDbId,
        description:   `Stall fee - ${stall?.stall_number} - ${MONTHS[nextUnpaidMonth - 1]} ${new Date().getFullYear()}`,
        redirect: {
          success: `${window.location.origin}/vendor/pay?status=success`,
          failed:  `${window.location.origin}/vendor/pay?status=failed`,
        },
      }),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || "Failed to create payment"); }
    return res.json();
  };

  // ── Poll for payment status ───────────────────────────────────────────────
  const pollPaymentStatus = (paymentDbId: string) => {
    setPollingActive(true);
    const channel = supabase.channel(`payment-${paymentDbId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payments", filter: `id=eq.${paymentDbId}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.status === "completed") {
          channel.unsubscribe(); clearInterval(interval); setPollingActive(false);
          setShowQR(false); setRefNumber(updated.reference_number || ""); setConfirmed(true);
          queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
          queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["vendor-history"] });
          toast.success("Payment confirmed!");
        } else if (updated.status === "failed") {
          channel.unsubscribe(); clearInterval(interval); setPollingActive(false);
          setShowQR(false); toast.error("Payment failed. Please try again.");
        }
      }).subscribe();

    const interval = setInterval(async () => {
      const { data: payment } = await supabase.from("payments").select("status, reference_number").eq("id", paymentDbId).single();
      if (payment?.status === "completed") {
        clearInterval(interval); channel.unsubscribe(); setPollingActive(false);
        setShowQR(false); setRefNumber(payment.reference_number || ""); setConfirmed(true);
        queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
        queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["vendor-history"] });
        toast.success("Payment confirmed!");
      } else if (payment?.status === "failed") {
        clearInterval(interval); channel.unsubscribe(); setPollingActive(false);
        setShowQR(false); toast.error("Payment failed.");
      }
    }, 4000);
    setTimeout(() => { clearInterval(interval); channel.unsubscribe(); setPollingActive(false); }, 10 * 60 * 1000);
  };

  // ── Online payment mutation ───────────────────────────────────────────────
  const initiateOnlinePayment = useMutation({
    mutationFn: async () => {
      if (payType === "staggered" && (!staggeredAmount || Number(staggeredAmount) <= 0)) throw new Error("Please enter a valid amount");
      if (payType === "staggered" && Number(staggeredAmount) > remainingBalance) throw new Error(`Amount cannot exceed ${fmt(remainingBalance)}`);
      const paymentDbId = await createPendingPayment();
      setPendingPayId(paymentDbId);
      const source = await createPayMongoSource(paymentDbId);
      return { source, paymentDbId };
    },
    onSuccess: ({ source, paymentDbId }) => {
      setPaymongoSource(source); setShowQR(true); pollPaymentStatus(paymentDbId);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Cash payment mutation ─────────────────────────────────────────────────
  const makeCashPayment = useMutation({
    mutationFn: async () => {
      if (payType === "staggered" && (!staggeredAmount || Number(staggeredAmount) <= 0)) throw new Error("Please enter a valid amount");
      const { data: payment, error } = await supabase.from("payments").insert({
        vendor_id: data!.vendor.id, stall_id: data!.vendor.stall_id || null,
        amount: payAmount, payment_method: "cash",
        payment_type: payType === "full" ? "due" : "staggered",
        status: "pending", period_month: nextUnpaidMonth, period_year: new Date().getFullYear(),
      }).select("reference_number").single();
      if (error) throw error;
      return payment;
    },
    onSuccess: (payment) => {
      setRefNumber(payment.reference_number || ""); setConfirmed(true);
      queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handlePay = () => {
    if (selected === "cash") makeCashPayment.mutate();
    else initiateOnlinePayment.mutate();
  };

  const isPending  = initiateOnlinePayment.isPending || makeCashPayment.isPending;
  const canProceed = payType === "full" || (!!staggeredAmount && Number(staggeredAmount) > 0);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // ── All paid ──────────────────────────────────────────────────────────────
  if (data?.allPaid) return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">All Paid for {new Date().getFullYear()}!</h2>
      <p className="mt-2 text-muted-foreground">You have no outstanding balance. All monthly stall fees are settled.</p>
      <div className="mt-6 rounded-2xl border bg-card p-4 w-full text-left space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Stall</span><span className="font-medium">{stall?.stall_number}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Section</span><span className="font-medium">{stall?.section}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Year</span><span className="font-medium">{new Date().getFullYear()}</span></div>
      </div>
    </div>
  );

  // ── Success screen ────────────────────────────────────────────────────────
  if (confirmed) {
    const newRemaining = remainingBalance - payAmount;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto space-y-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {selected === "cash" ? "Request Submitted!" : "Payment Successful!"}
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {fmt(payAmount)} for {MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()}
          </p>
        </div>

        {/* Receipt card */}
        <div className="w-full rounded-2xl border bg-card p-5 text-left space-y-2.5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Payment Receipt</p>
          {[
            { label: "Stall",    value: `${stall?.stall_number} — ${stall?.section}` },
            { label: "Period",   value: `${MONTHS[nextUnpaidMonth - 1]} ${new Date().getFullYear()}` },
            { label: "Amount",   value: fmt(payAmount) },
            { label: "Method",   value: selected === "cash" ? "Cash (pending cashier)" : selected?.toUpperCase() },
            { label: "Reference",value: refNumber || "—" },
            { label: "Status",   value: selected === "cash" ? "Pending cashier confirmation" : "Completed" },
          ].map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-medium text-right ${r.label === "Reference" ? "font-mono text-xs" : ""}`}>{r.value}</span>
            </div>
          ))}
        </div>

        {selected === "cash" && (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Bring your reference number to the cashier to complete your cash payment.
          </div>
        )}

        {payType === "staggered" && newRemaining > 0 && (
          <div className="w-full rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground">Remaining for {MONTHS[nextUnpaidMonth - 1]}</p>
            <p className="font-mono text-xl font-bold text-primary mt-0.5">{fmt(newRemaining)}</p>
          </div>
        )}

        <Button variant="outline" className="w-full" onClick={() => {
          setConfirmed(false); setSelected(null); setStaggeredAmount("");
          setPaymongoSource(null); setShowQR(false); setStep(1);
        }}>
          {newRemaining > 0 ? "Pay Remaining Balance" : "Make Another Payment"}
        </Button>
      </div>
    );
  }

  // ── QR / Payment screen ───────────────────────────────────────────────────
  if (showQR && paymongoSource) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <button onClick={() => { setShowQR(false); setPaymongoSource(null); setPollingActive(false); setStep(2); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Amount header */}
        <div className="rounded-2xl border bg-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount to Pay</p>
            <p className="font-mono text-3xl font-bold text-foreground">{fmt(payAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()} · Stall {stall?.stall_number}</p>
          </div>
          {pollingActive && (
            <div className="flex flex-col items-center gap-1.5">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs text-primary">Waiting…</span>
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="rounded-2xl border bg-card p-6 flex flex-col items-center gap-4 shadow-civic">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <QrCode className="h-4 w-4 text-primary" />
            Scan with {selected === "gcash" ? "GCash" : selected === "paymaya" ? "Maya" : "any banking app"}
          </div>
          <div className="rounded-2xl bg-white p-4 border-2 border-dashed border-border shadow-sm">
            <QRCodeCanvas value={paymongoSource.checkout_url} size={190} level="H" includeMargin={false} />
          </div>
          <p className="text-xs text-center text-muted-foreground max-w-xs leading-relaxed">
            Open your {selected === "gcash" ? "GCash" : selected === "paymaya" ? "Maya" : "banking"} app → Scan QR → Confirm exactly{" "}
            <strong className="text-foreground">{fmt(payAmount)}</strong>
          </p>
          <button onClick={() => { navigator.clipboard.writeText(paymongoSource.checkout_url); toast.success("Copied!"); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Copy className="h-3.5 w-3.5" /> Copy payment link
          </button>
        </div>

        {/* App button */}
        {selected !== "instapay" && (
          <a href={paymongoSource.checkout_url} target="_blank" rel="noopener noreferrer"
            className={`flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 font-semibold text-white transition-colors shadow-sm ${
              selected === "gcash" ? "bg-blue-500 hover:bg-blue-600" : "bg-green-600 hover:bg-green-700"
            }`}>
            <Smartphone className="h-5 w-5" />
            Open {selected === "gcash" ? "GCash" : "Maya"} App to Pay
            <ExternalLink className="h-4 w-4 opacity-70" />
          </a>
        )}
        {selected === "instapay" && (
          <a href={paymongoSource.checkout_url} target="_blank" rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 font-semibold text-primary-foreground hover:opacity-90 transition-opacity shadow-sm">
            <Building2 className="h-5 w-5" />
            Pay via Online Banking
            <ExternalLink className="h-4 w-4 opacity-70" />
          </a>
        )}

        {/* Polling status */}
        <div className="rounded-xl bg-secondary/50 p-4 flex items-start gap-3 text-sm">
          {pollingActive ? (
            <><Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Waiting for confirmation</p>
              <p className="text-xs text-muted-foreground">This page updates automatically once payment is received.</p>
            </div></>
          ) : (
            <><RefreshCw className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">Already paid?</p>
              <button onClick={() => pendingPayId && pollPaymentStatus(pendingPayId)} className="text-xs text-primary hover:underline">
                Check payment status
              </button>
            </div></>
          )}
        </div>
      </div>
    );
  }

  // ── Main form (3 steps) ───────────────────────────────────────────────────
  return (
    <div className="max-w-lg space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pay Online</h1>
        <p className="text-sm text-muted-foreground">Complete your stall fee payment in a few steps</p>
      </div>

      <Steps current={step} />

      {/* ── STEP 1: Review billing ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">

          {/* Bill card */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-civic">
            <div className="bg-primary/5 border-b px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Billing Period</p>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()}
                  </p>
                  {isAdvance && (
                    <span className="inline-block mt-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      Advance payment
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Stall</p>
                  <p className="font-mono font-bold text-foreground">{stall?.stall_number || "—"}</p>
                  <p className="text-xs text-muted-foreground">{stall?.section}</p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Rate</span>
                <span className="font-mono text-foreground">{fmt(monthlyRate)}</span>
              </div>
              {paidForNextMonth > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Paid</span>
                    <span className="font-mono text-success font-medium">− {fmt(paidForNextMonth)}</span>
                  </div>
                  <div className="h-px bg-border" />
                </>
              )}
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">{paidForNextMonth > 0 ? "Remaining Balance" : "Amount Due"}</span>
                <span className="font-mono text-2xl font-bold text-foreground">{fmt(remainingBalance)}</span>
              </div>
              {paidForNextMonth > 0 && (
                <div className="mt-1">
                  <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(paidForNextMonth / monthlyRate) * 100}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{Math.round((paidForNextMonth / monthlyRate) * 100)}% paid</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment type toggle */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-3">
            <p className="text-sm font-semibold text-foreground">Payment Type</p>
            <div className="flex rounded-xl bg-secondary p-1">
              <button onClick={() => setPayType("full")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType === "full" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                Full Payment
              </button>
              <button onClick={() => setPayType("staggered")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType === "staggered" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                Partial
              </button>
            </div>

            {payType === "staggered" && (
              <div className="space-y-3">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-amber-800">Enter any amount up to <strong>{fmt(remainingBalance)}</strong></p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Amount to Pay (₱)</Label>
                  <Input
                    type="number"
                    placeholder={`Max ${fmt(remainingBalance)}`}
                    value={staggeredAmount}
                    onChange={e => setStaggeredAmount(e.target.value)}
                    className="h-11 rounded-xl font-mono text-lg"
                    max={remainingBalance}
                  />
                </div>
                {staggeredAmount && Number(staggeredAmount) > 0 && Number(staggeredAmount) < remainingBalance && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">Remaining after this</span>
                    <span className="font-mono font-bold text-accent">{fmt(remainingBalance - Number(staggeredAmount))}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <Button variant="hero" size="lg" className="w-full gap-2" disabled={!canProceed} onClick={() => setStep(2)}>
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── STEP 2: Choose method ──────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {/* Amount reminder */}
          <div className="rounded-xl border bg-secondary/50 px-4 py-3 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()} · {payType === "staggered" ? "Partial" : "Full"}</span>
            <span className="font-mono font-bold text-foreground text-base">{fmt(payAmount)}</span>
          </div>

          {/* Method grid */}
          <div className="grid grid-cols-2 gap-3">
            {GATEWAYS.map(g => (
              <button key={g.id} onClick={() => setSelected(g.id)}
                className={`relative flex flex-col items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                  selected === g.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm"
                    : "bg-card hover:bg-secondary/40 hover:border-border"
                }`}>
                {selected === g.id && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </span>
                )}
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${g.iconBg}`}>
                  <g.icon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{g.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.sub}</p>
                </div>
              </button>
            ))}
          </div>

          {selected && selected !== "cash" && (
            <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 flex items-center gap-3 text-sm">
              <QrCode className="h-5 w-5 text-primary shrink-0" />
              <p className="text-muted-foreground">A QR code for <strong className="text-foreground">{fmt(payAmount)}</strong> will be generated. Scan with {selected === "gcash" ? "GCash" : selected === "paymaya" ? "Maya" : "your banking app"}.</p>
            </div>
          )}

          <Button variant="hero" size="lg" className="w-full gap-2" disabled={!selected} onClick={() => setStep(3)}>
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── STEP 3: Confirm & Pay ──────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {/* Summary card */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="bg-secondary/50 border-b px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Summary</p>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              {[
                { label: "Stall",   value: `${stall?.stall_number} — ${stall?.section}` },
                { label: "Period",  value: `${MONTHS[nextUnpaidMonth - 1]} ${new Date().getFullYear()}` },
                { label: "Type",    value: payType === "staggered" ? "Partial Payment" : "Full Payment" },
                { label: "Method",  value: GATEWAYS.find(g => g.id === selected)?.label || selected },
              ].map(r => (
                <div key={r.label} className="flex justify-between">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-medium text-foreground">{r.value}</span>
                </div>
              ))}
              <div className="h-px bg-border" />
              <div className="flex justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="font-mono text-xl font-bold text-foreground">{fmt(payAmount)}</span>
              </div>
            </div>
          </div>

          {selected === "cash" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              A payment reference will be generated. Bring it to the cashier to complete your payment.
            </div>
          )}

          <Button
            variant="hero" size="lg" className="w-full gap-2"
            disabled={isPending}
            onClick={handlePay}
          >
            {isPending ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
            ) : selected === "cash" ? (
              <><Banknote className="h-5 w-5" /> Submit Cash Request</>
            ) : (
              <><Wallet className="h-5 w-5" /> Generate QR & Pay — {fmt(payAmount)}</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default VendorPayOnline;