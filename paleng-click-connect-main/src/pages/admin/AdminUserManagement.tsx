import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus, Search, Shield, Store, Banknote, Loader2,
  X, Users, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, Edit3, Save, Mail, Phone, Home, Lock, UserCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const SECTION_PREFIX: Record<string, string> = {
  "General": "G", "Fish": "F", "Meat": "M",
  "Vegetables": "V", "Dry Goods": "D", "Bolante": "B",
};
const SECTIONS = ["General","Fish","Meat","Vegetables","Dry Goods","Bolante"];
const ROLE_CONFIG = {
  vendor:  { icon: Store,    color: "bg-primary/10 text-primary",    label: "Vendor"  },
  cashier: { icon: Banknote, color: "bg-amber-100 text-amber-700",   label: "Cashier" },
  admin:   { icon: Shield,   color: "bg-purple-100 text-purple-700", label: "Admin"   },
};
const emptyForm = {
  email: "", password: "", role: "vendor" as "vendor" | "cashier",
  first_name: "", middle_name: "", last_name: "",
  address: "", contact_number: "",
  stall_number: "", section: "General", location: "", monthly_rate: "",
};
const emptyEdit = {
  first_name: "", middle_name: "", last_name: "",
  contact_number: "", address: "",
  new_password: "", confirm_password: "",
};

