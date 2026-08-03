import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, CheckCircle2, CreditCard, Loader2, Banknote,
  User, Printer, AlertCircle, Receipt, Smartphone,
  Building2, X, RefreshCw, Clock, Eye, Scan,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";
import LoadingOverlay from "@/components/LoadingOverlay";

import { saveOfflinePayment, syncOfflinePayments, getUnsyncedCount, getOfflinePayments } from "@/lib/offlineSync";
import { preloadVendorDirectory, searchCachedVendors } from "@/lib/vendorCache";

const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// ── Notify vendor via Edge Function (email + push + in-app) ──────────────────
const notifyVendor = async (params: {
  vendor_user_id: string;
  vendor_name: string;
  stall_number: string;
  section: string;
  amount: number;
  period_month: number;
  period_year: number;
  payment_method: string;
  payment_type: string;
  receipt_number: string;
  reference_number: string;
  cashier_name: string;
}) => {
  if (!navigator.onLine) return; // Skip notification if offline
  try {
    // verify_jwt = false in config.toml — use anon key as bearer, no user JWT needed
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-vendor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("notifyVendor failed:", res.status, errText);
    }
  } catch (e) {
    console.error("notifyVendor failed:", e);
  }
};

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash: { icon: Smartphone, color: "bg-blue-500", label: "GCash" },
  paymaya: { icon: Smartphone, color: "bg-green-600", label: "Maya" },
  instapay: { icon: Building2, color: "bg-primary", label: "InstaPay" },
  cash: { icon: Banknote, color: "bg-slate-500", label: "Cash" },
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
<div class="row"><span class="lbl">Receipt No.</span><span class="val mono">${d.receiptNumber || "—"}</span></div>
<div class="row"><span class="lbl">Reference No.</span><span class="val mono">${d.refNumber || "—"}</span></div>
<div class="row"><span class="lbl">Date</span><span class="val">${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}</span></div>
<div class="row"><span class="lbl">Time</span><span class="val">${new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>
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
const ReceiptCard = ({ data, onNew, onSameVendor }: { data: any; onNew: () => void; onSameVendor?: () => void }) => (
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
        {data.offline && (
          <p className="text-xs text-amber-600 mt-1 flex items-center justify-center gap-1">
            <RefreshCw className="h-3 w-3" /> Saved offline. Will sync when online.
          </p>
        )}
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
          { label: "Receipt No.", value: data.receiptNumber || "—", mono: true },
          { label: "Reference No.", value: data.refNumber || "—", mono: true },
          { label: "Date & Time", value: new Date().toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
          { label: "Vendor", value: data.vendorName },
          { label: "Stall", value: `${data.stallNumber} · ${data.section}` },
          { label: "Billing Period", value: data.period },
          { label: "Payment Type", value: data.payType },
          { label: "Method", value: data.method },
          { label: "Processed by", value: data.cashierName },
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
        {[{ name: data.vendorName, role: "Vendor / Payor" }, { name: data.cashierName, role: "Cashier / Collector" }].map(s => (
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
    <div className="flex flex-col gap-2">
      <Button variant="hero" className="w-full gap-2 rounded-xl" onClick={() => doPrint(data)}>
        <Printer className="h-4 w-4" /> Print Receipt
      </Button>
      <div className="flex gap-2">
        {onSameVendor && (
          <Button variant="outline" className="flex-1 gap-1.5 rounded-xl text-xs" onClick={onSameVendor}>
            <User className="h-3.5 w-3.5" /> Same Vendor
          </Button>
        )}
        <Button variant="outline" className={onSameVendor ? "flex-1 gap-1.5 rounded-xl text-xs" : "w-full gap-2 rounded-xl"} onClick={onNew}>
          {onSameVendor ? <Search className="h-3.5 w-3.5" /> : <Receipt className="h-4 w-4" />} {onSameVendor ? "New Search" : "New Payment"}
        </Button>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// WALK-IN PAYMENT
// ═══════════════════════════════════════════════════════════════════════════════
const WalkInPayment = ({ cashierProfile, activeShift }: { cashierProfile: any; activeShift: any }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [vendor, setVendor] = useState<any>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [payType, setPayType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [receiptData, setReceiptData] = useState<any>(null);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    preloadVendorDirectory();
  }, []);

  const loadVendorData = async (v: any) => {
    let profile = v.profile;
    let payments: any[] = [];
    let schedules: any[] = [];

    if (navigator.onLine) {
      try {
        const [profileRes, paymentsRes, schedulesRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("user_id", v.user_id).single(),
          supabase.from("payments").select("period_month, amount")
            .eq("vendor_id", v.id).eq("status", "completed").eq("period_year", currentYear),
          v.stall_id
            ? (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", v.stall_id).eq("year", currentYear)
            : Promise.resolve({ data: [] }),
        ]);
        if (profileRes.data) profile = profileRes.data;
        if (paymentsRes.data) payments = paymentsRes.data;
        if (schedulesRes.data) schedules = schedulesRes.data;
      } catch (e) {
        console.warn("Offline loading vendor data:", e);
      }
    }

    const stall = (v.stalls || v.stall) as any;
    const defRate = stall?.monthly_rate || 1450;

    const rawPaidMap: Record<number, number> = {};
    payments.forEach((p: any) => {
      if (p.period_month) rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
    });

    const getMonthFee = (m: number) => {
      const s = schedules.find((s: any) => s.month === m);
      return s ? Number(s.amount) : defRate;
    };

    // Cascade excess payments forward
    const paidMap: Record<number, number> = {};
    let carry = 0;
    for (let m = 1; m <= 12; m++) {
      const due_m = getMonthFee(m);
      const credited = (rawPaidMap[m] || 0) + carry;
      paidMap[m] = credited;
      carry = credited >= due_m ? (credited - due_m) : 0;
    }

    let nextUnpaid = currentMonth;
    for (let m = 1; m <= currentMonth; m++) {
      if ((paidMap[m] || 0) < getMonthFee(m)) { nextUnpaid = m; break; }
      if (m === currentMonth) nextUnpaid = currentMonth + 1;
    }

    setVendor({ ...v, stall, profile, paidMap, getMonthFee, nextUnpaid });
    setPeriodMonth(nextUnpaid);
    setAmount("");
  };

  const searchVendor = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setVendor(null);
    setSearchResults([]);

    if (!navigator.onLine) {
      const cached = searchCachedVendors(searchTerm);
      if (!cached || cached.length === 0) {
        toast.error("No vendor found in offline directory. Try stall number or name.");
        setSearching(false);
        return;
      }

      const formattedResults = cached.map(c => ({
        id: c.id,
        user_id: c.user_id,
        stall_id: c.stall_id,
        stalls: { id: c.stall_id, stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate, area_measurement: c.area_measurement },
        stall: { id: c.stall_id, stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate, area_measurement: c.area_measurement },
        profile: { first_name: c.first_name, last_name: c.last_name, contact_number: c.contact_number },
      }));

      if (formattedResults.length === 1) {
        await loadVendorData(formattedResults[0]);
      } else {
        setSearchResults(formattedResults);
      }
      setSearching(false);
      return;
    }

    try {
      // 1. Search stalls by stall_number or section
      const { data: stalls } = await supabase
        .from("stalls")
        .select("id, stall_number, section")
        .or(`stall_number.ilike.%${searchTerm.trim()}%,section.ilike.%${searchTerm.trim()}%`);

      // 2. Search profiles by first_name or last_name
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, contact_number")
        .or(`first_name.ilike.%${searchTerm.trim()}%,last_name.ilike.%${searchTerm.trim()}%`);

      const conditions: string[] = [];
      if (stalls && stalls.length > 0) {
        const stallIds = stalls.map(s => s.id);
        conditions.push(`stall_id.in.(${stallIds.join(",")})`);
      }
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map(p => p.user_id);
        conditions.push(`user_id.in.(${userIds.join(",")})`);
      }

      if (conditions.length === 0) {
        // Fallback to offline search
        const cached = searchCachedVendors(searchTerm);
        if (cached && cached.length > 0) {
          const formattedResults = cached.map(c => ({
            id: c.id,
            user_id: c.user_id,
            stall_id: c.stall_id,
            stalls: { id: c.stall_id, stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate, area_measurement: c.area_measurement },
            stall: { id: c.stall_id, stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate, area_measurement: c.area_measurement },
            profile: { first_name: c.first_name, last_name: c.last_name, contact_number: c.contact_number },
          }));

          if (formattedResults.length === 1) {
            await loadVendorData(formattedResults[0]);
          } else {
            setSearchResults(formattedResults);
          }
          return;
        }

        toast.error("No vendor found. Try stall number, section, or vendor name.");
        setSearching(false);
        return;
      }

      // Query matched vendors
      const { data: vendorsList, error: vendorErr } = await supabase
        .from("vendors")
        .select("id, user_id, stall_id, award_date, stalls(*)")
        .or(conditions.join(","));

      if (vendorErr) throw vendorErr;

      if (!vendorsList || vendorsList.length === 0) {
        toast.error("No vendor found. Try stall number, section, or vendor name.");
        setSearching(false);
        return;
      }

      // Resolve profiles for all matched vendors to show correct details
      const uniqueUserIds = [...new Set(vendorsList.map(v => v.user_id))];
      const { data: profilesList, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", uniqueUserIds);

      if (profileErr) throw profileErr;

      const formattedResults = vendorsList.map(v => {
        const profile = profilesList?.find(p => p.user_id === v.user_id);
        return {
          ...v,
          profile,
          stall: v.stalls as any
        };
      });

      // Handle selection or multiple duplicate results
      if (formattedResults.length === 1) {
        await loadVendorData(formattedResults[0]);
      } else {
        setSearchResults(formattedResults);
      }
    } catch (err: any) {
      console.warn("Search error, trying offline fallback:", err);
      const cached = searchCachedVendors(searchTerm);
      if (cached && cached.length > 0) {
        const formattedResults = cached.map(c => ({
          id: c.id,
          user_id: c.user_id,
          stall_id: c.stall_id,
          stalls: { id: c.stall_id, stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate, area_measurement: c.area_measurement },
          stall: { id: c.stall_id, stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate, area_measurement: c.area_measurement },
          profile: { first_name: c.first_name, last_name: c.last_name, contact_number: c.contact_number },
        }));

        if (formattedResults.length === 1) {
          await loadVendorData(formattedResults[0]);
        } else {
          setSearchResults(formattedResults);
        }
      } else {
        toast.error("No vendor found matching search term.");
      }
    } finally {
      setSearching(false);
    }
  };

  const monthFee = vendor ? vendor.getMonthFee(periodMonth) : 1450;
  const alreadyPaid = vendor ? (vendor.paidMap[periodMonth] || 0) : 0;
  const remaining = Math.max(0, monthFee - alreadyPaid);
  const payAmount = payType === "full" ? remaining : (Number(amount) || 0);
  const isOverpay = payAmount > remaining;

  const recordPayment = useMutation({
    mutationFn: async () => {
      if (payAmount <= 0) throw new Error("Amount must be greater than 0");
      if (isOverpay) throw new Error(`Cannot exceed remaining balance of ${fmt(remaining)}`);
      if (payType === "partial" && (!amount || Number(amount) <= 0)) throw new Error("Enter a valid partial amount");

      const payload = {
        vendor_id: vendor.id,
        stall_id: vendor.stall_id || null,
        amount: payAmount,
        payment_method: "cash",
        payment_type: payType === "full" ? "due" : "staggered",
        status: "completed",
        processed_by: user?.id,
        period_month: periodMonth,
        period_year: periodYear,
        shift_id: activeShift?.id || null,
      };

      if (!navigator.onLine) {
        await saveOfflinePayment(payload);
        return {
          reference_number: "OFFLINE-SYNC",
          receipt_number: "PENDING",
          offline: true
        };
      }

      try {
        const { data, error } = await supabase.from("payments").insert(payload).select("reference_number, receipt_number").single();
        if (error) throw error;
        const cn1 = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
        await notifyVendor({
          vendor_user_id: vendor.user_id,
          vendor_name: `${vendor.profile?.first_name} ${vendor.profile?.last_name}`,
          stall_number: vendor.stall?.stall_number || "—",
          section: vendor.stall?.section || "General",
          amount: payAmount,
          period_month: periodMonth,
          period_year: periodYear,
          payment_method: "cash",
          payment_type: payType === "full" ? "due" : "staggered",
          receipt_number: data.receipt_number || "",
          reference_number: data.reference_number || "",
          cashier_name: cn1,
        });
        return data;
      } catch (err: any) {
        console.warn("Online payment insert failed, saving to IndexedDB offline:", err);
        await saveOfflinePayment(payload);
        return {
          reference_number: "OFFLINE-SYNC",
          receipt_number: "PENDING",
          offline: true
        };
      }
    },
    onSuccess: async (data: any) => {
      const cn = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      setReceiptData({
        vendorName: `${vendor.profile?.first_name} ${vendor.profile?.last_name}`,
        stallNumber: vendor.stall?.stall_number || "—",
        section: vendor.stall?.section || "General",
        amount: payAmount,
        payType: payType === "full" ? "Full Payment" : "Partial Payment",
        period: `${MONTHS_FULL[periodMonth - 1]} ${periodYear}`,
        method: "Cash at Cashier",
        refNumber: data.reference_number || "",
        receiptNumber: data.receipt_number || "",
        cashierName: cn,
        offline: data.offline || false,
      });
      ["vendor-statement", "vendor-pay-info", "vendor-history", "cashier-dashboard", "cashier-payment-status", "admin-payments", "admin-dashboard"]
        .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));

      if (data.offline || !navigator.onLine) {
        toast.success("Payment accepted & saved offline!");
        if (vendor) {
          const newPaidMap = { ...(vendor.paidMap || {}) };
          newPaidMap[periodMonth] = (newPaidMap[periodMonth] || 0) + payAmount;
          setVendor({ ...vendor, paidMap: newPaidMap });
        }
      } else {
        await loadVendorData(vendor);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reset = () => {
    setVendor(null); setSearchTerm(""); setAmount("");
    setSearchResults([]);
    setReceiptData(null); setPeriodMonth(currentMonth); setPeriodYear(currentYear); setPayType("full");
  };

  if (receiptData) return <ReceiptCard data={receiptData} onNew={reset} onSameVendor={() => setReceiptData(null)} />;

  return (
    <div className="space-y-4">
      {recordPayment.isPending && <LoadingOverlay role="cashier" message="Recording payment & notifying vendor..." />}
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by stall, section, or vendor name…"
            className="h-11 pl-10 rounded-xl"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && searchVendor()} />
        </div>
        <Button onClick={searchVendor} disabled={searching || !searchTerm.trim()} className="rounded-xl px-5 gap-1.5">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
        {(vendor || searchResults.length > 0) && (
          <Button variant="outline" size="icon" className="rounded-xl shrink-0" onClick={reset} title="Clear">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {searching && !vendor && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

      {/* Multiple accounts selection list */}
      {!searching && searchResults.length > 0 && !vendor && (
        <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-3">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
              Search Results ({searchResults.length} accounts found)
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setSearchResults([])} className="text-xs text-muted-foreground hover:text-foreground">
              Clear Results
            </Button>
          </div>
          <div className="divide-y max-h-[320px] overflow-y-auto pr-1">
            {searchResults.map((res) => (
              <div key={res.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0 gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-foreground">
                      {res.profile?.first_name} {res.profile?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Stall <span className="font-mono font-semibold text-foreground">{res.stall?.stall_number || "—"}</span>
                      {" · "}<span className="font-semibold text-primary">{res.stall?.section || "General"}</span>
                      {res.profile?.contact_number && ` · ${res.profile.contact_number}`}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setSearchResults([]);
                    loadVendorData(res);
                  }}
                  className="rounded-xl px-4 text-xs font-semibold shrink-0"
                >
                  Select Account
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                  const mo = i + 1;
                  const fee = vendor.getMonthFee(mo);
                  const paid = vendor.paidMap[mo] || 0;
                  const isFully = paid >= fee;
                  const isPartial = paid > 0 && paid < fee;
                  const isSel = mo === periodMonth;
                  return (
                    <button key={m} onClick={() => { setPeriodMonth(mo); setAmount(""); }}
                      className={`rounded-xl px-1 py-2.5 text-center text-xs transition-all border-2 ${isSel ? "border-primary bg-primary/10 shadow-sm" :
                        isFully ? "border-success/30 bg-success/10" :
                          isPartial ? "border-primary/20 bg-primary/5" :
                            "border-accent/20 bg-accent/5 hover:border-accent/40"
                        }`}>
                      <p className={`font-semibold ${isSel ? "text-primary" : "text-foreground"}`}>{m.slice(0, 3)}</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${isFully ? "text-success" : isPartial ? "text-primary" : "text-accent"}`}>
                        {isFully ? "✓ Paid" : isPartial ? "Partial" : "Unpaid"}
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
                  {MONTHS_FULL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Year</Label>
                <select className="h-10 w-full rounded-xl border bg-background px-3 text-sm"
                  value={periodYear} onChange={e => setPeriodYear(Number(e.target.value))}>
                  {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="rounded-xl border bg-secondary/40 px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Fee ({MONTHS_FULL[periodMonth - 1]})</span>
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
                <span className={`font-mono text-xl font-bold ${remaining === 0 ? "text-success" : "text-foreground"}`}>{fmt(remaining)}</span>
              </div>
              {remaining === 0 && (
                <p className="text-xs text-success flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />This month is fully paid</p>
              )}
            </div>

            {/* Advance payment option when current month is fully paid */}
            {remaining === 0 && periodMonth <= 12 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {MONTHS_FULL[periodMonth - 1]} is fully paid
                </p>
                {periodMonth < 12 && (
                  <>
                    <p className="text-xs text-muted-foreground">Would you like to pay in advance for the next month?</p>
                    <Button
                      variant="outline"
                      className="w-full gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => { setPeriodMonth(m => Math.min(m + 1, 12)); setAmount(""); setPayType("full"); }}
                    >
                      Pay {MONTHS_FULL[periodMonth]} {periodYear} in Advance
                    </Button>
                  </>
                )}
              </div>
            )}

            {remaining > 0 && (
              <>
                {/* Full / Partial toggle */}
                <div className="flex rounded-xl bg-secondary p-1">
                  <button onClick={() => { setPayType("full"); setAmount(""); }}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType === "full" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    Full — {fmt(remaining)}
                  </button>
                  <button onClick={() => setPayType("partial")}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${payType === "partial" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    Partial Payment
                  </button>
                </div>

                {payType === "partial" && (
                  <div className="space-y-2">
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₱</span>
                      <Input type="number" placeholder={`Enter amount (max ${fmt(remaining)})`}
                        className={`h-11 pl-8 rounded-xl font-mono text-lg ${isOverpay ? "border-accent ring-1 ring-accent" : ""}`}
                        value={amount} onChange={e => setAmount(e.target.value)} max={remaining} />
                    </div>
                    {isOverpay && (
                      <p className="text-xs text-accent flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" /> Cannot exceed {fmt(remaining)}
                      </p>
                    )}
                    {amount && Number(amount) > 0 && !isOverpay && Number(amount) < remaining && (
                      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                        After this payment: <strong>{fmt(remaining - Number(amount))}</strong> still remaining for {MONTHS_FULL[periodMonth - 1]}
                      </div>
                    )}
                  </div>
                )}

                <Button variant="hero" size="lg" className="w-full gap-2 rounded-xl"
                  disabled={recordPayment.isPending || payAmount <= 0 || isOverpay || (payType === "partial" && !amount) || !activeShift}
                  onClick={() => recordPayment.mutate()}>
                  {recordPayment.isPending
                    ? <><Loader2 className="h-5 w-5 animate-spin" />Processing…</>
                    : <><Banknote className="h-5 w-5" />Collect {fmt(payAmount)} — Cash</>}
                </Button>
                {!activeShift && <p className="text-xs text-red-500 text-center mt-2 font-semibold flex items-center justify-center gap-1.5"><AlertCircle className="h-4 w-4" />You must open a shift to collect payments.</p>}
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"walkin" | "submissions">("submissions");

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

  // Query active shift
  const { data: activeShift, isLoading: shiftLoading } = useQuery({
    queryKey: ["active-shift", user?.id],
    enabled: !!user?.id,
    retry: false,
    networkMode: "always",
    queryFn: async () => {
      const cashierId = user?.id;
      if (!cashierId) return null;
      const cacheKey = `palengclick_active_shift_${cashierId}`;

      try {
        const { data, error } = await supabase
          .from("cashier_shifts")
          .select("*")
          .eq("cashier_id", cashierId)
          .eq("status", "open")
          .maybeSingle();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        } else {
          localStorage.removeItem(cacheKey);
          return null;
        }
      } catch (err) {
        console.warn("Offline query for active shift, checking local cache...", err);
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try { return JSON.parse(cached); } catch (e) { }
        }
        if (!navigator.onLine) {
          const offlineShift = {
            id: `offline-shift-${cashierId}`,
            cashier_id: cashierId,
            starting_cash: 0,
            status: "open",
            opened_at: new Date().toISOString(),
            notes: "Offline active shift"
          };
          localStorage.setItem(cacheKey, JSON.stringify(offlineShift));
          return offlineShift;
        }
        return null;
      }
    }
  });

  useEffect(() => {
    if (searchParams.get("vendorId")) setTab("walkin");
  }, [searchParams]);

  // ── Pending online payments ────────────────────────────────────────────────
  const { data: pending = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ["cashier-pending"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: payments } = await supabase.from("payments").select("*").eq("status", "pending").order("created_at", { ascending: false });
      if (!payments?.length) return [];
      const vendorIds = [...new Set(payments.map(p => p.vendor_id))];
      const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number, section)").in("id", vendorIds);
      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return payments.map(p => {
        const v = vendors?.find(v => v.id === p.vendor_id);
        const pr = profiles?.find(pr => pr.user_id === v?.user_id);
        const st = v?.stalls as any;
        return { ...p, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: st?.stall_number || "—", section: st?.section || "" };
      });
    },
  });

  // ── Receipt submissions (vendor upload flow) ──────────────────────────────
  const { data: submissions = [], isLoading: subsLoading, refetch: refetchSubs } = useQuery({
    queryKey: ["cashier-submissions"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data: subs } = await supabase.from("payment_submissions")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (!subs?.length) return [];
      const vendorIds = [...new Set(subs.map((s: any) => s.vendor_id))];
      const { data: vendors } = await supabase.from("vendors")
        .select("id, user_id, stalls(stall_number, section)")
        .in("id", vendorIds);
      const userIds = vendors?.map((v: any) => v.user_id) || [];
      const { data: profiles } = await supabase.from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);
      return subs.map((s: any) => {
        const v = vendors?.find((v: any) => v.id === s.vendor_id);
        const pr = profiles?.find((pr: any) => pr.user_id === v?.user_id);
        const st = v?.stalls as any;
        return {
          ...s,
          vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
          stall: st?.stall_number || "—",
          section: st?.section || "",
        };
      });
    },
  });

  const [viewSubmission, setViewSubmission] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  const acceptSubmission = useMutation({
    mutationFn: async (s: any) => {
      const cashierName = cashierProfile
        ? `${cashierProfile.first_name} ${cashierProfile.last_name}`
        : "Cashier";

      // 1. Create a completed payment record
      const { data: payment, error: payErr } = await supabase.from("payments").insert({
        vendor_id: s.vendor_id,
        stall_id: s.stall_id || null,
        amount: s.amount,
        payment_method: s.payment_method || "instapay",
        payment_type: s.payment_type || "due",
        status: "completed",
        processed_by: user?.id,
        period_month: s.period_month,
        period_year: s.period_year,
        reference_number: s.ocr_reference || null,
        shift_id: activeShift?.id || null,
      }).select("id, reference_number, receipt_number").single();
      if (payErr) throw payErr;

      // 2. Update submission status
      await supabase.from("payment_submissions")
        .update({
          status: "accepted",
          payment_id: payment.id,
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", s.id);

      // 3. Notify vendor
      await notifyVendor({
        vendor_user_id: s.vendor_user_id,
        vendor_name: s.vendor_name,
        stall_number: s.stall,
        section: s.section || "General",
        amount: Number(s.amount),
        period_month: s.period_month,
        period_year: s.period_year,
        payment_method: s.payment_method || "instapay",
        payment_type: s.payment_type || "due",
        receipt_number: payment.receipt_number || "",
        reference_number: payment.reference_number || s.ocr_reference || "",
        cashier_name: cashierName,
      });

      return { ...s, payment };
    },
    onSuccess: (s) => {
      toast.success(`Payment accepted for ${s.vendor_name}`);
      setViewSubmission(null);
      queryClient.invalidateQueries({ queryKey: ["cashier-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rejectSubmission = useMutation({
    mutationFn: async ({ s, reason }: { s: any; reason: string }) => {
      // 1. Update submission status
      await supabase.from("payment_submissions")
        .update({
          status: "rejected",
          rejection_reason: reason || "Payment could not be verified.",
          processed_by: user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", s.id);

      // 2. Notify vendor — in-app rejection notice
      await supabase.from("notifications").insert({
        user_id: s.vendor_user_id,
        title: `❌ Payment Receipt Rejected`,
        message: `Your receipt submission for ${MONTHS_FULL[(s.period_month || 1) - 1]} ${s.period_year} (${fmt(Number(s.amount))}) was rejected.\n• Reason: ${reason || "Payment could not be verified."}\n• Stall: ${s.stall} — ${s.section}\n\nPlease resubmit with a valid receipt or visit the cashier.`,
        type: "confirmation",
      });
    },
    onSuccess: () => {
      toast.success("Submission rejected and vendor notified.");
      setViewSubmission(null);
      setRejectionReason("");
      setShowRejectInput(false);
      queryClient.invalidateQueries({ queryKey: ["cashier-submissions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const [onlineReceipt, setOnlineReceipt] = useState<any>(null);
  const [viewPayment, setViewPayment] = useState<any>(null);

  const confirmPayment = useMutation({
    mutationFn: async (p: any) => {
      const { error } = await supabase.from("payments").update({ status: "completed", processed_by: user?.id, shift_id: activeShift?.id || null }).eq("id", p.id);
      if (error) throw error;
      // Resolve actual auth user_id from vendor record
      const { data: vendorRow } = await supabase.from("vendors").select("user_id").eq("id", p.vendor_id).single();
      const recipientUserId = vendorRow?.user_id;
      const cn2 = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      if (recipientUserId) {
        await notifyVendor({
          vendor_user_id: recipientUserId,
          vendor_name: p.vendor_name,
          stall_number: p.stall,
          section: p.section || "General",
          amount: Number(p.amount),
          period_month: p.period_month,
          period_year: p.period_year,
          payment_method: p.payment_method,
          payment_type: p.payment_type,
          receipt_number: p.receipt_number || "",
          reference_number: p.reference_number || "",
          cashier_name: cn2,
        });
      }
      return p;
    },
    onSuccess: (p: any) => {
      const cn = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      setOnlineReceipt({
        vendorName: p.vendor_name,
        stallNumber: p.stall,
        section: p.section,
        amount: Number(p.amount),
        payType: p.payment_type === "staggered" ? "Partial Payment" : "Full Payment",
        period: p.period_month ? `${MONTHS_FULL[p.period_month - 1]} ${p.period_year}` : "—",
        method: METHOD_CONFIG[p.payment_method]?.label || p.payment_method,
        refNumber: p.reference_number || "",
        receiptNumber: p.receipt_number || "",
        cashierName: cn,
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
          title: "❌ Payment Rejected",
          message: `Your ${METHOD_CONFIG[p.payment_method]?.label || p.payment_method} payment has been rejected by the cashier.

Payment Details:
• Vendor: ${p.vendor_name}
• Stall: ${p.stall} — ${p.section}
• Amount: ${fmt(Number(p.amount))}
• Billing Period: ${p.period_month ? MONTHS_FULL[p.period_month - 1] : "—"} ${p.period_year || ""}
• Payment Method: ${METHOD_CONFIG[p.payment_method]?.label || p.payment_method}
• Reference No.: ${p.reference_number || "—"}
• Rejected by: ${cn}
• Date & Time: ${new Date().toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}

Please contact the cashier or try paying again through another method.`,
          type: "confirmation" as any,
        });
        // Push notification on rejection
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-vendor`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
          body: JSON.stringify({
            vendor_user_id: recipientUserId,
            _push_only: true,
            _push_title: "❌ Payment Rejected",
            _push_body: `Your ${METHOD_CONFIG[p.payment_method]?.label || p.payment_method} payment of ${fmt(Number(p.amount))} was rejected. Please visit the cashier.`,
          }),
        }).catch(() => { });
      }
    },
    onSuccess: () => { toast.success("Payment rejected — vendor notified."); refetchPending(); queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] }); },
    onError: () => toast.error("Failed to reject"),
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

    if (!navigator.onLine) {
      const cached = searchCachedVendors(manualSearch);
      if (cached?.length) {
        const c = cached[0];
        setManualVendor({
          id: c.id,
          user_id: c.user_id,
          stall_id: c.stall_id,
          stall: { stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate },
          profile: { first_name: c.first_name, last_name: c.last_name }
        });
        setManualAmount(String(c.monthly_rate || 1450));
        setManualSearching(false);
        return;
      }
      toast.error("Vendor not found in offline directory");
      setManualSearching(false);
      return;
    }

    try {
      const { data: stalls } = await supabase.from("stalls").select("id, stall_number, section, monthly_rate").ilike("stall_number", `%${manualSearch}%`);
      if (stalls?.length) {
        const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("stall_id", stalls[0].id).single();
        if (v) { const { data: pr } = await supabase.from("profiles").select("*").eq("user_id", v.user_id).single(); setManualVendor({ ...v, stall: v.stalls, profile: pr }); setManualAmount(String(stalls[0].monthly_rate)); setManualSearching(false); return; }
      }
      const { data: profiles } = await supabase.from("profiles").select("*").or(`first_name.ilike.%${manualSearch}%,last_name.ilike.%${manualSearch}%`);
      if (profiles?.length) {
        const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("user_id", profiles[0].user_id).single();
        if (v) { setManualVendor({ ...v, stall: v.stalls, profile: profiles[0] }); setManualAmount(String((v.stalls as any)?.monthly_rate || 1450)); setManualSearching(false); return; }
      }
      toast.error("Vendor not found");
    } catch (e) {
      const cached = searchCachedVendors(manualSearch);
      if (cached?.length) {
        const c = cached[0];
        setManualVendor({
          id: c.id,
          user_id: c.user_id,
          stall_id: c.stall_id,
          stall: { stall_number: c.stall_number, section: c.section, monthly_rate: c.monthly_rate },
          profile: { first_name: c.first_name, last_name: c.last_name }
        });
        setManualAmount(String(c.monthly_rate || 1450));
      } else {
        toast.error("Vendor not found");
      }
    } finally {
      setManualSearching(false);
    }
  };

  const recordManual = useMutation({
    mutationFn: async () => {
      const payload = {
        vendor_id: manualVendor.id, stall_id: manualVendor.stall_id || null,
        amount: Number(manualAmount), payment_method: manualMethod,
        payment_type: "due", status: "completed", processed_by: user?.id,
        period_month: new Date().getMonth() + 1, period_year: new Date().getFullYear(),
        shift_id: activeShift?.id || null,
      };

      if (!navigator.onLine) {
        await saveOfflinePayment(payload);
        return { reference_number: "OFFLINE-SYNC", receipt_number: "PENDING", offline: true };
      }

      try {
        const { data, error } = await supabase.from("payments").insert(payload).select("reference_number, receipt_number").single();
        if (error) throw error;
        const cn3 = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
        const now3 = new Date();
        await notifyVendor({
          vendor_user_id: manualVendor.user_id,
          vendor_name: `${manualVendor.profile?.first_name} ${manualVendor.profile?.last_name}`,
          stall_number: (manualVendor.stall as any)?.stall_number || "—",
          section: (manualVendor.stall as any)?.section || "General",
          amount: Number(manualAmount),
          period_month: now3.getMonth() + 1,
          period_year: now3.getFullYear(),
          payment_method: manualMethod,
          payment_type: "due",
          receipt_number: data.receipt_number || "",
          reference_number: data.reference_number || "",
          cashier_name: cn3,
        });
        return data;
      } catch (err: any) {
        console.warn("Online manual payment insert failed, saving offline:", err);
        await saveOfflinePayment(payload);
        return { reference_number: "OFFLINE-SYNC", receipt_number: "PENDING", offline: true };
      }
    },
    onSuccess: (data) => {
      const cn = cashierProfile ? `${cashierProfile.first_name} ${cashierProfile.last_name}` : "Cashier";
      const now = new Date();
      setManualReceipt({
        vendorName: `${manualVendor.profile?.first_name} ${manualVendor.profile?.last_name}`,
        stallNumber: (manualVendor.stall as any)?.stall_number || "—",
        section: (manualVendor.stall as any)?.section || "General",
        amount: Number(manualAmount),
        payType: "Full Payment",
        period: `${MONTHS_FULL[now.getMonth()]} ${now.getFullYear()}`,
        method: METHOD_CONFIG[manualMethod]?.label || manualMethod,
        refNumber: data.reference_number || "",
        receiptNumber: data.receipt_number || "",
        cashierName: cn,
      });
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetManual = () => { setManualVendor(null); setManualSearch(""); setManualAmount(""); setManualReceipt(null); };

  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [offlinePaymentsList, setOfflinePaymentsList] = useState<any[]>([]);
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshOfflineStatus = async () => {
    const count = await getUnsyncedCount();
    setUnsyncedCount(count);
    if (count > 0) {
      const list = await getOfflinePayments();
      setOfflinePaymentsList(list);
    } else {
      setOfflinePaymentsList([]);
    }
  };

  useEffect(() => {
    refreshOfflineStatus();
    const interval = setInterval(refreshOfflineStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    if (!navigator.onLine) {
      toast.error("Still offline. Please connect to internet to sync payments.");
      return;
    }
    setIsSyncing(true);
    toast.info("Syncing offline payments with database...");
    const res = await syncOfflinePayments();
    setIsSyncing(false);
    await refreshOfflineStatus();
    if (res?.success) {
      toast.success(`Successfully synced ${res.count} payment(s)!`);
      queryClient.invalidateQueries();
    } else {
      toast.error("Failed to sync some offline payments. Will retry automatically.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Accept Payment</h1>
        <p className="text-sm text-muted-foreground">Confirm online payments, process walk-in cash, or record manually</p>
      </div>

      {/* ── OFFLINE PAYMENTS BANNER & SYNC CONTROL ───────────────────────────── */}
      {unsyncedCount > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-amber-900 shadow-sm flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center font-bold text-lg shrink-0">
            </div>
            <div>
              <h4 className="font-semibold text-sm text-amber-950 flex items-center gap-2">
                {unsyncedCount} Offline Payment{unsyncedCount > 1 ? "s" : ""} Saved Locally
              </h4>
              <p className="text-xs text-amber-800/80 mt-0.5">
                Saved safely in browser local storage (IndexedDB). Click to view or sync with database.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-amber-400 bg-white/80 text-amber-900 hover:bg-white text-xs font-semibold rounded-xl"
              onClick={() => { refreshOfflineStatus(); setShowOfflineModal(true); }}
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" /> View Saved ({unsyncedCount})
            </Button>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl gap-1.5 shadow-sm"
              disabled={isSyncing}
              onClick={handleManualSync}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Button>
          </div>
        </div>
      )}

      {/* ── OFFLINE SAVED PAYMENTS MODAL ─────────────────────────────────────── */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b bg-amber-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-amber-950 flex items-center gap-2">
                  <span className="text-lg">⚡</span> Saved Offline Payments
                </h3>
                <p className="text-xs text-amber-800">
                  {offlinePaymentsList.length} transaction(s) stored locally in browser IndexedDB
                </p>
              </div>
              <button
                onClick={() => setShowOfflineModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-amber-200/50 text-amber-900 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {offlinePaymentsList.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No unsynced offline payments found.
                </div>
              ) : (
                offlinePaymentsList.map((p, idx) => (
                  <div key={p.id || idx} className="rounded-xl border bg-background p-4 flex items-center justify-between gap-3 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <span>{fmt(p.amount)}</span>
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono">
                          {p.payment_method?.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Period: Month {p.period_month || "—"}, {p.period_year || 2026} · Saved {new Date(p.created_at || Date.now()).toLocaleTimeString()}
                      </p>
                      <p className="text-[11px] font-mono text-amber-700">
                        ID: {p.id?.substring(0, 18)}...
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-500/15 text-amber-800 border border-amber-300 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending Sync
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t bg-secondary/30 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Location: Browser IndexedDB (`palengclick-offline-db`)
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowOfflineModal(false)} className="rounded-xl text-xs">
                  Close
                </Button>
                <Button size="sm" onClick={handleManualSync} disabled={isSyncing} className="rounded-xl text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  Sync to Database
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!shiftLoading && !activeShift && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600 flex items-center gap-2 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          You do not have an active shift. Please open a shift on the Dashboard to process payments.
        </div>
      )}

      {/* Tabs */}
      <div className="flex rounded-xl bg-secondary p-1 gap-0.5">
        {[
          { id: "submissions", label: "Receipts", badge: submissions.length },
          { id: "walkin", label: "Walk-in / Cash" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs sm:text-sm font-medium transition-all ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
            {t.badge ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── RECEIPT SUBMISSIONS (vendor upload flow) ─────────────────────────── */}
      {tab === "submissions" && (
        viewSubmission ? (
          <div className="max-w-lg mx-auto space-y-4">
            <button onClick={() => { setViewSubmission(null); setShowRejectInput(false); setRejectionReason(""); }}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" /> Back to list
            </button>

            {/* Header */}
            <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <div className="bg-foreground text-background text-center px-5 py-4 space-y-0.5">
                <p className="text-[9px] tracking-[3px] uppercase opacity-50">Republic of the Philippines</p>
                <p className="text-xs font-bold">Municipality of San Juan, Batangas</p>
                <p className="text-lg font-bold tracking-widest mt-1">RECEIPT SUBMISSION</p>
                <p className="text-[9px] opacity-40">Online Payment — Pending Verification</p>
              </div>

              {/* Details */}
              <div className="divide-y">
                {[
                  { label: "Vendor", value: viewSubmission.vendor_name },
                  { label: "Stall", value: `${viewSubmission.stall} — ${viewSubmission.section}` },
                  { label: "Period", value: `${MONTHS_FULL[(viewSubmission.period_month || 1) - 1]} ${viewSubmission.period_year}` },
                  { label: "Payment Type", value: viewSubmission.payment_type === "staggered" ? "Partial" : "Full" },
                  { label: "Method", value: "InstaPay / Bank Transfer" },
                  { label: "Submitted", value: new Date(viewSubmission.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-xs text-muted-foreground shrink-0">{r.label}</span>
                    <span className="text-xs font-semibold text-foreground text-right ml-3">{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Amount */}
              <div className="mx-4 my-3 rounded-xl border-2 border-primary/30 bg-primary/5 py-4 text-center">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Amount</p>
                <p className="font-mono text-3xl font-bold text-foreground">{fmt(Number(viewSubmission.amount))}</p>
              </div>
            </div>

            {/* OCR extracted data */}
            {(viewSubmission.ocr_reference || viewSubmission.ocr_amount || viewSubmission.ocr_datetime || viewSubmission.ocr_recipient) && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Scan className="h-3.5 w-3.5" /> Auto-detected from receipt
                </p>
                {[
                  { label: "Reference No.", value: viewSubmission.ocr_reference, mono: true },
                  { label: "Amount", value: viewSubmission.ocr_amount ? fmt(Number(viewSubmission.ocr_amount)) : null },
                  { label: "Date & Time", value: viewSubmission.ocr_datetime },
                  { label: "Recipient", value: viewSubmission.ocr_recipient },
                ].filter(f => f.value).map(f => (
                  <div key={f.label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className={`font-medium text-foreground text-right max-w-[60%] break-all ${f.mono ? "font-mono text-xs" : ""}`}>{f.value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Receipt image */}
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Receipt</p>
              <img
                src={viewSubmission.receipt_url}
                alt="Payment receipt"
                className="w-full rounded-xl border object-contain max-h-80 bg-secondary/30 cursor-pointer"
                onClick={() => window.open(viewSubmission.receipt_url, "_blank")}
              />
              <a href={viewSubmission.receipt_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <Eye className="h-3.5 w-3.5" /> Open full image
              </a>
            </div>

            {/* Reject reason input */}
            {showRejectInput && (
              <div className="space-y-2">
                <Label className="text-sm">Rejection Reason</Label>
                <Input
                  placeholder="e.g. Amount mismatch, invalid receipt, wrong account..."
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1 gap-2 rounded-xl bg-success hover:bg-success/90 text-white"
                disabled={acceptSubmission.isPending || !activeShift}
                onClick={() => acceptSubmission.mutate(viewSubmission)}>
                {acceptSubmission.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Accepting…</>
                  : <><CheckCircle2 className="h-4 w-4" /> Accept</>}
              </Button>
              {!showRejectInput ? (
                <Button variant="outline"
                  className="flex-1 gap-2 rounded-xl text-accent border-accent/30 hover:bg-accent/10"
                  onClick={() => setShowRejectInput(true)}>
                  <X className="h-4 w-4" /> Reject
                </Button>
              ) : (
                <Button
                  className="flex-1 gap-2 rounded-xl bg-accent hover:bg-accent/90 text-white"
                  disabled={rejectSubmission.isPending}
                  onClick={() => rejectSubmission.mutate({ s: viewSubmission, reason: rejectionReason })}>
                  {rejectSubmission.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Rejecting…</>
                    : <><X className="h-4 w-4" /> Confirm Reject</>}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{submissions.length}</strong> receipt{submissions.length !== 1 ? "s" : ""} pending verification
              </p>
              <button onClick={() => refetchSubs()} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>

            {subsLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3 text-muted-foreground">
                <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-foreground">All clear!</p>
                  <p className="text-xs mt-0.5">No pending receipt submissions</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {submissions.map((s: any) => (
                  <div key={s.id} className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                    {/* Card header strip */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: "linear-gradient(135deg, rgba(15,110,86,0.06) 0%, transparent 100%)" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Pending Verification</span>
                      <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(s.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    <div className="flex items-start gap-4 p-4">
                      {/* Receipt thumbnail */}
                      <div className="relative shrink-0 cursor-pointer group" onClick={() => window.open(s.receipt_url, "_blank")}>
                        <img
                          src={s.receipt_url}
                          alt="Receipt"
                          className="h-16 w-16 rounded-xl object-cover border bg-secondary/30"
                        />
                        <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Vendor info */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-bold text-foreground text-sm">{s.vendor_name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Stall <span className="font-mono font-semibold text-foreground">{s.stall}</span> · {s.section}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-mono font-bold text-foreground text-base">{fmt(Number(s.amount))}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{MONTHS_FULL[(s.period_month || 1) - 1]} {s.period_year}</p>
                          </div>
                        </div>

                        {/* Tags row */}
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700">
                            <Building2 className="h-3 w-3" /> InstaPay
                          </span>
                          {s.payment_type === "staggered" && (
                            <span className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-amber-50 text-amber-700">Partial</span>
                          )}
                          {s.ocr_reference && (
                            <span className="font-mono text-[10px] px-2 py-1 rounded-lg bg-secondary text-muted-foreground">
                              Ref: {s.ocr_reference}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="border-t grid grid-cols-2 gap-0">
                      <Button
                        className="gap-1.5 rounded-none rounded-bl-2xl text-xs h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:bg-emerald-600/50"
                        disabled={acceptSubmission.isPending || !activeShift}
                        onClick={() => acceptSubmission.mutate(s)}>
                        {acceptSubmission.isPending
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Accept Payment
                      </Button>
                      <Button variant="ghost"
                        className="gap-1.5 rounded-none rounded-br-2xl text-xs h-10 text-muted-foreground hover:text-foreground border-l font-semibold"
                        onClick={() => setViewSubmission(s)}>
                        <Eye className="h-3.5 w-3.5" /> View Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* ── WALK-IN CASH ─────────────────────────────────────────────────────── */}
      {tab === "walkin" && <WalkInPayment cashierProfile={cashierProfile} activeShift={activeShift} />}
    </div>
  );
};

export default CashierAcceptPayment;