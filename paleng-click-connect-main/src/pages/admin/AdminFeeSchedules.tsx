import { useState } from "react";
import {
  Loader2, Search, RefreshCw, CheckCircle2,
  Store, AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const AdminFeeSchedules = () => {
  const [search,        setSearch]        = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [year,          setYear]          = useState(new Date().getFullYear());
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

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-fee-vendors"],
    queryFn: async () => {
      const { data: vList } = await supabase.from("vendors").select("id, user_id, stall_id, stalls(stall_number, section, monthly_rate, status)").not("stall_id", "is", null);
      if (!vList) return [];
      const userIds = vList.map(v => v.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return vList.map(v => {
        const pr = profiles?.find(p => p.user_id === v.user_id);
        return { ...v, vendor_name: pr?`${pr.first_name} ${pr.last_name}`:"Unknown" };
      });
    },
  });

  const { data: allSchedules = [] } = useQuery({
    queryKey: ["all-fee-schedules", year],
    queryFn: async () => {
      const { data } = await (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("year", year);
      return (data || []) as any[];
    },
  });

  const filtered = vendors.filter((v: any) => {
    const st = v.stalls as any;
    const matchSearch  = !search || v.vendor_name.toLowerCase().includes(search.toLowerCase()) || (st?.stall_number||"").toLowerCase().includes(search.toLowerCase());
    const matchSection = filterSection === "all" || st?.section === filterSection;
    return matchSearch && matchSection;
  });

  // Stats
  const customCount   = vendors.filter((v: any) => allSchedules.some((s: any) => s.stall_id === v.stall_id)).length;
  const defaultCount  = vendors.length - customCount;
  const avgRate       = vendors.length > 0
    ? Math.round(vendors.reduce((s: number, v: any) => s + (v.stalls ? ((v.stalls as any)?.monthly_rate || 1450) : 0), 0) / vendors.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 12px 32px rgba(15,110,86,0.12)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Admin Portal</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-100">Fee Schedules</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Fee Schedules</h1>
            <p className="text-xs text-white/70 mt-0.5">View per-month stall rental rates and fee adjustments across vendors</p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-all">
            <RefreshCw className="h-3.5 w-3.5"/> Refresh
          </button>
        </div>
        {/* Stats strip */}
        <div className="relative mt-4 grid grid-cols-3 gap-2.5">
          {[
            { label: "Total Vendors", value: vendors.length },
            { label: "Custom Schedules", value: customCount },
            { label: "Avg Monthly Rate", value: `₱${avgRate.toLocaleString()}` },
          ].map(s => (
            <div key={s.label} className="rounded-xl px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <p className="font-mono text-base font-bold text-white leading-tight">{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Info banner ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-primary shrink-0"/>
        <div className="text-muted-foreground">
          <strong className="text-foreground">Read-Only View:</strong> You have view-only access to vendor monthly schedules. Rate editing is managed strictly by the Cashier.
        </div>
      </div>

      {/* ── 3 KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Vendors", value: String(vendors.length), icon: Store, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/30" },
          { label: "Custom Schedules", value: String(customCount), icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30" },
          { label: "Using Default Rate", value: String(defaultCount), icon: AlertCircle, iconBg: "bg-amber-100", iconColor: "#f59e0b", glow: "#f59e0b", gradient: "from-amber-50 to-amber-50/30" },
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
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search vendor or stall…" className="h-9 pl-9 rounded-xl text-xs" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="h-9 rounded-xl border bg-background px-3 text-xs" value={filterSection} onChange={e=>setFilterSection(e.target.value)}>
          <option value="all">All Sections</option>
          {SECTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="h-9 rounded-xl border bg-background px-3 text-xs" value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">{filtered.length}</strong> vendors · Year {year}
      </p>

      {/* ── Vendor table ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2.5">
            <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{background:"#0f6e56"}}>
              <Loader2 className="h-4 w-4 animate-spin text-white"/>
            </div>
            <p className="text-xs text-muted-foreground">Loading fee schedules…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                  {["Vendor","Stall","Section","Default Rate","Jan","Feb","Mar","Apr","May","Jun","Schedule"].map(h=>(
                    <th key={h} className="px-3.5 py-3 text-left font-semibold text-emerald-100 text-[11px] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((v: any) => {
                  const st      = v.stalls as any;
                  const defRate = st ? (Number(st.monthly_rate_2026) || Number(st.monthly_rate) || 0) : 0;
                  const vendorSchedules = allSchedules.filter((s: any) => s.stall_id === v.stall_id);
                  const hasAny  = vendorSchedules.length > 0;
                  return (
                    <tr key={v.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-3 py-3 font-semibold text-foreground">{v.vendor_name}</td>
                      <td className="px-3 py-3 font-mono text-foreground">{st?.stall_number||"—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{st?.section}</td>
                      <td className="px-3 py-3 font-mono text-muted-foreground">{fmt(defRate)}</td>
                      {[1,2,3,4,5,6].map(m => {
                        const sched = vendorSchedules.find((s: any) => s.month === m);
                        const amt   = sched ? Number(sched.amount) : defRate;
                        const isCustom = !!sched && sched.amount !== defRate;
                        return (
                          <td key={m} className="px-3 py-3">
                            <span className={`font-mono text-xs ${isCustom?"text-primary font-bold":"text-muted-foreground"}`}>
                              ₱{amt.toLocaleString()}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          hasAny?"bg-primary/10 text-primary border-primary/20":"bg-secondary text-muted-foreground border-border"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${hasAny?"bg-primary":"bg-muted-foreground"}`}/>
                          {hasAny?"Custom":"Default"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length===0&&(
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                          <Store className="h-7 w-7 text-slate-400"/>
                        </div>
                        <p className="font-semibold text-foreground">No vendors found</p>
                        <p className="text-xs">No vendor accounts exist.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="border-t bg-secondary/30 px-5 py-3 flex justify-between text-xs text-muted-foreground">
            <span>{filtered.length} vendors shown</span>
            <span className="text-primary font-medium">{customCount} with custom schedules</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeeSchedules;