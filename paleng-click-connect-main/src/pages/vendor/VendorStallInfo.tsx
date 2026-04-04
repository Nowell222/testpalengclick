import VendorBottomNav from "@/components/VendorBottomNav";
import { useState, useEffect } from "react";
import {
  QrCode, MapPin, User, Calendar, Loader2, Edit3, Save, X,
  Download, Phone, Home, CheckCircle2, Mail, Lock, Eye, EyeOff,
  UserCircle, AlertCircle, LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const fmt = (n: number) => `₱${Number(n).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const DS = {
  gradientHeader: "linear-gradient(160deg, #0d2240 0%, #1a3a5f 45%, #1d4ed8 80%, #2563eb 100%)",
  gradientCard:   "linear-gradient(135deg, #1a3a5f 0%, #2563eb 100%)",
  blue900: "#0d2240",
  blue800: "#1a3a5f",
  blue600: "#2563eb",
  blue50:  "#eff6ff",
  blue100: "#dbeafe",
};

const FieldRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-3 py-3 border-b border-slate-50 last:border-0">
    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: DS.blue50 }}>
      <Icon className="h-4 w-4" style={{ color: DS.blue600 }} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{label}</p>
      <p className="font-semibold text-slate-900 mt-0.5 break-words">{value || "—"}</p>
    </div>
  </div>
);

const VendorStallInfo = () => {
  const { user, signOut } = useAuth();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [editing,      setEditing]      = useState(false);
  const [showPwd,      setShowPwd]      = useState(false);
  const [showNewPwd,   setShowNewPwd]   = useState(false);
  const [showConfPwd,  setShowConfPwd]  = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);

  const [form, setForm] = useState({
    first_name: "", middle_name: "", last_name: "",
    contact_number: "", address: "", email: "",
    current_password: "", new_password: "", confirm_password: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["vendor-stall-info", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: vendor }  = await supabase.from("vendors").select("*, stalls(*)").eq("user_id", user!.id).single();
      const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      return { vendor, profile, stall: vendor?.stalls as any, email: authUser?.email || "" };
    },
  });

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
        current_password: "", new_password: "", confirm_password: "",
      }));
      setEmailChanged(false);
    }
  }, [data]);

  const stall   = data?.stall;
  const vendor  = data?.vendor;
  const profile = data?.profile;
  const isActive = profile?.status === "active";

  const saveAll = useMutation({
    mutationFn: async () => {
      const errors: string[] = [];
      const { error: profileErr } = await supabase.from("profiles")
        .update({
          first_name:     form.first_name.trim(),
          middle_name:    form.middle_name.trim() || null,
          last_name:      form.last_name.trim(),
          contact_number: form.contact_number.trim() || null,
          address:        form.address.trim() || null,
        })
        .eq("user_id", user!.id);
      if (profileErr) errors.push(`Profile: ${profileErr.message}`);

      if (form.email.trim() && form.email.trim() !== data?.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: form.email.trim() });
        if (emailErr) errors.push(`Email: ${emailErr.message}`);
        else setEmailChanged(true);
      }

      if (form.new_password) {
        if (!form.current_password) throw new Error("Enter your current password to change it.");
        if (form.new_password.length < 6) throw new Error("New password must be at least 6 characters.");
        if (form.new_password !== form.confirm_password) throw new Error("New passwords do not match.");
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: data?.email || "", password: form.current_password,
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
        current_password: "", new_password: "", confirm_password: "",
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
    link.href = url;
    link.download = `QR-Stall-${stall?.stall_number || "vendor"}.png`;
    link.click();
    toast.success("QR code downloaded!");
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  if (isLoading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#2563eb" }} />
    </div>
  );

  return (
    <div className="-mx-4 -mt-4 lg:mx-0 lg:mt-0">

      {/* ── Mobile Profile Hero ─────────────────────────────────────────── */}
      <div className="lg:hidden" style={{ background: DS.gradientHeader }}>
        <div className="flex flex-col items-center px-5 pt-8 pb-10">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3"
            style={{ background: "rgba(255,255,255,0.2)", border: "3px solid rgba(255,255,255,0.4)" }}>
            <span className="text-3xl font-black text-white">
              {(profile?.first_name?.[0] || "")}{(profile?.last_name?.[0] || "")}
            </span>
          </div>
          <p className="text-xl font-black text-white">
            {profile?.first_name} {profile?.last_name}
          </p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.65)" }}>
            Stall #{stall?.stall_number || "—"} · {stall?.section || "General"} Section
          </p>
          <div className="flex items-center gap-1.5 rounded-full px-4 py-1.5 mt-3"
            style={{ background: "rgba(74,222,128,0.2)", border: "1px solid rgba(74,222,128,0.4)" }}>
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            <span className="text-xs font-bold text-green-400">
              {isActive ? "Active Vendor" : "Suspended"}
            </span>
          </div>
        </div>
      </div>

      {/* Desktop header */}
      <div className="hidden lg:flex items-start justify-between flex-wrap gap-3" style={{ padding: "28px 32px 0" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Stall Information</h1>
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>Your stall details and account settings</p>
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

      {/* ── Cards — overlap the hero on mobile ─────────────────────────── */}
      <div className="px-3 -mt-6 lg:mt-5 lg:px-8 space-y-3 pb-24 lg:pb-10">

        {/* ── DESKTOP: Two-column professional layout ── */}
        <div className="hidden lg:grid lg:grid-cols-[1fr_340px] gap-5">

          {/* LEFT: Stall Details + Personal + Contact + Account */}
          <div className="space-y-4">

            {/* Stall Details */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: DS.blue50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={15} color={DS.blue600} />
                </div>
                <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>Stall Details</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
                {[
                  { label: "Stall #", value: stall?.stall_number || "—", mono: true, large: true },
                  { label: "Section", value: stall?.section || "General" },
                  { label: "Location", value: stall?.location || "—" },
                ].map((f, i) => (
                  <div key={f.label} style={{ padding: "16px 20px", borderRight: i < 2 ? "1px solid #f1f5f9" : "none", borderBottom: "1px solid #f1f5f9" }}>
                    <p style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>{f.label}</p>
                    <p style={{ fontSize: f.large ? 28 : 15, fontWeight: 800, color: "#0f172a", fontFamily: f.mono ? "'JetBrains Mono', monospace" : "inherit" }}>{f.value}</p>
                  </div>
                ))}
                {[
                  { label: "Monthly Rate", value: stall?.monthly_rate ? `₱${Number(stall.monthly_rate).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—", color: "#16a34a", mono: true },
                  { label: "Status", value: isActive ? "Active" : "Suspended", color: isActive ? "#16a34a" : "#dc2626", dot: true },
                  { label: "Award Date", value: vendor?.award_date ? new Date(vendor.award_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }) : "—" },
                ].map((f, i) => (
                  <div key={f.label} style={{ padding: "16px 20px", borderRight: i < 2 ? "1px solid #f1f5f9" : "none" }}>
                    <p style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, marginBottom: 6 }}>{f.label}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {f.dot && <div style={{ width: 8, height: 8, borderRadius: "50%", background: f.color, flexShrink: 0 }} />}
                      <p style={{ fontSize: 15, fontWeight: 700, color: f.color || "#0f172a", fontFamily: (f as any).mono ? "'JetBrains Mono', monospace" : "inherit" }}>{f.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personal Information */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: DS.blue50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={15} color={DS.blue600} />
                  </div>
                  <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>Personal Information</span>
                </div>
                {!editing && (
                  <button onClick={() => setEditing(true)} style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8,
                    background: DS.blue50, border: `1px solid ${DS.blue100}`, color: DS.blue600,
                    fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <Edit3 size={13} /> Edit
                  </button>
                )}
              </div>
              <div style={{ padding: "16px 20px" }}>
                {editing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label className="text-xs text-slate-500">First Name <span className="text-red-500">*</span></Label>
                      <Input className="h-10 rounded-xl" value={form.first_name} onChange={set("first_name")} placeholder="First name" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label className="text-xs text-slate-500">Last Name <span className="text-red-500">*</span></Label>
                      <Input className="h-10 rounded-xl" value={form.last_name} onChange={set("last_name")} placeholder="Last name" />
                    </div>
                    <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label className="text-xs text-slate-500">Middle Name</Label>
                      <Input className="h-10 rounded-xl" value={form.middle_name} onChange={set("middle_name")} placeholder="Middle name (optional)" />
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    {[
                      { label: "First Name",  value: profile?.first_name  || "—" },
                      { label: "Middle Name", value: profile?.middle_name || "—" },
                      { label: "Last Name",   value: profile?.last_name   || "—" },
                    ].map(f => (
                      <div key={f.label}>
                        <p style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{f.label}</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{f.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: DS.blue50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Phone size={15} color={DS.blue600} />
                </div>
                <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>Contact Information</span>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label className="text-xs text-slate-500">Contact Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="h-10 pl-9 rounded-xl" value={form.contact_number} onChange={set("contact_number")} placeholder="e.g. 09xx-xxx-xxxx" />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label className="text-xs text-slate-500">Address</Label>
                      <div className="relative">
                        <Home className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <textarea className="w-full min-h-[72px] pl-9 pr-3 pt-2.5 pb-2 rounded-xl border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                          placeholder="Home address" value={form.address} onChange={set("address")} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                      { label: "Contact Number", value: profile?.contact_number || "—", icon: Phone },
                      { label: "Address",         value: profile?.address        || "—", icon: Home  },
                    ].map(f => (
                      <div key={f.label} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                          <f.icon size={13} color="#64748b" />
                        </div>
                        <div>
                          <p style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{f.label}</p>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{f.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Account / Login */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: DS.blue50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Mail size={15} color={DS.blue600} />
                </div>
                <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>Account & Login</span>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {editing ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label className="text-xs text-slate-500">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input type="email" className="h-10 pl-9 rounded-xl" value={form.email} onChange={set("email")} placeholder="your@email.com" />
                      </div>
                      {form.email !== data?.email && form.email && (
                        <p className="text-xs text-amber-600 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />A confirmation link will be sent to the new email.</p>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>Change Password (optional)</span>
                      <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                      {[
                        { key: "current_password" as const, label: "Current Password", show: showPwd, setShow: setShowPwd, placeholder: "Required to change" },
                        { key: "new_password"     as const, label: "New Password",     show: showNewPwd,  setShow: setShowNewPwd,  placeholder: "Min 6 characters" },
                        { key: "confirm_password" as const, label: "Confirm Password", show: showConfPwd, setShow: setShowConfPwd, placeholder: "Re-enter new password" },
                      ].map(f => (
                        <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <Label className="text-xs text-slate-500">{f.label}</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input type={f.show ? "text" : "password"} className="h-10 pl-9 pr-10 rounded-xl" value={form[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />
                            <button type="button" onClick={() => f.setShow((v: boolean) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {f.show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {form.new_password && form.confirm_password && form.new_password !== form.confirm_password && (
                      <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" />Passwords do not match.</p>
                    )}
                    {form.new_password && form.confirm_password && form.new_password === form.confirm_password && (
                      <p className="text-xs text-green-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />Passwords match.</p>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {[
                      { label: "Email Address", value: data?.email || "—", icon: Mail },
                      { label: "Password",       value: "••••••••",         icon: Lock },
                    ].map(f => (
                      <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <f.icon size={13} color="#64748b" />
                        </div>
                        <div>
                          <p style={{ fontSize: 9.5, textTransform: "uppercase", letterSpacing: 1.5, color: "#94a3b8", fontWeight: 700, marginBottom: 4 }}>{f.label}</p>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{f.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: QR Code + vendor profile card */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Profile summary card */}
            <div style={{ background: DS.gradientHeader, borderRadius: 16, padding: "24px 20px", textAlign: "center", color: "#fff" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "3px solid rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: "#fff" }}>
                  {(profile?.first_name?.[0] || "")}{(profile?.last_name?.[0] || "")}
                </span>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{profile?.first_name} {profile?.last_name}</p>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>Stall #{stall?.stall_number} · {stall?.section || "General"} Section</p>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "5px 12px", borderRadius: 999, background: "rgba(74,222,128,0.2)", border: "1px solid rgba(74,222,128,0.35)" }}>
                <CheckCircle2 size={12} color="#4ade80" />
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>{isActive ? "Active Vendor" : "Suspended"}</span>
              </div>
            </div>

            {/* QR Code */}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: DS.blue50, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <QrCode size={15} color={DS.blue600} />
                </div>
                <span style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>Your QR Code</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px", gap: 12 }}>
                {vendor?.qr_code ? (
                  <>
                    <div style={{ borderRadius: 16, padding: 12, background: "#fff", border: `2px solid ${DS.blue100}`, boxShadow: "0 2px 8px rgba(37,99,235,0.1)" }}>
                      <QRCodeSVG value={vendor.qr_code} size={168} level="H" />
                    </div>
                    <div id="vendor-qr-canvas" style={{ display: "none" }}>
                      <QRCodeCanvas value={vendor.qr_code} size={400} />
                    </div>
                    <p style={{ fontSize: 9, fontFamily: "monospace", color: "#94a3b8", wordBreak: "break-all", textAlign: "center", maxWidth: 240 }}>{vendor.qr_code}</p>
                    <button onClick={handleDownloadQR} style={{
                      display: "flex", alignItems: "center", gap: 8, padding: "10px 20px",
                      borderRadius: 10, background: DS.blue50, border: `1.5px solid ${DS.blue100}`,
                      fontSize: 13, fontWeight: 700, color: DS.blue900, cursor: "pointer", fontFamily: "inherit", width: "100%", justifyContent: "center",
                    }}>
                      <Download size={15} /> Download QR Code
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "24px 0", color: "#94a3b8" }}>
                    <QrCode size={48} style={{ opacity: 0.2 }} />
                    <p style={{ fontSize: 13 }}>No QR code assigned yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE: Original card layout ── */}
        <div className="lg:hidden space-y-3">

        {/* Stall Details Card */}
        <div className="rounded-2xl bg-white overflow-hidden"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.blue50 }}>
              <MapPin className="h-4 w-4" style={{ color: DS.blue600 }} />
            </div>
            <span className="font-bold text-slate-900">Stall Details</span>
          </div>
          <div className="grid grid-cols-2 gap-0">
            <div className="p-4 border-b border-r border-slate-50">
              <p className="text-[9.5px] uppercase tracking-wide text-slate-400 font-semibold">Stall #</p>
              <p className="text-2xl font-black mt-1" style={{ color: DS.blue900, fontFamily: "'JetBrains Mono', monospace" }}>
                {stall?.stall_number || "—"}
              </p>
            </div>
            <div className="p-4 border-b border-slate-50">
              <p className="text-[9.5px] uppercase tracking-wide text-slate-400 font-semibold">Section</p>
              <p className="text-lg font-black text-slate-900 mt-1">{stall?.section || "General"}</p>
            </div>
            <div className="p-4 border-r border-slate-50">
              <p className="text-[9.5px] uppercase tracking-wide text-slate-400 font-semibold">Monthly Rate</p>
              <p className="text-lg font-black text-green-600 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt(stall?.monthly_rate || 1450)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[9.5px] uppercase tracking-wide text-slate-400 font-semibold">Status</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-500" : "bg-red-500"}`} />
                <span className={`text-sm font-bold ${isActive ? "text-green-600" : "text-red-600"}`}>
                  {isActive ? "Active" : "Suspended"}
                </span>
              </div>
            </div>
          </div>
          {vendor?.award_date && (
            <div className="flex items-center gap-3 px-4 py-3 border-t border-slate-50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: DS.blue50 }}>
                <Calendar className="h-4 w-4" style={{ color: DS.blue600 }} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">Award Date</p>
                <p className="text-sm font-semibold text-slate-900 mt-0.5">
                  {new Date(vendor.award_date).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* QR Code Card */}
        <div className="rounded-2xl bg-white overflow-hidden"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.blue50 }}>
              <QrCode className="h-4 w-4" style={{ color: DS.blue600 }} />
            </div>
            <span className="font-bold text-slate-900">Your QR Code</span>
          </div>
          <div className="flex flex-col items-center px-4 py-5 gap-3">
            {vendor?.qr_code ? (
              <>
                <div className="rounded-2xl p-3 bg-white"
                  style={{ border: `2px solid ${DS.blue100}` }}>
                  <QRCodeSVG value={vendor.qr_code} size={160} level="H" />
                </div>
                <div id="vendor-qr-canvas" style={{ display: "none" }}>
                  <QRCodeCanvas value={vendor.qr_code} size={400} />
                </div>
                <p className="text-[10px] font-mono text-slate-400 break-all max-w-xs text-center">
                  {vendor.qr_code}
                </p>
                <button
                  onClick={handleDownloadQR}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all"
                  style={{ background: DS.blue50, border: `1.5px solid ${DS.blue100}`, color: DS.blue800 }}>
                  <Download className="h-4 w-4" /> Download QR Code
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-muted-foreground py-6">
                <QrCode className="h-16 w-16 opacity-20" />
                <p className="text-sm">No QR code assigned yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Personal Information Card */}
        <div className="rounded-2xl bg-white overflow-hidden"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.blue50 }}>
                <UserCircle className="h-4 w-4" style={{ color: DS.blue600 }} />
              </div>
              <span className="font-bold text-slate-900">Personal Information</span>
            </div>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                style={{ background: DS.blue50, border: `1px solid ${DS.blue100}`, color: DS.blue600 }}>
                <Edit3 className="h-3.5 w-3.5" /> Edit
              </button>
            )}
          </div>

          <div className="px-4 py-2">
            {editing ? (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">First Name <span className="text-red-500">*</span></Label>
                    <Input className="h-10 rounded-xl" value={form.first_name} onChange={set("first_name")} placeholder="First name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500">Last Name <span className="text-red-500">*</span></Label>
                    <Input className="h-10 rounded-xl" value={form.last_name} onChange={set("last_name")} placeholder="Last name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Middle Name</Label>
                  <Input className="h-10 rounded-xl" value={form.middle_name} onChange={set("middle_name")} placeholder="Middle name (optional)" />
                </div>
              </div>
            ) : (
              <FieldRow icon={User} label="Full Name"
                value={[profile?.first_name, profile?.middle_name, profile?.last_name].filter(Boolean).join(" ")} />
            )}
          </div>
        </div>

        {/* Contact Information Card */}
        <div className="rounded-2xl bg-white overflow-hidden"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.blue50 }}>
              <Phone className="h-4 w-4" style={{ color: DS.blue600 }} />
            </div>
            <span className="font-bold text-slate-900">Contact Information</span>
          </div>
          <div className="px-4 py-2">
            {editing ? (
              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Contact Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-10 pl-9 rounded-xl" value={form.contact_number}
                      onChange={set("contact_number")} placeholder="e.g. 09xx-xxx-xxxx" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Address</Label>
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
              <div>
                <FieldRow icon={Phone} label="Contact Number" value={profile?.contact_number || ""} />
                <FieldRow icon={Home}  label="Address"        value={profile?.address        || ""} />
              </div>
            )}
          </div>
        </div>

        {/* Account / Login Card */}
        <div className="rounded-2xl bg-white overflow-hidden"
          style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DS.blue50 }}>
              <Mail className="h-4 w-4" style={{ color: DS.blue600 }} />
            </div>
            <span className="font-bold text-slate-900">Account / Login</span>
          </div>
          <div className="px-4 py-2">
            {editing ? (
              <div className="space-y-4 py-2">
                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Email Address</Label>
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

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">Change Password (optional)</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Current password */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Current Password</Label>
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
                  <Label className="text-xs text-slate-500">New Password</Label>
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
                  <Label className="text-xs text-slate-500">Confirm New Password</Label>
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
                    <p className="text-xs text-red-500 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" /> Passwords do not match.
                    </p>
                  )}
                  {form.new_password && form.confirm_password && form.new_password === form.confirm_password && (
                    <p className="text-xs text-green-600 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Passwords match.
                    </p>
                  )}
                </div>

                {/* Save / Cancel buttons */}
                <div className="flex gap-2 pt-2">
                  <button onClick={cancelEdit}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-slate-600 bg-slate-100">
                    <X className="h-4 w-4" /> Cancel
                  </button>
                  <button
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: DS.gradientCard }}
                    disabled={saveAll.isPending}
                    onClick={() => saveAll.mutate()}>
                    {saveAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <FieldRow icon={Mail} label="Email Address" value={data?.email || ""} />
                <FieldRow icon={Lock} label="Password" value="••••••••" />
              </div>
            )}
          </div>
        </div>

        </div>{/* end lg:hidden mobile cards */}

        {/* Logout — mobile only */}
        <button
          className="lg:hidden w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold transition-all"
          style={{ background: "#fff5f5", border: "1.5px solid #fecaca", color: "#dc2626" }}
          onClick={async () => { await signOut(); navigate("/login"); }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>

      </div>

      {/* Unified bottom nav — mobile only */}
      <VendorBottomNav />
    </div>
  );
};

export default VendorStallInfo;