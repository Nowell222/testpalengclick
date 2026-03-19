import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const VendorStatement = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-statement", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase.from("vendors").select("id, stalls(stall_number, section, monthly_rate)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", user!.id).single();
      const { data: payments } = await supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").eq("status", "completed").order("created_at", { ascending: true });
      return { vendor, profile, payments: payments || [], stall: vendor?.stalls as any };
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const stall = data?.stall;
  const profile = data?.profile;
  const payments = data?.payments || [];
  const monthlyRate = stall?.monthly_rate || 1450;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Calculate paid amounts per month (supports staggered)
  const monthPaidMap: Record<number, number> = {};
  payments.filter(p => p.period_year === currentYear).forEach(p => {
    if (p.period_month) {
      monthPaidMap[p.period_month] = (monthPaidMap[p.period_month] || 0) + Number(p.amount);
    }
  });

  // Calculate outstanding (only for months up to current)
  const totalOutstanding = MONTHS.reduce((sum, _, i) => {
    const month = i + 1;
    if (month > currentMonth) return sum;
    const paid = monthPaidMap[month] || 0;
    return sum + Math.max(0, monthlyRate - paid);
  }, 0);

  const totalPaid = Object.values(monthPaidMap).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Statement of Account</h1>
        <p className="text-sm text-muted-foreground">Official summary of your stall rental payments</p>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-civic max-w-2xl">
        <div className="mb-6 border-b pb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Republic of the Philippines</p>
          <p className="text-sm font-semibold text-foreground">Municipality of San Juan, Batangas</p>
          <h2 className="mt-3 text-lg font-bold text-foreground">STATEMENT OF ACCOUNT</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm mb-6">
          <div><p className="text-muted-foreground">Vendor Name</p><p className="font-medium text-foreground">{profile?.first_name} {profile?.last_name}</p></div>
          <div><p className="text-muted-foreground">Stall Number</p><p className="font-mono font-medium text-foreground">{stall?.stall_number || "—"}</p></div>
          <div><p className="text-muted-foreground">Section</p><p className="font-medium text-foreground">{stall?.section || "General"}</p></div>
          <div><p className="text-muted-foreground">Year</p><p className="font-medium text-foreground">{currentYear}</p></div>
        </div>
        <table className="w-full text-sm mb-6">
          <thead><tr className="border-b">
            <th className="pb-2 text-left font-medium text-muted-foreground">Period</th>
            <th className="pb-2 text-right font-medium text-muted-foreground">Amount Due</th>
            <th className="pb-2 text-right font-medium text-muted-foreground">Paid</th>
            <th className="pb-2 text-right font-medium text-muted-foreground">Balance</th>
            <th className="pb-2 text-right font-medium text-muted-foreground">Status</th>
          </tr></thead>
          <tbody className="divide-y">
            {MONTHS.map((m, i) => {
              const month = i + 1;
              const paid = monthPaidMap[month] || 0;
              const balance = Math.max(0, monthlyRate - paid);
              const isFully = paid >= monthlyRate;
              const isPartial = paid > 0 && paid < monthlyRate;
              const isFuture = month > currentMonth && paid === 0;

              return (
                <tr key={m} className={isFuture ? "opacity-50" : ""}>
                  <td className="py-2 text-foreground">{m} {currentYear}</td>
                  <td className="py-2 text-right font-mono text-foreground">₱{monthlyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td className="py-2 text-right font-mono text-foreground">
                    {paid > 0 ? `₱${paid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className={`py-2 text-right font-mono font-medium ${balance > 0 && !isFuture ? "text-accent" : "text-foreground"}`}>
                    {isFully ? "—" : `₱${balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`}
                  </td>
                  <td className={`py-2 text-right text-xs font-semibold ${
                    isFully ? "text-success" : isPartial ? "text-primary" : isFuture ? "text-muted-foreground" : "text-accent"
                  }`}>
                    {isFully ? "✓ Paid" : isPartial ? "Partial" : isFuture ? "Upcoming" : "Pending"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="space-y-2 border-t pt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Paid ({currentYear})</span>
            <span className="font-mono font-semibold text-success">₱{totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium text-foreground">Total Outstanding</span>
            <span className="font-mono text-xl font-bold text-accent">₱{totalOutstanding.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorStatement;
