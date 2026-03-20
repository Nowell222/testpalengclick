import { useState, useEffect } from "react";
import {
  Loader2, Search, Save, RefreshCw, CheckCircle2,
  Store, DollarSign, Edit3, X, AlertCircle, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// ─── Helper: get fee for a specific month (schedule or fallback to stall rate) ──
export const getMonthFee = (schedules: any[], month: number, year: number, defaultRate: number): number => {
  const s = schedules.find(s => s.month === month && s.year === year);
  return s ? Number(s.amount) : defaultRate;
};

// ─── Fetch all schedule rows for a stall/year ────────────────────────────────────
const useFeeSchedule = (stallId: string | null, year: number) => useQuery({
  queryKey: ["fee-schedule", stallId, year],
  enabled: !!stallId,
  queryFn: async () => {
    const { data } = await supabase
      .from("stall_fee_schedules" as any)
      .select("*")
      .eq("stall_id", stallId!)
      .eq("year", year);
    return (data || []) as any[];
  },
});

// ─── Editor for one vendor ────────────────────────────────────────────────────────
const VendorFeeEditor = ({ vendor, year, onClose }: { vendor: any; year: number; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const stall       = vendor.stalls as any;
  const defaultRate = stall?.monthly_rate || 1450;

  const { data: schedules = [], isLoading } = useFeeSchedule(vendor.stall_id, year);

  // Local state: 12 month amounts
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [notes,   setNotes]   = useState<Record<number, string>>({});
  const [dirty,   setDirty]   = useState(false);

  // Initialize from schedules or default
  useEffect(() => {
    const a: Record<number,string> = {};
    const n: Record<number,string> = {};
    MONTHS.forEach((_, i) => {
      const m   = i + 1;
      const row = schedules.find(s => s.month === m);
      a[m] = row ? String(row.amount) : String(defaultRate);
      n[m] = row?.note || "";
    });
    setAmounts(a);
    setNotes(n);
    setDirty(false);
  }, [schedules, defaultRate]);

  const applyToAll = (val: string) => {
    const a: Record<number,string> = {};
    MONTHS.forEach((_,i) => { a[i+1] = val; });
    setAmounts(a);
    setDirty(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const upserts = MONTHS.map((_, i) => {
        const m = i + 1;
        return { stall_id: vendor.stall_id, year, month: m, amount: Number(amounts[m]) || defaultRate, note: notes[m] || null };
      });
      const { error } = await (supabase.from("stall_fee_schedules" as any) as any)
        .upsert(upserts, { onConflict: "stall_id,year,month" });
      if (error) throw error;

      // Also update stalls.monthly_rate to the most common/Jan value so fallback is sensible
      const janAmt = Number(amounts[1]) || defaultRate;
      await supabase.from("stalls").update({ monthly_rate: janAmt }).eq("id", vendor.stall_id);
    },
    onSuccess: () => {
      toast.success("Fee schedule saved!");
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["fee-schedule", vendor.stall_id, year] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-statement"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-pay-info"] });
      queryClient.invalidateQueries({ queryKey: ["cashier-soa"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalYear = MONTHS.reduce((s, _, i) => s + (Number(amounts[i+1]) || 0), 0);
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between border-b bg-secondary/40 px-6 py-4 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-foreground">{vendor.vendor_name}</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stall <span className="font-mono">{stall?.stall_number}</span> · {stall?.section} · Fee schedule for {year}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Quick set all */}
          <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 p-3">
            <DollarSign className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground flex-1">Set same rate for all months:</p>
            <div className="flex gap-2">
              {[1450, 1500, 1600, 1800].map(v => (
                <button key={v} onClick={() => applyToAll(String(v))}
                  className="rounded-lg border px-2.5 py-1 text-xs font-mono text-muted-foreground hover:bg-card hover:text-foreground transition-colors">
                  ₱{v.toLocaleString()}
                </button>
              ))}
              <Input
                type="number"
                placeholder="Custom"
                className="h-7 w-24 rounded-lg text-xs"
                onKeyDown={e => { if (e.key === "Enter") applyToAll((e.target as HTMLInputElement).value); }}
                onBlur={e => { if (e.target.value) applyToAll(e.target.value); }}
              />
            </div>
          </div>

          {/* Month grid */}
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {MONTHS.map((month, i) => {
                const m          = i + 1;
                const isCurrent  = m === currentMonth && year === new Date().getFullYear();
                const isPast     = m < currentMonth && year <= new Date().getFullYear();
                const hasSchedule = schedules.some(s => s.month === m);

                return (
                  <div key={m}
                    className={`rounded-xl border p-3 space-y-2 ${isCurrent ? "border-primary/40 bg-primary/5" : isPast ? "bg-secondary/30" : "bg-card"}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs font-semibold ${isCurrent ? "text-primary" : "text-foreground"}`}>
                        {month}
                        {isCurrent && <span className="ml-1 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">Current</span>}
                      </p>
                      {hasSchedule && <CheckCircle2 className="h-3 w-3 text-success" />}
                    </div>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                      <Input
                        type="number"
                        className="h-9 pl-6 rounded-lg font-mono text-sm"
                        value={amounts[m] || ""}
                        onChange={e => { setAmounts(a => ({ ...a, [m]: e.target.value })); setDirty(true); }}
                      />
                    </div>
                    <Input
                      placeholder="Note (optional)"
                      className="h-7 rounded-lg text-xs"
                      value={notes[m] || ""}
                      onChange={e => { setNotes(n => ({ ...n, [m]: e.target.value })); setDirty(true); }}
                    />
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
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              You have unsaved changes. Save to update SOA for all roles in real time.
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1 border-t">
            <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty} className="gap-2 rounded-xl">
              {save.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save Fee Schedule</>}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const AdminFeeSchedules = () => {
  const [search,       setSearch]       = useState("");
  const [filterSection,setFilterSection]= useState("all");
  const [year,         setYear]         = useState(new Date().getFullYear());
  const [editVendor,   setEditVendor]   = useState<any>(null);
  const queryClient                     = useQueryClient();

  const SECTIONS = ["General","Fish","Meat","Vegetables","Dry Goods","Bolante"];

  const { data: vendors = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-fee-vendors"],
    queryFn: async () => {
      const { data: vList } = await supabase
        .from("vendors")
        .select("id, user_id, stall_id, stalls(stall_number, section, monthly_rate, status)")
        .not("stall_id", "is", null);

      if (!vList) return [];
      const userIds = vList.map(v => v.user_id);
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);

      return vList.map(v => {
        const pr = profiles?.find(p => p.user_id === v.user_id);
        return { ...v, vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown" };
      });
    },
  });

  // Fetch all schedules for the selected year (for preview)
  const { data: allSchedules = [] } = useQuery({
    queryKey: ["all-fee-schedules", year],
    queryFn: async () => {
      const { data } = await (supabase.from("stall_fee_schedules" as any) as any)
        .select("*").eq("year", year);
      return (data || []) as any[];
    },
  });

  const filtered = vendors.filter((v: any) => {
    const st = v.stalls as any;
    const matchSearch  = !search || v.vendor_name.toLowerCase().includes(search.toLowerCase()) || (st?.stall_number||"").toLowerCase().includes(search.toLowerCase());
    const matchSection = filterSection === "all" || st?.section === filterSection;
    return matchSearch && matchSection;
  });

  return (
    <div className="space-y-6">
      {editVendor && <VendorFeeEditor vendor={editVendor} year={year} onClose={() => setEditVendor(null)} />}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fee Schedules</h1>
          <p className="text-sm text-muted-foreground">
            Set per-month stall fees per vendor. Changes update SOA for all roles in real time.
          </p>
        </div>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm flex items-start gap-2">
        <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-muted-foreground">
          <strong className="text-foreground">How it works:</strong> Each vendor can have a different fee per month.
          If no schedule is set for a month, the stall's default monthly rate is used.
          Saving a schedule instantly updates the vendor's SOA, the cashier's SOA view, and all reports.
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search vendor or stall…" className="h-10 pl-10 rounded-xl"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm"
          value={filterSection} onChange={e => setFilterSection(e.target.value)}>
          <option value="all">All Sections</option>
          {SECTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm"
          value={year} onChange={e => setYear(Number(e.target.value))}>
          {[2024,2025,2026,2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">{filtered.length}</strong> vendors · Year {year}
      </p>

      {/* Vendor list */}
      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  {["Vendor","Stall","Section","Default Rate",...MONTHS.slice(0,6),"...","Action"].map(h => (
                    <th key={h} className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((v: any) => {
                  const st      = v.stalls as any;
                  const defRate = st?.monthly_rate || 1450;
                  const vendorSchedules = allSchedules.filter((s: any) => s.stall_id === v.stall_id);
                  const hasAnySchedule  = vendorSchedules.length > 0;

                  return (
                    <tr key={v.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-foreground">{v.vendor_name}</p>
                      </td>
                      <td className="px-3 py-3 font-mono text-foreground">{st?.stall_number || "—"}</td>
                      <td className="px-3 py-3 text-muted-foreground">{st?.section}</td>
                      <td className="px-3 py-3 font-mono text-muted-foreground">{fmt(defRate)}</td>
                      {/* Preview first 6 months */}
                      {[1,2,3,4,5,6].map(m => {
                        const sched = vendorSchedules.find((s: any) => s.month === m);
                        const amt   = sched ? Number(sched.amount) : defRate;
                        const isCustom = !!sched && sched.amount !== defRate;
                        return (
                          <td key={m} className="px-3 py-3">
                            <span className={`font-mono text-xs ${isCustom ? "text-primary font-bold" : "text-muted-foreground"}`}>
                              ₱{amt.toLocaleString()}
                            </span>
                          </td>
                        );
                      })}
                      <td className="px-3 py-3">
                        {hasAnySchedule ? (
                          <span className="text-xs text-primary font-medium">Custom</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Default</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Button size="sm" variant="outline"
                          className="h-7 gap-1.5 rounded-lg text-xs"
                          onClick={() => setEditVendor(v)}>
                          <Edit3 className="h-3 w-3" /> Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                    No vendors found. Create vendor accounts first.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeeSchedules;