import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Loader2, AlertTriangle, ArrowLeft,
  ChevronRight, Upload, Image, X, Scan, Building2,
  Clock, FileText, Eye,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import VendorMobileShell from "@/components/VendorMobileShell";
import { toast } from "sonner";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// ─── Municipality bank/payment details ─────────────────────────────────────────
// Update these with the actual municipality account details
const BANK_DETAILS = {
  bankName:      "Land Bank of the Philippines",
  accountName:   "Municipality of San Juan, Batangas",
  accountNumber: "0000-0000-00",
  instapayQR:    "/bankqr.png",   // place your QR image at public/bankqr.png
  notes:         "Pay via InstaPay, bank transfer, GCash, or Maya to this account.",
};

// ─── Steps ─────────────────────────────────────────────────────────────────────
const Steps = ({ current }: { current: 1 | 2 | 3 | 4 }) => (
  <div className="flex items-center gap-0 mb-6">
    {[
      { n: 1, label: "Review"  },
      { n: 2, label: "Pay"     },
      { n: 3, label: "Upload"  },
      { n: 4, label: "Done"    },
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
        {i < 3 && (
          <div className={`h-px w-10 mx-1 mb-4 transition-all ${current > s.n ? "bg-success" : "bg-border"}`} />
        )}
      </div>
    ))}
  </div>
);

// ─── OCR Result display ─────────────────────────────────────────────────────────
const OCRResult = ({ data }: { data: any }) => {
  const fields = [
    { label: "Reference No.", value: data.reference_number, mono: true },
    { label: "Amount",        value: data.amount ? fmt(Number(data.amount)) : null },
    { label: "Date & Time",   value: data.datetime },
    { label: "Recipient",     value: data.recipient },
  ].filter(f => f.value);

  if (!fields.length) return null;

  const confidenceColor = data.confidence === "high" ? "text-success" : data.confidence === "medium" ? "text-amber-600" : "text-accent";

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Scan className="h-3.5 w-3.5" /> Auto-detected from receipt
        </p>
        <span className={`text-xs font-medium ${confidenceColor}`}>
          {data.confidence} confidence
        </span>
      </div>
      {fields.map(f => (
        <div key={f.label} className="flex justify-between text-sm">
          <span className="text-muted-foreground">{f.label}</span>
          <span className={`font-medium text-foreground text-right max-w-[60%] break-all ${f.mono ? "font-mono text-xs" : ""}`}>
            {f.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Component ─────────────────────────────────────────────────────────────────
const VendorPayOnline = () => {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const fileRef     = useRef<HTMLInputElement>(null);

  const [step,            setStep]           = useState<1|2|3|4>(1);
  const [payType,         setPayType]        = useState<"full"|"staggered">("full");
  const [staggeredAmount, setStaggeredAmount]= useState("");
  const [receiptFile,     setReceiptFile]    = useState<File | null>(null);
  const [receiptPreview,  setReceiptPreview] = useState<string | null>(null);
  const [ocrData,         setOcrData]        = useState<any | null>(null);
  const [ocrLoading,      setOcrLoading]     = useState(false);
  const [submissionId,    setSubmissionId]   = useState<string | null>(null);

  // ── Fetch billing info ──────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ["vendor-pay-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, stall_id, stalls(id, stall_number, section, monthly_rate)")
        .eq("user_id", user!.id)
        .single();
      if (!vendor) return null;

      const stall       = vendor.stalls as any;
      const defaultRate = stall?.monthly_rate || 1450;
      const currentYear = new Date().getFullYear();

      const [paymentsRes, schedulesRes] = await Promise.all([
        supabase.from("payments")
          .select("period_month, period_year, amount, status")
          .eq("vendor_id", vendor.id)
          .eq("status", "completed")
          .eq("period_year", currentYear),
        stall?.id
          ? (supabase.from("stall_fee_schedules" as any) as any)
              .select("*").eq("stall_id", stall.id).eq("year", currentYear)
          : Promise.resolve({ data: [] }),
      ]);

      const payments  = paymentsRes.data  || [];
      const schedules = schedulesRes.data || [];
      const getMonthFee = (m: number) => {
        const s = schedules.find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };

      const rawPaidMap: Record<number, number> = {};
      payments.forEach(p => {
        if (p.period_month) rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
      });

      const effectiveMap: Record<number, number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m    = getMonthFee(m);
        const credited = (rawPaidMap[m] || 0) + carry;
        effectiveMap[m] = credited;
        carry           = credited >= due_m ? credited - due_m : 0;
      }

      let nextUnpaidMonth = 13;
      for (let m = 1; m <= 12; m++) {
        if (effectiveMap[m] < getMonthFee(m)) { nextUnpaidMonth = m; break; }
      }

      const monthlyRate      = getMonthFee(nextUnpaidMonth);
      const paidForNextMonth = effectiveMap[nextUnpaidMonth] || 0;
      const remainingBalance = Math.max(0, monthlyRate - paidForNextMonth);

      return { vendor, stall, monthlyRate, nextUnpaidMonth, paidForNextMonth, remainingBalance, allPaid: nextUnpaidMonth > 12 };
    },
  });

  const stall            = data?.stall;
  const monthlyRate      = data?.monthlyRate || 1450;
  const nextUnpaidMonth  = data?.nextUnpaidMonth || (new Date().getMonth() + 1);
  const remainingBalance = data?.remainingBalance || monthlyRate;
  const paidForNextMonth = data?.paidForNextMonth || 0;
  const payAmount        = payType === "full" ? remainingBalance : Number(staggeredAmount || 0);
  const canProceed       = payType === "full" || (!!staggeredAmount && Number(staggeredAmount) > 0 && Number(staggeredAmount) <= remainingBalance);

  // ── Handle receipt image selection + OCR ───────────────────────────────────
  const handleFileSelect = async (file: File) => {
    setReceiptFile(file);
    setOcrData(null);

    // Preview
    const reader = new FileReader();
    reader.onload = e => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    // OCR
    setOcrLoading(true);
    try {
      const b64Reader = new FileReader();
      b64Reader.onload = async (e) => {
        const dataUrl   = e.target?.result as string;
        const base64    = dataUrl.split(",")[1];
        const mediaType = file.type || "image/jpeg";

        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ocr-receipt`, {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${anonKey}`,
            "apikey":        anonKey,
          },
          body: JSON.stringify({ image_base64: base64, media_type: mediaType }),
        });

        if (res.ok) {
          const result = await res.json();
          setOcrData(result.extracted || null);
          if (result.extracted?.confidence === "high") {
            toast.success("Receipt scanned successfully!");
          } else {
            toast.info("Receipt scanned — please verify the details.");
          }
        } else {
          toast.error("Could not scan receipt. You can still submit manually.");
        }
        setOcrLoading(false);
      };
      b64Reader.readAsDataURL(file);
    } catch {
      setOcrLoading(false);
      toast.error("Scan failed. You can still submit.");
    }
  };

  // ── Submit receipt ──────────────────────────────────────────────────────────
  const submitReceipt = useMutation({
    mutationFn: async () => {
      if (!receiptFile) throw new Error("Please upload your payment receipt.");
      if (!data?.vendor) throw new Error("Vendor data not found.");

      // 1. Upload image to Supabase Storage
      const ext      = receiptFile.name.split(".").pop() || "jpg";
      const filePath = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(filePath, receiptFile, { upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from("payment-receipts")
        .getPublicUrl(filePath);
      const receiptUrl = urlData.publicUrl;

      // 3. Save submission record
      const { data: submission, error: subError } = await (supabase
        .from("payment_submissions" as any) as any)
        .insert({
          vendor_id:      data.vendor.id,
          vendor_user_id: user!.id,
          stall_id:       data.vendor.stall_id || null,
          amount:         payAmount,
          period_month:   nextUnpaidMonth,
          period_year:    new Date().getFullYear(),
          payment_method: "instapay",
          payment_type:   payType === "full" ? "due" : "staggered",
          receipt_url:    receiptUrl,
          receipt_path:   filePath,
          ocr_reference:  ocrData?.reference_number || null,
          ocr_amount:     ocrData?.amount           || null,
          ocr_datetime:   ocrData?.datetime         || null,
          ocr_recipient:  ocrData?.recipient        || null,
          ocr_raw:        ocrData ? JSON.stringify(ocrData) : null,
          status:         "pending",
        })
        .select("id")
        .single();
      if (subError) throw new Error(`Submission failed: ${subError.message}`);

      // 4. Notify cashiers — in-app notification to all cashiers
      const { data: cashiers } = await (supabase
        .from("user_roles" as any) as any)
        .select("user_id")
        .eq("role", "cashier");

      if (cashiers?.length) {
        const vendorName = `${stall?.stall_number} — ${stall?.section}`;
        await supabase.from("notifications").insert(
          cashiers.map((c: any) => ({
            user_id: c.user_id,
            title:   `📋 New Online Payment — ${fmt(payAmount)}`,
            message: `Vendor ${vendorName} submitted a payment receipt for ${MONTHS[nextUnpaidMonth - 1]} ${new Date().getFullYear()}.\n• Amount: ${fmt(payAmount)}\n• Method: InstaPay / Bank Transfer\n• Ref: ${ocrData?.reference_number || "—"}\n\nPlease review and verify in Accept Payment.`,
            type:    "info",
          }))
        );
      }

      return submission.id;
    },
    onSuccess: (id) => {
      setSubmissionId(id);
      setStep(4);
      queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-submissions"] });
      toast.success("Receipt submitted! The cashier will verify your payment.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // ── All paid ────────────────────────────────────────────────────────────────
  if (data?.allPaid) return (
    <div className="flex flex-col items-center justify-center py-20 text-center max-w-sm mx-auto">
      <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <h2 className="text-2xl font-bold text-foreground">All Paid for {new Date().getFullYear()}!</h2>
      <p className="mt-2 text-muted-foreground">You have no outstanding balance for this year.</p>
    </div>
  );

  // ── STEP 4: Success ─────────────────────────────────────────────────────────
  if (step === 4) return (
    <div className="flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto space-y-5">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 className="h-10 w-10 text-success" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">Receipt Submitted!</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Your receipt is now pending cashier verification.
        </p>
      </div>

      <div className="w-full rounded-2xl border bg-card p-5 text-left space-y-2.5 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Submission Summary</p>
        {[
          { label: "Stall",      value: `${stall?.stall_number} — ${stall?.section}` },
          { label: "Period",     value: `${MONTHS[nextUnpaidMonth - 1]} ${new Date().getFullYear()}` },
          { label: "Amount",     value: fmt(payAmount) },
          { label: "Reference",  value: ocrData?.reference_number || "—" },
          { label: "Status",     value: "⏳ Pending cashier review" },
        ].map(r => (
          <div key={r.label} className="flex justify-between">
            <span className="text-muted-foreground">{r.label}</span>
            <span className={`font-medium text-right ${r.label === "Reference" ? "font-mono text-xs" : ""}`}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
        <Clock className="h-4 w-4 shrink-0 mt-0.5" />
        <span>The cashier will review your receipt and confirm your payment. You'll be notified once it's approved.</span>
      </div>

      <Button variant="outline" className="w-full" onClick={() => {
        setStep(1); setReceiptFile(null); setReceiptPreview(null);
        setOcrData(null); setStaggeredAmount(""); setSubmissionId(null);
      }}>
        Submit Another Payment
      </Button>
    </div>
  );

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <VendorMobileShell title="Pay Online" subtitle="Submit your stall payment">
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pay Online</h1>
        <p className="text-sm text-muted-foreground">Pay via bank transfer or e-wallet and upload your receipt</p>
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
            </div>
          </div>

          {/* Payment type */}
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
              </div>
            )}
          </div>

          <Button variant="hero" size="lg" className="w-full gap-2" disabled={!canProceed} onClick={() => setStep(2)}>
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── STEP 2: Bank / payment details ────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          {/* Amount reminder */}
          <div className="rounded-xl border bg-secondary/50 px-4 py-3 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()} · {payType === "staggered" ? "Partial" : "Full"}</span>
            <span className="font-mono font-bold text-foreground text-base">{fmt(payAmount)}</span>
          </div>

          {/* Bank details card */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-civic">
            <div className="bg-primary px-5 py-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Building2 className="h-5 w-5 text-primary-foreground/80" />
                <p className="text-sm font-bold text-primary-foreground">Pay to this Account</p>
              </div>
              <p className="text-xs text-primary-foreground/60">Municipality of San Juan, Batangas</p>
            </div>

            <div className="px-5 py-5 space-y-4">
              {/* Account details */}
              <div className="space-y-3 text-sm">
                {[
                  { label: "Bank",           value: BANK_DETAILS.bankName },
                  { label: "Account Name",   value: BANK_DETAILS.accountName },
                  { label: "Account Number", value: BANK_DETAILS.accountNumber, mono: true },
                ].map(r => (
                  <div key={r.label} className="flex items-start justify-between gap-3">
                    <span className="text-muted-foreground shrink-0">{r.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold text-right text-foreground ${r.mono ? "font-mono" : ""}`}>
                        {r.value}
                      </span>
                      {r.mono && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(r.value); toast.success("Copied!"); }}
                          className="text-xs text-primary hover:underline shrink-0">
                          Copy
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="h-px bg-border" />

              {/* Static QR code */}
              {BANK_DETAILS.instapayQR && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Scan QR to Pay</p>
                  <img
                    src={BANK_DETAILS.instapayQR}
                    alt="Bank QR Code"
                    className="w-48 h-48 object-contain rounded-xl border bg-white p-2"
                  />
                  <p className="text-xs text-muted-foreground">InstaPay / QR Ph compatible</p>
                </div>
              )}

              <div className="h-px bg-border" />

              {/* Amount to send */}
              <div className="rounded-xl bg-success/5 border border-success/20 p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Send exactly</p>
                <p className="font-mono text-3xl font-bold text-success">{fmt(payAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">{MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()} · Stall {stall?.stall_number}</p>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                {BANK_DETAILS.notes}
              </p>
            </div>
          </div>

          {/* Instructions */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm text-amber-800">
            <p className="font-semibold">How to pay:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
              <li>Open your GCash, Maya, or banking app</li>
              <li>Send <strong>{fmt(payAmount)}</strong> to the account above via InstaPay or bank transfer</li>
              <li>Save or screenshot your payment confirmation/receipt</li>
              <li>Come back here and upload the screenshot in the next step</li>
            </ol>
          </div>

          <Button variant="hero" size="lg" className="w-full gap-2" onClick={() => setStep(3)}>
            I've Paid — Upload Receipt <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ── STEP 3: Upload receipt ─────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>

          <div className="rounded-xl border bg-secondary/50 px-4 py-3 flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Submitting for {MONTHS[nextUnpaidMonth - 1]} {new Date().getFullYear()}</span>
            <span className="font-mono font-bold text-foreground">{fmt(payAmount)}</span>
          </div>

          {/* Upload area */}
          <div
            onClick={() => !receiptFile && fileRef.current?.click()}
            className={`rounded-2xl border-2 border-dashed transition-all ${
              receiptFile ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
            } p-6`}>

            {!receiptFile ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                  <Upload className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Upload Payment Receipt</p>
                  <p className="text-xs text-muted-foreground mt-1">Screenshot or photo of your GCash/Maya/bank confirmation</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                  <Image className="h-4 w-4" /> Choose Image
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Preview */}
                <div className="relative">
                  <img
                    src={receiptPreview!}
                    alt="Receipt"
                    className="w-full max-h-64 object-contain rounded-xl border bg-white"
                  />
                  <button
                    onClick={e => { e.stopPropagation(); setReceiptFile(null); setReceiptPreview(null); setOcrData(null); }}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-card border shadow-sm hover:bg-secondary">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* OCR loading */}
                {ocrLoading && (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning receipt…
                  </div>
                )}

                {/* OCR results */}
                {!ocrLoading && ocrData && <OCRResult data={ocrData} />}

                {/* Change file */}
                <button
                  onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                  <Image className="h-3.5 w-3.5" /> Change image
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
          />

          {/* Info note */}
          {!receiptFile && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-2 text-xs text-primary">
              <Scan className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>We'll automatically scan your receipt to extract the reference number and amount for verification.</span>
            </div>
          )}

          <Button
            variant="hero" size="lg" className="w-full gap-2"
            disabled={!receiptFile || ocrLoading || submitReceipt.isPending}
            onClick={() => submitReceipt.mutate()}>
            {submitReceipt.isPending ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</>
            ) : (
              <><FileText className="h-5 w-5" /> Submit for Verification</>
            )}
          </Button>
        </div>
      )}
    </div>
    </VendorMobileShell>
  );
};

export default VendorPayOnline;