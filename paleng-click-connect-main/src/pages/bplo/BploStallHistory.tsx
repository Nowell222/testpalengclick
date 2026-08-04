import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, RefreshCw, Layers, Calendar, BadgeInfo, Loader2, Store, CheckCircle, XCircle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Stall {
  id: string;
  stall_number: string;
  section: string;
  status: string;
  monthly_rate: number | null;
  monthly_rate_2026: number | null;
  monthly_rate_2027: number | null;
  monthly_rate_2028: number | null;
  location: string | null;
}

const BPLO_GRAD = "linear-gradient(160deg, #0d1e36 0%, #1e3a8a 70%, #3b82f6 100%)";

export default function BploStallHistory() {
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("all");
  const [selectedStall, setSelectedStall] = useState<Stall | null>(null);

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

  // Fetch all stalls
  const { data: stalls = [], isLoading: loadingStalls, refetch: refetchStalls } = useQuery<Stall[]>({
    queryKey: ["bplo-history-stalls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stalls")
        .select("id, stall_number, section, status, monthly_rate, monthly_rate_2026, monthly_rate_2027, monthly_rate_2028, location")
        .order("stall_number", { ascending: true });
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch history for selected stall
  const { data: ownershipHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ["bplo-history-ownership", selectedStall?.id],
    enabled: !!selectedStall?.id,
    queryFn: async () => {
      if (!selectedStall?.id) return [];
      
      const { data: historyData, error: historyError } = await supabase
        .from("stall_ownership_history")
        .select(`
          id,
          stall_id,
          vendor_id,
          started_at,
          ended_at,
          status,
          vendors (
            id,
            user_id,
            business_permit_number,
            award_receipt_number,
            award_payment_date,
            award_date,
            qr_code,
            closed_at,
            closure_reason,
            closure_notes
          )
        `)
        .eq("stall_id", selectedStall.id)
        .order("started_at", { ascending: false });

      if (historyError) throw historyError;
      if (!historyData || historyData.length === 0) return [];

      const userIds = historyData
        .map((h: any) => h.vendors?.user_id)
        .filter(Boolean);

      const vendorIds = historyData
        .map((h: any) => h.vendor_id)
        .filter(Boolean);

      if (userIds.length > 0) {
        const [profilesRes, paymentsRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("user_id, first_name, middle_name, last_name, contact_number, address, status")
            .in("user_id", userIds),
          vendorIds.length > 0
            ? supabase
                .from("payments")
                .select("vendor_id, created_at")
                .in("vendor_id", vendorIds)
                .eq("status", "completed")
                .order("created_at", { ascending: false })
            : Promise.resolve({ data: [], error: null })
        ]);

        if (profilesRes.error) throw profilesRes.error;
        if (paymentsRes.error) throw paymentsRes.error;

        const profilesData = profilesRes.data;
        const paymentsData = paymentsRes.data || [];

        return historyData.map((h: any) => {
          // Find last payment date for this vendor
          const vendorPayments = paymentsData.filter((p: any) => p.vendor_id === h.vendor_id);
          const lastPaymentDate = vendorPayments.length > 0 ? vendorPayments[0].created_at : null;

          if (h.vendors && h.vendors.user_id) {
            const profile = profilesData?.find((p) => p.user_id === h.vendors.user_id);
            return {
              ...h,
              vendors: {
                ...h.vendors,
                profiles: profile || null,
                last_payment_date: lastPaymentDate
              }
            };
          }
          return {
            ...h,
            last_payment_date: lastPaymentDate
          };
        });
      }

      return historyData;
    }
  });

  // Filtered Stalls List
  const filteredStalls = useMemo(() => {
    return stalls.filter(s => {
      const term = search.toLowerCase();
      const matchSearch = s.stall_number.toLowerCase().includes(term) || (s.location || "").toLowerCase().includes(term);
      const matchSection = filterSection === "all" || s.section === filterSection;
      return matchSearch && matchSection;
    });
  }, [stalls, search, filterSection]);

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden text-white" style={{ background: BPLO_GRAD, boxShadow: "0 20px 48px rgba(30, 58, 138, 0.15)" }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 180, height: 180, borderRadius: "50%", border: "1.5px solid rgba(255,255,255,0.08)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.04, backgroundImage: "radial-gradient(circle,#fff 1px,transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-1 text-blue-200">BPLO Registry</p>
            <h1 className="text-2xl font-extrabold">Stall Ownership Histories</h1>
            <p className="text-xs mt-1 text-blue-100">Review historical owner timelines, transitions, and permit details for San Juan Public Market stalls.</p>
          </div>
          <Button onClick={() => refetchStalls()} variant="outline" className="h-10 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 gap-1.5 transition-colors border">
            <RefreshCw size={14} /> Refresh Directory
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Stall Directory */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <Input
                type="text"
                placeholder="Search stall number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl border-slate-200 text-sm focus:border-blue-500 outline-none"
              />
            </div>
            <select
              className="w-full h-10 rounded-xl border border-slate-200 bg-background px-3 text-sm focus:border-blue-500 outline-none"
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
            >
              <option value="all">All Market Sections</option>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/20">
            {loadingStalls ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <p className="text-xs text-slate-400">Loading directory...</p>
              </div>
            ) : filteredStalls.length === 0 ? (
              <p className="text-center py-12 text-xs text-slate-400 font-semibold">No stalls found matching criteria.</p>
            ) : (
              filteredStalls.map((s) => {
                const isSelected = selectedStall?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStall(s)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border ${
                      isSelected 
                        ? "bg-blue-50 border-blue-200 shadow-sm" 
                        : "bg-white border-transparent hover:bg-slate-50/80 hover:border-slate-200"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <p className={`font-black text-sm font-mono ${isSelected ? "text-blue-900" : "text-slate-900"}`}>Stall {s.stall_number}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        s.status === "occupied"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}>
                        {s.status === "occupied" ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {s.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-semibold mt-1 truncate">{s.section}</p>
                    {s.location && <p className="text-[10px] text-slate-400 mt-0.5 truncate italic">📍 {s.location}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Timeline View */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] flex flex-col">
          {selectedStall ? (
            <>
              <div className="border-b bg-gradient-to-r from-blue-50/50 to-transparent px-6 py-4 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-base">Stall {selectedStall.stall_number} Timeline</h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">{selectedStall.section} · {selectedStall.location || "No location remarks"}</p>
                </div>
                <div className="text-right flex items-center gap-4">
                  <div className="border-r border-slate-200 pr-4">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Base Rate</p>
                    <p className="font-bold text-sm text-slate-700 font-mono mt-0.5">₱{(selectedStall.monthly_rate || 0).toLocaleString()}</p>
                  </div>
                  {selectedStall.monthly_rate_2026 && (
                    <div className="border-r border-slate-200 pr-4">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">2026 Rate</p>
                      <p className="font-bold text-sm text-slate-700 font-mono mt-0.5">₱{selectedStall.monthly_rate_2026.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedStall.monthly_rate_2027 && (
                    <div className="border-r border-slate-200 pr-4">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">2027 Rate</p>
                      <p className="font-bold text-sm text-slate-700 font-mono mt-0.5">₱{selectedStall.monthly_rate_2027.toLocaleString()}</p>
                    </div>
                  )}
                  {selectedStall.monthly_rate_2028 && (
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">2028 Rate</p>
                      <p className="font-bold text-sm text-slate-700 font-mono mt-0.5">₱{selectedStall.monthly_rate_2028.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    <p className="text-xs text-slate-400">Loading ownership timeline...</p>
                  </div>
                ) : ownershipHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 gap-2">
                    <Store className="h-10 w-10 text-slate-200" />
                    <p className="font-bold text-slate-500 text-sm">No Ownership Records Found</p>
                    <p className="text-xs max-w-xs">There are no historical assignments recorded in the database for Stall {selectedStall.stall_number}.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-200 pl-6 ml-4 space-y-8">
                    {ownershipHistory.map((h: any) => {
                      const vendor = h.vendors;
                      const profile = vendor?.profiles;
                      const name = profile ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") : "Unknown Vendor";
                      const isCurrent = !h.ended_at && h.status === 'active';

                      return (
                        <div key={h.id} className="relative">
                          {/* Timeline Bullet */}
                          <span className={`absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center ${
                            isCurrent 
                              ? "border-emerald-500 shadow-sm" 
                              : h.status === 'transferred' 
                                ? "border-blue-500" 
                                : "border-slate-300"
                          }`}>
                            {isCurrent && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                          </span>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <h4 className="font-extrabold text-slate-900 text-sm">{name}</h4>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                isCurrent 
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                  : h.status === 'transferred' 
                                    ? "bg-blue-50 text-blue-700 border border-blue-100" 
                                    : "bg-slate-100 text-slate-700"
                              }`}>
                                {isCurrent ? "Current Owner" : h.status}
                              </span>
                            </div>
                            
                            <p className="text-xs text-slate-400 flex items-center gap-1 font-semibold">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {new Date(h.started_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} — {h.ended_at ? new Date(h.ended_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "Present"}
                            </p>

                            {vendor && (
                              <div className="mt-2 bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs space-y-3 text-slate-600 max-w-xl shadow-sm">
                                <p className="font-bold text-slate-700 flex items-center gap-1 border-b pb-1.5"><BadgeInfo size={13} className="text-blue-600" /> Owner Registry Info:</p>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                                  <p><span className="text-slate-400">Owner Name:</span> <strong className="text-slate-700">{profile ? [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") : "—"}</strong></p>
                                  <p><span className="text-slate-400">Account Status:</span> <strong className="text-slate-700 capitalize">{profile?.status || "—"}</strong></p>
                                  
                                  <p><span className="text-slate-400">Contact Number:</span> <strong className="text-slate-700">{profile?.contact_number || "—"}</strong></p>
                                  <p><span className="text-slate-400">Registered Address:</span> <strong className="text-slate-700">{profile?.address || "—"}</strong></p>
                                  
                                  <p><span className="text-slate-400">Award Date:</span> <strong className="text-slate-700">{vendor.award_date ? new Date(vendor.award_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}</strong></p>
                                  <p><span className="text-slate-400">Last Payment Date:</span> <strong className="text-slate-700">{vendor.last_payment_date ? new Date(vendor.last_payment_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "No payments found"}</strong></p>
                                  
                                  <p><span className="text-slate-400">Permit Number:</span> <strong className="text-slate-700">{vendor.business_permit_number || "—"}</strong></p>
                                  <p><span className="text-slate-400">Permit Receipt #:</span> <strong className="text-slate-700">{vendor.award_receipt_number || "—"}</strong></p>
                                  
                                  <p><span className="text-slate-400">Date of Payment:</span> <strong className="text-slate-700">{vendor.award_payment_date ? new Date(vendor.award_payment_date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—"}</strong></p>
                                  <p><span className="text-slate-400">QR Code:</span> <strong className="text-slate-700 font-mono text-[10px]">{vendor.qr_code || "—"}</strong></p>
                                </div>

                                {(vendor.closed_at || h.ended_at || vendor.closure_reason) && (
                                  <div className="mt-2 pt-2 border-t border-slate-200/60 grid grid-cols-1 gap-y-1 bg-red-50/30 p-2.5 rounded-lg border border-red-100/50">
                                    <p className="font-semibold text-red-950/80 mb-1">Closure Details:</p>
                                    <p><span className="text-slate-400">Closure Date:</span> <strong className="text-slate-700">{vendor.closed_at ? new Date(vendor.closed_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : (h.ended_at ? new Date(h.ended_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) : "—")}</strong></p>
                                    <p><span className="text-slate-400">Reason:</span> <strong className="text-slate-700">{vendor.closure_reason || "—"}</strong></p>
                                    {vendor.closure_notes && <p><span className="text-slate-400">Notes:</span> <strong className="text-slate-700">{vendor.closure_notes}</strong></p>}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-400 p-8 text-center gap-3">
              <Layers className="h-12 w-12 text-slate-200" />
              <p className="font-bold text-slate-500 text-sm">No Stall Selected</p>
              <p className="text-xs max-w-xs">Select a stall from the directory list on the left to check its chronological ownership histories and verification records.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
