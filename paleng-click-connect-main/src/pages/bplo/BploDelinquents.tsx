import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle, Search, Phone, Mail, User, Layers, RefreshCw, X, ShieldAlert
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      const yearStart = `${currentYear - 1}-01-01T00:00:00`;

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

      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

      const vendorStatus = vendors.map(v => {
        const pr = profiles?.find(p => p.user_id === v.user_id);
        const st = v.stalls as any;
        const rate = st?.monthly_rate_2026 || st?.monthly_rate || 1450;
        
        // Filter payments for this specific vendor in the current year
        const vPay = payments.filter(p => p.vendor_id === v.id);
        
        const map: Record<number, number> = {};
        vPay.forEach(p => {
          if (p.period_month) {
            map[p.period_month] = (map[p.period_month] || 0) + Number(p.amount);
          }
        });

        const totalPaid = Object.values(map).reduce((s, val) => s + val, 0);
        
        // Calculate outstanding balance up to the current month
        const outstanding = months.reduce((sum, _, i) => {
          const m = i + 1;
          if (m > currentMonth) return sum;
          return sum + Math.max(0, rate - (map[m] || 0));
        }, 0);

        const paidThisMonth = map[currentMonth] || 0;
        const monthsOverdue = months.slice(0, currentMonth).filter((_, i) => (map[i + 1] || 0) < rate).length;

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
          thisMonthStatus: paidThisMonth >= rate ? "paid" : paidThisMonth > 0 ? "partial" : "unpaid",
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
    <div className="space-y-6">
      
      {/* Hero Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden text-white" style={{ background: BPLO_GRAD, boxShadow: "0 20px 48px rgba(30, 58, 138, 0.15)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1 text-blue-200">BPLO Auditor Dashboard</p>
            <h1 className="text-2xl font-extrabold">Delinquent Vendor Payments</h1>
            <p className="text-xs mt-1 text-blue-100">Monitor overdue monthly rental collections, compliance status, and outstanding balances.</p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="h-10 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 transition-colors border">
            <RefreshCw size={14} /> Refresh Logs
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Outstanding", value: isLoading ? "..." : fmt(stats.totalOutstanding), sub: "combined unpaid fees", icon: AlertTriangle, iconBg: "bg-red-50 text-red-600 border-red-100" },
          { label: "Delinquent Accounts", value: isLoading ? "..." : stats.count, sub: "vendors with arrears", icon: User, iconBg: "bg-blue-50 text-blue-600 border-blue-100" },
          { label: "Critical Cases (3mo+)", value: isLoading ? "..." : stats.criticalCount, sub: "require immediate action", icon: ShieldAlert, iconBg: "bg-amber-50 text-amber-600 border-amber-100" },
          { label: "Avg. Arrears Period", value: isLoading ? "..." : `${stats.avgMonths} months`, sub: "average period overdue", icon: Layers, iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{c.label}</p>
              <h3 className="text-2xl font-black text-slate-900 mt-2 font-mono">{c.value}</h3>
              <p className="text-[10px] text-slate-400 mt-1 font-semibold">{c.sub}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${c.iconBg}`}>
              <c.icon size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Filters and List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Search Vendor / Stall</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <Input
                  type="text"
                  placeholder="Search name, stall number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-10 rounded-xl border-slate-200 text-sm focus:border-blue-500 transition-all outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Filter Section</label>
              <select 
                className="w-full h-10 rounded-xl border border-slate-200 bg-background px-3 text-sm focus:border-blue-500 outline-none"
                value={filterSection} 
                onChange={(e) => setFilterSection(e.target.value)}
              >
                <option value="all">All Market Sections</option>
                {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase pb-1.5">
            Found {filteredList.length} delinquent vendors
          </div>
        </div>

        {/* Directory Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-400">Computing delinquency registers...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500 text-left">
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Vendor Info</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Stall Details</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Overdue Period</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Outstanding Arrears</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((v) => (
                  <tr key={v.vendorId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{v.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone size={11} /> {v.contact}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800 font-mono">Stall {v.stall}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{v.section}</p>
                    </td>
                    <td className="px-5 py-4">
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
