import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, CheckCircle2, CreditCard, Loader2, Clock,
  Smartphone, Building2, Banknote, RefreshCw, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const METHOD_ICON: Record<string, any> = {
  gcash: Smartphone, paymaya: Smartphone, instapay: Building2, cash: Banknote,
};
const METHOD_COLOR: Record<string, string> = {
  gcash: "bg-blue-500", paymaya: "bg-green-600", instapay: "bg-primary", cash: "bg-muted",
};

const CashierAcceptPayment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [vendor, setVendor] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [payType, setPayType] = useState("due");
  const [done, setDone] = useState(false);
  const [refNum, setRefNum] = useState("");
  const [receiptNum, setReceiptNum] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "manual">("pending");

  useEffect(() => {
    const vendorId = searchParams.get("vendorId");
    if (vendorId) { loadVendorById(vendorId); setActiveTab("manual"); }
  }, [searchParams]);

  // ── Fetch all pending online payments ─────────────────────────────────────
  const { data: pendingPayments = [], isLoading: loadingPending, refetch: refetchPending } = useQuery({
    queryKey: ["cashier-pending-payments"],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: paymentsList } = await supabase
        .from("payments")
        .select("*")
        .in("status", ["pending", "completed"])
        .order("created_at", { ascending: false })
        .limit(100);
      if (!paymentsList?.length) return [];

      const vendorIds = [...new Set(paymentsList.map(p => p.vendor_id))];
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, user_id, stalls(stall_number, section)")
        .in("id", vendorIds);

      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, contact_number")
        .in("user_id", userIds);

      return paymentsList.map(p => {
        const v = vendors?.find(v => v.id === p.vendor_id);
        const pr = profiles?.find(pr => pr.user_id === v?.user_id);
        const stall = v?.stalls as any;
        return {
          ...p,
          vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
          contact: pr?.contact_number || "—",
          stall_number: stall?.stall_number || "—",
          section: stall?.section || "General",
        };
      });
    },
  });

  // ── Confirm a pending online payment ──────────────────────────────────────
  const confirmPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "completed", processed_by: user?.id })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment confirmed!");
      queryClient.invalidateQueries({ queryKey: ["cashier-pending-payments"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-payment-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Reject a pending payment ───────────────────────────────────────────────
  const rejectPayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment rejected.");
      queryClient.invalidateQueries({ queryKey: ["cashier-pending-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Load vendor by ID ─────────────────────────────────────────────────────
  const loadVendorById = async (vendorId: string) => {
    setSearching(true);
    const { data: v } = await supabase
      .from("vendors")
      .select("id, user_id, stall_id, stalls(*)")
      .eq("id", vendorId).single();
    if (v) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", v.user_id).single();
      // Get payment info
      const currentYear = new Date().getFullYear();
      const { data: payments } = await supabase
        .from("payments")
        .select("period_month, amount, status")
        .eq("vendor_id", v.id)
        .eq("status", "completed")
        .eq("period_year", currentYear);

      const monthPaidMap: Record<number, number> = {};
      (payments || []).forEach(p => {
        if (p.period_month) monthPaidMap[p.period_month] = (monthPaidMap[p.period_month] || 0) + Number(p.amount);
      });

      const stall = v.stalls as any;
      const monthlyRate = stall?.monthly_rate || 1450;
      let nextUnpaid = 1;
      for (let m = 1; m <= 12; m++) {
        if ((monthPaidMap[m] || 0) < monthlyRate) { nextUnpaid = m; break; }
        if (m === 12) nextUnpaid = 13;
      }
      const remaining = Math.max(0, monthlyRate - (monthPaidMap[nextUnpaid] || 0));

      setVendor({ ...v, stall: v.stalls, profile, monthlyRate, nextUnpaid, remaining, monthPaidMap });
      setAmount(String(remaining));
    }
    setSearching(false);
  };

  // ── Search vendor ─────────────────────────────────────────────────────────
  const searchVendor = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setVendor(null);

    const { data: stalls } = await supabase.from("stalls").select("id, stall_number, section, monthly_rate").ilike("stall_number", `%${searchTerm}%`);
    if (stalls?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("stall_id", stalls[0].id).single();
      if (v) { await loadVendorById(v.id); setSearching(false); return; }
    }

    const { data: profiles } = await supabase.from("profiles").select("*").or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
    if (profiles?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("user_id", profiles[0].user_id).single();
      if (v) { await loadVendorById(v.id); setSearching(false); return; }
    }

    toast.error("Vendor not found");
    setSearching(false);
  };

  // ── Record manual cash payment ────────────────────────────────────────────
  const recordPayment = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("payments").insert({
        vendor_id: vendor.id,
        stall_id: vendor.stall_id || null,
        amount: Number(amount),
        payment_method: method,
        payment_type: payType,
        status: "completed",
        processed_by: user?.id,
        period_month: vendor.nextUnpaid <= 12 ? vendor.nextUnpaid : new Date().getMonth() + 1,
        period_year: new Date().getFullYear(),
      }).select("reference_number, receipt_number").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setRefNum(data.reference_number || "");
      setReceiptNum(data.receipt_number || "");
      setDone(true);
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-pending-payments"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-payment-status"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Success screen ────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Payment Recorded!</h2>
        <p className="mt-2 text-muted-foreground">
          ₱{Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} from{" "}
          {vendor?.profile?.first_name} {vendor?.profile?.last_name}
        </p>
        <div className="mt-4 rounded-xl border bg-secondary/50 p-4 text-sm space-y-1 min-w-[240px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono font-medium">{refNum}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Receipt</span><span className="font-mono font-medium">{receiptNum}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="capitalize">{method}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Period</span>
            <span>{vendor?.nextUnpaid <= 12 ? `${MONTHS[vendor.nextUnpaid - 1]} ${new Date().getFullYear()}` : "—"}</span>
          </div>
        </div>
        <Button className="mt-6" onClick={() => { setDone(false); setVendor(null); setSearchTerm(""); setAmount(""); }}>
          New Payment
        </Button>
      </div>
    );
  }

  const pendingList  = pendingPayments.filter((p: any) => p.status === "pending");
  const completedList = pendingPayments.filter((p: any) => p.status === "completed");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Accept Payment</h1>
        <p className="text-sm text-muted-foreground">Review online payments or record cash payments</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-secondary p-1 max-w-sm">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${activeTab === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          Online Payments
          {pendingList.length > 0 && (
            <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">{pendingList.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${activeTab === "manual" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          Cash / Manual
        </button>
      </div>

      {/* ── PENDING ONLINE PAYMENTS TAB ─────────────────────────────────────── */}
      {activeTab === "pending" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pendingList.length} pending · {completedList.length} completed today
            </p>
            <button onClick={() => refetchPending()} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {loadingPending ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : pendingPayments.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
              No payments yet. They will appear here automatically.
            </div>
          ) : (
            <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-secondary/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stall</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Period</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingPayments.map((p: any) => {
                    const Icon = METHOD_ICON[p.payment_method] || CreditCard;
                    const color = METHOD_COLOR[p.payment_method] || "bg-muted";
                    return (
                      <tr key={p.id} className={`hover:bg-secondary/30 transition-colors ${p.status === "pending" ? "bg-amber-50/30" : ""}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{p.vendor_name}</p>
                          <p className="text-xs text-muted-foreground">{p.contact}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-foreground">{p.stall_number}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : "—"}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          ₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={`flex h-5 w-5 items-center justify-center rounded ${color}`}>
                              <Icon className="h-3 w-3 text-white" />
                            </span>
                            <span className="capitalize text-muted-foreground">{p.payment_method}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">
                          {p.payment_type === "staggered" ? "Partial" : "Full"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {p.reference_number || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            p.status === "completed" ? "bg-success/10 text-success" :
                            p.status === "pending"   ? "bg-amber-100 text-amber-700" :
                            "bg-accent/10 text-accent"
                          }`}>
                            {p.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> :
                             p.status === "pending"   ? <Clock className="h-3 w-3" /> :
                             <AlertCircle className="h-3 w-3" />}
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(p.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3">
                          {p.status === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs bg-success hover:bg-success/90"
                                disabled={confirmPayment.isPending}
                                onClick={() => confirmPayment.mutate(p.id)}
                              >
                                Confirm
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-accent border-accent/30 hover:bg-accent/10"
                                disabled={rejectPayment.isPending}
                                onClick={() => rejectPayment.mutate(p.id)}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {p.status === "completed" && (
                            <span className="text-xs text-success font-medium">✓ Done</span>
                          )}
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

      {/* ── MANUAL CASH PAYMENT TAB ──────────────────────────────────────────── */}
      {activeTab === "manual" && (
        <div className="max-w-lg space-y-4">
          {/* Search */}
          <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
            <Label>Search Vendor</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name or stall number..."
                  className="h-11 pl-10 rounded-xl"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchVendor()}
                />
              </div>
              <Button onClick={searchVendor} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
          </div>

          {searching && !vendor && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

          {vendor && (
            <>
              {/* Vendor info */}
              <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-3">
                <h3 className="font-semibold text-foreground">Vendor Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground">Name</p><p className="font-medium text-foreground">{vendor.profile?.first_name} {vendor.profile?.last_name}</p></div>
                  <div><p className="text-muted-foreground">Stall</p><p className="font-mono font-medium text-foreground">{(vendor.stall as any)?.stall_number}</p></div>
                  <div><p className="text-muted-foreground">Section</p><p className="font-medium text-foreground">{(vendor.stall as any)?.section}</p></div>
                  <div><p className="text-muted-foreground">Contact</p><p className="font-medium text-foreground">{vendor.profile?.contact_number || "—"}</p></div>
                  <div><p className="text-muted-foreground">Monthly Rate</p><p className="font-mono font-medium text-foreground">₱{vendor.monthlyRate?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p></div>
                  <div>
                    <p className="text-muted-foreground">Next Due Month</p>
                    <p className="font-medium text-foreground">
                      {vendor.nextUnpaid <= 12 ? `${MONTHS[vendor.nextUnpaid - 1]} ${new Date().getFullYear()}` : "All Paid ✓"}
                    </p>
                  </div>
                </div>
                {vendor.nextUnpaid <= 12 && (
                  <div className="rounded-xl bg-accent/5 border border-accent/10 p-3 text-sm flex justify-between">
                    <span className="text-muted-foreground">Remaining balance for {MONTHS[vendor.nextUnpaid - 1]}</span>
                    <span className="font-mono font-bold text-accent">₱{vendor.remaining?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              {/* Payment form */}
              <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
                <h3 className="font-semibold text-foreground">Record Payment</h3>
                <div className="space-y-1.5">
                  <Label>Amount (₱)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="h-11 rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <select
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="paymaya">Maya</option>
                    <option value="instapay">InstaPay</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Payment Type</Label>
                  <select
                    className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    value={payType}
                    onChange={e => setPayType(e.target.value)}
                  >
                    <option value="due">Full Payment</option>
                    <option value="staggered">Partial / Staggered</option>
                  </select>
                </div>
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={() => recordPayment.mutate()}
                  disabled={recordPayment.isPending || !amount || Number(amount) <= 0}
                >
                  {recordPayment.isPending
                    ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Recording…</>
                    : <><CreditCard className="mr-2 h-5 w-5" /> Record Payment — ₱{Number(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</>
                  }
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CashierAcceptPayment;