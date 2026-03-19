import { motion } from "framer-motion";
import { CreditCard, QrCode, Clock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const VendorDashboardHome = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      const { data: payments } = await supabase.from("payments").select("*").eq("vendor_id", vendor?.id || "").order("created_at", { ascending: false });

      const stall = vendor?.stalls as any;
      const monthlyRate = stall?.monthly_rate || 1450;
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Calculate paid amounts per month
      const monthPaidMap: Record<number, number> = {};
      (payments || []).filter(p => p.status === "completed" && p.period_year === currentYear).forEach(p => {
        if (p.period_month) {
          monthPaidMap[p.period_month] = (monthPaidMap[p.period_month] || 0) + Number(p.amount);
        }
      });

      // Current month payment status
      const paidThisMonth = monthPaidMap[currentMonth] || 0;
      const isCurrentMonthPaid = paidThisMonth >= monthlyRate;
      const remainingThisMonth = Math.max(0, monthlyRate - paidThisMonth);

      // Find next unpaid month
      let nextUnpaidMonth = currentMonth;
      for (let m = 1; m <= 12; m++) {
        if ((monthPaidMap[m] || 0) < monthlyRate) {
          nextUnpaidMonth = m;
          break;
        }
        if (m === 12) nextUnpaidMonth = 13;
      }

      return {
        vendor, profile, stall, monthlyRate,
        payments: (payments || []).slice(0, 5),
        isCurrentMonthPaid, paidThisMonth, remainingThisMonth,
        nextUnpaidMonth, allPaid: nextUnpaidMonth > 12,
      };
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const stall = data?.stall;
  const vendor = data?.vendor;
  const profile = data?.profile;
  const monthlyRate = data?.monthlyRate || 1450;
  const currentMonth = new Date().getMonth() + 1;

  return (
    <div className="space-y-6">
      {/* Monthly payment status banner */}
      {data?.isCurrentMonthPaid ? (
        <div className="flex items-center justify-between rounded-xl bg-success/10 border border-success/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <span className="text-sm font-semibold text-success">{MONTHS[currentMonth - 1]} — Paid ✓</span>
              <p className="text-xs text-muted-foreground">Your stall fee for this month is settled</p>
            </div>
          </div>
          {!data?.allPaid && (
            <Link to="/vendor/pay">
              <Button size="sm" variant="outline" className="border-success/30 text-success hover:bg-success/10">
                Pay {MONTHS[(data?.nextUnpaidMonth || currentMonth) - 1]} in Advance <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-xl bg-accent/10 border border-accent/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-accent" />
            <div>
              <span className="text-sm font-semibold text-accent">{MONTHS[currentMonth - 1]} — Unpaid</span>
              {(data?.paidThisMonth || 0) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Partially paid: ₱{data?.paidThisMonth?.toLocaleString("en-PH", { minimumFractionDigits: 2 })} 
                  {" "}• Remaining: ₱{data?.remainingThisMonth?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">₱{monthlyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })} due</p>
              )}
            </div>
          </div>
          <Link to="/vendor/pay">
            <Button size="sm" variant="hero">Pay Now</Button>
          </Link>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-foreground">Stall #{stall?.stall_number || "—"}</h1>
        <p className="text-sm text-muted-foreground">{profile?.first_name} {profile?.last_name} • {stall?.section || "General"} Section</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <motion.div whileHover={{ y: -2 }} className="rounded-2xl border bg-card p-6 shadow-civic">
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {data?.isCurrentMonthPaid ? "Next Bill" : "Amount Due"}
          </span>
          <h2 className="mt-2 font-mono text-4xl font-bold text-foreground">
            ₱{(data?.isCurrentMonthPaid ? monthlyRate : (data?.remainingThisMonth || monthlyRate)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.isCurrentMonthPaid
              ? `${MONTHS[(data?.nextUnpaidMonth || currentMonth + 1) - 1] || "All Paid"} ${new Date().getFullYear()}`
              : `${MONTHS[currentMonth - 1]} ${new Date().getFullYear()}`}
          </p>
          <Link to="/vendor/pay">
            <Button variant="hero" size="lg" className="mt-4 w-full">
              <CreditCard className="mr-2 h-5 w-5" />
              {data?.isCurrentMonthPaid ? "Pay in Advance" : "Pay Now"}
            </Button>
          </Link>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} className="rounded-2xl border bg-card p-6 shadow-civic flex flex-col items-center justify-center text-center">
          <div className="mb-4">
            {vendor?.qr_code ? <QRCodeSVG value={vendor.qr_code} size={128} /> : <QrCode className="h-16 w-16 text-muted-foreground/50" />}
          </div>
          <h3 className="font-semibold text-foreground">Your Stall QR Code</h3>
          <p className="mt-1 text-xs font-mono text-muted-foreground">{vendor?.qr_code}</p>
        </motion.div>
      </div>

      {/* Recent Payments */}
      <div className="rounded-2xl border bg-card shadow-civic">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold text-foreground">Recent Payments</h3>
          <Link to="/vendor/history"><Button variant="ghost" size="sm" className="text-primary">View All</Button></Link>
        </div>
        <div className="divide-y">
          {(data?.payments || []).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                {p.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertCircle className="h-5 w-5 text-accent" />}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : new Date(p.created_at).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{p.payment_method} • {p.payment_type === "staggered" ? "Partial" : "Full"}</p>
                </div>
              </div>
              <p className="font-mono text-sm font-semibold text-foreground">₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
            </div>
          ))}
          {(data?.payments || []).length === 0 && <p className="px-4 py-8 text-center text-muted-foreground">No payments yet</p>}
        </div>
      </div>
    </div>
  );
};

export default VendorDashboardHome;
