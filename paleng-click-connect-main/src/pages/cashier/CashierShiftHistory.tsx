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
    <div className="space-y-4">
      {/* ── Executive Header Banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 12px 32px rgba(15,110,86,0.12)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Cashier Terminal</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-100">Audit & Float</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Shift History & Cash Drawer Reconciliation</h1>
            <p className="text-xs text-white/70 mt-0.5">Review drawer balances, starting floats, and cashier reconciliations</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Column: Shift List */}
        <div className="md:col-span-1 space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs border rounded-2xl bg-card">No shift history found.</div>
          ) : (
            shifts.map((shift: any) => {
              const isSelected = selectedShift?.id === shift.id;
              const isClosed = shift.status === "closed";
              const openDate = new Date(shift.opened_at);
              return (
                <div
                  key={shift.id}
                  onClick={() => setSelectedShift(shift)}
                  className={`cursor-pointer rounded-xl border p-3 transition-all ${isSelected ? "bg-emerald-50 border-emerald-300 shadow-xs" : "bg-card hover:bg-slate-50 border-border"
                    }`}
                >
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <p className={`text-xs font-bold ${isSelected ? "text-emerald-800" : "text-foreground"}`}>
                        {openDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3" /> {openDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        <span className="mx-1">•</span>
                        <span className="truncate max-w-[100px]">{shift.cashier_name}</span>
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${isClosed ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700 animate-pulse"
                      }`}>
                      {shift.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Collected</p>
                      <p className="font-mono font-semibold text-foreground text-xs">{fmt(shift.system_computed_cash)}</p>
                    </div>
                    {isClosed && (
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Discrepancy</p>
                        <p className={`font-mono font-bold text-xs ${shift.discrepancy === 0 ? "text-emerald-600" : "text-red-600"}`}>
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
            <div className="rounded-2xl border bg-card shadow-xs overflow-hidden sticky top-24">
              <div className="border-b bg-gradient-to-r from-emerald-50/50 to-transparent px-4 py-3 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-foreground text-xs">Shift Details</h3>
                  <p className="text-[10px] text-muted-foreground">ID: {selectedShift.id} • Cashier: {selectedShift.cashier_name}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${selectedShift.status === "closed" ? "bg-slate-200 text-slate-700" : "bg-amber-100 text-amber-700"
                  }`}>
                  {selectedShift.status === "closed" ? "CLOSED SHIFT" : "ACTIVE SHIFT"}
                </span>
              </div>

              <div className="p-4 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Opened At</p>
                    <p className="font-medium text-xs">{new Date(selectedShift.opened_at).toLocaleString("en-PH")}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Closed At</p>
                    <p className="font-medium text-xs">{selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleString("en-PH") : "—"}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 grid grid-cols-2 gap-y-3 gap-x-6">
                  <div>
                    <p className="text-[10px] text-emerald-600/80 font-medium mb-0.5">Starting Cash (Float)</p>
                    <p className="font-mono text-base font-bold text-emerald-900">{fmt(selectedShift.starting_cash)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600/80 font-medium mb-0.5">System Collected</p>
                    <p className="font-mono text-base font-bold text-emerald-900">+ {fmt(selectedShift.system_computed_cash)}</p>
                  </div>
                  <div className="col-span-2 border-t border-emerald-200/60 pt-3">
                    <p className="text-[10px] text-emerald-600/80 font-medium mb-0.5">Expected Total in Drawer</p>
                    <p className="font-mono text-lg font-bold text-emerald-700">{fmt(selectedShift.starting_cash + selectedShift.system_computed_cash)}</p>
                  </div>
                </div>

                {selectedShift.status === "closed" ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 border p-3">
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Actual Cash Counted</p>
                        <p className="font-mono text-base font-bold text-foreground">{fmt(selectedShift.actual_ending_cash)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-medium text-muted-foreground mb-0.5">Discrepancy</p>
                        <div className={`flex items-center justify-end gap-1 font-mono text-base font-bold ${selectedShift.discrepancy === 0 ? "text-emerald-600" : "text-red-600"
                          }`}>
                          {selectedShift.discrepancy === 0 ? <CheckCircle2 className="h-4 w-4" /> :
                            selectedShift.discrepancy > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          {selectedShift.discrepancy > 0 ? "+" : ""}{fmt(selectedShift.discrepancy)}
                        </div>
                      </div>
                    </div>
                    {selectedShift.notes && (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                        <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-0.5 flex items-center gap-1.5"><FileText className="h-3 w-3" /> Notes</p>
                        <p className="text-xs text-amber-900/80">{selectedShift.notes}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 flex flex-col items-center justify-center text-center">
                    <Activity className="h-6 w-6 text-slate-400 mb-1.5 animate-pulse" />
                    <p className="font-semibold text-xs text-slate-700">Shift is currently active</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Close the shift from the dashboard to perform final cash reconciliation.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card h-full min-h-[300px] flex flex-col items-center justify-center text-muted-foreground">
              <FileText className="h-8 w-8 text-slate-300 mb-2" />
              <p className="font-medium text-xs">Select a shift on the left to view reconciliation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashierShiftHistory;
