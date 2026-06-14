import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Store, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";



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
    preferredSection: "",
    businessPermitNumber: "",
    awardReceiptNumber: "",
    awardPaymentDate: "",
    website: "", // Honeypot field
  });
  const [hasStallRequest, setHasStallRequest] = useState(true);



  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, preferredSection: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check: If the 'website' field is filled, it's likely a bot
    if (formData.website) {
      console.warn("Honeypot triggered - bot detected");
      // We simulate success so the bot thinks it won, but we don't save anything to the database
      setSuccess(true);
      return;
    }

    const isMissingRequiredFields = !formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.businessPermitNumber || !formData.awardReceiptNumber || !formData.awardPaymentDate || (hasStallRequest && !formData.preferredSection);
    if (isMissingRequiredFields) {
      toast.error("Please fill in all required fields");
      return;
    }


    setIsSubmitting(true);
    try {
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
        status: "pending",
        application_date: new Date().toISOString()
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
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Vendor Application</h1>
            <p className="text-slate-500">Apply for a stall space at the San Juan Public Market</p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name <span className="text-red-500">*</span></Label>
                  <Input 
                    id="firstName" name="firstName" 
                    placeholder="Juan" 
                    value={formData.firstName} onChange={handleChange} 
                    className="rounded-xl bg-slate-50 border-slate-200 h-11" 
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name <span className="text-red-500">*</span></Label>
                  <Input 
                    id="lastName" name="lastName" 
                    placeholder="Dela Cruz" 
                    value={formData.lastName} onChange={handleChange} 
                    className="rounded-xl bg-slate-50 border-slate-200 h-11"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                <Input 
                  id="email" name="email" type="email" 
                  placeholder="juan@example.com" 
                  value={formData.email} onChange={handleChange} 
                  className="rounded-xl bg-slate-50 border-slate-200 h-11"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                <Input 
                  id="phone" name="phone" 
                  placeholder="09123456789" 
                  value={formData.phone} onChange={handleChange} 
                  className="rounded-xl bg-slate-50 border-slate-200 h-11"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name (Optional)</Label>
                <Input 
                  id="businessName" name="businessName" 
                  placeholder="Juan's Fresh Produce" 
                  value={formData.businessName} onChange={handleChange} 
                  className="rounded-xl bg-slate-50 border-slate-200 h-11"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessPermitNumber">Permit Number <span className="text-red-500">*</span></Label>
                <Input 
                  id="businessPermitNumber" name="businessPermitNumber" 
                  placeholder="e.g. BPLO-2026-8902" 
                  value={formData.businessPermitNumber} onChange={handleChange} 
                  className="rounded-xl bg-slate-50 border-slate-200 h-11"
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="awardReceiptNumber">Permit Receipt # <span className="text-red-500">*</span></Label>
                  <Input 
                    id="awardReceiptNumber" name="awardReceiptNumber" 
                    placeholder="OR Number" 
                    value={formData.awardReceiptNumber} onChange={handleChange} 
                    className="rounded-xl bg-slate-50 border-slate-200 h-11"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="awardPaymentDate">Date of Payment <span className="text-red-500">*</span></Label>
                  <Input 
                    id="awardPaymentDate" name="awardPaymentDate" type="date" 
                    value={formData.awardPaymentDate} onChange={handleChange} 
                    className="rounded-xl bg-slate-50 border-slate-200 h-11"
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

              <div className="flex items-center space-x-2.5 py-3 border-b border-slate-100 mb-2">
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
                <Label htmlFor="hasStallRequest" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                  Request a Market Stall space
                </Label>
              </div>

              {hasStallRequest && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label>Preferred Section <span className="text-red-500">*</span></Label>
                  <Select value={formData.preferredSection} onValueChange={handleSelectChange} disabled={isSubmitting}>
                    <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 h-11">
                      <SelectValue placeholder="Select a section" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Building I - 1st Floor">Building I - 1st Floor</SelectItem>
                      <SelectItem value="Building II - 1st Floor">Building II - 1st Floor</SelectItem>
                      <SelectItem value="Building I - 2nd Floor">Building I - 2nd Floor</SelectItem>
                      <SelectItem value="Building II - 2nd Floor">Building II - 2nd Floor</SelectItem>
                      <SelectItem value="Bldg 1 & 2 Bolante">Bldg 1 & 2 Bolante</SelectItem>
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
              )}


              <Button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 text-base font-semibold transition-all mt-4"
                disabled={isSubmitting}
              >
                {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting Application...</> : "Submit Application"}
              </Button>
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
