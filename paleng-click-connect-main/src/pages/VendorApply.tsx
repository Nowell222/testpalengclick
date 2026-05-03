import { useState } from "react";
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
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (value: string) => {
    setFormData((prev) => ({ ...prev, preferredSection: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.preferredSection) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("vendor_applications" as any).insert({
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone_number: formData.phone,
        business_name: formData.businessName || null,
        preferred_section: formData.preferredSection,
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
                <Label>Preferred Section <span className="text-red-500">*</span></Label>
                <Select value={formData.preferredSection} onValueChange={handleSelectChange} disabled={isSubmitting}>
                  <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 h-11">
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Meat Section">Meat Section</SelectItem>
                    <SelectItem value="Fish Section">Fish Section</SelectItem>
                    <SelectItem value="Vegetable Section">Vegetable Section</SelectItem>
                    <SelectItem value="Fruit Section">Fruit Section</SelectItem>
                    <SelectItem value="Dry Goods">Dry Goods</SelectItem>
                    <SelectItem value="Eatery / Food Stall">Eatery / Food Stall</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
