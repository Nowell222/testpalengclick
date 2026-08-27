import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  FileText, Store, Search, CheckCircle2, XCircle, Clock, Loader2,
  ChevronRight, Building2, User, Phone, Mail, CalendarDays, X, AlertTriangle, ShieldCheck,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeRatesFromArea } from "@/lib/utils";
import { findStallByNumber } from "@/data/marketStallsRegistry";

const SECTION_PREFIX: Record<string, string> = {
  "Building I - 1st Floor": "B11",
  "Building II - 1st Floor": "B21",
  "Building I - 2nd Floor": "B1F",
  "Building II - 2nd Floor": "B2F",
  "Bldg 1 & 2 Bolante": "B12",
  "Outside the Building - Bolante": "OBB",
  "New Building - Mojica": "NBM",
  "New Building - Kalayaan": "NBK",
  "Meat Stalls": "MS",
  "Fish Stalls": "FS",
  "Egg and Dried Fish": "EDF",
  "Eatery 2nd Floor": "E2F",
  "Vegetable Section": "VS",
  "Vegetable Section - Extension": "VSE",
  "Dry Goods": "DG",
  "Eatery / Food Stall": "EFS",
  "Other": "OTH"
};

const STATUS_CONFIG = {
  pending: { label: "Pending Review", icon: Clock, color: "text-amber-600 bg-amber-100 border-amber-200" },
  approved: { label: "Approved", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100 border-emerald-200" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-600 bg-red-100 border-red-200" }
};

const AdminApplications = () => {
  const { role } = useAuth();
  const isReadOnly = role === "eemo";
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Approval Form State
  const [stallNumber, setStallNumber] = useState("");
  const [areaMeasurement, setAreaMeasurement] = useState("");
  const [monthlyRate2026, setMonthlyRate2026] = useState("1450");
  const [monthlyRate2027, setMonthlyRate2027] = useState("");
  const [monthlyRate2028, setMonthlyRate2028] = useState("");
  const [tempPassword, setTempPassword] = useState("PalengClick123");
  const [generatingStall, setGeneratingStall] = useState(false);
  const [assignStall, setAssignStall] = useState(true);
  const [section, setSection] = useState("");
  const [selectedClosedVendorId, setSelectedClosedVendorId] = useState<string | null>(null);

  // Reject Form State
  const [rejectReason, setRejectReason] = useState("");

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["vendor-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_applications")
        .select("*")
        .order("applied_at", { ascending: false });
      if (error) {
        console.error("Error fetching applications:", error);
        throw error;
      }
      return data;
    }
  });

  const { data: closedVendors = [] } = useQuery({
    queryKey: ["admin-applications-closed-vendors"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: vendors }, { data: history }, { data: apps }, { data: occupiedStalls }] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name").eq("status", "closed"),
        supabase.from("user_roles").select("user_id").eq("role", "vendor"),
        supabase.from("vendors").select("id, user_id, stall_id, stalls(stall_number, section, location, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, area_measurement)"),
        supabase.from("stall_ownership_history").select("*, stalls(stall_number, section, location, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, area_measurement)").order("started_at", { ascending: false }),
        supabase.from("vendor_applications").select("applicant_user_id, preferred_section"),
        supabase.from("stalls").select("stall_number").eq("status", "occupied")
      ]);

      if (!profiles || !roles || !vendors) return [];

      const occupiedStallNumbers = (occupiedStalls || []).map(s => s.stall_number);
      const closedProfiles = profiles.filter(p => roles.some(r => r.user_id === p.user_id));

      const mappedClosed = closedProfiles.map(p => {
        const v = vendors.find(vend => vend.user_id === p.user_id);
        const app = apps?.find(a => a.applicant_user_id === p.user_id);
        let lastStall = v?.stalls || null;
        if (!lastStall && v) {
          const hist = history?.find(h => h.vendor_id === v.id);
          if (hist && hist.stalls) lastStall = hist.stalls;
        }
        const section = lastStall?.section || app?.preferred_section || "Outside the Building - Bolante";

        return {
          id: p.user_id,
          vendor_id: v?.id,
          name: `${p.first_name} ${p.last_name}`,
          section,
          lastStall: lastStall as any
        };
      });

      return mappedClosed.filter(cv => {
        if (!cv.lastStall?.stall_number) return true;
        return !occupiedStallNumbers.includes(cv.lastStall.stall_number);
      });
    }
  });

  const lookupStallDetails = async (stallNum: string) => {
    if (!stallNum) return;
    const cleanNum = stallNum.trim();
    if (cleanNum.length < 2) return;

    // Check 897 Masterlist Registry first
    const masterStall = findStallByNumber(cleanNum);
    if (masterStall) {
      if (masterStall.section) setSection(masterStall.section);
      if (masterStall.area !== null) setAreaMeasurement(`${masterStall.area} sqm`);
      if (masterStall.rate2026 !== null) setMonthlyRate2026(String(masterStall.rate2026));
      if (masterStall.rate2027 !== null) setMonthlyRate2027(String(masterStall.rate2027));
      if (masterStall.rate2028 !== null) setMonthlyRate2028(String(masterStall.rate2028));
      return;
    }

    try {
      const { data, error } = await supabase
        .from("stalls")
        .select("section, area_measurement, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028")
        .ilike("stall_number", cleanNum)
        .maybeSingle();

      if (data && !error) {
        setSection(data.section || "");
        const areaStr = data.area_measurement || "";
        setAreaMeasurement(areaStr);
        const computed = computeRatesFromArea(areaStr);
        setMonthlyRate2026(data.monthly_rate_2026 !== null && data.monthly_rate_2026 !== undefined ? String(data.monthly_rate_2026) : (computed.rate2026 || "1450"));
        setMonthlyRate2027(data.monthly_rate_2027 !== null && data.monthly_rate_2027 !== undefined ? String(data.monthly_rate_2027) : computed.rate2027);
        setMonthlyRate2028(data.monthly_rate_2028 !== null && data.monthly_rate_2028 !== undefined ? String(data.monthly_rate_2028) : computed.rate2028);
      }
    } catch (err) {
      console.error("Error looking up stall details:", err);
    }
  };

  const generateStallNumber = async (sec: string) => {
    if (sec && sec.toLowerCase().includes('bolante')) {
      setStallNumber("");
      setAreaMeasurement("");
      setMonthlyRate2026("0");
      setMonthlyRate2027("0");
      setMonthlyRate2028("0");
      return;
    }
    setGeneratingStall(true);
    try {
      const prefix = SECTION_PREFIX[sec] || "G";
      const { data: existingStalls } = await supabase.from("stalls").select("stall_number").ilike("stall_number", `${prefix}-%`);
      const existingNums = (existingStalls || []).map(s => { const p = s.stall_number?.split("-"); return p?.length === 2 ? parseInt(p[1], 10) : 0; }).filter(n => !isNaN(n) && n > 0);
      let next = 1;
      while (existingNums.includes(next)) next++;
      const generatedNum = `${prefix}-${String(next).padStart(3, "0")}`;
      setStallNumber(generatedNum);
      lookupStallDetails(generatedNum);
    } catch { toast.error("Failed to generate stall number"); }
    finally { setGeneratingStall(false); }
  };

  const openApprovalModal = (app: any) => {
    setSelectedApp(app);
    setSelectedClosedVendorId(null);
    const prefSection = app.preferred_section || "Vegetable Section";
    const isBolantePref = prefSection.toLowerCase().includes("bolante");
    setAssignStall(true);
    setSection(prefSection);
    setTempPassword("PalengClick123");

    if (isBolantePref) {
      setStallNumber("");
      setAreaMeasurement("");
      setMonthlyRate2026("0");
      setMonthlyRate2027("0");
      setMonthlyRate2028("0");
    } else {
      setAreaMeasurement("");
      setMonthlyRate2026("1450");
      setMonthlyRate2027("");
      setMonthlyRate2028("");
      generateStallNumber(prefSection);
    }
    setShowApprovalModal(true);

  };

  const openRejectModal = (app: any) => {
    setSelectedApp(app);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      const isBolanteSec = section && section.toLowerCase().includes("bolante");
      if (assignStall && !isBolanteSec) {
        if (!stallNumber.trim()) throw new Error("Stall number is required");
        if (!monthlyRate2026 || Number(monthlyRate2026) <= 0) throw new Error("Valid monthly rate is required");
      }

      // 1. Create User via Edge Function
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: selectedApp.email,
          password: tempPassword,
          first_name: selectedApp.first_name,
          middle_name: "",
          last_name: selectedApp.last_name,
          contact_number: selectedApp.phone_number,
          address: "N/A",
          role: "vendor",
          stall_number: assignStall && !isBolanteSec ? stallNumber : "",
          section: assignStall ? section : undefined,
          location: assignStall ? (isBolanteSec ? "Bolante Section / No Monthly Rent" : "San Juan Public Market") : undefined,
          monthly_rate: assignStall ? (isBolanteSec ? 0 : Number(monthlyRate2026)) : undefined,
          monthly_rate_2026: assignStall ? (isBolanteSec ? 0 : Number(monthlyRate2026)) : undefined,
          monthly_rate_2027: assignStall ? (isBolanteSec ? 0 : (monthlyRate2027 ? Number(monthlyRate2027) : undefined)) : undefined,
          monthly_rate_2028: assignStall ? (isBolanteSec ? 0 : (monthlyRate2028 ? Number(monthlyRate2028) : undefined)) : undefined,
          area_measurement: assignStall && !isBolanteSec ? (areaMeasurement || undefined) : undefined,
          business_permit_number: selectedApp.business_permit_number,
          award_receipt_number: selectedApp.award_receipt_number,
          award_payment_date: selectedApp.award_payment_date,
        },
      });

      if (res.error) {
        let errorMsg = res.error.message;
        try {
          const body = await res.error.context?.json();
          if (body?.error) errorMsg = body.error;
        } catch (e) { }
        if (res.data?.error) errorMsg = res.data.error;
        if (errorMsg.includes("Failed to send a request")) {
          errorMsg = "Connection failed: Unable to approve application. Please check your network or verify if local Deno is running.";
        }
        throw new Error(errorMsg);
      }
      if (res.data?.error) throw new Error(res.data.error);

      // 2. Link closed vendor to new vendor if referencing closed account
      if (res.data?.user_id && selectedClosedVendorId) {
        const newUserId = res.data.user_id;
        const { data: newV } = await supabase.from("vendors").select("id").eq("user_id", newUserId).maybeSingle();
        if (newV) {
          await supabase.from("vendors").update({ transferred_to_vendor_id: newV.id }).eq("id", selectedClosedVendorId);
        }
      }

      // 3. Update Application Status
      const { error: updateErr } = await supabase
        .from("vendor_applications")
        .update({
          status: "approved",
          applicant_user_id: res.data?.user_id || undefined,
          preferred_section: section,
          reviewed_at: new Date().toISOString(),
          admin_notes: assignStall ? (isBolanteSec ? `Approved. Assigned Section: ${section} (Bolante)` : `Approved. Assigned Stall: ${stallNumber}`) : `Approved. Stall will be assigned later.`
        })
        .eq("id", selectedApp.id);

      if (updateErr) throw updateErr;

      // 3. Notify Vendor via Edge Function (email)
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-vendor`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
          body: JSON.stringify({
            vendor_user_id: "system-approval", // We just need email sent
            _email_only: true,
            _target_email: selectedApp.email,
            _push_title: "Vendor Application Approved!",
            _push_body: assignStall
              ? `Congratulations! Your vendor application has been approved.\nStall: ${stallNumber}\nTemporary Password: ${tempPassword}\nPlease login to the Vendor Portal to change your password and manage your stall.`
              : `Congratulations! Your vendor application has been approved.\nTemporary Password: ${tempPassword}\nPlease login to the Vendor Portal to change your password.`
          }),
        });
      } catch (e) {
        console.error("Failed to send approval email", e);
      }
    },
    onSuccess: () => {
      toast.success("Vendor approved and account created!");
      queryClient.invalidateQueries({ queryKey: ["vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stall-history-list"] });
      queryClient.invalidateQueries({ queryKey: ["bplo-history-stalls"] });
      queryClient.invalidateQueries({ queryKey: ["bplo-history-ownership"] });
      setShowApprovalModal(false);
      setSelectedApp(null);
    },
    onError: (e: any) => toast.error(e.message),
  });


  const rejectMutation = useMutation({
    mutationFn: async () => {
      const { error: updateErr } = await supabase
        .from("vendor_applications")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          admin_notes: rejectReason || "Rejected by admin"
        })
        .eq("id", selectedApp.id);

      if (updateErr) throw updateErr;

      // Notify Vendor (email)
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-vendor`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
          body: JSON.stringify({
            vendor_user_id: "system-rejection",
            _email_only: true,
            _target_email: selectedApp.email,
            _push_title: "Vendor Application Update",
            _push_body: `We regret to inform you that your vendor application for the San Juan Public Market was not approved at this time.\nReason: ${rejectReason || "No specific reason provided."}`
          }),
        });
      } catch (e) {
        console.error("Failed to send rejection email", e);
      }
    },
    onSuccess: () => {
      toast.success("Application rejected.");
      queryClient.invalidateQueries({ queryKey: ["vendor-applications"] });
      setShowRejectModal(false);
      setSelectedApp(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredApps = applications.filter((app: any) => {
    const matchSearch = !searchTerm ||
      `${app.first_name} ${app.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.preferred_section.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === "all" || app.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: applications.length,
    pending: applications.filter((a: any) => a.status === "pending").length,
    approved: applications.filter((a: any) => a.status === "approved").length,
  };

  return (
    <div className="space-y-4">
      {/* ── Executive Header Banner ───────────────────────────────────────────── */}
      <div className="rounded-2xl p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 12px 32px rgba(15,110,86,0.12)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">Admin Portal</span>
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-100">Applications</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Vendor Applications</h1>
            <p className="text-xs text-white/70 mt-0.5">Review, verify, and approve new market stall applications</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-xl px-4 py-2 text-right bg-white/10 border border-white/20 shrink-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-200">Pending Review</p>
              <p className="font-mono text-lg font-bold text-white leading-none mt-0.5">{counts.pending}</p>
              <p className="text-[10px] text-emerald-100/70 mt-0.5">of {counts.total} total</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3 Top KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Applications", value: String(counts.total), sub: "All submissions", icon: FileText, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/30" },
          { label: "Pending Review", value: String(counts.pending), sub: "Action required", icon: Clock, iconBg: "bg-amber-100", iconColor: "#f59e0b", glow: "#f59e0b", gradient: "from-amber-50 to-amber-50/30" },
          { label: "Approved Vendors", value: String(counts.approved), sub: "Accounts activated", icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-3.5 hover:shadow-sm transition-all duration-300 group`}>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-xs ${c.iconBg}`}>
                <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[16px] font-bold text-foreground leading-tight">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{c.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search & Filter Controls ────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-xl bg-secondary p-1">
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === s ? "bg-card text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s === "pending" && counts.pending > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] bg-amber-500 text-white font-mono">{counts.pending}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search applicants, emails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* ── List / Details Split ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">

        {/* List */}
        <div className="md:col-span-4 border rounded-2xl bg-card overflow-hidden h-[560px] flex flex-col shadow-xs">
          <div className="bg-gradient-to-r from-emerald-50/50 to-transparent px-4 py-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-600" />
              <span className="text-xs font-bold text-foreground">Applicants ({filteredApps.length})</span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-emerald-600" /></div>
            ) : filteredApps.length === 0 ? (
              <div className="text-center p-8 text-xs text-muted-foreground">No applications found.</div>
            ) : (
              filteredApps.map((app: any) => {
                const isActive = selectedApp?.id === app.id;
                const conf = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG];
                const StatusIcon = conf.icon;
                return (
                  <div key={app.id} onClick={() => setSelectedApp(app)}
                    className={`p-2.5 rounded-xl cursor-pointer transition-all border ${isActive ? "border-emerald-500/40 bg-emerald-50/70 shadow-xs" : "border-transparent hover:bg-secondary/60"}`}>
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <p className={`font-semibold text-xs truncate ${isActive ? "text-emerald-950 font-bold" : "text-foreground"}`}>{app.first_name} {app.last_name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider border shrink-0 ${conf.color}`}>
                        {app.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{app.preferred_section || "General"}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(app.application_date || app.applied_at || app.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Details Pane */}
        <div className="md:col-span-8">
          {selectedApp ? (
            <div className="border rounded-2xl bg-card shadow-xs overflow-hidden h-[560px] flex flex-col">
              <div className="border-b bg-gradient-to-r from-emerald-50/50 to-transparent px-5 py-3 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="font-bold text-sm text-foreground">Application Details</h2>
                  <p className="text-[11px] text-muted-foreground">Submitted {new Date(selectedApp.application_date || selectedApp.applied_at || selectedApp.created_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                </div>
                <div className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 ${STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].color}`}>
                  {(() => { const I = STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].icon; return <I className="h-3.5 w-3.5" /> })()}
                  {STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].label}
                </div>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Personal Info */}
                  <div className="space-y-2.5 bg-secondary/20 p-3 rounded-xl border">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Applicant Information</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">Full Name</p>
                          <p className="font-semibold text-xs text-foreground">{selectedApp.first_name} {selectedApp.last_name}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">Email Address</p>
                          <p className="font-medium text-xs text-foreground">{selectedApp.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">Phone Number</p>
                          <p className="font-medium text-xs text-foreground">{selectedApp.phone_number || "—"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Business Info */}
                  <div className="space-y-2.5 bg-secondary/20 p-3 rounded-xl border">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1">Business Intent</h3>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">Business Name</p>
                          <p className="font-medium text-xs text-foreground">{selectedApp.business_name || "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Store className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold">Preferred Section</p>
                          <p className={`font-medium text-xs px-2 py-0.5 rounded-md border inline-block mt-0.5 ${selectedApp.preferred_section ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-slate-600 bg-slate-50 border-slate-200"}`}>
                            {selectedApp.preferred_section || "General"}
                          </p>
                        </div>
                      </div>
                      {(() => {
                        let areaStr = "";
                        let r26 = "";
                        let r27 = "";
                        let r28 = "";
                        if (selectedApp.admin_notes) {
                          try {
                            const p = JSON.parse(selectedApp.admin_notes);
                            if (p.area_measurement) areaStr = p.area_measurement;
                            if (p.rate_2026) r26 = String(p.rate_2026);
                            if (p.rate_2027) r27 = String(p.rate_2027);
                            if (p.rate_2028) r28 = String(p.rate_2028);
                          } catch {}
                        }
                        if (areaStr) {
                          const computed = computeRatesFromArea(areaStr);
                          r26 = r26 || computed.rate2026;
                          r27 = r27 || computed.rate2027;
                          r28 = r28 || computed.rate2028;
                          return (
                            <div className="rounded-lg bg-card border p-2 space-y-0.5">
                              <p className="text-[11px] font-semibold text-slate-700">Area: <span className="font-mono text-emerald-700">{areaStr} sqm</span></p>
                              <p className="text-[10px] text-slate-500 font-mono">
                                2026: ₱{r26 || "—"} · 2027: ₱{r27 || "—"} · 2028: ₱{r28 || "—"}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b pb-1 mb-2.5">Permit Verification</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="flex items-start gap-2 bg-secondary/20 p-2.5 rounded-xl border">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Permit Number</p>
                        <p className="font-semibold text-xs text-foreground font-mono">{selectedApp.business_permit_number || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-secondary/20 p-2.5 rounded-xl border">
                      <FileText className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Receipt #</p>
                        <p className="font-semibold text-xs text-foreground font-mono">{selectedApp.award_receipt_number || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 bg-secondary/20 p-2.5 rounded-xl border">
                      <CalendarDays className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Payment Date</p>
                        <p className="font-semibold text-xs text-foreground">
                          {selectedApp.award_payment_date ? new Date(selectedApp.award_payment_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedApp.status !== "pending" && (
                  <div className="rounded-xl bg-secondary/30 border p-3">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Review Notes</h3>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{selectedApp.admin_notes || "No notes provided."}</p>
                    <p className="text-[10px] text-muted-foreground mt-1.5">Reviewed on {new Date(selectedApp.reviewed_at).toLocaleString("en-PH")}</p>
                  </div>
                )}

                {/* Actions */}
                {selectedApp.status === "pending" && !isReadOnly && (
                  <div className="pt-3 border-t flex gap-2.5 mt-auto">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 text-xs font-semibold shadow-xs"
                      onClick={() => openApprovalModal(selectedApp)}
                    >
                      <ShieldCheck className="mr-1.5 h-4 w-4" /> Approve & Create Vendor
                    </Button>
                    <Button
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200 rounded-xl h-10 text-xs font-semibold"
                      onClick={() => openRejectModal(selectedApp)}
                    >
                      <XCircle className="mr-1.5 h-4 w-4" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border rounded-2xl bg-card h-full flex flex-col items-center justify-center text-muted-foreground min-h-[400px]">
              <FileText className="h-12 w-12 text-slate-200 mb-4" />
              <p className="font-medium">Select an application to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Approval Modal ─────────────────────────────────────────────────── */}
      {showApprovalModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="border-b bg-emerald-50/50 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg text-emerald-900">Approve Application</h3>
                <p className="text-xs text-emerald-700/70">Create vendor account for {selectedApp.first_name}</p>
              </div>
              <button onClick={() => setShowApprovalModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {closedVendors.length > 0 && (
                <div className="space-y-1.5 pb-2 border-b">
                  <Label className="text-xs text-muted-foreground font-medium">Reference Closed Account / Transfer of Ownership</Label>
                  <select
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        const cv = closedVendors.find(c => c.id === val);
                        if (cv) {
                          setSelectedClosedVendorId(cv.vendor_id || null);
                          const secName = cv.section || cv.lastStall?.section || "Outside the Building - Bolante";
                          setSection(secName);
                          if (secName.toLowerCase().includes("bolante")) {
                            setStallNumber("");
                            setAreaMeasurement("");
                            setMonthlyRate2026("0");
                            setMonthlyRate2027("0");
                            setMonthlyRate2028("0");
                          } else if (cv.lastStall) {
                            setStallNumber(cv.lastStall.stall_number || "");
                            setAreaMeasurement(cv.lastStall.area_measurement || "");
                            setMonthlyRate2026(cv.lastStall.monthly_rate_2026 !== null ? String(cv.lastStall.monthly_rate_2026) : "1450");
                            setMonthlyRate2027(cv.lastStall.monthly_rate_2027 !== null ? String(cv.lastStall.monthly_rate_2027) : "");
                            setMonthlyRate2028(cv.lastStall.monthly_rate_2028 !== null ? String(cv.lastStall.monthly_rate_2028) : "");
                          }
                        }
                      } else {
                        setSelectedClosedVendorId(null);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">-- Select Closed Account (Optional) --</option>
                    {closedVendors.map(cv => {
                      const stallStr = cv.lastStall?.stall_number
                        ? ` (Stall: ${cv.lastStall.stall_number})`
                        : ` (${cv.section || "Bolante"})`;
                      return (
                        <option key={cv.id} value={cv.id}>
                          {cv.name}{stallStr}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="flex items-center space-x-2 pb-3 border-b">
                <input
                  type="checkbox"
                  id="assignStallApproval"
                  checked={assignStall}
                  onChange={e => {
                    setAssignStall(e.target.checked);
                    if (e.target.checked) {
                      generateStallNumber(selectedApp.preferred_section);
                    } else {
                      setStallNumber("");
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <Label htmlFor="assignStallApproval" className="text-sm font-semibold cursor-pointer select-none">Assign Physical Stall Details Now</Label>
              </div>

              {assignStall && (
                <>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Assigned Section</Label>
                    <select
                      className="h-10 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      value={section}
                      onChange={e => {
                        const newSection = e.target.value;
                        setSection(newSection);
                        generateStallNumber(newSection);
                      }}
                    >
                      {Object.keys(SECTION_PREFIX).map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>

                  {section && section.toLowerCase().includes('bolante') ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-800 flex items-start gap-3">
                      <span className="text-2xl leading-none mt-0.5"></span>
                      <div>
                        <p className="font-bold text-amber-900">Bolante Section — No Stall Required</p>
                        <p className="text-xs text-amber-700 mt-1">Bolante vendors do not occupy a physical stall and are not charged monthly rent. No stall number or rate is needed.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground flex justify-between">
                        <span>Assigned Stall Number</span>
                        {generatingStall && <span className="text-emerald-600 text-[10px] flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Generating...</span>}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          value={stallNumber}
                          onChange={e => setStallNumber(e.target.value)}
                          onBlur={e => lookupStallDetails(e.target.value)}
                          className="h-10 font-mono flex-1"
                          placeholder="e.g. MS-001"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-xl shrink-0"
                          disabled={generatingStall}
                          onClick={() => generateStallNumber(section)}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {!section.toLowerCase().includes('bolante') && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Area Size / Measurement</Label>
                      <Input
                        value={areaMeasurement}
                        onChange={e => {
                          const val = e.target.value;
                          setAreaMeasurement(val);
                          if (!section.toLowerCase().includes('bolante')) {
                            const rates = computeRatesFromArea(val);
                            setMonthlyRate2026(rates.rate2026);
                            setMonthlyRate2027(rates.rate2027);
                            setMonthlyRate2028(rates.rate2028);
                          }
                        }}
                        className="h-10 font-mono"
                        placeholder="e.g. 2x2 m or 12 sqm"
                      />
                    </div>
                  )}

                  {!section.toLowerCase().includes('bolante') && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Rate 2026 (₱)</Label>
                        <Input
                          type="number"
                          value={monthlyRate2026}
                          onChange={e => setMonthlyRate2026(e.target.value)}
                          className="h-10 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Rate 2027 (₱)</Label>
                        <Input
                          type="number"
                          value={monthlyRate2027}
                          onChange={e => setMonthlyRate2027(e.target.value)}
                          className="h-10 font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Rate 2028 (₱)</Label>
                        <Input
                          type="number"
                          value={monthlyRate2028}
                          onChange={e => setMonthlyRate2028(e.target.value)}
                          className="h-10 font-mono"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                <Input
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  className="h-10 font-mono"
                />
                <p className="text-[10px] text-muted-foreground">An email will be sent to <strong>{selectedApp.email}</strong> with their login details.</p>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50/50 flex gap-3 shrink-0">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11"
                disabled={approveMutation.isPending || generatingStall}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Approval"}
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="border-b bg-red-50/50 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg text-red-900">Reject Application</h3>
                <p className="text-xs text-red-700/70">Rejecting {selectedApp.first_name}'s application</p>
              </div>
              <button onClick={() => setShowRejectModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reason for Rejection (Optional)</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                  placeholder="e.g. No available stalls in preferred section at this time."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">This reason will be included in the email sent to the applicant.</p>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50/50 flex gap-3 shrink-0">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-11"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Rejection"}
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplications;
