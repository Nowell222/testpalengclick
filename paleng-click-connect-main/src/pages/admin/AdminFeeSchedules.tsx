import { useState, useEffect } from "react";
import {
  Loader2, Search, Save, RefreshCw, CheckCircle2,
  Store, DollarSign, Edit3, X, AlertCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const VendorFeeEditor = ({ vendor, year, onClose }: { vendor: any; year: number; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const stall       = vendor.stalls as any;
  const defaultRate = stall?.monthly_rate || 1450;
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["fee-schedule", vendor.stall_id, year],
    enabled: !!vendor.stall_id,
    queryFn: async () => {
      const { data } = await supabase.from("stall_fee_schedules" as any).select("*").eq("stall_id", vendor.stall_id!).eq("year", year);
      return (data || []) as any[];
    },
  });

  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [notes,   setNotes]   = useState<Record<number, string>>({});
  const [dirty,   setDirty]   = useState(false);
  const currentMonth = new Date().getMonth() + 1;

  useEffect(() => {
    const a: Record<number,string> = {}; const n: Record<number,string> = {};
    MONTHS.forEach((_, i) => {
      const m = i + 1; const row = schedules.find((s: any) => s.month === m);
      a[m] = row ? String(row.amount) : String(defaultRate);
      n[m] = row?.note || "";
    });
    setAmounts(a); setNotes(n); setDirty(false);
  }, [schedules, defaultRate]);

  const applyToAll = (val: string) => {
    const a: Record<number,string> = {};
    MONTHS.forEach((_,i) => { a[i+1] = val; });
    setAmounts(a); setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const upserts = MONTHS.map((_, i) => {
        const m = i + 1;
        return { stall_id: vendor.stall_id, year, month: m, amount: Number(amounts[m]) || defaultRate, note: notes[m] || null };
      });
      const { error } = await (supabase.from("stall_fee_schedules" as any) as any).upsert(upserts, { onConflict: "stall_id,year,month" });
      if (error) throw error;
      await supabase.from("stalls").update({ monthly_rate: Number(amounts[1]) || defaultRate }).eq("id", vendor.stall_id);
    },
    onSuccess: () => {
      toast.success("Fee schedule saved!");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["fee-schedule", vendor.stall_id, year] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalYear = MONTHS.reduce((s, _, i) => s + (Number(amounts[i+1]) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="rounded-t-2xl overflow-hidden" style={{background:"linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)"}}>
          <div className="flex items-start justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 border border-white/20">
                <Store className="h-5 w-5 text-white"/>
              </div>
              <div>
                <h2 className="font-bold text-white">{vendor.vendor_name}</h2>
                <p className="text-sm text-emerald-200/80">
                  Stall <span className="font-mono">{stall?.stall_number}</span> · {stall?.section} · {year}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="rounded-xl p-2 hover:bg-white/10 text-white/70 transition-colors"><X className="h-5 w-5"/></button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Quick set all */}
          <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 p-3 flex-wrap">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary shrink-0"/>
              <p className="text-sm text-muted-foreground">Set same rate for all months:</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[1450,1500,1600,1800].map(v=>(
                <button key={v} onClick={()=>applyToAll(String(v))}
                  className="rounded-lg border px-2.5 py-1 text-xs font-mono text-muted-foreground hover:bg-card hover:text-foreground transition-colors">
                  ₱{v.toLocaleString()}
                </button>
              ))}
              <Input type="number" placeholder="Custom" className="h-7 w-24 rounded-lg text-xs"
                onKeyDown={e=>{if(e.key==="Enter")applyToAll((e.target as HTMLInputElement).value);}}
                onBlur={e=>{if(e.target.value)applyToAll(e.target.value);}}/>
            </div>
          </div>

          {/* Month grid */}
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MONTHS.map((month, i) => {
                const m           = i + 1;
                const isCurrent   = m === currentMonth && year === new Date().getFullYear();
                const isPast      = m < currentMonth && year <= new Date().getFullYear();
                const hasSchedule = schedules.some((s: any) => s.month === m);
                return (
                  <div key={m} className={`rounded-xl border p-3 space-y-2 ${isCurrent?"border-primary/40 bg-primary/5":isPast?"bg-secondary/30":"bg-card"}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-semibold ${isCurrent?"text-primary":"text-foreground"}`}>
                        {month}
                        {isCurrent&&<span className="ml-1.5 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">Current</span>}
                      </p>
                      {hasSchedule&&<CheckCircle2 className="h-3 w-3 text-success"/>}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                      <Input type="number" className="h-9 pl-6 rounded-lg font-mono text-sm"
                        value={amounts[m]||""} onChange={e=>{setAmounts(a=>({...a,[m]:e.target.value}));setDirty(true);}}/>
                    </div>
                    <Input placeholder="Note (optional)" className="h-7 rounded-lg text-xs"
                      value={notes[m]||""} onChange={e=>{setNotes(n=>({...n,[m]:e.target.value}));setDirty(true);}}/>
                  </div>
                );
              })}
            </div>
          )}

          {/* Year total */}
          <div className="rounded-xl border bg-secondary/40 px-4 py-3 flex justify-between text-sm">
            <span className="text-muted-foreground">Total annual fees ({year})</span>
            <span className="font-mono font-bold text-foreground">{fmt(totalYear)}</span>
          </div>

          {dirty && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0"/>
              You have unsaved changes. Save to update SOA for all roles in real time.
            </div>
          )}

          <div className="flex gap-3 pt-1 border-t">
            <Button onClick={()=>save.mutate()} disabled={save.isPending||!dirty} className="gap-2 rounded-xl">
              {save.isPending?<><Loader2 className="h-4 w-4 animate-spin"/>Saving…</>:<><Save className="h-4 w-4"/>Save Fee Schedule</>}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────────
const AdminFeeSchedules = () => {
  const [search,        setSearch]        = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [year,          setYear]          = useState(new Date().getFullYear());
  const [editVendor,    setEditVendor]    = useState<any>(null);
  const [bulkSection,   setBulkSection]   = useState("General");
  const [bulkRate,      setBulkRate]      = useState("");
  const [bulkApplying,  setBulkApplying]  = useState(false);
  const queryClient = useQueryClient();
  const SECTIONS = ["General","Fish","Meat","Vegetables","Dry Goods","Bolante"];

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
    ? Math.round(vendors.reduce((s: number, v: any) => s + ((v.stalls as any)?.monthly_rate || 1450), 0) / vendors.length)
    : 0;

  const handleBulkApply = async () => {
    if (!bulkRate || Number(bulkRate) <= 0) { toast.error("Enter a valid rate."); return; }
    setBulkApplying(true);
    try {
      const targets = vendors.filter((v: any) => bulkSection==="All" || (v.stalls as any)?.section === bulkSection);
      if (!targets.length) { toast.error("No vendors in selected section."); setBulkApplying(false); return; }
      const rate = Number(bulkRate);
      const upserts = targets.flatMap((v: any) => Array.from({length:12},(_,i)=>({ stall_id:v.stall_id, year, month:i+1, amount:rate, note:null })));
      const { error } = await (supabase.from("stall_fee_schedules" as any) as any).upsert(upserts, { onConflict: "stall_id,year,month" });
      if (error) throw error;
      const stallIds = targets.map((v: any) => v.stall_id).filter(Boolean);
      if (stallIds.length) await supabase.from("stalls").update({ monthly_rate: rate }).in("id", stallIds);
      toast.success(`Applied ${fmt(rate)}/month to ${targets.length} vendor${targets.length>1?"s":""} for ${year}.`);
      queryClient.invalidateQueries({ queryKey: ["all-fee-schedules", year] });
      queryClient.invalidateQueries({ queryKey: ["admin-fee-vendors"] });
      setBulkRate("");
    } catch (e: any) { toast.error(e.message); }
    finally { setBulkApplying(false); }
  };

  return (
    <div className="space-y-5">
      {editVendor && <VendorFeeEditor vendor={editVendor} year={year} onClose={() => setEditVendor(null)}/>}

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
            <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.6)"}}>Set per-month stall fees per vendor — updates SOA in real time</p>
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
          <strong className="text-foreground">How it works:</strong> Each vendor can have a different fee per month. If no schedule is set, the stall's default rate applies. Saving instantly updates the vendor's SOA and all reports.
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

      {/* ── Bulk apply ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
          <div>
            <p className="text-[13px] font-bold text-foreground">Bulk Apply Rate by Section</p>
            <p className="text-xs text-muted-foreground">Apply a single monthly rate to all vendors in a section for {year}</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Section</label>
              <select className="h-9 rounded-xl border bg-background px-3 text-sm" value={bulkSection} onChange={e=>setBulkSection(e.target.value)}>
                <option value="All">All Sections</option>
                {SECTIONS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Monthly Rate (₱)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₱</span>
                <Input type="number" placeholder="e.g. 1450" className="h-9 pl-7 rounded-xl font-mono w-36" value={bulkRate} onChange={e=>setBulkRate(e.target.value)}/>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Year</label>
              <select className="h-9 rounded-xl border bg-background px-3 text-sm" value={year} onChange={e=>setYear(Number(e.target.value))}>
                {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
              </select>
            </div>
            <Button className="gap-2 rounded-xl h-9" disabled={bulkApplying||!bulkRate} onClick={handleBulkApply}
              style={{background:"linear-gradient(135deg,#0f6e56,#1d9e75)"}}>
              {bulkApplying?<Loader2 className="h-4 w-4 animate-spin"/>:<Zap className="h-4 w-4"/>}
              Apply to {bulkSection==="All"?"All":bulkSection}
            </Button>
          </div>
          {bulkRate && Number(bulkRate) > 0 && (
            <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground">
              Will apply <strong className="text-foreground">{fmt(Number(bulkRate))}</strong>/month to{" "}
              <strong className="text-foreground">
                {bulkSection==="All"?vendors.length:vendors.filter((v:any)=>(v.stalls as any)?.section===bulkSection).length}
              </strong> vendor{vendors.length!==1?"s":""} for all 12 months of {year}.
            </div>
          )}
        </div>
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
                  {["Vendor","Stall","Section","Default Rate","Jan","Feb","Mar","Apr","May","Jun","Schedule","Action"].map(h=>(
                    <th key={h} className="px-3 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((v: any) => {
                  const st      = v.stalls as any;
                  const defRate = st?.monthly_rate || 1450;
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
                      <td className="px-3 py-3">
                        <Button size="sm" variant="outline" className="h-7 gap-1.5 rounded-lg text-xs" onClick={()=>setEditVendor(v)}>
                          <Edit3 className="h-3 w-3"/> Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length===0&&(
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                          <Store className="h-7 w-7 text-slate-400"/>
                        </div>
                        <p className="font-semibold text-foreground">No vendors found</p>
                        <p className="text-xs">Create vendor accounts first to manage their fee schedules.</p>
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