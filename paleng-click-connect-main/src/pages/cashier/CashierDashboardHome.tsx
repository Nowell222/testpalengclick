import { DollarSign, Users, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CashierDashboardHome = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cashier-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data: todayPayments } = await supabase.from("payments").select("*").gte("created_at", today + "T00:00:00").eq("status", "completed");
      const totalToday = (todayPayments || []).reduce((s, p) => s + Number(p.amount), 0);
      
      const { data: recent } = await supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(5);
      let recentList: any[] = [];
      if (recent?.length) {
        const vendorIds = [...new Set(recent.map(p => p.vendor_id))];
        const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number)").in("id", vendorIds);
        const userIds = vendors?.map(v => v.user_id) || [];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
        recentList = recent.map(p => {
          const v = vendors?.find(v => v.id === p.vendor_id);
          const pr = profiles?.find(pr => pr.user_id === v?.user_id);
          return { ...p, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown", stall: (v?.stalls as any)?.stall_number || "—" };
        });
      }
      return { totalToday, txCount: todayPayments?.length || 0, recent: recentList };
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const stats = [
    { label: "Today's Collections", value: `₱${(data?.totalToday || 0).toLocaleString()}`, icon: DollarSign },
    { label: "Transactions Today", value: String(data?.txCount || 0), icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Cashier Terminal</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map(s => (
          <div key={s.label} className="rounded-2xl border bg-card p-5 shadow-civic">
            <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{s.label}</span><s.icon className="h-4 w-4 text-muted-foreground" /></div>
            <p className="mt-2 font-mono text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/cashier/accept" className="rounded-2xl border bg-primary p-6 shadow-civic-lg text-center hover:bg-primary/90 transition-colors">
          <DollarSign className="mx-auto h-8 w-8 text-primary-foreground" /><h3 className="mt-2 text-lg font-bold text-primary-foreground">Accept Payment</h3>
        </Link>
        <Link to="/cashier/search" className="rounded-2xl border bg-card p-6 shadow-civic text-center hover:bg-secondary/50 transition-colors">
          <Users className="mx-auto h-8 w-8 text-primary" /><h3 className="mt-2 text-lg font-bold text-foreground">Search Vendor</h3>
        </Link>
      </div>
      <div className="rounded-2xl border bg-card shadow-civic">
        <div className="border-b p-4"><h3 className="font-semibold text-foreground">Recent Receipts</h3></div>
        <div className="divide-y">
          {(data?.recent || []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-success" /><div><p className="text-sm font-medium text-foreground">{r.vendor_name}</p><p className="text-xs text-muted-foreground">Stall {r.stall}</p></div></div>
              <div className="text-right"><p className="font-mono text-sm font-semibold text-foreground">₱{Number(r.amount).toLocaleString()}</p><p className="text-xs text-muted-foreground">{r.reference_number}</p></div>
            </div>
          ))}
          {(data?.recent || []).length === 0 && <p className="px-4 py-8 text-center text-muted-foreground">No transactions yet</p>}
        </div>
      </div>
    </div>
  );
};

export default CashierDashboardHome;
