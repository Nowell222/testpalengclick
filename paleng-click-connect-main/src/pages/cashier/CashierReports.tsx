import { Button } from "@/components/ui/button";
import { Download, Printer, FileText, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const CashierReports = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["cashier-reports"],
    queryFn: async () => {
      // Get payments for the last 7 days
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 6);
      const startDate = sevenDaysAgo.toISOString().split("T")[0];

      const { data: payments } = await supabase
        .from("payments")
        .select("amount, created_at, status")
        .gte("created_at", startDate + "T00:00:00")
        .eq("status", "completed");

      const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyMap: Record<string, number> = {};

      for (let i = 0; i < 7; i++) {
        const d = new Date(sevenDaysAgo);
        d.setDate(sevenDaysAgo.getDate() + i);
        const key = days[d.getDay()];
        dailyMap[key] = 0;
      }

      (payments || []).forEach(p => {
        const d = new Date(p.created_at);
        const key = days[d.getDay()];
        dailyMap[key] = (dailyMap[key] || 0) + Number(p.amount);
      });

      const chartData = Object.entries(dailyMap).map(([day, amount]) => ({ day, amount }));
      const totalWeek = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
      const totalCount = payments?.length || 0;

      return { chartData, totalWeek, totalCount };
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const reports = [
    { label: "Daily Collection Report", desc: `${data?.totalCount || 0} payments this week` },
    { label: "Payment Receipt Log", desc: "All receipts issued" },
    { label: "Vendor Payment Status", desc: "Outstanding balances per vendor" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate and print collection reports</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-civic">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">Weekly Collections</h3>
            <p className="text-sm text-muted-foreground">Total: ₱{(data?.totalWeek || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="mr-1.5 h-3.5 w-3.5" /> Print</Button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data?.chartData || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,88%)" />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(220,10%,42%)" }} />
            <YAxis tick={{ fontSize: 12, fill: "hsl(220,10%,42%)" }} tickFormatter={(v) => `₱${v / 1000}k`} />
            <Tooltip formatter={(v: number) => `₱${v.toLocaleString()}`} />
            <Bar dataKey="amount" fill="hsl(185,60%,35%)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {reports.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-civic">
            <FileText className="h-8 w-8 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
            <Button variant="outline" size="sm">View</Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CashierReports;
