import {
  Clock, CheckCircle2, Loader2, CreditCard,
  Search, FileText, TrendingUp, AlertCircle, ArrowRight, Banknote,
  Smartphone, ChevronDown, ChevronUp, Activity, Zap,
  CalendarDays, CalendarRange, Users, Lock, Unlock, LogIn, LogOut
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell,
} from "recharts";
import { useState, useEffect } from "react";
import { getUnsyncedCount, syncOfflinePayments } from "@/lib/offlineSync";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(15, 110, 86, 0.95)",
      border: "1px solid rgba(52, 211, 153, 0.4)",
      borderRadius: 12,
      padding: "12px 16px",
      boxShadow: "0 8px 16px rgba(0,0,0,0.12)",
      backdropFilter: "blur(8px)",
    }}>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ color: "#34d399", fontWeight: 600, fontFamily: "monospace", fontSize: 14 }}>
        {fmt(payload[0].value)}
      </p>
    </div>
  );
};

const METHOD_CFG: Record<string, {
  iconBg: string; iconText: string; pillBg: string; bar: string; label: string;
}> = {
  cash: { iconBg: "bg-slate-100", iconText: "text-slate-600", pillBg: "bg-slate-50", bar: "#64748b", label: "Cash" },
  gcash: { iconBg: "bg-blue-100", iconText: "text-blue-700", pillBg: "bg-blue-50", bar: "#3b82f6", label: "GCash" },
  paymaya: { iconBg: "bg-emerald-100", iconText: "text-emerald-700", pillBg: "bg-emerald-50", bar: "#10b981", label: "Maya" },
  instapay: { iconBg: "bg-indigo-100", iconText: "text-indigo-700", pillBg: "bg-indigo-50", bar: "#6366f1", label: "Instapay" },
};

const METHOD_BADGE: Record<string, { bg: string; text: string }> = {
  cash: { bg: "bg-slate-100", text: "text-slate-700" },
  gcash: { bg: "bg-blue-100", text: "text-blue-800" },
  paymaya: { bg: "bg-emerald-100", text: "text-emerald-800" },
  instapay: { bg: "bg-indigo-100", text: "text-indigo-800" },
};

const CashierDashboardHome = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [showTransactions, setShowTransactions] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [startingCash, setStartingCash] = useState("");
  const [endingCash, setEndingCash] = useState("");
  const [shiftNotes, setShiftNotes] = useState("");
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  useEffect(() => {
    const checkOffline = async () => {
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    };
    checkOffline();
    const interval = setInterval(checkOffline, 5000);
    return () => clearInterval(interval);
  }, []);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!navigator.onLine) throw new Error("You are currently offline. Please connect to the internet to sync.");
      return await syncOfflinePayments();
    },
    onSuccess: (res) => {
      if (res.count > 0) {
        toast.success(`Successfully synced ${res.count} offline payments!`);
        queryClient.invalidateQueries({ queryKey: ["cashier-dashboard"] });
      } else {
        toast.info("No offline payments to sync or sync failed.");
      }
      setUnsyncedCount(0);
    },
    onError: (e: any) => toast.error(e.message)
  });

  const { data: activeShift, isLoading: shiftLoading } = useQuery({
    queryKey: ["active-shift", session?.user?.id],
    enabled: !!session?.user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cashier_shifts")
        .select("*")
        .eq("cashier_id", session?.user?.id)
        .eq("status", "open")
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const openShiftMutation = useMutation({
    mutationFn: async () => {
      const start = Number(startingCash);
      if (isNaN(start) || start < 0) throw new Error("Invalid starting cash");
      const { error } = await supabase.from("cashier_shifts").insert({
        cashier_id: session?.user?.id,
        starting_cash: start,
        status: "open",
        notes: shiftNotes || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift opened successfully!");
      setShowOpenShiftModal(false);
      setStartingCash("");
      setShiftNotes("");
      queryClient.invalidateQueries({ queryKey: ["active-shift"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const closeShiftMutation = useMutation({
    mutationFn: async () => {
      if (!activeShift) throw new Error("No active shift");
      const end = Number(endingCash);
      if (isNaN(end) || end < 0) throw new Error("Invalid actual ending cash");

      const { error } = await supabase.from("cashier_shifts")
        .update({
          status: "closed",
          actual_ending_cash: end,
          closed_at: new Date().toISOString(),
          notes: shiftNotes || activeShift.notes
        })
        .eq("id", activeShift.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift closed successfully!");
      setShowCloseShiftModal(false);
      setEndingCash("");
      setShiftNotes("");
      queryClient.invalidateQueries({ queryKey: ["active-shift"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cashier-dashboard"],
    refetchInterval: 15000,
    queryFn: async () => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const yearStart = `${now.getFullYear()}-01-01T00:00:00`;
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6);

      const { data: allPayments } = await supabase
        .from("payments").select("*")
        .gte("created_at", yearStart)
        .order("created_at", { ascending: false });

      const payments = allPayments || [];
      const completed = payments.filter(p => p.status === "completed");
      const pending = payments.filter(p => p.status === "pending");

      const todayPay = completed.filter(p => p.created_at?.startsWith(todayStr));
      const totalToday = todayPay.reduce((s, p) => s + Number(p.amount), 0);
      const weekPay = completed.filter(p => new Date(p.created_at) >= weekStart);
      const totalWeek = weekPay.reduce((s, p) => s + Number(p.amount), 0);
      const monthPay = completed.filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
      const totalMonth = monthPay.reduce((s, p) => s + Number(p.amount), 0);

      const weekChart: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now); d.setDate(now.getDate() - i);
        weekChart[d.toISOString().split("T")[0]] = 0;
      }
      weekPay.forEach(p => {
        const k = p.created_at?.split("T")[0];
        if (k && weekChart[k] !== undefined) weekChart[k] += Number(p.amount);
      });
      const chartData = Object.entries(weekChart).map(([date, amount], i, arr) => ({
        day: DAYS[new Date(date).getDay()], date, amount,
        isToday: i === arr.length - 1,
      }));

      const monthlyMap: Record<number, number> = {};
      MONTHS.forEach((_, i) => { monthlyMap[i] = 0; });
      completed.forEach(p => {
        const m = new Date(p.created_at).getMonth();
        monthlyMap[m] = (monthlyMap[m] || 0) + Number(p.amount);
      });
      const monthlyData = MONTHS.map((m, i) => ({ month: m, amount: monthlyMap[i] }));

      const methodBreakdown: Record<string, number> = {};
      todayPay.forEach(p => {
        methodBreakdown[p.payment_method] = (methodBreakdown[p.payment_method] || 0) + Number(p.amount);
      });

      const recent8 = payments.slice(0, 8);
      let recentList: any[] = [];
      if (recent8.length) {
        const vendorIds = [...new Set(recent8.map(p => p.vendor_id))];
        const { data: vendors } = await supabase
          .from("vendors").select("id, user_id, stalls(stall_number, section)").in("id", vendorIds);
        const userIds = vendors?.map(v => v.user_id) || [];
        const { data: profiles } = await supabase
          .from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
        recentList = recent8.map(p => {
          const v = vendors?.find(v => v.id === p.vendor_id);
          const pr = profiles?.find(pr => pr.user_id === v?.user_id);
          const st = v?.stalls as any;
          return {
            ...p,
            vendor_name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
            stall: st?.stall_number || "—",
            section: st?.section || "",
          };
        });
      }

      const { data: allVendors } = await supabase.from("vendors").select("id");
      const totalVendors = allVendors?.length || 0;
      const paidVendorIds = new Set(monthPay.map(p => p.vendor_id));
      const paidVendors = paidVendorIds.size;

      return {
        totalToday, txToday: todayPay.length,
        totalWeek, txWeek: weekPay.length,
        totalMonth, txMonth: monthPay.length,
        pendingCount: pending.length,
        chartData, monthlyData, methodBreakdown,
        recentList, totalVendors, paidVendors,
      };
    },
  });

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "#0f6e56" }}>
        <Loader2 className="h-5 w-5 animate-spin text-white" />
      </div>
      <p className="text-sm text-muted-foreground">Loading dashboard…</p>
    </div>
  );

  const d = data!;
  const today = new Date();
  const paidPct = d.totalVendors > 0 ? Math.round(d.paidVendors / d.totalVendors * 100) : 0;
  const methodTotal = Object.values(d.methodBreakdown).reduce((s, v) => s + v, 0);
  const greeting = today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening";

  return (
    <div className="space-y-3.5">
      {/* ── Shift Modals ────────────────────────────────────────────────── */}
      {showOpenShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowOpenShiftModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><Unlock className="h-5 w-5" /></div>
              <div>
                <h3 className="font-bold text-lg">Open Shift</h3>
                <p className="text-xs text-muted-foreground">Start your cashier session</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Starting Cash (Float) ₱</label>
                <Input type="number" placeholder="e.g. 500.00" value={startingCash} onChange={e => setStartingCash(e.target.value)} className="h-10 text-lg font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notes (Optional)</label>
                <Input placeholder="Any starting notes..." value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={openShiftMutation.isPending || !startingCash} onClick={() => openShiftMutation.mutate()}>
                {openShiftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open Shift"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowOpenShiftModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowCloseShiftModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600"><Lock className="h-5 w-5" /></div>
              <div>
                <h3 className="font-bold text-lg">Close Shift</h3>
                <p className="text-xs text-muted-foreground">End your cashier session</p>
              </div>
            </div>
            <div className="bg-secondary/40 p-3 rounded-xl space-y-1.5 mb-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Opened at:</span> <span className="font-medium">{new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Starting Cash:</span> <span className="font-mono">{fmt(activeShift.starting_cash)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">System Collections:</span> <span className="font-mono text-emerald-600 font-bold">{fmt(d.totalToday)}</span></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Actual Ending Cash In Drawer ₱</label>
                <Input type="number" placeholder="Count your drawer..." value={endingCash} onChange={e => setEndingCash(e.target.value)} className="h-10 text-lg font-mono" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notes (Optional)</label>
                <Input placeholder="Explanation for discrepancies..." value={shiftNotes} onChange={e => setShiftNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={closeShiftMutation.isPending || !endingCash} onClick={() => closeShiftMutation.mutate()}>
                {closeShiftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Close"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setShowCloseShiftModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Offline Sync Banner ───────────────────────────────────────────── */}
      {unsyncedCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-800">Offline Payments Pending</h3>
              <p className="text-sm text-amber-700">You have {unsyncedCount} payment(s) saved offline that need to be synced.</p>
            </div>
          </div>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !navigator.onLine}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white gap-2"
          >
            {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Sync Now
          </Button>
        </div>
      )}

      {/* ── Shift Status Banner ───────────────────────────────────────────── */}
      {!shiftLoading && !activeShift ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0"><Lock className="h-5 w-5" /></div>
            <div>
              <h3 className="font-bold text-red-800">Shift Closed</h3>
              <p className="text-sm text-red-600/80">You cannot accept payments until you open a shift.</p>
            </div>
          </div>
          <Button onClick={() => setShowOpenShiftModal(true)} className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white gap-2">
            <Unlock className="h-4 w-4" /> Open Shift Now
          </Button>
        </div>
      ) : !shiftLoading && activeShift ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><Activity className="h-5 w-5" /></div>
            <div>
              <h3 className="font-bold text-emerald-800">Shift Active</h3>
              <p className="text-xs text-emerald-600/80 mt-0.5">
                Opened at {new Date(activeShift.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Starting Cash: {fmt(activeShift.starting_cash)}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowCloseShiftModal(true)} variant="outline" className="w-full sm:w-auto border-emerald-200 text-emerald-700 hover:bg-emerald-100 gap-2">
            <Lock className="h-4 w-4" /> End Shift
          </Button>
        </div>
      ) : null}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0f6e56 0%, #0d5a47 100%)",
          boxShadow: "0 20px 48px rgba(15, 110, 86, 0.15)"
        }}>
        {[
          [200, "-60px", "-60px", "top", "right"],
          [140, "-20px", "-20px", "top", "right"],
          [250, "-100px", "-60px", "bottom", "left"],
        ].map(([sz, a, b, v, h], i) => (
          <div key={i} style={{
            position: "absolute", [v as string]: a, [h as string]: b,
            width: sz, height: sz, borderRadius: "50%",
            border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none",
          }} />
        ))}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04,
          backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }} />

        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
              style={{ color: "rgba(255,255,255,0.6)" }}>Cashier Terminal</p>
            <h1 className="text-[28px] font-bold text-white leading-tight">
              Good {greeting} 👋
            </h1>
            <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              <span className="inline-block w-1 h-1 rounded-full" style={{ background: "#34d399" }} />
              {today.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>

          <div className="rounded-2xl px-5 py-4 text-right relative backdrop-blur"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              minWidth: 165,
              boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
            }}>
            <div style={{ position: "absolute", top: 12, left: 12, width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: "rgba(255,255,255,0.6)" }}>Today's Collection</p>
            <p className="font-mono text-[24px] font-bold text-white mt-1">{fmt(d.totalToday)}</p>
            <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              {d.txToday} transaction{d.txToday !== 1 ? "s" : ""} • {((d.txToday / 10) * 100).toFixed(0)}% of target
            </p>
          </div>
        </div>

        <div className="relative mt-5 rounded-xl px-4 py-3"
          style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
              Vendor compliance progress — {MONTHS[today.getMonth()]}
            </p>
            <p className="text-[11px] font-bold text-white">
              {d.paidVendors}/{d.totalVendors} vendors paid ({paidPct}%)
            </p>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.15)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${paidPct}%`, background: "linear-gradient(90deg, #34d399 0%, #6ee7b7 100%)" }} />
          </div>
        </div>

        {d.pendingCount > 0 && (
          <Link to="/cashier/accept">
            <div className="mt-3.5 flex items-center gap-2.5 rounded-xl px-4 py-3 cursor-pointer group transition-all hover:scale-[1.02]"
              style={{ background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.35)" }}>
              <div className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: "#fbbf24" }} />
              <span className="text-xs font-medium" style={{ color: "#fef08a" }}>
                <strong className="text-sm">{d.pendingCount}</strong> pending payment{d.pendingCount > 1 ? "s" : ""} awaiting confirmation
              </span>
              <ArrowRight className="h-3.5 w-3.5 ml-auto group-hover:translate-x-1 transition-transform" style={{ color: "#fbbf24" }} />
            </div>
          </Link>
        )}
      </div>

      {/* ── KPI row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "This Week", value: fmt(d.totalWeek), sub: `${d.txWeek} transactions`,
            icon: CalendarDays, iconBg: "bg-blue-100", iconColor: "#0ea5e9",
            glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/40"
          },
          {
            label: "This Month", value: fmt(d.totalMonth), sub: `${d.txMonth} transactions`,
            icon: CalendarRange, iconBg: "bg-emerald-100", iconColor: "#10b981",
            glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/40"
          },
          {
            label: "Pending", value: String(d.pendingCount), sub: "awaiting confirm",
            icon: d.pendingCount > 0 ? Clock : CheckCircle2,
            iconBg: d.pendingCount > 0 ? "bg-amber-100" : "bg-emerald-100",
            iconColor: d.pendingCount > 0 ? "#f59e0b" : "#10b981",
            glow: d.pendingCount > 0 ? "#f59e0b" : "#10b981",
            gradient: d.pendingCount > 0 ? "from-amber-50 to-amber-50/40" : "from-emerald-50 to-emerald-50/40"
          },
        ].map((c, i) => (
          <div key={i}
            className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-md transition-all duration-300 group`}
            style={{ minHeight: 120 }}>
            <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-[0.08] blur-lg group-hover:opacity-[0.12] transition-opacity`}
              style={{ background: c.glow }} />
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{c.label}</p>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${c.iconBg} group-hover:shadow-md transition-shadow`}>
                <c.icon className="h-4.5 w-4.5" style={{ color: c.iconColor }} />
              </div>
            </div>
            <div className="z-10">
              <p className="font-mono text-[18px] font-bold text-foreground">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1 font-medium">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── 4 action buttons — single row ─────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <Link to="/cashier/accept"
          className="relative overflow-hidden flex flex-col items-center justify-center gap-2 rounded-2xl text-white font-medium group hover:shadow-lg transition-all duration-300 transform hover:scale-[1.02]"
          style={{ minHeight: 96, background: "linear-gradient(135deg, #0f6e56 0%, #0d5a47 100%)", textDecoration: "none", boxShadow: "0 12px 32px rgba(15, 110, 86, 0.2)" }}>
          <div style={{ position: "absolute", top: -25, right: -25, width: 110, height: 110, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
          <div style={{ position: "absolute", bottom: -40, left: 25, width: 85, height: 85, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
          <div className="relative z-10 h-9 w-9 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform"
            style={{ background: "rgba(255,255,255,0.2)", border: "1.5px solid rgba(255,255,255,0.3)" }}>
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="relative z-10 text-[10px] font-semibold text-white text-center leading-tight px-2 whitespace-pre-line">{"Accept\nPayment"}</span>
        </Link>

        {[
          { label: "Search\nVendor", to: "/cashier/search", icon: Search, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9" },
          { label: "Payment\nStatus", to: "/cashier/status", icon: Activity, iconBg: "bg-amber-100", iconColor: "#f59e0b", glow: "#f59e0b" },
          { label: "Print\nSOA", to: "/cashier/soa", icon: FileText, iconBg: "bg-violet-100", iconColor: "#a855f7", glow: "#a855f7" },
        ].map(a => (
          <Link key={a.to} to={a.to}
            className="relative overflow-hidden flex items-center gap-3 rounded-2xl border border-border bg-card px-5 hover:shadow-md transition-all duration-300 group hover:scale-[1.02]"
            style={{ minHeight: 96, textDecoration: "none" }}>
            <div className={`absolute -bottom-4 -right-4 w-14 h-14 rounded-full opacity-[0.06] blur-lg group-hover:opacity-[0.1] transition-opacity`} style={{ background: a.glow }} />
            <div className={`relative z-10 h-9 w-9 shrink-0 rounded-xl flex items-center justify-center group-hover:shadow-md transition-shadow ${a.iconBg}`}>
              <a.icon className="h-4.5 w-4.5" style={{ color: a.iconColor }} />
            </div>
            <span className="relative z-10 text-[12px] font-semibold text-foreground leading-tight whitespace-pre-line">
              {a.label}
            </span>
          </Link>
        ))}
      </div>

      {/* ── Payment method breakdown ───────────────────────────────────── */}
      {Object.keys(d.methodBreakdown).length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md" />
              <p className="text-[13px] font-bold text-foreground">Today's Collections by Payment Method</p>
            </div>
            <span className="text-[11px] font-semibold text-foreground px-3 py-1.5 rounded-lg" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              {fmt(methodTotal)} total
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4">
            {Object.entries(d.methodBreakdown).map(([method, amount]) => {
              const pct = methodTotal > 0 ? Math.round((amount / methodTotal) * 100) : 0;
              const cfg = METHOD_CFG[method] || { iconBg: "bg-secondary", iconText: "text-foreground", pillBg: "bg-secondary", bar: "#6b7280", label: method };
              const Icon = method === "cash" ? Banknote : Smartphone;
              return (
                <div key={method}
                  className={`group relative overflow-hidden flex flex-col rounded-xl border border-border px-4 py-3.5 transition-all duration-300 hover:shadow-md hover:scale-[1.02]`}
                  style={{ background: `linear-gradient(135deg, ${cfg.pillBg} 0%, rgba(255,255,255,0) 100%)` }}>
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center group-hover:shadow-md transition-shadow ${cfg.iconBg}`}>
                        <Icon className={`h-4 w-4 ${cfg.iconText}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold ${cfg.iconText}`}>{cfg.label}</p>
                        <p className="font-mono text-[14px] font-bold text-foreground mt-0.5 truncate">{fmt(amount)}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-muted-foreground" style={{ color: cfg.iconText }}>{pct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.bar }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Charts side by side ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">

        {/* 7-day bar chart */}
        <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-600 shadow-md" />
              <p className="text-[13px] font-bold text-foreground">Collections — Last 7 Days</p>
            </div>
            <span className="text-[11px] font-semibold text-foreground px-3 py-1.5 rounded-lg" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              {fmt(d.totalWeek)} this week
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm" style={{ background: "#34d399" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Past days</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm" style={{ background: "#0f6e56" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Today</span>
            </div>
          </div>

          <div className="relative">
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <linearGradient id="barGradient7DayPast" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#34d399", stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: "#1f9e74", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#10b981", stopOpacity: 0.8 }} />
                </linearGradient>
                <linearGradient id="barGradient7DayToday" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#0f6e56", stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: "#065f46", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#0d4a3d", stopOpacity: 0.9 }} />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 pointer-events-none" style={{
              background: "url('data:image/svg+xml,%3Csvg width=%2720%27 height=%2720%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%271%27 fill=%27%23d1fae5%27 opacity=%270.3%27/%3E%3C/svg%3E')",
              backgroundSize: "20px 20px"
            }} />

            <div className="relative px-4 py-3" style={{ background: "rgba(240, 253, 250, 0.3)" }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.chartData} barSize={24} margin={{ top: 16, right: 16, left: -8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(220,10%,55%)", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(220,10%,55%)", fontWeight: 500 }}
                    tickFormatter={v => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
                    axisLine={false} tickLine={false} width={50}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
                  <Bar dataKey="amount" radius={[10, 10, 0, 0]} isAnimationActive={true}>
                    {d.chartData.map((entry: any, i: number) => (
                      <Cell
                        key={i}
                        fill={entry.isToday ? "url(#barGradient7DayToday)" : "url(#barGradient7DayPast)"}
                        opacity={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 pb-4 border-t">
            {[
              { label: "Daily Avg", value: fmt(Math.round(d.totalWeek / 7)) },
              { label: "Peak Day", value: fmt(Math.max(...d.chartData.map((c: any) => c.amount))) },
              { label: "Growth", value: "+12.5%" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center pt-3 px-2 gap-1.5 rounded-lg hover:bg-secondary/40 transition-colors">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="font-mono text-[12px] font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly chart */}
        <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-600 shadow-md" />
              <p className="text-[13px] font-bold text-foreground">Collections — {today.getFullYear()} Monthly</p>
            </div>
            <span className="text-[11px] font-semibold text-foreground px-3 py-1.5 rounded-lg" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              {fmt(d.totalMonth)} this month
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 px-5 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm" style={{ background: "#34d399" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Past months</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-sm" style={{ background: "#0f6e56" }} />
              <span className="text-[11px] font-medium text-muted-foreground">Current month</span>
            </div>
          </div>

          <div className="relative">
            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
              <defs>
                <linearGradient id="barGradientMonthlyPast" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#34d399", stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: "#1f9e74", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#10b981", stopOpacity: 0.8 }} />
                </linearGradient>
                <linearGradient id="barGradientMonthlyCurrent" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" style={{ stopColor: "#0f6e56", stopOpacity: 1 }} />
                  <stop offset="50%" style={{ stopColor: "#065f46", stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: "#0d4a3d", stopOpacity: 0.9 }} />
                </linearGradient>
              </defs>
            </svg>

            <div className="absolute inset-0 pointer-events-none" style={{
              background: "url('data:image/svg+xml,%3Csvg width=%2720%27 height=%2720%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Ccircle cx=%2710%27 cy=%2710%27 r=%271%27 fill=%27%23d1fae5%27 opacity=%270.3%27/%3E%3C/svg%3E')",
              backgroundSize: "20px 20px"
            }} />

            <div className="relative px-4 py-3" style={{ background: "rgba(240, 253, 250, 0.3)" }}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={d.monthlyData} barSize={16} margin={{ top: 16, right: 16, left: -8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220,10%,55%)", fontWeight: 500 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(220,10%,55%)", fontWeight: 500 }}
                    tickFormatter={v => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`}
                    axisLine={false} tickLine={false} width={50}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
                  <Bar dataKey="amount" radius={[10, 10, 0, 0]} isAnimationActive={true}>
                    {d.monthlyData.map((entry: any, i: number) => (
                      <Cell
                        key={i}
                        fill={i === today.getMonth() ? "url(#barGradientMonthlyCurrent)" : "url(#barGradientMonthlyPast)"}
                        opacity={1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 pb-4 border-t">
            {[
              { label: "Best Month", value: fmt(Math.max(...d.monthlyData.map((c: any) => c.amount))) },
              { label: "Avg/Month", value: fmt(Math.round(d.monthlyData.filter((c: any) => c.amount > 0).reduce((s: number, c: any) => s + c.amount, 0) / Math.max(1, d.monthlyData.filter((c: any) => c.amount > 0).length))) },
              { label: "This Month", value: fmt(d.totalMonth) }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center pt-3 px-2 gap-1.5 rounded-lg hover:bg-secondary/40 transition-colors">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="font-mono text-[12px] font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Recent Transactions — collapsible, 3 items ────────────────── */}
      <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
        {/*
          FIX: was <button> wrapping a <Link><button>, which is invalid HTML.
          Changed outer element to <div> with onClick + cursor-pointer.
          "View all" Link is styled directly — no inner <button> child.
        */}
        <div
          onClick={() => setShowTransactions(v => !v)}
          className="flex items-center justify-between w-full px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent hover:bg-secondary/40 transition-colors cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md" />
            <h3 className="text-[13px] font-bold text-foreground">Recent Transactions</h3>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}>
              {d.recentList.length > 0
                ? showTransactions
                  ? `Showing 3 of ${d.recentList.length}`
                  : `${d.recentList.length} recent transactions — tap to expand`
                : "No transactions"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/cashier/status"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition-all hover:shadow-md group"
              style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981", border: "1px solid rgba(16, 185, 129, 0.2)", textDecoration: "none" }}
            >
              View all <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
            {showTransactions
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {showTransactions && (
          d.recentList.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="divide-y">
                <div className="hidden md:grid grid-cols-[50px_1fr_120px_120px_100px_80px] gap-4 px-5 py-3 bg-secondary/30 items-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <div>Status</div>
                  <div>Vendor & Details</div>
                  <div>Method</div>
                  <div>Amount</div>
                  <div>Date</div>
                  <div>Action</div>
                </div>

                {d.recentList.slice(0, 3).map((r: any, idx: number) => {
                  const isCompleted = r.status === "completed";
                  const isPending = r.status === "pending";
                  const initials = r.vendor_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  const badgeCfg = METHOD_BADGE[r.payment_method] || { bg: "bg-secondary", text: "text-foreground" };
                  const methodLabel = METHOD_CFG[r.payment_method]?.label || r.payment_method;
                  const txDate = new Date(r.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

                  return (
                    <div key={r.id} className="hidden md:grid grid-cols-[50px_1fr_120px_120px_100px_80px] gap-4 px-5 py-3.5 items-center hover:bg-secondary/40 transition-colors group border-t border-border/50">
                      <div className="flex justify-center">
                        <div className="relative">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${isCompleted ? "bg-emerald-100 text-emerald-700"
                            : isPending ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-red-700"
                            }`}>
                            {initials}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isCompleted ? "bg-emerald-500 shadow-md"
                            : isPending ? "bg-amber-400 animate-pulse"
                              : "bg-red-500"
                            }`} />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="text-[12px] font-bold text-foreground truncate">{r.vendor_name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <span>Stall {r.stall}</span>
                          <span>•</span>
                          <span>{r.section}</span>
                        </p>
                      </div>

                      <div>
                        <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-lg ${badgeCfg.bg} ${badgeCfg.text}`}>
                          {methodLabel}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className="font-mono text-[13px] font-bold text-foreground">{fmt(Number(r.amount))}</p>
                      </div>

                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground">{txDate}</p>
                      </div>

                      <div className="text-center">
                        <span className={`inline-flex items-center text-[9px] font-bold px-2 py-1 rounded-full transition-all ${isCompleted ? "bg-emerald-50 text-emerald-700"
                          : isPending ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-600"
                          }`}>
                          {isCompleted ? "✓ Completed" : isPending ? "⏱ Pending" : "✗ Failed"}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {d.recentList.slice(0, 3).map((r: any) => {
                  const isCompleted = r.status === "completed";
                  const isPending = r.status === "pending";
                  const initials = r.vendor_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  const badgeCfg = METHOD_BADGE[r.payment_method] || { bg: "bg-secondary", text: "text-foreground" };
                  const methodLabel = METHOD_CFG[r.payment_method]?.label || r.payment_method;

                  return (
                    <div key={r.id} className="md:hidden flex items-start gap-3.5 px-4 py-3.5 hover:bg-secondary/40 transition-colors border-t">
                      <div className="relative shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center text-[11px] font-bold ${isCompleted ? "bg-emerald-100 text-emerald-700"
                          : isPending ? "bg-amber-100 text-amber-700"
                            : "bg-red-100 text-red-700"
                          }`}>
                          {initials}
                        </div>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${isCompleted ? "bg-emerald-500 shadow-md"
                          : isPending ? "bg-amber-400 animate-pulse"
                            : "bg-red-500"
                          }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="min-w-0">
                            <p className="text-[12px] font-bold text-foreground truncate">{r.vendor_name}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">Stall {r.stall} · {r.section}</p>
                          </div>
                          <p className="font-mono text-[12px] font-bold text-foreground shrink-0">{fmt(Number(r.amount))}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-lg ${badgeCfg.bg} ${badgeCfg.text}`}>
                            {methodLabel}
                          </span>
                          <span className={`inline-flex items-center text-[9px] font-bold px-2 py-0.5 rounded-full ${isCompleted ? "bg-emerald-50 text-emerald-700"
                            : isPending ? "bg-amber-50 text-amber-700"
                              : "bg-red-50 text-red-600"
                            }`}>
                            {isCompleted ? "Completed" : isPending ? "Pending" : "Failed"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-[13px] font-medium text-muted-foreground">No transactions yet</p>
              <p className="text-[12px] text-muted-foreground/60 text-center px-4">Processed payments will appear here in real-time</p>
            </div>
          )
        )}
      </div>

    </div>
  );
};

export default CashierDashboardHome;