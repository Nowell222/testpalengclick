import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus, Search, Shield, Store, Banknote, Loader2,
  X, Users, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, ChevronDown, Filter,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ─── Section prefixes for auto stall number ────────────────────────────────────
const SECTION_PREFIX: Record<string, string> = {
  "General":    "G",
  "Fish":       "F",
  "Meat":       "M",
  "Vegetables": "V",
  "Dry Goods":  "D",
  "Bolante":    "B",
};

const SECTIONS = ["General","Fish","Meat","Vegetables","Dry Goods","Bolante"];

const ROLE_CONFIG = {
  vendor:  { icon: Store,   color: "bg-primary/10 text-primary",    label: "Vendor"  },
  cashier: { icon: Banknote,color: "bg-amber-100 text-amber-700",   label: "Cashier" },
  admin:   { icon: Shield,  color: "bg-purple-100 text-purple-700", label: "Admin"   },
};

const emptyForm = {
  email: "", password: "", role: "vendor" as "vendor" | "cashier",
  first_name: "", middle_name: "", last_name: "",
  address: "", contact_number: "",
  stall_number: "", section: "General", location: "",
};

// ─── Component ─────────────────────────────────────────────────────────────────
const AdminUserManagement = () => {
  const queryClient = useQueryClient();
  const [showCreate,   setShowCreate]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterRole,   setFilterRole]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showPwd,      setShowPwd]      = useState(false);
  const [form,         setForm]         = useState({ ...emptyForm });
  const [generatingStall, setGeneratingStall] = useState(false);

  // ── Fetch users ──────────────────────────────────────────────────────────────
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
          id:      p.user_id,
          name:    `${p.first_name} ${p.last_name}`,
          email:   p.user_id,
          role:    userRole?.role || "vendor",
          stall:   stall?.stall_number || "—",
          section: stall?.section || "—",
          contact: p.contact_number || "—",
          address: p.address || "—",
          status:  p.status,
          created: p.created_at,
        };
      });
    },
  });

  // ── Auto-generate stall number ───────────────────────────────────────────────
  const generateStallNumber = async (section: string) => {
    setGeneratingStall(true);
    try {
      const prefix = SECTION_PREFIX[section] || "G";
      // Get all existing stall numbers with this prefix
      const { data: existingStalls } = await supabase
        .from("stalls")
        .select("stall_number")
        .ilike("stall_number", `${prefix}-%`);

      const existingNums = (existingStalls || [])
        .map(s => {
          const parts = s.stall_number?.split("-");
          return parts?.length === 2 ? parseInt(parts[1], 10) : 0;
        })
        .filter(n => !isNaN(n) && n > 0);

      // Find next available number
      let next = 1;
      while (existingNums.includes(next)) next++;

      const newStallNumber = `${prefix}-${String(next).padStart(3, "0")}`;
      setForm(f => ({ ...f, stall_number: newStallNumber }));
      toast.success(`Generated stall number: ${newStallNumber}`);
    } catch {
      toast.error("Failed to generate stall number");
    } finally {
      setGeneratingStall(false);
    }
  };

  // Auto-generate when section changes (if stall number field is empty or auto-generated)
  useEffect(() => {
    if (form.role === "vendor" && form.section) {
      const prefix = SECTION_PREFIX[form.section] || "G";
      // Only auto-regenerate if the current value looks auto-generated or is empty
      if (!form.stall_number || /^[A-Z]-\d{3}$/.test(form.stall_number)) {
        generateStallNumber(form.section);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.section, form.role]);

  // ── Create user mutation ─────────────────────────────────────────────────────
  const createUser = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) throw new Error("Please enter a valid email address");
      if (form.password.length < 6)            throw new Error("Password must be at least 6 characters");
      if (!form.first_name.trim())             throw new Error("First name is required");
      if (!form.last_name.trim())              throw new Error("Last name is required");
      if (form.role === "vendor" && !form.stall_number.trim()) throw new Error("Stall number is required for vendors");

      const res = await supabase.functions.invoke("create-user", {
        body: {
          email:          form.email.trim(),
          password:       form.password,
          first_name:     form.first_name.trim(),
          middle_name:    form.middle_name.trim(),
          last_name:      form.last_name.trim(),
          contact_number: form.contact_number.trim(),
          address:        form.address.trim(),
          role:           form.role,
          stall_number:   form.stall_number.trim(),
          section:        form.section,
          location:       form.location.trim(),
        },
      });
      if (res.error)       throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: async () => {
      toast.success("Account created successfully!");
      await new Promise(r => setTimeout(r, 500));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowCreate(false);
      setForm({ ...emptyForm });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Toggle status ─────────────────────────────────────────────────────────────
  const toggleStatus = useMutation({
    mutationFn: async ({ userId, newStatus }: { userId: string; newStatus: string }) => {
      const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  // ── Filtered users ─────────────────────────────────────────────────────────────
  const filtered = users.filter((u: any) => {
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.stall.toLowerCase().includes(search.toLowerCase()) ||
      u.contact.includes(search);
    const matchRole   = filterRole   === "all" || u.role   === filterRole;
    const matchStatus = filterStatus === "all" || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  // ── Summary counts ─────────────────────────────────────────────────────────────
  const counts = {
    total:     users.length,
    vendors:   users.filter((u: any) => u.role === "vendor").length,
    cashiers:  users.filter((u: any) => u.role === "cashier").length,
    active:    users.filter((u: any) => u.status === "active").length,
    suspended: users.filter((u: any) => u.status === "suspended").length,
  };

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Create, update, and manage vendor and cashier accounts</p>
        </div>
        <Button onClick={() => { setShowCreate(true); if (form.role === "vendor") generateStallNumber(form.section); }}
          className="gap-2 rounded-xl">
          <UserPlus className="h-4 w-4" /> Create Account
        </Button>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Users",  value: counts.total,     icon: Users,         color: "text-foreground",  bg: "bg-secondary"   },
          { label: "Vendors",      value: counts.vendors,   icon: Store,          color: "text-primary",     bg: "bg-primary/10"  },
          { label: "Active",       value: counts.active,    icon: CheckCircle2,   color: "text-success",     bg: "bg-success/10"  },
          { label: "Suspended",    value: counts.suspended, icon: AlertCircle,    color: counts.suspended > 0 ? "text-accent" : "text-muted-foreground", bg: counts.suspended > 0 ? "bg-accent/10" : "bg-secondary" },
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

      {/* ── Create Account Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y:  0  }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border bg-card shadow-civic overflow-hidden"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b bg-secondary/40 px-6 py-4">
              <div>
                <h3 className="font-semibold text-foreground">Create New Account</h3>
                <p className="text-xs text-muted-foreground">Fill in the details below to create a new user account</p>
              </div>
              <button onClick={() => { setShowCreate(false); setForm({ ...emptyForm }); }}
                className="rounded-lg p-1.5 hover:bg-secondary transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Role selector */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Account Role</Label>
                <div className="flex gap-3">
                  {(["vendor","cashier"] as const).map(r => {
                    const cfg = ROLE_CONFIG[r];
                    return (
                      <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                        className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                          form.role === r
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground"
                            : "bg-card text-muted-foreground hover:bg-secondary/50"
                        }`}>
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${cfg.color}`}>
                          <cfg.icon className="h-3.5 w-3.5" />
                        </div>
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Login credentials */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Login Credentials</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Email <span className="text-accent">*</span></Label>
                    <Input placeholder="email@example.com" className="h-11 rounded-xl"
                      value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password <span className="text-accent">*</span></Label>
                    <div className="relative">
                      <Input type={showPwd ? "text" : "password"} placeholder="Min. 6 characters" className="h-11 rounded-xl pr-10"
                        value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                      <button type="button" onClick={() => setShowPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {form.password && form.password.length < 6 && (
                      <p className="text-xs text-accent">Password must be at least 6 characters</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal info */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Personal Information</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>First Name <span className="text-accent">*</span></Label>
                    <Input placeholder="First name" className="h-11 rounded-xl"
                      value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Middle Name</Label>
                    <Input placeholder="Middle name (optional)" className="h-11 rounded-xl"
                      value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name <span className="text-accent">*</span></Label>
                    <Input placeholder="Last name" className="h-11 rounded-xl"
                      value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact Number</Label>
                    <Input placeholder="09XX XXX XXXX" className="h-11 rounded-xl"
                      value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Address</Label>
                    <Input placeholder="Home address" className="h-11 rounded-xl"
                      value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Stall info (vendor only) */}
              {form.role === "vendor" && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Stall Information</p>
                  <div className="grid gap-4 sm:grid-cols-3">

                    {/* Section first */}
                    <div className="space-y-1.5">
                      <Label>Section <span className="text-accent">*</span></Label>
                      <select className="h-11 w-full rounded-xl border bg-background px-3 text-sm"
                        value={form.section}
                        onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>
                        {SECTIONS.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </div>

                    {/* Auto-generated stall number */}
                    <div className="space-y-1.5">
                      <Label>
                        Stall Number <span className="text-accent">*</span>
                        <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Auto-generated</span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. G-001"
                          className="h-11 rounded-xl font-mono flex-1"
                          value={form.stall_number}
                          onChange={e => setForm(f => ({ ...f, stall_number: e.target.value }))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-xl shrink-0"
                          disabled={generatingStall}
                          onClick={() => generateStallNumber(form.section)}
                          title="Generate new stall number"
                        >
                          {generatingStall
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Auto-generated based on section. Click <RefreshCw className="inline h-3 w-3" /> to regenerate, or type a custom number.
                      </p>
                    </div>

                    {/* Location */}
                    <div className="space-y-1.5">
                      <Label>Location / Remarks</Label>
                      <Input placeholder="e.g. Near entrance" className="h-11 rounded-xl"
                        value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                    </div>
                  </div>

                  {/* Stall number preview */}
                  {form.stall_number && (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-primary/10 bg-primary/5 px-4 py-3">
                      <Store className="h-4 w-4 text-primary shrink-0" />
                      <div className="text-sm">
                        <span className="text-muted-foreground">Stall </span>
                        <strong className="font-mono text-foreground">{form.stall_number}</strong>
                        <span className="text-muted-foreground"> · {form.section} Section</span>
                        {form.location && <span className="text-muted-foreground"> · {form.location}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2 border-t">
                <Button
                  onClick={() => createUser.mutate()}
                  disabled={createUser.isPending}
                  className="gap-2 rounded-xl"
                >
                  {createUser.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</>
                    : <><UserPlus className="h-4 w-4" /> Create Account</>}
                </Button>
                <Button variant="outline" className="rounded-xl"
                  onClick={() => { setShowCreate(false); setForm({ ...emptyForm }); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search + filters ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, stall, or contact…" className="h-10 pl-10 rounded-xl"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm"
          value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="vendor">Vendors</option>
          <option value="cashier">Cashiers</option>
          <option value="admin">Admins</option>
        </select>
        <select className="h-10 rounded-xl border bg-background px-3 text-sm"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
        <strong className="text-foreground">{users.length}</strong> accounts
      </p>

      {/* ── Users table ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50">
                  {["Account","Role","Stall","Contact","Status","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u: any) => {
                  const roleCfg = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.vendor;
                  const RoleIcon = roleCfg.icon;
                  return (
                    <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                      {/* Account */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${roleCfg.color}`}>
                            <RoleIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{u.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(u.created).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${roleCfg.color}`}
                          style={{ borderColor: "transparent" }}>
                          <RoleIcon className="h-3 w-3" />
                          {roleCfg.label}
                        </span>
                      </td>

                      {/* Stall */}
                      <td className="px-4 py-3">
                        {u.stall !== "—" ? (
                          <div>
                            <p className="font-mono font-semibold text-foreground">{u.stall}</p>
                            <p className="text-xs text-muted-foreground">{u.section}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3 text-muted-foreground">{u.contact}</td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          u.status === "active"
                            ? "bg-success/10 text-success border-success/20"
                            : "bg-accent/10 text-accent border-accent/20"
                        }`}>
                          {u.status === "active"
                            ? <><CheckCircle2 className="h-3 w-3" /> Active</>
                            : <><AlertCircle  className="h-3 w-3" /> Suspended</>}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-7 rounded-lg text-xs ${
                            u.status === "active"
                              ? "border-accent/30 text-accent hover:bg-accent/10"
                              : "border-success/30 text-success hover:bg-success/10"
                          }`}
                          disabled={toggleStatus.isPending}
                          onClick={() => toggleStatus.mutate({
                            userId:    u.id,
                            newStatus: u.status === "active" ? "suspended" : "active",
                          })}
                        >
                          {u.status === "active" ? "Suspend" : "Activate"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <Users className="h-8 w-8 opacity-20 mx-auto mb-2" />
                      <p>{users.length === 0 ? "No accounts yet. Create the first one." : "No accounts match your search."}</p>
                    </td>
                  </tr>
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