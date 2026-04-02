import { motion } from "framer-motion";
import {
  CreditCard, QrCode, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Clock, FileText, Bell, Newspaper, Store,
  History, TrendingUp, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

const MONTHS       = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const VendorDashboardHome = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-dashboard", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: vendor }  = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      const { data: payments } = await supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").order("created_at", { ascending: false });
      const { data: notifications } = await supabase.from("notifications").select("*").eq("user_id", user!.id).eq("read_status", false).order("created_at", { ascending: false }).limit(3);

      const stall       = vendor?.stalls as any;
      const defaultRate = stall?.monthly_rate || 1450;
      const currentYear  = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const { data: schedules } = stall?.id
        ? await (supabase.from("stall_fee_schedules" as any) as any)
            .select("*").eq("stall_id", stall.id).eq("year", currentYear)
        : { data: [] };

      const getMonthFee = (m: number): number => {
        const s = (schedules || []).find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };

      const rawPaidMap: Record<number, number> = {};
      (payments || [])
        .filter(p => p.status === "completed" && p.period_year === currentYear)
        .forEach(p => {
          if (p.period_month)
            rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
        });

      const effMap: Record<number, number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m    = getMonthFee(m);
        const credited = (rawPaidMap[m] || 0) + carry;
        effMap[m]      = credited;
        carry          = credited >= due_m ? (credited - due_m) : 0;
      }

      const currentMonthFee    = getMonthFee(currentMonth);
      const paidThisMonth      = effMap[currentMonth] || 0;
      const isCurrentMonthPaid = paidThisMonth >= currentMonthFee;
      const remainingThisMonth = Math.max(0, currentMonthFee - paidThisMonth);
      const monthlyRate        = currentMonthFee;

      let nextUnpaidMonth = currentMonth;
      for (let m = 1; m <= 12; m++) {
        if ((effMap[m] || 0) < getMonthFee(m)) { nextUnpaidMonth = m; break; }
        if (m === 12) nextUnpaidMonth = 13;
      }

      const totalPaidYear = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);
      const monthsPaid = Array.from({ length: currentMonth }, (_, i) => i + 1)
        .filter(m => (effMap[m] || 0) >= getMonthFee(m)).length;
      const totalOutstanding = Array.from({ length: currentMonth }, (_, i) => i + 1)
        .reduce((sum, m) => sum + Math.max(0, getMonthFee(m) - (effMap[m] || 0)), 0);

      const chartData = MONTHS_SHORT.slice(0, currentMonth).map((m, i) => ({
        month: m,
        paid:  Math.min(effMap[i + 1] || 0, getMonthFee(i + 1)),
        due:   getMonthFee(i + 1),
      }));

      return {
        vendor, profile, stall, monthlyRate,
        payments: (payments || []).slice(0, 6),
        isCurrentMonthPaid, paidThisMonth, remainingThisMonth,
        nextUnpaidMonth, allPaid: nextUnpaidMonth > 12,
        totalPaidYear, monthsPaid, totalOutstanding,
        chartData, currentMonth, currentYear,
        unreadNotifs: notifications || [],
      };
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const d           = data!;
  const stall       = d.stall;
  const vendor      = d.vendor;
  const profile     = d.profile;
  const monthlyRate = d.monthlyRate;
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-[clamp(1rem,4vw,1.5rem)]">

      {/* Greeting */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-foreground" style={{ fontSize: "clamp(1.1rem,5vw,1.5rem)" }}>
            Hello, {profile?.first_name}! 👋
          </h1>
          <p className="text-muted-foreground mt-0.5" style={{ fontSize: "clamp(0.7rem,3vw,0.875rem)" }}>
            Stall {stall?.stall_number || "—"} · {stall?.section || "General"} ·{" "}
            {new Date().toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {d.unreadNotifs.length > 0 && (
          <Link to="/vendor/notifications">
            <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-primary hover:bg-primary/10 transition-colors" style={{ fontSize: "clamp(0.75rem,3vw,0.875rem)" }}>
              <Bell className="h-4 w-4 shrink-0" />
              <span>{d.unreadNotifs.length} unread</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        )}
      </div>

      {/* Payment status alert */}
      {d.isCurrentMonthPaid ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-2xl border border-success/20 bg-success/5 sm:flex-row sm:items-center sm:justify-between"
          style={{ padding: "clamp(0.75rem,3vw,1.25rem)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-semibold text-success" style={{ fontSize: "clamp(0.8rem,3.5vw,0.95rem)" }}>{MONTHS[currentMonth - 1]} {d.currentYear} — Paid ✓</p>
              <p className="text-muted-foreground" style={{ fontSize: "clamp(0.65rem,2.8vw,0.75rem)" }}>Your stall fee is fully settled</p>
            </div>
          </div>
          {!d.allPaid && d.nextUnpaidMonth <= 12 && (
            <Link to="/vendor/pay" className="w-full sm:w-auto">
              <Button size="sm" variant="outline" className="border-success/30 text-success hover:bg-success/10 w-full sm:w-auto min-h-[44px] sm:min-h-0">
                Pay {MONTHS[d.nextUnpaidMonth - 1]} early <ArrowRight className="ml-1.5 h-3 w-3" />
              </Button>
            </Link>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 rounded-2xl border border-accent/20 bg-accent/5 sm:flex-row sm:items-center sm:justify-between"
          style={{ padding: "clamp(0.75rem,3vw,1.25rem)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 shrink-0">
              <AlertCircle className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-accent" style={{ fontSize: "clamp(0.8rem,3.5vw,0.95rem)" }}>
                {MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} {d.currentYear} — Due
              </p>
              {d.paidThisMonth > 0 ? (
                <p className="text-muted-foreground" style={{ fontSize: "clamp(0.65rem,2.8vw,0.75rem)" }}>{fmt(d.paidThisMonth)} paid · {fmt(d.remainingThisMonth)} remaining</p>
              ) : (
                <p className="text-muted-foreground" style={{ fontSize: "clamp(0.65rem,2.8vw,0.75rem)" }}>{fmt(monthlyRate)} due this month</p>
              )}
            </div>
          </div>
          <Link to="/vendor/pay" className="w-full sm:w-auto">
            <Button size="sm" variant="hero" className="w-full sm:w-auto min-h-[44px] sm:min-h-0 shrink-0">
              Pay Now <ArrowRight className="ml-1.5 h-3 w-3" />
            </Button>
          </Link>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-[clamp(0.4rem,2vw,0.75rem)] lg:grid-cols-4">
        {[
          { label: "Monthly Rate",   value: fmt(monthlyRate),        sub: "per month",         icon: Calendar,     color: "text-foreground",   bg: "bg-secondary" },
          { label: "Total Paid",     value: fmt(d.totalPaidYear),    sub: `${d.currentYear}`,  icon: TrendingUp,   color: "text-success",      bg: "bg-success/10" },
          { label: "Months Settled", value: `${d.monthsPaid}/${d.currentMonth}`, sub: "paid", icon: CheckCircle2, color: d.monthsPaid === d.currentMonth ? "text-success" : "text-primary", bg: d.monthsPaid === d.currentMonth ? "bg-success/10" : "bg-primary/10" },
          { label: "Outstanding",    value: fmt(d.totalOutstanding), sub: "balance",           icon: AlertCircle,  color: d.totalOutstanding === 0 ? "text-success" : "text-accent",       bg: d.totalOutstanding === 0 ? "bg-success/10" : "bg-accent/10" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card shadow-civic" style={{ padding: "clamp(0.6rem,2.5vw,1rem)" }}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-muted-foreground uppercase tracking-wider" style={{ fontSize: "clamp(0.55rem,2.2vw,0.65rem)" }}>{c.label}</p>
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg shrink-0 ${c.bg}`}>
                <c.icon className={`h-3 w-3 ${c.color}`} />
              </div>
            </div>
            <p className={`font-mono font-bold leading-tight ${c.color}`} style={{ fontSize: "clamp(0.85rem,3.8vw,1.125rem)" }}>{c.value}</p>
            <p className="text-muted-foreground mt-0.5" style={{ fontSize: "clamp(0.55rem,2.2vw,0.65rem)" }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="grid gap-[clamp(0.75rem,3vw,1.25rem)] lg:grid-cols-[1fr_300px]">

        {/* RIGHT panel — shown FIRST on mobile */}
        <div className="space-y-[clamp(0.75rem,3vw,1rem)] order-first lg:order-last">

          {/* Pay card */}
          <motion.div whileHover={{ y: -2 }} className="rounded-2xl border bg-card shadow-civic" style={{ padding: "clamp(0.75rem,3vw,1.25rem)" }}>
            <p className="font-medium uppercase tracking-wider text-muted-foreground mb-2" style={{ fontSize: "clamp(0.6rem,2.5vw,0.7rem)" }}>
              {d.isCurrentMonthPaid ? "Next Bill" : "Amount Due"}
            </p>
            <p className="font-mono font-bold text-foreground leading-none" style={{ fontSize: "clamp(1.5rem,7vw,1.875rem)" }}>
              {fmt(d.isCurrentMonthPaid ? monthlyRate : (d.remainingThisMonth || monthlyRate))}
            </p>
            <p className="text-muted-foreground mt-1" style={{ fontSize: "clamp(0.7rem,3vw,0.875rem)" }}>
              {d.isCurrentMonthPaid
                ? `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth + 1) - 1] || "All months paid"} ${d.currentYear}`
                : `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} ${d.currentYear}`}
            </p>
            {d.paidThisMonth > 0 && !d.isCurrentMonthPaid && (
              <div className="mt-3 space-y-1">
                <div className="flex justify-between" style={{ fontSize: "clamp(0.65rem,2.8vw,0.75rem)" }}>
                  <span className="text-muted-foreground">Paid so far</span>
                  <span className="text-muted-foreground">{fmt(d.paidThisMonth)}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min((d.paidThisMonth / monthlyRate) * 100, 100)}%` }} />
                </div>
                <div className="flex justify-between" style={{ fontSize: "clamp(0.65rem,2.8vw,0.75rem)" }}>
                  <span className="text-muted-foreground">Remaining</span>
                  <span className="text-accent font-medium">{fmt(d.remainingThisMonth)}</span>
                </div>
              </div>
            )}
            <Link to="/vendor/pay" className="block mt-4">
              <Button variant="hero" size="lg" className="w-full min-h-[44px]">
                <CreditCard className="mr-2 h-4 w-4" />
                {d.isCurrentMonthPaid ? "Pay in Advance" : "Pay Now"}
              </Button>
            </Link>
          </motion.div>

          {/* QR Code */}
          <div className="rounded-2xl border bg-card shadow-civic flex flex-col items-center text-center" style={{ padding: "clamp(0.75rem,3vw,1.25rem)" }}>
            <p className="font-medium uppercase tracking-wider text-muted-foreground mb-3" style={{ fontSize: "clamp(0.6rem,2.5vw,0.7rem)" }}>Your Stall QR Code</p>
            <div className="rounded-xl border-2 border-dashed border-border p-3 bg-white">
              {vendor?.qr_code
                ? <QRCodeSVG value={vendor.qr_code} size={isMobile ? Math.min(140, window.innerWidth - 120) : 120} level="H" />
                : <QrCode className="h-16 w-16 text-muted-foreground/30" />}
            </div>
            <p className="mt-2 font-semibold text-foreground" style={{ fontSize: "clamp(0.75rem,3vw,0.875rem)" }}>Stall {stall?.stall_number}</p>
            <p className="font-mono text-muted-foreground mt-0.5 break-all leading-relaxed" style={{ fontSize: "clamp(0.5rem,2vw,0.65rem)" }}>{vendor?.qr_code}</p>
          </div>

          {/* Quick links */}
          <div className="rounded-2xl border bg-card shadow-civic" style={{ padding: "clamp(0.6rem,2.5vw,1rem)" }}>
            <p className="font-medium uppercase tracking-wider text-muted-foreground mb-2" style={{ fontSize: "clamp(0.6rem,2.5vw,0.7rem)" }}>Quick Links</p>
            <div className="space-y-0.5">
              {[
                { label: "Payment History",      to: "/vendor/history",       icon: History },
                { label: "Statement of Account", to: "/vendor/statement",     icon: FileText },
                { label: "Stall Information",    to: "/vendor/stall",         icon: Store },
                { label: "Notifications",        to: "/vendor/notifications", icon: Bell,  badge: d.unreadNotifs.length },
                { label: "News & Updates",       to: "/vendor/news",          icon: Newspaper },
              ].map(l => (
                <Link key={l.to} to={l.to} className="flex items-center justify-between rounded-xl px-3 py-2.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors min-h-[44px]" style={{ fontSize: "clamp(0.75rem,3vw,0.875rem)" }}>
                  <div className="flex items-center gap-2.5">
                    <l.icon className="h-4 w-4 shrink-0" />
                    {l.label}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {l.badge ? <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{l.badge}</span> : null}
                    <ArrowRight className="h-3.5 w-3.5 opacity-40" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* LEFT: Chart + recent payments */}
        <div className="space-y-[clamp(0.75rem,3vw,1.25rem)] order-last lg:order-first">

          {/* Chart */}
          <div className="rounded-2xl border bg-card shadow-civic" style={{ padding: "clamp(0.75rem,3vw,1.25rem)" }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground" style={{ fontSize: "clamp(0.8rem,3.5vw,0.95rem)" }}>Progress — {d.currentYear}</h3>
                <p className="text-muted-foreground" style={{ fontSize: "clamp(0.6rem,2.5vw,0.7rem)" }}>Paid vs due per month</p>
              </div>
              <Link to="/vendor/statement">
                <Button variant="ghost" size="sm" className="text-primary gap-1 min-h-[36px]" style={{ fontSize: "clamp(0.65rem,2.8vw,0.75rem)" }}>
                  Full SOA <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            {d.chartData.length === 0 ? (
              <p className="text-center text-muted-foreground py-10" style={{ fontSize: "clamp(0.75rem,3vw,0.875rem)" }}>No payment data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={isMobile ? 150 : 180}>
                <BarChart data={d.chartData} barGap={2} barSize={isMobile ? 10 : 14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: isMobile ? 9 : 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
                  {!isMobile && <YAxis tick={{ fontSize: 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={45} />}
                  <Tooltip formatter={(v: number, name: string) => [fmt(v), name === "paid" ? "Paid" : "Due"]} contentStyle={{ borderRadius: "10px", border: "1px solid hsl(220,13%,88%)", fontSize: "12px" }} />
                  <Bar dataKey="due"  fill="hsl(220,13%,91%)" radius={[4,4,0,0]} name="due" />
                  <Bar dataKey="paid" fill="hsl(185,60%,35%)" radius={[4,4,0,0]} name="paid" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent payments */}
          <div className="rounded-2xl border bg-card shadow-civic">
            <div className="flex items-center justify-between border-b px-[clamp(0.75rem,3vw,1.25rem)] py-3.5">
              <h3 className="font-semibold text-foreground" style={{ fontSize: "clamp(0.8rem,3.5vw,0.95rem)" }}>Recent Payments</h3>
              <Link to="/vendor/history">
                <Button variant="ghost" size="sm" className="text-primary gap-1 min-h-[36px]" style={{ fontSize: "clamp(0.65rem,2.8vw,0.75rem)" }}>
                  View All <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="divide-y">
              {d.payments.map((p: any) => (
                <div key={p.id} className="flex items-center gap-[clamp(0.5rem,2vw,0.75rem)] px-[clamp(0.75rem,3vw,1.25rem)] py-3 hover:bg-secondary/30 transition-colors">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${p.status === "completed" ? "bg-success/10" : p.status === "pending" ? "bg-amber-100" : "bg-accent/10"}`}>
                    {p.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-success" /> : p.status === "pending" ? <Clock className="h-4 w-4 text-amber-600" /> : <AlertCircle className="h-4 w-4 text-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate" style={{ fontSize: "clamp(0.75rem,3vw,0.875rem)" }}>
                      {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : new Date(p.created_at).toLocaleDateString("en-PH")}
                    </p>
                    <p className="text-muted-foreground capitalize truncate" style={{ fontSize: "clamp(0.6rem,2.5vw,0.7rem)" }}>
                      {p.payment_method} · {p.payment_type === "staggered" ? "Partial" : "Full"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-bold text-foreground" style={{ fontSize: "clamp(0.75rem,3vw,0.875rem)" }}>{fmt(Number(p.amount))}</p>
                    <p className={`font-medium capitalize ${p.status === "completed" ? "text-success" : p.status === "pending" ? "text-amber-600" : "text-accent"}`} style={{ fontSize: "clamp(0.6rem,2.5vw,0.7rem)" }}>{p.status}</p>
                  </div>
                </div>
              ))}
              {d.payments.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                  <CreditCard className="h-8 w-8 opacity-30" />
                  <p style={{ fontSize: "clamp(0.75rem,3vw,0.875rem)" }}>No payments recorded yet</p>
                  <Link to="/vendor/pay"><Button size="sm" variant="outline" className="mt-1 min-h-[44px]">Make your first payment</Button></Link>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default VendorDashboardHome;