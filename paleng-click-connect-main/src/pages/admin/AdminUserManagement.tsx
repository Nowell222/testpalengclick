import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus, Search, Shield, Store, Banknote, Loader2,
  X, Users, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, Edit3, Save, Phone, Home, Lock, UserCircle, AlertTriangle,
  FileUp, Download, CheckCheck, XCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import VendorDocumentsManager from "@/components/admin/VendorDocumentsManager";

const SECTION_PREFIX: Record<string, string> = {
  "Vegetable Section - Extension": "VSE",
  "Eatery 2nd Floor": "E2F",
  "Vegetable Section": "VS",
  "Egg and Dried Fish": "EDF",
  "Fish Stalls": "FS",
  "Meat Stalls": "MS",
  "New Building - Kalayaan": "NBK",
  "New Building - Mojica": "NBM",
  "Fruit Stalls and Refreshments": "FSR",
  "Bldg 1 & 2 Bolante": "B12",
  "Building II - 2nd Floor": "B2F",
  "Building I - 2nd Floor": "B1F",
};
const SECTIONS = [
  "Vegetable Section - Extension",
  "Eatery 2nd Floor",
  "Vegetable Section",
  "Egg and Dried Fish",
  "Fish Stalls",
  "Meat Stalls",
  "New Building - Kalayaan",
  "New Building - Mojica",
  "Fruit Stalls and Refreshments",
  "Bldg 1 & 2 Bolante",
  "Building II - 2nd Floor",
  "Building I - 2nd Floor",
];
const ROLE_CONFIG = {
  vendor: { icon: Store, color: "bg-emerald-100 text-emerald-700", label: "Vendor" },
  cashier: { icon: Banknote, color: "bg-amber-100 text-amber-700", label: "Cashier" },
  admin: { icon: Shield, color: "bg-purple-100 text-purple-700", label: "Admin" },
};

// ── Status config — used throughout for consistent badge/color rendering ─────
const STATUS_CONFIG = {
  active: {
    label: "Active",
    dot: "bg-success",
    badge: "bg-success/10 text-success border-success/20",
  },
  suspended: {
    label: "Suspended",
    dot: "bg-accent",
    badge: "bg-accent/10 text-accent border-accent/20",
  },
  // NEW: delinquent status — amber/orange to distinguish from suspended (red)
  delinquent: {
    label: "Delinquent",
    dot: "bg-amber-500",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
  },
};

const emptyForm = {
  email: "", password: "", role: "vendor" as "vendor" | "cashier",
  first_name: "", middle_name: "", last_name: "",
  address: "", contact_number: "",
  stall_number: "", section: "Vegetable Section - Extension", location: "", monthly_rate: "",
};
const emptyEdit = {
  first_name: "", middle_name: "", last_name: "",
  contact_number: "", address: "",
  new_password: "", confirm_password: "",
};

const AdminUserManagement = () => {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfPwd, setShowConfPwd] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [generatingStall, setGeneratingStall] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ ...emptyEdit });
  const [suspendTarget, setSuspendTarget] = useState<any>(null);
  const [suspendReason, setSuspendReason] = useState("");
  // NEW: separate state for the delinquent modal
  const [delinquentTarget, setDelinquentTarget] = useState<any>(null);
  const [delinquentReason, setDelinquentReason] = useState("");
  // NEW: separate state for documents modal
  const [docsTarget, setDocsTarget] = useState<any>(null);

  // ── CSV Import state ──────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvFileName, setCsvFileName] = useState("");
  const [importResults, setImportResults] = useState<{ name: string; status: "pending" | "success" | "error"; message?: string }[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const csvInputRef = useRef<HTMLInputElement>(null);

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
        const userRole = roles?.find(r => r.user_id === p.user_id);
        const vendorInfo = vendors?.find(v => v.user_id === p.user_id);
        const stall = vendorInfo?.stalls as any;
        return {
          id: p.user_id, name: `${p.first_name} ${p.last_name}`,
          first_name: p.first_name, middle_name: p.middle_name || "", last_name: p.last_name,
          role: userRole?.role || "vendor",
          stall: stall?.stall_number || "—", section: stall?.section || "—",
          contact: p.contact_number || "—", address: p.address || "—",
          status: p.status, created: p.created_at,
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
    if (form.role === "vendor" && form.section) generateStallNumber(form.section);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.section, form.role]);

  const createUser = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) throw new Error("Please enter a valid email address");
      if (form.password.length < 6) throw new Error("Password must be at least 6 characters");
      if (!form.first_name.trim()) throw new Error("First name is required");
      if (!form.last_name.trim()) throw new Error("Last name is required");
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
      if (res.error) throw new Error(res.error.message);
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

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({ first_name: u.first_name, middle_name: u.middle_name || "", last_name: u.last_name, contact_number: u.contact === "—" ? "" : u.contact, address: u.address === "—" ? "" : u.address, new_password: "", confirm_password: "" });
  };

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editForm.first_name.trim()) throw new Error("First name is required");
      if (!editForm.last_name.trim()) throw new Error("Last name is required");
      const { error: profileErr } = await supabase.from("profiles").update({
        first_name: editForm.first_name.trim(), middle_name: editForm.middle_name.trim() || null,
        last_name: editForm.last_name.trim(), contact_number: editForm.contact_number.trim() || null,
        address: editForm.address.trim() || null,
      }).eq("user_id", editUser.id);
      if (profileErr) throw profileErr;
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

  const confirmSuspend = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ status: "suspended" }).eq("user_id", suspendTarget.id);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: suspendTarget.id,
        title: "⚠️ Account Suspended",
        message: `Your account has been suspended.\n\nReason: ${suspendReason || "No reason provided."}\n\nPlease contact the Municipal Treasurer's Office.`,
        type: "overdue",
      });
    },
    onSuccess: () => {
      toast.success(`${suspendTarget.name}'s account has been suspended.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSuspendTarget(null); setSuspendReason("");
    },
    onError: () => toast.error("Failed to suspend account"),
  });

  // NEW: Mark as Delinquent mutation
  // Sets status to "delinquent", sends a notification, and blocks login (handled by auth check)
  const confirmDelinquent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: "delinquent" })
        .eq("user_id", delinquentTarget.id);
      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: delinquentTarget.id,
        title: "🔒 Account Flagged as Delinquent",
        message: `Your account has been flagged as delinquent and your access has been temporarily disabled.\n\nReason: ${delinquentReason || "Outstanding unpaid fees."}\n\nPlease settle your balance and contact the Market Supervisor or Municipal Treasurer's Office to restore your access.`,
        type: "overdue",
      });
    },
    onSuccess: () => {
      toast.success(`${delinquentTarget.name} has been marked as delinquent.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setDelinquentTarget(null); setDelinquentReason("");
    },
    onError: () => toast.error("Failed to mark account as delinquent"),
  });

  const reactivate = useMutation({
    mutationFn: async (u: any) => {
      const { error } = await supabase.from("profiles").update({ status: "active" }).eq("user_id", u.id);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: u.id, title: "✅ Account Reactivated",
        message: "Your account has been reactivated. You can now log in and use PALENG-CLICK.",
        type: "confirmation",
      });
    },
    onSuccess: (_, u) => {
      toast.success(`${u.name}'s account has been reactivated.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Failed to reactivate account"),
  });

  // ── CSV helpers ───────────────────────────────────────────────────────────
  const parseCSV = (text: string) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    // Normalize header names to canonical keys, handling common variations
    const HEADER_ALIASES: Record<string, string> = {
      "monthly_rate": "monthly_rate",
      "monthly rate": "monthly_rate",
      "monthlyrate": "monthly_rate",
      "rate": "monthly_rate",
      "monthly_fee": "monthly_rate",
      "monthly fee": "monthly_rate",
      "fee": "monthly_rate",
      "stall_rate": "monthly_rate",
      "stall_number": "stall_number",
      "stall number": "stall_number",
      "stallnumber": "stall_number",
      "stall_no": "stall_number",
      "stall no": "stall_number",
      "stall": "stall_number",
      "first_name": "first_name",
      "first name": "first_name",
      "firstname": "first_name",
      "last_name": "last_name",
      "last name": "last_name",
      "lastname": "last_name",
      "middle_name": "middle_name",
      "middle name": "middle_name",
      "middlename": "middle_name",
      "contact_number": "contact_number",
      "contact number": "contact_number",
      "contact": "contact_number",
      "phone": "contact_number",
      "mobile": "contact_number",
    };

    const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
    const headers = rawHeaders.map(h => {
      const normalized = h.toLowerCase().replace(/\s+/g, "_");
      const alias = h.toLowerCase().trim();
      return HEADER_ALIASES[alias] || HEADER_ALIASES[normalized] || normalized;
    });

    return lines.slice(1).filter(l => l.trim()).map(line => {
      const values: string[] = [];
      let cur = "", inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; }
        else if (ch === "," && !inQ) { values.push(cur.trim()); cur = ""; }
        else { cur += ch; }
      }
      values.push(cur.trim());
      const row: any = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
      return row;
    });
  };

  const handleCSVFile = (file: File) => {
    setCsvFileName(file.name);
    setImportResults([]);
    setImportDone(false);
    setShowPreview(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      setCsvRows(rows);
      setImportResults(rows.map(r => ({
        name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || "Unknown",
        status: "pending" as const,
      })));
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (!csvRows.length || isImporting) return;
    setIsImporting(true);
    setShowPreview(false);
    const results = csvRows.map(r => ({
      name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || r.email || "Unknown",
      status: "pending" as "pending" | "success" | "error",
      message: undefined as string | undefined,
    }));
    setImportResults([...results]);

    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      try {
        const res = await supabase.functions.invoke("create-user", {
          body: {
            email: (row.email || "").trim(),
            password: (row.password || "").trim(),
            first_name: (row.first_name || "").trim(),
            middle_name: (row.middle_name || "").trim(),
            last_name: (row.last_name || "").trim(),
            contact_number: (row.contact_number || "").trim(),
            address: (row.address || "").trim(),
            role: (row.role || "vendor").trim(),
            stall_number: (row.stall_number || "").trim(),
            section: (row.section || "Vegetable Section - Extension").trim(),
            location: (row.location || "").trim(),
            monthly_rate: row.monthly_rate !== undefined && row.monthly_rate !== ""
              ? Number(String(row.monthly_rate).replace(/,/g, ".").trim())
              : undefined,
          },
        });
        // res.data contains the actual error message from the edge function body
        // res.error is just a generic "non-2xx" wrapper — always prefer res.data?.error
        const errMsg = res.data?.error || res.error?.message || null;
        if (errMsg) {
          results[i] = { ...results[i], status: "error", message: errMsg };
        } else {
          results[i] = { ...results[i], status: "success" };
        }
      } catch (err: any) {
        results[i] = { ...results[i], status: "error", message: err.message || "Unknown error" };
      }
      setImportResults([...results]);
      await new Promise(r => setTimeout(r, 200));
    }
    setIsImporting(false);
    setImportDone(true);
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    const succeeded = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "error").length;
    if (failed === 0) toast.success(`All ${succeeded} users imported successfully!`);
    else toast.warning(`${succeeded} imported, ${failed} failed. Check the log below.`);
  };

  const downloadSampleCSV = () => {
    const header = "email,password,first_name,middle_name,last_name,contact_number,address,role,stall_number,section,location,monthly_rate";
    const row1 = "juan@example.com,abc123,Juan,,Dela Cruz,09171234567,Lipa City,vendor,VSE-001,Vegetable Section - Extension,Near gate,1200";
    const row2 = "maria@example.com,abc123,Maria,Santos,Reyes,09181234567,Batangas City,cashier,,,,";
    const blob = new Blob([header + "\n" + row1 + "\n" + row2], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "sample-users.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const resetImport = () => {
    setCsvRows([]); setCsvFileName(""); setImportResults([]);
    setIsImporting(false); setImportDone(false); setShowPreview(true);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const filtered = users.filter((u: any) => {
    const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.stall.toLowerCase().includes(search.toLowerCase()) || u.contact.includes(search);
    return matchSearch && (filterRole === "all" || u.role === filterRole) && (filterStatus === "all" || u.status === filterStatus);
  });

  const counts = {
    total: users.length,
    vendors: users.filter((u: any) => u.role === "vendor").length,
    active: users.filter((u: any) => u.status === "active").length,
    suspended: users.filter((u: any) => u.status === "suspended").length,
    // NEW: delinquent count for KPI card
    delinquent: users.filter((u: any) => u.status === "delinquent").length,
  };

  const ef = (key: keyof typeof emptyEdit) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setEditForm(f => ({ ...f, [key]: e.target.value }));

  return (
    <div className="space-y-5">

      {/* ── NEW: Mark as Delinquent confirm modal ──────────────────────────── */}
      {delinquentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setDelinquentTarget(null)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Mark as Delinquent</h3>
                  <p className="text-sm text-muted-foreground">
                    <strong>{delinquentTarget.name}</strong>'s account will be <span className="font-semibold text-amber-600">disabled</span>. They will be notified and unable to log in until reactivated.
                  </p>
                </div>
              </div>
              {/* Info box explaining what happens at login */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 space-y-1">
                <p className="font-semibold">What the vendor will see when they try to log in:</p>
                <p className="italic">"Your account has been marked as delinquent due to outstanding fees. Please contact the Market Supervisor or Treasurer's Office to resolve this."</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-xl border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-200"
                  placeholder="e.g. 3 months unpaid stall fees…"
                  value={delinquentReason}
                  onChange={e => setDelinquentReason(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  className="flex-1 gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white border-0"
                  disabled={confirmDelinquent.isPending}
                  onClick={() => confirmDelinquent.mutate()}
                >
                  {confirmDelinquent.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <AlertTriangle className="h-4 w-4" />}
                  Confirm — Mark Delinquent
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setDelinquentTarget(null); setDelinquentReason(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suspend confirm modal */}
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
                  <p className="text-sm text-muted-foreground">Suspending <strong>{suspendTarget.name}</strong>. They will be notified.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
                <textarea className="w-full min-h-[80px] rounded-xl border bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/20"
                  placeholder="e.g. Non-payment of stall fees…" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button className="flex-1 gap-2 rounded-xl bg-accent hover:bg-accent/90 text-white" disabled={confirmSuspend.isPending} onClick={() => confirmSuspend.mutate()}>
                  {confirmSuspend.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertCircle className="h-4 w-4" />} Confirm Suspend
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setSuspendTarget(null); setSuspendReason(""); }}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setEditUser(null)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50/50 to-transparent px-5 py-4 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-foreground">Edit Account</h3>
                <p className="text-xs text-muted-foreground">{editUser.name} · {ROLE_CONFIG[editUser.role as keyof typeof ROLE_CONFIG]?.label}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" /> Personal Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">First Name *</Label><Input className="h-10 rounded-xl" value={editForm.first_name} onChange={ef("first_name")} /></div>
                  <div className="space-y-1"><Label className="text-xs">Last Name *</Label><Input className="h-10 rounded-xl" value={editForm.last_name} onChange={ef("last_name")} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Middle Name</Label><Input className="h-10 rounded-xl" value={editForm.middle_name} onChange={ef("middle_name")} placeholder="Optional" /></div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact Info</p>
                <div className="relative"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-10 pl-9 rounded-xl" placeholder="09xx-xxx-xxxx" value={editForm.contact_number} onChange={ef("contact_number")} /></div>
                <div className="relative"><Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea className="w-full min-h-[60px] pl-9 pr-3 pt-2.5 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Home address" value={editForm.address} onChange={ef("address")} /></div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Reset Password (optional)</p>
                <div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type={showNewPwd ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl" placeholder="New password (min. 6 chars)" value={editForm.new_password} onChange={ef("new_password")} />
                  <button type="button" onClick={() => setShowNewPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>
                {editForm.new_password && (<div className="relative"><Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type={showConfPwd ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl" placeholder="Confirm new password" value={editForm.confirm_password} onChange={ef("confirm_password")} />
                  <button type="button" onClick={() => setShowConfPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showConfPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div>)}
                {editForm.new_password && editForm.confirm_password && editForm.new_password !== editForm.confirm_password && (
                  <p className="text-xs text-accent flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Passwords do not match</p>)}
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

      {/* Docs Modal */}
      {docsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setDocsTarget(null)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-blue-50/50 to-transparent px-5 py-4 shrink-0">
              <div>
                <h3 className="font-bold text-foreground">Vendor Documents</h3>
                <p className="text-xs text-muted-foreground">{docsTarget.name}</p>
              </div>
              <button onClick={() => setDocsTarget(null)} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <VendorDocumentsManager userId={docsTarget.id} />
            </div>
          </div>
        </div>
      )}

      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0f6e56 0%,#0d5a47 100%)", boxShadow: "0 20px 48px rgba(15,110,86,0.15)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>Admin Portal</p>
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Create, edit, and manage vendor and cashier accounts</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => { setShowCreate(true); if (form.role === "vendor") generateStallNumber(form.section); }}
              className="gap-2 rounded-xl border-white/20 bg-white/15 text-white hover:bg-white/25 border">
              <UserPlus className="h-4 w-4" /> Create Account
            </Button>
            <Button onClick={() => { setShowImport(v => !v); resetImport(); }}
              className="gap-2 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 border">
              <FileUp className="h-4 w-4" /> Import CSV
            </Button>
          </div>
        </div>
      </div>

      {/* ── Summary KPI cards ── now 5 cards including Delinquent ─────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total Users", value: counts.total, icon: Users, iconBg: "bg-blue-100", iconColor: "#0ea5e9", glow: "#0ea5e9", gradient: "from-blue-50 to-blue-50/40" },
          { label: "Vendors", value: counts.vendors, icon: Store, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/40" },
          { label: "Active", value: counts.active, icon: CheckCircle2, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/40" },
          // NEW: Delinquent KPI card — amber
          { label: "Delinquent", value: counts.delinquent, icon: AlertTriangle, iconBg: counts.delinquent > 0 ? "bg-amber-100" : "bg-secondary", iconColor: counts.delinquent > 0 ? "#d97706" : "hsl(220,10%,55%)", glow: counts.delinquent > 0 ? "#d97706" : "transparent", gradient: counts.delinquent > 0 ? "from-amber-50 to-amber-50/40" : "from-secondary to-secondary/40" },
          { label: "Suspended", value: counts.suspended, icon: AlertCircle, iconBg: counts.suspended > 0 ? "bg-red-100" : "bg-secondary", iconColor: counts.suspended > 0 ? "#ef4444" : "hsl(220,10%,55%)", glow: counts.suspended > 0 ? "#ef4444" : "transparent", gradient: counts.suspended > 0 ? "from-red-50 to-red-50/40" : "from-secondary to-secondary/40" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-md transition-all duration-300 group`} style={{ minHeight: 110 }}>
            <div className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full opacity-[0.08] blur-lg group-hover:opacity-[0.12] transition-opacity" style={{ background: c.glow }} />
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{c.label}</p>
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${c.iconBg} group-hover:shadow-md transition-shadow`}>
                <c.icon className="h-4 w-4" style={{ color: c.iconColor }} />
              </div>
            </div>
            <div className="z-10 mt-2">
              <p className="font-mono text-[22px] font-bold text-foreground">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── CSV Import panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-blue-50/60 to-transparent px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <h3 className="text-[13px] font-bold text-foreground">Bulk Import via CSV</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Upload a CSV file to create multiple accounts at once</p>
              </div>
              <button onClick={() => { setShowImport(false); resetImport(); }} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Step 1: Download sample + upload */}
              {!csvFileName && (
                <div className="space-y-4">
                  {/* Sample download */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
                    <Download className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-blue-800">Need a template?</p>
                      <p className="text-xs text-blue-600 mt-0.5">Download our sample CSV with the correct column headers already set up.</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 gap-1.5 rounded-lg border-blue-300 text-blue-700 hover:bg-blue-100" onClick={downloadSampleCSV}>
                      <Download className="h-3.5 w-3.5" /> Download Sample
                    </Button>
                  </div>

                  {/* Required columns reference */}
                  <div className="rounded-xl border bg-secondary/40 px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Required CSV Columns</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {[
                        { col: "email", req: true }, { col: "password", req: true }, { col: "first_name", req: true },
                        { col: "last_name", req: true }, { col: "role", req: true, note: "vendor / cashier" },
                        { col: "middle_name", req: false }, { col: "contact_number", req: false }, { col: "address", req: false },
                        { col: "stall_number", req: false, note: "vendors only" }, { col: "section", req: false, note: "vendors only" },
                        { col: "location", req: false }, { col: "monthly_rate", req: false, note: "vendors only" },
                      ].map(({ col, req, note }) => (
                        <div key={col} className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${req ? "bg-emerald-500" : "bg-slate-300"}`} />
                          <span className="font-mono text-[11px] text-foreground">{col}</span>
                          {note && <span className="text-[10px] text-muted-foreground">({note})</span>}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">● required &nbsp; ○ optional</p>
                  </div>

                  {/* Drop zone */}
                  <label
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/40 py-10 cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all"
                    onDragOver={e => { e.preventDefault(); }}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}
                  >
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <FileUp className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-foreground">Drop your CSV here, or <span className="text-blue-600 underline underline-offset-2">browse</span></p>
                      <p className="text-xs text-muted-foreground mt-1">.csv files only</p>
                    </div>
                    <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }} />
                  </label>
                </div>
              )}

              {/* Step 2: Preview + run */}
              {csvFileName && !importDone && (
                <div className="space-y-4">
                  {/* File info bar */}
                  <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 px-4 py-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <FileUp className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{csvFileName}</p>
                      <p className="text-xs text-muted-foreground">{csvRows.length} row{csvRows.length !== 1 ? "s" : ""} detected</p>
                    </div>
                    {!isImporting && (
                      <button onClick={resetImport} className="text-xs text-muted-foreground hover:text-accent flex items-center gap-1">
                        <X className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>

                  {/* Preview table toggle */}
                  {csvRows.length > 0 && !isImporting && (
                    <button onClick={() => setShowPreview(v => !v)} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                      {showPreview ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {showPreview ? "Hide" : "Show"} preview ({csvRows.length} users)
                    </button>
                  )}

                  {showPreview && csvRows.length > 0 && !isImporting && (
                    <div className="rounded-xl border overflow-hidden">
                      {/* Warn if any vendor row is missing monthly_rate */}
                      {csvRows.some((r: any) => (r.role || "vendor") === "vendor" && (!r.monthly_rate || r.monthly_rate === "")) && (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border-b border-amber-200">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            <strong>Warning:</strong> Some vendor rows are missing a <code className="bg-amber-100 px-1 rounded font-mono">monthly_rate</code> value — those rows will fail.
                            Your CSV column must be named <strong>monthly_rate</strong>, <strong>rate</strong>, or <strong>monthly_fee</strong>.
                          </p>
                        </div>
                      )}
                      <div className="overflow-x-auto max-h-56">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-secondary/60">
                              {["#", "Email", "Name", "Role", "Stall", "Section", "Rate"].map(h => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {csvRows.map((r: any, i: number) => {
                              const isVendor = (r.role || "vendor") === "vendor";
                              const missingRate = isVendor && (!r.monthly_rate || r.monthly_rate === "");
                              return (
                                <tr key={i} className={`hover:bg-secondary/30 ${missingRate ? "bg-amber-50/50" : ""}`}>
                                  <td className="px-3 py-2 text-muted-foreground font-mono">{i + 1}</td>
                                  <td className="px-3 py-2 max-w-[140px] truncate">{r.email}</td>
                                  <td className="px-3 py-2 whitespace-nowrap">{r.first_name} {r.last_name}</td>
                                  <td className="px-3 py-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.role === "cashier" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                                      {r.role || "vendor"}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-mono">{r.stall_number || "—"}</td>
                                  <td className="px-3 py-2 max-w-[120px] truncate text-muted-foreground">{r.section || "—"}</td>
                                  <td className={`px-3 py-2 font-mono font-semibold ${missingRate ? "text-amber-600" : "text-foreground"}`}>
                                    {r.monthly_rate
                                      ? `₱${Number(String(r.monthly_rate).replace(/,/g, ".")).toLocaleString("en-PH")}`
                                      : isVendor
                                        ? <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-3 w-3" /> Missing</span>
                                        : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Progress list while importing */}
                  {isImporting && (
                    <div className="space-y-2 max-h-56 overflow-y-auto rounded-xl border p-3">
                      {importResults.map((r, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm">
                          {r.status === "pending" && i === importResults.findIndex(x => x.status === "pending")
                            ? <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                            : r.status === "success" ? <CheckCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                              : r.status === "error" ? <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                                : <div className="h-4 w-4 rounded-full border-2 border-secondary shrink-0" />}
                          <span className={`flex-1 truncate ${r.status === "error" ? "text-red-600" : r.status === "success" ? "text-emerald-700" : "text-muted-foreground"}`}>
                            {r.name}
                          </span>
                          {r.message && <span className="text-[10px] text-red-500 truncate max-w-[180px]">{r.message}</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isImporting && (
                    <div className="flex gap-3 pt-2 border-t">
                      <Button className="flex-1 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white border-0" onClick={runImport} disabled={csvRows.length === 0}>
                        <FileUp className="h-4 w-4" /> Import {csvRows.length} User{csvRows.length !== 1 ? "s" : ""}
                      </Button>
                      <Button variant="outline" className="rounded-xl" onClick={resetImport}>Cancel</Button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Done summary */}
              {importDone && (
                <div className="space-y-4">
                  {/* Summary banner */}
                  {(() => {
                    const ok = importResults.filter(r => r.status === "success").length;
                    const bad = importResults.filter(r => r.status === "error").length;
                    return (
                      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${bad === 0 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                        {bad === 0
                          ? <CheckCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                          : <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />}
                        <div>
                          <p className={`text-sm font-semibold ${bad === 0 ? "text-emerald-800" : "text-amber-800"}`}>
                            {bad === 0 ? `All ${ok} users imported!` : `${ok} imported, ${bad} failed`}
                          </p>
                          <p className={`text-xs ${bad === 0 ? "text-emerald-600" : "text-amber-600"}`}>
                            {bad === 0 ? "Users can now log in." : "Fix the errors below and re-import those rows."}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Result list */}
                  <div className="space-y-1.5 max-h-56 overflow-y-auto rounded-xl border p-3">
                    {importResults.map((r, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-sm">
                        {r.status === "success"
                          ? <CheckCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                          : <XCircle className="h-4 w-4 text-red-500 shrink-0" />}
                        <span className={`flex-1 truncate ${r.status === "error" ? "text-red-600" : "text-emerald-700"}`}>{r.name}</span>
                        {r.message && <span className="text-[10px] text-red-500 truncate max-w-[200px]">{r.message}</span>}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2 border-t">
                    <Button className="rounded-xl gap-2" onClick={() => { setShowImport(false); resetImport(); }}>
                      <CheckCircle2 className="h-4 w-4" /> Done
                    </Button>
                    <Button variant="outline" className="rounded-xl gap-2" onClick={resetImport}>
                      <FileUp className="h-4 w-4" /> Import Another File
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Account form ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border bg-card shadow-civic overflow-hidden">
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-emerald-50/50 to-transparent px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <h3 className="text-[13px] font-bold text-foreground">Create New Account</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Fill in the details to create a new user account</p>
              </div>
              <button onClick={() => { setShowCreate(false); setForm({ ...emptyForm }); }} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Role */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">Account Role</Label>
                <div className="flex gap-3">
                  {(["vendor", "cashier"] as const).map(r => {
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
                        {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
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
                        <Input type="number" placeholder="e.g. 1200.50" step="0.01" min="0" className="h-11 rounded-xl pl-7 font-mono" value={form.monthly_rate} onChange={e => setForm(f => ({ ...f, monthly_rate: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2 border-t">
                <Button onClick={() => createUser.mutate()} disabled={createUser.isPending} className="gap-2 rounded-xl">
                  {createUser.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : <><UserPlus className="h-4 w-4" />Create Account</>}
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setShowCreate(false); setForm({ ...emptyForm }); }}>Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search + filters — added delinquent option ────────────────────── */}
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
          <option value="delinquent">Delinquent</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing <strong className="text-foreground">{filtered.length}</strong> of <strong className="text-foreground">{users.length}</strong> accounts
      </p>

      {/* ── Users table ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-civic overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-14 gap-3">
            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "#0f6e56" }}>
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
            <p className="text-sm text-muted-foreground">Loading accounts…</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ background: "linear-gradient(135deg,#0d3320 0%,#0f6e56 100%)" }}>
                  {["Account", "Role", "Stall", "Contact", "Status", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3.5 text-left font-semibold text-emerald-100 text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((u: any) => {
                  const roleCfg = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.vendor;
                  const statusCfg = STATUS_CONFIG[u.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
                  const RoleIcon = roleCfg.icon;
                  const isActive = u.status === "active";
                  const isDelinquent = u.status === "delinquent";
                  const isSuspended = u.status === "suspended";

                  return (
                    <tr key={u.id} className="hover:bg-emerald-50/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${roleCfg.color}`}><RoleIcon className="h-4 w-4" /></div>
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
                      <td className="px-4 py-3 text-muted-foreground text-sm">{u.contact}</td>
                      <td className="px-4 py-3">
                        {/* NEW: dynamic status badge using STATUS_CONFIG */}
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusCfg.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 gap-1 rounded-lg text-xs" onClick={() => openEdit(u)}>
                            <Edit3 className="h-3 w-3" /> Edit
                          </Button>

                          {u.role === "vendor" && (
                            <Button size="sm" variant="outline" className="h-7 gap-1 rounded-lg text-xs border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setDocsTarget(u)}>
                              <FileUp className="h-3 w-3" /> Docs
                            </Button>
                          )}

                          {/* Active → can be marked delinquent OR suspended */}
                          {isActive && (
                            <>
                              {/* NEW: Delinquent button — primary action for unpaid fees */}
                              <Button
                                size="sm" variant="outline"
                                className="h-7 rounded-lg text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                onClick={() => { setDelinquentTarget(u); setDelinquentReason(""); }}
                              >
                                Delinquent
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                className="h-7 rounded-lg text-xs border-accent/30 text-accent hover:bg-accent/10"
                                onClick={() => { setSuspendTarget(u); setSuspendReason(""); }}
                              >
                                Suspend
                              </Button>
                            </>
                          )}

                          {/* Delinquent → can be reactivated directly */}
                          {isDelinquent && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 rounded-lg text-xs border-success/30 text-success hover:bg-success/10"
                              disabled={reactivate.isPending}
                              onClick={() => reactivate.mutate(u)}
                            >
                              Reactivate
                            </Button>
                          )}

                          {/* Suspended → can be reactivated */}
                          {isSuspended && (
                            <Button
                              size="sm" variant="outline"
                              className="h-7 rounded-lg text-xs border-success/30 text-success hover:bg-success/10"
                              disabled={reactivate.isPending}
                              onClick={() => reactivate.mutate(u)}
                            >
                              Activate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                          <Users className="h-7 w-7 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{users.length === 0 ? "No accounts yet" : "No accounts match your search"}</p>
                          <p className="text-xs mt-0.5">{users.length === 0 ? "Create the first one above." : "Try a different name, stall, or role."}</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="border-t bg-secondary/30 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> {counts.active} active
              </span>
              {counts.delinquent > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> {counts.delinquent} delinquent
                </span>
              )}
              {counts.suspended > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-accent font-medium">
                  <span className="h-2 w-2 rounded-full bg-accent" /> {counts.suspended} suspended
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{counts.total} total accounts</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;