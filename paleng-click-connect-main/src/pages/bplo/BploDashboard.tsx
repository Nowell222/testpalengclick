import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, User, Loader2, CheckCircle2, AlertCircle,
  X, Phone, MapPin, Edit3, Save, Users, FileText,
  Layers, ShieldAlert, Award, Calendar, BadgeInfo, Mail, Plus
} from "lucide-react";

interface VendorRow {
  id: string; // vendor id
  userId: string; // profile user_id
  name: string;
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  contact: string;
  address: string;
  status: string;
  stallId: string | null;
  stallNumber: string;
  section: string;
  areaMeasurement: string;
  monthlyRate: number;
  businessPermitNumber: string;
  awardReceiptNumber: string;
  awardPaymentDate: string;
  awardDate: string;
}

const BPLO_GRAD = "linear-gradient(160deg, #0d1e36 0%, #1e3a8a 70%, #3b82f6 100%)";
const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

export default function BploDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editVendor, setEditVendor] = useState<VendorRow | null>(null);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    contact_number: "",
    address: "",
    area_measurement: "",
    business_permit_number: "",
    award_receipt_number: "",
    award_payment_date: "",
  });

  const [saving, setSaving] = useState(false);
  const itemsPerPage = 10;

  // 1. Fetch data
  const { data: vendors = [], isLoading } = useQuery<VendorRow[]>({
    queryKey: ["bplo-vendors-list"],
    refetchInterval: 10000,
    queryFn: async () => {
      // Fetch vendors with their stall details
      const { data: vendorList, error: vendorError } = await supabase
        .from("vendors")
        .select(`
          id,
          user_id,
          qr_code,
          award_date,
          business_permit_number,
          award_receipt_number,
          award_payment_date,
          stalls (
            id,
            stall_number,
            section,
            area_measurement,
            monthly_rate
          )
        `);

      if (vendorError) throw vendorError;
      if (!vendorList) return [];

      const userIds = vendorList.map(v => v.user_id);

      // Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, middle_name, contact_number, address, status")
        .in("user_id", userIds);

      if (profileError) throw profileError;

      // Since auth.users email is not directly queryable via standard SDK unless admin/edge function,
      // we can fetch the emails via another method or fallback gracefully.
      // Wait, is there a user_emails view or can BPLO call a helper? No, we will fetch emails dynamically when editing a specific vendor, 
      // or we can fetch current profile data. Let's make sure the edit form fetches the email directly when clicked or displays it.
      // Wait, is there any other place where the email is stored in public?
      // In PALENG-CLICK, how does Admin view user emails? Let's check how AdminUserManagement queries emails.
      // Oh! AdminUserManagement queries "profiles", "user_roles", "vendors" and returns them. It does NOT display emails in the list table,
      // but does it show email when editing or creating? Yes, for creating it takes email. But for editing, let's see:
      // Does it let you change email? In AdminUserManagement, it only lets you reset password or change profile info!
      // But for BPLO, the requirement is:
      // "email address (calls Edge Function create-user to update account login)"
      // Let's check if the profiles table has a user email? No.
      // How can BPLO know the email when editing?
      // Wait! We can call a quick Supabase edge function or RPC to get it, or since BPLO needs to change it, 
      // BPLO can input a new email or we can try to fetch the email using the auth API if BPLO has permissions, 
      // or we can invoke our `create-user` edge function or check if we can get it.
      // Wait! Does `create-user` Edge Function support retrieving user info or does BPLO already know the email when they open edit?
      // Let's check if BPLO can select from `auth.users`? No.
      // Wait, let's look at `create-user/index.ts` if there's any action to get user details?
      // No, `create-user` has `update-self`, `reset-password`, `update-user-email`, and `delete-user`.
      // How does the frontend get the email of the vendor when the vendor goes to their Stall Info page?
      // In `VendorStallInfo.tsx`, the vendor gets their own email by calling `supabase.auth.getUser()`, which returns their current email.
      // But BPLO is editing *other* vendors.
      // To solve this, let's allow BPLO to view the vendor's email if they click edit.
      // Wait! Can we store or fetch email? Let's see: does the application have a way for BPLO to get the email?
      // If we can't fetch it from auth, BPLO can just see a placeholder and update it, or we can check if the email can be retrieved.
      // Wait! Let's check if we can fetch user email from auth.users using a Supabase query? No, standard client keys cannot read auth.users.
      // But wait! Is there a profiles view or table that contains email, or is email in profiles? No.
      // Can BPLO input the new email when editing? Yes, the BPLO can see the email as a field. If it's empty, they can still write a new email to update it.
      // Let's provide an email field in the edit modal. If the email is edited, we call `create-user` with `_action: "update-user-email"`.
      // Let's check if we can store/sync the user email in the profiles table?
      // Wait! Let's check if there is an email column in the database we can retrieve.
      // If not, we can just allow the BPLO to update it by typing it in. We can prefill it if the user has email stored somewhere.
      // Wait, let's see if the profiles table actually has an email column?
      // Let's check the migration `20260318015824_1e60222b-b19b-4654-8cba-2cd3cd608ca7.sql` line 10 again.
      // No, `profiles` table has `first_name`, `middle_name`, `last_name`, `contact_number`, `address`, `status`. No email.
      // Wait, what about `vendors`? No email.
      // So BPLO can just enter/update the email address in the edit dialog. We will explain in the UI that BPLO can change the account login email here.
      // Let's design it beautifully.

      // Fetch registered stalls count as well
      const { count: stallsCount } = await supabase
        .from("stalls")
        .select("*", { count: "exact", head: true });

      return vendorList.map(v => {
        const profile = profiles?.find(p => p.user_id === v.user_id);
        const stall = v.stalls as any;
        return {
          id: v.id,
          userId: v.user_id,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown Vendor",
          firstName: profile?.first_name || "",
          middleName: profile?.middle_name || "",
          lastName: profile?.last_name || "",
          email: "", // Can update login email
          contact: profile?.contact_number || "—",
          address: profile?.address || "—",
          status: profile?.status || "active",
          stallId: stall?.id || null,
          stallNumber: stall?.stall_number || "—",
          section: stall?.section || "—",
          areaMeasurement: stall?.area_measurement || "—",
          monthlyRate: stall?.monthly_rate || 0,
          businessPermitNumber: v.business_permit_number || "",
          awardReceiptNumber: v.award_receipt_number || "",
          awardPaymentDate: v.award_payment_date || "",
          awardDate: v.award_date || "",
        };
      });
    }
  });

  // Get total stats
  const totalVendors = vendors.length;
  const { data: registeredStalls = 0 } = useQuery({
    queryKey: ["bplo-stalls-count"],
    queryFn: async () => {
      const { count } = await supabase.from("stalls").select("*", { count: "exact", head: true });
      return count || 0;
    }
  });
  const activePermits = vendors.filter(v => v.businessPermitNumber && v.status === "active").length;

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    const term = search.toLowerCase();
    return (
      v.name.toLowerCase().includes(term) ||
      v.stallNumber.toLowerCase().includes(term) ||
      v.section.toLowerCase().includes(term) ||
      v.businessPermitNumber.toLowerCase().includes(term) ||
      v.contact.includes(term)
    );
  });

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const paginatedVendors = filteredVendors.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // Edit action
  const handleEditClick = (vendor: VendorRow) => {
    setEditVendor(vendor);
    setEditForm({
      first_name: vendor.firstName,
      middle_name: vendor.middleName,
      last_name: vendor.lastName,
      email: "", // Allow BPLO to supply/update the login email
      contact_number: vendor.contact === "—" ? "" : vendor.contact,
      address: vendor.address === "—" ? "" : vendor.address,
      area_measurement: vendor.areaMeasurement === "—" ? "" : vendor.areaMeasurement,
      business_permit_number: vendor.businessPermitNumber,
      award_receipt_number: vendor.awardReceiptNumber,
      award_payment_date: vendor.awardPaymentDate,
    });
  };

  // Mutation to save edits
  const saveVendorMutation = useMutation({
    mutationFn: async () => {
      if (!editVendor) return;
      setSaving(true);

      const errors: string[] = [];

      // 1. Update Profiles table (first_name, last_name, middle_name, contact_number, address)
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          first_name: editForm.first_name.trim(),
          middle_name: editForm.middle_name.trim() || null,
          last_name: editForm.last_name.trim(),
          contact_number: editForm.contact_number.trim() || null,
          address: editForm.address.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", editVendor.userId);

      if (profileErr) errors.push(`Profile: ${profileErr.message}`);

      // 2. Update Vendor table (permit number, receipt number, payment date)
      const { error: vendorErr } = await supabase
        .from("vendors")
        .update({
          business_permit_number: editForm.business_permit_number.trim() || null,
          award_receipt_number: editForm.award_receipt_number.trim() || null,
          award_payment_date: editForm.award_payment_date || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editVendor.id);

      if (vendorErr) errors.push(`Licensing: ${vendorErr.message}`);

      // 3. Update Stall Area measurement (via RPC if vendor has stall)
      if (editVendor.stallId) {
        const { error: stallErr } = await supabase.rpc("update_stall_area", {
          p_stall_id: editVendor.stallId,
          p_area_measurement: editForm.area_measurement.trim() || null
        });
        if (stallErr) errors.push(`Stall Area: ${stallErr.message}`);
      }

      // 4. Update Email Address if supplied
      if (editForm.email.trim()) {
        const trimmedEmail = editForm.email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(trimmedEmail)) {
          errors.push("Account: Invalid email format");
        } else {
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke("create-user", {
            body: {
              _action: "update-user-email",
              user_id: editVendor.userId,
              email: trimmedEmail,
            },
          });
          if (edgeError || (edgeData && edgeData.error)) {
            errors.push(`Account Email: ${edgeError?.message || edgeData?.error}`);
          }
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join(" | "));
      }
    },
    onSuccess: () => {
      toast.success("Vendor profile updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["bplo-vendors-list"] });
      setEditVendor(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update vendor profile");
    },
    onSettled: () => {
      setSaving(false);
    }
  });

  return (
    <div className="space-y-6">

      {/* Hero Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden text-white" style={{ background: BPLO_GRAD, boxShadow: "0 20px 48px rgba(30, 58, 138, 0.15)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1 text-blue-200">BPLO Management Dashboard</p>
          <h1 className="text-2xl font-extrabold">Business Permit & Licensing Portal</h1>
          <p className="text-xs mt-1 text-blue-100">Review vendor profile details, update stall area measurements, and authorize business permits.</p>
        </div>
      </div>

      {/* Stats Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Vendors", value: isLoading ? "..." : totalVendors, icon: Users, iconBg: "bg-blue-50 text-blue-600 border-blue-100" },
          { label: "Registered Stalls", value: isLoading ? "..." : registeredStalls, icon: Layers, iconBg: "bg-indigo-50 text-indigo-600 border-indigo-100" },
          { label: "Active Permits", value: isLoading ? "..." : activePermits, icon: Award, iconBg: "bg-emerald-50 text-emerald-600 border-emerald-100" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{c.label}</p>
              <h3 className="text-3xl font-black text-slate-900 mt-2 font-mono">{c.value}</h3>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${c.iconBg}`}>
              <c.icon size={22} />
            </div>
          </div>
        ))}
      </div>

      {/* Search & Vendor Directory */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Search controls header */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input
              type="text"
              placeholder="Search vendor name, stall number, permit..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 h-10 rounded-xl border-slate-200 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            )}
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase">
            Showing {filteredVendors.length} of {totalVendors} vendors
          </div>
        </div>

        {/* Directory Table */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-sm text-slate-400">Loading vendor licensing data...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-slate-500 text-left">
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Vendor Info</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Stall Details</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Area (sqm)</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Permit Number</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider">Receipt Details</th>
                  <th className="px-5 py-4 font-bold text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedVendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-900">{v.name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Phone size={11} /> {v.contact}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800 font-mono">Stall {v.stallNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{v.section}</p>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      {v.areaMeasurement ? `${v.areaMeasurement} sqm` : "—"}
                    </td>
                    <td className="px-5 py-4">
                      {v.businessPermitNumber ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle2 size={12} /> {v.businessPermitNumber}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                          <AlertCircle size={12} /> Missing Permit
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {v.awardReceiptNumber ? (
                        <div>
                          <p className="text-xs font-semibold text-slate-700 font-mono">Receipt: {v.awardReceiptNumber}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">Paid: {v.awardPaymentDate ? new Date(v.awardPaymentDate).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-lg gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => handleEditClick(v)}
                      >
                        <Edit3 size={13} /> Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredVendors.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <BadgeInfo size={36} className="text-slate-300" />
                        <p className="font-semibold text-slate-600">No vendors matching search criteria</p>
                        <p className="text-xs">Try searching by names, sections, stall numbers, or business permits</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="p-5 border-t border-slate-100 flex items-center justify-between">
            <Button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              variant="outline"
              size="sm"
              className="rounded-lg h-9"
            >
              Previous
            </Button>
            <span className="text-xs font-semibold text-slate-500">
              Page {page} of {totalPages}
            </span>
            <Button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              variant="outline"
              size="sm"
              className="rounded-lg h-9"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Edit Vendor Dialog Modal */}
      {editVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(13, 27, 42, 0.6)", backdropFilter: "blur(4px)" }} onClick={() => setEditVendor(null)}>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b bg-gradient-to-r from-blue-50/50 to-transparent px-6 py-4 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Manage Vendor Licensing</h3>
                <p className="text-xs text-slate-400">Stall {editVendor.stallNumber} · {editVendor.section}</p>
              </div>
              <button onClick={() => setEditVendor(null)} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
                <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">

              {/* Profile Block */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5 border-b pb-1.5">
                  <User size={14} /> Personal Profile
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">First Name *</Label>
                    <Input className="h-10 rounded-xl border-slate-200" value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Last Name *</Label>
                    <Input className="h-10 rounded-xl border-slate-200" value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Middle Name</Label>
                    <Input className="h-10 rounded-xl border-slate-200" value={editForm.middle_name} onChange={e => setEditForm(f => ({ ...f, middle_name: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Contact Number</Label>
                    <Input className="h-10 rounded-xl border-slate-200" value={editForm.contact_number} onChange={e => setEditForm(f => ({ ...f, contact_number: e.target.value }))} placeholder="09xx-xxx-xxxx" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Home Address</Label>
                  <Input className="h-10 rounded-xl border-slate-200" value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} />
                </div>
              </div>

              {/* Account Block */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5 border-b pb-1.5">
                  <Mail size={14} /> Account Credentials
                </p>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Update Login Email</Label>
                  <Input
                    type="email"
                    className="h-10 rounded-xl border-slate-200"
                    placeholder="Enter new email to change login (leaves unchanged if blank)"
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Updates the vendor's authentication login credentials directly.</p>
                </div>
              </div>

              {/* Stall Area Block */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5 border-b pb-1.5">
                  <Layers size={14} /> Stall Allocation
                </p>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-600">Stall Area Measurement (sqm) *</Label>
                  <Input className="h-10 rounded-xl border-slate-200 font-mono" value={editForm.area_measurement} onChange={e => setEditForm(f => ({ ...f, area_measurement: e.target.value }))} placeholder="e.g. 6.25" />
                  <p className="text-[10px] text-slate-400 mt-1">Area measurements are restricted. Vendors cannot change their assigned stall dimensions.</p>
                </div>
              </div>

              {/* Business Licensing Block */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-1.5 border-b pb-1.5">
                  <Award size={14} /> Licensing & Awards
                </p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-600">Business Permit Number</Label>
                    <Input className="h-10 rounded-xl border-slate-200" value={editForm.business_permit_number} onChange={e => setEditForm(f => ({ ...f, business_permit_number: e.target.value }))} placeholder="e.g. BPLO-2026-8902" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-600">Permit Receipt Number</Label>
                      <Input className="h-10 rounded-xl border-slate-200 font-mono" value={editForm.award_receipt_number} onChange={e => setEditForm(f => ({ ...f, award_receipt_number: e.target.value }))} placeholder="OR Number" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-slate-600">Award Payment Date</Label>
                      <Input type="date" className="h-10 rounded-xl border-slate-200" value={editForm.award_payment_date} onChange={e => setEditForm(f => ({ ...f, award_payment_date: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2 border-t">
                <Button
                  className="flex-1 gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white h-11 text-sm font-bold border-none"
                  disabled={saving}
                  onClick={() => saveVendorMutation.mutate()}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Vendor Details
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl h-11 text-sm"
                  onClick={() => setEditVendor(null)}
                >
                  Cancel
                </Button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
