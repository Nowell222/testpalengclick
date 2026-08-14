import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  FileText, Store, Search, CheckCircle2, XCircle, Clock, Loader2,
  Building2, User, Phone, Mail, X, ShieldCheck, RefreshCw
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
  pending: { label: "Pending BPLO Verification", icon: Clock, color: "text-amber-700 bg-amber-100 border-amber-300" },
  approved: { label: "Verified & Approved", icon: CheckCircle2, color: "text-emerald-700 bg-emerald-100 border-emerald-300" },
  rejected: { label: "Rejected / Invalid Permit", icon: XCircle, color: "text-red-700 bg-red-100 border-red-300" }
};

const BploApplications = () => {
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
    queryKey: ["bplo-vendor-applications"],
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
    queryKey: ["bplo-applications-closed-vendors"],
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

    let reqArea = "";
    let reqR26 = "1450";
    let reqR27 = "";
    let reqR28 = "";
    let reqStallNum = "";
    if (app.admin_notes) {
      try {
        const parsed = JSON.parse(app.admin_notes);
        if (parsed.area_measurement) reqArea = parsed.area_measurement;
        if (parsed.rate_2026) reqR26 = String(parsed.rate_2026);
        if (parsed.rate_2027) reqR27 = String(parsed.rate_2027);
        if (parsed.rate_2028) reqR28 = String(parsed.rate_2028);
        if (parsed.referenced_closed_vendor_id) setSelectedClosedVendorId(parsed.referenced_closed_vendor_id);
        if (parsed.temp_password) setTempPassword(parsed.temp_password);
        if (parsed.stall_number) reqStallNum = parsed.stall_number;
      } catch (e) {}
    }

    if (isBolantePref) {
      setStallNumber("");
      setAreaMeasurement("");
      setMonthlyRate2026("0");
      setMonthlyRate2027("0");
      setMonthlyRate2028("0");
    } else {
      setAreaMeasurement(reqArea);
      setMonthlyRate2026(reqR26);
      setMonthlyRate2027(reqR27);
      setMonthlyRate2028(reqR28);
      if (reqStallNum) {
        setStallNumber(reqStallNum);
      } else {
        generateStallNumber(prefSection);
      }
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
        if (!stallNumber.trim()) throw new Error("Stall Number is required");
        if (!monthlyRate2026 || Number(monthlyRate2026) <= 0) throw new Error("Monthly Rate for 2026 is required");
      }

      // 1. Invoke create-user Edge Function as BPLO officer
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: selectedApp.email,
          password: tempPassword || "PalengClick123",
          first_name: selectedApp.first_name,
          last_name: selectedApp.last_name,
          contact_number: selectedApp.phone_number,
          role: "vendor",
          initial_status: "active",
          stall_number: assignStall && !isBolanteSec ? stallNumber.trim() : "",
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
        throw new Error(errorMsg);
      }
      if (res.data?.error) throw new Error(res.data.error);

      // 2. Link closed vendor if referencing closed account
      let effectiveClosedVendorId = selectedClosedVendorId;
      if (!effectiveClosedVendorId && selectedApp.admin_notes) {
        try {
          const parsed = JSON.parse(selectedApp.admin_notes);
          if (parsed.referenced_closed_vendor_id) effectiveClosedVendorId = parsed.referenced_closed_vendor_id;
        } catch (e) {}
      }

      if (res.data?.user_id && effectiveClosedVendorId) {
        const newUserId = res.data.user_id;
        const { data: newV } = await supabase.from("vendors").select("id, stall_id").eq("user_id", newUserId).maybeSingle();
        if (newV) {
          // 1. Update old vendor record to point transferred_to_vendor_id = newV.id
          await supabase
            .from("vendors")
            .update({ transferred_to_vendor_id: newV.id })
            .or(`id.eq.${effectiveClosedVendorId},user_id.eq.${effectiveClosedVendorId}`);

          // 2. Find closed vendor's ID
          const { data: oldV } = await supabase
            .from("vendors")
            .select("id")
            .or(`id.eq.${effectiveClosedVendorId},user_id.eq.${effectiveClosedVendorId}`)
            .maybeSingle();

          const targetOldVendorId = oldV?.id || effectiveClosedVendorId;

          // 3. Mark old ownership history record as transferred
          await supabase
            .from("stall_ownership_history")
            .update({ status: "transferred" })
            .eq("vendor_id", targetOldVendorId);

          // 4. Ensure new vendor has a stall history record if stall_id exists
          if (newV.stall_id) {
            const { data: existingNewHist } = await supabase
              .from("stall_ownership_history")
              .select("id")
              .eq("vendor_id", newV.id)
              .maybeSingle();

            if (!existingNewHist) {
              await supabase.from("stall_ownership_history").insert({
                stall_id: newV.stall_id,
                vendor_id: newV.id,
                started_at: new Date().toISOString(),
                status: "active"
              });
            }
          }
        }
      }

      // 3. Update Application Status to approved
      const { error: updateErr } = await supabase
        .from("vendor_applications")
        .update({
          status: "approved",
          applicant_user_id: res.data?.user_id || undefined,
          preferred_section: section,
          reviewed_at: new Date().toISOString(),
          admin_notes: `BPLO Verified & Approved. Permit #${selectedApp.business_permit_number || 'N/A'}. Assigned Stall: ${stallNumber || 'Bolante'}`
        })
        .eq("id", selectedApp.id);

      if (updateErr) throw updateErr;

      // 4. Notify Vendor via Edge Function (email)
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-vendor`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anonKey}`, "apikey": anonKey },
          body: JSON.stringify({
            vendor_user_id: "system-approval",
            _email_only: true,
            _target_email: selectedApp.email,
            _push_title: "BPLO Permit Verification Complete — Account Activated!",
            _push_body: `Congratulations! Your business permit has been verified and approved by BPLO.\nStall: ${stallNumber || 'Bolante'}\nTemporary Password: ${tempPassword}\nPlease login to the Vendor Portal to access your dashboard.`
          }),
        });
      } catch (e) {
        console.error("Failed to send approval email", e);
      }
    },
    onSuccess: () => {
      toast.success("Business permit verified & vendor account activated!");
      queryClient.invalidateQueries({ queryKey: ["bplo-vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
          admin_notes: `BPLO Rejection: ${rejectReason || "Invalid or unverified permit details"}`
        })
        .eq("id", selectedApp.id);

      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      toast.success("Application rejected.");
      queryClient.invalidateQueries({ queryKey: ["bplo-vendor-applications"] });
      setShowRejectModal(false);
      setSelectedApp(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredApps = applications.filter((app: any) => {
    const matchSearch = !searchTerm ||
      `${app.first_name} ${app.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.business_permit_number && app.business_permit_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (app.preferred_section && app.preferred_section.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter === "all" || app.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: applications.length,
    pending: applications.filter((a: any) => a.status === "pending").length,
    approved: applications.filter((a: any) => a.status === "approved").length,
  };

  return (
    <div className="space-y-6">
      {/* ── Hero Header ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0d1e36 0%,#1e3a8a 60%,#3b82f6 100%)", boxShadow: "0 20px 48px rgba(30,58,138,0.2)" }}>
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-blue-100">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">BPLO Application & Permit Review</h1>
            <p className="text-xs mt-1 text-blue-200">Verify business permits, receipts, and activate vendor accounts</p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Applications</p>
            <p className="text-2xl font-black mt-1">{counts.total}</p>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl text-slate-600"><FileText className="h-5 w-5" /></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between border-amber-200 bg-amber-50/50">
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending Permit Verification</p>
            <p className="text-2xl font-black mt-1 text-amber-900">{counts.pending}</p>
          </div>
          <div className="bg-amber-100 p-3 rounded-xl text-amber-600"><Clock className="h-5 w-5" /></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between border-emerald-200 bg-emerald-50/50">
          <div>
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Verified & Approved</p>
            <p className="text-2xl font-black mt-1 text-emerald-900">{counts.approved}</p>
          </div>
          <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex rounded-xl bg-secondary p-1">
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {s === "pending" ? "Pending Verification" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendor name, permit #, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* ── Main Split View ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* List Pane */}
        <div className="md:col-span-1 border rounded-2xl bg-card overflow-hidden h-[620px] flex flex-col">
          <div className="bg-slate-50 px-4 py-3 border-b text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Applications List ({filteredApps.length})
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
            ) : filteredApps.length === 0 ? (
              <div className="text-center p-8 text-xs text-muted-foreground">No applications found.</div>
            ) : (
              filteredApps.map((app: any) => {
                const isActive = selectedApp?.id === app.id;
                const conf = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG];
                return (
                  <div key={app.id} onClick={() => setSelectedApp(app)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border ${isActive ? "border-blue-500 bg-blue-50/60 shadow-sm" : "border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                    <div className="flex justify-between items-start mb-1">
                      <p className={`font-bold text-sm ${isActive ? "text-blue-950" : "text-foreground"}`}>{app.first_name} {app.last_name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${conf.color}`}>
                        {app.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-mono text-blue-700 font-semibold truncate">Permit: {app.business_permit_number || "Unverified"}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-1">{app.preferred_section || "Blank Section"}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Details Pane */}
        <div className="md:col-span-2">
          {selectedApp ? (
            <div className="border rounded-2xl bg-card shadow-sm overflow-hidden h-full flex flex-col">
              <div className="border-b bg-slate-50 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg text-foreground">Permit & Application Details</h2>
                  <p className="text-xs text-muted-foreground">Submitted {new Date(selectedApp.application_date || selectedApp.applied_at || selectedApp.created_at).toLocaleString()}</p>
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].color}`}>
                  {STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].label}
                </div>
              </div>

              <div className="p-6 space-y-6 flex-1 overflow-y-auto">
                
                {/* ── PERMIT VERIFICATION CARD (Highlighted for BPLO) ─────────── */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-3">
                  <div className="flex items-center gap-2 border-b border-blue-200 pb-2 text-blue-900 font-bold text-sm">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                    <span>Business Permit Verification Details</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-blue-700 font-semibold">Permit Number</p>
                      <p className="font-mono font-bold text-base text-slate-900 mt-0.5">{selectedApp.business_permit_number || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 font-semibold">Permit Receipt # (OR)</p>
                      <p className="font-mono font-bold text-base text-slate-900 mt-0.5">{selectedApp.award_receipt_number || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 font-semibold">Date of Payment</p>
                      <p className="font-semibold text-sm text-slate-900 mt-0.5">
                        {selectedApp.award_payment_date ? new Date(selectedApp.award_payment_date).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Personal Info */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Applicant Profile</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2.5">
                        <User className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Full Name</p>
                          <p className="font-semibold">{selectedApp.first_name} {selectedApp.last_name}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-semibold">{selectedApp.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="font-semibold">{selectedApp.phone_number}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Business & Stall Request */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Stall Request</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Business Name</p>
                          <p className="font-semibold">{selectedApp.business_name || "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <Store className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Preferred Section</p>
                          <p className="font-semibold text-emerald-700">{selectedApp.preferred_section || "None"}</p>
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
                            <div className="mt-2 rounded-xl bg-slate-50 border p-2.5 space-y-1">
                              <p className="text-xs font-semibold text-slate-700">Area Measurement: <span className="font-mono text-emerald-700">{areaStr} sqm</span></p>
                              <p className="text-[11px] text-slate-600 font-mono">
                                Rates: 2026: ₱{r26 || "—"} · 2027: ₱{r27 || "—"} · 2028: ₱{r28 || "—"}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {selectedApp.status === "pending" && (
                  <div className="pt-4 border-t flex gap-3 mt-auto">
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold"
                      onClick={() => openApprovalModal(selectedApp)}
                    >
                      <ShieldCheck className="mr-2 h-5 w-5" /> Verify Permit & Approve Vendor
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 rounded-xl h-12 font-bold"
                      onClick={() => openRejectModal(selectedApp)}
                    >
                      <XCircle className="mr-2 h-5 w-5" /> Reject Application
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border rounded-2xl bg-card h-full flex flex-col items-center justify-center text-muted-foreground min-h-[400px]">
              <FileText className="h-12 w-12 text-slate-200 mb-4" />
              <p className="font-semibold">Select a vendor application to review permits</p>
            </div>
          )}
        </div>
      </div>

      {/* ── BPLO Approval Modal ────────────────────────────────────────────── */}
      {showApprovalModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="border-b bg-emerald-50 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg text-emerald-950">BPLO Permit Verification & Approval</h3>
                <p className="text-xs text-emerald-700">Activating vendor account for {selectedApp.first_name} {selectedApp.last_name}</p>
              </div>
              <button onClick={() => setShowApprovalModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Verified Permit Summary */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs space-y-1">
                <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Business Permit Details Verified
                </p>
                <p className="text-slate-700 font-mono">Permit #: <strong>{selectedApp.business_permit_number}</strong> | OR #: <strong>{selectedApp.award_receipt_number}</strong></p>
              </div>

              {closedVendors.length > 0 && (
                <div className="space-y-1.5 pb-2 border-b">
                  <Label className="text-xs text-muted-foreground font-medium">Reference Closed Account (Transfer of Ownership)</Label>
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
                    {closedVendors.map(cv => (
                      <option key={cv.id} value={cv.id}>
                        {cv.name} {cv.lastStall?.stall_number ? `(Stall: ${cv.lastStall.stall_number})` : `(${cv.section})`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center space-x-2 pb-3 border-b">
                <input
                  type="checkbox"
                  id="assignStallBploApproval"
                  checked={assignStall}
                  onChange={e => {
                    setAssignStall(e.target.checked);
                    if (e.target.checked) generateStallNumber(selectedApp.preferred_section);
                    else setStallNumber("");
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <Label htmlFor="assignStallBploApproval" className="text-sm font-semibold cursor-pointer select-none">Assign Physical Stall Details Now</Label>
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

                  {!section.toLowerCase().includes('bolante') && (
                    <>
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
                            className="h-10 font-mono flex-1 text-sm"
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
                          className="h-10 font-mono text-sm"
                          placeholder="e.g. 2x2 m or 12 sqm"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Rate 2026 (₱)</Label>
                          <Input
                            type="number"
                            value={monthlyRate2026}
                            onChange={e => setMonthlyRate2026(e.target.value)}
                            className="h-10 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Rate 2027 (₱)</Label>
                          <Input
                            type="number"
                            value={monthlyRate2027}
                            onChange={e => setMonthlyRate2027(e.target.value)}
                            className="h-10 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Rate 2028 (₱)</Label>
                          <Input
                            type="number"
                            value={monthlyRate2028}
                            onChange={e => setMonthlyRate2028(e.target.value)}
                            className="h-10 font-mono text-sm"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">Vendor Temporary Password</Label>
                <Input
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  className="h-10 font-mono text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3 shrink-0">
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-bold"
                disabled={approveMutation.isPending || generatingStall}
                onClick={() => approveMutation.mutate()}
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Activate Account"}
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── BPLO Reject Modal ──────────────────────────────────────────────── */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col my-auto overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="border-b bg-red-50 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-lg text-red-950">Reject Vendor Permit Application</h3>
                <p className="text-xs text-red-700">Rejecting {selectedApp.first_name}'s application</p>
              </div>
              <button onClick={() => setShowRejectModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reason for Rejection (Permit Discrepancy)</Label>
                <textarea
                  className="w-full min-h-[100px] rounded-xl border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 resize-none"
                  placeholder="e.g. Business permit number could not be verified in BPLO records."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3 shrink-0">
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl h-11 font-bold"
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

export default BploApplications;
