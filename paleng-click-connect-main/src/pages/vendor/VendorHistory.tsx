import { CheckCircle2, AlertCircle, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const VendorHistory = () => {
  const { user } = useAuth();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["vendor-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase.from("vendors").select("id").eq("user_id", user!.id).single();
      if (!vendor) return [];
      const { data } = await supabase.from("payments").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payment History</h1>
        <p className="text-sm text-muted-foreground">Complete record of all your stall payments</p>
      </div>
      <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Method</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reference</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {payments.map((p: any) => (
              <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-mono font-semibold text-foreground">₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{p.payment_method}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold capitalize ${p.status === "completed" ? "text-success" : "text-accent"}`}>
                    {p.status === "completed" ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference_number}</td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No payments yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VendorHistory;
