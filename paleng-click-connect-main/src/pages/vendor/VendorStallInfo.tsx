import { QrCode, MapPin, User, Calendar, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG } from "qrcode.react";

const VendorStallInfo = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-stall-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor } = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return { vendor, profile, stall: vendor?.stalls as any };
    },
  });

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const stall = data?.stall;
  const vendor = data?.vendor;
  const profile = data?.profile;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Stall Information</h1>
        <p className="text-sm text-muted-foreground">Details about your market stall</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><MapPin className="h-6 w-6 text-primary" /></div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Stall #{stall?.stall_number || "—"}</h3>
              <p className="text-sm text-muted-foreground">{stall?.section || "General"} Section</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3"><User className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-muted-foreground">Vendor</p><p className="font-medium text-foreground">{profile?.first_name} {profile?.last_name}</p></div></div>
            <div className="flex items-start gap-3"><Calendar className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-muted-foreground">Award Date</p><p className="font-medium text-foreground">{vendor?.award_date ? new Date(vendor.award_date).toLocaleDateString() : "—"}</p></div></div>
            {stall?.location && <div className="flex items-start gap-3"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /><div><p className="text-muted-foreground">Location</p><p className="font-medium text-foreground">{stall.location}</p></div></div>}
          </div>
          <div className="rounded-xl bg-secondary/50 p-3 text-sm">
            <p className="text-muted-foreground">Monthly Rental</p>
            <p className="font-mono text-lg font-bold text-foreground">₱{Number(stall?.monthly_rate || 1450).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-xl bg-success/5 border border-success/20 p-3 text-sm">
            <p className="font-semibold text-success">Status: {profile?.status === "active" ? "Active" : "Suspended"}</p>
          </div>
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-civic flex flex-col items-center justify-center">
          <div className="mb-4">
            {vendor?.qr_code ? <QRCodeSVG value={vendor.qr_code} size={192} /> : <QrCode className="h-24 w-24 text-muted-foreground/40" />}
          </div>
          <p className="font-semibold text-foreground">Your QR Code</p>
          <p className="text-sm text-muted-foreground">Use for inspection verification and payments</p>
          <p className="mt-2 text-[10px] font-mono text-muted-foreground break-all max-w-xs text-center">{vendor?.qr_code}</p>
        </div>
      </div>
    </div>
  );
};

export default VendorStallInfo;
