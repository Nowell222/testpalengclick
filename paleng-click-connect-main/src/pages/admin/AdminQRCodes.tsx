import { useState, useRef, useEffect, useCallback } from "react";
import {
  QrCode, Camera, CameraOff, Search, Loader2, CheckCircle2,
  AlertCircle, Clock, Store, User, CreditCard, X,
  Smartphone, Building2, Banknote, ScanLine, RefreshCw,
  MapPin, Phone, Calendar, TrendingUp, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string; bg: string; text: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",   label: "GCash",    bg: "bg-blue-100",    text: "text-blue-700"    },
  paymaya:  { icon: Smartphone, color: "bg-green-600",  label: "Maya",     bg: "bg-emerald-100", text: "text-emerald-700" },
  instapay: { icon: Building2,  color: "bg-indigo-600", label: "InstaPay", bg: "bg-indigo-100",  text: "text-indigo-700"  },
  cash:     { icon: Banknote,   color: "bg-slate-500",  label: "Cash",     bg: "bg-slate-100",   text: "text-slate-600"   },
};

const fetchVendorByQR = async (qrValue: string) => {
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, user_id, qr_code, award_date, stall_id, stalls(*)")
    .eq("qr_code", qrValue)
    .single();
  if (!vendor) return null;

  const [profileRes, paymentsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", vendor.user_id).single(),
    supabase.from("payments").select("*").eq("vendor_id", vendor.id).order("created_at", { ascending: false }),
  ]);
  const profile  = profileRes.data;
  const payments = paymentsRes.data || [];
  const stall    = vendor.stalls as any;
  const currentYear  = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultRate  = stall?.monthly_rate || 1450;

  const { data: schedules } = stall?.id
    ? await (supabase.from("stall_fee_schedules" as any) as any).select("*").eq("stall_id", stall.id).eq("year", currentYear)
    : { data: [] };
  const getMonthFee = (m: number): number => {
    const s = (schedules || []).find((s: any) => s.month === m);
    return s ? Number(s.amount) : defaultRate;
  };
  const rawPaidMap: Record<number, number> = {};
  payments.filter(p => p.status === "completed" && p.period_year === currentYear).forEach(p => {
    if (p.period_month) rawPaidMap[p.period_month] = (rawPaidMap[p.period_month] || 0) + Number(p.amount);
  });
  const effMap: Record<number, number> = {};
  let carry = 0;
  for (let m = 1; m <= 12; m++) {
    const due_m = getMonthFee(m);
    const credited = (rawPaidMap[m] || 0) + carry;
    effMap[m] = credited;
    carry = credited >= due_m ? (credited - due_m) : 0;
  }
  const monthPaidMap: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) monthPaidMap[m] = Math.min(effMap[m], getMonthFee(m));
  const monthlyRate        = getMonthFee(currentMonth);
  const paidThisMonth      = effMap[currentMonth] || 0;
  const isCurrentMonthPaid = paidThisMonth >= monthlyRate;
  const remainingThisMonth = Math.max(0, monthlyRate - paidThisMonth);
  const totalPaidYear      = Object.values(rawPaidMap).reduce((s, v) => s + v, 0);
  const monthsPaid         = Array.from({length: 12}, (_, i) => i + 1).filter(m => (effMap[m] || 0) >= getMonthFee(m)).length;
  const totalOutstanding   = MONTHS.reduce((sum, _, i) => {
    const m = i + 1; if (m > currentMonth) return sum;
    return sum + Math.max(0, getMonthFee(m) - (effMap[m] || 0));
  }, 0);
  return { vendor, profile, stall, payments: payments.slice(0, 8), monthlyRate, monthPaidMap, effMap, getMonthFee,
    paidThisMonth, isCurrentMonthPaid, remainingThisMonth, totalPaidYear, monthsPaid, totalOutstanding, currentMonth, currentYear };
};

// ── QR Scanner ──────────────────────────────────────────────────────────────────
const QRScanner = ({ onScan, onClose }: { onScan: (val: string) => void; onClose: () => void }) => {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef   = useRef<number>(0);
  const [error,    setError]    = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameras,  setCameras]  = useState<MediaDeviceInfo[]>([]);
  const [camIdx,   setCamIdx]   = useState(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera(); setError(null); setScanning(true);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Camera API is not supported in this browser or requires a secure context (HTTPS/localhost).");
      setScanning(false);
      return;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "environment" },
        });
      } catch (firstErr) {
        // Fallback: If deviceId is not specified and facingMode fails (common on laptops/desktops), try requesting any camera.
        if (!deviceId) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === "videoinput"));
      const jsQRModule = await import("jsqr");
      const jsQR = jsQRModule.default || jsQRModule;
      const tick = () => {
        const video = videoRef.current, canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) { animRef.current = requestAnimationFrame(tick); return; }
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) { stopCamera(); setScanning(false); onScan(code.data); return; }
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      console.error("Camera access error:", err);
      const msg = err.message || "";
      const name = err.name || "";
      if (msg.includes("Permission") || name.includes("NotAllowed")) {
        setError("Camera access denied.");
      } else {
        setError(`Could not access camera: ${name ? `${name}: ` : ""}${msg || "Unknown error occurred"}`);
      }
      setScanning(false);
    }
  }, [stopCamera, onScan]);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#111" }}>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="flex items-center gap-2 text-white">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/20">
              <ScanLine className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <span className="text-sm font-semibold">Scan Vendor QR Code</span>
          </div>
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button onClick={() => { const n = (camIdx + 1) % cameras.length; setCamIdx(n); startCamera(cameras[n]?.deviceId); }}
                className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => { stopCamera(); onClose(); }} className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative aspect-square bg-gray-900">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          {scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-52 w-52">
                <div className="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-emerald-400 rounded-tl-md" />
                <div className="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-emerald-400 rounded-tr-md" />
                <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-emerald-400 rounded-bl-md" />
                <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-emerald-400 rounded-br-md" />
                <div className="absolute inset-x-2 top-0 h-0.5 bg-emerald-400/80 animate-[scanline_2s_linear_infinite]" style={{ boxShadow: "0 0 8px #34d399" }} />
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/95 p-6 text-center">
              <CameraOff className="h-10 w-10 text-accent" />
              <p className="text-sm text-white font-medium">{error}</p>
              <Button size="sm" onClick={() => startCamera()} className="rounded-xl">Try Again</Button>
            </div>
          )}
          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
            </div>
          )}
        </div>
        <div className="px-4 py-3 text-center" style={{ background: "rgba(0,0,0,0.8)" }}>
          <p className="text-xs text-white/60">Point your camera at a vendor's QR code</p>
        </div>
      </div>
      <style>{`@keyframes scanline { 0%{top:0;opacity:1} 90%{top:100%;opacity:1} 100%{top:100%;opacity:0} }`}</style>
    </div>
  );
};

