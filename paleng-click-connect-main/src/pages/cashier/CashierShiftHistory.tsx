import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, CalendarRange, Clock, DollarSign, Activity, FileText, CheckCircle2, ChevronRight, AlertCircle, TrendingDown, TrendingUp
} from "lucide-react";

const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const CashierShiftHistory = () => {
  const { session } = useAuth();
  const [selectedShift, setSelectedShift] = useState<any>(null);

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["cashier-shifts-history"],
    queryFn: async () => {
      // 1. Fetch all shifts
      const { data: shiftsData, error: shiftsError } = await supabase
        .from("cashier_shifts")
        .select(`*`)
        .order("opened_at", { ascending: false });

      if (shiftsError) throw shiftsError;
      if (!shiftsData || shiftsData.length === 0) return [];

      const shiftIds = shiftsData.map((s: any) => s.id);
      const cashierIds = [...new Set(shiftsData.map((s: any) => s.cashier_id))];

      // 2. Fetch payments for all these shifts to compute system cash
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("id, amount, shift_id")
        .in("shift_id", shiftIds);

      if (paymentsError) console.error("Error fetching payments for shifts:", paymentsError);

      // 3. Fetch cashier profiles to display their names
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", cashierIds);

      return shiftsData.map((shift: any) => {
        const shiftPayments = paymentsData?.filter((p: any) => p.shift_id === shift.id) || [];
        const system_computed_cash = shiftPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        const profile = profilesData?.find((p: any) => p.user_id === shift.cashier_id);
        const cashier_name = profile ? `${profile.first_name} ${profile.last_name}` : "Unknown Cashier";

        return {
          ...shift,
          cashier_name,
          system_computed_cash,
          discrepancy: shift.actual_ending_cash !== null ? shift.actual_ending_cash - (shift.starting_cash + system_computed_cash) : 0
        };
      });
    }
  });

  return (
    <div className="space-y-5">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)", boxShadow: "0 20px 48px rgba(15,110,86,0.15)" }}>
        {[[200, "-60px", "-60px", "top", "right"], [250, "-100px", "-60px", "bottom", "left"]].map(([sz, a, b, v, h], i) => (
          <div key={i} style={{ position: "absolute", [v as string]: a, [h as string]: b, width: sz, height: sz, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        ))}
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 border border-white/20">
            <CalendarRange className="h-6 w-6 text-emerald-100" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Shift History & Reconciliation</h1>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>View your past shifts, float amounts, and cash drawer reconciliations</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Column: Shift List */}
        <div className="md:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm border rounded-2xl bg-card">No shift history found.</div>
          ) : (
            shifts.map((shift: any) => {
              const isSelected = selectedShift?.id === shift.id;
              const isClosed = shift.status === "closed";
              const openDate = new Date(shift.opened_at);
              return (
                <div
                  key={shift.id}
                  onClick={() => setSelectedShift(shift)}
                  className={`cursor-pointer rounded-2xl border p-4 transition-all ${isSelected ? "bg-emerald-50 border-emerald-300 shadow-md" : "bg-card hover:bg-slate-50 border-slate-200"
                    }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className={`text-sm font-bold ${isSelected ? "text-emerald-800" : "text-foreground"}`}>
                        {openDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> {openDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-1">•</span>
                        <span className="truncate max-w-[100px]">{shift.cashier_name}</span>
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${isClosed ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700 animate-pulse"
                      }`}>
                      {shift.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Collected</p>
                      <p className="font-mono font-semibold text-foreground">{fmt(shift.system_computed_cash)}</p>
                    </div>
                    {isClosed && (
                      <div className="text-right">
                        <p className="text-muted-foreground">Discrepancy</p>
                        <p className={`font-mono font-bold ${shift.discrepancy === 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {shift.discrepancy > 0 ? "+" : ""}{fmt(shift.discrepancy)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Shift Details */}
        <div className="md:col-span-2">
          {selectedShift ? (
            <div className="rounded-2xl border bg-card shadow-sm overflow-hidden sticky top-24">
              <div className="border-b bg-slate-50 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground">Shift Details</h3>
                  <p className="text-xs text-muted-foreground">ID: {selectedShift.id} • Cashier: {selectedShift.cashier_name}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${selectedShift.status === "closed" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"
                  }`}>
                  {selectedShift.status === "closed" ? "CLOSED SHIFT" : "ACTIVE SHIFT"}
                </span>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Opened At</p>
                    <p className="font-medium text-sm">{new Date(selectedShift.opened_at).toLocaleString("en-PH")}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Closed At</p>
                    <p className="font-medium text-sm">{selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleString("en-PH") : "—"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 grid grid-cols-2 gap-y-4 gap-x-8">
                  <div>
                    <p className="text-xs text-emerald-600/80 font-medium mb-1">Starting Cash (Float)</p>
                    <p className="font-mono text-xl font-bold text-emerald-900">{fmt(selectedShift.starting_cash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600/80 font-medium mb-1">System Collected</p>
                    <p className="font-mono text-xl font-bold text-emerald-900">+ {fmt(selectedShift.system_computed_cash)}</p>
                  </div>
                  <div className="col-span-2 border-t border-emerald-200/60 pt-4">
                    <p className="text-xs text-emerald-600/80 font-medium mb-1">Expected Total in Drawer</p>
                    <p className="font-mono text-2xl font-bold text-emerald-700">{fmt(selectedShift.starting_cash + selectedShift.system_computed_cash)}</p>
                  </div>
                </div>

                {selectedShift.status === "closed" ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 border p-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Actual Cash Counted</p>
                        <p className="font-mono text-xl font-bold text-foreground">{fmt(selectedShift.actual_ending_cash)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Discrepancy</p>
                        <div className={`flex items-center justify-end gap-1 font-mono text-lg font-bold ${selectedShift.discrepancy === 0 ? "text-emerald-600" : "text-red-600"
                          }`}>
                          {selectedShift.discrepancy === 0 ? <CheckCircle2 className="h-5 w-5" /> :
                            selectedShift.discrepancy > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                          {selectedShift.discrepancy > 0 ? "+" : ""}{fmt(selectedShift.discrepancy)}
                        </div>
                      </div>
                    </div>
                    {selectedShift.notes && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Notes</p>
                        <p className="text-sm text-amber-900/80">{selectedShift.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
                    <Activity className="h-8 w-8 text-slate-400 mb-2 animate-pulse" />
                    <p className="font-semibold text-slate-700">Shift is currently active</p>
                    <p className="text-xs text-slate-500 mt-1">Close the shift from the dashboard to perform final cash reconciliation.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card h-full min-h-[400px] flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-10 w-10 text-slate-200 mb-3" />
              <p className="font-medium">Select a shift to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashierShiftHistory;
