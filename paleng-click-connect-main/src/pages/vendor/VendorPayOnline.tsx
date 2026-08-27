import VendorBottomNav from "@/components/VendorBottomNav";
import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, Loader2, AlertTriangle, ArrowLeft,
  ChevronRight, Upload, Image, X, Scan, Building2,
  Clock, FileText, Eye, XCircle, Lock, Shield,
  Store, Calendar, Sparkles, Check, Info, BadgeCheck,
} from "lucide-react";
import { scanReceipt } from "@/lib/geminiReceiptScanner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n: number) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DS = {
  gradientHeader: "linear-gradient(160deg, #0d2240 0%, #1a3a5f 45%, #1d4ed8 80%, #2563eb 100%)",
  gradientCard: "linear-gradient(135deg, #1a3a5f 0%, #2563eb 100%)",
  blue900: "#0d2240",
  blue600: "#2563eb",
};

const BANK_DETAILS = {
  bankName: "Land Bank of the Philippines",
  accountName: "Municipality of San Juan, Batangas",
  accountNumber: "09260714277",
  instapayQR: "/bankqr.png",
  notes: "Pay via InstaPay, bank transfer, GCash, or Maya to this account.",
};

const BOLANTE_CATEGORIES = [
  { id: "business_permit", label: "Business Permit & Licensing (BPLO)", desc: "Annual / renewal municipal business permit requirement" },
  { id: "regulatory_fee", label: "Annual Regulatory & Inspection Fee", desc: "Bolante section vendor regulatory compliance" },
  { id: "market_clearance", label: "Market & Sanitary Clearance", desc: "Sanitary inspection and market operational permit" },
  { id: "custom_fee", label: "Custom Requirement / Assessment Fee", desc: "Special assessment or custom permit payment" },
];

// ─── Step Bar ──────────────────────────────────────────────────────────────────
const Steps = ({ current }: { current: 1 | 2 | 3 | 4 }) => (
  <div className="flex items-center px-5 py-4 bg-white border-b border-slate-100">
    {[
      { n: 1, label: "Review" },
      { n: 2, label: "Pay" },
      { n: 3, label: "Upload" },
      { n: 4, label: "Done" },
    ].map((s, i) => (
      <div key={s.n} className="flex items-center flex-1">
        <div className="flex flex-col items-center">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all ${current === s.n ? "text-white" :
            current > s.n ? "bg-green-600 text-white" :
              "bg-slate-100 text-slate-400"
            }`} style={current === s.n ? { background: DS.blue600, boxShadow: `0 2px 8px rgba(37,99,235,0.35)` } : {}}>
            {current > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
          </div>
          <span className={`text-[10px] mt-1 font-medium uppercase tracking-wide ${current >= s.n ? "text-slate-700" : "text-slate-400"
            } ${current === s.n ? "font-bold" : ""}`}
            style={current === s.n ? { color: DS.blue600 } : {}}>
            {s.label}
          </span>
        </div>
        {i < 3 && (
          <div className={`flex-1 h-0.5 mx-1 mb-4 transition-all ${current > s.n ? "bg-green-500" : "bg-slate-200"}`} />
        )}
      </div>
    ))}
  </div>
);

// ─── OCR Result ────────────────────────────────────────────────────────────────
const OCRResult = ({ data }: { data: any }) => {
  const fields = [
    { label: "Reference No.", value: data.reference_number, mono: true },
    { label: "Amount", value: data.amount ? fmt(Number(data.amount)) : null },
    { label: "Date & Time", value: data.datetime },
    { label: "Recipient", value: data.recipient },
  ].filter(f => f.value);

  if (!fields.length) return null;

  const confidenceColor = data.confidence === "high" ? "text-green-600" : data.confidence === "medium" ? "text-amber-600" : "text-red-500";

  return (
    <div className="rounded-xl border px-4 py-3 space-y-2"
      style={{ background: DS.blue900 + "0d", borderColor: DS.blue600 + "33" }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: DS.blue600 }}>
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

// ─── Main Component ────────────────────────────────────────────────────────────
const VendorPayOnline = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Month & Payment Mode selection
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [monthInitialized, setMonthInitialized] = useState(false);

  // For regular stall vendors: 'month_due' | 'custom_advance' | 'permit_requirement'
  const [paymentMode, setPaymentMode] = useState<"month_due" | "custom_advance" | "permit_requirement">("month_due");
  const [customAmount, setCustomAmount] = useState("");

  // For Bolante vendors
  const [bolanteCategory, setBolanteCategory] = useState<string>("Business Permit & Licensing (BPLO)");
  const [permitNote, setPermitNote] = useState("");

  // Receipt & OCR state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<any | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  // Manual overrides for OCR or direct entry
  const [refNum, setRefNum] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [detectedRef, setDetectedRef] = useState<string | null>(null);
  const [isReceiptImageDuplicate, setIsReceiptImageDuplicate] = useState(false);
  const [duplicateRefError, setDuplicateRefError] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const resetReceiptState = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setOcrData(null);
    setDetectedRef(null);
    setIsReceiptImageDuplicate(false);
    setDuplicateRefError(null);
    setRefNum("");
    setPaidAmount("");
  };

  const checkDuplicateReference = async (ref: string): Promise<boolean> => {
    if (!ref || ref.trim().length < 4) return false;
    const rawRef = ref.trim();
    const normalizedRef = rawRef.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    if (normalizedRef.length < 4) return false;

    setIsCheckingDuplicate(true);
    try {
      const { data: rpcDup, error: rpcErr } = await supabase.rpc("check_reference_exists" as any, {
        p_reference: rawRef
      });
      if (!rpcErr && rpcDup === true) return true;

      const { data: submissions } = await supabase
        .from("payment_submissions")
        .select("id, status, ocr_reference")
        .in("status", ["pending", "accepted", "approved"]);

      const match = (submissions || []).find((s: any) => {
        const sRef = (s.ocr_reference || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        return sRef && sRef === normalizedRef;
      });

      return !!match;
    } catch (err) {
      console.error("Error checking duplicate reference:", err);
      return false;
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  useEffect(() => {
    if (isReceiptImageDuplicate && detectedRef) {
      setDuplicateRefError(`Reference number "${detectedRef}" has already been submitted for a previous payment. Duplicate receipts are not allowed.`);
      return;
    }

    const timer = setTimeout(async () => {
      if (refNum && refNum.trim().length >= 4) {
        const isDup = await checkDuplicateReference(refNum);
        if (isDup) {
          setDuplicateRefError(`Reference number "${refNum.trim()}" has already been submitted for a previous payment. Duplicate receipts are not allowed.`);
        } else {
          setDuplicateRefError(null);
        }
      } else {
        setDuplicateRefError(null);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [refNum, isReceiptImageDuplicate, detectedRef]);

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-pay-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("id, stall_id, business_permit_number, award_receipt_number, stalls(id, stall_number, section, monthly_rate, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028)")
        .eq("user_id", user!.id)
        .single();
      if (!vendor) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, contact_number")
        .eq("user_id", user!.id)
        .single();

      const { data: appData } = await supabase
        .from("vendor_applications")
        .select("preferred_section, business_permit_number, award_receipt_number")
        .eq("applicant_user_id", user!.id)
        .maybeSingle();

      const stall = vendor.stalls as any;
      const preferredSection = appData?.preferred_section || null;
      const isBolante = !stall && (!!preferredSection?.toLowerCase().includes("bolante") || !vendor.stall_id);
      const defaultRate = stall ? (Number(stall.monthly_rate_2026) || Number(stall.monthly_rate) || 0) : 0;
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const [paymentsRes, schedulesRes] = await Promise.all([
        supabase.from("payments")
          .select("period_month, period_year, amount, status")
          .eq("vendor_id", vendor.id)
          .eq("status", "completed")
          .eq("period_year", currentYear),
        stall?.id
          ? supabase.from("stall_fee_schedules")
            .select("*").eq("stall_id", stall.id).eq("year", currentYear)
          : Promise.resolve({ data: [] }),
      ]);

      const payments = paymentsRes.data || [];
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
        const due_m = getMonthFee(m);
        const credited = (rawPaidMap[m] || 0) + carry;
        effectiveMap[m] = credited;
        carry = credited >= due_m ? credited - due_m : 0;
      }

      let nextUnpaidMonth = 13;
      if (stall && defaultRate > 0) {
        for (let m = 1; m <= 12; m++) {
          if (effectiveMap[m] < getMonthFee(m)) {
            nextUnpaidMonth = m;
            break;
          }
        }
      }

      const isCurrentMonthPaid = stall && defaultRate > 0 ? (effectiveMap[currentMonth] || 0) >= getMonthFee(currentMonth) : true;
      const allRegularPaid = stall && defaultRate > 0 ? nextUnpaidMonth > 12 : false;

      // Determine default recommended target month
      let defaultTargetMonth = currentMonth;
      if (stall && defaultRate > 0) {
        if (nextUnpaidMonth <= 12) {
          defaultTargetMonth = nextUnpaidMonth;
        } else {
          // If all months up to Dec are paid, default to upcoming year cycle or current month
          defaultTargetMonth = currentMonth;
        }
      }

      return {
        vendor,
        profile,
        stall,
        defaultRate,
        currentYear,
        currentMonth,
        isBolante,
        preferredSection,
        nextUnpaidMonth,
        defaultTargetMonth,
        isCurrentMonthPaid,
        allRegularPaid,
        effectiveMap,
        rawPaidMap,
        getMonthFee,
        businessPermitNumber: appData?.business_permit_number || vendor.business_permit_number || null,
      };
    },
  });

  // Automatically initialize selectedMonth to recommended default target month
  useEffect(() => {
    if (data?.defaultTargetMonth && !monthInitialized) {
      setSelectedMonth(data.defaultTargetMonth);
      setMonthInitialized(true);
    }
  }, [data?.defaultTargetMonth, monthInitialized]);

  const stall = data?.stall;
  const isBolante = !!data?.isBolante;
  const preferredSection = data?.preferredSection || (isBolante ? "Bolante Section" : "General");
  const currentYear = data?.currentYear || new Date().getFullYear();
  const currentMonth = data?.currentMonth || (new Date().getMonth() + 1);

  // Month-specific calculations
  const selectedMonthFee = data ? data.getMonthFee(selectedMonth) : 0;
  const selectedMonthPaid = data ? (data.effectiveMap[selectedMonth] || 0) : 0;
  const selectedMonthBalance = Math.max(0, selectedMonthFee - selectedMonthPaid);
  const isSelectedMonthSettled = selectedMonthFee > 0 && selectedMonthPaid >= selectedMonthFee;

  // Calculate the amount to pay based on selection and mode
  let payAmount = 0;
  if (isBolante) {
    payAmount = Number(customAmount || 0);
  } else {
    if (paymentMode === "month_due") {
      // If month has remaining balance, use balance; if already fully paid, use the full monthly rate for advance credit
      payAmount = selectedMonthBalance > 0 ? selectedMonthBalance : selectedMonthFee;
    } else {
      payAmount = Number(customAmount || 0);
    }
  }

  const actualSubmittedAmount = (paidAmount && !isNaN(Number(paidAmount)) && Number(paidAmount) > 0)
    ? Number(paidAmount)
    : payAmount;

  const canProceed = payAmount > 0;

  const handleFileSelect = async (file: File) => {
    setReceiptFile(file);
    setOcrData(null);
    setDetectedRef(null);
    setIsReceiptImageDuplicate(false);
    setDuplicateRefError(null);
    setRefNum("");
    setPaidAmount("");

    const reader = new FileReader();
    reader.onload = e => setReceiptPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setOcrLoading(true);
    try {
      const results = await scanReceipt(file);
      console.log("Scan Results:", results);

      setOcrData(results);
      if (results.amount) setPaidAmount(results.amount);

      if (results.reference_number) {
        setDetectedRef(results.reference_number);
        setRefNum(results.reference_number);

        const isDup = await checkDuplicateReference(results.reference_number);
        if (isDup) {
          setIsReceiptImageDuplicate(true);
          setDuplicateRefError(`Reference number "${results.reference_number}" has already been submitted for a previous payment. Duplicate receipts are not allowed.`);
          toast.error("Duplicate receipt detected! This receipt has already been used.");
        } else {
          setIsReceiptImageDuplicate(false);
          setDuplicateRefError(null);
          toast.success("Receipt scanned! Details auto-filled.");
        }
      } else {
        setDetectedRef(null);
        setIsReceiptImageDuplicate(false);
        setDuplicateRefError(null);
        setRefNum("");
        toast.info("Reference number not detected. Please enter it manually.");
      }
    } catch (err) {
      console.error("Receipt Scanning Error:", err);
      toast.error("Scanning service unavailable. Please enter details manually.");
    } finally {
      setOcrLoading(false);
    }
  };

  const submitReceipt = useMutation({
    mutationFn: async () => {
      if (!receiptFile) throw new Error("Please upload your payment receipt.");
      if (!data?.vendor) throw new Error("Vendor data not found.");

      if (isReceiptImageDuplicate) {
        throw new Error(`Duplicate Receipt: The uploaded receipt (${detectedRef || refNum}) has already been submitted and cannot be reused.`);
      }

      if (detectedRef) {
        const isDetectedDup = await checkDuplicateReference(detectedRef);
        if (isDetectedDup) {
          throw new Error(`Duplicate Receipt: Reference number "${detectedRef}" on this receipt has already been submitted for a previous payment.`);
        }
      }

      if (refNum) {
        const isDup = await checkDuplicateReference(refNum);
        if (isDup) {
          throw new Error(`Duplicate Receipt: Reference number "${refNum.trim()}" has already been submitted for a previous payment.`);
        }
      }

      const ext = receiptFile.name.split(".").pop() || "jpg";
      const filePath = `${user!.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-receipts")
        .upload(filePath, receiptFile, { upsert: false });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const { data: urlData } = supabase.storage
        .from("payment-receipts")
        .getPublicUrl(filePath);
      const receiptUrl = urlData.publicUrl;

      const finalAmount = (paidAmount && !isNaN(Number(paidAmount)) && Number(paidAmount) > 0)
        ? Number(paidAmount)
        : payAmount;

      const isPartial = !isBolante && paymentMode === "month_due" && finalAmount < selectedMonthBalance;
      const paymentType = isPartial || paymentMode === "custom_advance" ? "staggered" : "due";

      const { data: submission, error: subError } = await supabase
        .from("payment_submissions")
        .insert({
          vendor_id: data.vendor.id,
          vendor_user_id: user!.id,
          stall_id: data.vendor.stall_id || null,
          amount: finalAmount,
          period_month: selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : currentMonth,
          period_year: currentYear,
          payment_method: "instapay",
          payment_type: paymentType,
          receipt_url: receiptUrl,
          receipt_path: filePath,
          ocr_reference: refNum || null,
          ocr_amount: finalAmount,
          ocr_datetime: ocrData?.datetime || null,
          ocr_recipient: isBolante ? bolanteCategory : (paymentMode === "permit_requirement" ? "Business Permit / Requirement" : (ocrData?.recipient || null)),
          ocr_raw: JSON.stringify({ ...(ocrData || {}), bolanteCategory: isBolante ? bolanteCategory : null, purpose: isBolante ? bolanteCategory : paymentMode }),
          status: "pending",
        })
        .select("id")
        .single();
      if (subError) throw new Error(`Submission failed: ${subError.message}`);

      // Notify cashiers
      const { data: cashiers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "cashier");

      if (cashiers?.length) {
        const vendorDisplayName = data.profile ? `${data.profile.first_name} ${data.profile.last_name}` : "Vendor";
        const title = isBolante
          ? `📋 Bolante Requirement Payment — ${fmt(finalAmount)}`
          : `📋 New Online Payment — ${fmt(finalAmount)}`;

        const message = isBolante
          ? `Bolante Vendor ${vendorDisplayName} (${preferredSection}) submitted a payment receipt for ${bolanteCategory}.\n• Amount: ${fmt(finalAmount)}\n• Period: ${MONTHS[selectedMonth - 1]} ${currentYear}\n• Ref: ${refNum || "—"}\n\nPlease review and verify in Accept Payment.`
          : `Vendor ${stall?.stall_number ? `Stall ${stall.stall_number} (${stall.section})` : vendorDisplayName} submitted a payment receipt for ${MONTHS[selectedMonth - 1]} ${currentYear}.\n• Amount: ${fmt(finalAmount)}\n• Method: InstaPay / Bank Transfer\n• Ref: ${refNum || "—"}\n\nPlease review and verify in Accept Payment.`;

        await supabase.from("notifications").insert(
          cashiers.map((c: any) => ({
            user_id: c.user_id,
            title,
            message,
            type: "info",
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

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#2563eb" }} />
    </div>
  );

  // Step 4: Submission Confirmation
  if (step === 4) return (
    <div className="-mx-4 -mt-4 lg:mx-0 lg:mt-0">
      <div className="lg:hidden" style={{ background: DS.gradientHeader }}>
        <div className="px-5 pt-5 pb-6 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <CheckCircle2 className="h-9 w-9 text-white" />
          </div>
          <h2 className="text-2xl font-black text-white">Receipt Submitted!</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            Your receipt is now pending cashier verification.
          </p>
        </div>
      </div>

      <div className="hidden lg:flex flex-col items-center justify-center py-12 text-center max-w-sm mx-auto space-y-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Receipt Submitted!</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Your receipt is now pending cashier verification.
          </p>
        </div>
      </div>

      <div className="px-4 py-4 lg:px-8 lg:max-w-sm lg:mx-auto space-y-4">
        <div className="rounded-2xl border bg-card p-5 space-y-2.5 text-sm shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Submission Summary</p>
          {[
            { label: "Account / Stall", value: isBolante ? `Bolante — ${preferredSection}` : `${stall?.stall_number || "—"} (${stall?.section || "General"})` },
            { label: "Period / Purpose", value: isBolante ? `${bolanteCategory} (${MONTHS[selectedMonth - 1]} ${currentYear})` : `${MONTHS[selectedMonth - 1]} ${currentYear}` },
            { label: "Amount", value: fmt(actualSubmittedAmount) },
            { label: "Reference", value: refNum || "—" },
            { label: "Status", value: "⏳ Pending cashier review" },
          ].map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-muted-foreground">{r.label}</span>
              <span className={`font-medium text-right ${r.label === "Reference" ? "font-mono text-xs" : ""}`}>{r.value}</span>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
          <Clock className="h-4 w-4 shrink-0 mt-0.5" />
          <span>The cashier will review your receipt and confirm your payment. You'll receive a notification once verified.</span>
        </div>

        <Button variant="outline" className="w-full rounded-xl h-11" onClick={() => {
          setStep(1);
          resetReceiptState();
          setCustomAmount("");
          setSubmissionId(null);
        }}>
          Submit Another Payment
        </Button>
      </div>
    </div>
  );

  return (
    <div className="-mx-4 -mt-4 lg:mx-0 lg:mt-0">
      {/* Mobile header */}
      <div className="lg:hidden" style={{ background: DS.gradientHeader, paddingBottom: 0 }}>
        <div className="px-5 pt-5 pb-3">
          <h1 className="text-2xl font-black text-white">Pay Online</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
            {isBolante
              ? "Pay for your business permit & regulatory requirements"
              : "Pay stall rental or advance fees & upload your receipt"}
          </p>
        </div>
      </div>

      {/* Desktop page header */}
      <div className="hidden lg:block" style={{ padding: "28px 32px 0" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Pay Online</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
          {isBolante
            ? "Pay for your business permit, regulatory compliance, and municipal fees online"
            : "Pay stall rental or advance fees via bank transfer / e-wallet and upload your receipt"}
        </p>
      </div>

      {/* Step bar */}
      <div className="lg:px-8 lg:pt-5"><Steps current={step} /></div>

      <div className="px-4 py-4 lg:px-8 lg:pb-8 lg:max-w-2xl space-y-4">

        {/* ── STEP 1: Review & Configure Payment ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">

            {/* ── BOLANTE VENDOR CARD ── */}
            {isBolante ? (
              <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: DS.gradientHeader }}>
                <div className="flex items-start justify-between p-5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 text-[11px] font-bold mb-2">
                      <Shield className="h-3.5 w-3.5" /> Bolante Section Vendor
                    </div>
                    <p className="text-xl font-black text-white">{preferredSection}</p>
                    <p className="text-xs text-white/70 mt-1">No monthly physical stall rent required</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-[1px] text-white/60">Permit Status</p>
                    <p className="font-bold text-white text-sm mt-0.5">
                      {data?.businessPermitNumber ? `Permit #${data.businessPermitNumber}` : "Registered"}
                    </p>
                  </div>
                </div>

                <div className="mx-5" style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />

                <div className="px-5 py-4 space-y-3">
                  <div className="rounded-xl bg-white/10 p-3 text-xs text-white/90 leading-relaxed border border-white/10 flex items-start gap-2.5">
                    <Info className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
                    <span>
                      Bolante vendors do not occupy a fixed physical stall. You can use this portal to pay for your <strong>Business Permit (BPLO)</strong>, <strong>Mayor's Permit</strong>, and <strong>regulatory requirements</strong> online.
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* ── REGULAR STALL VENDOR BILL CARD ── */
              <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: DS.gradientHeader }}>
                <div className="flex items-start justify-between p-5">
                  <div>
                    <p className="text-[9px] uppercase tracking-[2px]" style={{ color: "rgba(255,255,255,0.55)" }}>Target Billing Period</p>
                    <p className="text-xl font-black text-white mt-1">
                      {MONTHS[selectedMonth - 1]} {currentYear}
                    </p>
                    {selectedMonth > currentMonth && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-200 bg-blue-500/30 px-2 py-0.5 rounded-full mt-1.5 border border-blue-300/30">
                        <Sparkles className="h-2.5 w-2.5" /> Advance Payment
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-[1px]" style={{ color: "rgba(255,255,255,0.55)" }}>Stall</p>
                    <p className="font-mono font-black text-white text-xl">{stall?.stall_number || "—"}</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{stall?.section || "General"}</p>
                  </div>
                </div>

                <div className="mx-5" style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />

                <div className="px-5 py-4 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "rgba(255,255,255,0.65)" }}>Monthly Rate ({MONTHS[selectedMonth - 1]})</span>
                    <span className="font-mono text-white">{fmt(selectedMonthFee)}</span>
                  </div>

                  {selectedMonthPaid > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span style={{ color: "rgba(255,255,255,0.65)" }}>Already Credited</span>
                        <span className="font-mono text-green-300 font-medium">− {fmt(selectedMonthPaid)}</span>
                      </div>
                      <div style={{ height: 1, background: "rgba(255,255,255,0.15)" }} />
                    </>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">
                      {isSelectedMonthSettled ? "Amount (Advance Credit)" : (selectedMonthPaid > 0 ? "Remaining Balance" : "Amount Due")}
                    </span>
                    <span className="font-mono text-3xl font-black text-white">
                      {fmt(isSelectedMonthSettled ? selectedMonthFee : selectedMonthBalance)}
                    </span>
                  </div>

                  {isSelectedMonthSettled && (
                    <div className="rounded-lg bg-green-500/20 border border-green-400/30 p-2 text-xs text-green-200 flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-300 shrink-0" />
                      <span>{MONTHS[selectedMonth - 1]} is already settled. You can still pay extra advance credit or select another month.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── BILLING MONTH SELECTOR (only for regular stall vendors with monthly stall rental) ── */}
            {!isBolante && (
              <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Select Billing Month
                  </p>
                  <span className="text-xs text-muted-foreground">Year {currentYear}</span>
                </div>

                {/* Month pills grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {MONTHS_SHORT.map((mShort, idx) => {
                    const mNum = idx + 1;
                    const isSelected = selectedMonth === mNum;
                    const mFee = data ? data.getMonthFee(mNum) : 0;
                    const mPaid = data ? (data.effectiveMap[mNum] || 0) : 0;
                    const isPaid = mFee > 0 && mPaid >= mFee;
                    const isCurrent = mNum === currentMonth;

                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => setSelectedMonth(mNum)}
                        className={`relative py-2 px-1 rounded-xl text-center border text-xs font-medium transition-all ${
                          isSelected
                            ? "border-primary bg-primary text-white shadow-sm ring-2 ring-primary/20"
                            : isPaid
                              ? "border-green-200 bg-green-50/70 text-green-800 hover:bg-green-100/70"
                              : isCurrent
                                ? "border-amber-300 bg-amber-50/70 text-amber-900 hover:bg-amber-100/70 font-bold"
                                : "border-border bg-background text-foreground hover:bg-slate-50"
                        }`}
                      >
                        <div className="text-[11px] font-bold">{mShort}</div>
                        <div className="text-[9px] mt-0.5 truncate">
                          {isPaid ? (
                            <span className={isSelected ? "text-green-200" : "text-green-700"}>Paid ✓</span>
                          ) : isCurrent ? (
                            <span className={isSelected ? "text-amber-200" : "text-amber-700"}>Current</span>
                          ) : (
                            <span className={isSelected ? "text-blue-100" : "text-muted-foreground"}>
                              {mNum > currentMonth ? "Adv" : "—"}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PAYMENT CONFIGURATION (BOLANTE vs STALL) ── */}
            {isBolante ? (
              /* BOLANTE REQUIREMENT SELECTOR */
              <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">Select Requirement / Payment Purpose</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Choose the municipal requirement you are paying for</p>
                </div>

                <div className="space-y-2">
                  {BOLANTE_CATEGORIES.map(cat => {
                    const isSelected = bolanteCategory === cat.label;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setBolanteCategory(cat.label)}
                        className={`w-full p-3.5 rounded-xl border text-left transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? "border-primary bg-blue-50/60 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className={`text-xs font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {cat.label}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{cat.desc}</p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? "border-primary bg-primary text-white" : "border-slate-300"
                        }`}>
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Quick amount presets */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Amount to Pay (₱) <span className="text-red-500">*</span>
                  </Label>
                  <div className="grid grid-cols-4 gap-2">
                    {["500", "1000", "1500", "2000"].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setCustomAmount(amt)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          customAmount === amt
                            ? "bg-primary text-white border-primary shadow-sm"
                            : "bg-slate-50 text-slate-700 border-border hover:bg-slate-100"
                        }`}
                      >
                        ₱{Number(amt).toLocaleString()}
                      </button>
                    ))}
                  </div>

                  <div className="relative mt-2">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold text-base">₱</span>
                    <Input
                      type="number"
                      placeholder="Enter custom amount (e.g. 500.00)"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      className="h-11 pl-8 rounded-xl font-mono text-base"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* REGULAR STALL PAYMENT MODE SELECTOR */
              <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">Payment Type</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pay standard monthly rate, advance lump-sum, or municipal permit fees</p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("month_due")}
                    className={`rounded-lg py-2.5 text-xs font-bold transition-all ${
                      paymentMode === "month_due" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Full Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("custom_advance")}
                    className={`rounded-lg py-2.5 text-xs font-bold transition-all ${
                      paymentMode === "custom_advance" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Custom / Advance
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("permit_requirement")}
                    className={`rounded-lg py-2.5 text-xs font-bold transition-all ${
                      paymentMode === "permit_requirement" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    Permit / Fee
                  </button>
                </div>

                {paymentMode === "month_due" && (
                  <div className="space-y-2">
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-start gap-2">
                      <Clock className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-900">
                          {selectedMonth > currentMonth ? `Advance payment for ${MONTHS[selectedMonth - 1]} ${currentYear}` : `Payment for ${MONTHS[selectedMonth - 1]} ${currentYear}`}
                        </p>
                        <p className="text-blue-700 mt-0.5">
                          Will submit <strong>{fmt(payAmount)}</strong> to cover the {MONTHS[selectedMonth - 1]} monthly stall rental.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {paymentMode === "custom_advance" && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-blue-900">Custom / Advance Amount</p>
                        <p className="text-blue-700 mt-0.5">
                          Enter any custom amount. Any excess beyond the current due automatically rolls over as advance credit for subsequent months!
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Amount to Pay (₱) <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold">₱</span>
                        <Input
                          type="number"
                          placeholder="e.g. 1500.00"
                          value={customAmount}
                          onChange={e => setCustomAmount(e.target.value)}
                          className="h-11 pl-8 rounded-xl font-mono text-base"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMode === "permit_requirement" && (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-purple-50 border border-purple-200 p-3 text-xs text-purple-800 flex items-start gap-2">
                      <Shield className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-purple-900">Business Permit & Regulatory Payment</p>
                        <p className="text-purple-700 mt-0.5">
                          Use this option to pay for BPLO business permits, clearances, and regulatory assessments.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Amount to Pay (₱) <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold">₱</span>
                        <Input
                          type="number"
                          placeholder="e.g. 500.00"
                          value={customAmount}
                          onChange={e => setCustomAmount(e.target.value)}
                          className="h-11 pl-8 rounded-xl font-mono text-base"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl py-4 transition-all disabled:opacity-50"
              style={{ background: DS.gradientCard, boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}
              disabled={!canProceed}
              onClick={() => setStep(2)}>
              <ChevronRight className="h-4 w-4" />
              Continue to Payment Details ({fmt(payAmount)})
            </button>
          </div>
        )}

        {/* ── STEP 2: Payment Details & Bank Transfer ──────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back to Review
            </button>

            <div className="rounded-xl border bg-slate-50 px-4 py-3 flex justify-between items-center text-sm">
              <span className="text-muted-foreground">
                {isBolante
                  ? `${bolanteCategory} · ${currentYear}`
                  : `${MONTHS[selectedMonth - 1]} ${currentYear} · ${paymentMode === "month_due" ? "Full Month" : paymentMode === "custom_advance" ? "Advance / Custom" : "Permit Fee"}`}
              </span>
              <span className="font-mono font-bold text-foreground text-base">{fmt(payAmount)}</span>
            </div>

            {/* Bank details card */}
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="text-center py-4 px-5" style={{ background: DS.blue900 }}>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Building2 className="h-5 w-5 text-white opacity-70" />
                  <p className="text-sm font-bold text-white">Pay to this Account</p>
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Municipality of San Juan, Batangas</p>
              </div>

              <div className="px-5 py-5 space-y-4">
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Bank", value: BANK_DETAILS.bankName },
                    { label: "Account Name", value: BANK_DETAILS.accountName },
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
                            type="button"
                            onClick={() => { navigator.clipboard.writeText(r.value); toast.success("Copied!"); }}
                            className="text-xs font-bold hover:underline shrink-0"
                            style={{ color: DS.blue600 }}>
                            Copy
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="h-px bg-border" />

                {BANK_DETAILS.instapayQR && (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Scan QR to Pay</p>
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
                <div className="rounded-xl py-4 text-center"
                  style={{ background: "#dcfce7", border: "1px solid #86efac" }}>
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Send Exactly</p>
                  <p className="font-mono text-3xl font-black text-green-700">{fmt(payAmount)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {isBolante
                      ? `${bolanteCategory} · ${preferredSection}`
                      : `${MONTHS[selectedMonth - 1]} ${currentYear} · Stall ${stall?.stall_number || "—"}`}
                  </p>
                </div>

                <p className="text-xs text-center text-muted-foreground">{BANK_DETAILS.notes}</p>
              </div>
            </div>

            {/* How to pay instructions */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm text-amber-800">
              <p className="font-bold">How to pay:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs leading-relaxed">
                <li>Open your GCash, Maya, or banking app</li>
                <li>Send <strong>{fmt(payAmount)}</strong> to the account above via InstaPay or bank transfer</li>
                <li>Save or screenshot your payment confirmation / receipt</li>
                <li>Proceed to the next step to upload the screenshot for verification</li>
              </ol>
            </div>

            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl py-4"
              style={{ background: DS.gradientCard, boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}
              onClick={() => setStep(3)}>
              <ChevronRight className="h-4 w-4" />
              I've Paid — Upload Receipt
            </button>
          </div>
        )}

        {/* ── STEP 3: Upload Receipt & Submit ───────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="rounded-xl border bg-slate-50 px-4 py-3 space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">
                  Submitting for {isBolante ? `${bolanteCategory} (${currentYear})` : `${MONTHS[selectedMonth - 1]} ${currentYear}`}
                </span>
                <span className="font-mono font-bold text-foreground">{fmt(actualSubmittedAmount)}</span>
              </div>
            </div>

            {/* Upload area */}
            <div
              onClick={() => !receiptFile && fileRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed transition-all ${receiptFile
                ? "border-blue-300 bg-blue-50"
                : "border-border bg-card hover:border-blue-300 hover:bg-blue-50 cursor-pointer"
                } p-6`}>

              {!receiptFile ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
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
                  <div className="relative">
                    <img
                      src={receiptPreview!}
                      alt="Receipt"
                      className="w-full max-h-64 object-contain rounded-xl border bg-white"
                    />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); resetReceiptState(); }}
                      className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-card border shadow-sm hover:bg-secondary">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {ocrLoading && (
                    <div className="flex flex-col gap-3 py-2">
                      <div className="flex items-center gap-2 text-sm font-medium" style={{ color: DS.blue600 }}>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Scanning receipt…
                      </div>
                      <Button
                        variant="secondary" size="sm" className="h-9 rounded-xl text-xs gap-1.5"
                        onClick={(e) => { e.stopPropagation(); setOcrLoading(false); }}
                      >
                        <FileText className="h-3.5 w-3.5" /> Skip & Enter Manually
                      </Button>
                    </div>
                  )}

                  {!ocrLoading && (
                    <div className="space-y-4 pt-2">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Reference Number <span className="text-red-500">*</span>
                            </Label>
                            {isReceiptImageDuplicate && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                                <Lock className="h-2.5 w-2.5" /> Receipt Locked (Used)
                              </span>
                            )}
                          </div>
                          <Input
                            placeholder="e.g. 0012 3456 789"
                            value={refNum}
                            onChange={(e) => {
                              if (!isReceiptImageDuplicate) {
                                setRefNum(e.target.value);
                              }
                            }}
                            readOnly={isReceiptImageDuplicate}
                            disabled={isReceiptImageDuplicate}
                            className={`h-11 rounded-xl font-mono text-base transition-colors ${
                              isReceiptImageDuplicate
                                ? "bg-red-50/70 border-red-300 text-red-900 cursor-not-allowed select-none"
                                : ""
                            }`}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Actual Amount Paid (₱) <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={paidAmount}
                            onChange={(e) => {
                              if (!isReceiptImageDuplicate) {
                                setPaidAmount(e.target.value);
                              }
                            }}
                            readOnly={isReceiptImageDuplicate}
                            disabled={isReceiptImageDuplicate}
                            className={`h-11 rounded-xl font-mono text-base transition-colors ${
                              isReceiptImageDuplicate
                                ? "bg-red-50/70 border-red-300 text-red-900 cursor-not-allowed select-none"
                                : ""
                            }`}
                          />
                        </div>
                      </div>

                      {duplicateRefError && (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-800 flex items-start gap-2.5 animate-in fade-in">
                          <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <p className="font-bold text-red-900">Duplicate Receipt Detected</p>
                            <p className="leading-relaxed">{duplicateRefError}</p>
                            {isReceiptImageDuplicate && (
                              <p className="text-[11px] font-medium text-red-700 pt-0.5">
                                This receipt image has already been submitted and cannot be reused. Please click <strong>Change Image</strong> or <strong>Retake Photo</strong> to upload a different, unused receipt.
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {ocrData && !duplicateRefError && (
                        <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-[11px] text-green-800 flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>We've pre-filled details from your receipt. Please double-check they are correct.</span>
                        </div>
                      )}

                      {!ocrData && !ocrLoading && !duplicateRefError && (
                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-600 flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                          <span>We couldn't auto-read the receipt. Please type the reference number and amount manually.</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-[11px] gap-1.5 text-muted-foreground"
                      onClick={e => { e.stopPropagation(); resetReceiptState(); fileRef.current?.click(); }}
                    >
                      <Image className="h-3.5 w-3.5" /> Change Image
                    </Button>
                    <Button
                      type="button"
                      variant="outline" size="sm" className="flex-1 h-9 rounded-xl text-[11px] gap-1.5 text-muted-foreground"
                      onClick={e => { e.stopPropagation(); resetReceiptState(); fileRef.current?.click(); }}
                    >
                      <Scan className="h-3.5 w-3.5" /> Retake Photo
                    </Button>
                  </div>
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

            {!receiptFile && (
              <div className="rounded-xl px-4 py-3 flex items-start gap-2 text-xs"
                style={{ background: DS.blue900 + "0d", border: `1px solid ${DS.blue600}33`, color: DS.blue600 }}>
                <Scan className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>We'll automatically scan your receipt to extract the reference number and amount for verification.</span>
              </div>
            )}

            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 text-white font-bold text-sm rounded-2xl py-4 transition-all disabled:opacity-50"
              style={{ background: DS.gradientCard, boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}
              disabled={!receiptFile || !refNum || !paidAmount || ocrLoading || isCheckingDuplicate || isReceiptImageDuplicate || !!duplicateRefError || submitReceipt.isPending}
              onClick={() => submitReceipt.mutate()}>
              {submitReceipt.isPending ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Submitting…</>
              ) : (
                <><FileText className="h-5 w-5" /> Submit for Verification</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Unified bottom nav — mobile only */}
      <VendorBottomNav />
    </div>
  );
};

export default VendorPayOnline;