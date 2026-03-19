import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminPayments = () => {
  const [paymentType, setPaymentType] = useState("All");
  const [search, setSearch] = useState("");

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, vendors(user_id, stalls(stall_number)), profiles:vendors(user_id(first_name, last_name))")
        .order("created_at", { ascending: false });

      // Simpler query approach
      const { data: paymentsList } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (!paymentsList) return [];

      // Get vendor details
      const vendorIds = [...new Set(paymentsList.map(p => p.vendor_id))];
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, user_id, stalls(stall_number)")
        .in("id", vendorIds);

      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      return paymentsList.map(p => {
        const vendor = vendors?.find(v => v.id === p.vendor_id);
        const profile = profiles?.find(pr => pr.user_id === vendor?.user_id);
        return {
          ...p,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
          stall: (vendor?.stalls as any)?.stall_number || "—",
        };
      });
    },
  });

  const types = ["All", "due", "manual", "staggered"];
  const filtered = payments.filter(
    (p: any) =>
      (paymentType === "All" || p.payment_type === paymentType) &&
      p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payment Management</h1>
        <p className="text-sm text-muted-foreground">View and manage all stall payments</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-secondary p-1">
          {types.map((t) => (
            <button key={t} onClick={() => setPaymentType(t)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${paymentType === t ? "bg-card text-foreground shadow-civic" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 w-48 pl-9 rounded-lg" />
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p: any) => (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{p.payment_type}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{p.payment_method}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference_number}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${p.status === "completed" ? "bg-success/10 text-success" : p.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-accent/10 text-accent"}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No payments found</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminPayments;
