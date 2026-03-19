import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CreditCard,
  Smartphone,
  Building2,
  Banknote,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  QrCode,
  ExternalLink,
  Copy,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeCanvas } from "qrcode.react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Gateway = "gcash" | "paymaya" | "instapay" | "cash";

interface PayMongoSource {
  id: string;
  checkout_url: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const gateways: { id: Gateway; label: string; icon: any; color: string; description: string }[] = [
  { id: "gcash",    label: "GCash",           icon: Smartphone, color: "bg-blue-500",   description: "Pay via GCash e-wallet" },
  { id: "paymaya",  label: "Maya",            icon: Smartphone, color: "bg-green-600",  description: "Pay via Maya e-wallet" },
  { id: "instapay", label: "InstaPay / Bank", icon: Building2,  color: "bg-primary",    description: "Any bank with InstaPay" },
  { id: "cash",     label: "Cash (Cashier)",  icon: Banknote,   color: "bg-muted",      description: "Pay at the market cashier" },
];

// Map our gateway IDs to PayMongo source types
const PAYMONGO_TYPE: Record<string, string> = {
  gcash:    "gcash",
  paymaya:  "paymaya",
  instapay: "qrph",   // QR Ph = InstaPay-compatible QR for any bank
};

// ─── Component ────────────────────────────────────────────────────────────────

const VendorPayOnline = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Gateway | null>(null);
  const [payType, setPayType] = useState<"full" | "staggered">("full");
  const [staggeredAmount, setStaggeredAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [refNumber, setRefNumber] = useState("");

  // QR/online payment state
  const [paymongoSource, setPaymongoSource] = useState<PayMongoSource | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [pollingActive, setPollingActive] = useState(false);
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);

  // ── Fetch vendor / stall info ──────────────────────────────────────────────

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-pay-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, stall_id, stalls(stall_number, section, monthly_rate)")
        .eq("user_id", user!.id)
        .single();
      if (!vendor) return null;

      const currentYear = new Date().getFullYear();
      const { data: payments } = await supabase
        .from("payments")
        .select("period_month, period_year, amount, payment_type, status")
        .eq("vendor_id", vendor.id)
        .eq("status", "completed")
        .eq("period_year", currentYear);

      const monthPaidMap: Record<number, number> = {};
      (payments || []).forEach((p) => {
        if (p.period_month) {
          monthPaidMap[p.period_month] = (monthPaidMap[p.period_month] || 0) + Number(p.amount);
        }
      });

      const stall = vendor.stalls as any;
      const monthlyRate = stall?.monthly_rate || 1450;

      let nextUnpaidMonth = 1;
      for (let m = 1; m <= 12; m++) {
        if ((monthPaidMap[m] || 0) < monthlyRate) { nextUnpaidMonth = m; break; }
        if (m === 12) nextUnpaidMonth = 13;
      }

      const paidForNextMonth = monthPaidMap[nextUnpaidMonth] || 0;
      const remainingBalance = monthlyRate - paidForNextMonth;

