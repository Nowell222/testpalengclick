import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Store, Loader2, ArrowLeft, CheckCircle2, Search, MapPin, Check, Ban, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeRatesFromArea } from "@/lib/utils";
import { findStallByNumber, searchStalls, isStallOccupied, normalizeStallKey, MarketStallInfo } from "@/data/marketStallsRegistry";

const VendorApply = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    businessName: "",
    stallNumber: "",
    preferredSection: "",
    businessPermitNumber: "",
    awardReceiptNumber: "",
    awardPaymentDate: "",
    areaMeasurement: "",
    monthlyRate2026: "1450",
    monthlyRate2027: "",
    monthlyRate2028: "",
    website: "", // Honeypot field
  });
  const [hasStallRequest, setHasStallRequest] = useState(true);
  const [stallSuggestions, setStallSuggestions] = useState<MarketStallInfo[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [matchedStall, setMatchedStall] = useState<MarketStallInfo | null>(null);
  const [occupiedStalls, setOccupiedStalls] = useState<Set<string>>(new Set());
  const [isLoadingOccupied, setIsLoadingOccupied] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch occupied and reserved stalls so they disappear from auto-fill
  useEffect(() => {
    let isMounted = true;
    const fetchOccupied = async () => {
      setIsLoadingOccupied(true);
      const keys = new Set<string>();
      try {
        // 1. Try public RPC function
        const { data: rpcData, error: rpcErr } = await supabase.rpc("get_occupied_stalls");
        if (!rpcErr && Array.isArray(rpcData)) {
          rpcData.forEach((row: any) => {
            if (row?.stall_number) keys.add(normalizeStallKey(row.stall_number));
          });
        }

        // 2. Also check direct stalls query for occupied status
        const { data: directStalls, error: directErr } = await supabase
          .from("stalls")
          .select("stall_number")
          .eq("status", "occupied");
        if (!directErr && Array.isArray(directStalls)) {
          directStalls.forEach((s: any) => {
            if (s?.stall_number) keys.add(normalizeStallKey(s.stall_number));
          });
        }

        // 3. Also check pending vendor applications so duplicate applications aren't made
        const { data: pendingApps } = await supabase
          .from("vendor_applications")
          .select("admin_notes")
          .eq("status", "pending");
        if (Array.isArray(pendingApps)) {
          pendingApps.forEach((app: any) => {
            if (app?.admin_notes) {
              try {
                const parsed = JSON.parse(app.admin_notes);
                if (parsed?.stall_number) {
                  keys.add(normalizeStallKey(parsed.stall_number));
                }
              } catch {}
            }
          });
        }
      } catch (err) {
        console.warn("Could not fetch occupied stalls list:", err);
      } finally {
        if (isMounted) {
          setOccupiedStalls(keys);
          setIsLoadingOccupied(false);
        }
      }
    };

    fetchOccupied();
    return () => { isMounted = false; };
  }, []);

  const handleStallSelect = (stall: MarketStallInfo) => {
    if (isStallOccupied(stall.stallNumber, occupiedStalls)) {
      toast.error(`Stall ${stall.stallNumber} is already occupied by another vendor.`);
      return;
    }

    setMatchedStall(stall);
    setShowSuggestions(false);
    setFormData((prev) => ({
      ...prev,
      stallNumber: stall.stallNumber,
      preferredSection: stall.section,
      areaMeasurement: stall.area !== null ? `${stall.area} sqm` : prev.areaMeasurement,
      monthlyRate2026: stall.rate2026 !== null ? String(stall.rate2026) : prev.monthlyRate2026,
      monthlyRate2027: stall.rate2027 !== null ? String(stall.rate2027) : prev.monthlyRate2027,
      monthlyRate2028: stall.rate2028 !== null ? String(stall.rate2028) : prev.monthlyRate2028,
    }));
    toast.success(`Stall ${stall.stallNumber} loaded! Area & rates auto-filled.`);
  };

  const handleStallInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, stallNumber: val }));

    if (!val.trim()) {
      setStallSuggestions([]);
      setShowSuggestions(false);
      setMatchedStall(null);
      return;
    }

    // Exclude occupied stalls from suggestions
    const suggestions = searchStalls(val, 6, occupiedStalls);
    setStallSuggestions(suggestions);
    setShowSuggestions(suggestions.length > 0);

    const directMatch = findStallByNumber(val);
    const occupied = isStallOccupied(val, occupiedStalls);

    if (directMatch && !occupied) {
      setMatchedStall(directMatch);
      setFormData((prev) => ({
        ...prev,
        preferredSection: directMatch.section,
        areaMeasurement: directMatch.area !== null ? `${directMatch.area} sqm` : prev.areaMeasurement,
        monthlyRate2026: directMatch.rate2026 !== null ? String(directMatch.rate2026) : prev.monthlyRate2026,
        monthlyRate2027: directMatch.rate2027 !== null ? String(directMatch.rate2027) : prev.monthlyRate2027,
        monthlyRate2028: directMatch.rate2028 !== null ? String(directMatch.rate2028) : prev.monthlyRate2028,
      }));
    } else {
      setMatchedStall(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "stallNumber") {
      handleStallInputChange(e);
      return;
    }
    if (name === "areaMeasurement") {
      const isBolante = formData.preferredSection.toLowerCase().includes("bolante");
      if (isBolante) {
        setFormData((prev) => ({
          ...prev,
          areaMeasurement: value,
          monthlyRate2026: "0",
          monthlyRate2027: "0",
          monthlyRate2028: "0",
        }));
      } else {
        const rates = computeRatesFromArea(value);
        setFormData((prev) => ({
          ...prev,
          areaMeasurement: value,
          monthlyRate2026: rates.rate2026,
          monthlyRate2027: rates.rate2027,
          monthlyRate2028: rates.rate2028,
        }));
      }
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (value: string) => {
    const isBolante = value.toLowerCase().includes("bolante");
    if (isBolante) {
      setFormData((prev) => ({
        ...prev,
        preferredSection: value,
        areaMeasurement: "",
        monthlyRate2026: "0",
        monthlyRate2027: "0",
        monthlyRate2028: "0",
      }));
    } else {
      setFormData((prev) => {
        const rates = computeRatesFromArea(prev.areaMeasurement);
        return {
          ...prev,
          preferredSection: value,
          monthlyRate2026: rates.rate2026 || prev.monthlyRate2026 || "1450",
          monthlyRate2027: rates.rate2027 || prev.monthlyRate2027,
          monthlyRate2028: rates.rate2028 || prev.monthlyRate2028,
        };
      });
    }
  };

  const isCurrentStallOccupied = hasStallRequest && !!formData.stallNumber.trim() && isStallOccupied(formData.stallNumber, occupiedStalls);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check: If the 'website' field is filled, it's likely a bot
    if (formData.website) {
      console.warn("Honeypot triggered - bot detected");
      setSuccess(true);
      return;
    }

    if (isCurrentStallOccupied) {
      toast.error(`Stall "${formData.stallNumber.toUpperCase()}" is already occupied or reserved. Please choose an available stall.`);
      return;
    }

    const isMissingRequiredFields = !formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.businessPermitNumber || !formData.awardReceiptNumber || !formData.awardPaymentDate || (hasStallRequest && !formData.preferredSection);
    if (isMissingRequiredFields) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const appNotes = JSON.stringify({
        stall_number: formData.stallNumber || undefined,
        stall_sub_section: matchedStall?.subSection || undefined,
        area_measurement: formData.areaMeasurement || undefined,
        rate_2026: formData.monthlyRate2026 || undefined,
        rate_2027: formData.monthlyRate2027 || undefined,
        rate_2028: formData.monthlyRate2028 || undefined,
      });

      const { error } = await supabase.from("vendor_applications").insert({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phone,
        business_name: formData.businessName || null,
        preferred_section: hasStallRequest ? formData.preferredSection : null,
        business_permit_number: formData.businessPermitNumber,
        award_receipt_number: formData.awardReceiptNumber,
        award_payment_date: formData.awardPaymentDate,
        admin_notes: appNotes,
        status: "pending",
        application_date: new Date().toISOString(),
        applied_at: new Date().toISOString()
      });

      if (error) throw error;
      
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Application Submitted!</h2>
          <p className="text-slate-500">
            Thank you for applying to Paleng-Click. Your vendor application has been sent to the market administration. 
            We will review your details and contact you via email or SMS with the next steps.
          </p>
          <div className="pt-6">
            <Link to="/">
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 rounded-xl text-lg font-semibold">
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-semibold text-sm">Back</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
            <Store className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg text-slate-900 tracking-tight">PALENG-CLICK</span>
        </div>
        <div className="w-16" /> {/* Spacer */}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-4xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Vendor Application</h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto">Apply for a stall space at the San Juan Public Market and submit permit details for BPLO verification.</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* ── Panel 1: Personal & Business Info ────────────────────────── */}
                <div className="space-y-4">
                  <div className="border-b pb-3 flex items-center gap-2 text-emerald-800 font-bold text-base">
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                      <Store className="w-5 h-5" />
                    </div>
                    <span>1. Applicant & Business Profile</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-xs font-semibold text-slate-700">First Name <span className="text-red-500">*</span></Label>
                      <Input 
                        id="firstName" name="firstName" 
                        placeholder="Juan" 
                        value={formData.firstName} onChange={handleChange} 
                        className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm" 
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-xs font-semibold text-slate-700">Last Name <span className="text-red-500">*</span></Label>
                      <Input 
                        id="lastName" name="lastName" 
                        placeholder="Dela Cruz" 
                        value={formData.lastName} onChange={handleChange} 
                        className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email Address <span className="text-red-500">*</span></Label>
                    <Input 
                      id="email" name="email" type="email" 
                      placeholder="juan@example.com" 
                      value={formData.email} onChange={handleChange} 
                      className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Phone Number <span className="text-red-500">*</span></Label>
                    <Input 
                      id="phone" name="phone" 
                      placeholder="09123456789" 
                      value={formData.phone} onChange={handleChange} 
                      className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm"
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessName" className="text-xs font-semibold text-slate-700">Business Name (Optional)</Label>
                    <Input 
                      id="businessName" name="businessName" 
                      placeholder="Juan's Fresh Produce" 
                      value={formData.businessName} onChange={handleChange} 
                      className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm"
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                {/* ── Panel 2: Permit Verification & Market Stall Request ──────── */}
                <div className="space-y-4">
                  <div className="border-b pb-3 flex items-center gap-2 text-blue-900 font-bold text-base">
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                      <Store className="w-5 h-5" />
                    </div>
                    <span>2. Permit Details & Stall Request</span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessPermitNumber" className="text-xs font-semibold text-slate-700">Business Permit Number <span className="text-red-500">*</span></Label>
                    <Input 
                      id="businessPermitNumber" name="businessPermitNumber" 
                      placeholder="e.g. BPLO-2026-8902" 
                      value={formData.businessPermitNumber} onChange={handleChange} 
                      className="rounded-xl bg-slate-50 border-slate-200 h-11 font-mono text-sm"
                      disabled={isSubmitting}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="awardReceiptNumber" className="text-xs font-semibold text-slate-700">Permit Receipt # <span className="text-red-500">*</span></Label>
                      <Input 
                        id="awardReceiptNumber" name="awardReceiptNumber" 
                        placeholder="OR Number" 
                        value={formData.awardReceiptNumber} onChange={handleChange} 
                        className="rounded-xl bg-slate-50 border-slate-200 h-11 font-mono text-sm"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="awardPaymentDate" className="text-xs font-semibold text-slate-700">Date of Payment <span className="text-red-500">*</span></Label>
                      <Input 
                        id="awardPaymentDate" name="awardPaymentDate" type="date" 
                        value={formData.awardPaymentDate} onChange={handleChange} 
                        className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm"
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                  </div>

                  {/* Honeypot field - Hidden from users but visible to bots */}
                  <div className="hidden" aria-hidden="true">
                    <Input
                      id="website"
                      name="website"
                      type="text"
                      value={formData.website}
                      onChange={handleChange}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex items-center space-x-2.5 py-2.5 border-b border-t border-slate-100 my-2">
                    <input 
                      type="checkbox" 
                      id="hasStallRequest" 
                      checked={hasStallRequest} 
                      onChange={e => {
                        setHasStallRequest(e.target.checked);
                        if (!e.target.checked) {
                          setFormData(prev => ({ ...prev, preferredSection: "" }));
                        }
                      }} 
                      className="h-4.5 w-4.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <Label htmlFor="hasStallRequest" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                      Request a Market Stall space
                    </Label>
                  </div>

                  {hasStallRequest && (
                    <div className="space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      
                      {/* Stall Number Input with Autocomplete */}
                      <div className="space-y-1.5 relative" ref={suggestionsRef}>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="stallNumber" className="text-xs font-semibold text-slate-700">
                            Stall Number (Auto-Fill)
                          </Label>
                          <span className="text-[10px] text-slate-400">e.g. VS001, I 1A1, P2R10, MSA1</span>
                        </div>
                        <div className="relative">
                          <Input
                            id="stallNumber"
                            name="stallNumber"
                            placeholder="Type stall number..."
                            value={formData.stallNumber}
                            onChange={handleChange}
                            onFocus={() => {
                              if (formData.stallNumber.trim()) {
                                setStallSuggestions(searchStalls(formData.stallNumber, 6, occupiedStalls));
                                setShowSuggestions(true);
                              }
                            }}
                            className={`rounded-xl h-11 text-sm font-mono uppercase tracking-wider pl-9 transition-colors ${
                              isCurrentStallOccupied
                                ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200 bg-rose-50/20 text-rose-900"
                                : "bg-slate-50 border-slate-200"
                            }`}
                            disabled={isSubmitting}
                            autoComplete="off"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                        </div>

                        {/* Suggestions Dropdown */}
                        {showSuggestions && stallSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in">
                            {stallSuggestions.map((s) => (
                              <button
                                key={s.stallNumber}
                                type="button"
                                onClick={() => handleStallSelect(s)}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 transition-colors flex items-center justify-between group"
                              >
                                <div>
                                  <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800 font-mono">
                                    {s.stallNumber}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {s.subSection} {s.area ? `• ${s.area} sqm` : ""}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xs font-semibold text-emerald-700">
                                    ₱{s.rate2026?.toLocaleString() || "0"} / mo
                                  </div>
                                  <span className="text-[10px] text-slate-400">CY 2026</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Occupied / Unavailable Warning Banner */}
                      {isCurrentStallOccupied && (
                        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 flex items-start gap-2.5 animate-in fade-in">
                          <Ban className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center justify-between font-bold text-rose-900">
                              <span>Stall Unavailable / Occupied</span>
                              <span className="font-mono text-[11px] bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded-md">
                                {formData.stallNumber.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[11px] text-rose-700">
                              This stall is already occupied by an active vendor or has a pending reservation. Please choose an available stall from the list.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Matched Stall Banner */}
                      {matchedStall && !isCurrentStallOccupied && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900 flex items-start gap-2.5 animate-in fade-in">
                          <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="space-y-0.5 flex-1">
                            <div className="flex items-center justify-between font-bold text-emerald-900">
                              <span>Stall Details Auto-Filled</span>
                              <span className="font-mono text-[11px] bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-md">
                                {matchedStall.stallNumber}
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              Section: <strong>{matchedStall.section}</strong> ({matchedStall.subSection}) • Area: <strong>{matchedStall.area} sqm</strong>
                            </p>
                            {matchedStall.holderName && (
                              <p className="text-[10px] text-emerald-700 pt-0.5">
                                Masterlist Holder: {matchedStall.holderName}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Preferred Market Section <span className="text-red-500">*</span></Label>
                        <Select value={formData.preferredSection} onValueChange={handleSelectChange} disabled={isSubmitting}>
                          <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm">
                            <SelectValue placeholder="Select a section" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Building I - 1st Floor">Building I - 1st Floor</SelectItem>
                            <SelectItem value="Building II - 1st Floor">Building II - 1st Floor</SelectItem>
                            <SelectItem value="Building I - 2nd Floor">Building I - 2nd Floor</SelectItem>
                            <SelectItem value="Building II - 2nd Floor">Building II - 2nd Floor</SelectItem>
                            <SelectItem value="Bldg 1 & 2 Bolante">Bldg 1 & 2 Bolante</SelectItem>
                            <SelectItem value="Outside the Building - Bolante">Outside the Building - Bolante</SelectItem>
                            <SelectItem value="New Building - Mojica">New Building - Mojica</SelectItem>
                            <SelectItem value="New Building - Kalayaan">New Building - Kalayaan</SelectItem>
                            <SelectItem value="Meat Stalls">Meat Stalls</SelectItem>
                            <SelectItem value="Fish Stalls">Fish Stalls</SelectItem>
                            <SelectItem value="Egg and Dried Fish">Egg and Dried Fish</SelectItem>
                            <SelectItem value="Eatery 2nd Floor">Eatery 2nd Floor</SelectItem>
                            <SelectItem value="Vegetable Section">Vegetable Section</SelectItem>
                            <SelectItem value="Vegetable Section - Extension">Vegetable Section - Extension</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {!formData.preferredSection.toLowerCase().includes("bolante") && (
                        <>
                          <div className="space-y-1.5">
                            <Label htmlFor="areaMeasurement" className="text-xs font-semibold text-slate-700">Area Size / Measurement</Label>
                            <Input
                              id="areaMeasurement" name="areaMeasurement"
                              placeholder="e.g. 2x2 m or 12 sqm"
                              value={formData.areaMeasurement} onChange={handleChange}
                              className="rounded-xl bg-slate-50 border-slate-200 h-11 text-sm font-mono"
                              disabled={isSubmitting}
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1.5">
                              <Label htmlFor="monthlyRate2026" className="text-[11px] font-semibold text-slate-700">Rate 2026 (₱)</Label>
                              <Input
                                id="monthlyRate2026" name="monthlyRate2026" type="number"
                                placeholder="1450"
                                value={formData.monthlyRate2026} onChange={handleChange}
                                className="rounded-xl bg-slate-50 border-slate-200 h-10 text-xs font-mono"
                                disabled={isSubmitting}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="monthlyRate2027" className="text-[11px] font-semibold text-slate-700">Rate 2027 (₱)</Label>
                              <Input
                                id="monthlyRate2027" name="monthlyRate2027" type="number"
                                placeholder="Opt."
                                value={formData.monthlyRate2027} onChange={handleChange}
                                className="rounded-xl bg-slate-50 border-slate-200 h-10 text-xs font-mono"
                                disabled={isSubmitting}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="monthlyRate2028" className="text-[11px] font-semibold text-slate-700">Rate 2028 (₱)</Label>
                              <Input
                                id="monthlyRate2028" name="monthlyRate2028" type="number"
                                placeholder="Opt."
                                value={formData.monthlyRate2028} onChange={handleChange}
                                className="rounded-xl bg-slate-50 border-slate-200 h-10 text-xs font-mono"
                                disabled={isSubmitting}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

              </div>

              <div className="pt-4 border-t flex flex-col items-center gap-3">
                {isCurrentStallOccupied && (
                  <div className="w-full text-center p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 animate-in fade-in">
                    ⚠️ Cannot submit: Stall {formData.stallNumber.toUpperCase()} is already occupied. Please choose an available stall.
                  </div>
                )}
                <Button 
                  type="submit" 
                  className="w-full md:w-auto md:px-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-bold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting || isCurrentStallOccupied}
                >
                  {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting Application...</> : "Submit Application"}
                </Button>
                <p className="text-xs text-slate-500 text-center">
                  Your permit details will be submitted to the **Business Permit and Licensing Office (BPLO)** for verification.
                </p>
              </div>
            </form>
          </div>
          
          <p className="text-center text-sm text-slate-500">
            Already have an account? <Link to="/login" className="text-emerald-600 font-semibold hover:underline">Log in here</Link>
          </p>
        </div>
      </main>
    </div>
  );
};

export default VendorApply;
