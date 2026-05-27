import { useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Download, Printer, Loader2, TrendingUp, DollarSign,
  Users, Store, AlertCircle, CheckCircle2, Clock, Filter,
  BarChart2, PieChart, Activity, RefreshCw, X, CreditCard,
  Banknote, Smartphone, Building2, CalendarDays, FileSpreadsheet,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart as RePieChart,
  Pie, Cell, AreaChart, Area,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTHS_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt    = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
const fmtK   = (n: number) => n >= 1000 ? `₱${(n/1000).toFixed(1)}k` : `₱${n.toFixed(0)}`;
const PIE_COLORS = ["#0f6e56","#1d9e75","#185fa5","#ba7517","#993c1d","#534ab7"];

const METHOD_CONFIG: Record<string, { icon: any; bg: string; text: string; label: string }> = {
  gcash:    { icon: Smartphone, bg: "bg-blue-100",    text: "text-blue-700",    label: "GCash"    },
  paymaya:  { icon: Smartphone, bg: "bg-emerald-100", text: "text-emerald-700", label: "Maya"     },
  instapay: { icon: Building2,  bg: "bg-indigo-100",  text: "text-indigo-700",  label: "InstaPay" },
  cash:     { icon: Banknote,   bg: "bg-slate-100",   text: "text-slate-600",   label: "Cash"     },
};

const CustomTooltip = ({active,payload,label}:any) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"rgba(15,110,86,0.95)",border:"1px solid rgba(52,211,153,0.4)",borderRadius:12,padding:"12px 16px",boxShadow:"0 8px 16px rgba(0,0,0,0.12)"}}>
      <p style={{color:"rgba(255,255,255,0.6)",fontSize:11,marginBottom:4,fontWeight:500}}>{label}</p>
      <p style={{color:"#34d399",fontWeight:600,fontFamily:"monospace",fontSize:14}}>{fmt(payload[0].value)}</p>
    </div>
  );
};

const doPrint = (title: string, subtitle: string, bodyHTML: string) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;padding:28px}
  .hdr{text-align:center;border-bottom:2px solid #1a1a1a;padding-bottom:10px;margin-bottom:16px}
  .rep{font-size:9px;letter-spacing:2px;color:#666;text-transform:uppercase}.lgu{font-size:13px;font-weight:bold;margin:3px 0}
  .ttl{font-size:17px;font-weight:bold;margin-top:4px}.sub{font-size:10px;color:#666;margin-top:2px}
  table{width:100%;border-collapse:collapse;margin-bottom:14px}thead tr{background:#1a1a1a;color:#fff}
  thead th{padding:6px 8px;text-align:left;font-size:10px}thead th.r{text-align:right}
  tbody tr{border-bottom:1px solid #eee}tbody td{padding:5px 8px}td.r{text-align:right;font-family:monospace}td.mono{font-family:monospace}
  td.green{color:#27ae60;font-weight:bold}td.red{color:#c0392b;font-weight:bold}td.amber{color:#d97706;font-weight:bold}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
  .stat-box{border:1px solid #ddd;border-radius:4px;padding:10px;text-align:center}
  .stat-box .val{font-size:15px;font-weight:bold;font-family:monospace}.stat-box .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
  .sum{border-top:2px solid #1a1a1a;padding:8px 0;display:flex;justify-content:space-between;font-weight:bold;font-size:13px}
  .footer{margin-top:22px;text-align:center;font-size:9px;color:#aaa;border-top:1px solid #ddd;padding-top:8px}
</style></head><body>
<div class="hdr">
  <div class="rep">Republic of the Philippines · Municipality of San Juan, Batangas</div>
  <div class="lgu">Office of the Municipal Treasurer</div>
  <div class="ttl">${title}</div>
  <div class="sub">${subtitle} · Printed: ${new Date().toLocaleString("en-PH")}</div>
</div>${bodyHTML}
<div class="footer">PALENG-CLICK System · Computer-generated · ${new Date().toLocaleString("en-PH")}</div>
</body></html>`;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  document.body.appendChild(frame);
  frame.srcdoc = html;
  frame.onload = () => { setTimeout(() => { frame.contentWindow?.print(); document.body.removeChild(frame); }, 300); };
};

const AdminReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "analytics";
  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tab);
    setSearchParams(newParams, { replace: true });
  };
  const [chartView,     setChartView]     = useState<"daily"|"weekly"|"monthly">("monthly");
  const [dateFrom,      setDateFrom]      = useState(() => { const d=new Date(); d.setDate(d.getDate()-29); return d.toISOString().split("T")[0]; });
  const [dateTo,        setDateTo]        = useState(() => new Date().toISOString().split("T")[0]);
  const [reportYear,    setReportYear]    = useState(new Date().getFullYear());
  const [filterSection, setFilterSection] = useState("all");
  const [search,        setSearch]        = useState("");

  const today = new Date().toISOString().split("T")[0];
  const SECTIONS = [
    "Building I - 1st Floor",
    "Building II - 1st Floor",
    "Building I - 2nd Floor",
    "Building II - 2nd Floor",
    "Bldg 1 & 2 Bolante",
    "New Building - Mojica",
    "New Building - Kalayaan",
    "Meat Stalls",
    "Fish Stalls",
    "Egg and Dried Fish",
    "Eatery 2nd Floor",
    "Vegetable Section",
    "Vegetable Section - Extension",
  ];

  const setQuick = (type: string) => {
    const now = new Date(), t = now.toISOString().split("T")[0];
    if (type==="today")      { setDateFrom(t); setDateTo(t); }
    if (type==="week")       { const s=new Date(now); s.setDate(now.getDate()-6); setDateFrom(s.toISOString().split("T")[0]); setDateTo(t); }
    if (type==="month")      { setDateFrom(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`); setDateTo(t); }
    if (type==="last-month") { const p=new Date(now.getFullYear(),now.getMonth()-1,1),e=new Date(now.getFullYear(),now.getMonth(),0); setDateFrom(p.toISOString().split("T")[0]); setDateTo(e.toISOString().split("T")[0]); }
    if (type==="year")       { setDateFrom(`${now.getFullYear()}-01-01`); setDateTo(t); }
  };

  const { data: allData, isLoading, refetch } = useQuery({
    queryKey: ["admin-reports-all"],
    refetchInterval: 60000,
    queryFn: async () => {
      const yearStart = `${new Date().getFullYear()-3}-01-01T00:00:00`;
      const [paymentsRes, vendorsRes, stallsRes] = await Promise.all([
        supabase.from("payments").select("*").gte("created_at",yearStart).order("created_at",{ascending:false}),
        supabase.from("vendors").select("id,user_id,stalls(stall_number,section,monthly_rate,status)"),
        supabase.from("stalls").select("*"),
      ]);
      const payments=paymentsRes.data||[], vendors=vendorsRes.data||[], stalls=stallsRes.data||[];
      const userIds = vendors.map(v=>v.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id,first_name,last_name,contact_number,status").in("user_id",userIds);
      const completed = payments.filter(p=>p.status==="completed");
      const currentYear=new Date().getFullYear(), currentMonth=new Date().getMonth()+1;

      const enriched = payments.map(p=>{
        const v=vendors.find(v=>v.id===p.vendor_id);
        const pr=profiles?.find(pr=>pr.user_id===v?.user_id);
        const st=v?.stalls as any;
        return {...p,vendor_name:pr?`${pr.first_name} ${pr.last_name}`:"Unknown",stall:st?.stall_number||"—",section:st?.section||"General",monthly_rate:st?.monthly_rate||1450};
      });

      const vendorStatus = vendors.map(v=>{
        const pr=profiles?.find(p=>p.user_id===v.user_id);
        const st=v.stalls as any; const rate=st?.monthly_rate||1450;
        const vPay=completed.filter(p=>p.vendor_id===v.id&&p.period_year===currentYear);
        const map:Record<number,number>={};
        vPay.forEach(p=>{if(p.period_month)map[p.period_month]=(map[p.period_month]||0)+Number(p.amount);});
        const totalPaid=Object.values(map).reduce((s,v)=>s+v,0);
        const outstanding=MONTHS_FULL.reduce((sum,_,i)=>{const m=i+1;if(m>currentMonth)return sum;return sum+Math.max(0,rate-(map[m]||0));},0);
        const paidThisMonth=map[currentMonth]||0;
        const monthsOverdue=MONTHS_FULL.slice(0,currentMonth).filter((_,i)=>(map[i+1]||0)<rate).length;
        return {
          vendorId:v.id,userId:v.user_id,name:pr?`${pr.first_name} ${pr.last_name}`:"Unknown",
          contact:pr?.contact_number||"—",accountStatus:pr?.status||"active",
          stall:st?.stall_number||"—",section:st?.section||"General",rate,totalPaid,outstanding,monthsOverdue,
          thisMonthStatus:paidThisMonth>=rate?"paid":paidThisMonth>0?"partial":"unpaid",
          paidThisMonth,remainingThisMonth:Math.max(0,rate-paidThisMonth),map,
        };
      });

      const monthlyMap:Record<number,number>={};
      MONTHS_SHORT.forEach((_,i)=>{monthlyMap[i]=0;});
      completed.filter(p=>new Date(p.created_at).getFullYear()===currentYear).forEach(p=>{const m=new Date(p.created_at).getMonth();monthlyMap[m]=(monthlyMap[m]||0)+Number(p.amount);});
      const monthlyData=MONTHS_SHORT.map((m,i)=>({month:m,amount:monthlyMap[i]}));

      const sectionMap:Record<string,number>={};
      completed.forEach(p=>{const e=enriched.find(e=>e.id===p.id);if(e)sectionMap[e.section]=(sectionMap[e.section]||0)+Number(p.amount);});
      const sectionData=Object.entries(sectionMap).map(([section,amount])=>({section,amount})).sort((a,b)=>b.amount-a.amount);

      const methodMap:Record<string,number>={};
      completed.forEach(p=>{methodMap[p.payment_method]=(methodMap[p.payment_method]||0)+Number(p.amount);});
      const methodData=Object.entries(methodMap).map(([method,amount])=>({method:method==="paymaya"?"Maya":method.charAt(0).toUpperCase()+method.slice(1),amount}));

      const weeklyMap:Record<string,number>={};
      for(let i=7;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i*7);const key=`W${Math.ceil(d.getDate()/7)} ${MONTHS_SHORT[d.getMonth()]}`;weeklyMap[key]=0;}
      completed.forEach(p=>{const d=new Date(p.created_at);const key=`W${Math.ceil(d.getDate()/7)} ${MONTHS_SHORT[d.getMonth()]}`;if(weeklyMap[key]!==undefined)weeklyMap[key]+=Number(p.amount);});
      const weeklyData=Object.entries(weeklyMap).map(([week,amount])=>({week,amount}));

      return {enriched,vendorStatus,monthlyData,weeklyData,sectionData,methodData,stalls,currentYear,currentMonth};
    },
  });

  const rangePayments = useMemo(()=>{
    if(!allData) return [];
    return (allData.enriched||[]).filter((p:any)=>{
      const d=p.created_at?.split("T")[0];
      return d>=dateFrom&&d<=dateTo&&(filterSection==="all"||p.section===filterSection)&&(!search||p.vendor_name.toLowerCase().includes(search.toLowerCase())||p.stall.toLowerCase().includes(search.toLowerCase()))&&p.status==="completed";
    });
  },[allData,dateFrom,dateTo,filterSection,search]);

  const stats = useMemo(()=>{
    if(!allData) return {totalYear:0,totalRange:0,txRange:0,pending:0,outstanding:0,vendors:0,paidVendors:0,stalls:0,occupied:0};
    const completed=(allData.enriched||[]).filter((p:any)=>p.status==="completed");
    return {
      totalYear:  completed.reduce((s:number,p:any)=>s+Number(p.amount),0),
      totalRange: rangePayments.reduce((s:number,p:any)=>s+Number(p.amount),0),
      txRange:    rangePayments.length,
      pending:    (allData.enriched||[]).filter((p:any)=>p.status==="pending").length,
      outstanding:(allData.vendorStatus||[]).reduce((s:number,v:any)=>s+v.outstanding,0),
      vendors:    (allData.vendorStatus||[]).length,
      paidVendors:(allData.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length,
      stalls:     (allData.stalls||[]).length,
      occupied:   (allData.stalls||[]).filter((s:any)=>s.status==="occupied").length,
    };
  },[allData,rangePayments]);

  const dailyChartData = useMemo(()=>{
    const map:Record<string,number>={};
    const start=new Date(dateFrom),end=new Date(dateTo);
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))map[d.toISOString().split("T")[0]]=0;
    rangePayments.forEach((p:any)=>{const k=p.created_at?.split("T")[0];if(k&&map[k]!==undefined)map[k]+=Number(p.amount);});
    return Object.entries(map).map(([date,amount])=>({label:new Date(date).toLocaleDateString("en-PH",{month:"short",day:"numeric"}),amount}));
  },[rangePayments,dateFrom,dateTo]);

  const printVendorStatus = () => {
    const vs=(allData?.vendorStatus||[]).filter((v:any)=>filterSection==="all"||v.section===filterSection);
    const totalOut=vs.reduce((s:number,v:any)=>s+v.outstanding,0);
    const rows=vs.map((v:any)=>`<tr><td>${v.name}</td><td class="mono">${v.stall}</td><td>${v.section}</td><td class="r mono">${fmt(v.rate)}</td><td class="r mono">${fmt(v.totalPaid)}</td><td class="r mono ${v.outstanding>0?"red":"green"}">${fmt(v.outstanding)}</td><td class="${v.thisMonthStatus==="paid"?"green":v.thisMonthStatus==="partial"?"amber":"red"}">${v.thisMonthStatus==="paid"?"✓ Paid":v.thisMonthStatus==="partial"?"Partial":"Unpaid"}</td></tr>`).join("");
    doPrint("Vendor Payment Status",`${MONTHS_FULL[new Date().getMonth()]} ${new Date().getFullYear()}`,`<div class="stats"><div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="paid").length}</div><div class="lbl">Paid</div></div><div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="partial").length}</div><div class="lbl">Partial</div></div><div class="stat-box"><div class="val">${vs.filter((v:any)=>v.thisMonthStatus==="unpaid").length}</div><div class="lbl">Unpaid</div></div><div class="stat-box"><div class="val">${fmt(totalOut)}</div><div class="lbl">Outstanding</div></div></div><table><thead><tr><th>Vendor</th><th>Stall</th><th>Section</th><th class="r">Rate</th><th class="r">Total Paid</th><th class="r">Outstanding</th><th>This Month</th></tr></thead><tbody>${rows}</tbody></table><div class="sum"><span>TOTAL OUTSTANDING</span><span>${fmt(totalOut)}</span></div>`);
  };

  const printCollection = () => {
    const total=rangePayments.reduce((s:number,p:any)=>s+Number(p.amount),0);
    const rows=rangePayments.map((p:any)=>`<tr><td>${new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td><td>${p.vendor_name}</td><td class="mono">${p.stall}</td><td>${p.section}</td><td>${p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—"}</td><td class="r mono">${fmt(Number(p.amount))}</td><td>${p.payment_method==="paymaya"?"Maya":p.payment_method}</td><td class="mono">${p.reference_number||"—"}</td></tr>`).join("");
    doPrint("Collection Report",`${new Date(dateFrom).toLocaleDateString("en-PH",{month:"short",day:"numeric"})} – ${new Date(dateTo).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}`,`<div class="stats"><div class="stat-box"><div class="val">${fmt(total)}</div><div class="lbl">Total</div></div><div class="stat-box"><div class="val">${rangePayments.length}</div><div class="lbl">Transactions</div></div><div class="stat-box"><div class="val">${rangePayments.filter((p:any)=>p.payment_type==="due").length}</div><div class="lbl">Full</div></div><div class="stat-box"><div class="val">${rangePayments.filter((p:any)=>p.payment_type==="staggered").length}</div><div class="lbl">Partial</div></div></div><table><thead><tr><th>Date</th><th>Vendor</th><th>Stall</th><th>Section</th><th>Period</th><th class="r">Amount</th><th>Method</th><th>Reference</th></tr></thead><tbody>${rows}</tbody></table><div class="sum"><span>TOTAL</span><span>${fmt(total)}</span></div>`);
  };

  const TABS = [
    {id:"analytics",   label:"Analytics",    icon:BarChart2   },
    {id:"collection",  label:"Collection",   icon:DollarSign  },
    {id:"vendors",     label:"Vendors",      icon:Users       },
    {id:"delinquent",  label:"Delinquent",   icon:AlertCircle },
    {id:"stalls",      label:"Stalls",       icon:Store       },
    {id:"annual",      label:"Annual",       icon:Activity    },
  ] as const;

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{background:"#0f6e56"}}><Loader2 className="h-5 w-5 animate-spin text-white"/></div>
      <p className="text-sm text-muted-foreground">Loading reports…</p>
    </div>
  );

  const currentMonth = allData?.currentMonth || new Date().getMonth() + 1;

  return (
    <div className="space-y-5">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)",boxShadow:"0 20px 48px rgba(15,110,86,0.15)"}}>
        {[[200,"-60px","-60px","top","right"],[250,"-100px","-60px","bottom","left"]].map(([sz,a,b,v,h],i)=>(
          <div key={i} style={{position:"absolute",[v as string]:a,[h as string]:b,width:sz,height:sz,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.08)",pointerEvents:"none"}}/>
        ))}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:0.04,backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",backgroundSize:"22px 22px"}}/>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1" style={{color:"rgba(255,255,255,0.6)"}}>Admin Portal</p>
            <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
            <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.6)"}}>Collection reports, analytics, and vendor payment insights</p>
          </div>
          <button onClick={()=>refetch()} className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20 transition-colors">
            <RefreshCw className="h-3.5 w-3.5"/> Refresh
          </button>
        </div>
        {/* Stats strip */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {label:"Year-to-date",    value:fmt(stats.totalYear)},
            {label:"Outstanding",     value:fmt(stats.outstanding)},
            {label:"Stall Occupancy", value:`${stats.occupied}/${stats.stalls}`},
            {label:"Vendor Compliance",value:`${stats.paidVendors}/${stats.vendors}`},
          ].map(s=>(
            <div key={s.label} className="rounded-xl px-4 py-3" style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)"}}>
              <p className="font-mono text-lg font-bold text-white">{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{color:"rgba(255,255,255,0.6)"}}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {label:"Total Collected",  value:fmt(stats.totalYear),   sub:`${allData?.currentYear} year-to-date`,           icon:DollarSign,  iconBg:"bg-emerald-100",iconColor:"#10b981",glow:"#10b981",gradient:"from-emerald-50 to-emerald-50/40"},
          {label:"Active Vendors",   value:String(stats.vendors),  sub:`${stats.paidVendors} paid this month`,           icon:Users,       iconBg:"bg-blue-100",   iconColor:"#0ea5e9",glow:"#0ea5e9",gradient:"from-blue-50 to-blue-50/40"},
          {label:"Stall Occupancy",  value:`${stats.occupied}/${stats.stalls}`, sub:`${stats.stalls>0?Math.round(stats.occupied/stats.stalls*100):0}% occupied`, icon:Store, iconBg:"bg-amber-100", iconColor:"#f59e0b",glow:"#f59e0b",gradient:"from-amber-50 to-amber-50/40"},
          {label:"Outstanding",      value:fmt(stats.outstanding), sub:"all vendors combined",                           icon:AlertCircle, iconBg:stats.outstanding>0?"bg-accent/10":"bg-emerald-100",iconColor:stats.outstanding>0?"hsl(var(--accent))":"#10b981",glow:stats.outstanding>0?"hsl(var(--accent))":"#10b981",gradient:stats.outstanding>0?"from-accent/5 to-accent/5":"from-emerald-50 to-emerald-50/40"},
        ].map((c,i)=>(
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-md transition-all duration-300 group`} style={{minHeight:110}}>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-[0.08] blur-lg group-hover:opacity-[0.12] transition-opacity" style={{background:c.glow}}/>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{c.label}</p>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${c.iconBg} group-hover:shadow-md transition-shadow`}>
                <c.icon className="h-4 w-4" style={{color:c.iconColor}}/>
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[17px] font-bold text-foreground">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-xl bg-secondary p-1 flex-wrap">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${activeTab===t.id?"bg-card text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="h-3.5 w-3.5"/>{t.label}
          </button>
        ))}
      </div>

      {/* ── Date filter (shared) ─────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
          <p className="text-[13px] font-bold text-foreground">Date Range & Filters</p>
          <div className="ml-auto flex gap-1 flex-wrap">
            {[["today","Today"],["week","Week"],["month","Month"],["last-month","Last Month"],["year","Year"]].map(([k,l])=>(
              <button key={k} onClick={()=>setQuick(k)} className="rounded-lg border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors">{l}</button>
            ))}
          </div>
        </div>
        <div className="p-4 flex gap-3 flex-wrap items-end">
          <div className="space-y-1"><label className="text-xs text-muted-foreground">From</label><Input type="date" className="h-9 rounded-xl text-sm" value={dateFrom} max={today} onChange={e=>setDateFrom(e.target.value)}/></div>
          <div className="space-y-1"><label className="text-xs text-muted-foreground">To</label><Input type="date" className="h-9 rounded-xl text-sm" value={dateTo} max={today} onChange={e=>setDateTo(e.target.value)}/></div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Section</label>
            <select className="h-9 rounded-xl border bg-background px-3 text-sm" value={filterSection} onChange={e=>setFilterSection(e.target.value)}>
              <option value="all">All Sections</option>
              {SECTIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-[160px]">
            <label className="text-xs text-muted-foreground">Search</label>
            <div className="relative"><Input placeholder="Vendor or stall…" className="h-9 rounded-xl text-sm pl-8" value={search} onChange={e=>setSearch(e.target.value)}/><Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"/></div>
          </div>
          <div className="text-right pb-0.5">
            <p className="text-xs font-mono font-bold text-success">{fmt(stats.totalRange)}</p>
            <p className="text-xs text-muted-foreground">{stats.txRange} transactions</p>
          </div>
        </div>
      </div>

      {/* ══ ANALYTICS ══════════════════════════════════════════════════════ */}
      {activeTab==="analytics" && (
        <div className="space-y-4">
          {/* Chart view toggle + main chart */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-600 shadow-md"/>
                <p className="text-[13px] font-bold text-foreground capitalize">{chartView} Collection Trend</p>
              </div>
              <div className="flex gap-1">
                {(["daily","weekly","monthly"] as const).map(v=>(
                  <button key={v} onClick={()=>setChartView(v)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all ${chartView===v?"bg-primary text-primary-foreground":"bg-secondary text-muted-foreground"}`}>{v}</button>
                ))}
              </div>
            </div>
            <div className="relative p-4" style={{background:"rgba(240,253,250,0.3)"}}>
              <ResponsiveContainer width="100%" height={220}>
                {chartView==="daily" ? (
                  <AreaChart data={dailyChartData}>
                    <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f6e56" stopOpacity={0.3}/><stop offset="95%" stopColor="#0f6e56" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false}/>
                    <XAxis dataKey="label" tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                    <Tooltip content={<CustomTooltip/>} cursor={{fill:"rgba(16,185,129,0.08)"}}/>
                    <Area type="monotone" dataKey="amount" stroke="#0f6e56" fill="url(#cg)" strokeWidth={2}/>
                  </AreaChart>
                ) : chartView==="weekly" ? (
                  <BarChart data={allData?.weeklyData||[]} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false}/>
                    <XAxis dataKey="week" tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                    <Tooltip content={<CustomTooltip/>} cursor={{fill:"rgba(16,185,129,0.08)"}}/>
                    <Bar dataKey="amount" fill="#1d9e75" radius={[6,6,0,0]}/>
                  </BarChart>
                ) : (
                  <BarChart data={allData?.monthlyData||[]} barSize={18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false}/>
                    <XAxis dataKey="month" tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                    <Tooltip content={<CustomTooltip/>} cursor={{fill:"rgba(16,185,129,0.08)"}}/>
                    <Bar dataKey="amount" radius={[6,6,0,0]}>
                      {(allData?.monthlyData||[]).map((_:any,i:number)=>(
                        <Cell key={i} fill={i===currentMonth-1?"#0f6e56":"#34d399"}/>
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown charts */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
                <p className="text-[13px] font-bold text-foreground">By Payment Method</p>
              </div>
              {(allData?.methodData||[]).length===0 ? <p className="text-center text-sm text-muted-foreground py-8">No data in range</p> : (
                <div className="p-4">
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
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
                <p className="text-[13px] font-bold text-foreground">By Market Section</p>
              </div>
              {(allData?.sectionData||[]).length===0 ? <p className="text-center text-sm text-muted-foreground py-8">No data in range</p> : (
                <div className="p-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={allData?.sectionData||[]} layout="vertical" barSize={14}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)"/>
                      <XAxis type="number" tick={{fontSize:10}} tickFormatter={fmtK}/>
                      <YAxis type="category" dataKey="section" tick={{fontSize:11}} width={72}/>
                      <Tooltip formatter={(v:number)=>fmt(v)} contentStyle={{borderRadius:"10px",fontSize:"12px"}}/>
                      <Bar dataKey="amount" fill="#185fa5" radius={[0,6,6,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Vendor payment rate bar */}
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
                <p className="text-[13px] font-bold text-foreground">Vendor Payment Rate — {MONTHS_FULL[currentMonth-1]}</p>
              </div>
              <span className="text-sm text-muted-foreground">{stats.paidVendors}/{stats.vendors} paid ({stats.vendors>0?Math.round(stats.paidVendors/stats.vendors*100):0}%)</span>
            </div>
            <div className="px-5 py-4">
              <div className="h-3 w-full rounded-full bg-secondary overflow-hidden flex">
                {(()=>{const t=stats.vendors||1,paid=(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length,partial=(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length;return(<><div className="h-full bg-success transition-all" style={{width:`${paid/t*100}%`}}/><div className="h-full bg-primary transition-all" style={{width:`${partial/t*100}%`}}/><div className="h-full bg-accent transition-all" style={{width:`${(t-paid-partial)/t*100}%`}}/></>);})()}
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                {[["bg-success","Paid",(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length],["bg-primary","Partial",(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length],["bg-accent","Unpaid",(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="unpaid").length]].map(([c,l,n])=>(
                  <span key={l as string} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${c}`}/>{l}: <strong className="text-foreground">{n as number}</strong></span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ COLLECTION ════════════════════════════════════════════════════ */}
      {activeTab==="collection" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Collection Report</h2>
              <p className="text-sm text-muted-foreground">{rangePayments.length} transactions · {fmt(stats.totalRange)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printCollection}><Printer className="h-4 w-4"/> Print</Button>
              <Button className="gap-2 rounded-xl" style={{background:"linear-gradient(135deg,#0f6e56,#1d9e75)"}} onClick={printCollection}><Download className="h-4 w-4"/> PDF</Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                    {["Date","Vendor","Stall","Section","Period","Amount","Method","Type","Reference","Receipt"].map(h=>(
                      <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rangePayments.map((p:any)=>{
                    const mCfg=METHOD_CONFIG[p.payment_method]||{icon:CreditCard,bg:"bg-secondary",text:"text-foreground",label:p.payment_method};
                    const MI=mCfg.icon;
                    return(<tr key={p.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(p.created_at).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</td>
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{p.vendor_name}</td>
                      <td className="px-4 py-3 font-mono text-foreground">{p.stall}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.section}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{p.period_month?`${MONTHS_FULL[p.period_month-1]} ${p.period_year}`:"—"}</td>
                      <td className="px-4 py-3 font-mono font-bold text-foreground whitespace-nowrap">{fmt(Number(p.amount))}</td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${mCfg.bg} ${mCfg.text}`}><MI className="h-3 w-3"/>{mCfg.label}</span></td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${p.payment_type==="staggered"?"border-primary/20 bg-primary/5 text-primary":"border-border bg-secondary text-muted-foreground"}`}>{p.payment_type==="staggered"?"Partial":"Full"}</span></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.reference_number||"—"}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.receipt_number||"—"}</td>
                    </tr>);
                  })}
                  {rangePayments.length===0&&<tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">No data in selected range</td></tr>}
                </tbody>
              </table>
            </div>
            {rangePayments.length>0&&<div className="border-t bg-secondary/30 px-5 py-3 flex justify-between text-sm"><span className="text-muted-foreground">{rangePayments.length} transactions</span><span className="font-mono font-bold text-success">{fmt(stats.totalRange)}</span></div>}
          </div>
        </div>
      )}

      {/* ══ VENDORS ═══════════════════════════════════════════════════════ */}
      {activeTab==="vendors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Vendor Payment Status</h2>
              <p className="text-sm text-muted-foreground">{MONTHS_FULL[currentMonth-1]} {allData?.currentYear}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl" onClick={printVendorStatus}><Printer className="h-4 w-4"/> Print</Button>
              <Button className="gap-2 rounded-xl" style={{background:"linear-gradient(135deg,#0f6e56,#1d9e75)"}} onClick={printVendorStatus}><Download className="h-4 w-4"/> PDF</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-2">
            {[
              {label:"Paid",    value:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="paid").length,    dot:"bg-emerald-500"},
              {label:"Partial", value:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="partial").length,  dot:"bg-primary"},
              {label:"Unpaid",  value:(allData?.vendorStatus||[]).filter((v:any)=>v.thisMonthStatus==="unpaid").length,   dot:"bg-accent"},
              {label:"Outstanding",value:fmt((allData?.vendorStatus||[]).reduce((s:number,v:any)=>s+v.outstanding,0)),   dot:"bg-accent"},
            ].map((c,i)=>(
              <div key={i} className="rounded-xl border bg-card p-3 flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${c.dot}`}/>
                <div><p className="font-mono font-bold text-foreground">{c.value}</p><p className="text-xs text-muted-foreground">{c.label}</p></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                    {["Vendor","Stall","Section","Rate","Total Paid","Outstanding","This Month","Overdue","Contact"].map(h=>(
                      <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(allData?.vendorStatus||[]).filter((v:any)=>filterSection==="all"||v.section===filterSection).map((v:any)=>(
                    <tr key={v.vendorId} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground">{v.name}</td>
                      <td className="px-4 py-3 font-mono text-foreground">{v.stall}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.section}</td>
                      <td className="px-4 py-3 font-mono text-foreground">{fmt(v.rate)}</td>
                      <td className="px-4 py-3 font-mono text-success font-semibold">{fmt(v.totalPaid)}</td>
                      <td className="px-4 py-3 font-mono font-semibold"><span className={v.outstanding>0?"text-accent":"text-success"}>{fmt(v.outstanding)}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          v.thisMonthStatus==="paid"?"bg-success/10 text-success border-success/20":v.thisMonthStatus==="partial"?"bg-primary/10 text-primary border-primary/20":"bg-accent/10 text-accent border-accent/20"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${v.thisMonthStatus==="paid"?"bg-success":v.thisMonthStatus==="partial"?"bg-primary":"bg-accent"}`}/>
                          {v.thisMonthStatus==="paid"?"Paid":v.thisMonthStatus==="partial"?"Partial":"Unpaid"}
                        </span>
                      </td>
                      <td className="px-4 py-3"><span className={v.monthsOverdue>=3?"font-bold text-accent":v.monthsOverdue>0?"text-amber-600":"text-muted-foreground"}>{v.monthsOverdue>0?`${v.monthsOverdue} mo`:"—"}</span></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{v.contact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELINQUENT ════════════════════════════════════════════════════ */}
      {activeTab==="delinquent" && (
        <div className="space-y-4">
          {(()=>{
            const delinquent=(allData?.vendorStatus||[]).filter((v:any)=>v.monthsOverdue>0).sort((a:any,b:any)=>b.outstanding-a.outstanding);
            const totalOut=delinquent.reduce((s:number,v:any)=>s+v.outstanding,0);
            return (<>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="font-semibold text-foreground">Delinquent Vendors</h2>
                  <p className="text-sm text-muted-foreground">{delinquent.length} vendors with overdue payments · {fmt(totalOut)} total</p>
                </div>
              </div>
              {delinquent.length===0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border bg-card py-16 gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><CheckCircle2 className="h-7 w-7 text-emerald-500"/></div>
                  <div className="text-center">
                    <p className="font-semibold text-emerald-700">No delinquent vendors!</p>
                    <p className="text-sm text-muted-foreground">All vendors are up to date.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                          {["Vendor","Stall","Section","Months Overdue","Outstanding","Partial Paid","Contact","Status"].map(h=>(
                            <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {delinquent.map((v:any)=>(
                          <tr key={v.vendorId} className="hover:bg-emerald-50/40 transition-colors">
                            <td className="px-4 py-3 font-semibold text-foreground">{v.name}</td>
                            <td className="px-4 py-3 font-mono">{v.stall}</td>
                            <td className="px-4 py-3 text-muted-foreground">{v.section}</td>
                            <td className="px-4 py-3"><span className={`font-bold ${v.monthsOverdue>=6?"text-red-600":v.monthsOverdue>=3?"text-accent":"text-amber-600"}`}>{v.monthsOverdue} month{v.monthsOverdue>1?"s":""}{v.monthsOverdue>=3?" ⚠️":""}</span></td>
                            <td className="px-4 py-3 font-mono font-bold text-accent">{fmt(v.outstanding)}</td>
                            <td className="px-4 py-3 font-mono text-primary">{v.paidThisMonth>0?fmt(v.paidThisMonth):"—"}</td>
                            <td className="px-4 py-3 text-xs text-muted-foreground">{v.contact}</td>
                            <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${v.accountStatus==="active"?"bg-success/10 text-success border-success/20":"bg-accent/10 text-accent border-accent/20"}`}><span className={`h-1.5 w-1.5 rounded-full ${v.accountStatus==="active"?"bg-success":"bg-accent"}`}/>{v.accountStatus}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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

      {/* ══ STALLS ════════════════════════════════════════════════════════ */}
      {activeTab==="stalls" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Stall Summary</h2>
              <p className="text-sm text-muted-foreground">{stats.occupied} occupied · {stats.stalls-stats.occupied} vacant · {stats.stalls} total</p>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                    {["Stall No.","Section","Location","Monthly Rate","Status"].map(h=>(
                      <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(allData?.stalls||[]).map((s:any)=>(
                    <tr key={s.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">{s.stall_number}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.section}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.location||"—"}</td>
                      <td className="px-4 py-3 font-mono text-foreground">{fmt(s.monthly_rate||1450)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.status==="occupied"?"bg-success/10 text-success border-success/20":"bg-secondary text-muted-foreground border-border"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.status==="occupied"?"bg-success":"bg-muted-foreground"}`}/>
                          {s.status==="occupied"?"Occupied":"Vacant"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ ANNUAL ════════════════════════════════════════════════════════ */}
      {activeTab==="annual" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Annual Financial Report</h2>
              <p className="text-sm text-muted-foreground">Fiscal Year {allData?.currentYear}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2 rounded-xl"><Printer className="h-4 w-4"/> Monthly Summary</Button>
              <Button className="gap-2 rounded-xl" style={{background:"linear-gradient(135deg,#0f6e56,#1d9e75)"}}><Download className="h-4 w-4"/> Annual PDF</Button>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
              <div className="h-2 w-2 rounded-full bg-emerald-600 shadow-md"/>
              <p className="text-[13px] font-bold text-foreground">Monthly Collections — {allData?.currentYear}</p>
            </div>
            <div className="relative p-4" style={{background:"rgba(240,253,250,0.3)"}}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={allData?.monthlyData||[]} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,92%)" vertical={false}/>
                  <XAxis dataKey="month" tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:"hsl(220,10%,55%)"}} tickFormatter={fmtK} axisLine={false} tickLine={false} width={46}/>
                  <Tooltip content={<CustomTooltip/>} cursor={{fill:"rgba(16,185,129,0.08)"}}/>
                  <Bar dataKey="amount" radius={[6,6,0,0]}>
                    {(allData?.monthlyData||[]).map((_:any,i:number)=>(<Cell key={i} fill={i===currentMonth-1?"#0f6e56":"#34d399"}/>))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)"}}>
                    {["Month","Total Collected","% of Year","Collection Rate"].map(h=>(
                      <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(allData?.monthlyData||[]).map((m:any,i:number)=>{
                    const totalYear=(allData?.monthlyData||[]).reduce((s:number,x:any)=>s+x.amount,0);
                    const expectedMonthly=(allData?.vendorStatus||[]).reduce((s:number,v:any)=>s+v.rate,0);
                    const rate=expectedMonthly>0?Math.round(m.amount/expectedMonthly*100):0;
                    const isCurrent=i===currentMonth-1;
                    return(
                      <tr key={m.month} className={`hover:bg-emerald-50/40 transition-colors ${isCurrent?"bg-primary/5":""}`}>
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
        </div>
      )}
    </div>
  );
};

export default AdminReports;