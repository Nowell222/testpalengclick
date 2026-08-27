import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, Search, Phone, Mail, User, Layers, RefreshCw, X, ShieldAlert
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { calculateMonthlyStatement, computeMonthPenalty, PAYMENT_DUE_DAY, PENALTY_RATE, isMonthOverdue } from "@/lib/utils";

interface DelinquentRow {
  vendorId: string;
  userId: string;
  name: string;
  contact: string;
  accountStatus: string;
  stall: string;
  section: string;
  rate: number;
  totalPaid: number;
  outstanding: number;
  monthsOverdue: number;
  thisMonthStatus: string;
}

const BPLO_GRAD = "linear-gradient(160deg, #0d1e36 0%, #1e3a8a 70%, #3b82f6 100%)";
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export default function BploDelinquents() {
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("all");

  const SECTIONS = [
    "Building I - 1st Floor",
    "Building II - 1st Floor",
    "Building I - 2nd Floor",
    "Building II - 2nd Floor",
    "Bldg 1 & 2 Bolante",
    "Outside the Building - Bolante",
    "New Building - Mojica",
    "New Building - Kalayaan",
    "Meat Stalls",
    "Fish Stalls",
    "Egg and Dried Fish",
    "Eatery 2nd Floor",
    "Vegetable Section",
    "Vegetable Section - Extension",
  ];

  // Fetch payments, vendors, and profiles to compute delinquencies
  const { data: delinquents = [], isLoading, refetch } = useQuery<DelinquentRow[]>({
    queryKey: ["bplo-delinquents"],
    refetchInterval: 20000,
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const [paymentsRes, vendorsRes] = await Promise.all([
        supabase.from("payments").select("*").eq("status", "completed").eq("period_year", currentYear),
        supabase.from("vendors").select("id,user_id,stalls(stall_number,section,monthly_rate,monthly_rate_2026,status)"),
      ]);

      const payments = paymentsRes.data || [];
      const vendors = vendorsRes.data || [];
      const userIds = vendors.map(v => v.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,first_name,last_name,contact_number,status")
        .in("user_id", userIds);

      const vendorStatus = vendors.map(v => {
        const pr = profiles?.find(p => p.user_id === v.user_id);
        const st = v.stalls as any;
        const rate = st ? (Number(st.monthly_rate_2026) || Number(st.monthly_rate) || 0) : 0;
        const isBolante = (st?.section || "").toLowerCase().includes("bolante");
        
        // Filter payments for this specific vendor in the current year
        const vPay = payments.filter(p => p.vendor_id === v.id);
        
        const statement = calculateMonthlyStatement({
          year: currentYear,
          getMonthFee: () => rate,
          payments: vPay,
          isBolante,
        });

        const totalPaid = statement.totalPaid;
        const outstanding = statement.totalOutstanding;
        const monthsOverdue = statement.rows.slice(0, currentMonth).filter(r => r.isOverdue && r.balance > 0).length;
        const currentMonthRow = statement.rows[currentMonth - 1];
        const thisMonthStatus = (currentMonthRow?.isFully || currentMonthRow?.isAdvance)
          ? "paid"
          : (currentMonthRow?.isPartial ? "partial" : "unpaid");

        return {
          vendorId: v.id,
          userId: v.user_id,
          name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown Vendor",
          contact: pr?.contact_number || "—",
          accountStatus: pr?.status || "active",
          stall: st?.stall_number || "—",
          section: st?.section || "General",
          rate,
          totalPaid,
          outstanding,
          monthsOverdue,
          thisMonthStatus,
        };
      });

      // Filter only those with outstanding balance or months overdue
      return vendorStatus.filter(v => v.monthsOverdue > 0 && v.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
    }
  });

  // KPI Calculations
  const stats = useMemo(() => {
    if (delinquents.length === 0) return { totalOutstanding: 0, count: 0, avgMonths: 0, criticalCount: 0 };
    const totalOutstanding = delinquents.reduce((sum, v) => sum + v.outstanding, 0);
    const avgMonths = delinquents.reduce((sum, v) => sum + v.monthsOverdue, 0) / delinquents.length;
    const criticalCount = delinquents.filter(v => v.monthsOverdue >= 3).length;
    return {
      totalOutstanding,
      count: delinquents.length,
      avgMonths: Math.round(avgMonths * 10) / 10,
      criticalCount,
    };
  }, [delinquents]);

  // Filtered List
  const filteredList = useMemo(() => {
    return delinquents.filter(v => {
      const term = search.toLowerCase();
      const matchSearch =
        v.name.toLowerCase().includes(term) ||
        v.stall.toLowerCase().includes(term) ||
        v.contact.includes(term);
      const matchSection = filterSection === "all" || v.section === filterSection;
      return matchSearch && matchSection;
    });
  }, [delinquents, search, filterSection]);

  return (
    <div className="space-y-4">
      
      {/* Executive Header Banner */}
      <div className="rounded-2xl p-5 relative overflow-hidden text-white" style={{ background: BPLO_GRAD, boxShadow: "0 12px 32px rgba(13,30,54,0.15)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200">BPLO Auditor Dashboard</span>
              <span className="h-1 w-1 rounded-full bg-blue-400" />
              <span className="text-[10px] text-blue-100">Compliance & Arrears</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Delinquent Vendor Payments</h1>
            <p className="text-xs text-blue-100/70 mt-0.5">Monitor overdue monthly rental collections, compliance status, and outstanding balances.</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="h-9 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 transition-colors border text-xs px-3.5 font-semibold">
            <RefreshCw size={13} /> Refresh Logs
          </Button>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Outstanding", value: isLoading ? "..." : fmt(stats.totalOutstanding), sub: "combined unpaid fees", icon: AlertTriangle, iconBg: "bg-rose-100", iconColor: "#f43f5e", glow: "#f43f5e", gradient: "from-rose-50 to-rose-50/30" },
          { label: "Delinquent Accounts", value: isLoading ? "..." : String(stats.count), sub: "vendors with arrears", icon: User, iconBg: "bg-blue-100", iconColor: "#2563eb", glow: "#2563eb", gradient: "from-blue-50 to-blue-50/30" },
          { label: "Critical Cases (3mo+)", value: isLoading ? "..." : String(stats.criticalCount), sub: "require immediate action", icon: ShieldAlert, iconBg: stats.criticalCount > 0 ? "bg-amber-100" : "bg-secondary", iconColor: stats.criticalCount > 0 ? "#f59e0b" : "hsl(220,10%,55%)", glow: stats.criticalCount > 0 ? "#f59e0b" : "transparent", gradient: stats.criticalCount > 0 ? "from-amber-50 to-amber-50/30" : "from-secondary to-secondary/30" },
          { label: "Avg. Arrears Period", value: isLoading ? "..." : `${stats.avgMonths} mo`, sub: "average period overdue", icon: Layers, iconBg: "bg-indigo-100", iconColor: "#4f46e5", glow: "#4f46e5", gradient: "from-indigo-50 to-indigo-50/30" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-3.5 hover:shadow-sm transition-all duration-300 group`}>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-xs ${c.iconBg}`}>
                <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[16px] font-bold text-foreground leading-tight">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and List */}
      <div className="bg-card rounded-2xl border shadow-xs overflow-hidden">
        
        {/* Controls */}
        <div className="p-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/50 to-transparent">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input
                type="text"
                placeholder="Search name, stall number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 rounded-xl border bg-background text-xs"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>
            <div>
              <select 
                className="w-full h-9 rounded-xl border bg-background px-3 text-xs"
                value={filterSection} 
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="all">All Market Sections</option>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="text-[11px] font-semibold text-muted-foreground">
            Found {filteredList.length} delinquent vendors
          </div>
        </div>

        {/* Directory Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2.5">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs text-muted-foreground">Computing delinquency registers...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ background: "linear-gradient(135deg,#0d1e36 0%,#1e3a8a 100%)" }}>
                  <th className="px-4 py-3 font-semibold text-blue-100 text-[11px] uppercase tracking-wider text-left">Vendor Info</th>
                  <th className="px-4 py-3 font-semibold text-blue-100 text-[11px] uppercase tracking-wider text-left">Stall Details</th>
                  <th className="px-4 py-3 font-semibold text-blue-100 text-[11px] uppercase tracking-wider text-left">Overdue Period</th>
                  <th className="px-4 py-3 font-semibold text-blue-100 text-[11px] uppercase tracking-wider text-left">Outstanding Arrears</th>
                  <th className="px-4 py-3 font-semibold text-blue-100 text-[11px] uppercase tracking-wider text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredList.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-foreground text-xs">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Phone size={10} /> {v.contact}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-foreground font-mono text-xs">Stall {v.stall}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{v.section}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`font-bold inline-flex items-center gap-1 ${
                        v.monthsOverdue >= 6 
                          ? "text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100" 
                          : v.monthsOverdue >= 3 
                            ? "text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100" 
                            : "text-slate-700 bg-slate-100 px-2 py-0.5 rounded"
                      }`}>
                        {v.monthsOverdue} month{v.monthsOverdue > 1 ? "s" : ""}
                        {v.monthsOverdue >= 3 && " ⚠️"}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-red-600">
                      {fmt(v.outstanding)}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        v.accountStatus === "active" 
                          ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                          : "bg-red-50 text-red-700 border-red-100"
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${v.accountStatus === "active" ? "bg-emerald-500" : "bg-red-500"}`} />
                        {v.accountStatus.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <AlertTriangle size={36} className="text-slate-300" />
                        <p className="font-semibold text-slate-600">No delinquent vendors found</p>
                        <p className="text-xs">All vendors are currently up to date in the selected filter.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info summary */}
        {!isLoading && filteredList.length > 0 && (
          <div className="p-5 border-t bg-slate-50/50 flex justify-between items-center text-xs font-semibold text-slate-500">
            <span>{filteredList.length} Delinquents Registered</span>
            <span className="font-mono text-sm text-red-600">Total Arrears: {fmt(filteredList.reduce((sum, v) => sum + v.outstanding, 0))}</span>
          </div>
        )}

      </div>

    </div>
  );
}
