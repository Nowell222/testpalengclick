import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download, Printer, FileText, Loader2, TrendingUp, FileSpreadsheet,
  TrendingDown, Minus, RefreshCw, Calendar, Users,
  CreditCard, Banknote, Smartphone, Building2, CheckCircle2,
  AlertCircle, Clock, BarChart2, PieChart, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart as RePieChart,
  Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Constants ────────────────────────────────────────────────────────────────
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const COLORS = ["#0f6e56","#1d9e75","#5dcaa5","#9fe1cb","#185fa5","#378add","#85b7eb","#EF9F27","#BA7517"];

const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtShort = (n: number) => n >= 1000 ? `₱${(n/1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;

// ─── Print helpers ─────────────────────────────────────────────────────────────
const printHTML = (title: string, body: string) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:12px;color:#1a1a1a;padding:28px}
  .hdr{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:18px}
  .hdr .rep{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase}
  .hdr .lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .hdr .ttl{font-size:17px;font-weight:bold;letter-spacing:1px;margin-top:5px}
  .hdr .sub{font-size:10px;color:#666;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  thead tr{background:#1a1a1a;color:#fff}
  thead th{padding:7px 9px;text-align:left;font-size:11px}
  thead th.r{text-align:right}
  tbody tr{border-bottom:1px solid #e5e5e5}
  tbody td{padding:6px 9px}
  td.r{text-align:right;font-family:monospace}
  td.mono{font-family:monospace}
  .sum{border-top:2px solid #1a1a1a;padding:10px;display:flex;justify-content:space-between}
  .sum span{font-weight:bold}
  .badge{display:inline-block;padding:2px 7px;border-radius:20px;font-size:10px;font-weight:bold}
  .paid{background:#d4edda;color:#155724}
  .pend{background:#fff3cd;color:#856404}
  .fail{background:#f8d7da;color:#721c24}
  .footer{margin-top:24px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
  .stat-box{border:1px solid #ddd;border-radius:6px;padding:10px;text-align:center}
  .stat-box .val{font-size:16px;font-weight:bold;font-family:monospace;color:#1a1a1a}
  .stat-box .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines · Municipality of San Juan, Batangas</div>
  <div class="lgu">Office of the Municipal Treasurer</div>
  <div class="ttl">${title}</div>
  <div class="sub">Printed: ${new Date().toLocaleString("en-PH")}</div>
</div>
${body}
<div class="footer">PALENG-CLICK System · Computer-generated report · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;

// ─── CSV Export helper ────────────────────────────────────────────────────────
const exportCSV = (filename: string, rows: string[][], headers: string[]) => {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
};

// ─── Component ─────────────────────────────────────────────────────────────────
const CashierReports = () => {
  const [activeTab,    setActiveTab]    = useState<"analytics"|"daily"|"receipts"|"vendor-status">("analytics");
  const [chartView,    setChartView]    = useState<"daily"|"weekly"|"monthly">("weekly");
  const [dateFrom,     setDateFrom]     = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 6);
    return d.toISOString().split("T")[0];
  });
  const [dateTo,       setDateTo]       = useState(() => new Date().toISOString().split("T")[0]);
  const [reportYear,   setReportYear]   = useState(new Date().getFullYear());
  const [reportMonth,  setReportMonth]  = useState(new Date().getMonth());
  const printRef = useRef<HTMLIFrameElement>(null);

  const today = new Date().toISOString().split("T")[0];

  // ── Fetch ALL payments ────────────────────────────────────────────────────
  const { data: allData, isLoading, refetch } = useQuery({
    queryKey: ["cashier-reports-all"],
    refetchInterval: 30000,
    queryFn: async () => {
      const yearStart = `${new Date().getFullYear()}-01-01T00:00:00`;

      const [paymentsRes, vendorsRes] = await Promise.all([
        supabase.from("payments").select("*").gte("created_at", yearStart).order("created_at", { ascending: false }),
        supabase.from("vendors").select("id, user_id, stalls(stall_number, section, monthly_rate)"),
      ]);

      const payments = paymentsRes.data || [];
      const vendors  = vendorsRes.data  || [];
      const userIds  = vendors.map(v => v.user_id);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, contact_number")
        .in("user_id", userIds);

      const enriched = payments.map(p => {
        const v   = vendors.find(v => v.id === p.vendor_id);
        const pr  = profiles?.find(pr => pr.user_id === v?.user_id);
        const st  = v?.stalls as any;
        return {
          ...p,
          vendor_name:  pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
          contact:      pr?.contact_number || "—",
          stall_number: st?.stall_number || "—",
          section:      st?.section || "General",
          monthly_rate: st?.monthly_rate || 1450,
        };
      });

      // Vendor payment status
      const currentYear  = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;
      const vendorStatus = vendors.map(v => {
        const st   = v.stalls as any;
        const pr   = profiles?.find(pr => pr.user_id === v.user_id);
        const rate = st?.monthly_rate || 1450;
        const vPay = payments.filter(p => p.vendor_id === v.id && p.status === "completed" && p.period_year === currentYear);
        const map: Record<number,number> = {};
        vPay.forEach(p => { if (p.period_month) map[p.period_month] = (map[p.period_month]||0)+Number(p.amount); });
        const totalPaid = Object.values(map).reduce((s,v)=>s+v, 0);
        const outstanding = MONTHS_FULL.reduce((sum,_,i) => {
          const m = i+1;
          return m > currentMonth ? sum : sum + Math.max(0, rate - (map[m]||0));
        }, 0);
        const paidThisMonth = map[currentMonth] || 0;
        return {
          vendorId: v.id, name: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
          stall: st?.stall_number || "—", section: st?.section || "General",
          rate, totalPaid, outstanding,
          thisMonthStatus: paidThisMonth >= rate ? "paid" : paidThisMonth > 0 ? "partial" : "unpaid",
          paidThisMonth, remainingThisMonth: Math.max(0, rate - paidThisMonth),
        };
      });

      return { enriched, vendorStatus, vendors, profiles };
    },
  });

  // ── Derived data ──────────────────────────────────────────────────────────
  const completed = useMemo(() =>
    (allData?.enriched || []).filter((p: any) => p.status === "completed"), [allData]);

  // Range-filtered payments
  const rangePayments = useMemo(() => {
    return completed.filter((p: any) => {
      const d = p.created_at?.split("T")[0];
      return d >= dateFrom && d <= dateTo;
    });
  }, [completed, dateFrom, dateTo]);

  // ── Chart data ─────────────────────────────────────────────────────────────
  const dailyChartData = useMemo(() => {
    const map: Record<string,number> = {};
    const start = new Date(dateFrom), end = new Date(dateTo);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      map[d.toISOString().split("T")[0]] = 0;
    }
    rangePayments.forEach((p: any) => {
      const k = p.created_at?.split("T")[0];
      if (k && map[k] !== undefined) map[k] = (map[k]||0) + Number(p.amount);
    });
    return Object.entries(map).map(([date, amount]) => ({
      date, amount,
      label: new Date(date).toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
    }));
  }, [rangePayments, dateFrom, dateTo]);

  const weeklyChartData = useMemo(() => {
    const map: Record<string, number> = {};
    completed.forEach((p: any) => {
      const d = new Date(p.created_at);
      const week = `W${Math.ceil(d.getDate()/7)} ${MONTHS[d.getMonth()]}`;
      map[week] = (map[week]||0) + Number(p.amount);
    });
    return Object.entries(map).slice(-12).map(([week,amount]) => ({ week, amount }));
  }, [completed]);

  const monthlyChartData = useMemo(() => {
    const map: Record<number, number> = {};
    MONTHS.forEach((_, i) => map[i] = 0);
    completed.filter((p: any) => p.period_year === reportYear || new Date(p.created_at).getFullYear() === reportYear)
      .forEach((p: any) => {
        const m = new Date(p.created_at).getMonth();
        map[m] = (map[m]||0) + Number(p.amount);
      });
    return MONTHS.map((m, i) => ({ month: m, amount: map[i] }));
  }, [completed, reportYear]);

  // Method breakdown
  const methodData = useMemo(() => {
    const map: Record<string,number> = {};
    rangePayments.forEach((p: any) => {
      map[p.payment_method] = (map[p.payment_method]||0) + Number(p.amount);
    });
    return Object.entries(map).map(([method, amount]) => ({
      method: method === "paymaya" ? "Maya" : method.charAt(0).toUpperCase()+method.slice(1),
      amount,
    }));
  }, [rangePayments]);

  // Section breakdown
  const sectionData = useMemo(() => {
    const map: Record<string,number> = {};
    rangePayments.forEach((p: any) => {
      map[p.section] = (map[p.section]||0) + Number(p.amount);
    });
    return Object.entries(map).map(([section, amount]) => ({ section, amount }));
  }, [rangePayments]);

  // Summary stats
  const stats = useMemo(() => {
    const todayStr   = today;
    const todayPay   = completed.filter((p: any) => p.created_at?.startsWith(todayStr));
    const weekStart  = new Date(); weekStart.setDate(weekStart.getDate()-6);
    const weekPay    = completed.filter((p: any) => new Date(p.created_at) >= weekStart);
    const monthPay   = completed.filter((p: any) => {
      const d = new Date(p.created_at);
      return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
    });
    const prevMonthStart = new Date(); prevMonthStart.setMonth(prevMonthStart.getMonth()-1, 1);
    const prevMonthEnd   = new Date(); prevMonthEnd.setDate(0);
    const prevPay = completed.filter((p: any) => {
      const d = new Date(p.created_at);
      return d >= prevMonthStart && d <= prevMonthEnd;
    });
    const prevTotal  = prevPay.reduce((s: number, p: any) => s+Number(p.amount), 0);
    const monthTotal = monthPay.reduce((s: number, p: any) => s+Number(p.amount), 0);
    const trend = prevTotal > 0 ? ((monthTotal - prevTotal) / prevTotal * 100) : 0;

    return {
      today:      todayPay.reduce((s: number, p: any) => s+Number(p.amount), 0),
      todayCount: todayPay.length,
      week:       weekPay.reduce((s: number, p: any) => s+Number(p.amount), 0),
      weekCount:  weekPay.length,
      month:      monthTotal,
      monthCount: monthPay.length,
      trend,
      range:      rangePayments.reduce((s: number, p: any) => s+Number(p.amount), 0),
      rangeCount: rangePayments.length,
      pending:    (allData?.enriched||[]).filter((p: any)=>p.status==="pending").length,
      totalOutstanding: (allData?.vendorStatus||[]).reduce((s: number, v: any)=>s+v.outstanding, 0),
      vendorsPaid: (allData?.vendorStatus||[]).filter((v: any)=>v.thisMonthStatus==="paid").length,
      vendorsTotal: (allData?.vendorStatus||[]).length,
    };
  }, [completed, allData, rangePayments, today]);

  // ── Print functions ────────────────────────────────────────────────────────
  const doPrint = (html: string) => {
    const frame = printRef.current;
    if (!frame) return;
    frame.srcdoc = html;
    frame.onload = () => setTimeout(() => frame.contentWindow?.print(), 300);
  };


  const exportDailyCSV = () => {
    const tp = completed.filter((p: any) => p.created_at?.startsWith(today));
    const headers = ["Time","Vendor","Stall","Period","Amount","Method","Type","Reference No.","Receipt No."];
    const rows = tp.map((p: any) => [
      new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"}),
      p.vendor_name, p.stall_number,
      p.period_month ? `${MONTHS_FULL[p.period_month-1]} ${p.period_year}` : "",
      String(Number(p.amount).toFixed(2)), p.payment_method,
      p.payment_type==="staggered"?"Partial":"Full",
      p.reference_number||"", p.receipt_number||"",
    ]);
    exportCSV(`daily-collection-${today}.csv`, rows, headers);
  };

  const exportReceiptCSV = () => {
    const headers = ["Receipt No.","Reference No.","Date","Vendor","Stall","Section","Period","Amount","Method","Type"];
    const rows = rangePayments.map((p: any) => [
      p.receipt_number||"", p.reference_number||"",
      new Date(p.created_at).toLocaleDateString("en-PH"),
      p.vendor_name, p.stall_number, p.section,
      p.period_month ? `${MONTHS_FULL[p.period_month-1]} ${p.period_year}` : "",
      String(Number(p.amount).toFixed(2)),
      p.payment_method==="paymaya"?"Maya":p.payment_method,
      p.payment_type==="staggered"?"Partial":"Full",
    ]);
    exportCSV(`receipt-log-${dateFrom}-to-${dateTo}.csv`, rows, headers);
  };

  const exportVendorStatusCSV = () => {
    const headers = ["Vendor","Stall","Section","Monthly Rate","Total Paid","Outstanding","This Month Status","Remaining This Month"];
    const vs = allData?.vendorStatus || [];
    const rows = vs.map((v: any) => [
      v.name, v.stall, v.section,
      String(v.rate.toFixed(2)),
      String(v.totalPaid.toFixed(2)),
      String(v.outstanding.toFixed(2)),
      v.thisMonthStatus,
      String(v.remainingThisMonth.toFixed(2)),
    ]);
    exportCSV(`vendor-status-${MONTHS_FULL[new Date().getMonth()]}-${new Date().getFullYear()}.csv`, rows, headers);
  };
  const printDailyReport = () => {
    const dayPayments = completed.filter((p: any) => p.created_at?.startsWith(today));
    const total = dayPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const rows = dayPayments.map((p: any) => `
      <tr>
        <td class="mono">${new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</td>
        <td>${p.vendor_name}</td>
        <td class="mono">${p.stall_number}</td>
        <td>${MONTHS_FULL[p.period_month-1]||"—"} ${p.period_year||""}</td>
        <td class="r">₱${Number(p.amount).toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
        <td>${p.payment_method}</td>
        <td class="mono">${p.reference_number||"—"}</td>
        <td class="mono">${p.receipt_number||"—"}</td>
      </tr>`).join("") || `<tr><td colspan="8" style="text-align:center;padding:20px;color:#888">No collections today</td></tr>`;

    doPrint(printHTML(`Daily Collection Report — ${new Date().toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}`,`
      <div class="stats">
        <div class="stat-box"><div class="val">₱${total.toLocaleString("en-PH",{minimumFractionDigits:2})}</div><div class="lbl">Total Collected</div></div>
        <div class="stat-box"><div class="val">${dayPayments.length}</div><div class="lbl">Transactions</div></div>
        <div class="stat-box"><div class="val">${dayPayments.filter((p:any)=>p.payment_method==="cash").length}</div><div class="lbl">Cash</div></div>
        <div class="stat-box"><div class="val">${dayPayments.filter((p:any)=>p.payment_method!=="cash").length}</div><div class="lbl">Online</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Time</th><th>Vendor</th><th>Stall</th><th>Period</th>
          <th class="r">Amount</th><th>Method</th><th>Reference</th><th>Receipt</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sum"><span>TOTAL COLLECTIONS — ${new Date().toLocaleDateString("en-PH")}</span><span>₱${total.toLocaleString("en-PH",{minimumFractionDigits:2})}</span></div>
    `));
  };

  const printReceiptLog = () => {
    const start = dateFrom, end = dateTo;
    const filtered = completed.filter((p: any) => {
      const d = p.created_at?.split("T")[0];
      return d >= start && d <= end;
    });
    const total = filtered.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const rows = filtered.map((p: any) => `
      <tr>
        <td class="mono">${p.receipt_number||"—"}</td>
        <td class="mono">${p.reference_number||"—"}</td>
        <td>${new Date(p.created_at).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"})}</td>
        <td>${p.vendor_name}</td>
        <td class="mono">${p.stall_number}</td>
        <td>${MONTHS_FULL[(p.period_month||1)-1]||"—"} ${p.period_year||""}</td>
        <td class="r">₱${Number(p.amount).toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
        <td>${p.payment_method==="paymaya"?"Maya":p.payment_method}</td>
        <td class="r">${p.payment_type==="staggered"?"Partial":"Full"}</td>
      </tr>`).join("") || `<tr><td colspan="9" style="text-align:center;padding:20px;color:#888">No receipts in range</td></tr>`;

    doPrint(printHTML(`Payment Receipt Log — ${new Date(start).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} to ${new Date(end).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`,`
      <div class="stats">
        <div class="stat-box"><div class="val">₱${total.toLocaleString("en-PH",{minimumFractionDigits:2})}</div><div class="lbl">Total Amount</div></div>
        <div class="stat-box"><div class="val">${filtered.length}</div><div class="lbl">Receipts Issued</div></div>
        <div class="stat-box"><div class="val">${filtered.filter((p:any)=>p.payment_type==="due").length}</div><div class="lbl">Full Payments</div></div>
        <div class="stat-box"><div class="val">${filtered.filter((p:any)=>p.payment_type==="staggered").length}</div><div class="lbl">Partial</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Receipt No.</th><th>Reference No.</th><th>Date</th><th>Vendor</th>
          <th>Stall</th><th>Period</th><th class="r">Amount</th><th>Method</th><th class="r">Type</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sum"><span>TOTAL — ${filtered.length} receipts</span><span>₱${total.toLocaleString("en-PH",{minimumFractionDigits:2})}</span></div>
    `));
  };

  const printVendorStatus = () => {
    const vs = allData?.vendorStatus || [];
    const rows = vs.map((v: any) => `
      <tr>
        <td>${v.name}</td>
        <td class="mono">${v.stall}</td>
        <td>${v.section}</td>
        <td class="r">₱${v.rate.toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
        <td class="r">₱${v.totalPaid.toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
        <td class="r" style="${v.outstanding>0?"color:#c0392b;font-weight:bold":"color:#27ae60"}">₱${v.outstanding.toLocaleString("en-PH",{minimumFractionDigits:2})}</td>
        <td style="text-align:center"><span class="badge ${v.thisMonthStatus==="paid"?"paid":v.thisMonthStatus==="partial"?"pend":"fail"}">${v.thisMonthStatus==="paid"?"Paid":v.thisMonthStatus==="partial"?"Partial":"Unpaid"}</span></td>
      </tr>`).join("");
    const totalOut = vs.reduce((s: number, v: any)=>s+v.outstanding, 0);

    doPrint(printHTML(`Vendor Payment Status — ${MONTHS_FULL[new Date().getMonth()]} ${new Date().getFullYear()}`,`
      <div class="stats">
        <div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="paid").length}</div><div class="lbl">Paid This Month</div></div>
        <div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="partial").length}</div><div class="lbl">Partial</div></div>
        <div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="unpaid").length}</div><div class="lbl">Unpaid</div></div>
        <div class="stat-box"><div class="val">₱${totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}</div><div class="lbl">Total Outstanding</div></div>
      </div>
      <table>
        <thead><tr>
          <th>Vendor</th><th>Stall</th><th>Section</th>
          <th class="r">Monthly Rate</th><th class="r">Total Paid</th>
          <th class="r">Outstanding</th><th style="text-align:center">This Month</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="sum"><span>TOTAL OUTSTANDING BALANCE</span><span>₱${totalOut.toLocaleString("en-PH",{minimumFractionDigits:2})}</span></div>
    `));
  };

  // ── Quick date shortcuts ───────────────────────────────────────────────────
  const setQuickDate = (type: string) => {
    const now = new Date();
    const t = now.toISOString().split("T")[0];
    if (type === "today")     { setDateFrom(t); setDateTo(t); }
    if (type === "week")      { const s=new Date(now); s.setDate(s.getDate()-6); setDateFrom(s.toISOString().split("T")[0]); setDateTo(t); }
    if (type === "month")     { setDateFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`); setDateTo(t); }
    if (type === "last-month"){ const p=new Date(now.getFullYear(),now.getMonth()-1,1); const e=new Date(now.getFullYear(),now.getMonth(),0); setDateFrom(p.toISOString().split("T")[0]); setDateTo(e.toISOString().split("T")[0]); }
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>;

  const tabs = [
    { id: "analytics",      label: "Analytics",        icon: BarChart2 },
    { id: "daily",          label: "Daily Collection",  icon: Calendar },
    { id: "receipts",       label: "Receipt Log",       icon: FileText },
    { id: "vendor-status",  label: "Vendor Status",     icon: Users },
  ] as const;

  return (
    <div className="space-y-6">
      <iframe ref={printRef} style={{ display:"none" }} title="print-frame"/>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Collection reports, analytics, and vendor payment insights</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1">
          <RefreshCw className="h-3.5 w-3.5"/> Refresh
        </button>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Today",        value: fmt(stats.today),       sub: `${stats.todayCount} transactions`,   icon: Calendar,    color: "text-success" },
          { label:"This Week",    value: fmt(stats.week),        sub: `${stats.weekCount} transactions`,    icon: Activity,    color: "text-primary" },
          { label:"This Month",   value: fmt(stats.month),       sub: `${stats.monthCount} transactions`,   icon: TrendingUp,  color: "text-foreground" },
          { label:"Outstanding",  value: fmt(stats.totalOutstanding), sub: `${stats.vendorsTotal - stats.vendorsPaid} vendors unpaid`, icon: AlertCircle, color: "text-accent" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <c.icon className={`h-4 w-4 ${c.color}`}/>
            </div>
            <p className={`font-mono text-lg font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
              activeTab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}>
            <t.icon className="h-3.5 w-3.5"/>{t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ ANALYTICS TAB ═══════════════════════════════════════ */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Date range + chart type controls */}
          <div className="rounded-2xl border bg-card p-4 shadow-civic space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm font-medium text-foreground">Date Range</p>
              <div className="flex gap-1 flex-wrap">
                {[["today","Today"],["week","This Week"],["month","This Month"],["last-month","Last Month"]].map(([k,l]) => (
                  <button key={k} onClick={() => setQuickDate(k)}
                    className="rounded-lg border px-3 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors">
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">From</label>
                <Input type="date" className="h-9 rounded-xl text-sm" value={dateFrom} max={today} onChange={e=>setDateFrom(e.target.value)}/>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">To</label>
                <Input type="date" className="h-9 rounded-xl text-sm" value={dateTo} max={today} onChange={e=>setDateTo(e.target.value)}/>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Year (monthly view)</label>
                <select className="h-9 rounded-xl border bg-background px-3 text-sm"
                  value={reportYear} onChange={e=>setReportYear(Number(e.target.value))}>
                  {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{stats.rangeCount}</strong> transactions ·{" "}
                <strong className="text-foreground">{fmt(stats.range)}</strong> collected
              </p>
              <div className="flex gap-1">
                {(["daily","weekly","monthly"] as const).map(v => (
                  <button key={v} onClick={()=>setChartView(v)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all ${
                      chartView===v ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}>{v}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Main collection chart */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground capitalize">{chartView} Collections</h3>
                <p className="text-xs text-muted-foreground">{fmt(stats.range)} total in selected range</p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary"/>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              {chartView === "daily" ? (
                <AreaChart data={dailyChartData}>
                  <defs>
                    <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f6e56" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#0f6e56" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,88%)"/>
                  <XAxis dataKey="label" tick={{fontSize:11,fill:"hsl(220,10%,42%)"}}/>
                  <YAxis tick={{fontSize:11,fill:"hsl(220,10%,42%)"}} tickFormatter={fmtShort}/>
                  <Tooltip formatter={(v:number)=>fmt(v)} labelFormatter={(l)=>l}/>
                  <Area type="monotone" dataKey="amount" stroke="#0f6e56" fill="url(#colGrad)" strokeWidth={2}/>
                </AreaChart>
              ) : chartView === "weekly" ? (
                <BarChart data={weeklyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,88%)"/>
                  <XAxis dataKey="week" tick={{fontSize:11,fill:"hsl(220,10%,42%)"}}/>
                  <YAxis tick={{fontSize:11,fill:"hsl(220,10%,42%)"}} tickFormatter={fmtShort}/>
                  <Tooltip formatter={(v:number)=>fmt(v)}/>
                  <Bar dataKey="amount" fill="#1d9e75" radius={[6,6,0,0]}/>
                </BarChart>
              ) : (
                <LineChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,88%)"/>
                  <XAxis dataKey="month" tick={{fontSize:11,fill:"hsl(220,10%,42%)"}}/>
                  <YAxis tick={{fontSize:11,fill:"hsl(220,10%,42%)"}} tickFormatter={fmtShort}/>
                  <Tooltip formatter={(v:number)=>fmt(v)}/>
                  <Line type="monotone" dataKey="amount" stroke="#185fa5" strokeWidth={2} dot={{fill:"#185fa5",r:4}}/>
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Method + Section breakdown */}
          <div className="grid gap-5 sm:grid-cols-2">
            {/* Payment method pie */}
            <div className="rounded-2xl border bg-card p-5 shadow-civic">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="h-4 w-4 text-primary"/>
                <h3 className="font-semibold text-foreground">By Payment Method</h3>
              </div>
              {methodData.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No data in range</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <RePieChart>
                    <Pie data={methodData} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={75} label={({method,percent})=>`${method} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                      {methodData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v:number)=>fmt(v)}/>
                  </RePieChart>
                </ResponsiveContainer>
              )}
              <div className="mt-2 space-y-1.5">
                {methodData.map((m,i) => (
                  <div key={m.method} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{background:COLORS[i%COLORS.length]}}/>
                      <span className="text-muted-foreground">{m.method}</span>
                    </span>
                    <span className="font-mono font-medium text-foreground">{fmt(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Section breakdown bar */}
            <div className="rounded-2xl border bg-card p-5 shadow-civic">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-4 w-4 text-primary"/>
                <h3 className="font-semibold text-foreground">By Market Section</h3>
              </div>
              {sectionData.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No data in range</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sectionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,88%)"/>
                    <XAxis type="number" tick={{fontSize:10}} tickFormatter={fmtShort}/>
                    <YAxis type="category" dataKey="section" tick={{fontSize:11}} width={70}/>
                    <Tooltip formatter={(v:number)=>fmt(v)}/>
                    <Bar dataKey="amount" fill="#185fa5" radius={[0,6,6,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Vendor payment rate */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-4 w-4 text-primary"/>
              <h3 className="font-semibold text-foreground">Vendor Payment Rate — {MONTHS_FULL[new Date().getMonth()]}</h3>
            </div>
            <div className="flex items-center gap-4 mb-3">
              {[
                { label:"Paid",    count:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length,    color:"bg-success" },
                { label:"Partial", count:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length,  color:"bg-primary" },
                { label:"Unpaid",  count:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="unpaid").length,   color:"bg-accent" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color}`}/>
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className="font-bold text-foreground">{s.count}</span>
                </div>
              ))}
            </div>
            <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
              {(() => {
                const total = stats.vendorsTotal || 1;
                const paid    = (allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length;
                const partial = (allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length;
                return (<>
                  <div className="h-full bg-success transition-all" style={{width:`${paid/total*100}%`}}/>
                  <div className="h-full bg-primary transition-all" style={{width:`${partial/total*100}%`}}/>
                  <div className="h-full bg-accent transition-all" style={{width:`${(total-paid-partial)/total*100}%`}}/>
                </>);
              })()}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {stats.vendorsPaid} of {stats.vendorsTotal} vendors paid this month ({stats.vendorsTotal > 0 ? Math.round(stats.vendorsPaid/stats.vendorsTotal*100) : 0}%)
            </p>
          </div>
        </div>
      )}

      {/* ══════════════ DAILY COLLECTION TAB ════════════════════════════════ */}
      {activeTab === "daily" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Daily Collection Report</h2>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={exportDailyCSV}>
                <FileSpreadsheet className="h-4 w-4"/> Export CSV
              </Button>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printDailyReport}>
                <Printer className="h-4 w-4"/> Print
              </Button>
              <Button variant="hero" className="gap-2 rounded-xl" onClick={printDailyReport}>
                <Download className="h-4 w-4"/> Save PDF
              </Button>
            </div>
          </div>

          {/* Today summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(() => {
              const tp = completed.filter((p: any) => p.created_at?.startsWith(today));
              const total = tp.reduce((s: number, p: any) => s+Number(p.amount), 0);
              return [
                { label:"Total Collected", value: fmt(total), color:"text-success" },
                { label:"Transactions",    value: String(tp.length), color:"text-foreground" },
                { label:"Cash",            value: String(tp.filter((p:any)=>p.payment_method==="cash").length), color:"text-foreground" },
                { label:"Online",          value: String(tp.filter((p:any)=>p.payment_method!=="cash").length), color:"text-primary" },
              ];
            })().map(c => (
              <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`font-mono text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Today's table */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  {["Time","Vendor","Stall","Period","Amount","Method","Type","Reference","Receipt"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {completed.filter((p: any) => p.created_at?.startsWith(today)).map((p: any) => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.vendor_name}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{p.stall_number}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{MONTHS_FULL[(p.period_month||1)-1]} {p.period_year}</td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.payment_method}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.payment_type==="staggered"?"Partial":"Full"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.reference_number||"—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.receipt_number||"—"}</td>
                  </tr>
                ))}
                {completed.filter((p: any) => p.created_at?.startsWith(today)).length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No collections today yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ RECEIPT LOG TAB ══════════════════════════════════════ */}
      {activeTab === "receipts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-foreground">Payment Receipt Log</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={exportReceiptCSV}><FileSpreadsheet className="h-4 w-4"/> Export CSV</Button>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printReceiptLog}><Printer className="h-4 w-4"/> Print</Button>
              <Button variant="hero" className="gap-2 rounded-xl" onClick={printReceiptLog}><Download className="h-4 w-4"/> Save PDF</Button>
            </div>
          </div>

          {/* Date range filter */}
          <div className="rounded-2xl border bg-card p-4 shadow-civic flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input type="date" className="h-9 rounded-xl text-sm" value={dateFrom} max={today} onChange={e=>setDateFrom(e.target.value)}/>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input type="date" className="h-9 rounded-xl text-sm" value={dateTo} max={today} onChange={e=>setDateTo(e.target.value)}/>
            </div>
            <div className="flex gap-1 flex-wrap">
              {[["today","Today"],["week","Week"],["month","Month"]].map(([k,l]) => (
                <button key={k} onClick={()=>setQuickDate(k)} className="rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary">{l}</button>
              ))}
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-muted-foreground">{rangePayments.length} receipts</p>
              <p className="font-mono font-bold text-foreground">{fmt(stats.range)}</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  {["Receipt No.","Reference No.","Date","Vendor","Stall","Period","Amount","Method","Type"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rangePayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-medium">{p.receipt_number||"—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.reference_number||"—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.vendor_name}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{p.stall_number}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{MONTHS_FULL[(p.period_month||1)-1]} {p.period_year}</td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{p.payment_method==="paymaya"?"Maya":p.payment_method}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${p.payment_type==="staggered"?"border-primary/20 bg-primary/5 text-primary":"border-border bg-secondary text-muted-foreground"}`}>
                        {p.payment_type==="staggered"?"Partial":"Full"}
                      </span>
                    </td>
                  </tr>
                ))}
                {rangePayments.length===0&&<tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No receipts in selected range</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════ VENDOR STATUS TAB ════════════════════════════════════ */}
      {activeTab === "vendor-status" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Vendor Payment Status</h2>
              <p className="text-sm text-muted-foreground">{MONTHS_FULL[new Date().getMonth()]} {new Date().getFullYear()}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={exportVendorStatusCSV}><FileSpreadsheet className="h-4 w-4"/> Export CSV</Button>
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printVendorStatus}><Printer className="h-4 w-4"/> Print</Button>
              <Button variant="hero" className="gap-2 rounded-xl" onClick={printVendorStatus}><Download className="h-4 w-4"/> Save PDF</Button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label:"Paid This Month",    value:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length,    color:"text-success" },
              { label:"Partial",            value:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length,  color:"text-primary" },
              { label:"Unpaid",             value:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="unpaid").length,   color:"text-accent" },
              { label:"Total Outstanding",  value:fmt(stats.totalOutstanding),                                                        color:"text-accent" },
            ].map(c => (
              <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`font-mono text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  {["Vendor","Stall","Section","Monthly Rate","Total Paid (Year)","Outstanding","This Month","Remaining"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {(allData?.vendorStatus||[]).map((v: any) => (
                  <tr key={v.vendorId} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{v.name}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{v.stall}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.section}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{fmt(v.rate)}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-success">{fmt(v.totalPaid)}</td>
                    <td className="px-4 py-3 font-mono font-semibold">
                      <span className={v.outstanding>0?"text-accent":"text-success"}>{fmt(v.outstanding)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        v.thisMonthStatus==="paid"    ? "bg-success/10 text-success border-success/20" :
                        v.thisMonthStatus==="partial" ? "bg-primary/10 text-primary border-primary/20" :
                        "bg-accent/10 text-accent border-accent/20"
                      }`}>
                        {v.thisMonthStatus==="paid"    ? <><CheckCircle2 className="h-3 w-3"/>Paid</> :
                         v.thisMonthStatus==="partial" ? <><Clock className="h-3 w-3"/>Partial</> :
                         <><AlertCircle className="h-3 w-3"/>Unpaid</>}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {v.thisMonthStatus==="paid"
                        ? <span className="text-success text-xs">—</span>
                        : <span className="text-accent font-semibold">{fmt(v.remainingThisMonth)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierReports;