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
    <div className="space-y-5">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)",boxShadow:"0 20px 48px rgba(15,110,86,0.15)"}}>
        {[[200,"-60px","-60px","top","right"],[250,"-100px","-60px","bottom","left"]].map(([sz,a,b,v,h],i)=>(
          <div key={i} style={{position:"absolute",[v as string]:a,[h as string]:b,width:sz,height:sz,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.08)",pointerEvents:"none"}}/>
        ))}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:0.04,backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",backgroundSize:"22px 22px"}}/>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1" style={{color:"rgba(255,255,255,0.6)"}}>Admin Portal</p>
            <h1 className="text-2xl font-bold text-white">Fee Schedules</h1>
            <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.6)"}}>View per-month stall fees per vendor — updates from cashier in real time</p>
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-colors">
            <RefreshCw className="h-3.5 w-3.5"/> Refresh
          </button>
        </div>
        {/* Stats strip */}
        <div className="relative mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Total Vendors",   value: vendors.length },
            { label: "Custom Schedules", value: customCount },
            { label: "Avg Monthly Rate", value: `₱${avgRate.toLocaleString()}` },
          ].map(s=>(
            <div key={s.label} className="rounded-xl px-4 py-3 text-center" style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)"}}>
              <p className="font-mono text-xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{color:"rgba(255,255,255,0.6)"}}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Info banner ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0"/>
        <div className="text-muted-foreground">
          <strong className="text-foreground">Read-Only View:</strong> You have view-only access to vendor monthly schedules. Rate editing is managed strictly by the Cashier.
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {label:"Total Vendors",   value:vendors.length,   icon:Store,       iconBg:"bg-blue-100",    iconColor:"#0ea5e9",glow:"#0ea5e9",gradient:"from-blue-50 to-blue-50/40"},
          {label:"Custom Schedules",value:customCount,       icon:CheckCircle2,iconBg:"bg-emerald-100", iconColor:"#10b981",glow:"#10b981",gradient:"from-emerald-50 to-emerald-50/40"},
          {label:"Using Default",   value:defaultCount,      icon:AlertCircle, iconBg:"bg-amber-100",   iconColor:"#f59e0b",glow:"#f59e0b",gradient:"from-amber-50 to-amber-50/40"},
        ].map((c,i)=>(
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-md transition-all duration-300 group`} style={{minHeight:100}}>
            <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full opacity-[0.08] blur-lg" style={{background:c.glow}}/>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${c.iconBg} group-hover:shadow-md transition-shadow`}>
                <c.icon className="h-4 w-4" style={{color:c.iconColor}}/>
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[20px] font-bold text-foreground">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search vendor or stall…" className="h-10 pl-10 rounded-xl" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={filterSection} onChange={e=>setFilterSection(e.target.value)}>
          <option value="all">All Sections</option>
          {SECTIONS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={year} onChange={e=>setYear(Number(e.target.value))}>
          {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{filtered.length}</strong> vendors · Year {year}
      </p>

      {/* ── Vendor table ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{background:"#0f6e56"}}>
              <Loader2 className="h-5 w-5 animate-spin text-white"/>
            </div>
            <p className="text-sm text-muted-foreground">Loading fee schedules…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                  {["Vendor","Stall","Section","Default Rate","Jan","Feb","Mar","Apr","May","Jun","Schedule"].map(h=>(
                    <th key={h} className="px-3 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
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