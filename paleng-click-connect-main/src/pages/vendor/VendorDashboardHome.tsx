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
  const { user }   = useAuth();
  const isMobile   = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-dashboard", user?.id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data: vendor }        = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile }       = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      const { data: payments }      = await supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").order("created_at", { ascending: false });
      const { data: notifications } = await supabase.from("notifications").select("*").eq("user_id", user!.id).eq("read_status", false).order("created_at", { ascending: false }).limit(3);

      const stall        = vendor?.stalls as any;
      const defaultRate  = stall?.monthly_rate || 1450;
      const currentYear  = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const { data: schedules } = stall?.id
        ? await (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", stall.id).eq("year", currentYear)
        : { data: [] };

      const getMonthFee = (m: number): number => {
        const s = (schedules || []).find((s: any) => s.month === m);
        return s ? Number(s.amount) : defaultRate;
      };

      const rawPaidMap: Record<number, number> = {};
      (payments || []).filter(p => p.status === "completed" && p.period_year === currentYear)
        .forEach(p => { if (p.period_month) rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount); });

      const effMap: Record<number, number> = {};
      let carry = 0;
      for (let m = 1; m <= 12; m++) {
        const due_m = getMonthFee(m);
        const credited = (rawPaidMap[m] || 0) + carry;
        effMap[m] = credited;
        carry = credited >= due_m ? credited - due_m : 0;
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

      const totalPaidYear    = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);
      const monthsPaid       = Array.from({ length: currentMonth }, (_, i) => i + 1).filter(m => (effMap[m] || 0) >= getMonthFee(m)).length;
      const totalOutstanding = Array.from({ length: currentMonth }, (_, i) => i + 1).reduce((sum, m) => sum + Math.max(0, getMonthFee(m) - (effMap[m] || 0)), 0);
      const chartData        = MONTHS_SHORT.slice(0, currentMonth).map((m, i) => ({ month: m, paid: Math.min(effMap[i + 1] || 0, getMonthFee(i + 1)), due: getMonthFee(i + 1) }));

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

  const d            = data!;
  const stall        = d.stall;
  const vendor       = d.vendor;
  const profile      = d.profile;
  const monthlyRate  = d.monthlyRate;
  const currentMonth = new Date().getMonth() + 1;

  // All sizing driven by isMobile — no Tailwind breakpoints
  const gap       = isMobile ? 14 : 24;
  const cardPad   = isMobile ? "10px 12px" : "20px";
  const monoLg    = isMobile ? "1.35rem" : "1.875rem";
  const monoSm    = isMobile ? "0.9rem" : "1.1rem";
  const labelSize = isMobile ? "0.65rem" : "0.75rem";
  const bodySize  = isMobile ? "0.78rem" : "0.875rem";
  const iconSize  = isMobile ? 13 : 16;

  const statCards = [
    { label: "Monthly Rate",   value: fmt(monthlyRate),       sub: "per month",                    icon: Calendar,     color: "var(--foreground)",                      bg: "hsl(var(--secondary))" },
    { label: "Total Paid",     value: fmt(d.totalPaidYear),   sub: `${d.currentYear} so far`,      icon: TrendingUp,   color: "hsl(var(--success))",                    bg: "hsl(var(--success) / 0.1)" },
    { label: "Months Settled", value: `${d.monthsPaid}/${d.currentMonth}`, sub: "paid in full",   icon: CheckCircle2, color: d.monthsPaid === d.currentMonth ? "hsl(var(--success))" : "hsl(var(--primary))", bg: d.monthsPaid === d.currentMonth ? "hsl(var(--success)/0.1)" : "hsl(var(--primary)/0.1)" },
    { label: "Outstanding",    value: fmt(d.totalOutstanding), sub: "balance due",                 icon: AlertCircle,  color: d.totalOutstanding === 0 ? "hsl(var(--success))" : "hsl(var(--accent))", bg: d.totalOutstanding === 0 ? "hsl(var(--success)/0.1)" : "hsl(var(--accent)/0.1)" },
  ];

  const S: Record<string, React.CSSProperties> = {
    wrap:    { display: "flex", flexDirection: "column", gap },
    card:    { borderRadius: 16, border: "1px solid var(--border)", background: "var(--card)", padding: cardPad, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" },
    row:     { display: "flex", alignItems: "center", gap: isMobile ? 8 : 12 },
    rowWrap: { display: "flex", alignItems: "center", flexWrap: "wrap" as const, gap: 8, justifyContent: "space-between" },
    label:   { fontSize: labelSize, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--muted-foreground)" },
    mono:    { fontFamily: "monospace" },
  };

  return (
    <div style={S.wrap}>

      {/* Greeting */}
      <div style={S.rowWrap}>
        <div>
          <h1 style={{ fontSize: isMobile ? "1.15rem" : "1.5rem", fontWeight: 700, margin: 0 }}>
            Hello, {profile?.first_name}! 👋
          </h1>
          <p style={{ fontSize: bodySize, color: "var(--muted-foreground)", marginTop: 2 }}>
            Stall {stall?.stall_number || "—"} · {stall?.section || "General"} ·{" "}
            {new Date().toLocaleDateString("en-PH", { weekday: isMobile ? "short" : "long", month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        {d.unreadNotifs.length > 0 && (
          <Link to="/vendor/notifications" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, borderRadius: 10, border: "1px solid hsl(var(--primary)/0.3)", background: "hsl(var(--primary)/0.05)", padding: "5px 10px", fontSize: "0.75rem", color: "hsl(var(--primary))" }}>
              <Bell size={12} /><span>{d.unreadNotifs.length} unread</span><ArrowRight size={11} />
            </div>
          </Link>
        )}
      </div>

      {/* Payment status */}
      {d.isCurrentMonthPaid ? (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...S.card, borderColor: "hsl(var(--success)/0.25)", background: "hsl(var(--success)/0.05)", padding: cardPad }}>
          <div style={{ ...S.rowWrap, gap: 8 }}>
            <div style={{ ...S.row }}>
              <div style={{ width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: "50%", background: "hsl(var(--success)/0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CheckCircle2 size={isMobile ? 15 : 18} style={{ color: "hsl(var(--success))" }} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: bodySize, color: "hsl(var(--success))", margin: 0 }}>{MONTHS[currentMonth - 1]} {d.currentYear} — Paid ✓</p>
                <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", margin: 0 }}>Stall fee fully settled</p>
              </div>
            </div>
            {!d.allPaid && d.nextUnpaidMonth <= 12 && (
              <Link to="/vendor/pay"><Button size="sm" variant="outline" style={{ fontSize: "0.72rem", borderColor: "hsl(var(--success)/0.3)", color: "hsl(var(--success))" }}>
                Pay {MONTHS[d.nextUnpaidMonth - 1].slice(0,3)} early <ArrowRight size={10} style={{ marginLeft: 3 }} />
              </Button></Link>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ ...S.card, borderColor: "hsl(var(--accent)/0.25)", background: "hsl(var(--accent)/0.05)", padding: cardPad }}>
          <div style={{ ...S.rowWrap, gap: 8 }}>
            <div style={{ ...S.row }}>
              <div style={{ width: isMobile ? 30 : 36, height: isMobile ? 30 : 36, borderRadius: "50%", background: "hsl(var(--accent)/0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertCircle size={isMobile ? 15 : 18} style={{ color: "hsl(var(--accent))" }} />
              </div>
              <div>
                <p style={{ fontWeight: 600, fontSize: bodySize, color: "hsl(var(--accent))", margin: 0 }}>{MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} {d.currentYear} — Due</p>
                <p style={{ fontSize: "0.7rem", color: "var(--muted-foreground)", margin: 0 }}>
                  {d.paidThisMonth > 0 ? `${fmt(d.paidThisMonth)} paid · ${fmt(d.remainingThisMonth)} left` : `${fmt(monthlyRate)} due`}
                </p>
              </div>
            </div>
            <Link to="/vendor/pay"><Button size="sm" variant="hero" style={{ fontSize: "0.72rem" }}>Pay Now <ArrowRight size={10} style={{ marginLeft: 3 }} /></Button></Link>
          </div>
        </motion.div>
      )}

      {/* Stat cards — 2 col always */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 8 : 12 }}>
        {statCards.map(c => (
          <div key={c.label} style={{ ...S.card }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <p style={{ ...S.label, margin: 0 }}>{c.label}</p>
              <div style={{ width: isMobile ? 22 : 28, height: isMobile ? 22 : 28, borderRadius: 7, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <c.icon size={isMobile ? 10 : 13} style={{ color: c.color }} />
              </div>
            </div>
            <p style={{ ...S.mono, fontSize: monoSm, fontWeight: 700, color: c.color, margin: 0 }}>{c.value}</p>
            <p style={{ fontSize: "0.68rem", color: "var(--muted-foreground)", marginTop: 2 }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Pay card */}
      <motion.div whileHover={{ y: -2 }} style={{ ...S.card }}>
        <p style={{ ...S.label, margin: "0 0 6px" }}>{d.isCurrentMonthPaid ? "Next Bill" : "Amount Due"}</p>
        <p style={{ ...S.mono, fontSize: monoLg, fontWeight: 700, lineHeight: 1, margin: 0 }}>{fmt(d.isCurrentMonthPaid ? monthlyRate : (d.remainingThisMonth || monthlyRate))}</p>
        <p style={{ fontSize: bodySize, color: "var(--muted-foreground)", marginTop: 4 }}>
          {d.isCurrentMonthPaid ? `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth + 1) - 1] || "All paid"} ${d.currentYear}` : `${MONTHS[(d.nextUnpaidMonth <= 12 ? d.nextUnpaidMonth : currentMonth) - 1]} ${d.currentYear}`}
        </p>
        {d.paidThisMonth > 0 && !d.isCurrentMonthPaid && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--muted-foreground)", marginBottom: 4 }}>
              <span>Paid</span><span>{fmt(d.paidThisMonth)}</span>
            </div>
            <div style={{ height: 5, background: "hsl(var(--secondary))", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "hsl(var(--primary))", borderRadius: 99, width: `${Math.min((d.paidThisMonth / monthlyRate) * 100, 100)}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", marginTop: 4 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Remaining</span>
              <span style={{ color: "hsl(var(--accent))", fontWeight: 600 }}>{fmt(d.remainingThisMonth)}</span>
            </div>
          </div>
        )}
        <Link to="/vendor/pay" style={{ display: "block", marginTop: 12 }}>
          <Button variant="hero" style={{ width: "100%", fontSize: isMobile ? "0.85rem" : "1rem", height: isMobile ? 38 : 44 }}>
            <CreditCard size={iconSize} style={{ marginRight: 6 }} />{d.isCurrentMonthPaid ? "Pay in Advance" : "Pay Now"}
          </Button>
        </Link>
      </motion.div>

      {/* Chart */}
      <div style={{ ...S.card }}>
        <div style={{ ...S.rowWrap, marginBottom: 10 }}>
          <div>
            <h3 style={{ fontWeight: 600, fontSize: isMobile ? "0.85rem" : "1rem", margin: 0 }}>Progress — {d.currentYear}</h3>
            <p style={{ fontSize: "0.68rem", color: "var(--muted-foreground)", marginTop: 1 }}>Paid (teal) vs due (gray)</p>
          </div>
          <Link to="/vendor/statement"><Button variant="ghost" size="sm" style={{ fontSize: "0.7rem", height: 28, padding: "0 8px" }} className="text-primary">Full SOA <ArrowRight size={10} style={{ marginLeft: 3 }} /></Button></Link>
        </div>
        {d.chartData.length === 0 ? (
          <p style={{ textAlign: "center", fontSize: "0.875rem", padding: "24px 0", color: "var(--muted-foreground)" }}>No payment data yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 120 : 180}>
            <BarChart data={d.chartData} barGap={2} barSize={isMobile ? 9 : 14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: isMobile ? 9 : 11, fill: "hsl(220,10%,55%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: isMobile ? 8 : 10, fill: "hsl(220,10%,55%)" }} tickFormatter={v => v >= 1000 ? `₱${v/1000}k` : `₱${v}`} axisLine={false} tickLine={false} width={isMobile ? 28 : 45} />
              <Tooltip formatter={(v: number, name: string) => [fmt(v), name === "paid" ? "Paid" : "Due"]} contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 11 }} />
              <Bar dataKey="due" fill="hsl(220,13%,91%)" radius={[4,4,0,0]} />
              <Bar dataKey="paid" fill="hsl(185,60%,35%)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent payments */}
      <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "10px 12px" : "12px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ fontWeight: 600, fontSize: isMobile ? "0.85rem" : "1rem", margin: 0 }}>Recent Payments</h3>
          <Link to="/vendor/history"><Button variant="ghost" size="sm" style={{ fontSize: "0.7rem", height: 28, padding: "0 8px" }} className="text-primary">View All <ArrowRight size={10} style={{ marginLeft: 3 }} /></Button></Link>
        </div>
        {d.payments.map((p: any) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, padding: isMobile ? "9px 12px" : "11px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, flexShrink: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: p.status === "completed" ? "hsl(var(--success)/0.1)" : p.status === "pending" ? "#fef3c7" : "hsl(var(--accent)/0.1)" }}>
              {p.status === "completed" ? <CheckCircle2 size={13} style={{ color: "hsl(var(--success))" }} /> : p.status === "pending" ? <Clock size={13} style={{ color: "#d97706" }} /> : <AlertCircle size={13} style={{ color: "hsl(var(--accent))" }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: isMobile ? "0.76rem" : "0.875rem", fontWeight: 500, margin: 0 }}>{p.period_month && p.period_year ? `${MONTHS[p.period_month - 1].slice(0, isMobile ? 3 : 9)} ${p.period_year}` : new Date(p.created_at).toLocaleDateString("en-PH")}</p>
              <p style={{ fontSize: "0.66rem", color: "var(--muted-foreground)", margin: 0 }}>{p.payment_method} · {p.payment_type === "staggered" ? "Partial" : "Full"}</p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ ...S.mono, fontSize: isMobile ? "0.76rem" : "0.875rem", fontWeight: 700, margin: 0 }}>{fmt(Number(p.amount))}</p>
              <p style={{ fontSize: "0.65rem", fontWeight: 500, margin: 0, color: p.status === "completed" ? "hsl(var(--success))" : p.status === "pending" ? "#d97706" : "hsl(var(--accent))" }}>{p.status}</p>
            </div>
          </div>
        ))}
        {d.payments.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0", gap: 8, color: "var(--muted-foreground)" }}>
            <CreditCard size={26} style={{ opacity: 0.3 }} />
            <p style={{ fontSize: "0.875rem" }}>No payments yet</p>
            <Link to="/vendor/pay"><Button size="sm" variant="outline">Make your first payment</Button></Link>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div style={{ ...S.card }}>
        <p style={{ ...S.label, margin: "0 0 8px" }}>Quick Links</p>
        {[
          { label: "Payment History",      to: "/vendor/history",       icon: History },
          { label: "Statement of Account", to: "/vendor/statement",     icon: FileText },
          { label: "Stall Information",    to: "/vendor/stall",         icon: Store },
          { label: "Notifications",        to: "/vendor/notifications", icon: Bell, badge: d.unreadNotifs.length },
          { label: "News & Updates",       to: "/vendor/news",          icon: Newspaper },
        ].map(l => (
          <Link key={l.to} to={l.to} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 9, padding: isMobile ? "7px 8px" : "9px 12px", textDecoration: "none", color: "var(--muted-foreground)" }}
            className="hover:bg-secondary hover:text-foreground transition-colors">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <l.icon size={iconSize} />
              <span style={{ fontSize: bodySize }}>{l.label}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {l.badge ? <span style={{ width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "hsl(var(--primary))", color: "#fff", fontSize: "0.6rem", fontWeight: 700 }}>{l.badge}</span> : null}
              <ArrowRight size={12} style={{ opacity: 0.35 }} />
            </div>
          </Link>
        ))}
      </div>

      {/* QR Code */}
      <div style={{ ...S.card, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <p style={{ ...S.label, margin: "0 0 10px" }}>Your Stall QR Code</p>
        <div style={{ borderRadius: 12, border: "2px dashed var(--border)", padding: 10, background: "#fff" }}>
          {vendor?.qr_code ? <QRCodeSVG value={vendor.qr_code} size={isMobile ? 88 : 120} level="H" /> : <QrCode size={isMobile ? 60 : 80} style={{ opacity: 0.25 }} className="text-muted-foreground" />}
        </div>
        <p style={{ fontWeight: 600, fontSize: bodySize, marginTop: 8 }}>Stall {stall?.stall_number}</p>
        <p style={{ ...S.mono, fontSize: "0.65rem", color: "var(--muted-foreground)", marginTop: 2, wordBreak: "break-all", lineHeight: 1.4 }}>{vendor?.qr_code}</p>
      </div>

    </div>
  );
};

export default VendorDashboardHome;