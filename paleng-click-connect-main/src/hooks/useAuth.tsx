import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AppRole = "admin" | "cashier" | "vendor" | "bplo" | "eemo";
type AccountStatus = "active" | "suspended" | "delinquent" | "closed" | "pending";

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
    try {
      const [roleRes, profileRes] = await Promise.all([
        supabase.rpc("get_user_role", { _user_id: userId }),
        supabase.from("profiles").select("first_name, last_name, middle_name, contact_number, avatar_url, status, address").eq("user_id", userId).maybeSingle(),
      ]);

      if (roleRes.data) {
        const userRole = roleRes.data as AppRole;
        setRole(userRole);
        localStorage.setItem(`palengclick_role_${userId}`, userRole);
      } else {
        const cachedRole = localStorage.getItem(`palengclick_role_${userId}`) as AppRole | null;
        if (cachedRole) setRole(cachedRole);
      }

      if (profileRes.data) {
        setProfile(profileRes.data);
        localStorage.setItem(`palengclick_profile_${userId}`, JSON.stringify(profileRes.data));
        const status = profileRes.data.status;
        if (status === "suspended" || status === "delinquent" || status === "closed" || status === "pending") {
          await clearAuth();
        }
      } else {
        const cachedProfileStr = localStorage.getItem(`palengclick_profile_${userId}`);
        if (cachedProfileStr) {
          try { setProfile(JSON.parse(cachedProfileStr)); } catch (e) {}
        }
      }
    } catch (err) {
      console.warn("Offline or network issue while fetching profile/role:", err);
      const cachedRole = localStorage.getItem(`palengclick_role_${userId}`) as AppRole | null;
      const cachedProfileStr = localStorage.getItem(`palengclick_profile_${userId}`);
      if (cachedRole) setRole(cachedRole);
      if (cachedProfileStr) {
        try { setProfile(JSON.parse(cachedProfileStr)); } catch (e) {}
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
    if (user?.id) {
      localStorage.removeItem(`palengclick_role_${user.id}`);
      localStorage.removeItem(`palengclick_profile_${user.id}`);
    }
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
    setLoading(false);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, sess) => {
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
        const userId = sess.user.id;
        // Immediately restore cached role & profile so offline navigation works without waiting for network
        const cachedRole = localStorage.getItem(`palengclick_role_${userId}`) as AppRole | null;
        const cachedProfileStr = localStorage.getItem(`palengclick_profile_${userId}`);
        if (cachedRole) setRole(cachedRole);
        if (cachedProfileStr) {
          try { setProfile(JSON.parse(cachedProfileStr)); } catch (e) {}
        }

        fetchRoleAndProfile(userId);
      } else {
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Realtime profile listener: Instant auto-logout when account is closed, suspended, or delinquent
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-status-listener-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newStatus = payload.new?.status;
          if (newStatus === "closed" || newStatus === "suspended" || newStatus === "delinquent") {
            toast.error(
              newStatus === "closed"
                ? "🔒 Your account has been closed by the Market Administration."
                : newStatus === "suspended"
                ? "⛔ Your account has been suspended."
                : "⚠️ Your account has been marked delinquent."
            );
            await clearAuth();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };

    const userId = data.user?.id;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("status")
        .eq("user_id", userId)
        .maybeSingle();

      const status = profileData?.status as AccountStatus | undefined;

      if (status === "suspended" || status === "delinquent" || status === "closed" || status === "pending") {
        await supabase.auth.signOut();
        return { error: null, blockedStatus: status };
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    if (user?.id) {
      localStorage.removeItem(`palengclick_role_${user.id}`);
      localStorage.removeItem(`palengclick_profile_${user.id}`);
    }
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