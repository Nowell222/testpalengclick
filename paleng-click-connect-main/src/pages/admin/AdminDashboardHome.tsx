import { motion } from "framer-motion";
import { Users, TrendingDown, TrendingUp, DollarSign, AlertCircle, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboardHome = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: async () => {
      const [vendorsRes, paymentsRes, stallsRes] = await Promise.all([
        supabase.from("vendors").select("id, user_id").then(r => r.data || []),
        supabase.from("payments").select("*").eq("status", "completed").then(r => r.data || []),
        supabase.from("stalls").select("id, status").then(r => r.data || []),
      ]);

      const totalCollected = paymentsRes.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalStalls = stallsRes.length;
      const occupiedStalls = stallsRes.filter(s => s.status === "occupied").length;

      // Recent payments
      const { data: recentPayments } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      // Get vendor details for recent payments
      let recentTx: any[] = [];
      if (recentPayments?.length) {
        const vendorIds = [...new Set(recentPayments.map(p => p.vendor_id))];
        const { data: vendors } = await supabase.from("vendors").select("id, user_id, stalls(stall_number)").in("id", vendorIds);
        const userIds = vendors?.map(v => v.user_id) || [];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);

        recentTx = recentPayments.map(p => {
          const vendor = vendors?.find(v => v.id === p.vendor_id);
          const profile = profiles?.find(pr => pr.user_id === vendor?.user_id);
          return {
            vendor: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
            stall: (vendor?.stalls as any)?.stall_number || "—",
            amount: `₱${Number(p.amount).toLocaleString()}`,
            method: p.payment_method,
            time: new Date(p.created_at).toLocaleString(),
          };
        });
      }

      // Overdue payments
      const { data: overdueSchedules } = await supabase
        .from("payment_schedules")
        .select("*, vendors(user_id, stalls(stall_number))")
        .eq("status", "overdue")
        .limit(5);

      let delinquent: any[] = [];
      if (overdueSchedules?.length) {
        const userIds = overdueSchedules.map((s: any) => s.vendors?.user_id).filter(Boolean);
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
        delinquent = overdueSchedules.map((s: any) => {
          const profile = profiles?.find(p => p.user_id === s.vendors?.user_id);
          return {
            name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
            stall: s.vendors?.stalls?.stall_number || "—",
            amount: `₱${Number(s.amount).toLocaleString()}`,
          };
        });
      }

      return {
        totalCollected,
        totalVendors: vendorsRes.length,
        totalStalls,
        occupiedStalls,
        recentTx,
        delinquent,
      };
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const stats = [
    { label: "Total Collections", value: `₱${(data?.totalCollected || 0).toLocaleString()}`, icon: DollarSign },
    { label: "Active Vendors", value: `${data?.totalVendors || 0}`, icon: Users },
    { label: "Occupied Stalls", value: `${data?.occupiedStalls || 0} / ${data?.totalStalls || 0}`, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="rounded-2xl border bg-card p-5 shadow-civic">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-foreground">{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border bg-card shadow-civic lg:col-span-3">
          <div className="border-b p-4"><h3 className="font-semibold text-foreground">Recent Transactions</h3></div>
          <div className="divide-y">
            {(data?.recentTx || []).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.vendor}</p>
                  <p className="text-xs text-muted-foreground">Stall {t.stall} • {t.method}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm font-semibold text-foreground">{t.amount}</p>
                  <p className="text-xs text-muted-foreground">{t.time}</p>
                </div>
              </div>
            ))}
            {(data?.recentTx || []).length === 0 && (
              <p className="px-4 py-8 text-center text-muted-foreground">No transactions yet</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border bg-card shadow-civic lg:col-span-2">
          <div className="border-b p-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-accent" /> Overdue Schedules
            </h3>
          </div>
          <div className="divide-y">
            {(data?.delinquent || []).map((v: any, i: number) => (
              <div key={i} className="p-4">
                <p className="text-sm font-medium text-foreground">{v.name}</p>
                <p className="text-xs text-muted-foreground">Stall {v.stall}</p>
                <p className="mt-1 font-mono text-sm font-semibold text-foreground">{v.amount} overdue</p>
              </div>
            ))}
            {(data?.delinquent || []).length === 0 && (
              <p className="px-4 py-8 text-center text-muted-foreground">No overdue schedules</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardHome;