const AdminUserManagement = () => {
  const queryClient = useQueryClient();
  const [showCreate,      setShowCreate]      = useState(false);
  const [search,          setSearch]          = useState("");
  const [filterRole,      setFilterRole]      = useState("all");
  const [filterStatus,    setFilterStatus]    = useState("all");
  const [showPwd,         setShowPwd]         = useState(false);
  const [showNewPwd,      setShowNewPwd]      = useState(false);
  const [showConfPwd,     setShowConfPwd]     = useState(false);
  const [form,            setForm]            = useState({ ...emptyForm });
  const [generatingStall, setGeneratingStall] = useState(false);

  // Edit user state
  const [editUser,    setEditUser]    = useState<any>(null);
  const [editForm,    setEditForm]    = useState({ ...emptyEdit });

  // Suspend with reason state
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }, { data: vendors }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("vendors").select("user_id, stalls(stall_number, section)"),
      ]);
      if (!profiles) return [];
      return profiles.map(p => {
        const userRole   = roles?.find(r => r.user_id === p.user_id);
        const vendorInfo = vendors?.find(v => v.user_id === p.user_id);
        const stall      = vendorInfo?.stalls as any;
        return {
          id:         p.user_id,
          name:       `${p.first_name} ${p.last_name}`,
          first_name: p.first_name,
          middle_name:p.middle_name || "",
          last_name:  p.last_name,
          email:      p.user_id,
          role:       userRole?.role || "vendor",
          stall:      stall?.stall_number || "—",
          section:    stall?.section || "—",
          contact:    p.contact_number || "—",
          address:    p.address || "—",
          status:     p.status,
          created:    p.created_at,
        };
      });
    },
  });

  const generateStallNumber = async (section: string) => {
    setGeneratingStall(true);
    try {
      const prefix = SECTION_PREFIX[section] || "G";
      const { data: existingStalls } = await supabase.from("stalls").select("stall_number").ilike("stall_number", `${prefix}-%`);
      const existingNums = (existingStalls || []).map(s => { const p = s.stall_number?.split("-"); return p?.length === 2 ? parseInt(p[1], 10) : 0; }).filter(n => !isNaN(n) && n > 0);
      let next = 1;
      while (existingNums.includes(next)) next++;
      setForm(f => ({ ...f, stall_number: `${prefix}-${String(next).padStart(3, "0")}` }));
    } catch { toast.error("Failed to generate stall number"); }
    finally { setGeneratingStall(false); }
  };

  useEffect(() => {
    if (form.role === "vendor" && form.section) {
      const prefix = SECTION_PREFIX[form.section] || "G";
      if (!form.stall_number || /^[A-Z]-\d{3}$/.test(form.stall_number)) generateStallNumber(form.section);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.section, form.role]);

  // ── Create user ──────────────────────────────────────────────────────────────
  const createUser = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) throw new Error("Please enter a valid email address");
      if (form.password.length < 6)            throw new Error("Password must be at least 6 characters");
      if (!form.first_name.trim())             throw new Error("First name is required");
      if (!form.last_name.trim())              throw new Error("Last name is required");
      if (form.role === "vendor" && !form.stall_number.trim()) throw new Error("Stall number is required");
      if (form.role === "vendor" && (!form.monthly_rate || Number(form.monthly_rate) <= 0)) throw new Error("Monthly fee is required for vendors");
      const res = await supabase.functions.invoke("create-user", {
        body: {
          email: form.email.trim(), password: form.password,
          first_name: form.first_name.trim(), middle_name: form.middle_name.trim(), last_name: form.last_name.trim(),
          contact_number: form.contact_number.trim(), address: form.address.trim(),
          role: form.role, stall_number: form.stall_number.trim(),
          section: form.section, location: form.location.trim(), monthly_rate: Number(form.monthly_rate),
        },
      });
      if (res.error)       throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: async () => {
      toast.success("Account created successfully!");
      await new Promise(r => setTimeout(r, 500));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false); setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Edit user ────────────────────────────────────────────────────────────────
  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({ first_name: u.first_name, middle_name: u.middle_name || "", last_name: u.last_name, contact_number: u.contact === "—" ? "" : u.contact, address: u.address === "—" ? "" : u.address, new_password: "", confirm_password: "" });
  };

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editForm.first_name.trim()) throw new Error("First name is required");
      if (!editForm.last_name.trim())  throw new Error("Last name is required");
      // Update profile
      const { error: profileErr } = await supabase.from("profiles").update({
        first_name:     editForm.first_name.trim(),
        middle_name:    editForm.middle_name.trim() || null,
        last_name:      editForm.last_name.trim(),
        contact_number: editForm.contact_number.trim() || null,
        address:        editForm.address.trim() || null,
      }).eq("user_id", editUser.id);
      if (profileErr) throw profileErr;
      // Password change via service role (admin edge function)
      if (editForm.new_password) {
        if (editForm.new_password.length < 6) throw new Error("Password must be at least 6 characters");
        if (editForm.new_password !== editForm.confirm_password) throw new Error("Passwords do not match");
        const { error: pwdErr } = await supabase.functions.invoke("create-user", {
          body: { _action: "reset-password", user_id: editUser.id, password: editForm.new_password },
        });
        if (pwdErr) throw new Error("Password update failed. Try again.");
      }
    },
    onSuccess: () => {
      toast.success("Account updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditUser(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Suspend with reason ──────────────────────────────────────────────────────
  const confirmSuspend = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ status: "suspended" }).eq("user_id", suspendTarget.id);
      if (error) throw error;
      // Notify vendor
      await supabase.from("notifications").insert({
        user_id: suspendTarget.id,
        title:   "⚠️ Account Suspended",
        message: `Your account has been suspended by the administrator.\n\nReason: ${suspendReason || "No reason provided."}\n\nPlease contact the Municipal Treasurer's Office for assistance.`,
        type:    "overdue",
      });
    },
    onSuccess: () => {
      toast.success(`${suspendTarget.name}'s account has been suspended.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSuspendTarget(null); setSuspendReason("");
    },
    onError: () => toast.error("Failed to suspend account"),
  });

  const reactivate = useMutation({
    mutationFn: async (u: any) => {
      const { error } = await supabase.from("profiles").update({ status: "active" }).eq("user_id", u.id);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: u.id,
        title:   "✅ Account Reactivated",
        message: "Your account has been reactivated. You can now log in and use PALENG-CLICK.",
        type:    "confirmation",
      });
    },
    onSuccess: (_, u) => {
      toast.success(`${u.name}'s account has been reactivated.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to reactivate account"),
  });

  const filtered = users.filter((u: any) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.stall.toLowerCase().includes(search.toLowerCase()) || u.contact.includes(search);
    return matchSearch && (filterRole === "all" || u.role === filterRole) && (filterStatus === "all" || u.status === filterStatus);
  });

  const counts = {
    total:     users.length,
    vendors:   users.filter((u: any) => u.role === "vendor").length,
    active:    users.filter((u: any) => u.status === "active").length,
    suspended: users.filter((u: any) => u.status === "suspended").length,
  };

  const ef = (key: keyof typeof emptyEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-6">

      {/* ── Suspend confirm modal ─────────────────────────────────────────────── */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setSuspendTarget(null)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 shrink-0">
                  <AlertCircle className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Suspend Account</h3>
                  <p className="text-sm text-muted-foreground">You are about to suspend <strong>{suspendTarget.name}</strong>. They will be notified.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reason for suspension (optional)</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-xl border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="e.g. Non-payment of stall fees, violation of market rules…"
                  value={suspendReason}
                  onChange={e => setSuspendReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-1">
                <Button className="flex-1 gap-2 rounded-xl bg-accent hover:bg-accent/90 text-white"
                  disabled={confirmSuspend.isPending} onClick={() => confirmSuspend.mutate()}>
                  {confirmSuspend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />}
                  Confirm Suspend
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setSuspendTarget(null); setSuspendReason(""); }}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit user modal ───────────────────────────────────────────────────── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setEditUser(null)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <h3 className="font-bold text-foreground">Edit Account</h3>
                <p className="text-xs text-muted-foreground">{editUser.name} · {ROLE_CONFIG[editUser.role as keyof typeof ROLE_CONFIG]?.label}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Personal info */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" /> Personal Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">First Name *</Label><Input className="h-10 rounded-xl" value={editForm.first_name} onChange={ef("first_name")} /></div>
                  <div className="space-y-1"><Label className="text-xs">Last Name *</Label><Input className="h-10 rounded-xl" value={editForm.last_name} onChange={ef("last_name")} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Middle Name</Label><Input className="h-10 rounded-xl" value={editForm.middle_name} onChange={ef("middle_name")} placeholder="Optional" /></div>
              </div>

              {/* Contact */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact Info</p>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-10 pl-9 rounded-xl" placeholder="09xx-xxx-xxxx" value={editForm.contact_number} onChange={ef("contact_number")} />
                </div>
                <div className="relative">
                  <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea className="w-full min-h-[60px] pl-9 pr-3 pt-2.5 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Home address" value={editForm.address} onChange={ef("address")} />
                </div>
              </div>

              {/* Password reset */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Reset Password (optional)</p>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type={showNewPwd ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl" placeholder="New password (min. 6 chars)" value={editForm.new_password} onChange={ef("new_password")} />
                  <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {editForm.new_password && (
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showConfPwd ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl" placeholder="Confirm new password" value={editForm.confirm_password} onChange={ef("confirm_password")} />
                    <button type="button" onClick={() => setShowConfPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                )}
                {editForm.new_password && editForm.confirm_password && editForm.new_password !== editForm.confirm_password && (
                  <p className="text-xs text-accent flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Passwords do not match</p>
                )}
              </div>

              <div className="flex gap-3 pt-2 border-t">
                <Button className="flex-1 gap-2 rounded-xl" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate()}>
                  {saveEdit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => setEditUser(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Create, edit, and manage vendor and cashier accounts</p>
        </div>
        <Button onClick={() => { setShowCreate(true); if (form.role === "vendor") generateStallNumber(form.section); }} className="gap-2 rounded-xl">
          <UserPlus className="h-4 w-4" /> Create Account
        </Button>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Users",  value: counts.total,     icon: Users,       color: "text-foreground",  bg: "bg-secondary"   },
          { label: "Vendors",      value: counts.vendors,   icon: Store,       color: "text-primary",     bg: "bg-primary/10"  },
          { label: "Active",       value: counts.active,    icon: CheckCircle2,color: "text-success",     bg: "bg-success/10"  },
          { label: "Suspended",    value: counts.suspended, icon: AlertCircle, color: counts.suspended > 0 ? "text-accent" : "text-muted-foreground", bg: counts.suspended > 0 ? "bg-accent/10" : "bg-secondary" },
        ].map(c => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 shadow-civic">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{c.label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
              </div>
            </div>
            <p className={`font-mono text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Create Account form ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="flex items-center justify-between border-b bg-secondary/40 px-6 py-4">
              <div><h3 className="font-semibold text-foreground">Create New Account</h3><p className="text-xs text-muted-foreground">Fill in the details to create a new user account</p></div>
              <button onClick={() => { setShowCreate(false); setForm({ ...emptyForm }); }} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Role */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Account Role</Label>
                <div className="flex gap-3">
                  {(["vendor","cashier"] as const).map(r => {
                    const cfg = ROLE_CONFIG[r];
                    return (
                      <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${form.role === r ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground" : "bg-card text-muted-foreground hover:bg-secondary/50"}`}>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cfg.color}`}><cfg.icon className="h-3.5 w-3.5" /></div>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Credentials */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Login Credentials</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-accent">*</span></Label>
                    <Input placeholder="email@example.com" className="h-11 rounded-xl" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password <span className="text-accent">*</span></Label>
                    <div className="relative">
                      <Input type={showPwd ? "text" : "password"} placeholder="Min. 6 characters" className="h-11 rounded-xl pr-10" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                      <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.password && form.password.length < 6 && <p className="text-xs text-accent">Password must be at least 6 characters</p>}
                  </div>
                </div>
              </div>
              {/* Personal */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Information</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5"><Label>First Name <span className="text-accent">*</span></Label><Input placeholder="First name" className="h-11 rounded-xl" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Middle Name</Label><Input placeholder="Optional" className="h-11 rounded-xl" value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Last Name <span className="text-accent">*</span></Label><Input placeholder="Last name" className="h-11 rounded-xl" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                  <div className="space-y-1.5"><Label>Contact Number</Label><Input placeholder="09XX XXX XXXX" className="h-11 rounded-xl" value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} /></div>
                  <div className="space-y-1.5 sm:col-span-2"><Label>Address</Label><Input placeholder="Home address" className="h-11 rounded-xl" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                </div>
              </div>
              {/* Stall (vendor only) */}
              {form.role === "vendor" && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Stall Information</p>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>Section <span className="text-accent">*</span></Label>
                      <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>
                        {SECTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Stall Number <span className="text-accent">*</span> <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Auto</span></Label>
                      <div className="flex gap-2">
                        <Input placeholder="e.g. G-001" className="h-11 rounded-xl font-mono flex-1" value={form.stall_number} onChange={e => setForm(f => ({ ...f, stall_number: e.target.value }))} />
                        <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" disabled={generatingStall} onClick={() => generateStallNumber(form.section)}>
                          {generatingStall ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5"><Label>Location / Remarks</Label><Input placeholder="e.g. Near entrance" className="h-11 rounded-xl" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
                    <div className="space-y-1.5">
                      <Label>Monthly Fee (₱) <span className="text-accent">*</span></Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₱</span>
                        <Input type="number" placeholder="e.g. 1200" className="h-11 rounded-xl pl-7 font-mono" value={form.monthly_rate} onChange={e => setForm(f => ({ ...f, monthly_rate: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2 border-t">
                <Button onClick={() => createUser.mutate()} disabled={createUser.isPending} className="gap-2 rounded-xl">
                  {createUser.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : <><UserPlus className="h-4 w-4" /> Create Account</>}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setShowCreate(false); setForm({ ...emptyForm }); }}>Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search + filters ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, stall, or contact…" className="h-10 pl-10 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="vendor">Vendors</option>
          <option value="cashier">Cashiers</option>
          <option value="admin">Admins</option>
        </select>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{filtered.length}</strong> of <strong className="text-foreground">{users.length}</strong> accounts
      </p>

      {/* ── Users table ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  {["Account","Role","Stall","Contact","Status","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u: any) => {
                  const roleCfg  = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.vendor;
                  const RoleIcon = roleCfg.icon;
                  return (
                    <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${roleCfg.color}`}><RoleIcon className="h-4 w-4" /></div>
                          <div>
                            <p className="font-semibold text-foreground">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{new Date(u.created).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${roleCfg.color}`} style={{ borderColor: "transparent" }}>
                          <RoleIcon className="h-3 w-3" />{roleCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.stall !== "—" ? (
                          <div><p className="font-mono font-semibold text-foreground">{u.stall}</p><p className="text-xs text-muted-foreground">{u.section}</p></div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.contact}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${u.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-accent/10 text-accent border-accent/20"}`}>
                          {u.status === "active" ? <><CheckCircle2 className="h-3 w-3" /> Active</> : <><AlertCircle className="h-3 w-3" /> Suspended</>}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-7 gap-1 rounded-lg text-xs" onClick={() => openEdit(u)}>
                            <Edit3 className="h-3 w-3" /> Edit
                          </Button>
                          {u.status === "active" ? (
                            <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs border-accent/30 text-accent hover:bg-accent/10"
                              onClick={() => { setSuspendTarget(u); setSuspendReason(""); }}>
                              Suspend
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs border-success/30 text-success hover:bg-success/10"
                              disabled={reactivate.isPending} onClick={() => reactivate.mutate(u)}>
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Users className="h-8 w-8 opacity-20 mx-auto mb-2" />
                    <p>{users.length === 0 ? "No accounts yet. Create the first one." : "No accounts match your search."}</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;