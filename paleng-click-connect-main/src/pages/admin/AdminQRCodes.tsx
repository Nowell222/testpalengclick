import { useState, useRef, useEffect, useCallback } from "react";
import {
  QrCode, Camera, CameraOff, Search, Loader2, CheckCircle2,
  AlertCircle, Clock, Store, User, CreditCard, X,
  Smartphone, Building2, Banknote, ScanLine, RefreshCw,
  MapPin, Phone, Calendar, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

// ─── Constants ──────────────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const METHOD_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  gcash:    { icon: Smartphone, color: "bg-blue-500",  label: "GCash"    },
  paymaya:  { icon: Smartphone, color: "bg-green-600", label: "Maya"     },
  instapay: { icon: Building2,  color: "bg-primary",   label: "InstaPay" },
  cash:     { icon: Banknote,   color: "bg-slate-500", label: "Cash"     },
};

// ─── Fetch vendor details from QR code value ────────────────────────────────────
const fetchVendorByQR = async (qrValue: string) => {
  // QR format: PALENGCLICK-{stall_number}-{vendor_uuid}
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
  const monthlyRate  = stall?.monthly_rate || 1450;

  const monthPaidMap: Record<number, number> = {};
  payments.filter(p => p.status === "completed" && p.period_year === currentYear).forEach(p => {
    if (p.period_month) monthPaidMap[p.period_month] = (monthPaidMap[p.period_month] || 0) + Number(p.amount);
  });

  const paidThisMonth      = monthPaidMap[currentMonth] || 0;
  const isCurrentMonthPaid = paidThisMonth >= monthlyRate;
  const remainingThisMonth = Math.max(0, monthlyRate - paidThisMonth);
  const totalPaidYear      = Object.values(monthPaidMap).reduce((s, v) => s + v, 0);
  const monthsPaid         = Object.entries(monthPaidMap).filter(([, v]) => v >= monthlyRate).length;
  const totalOutstanding   = MONTHS.reduce((sum, _, i) => {
    const m = i + 1;
    if (m > currentMonth) return sum;
    return sum + Math.max(0, monthlyRate - (monthPaidMap[m] || 0));
  }, 0);

  return {
    vendor, profile, stall,
    payments: payments.slice(0, 8),
    monthlyRate, monthPaidMap, paidThisMonth,
    isCurrentMonthPaid, remainingThisMonth,
    totalPaidYear, monthsPaid, totalOutstanding,
    currentMonth, currentYear,
  };
};

// ─── QR Scanner component ───────────────────────────────────────────────────────
const QRScanner = ({ onScan, onClose }: { onScan: (val: string) => void; onClose: () => void }) => {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const animRef     = useRef<number>(0);
  const [error,     setError]     = useState<string | null>(null);
  const [scanning,  setScanning]  = useState(false);
  const [cameras,   setCameras]   = useState<MediaDeviceInfo[]>([]);
  const [camIdx,    setCamIdx]    = useState(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async (deviceId?: string) => {
    stopCamera();
    setError(null);
    setScanning(true);
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Enumerate cameras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams    = devices.filter(d => d.kind === "videoinput");
      setCameras(cams);

      // Dynamically load jsQR
      const jsQRModule = await import("https://esm.sh/jsqr@1.4.0" as any);
      const jsQR = jsQRModule.default || jsQRModule;

      const tick = () => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
          animRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
        if (code?.data) {
          stopCamera();
          setScanning(false);
          onScan(code.data);
          return;
        }
        animRef.current = requestAnimationFrame(tick);
      };
      animRef.current = requestAnimationFrame(tick);
    } catch (err: any) {
      setError(err.message?.includes("Permission")
        ? "Camera access denied. Please allow camera access in your browser settings."
        : "Could not access camera. Make sure no other app is using it.");
      setScanning(false);
    }
  }, [stopCamera, onScan]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const switchCamera = () => {
    const nextIdx = (camIdx + 1) % cameras.length;
    setCamIdx(nextIdx);
    startCamera(cameras[nextIdx]?.deviceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-black shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between bg-black/80 px-4 py-3">
          <div className="flex items-center gap-2 text-white">
            <ScanLine className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Scan Vendor QR Code</span>
          </div>
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <button onClick={switchCamera}
                className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors">
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => { stopCamera(); onClose(); }}
              className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Camera view */}
        <div className="relative aspect-square bg-gray-900">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner overlay */}
          {scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Corner brackets */}
              <div className="relative h-52 w-52">
                <div className="absolute top-0 left-0 h-8 w-8 border-t-2 border-l-2 border-primary rounded-tl-md" />
                <div className="absolute top-0 right-0 h-8 w-8 border-t-2 border-r-2 border-primary rounded-tr-md" />
                <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-primary rounded-bl-md" />
                <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-primary rounded-br-md" />
                {/* Scan line animation */}
                <div className="absolute inset-x-2 top-0 h-0.5 bg-primary/80 animate-[scanline_2s_linear_infinite]"
                  style={{ boxShadow: "0 0 8px hsl(var(--primary))" }} />
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-900/95 p-6 text-center">
              <CameraOff className="h-10 w-10 text-accent" />
              <p className="text-sm text-white font-medium">{error}</p>
              <Button size="sm" onClick={() => startCamera()} className="rounded-xl">
                Try Again
              </Button>
            </div>
          )}

          {/* Loading */}
          {!scanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-black/80 px-4 py-3 text-center">
          <p className="text-xs text-white/60">Point your camera at a vendor's QR code</p>
        </div>
      </div>

      {/* Scanline animation style */}
      <style>{`
        @keyframes scanline {
          0%   { top: 0;    opacity: 1; }
          90%  { top: 100%; opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ─── Vendor Detail Panel ────────────────────────────────────────────────────────
const VendorDetail = ({ data, onClose }: { data: any; onClose: () => void }) => {
  const { profile, stall, vendor, payments } = data;

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button onClick={onClose}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        ← Back to scanner
      </button>

      {/* Vendor header card */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="bg-primary/5 border-b px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                {profile?.first_name} {profile?.last_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                Stall <span className="font-mono font-semibold text-foreground">{stall?.stall_number}</span>
                {" · "}{stall?.section} Section
              </p>
            </div>
          </div>
          {/* QR preview */}
          <div className="shrink-0 rounded-xl border-2 border-dashed border-border p-2 bg-white">
            <QRCodeSVG value={vendor?.qr_code || ""} size={64} level="H" />
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 px-6 py-4 sm:grid-cols-3 text-sm">
          {[
            { icon: Phone,    label: "Contact",     value: profile?.contact_number || "—"   },
            { icon: MapPin,   label: "Address",      value: profile?.address || "—"          },
            { icon: Store,    label: "Location",     value: stall?.location || "—"           },
            { icon: Calendar, label: "Award Date",   value: vendor?.award_date ? new Date(vendor.award_date).toLocaleDateString("en-PH",{year:"numeric",month:"long",day:"numeric"}) : "—" },
            { icon: CreditCard,label:"Monthly Rate", value: fmt(data.monthlyRate)             },
            { icon: Store,    label: "Stall Status", value: stall?.status === "occupied" ? "Occupied" : "Vacant" },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <Icon className="h-3 w-3" />
                {label}
              </div>
              <p className="font-medium text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payment summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Paid",     value: fmt(data.totalPaidYear),      color: "text-success",  icon: TrendingUp,   bg: "bg-success/10" },
          { label: "Months Settled", value: `${data.monthsPaid}/${data.currentMonth}`, color: data.monthsPaid === data.currentMonth ? "text-success" : "text-primary", icon: CheckCircle2, bg: data.monthsPaid === data.currentMonth ? "bg-success/10" : "bg-primary/10" },
          { label: "This Month",     value: data.isCurrentMonthPaid ? "Paid ✓" : fmt(data.remainingThisMonth)+" due", color: data.isCurrentMonthPaid ? "text-success" : "text-accent", icon: data.isCurrentMonthPaid ? CheckCircle2 : AlertCircle, bg: data.isCurrentMonthPaid ? "bg-success/10" : "bg-accent/10" },
          { label: "Outstanding",    value: fmt(data.totalOutstanding),   color: data.totalOutstanding === 0 ? "text-success" : "text-accent", icon: AlertCircle, bg: data.totalOutstanding === 0 ? "bg-success/10" : "bg-accent/10" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-3 w-3 ${c.color}`} />
              </div>
            </div>
            <p className={`font-mono text-base font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Payment status per month */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        <div className="border-b bg-secondary/50 px-5 py-3">
          <h3 className="font-semibold text-foreground">Payment Status — {data.currentYear}</h3>
        </div>
        <div className="grid grid-cols-3 gap-px bg-border sm:grid-cols-4 lg:grid-cols-6">
          {MONTHS.map((m, i) => {
            const monthNum = i + 1;
            const paid     = data.monthPaidMap[monthNum] || 0;
            const isFully  = paid >= data.monthlyRate;
            const isPartial= paid > 0 && paid < data.monthlyRate;
            const isFuture = monthNum > data.currentMonth && paid === 0;
            return (
              <div key={m} className={`bg-card p-3 text-center ${isFuture ? "opacity-40" : ""}`}>
                <p className="text-xs font-medium text-muted-foreground">{m.slice(0, 3)}</p>
                <div className="mt-1.5 flex justify-center">
                  {isFully  ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                   isPartial ? <Clock className="h-4 w-4 text-primary" /> :
                   isFuture  ? <div className="h-4 w-4 rounded-full border-2 border-muted" /> :
                               <AlertCircle className="h-4 w-4 text-accent" />}
                </div>
                <p className={`text-[10px] font-medium mt-1 ${
                  isFully ? "text-success" : isPartial ? "text-primary" : isFuture ? "text-muted-foreground" : "text-accent"
                }`}>
                  {isFully ? "Paid" : isPartial ? "Partial" : isFuture ? "—" : "Unpaid"}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-2xl border bg-card shadow-civic">
        <div className="border-b px-5 py-3.5">
          <h3 className="font-semibold text-foreground">Recent Transactions</h3>
        </div>
        <div className="divide-y">
          {payments.map((p: any) => {
            const methodCfg = METHOD_CONFIG[p.payment_method] || { icon: CreditCard, color: "bg-muted", label: p.payment_method };
            const MethodIcon = methodCfg.icon;
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  p.status === "completed" ? "bg-success/10" :
                  p.status === "pending"   ? "bg-amber-100"  : "bg-accent/10"
                }`}>
                  {p.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
                   p.status === "pending"   ? <Clock className="h-4 w-4 text-amber-600" /> :
                                              <AlertCircle className="h-4 w-4 text-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {p.period_month && p.period_year ? `${MONTHS[p.period_month - 1]} ${p.period_year}` : new Date(p.created_at).toLocaleDateString("en-PH")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`flex h-4 w-4 items-center justify-center rounded ${methodCfg.color}`}>
                      <MethodIcon className="h-2.5 w-2.5 text-white" />
                    </span>
                    <p className="text-xs text-muted-foreground capitalize">
                      {methodCfg.label} · {p.payment_type === "staggered" ? "Partial" : "Full"}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-sm font-bold text-foreground">{fmt(Number(p.amount))}</p>
                  {p.reference_number && (
                    <p className="font-mono text-[10px] text-muted-foreground">{p.reference_number}</p>
                  )}
                </div>
              </div>
            );
          })}
          {payments.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────────
const AdminQRCodes = () => {
  const [showScanner, setShowScanner]   = useState(false);
  const [scanning,    setScanning]      = useState(false);
  const [manualInput, setManualInput]   = useState("");
  const [vendorData,  setVendorData]    = useState<any>(null);
  const [loading,     setLoading]       = useState(false);
  const [notFound,    setNotFound]      = useState(false);
  const [search,      setSearch]        = useState("");

  // Fetch all vendors for the list view
  const { data: allVendors = [], isLoading: listLoading } = useQuery({
    queryKey: ["admin-qr-list"],
    queryFn: async () => {
      const { data: vendors } = await supabase
        .from("vendors")
        .select("id, qr_code, user_id, stalls(stall_number, section, status)")
        .not("stall_id", "is", null);
      if (!vendors) return [];
      const userIds = vendors.map(v => v.user_id);
      const { data: profiles } = await supabase
        .from("profiles").select("user_id, first_name, last_name").in("user_id", userIds);
      return vendors.map(v => {
        const pr = profiles?.find(p => p.user_id === v.user_id);
        const st = v.stalls as any;
        return {
          id: v.id, qr_code: v.qr_code || "",
          vendor: pr ? `${pr.first_name} ${pr.last_name}` : "Unknown",
          stall: st?.stall_number || "—",
          section: st?.section || "General",
          status: st?.status === "occupied" ? "occupied" : "vacant",
        };
      });
    },
  });

  const handleScan = async (qrValue: string) => {
    setShowScanner(false);
    setLoading(true);
    setNotFound(false);
    setVendorData(null);
    try {
      const data = await fetchVendorByQR(qrValue);
      if (!data) { setNotFound(true); toast.error("QR code not recognized. No vendor found."); }
      else         setVendorData(data);
    } catch {
      setNotFound(true);
      toast.error("Failed to load vendor data.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualLookup = async () => {
    if (!manualInput.trim()) return;
    await handleScan(manualInput.trim());
  };

  const handleVendorClick = async (qrCode: string) => {
    if (!qrCode) { toast.error("This vendor has no QR code assigned."); return; }
    await handleScan(qrCode);
  };

  const filteredVendors = allVendors.filter((v: any) =>
    v.vendor.toLowerCase().includes(search.toLowerCase()) ||
    v.stall.toLowerCase().includes(search.toLowerCase())
  );

  // If showing vendor detail
  if (vendorData) {
    return (
      <div className="space-y-0">
        <VendorDetail data={vendorData} onClose={() => { setVendorData(null); setManualInput(""); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">QR Code Scanner</h1>
          <p className="text-sm text-muted-foreground">
            Scan a vendor's QR code to view their stall and payment information
          </p>
        </div>
        <Button onClick={() => setShowScanner(true)} className="gap-2 rounded-xl" size="lg">
          <Camera className="h-4 w-4" />
          Open Scanner
        </Button>
      </div>

      {/* Scanner card */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Scan options */}
        <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-5">
          <h3 className="font-semibold text-foreground">Scan or Enter QR Code</h3>

          {/* Camera scan button */}
          <button
            onClick={() => setShowScanner(true)}
            className="w-full flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 py-10 hover:bg-primary/8 hover:border-primary/50 transition-all group"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
              <Camera className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Tap to Open Camera</p>
              <p className="text-xs text-muted-foreground mt-0.5">Point at a vendor's QR code to scan</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
              <ScanLine className="h-3.5 w-3.5" />
              Admin-only scanner
            </div>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or enter manually</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Manual input */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Paste QR code value (PALENGCLICK-...)"
                className="h-11 rounded-xl font-mono text-sm flex-1"
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleManualLookup()}
              />
              <Button onClick={handleManualLookup} disabled={loading || !manualInput.trim()}
                className="h-11 rounded-xl shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {notFound && (
              <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-sm text-accent">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No vendor found for this QR code value.
              </div>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
          <h3 className="font-semibold text-foreground">How to Use</h3>
          <div className="space-y-3">
            {[
              { step: "1", title: "Open the scanner", desc: "Tap the camera button or the 'Open Scanner' button above.", icon: Camera },
              { step: "2", title: "Point at QR code",  desc: "Aim your camera at the vendor's printed or on-screen QR code.", icon: ScanLine },
              { step: "3", title: "View details",      desc: "Instantly see the vendor's stall info, payment status, and history.", icon: Store },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {s.step}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <strong>Admin only.</strong> This scanner is restricted to admin accounts. Vendors and cashiers cannot access this feature.
            </p>
          </div>
        </div>
      </div>

      {/* All vendors list */}
      <div className="rounded-2xl border bg-card shadow-civic">
        <div className="flex items-center justify-between border-b px-5 py-3.5 flex-wrap gap-3">
          <h3 className="font-semibold text-foreground">All Vendor QR Codes</h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendor or stall…" className="h-9 pl-9 rounded-xl w-52"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {listLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="divide-y">
            {filteredVendors.map((v: any) => (
              <button key={v.id} onClick={() => handleVendorClick(v.qr_code)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/40 transition-colors text-left">
                {/* QR mini preview */}
                <div className="shrink-0 rounded-lg border bg-white p-1.5">
                  {v.qr_code
                    ? <QRCodeSVG value={v.qr_code} size={40} level="L" />
                    : <QrCode className="h-10 w-10 text-muted-foreground/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{v.vendor}</p>
                  <p className="text-xs text-muted-foreground">
                    Stall <span className="font-mono">{v.stall}</span> · {v.section}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    v.status === "occupied"
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {v.status === "occupied" ? "Occupied" : "Vacant"}
                  </span>
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
            {filteredVendors.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">
                {allVendors.length === 0 ? "No vendor accounts found. Create vendor accounts first." : "No vendors match your search."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminQRCodes;