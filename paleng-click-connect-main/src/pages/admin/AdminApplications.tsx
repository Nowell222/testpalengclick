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

const SECTION_PREFIX: Record<string, string> = {
  "Building I - 1st Floor":          "B11",
  "Building II - 1st Floor":         "B21",
  "Building I - 2nd Floor":          "B1F",
  "Building II - 2nd Floor":         "B2F",
  "Bldg 1 & 2 Bolante":              "B12",
  "New Building - Mojica":           "NBM",
  "New Building - Kalayaan":         "NBK",
  "Meat Stalls":                     "MS",
  "Fish Stalls":                     "FS",
  "Egg and Dried Fish":              "EDF",
  "Eatery 2nd Floor":                "E2F",
  "Vegetable Section":               "VS",
  "Vegetable Section - Extension":   "VSE",
  "Dry Goods":                       "DG",
  "Eatery / Food Stall":             "EFS",
  "Other":                           "OTH"
};

const STATUS_CONFIG = {
  pending:  { label: "Pending Review", icon: Clock,        color: "text-amber-600 bg-amber-100 border-amber-200" },
  approved: { label: "Approved",       icon: CheckCircle2, color: "text-emerald-600 bg-emerald-100 border-emerald-200" },
  rejected: { label: "Rejected",       icon: XCircle,      color: "text-red-600 bg-red-100 border-red-200" }
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
  const [monthlyRate2026, setMonthlyRate2026] = useState("1450");
  const [monthlyRate2027, setMonthlyRate2027] = useState("");
  const [monthlyRate2028, setMonthlyRate2028] = useState("");
  const [tempPassword, setTempPassword] = useState("PalengClick123");
  const [generatingStall, setGeneratingStall] = useState(false);
  const [assignStall, setAssignStall] = useState(true);
  const [section, setSection] = useState("");

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
      const [{ data: profiles }, { data: roles }, { data: vendors }, { data: history }, { data: schedules }, { data: occupiedStalls }] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name").eq("status", "closed"),
        supabase.from("user_roles").select("user_id").eq("role", "vendor"),
        supabase.from("vendors").select("id, user_id"),
        supabase.from("stall_ownership_history").select("*, stalls(stall_number, section, location, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, area_measurement)").order("started_at", { ascending: false }),
        supabase.from("payment_schedules").select("vendor_id, stall_id, stalls(stall_number, section, location, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, area_measurement)").order("created_at", { ascending: false }),
        supabase.from("stalls").select("stall_number").eq("status", "occupied")
      ]);
      
      if (!profiles || !roles || !vendors) return [];
      
      const occupiedStallNumbers = (occupiedStalls || []).map(s => s.stall_number);
      const closedProfiles = profiles.filter(p => roles.some(r => r.user_id === p.user_id));
      
      const mappedClosed = closedProfiles.map(p => {
        const v = vendors.find(vend => vend.user_id === p.user_id);
        let lastStall = null;
        if (v) {
          const hist = history?.find(h => h.vendor_id === v.id);
          if (hist && hist.stalls) {
            lastStall = hist.stalls;
          } else {
            const sched = schedules?.find(s => s.vendor_id === v.id && s.stalls);
            if (sched && sched.stalls) {
              lastStall = sched.stalls;
            }
          }
        }
        return {
          id: p.user_id,
          vendor_id: v?.id,
          name: `${p.first_name} ${p.last_name}`,
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

    try {
      const { data, error } = await supabase
        .from("stalls")
        .select("section, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028")
        .eq("stall_number", cleanNum)
        .maybeSingle();

      if (data && !error) {
        setSection(data.section || "");
        setMonthlyRate2026(data.monthly_rate_2026 !== null ? String(data.monthly_rate_2026) : "1450");
        setMonthlyRate2027(data.monthly_rate_2027 !== null ? String(data.monthly_rate_2027) : "");
        setMonthlyRate2028(data.monthly_rate_2028 !== null ? String(data.monthly_rate_2028) : "");
      }
    } catch (err) {
      console.error("Error looking up stall details:", err);
    }
  };

  const generateStallNumber = async (section: string) => {
    setGeneratingStall(true);
    try {
      const prefix = SECTION_PREFIX[section] || "G";
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
    const hasStallPref = !!app.preferred_section;
    setAssignStall(hasStallPref);
    setStallNumber("");
    setMonthlyRate2026("1450");
    setMonthlyRate2027("");
    setMonthlyRate2028("");
    setTempPassword("PalengClick123");
    setSection(app.preferred_section || "Vegetable Section");
    if (hasStallPref) {
      generateStallNumber(app.preferred_section);
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
      if (assignStall) {
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
          stall_number: assignStall ? stallNumber : "",
          section: assignStall ? section : undefined, 
          location: assignStall ? "San Juan Public Market" : undefined, 
          monthly_rate: assignStall ? Number(monthlyRate2026) : undefined,
          monthly_rate_2026: assignStall ? Number(monthlyRate2026) : undefined,
          monthly_rate_2027: assignStall && monthlyRate2027 ? Number(monthlyRate2027) : undefined,
          monthly_rate_2028: assignStall && monthlyRate2028 ? Number(monthlyRate2028) : undefined,
          business_permit_number: selectedApp.business_permit_number,
          award_receipt_number: selectedApp.award_receipt_number,
          award_payment_date: selectedApp.award_payment_date,
        },
      });
      
      if (res.error) {
        if (res.error.message?.includes("Failed to send a request")) {
          throw new Error("Connection failed: Unable to approve application. Please check your network or verify if local Deno is running.");
        }
        throw new Error(res.error.message);
      }
      if (res.data?.error) throw new Error(res.data.error);

      // 2. Update Application Status
      const { error: updateErr } = await supabase
        .from("vendor_applications")
        .update({ 
          status: "approved", 
          reviewed_at: new Date().toISOString(),
          admin_notes: assignStall ? `Approved. Assigned Stall: ${stallNumber}` : `Approved. Stall will be assigned later.` 
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
    <div className="space-y-6">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{background:"linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)",boxShadow:"0 20px 48px rgba(15,110,86,0.15)"}}>
        {[[200,"-60px","-60px","top","right"],[250,"-100px","-60px","bottom","left"]].map(([sz,a,b,v,h],i)=>(
          <div key={i} style={{position:"absolute",[v as string]:a,[h as string]:b,width:sz,height:sz,borderRadius:"50%",border:"1.5px solid rgba(255,255,255,0.08)",pointerEvents:"none"}}/>
        ))}
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-emerald-100">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Vendor Applications</h1>
            <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.6)"}}>Review, approve, or reject new stall vendor applications</p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Total Applications</p>
            <p className="text-2xl font-bold mt-1">{counts.total}</p>
          </div>
          <div className="bg-slate-100 p-3 rounded-xl text-slate-600"><FileText className="h-5 w-5"/></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between border-amber-200 bg-amber-50/30">
          <div>
            <p className="text-sm font-semibold text-amber-700">Pending Review</p>
            <p className="text-2xl font-bold mt-1 text-amber-900">{counts.pending}</p>
          </div>
          <div className="bg-amber-100 p-3 rounded-xl text-amber-600"><Clock className="h-5 w-5"/></div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm flex items-center justify-between border-emerald-200 bg-emerald-50/30">
          <div>
            <p className="text-sm font-semibold text-emerald-700">Approved</p>
            <p className="text-2xl font-bold mt-1 text-emerald-900">{counts.approved}</p>
          </div>
          <div className="bg-emerald-100 p-3 rounded-xl text-emerald-600"><CheckCircle2 className="h-5 w-5"/></div>
        </div>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex rounded-xl bg-secondary p-1">
          {["all", "pending", "approved", "rejected"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search applicants..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 rounded-xl"
          />
        </div>
      </div>

      {/* ── List / Details Split ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* List */}
        <div className="md:col-span-1 border rounded-2xl bg-card overflow-hidden h-[600px] flex flex-col">
          <div className="bg-slate-50 px-4 py-3 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Applicant List
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {isLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-emerald-600"/></div>
            ) : filteredApps.length === 0 ? (
              <div className="text-center p-8 text-sm text-muted-foreground">No applications found.</div>
            ) : (
              filteredApps.map((app: any) => {
                const isActive = selectedApp?.id === app.id;
                const conf = STATUS_CONFIG[app.status as keyof typeof STATUS_CONFIG];
                const StatusIcon = conf.icon;
                return (
                  <div key={app.id} onClick={() => setSelectedApp(app)}
                    className={`p-3 rounded-xl cursor-pointer transition-all border ${isActive ? "border-emerald-300 bg-emerald-50" : "border-transparent hover:bg-slate-50 hover:border-slate-200"}`}>
                    <div className="flex justify-between items-start mb-1">
                      <p className={`font-semibold text-sm ${isActive ? "text-emerald-900" : "text-foreground"}`}>{app.first_name} {app.last_name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border ${conf.color}`}>
                        {app.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{app.preferred_section || "None (Blank Stall)"}</p>
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(app.application_date).toLocaleDateString()}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Details Pane */}
        <div className="md:col-span-2">
          {selectedApp ? (
            <div className="border rounded-2xl bg-card shadow-sm overflow-hidden h-full">
              <div className="border-b bg-slate-50 px-6 py-4 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-lg text-foreground">Application Details</h2>
                  <p className="text-xs text-muted-foreground">Submitted {new Date(selectedApp.application_date).toLocaleString()}</p>
                </div>
                <div className={`px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-1.5 ${STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].color}`}>
                  {(() => { const I = STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].icon; return <I className="h-4 w-4" /> })()}
                  {STATUS_CONFIG[selectedApp.status as keyof typeof STATUS_CONFIG].label}
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  {/* Personal Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Applicant</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Full Name</p>
                          <p className="font-medium text-sm">{selectedApp.first_name} {selectedApp.last_name}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Email Address</p>
                          <p className="font-medium text-sm">{selectedApp.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Phone Number</p>
                          <p className="font-medium text-sm">{selectedApp.phone_number}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Business Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2">Business Intent</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Building2 className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Business Name</p>
                          <p className="font-medium text-sm">{selectedApp.business_name || "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Store className="h-4 w-4 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-muted-foreground">Preferred Section</p>
                          <p className={`font-medium text-sm px-2 py-0.5 rounded-md border inline-block ${selectedApp.preferred_section ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-slate-600 bg-slate-50 border-slate-200"}`}>
                            {selectedApp.preferred_section || "None (Blank Stall)"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b pb-2 mb-3">Permit Verification</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Permit Number</p>
                        <p className="font-semibold text-sm text-slate-800">{selectedApp.business_permit_number || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Permit Receipt #</p>
                        <p className="font-semibold text-sm text-slate-800">{selectedApp.award_receipt_number || "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CalendarDays className="h-4 w-4 text-emerald-600 mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Date of Payment</p>
                        <p className="font-semibold text-sm text-slate-800">
                          {selectedApp.award_payment_date ? new Date(selectedApp.award_payment_date).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" }) : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedApp.status !== "pending" && (
                  <div className="mt-8 rounded-xl bg-slate-50 border p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Review Notes</h3>
                    <p className="text-sm whitespace-pre-wrap">{selectedApp.admin_notes || "No notes provided."}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">Reviewed on {new Date(selectedApp.reviewed_at).toLocaleString()}</p>
                  </div>
                )}

                {/* Actions */}
                {selectedApp.status === "pending" && !isReadOnly && (
                  <div className="pt-6 border-t flex gap-3 mt-auto">
                    <Button 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12"
                      onClick={() => openApprovalModal(selectedApp)}
                    >
                      <ShieldCheck className="mr-2 h-5 w-5" /> Approve & Create Vendor
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 rounded-xl h-12"
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
              <p className="font-medium">Select an application to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Approval Modal ─────────────────────────────────────────────────── */}
      {showApprovalModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowApprovalModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="border-b bg-emerald-50/50 px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-emerald-900">Approve Application</h3>
                <p className="text-xs text-emerald-700/70">Create vendor account for {selectedApp.first_name}</p>
              </div>
              <button onClick={() => setShowApprovalModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5"/></button>
            </div>
            
            <div className="p-6 space-y-4">
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
                <Label htmlFor="assignStallApproval" className="text-sm font-semibold cursor-pointer select-none">Assign Stall Details Now</Label>
              </div>

              {assignStall && (
                <>
                  {closedVendors.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Reference Closed Account (Pre-fill Stall Details)</Label>
                      <select 
                        className="h-10 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        onChange={e => {
                          const val = e.target.value;
                          if (val) {
                            const cv = closedVendors.find(c => c.id === val);
                            if (cv && cv.lastStall) {
                              setSection(cv.lastStall.section || "");
                              setStallNumber(cv.lastStall.stall_number || "");
                              setMonthlyRate2026(cv.lastStall.monthly_rate_2026 !== null ? String(cv.lastStall.monthly_rate_2026) : "1450");
                              setMonthlyRate2027(cv.lastStall.monthly_rate_2027 !== null ? String(cv.lastStall.monthly_rate_2027) : "");
                              setMonthlyRate2028(cv.lastStall.monthly_rate_2028 !== null ? String(cv.lastStall.monthly_rate_2028) : "");
                            }
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="">-- Manual Input / Select Closed Account --</option>
                        {closedVendors.map(cv => {
                          const stallStr = cv.lastStall?.stall_number ? ` (Stall: ${cv.lastStall.stall_number})` : "";
                          return (
                            <option key={cv.id} value={cv.id}>
                              {cv.name}{stallStr}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

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
                  
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex justify-between">
                      <span>Assigned Stall Number</span>
                      {generatingStall && <span className="text-emerald-600 text-[10px] flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Generating...</span>}
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

              <div className="pt-4 flex gap-3">
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  disabled={approveMutation.isPending || generatingStall}
                  onClick={() => approveMutation.mutate()}
                >
                  {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : "Confirm Approval"}
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject Modal ───────────────────────────────────────────────────── */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowRejectModal(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="border-b bg-red-50/50 px-6 py-4 rounded-t-2xl flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-red-900">Reject Application</h3>
                <p className="text-xs text-red-700/70">Rejecting {selectedApp.first_name}'s application</p>
              </div>
              <button onClick={() => setShowRejectModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5"/></button>
            </div>
            
            <div className="p-6 space-y-4">
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

              <div className="pt-4 flex gap-3">
                <Button 
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                >
                  {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : "Confirm Rejection"}
                </Button>
                <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowRejectModal(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApplications;
