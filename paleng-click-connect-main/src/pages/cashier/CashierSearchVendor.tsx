import { Input } from "@/components/ui/input";
import {
  Search, User, Loader2, CheckCircle2, AlertCircle, Clock,
  X, Phone, MapPin, CreditCard, TrendingUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const CashierSearchVendor = () => {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const navigate = useNavigate();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ["cashier-vendors"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data: vendorList } = await supabase
        .from("vendors")
        .select("id, user_id, qr_code, award_date, stalls(stall_number, section, monthly_rate, monthly_rate_2026, location, status)");
      if (!vendorList) return [];
      const userIds = vendorList.map(v => v.user_id);
      const [profilesRes, paymentsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, contact_number, address, status").in("user_id", userIds),
        supabase.from("payments")
          .select("vendor_id, amount, status, period_month, period_year, payment_method, payment_type, reference_number, receipt_number, created_at")
          .in("vendor_id", vendorList.map(v => v.id)).order("created_at", { ascending: false }),
      ]);
      const profiles = profilesRes.data || [];
      const allPayments = paymentsRes.data || [];
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      return vendorList.map(v => {
        const profile = profiles.find(p => p.user_id === v.user_id);
        const stall = v.stalls as any;
        const monthlyRate = stall?.monthly_rate_2026 || stall?.monthly_rate || 1450;
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
          id: v.id, userId: v.user_id, qrCode: v.qr_code, awardDate: v.award_date,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown",
          firstName: profile?.first_name || "", lastName: profile?.last_name || "",
          contact: profile?.contact_number || "—", address: profile?.address || "—",
          accountStatus: profile?.status || "active",
          stallNumber: stall?.stall_number || "—", section: stall?.section || "General",
          location: stall?.location || "—", stallStatus: stall?.status || "vacant",
          monthlyRate, isCurrentMonthPaid, paidThisMonth, remainingThisMonth,
          nextUnpaid, allPaid: nextUnpaid > 12,
          totalPaidYear, totalOutstanding, monthPaidMap,
          payments: vendorPayments.slice(0, 10),
          completedCount: completedPayments.length,
        };
      });
    },
  });

  const filtered = vendors.filter((v: any) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      v.name.toLowerCase().includes(term) ||
      v.stallNumber.toLowerCase().includes(term) ||
      v.section.toLowerCase().includes(term) ||
      (v.contact || "").toLowerCase().includes(term) ||
      (v.qrCode || "").toLowerCase().includes(term) ||
      (v.location || "").toLowerCase().includes(term) ||
      (v.address || "").toLowerCase().includes(term)
    );
  });

  const paidCount   = vendors.filter((v: any) => v.isCurrentMonthPaid).length;
  const unpaidCount = vendors.length - paidCount;

  return (
    <div className="space-y-5">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vendor Directory</h1>
        <p className="text-sm text-muted-foreground">View all vendors and check payment details</p>
      </div>

      {/* ── Stats strip ──────────────────────────────────────────────────────── */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Vendors",   value: vendors.length, icon: Users,        iconBg: "bg-blue-100",    iconColor: "#0ea5e9",  glow: "#0ea5e9",  gradient: "from-blue-50 to-blue-50/40"    },
            { label: "Paid This Month", value: paidCount,      icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "#10b981",  glow: "#10b981",  gradient: "from-emerald-50 to-emerald-50/40" },
            { label: "Unpaid / Partial",value: unpaidCount,    icon: AlertCircle,  iconBg: unpaidCount > 0 ? "bg-amber-100" : "bg-emerald-100", iconColor: unpaidCount > 0 ? "#f59e0b" : "#10b981", glow: unpaidCount > 0 ? "#f59e0b" : "#10b981", gradient: unpaidCount > 0 ? "from-amber-50 to-amber-50/40" : "from-emerald-50 to-emerald-50/40" },
          ].map(c => (
            <div key={c.label}
                 className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-md transition-all duration-300 group`}
                 style={{ minHeight: 100 }}>
              <div className={`absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-[0.08] blur-lg group-hover:opacity-[0.12] transition-opacity`}
                   style={{ background: c.glow }} />
              <div className="flex items-center justify-between z-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{c.label}</p>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${c.iconBg} group-hover:shadow-md transition-shadow`}>
                  <c.icon className="h-4.5 w-4.5" style={{ color: c.iconColor }} />
                </div>
              </div>
              <div className="z-10 mt-2">
                <p className="font-mono text-[22px] font-bold text-foreground">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Search bar ───────────────────────────────────────────────────────── */}
      <div className="relative max-w-lg">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, stall number, or section…"
          className="h-12 pl-11 rounded-xl border-border/60 bg-white"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!isLoading && (
        <p className="text-sm text-muted-foreground">
          Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
          <strong className="text-foreground">{vendors.length}</strong> vendors
          {search && ` matching "${search}"`}
        </p>
      )}

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="h-10 w-10 rounded-full bg-cashier-hero flex items-center justify-center shadow-hero">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
          <p className="text-sm text-muted-foreground">Loading vendor directory…</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-zebra">
              <thead>
                <tr className="border-b" style={{ background: "linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)" }}>
                  {["Vendor","Stall","Section","Monthly Rate","This Month","Outstanding","Account","Actions"].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((v: any) => (
                  <tr key={v.id} className="hover:bg-emerald-50/40 transition-colors cursor-pointer" onClick={() => setSelected(v)}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{v.name}</p>
                      <p className="text-xs text-muted-foreground">{v.contact}</p>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{v.stallNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.section}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{fmt(v.monthlyRate)}</td>
                    <td className="px-4 py-3">
                      {v.isCurrentMonthPaid
                        ? <span className="pill-success"><CheckCircle2 className="h-3 w-3" />Paid</span>
                        : <span className="pill-warning"><AlertCircle className="h-3 w-3" />{fmt(v.remainingThisMonth)} due</span>}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold">
                      <span className={v.totalOutstanding > 0 ? "text-red-600" : "text-emerald-600"}>
                        {v.totalOutstanding > 0 ? fmt(v.totalOutstanding) : "None"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                        v.accountStatus === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-red-50 text-red-600 border-red-200"
                      }`}>
                        {v.accountStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => setSelected(v)}>
                          View
                        </Button>
                        <Button size="sm" className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white border-0"
                          onClick={() => navigate(`/cashier/accept?vendorId=${v.id}`)}>
                          Pay
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                          <Search className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="font-medium">No vendors found</p>
                        <p className="text-xs">Try a different name, stall number, or section</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Vendor Detail Modal ───────────────────────────────────────────────── */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(13,51,32,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card rounded-2xl border shadow-civic-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="rounded-t-2xl" style={{ background: "linear-gradient(135deg,#0d3320,#0f6e56)" }}>
              <div className="flex items-center justify-between p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/20">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                    <p className="text-sm text-emerald-300/80">Stall {selected.stallNumber} · {selected.section}</p>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-xl p-2 hover:bg-white/10 transition-colors text-white/70">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Account + Stall info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <p className="section-label">Account Details</p>
                  <div className="flex items-start gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div><p className="text-xs text-muted-foreground">Contact</p><p className="font-medium">{selected.contact}</p></div>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div><p className="text-xs text-muted-foreground">Address</p><p className="font-medium">{selected.address}</p></div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold border ${selected.accountStatus === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                      {selected.accountStatus}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="section-label">Stall Details</p>
                  <div><p className="text-xs text-muted-foreground">Stall Number</p><p className="font-mono font-bold text-xl">{selected.stallNumber}</p></div>
                  <div><p className="text-xs text-muted-foreground">Section</p><p className="font-medium">{selected.section}</p></div>
                  <div><p className="text-xs text-muted-foreground">Monthly Rate</p><p className="font-mono font-bold text-foreground">{fmt(selected.monthlyRate)}</p></div>
                </div>
              </div>

              {/* Payment summary tiles */}
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="section-label mb-3">Payment Summary — {new Date().getFullYear()}</p>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: "Total Paid",    value: fmt(selected.totalPaidYear),   color: "text-emerald-700" },
                    { label: "Outstanding",   value: fmt(selected.totalOutstanding), color: selected.totalOutstanding > 0 ? "text-red-600" : "text-emerald-700" },
                    { label: "Transactions",  value: String(selected.completedCount), color: "text-foreground" },
                  ].map(c => (
                    <div key={c.label} className="rounded-xl bg-white border p-3 text-center">
                      <p className={`font-mono font-bold text-base ${c.color}`}>{c.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{MONTHS[new Date().getMonth()]} status</span>
                    <span className={`font-semibold ${selected.isCurrentMonthPaid ? "text-emerald-700" : "text-amber-700"}`}>
                      {selected.isCurrentMonthPaid ? "✓ Paid" : `${fmt(selected.remainingThisMonth)} remaining`}
                    </span>
                  </div>
                  {!selected.allPaid && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next Due</span>
                      <span className="font-medium">{selected.nextUnpaid <= 12 ? `${MONTHS[selected.nextUnpaid - 1]} ${new Date().getFullYear()}` : "All settled"}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent payments mini-table */}
              {selected.payments.length > 0 && (
                <div>
                  <p className="section-label mb-3">Recent Transactions</p>
                  <div className="rounded-xl border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          {["Date","Period","Amount","Method","Status"].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selected.payments.map((p: any) => (
                          <tr key={p.id} className="hover:bg-slate-50/60">
                            <td className="px-3 py-2 text-muted-foreground">{new Date(p.created_at).toLocaleDateString("en-PH")}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.period_month && p.period_year ? `${MONTHS[p.period_month - 1].slice(0,3)} ${p.period_year}` : "—"}</td>
                            <td className="px-3 py-2 font-mono font-semibold text-foreground">{fmt(Number(p.amount))}</td>
                            <td className="px-3 py-2 capitalize text-muted-foreground">{p.payment_method}</td>
                            <td className="px-3 py-2">
                              <span className={`font-semibold ${p.status === "completed" ? "text-emerald-600" : p.status === "pending" ? "text-amber-600" : "text-red-500"}`}>
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
              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1 gap-2 rounded-xl bg-cashier-hero text-white shadow-hero btn-lift border-0"
                  style={{ background: "linear-gradient(135deg,#0d3320,#0f6e56)" }}
                  onClick={() => { setSelected(null); navigate(`/cashier/accept?vendorId=${selected.id}`); }}
                >
                  <CreditCard className="h-4 w-4" /> Accept Payment
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setSelected(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierSearchVendor;