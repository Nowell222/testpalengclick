import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { User, Mail, Lock, Save, Loader2, ShieldCheck, UserCircle, Camera, AlertCircle } from "lucide-react";
import LoadingOverlay from "@/components/LoadingOverlay";

const CashierSettings = () => {
  const { user, profile, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");

  // Account state
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (profile && user) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setMiddleName(profile.middle_name || "");
      setContactNumber(profile.contact_number || "");
      setAddress((profile as any).address || "");
      setEmail(user.email || "");
      setFetching(false);
    }
  }, [profile, user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
          contact_number: contactNumber,
          address: address,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Profile updated successfully");
      await refetchProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = newPassword.trim();

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
    if (trimmedEmail !== user.email?.toLowerCase() && !emailRegex.test(trimmedEmail)) {
      toast.error(`"${trimmedEmail}" is not a valid email format.`);
      return;
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (trimmedPassword && trimmedPassword !== confirmPassword.trim()) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      // Use the Edge Function to bypass email confirmation requirement
      const { data: edgeData, error: edgeError } = await supabase.functions.invoke("create-user", {
        body: {
          _action: "update-self",
          email: trimmedEmail !== user.email?.toLowerCase() ? trimmedEmail : undefined,
          password: trimmedPassword || undefined,
        },
      });

      if (edgeError || (edgeData && edgeData.error)) {
        const rawMsg = edgeError?.message || edgeData?.error || "Failed to update account";
        const errMsg = rawMsg.includes("Failed to send a request")
          ? "Connection failed: Unable to connect to backend settings service."
          : rawMsg;
        throw new Error(errMsg);
      }

      toast.success("Account security updated successfully");
      setNewPassword("");
      setConfirmPassword("");
      if (trimmedEmail !== user.email?.toLowerCase()) {
        setEmail(trimmedEmail);
      }
    } catch (error: any) {
      console.error("Update Account Error:", error);
      toast.error(error.message || "Failed to update account");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  const CASHIER_GRAD = "linear-gradient(160deg,#0d3320 0%,#0f6e56 70%,#10b981 100%)";

  return (
    <div className="-mx-6 -mt-6 animate-in fade-in duration-500 overflow-hidden flex flex-col h-[calc(100vh-56px)] bg-slate-50/50">
      {loading && <LoadingOverlay role="cashier" message="Updating your settings..." />}
      {/* COMPACT GRADIENT HEADER */}
      <div style={{ background: CASHIER_GRAD }} className="px-8 py-4 text-white shadow-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md p-0.5 border border-white/30 overflow-hidden">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden relative">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-black text-emerald-600">
                    {profile?.first_name?.[0]}{profile?.last_name?.[0]}
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => document.getElementById('avatar-upload-mini')?.click()}
              className="absolute -bottom-1 -right-1 bg-white text-emerald-700 p-1.5 rounded-xl shadow-lg hover:scale-110 transition-all active:scale-95 border border-emerald-50"
            >
              <Camera size={12} />
            </button>
            <input id="avatar-upload-mini" type="file" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !user) return;
              setLoading(true);
              try {
                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}/${Math.random()}.${fileExt}`;
                await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('user_id', user.id);
                toast.success("Profile picture updated!");
                await refetchProfile();
              } catch (err: any) { toast.error(err.message || "Upload failed"); }
              finally { setLoading(false); }
            }} className="hidden" accept="image/*" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-tight">{profile?.first_name} {profile?.last_name}</h1>
            <p className="text-emerald-50/70 text-xs font-medium flex items-center gap-1.5 mt-0.5">
              <ShieldCheck size={14} className="text-emerald-300" />
              Assigned Cashier · {user?.email}
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-50">Terminal Active</span>
          </div>
        </div>
      </div>

      {/* COMPACT GRID CONTENT */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full max-w-7xl mx-auto">
          
          {/* LEFT: Security (Compact) */}
          <div className="lg:col-span-4 flex flex-col h-full">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                  <Lock size={14} className="text-emerald-600" />
                  Security
                </h2>
              </div>
              <form onSubmit={handleUpdateAccount} className="p-5 flex flex-col flex-1 gap-4 overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={14} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none bg-slate-50/30" required />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={14} />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none bg-slate-50/30" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirm Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500" size={14} />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••" className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none bg-slate-50/30" />
                  </div>
                </div>
                <div className="mt-auto pt-4">
                  <Button type="submit" disabled={loading} className="w-full rounded-xl gap-2 bg-slate-900 hover:bg-slate-800 h-11 text-xs font-bold transition-all active:scale-95">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save size={16} />}
                    Update Account
                  </Button>
                </div>
              </form>
            </div>
          </div>

          {/* RIGHT: Profile (Compact) */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
              <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                  <UserCircle size={14} className="text-emerald-600" />
                  Profile Information
                </h2>
              </div>
              <form onSubmit={handleUpdateProfile} className="p-6 flex flex-col flex-1 gap-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all outline-none text-slate-700 bg-slate-50/30 text-sm font-medium" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all outline-none text-slate-700 bg-slate-50/30 text-sm font-medium" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Middle Name</label>
                    <input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all outline-none text-slate-700 bg-slate-50/30 text-sm font-medium" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Contact Number</label>
                    <input type="text" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all outline-none text-slate-700 bg-slate-50/30 text-sm font-medium" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Home Address</label>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all outline-none text-slate-700 bg-slate-50/30 text-sm min-h-[80px] font-medium resize-none" />
                </div>
                <div className="mt-auto pt-4 flex justify-end">
                  <Button type="submit" disabled={loading} style={{ background: CASHIER_GRAD }}
                    className="px-10 py-6 rounded-xl text-white font-bold flex items-center gap-3 hover:opacity-90 shadow-lg shadow-emerald-900/10 disabled:opacity-50 text-base transition-all active:scale-95">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default CashierSettings;
