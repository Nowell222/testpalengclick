import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "cashier" | "vendor" | "bplo" | "eemo";
type AccountStatus = "active" | "suspended" | "delinquent" | "closed";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { first_name: string; last_name: string; middle_name?: string; contact_number?: string; avatar_url?: string; status?: string; address?: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null; blockedStatus?: AccountStatus }>;
  signOut: () => Promise<void>;
  refetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoleAndProfile = async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.rpc("get_user_role", { _user_id: userId }),
      supabase.from("profiles").select("first_name, last_name, middle_name, contact_number, avatar_url, status, address").eq("user_id", userId).maybeSingle(),
    ]);
    if (roleRes.data) setRole(roleRes.data as AppRole);
    if (profileRes.data) {
      setProfile(profileRes.data);
      const status = profileRes.data.status;
      if (status === "suspended" || status === "delinquent" || status === "closed") {
        await clearAuth();
      }
    }
  };

  const refetchProfile = async () => {
    if (user?.id) {
      await fetchRoleAndProfile(user.id);
    }
  };

  const clearAuth = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
      // Handle expired/invalid refresh token - sign out cleanly
      if (event === "SIGNED_OUT" || (event === "TOKEN_REFRESHED" && !sess)) {
        setUser(null);
        setSession(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => fetchRoleAndProfile(sess.user.id), 0);
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    // ── Check account status before allowing access ──────────────────────
    const userId = data.user?.id;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();

      const status = profileData?.status as AccountStatus | undefined;

      if (status === "suspended" || status === "delinquent" || status === "closed") {
        // Sign them out immediately — they should not get a session
        await supabase.auth.signOut();
        return { error: null, blockedStatus: status };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signIn, signOut, refetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};