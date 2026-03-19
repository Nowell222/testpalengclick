import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer, FileText, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminReports = () => {
  const [period, setPeriod] = useState("Daily");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data: payments } = await supabase
        .from("payments")
        .select("amount, status, created_at, payment_method")
        .eq("status", "completed");

      const totalCollected = (payments || []).reduce((s, p) => s + Number(p.amount), 0);
      const { data: overdueSchedules } = await supabase.from("payment_schedules").select("amount").eq("status", "overdue");
      const totalOverdue = (overdueSchedules || []).reduce((s, p) => s + Number(p.amount), 0);

      return { totalCollected, totalOverdue, paymentCount: payments?.length || 0 };
    },
  });

  const reportTypes = [
    { label: "Daily Collection", desc: "View/Print daily collection summary" },
    { label: "Weekly Collection", desc: "View/Print weekly collection summary" },
    { label: "Monthly Collection", desc: "View/Print monthly collection summary" },
    { label: "Delinquent Vendors", desc: "List of vendors with overdue payments" },
    { label: "Vendor Payment History", desc: "Individual vendor payment records" },
    { label: "Stall Summary", desc: "Overview of all stalls and their status" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Generate, view, and export collection and vendor reports</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-card p-4 shadow-civic text-center">
              <p className="text-sm text-muted-foreground">Collectible Overdue</p>
              <p className="mt-1 font-mono text-xl font-bold text-accent">₱{(data?.totalOverdue || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-civic text-center">
              <p className="text-sm text-muted-foreground">Total Collected</p>
              <p className="mt-1 font-mono text-xl font-bold text-foreground">₱{(data?.totalCollected || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-civic text-center">
              <p className="text-sm text-muted-foreground">Total Payments</p>
              <p className="mt-1 font-mono text-xl font-bold text-success">{data?.paymentCount || 0}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold text-foreground">Available Reports</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reportTypes.map((r) => (
                <div key={r.label} className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-civic">
                  <FileText className="h-8 w-8 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.desc}</p>
                  </div>
                  <Button variant="outline" size="sm">View</Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminReports;
