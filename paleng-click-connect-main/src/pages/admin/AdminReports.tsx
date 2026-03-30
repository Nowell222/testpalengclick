import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download, Printer, FileText, Loader2, TrendingUp, DollarSign,
  Users, Store, AlertCircle, CheckCircle2, Clock, Filter,
  BarChart2, PieChart, Activity, RefreshCw, X, CreditCard,
  Banknote, Smartphone, Building2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart as RePieChart,
  Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Constants ─────────────────────────────────────────────────────────────────
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt    = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtK   = (n: number) => n >= 1000 ? `₱${(n/1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;
const PIE_COLORS = ["#0f6e56","#1d9e75","#185fa5","#ba7517","#993c1d","#534ab7"];

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",  label: "GCash"    },
  paymaya:  { icon: Smartphone, color: "bg-green-600", label: "Maya"     },
  instapay: { icon: Building2,  color: "bg-primary",   label: "InstaPay" },
  cash:     { icon: Banknote,   color: "bg-slate-500", label: "Cash"     },
};

// ─── Print helper ──────────────────────────────────────────────────────────────
const doPrint = (title: string, subtitle: string, bodyHTML: string) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:28px}
  .hdr{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:16px}
  .rep{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase}
  .lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .ttl{font-size:17px;font-weight:bold;margin-top:4px;letter-spacing:.5px}
  .sub{font-size:10px;color:#666;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}
  thead tr{background:#111;color:#fff}
  thead th{padding:6px 8px;text-align:left;font-size:10px}
  thead th.r{text-align:right}
  tbody tr{border-bottom:1px solid #eee}
  tbody td{padding:5px 8px}
  td.r{text-align:right;font-family:monospace}
  td.mono{font-family:monospace}
  td.green{color:#27ae60;font-weight:bold}
  td.red{color:#c0392b;font-weight:bold}
  td.amber{color:#d97706;font-weight:bold}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .stat-box{border:1px solid #ddd;border-radius:4px;padding:10px;text-align:center}
  .stat-box .val{font-size:15px;font-weight:bold;font-family:monospace}
  .stat-box .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
  .sum{border-top:2px solid #111;padding:8px 0;display:flex;justify-content:space-between;font-weight:bold;font-size:13px}
  .footer{margin-top:22px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines · Municipality of San Juan, Batangas</div>
  <div class="lgu">Office of the Municipal Treasurer</div>
  <div class="ttl">${title}</div>
  <div class="sub">${subtitle} · Printed: ${new Date().toLocaleString("en-PH")}</div>
</div>
${bodyHTML}
<div class="footer">PALENG-CLICK System · Computer-generated report · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
};

// ─── Component ─────────────────────────────────────────────────────────────────
const AdminReports = () => {
  const [activeTab,   setActiveTab]   = useState("analytics");
  const [chartView,   setChartView]   = useState<"daily"|"weekly"|"monthly">("monthly");
  const [dateFrom,    setDateFrom]    = useState(() => { const d=new Date(); d.setDate(d.getDate()-29); return d.toISOString().split("T")[0]; });
  const [dateTo,      setDateTo]      = useState(() => new Date().toISOString().split("T")[0]);
  const [reportYear,  setReportYear]  = useState(new Date().getFullYear());
  const [compareYear, setCompareYear]  = useState(new Date().getFullYear() - 1);
  const [showYoY,     setShowYoY]      = useState(false);
  const [filterSection, setFilterSection] = useState("all");
  const [search,      setSearch]      = useState("");

  const today = new Date().toISOString().split("T")[0];

  const setQuick = (type: string) => {
    const now = new Date(), t = now.toISOString().split("T")[0];
    if (type==="today")      { setDateFrom(t); setDateTo(t); }
    if (type==="week")       { const s=new Date(now); s.setDate(now.getDate()-6); setDateFrom(s.toISOString().split("T")[0]); setDateTo(t); }
    if (type==="month")      { setDateFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`); setDateTo(t); }
    if (type==="last-month") { const p=new Date(now.getFullYear(),now.getMonth()-1,1),e=new Date(now.getFullYear(),now.getMonth(),0); setDateFrom(p.toISOString().split("T")[0]); setDateTo(e.toISOString().split("T")[0]); }
    if (type==="year")       { setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(t); }
  };

  // ── Fetch all data ───────────────────────────────────────────────────────────
  const { data: allData, isLoading, refetch } = useQuery({
    queryKey: ["admin-reports-all"],
    refetchInterval: 60000,
    queryFn: async () => {
      const yearStart = `${Math.min(new Date().getFullYear() - 3, new Date().getFullYear())}-01-01T00:00:00`;
      const [paymentsRes, vendorsRes, stallsRes] = await Promise.all([
        supabase.from("payments").select("*").gte("created_at", yearStart).order("created_at", { ascending: false }),
        supabase.from("vendors").select("id, user_id, stalls(stall_number, section, monthly_rate, status)"),
        supabase.from("stalls").select("*"),
      ]);

      const payments = paymentsRes.data || [];
      const vendors  = vendorsRes.data  || [];
      const stalls   = stallsRes.data   || [];

      const userIds = vendors.map(v => v.user_id);
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, first_name, last_name, contact_number, status").in("user_id", userIds);

      const completed = payments.filter(p => p.status === "completed");
      const currentYear  = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      // Enrich payments with vendor/profile info
      const enriched = payments.map(p => {
        const v  = vendors.find(v => v.id === p.vendor_id);
        const pr = profiles?.find(pr => pr.user_id === v?.user_id);
        const st = v?.stalls as any;
        return { ...p, vendor_name: pr?`${pr.first_name} ${pr.last_name}`:"Unknown", stall: st?.stall_number||"—", section: st?.section||"General", monthly_rate: st?.monthly_rate||1450 };
      });

      // Vendor payment status this month
      const vendorStatus = vendors.map(v => {
        const pr   = profiles?.find(p => p.user_id === v.user_id);
        const st   = v.stalls as any;
        const rate = st?.monthly_rate || 1450;
        const vPay = completed.filter(p => p.vendor_id === v.id && p.period_year === currentYear);
        const map: Record<number,number> = {};
        vPay.forEach(p => { if(p.period_month) map[p.period_month]=(map[p.period_month]||0)+Number(p.amount); });
        const totalPaid = Object.values(map).reduce((s,v)=>s+v,0);
        const outstanding = MONTHS_FULL.reduce((sum,_,i)=>{ const m=i+1; if(m>currentMonth) return sum; return sum+Math.max(0,rate-(map[m]||0)); },0);
        const paidThisMonth = map[currentMonth]||0;
        const monthsOverdue = MONTHS_FULL.slice(0,currentMonth).filter((_,i)=>(map[i+1]||0)<rate).length;
        return {
          vendorId: v.id, userId: v.user_id,
          name: pr?`${pr.first_name} ${pr.last_name}`:"Unknown",
          contact: pr?.contact_number||"—",
          accountStatus: pr?.status||"active",
          stall: st?.stall_number||"—", section: st?.section||"General",
          rate, totalPaid, outstanding, monthsOverdue,
          thisMonthStatus: paidThisMonth>=rate?"paid":paidThisMonth>0?"partial":"unpaid",
          paidThisMonth, remainingThisMonth: Math.max(0,rate-paidThisMonth),
          map,
        };
      });

      // Monthly chart
      const monthlyMap: Record<number,number> = {};
      MONTHS_SHORT.forEach((_,i)=>{ monthlyMap[i]=0; });
      completed.filter(p=>new Date(p.created_at).getFullYear()===currentYear)
        .forEach(p=>{ const m=new Date(p.created_at).getMonth(); monthlyMap[m]=(monthlyMap[m]||0)+Number(p.amount); });
      const monthlyData = MONTHS_SHORT.map((m,i)=>({ month:m, amount:monthlyMap[i] }));

      // Section breakdown
      const sectionMap: Record<string,number> = {};
      completed.forEach(p=>{ const e=enriched.find(e=>e.id===p.id); if(e) sectionMap[e.section]=(sectionMap[e.section]||0)+Number(p.amount); });
      const sectionData = Object.entries(sectionMap).map(([section,amount])=>({ section, amount })).sort((a,b)=>b.amount-a.amount);

      // Method breakdown
      const methodMap: Record<string,number> = {};
      completed.forEach(p=>{ methodMap[p.payment_method]=(methodMap[p.payment_method]||0)+Number(p.amount); });
      const methodData = Object.entries(methodMap).map(([method,amount])=>({
        method: method==="paymaya"?"Maya":method.charAt(0).toUpperCase()+method.slice(1), amount,
      }));

      // Weekly trend (last 8 weeks)
      const weeklyMap: Record<string,number> = {};
      for (let i=7;i>=0;i--) {
        const d=new Date(); d.setDate(d.getDate()-i*7);
        const key=`W${Math.ceil(d.getDate()/7)} ${MONTHS_SHORT[d.getMonth()]}`;
        weeklyMap[key]=0;
      }
      completed.forEach(p=>{
        const d=new Date(p.created_at);
        const key=`W${Math.ceil(d.getDate()/7)} ${MONTHS_SHORT[d.getMonth()]}`;
        if(weeklyMap[key]!==undefined) weeklyMap[key]+=Number(p.amount);
      });
      const weeklyData = Object.entries(weeklyMap).map(([week,amount])=>({ week, amount }));

      return { enriched, vendorStatus, monthlyData, weeklyData, sectionData, methodData, stalls, currentYear, currentMonth };
    },
  });

  // ── Range-filtered payments ──────────────────────────────────────────────────
  const rangePayments = useMemo(()=>{
    if (!allData) return [];
    return (allData.enriched||[]).filter((p:any)=>{
      const d = p.created_at?.split("T")[0];
      const matchDate  = d >= dateFrom && d <= dateTo;
      const matchSection = filterSection==="all" || p.section===filterSection;
      const matchSearch  = !search || p.vendor_name.toLowerCase().includes(search.toLowerCase()) || p.stall.toLowerCase().includes(search.toLowerCase());
      return matchDate && matchSection && matchSearch && p.status==="completed";
    });
  }, [allData, dateFrom, dateTo, filterSection, search]);

  // ── Summary stats ────────────────────────────────────────────────────────────
  const stats = useMemo(()=>{
    if (!allData) return { totalYear:0, totalRange:0, txRange:0, pending:0, outstanding:0, vendors:0, paidVendors:0, stalls:0, occupied:0 };
    const completed = (allData.enriched||[]).filter((p:any)=>p.status==="completed");
    const pending   = (allData.enriched||[]).filter((p:any)=>p.status==="pending").length;
    const outstanding = (allData.vendorStatus||[]).reduce((s:number,v:any)=>s+v.outstanding,0);
    const paidVendors = (allData.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length;
    return {
      totalYear:  completed.reduce((s:number,p:any)=>s+Number(p.amount),0),
      totalRange: rangePayments.reduce((s:number,p:any)=>s+Number(p.amount),0),
      txRange:    rangePayments.length,
      pending, outstanding,
      vendors:    (allData.vendorStatus||[]).length,
      paidVendors,
      stalls:     (allData.stalls||[]).length,
      occupied:   (allData.stalls||[]).filter((s:any)=>s.status==="occupied").length,
    };
  }, [allData, rangePayments]);

  // ── Daily chart data ─────────────────────────────────────────────────────────
  const dailyChartData = useMemo(()=>{
    const map: Record<string,number> = {};
    const start=new Date(dateFrom), end=new Date(dateTo);
    for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) map[d.toISOString().split("T")[0]]=0;
    rangePayments.forEach((p:any)=>{ const k=p.created_at?.split("T")[0]; if(k&&map[k]!==undefined) map[k]+=Number(p.amount); });
    return Object.entries(map).map(([date,amount])=>({ label:new Date(date).toLocaleDateString("en-PH",{month:"short",day:"numeric"}), amount }));
  }, [rangePayments, dateFrom, dateTo]);

  // ─── Print functions ──────────────────────────────────────────────────────────
  const printDailyCollection = () => {
    const todayStr = today;
    const todayPay = (allData?.enriched||[]).filter((p:any)=>p.created_at?.startsWith(todayStr)&&p.status==="completed");
    const total = todayPay.reduce((s:number,p:any)=>s+Number(p.amount),0);
    const rows = todayPay.map((p:any)=>`
      <tr>
        <td class="mono">${new Date(p.created_at).toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit"})}</td>
        <td>${p.vendor_name}</td><td class="mono">${p.stall}</td><td>${p.section}</td>
        <td>${p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—"}</td>
        <td class="r mono">${fmt(Number(p.amount))}</td>
        <td>${p.payment_method==="paymaya"?"Maya":p.payment_method}</td>
        <td class="mono">${p.reference_number||"—"}</td>
      </tr>`).join("") || `<tr><td colspan="8" style="text-align:center;padding:16px;color:#888">No collections today</td></tr>`;
    doPrint("Daily Collection Report", new Date().toLocaleDateString("en-PH",{weekday:"long",year:"numeric",month:"long",day:"numeric"}),`
      <div class="stats">
        <div class="stat-box"><div class="val">${fmt(total)}</div><div class="lbl">Total Collected</div></div>
        <div class="stat-box"><div class="val">${todayPay.length}</div><div class="lbl">Transactions</div></div>
        <div class="stat-box"><div class="val">${todayPay.filter((p:any)=>p.payment_method==="cash").length}</div><div class="lbl">Cash</div></div>
        <div class="stat-box"><div class="val">${todayPay.filter((p:any)=>p.payment_method!=="cash").length}</div><div class="lbl">Online</div></div>
      </div>
      <table><thead><tr><th>Time</th><th>Vendor</th><th>Stall</th><th>Section</th><th>Period</th><th class="r">Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum"><span>TOTAL COLLECTIONS</span><span>${fmt(total)}</span></div>`);
  };

  const printRangeCollection = () => {
    const total = rangePayments.reduce((s:number,p:any)=>s+Number(p.amount),0);
    const rows = rangePayments.map((p:any)=>`
      <tr>
        <td>${new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td>
        <td>${p.vendor_name}</td><td class="mono">${p.stall}</td><td>${p.section}</td>
        <td>${p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—"}</td>
        <td class="r mono">${fmt(Number(p.amount))}</td>
        <td>${p.payment_method==="paymaya"?"Maya":p.payment_method}</td>
        <td>${p.payment_type==="staggered"?"Partial":"Full"}</td>
        <td class="mono">${p.reference_number||"—"}</td>
        <td class="mono">${p.receipt_number||"—"}</td>
      </tr>`).join("") || `<tr><td colspan="10" style="text-align:center;padding:16px;color:#888">No data</td></tr>`;
    const from=new Date(dateFrom).toLocaleDateString("en-PH",{month:"short",day:"numeric"});
    const to=new Date(dateTo).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
    doPrint("Collection Report", `${from} – ${to}`,`
      <div class="stats">
        <div class="stat-box"><div class="val">${fmt(total)}</div><div class="lbl">Total Collected</div></div>
        <div class="stat-box"><div class="val">${rangePayments.length}</div><div class="lbl">Transactions</div></div>
        <div class="stat-box"><div class="val">${rangePayments.filter((p:any)=>p.payment_type==="due").length}</div><div class="lbl">Full Payments</div></div>
        <div class="stat-box"><div class="val">${rangePayments.filter((p:any)=>p.payment_type==="staggered").length}</div><div class="lbl">Partial</div></div>
      </div>
      <table><thead><tr><th>Date</th><th>Vendor</th><th>Stall</th><th>Section</th><th>Period</th><th class="r">Amount</th><th>Method</th><th>Type</th><th>Reference</th><th>Receipt</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum"><span>TOTAL — ${rangePayments.length} transactions</span><span>${fmt(total)}</span></div>`);
  };

  const printMonthlyReport = () => {
    const rows = allData?.monthlyData.map((m:any,i:number)=>`
      <tr><td>${MONTHS_FULL[i]} ${allData.currentYear}</td><td class="r mono">${fmt(m.amount)}</td>
      <td class="r">${((m.amount/(allData.monthlyData.reduce((s:number,x:any)=>s+x.amount,0)||1))*100).toFixed(1)}%</td></tr>`).join("");
    const total = allData?.monthlyData.reduce((s:number,m:any)=>s+m.amount,0)||0;
    doPrint("Monthly Collection Summary", `Fiscal Year ${allData?.currentYear}`,`
      <table><thead><tr><th>Month</th><th class="r">Amount Collected</th><th class="r">% of Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum"><span>TOTAL — ${allData?.currentYear}</span><span>${fmt(total)}</span></div>`);
  };

  const printVendorStatus = () => {
    const vs = (allData?.vendorStatus||[]).filter((v:any)=>filterSection==="all"||v.section===filterSection);
    const rows = vs.map((v:any)=>`
      <tr>
        <td>${v.name}</td><td class="mono">${v.stall}</td><td>${v.section}</td>
        <td class="r mono">${fmt(v.rate)}</td>
        <td class="r mono">${fmt(v.totalPaid)}</td>
        <td class="r mono ${v.outstanding>0?"red":"green"}">${fmt(v.outstanding)}</td>
        <td class="${v.thisMonthStatus==="paid"?"green":v.thisMonthStatus==="partial"?"amber":"red"}">${v.thisMonthStatus==="paid"?"✓ Paid":v.thisMonthStatus==="partial"?"Partial":"Unpaid"}</td>
        <td>${v.monthsOverdue > 0 ? v.monthsOverdue+" mo overdue" : "—"}</td>
      </tr>`).join("");
    const totalOut = vs.reduce((s:number,v:any)=>s+v.outstanding,0);
    doPrint("Vendor Payment Status Report", `${MONTHS_FULL[new Date().getMonth()]} ${new Date().getFullYear()}`,`
      <div class="stats">
        <div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="paid").length}</div><div class="lbl">Paid This Month</div></div>
        <div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="partial").length}</div><div class="lbl">Partial</div></div>
        <div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="unpaid").length}</div><div class="lbl">Unpaid</div></div>
        <div class="stat-box"><div class="val">${fmt(totalOut)}</div><div class="lbl">Total Outstanding</div></div>
      </div>
      <table><thead><tr><th>Vendor</th><th>Stall</th><th>Section</th><th class="r">Rate</th><th class="r">Total Paid</th><th class="r">Outstanding</th><th>This Month</th><th>Overdue</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum"><span>TOTAL OUTSTANDING BALANCE</span><span style="color:#c0392b">${fmt(totalOut)}</span></div>`);
  };

  const printDelinquentVendors = () => {
    const delinquent = (allData?.vendorStatus||[]).filter((v:any)=>v.monthsOverdue>0).sort((a:any,b:any)=>b.outstanding-a.outstanding);
    const rows = delinquent.map((v:any)=>`
      <tr>
        <td>${v.name}</td><td class="mono">${v.stall}</td><td>${v.section}</td>
        <td class="r">${v.monthsOverdue} month(s)</td>
        <td class="r mono red">${fmt(v.outstanding)}</td>
        <td class="${v.accountStatus==="active"?"green":"red"}">${v.accountStatus}</td>
        <td>${v.contact}</td>
      </tr>`).join("") || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#27ae60;font-weight:bold">✓ No delinquent vendors</td></tr>`;
    doPrint("Delinquent Vendor Report", `As of ${new Date().toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"})}`,`
      <div class="stats">
        <div class="stat-box"><div class="val">${delinquent.length}</div><div class="lbl">Delinquent Vendors</div></div>
        <div class="stat-box"><div class="val">${fmt(delinquent.reduce((s:number,v:any)=>s+v.outstanding,0))}</div><div class="lbl">Total Outstanding</div></div>
        <div class="stat-box"><div class="val">${delinquent.filter((v:any)=>v.monthsOverdue>=3).length}</div><div class="lbl">3+ Months Late</div></div>
        <div class="stat-box"><div class="val">${delinquent.filter((v:any)=>v.monthsOverdue>=6).length}</div><div class="lbl">6+ Months Late</div></div>
      </div>
      <table><thead><tr><th>Vendor</th><th>Stall</th><th>Section</th><th class="r">Months Overdue</th><th class="r">Outstanding</th><th>Account Status</th><th>Contact</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum"><span>TOTAL DELINQUENT — ${delinquent.length} vendors</span><span style="color:#c0392b">${fmt(delinquent.reduce((s:number,v:any)=>s+v.outstanding,0))}</span></div>`);
  };

  const printStallSummary = () => {
    const stalls = allData?.stalls||[];
    const rows = stalls.map((s:any)=>`
      <tr>
        <td class="mono">${s.stall_number}</td><td>${s.section}</td><td>${s.location||"—"}</td>
        <td class="r mono">${fmt(s.monthly_rate||1450)}</td>
        <td class="${s.status==="occupied"?"green":"red"}">${s.status==="occupied"?"Occupied":"Vacant"}</td>
      </tr>`).join("");
    doPrint("Stall Summary Report", `Total: ${stalls.length} stalls`,`
      <div class="stats">
        <div class="stat-box"><div class="val">${stalls.length}</div><div class="lbl">Total Stalls</div></div>
        <div class="stat-box"><div class="val">${stalls.filter((s:any)=>s.status==="occupied").length}</div><div class="lbl">Occupied</div></div>
        <div class="stat-box"><div class="val">${stalls.filter((s:any)=>s.status==="vacant").length}</div><div class="lbl">Vacant</div></div>
        <div class="stat-box"><div class="val">${stalls.length>0?Math.round(stalls.filter((s:any)=>s.status==="occupied").length/stalls.length*100):0}%</div><div class="lbl">Occupancy Rate</div></div>
      </div>
      <table><thead><tr><th>Stall No.</th><th>Section</th><th>Location</th><th class="r">Monthly Rate</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`);
  };

  const printAnnualReport = () => {
    const monthly = allData?.monthlyData||[];
    const total   = monthly.reduce((s:number,m:any)=>s+m.amount,0);
    const vs      = allData?.vendorStatus||[];
    const rows = monthly.map((m:any,i:number)=>`
      <tr><td>${MONTHS_FULL[i]}</td><td class="r mono">${fmt(m.amount)}</td>
      <td class="r">${((m.amount/(total||1))*100).toFixed(1)}%</td>
      <td class="${m.amount>0?"green":"red"}">${m.amount>0?"✓":"—"}</td></tr>`).join("");
    doPrint("Annual Financial Report", `Fiscal Year ${allData?.currentYear}`,`
      <div class="stats">
        <div class="stat-box"><div class="val">${fmt(total)}</div><div class="lbl">Total Collected</div></div>
        <div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="paid").length}/${vs.length}</div><div class="lbl">Vendors Paid</div></div>
        <div class="stat-box"><div class="val">${fmt(vs.reduce((s:number,v:any)=>s+v.outstanding,0))}</div><div class="lbl">Outstanding</div></div>
        <div class="stat-box"><div class="val">${stats.occupied}/${stats.stalls}</div><div class="lbl">Stall Occupancy</div></div>
      </div>
      <table><thead><tr><th>Month</th><th class="r">Collected</th><th class="r">Share</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="sum"><span>ANNUAL TOTAL — ${allData?.currentYear}</span><span>${fmt(total)}</span></div>`);
  };

  const SECTIONS = ["General","Fish","Meat","Vegetables","Dry Goods","Bolante"];
  const TABS = [
    { id:"analytics",   label:"Analytics",         icon: BarChart2    },
    { id:"collection",  label:"Collection",         icon: DollarSign   },
    { id:"vendors",     label:"Vendor Status",      icon: Users        },
    { id:"delinquent",  label:"Delinquent",         icon: AlertCircle  },
    { id:"stalls",      label:"Stalls",             icon: Store        },
    { id:"annual",      label:"Annual",             icon: Activity     },
  ] as const;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Comprehensive collection reports, analytics, and vendor insights</p>
        </div>
        <button onClick={()=>refetch()} className="flex items-center gap-1.5 text-xs text-primary hover:underline">
          <RefreshCw className="h-3.5 w-3.5"/> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label:"Total Collected",   value:fmt(stats.totalYear),      sub:`${allData?.currentYear} year-to-date`,       icon:DollarSign,   color:"text-success",   bg:"bg-success/10"  },
          { label:"Active Vendors",    value:String(stats.vendors),      sub:`${stats.paidVendors} paid this month`,      icon:Users,        color:"text-primary",   bg:"bg-primary/10"  },
          { label:"Stall Occupancy",   value:`${stats.occupied}/${stats.stalls}`, sub:`${stats.stalls>0?Math.round(stats.occupied/stats.stalls*100):0}% occupied`, icon:Store, color:"text-foreground", bg:"bg-secondary" },
          { label:"Total Outstanding", value:fmt(stats.outstanding),     sub:"all vendors combined",                       icon:AlertCircle,  color:stats.outstanding>0?"text-accent":"text-success", bg:stats.outstanding>0?"bg-accent/10":"bg-success/10" },
        ].map(c=>(
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.color}`}/>
              </div>
            </div>
            <p className={`font-mono text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1 flex-wrap">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab===t.id?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5"/>{t.label}
          </button>
        ))}
      </div>

      {/* Date + filter controls (shared across tabs) */}
      <div className="rounded-2xl border bg-card p-4 shadow-civic space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm font-medium text-foreground">Date Range & Filters</p>
          <div className="flex gap-1 flex-wrap">
            {[["today","Today"],["week","This Week"],["month","This Month"],["last-month","Last Month"],["year","This Year"]].map(([k,l])=>(
              <button key={k} onClick={()=>setQuick(k)}
                className="rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors">{l}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <Input type="date" className="h-9 rounded-xl text-sm" value={dateFrom} max={today} onChange={e=>setDateFrom(e.target.value)}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <Input type="date" className="h-9 rounded-xl text-sm" value={dateTo} max={today} onChange={e=>setDateTo(e.target.value)}/>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Section</label>
            <select className="h-9 rounded-xl border bg-background px-3 text-sm" value={filterSection} onChange={e=>setFilterSection(e.target.value)}>
              <option value="all">All Sections</option>
              {SECTIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Year (charts)</label>
            <select className="h-9 rounded-xl border bg-background px-3 text-sm" value={reportYear} onChange={e=>setReportYear(Number(e.target.value))}>
              {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Search vendor/stall</label>
            <div className="relative">
              <Input placeholder="Search..." className="h-9 rounded-xl text-sm pl-8" value={search} onChange={e=>setSearch(e.target.value)}/>
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"/>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">{stats.txRange}</strong> transactions ·{" "}
          <strong className="text-success">{fmt(stats.totalRange)}</strong> in selected range
        </p>
      </div>

      {/* ══ ANALYTICS TAB ══════════════════════════════════════════════════════ */}
      {activeTab==="analytics" && (
        <div className="space-y-5">
          {/* View toggle */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Collection Trend</h3>
            <div className="flex gap-1">
              {(["daily","weekly","monthly"] as const).map(v=>(
                <button key={v} onClick={()=>setChartView(v)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all ${chartView===v?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground"}`}>{v}</button>
              ))}
            </div>
          </div>

          {/* Main chart */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic">
            <ResponsiveContainer width="100%" height={220}>
              {chartView==="daily" ? (
                <AreaChart data={dailyChartData}>
                  <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f6e56" stopOpacity={0.3}/><stop offset="95%" stopColor="#0f6e56" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false}/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                  <Tooltip formatter={(v:number)=>[fmt(v),"Collected"]} contentStyle={{borderRadius:"10px",border:"1px solid hsl(220,13%,88%)",fontSize:"12px"}}/>
                  <Area type="monotone" dataKey="amount" stroke="#0f6e56" fill="url(#cg)" strokeWidth={2}/>
                </AreaChart>
              ) : chartView==="weekly" ? (
                <BarChart data={allData?.weeklyData||[]} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false}/>
                  <XAxis dataKey="week" tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                  <Tooltip formatter={(v:number)=>[fmt(v),"Collected"]} contentStyle={{borderRadius:"10px",border:"1px solid hsl(220,13%,88%)",fontSize:"12px"}}/>
                  <Bar dataKey="amount" fill="#1d9e75" radius={[6,6,0,0]}/>
                </BarChart>
              ) : (
                <LineChart data={allData?.monthlyData||[]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false}/>
                  <XAxis dataKey="month" tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                  <Tooltip formatter={(v:number)=>[fmt(v),"Collected"]} contentStyle={{borderRadius:"10px",border:"1px solid hsl(220,13%,88%)",fontSize:"12px"}}/>
                  <Line type="monotone" dataKey="amount" stroke="#185fa5" strokeWidth={2} dot={{fill:"#185fa5",r:4}}/>
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Breakdown charts */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-5 shadow-civic">
              <h3 className="font-semibold text-foreground mb-4">By Payment Method</h3>
              {(allData?.methodData||[]).length===0 ? <p className="text-sm text-muted-foreground py-8 text-center">No data</p> : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <RePieChart><Pie data={allData?.methodData||[]} dataKey="amount" nameKey="method" cx="50%" cy="50%" outerRadius={65} innerRadius={28}>
                      {(allData?.methodData||[]).map((_:any,i:number)=><Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Pie><Tooltip formatter={(v:number)=>fmt(v)}/></RePieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {(allData?.methodData||[]).map((m:any,i:number)=>(
                      <div key={m.method} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{background:PIE_COLORS[i%PIE_COLORS.length]}}/><span className="text-muted-foreground">{m.method}</span></span>
                        <span className="font-mono font-medium text-foreground">{fmt(m.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-civic">
              <h3 className="font-semibold text-foreground mb-4">By Market Section</h3>
              {(allData?.sectionData||[]).length===0 ? <p className="text-sm text-muted-foreground py-8 text-center">No data</p> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={allData?.sectionData||[]} layout="vertical" barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)"/>
                    <XAxis type="number" tick={{fontSize:10}} tickFormatter={fmtK}/>
                    <YAxis type="category" dataKey="section" tick={{fontSize:11}} width={72}/>
                    <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{borderRadius:"10px",fontSize:"12px"}}/>
                    <Bar dataKey="amount" fill="#185fa5" radius={[0,6,6,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Vendor payment rate */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Vendor Payment Rate — {MONTHS_FULL[(allData?.currentMonth||1)-1]} {allData?.currentYear}</h3>
              <span className="text-sm text-muted-foreground">{stats.paidVendors}/{stats.vendors} paid ({stats.vendors>0?Math.round(stats.paidVendors/stats.vendors*100):0}%)</span>
            </div>
            <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
              {(()=>{const t=stats.vendors||1,paid=(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length,partial=(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length;return(<><div className="h-full bg-success" style={{width:`${paid/t*100}%`}}/><div className="h-full bg-primary" style={{width:`${partial/t*100}%`}}/><div className="h-full bg-accent" style={{width:`${(t-paid-partial)/t*100}%`}}/></>);})()}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              {[["bg-success","Paid",(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length],["bg-primary","Partial",(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length],["bg-accent","Unpaid",(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="unpaid").length]].map(([c,l,n])=>(
                <span key={l as string} className="flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${c}`}/>{l}: <strong className="text-foreground">{n as number}</strong></span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ COLLECTION TAB ═════════════════════════════════════════════════════ */}
      {activeTab==="collection" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-foreground">Collection Report — {rangePayments.length} transactions · {fmt(stats.totalRange)}</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printDailyCollection}><Printer className="h-4 w-4"/> Today's Report</Button>
              <Button variant="hero" className="gap-2 rounded-xl" onClick={printRangeCollection}><Download className="h-4 w-4"/> Print / PDF</Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-secondary/50">
                {["Date","Vendor","Stall","Section","Period","Amount","Method","Type","Reference","Receipt"].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y">
                {rangePayments.map((p:any)=>{
                  const mCfg=METHOD_CONFIG[p.payment_method]||{icon:CreditCard,color:"bg-muted",label:p.payment_method};
                  const MI=mCfg.icon;
                  return(<tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{p.vendor_name}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{p.stall}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.section}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">{fmt(Number(p.amount))}</td>
                    <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><span className={`flex h-5 w-5 items-center justify-center rounded ${mCfg.color}`}><MI className="h-3 w-3 text-white"/></span><span className="text-xs text-muted-foreground">{mCfg.label}</span></span></td>
                    <td className="px-4 py-3"><span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${p.payment_type==="staggered"?"border-primary/20 bg-primary/5 text-primary":"border-border bg-secondary text-muted-foreground"}`}>{p.payment_type==="staggered"?"Partial":"Full"}</span></td>
                    <td className="px-4 py-3"><span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{p.reference_number||"—"}</span></td>
                    <td className="px-4 py-3"><span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">{p.receipt_number||"—"}</span></td>
                  </tr>);
                })}
                {rangePayments.length===0&&<tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No data in selected range</td></tr>}
              </tbody>
            </table>
            {rangePayments.length>0&&<div className="border-t bg-secondary/30 px-5 py-3 flex justify-between text-sm"><span className="text-muted-foreground">{rangePayments.length} transactions</span><span className="font-mono font-bold text-success">{fmt(stats.totalRange)}</span></div>}
          </div>
        </div>
      )}

      {/* ══ VENDOR STATUS TAB ══════════════════════════════════════════════════ */}
      {activeTab==="vendors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-foreground">Vendor Payment Status — {MONTHS_FULL[(allData?.currentMonth||1)-1]} {allData?.currentYear}</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printVendorStatus}><Printer className="h-4 w-4"/> Print</Button>
              <Button variant="hero" className="gap-2 rounded-xl" onClick={printVendorStatus}><Download className="h-4 w-4"/> Save PDF</Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-secondary/50">
                {["Vendor","Stall","Section","Rate","Total Paid","Outstanding","This Month","Months Overdue","Contact"].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y">
                {(allData?.vendorStatus||[]).filter((v:any)=>filterSection==="all"||v.section===filterSection).map((v:any)=>(
                  <tr key={v.vendorId} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">{v.name}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{v.stall}</td>
                    <td className="px-4 py-3 text-muted-foreground">{v.section}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{fmt(v.rate)}</td>
                    <td className="px-4 py-3 font-mono text-success font-semibold">{fmt(v.totalPaid)}</td>
                    <td className="px-4 py-3 font-mono font-semibold"><span className={v.outstanding>0?"text-accent":"text-success"}>{fmt(v.outstanding)}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${v.thisMonthStatus==="paid"?"bg-success/10 text-success border-success/20":v.thisMonthStatus==="partial"?"bg-primary/10 text-primary border-primary/20":"bg-accent/10 text-accent border-accent/20"}`}>
                        {v.thisMonthStatus==="paid"?<><CheckCircle2 className="h-3 w-3"/>Paid</>:v.thisMonthStatus==="partial"?<><Clock className="h-3 w-3"/>Partial</>:<><AlertCircle className="h-3 w-3"/>Unpaid</>}
                      </span>
                    </td>
                    <td className="px-4 py-3"><span className={v.monthsOverdue>=3?"font-bold text-accent":v.monthsOverdue>0?"text-amber-600":"text-muted-foreground"}>{v.monthsOverdue>0?`${v.monthsOverdue} month(s)`:"—"}</span></td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{v.contact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ DELINQUENT TAB ═════════════════════════════════════════════════════ */}
      {activeTab==="delinquent" && (
        <div className="space-y-4">
          {(() => {
            const delinquent = (allData?.vendorStatus||[]).filter((v:any)=>v.monthsOverdue>0).sort((a:any,b:any)=>b.outstanding-a.outstanding);
            const totalOut = delinquent.reduce((s:number,v:any)=>s+v.outstanding,0);
            return (<>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">Delinquent Vendors</h2>
                  <p className="text-sm text-muted-foreground">{delinquent.length} vendors with overdue payments · {fmt(totalOut)} total outstanding</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2 rounded-xl" onClick={printDelinquentVendors}><Printer className="h-4 w-4"/> Print</Button>
                  <Button variant="hero" className="gap-2 rounded-xl" onClick={printDelinquentVendors}><Download className="h-4 w-4"/> Save PDF</Button>
                </div>
              </div>
              {delinquent.length===0?(
                <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3">
                  <CheckCircle2 className="h-10 w-10 text-success opacity-60"/>
                  <p className="font-semibold text-success">No delinquent vendors!</p>
                  <p className="text-sm text-muted-foreground">All vendors are up to date with their payments.</p>
                </div>
              ):(
                <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b bg-secondary/50">
                      {["Vendor","Stall","Section","Months Overdue","Outstanding Balance","Partial Paid","Contact","Status"].map(h=>(
                        <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y">
                      {delinquent.map((v:any)=>(
                        <tr key={v.vendorId} className={`hover:bg-secondary/30 transition-colors ${v.monthsOverdue>=3?"bg-accent/3":""}`}>
                          <td className="px-4 py-3 font-semibold text-foreground">{v.name}</td>
                          <td className="px-4 py-3 font-mono">{v.stall}</td>
                          <td className="px-4 py-3 text-muted-foreground">{v.section}</td>
                          <td className="px-4 py-3"><span className={`font-bold ${v.monthsOverdue>=6?"text-red-600":v.monthsOverdue>=3?"text-accent":"text-amber-600"}`}>{v.monthsOverdue} month(s){v.monthsOverdue>=3?" ⚠️":""}</span></td>
                          <td className="px-4 py-3 font-mono font-bold text-accent">{fmt(v.outstanding)}</td>
                          <td className="px-4 py-3 font-mono text-primary">{v.paidThisMonth>0?fmt(v.paidThisMonth):"—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{v.contact}</td>
                          <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${v.accountStatus==="active"?"bg-success/10 text-success":"bg-accent/10 text-accent"}`}>{v.accountStatus}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="border-t bg-secondary/30 px-5 py-3 flex justify-between text-sm">
                    <span className="text-muted-foreground">{delinquent.length} delinquent vendors</span>
                    <span className="font-mono font-bold text-accent">{fmt(totalOut)}</span>
                  </div>
                </div>
              )}
            </>);
          })()}
        </div>
      )}

      {/* ══ STALLS TAB ═════════════════════════════════════════════════════════ */}
      {activeTab==="stalls" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Stall Summary</h2>
              <p className="text-sm text-muted-foreground">{stats.occupied} occupied · {stats.stalls-stats.occupied} vacant · {stats.stalls} total</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printStallSummary}><Printer className="h-4 w-4"/> Print</Button>
              <Button variant="hero" className="gap-2 rounded-xl" onClick={printStallSummary}><Download className="h-4 w-4"/> Save PDF</Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-secondary/50">
                {["Stall No.","Section","Location","Monthly Rate","Status"].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y">
                {(allData?.stalls||[]).map((s:any)=>(
                  <tr key={s.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{s.stall_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.section}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.location||"—"}</td>
                    <td className="px-4 py-3 font-mono text-foreground">{fmt(s.monthly_rate||1450)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.status==="occupied"?"bg-success/10 text-success":"bg-secondary text-muted-foreground"}`}>
                        {s.status==="occupied"?<><CheckCircle2 className="h-3 w-3"/>Occupied</>:<><Store className="h-3 w-3"/>Vacant</>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ ANNUAL TAB ═════════════════════════════════════════════════════════ */}
      {activeTab==="annual" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-foreground">Annual Financial Report — {allData?.currentYear}</h2>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printMonthlyReport}><Printer className="h-4 w-4"/> Monthly Summary</Button>
              <Button variant="hero" className="gap-2 rounded-xl" onClick={printAnnualReport}><Download className="h-4 w-4"/> Full Annual PDF</Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card p-5 shadow-civic">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={allData?.monthlyData||[]} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                <Tooltip formatter={(v:number)=>[fmt(v),"Collected"]} contentStyle={{borderRadius:"10px",border:"1px solid hsl(220,13%,88%)",fontSize:"12px"}}/>
                <Bar dataKey="amount" fill="hsl(185,60%,35%)" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-secondary/50">
                {["Month","Total Collected","% of Year","vs Rate (all vendors)"].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y">
                {(allData?.monthlyData||[]).map((m:any,i:number)=>{
                  const totalYear=(allData?.monthlyData||[]).reduce((s:number,x:any)=>s+x.amount,0);
                  const expectedMonthly=(allData?.vendorStatus||[]).reduce((s:number,v:any)=>s+v.rate,0);
                  const rate=expectedMonthly>0?Math.round(m.amount/expectedMonthly*100):0;
                  const isCurrent=i===((allData?.currentMonth||1)-1);
                  return(
                    <tr key={m.month} className={`hover:bg-secondary/30 transition-colors ${isCurrent?"bg-primary/3":""}`}>
                      <td className="px-4 py-3 font-medium text-foreground">{MONTHS_FULL[i]} {allData?.currentYear}{isCurrent&&<span className="ml-2 text-xs text-primary">(current)</span>}</td>
                      <td className="px-4 py-3 font-mono font-bold text-foreground">{fmt(m.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{totalYear>0?((m.amount/totalYear)*100).toFixed(1):0}%</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden">
                            <div className={`h-full rounded-full ${rate>=100?"bg-success":rate>=50?"bg-primary":"bg-accent"}`} style={{width:`${Math.min(rate,100)}%`}}/>
                          </div>
                          <span className={`text-xs font-semibold ${rate>=100?"text-success":rate>=50?"text-primary":"text-accent"}`}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t bg-secondary/30 px-5 py-3 flex justify-between text-sm">
              <span className="text-muted-foreground">Annual Total — {allData?.currentYear}</span>
              <span className="font-mono font-bold text-success">{fmt((allData?.monthlyData||[]).reduce((s:number,m:any)=>s+m.amount,0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReports;