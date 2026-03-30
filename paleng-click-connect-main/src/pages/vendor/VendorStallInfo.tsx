import { useState, useRef } from "react";
import { QrCode, MapPin, User, Calendar, Loader2, Edit3, Save, X, Download, Phone, Home, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const VendorStallInfo = () => {
  const { user }    = useAuth();
  const queryClient = useQueryClient();
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({ contact_number: "", address: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-stall-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor }  = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return { vendor, profile, stall: vendor?.stalls as any };
    },
    onSuccess: (d) => {
      setForm({
        contact_number: d.profile?.contact_number || "",
        address:        d.profile?.address        || "",
      });
    },
  } as any);

  const stall   = data?.stall;
  const vendor  = data?.vendor;
  const profile = data?.profile;

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ contact_number: form.contact_number, address: form.address })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully.");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["vendor-stall-info"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDownloadQR = () => {
    const canvas = document.querySelector("#vendor-qr-canvas canvas") as HTMLCanvasElement;
    if (!canvas) return;
    const url  = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href     = url;
    link.download = `QR-Stall-${stall?.stall_number || "vendor"}.png`;
    link.click();
    toast.success("QR code downloaded!");
  };

  const cancelEdit = () => {
    setForm({ contact_number: profile?.contact_number || "", address: profile?.address || "" });
    setEditing(false);
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const isActive = profile?.status === "active";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stall Information</h1>
          <p className="text-sm text-muted-foreground">Your stall details and profile</p>
        </div>
        {!editing && (
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setEditing(true)}>
            <Edit3 className="h-4 w-4" /> Edit Profile
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left: Stall + Profile info ─────────────────────────────────── */}
        <div className="space-y-4">

          {/* Stall card */}
          <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Stall #{stall?.stall_number || "—"}</h3>
                <p className="text-sm text-muted-foreground">{stall?.section || "General"} Section</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Vendor Name</p>
                  <p className="font-medium text-foreground">{profile?.first_name} {profile?.middle_name ? profile.middle_name + " " : ""}{profile?.last_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Award Date</p>
                  <p className="font-medium text-foreground">
                    {vendor?.award_date ? new Date(vendor.award_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                  </p>
                </div>
              </div>
              {stall?.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Location</p>
                    <p className="font-medium text-foreground">{stall.location}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/50 p-3 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Monthly Rate</p>
                <p className="font-mono text-base font-bold text-foreground">{fmt(stall?.monthly_rate || 1450)}</p>
              </div>
              <div className={`rounded-xl p-3 text-sm ${isActive ? "bg-success/5 border border-success/20" : "bg-accent/5 border border-accent/20"}`}>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Account Status</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`h-4 w-4 ${isActive ? "text-success" : "text-accent"}`} />
                  <p className={`font-semibold ${isActive ? "text-success" : "text-accent"}`}>
                    {isActive ? "Active" : "Suspended"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile edit card */}
          <div className="rounded-2xl border bg-card p-6 shadow-civic space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Contact Information</h3>
              {editing && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-lg h-8 text-xs" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" variant="hero" className="gap-1.5 rounded-lg h-8 text-xs"
                    disabled={saveProfile.isPending}
                    onClick={() => saveProfile.mutate()}>
                    {saveProfile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Contact Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-10 pl-9 rounded-xl"
                      placeholder="e.g. 09xx-xxx-xxxx"
                      value={form.contact_number}
                      onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <div className="relative">
                    <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea
                      className="w-full min-h-[80px] pl-9 pr-3 pt-2.5 pb-2 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Your home address"
                      value={form.address}
                      onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Contact Number</p>
                    <p className="font-medium text-foreground">{profile?.contact_number || "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Home className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium text-foreground">{profile?.address || "—"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: QR Code ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border bg-card p-6 shadow-civic flex flex-col items-center justify-center gap-4">
          <div>
            <p className="text-center font-semibold text-foreground mb-1">Your QR Code</p>
            <p className="text-center text-sm text-muted-foreground">Present this for payment and inspection</p>
          </div>

          {vendor?.qr_code ? (
            <>
              {/* Visible SVG QR */}
              <div className="rounded-2xl border-2 border-primary/20 bg-white p-4">
                <QRCodeSVG value={vendor.qr_code} size={200} />
              </div>

              {/* Hidden canvas QR for download */}
              <div id="vendor-qr-canvas" style={{ display: "none" }}>
                <QRCodeCanvas value={vendor.qr_code} size={400} />
              </div>

              <p className="text-[10px] font-mono text-muted-foreground break-all max-w-xs text-center">
                {vendor.qr_code}
              </p>

              <Button variant="outline" className="gap-2 rounded-xl w-full max-w-xs" onClick={handleDownloadQR}>
                <Download className="h-4 w-4" /> Download QR Code
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-8">
              <QrCode className="h-20 w-20 opacity-20" />
              <p className="text-sm">No QR code assigned yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorStallInfo;
