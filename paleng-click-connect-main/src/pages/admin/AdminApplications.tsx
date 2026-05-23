import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  FileText, Store, Search, CheckCircle2, XCircle, Clock, Loader2, 
  ChevronRight, Building2, User, Phone, Mail, CalendarDays, X, AlertTriangle, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SECTION_PREFIX: Record<string, string> = {
  "Vegetable Section - Extension":   "VSE",
  "Eatery 2nd Floor":                "E2F",
  "Vegetable Section":               "VS",
  "Egg and Dried Fish":              "EDF",
  "Fish Stalls":                     "FS",
  "Meat Stalls":                     "MS",
  "New Building - Kalayaan":         "NBK",
  "New Building - Mojica":           "NBM",
  "Fruit Stalls and Refreshments":   "FSR",
  "Bldg 1 & 2 Bolante":             "B12",
  "Building II - 2nd Floor":         "B2F",
  "Building I - 2nd Floor":         "B1F",
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
  const [monthlyRate, setMonthlyRate] = useState("1450");
  const [tempPassword, setTempPassword] = useState("PalengClick123");
  const [generatingStall, setGeneratingStall] = useState(false);

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

  const generateStallNumber = async (section: string) => {
    setGeneratingStall(true);
    try {
      const prefix = SECTION_PREFIX[section] || "G";
      const { data: existingStalls } = await supabase.from("stalls").select("stall_number").ilike("stall_number", `${prefix}-%`);
      const existingNums = (existingStalls || []).map(s => { const p = s.stall_number?.split("-"); return p?.length === 2 ? parseInt(p[1], 10) : 0; }).filter(n => !isNaN(n) && n > 0);
      let next = 1;
      while (existingNums.includes(next)) next++;
      setStallNumber(`${prefix}-${String(next).padStart(3, "0")}`);
    } catch { 
      toast.error("Failed to generate stall number"); 
    } finally { 
      setGeneratingStall(false); 
    }
  };

  const openApprovalModal = (app: any) => {
    setSelectedApp(app);
    setStallNumber("");
    setMonthlyRate("1450");
    setTempPassword("PalengClick123");
    generateStallNumber(app.preferred_section);
    setShowApprovalModal(true);
  };

  const openRejectModal = (app: any) => {
    setSelectedApp(app);
    setRejectReason("");
    setShowRejectModal(true);
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!stallNumber.trim()) throw new Error("Stall number is required");
      if (!monthlyRate || Number(monthlyRate) <= 0) throw new Error("Valid monthly rate is required");

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
          stall_number: stallNumber,
          section: selectedApp.preferred_section, 
          location: "San Juan Public Market", 
          monthly_rate: Number(monthlyRate),
        },
      });
      
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      // 2. Update Application Status
      const { error: updateErr } = await supabase
        .from("vendor_applications")
        .update({ 
          status: "approved", 
          reviewed_at: new Date().toISOString(),
          admin_notes: `Approved. Assigned Stall: ${stallNumber}` 
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
            _push_body: `Congratulations! Your vendor application has been approved.\nStall: ${stallNumber}\nTemporary Password: ${tempPassword}\nPlease login to the Vendor Portal to change your password and manage your stall.`
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
                    <p className="text-xs text-muted-foreground truncate">{app.preferred_section}</p>
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
                          <p className="font-medium text-sm text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 inline-block">
                            {selectedApp.preferred_section}
                          </p>
                        </div>
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
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assigned Section</Label>
                <Input disabled value={selectedApp.preferred_section} className="h-10 bg-slate-50" />
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex justify-between">
                  <span>Assigned Stall Number</span>
                  {generatingStall && <span className="text-emerald-600 text-[10px] flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin"/> Generating...</span>}
                </Label>
                <Input 
                  value={stallNumber} 
                  onChange={e => setStallNumber(e.target.value)} 
                  className="h-10 font-mono" 
                  placeholder="e.g. MS-001"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Monthly Rate (₱)</Label>
                <Input 
                  type="number" 
                  value={monthlyRate} 
                  onChange={e => setMonthlyRate(e.target.value)} 
                  className="h-10 font-mono" 
                />
              </div>

              <div className="space-y-1.5">
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
