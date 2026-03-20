import { Input } from "@/components/ui/input";
import { Search, User, Loader2, CheckCircle2, AlertCircle, Clock, X, Phone, MapPin, QrCode, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const CashierSearchVendor = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const navigate = useNavigate();

  // ── Fetch all vendors with full details ───────────────────────────────────
  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["cashier-vendors"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: vendorList } = await supabase
        .from("vendors")
        .select("id, user_id, qr_code, award_date, stalls(stall_number, section, monthly_rate, location, status)");
      if (!vendorList) return [];

      const userIds = vendorList.map(v => v.user_id);

      const [profilesRes, paymentsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, contact_number, address, status").in("user_id", userIds),
        supabase.from("payments").select("vendor_id, amount, status, period_month, period_year, payment_method, payment_type, reference_number, receipt_number, created_at")
          .in("vendor_id", vendorList.map(v => v.id))
          .order("created_at", { ascending: false }),
      ]);

      const profiles = profilesRes.data || [];
      const allPayments = paymentsRes.data || [];
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      return vendorList.map(v => {
        const profile = profiles.find(p => p.user_id === v.user_id);
        const stall = v.stalls as any;
        const monthlyRate = stall?.monthly_rate || 1450;
        const vendorPayments = allPayments.filter(p => p.vendor_id === v.id);
        const completedPayments = vendorPayments.filter(p => p.status === "completed" && p.period_year === currentYear);

        const monthPaidMap: Record<number, number> = {};
        completedPayments.forEach(p => {
          if (p.period_month) monthPaidMap[p.period_month] = (monthPaidMap[p.period_month] || 0) + Number(p.amount);
        });

        const paidThisMonth = monthPaidMap[currentMonth] || 0;
        const isCurrentMonthPaid = paidThisMonth >= monthlyRate;
        const remainingThisMonth = Math.max(0, monthlyRate - paidThisMonth);

        let nextUnpaid = currentMonth;
        for (let m = 1; m <= 12; m++) {
          if ((monthPaidMap[m] || 0) < monthlyRate) { nextUnpaid = m; break; }
          if (m === 12) nextUnpaid = 13;
        }

        const totalPaidYear = Object.values(monthPaidMap).reduce((s, v) => s + v, 0);
        const totalOutstanding = MONTHS.reduce((sum, _, i) => {
          const month = i + 1;
          if (month > currentMonth) return sum;
          return sum + Math.max(0, monthlyRate - (monthPaidMap[month] || 0));
        }, 0);

        return {
          id: v.id,
          userId: v.user_id,
          qrCode: v.qr_code,
          awardDate: v.award_date,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
          firstName: profile?.first_name || "",
          lastName: profile?.last_name || "",
          contact: profile?.contact_number || "—",
          address: profile?.address || "—",
          accountStatus: profile?.status || "active",
          stallNumber: stall?.stall_number || "—",
          section: stall?.section || "General",
          location: stall?.location || "—",
          stallStatus: stall?.status || "vacant",
          monthlyRate,
          isCurrentMonthPaid,
          paidThisMonth,
          remainingThisMonth,
          nextUnpaid,
          allPaid: nextUnpaid > 12,
          totalPaidYear,
          totalOutstanding,
          monthPaidMap,
          payments: vendorPayments.slice(0, 10),
          completedCount: completedPayments.length,
        };
      });
    },
  });

  const filtered = vendors.filter((v: any) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.stallNumber.toLowerCase().includes(search.toLowerCase()) ||
    v.section.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vendor Directory</h1>
        <p className="text-sm text-muted-foreground">View all vendors, search, and check account details</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, stall, or section..."
          className="h-12 pl-10 rounded-xl"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Summary */}
      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length} of {vendors.length} vendors
          {search && ` matching "${search}"`}
        </p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stall</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Section</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Monthly Rate</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">This Month</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Outstanding</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((v: any) => (
                <tr key={v.id} className="hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelected(v)}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.contact}</p>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground">{v.stallNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.section}</td>
                  <td className="px-4 py-3 font-mono text-foreground">₱{v.monthlyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${v.isCurrentMonthPaid ? "text-success" : "text-accent"}`}>
                      {v.isCurrentMonthPaid ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {v.isCurrentMonthPaid ? "Paid" : `₱${v.remainingThisMonth.toLocaleString("en-PH", { minimumFractionDigits: 2 })} due`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">
                    <span className={v.totalOutstanding > 0 ? "text-accent font-semibold" : "text-success"}>
                      {v.totalOutstanding > 0 ? `₱${v.totalOutstanding.toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "None"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.accountStatus === "active" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>
                      {v.accountStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSelected(v)}>
                        View
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={() => navigate(`/cashier/accept?vendorId=${v.id}`)}>
                        Pay
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No vendors found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VENDOR DETAIL MODAL ──────────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="text-lg font-bold text-foreground">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">Stall {selected.stallNumber} · {selected.section}</p>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Account Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">Account Details</h3>
                  <div className="flex items-start gap-2"><Phone className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-muted-foreground text-xs">Contact</p><p className="font-medium text-foreground">{selected.contact}</p></div></div>
                  <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-muted-foreground text-xs">Address</p><p className="font-medium text-foreground">{selected.address}</p></div></div>
                  <div className="flex items-start gap-2"><User className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-muted-foreground text-xs">Status</p>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${selected.accountStatus === "active" ? "bg-success/10 text-success" : "bg-accent/10 text-accent"}`}>{selected.accountStatus}</span>
                  </div></div>
                  {selected.awardDate && (
                    <div><p className="text-muted-foreground text-xs">Award Date</p><p className="font-medium text-foreground">{new Date(selected.awardDate).toLocaleDateString("en-PH")}</p></div>
                  )}
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">Stall Details</h3>
                  <div><p className="text-muted-foreground text-xs">Stall Number</p><p className="font-mono font-bold text-foreground text-lg">{selected.stallNumber}</p></div>
                  <div><p className="text-muted-foreground text-xs">Section</p><p className="font-medium text-foreground">{selected.section}</p></div>
                  <div><p className="text-muted-foreground text-xs">Location</p><p className="font-medium text-foreground">{selected.location}</p></div>
                  <div><p className="text-muted-foreground text-xs">Monthly Rate</p><p className="font-mono font-bold text-foreground">₱{selected.monthlyRate.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p></div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="rounded-xl border bg-secondary/30 p-4 space-y-2 text-sm">
                <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground mb-3">Payment Summary — {new Date().getFullYear()}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-card border p-3 text-center">
                    <p className="font-mono font-bold text-success text-base">₱{selected.totalPaidYear.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Paid</p>
                  </div>
                  <div className="rounded-lg bg-card border p-3 text-center">
                    <p className={`font-mono font-bold text-base ${selected.totalOutstanding > 0 ? "text-accent" : "text-success"}`}>
                      ₱{selected.totalOutstanding.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
                  </div>
                  <div className="rounded-lg bg-card border p-3 text-center">
                    <p className="font-mono font-bold text-foreground text-base">{selected.completedCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">Transactions</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground">This Month ({MONTHS[new Date().getMonth()]})</span>
                  <span className={`font-semibold ${selected.isCurrentMonthPaid ? "text-success" : "text-accent"}`}>
                    {selected.isCurrentMonthPaid ? "✓ Paid" : `₱${selected.remainingThisMonth.toLocaleString("en-PH", { minimumFractionDigits: 2 })} remaining`}
                  </span>
                </div>
                {!selected.allPaid && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Next Due</span>
                    <span className="font-medium text-foreground">
                      {selected.nextUnpaid <= 12 ? `${MONTHS[selected.nextUnpaid - 1]} ${new Date().getFullYear()}` : "All settled"}
                    </span>
                  </div>
                )}
              </div>

              {/* Recent Payments */}
              {selected.payments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground mb-3">Recent Transactions</h3>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-secondary/50">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Period</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Amount</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Method</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Reference</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selected.payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-secondary/30">
                            <td className="px-3 py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-PH")}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : "—"}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-foreground">₱{Number(p.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 capitalize text-muted-foreground">{p.payment_method}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.payment_type === "staggered" ? "Partial" : "Full"}</td>
                            <td className="px-3 py-2 font-mono text-muted-foreground">{p.reference_number || "—"}</td>
                            <td className="px-3 py-2">
                              <span className={`font-semibold ${p.status === "completed" ? "text-success" : p.status === "pending" ? "text-primary" : "text-accent"}`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="hero"
                  className="flex-1"
                  onClick={() => { setSelected(null); navigate(`/cashier/accept?vendorId=${selected.id}`); }}
                >
                  <CreditCard className="mr-2 h-4 w-4" /> Accept Payment
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierSearchVendor;