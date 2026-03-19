import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Printer, Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CashierSOA = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const searchVendor = async () => {
    setLoading(true);
    // Search by stall or name
    const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number, section, monthly_rate)");
    const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name");
    
    const match = vendors?.find(v => {
      const stall = v.stalls as any;
      const profile = profiles?.find(p => p.user_id === v.user_id);
      return stall?.stall_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${profile?.first_name} ${profile?.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (match) {
      const profile = profiles?.find(p => p.user_id === match.user_id);
      const stall = match.stalls as any;
      const { data: payments } = await supabase.from("payments").select("*").eq("vendor_id", match.id).eq("status", "completed");
      const currentYear = new Date().getFullYear();
      const paidMonths = new Set((payments || []).filter(p => p.period_year === currentYear).map(p => p.period_month));
      setData({ profile, stall, paidMonths, monthlyRate: stall?.monthly_rate || 1450 });
    } else {
      toast.error("Vendor not found");
      setData(null);
    }
    setLoading(false);
  };

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-foreground">Print Statement of Account</h1><p className="text-sm text-muted-foreground">Search a vendor and view their SOA</p></div>
      <div className="rounded-2xl border bg-card p-6 shadow-civic max-w-lg space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Vendor name or stall..." className="h-11 pl-10 rounded-xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
          <Button onClick={searchVendor} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</Button>
        </div>
      </div>
      {data && (
        <div className="rounded-2xl border bg-card p-6 shadow-civic max-w-2xl">
          <div className="mb-4 border-b pb-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Municipality of San Juan, Batangas</p>
            <p className="text-sm font-semibold text-foreground">STATEMENT OF ACCOUNT</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm mb-4">
            <div><p className="text-muted-foreground">Vendor</p><p className="font-medium text-foreground">{data.profile?.first_name} {data.profile?.last_name}</p></div>
            <div><p className="text-muted-foreground">Stall</p><p className="font-mono font-medium text-foreground">{data.stall?.stall_number}</p></div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="pb-2 text-left text-muted-foreground">Period</th><th className="pb-2 text-right text-muted-foreground">Amount</th><th className="pb-2 text-right text-muted-foreground">Status</th></tr></thead>
            <tbody className="divide-y">
              {months.map((m, i) => (
                <tr key={m}><td className="py-2 text-foreground">{m}</td><td className="py-2 text-right font-mono">₱{Number(data.monthlyRate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td><td className={`py-2 text-right font-semibold ${data.paidMonths.has(i+1) ? "text-success" : "text-muted-foreground"}`}>{data.paidMonths.has(i+1) ? "Paid" : "Pending"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CashierSOA;
