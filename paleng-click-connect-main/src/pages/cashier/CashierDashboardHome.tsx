import {
  Clock, CheckCircle2, Loader2, CreditCard,
  Search, FileText, ArrowRight, Banknote,
  Smartphone, Activity, Zap, CalendarDays, CalendarRange,
  Lock, Unlock, ChevronRight,
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
      padding: "10px 14px",
      boxShadow: "0 8px 16px rgba(0,0,0,0.12)",
    }}>
      <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginBottom: 4, fontWeight: 500 }}>{label}</p>
      <p style={{ color: "#34d399", fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>
        {fmt(payload[0].value)}
      </p>
    </div>
  );
};

const METHOD_CFG: Record<string, { iconBg: string; iconText: string; pillBg: string; bar: string; label: string }> = {
  cash: { iconBg: "bg-slate-100", iconText: "text-slate-600", pillBg: "bg-slate-50", bar: "#64748b", label: "Cash" },
  gcash: { iconBg: "bg-blue-100", iconText: "text-blue-700", pillBg: "bg-blue-50", bar: "#3b82f6", label: "GCash" },
  paymaya: { iconBg: "bg-emerald-100", iconText: "text-emerald-700", pillBg: "bg-emerald-50", bar: "#10b981", label: "Maya" },
  instapay: { iconBg: "bg-indigo-100", iconText: "text-indigo-700", pillBg: "bg-indigo-50", bar: "#6366f1", label: "Instapay" },
};

const CashierDashboardHome = () => {
  const { session } = useAuth();
  const queryClient = useQueryClient();
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

      const recent8 = payments.slice(0, 5);
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
      <p className="text-sm text-muted-foreground">Loading cashier dashboard…</p>
    </div>
  );

  const d = data!;
  const today = new Date();
  const paidPct = d.totalVendors > 0 ? Math.round(d.paidVendors / d.totalVendors * 100) : 0;
  const methodTotal = Object.values(d.methodBreakdown).reduce((s, v) => s + v, 0);
  const greeting = today.getHours() < 12 ? "morning" : today.getHours() < 17 ? "afternoon" : "evening";

  return (
    <div className="space-y-4">
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

      {/* ── Compact Shift & Offline Alert Bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border rounded-2xl p-3 shadow-xs">
        <div className="flex items-center gap-3">
          {!shiftLoading && !activeShift ? (
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl">
              <Lock className="h-4 w-4" /> Shift Closed
            </div>
          ) : !shiftLoading && activeShift ? (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <Activity className="h-4 w-4 text-emerald-600 animate-pulse" />
              <span>Shift Active (Float: {fmt(activeShift.starting_cash)})</span>
            </div>
          ) : null}

          {unsyncedCount > 0 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl">
              <Zap className="h-4 w-4 text-amber-600" />
              <span>{unsyncedCount} offline payment(s) pending</span>
              <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending || !navigator.onLine} className="ml-1 text-[11px] underline font-bold hover:text-amber-900">
                Sync Now
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {!shiftLoading && !activeShift ? (
            <Button size="sm" onClick={() => setShowOpenShiftModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs rounded-xl">
              <Unlock className="h-3.5 w-3.5" /> Open Shift
            </Button>
          ) : !shiftLoading && activeShift ? (
            <Button size="sm" onClick={() => setShowCloseShiftModal(true)} variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50 gap-1.5 h-8 text-xs rounded-xl">
              <Lock className="h-3.5 w-3.5" /> End Shift
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Executive Header Banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 12px 32px rgba(15,110,86,0.12)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Cashier Terminal</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-100">{today.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Good {greeting}, Cashier 👋</h1>
            <p className="text-xs text-white/70 mt-0.5">Collect stall fees, verify payment status, and issue receipts</p>
          </div>

          <div className="flex items-center gap-3">
            {d.pendingCount > 0 && (
              <Link to="/cashier/accept" className="no-underline">
                <div className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold bg-amber-400/20 border border-amber-300/40 text-amber-200 hover:bg-amber-400/30 transition-all">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>{d.pendingCount} Pending Payment{d.pendingCount > 1 ? "s" : ""}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-amber-300" />
                </div>
              </Link>
            )}

            <div className="rounded-xl px-4 py-2.5 text-right bg-white/10 border border-white/20 shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">Today's Collection</p>
              <p className="font-mono text-lg font-bold text-white leading-none mt-0.5">{fmt(d.totalToday)}</p>
              <p className="text-[10px] text-emerald-100/70 mt-0.5">{d.txToday} txs</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 4 Top KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Today's Collection", value: fmt(d.totalToday), sub: `${d.txToday} transaction${d.txToday !== 1 ? "s" : ""}`, icon: Activity, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30" },
          { label: "This Week", value: fmt(d.totalWeek), sub: `${d.txWeek} transactions`, icon: CalendarDays, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/30" },
          { label: "This Month", value: fmt(d.totalMonth), sub: `${d.txMonth} transactions`, icon: CalendarRange, iconBg: "bg-violet-100", iconColor: "#a855f7", glow: "#a855f7", gradient: "from-violet-50 to-violet-50/30" },
          { label: "Pending Confirm", value: String(d.pendingCount), sub: d.pendingCount > 0 ? "Awaiting processing" : "All clear ✓", icon: d.pendingCount > 0 ? Clock : CheckCircle2, iconBg: d.pendingCount > 0 ? "bg-amber-100" : "bg-emerald-100", iconColor: d.pendingCount > 0 ? "#f59e0b" : "#10b981", glow: d.pendingCount > 0 ? "#f59e0b" : "#10b981", gradient: d.pendingCount > 0 ? "from-amber-50 to-amber-50/30" : "from-emerald-50 to-emerald-50/30" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-sm transition-all duration-300 group`}>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-sm ${c.iconBg}`}>
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

      {/* ── Main 2-Column Dashboard Grid ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* ── LEFT COLUMN (7 Cols): Cashier Action Tools & Collection Charts ──── */}
        <div className="lg:col-span-7 space-y-4">

          {/* Quick Cashier Navigation Bar */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Cashier Shortcuts</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link to="/cashier/accept" className="flex items-center gap-2.5 rounded-xl border bg-emerald-700 text-white p-2.5 hover:bg-emerald-800 transition-colors no-underline">
                <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-semibold truncate">Accept Pay</span>
              </Link>

              {[
                { label: "Search Vendor", to: "/cashier/search", icon: Search, color: "text-blue-600 bg-blue-50 border-blue-100" },
                { label: "Payment Status", to: "/cashier/status", icon: Activity, color: "text-amber-600 bg-amber-50 border-amber-100" },
                { label: "Print SOA", to: "/cashier/soa", icon: FileText, color: "text-purple-600 bg-purple-50 border-purple-100" },
              ].map(a => (
                <Link key={a.to} to={a.to} className={`flex items-center gap-2.5 rounded-xl border ${a.color} p-2.5 hover:opacity-90 transition-opacity no-underline`}>
                  <div className="h-7 w-7 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-xs">
                    <a.icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-foreground truncate">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Collections Bar Chart (7 Days) */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-600" />
                <p className="text-xs font-bold text-foreground">Weekly Collections (Last 7 Days)</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700">{fmt(d.totalWeek)} week total</span>
            </div>

            <div className="p-4">
              <div className="relative">
                <ResponsiveContainer width="100%" height={175}>
                  <BarChart data={d.chartData} barSize={20} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(220,10%,55%)", fontWeight: 500 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${(v / 1000).toFixed(0)}k` : `₱${v}`} axisLine={false} tickLine={false} width={42} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {d.chartData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.isToday ? "#0f6e56" : "#34d399"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t mt-2">
                {[
                  { label: "Daily Avg", value: fmt(Math.round(d.totalWeek / 7)) },
                  { label: "Peak Day", value: fmt(Math.max(...d.chartData.map((c: any) => c.amount))) },
                  { label: "Today", value: fmt(d.totalToday) },
                ].map((s, i) => (
                  <div key={i} className="text-center p-1.5 rounded-lg bg-secondary/30">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">{s.label}</p>
                    <p className="font-mono text-xs font-bold text-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          {Object.keys(d.methodBreakdown).length > 0 && (
            <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-600" />
                  <p className="text-xs font-bold text-foreground">Today's Collections by Method</p>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">{fmt(methodTotal)} total</span>
              </div>
              <div className="p-3.5 grid grid-cols-2 gap-2.5">
                {Object.entries(d.methodBreakdown).map(([method, amount]) => {
                  const pct = methodTotal > 0 ? Math.round((amount / methodTotal) * 100) : 0;
                  const cfg = METHOD_CFG[method] || { iconBg: "bg-secondary", iconText: "text-foreground", pillBg: "bg-secondary", bar: "#6b7280", label: method };
                  const Icon = method === "cash" ? Banknote : Smartphone;
                  return (
                    <div key={method} className="rounded-xl border p-2.5 bg-card flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className={`h-7 w-7 rounded-md flex items-center justify-center ${cfg.iconBg}`}>
                            <Icon className={`h-3.5 w-3.5 ${cfg.iconText}`} />
                          </div>
                          <div>
                            <p className="text-[11px] font-bold leading-none text-foreground">{cfg.label}</p>
                            <p className="font-mono text-xs font-bold text-foreground mt-0.5">{fmt(amount)}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cfg.bar }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── RIGHT COLUMN (5 Cols): Operational Activity & Shift Summary ────── */}
        <div className="lg:col-span-5 space-y-4">

          {/* Shift Drawer Balance & Vendor Compliance Summary */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <h3 className="text-xs font-bold text-foreground">Shift & Compliance Summary</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {paidPct}% Paid
              </span>
            </div>

            {activeShift ? (
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Starting Float:</span>
                  <span className="font-mono font-bold text-foreground">{fmt(activeShift.starting_cash)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Today's System Collections:</span>
                  <span className="font-mono font-bold text-emerald-700">+{fmt(d.totalToday)}</span>
                </div>
                <div className="border-t border-emerald-200/60 pt-1.5 flex justify-between font-bold">
                  <span className="text-emerald-900">Expected Drawer Total:</span>
                  <span className="font-mono text-emerald-800">{fmt(Number(activeShift.starting_cash) + d.totalToday)}</span>
                </div>
              </div>
            ) : (
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
                ⚠️ Shift is currently closed. Open shift to track cash drawer balance.
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">Monthly Vendor Paid Progress:</span>
                <span className="font-bold">{d.paidVendors} / {d.totalVendors} vendors</span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
          </div>

          {/* Recent Live Transactions Stream (Direct List) */}
          <div className="rounded-2xl border bg-card overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                <h3 className="text-xs font-bold text-foreground">Recent Transactions</h3>
              </div>
              <Link to="/cashier/status" className="text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1 no-underline">
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {d.recentList.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">No payments processed yet today</div>
            ) : (
              <div className="divide-y max-h-[300px] overflow-y-auto">
                {d.recentList.map((t: any) => {
                  const isC = t.status === "completed", isP = t.status === "pending";
                  const cfg = METHOD_CFG[t.payment_method] || { iconBg: "bg-secondary", iconText: "text-foreground", pillBg: "bg-secondary", bar: "#6b7280", label: t.payment_method };
                  return (
                    <div key={t.id} className="p-3 hover:bg-secondary/30 transition-colors flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-foreground truncate">{t.vendor_name}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${cfg.iconBg} ${cfg.iconText}`}>{cfg.label}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Stall {t.stall} · {new Date(t.created_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono text-xs font-bold text-foreground">{fmt(Number(t.amount))}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isC ? "bg-emerald-100 text-emerald-700" : isP ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                          {isC ? "Completed" : isP ? "Pending" : "Failed"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default CashierDashboardHome;