      return { vendor, stall, monthlyRate, monthPaidMap, nextUnpaidMonth, paidForNextMonth, remainingBalance, allPaid: nextUnpaidMonth > 12 };
    },
  });

  const stall            = data?.stall;
  const monthlyRate      = data?.monthlyRate || 1450;
  const nextUnpaidMonth  = data?.nextUnpaidMonth || (new Date().getMonth() + 1);
  const remainingBalance = data?.remainingBalance || monthlyRate;
  const paidForNextMonth = data?.paidForNextMonth || 0;
  const payAmount        = payType === "full" ? remainingBalance : Number(staggeredAmount || 0);

  // ── STEP 1: Create a pending payment row in Supabase ──────────────────────

  const createPendingPayment = async (): Promise<string> => {
    const { data: payment, error } = await supabase
      .from("payments")
      .insert({
        vendor_id:      data!.vendor.id,
        stall_id:       data!.vendor.stall_id || null,
        amount:         payAmount,
        payment_method: selected as any,
        payment_type:   payType === "full" ? "due" : "staggered",
        status:         "pending",
        period_month:   nextUnpaidMonth,
        period_year:    new Date().getFullYear(),
      })
      .select("id, reference_number")
      .single();
    if (error) throw error;
    return payment.id;
  };

  // ── STEP 2: Call Supabase Edge Function to create PayMongo source ─────────

  const createPayMongoSource = async (paymentDbId: string): Promise<PayMongoSource> => {
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-paymongo-source`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to create payment source");
    }

    return res.json();
  };

  // ── STEP 3: Poll Supabase for payment status ──────────────────────────────

  const pollPaymentStatus = (paymentDbId: string) => {
    setPollingActive(true);

    // Use Supabase realtime channel instead of interval polling
    const channel = supabase
      .channel(`payment-${paymentDbId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "payments",
          filter: `id=eq.${paymentDbId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === "completed") {
            channel.unsubscribe();
            setPollingActive(false);
            setShowQR(false);
            setRefNumber(updated.reference_number || "");
            setConfirmed(true);
            queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
            queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
            queryClient.invalidateQueries({ queryKey: ["vendor-history"] });
            queryClient.invalidateQueries({ queryKey: ["vendor-statement"] });
            toast.success("Payment confirmed!");
          } else if (updated.status === "failed") {
            channel.unsubscribe();
            setPollingActive(false);
            setShowQR(false);
            toast.error("Payment failed. Please try again.");
          }
        }
      )
      .subscribe();

    // Fallback interval poll every 4 seconds in case realtime misses it
    const interval = setInterval(async () => {
      const { data: payment } = await supabase
        .from("payments")
        .select("status, reference_number")
        .eq("id", paymentDbId)
        .single();

      if (payment?.status === "completed") {
        clearInterval(interval);
        channel.unsubscribe();
        setPollingActive(false);
        setShowQR(false);
        setRefNumber(payment.reference_number || "");
        setConfirmed(true);
        queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
        queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["vendor-history"] });
        queryClient.invalidateQueries({ queryKey: ["vendor-statement"] });
        toast.success("Payment confirmed!");
      } else if (payment?.status === "failed") {
        clearInterval(interval);
        channel.unsubscribe();
        setPollingActive(false);
        setShowQR(false);
        toast.error("Payment failed. Please try again.");
      }
    }, 4000);

    // Stop after 10 minutes
    setTimeout(() => {
      clearInterval(interval);
      channel.unsubscribe();
      setPollingActive(false);
    }, 10 * 60 * 1000);
  };

  // ── Online payment mutation (GCash / Maya / InstaPay) ────────────────────

  const initiateOnlinePayment = useMutation({
    mutationFn: async () => {
      if (payType === "staggered" && (!staggeredAmount || Number(staggeredAmount) <= 0))
        throw new Error("Please enter a valid amount");
      if (payType === "staggered" && Number(staggeredAmount) > remainingBalance)
        throw new Error(`Amount cannot exceed ₱${remainingBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`);

      const paymentDbId = await createPendingPayment();
      setPendingPaymentId(paymentDbId);
      const source = await createPayMongoSource(paymentDbId);
      return { source, paymentDbId };
    },
    onSuccess: ({ source, paymentDbId }) => {
      setPaymongoSource(source);
      setShowQR(true);
      pollPaymentStatus(paymentDbId);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Cash payment mutation (same as before, instant complete) ─────────────

  const makeCashPayment = useMutation({
    mutationFn: async () => {
      if (payType === "staggered" && (!staggeredAmount || Number(staggeredAmount) <= 0))
        throw new Error("Please enter a valid amount");
      if (payType === "staggered" && Number(staggeredAmount) > remainingBalance)
        throw new Error(`Amount cannot exceed ₱${remainingBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`);

      const { data: payment, error } = await supabase
        .from("payments")
        .insert({
          vendor_id:      data!.vendor.id,
          stall_id:       data!.vendor.stall_id || null,
          amount:         payAmount,
          payment_method: "cash",
          payment_type:   payType === "full" ? "due" : "staggered",
          status:         "pending", // cashier will mark completed
          period_month:   nextUnpaidMonth,
          period_year:    new Date().getFullYear(),
        })
        .select("reference_number")
        .single();
      if (error) throw error;
      return payment;
    },
    onSuccess: (payment) => {
      setRefNumber(payment.reference_number || "");
      setConfirmed(true);
      queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Handle Pay button click ───────────────────────────────────────────────

  const handlePay = () => {
    if (selected === "cash") {
      makeCashPayment.mutate();
    } else {
      initiateOnlinePayment.mutate();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // ── Loading / all paid / confirmed states ─────────────────────────────────

  if (isLoading)
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (data?.allPaid)
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">All Paid for {new Date().getFullYear()}!</h2>
        <p className="mt-2 text-muted-foreground">You have no outstanding balance. All monthly fees are settled.</p>
      </div>
    );

  if (confirmed) {
    const newRemaining = remainingBalance - payAmount;
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {selected === "cash" ? "Payment Request Submitted!" : "Payment Successful!"}
        </h2>
        <p className="mt-2 text-muted-foreground">
          ₱{payAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })} for{" "}
          {MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()}
        </p>
        {refNumber && <p className="mt-1 text-sm text-muted-foreground">Reference: <strong>{refNumber}</strong></p>}
        {selected === "cash" && (
          <p className="mt-2 text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-2 max-w-sm">
            Bring your reference number to the cashier to complete your cash payment.
          </p>
        )}
        {payType === "staggered" && newRemaining > 0 && (
          <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 max-w-sm">
            <p className="text-sm font-medium text-foreground">Remaining for {MONTHS[nextUnpaidMonth - 1]}:</p>
            <p className="font-mono text-lg font-bold text-primary">₱{newRemaining.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          </div>
        )}
        <Button variant="outline" className="mt-6" onClick={() => { setConfirmed(false); setSelected(null); setStaggeredAmount(""); setPaymongoSource(null); setShowQR(false); }}>
          {newRemaining > 0 ? "Pay Remaining Balance" : "Make Another Payment"}
        </Button>
      </div>
    );
  }

  // ── QR / Payment screen ───────────────────────────────────────────────────

  if (showQR && paymongoSource) {
    const isGcash    = selected === "gcash";
    const isMaya     = selected === "paymaya";
    const isInstaPay = selected === "instapay";

    // Deep link URLs (redirect to app directly on mobile)
    const gcashDeepLink  = paymongoSource.checkout_url; // PayMongo redirects to GCash
    const mayaDeepLink   = paymongoSource.checkout_url;
    const qrValue        = paymongoSource.checkout_url;

    return (
      <div className="max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setShowQR(false); setPaymongoSource(null); setPollingActive(false); }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Complete Payment</h1>
            <p className="text-sm text-muted-foreground">Scan the QR or tap the button to pay</p>
          </div>
        </div>

        {/* Amount summary */}
        <div className="rounded-2xl border bg-card p-5 shadow-civic flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Amount Due</p>
            <p className="font-mono text-2xl font-bold text-foreground">
              ₱{payAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()} · {stall?.stall_number}
            </p>
          </div>
          {pollingActive && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Waiting for payment…
            </div>
          )}
        </div>

        {/* QR Code */}
        <div className="rounded-2xl border bg-card p-6 shadow-civic flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <QrCode className="h-4 w-4" />
            Scan with {isGcash ? "GCash" : isMaya ? "Maya" : "any banking app"}
          </div>
          <div className="rounded-2xl border-4 border-primary/10 p-3 bg-white">
            <QRCodeCanvas
              value={qrValue}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground max-w-xs">
            Open your {isGcash ? "GCash" : isMaya ? "Maya" : "banking"} app → Scan QR → Confirm the exact amount of <strong>₱{payAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
          </p>

          {/* Copy link */}
          <button
            onClick={() => copyToClipboard(paymongoSource.checkout_url)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy payment link
          </button>
        </div>

        {/* Payment app buttons */}
        <div className="space-y-3">
          {isGcash && (
            <a
              href={gcashDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-500 px-6 py-4 text-white font-semibold text-base hover:bg-blue-600 transition-colors shadow-sm"
            >
              <Smartphone className="h-5 w-5" />
              Open GCash App to Pay
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          )}

          {isMaya && (
            <a
              href={mayaDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-green-600 px-6 py-4 text-white font-semibold text-base hover:bg-green-700 transition-colors shadow-sm"
            >
              <Smartphone className="h-5 w-5" />
              Open Maya App to Pay
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          )}

          {isInstaPay && (
            <a
              href={paymongoSource.checkout_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 text-primary-foreground font-semibold text-base hover:opacity-90 transition-opacity shadow-sm"
            >
              <Building2 className="h-5 w-5" />
              Pay via Online Banking
              <ExternalLink className="h-4 w-4 opacity-70" />
            </a>
          )}
        </div>

        {/* Polling status / refresh */}
        <div className="rounded-xl bg-secondary/50 p-4 flex items-start gap-3 text-sm">
          {pollingActive ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Waiting for payment confirmation</p>
                <p className="text-muted-foreground">This page will automatically update once your payment is received.</p>
              </div>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Already paid?</p>
                <button
                  onClick={() => pendingPaymentId && pollPaymentStatus(pendingPaymentId)}
                  className="text-primary hover:underline"
                >
                  Click to check payment status
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Main payment selection form ───────────────────────────────────────────

  const isAdvancePayment = nextUnpaidMonth > new Date().getMonth() + 1;
  const isPending        = initiateOnlinePayment.isPending || makeCashPayment.isPending;
  const canPay           = selected && !isPending && (payType === "full" || (staggeredAmount && Number(staggeredAmount) > 0));

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pay Online</h1>
        <p className="text-sm text-muted-foreground">Choose your payment method and complete your stall fee</p>
      </div>

      {/* Billing summary */}
      <div className="rounded-2xl border bg-card p-6 shadow-civic">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Payment Details</h3>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Stall</span>
            <span className="font-medium text-foreground">{stall?.stall_number || "—"} ({stall?.section || "General"})</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Billing Month</span>
            <span className="font-semibold text-foreground">
              {MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()}
              {isAdvancePayment && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Advance</span>}
            </span>
          </div>
          {paidForNextMonth > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Already Paid</span>
              <span className="font-mono font-medium text-success">₱{paidForNextMonth.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="font-medium text-foreground">{paidForNextMonth > 0 ? "Remaining Balance" : "Monthly Rate"}</span>
            <span className="font-mono text-lg font-bold text-foreground">₱{remainingBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      {/* Payment type (full / staggered) */}
      <div className="rounded-2xl border bg-card p-6 shadow-civic">
        <h3 className="mb-3 text-sm font-medium text-foreground">Payment Type</h3>
        <div className="flex rounded-xl bg-secondary p-1">
          <button onClick={() => setPayType("full")} className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType === "full" ? "bg-card text-foreground shadow-civic" : "text-muted-foreground"}`}>Full Payment</button>
          <button onClick={() => setPayType("staggered")} className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType === "staggered" ? "bg-card text-foreground shadow-civic" : "text-muted-foreground"}`}>Staggered</button>
        </div>
        {payType === "staggered" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-secondary/50 p-3 text-sm flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-foreground font-medium">Pay any amount towards your balance</p>
                <p className="text-muted-foreground mt-0.5">
                  Remaining: <strong className="text-foreground">₱{remainingBalance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</strong>
                  {paidForNextMonth > 0 && <span> (already paid ₱{paidForNextMonth.toLocaleString("en-PH", { minimumFractionDigits: 2 })})</span>}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Amount to Pay (₱)</Label>
              <Input
                type="number"
                placeholder={`Max ₱${remainingBalance.toLocaleString()}`}
                value={staggeredAmount}
                onChange={(e) => setStaggeredAmount(e.target.value)}
                className="h-11 rounded-xl font-mono"
                max={remainingBalance}
              />
            </div>
            {staggeredAmount && Number(staggeredAmount) > 0 && Number(staggeredAmount) < remainingBalance && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm">
                <p className="text-accent font-medium">After this payment, you'll still owe:</p>
                <p className="font-mono text-lg font-bold text-accent">
                  ₱{(remainingBalance - Number(staggeredAmount)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-muted-foreground text-xs mt-1">for {MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gateway selection */}
      <div className="rounded-2xl border bg-card p-6 shadow-civic">
        <h3 className="mb-3 text-sm font-medium text-foreground">Choose Payment Method</h3>
        <div className="grid grid-cols-2 gap-3">
          {gateways.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelected(g.id)}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all ${selected === g.id ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-secondary/50"}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${g.color}`}>
                <g.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{g.label}</p>
                <p className="text-xs text-muted-foreground">{g.description}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Show QR hint when online method selected */}
        {selected && selected !== "cash" && (
          <div className="mt-4 rounded-xl bg-primary/5 border border-primary/10 p-3 flex items-center gap-3 text-sm">
            <QrCode className="h-5 w-5 text-primary shrink-0" />
            <p className="text-foreground">
              A <strong>QR code</strong> will be generated for the exact amount. You can scan it with {selected === "gcash" ? "GCash" : selected === "paymaya" ? "Maya" : "any banking app"} or tap the direct pay button.
            </p>
          </div>
        )}
      </div>

      {/* Pay button */}
      <Button
        variant="hero"
        size="xl"
        className="w-full"
        disabled={!canPay}
        onClick={handlePay}
      >
        {isPending ? (
          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing Payment…</>
        ) : selected === "cash" ? (
          <><Banknote className="mr-2 h-5 w-5" /> Submit Cash Payment Request</>
        ) : selected ? (
          <><QrCode className="mr-2 h-5 w-5" /> Generate QR & Pay — ₱{(payType === "full" ? remainingBalance : Number(staggeredAmount || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</>
        ) : (
          <><CreditCard className="mr-2 h-5 w-5" /> Select a payment method above</>
        )}
      </Button>
    </div>
  );
};

export default VendorPayOnline;
