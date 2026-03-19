import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const CashierAcceptPayment = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [vendor, setVendor] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [done, setDone] = useState(false);
  const [refNum, setRefNum] = useState("");
  const [searching, setSearching] = useState(false);

  // Auto-load vendor if vendorId is passed via URL
  useEffect(() => {
    const vendorId = searchParams.get("vendorId");
    if (vendorId) {
      loadVendorById(vendorId);
    }
  }, [searchParams]);

  const loadVendorById = async (vendorId: string) => {
    setSearching(true);
    const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("id", vendorId).single();
    if (v) {
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", v.user_id).single();
      setVendor({ ...v, stall: v.stalls, profile });
      setAmount(String((v.stalls as any)?.monthly_rate || 1450));
    }
    setSearching(false);
  };

  const searchVendor = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    // Search by stall number
    const { data: stalls } = await supabase.from("stalls").select("id, stall_number, section, monthly_rate").ilike("stall_number", `%${searchTerm}%`);
    if (stalls?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("stall_id", stalls[0].id).single();
      if (v) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", v.user_id).single();
        setVendor({ ...v, stall: v.stalls, profile });
        setAmount(String(stalls[0].monthly_rate));
        setSearching(false);
        return;
      }
    }
    // Search by name
    const { data: profiles } = await supabase.from("profiles").select("*").or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`);
    if (profiles?.length) {
      const { data: v } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(*)").eq("user_id", profiles[0].user_id).single();
      if (v) {
        setVendor({ ...v, stall: v.stalls, profile: profiles[0] });
        setAmount(String((v.stalls as any)?.monthly_rate || 1450));
        setSearching(false);
        return;
      }
    }
    toast.error("Vendor not found");
    setSearching(false);
  };

  const recordPayment = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("payments").insert({
        vendor_id: vendor.id,
        stall_id: vendor.stall_id || null,
        amount: Number(amount),
        payment_method: method,
        payment_type: "due",
        status: "completed",
        processed_by: user?.id,
        period_month: new Date().getMonth() + 1,
        period_year: new Date().getFullYear(),
      }).select("reference_number, receipt_number").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setRefNum(data.reference_number || "");
      setDone(true);
      // Invalidate all relevant caches
      queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-payment-status"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10"><CheckCircle2 className="h-10 w-10 text-success" /></div>
        <h2 className="text-2xl font-bold text-foreground">Payment Recorded!</h2>
        <p className="mt-2 text-muted-foreground">₱{Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })} from {vendor?.profile?.first_name} {vendor?.profile?.last_name}</p>
        <p className="mt-1 text-sm text-muted-foreground">Receipt: {refNum}</p>
        <div className="mt-6 flex gap-2">
          <Button onClick={() => { setDone(false); setVendor(null); setSearchTerm(""); setAmount(""); }}>New Payment</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Accept Payment</h1><p className="text-sm text-muted-foreground">Process cash payments from vendors</p></div>
      <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
        <Label>Search Vendor</Label>
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Name or stall number..." className="h-11 pl-10 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => e.key === "Enter" && searchVendor()} /></div>
          <Button onClick={searchVendor} disabled={searching}>{searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</Button>
        </div>
      </div>
      {searching && !vendor && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
      {vendor && (
        <>
          <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-3">
            <h3 className="font-semibold text-foreground">Vendor Details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Name</p><p className="font-medium text-foreground">{vendor.profile?.first_name} {vendor.profile?.last_name}</p></div>
              <div><p className="text-muted-foreground">Stall</p><p className="font-mono font-medium text-foreground">{(vendor.stall as any)?.stall_number}</p></div>
              <div><p className="text-muted-foreground">Section</p><p className="font-medium text-foreground">{(vendor.stall as any)?.section}</p></div>
              <div><p className="text-muted-foreground">Contact</p><p className="font-medium text-foreground">{vendor.profile?.contact_number || "—"}</p></div>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
            <h3 className="font-semibold text-foreground">Payment Details</h3>
            <div className="space-y-1.5"><Label>Amount (₱)</Label><Input value={amount} onChange={e => setAmount(e.target.value)} className="h-11 rounded-xl font-mono" /></div>
            <div className="space-y-1.5"><Label>Method</Label>
              <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="cash">Cash</option><option value="gcash">GCash</option><option value="paymaya">PayMaya</option>
              </select>
            </div>
            <Button variant="hero" size="lg" className="w-full" onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending}>
              {recordPayment.isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />} Record Payment
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default CashierAcceptPayment;
