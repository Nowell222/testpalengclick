import { useState, useEffect } from "react";
import {
  QrCode, MapPin, User, Calendar, Loader2, Edit3, Save, X,
  Download, Phone, Home, CheckCircle2, Mail, Lock, Eye, EyeOff,
  UserCircle, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

// ── Field Row (view mode) ──────────────────────────────────────────────────────
const FieldRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground break-words">{value || "—"}</p>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const VendorStallInfo = () => {
  const { user }    = useAuth();
  const queryClient = useQueryClient();

  const [editing,      setEditing]      = useState(false);
  const [showPwd,      setShowPwd]      = useState(false);
  const [showNewPwd,   setShowNewPwd]   = useState(false);
  const [showConfPwd,  setShowConfPwd]  = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);

  const [form, setForm] = useState({
    first_name:     "",
    middle_name:    "",
    last_name:      "",
    contact_number: "",
    address:        "",
    email:          "",
    // password change fields
    current_password:  "",
    new_password:      "",
    confirm_password:  "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-stall-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor }  = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      // Get current email from auth session
      const { data: { user: authUser } } = await supabase.auth.getUser();
      return { vendor, profile, stall: vendor?.stalls as any, email: authUser?.email || "" };
    },
  });

  // Populate form when data loads
  useEffect(() => {
    if (data) {
      setForm(f => ({
        ...f,
        first_name:     data.profile?.first_name     || "",
        middle_name:    data.profile?.middle_name     || "",
        last_name:      data.profile?.last_name       || "",
        contact_number: data.profile?.contact_number  || "",
        address:        data.profile?.address         || "",
        email:          data.email                    || "",
        current_password:  "",
        new_password:      "",
        confirm_password:  "",
      }));
      setEmailChanged(false);
    }
  }, [data]);

  const stall   = data?.stall;
  const vendor  = data?.vendor;
  const profile = data?.profile;
  const isActive = profile?.status === "active";

  // ── Save mutation ──────────────────────────────────────────────────────────
  const saveAll = useMutation({
    mutationFn: async () => {
      const errors: string[] = [];

      // 1. Update profile fields
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          first_name:     form.first_name.trim(),
          middle_name:    form.middle_name.trim() || null,
          last_name:      form.last_name.trim(),
          contact_number: form.contact_number.trim() || null,
          address:        form.address.trim() || null,
        })
        .eq("user_id", user!.id);
      if (profileErr) errors.push(`Profile: ${profileErr.message}`);

      // 2. Update email if changed
      if (form.email.trim() && form.email.trim() !== data?.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: form.email.trim() });
        if (emailErr) errors.push(`Email: ${emailErr.message}`);
        else setEmailChanged(true);
      }

      // 3. Update password if filled in
      if (form.new_password) {
        if (!form.current_password) throw new Error("Enter your current password to change it.");
        if (form.new_password.length < 6) throw new Error("New password must be at least 6 characters.");
        if (form.new_password !== form.confirm_password) throw new Error("New passwords do not match.");
        // Re-authenticate to verify current password
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email:    data?.email || "",
          password: form.current_password,
        });
        if (signInErr) throw new Error("Current password is incorrect.");
        const { error: pwdErr } = await supabase.auth.updateUser({ password: form.new_password });
        if (pwdErr) errors.push(`Password: ${pwdErr.message}`);
      }

      if (errors.length) throw new Error(errors.join(" | "));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-stall-info"] });
      setEditing(false);
      setForm(f => ({ ...f, current_password: "", new_password: "", confirm_password: "" }));
      if (emailChanged) {
        toast.success("Profile saved! Check your new email inbox to confirm the change.");
      } else {
        toast.success("Profile updated successfully.");
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelEdit = () => {
    if (data) {
      setForm({
        first_name:     data.profile?.first_name     || "",
        middle_name:    data.profile?.middle_name     || "",
        last_name:      data.profile?.last_name       || "",
        contact_number: data.profile?.contact_number  || "",
        address:        data.profile?.address         || "",
        email:          data.email                    || "",
        current_password:  "",
        new_password:      "",
        confirm_password:  "",
      });
    }
    setEditing(false);
    setEmailChanged(false);
  };

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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stall Information</h1>
          <p className="text-sm text-muted-foreground">Your stall details and account settings</p>
        </div>
        {!editing ? (
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => setEditing(true)}>
            <Edit3 className="h-4 w-4" /> Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={cancelEdit}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button variant="hero" className="gap-2 rounded-xl"
              disabled={saveAll.isPending}
              onClick={() => saveAll.mutate()}>
              {saveAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Left column ───────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Stall details — read-only always */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Stall #{stall?.stall_number || "—"}</h3>
                <p className="text-xs text-muted-foreground">{stall?.section || "General"} Section{stall?.location ? ` · ${stall.location}` : ""}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-secondary/50 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Monthly Rate</p>
                <p className="font-mono font-bold text-foreground">{fmt(stall?.monthly_rate || 1450)}</p>
              </div>
              <div className={`rounded-xl p-3 ${isActive ? "bg-success/5 border border-success/20" : "bg-accent/5 border border-accent/20"}`}>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${isActive ? "text-success" : "text-accent"}`} />
                  <p className={`text-sm font-semibold ${isActive ? "text-success" : "text-accent"}`}>
                    {isActive ? "Active" : "Suspended"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Award Date</p>
                <p className="font-medium text-foreground">
                  {vendor?.award_date
                    ? new Date(vendor.award_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <UserCircle className="h-4 w-4 text-primary" /> Personal Information
            </h3>

            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">First Name <span className="text-accent">*</span></Label>
                    <Input className="h-10 rounded-xl" value={form.first_name} onChange={set("first_name")} placeholder="First name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Last Name <span className="text-accent">*</span></Label>
                    <Input className="h-10 rounded-xl" value={form.last_name} onChange={set("last_name")} placeholder="Last name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Middle Name</Label>
                  <Input className="h-10 rounded-xl" value={form.middle_name} onChange={set("middle_name")} placeholder="Middle name (optional)" />
                </div>
              </div>
            ) : (
              <FieldRow icon={User} label="Full Name"
                value={[profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(" ")} />
            )}
          </div>

          {/* Contact Info */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" /> Contact Information
            </h3>

            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Contact Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-10 pl-9 rounded-xl" value={form.contact_number}
                      onChange={set("contact_number")} placeholder="e.g. 09xx-xxx-xxxx" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <div className="relative">
                    <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <textarea
                      className="w-full min-h-[72px] pl-9 pr-3 pt-2.5 pb-2 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Home address"
                      value={form.address}
                      onChange={set("address")}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <FieldRow icon={Phone} label="Contact Number" value={profile?.contact_number || ""} />
                <FieldRow icon={Home}  label="Address"        value={profile?.address        || ""} />
              </div>
            )}
          </div>
        </div>

        {/* ── Right column ──────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Account / Login */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" /> Account / Login
            </h3>

            {editing ? (
              <div className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="email" className="h-10 pl-9 rounded-xl" value={form.email}
                      onChange={set("email")} placeholder="your@email.com" />
                  </div>
                  {form.email !== data?.email && form.email && (
                    <p className="text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      A confirmation link will be sent to the new email.
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">Change Password (optional)</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Current password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showPwd ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl"
                      value={form.current_password} onChange={set("current_password")}
                      placeholder="Required to change password" />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showNewPwd ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl"
                      value={form.new_password} onChange={set("new_password")}
                      placeholder="At least 6 characters" />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type={showConfPwd ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl"
                      value={form.confirm_password} onChange={set("confirm_password")}
                      placeholder="Re-enter new password" />
                    <button type="button" onClick={() => setShowConfPwd(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.new_password && form.confirm_password && form.new_password !== form.confirm_password && (
                    <p className="text-xs text-accent flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match.
                    </p>
                  )}
                  {form.new_password && form.confirm_password && form.new_password === form.confirm_password && (
                    <p className="text-xs text-success flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <FieldRow icon={Mail} label="Email Address" value={data?.email || ""} />
                <FieldRow icon={Lock} label="Password" value="••••••••" />
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="rounded-2xl border bg-card p-5 shadow-civic flex flex-col items-center gap-4">
            <div className="text-center">
              <p className="font-semibold text-foreground">Your QR Code</p>
              <p className="text-xs text-muted-foreground mt-0.5">Present for payment and market inspection</p>
            </div>

            {vendor?.qr_code ? (
              <>
                <div className="rounded-2xl border-2 border-primary/20 bg-white p-4">
                  <QRCodeSVG value={vendor.qr_code} size={180} />
                </div>
                <div id="vendor-qr-canvas" style={{ display: "none" }}>
                  <QRCodeCanvas value={vendor.qr_code} size={400} />
                </div>
                <p className="text-[10px] font-mono text-muted-foreground break-all max-w-xs text-center">
                  {vendor.qr_code}
                </p>
                <Button variant="outline" className="gap-2 rounded-xl w-full" onClick={handleDownloadQR}>
                  <Download className="h-4 w-4" /> Download QR Code
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground py-6">
                <QrCode className="h-16 w-16 opacity-20" />
                <p className="text-sm">No QR code assigned yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorStallInfo;