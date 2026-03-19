import { CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const statusIcon: Record<string, any> = { completed: CheckCircle2, pending: Clock, failed: AlertCircle };
const statusColor: Record<string, string> = { completed: "text-success", pending: "text-primary", failed: "text-accent" };

const CashierPaymentStatus = () => {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["cashier-payment-status"],
    queryFn: async () => {
      const { data: paymentsList } = await supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(50);
      if (!paymentsList?.length) return [];
      const vendorIds = [...new Set(paymentsList.map(p => p.vendor_id))];
      const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number)").in("id", vendorIds);
      const userIds = vendors?.map(v => v.user_id) || [];
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return paymentsList.map(p => {
        const vendor = vendors?.find(v => v.id === p.vendor_id);
        const profile = profiles?.find(pr => pr.user_id === vendor?.user_id);
        return { ...p, vendor_name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown", stall: (vendor?.stalls as any)?.stall_number || "—" };
      });
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Payment Status</h1><p className="text-sm text-muted-foreground">View status of all processed payments</p></div>
      <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-secondary/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stall</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
          </tr></thead>
          <tbody className="divide-y">
            {payments.map((p: any) => {
              const Icon = statusIcon[p.status] || Clock;
              const color = statusColor[p.status] || "text-muted-foreground";
              return (
                <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{p.vendor_name}</td>
                  <td className="px-4 py-3 font-mono text-foreground">{p.stall}</td>
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{p.payment_method}</td>
                  <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-xs font-semibold capitalize ${color}`}><Icon className="h-3 w-3" /> {p.status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              );
            })}
            {payments.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No payments yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CashierPaymentStatus;
