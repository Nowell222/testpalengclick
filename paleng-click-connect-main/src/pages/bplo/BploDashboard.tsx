import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search, Loader2,
  X, Phone, Edit3, Save, Users, FileText,
  Layers, ShieldAlert, Award, BadgeInfo, RefreshCw, AlertTriangle, ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";

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

const BPLO_GRAD = "linear-gradient(135deg, #0d1e36 0%, #1e3a8a 70%, #3b82f6 100%)";

export default function BploDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
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
    stall_number: "",
    section: "",
  });

  const [saving, setSaving] = useState(false);
  const itemsPerPage = 8;

  // Stall History States
  const [historyStall, setHistoryStall] = useState<{ id: string, number: string } | null>(null);
  const [stallHistory, setStallHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleStallHistoryClick = async (stallId: string | null, stallNumber: string) => {
    if (!stallId) return;
    setHistoryStall({ id: stallId, number: stallNumber });
    setLoadingHistory(true);
    try {
      const { data: historyData, error: historyError } = await supabase
        .from("stall_ownership_history")
        .select(`
          id,
          started_at,
          ended_at,
          status,
          vendors (
            id,
            user_id,
            business_permit_number,
            award_receipt_number,
            award_payment_date
          )
        `)
        .eq("stall_id", stallId)
        .order("started_at", { ascending: false });

      if (historyError) throw historyError;

      if (!historyData || historyData.length === 0) {
        setStallHistory([]);
        return;
      }

      const userIds = historyData
        .map((h: any) => h.vendors?.user_id)
        .filter(Boolean);

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, contact_number")
          .in("user_id", userIds);

        if (profilesError) throw profilesError;

        const merged = historyData.map((h: any) => {
          if (h.vendors && h.vendors.user_id) {
            const profile = profilesData?.find((p) => p.user_id === h.vendors.user_id);
            return {
              ...h,
              vendors: {
                ...h.vendors,
                profiles: profile || null
              }
            };
          }
          return h;
        });
        const sortHistory = (arr: any[]) => [...arr].sort((a: any, b: any) => {
          const aCurrent = !a.ended_at && a.status === 'active';
          const bCurrent = !b.ended_at && b.status === 'active';
          if (aCurrent && !bCurrent) return -1;
          if (!aCurrent && bCurrent) return 1;
          const dateA = new Date(a.started_at || 0).getTime();
          const dateB = new Date(b.started_at || 0).getTime();
          return dateB - dateA;
        });
        setStallHistory(sortHistory(merged));
      } else {
        const sortHistory = (arr: any[]) => [...arr].sort((a: any, b: any) => {
          const aCurrent = !a.ended_at && a.status === 'active';
          const bCurrent = !b.ended_at && b.status === 'active';
          if (aCurrent && !bCurrent) return -1;
          if (!aCurrent && bCurrent) return 1;
          const dateA = new Date(a.started_at || 0).getTime();
          const dateB = new Date(b.started_at || 0).getTime();
          return dateB - dateA;
        });
        setStallHistory(sortHistory(historyData));
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load stall ownership history");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch vendors data
  const { data: vendors = [], isLoading, refetch } = useQuery<VendorRow[]>({
    queryKey: ["bplo-vendors-list"],
    refetchInterval: 10000,
    queryFn: async () => {
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
            monthly_rate,
            monthly_rate_2026
          )
        `);

      if (vendorError) throw vendorError;
      if (!vendorList) return [];

      const userIds = vendorList.map(v => v.user_id);

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, middle_name, contact_number, address, status")
        .in("user_id", userIds);

      if (profileError) throw profileError;

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
          email: "",
          contact: profile?.contact_number || "—",
          address: profile?.address || "—",
          status: profile?.status || "active",
          stallId: stall?.id || null,
          stallNumber: stall?.stall_number || "—",
          section: stall?.section || "—",
          areaMeasurement: stall?.area_measurement || "—",
          monthlyRate: stall?.monthly_rate_2026 || stall?.monthly_rate || 0,
          businessPermitNumber: v.business_permit_number || "",
          awardReceiptNumber: v.award_receipt_number || "",
          awardPaymentDate: v.award_payment_date || "",
          awardDate: v.award_date || "",
        };
      });
    }
  });

  const totalVendors = vendors.length;
  const { data: registeredStalls = 0 } = useQuery({
    queryKey: ["bplo-stalls-count"],
    queryFn: async () => {
      const { count } = await supabase.from("stalls").select("*", { count: "exact", head: true });
      return count || 0;
    }
  });
  const activePermits = vendors.filter(v => v.businessPermitNumber && v.status === "active").length;
  const delinquentCount = vendors.filter(v => v.status === "delinquent").length;
  const permitRate = totalVendors > 0 ? Math.round((activePermits / totalVendors) * 100) : 0;

  // Filter vendors
  const filteredVendors = vendors.filter(v => {
    const term = search.toLowerCase().trim();
    const matchSearch = !term ||
      v.name.toLowerCase().includes(term) ||
      v.stallNumber.toLowerCase().includes(term) ||
      v.section.toLowerCase().includes(term) ||
      v.businessPermitNumber.toLowerCase().includes(term) ||
      v.awardReceiptNumber.toLowerCase().includes(term) ||
      v.contact.toLowerCase().includes(term) ||
      v.address.toLowerCase().includes(term);

    const matchStatus = filterStatus === "all" || v.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPages = Math.ceil(filteredVendors.length / itemsPerPage);
  const paginatedVendors = filteredVendors.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleEditClick = (vendor: VendorRow) => {
    setEditVendor(vendor);
    setEditForm({
      first_name: vendor.firstName,
      middle_name: vendor.middleName,
      last_name: vendor.lastName,
      email: "",
      contact_number: vendor.contact === "—" ? "" : vendor.contact,
      address: vendor.address === "—" ? "" : vendor.address,
      area_measurement: vendor.areaMeasurement === "—" ? "" : vendor.areaMeasurement,
      business_permit_number: vendor.businessPermitNumber,
      award_receipt_number: vendor.awardReceiptNumber,
      award_payment_date: vendor.awardPaymentDate,
      stall_number: vendor.stallNumber === "—" ? "" : vendor.stallNumber,
      section: vendor.section === "—" ? "" : vendor.section,
    });
  };

  const saveVendorMutation = useMutation({
    mutationFn: async () => {
      if (!editVendor) return;
      setSaving(true);
      const errors: string[] = [];

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

      let finalStallId = editVendor.stallId;
      const oldStallId = editVendor.stallId;
      const currentStallNum = editVendor.stallNumber;
      const newStallNum = editForm.stall_number.trim();
      const newSection = editForm.section.trim();

      if (newStallNum && newStallNum !== currentStallNum) {
        const { data: existingStall } = await supabase
          .from("stalls")
          .select("id, status")
          .eq("stall_number", newStallNum)
          .maybeSingle();

        if (existingStall) {
          finalStallId = existingStall.id;
          const { error: updateStallErr } = await supabase
            .from("stalls")
            .update({
              section: newSection || "General",
              status: "occupied"
            })
            .eq("id", finalStallId);
          if (updateStallErr) errors.push(`Assign Stall: ${updateStallErr.message}`);
        } else {
          if (oldStallId) {
            const { error: renameStallErr } = await supabase
              .from("stalls")
              .update({
                stall_number: newStallNum,
                section: newSection || "General"
              })
              .eq("id", oldStallId);
            if (renameStallErr) errors.push(`Rename Stall: ${renameStallErr.message}`);
          } else {
            const { data: newStall, error: createStallErr } = await supabase
              .from("stalls")
              .insert({
                stall_number: newStallNum,
                section: newSection || "General",
                status: "occupied",
                monthly_rate: 1450
              })
              .select("id")
              .single();
            if (createStallErr) {
              errors.push(`Create Stall: ${createStallErr.message}`);
            } else {
              finalStallId = newStall.id;
            }
          }
        }

        if (finalStallId !== oldStallId) {
          const { error: updateVendorStallErr } = await supabase
            .from("vendors")
            .update({ stall_id: finalStallId })
            .eq("id", editVendor.id);
          if (updateVendorStallErr) errors.push(`Update Vendor Stall: ${updateVendorStallErr.message}`);

          if (oldStallId) {
            const { data: otherVendors } = await supabase
              .from("vendors")
              .select("id")
              .eq("stall_id", oldStallId)
              .neq("id", editVendor.id);

            if (!otherVendors || otherVendors.length === 0) {
              await supabase
                .from("stalls")
                .update({ status: "vacant" })
                .eq("id", oldStallId);
            }
          }
        }
      } else if (oldStallId && newSection && newSection !== editVendor.section) {
        const { error: updateStallErr } = await supabase
          .from("stalls")
          .update({ section: newSection })
          .eq("id", oldStallId);
        if (updateStallErr) errors.push(`Update Stall Section: ${updateStallErr.message}`);
      }

      if (finalStallId) {
        const { error: stallErr } = await supabase.rpc("update_stall_area", {
          p_stall_id: finalStallId,
          p_area_measurement: editForm.area_measurement.trim() || null
        });
        if (stallErr) errors.push(`Stall Area: ${stallErr.message}`);
      }

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
            const rawMsg = edgeError?.message || edgeData?.error;
            const errMsg = rawMsg?.includes("Failed to send a request")
              ? "Connection failed to backend account helper"
              : rawMsg;
            errors.push(`Account Email: ${errMsg}`);
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

  const today = new Date();

  return (
    <div className="space-y-4">

      {/* Executive Header Banner */}
      <div className="rounded-2xl p-5 relative overflow-hidden text-white" style={{ background: BPLO_GRAD, boxShadow: "0 12px 32px rgba(13,30,54,0.15)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 160, height: 160, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-200">BPLO Licensing Portal</span>
              <span className="h-1 w-1 rounded-full bg-blue-400" />
              <span className="text-[10px] text-blue-100">{today.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
            </div>
            <h1 className="text-xl font-bold text-white leading-snug">Business Permit & Licensing Directory</h1>
            <p className="text-xs text-blue-100/70 mt-0.5">Manage vendor permits, receipt numbers, stall areas, and licensing compliance</p>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => refetch()} variant="outline" className="h-9 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 text-xs gap-1.5 border">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh Directory
            </Button>
          </div>
        </div>
      </div>

      {/* Top 4 KPI Metrics Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Vendors", value: isLoading ? "..." : String(totalVendors), sub: "Registered stallholders", icon: Users, iconBg: "bg-blue-100", iconColor: "#2563eb", glow: "#2563eb", gradient: "from-blue-50 to-blue-50/30" },
          { label: "Registered Stalls", value: isLoading ? "..." : String(registeredStalls), sub: "Market stalls", icon: Layers, iconBg: "bg-indigo-100", iconColor: "#4f46e5", glow: "#4f46e5", gradient: "from-indigo-50 to-indigo-50/30" },
          { label: "Active Permits", value: isLoading ? "..." : String(activePermits), sub: `${permitRate}% compliance rate`, icon: Award, iconBg: "bg-emerald-100", iconColor: "#10b981", glow: "#10b981", gradient: "from-emerald-50 to-emerald-50/30" },
          { label: "Delinquents", value: isLoading ? "..." : String(delinquentCount), sub: delinquentCount > 0 ? "Requires review" : "All active", icon: AlertTriangle, iconBg: delinquentCount > 0 ? "bg-amber-100" : "bg-emerald-100", iconColor: delinquentCount > 0 ? "#f59e0b" : "#10b981", glow: delinquentCount > 0 ? "#f59e0b" : "#10b981", gradient: delinquentCount > 0 ? "from-amber-50 to-amber-50/30" : "from-emerald-50 to-emerald-50/30" },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${c.gradient} flex flex-col justify-between p-4 hover:shadow-sm transition-all duration-300 group`}>
            <div className="flex items-center justify-between z-10">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shadow-sm ${c.iconBg}`}>
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

      {/* Main 2-Column Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT COLUMN (8 Cols): Vendor Directory & Search */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-card border rounded-2xl shadow-sm overflow-hidden">
            
            {/* Search & Filter Header */}
            <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={15} />
                <Input
                  type="text"
                  placeholder="Search vendor name, stall number, permit..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="pl-9 h-9 rounded-xl border-slate-200 text-xs bg-white focus:border-blue-500 outline-none"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs focus:border-blue-500 outline-none"
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="delinquent">Delinquent</option>
                  <option value="suspended">Suspended</option>
                </select>

                <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                  {filteredVendors.length} vendors
                </span>
              </div>
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-blue-600" />
                <p className="text-xs text-muted-foreground">Loading vendor licensing data...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-100/70 text-slate-600 text-left">
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Vendor Info</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Stall Details</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Area (sqm)</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Permit Number</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Receipt #</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedVendors.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground">{v.name}</p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Phone size={10} /> {v.contact}</p>
                        </td>
                        <td className="px-4 py-3">
                          {v.stallId ? (
                            <button
                              onClick={() => handleStallHistoryClick(v.stallId, v.stallNumber)}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline font-mono text-left"
                            >
                              Stall {v.stallNumber}
                            </button>
                          ) : (
                            <span className="font-mono text-slate-700">Stall {v.stallNumber}</span>
                          )}
                          <p className="text-[10px] text-muted-foreground">{v.section}</p>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-700">{v.areaMeasurement}</td>
                        <td className="px-4 py-3 font-mono">
                          {v.businessPermitNumber ? (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
                              <FileText size={10} /> {v.businessPermitNumber}
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold text-[10px]">No Permit</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {v.awardReceiptNumber ? (
                            <div>
                              <p className="font-semibold">{v.awardReceiptNumber}</p>
                              {v.awardPaymentDate && <p className="text-[9px] text-muted-foreground">{v.awardPaymentDate}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditClick(v)}
                            className="h-7 text-xs rounded-lg gap-1 border-slate-200 text-slate-700 hover:bg-slate-100"
                          >
                            <Edit3 size={11} /> Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {paginatedVendors.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                          No vendors found matching search term.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="p-3 border-t flex items-center justify-between bg-slate-50/50 text-xs">
                <span className="text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 text-xs rounded-lg">Prev</Button>
                  <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="h-7 text-xs rounded-lg">Next</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (4 Cols): BPLO Navigation & Licensing Compliance */}
        <div className="lg:col-span-4 space-y-4">

          {/* Quick Shortcuts */}
          <div className="bg-card border rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">BPLO Navigation</p>
            <div className="space-y-2">
              <Link to="/bplo/delinquents" className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100/60 transition-colors text-amber-900 no-underline">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-amber-200/80 flex items-center justify-center shrink-0 text-amber-800">
                    <ShieldAlert className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none">Delinquency Registry</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">{delinquentCount} overdue vendor accounts</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-600" />
              </Link>

              <Link to="/bplo/stall-history" className="flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100/60 transition-colors text-blue-900 no-underline">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-blue-200/80 flex items-center justify-center shrink-0 text-blue-800">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none">Stall Ownership Histories</p>
                    <p className="text-[10px] text-blue-700 mt-0.5">Historical timelines & transitions</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-blue-600" />
              </Link>

              <Link to="/bplo/settings" className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/60 transition-colors text-slate-900 no-underline">
                <div className="flex items-center gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-slate-200/80 flex items-center justify-center shrink-0 text-slate-700">
                    <BadgeInfo className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none">BPLO Settings</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">System preferences & roles</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
            </div>
          </div>

          {/* Business Permit Compliance Gauge */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-foreground">Permit Compliance</h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                {permitRate}% Verified
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${permitRate}%` }} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
              <div className="bg-emerald-50/60 rounded-lg p-2 border border-emerald-100">
                <p className="text-[9px] font-bold text-emerald-700 uppercase">Active Permits</p>
                <p className="font-bold text-emerald-800 text-sm mt-0.5">{activePermits}</p>
              </div>
              <div className="bg-amber-50/60 rounded-lg p-2 border border-amber-100">
                <p className="text-[9px] font-bold text-amber-700 uppercase">Missing Permits</p>
                <p className="font-bold text-amber-800 text-sm mt-0.5">{totalVendors - activePermits}</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Edit Vendor Modal */}
      {editVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto" onClick={() => setEditVendor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Edit Vendor Licensing Profile</h3>
                <p className="text-xs text-slate-500">{editVendor.name} • Stall {editVendor.stallNumber}</p>
              </div>
              <button onClick={() => setEditVendor(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">First Name *</Label>
                  <Input value={editForm.first_name} onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))} className="h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Last Name *</Label>
                  <Input value={editForm.last_name} onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))} className="h-9 text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Contact Number</Label>
                <Input value={editForm.contact_number} onChange={e => setEditForm(f => ({ ...f, contact_number: e.target.value }))} className="h-9 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Stall Number</Label>
                  <Input value={editForm.stall_number} onChange={e => setEditForm(f => ({ ...f, stall_number: e.target.value }))} className="h-9 text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Section</Label>
                  <Input value={editForm.section} onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))} className="h-9 text-xs" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Area Measurement (sqm)</Label>
                  <Input value={editForm.area_measurement} onChange={e => setEditForm(f => ({ ...f, area_measurement: e.target.value }))} className="h-9 text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Business Permit Number</Label>
                  <Input value={editForm.business_permit_number} onChange={e => setEditForm(f => ({ ...f, business_permit_number: e.target.value }))} className="h-9 text-xs font-mono" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Award Receipt Number</Label>
                  <Input value={editForm.award_receipt_number} onChange={e => setEditForm(f => ({ ...f, award_receipt_number: e.target.value }))} className="h-9 text-xs font-mono" />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Award Payment Date</Label>
                  <Input type="date" value={editForm.award_payment_date} onChange={e => setEditForm(f => ({ ...f, award_payment_date: e.target.value }))} className="h-9 text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">Account Email (Optional Login Update)</Label>
                <Input type="email" placeholder="e.g. vendor@example.com" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} className="h-9 text-xs" />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 gap-1.5" disabled={saving} onClick={() => saveVendorMutation.mutate()}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Licensing Profile
              </Button>
              <Button variant="outline" className="w-full text-xs h-9" onClick={() => setEditVendor(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Stall History Modal */}
      {historyStall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setHistoryStall(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Stall {historyStall.number} History</h3>
                <p className="text-xs text-slate-500">Ownership transitions & permits</p>
              </div>
              <button onClick={() => setHistoryStall(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-10 flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                <p className="text-xs text-slate-400">Loading ownership timeline...</p>
              </div>
            ) : stallHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No past ownership history recorded for Stall {historyStall.number}.
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {stallHistory.map((h: any, i: number) => {
                  const pr = h.vendors?.profiles;
                  const name = pr ? `${pr.first_name} ${pr.last_name}` : "Unknown Vendor";
                  return (
                    <div key={h.id || i} className="p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-slate-900">
                        <span>{name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${h.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {h.status || "closed"}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500">Started: {new Date(h.started_at).toLocaleDateString("en-PH")}</p>
                      {h.vendors?.business_permit_number && (
                        <p className="text-[10px] text-blue-600 font-mono">Permit: {h.vendors.business_permit_number}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