// ── Vendor Detail ────────────────────────────────────────────────────────────────
const VendorDetail = ({ data, onClose }: { data: any; onClose: () => void }) => {
  const { profile, stall, vendor, payments } = data;
  return (
    <div className="space-y-4">
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to scanner
      </button>

      {/* Vendor header */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="px-6 py-5 flex items-start justify-between gap-4" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)" }}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 border border-white/20">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{profile?.first_name} {profile?.last_name}</h2>
              <p className="text-sm text-emerald-200/80 mt-0.5">
                Stall <span className="font-mono font-semibold text-white">{stall?.stall_number}</span> · {stall?.section}
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl border-2 border-white/20 p-2 bg-white">
            <QRCodeSVG value={vendor?.qr_code || ""} size={64} level="H" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4 sm:grid-cols-3 text-sm bg-secondary/30">
          {[
            { icon: Phone,    label: "Contact",     value: profile?.contact_number || "—" },
            { icon: MapPin,   label: "Address",     value: profile?.address || "—"        },
            { icon: Store,    label: "Location",    value: stall?.location || "—"          },
            { icon: Calendar, label: "Award Date",  value: vendor?.award_date ? new Date(vendor.award_date).toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"}) : "—" },
            { icon: CreditCard, label: "Monthly Rate", value: fmt(data.monthlyRate)       },
            { icon: Store,    label: "Stall Status", value: stall?.status === "occupied" ? "Occupied" : "Vacant" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5"><Icon className="h-3 w-3"/>{label}</div>
              <p className="font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payment summary KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label:"Total Paid",     value:fmt(data.totalPaidYear),      icon:TrendingUp,   iconBg:"bg-emerald-100",iconColor:"#10b981",glow:"#10b981",gradient:"from-emerald-50 to-emerald-50/40" },
          { label:"Months Settled", value:`${data.monthsPaid}/${data.currentMonth}`, icon:CheckCircle2, iconBg:data.monthsPaid===data.currentMonth?"bg-emerald-100":"bg-primary/10",iconColor:data.monthsPaid===data.currentMonth?"#10b981":"hsl(var(--primary))",glow:"#10b981",gradient:"from-emerald-50 to-emerald-50/40" },
          { label:"This Month",     value:data.isCurrentMonthPaid?"Paid ✓":fmt(data.remainingThisMonth)+" due", icon:data.isCurrentMonthPaid?CheckCircle2:AlertCircle, iconBg:data.isCurrentMonthPaid?"bg-emerald-100":"bg-accent/10",iconColor:data.isCurrentMonthPaid?"#10b981":"hsl(var(--accent))",glow:data.isCurrentMonthPaid?"#10b981":"hsl(var(--accent))",gradient:data.isCurrentMonthPaid?"from-emerald-50 to-emerald-50/40":"from-accent/5 to-accent/5" },
          { label:"Outstanding",    value:fmt(data.totalOutstanding),   icon:AlertCircle,  iconBg:data.totalOutstanding===0?"bg-emerald-100":"bg-accent/10",iconColor:data.totalOutstanding===0?"#10b981":"hsl(var(--accent))",glow:data.totalOutstanding===0?"#10b981":"hsl(var(--accent))",gradient:data.totalOutstanding===0?"from-emerald-50 to-emerald-50/40":"from-accent/5 to-accent/5" },
        ].map(c=>(
          <div key={c.label} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-md transition-all duration-300 group`} style={{minHeight:100}}>
            <div className="absolute -bottom-6 -right-6 w-16 h-16 rounded-full opacity-[0.08] blur-lg" style={{background:c.glow}}/>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center shadow-sm ${c.iconBg}`}>
                <c.icon className="h-3.5 w-3.5" style={{color:c.iconColor}}/>
              </div>
            </div>
            <p className="font-mono text-base font-bold text-foreground z-10 mt-2">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly status grid */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
          <h3 className="text-[13px] font-bold text-foreground">Payment Status — {data.currentYear}</h3>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border sm:grid-cols-4 lg:grid-cols-6">
          {MONTHS.map((m, i) => {
            const monthNum = i + 1;
            const credited = data.effMap[monthNum] || 0;
            const rate     = data.getMonthFee ? data.getMonthFee(monthNum) : data.monthlyRate;
            const isAdvance = monthNum > data.currentMonth && credited >= rate;
            const isFully   = credited >= rate && !isAdvance;
            const isPartial = credited > 0 && credited < rate && monthNum <= data.currentMonth;
            const isFuture  = monthNum > data.currentMonth && credited < rate;
            return (
              <div key={m} className={`bg-card p-3 text-center ${isFuture ? "opacity-40" : ""}`}>
                <p className="text-xs font-medium text-muted-foreground">{m.slice(0, 3)}</p>
                <div className="mt-1.5 flex justify-center">
                  {isAdvance  ? <CheckCircle2 className="h-4 w-4 text-blue-500" />
                  :isFully    ? <CheckCircle2 className="h-4 w-4 text-success" />
                  :isPartial  ? <Clock className="h-4 w-4 text-primary" />
                  :isFuture   ? <div className="h-4 w-4 rounded-full border-2 border-muted" />
                  :<AlertCircle className="h-4 w-4 text-accent" />}
                </div>
                <p className={`text-[10px] font-semibold mt-1 ${
                  isAdvance?"text-blue-500":isFully?"text-success":isPartial?"text-primary":isFuture?"text-muted-foreground":"text-accent"
                }`}>{isAdvance?"Adv":isFully?"Paid":isPartial?"Part":isFuture?"—":"Unpaid"}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
          <h3 className="text-[13px] font-bold text-foreground">Recent Transactions</h3>
        </div>
        <div className="divide-y">
          {payments.map((p: any) => {
            const mCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, color: "bg-muted", label: p.payment_method, bg:"bg-secondary", text:"text-foreground" };
            const MI = mCfg.icon;
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-emerald-50/40 transition-colors">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  p.status==="completed"?"bg-success/10":p.status==="pending"?"bg-amber-100":"bg-accent/10"
                }`}>
                  {p.status==="completed"?<CheckCircle2 className="h-4 w-4 text-success"/>:p.status==="pending"?<Clock className="h-4 w-4 text-amber-600"/>:<AlertCircle className="h-4 w-4 text-accent"/>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {p.period_month && p.period_year ? `${MONTHS[p.period_month-1]} ${p.period_year}` : new Date(p.created_at).toLocaleDateString("en-PH")}
                  </p>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-lg mt-0.5 ${mCfg.bg} ${mCfg.text}`}>
                    <MI className="h-3 w-3"/>{mCfg.label} · {p.payment_type==="staggered"?"Partial":"Full"}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold text-foreground">{fmt(Number(p.amount))}</p>
                  {p.reference_number && <p className="font-mono text-[10px] text-muted-foreground">{p.reference_number}</p>}
                </div>
              </div>
            );
          })}
          {payments.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No transactions yet</p>}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────────
const AdminQRCodes = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [vendorData,  setVendorData]  = useState<any>(null);
  const [loading,     setLoading]     = useState(false);
  const [notFound,    setNotFound]    = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [search,      setSearch]      = useState("");

  const { data: allVendors = [], isLoading: listLoading } = useQuery({
    queryKey: ["admin-qr-list"],
    queryFn: async () => {
      const { data: vendors } = await supabase.from("vendors").select("id, qr_code, user_id, stalls(stall_number, section, status)").not("stall_id", "is", null);
      if (!vendors) return [];
      const userIds = vendors.map(v => v.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return vendors.map(v => {
        const pr = profiles?.find(p => p.user_id === v.user_id);
        const st = v.stalls as any;
        return { id: v.id, qr_code: v.qr_code || "", vendor: pr?`${pr.first_name} ${pr.last_name}`:"Unknown", stall: st?.stall_number||"—", section: st?.section||"General", status: st?.status==="occupied"?"occupied":"vacant" };
      });
    },
  });

  const handleScan = async (qrValue: string) => {
    setShowScanner(false); setLoading(true); setNotFound(false); setVendorData(null);
    try {
      const data = await fetchVendorByQR(qrValue);
      if (!data) { setNotFound(true); toast.error("QR code not recognized."); }
      else setVendorData(data);
    } catch { setNotFound(true); toast.error("Failed to load vendor data."); }
    finally { setLoading(false); }
  };

  const filteredVendors = allVendors.filter((v: any) =>
    v.vendor.toLowerCase().includes(search.toLowerCase()) || v.stall.toLowerCase().includes(search.toLowerCase())
  );

  const occupiedCount = allVendors.filter((v: any) => v.status === "occupied").length;

  if (vendorData) return (
    <div className="space-y-0">
      <VendorDetail data={vendorData} onClose={() => { setVendorData(null); setManualInput(""); }} />
    </div>
  );

  return (
    <div className="space-y-5">
      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)",boxShadow:"0 20px 48px rgba(15,110,86,0.15)"}}>
        {[[200,"-60px","-60px","top","right"],[250,"-100px","-60px","bottom","left"]].map(([sz,a,b,v,h],i)=>(
          <div key={i} style={{position:"absolute",[v as string]:a,[h as string]:b,width:sz,height:sz,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.08)",pointerEvents:"none"}}/>
        ))}
        <div style={{position:"absolute",inset:0,pointerEvents:"none",opacity:0.04,backgroundImage:"radial-gradient(circle,#fff 1px,transparent 1px)",backgroundSize:"22px 22px"}}/>
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1" style={{color:"rgba(255,255,255,0.6)"}}>Admin Portal</p>
            <h1 className="text-2xl font-bold text-white">QR Code Scanner</h1>
            <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.6)"}}>Scan a vendor QR code to view stall and payment details</p>
          </div>
          <Button onClick={() => setShowScanner(true)} size="lg"
            className="gap-2 rounded-xl border-white/20 bg-white/15 text-white hover:bg-white/25 border">
            <Camera className="h-4 w-4"/> Open Scanner
          </Button>
        </div>
        {/* Stats strip */}
        <div className="relative mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Total Vendors", value: allVendors.length },
            { label: "Occupied Stalls", value: occupiedCount },
            { label: "With QR Codes", value: allVendors.filter((v:any)=>v.qr_code).length },
          ].map(s=>(
            <div key={s.label} className="rounded-xl px-4 py-3 text-center" style={{background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.15)"}}>
              <p className="font-mono text-xl font-bold text-white">{s.value}</p>
              <p className="text-[10px] mt-0.5" style={{color:"rgba(255,255,255,0.6)"}}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scan + How to use ─────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scan card */}
        <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
            <p className="text-[13px] font-bold text-foreground">Scan or Enter QR Code</p>
          </div>
          <div className="p-5 space-y-4">
            <button onClick={() => setShowScanner(true)}
              className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 py-10 hover:bg-primary/8 hover:border-primary/50 transition-all group">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <Camera className="h-7 w-7 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Tap to Open Camera</p>
                <p className="text-xs text-muted-foreground mt-0.5">Point at a vendor's QR code to scan</p>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-primary font-medium">
                <ScanLine className="h-3.5 w-3.5"/> Admin-only scanner
              </span>
            </button>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border"/><span className="text-xs text-muted-foreground">or enter manually</span><div className="flex-1 h-px bg-border"/>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Paste QR code value (PALENGCLICK-…)" className="h-11 rounded-xl font-mono text-sm flex-1"
                value={manualInput} onChange={e=>setManualInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleScan(manualInput.trim())}/>
              <Button onClick={() => handleScan(manualInput.trim())} disabled={loading || !manualInput.trim()} className="h-11 rounded-xl shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Search className="h-4 w-4"/>}
              </Button>
            </div>
            {notFound && (
              <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2.5 text-sm text-accent">
                <AlertCircle className="h-4 w-4 shrink-0"/> No vendor found for this QR code value.
              </div>
            )}
          </div>
        </div>

        {/* How to use */}
        <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
            <p className="text-[13px] font-bold text-foreground">How to Use</p>
          </div>
          <div className="p-5 space-y-3">
            {[
              { step:"1", title:"Open the scanner", desc:"Tap the camera button or 'Open Scanner' above.", icon:Camera },
              { step:"2", title:"Point at QR code",  desc:"Aim at the vendor's printed or on-screen QR code.", icon:ScanLine },
              { step:"3", title:"View details",      desc:"Instantly see stall info, payment status, and history.", icon:Store },
            ].map(s=>(
              <div key={s.step} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{background:"linear-gradient(135deg,#0f6e56,#1d9e75)"}}>{s.step}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2 mt-4">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-800"><strong>Admin only.</strong> This scanner is restricted to admin accounts.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── All vendors list ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-emerald-50/50 to-transparent flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-md"/>
            <p className="text-[13px] font-bold text-foreground">All Vendor QR Codes</p>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{background:"rgba(16,185,129,0.1)",color:"#10b981"}}>{allVendors.length} vendors</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
            <Input placeholder="Search vendor or stall…" className="h-9 pl-9 rounded-xl w-52" value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
        </div>
        {listLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{background:"#0f6e56"}}>
              <Loader2 className="h-5 w-5 animate-spin text-white"/>
            </div>
            <p className="text-sm text-muted-foreground">Loading vendors…</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[80px_1fr_120px_100px_80px] gap-4 px-5 py-3 border-b bg-secondary/30 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <div>QR Code</div><div>Vendor</div><div>Stall</div><div>Status</div><div>Action</div>
            </div>
            <div className="divide-y">
              {filteredVendors.map((v: any) => (
                <div key={v.id} className="hidden sm:grid grid-cols-[80px_1fr_120px_100px_80px] gap-4 px-5 py-3.5 items-center hover:bg-emerald-50/40 transition-colors">
                  <div className="shrink-0 rounded-xl border bg-white p-1.5 w-fit">
                    {v.qr_code ? <QRCodeSVG value={v.qr_code} size={40} level="L"/> : <QrCode className="h-10 w-10 text-muted-foreground/30"/>}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{v.vendor}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.section}</p>
                  </div>
                  <div><p className="font-mono font-semibold text-foreground">{v.stall}</p></div>
                  <div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      v.status==="occupied" ? "bg-success/10 text-success border-success/20" : "bg-secondary text-muted-foreground border-border"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${v.status==="occupied"?"bg-success":"bg-muted-foreground"}`}/>
                      {v.status==="occupied"?"Occupied":"Vacant"}
                    </span>
                  </div>
                  <div>
                    <Button size="sm" variant="outline" className="h-7 gap-1 rounded-lg text-xs" onClick={() => v.qr_code ? handleScan(v.qr_code) : toast.error("No QR code.")}>
                      <Search className="h-3 w-3"/> View
                    </Button>
                  </div>
                </div>
              ))}
              {/* Mobile rows */}
              {filteredVendors.map((v: any) => (
                <button key={`m-${v.id}`} className="sm:hidden w-full flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/40 transition-colors text-left"
                  onClick={() => v.qr_code ? handleScan(v.qr_code) : toast.error("No QR code.")}>
                  <div className="shrink-0 rounded-lg border bg-white p-1.5">
                    {v.qr_code ? <QRCodeSVG value={v.qr_code} size={40} level="L"/> : <QrCode className="h-10 w-10 text-muted-foreground/30"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{v.vendor}</p>
                    <p className="text-xs text-muted-foreground">Stall <span className="font-mono">{v.stall}</span> · {v.section}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v.status==="occupied"?"bg-success/10 text-success":"bg-secondary text-muted-foreground"}`}>
                    {v.status==="occupied"?"Occupied":"Vacant"}
                  </span>
                </button>
              ))}
              {filteredVendors.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                    <Users className="h-7 w-7 text-slate-400"/>
                  </div>
                  <p className="font-medium text-foreground">{allVendors.length===0?"No vendor accounts found":"No vendors match your search"}</p>
                </div>
              )}
            </div>
          </>
        )}
        {filteredVendors.length > 0 && (
          <div className="border-t bg-secondary/30 px-5 py-3 flex justify-between text-xs text-muted-foreground">
            <span>{filteredVendors.length} vendors shown</span>
            <span className="text-emerald-700 font-medium">{occupiedCount} occupied · {allVendors.length - occupiedCount} vacant</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQRCodes;