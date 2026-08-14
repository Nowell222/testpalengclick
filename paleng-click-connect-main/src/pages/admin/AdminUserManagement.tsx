import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  UserPlus, Search, Shield, Store, Banknote, Loader2,
  X, Users, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, Edit3, Save, Phone, Home, Lock, UserCircle, AlertTriangle,
  FileUp, Download, CheckCheck, XCircle, ChevronDown, ChevronUp,
  MoreHorizontal,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import VendorDocumentsManager from "@/components/admin/VendorDocumentsManager";
import { computeRatesFromArea } from "@/lib/utils";
import { findStallByNumber, searchStalls, MarketStallInfo } from "@/data/marketStallsRegistry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
};
const SECTIONS = [
  "Building I - 1st Floor",
  "Building II - 1st Floor",
  "Building I - 2nd Floor",
  "Building II - 2nd Floor",
  "Bldg 1 & 2 Bolante",
  "Outside the Building - Bolante",
  "New Building - Mojica",
  "New Building - Kalayaan",
  "Meat Stalls",
  "Fish Stalls",
  "Egg and Dried Fish",
  "Eatery 2nd Floor",
  "Vegetable Section",
  "Vegetable Section - Extension",
];
const ROLE_CONFIG = {
  vendor: { icon: Store, color: "bg-emerald-100 text-emerald-700", label: "Vendor" },
  cashier: { icon: Banknote, color: "bg-amber-100 text-amber-700", label: "Cashier" },
  admin: { icon: Shield, color: "bg-purple-100 text-purple-700", label: "Admin" },
  bplo: { icon: Shield, color: "bg-blue-100 text-blue-700", label: "BPLO" },
  eemo: { icon: Eye, color: "bg-indigo-100 text-indigo-700", label: "Viewer (EEMO)" },
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
  // NEW: closed status — gray/slate for closed accounts
  closed: {
    label: "Closed",
    dot: "bg-slate-500",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

const emptyForm = {
  email: "", password: "", role: "vendor" as "vendor" | "cashier" | "bplo" | "eemo",
  first_name: "", middle_name: "", last_name: "",
  address: "", contact_number: "",
  stall_number: "", section: "Vegetable Section - Extension", location: "", monthly_rate: "", area_measurement: "",
  monthly_rate_2026: "", monthly_rate_2027: "", monthly_rate_2028: "",
  business_permit_number: "", award_receipt_number: "", award_payment_date: "",
};
const emptyEdit = {
  first_name: "", middle_name: "", last_name: "",
  contact_number: "", address: "",
  new_password: "", confirm_password: "",
};

const AdminUserManagement = () => {
  const { role } = useAuth();
  const isReadOnly = role === "eemo";
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
  // NEW: separate state for the account closure modal
  const [closeTarget, setCloseTarget] = useState<any>(null);
  const [closureReason, setClosureReason] = useState("transfer_ownership");
  const [closureNotes, setClosureNotes] = useState("");
  const [transferredToVendorId, setTransferredToVendorId] = useState("");
  // NEW: separate state for documents modal
  const [docsTarget, setDocsTarget] = useState<any>(null);
  // NEW: Bulk delete state
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [assignStall, setAssignStall] = useState(true);
  const [selectedClosedVendorId, setSelectedClosedVendorId] = useState("");
  const [createStallSuggestions, setCreateStallSuggestions] = useState<MarketStallInfo[]>([]);
  const [showCreateSuggestions, setShowCreateSuggestions] = useState(false);
  const createSuggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createSuggestionsRef.current && !createSuggestionsRef.current.contains(event.target as Node)) {
        setShowCreateSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      const [{ data: profiles }, { data: roles }, { data: vendors }, { data: apps }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("vendors").select("id, user_id, stalls(stall_number, section)"),
        supabase.from("vendor_applications").select("applicant_user_id, preferred_section"),
      ]);
      if (!profiles) return [];
      return profiles.map(p => {
        const userRole = roles?.find(r => r.user_id === p.user_id);
        const vendorInfo = vendors?.find(v => v.user_id === p.user_id);
        const app = apps?.find(a => a.applicant_user_id === p.user_id);
        const stall = vendorInfo?.stalls as any;
        const sectionName = stall?.section || app?.preferred_section || "—";
        const isBolanteSec = sectionName !== "—" && sectionName.toLowerCase().includes("bolante");
        let stallDisplay = stall?.stall_number || "—";
        if (!stall && isBolanteSec) {
          stallDisplay = "No Stall (Bolante)";
        }
        return {
          id: p.user_id, name: `${p.first_name} ${p.last_name}`,
          first_name: p.first_name, middle_name: p.middle_name || "", last_name: p.last_name,
          role: userRole?.role || "vendor",
          stall: stallDisplay, section: sectionName,
          contact: p.contact_number || "—", address: p.address || "—",
          status: p.status, created: p.created_at,
          vendor_id: vendorInfo?.id,
        };
      });
    },
  });

  const { data: stallHistory = [] } = useQuery({
    queryKey: ["admin-stall-history-list"],
    queryFn: async () => {
      const [{ data: history }, { data: schedules }] = await Promise.all([
        supabase
          .from("stall_ownership_history")
          .select("*, stalls(stall_number, section, location, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, area_measurement)")
          .order("started_at", { ascending: false }),
        supabase
          .from("payment_schedules")
          .select("vendor_id, stall_id, stalls(stall_number, section, location, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, area_measurement)")
          .order("created_at", { ascending: false })
      ]);

      const mergedHistory = history ? [...history] : [];

      if (schedules) {
        schedules.forEach(sched => {
          if (sched.vendor_id && sched.stalls) {
            const hasHist = mergedHistory.some(h => h.vendor_id === sched.vendor_id);
            if (!hasHist) {
              mergedHistory.push({
                vendor_id: sched.vendor_id,
                stalls: sched.stalls,
                id: `sched-fallback-${sched.vendor_id}`,
                stall_id: sched.stall_id,
                started_at: new Date().toISOString(),
                ended_at: null,
                status: 'closed'
              });
            }
          }
        });
      }
      return mergedHistory;
    }
  });

  const { data: pendingApps = [] } = useQuery({
    queryKey: ["admin-pending-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_applications")
        .select("id, first_name, last_name, email, phone_number, business_name, preferred_section")
        .eq("status", "pending");
      if (error) {
        console.error("Error fetching pending applications:", error);
        return [];
      }
      return data;
    }
  });

  const lookupStallDetails = async (stallNum: string, setFormState: Function) => {
    if (!stallNum) return;
    const cleanNum = stallNum.trim();
    if (cleanNum.length < 2) return;

    // 1. Search in masterlist registry first
    const masterStall = findStallByNumber(cleanNum);
    if (masterStall) {
      setFormState((f: any) => ({
        ...f,
        section: masterStall.section || f.section,
        location: masterStall.subSection || "",
        area_measurement: masterStall.area !== null ? `${masterStall.area}` : f.area_measurement,
        monthly_rate_2026: masterStall.rate2026 !== null ? String(masterStall.rate2026) : f.monthly_rate_2026,
        monthly_rate_2027: masterStall.rate2027 !== null ? String(masterStall.rate2027) : f.monthly_rate_2027,
        monthly_rate_2028: masterStall.rate2028 !== null ? String(masterStall.rate2028) : f.monthly_rate_2028,
      }));
      return;
    }

    // 2. Search in local stallHistory
    const foundHist = stallHistory.find((h: any) => h.stalls?.stall_number?.toLowerCase() === cleanNum.toLowerCase());
    if (foundHist && foundHist.stalls) {
      const s = foundHist.stalls;
      const areaStr = s.area_measurement || "";
      const computed = computeRatesFromArea(areaStr);
      setFormState((f: any) => ({
        ...f,
        section: s.section || f.section,
        location: s.location || "",
        area_measurement: areaStr,
        monthly_rate_2026: s.monthly_rate_2026 !== null && s.monthly_rate_2026 !== undefined ? String(s.monthly_rate_2026) : computed.rate2026,
        monthly_rate_2027: s.monthly_rate_2027 !== null && s.monthly_rate_2027 !== undefined ? String(s.monthly_rate_2027) : computed.rate2027,
        monthly_rate_2028: s.monthly_rate_2028 !== null && s.monthly_rate_2028 !== undefined ? String(s.monthly_rate_2028) : computed.rate2028,
      }));
      return;
    }

    // 2. Query supabase stalls table
    try {
      const { data, error } = await supabase
        .from("stalls")
        .select("section, location, area_measurement, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028")
        .eq("stall_number", cleanNum)
        .maybeSingle();

      if (data && !error) {
        const areaStr = data.area_measurement || "";
        const computed = computeRatesFromArea(areaStr);
        setFormState((f: any) => ({
          ...f,
          section: data.section || f.section,
          location: data.location || "",
          area_measurement: areaStr,
          monthly_rate_2026: data.monthly_rate_2026 !== null && data.monthly_rate_2026 !== undefined ? String(data.monthly_rate_2026) : computed.rate2026,
          monthly_rate_2027: data.monthly_rate_2027 !== null && data.monthly_rate_2027 !== undefined ? String(data.monthly_rate_2027) : computed.rate2027,
          monthly_rate_2028: data.monthly_rate_2028 !== null && data.monthly_rate_2028 !== undefined ? String(data.monthly_rate_2028) : computed.rate2028,
        }));
      }
    } catch (err) {
      console.error("Error looking up stall details:", err);
    }
  };

  const generateStallNumber = async (section: string) => {
    if (section && section.toLowerCase().includes("bolante")) {
      setForm(f => ({
        ...f,
        stall_number: "",
        monthly_rate_2026: "0",
        monthly_rate_2027: "0",
        monthly_rate_2028: "0",
        area_measurement: ""
      }));
      return;
    }
    setGeneratingStall(true);
    try {
      const prefix = SECTION_PREFIX[section] || "G";
      const { data: existingStalls } = await supabase.from("stalls").select("stall_number").ilike("stall_number", `${prefix}-%`);
      const existingNums = (existingStalls || []).map(s => { const p = s.stall_number?.split("-"); return p?.length === 2 ? parseInt(p[1], 10) : 0; }).filter(n => !isNaN(n) && n > 0);
      let next = 1;
      while (existingNums.includes(next)) next++;
      const generatedNum = `${prefix}-${String(next).padStart(3, "0")}`;
      setForm(f => ({ ...f, stall_number: generatedNum }));
      lookupStallDetails(generatedNum, setForm);
    } catch { toast.error("Failed to generate stall number"); }
    finally { setGeneratingStall(false); }
  };

  useEffect(() => {
    if (showCreate && form.role === "vendor" && !form.stall_number && !form.section.toLowerCase().includes("bolante")) {
      generateStallNumber(form.section);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreate, form.role]);

  useEffect(() => {
    if (!showCreate) {
      setAssignStall(true);
    }
  }, [showCreate]);

  const createUser = useMutation({
    mutationFn: async () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(form.email.trim())) throw new Error("Please enter a valid email address");
      if (form.password.length < 6) throw new Error("Password must be at least 6 characters");
      if (!form.first_name.trim()) throw new Error("First name is required");
      if (!form.last_name.trim()) throw new Error("Last name is required");

      if (form.role === "vendor") {
        if (!form.business_permit_number.trim()) throw new Error("Business Permit # is required for vendor applications");
        if (!form.award_receipt_number.trim()) throw new Error("Permit Receipt # is required for vendor applications");
        if (!form.award_payment_date) throw new Error("Date of Payment is required for vendor applications");

        const appNotes = JSON.stringify({
          area_measurement: assignStall ? form.area_measurement.trim() || undefined : undefined,
          rate_2026: assignStall ? form.monthly_rate_2026 || undefined : undefined,
          rate_2027: assignStall ? form.monthly_rate_2027 || undefined : undefined,
          rate_2028: assignStall ? form.monthly_rate_2028 || undefined : undefined,
          stall_number: assignStall ? form.stall_number.trim() || undefined : undefined,
          referenced_closed_vendor_id: selectedClosedVendorId || undefined,
          temp_password: form.password || undefined,
        });

        const { error } = await supabase.from("vendor_applications").insert({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone_number: form.contact_number.trim(),
          business_name: null,
          preferred_section: assignStall ? form.section : null,
          business_permit_number: form.business_permit_number.trim() || null,
          award_receipt_number: form.award_receipt_number.trim() || null,
          award_payment_date: form.award_payment_date || null,
          admin_notes: appNotes,
          status: "pending",
          application_date: new Date().toISOString(),
          applied_at: new Date().toISOString()
        });

        if (error) throw error;
      } else {
        const res = await supabase.functions.invoke("create-user", {
          body: {
            email: form.email.trim(), password: form.password,
            first_name: form.first_name.trim(), middle_name: form.middle_name.trim(), last_name: form.last_name.trim(),
            contact_number: form.contact_number.trim(), address: form.address.trim(),
            role: form.role,
          },
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
      }
    },
    onSuccess: async () => {
      if (form.role === "vendor") {
        toast.success("Vendor application submitted to BPLO queue for permit verification & approval!");
      } else {
        toast.success("Staff account created successfully!");
      }
      await new Promise(r => setTimeout(r, 500));
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["bplo-vendor-applications"] });
      setShowCreate(false); setForm({ ...emptyForm }); setSelectedClosedVendorId("");
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
  });

  const confirmCloseUser = useMutation({
    mutationFn: async () => {
      const isApp = transferredToVendorId.startsWith("app:");
      const appId = isApp ? transferredToVendorId.substring(4) : undefined;
      const vendorId = isApp ? undefined : (transferredToVendorId || undefined);

      let success = false;
      try {
        const res = await supabase.functions.invoke("create-user", {
          body: {
            _action: "close-user",
            user_id: closeTarget.id,
            closure_reason: closureReason,
            closure_notes: closureNotes,
            transferred_to_vendor_id: vendorId,
            transferred_to_app_id: appId
          }
        });
        if (!res.error && !res.data?.error) {
          success = true;
        } else {
          console.warn("Edge function close-user non-success, using direct DB fallback:", res.error || res.data?.error);
        }
      } catch (e) {
        console.warn("Edge function invoke error, using direct DB fallback:", e);
      }

      if (!success) {
        // Direct DB fallback:
        const { data: vData } = await supabase
          .from("vendors")
          .select("id, stall_id")
          .eq("user_id", closeTarget.id)
          .maybeSingle();

        const { error: profErr } = await supabase
          .from("profiles")
          .update({ status: "closed" })
          .eq("user_id", closeTarget.id);

        if (profErr) throw profErr;

        let targetVendorId = vendorId || null;

        if (transferredToVendorId.startsWith("user:")) {
          const targetUserId = transferredToVendorId.substring(5);
          const { data: targetV } = await supabase
            .from("vendors")
            .select("id")
            .eq("user_id", targetUserId)
            .maybeSingle();

          if (targetV) {
            targetVendorId = targetV.id;
          } else {
            const { data: newV } = await supabase
              .from("vendors")
              .insert({
                user_id: targetUserId,
                stall_id: null,
                award_date: new Date().toISOString().split("T")[0]
              })
              .select("id")
              .single();
            if (newV) targetVendorId = newV.id;
          }
        }

        if (appId) {
          await supabase
            .from("vendor_applications")
            .update({
              status: "approved",
              reviewed_at: new Date().toISOString(),
              admin_notes: `Approved via Transfer of Ownership from user ${closeTarget.id}`
            })
            .eq("id", appId);
        }

        if (vData) {
          const { error: vUpdateErr } = await supabase
            .from("vendors")
            .update({
              stall_id: null,
              closed_at: new Date().toISOString(),
              closure_reason: closureReason,
              closure_notes: closureNotes || null,
              transferred_to_vendor_id: targetVendorId
            })
            .eq("user_id", closeTarget.id);

          if (vUpdateErr) throw vUpdateErr;

          if (vData.stall_id) {
            // Update stall_ownership_history for the closing vendor to set ended_at and status closed
            await supabase
              .from("stall_ownership_history")
              .update({ ended_at: new Date().toISOString(), status: "closed" })
              .eq("vendor_id", vData.id)
              .is("ended_at", null);

            // If no history record existed yet for this vendor, insert one
            const { data: existingHist } = await supabase
              .from("stall_ownership_history")
              .select("id")
              .eq("vendor_id", vData.id)
              .maybeSingle();

            if (!existingHist) {
              await supabase
                .from("stall_ownership_history")
                .insert({
                  stall_id: vData.stall_id,
                  vendor_id: vData.id,
                  started_at: new Date().toISOString(),
                  ended_at: new Date().toISOString(),
                  status: "closed"
                });
            }

            if (closureReason === "transfer_ownership" && targetVendorId) {
              await supabase
                .from("vendors")
                .update({ stall_id: vData.stall_id })
                .eq("id", targetVendorId);

              await supabase
                .from("stall_ownership_history")
                .insert({
                  stall_id: vData.stall_id,
                  vendor_id: targetVendorId,
                  started_at: new Date().toISOString(),
                  status: "active"
                });
            } else {
              // Vacate stall for future vendor applications to reference
              await supabase
                .from("stalls")
                .update({ status: "vacant" })
                .eq("id", vData.stall_id);
            }
          }
        }

        await supabase.from("notifications").insert({
          user_id: closeTarget.id,
          title: "🔒 Account Closed",
          message: `Your account has been closed. Reason: ${closureReason || "Administrative decision."}`,
          type: "overdue"
        });
      }
    },
    onSuccess: () => {
      toast.success(`${closeTarget.name}'s account has been successfully closed.`);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-applications"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stall-history-list"] });
      queryClient.invalidateQueries({ queryKey: ["bplo-history-stalls"] });
      queryClient.invalidateQueries({ queryKey: ["bplo-history-ownership"] });
      setCloseTarget(null);
      setClosureNotes("");
      setClosureReason("transfer_ownership");
      setTransferredToVendorId("");
    },
    onError: (e: any) => toast.error(e.message || "Failed to close account"),
  });

  const reactivate = useMutation({
    mutationFn: async (u: any) => {
      if (u.status === "closed") {
        throw new Error("Closed accounts cannot be reactivated");
      }
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
    onError: (e: any) => toast.error(e.message || "Failed to reactivate account"),
  });

  const deleteUsers = useMutation({
    mutationFn: async (ids: string[]) => {
      let successData: any = null;
      try {
        const res = await supabase.functions.invoke("create-user", {
          body: { _action: "delete-user", user_id: ids },
        });
        if (!res.error && res.data && !res.data.error) {
          successData = res.data;
        } else {
          console.warn("Edge function delete-user non-success, using direct DB fallback:", res.error || res.data?.error);
        }
      } catch (e) {
        console.warn("Edge function invoke error, using direct DB fallback:", e);
      }

      if (successData) return successData;

      // Direct DB Fallback:
      const results = [];
      for (const id of ids) {
        try {
          const { data: vData } = await supabase
            .from("vendors")
            .select("id, stall_id")
            .eq("user_id", id)
            .maybeSingle();

          if (vData?.stall_id) {
            await supabase
              .from("stalls")
              .update({ status: "vacant" })
              .eq("id", vData.stall_id);
          }

          await supabase.from("vendors").delete().eq("user_id", id);
          await supabase.from("user_roles").delete().eq("user_id", id);
          const { error: pErr } = await supabase.from("profiles").delete().eq("user_id", id);

          if (pErr) throw pErr;
          results.push({ id, status: "success" });
        } catch (err: any) {
          console.error(`Failed to delete user ${id}:`, err);
          results.push({ id, status: "error", message: err.message || "Failed to delete" });
        }
      }

      return { success: true, results };
    },
    onSuccess: (data, ids) => {
      const successCount = data.results.filter((r: any) => r.status === "success").length;
      const failCount = data.results.filter((r: any) => r.status === "error").length;

      if (successCount > 0) {
        toast.success(`Successfully deleted ${successCount} user${successCount !== 1 ? "s" : ""}.`);
      }
      if (failCount > 0) {
        toast.error(`Failed to delete ${failCount} user${failCount !== 1 ? "s" : ""}.`);
      }

      setSelectedUsers([]);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      setIsBulkDelete(false);
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stall-history-list"] });
      queryClient.invalidateQueries({ queryKey: ["bplo-history-stalls"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete account"),
  });

  const toggleSelectAll = () => {
    if (selectedUsers.length === filtered.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filtered.map((u: any) => u.id));
    }
  };

  const toggleSelectUser = (id: string) => {
    setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

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
      "area_measurement": "area_measurement",
      "area measurement": "area_measurement",
      "area": "area_measurement",
      "monthly_rate_2026": "monthly_rate_2026",
      "monthly rate 2026": "monthly_rate_2026",
      "rate_2026": "monthly_rate_2026",
      "rate 2026": "monthly_rate_2026",
      "monthly_rate_2027": "monthly_rate_2027",
      "monthly rate 2027": "monthly_rate_2027",
      "rate_2027": "monthly_rate_2027",
      "rate 2027": "monthly_rate_2027",
      "monthly_rate_2028": "monthly_rate_2028",
      "monthly rate 2028": "monthly_rate_2028",
      "rate_2028": "monthly_rate_2028",
      "rate 2028": "monthly_rate_2028",
      "size": "area_measurement",
      "business_permit_number": "business_permit_number",
      "business permit number": "business_permit_number",
      "business_permit_no": "business_permit_number",
      "business permit no": "business_permit_number",
      "business_permit": "business_permit_number",
      "business permit": "business_permit_number",
      "business_permit_num": "business_permit_number",
      "business permit num": "business_permit_number",
      "award_receipt_number": "award_receipt_number",
      "award receipt number": "award_receipt_number",
      "permit_receipt_number": "award_receipt_number",
      "permit receipt number": "award_receipt_number",
      "permit_receipt_no": "award_receipt_number",
      "permit receipt no": "award_receipt_number",
      "permit_receipt": "award_receipt_number",
      "permit receipt": "award_receipt_number",
      "permit_no": "award_receipt_number",
      "permit no": "award_receipt_number",
      "permit_number": "award_receipt_number",
      "permit number": "award_receipt_number",
      "permit_receipt_#": "award_receipt_number",
      "permit receipt #": "award_receipt_number",
      "receipt_number": "award_receipt_number",
      "receipt number": "award_receipt_number",
      "receipt_no": "award_receipt_number",
      "receipt no": "award_receipt_number",
      "award_payment_date": "award_payment_date",
      "award payment date": "award_payment_date",
      "payment_date": "award_payment_date",
      "payment date": "award_payment_date",
      "date_of_payment": "award_payment_date",
      "date of payment": "award_payment_date",
      "permit_payment_date": "award_payment_date",
      "permit payment date": "award_payment_date",
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
      const rowRole = (row.role || "vendor").trim().toLowerCase();
      try {
        if (rowRole === "vendor") {
          const bpNum = (row.business_permit_number || "").trim();
          const recNum = (row.award_receipt_number || "").trim();
          const payDate = (row.award_payment_date || "").trim();

          if (!bpNum || !recNum || !payDate) {
            results[i] = { ...results[i], status: "error", message: "Business permit #, receipt #, and payment date are required for vendors" };
            setImportResults([...results]);
            continue;
          }
          const areaStr = (row.area_measurement || "").trim();
          const computedRates = computeRatesFromArea(areaStr);

          const rate2026Val = row.monthly_rate_2026 !== undefined && row.monthly_rate_2026 !== ""
            ? row.monthly_rate_2026
            : row.monthly_rate !== undefined && row.monthly_rate !== ""
              ? row.monthly_rate
              : (computedRates.rate2026 || undefined);

          const rate2027Val = row.monthly_rate_2027 !== undefined && row.monthly_rate_2027 !== ""
            ? row.monthly_rate_2027
            : (computedRates.rate2027 || undefined);

          const rate2028Val = row.monthly_rate_2028 !== undefined && row.monthly_rate_2028 !== ""
            ? row.monthly_rate_2028
            : (computedRates.rate2028 || undefined);

          const appNotes = JSON.stringify({
            area_measurement: areaStr || undefined,
            rate_2026: rate2026Val,
            rate_2027: rate2027Val,
            rate_2028: rate2028Val,
          });

          const { error: insertErr } = await supabase.from("vendor_applications").insert({
            first_name: (row.first_name || "").trim(),
            last_name: (row.last_name || "").trim(),
            email: (row.email || "").trim(),
            phone_number: (row.contact_number || "").trim(),
            business_name: null,
            preferred_section: (row.section || "Vegetable Section").trim(),
            business_permit_number: (row.business_permit_number || "").trim() || null,
            award_receipt_number: (row.award_receipt_number || "").trim() || null,
            award_payment_date: (row.award_payment_date || "").trim() || null,
            admin_notes: appNotes,
            status: "pending",
            application_date: new Date().toISOString(),
            applied_at: new Date().toISOString()
          });

          if (insertErr) {
            results[i] = { ...results[i], status: "error", message: insertErr.message };
          } else {
            results[i] = { ...results[i], status: "success", message: "Sent to BPLO queue" };
          }
        } else {
          const res = await supabase.functions.invoke("create-user", {
            body: {
              email: (row.email || "").trim(),
              password: (row.password || "").trim(),
              first_name: (row.first_name || "").trim(),
              middle_name: (row.middle_name || "").trim(),
              last_name: (row.last_name || "").trim(),
              contact_number: (row.contact_number || "").trim(),
              address: (row.address || "").trim(),
              role: rowRole,
            },
          });
          const errMsg = res.data?.error || res.error?.message || null;
          if (errMsg) {
            results[i] = { ...results[i], status: "error", message: errMsg };
          } else {
            results[i] = { ...results[i], status: "success" };
          }
        }
      } catch (err: any) {
        results[i] = { ...results[i], status: "error", message: err.message || "Import failed" };
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
    const header = "email,password,first_name,middle_name,last_name,contact_number,address,role,stall_number,section,location,area_measurement,business_permit_number,award_receipt_number,award_payment_date,monthly_rate_2026,monthly_rate_2027,monthly_rate_2028";
    const row1 = "juan@example.com,abc123,Juan,,Dela Cruz,09171234567,Lipa City,vendor,VSE-001,Vegetable Section - Extension,Near gate,12.8,BP-2026-0001,REC-987654,2026-01-15,3840,4608,5760";
    const row2 = "maria@example.com,abc123,Maria,Santos,Reyes,09181234567,Batangas City,cashier,,,,,,,,,,";
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
    const term = search.toLowerCase().trim();
    const matchSearch = !term ||
      (u.name || "").toLowerCase().includes(term) ||
      (u.stall || "").toLowerCase().includes(term) ||
      (u.section || "").toLowerCase().includes(term) ||
      (u.contact || "").toLowerCase().includes(term) ||
      (u.address || "").toLowerCase().includes(term);
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

      {/* ── Bulk Delete confirmation modal ─────────────────────────────── */}
      {(deleteTarget || isBulkDelete) && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => { setDeleteTarget(null); setIsBulkDelete(false); setDeleteConfirmText(""); }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl border shadow-2xl w-full max-w-md overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 shrink-0">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">
                    {isBulkDelete ? `Delete ${selectedUsers.length} Accounts?` : `Delete Account?`}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isBulkDelete
                      ? "This will permanently remove all selected users and their associated data (payments, messages, history). Assigned stalls will be automatically vacated."
                      : <>Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action is permanent and cannot be undone.</>}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 space-y-3">
                <p className="text-[11px] font-bold text-red-700 uppercase tracking-wider">Safety Confirmation</p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-red-800">Type <span className="font-mono font-bold">DELETE</span> to confirm</Label>
                  <Input
                    placeholder="Type DELETE here..."
                    className="h-10 rounded-lg border-red-200 bg-white focus:ring-red-200 uppercase"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="destructive" className="flex-1 rounded-xl h-11 font-bold"
                  disabled={deleteConfirmText.toUpperCase() !== "DELETE" || deleteUsers.isPending}
                  onClick={() => deleteUsers.mutate(isBulkDelete ? selectedUsers : [deleteTarget.id])}
                >
                  {deleteUsers.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Deletion</>}
                </Button>
                <Button
                  variant="outline" className="flex-1 rounded-xl h-11"
                  onClick={() => { setDeleteTarget(null); setIsBulkDelete(false); setDeleteConfirmText(""); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

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

      {/* ── NEW: Close Account / Transfer Modal ──────────────────────────── */}
      {closeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setCloseTarget(null)}>
          <div className="bg-card rounded-2xl border shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground">Close Vendor Account</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Closing account for <strong>{closeTarget.name}</strong>.
                  </p>
                  {closeTarget.stall !== "—" && (
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground">
                      Stall: {closeTarget.stall} ({closeTarget.section})
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Reason for Closure</Label>
                  <select
                    className="h-10 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                    value={closureReason}
                    onChange={e => {
                      setClosureReason(e.target.value);
                      if (e.target.value !== "transfer_ownership") {
                        setTransferredToVendorId("");
                      }
                    }}
                  >
                    <option value="transfer_ownership">Transfer of Ownership</option>
                    <option value="voluntary_surrender">Voluntary Surrender</option>
                    <option value="non_payment">Non-payment of Stall Fees</option>
                    <option value="other">Other / Violations</option>
                  </select>
                </div>

                {closureReason === "transfer_ownership" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Transferred to (New Vendor / Applicant)</Label>
                    {(() => {
                      const candidates = users.filter(
                        (u: any) =>
                          u.role === "vendor" &&
                          u.id !== closeTarget.id &&
                          u.stall === "—" &&
                          u.status !== "closed"
                      );
                      return (
                        <>
                          <select
                            className="h-10 w-full rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
                            value={transferredToVendorId}
                            onChange={e => setTransferredToVendorId(e.target.value)}
                          >
                            <option value="">-- Select New Owner --</option>
                            {candidates.length > 0 && (
                              <optgroup label="Registered Vendors (No Stall)">
                                {candidates.map((c: any) => (
                                  <option key={c.id} value={c.vendor_id || `user:${c.id}`}>
                                    {c.name} ({c.contact})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {pendingApps.length > 0 && (
                              <optgroup label="Pending Applicants">
                                {pendingApps.map((app: any) => (
                                  <option key={app.id} value={`app:${app.id}`}>
                                    [APP] {app.first_name} {app.last_name} ({app.email})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          {candidates.length === 0 && pendingApps.length === 0 ? (
                            <p className="text-[11px] text-amber-600 mt-1">
                              ⚠️ No vacant vendors or pending applicants found. Please create the new owner's account or submit an application first.
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              You can select an active vendor without a stall, or a pending applicant.
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Notes / Remarks (optional)</Label>
                  <textarea
                    className="w-full min-h-[80px] rounded-xl border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-200"
                    placeholder="Provide additional details regarding this account closure..."
                    value={closureNotes}
                    onChange={e => setClosureNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white border-0"
                  disabled={
                    confirmCloseUser.isPending ||
                    (closureReason === "transfer_ownership" && !transferredToVendorId)
                  }
                  onClick={() => confirmCloseUser.mutate()}
                >
                  {confirmCloseUser.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  Confirm Close
                </Button>
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setCloseTarget(null);
                    setClosureNotes("");
                    setClosureReason("transfer_ownership");
                    setTransferredToVendorId("");
                  }}
                >
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
                <h3 className="font-bold text-foreground">{isReadOnly ? "Account Details" : "Edit Account"}</h3>
                <p className="text-xs text-muted-foreground">{editUser.name} · {ROLE_CONFIG[editUser.role as keyof typeof ROLE_CONFIG]?.label}</p>
              </div>
              <button onClick={() => setEditUser(null)} className="rounded-lg p-1.5 hover:bg-secondary"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><UserCircle className="h-3.5 w-3.5" /> Personal Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label className="text-xs">First Name *</Label><Input disabled={isReadOnly} className="h-10 rounded-xl" value={editForm.first_name} onChange={ef("first_name")} /></div>
                  <div className="space-y-1"><Label className="text-xs">Last Name *</Label><Input disabled={isReadOnly} className="h-10 rounded-xl" value={editForm.last_name} onChange={ef("last_name")} /></div>
                </div>
                <div className="space-y-1"><Label className="text-xs">Middle Name</Label><Input disabled={isReadOnly} className="h-10 rounded-xl" value={editForm.middle_name} onChange={ef("middle_name")} placeholder="Optional" /></div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Contact Info</p>
                <div className="relative"><Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input disabled={isReadOnly} className="h-10 pl-9 rounded-xl" placeholder="09xx-xxx-xxxx" value={editForm.contact_number} onChange={ef("contact_number")} /></div>
                <div className="relative"><Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <textarea disabled={isReadOnly} className="w-full min-h-[60px] pl-9 pr-3 pt-2.5 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Home address" value={editForm.address} onChange={ef("address")} /></div>
              </div>
              {!isReadOnly && (
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
              )}
              <div className="flex gap-3 pt-2 border-t">
                {!isReadOnly ? (
                  <>
                    <Button className="flex-1 gap-2 rounded-xl" disabled={saveEdit.isPending} onClick={() => saveEdit.mutate()}>
                      {saveEdit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
                    </Button>
                    <Button variant="outline" className="rounded-xl" onClick={() => setEditUser(null)}>Cancel</Button>
                  </>
                ) : (
                  <Button className="w-full rounded-xl" onClick={() => setEditUser(null)}>Close</Button>
                )}
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
          {!isReadOnly && (
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => { setShowCreate(true); if (form.role === "vendor") generateStallNumber(form.section); }}
                className="gap-2 rounded-xl border-white/20 bg-white/15 text-white hover:bg-white/25 border">
                <UserPlus className="h-4 w-4" /> Create Account
              </Button>
              <Button onClick={() => { setShowImport(v => !v); resetImport(); }}
                className="gap-2 rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 border">
                <FileUp className="h-4 w-4" /> Import CSV
              </Button>
              {selectedUsers.length > 0 && (
                <Button onClick={() => { setIsBulkDelete(true); setDeleteConfirmText(""); }}
                  className="gap-2 rounded-xl bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-900/20 animate-in zoom-in-95 duration-200">
                  <XCircle className="h-4 w-4" /> Delete ({selectedUsers.length})
                </Button>
              )}
            </div>
          )}
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
                        { col: "location", req: false },
                        { col: "area_measurement", req: false, note: "vendors only (e.g. 12.8)" },
                        { col: "business_permit_number", req: false, note: "vendors" },
                        { col: "award_receipt_number", req: false, note: "vendors (Permit Receipt #)" },
                        { col: "award_payment_date", req: false, note: "vendors (YYYY-MM-DD)" },
                        { col: "monthly_rate_2026", req: false, note: "vendors" },
                        { col: "monthly_rate_2027", req: false, note: "vendors" },
                        { col: "monthly_rate_2028", req: false, note: "vendors" },
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
                      {/* Warn if any vendor row (except Bolante) is missing monthly_rate */}
                      {csvRows.some((r: any) => (r.role || "vendor") === "vendor" && !(r.section || "").toLowerCase().includes("bolante") && (!r.monthly_rate_2026 || r.monthly_rate_2026 === "") && (!r.monthly_rate || r.monthly_rate === "")) && (
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border-b border-amber-200">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">
                            <strong>Warning:</strong> Some vendor rows are missing a <code className="bg-amber-100 px-1 rounded font-mono">monthly_rate_2026</code> value — those rows will fail.
                            Use columns <strong>monthly_rate_2026</strong>, <strong>monthly_rate_2027</strong>, <strong>monthly_rate_2028</strong>.
                          </p>
                        </div>
                      )}
                      <div className="overflow-x-auto max-h-56">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-secondary/60">
                              {["#", "Email", "Name", "Role", "Stall", "Section", "Bus. Permit #", "Permit Receipt #", "Payment Date", "Rate 2026", "Rate 2027", "Rate 2028"].map(h => (
                                <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {csvRows.map((r: any, i: number) => {
                              const isVendor = (r.role || "vendor") === "vendor";
                              const isBolante = (r.section || "").toLowerCase().includes("bolante");
                              const missingRate = isVendor && !isBolante && (!r.monthly_rate_2026 || r.monthly_rate_2026 === "") && (!r.monthly_rate || r.monthly_rate === "");
                              const fmtRate = (v: any) => isBolante ? "₱0 (Bolante)" : (v ? `₱${Number(String(v).replace(/,/g, ".")).toLocaleString("en-PH")}` : "—");
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
                                  <td className="px-3 py-2 font-mono max-w-[110px] truncate text-muted-foreground">{r.business_permit_number || "—"}</td>
                                  <td className="px-3 py-2 font-mono max-w-[110px] truncate text-muted-foreground">{r.award_receipt_number || "—"}</td>
                                  <td className="px-3 py-2 font-mono max-w-[100px] truncate text-muted-foreground">{r.award_payment_date || "—"}</td>
                                  <td className={`px-3 py-2 font-mono font-semibold ${missingRate ? "text-amber-600" : "text-foreground"}`}>
                                    {(r.monthly_rate_2026 || r.monthly_rate)
                                      ? fmtRate(r.monthly_rate_2026 || r.monthly_rate)
                                      : isVendor
                                        ? <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="h-3 w-3" /> Missing</span>
                                        : "—"}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-foreground">{fmtRate(r.monthly_rate_2027)}</td>
                                  <td className="px-3 py-2 font-mono text-foreground">{fmtRate(r.monthly_rate_2028)}</td>
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
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* ── Left Column: Role, Credentials, Personal Info, Stall Reference ── */}
                <div className="space-y-4">
                  {/* Role */}
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Account Role</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(["vendor", "cashier", "bplo", "eemo"] as const).map(r => {
                        const cfg = ROLE_CONFIG[r];
                        return (
                          <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${form.role === r ? "border-primary bg-primary/5 ring-2 ring-primary/20 text-foreground font-bold" : "bg-card text-muted-foreground hover:bg-secondary/50"}`}>
                            <div className={`flex h-5 w-5 items-center justify-center rounded-md ${cfg.color}`}><cfg.icon className="h-3 w-3" /></div>
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Credentials */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Login Credentials</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Email <span className="text-accent">*</span></Label>
                        <Input placeholder="email@example.com" className="h-10 rounded-xl text-xs" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Password <span className="text-accent">*</span></Label>
                        <div className="relative">
                          <Input type={showPwd ? "text" : "password"} placeholder="Min. 6 characters" className="h-10 rounded-xl text-xs pr-9" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                          <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                            {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button>
                        </div>
                        {form.password && form.password.length < 6 && <p className="text-[11px] text-accent">Min. 6 characters required</p>}
                      </div>
                    </div>
                  </div>

                  {/* Personal Information */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Personal Information</p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1"><Label className="text-xs">First Name <span className="text-accent">*</span></Label><Input placeholder="First name" className="h-10 rounded-xl text-xs" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Middle Name</Label><Input placeholder="Optional" className="h-10 rounded-xl text-xs" value={form.middle_name} onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Last Name <span className="text-accent">*</span></Label><Input placeholder="Last name" className="h-10 rounded-xl text-xs" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                      <div className="space-y-1"><Label className="text-xs">Contact Number</Label><Input placeholder="09XX XXX XXXX" className="h-10 rounded-xl text-xs" value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))} /></div>
                      <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Address</Label><Input placeholder="Home address" className="h-10 rounded-xl text-xs" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                    </div>
                  </div>

                  {/* Stall Checkbox & Reference Closed Account */}
                  {form.role === "vendor" && (
                    <div className="space-y-3 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-2 bg-secondary/30 p-2.5 rounded-xl">
                        <input
                          type="checkbox"
                          id="assignStall"
                          className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                          checked={assignStall}
                          onChange={e => {
                            setAssignStall(e.target.checked);
                            if (!e.target.checked) {
                              setForm(f => ({ ...f, stall_number: "", monthly_rate_2026: "", monthly_rate_2027: "", monthly_rate_2028: "" }));
                            }
                          }}
                        />
                        <Label htmlFor="assignStall" className="cursor-pointer text-xs font-semibold text-foreground">
                          Assign Stall and Rates now
                        </Label>
                      </div>

                      {assignStall && (() => {
                        const activeOccupiedStalls = users
                          .filter((u: any) => u.status !== "closed" && u.role === "vendor" && u.stall && u.stall !== "—")
                          .map((u: any) => u.stall);

                        const closedVendors = users.filter((u: any) => {
                          if (u.status !== "closed" || u.role !== "vendor") return false;
                          const hist = stallHistory.find((h: any) => h.vendor_id === u.vendor_id);
                          const lastStallNum = hist?.stalls?.stall_number;
                          if (!lastStallNum) return true;
                          return !activeOccupiedStalls.includes(lastStallNum);
                        });

                        if (closedVendors.length === 0) return null;
                        return (
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold text-muted-foreground">Reference Closed Account (Pre-fill Stall Details)</Label>
                            <select
                              className="h-10 w-full rounded-xl border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                              value={selectedClosedVendorId}
                              onChange={e => {
                                const vendorId = e.target.value;
                                setSelectedClosedVendorId(vendorId);
                                if (vendorId) {
                                  const hist = stallHistory.find((h: any) => h.vendor_id === vendorId);
                                  if (hist && hist.stalls) {
                                    const s = hist.stalls as any;
                                    setForm(f => ({
                                      ...f,
                                      section: s.section || f.section,
                                      stall_number: s.stall_number || "",
                                      location: s.location || "",
                                      area_measurement: s.area_measurement || "",
                                      monthly_rate_2026: s.monthly_rate_2026 !== null ? String(s.monthly_rate_2026) : "",
                                      monthly_rate_2027: s.monthly_rate_2027 !== null ? String(s.monthly_rate_2027) : "",
                                      monthly_rate_2028: s.monthly_rate_2028 !== null ? String(s.monthly_rate_2028) : "",
                                    }));
                                  }
                                }
                              }}
                            >
                              <option value="">-- Manual Input / Select Closed Account --</option>
                              {closedVendors.map((cv: any) => {
                                const hist = stallHistory.find((h: any) => h.vendor_id === cv.vendor_id);
                                const lastStallStr = hist?.stalls?.stall_number ? ` (Stall: ${hist.stalls.stall_number})` : "";
                                return (
                                  <option key={cv.id} value={cv.vendor_id}>
                                    {cv.name}{lastStallStr}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* ── Right Column: Section, Stall, Permit & Rates ── */}
                <div className="space-y-4">
                  {form.role === "vendor" && assignStall ? (
                    <>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Section & Stall Details</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Section <span className="text-accent">*</span></Label>
                            <select
                              className="h-10 w-full rounded-xl border bg-background px-3 text-xs"
                              value={form.section}
                              onChange={e => {
                                const newSection = e.target.value;
                                setForm(f => ({ ...f, section: newSection }));
                                generateStallNumber(newSection);
                              }}
                            >
                              {SECTIONS.map(s => <option key={s}>{s}</option>)}
                            </select>
                          </div>

                          {form.section && form.section.toLowerCase().includes("bolante") ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 flex items-start gap-2">
                              <span className="text-lg leading-none mt-0.5"></span>
                              <div>
                                <p className="font-semibold text-amber-900">Bolante Section — No Stall Assigned</p>
                                <p className="text-amber-700 mt-0.5">Bolante vendors do not occupy a physical stall and are not charged monthly rent. No stall number, area, or rate is needed.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1 relative" ref={createSuggestionsRef}>
                              <Label className="text-xs flex items-center justify-between">
                                <span>
                                  Stall Number <span className="text-accent">*</span>
                                  <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">Auto-fill</span>
                                </span>
                              </Label>
                              <div className="flex gap-1.5">
                                <div className="relative flex-1">
                                  <Input
                                    placeholder="e.g. VS001, I 1A1, MSA1"
                                    className="h-10 rounded-xl font-mono text-xs w-full uppercase"
                                    value={form.stall_number}
                                    onChange={e => {
                                      const val = e.target.value;
                                      setForm(f => ({ ...f, stall_number: val }));
                                      if (val.trim()) {
                                        const suggestions = searchStalls(val, 6);
                                        setCreateStallSuggestions(suggestions);
                                        setShowCreateSuggestions(suggestions.length > 0);
                                        const directMatch = findStallByNumber(val);
                                        if (directMatch) {
                                          setForm(f => ({
                                            ...f,
                                            section: directMatch.section || f.section,
                                            location: directMatch.subSection || "",
                                            area_measurement: directMatch.area !== null ? `${directMatch.area}` : f.area_measurement,
                                            monthly_rate_2026: directMatch.rate2026 !== null ? String(directMatch.rate2026) : f.monthly_rate_2026,
                                            monthly_rate_2027: directMatch.rate2027 !== null ? String(directMatch.rate2027) : f.monthly_rate_2027,
                                            monthly_rate_2028: directMatch.rate2028 !== null ? String(directMatch.rate2028) : f.monthly_rate_2028,
                                          }));
                                        }
                                      } else {
                                        setShowCreateSuggestions(false);
                                      }
                                    }}
                                    onFocus={() => {
                                      if (form.stall_number.trim()) {
                                        setCreateStallSuggestions(searchStalls(form.stall_number, 6));
                                        setShowCreateSuggestions(true);
                                      }
                                    }}
                                    onBlur={() => lookupStallDetails(form.stall_number, setForm)}
                                    autoComplete="off"
                                  />
                                </div>
                                <Button type="button" variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0" disabled={generatingStall} onClick={() => generateStallNumber(form.section)}>
                                  {generatingStall ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                </Button>
                              </div>

                              {/* Autocomplete Dropdown */}
                              {showCreateSuggestions && createStallSuggestions.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden max-h-52 overflow-y-auto divide-y divide-slate-100 animate-in fade-in">
                                  {createStallSuggestions.map((s) => (
                                    <button
                                      key={s.stallNumber}
                                      type="button"
                                      onClick={() => {
                                        setShowCreateSuggestions(false);
                                        setForm(f => ({
                                          ...f,
                                          stall_number: s.stallNumber,
                                          section: s.section || f.section,
                                          location: s.subSection || "",
                                          area_measurement: s.area !== null ? `${s.area}` : f.area_measurement,
                                          monthly_rate_2026: s.rate2026 !== null ? String(s.rate2026) : f.monthly_rate_2026,
                                          monthly_rate_2027: s.rate2027 !== null ? String(s.rate2027) : f.monthly_rate_2027,
                                          monthly_rate_2028: s.rate2028 !== null ? String(s.rate2028) : f.monthly_rate_2028,
                                        }));
                                        toast.success(`Stall ${s.stallNumber} details auto-filled!`);
                                      }}
                                      className="w-full px-3 py-2 text-left hover:bg-emerald-50 transition-colors flex items-center justify-between group"
                                    >
                                      <div>
                                        <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 font-mono">
                                          {s.stallNumber}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          {s.subSection} {s.area ? `• ${s.area} sqm` : ""}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-xs font-semibold text-emerald-700">
                                          ₱{s.rate2026?.toLocaleString() || "0"}
                                        </div>
                                        <span className="text-[9px] text-slate-400">CY 2026</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {!form.section.toLowerCase().includes("bolante") && (
                            <>
                              <div className="space-y-1">
                                <Label className="text-xs">Location / Remarks</Label>
                                <Input placeholder="e.g. Near entrance" className="h-10 rounded-xl text-xs" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">Area Measurement (sqm)</Label>
                                <Input
                                  placeholder="e.g. 12.8"
                                  className="h-10 rounded-xl font-mono text-xs"
                                  value={form.area_measurement}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const isBolante = form.section.toLowerCase().includes("bolante");
                                    if (isBolante) {
                                      setForm(f => ({
                                        ...f,
                                        area_measurement: val,
                                        monthly_rate_2026: "0",
                                        monthly_rate_2027: "0",
                                        monthly_rate_2028: "0",
                                      }));
                                    } else {
                                      const rates = computeRatesFromArea(val);
                                      setForm(f => ({
                                        ...f,
                                        area_measurement: val,
                                        monthly_rate_2026: rates.rate2026,
                                        monthly_rate_2027: rates.rate2027,
                                        monthly_rate_2028: rates.rate2028,
                                      }));
                                    }
                                  }}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Permit & Payment Records</p>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Business Permit # <span className="text-accent">*</span></Label>
                            <Input placeholder="BP-2026-0001" className="h-10 rounded-xl text-xs" value={form.business_permit_number} onChange={e => setForm(f => ({ ...f, business_permit_number: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Permit Receipt # <span className="text-accent">*</span></Label>
                            <Input placeholder="REC-987654" className="h-10 rounded-xl text-xs" value={form.award_receipt_number} onChange={e => setForm(f => ({ ...f, award_receipt_number: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Date of Payment <span className="text-accent">*</span></Label>
                            <Input type="date" className="h-10 rounded-xl text-xs" value={form.award_payment_date} onChange={e => setForm(f => ({ ...f, award_payment_date: e.target.value }))} />
                          </div>
                        </div>
                      </div>

                      {!form.section.toLowerCase().includes("bolante") && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Monthly Rates Schedule</p>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Rate 2026 (₱) <span className="text-accent">*</span></Label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₱</span>
                                <Input
                                  type="number"
                                  placeholder="3840"
                                  step="0.01" min="0"
                                  className="h-10 rounded-xl pl-6 font-mono text-xs"
                                  value={form.monthly_rate_2026}
                                  onChange={e => setForm(f => ({ ...f, monthly_rate_2026: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Rate 2027 (₱)</Label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₱</span>
                                <Input
                                  type="number"
                                  placeholder="4608"
                                  step="0.01" min="0"
                                  className="h-10 rounded-xl pl-6 font-mono text-xs"
                                  value={form.monthly_rate_2027}
                                  onChange={e => setForm(f => ({ ...f, monthly_rate_2027: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Rate 2028 (₱)</Label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">₱</span>
                                <Input
                                  type="number"
                                  placeholder="5760"
                                  step="0.01" min="0"
                                  className="h-10 rounded-xl pl-6 font-mono text-xs"
                                  value={form.monthly_rate_2028}
                                  onChange={e => setForm(f => ({ ...f, monthly_rate_2028: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="rounded-xl border bg-secondary/30 p-6 text-center text-muted-foreground space-y-2">
                      <Store className="h-8 w-8 mx-auto text-muted-foreground/50" />
                      <p className="text-xs font-semibold">No Stall Assigned</p>
                      <p className="text-[11px]">This account will be created without a stall assignment. You can assign a stall later anytime.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Buttons */}
              <div className="flex gap-3 pt-3 border-t">
                <Button onClick={() => createUser.mutate()} disabled={createUser.isPending} className="gap-2 rounded-xl h-10 px-6 font-semibold">
                  {createUser.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : <><UserPlus className="h-4 w-4" />Create Account</>}
                </Button>
                <Button variant="outline" className="rounded-xl h-10 px-5" onClick={() => { setShowCreate(false); setForm({ ...emptyForm }); }}>Cancel</Button>
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
          <option value="bplo">BPLO</option>
          <option value="eemo">Viewers (EEMO)</option>
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
                  {!isReadOnly && (
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                        checked={filtered.length > 0 && selectedUsers.length === filtered.length}
                        onChange={toggleSelectAll}
                      />
                    </th>
                  )}
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
                  const isClosed = u.status === "closed";

                  return (
                    <tr key={u.id} className={`hover:bg-emerald-50/40 transition-colors ${selectedUsers.includes(u.id) ? "bg-emerald-50/60" : ""}`}>
                      {!isReadOnly && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                            checked={selectedUsers.includes(u.id)}
                            onChange={() => toggleSelectUser(u.id)}
                          />
                        </td>
                      )}
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
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-white border rounded-xl shadow-lg p-1.5 space-y-1 z-[1000]">
                            <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-50 cursor-pointer focus:bg-slate-50 focus:text-foreground outline-none" onClick={() => openEdit(u)}>
                              {isReadOnly ? <Eye className="h-3.5 w-3.5 text-muted-foreground" /> : <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />}
                              {isReadOnly ? "View Details" : "Edit Account"}
                            </DropdownMenuItem>

                            {u.role === "vendor" && (
                              <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs rounded-lg hover:bg-slate-50 cursor-pointer focus:bg-slate-50 focus:text-foreground outline-none" onClick={() => setDocsTarget(u)}>
                                <FileUp className="h-3.5 w-3.5 text-blue-600" />
                                <span>Documents</span>
                              </DropdownMenuItem>
                            )}

                            {!isReadOnly && (
                              <>
                                {/* Active → delinquent or suspend */}
                                {isActive && (
                                  <>
                                    <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 rounded-lg hover:bg-amber-50 cursor-pointer focus:bg-amber-50 outline-none" onClick={() => { setDelinquentTarget(u); setDelinquentReason(""); }}>
                                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                      <span>Mark Delinquent</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs text-accent rounded-lg hover:bg-accent/10 cursor-pointer focus:bg-accent/10 outline-none" onClick={() => { setSuspendTarget(u); setSuspendReason(""); }}>
                                      <AlertCircle className="h-3.5 w-3.5 text-accent" />
                                      <span>Suspend Account</span>
                                    </DropdownMenuItem>
                                  </>
                                )}

                                {/* Delinquent → reactivate */}
                                {isDelinquent && (
                                  <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs text-success rounded-lg hover:bg-success/10 cursor-pointer focus:bg-success/10 outline-none" disabled={reactivate.isPending} onClick={() => reactivate.mutate(u)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                    <span>Reactivate</span>
                                  </DropdownMenuItem>
                                )}

                                {/* Suspended → reactivate */}
                                {isSuspended && (
                                  <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs text-success rounded-lg hover:bg-success/10 cursor-pointer focus:bg-success/10 outline-none" disabled={reactivate.isPending} onClick={() => reactivate.mutate(u)}>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                                    <span>Activate Account</span>
                                  </DropdownMenuItem>
                                )}



                                {/* Close Vendor Account option */}
                                {u.role === "vendor" && !isClosed && (
                                  <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs text-slate-700 rounded-lg hover:bg-slate-50 cursor-pointer focus:bg-slate-50 outline-none" onClick={() => { setCloseTarget(u); setClosureReason("transfer_ownership"); setClosureNotes(""); setTransferredToVendorId(""); }}>
                                    <XCircle className="h-3.5 w-3.5 text-slate-500" />
                                    <span>Close Account</span>
                                  </DropdownMenuItem>
                                )}

                                <div className="h-px bg-slate-100 my-1" />

                                <DropdownMenuItem className="flex items-center gap-2 px-3 py-2 text-xs text-red-600 rounded-lg hover:bg-red-50 cursor-pointer focus:bg-red-50 outline-none" onClick={() => { setDeleteTarget(u); setDeleteConfirmText(""); setIsBulkDelete(false); }}>
                                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                                  <span>Delete Account</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={isReadOnly ? 5 : 6} className="px-4 py-14 text-center">
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