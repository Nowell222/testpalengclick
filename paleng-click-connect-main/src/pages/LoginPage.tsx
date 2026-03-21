import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, MapPin, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const LoginPage = () => {
  const navigate     = useNavigate();
  const { signIn }   = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [isLoading,   setIsLoading]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please enter your email and password"); return; }
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);
    if (error) {
      toast.error(error);
    } else {
      setTimeout(async () => {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: user.id });
          if (roleData === "admin")    navigate("/admin");
          else if (roleData === "vendor")  navigate("/vendor");
          else if (roleData === "cashier") navigate("/cashier");
          else navigate("/");
        }
      }, 200);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "'Georgia', 'Times New Roman', serif", background: "#f8f5f0", position: "relative", overflow: "hidden" }}>

      {/* ── LEFT PANEL — image with overlay ─────────────────────────────────── */}
      <div style={{ display: "none", flex: "1 1 0%", position: "relative", overflow: "hidden" }} className="lg:block" id="login-left">
        <img
          src="/hall.jpg"
          alt="Municipal Hall of San Juan, Batangas"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", position: "absolute", inset: 0 }}
        />
        {/* Dark green overlay */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(10,25,12,0.93) 0%, rgba(10,25,12,0.75) 100%)" }} />
        {/* Gold top line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, transparent, #c9a84c, #e8c86e, #c9a84c, transparent)" }} />
        {/* Gold frame */}
        <div style={{ position: "absolute", inset: 24, border: "1px solid rgba(201,168,76,0.25)", pointerEvents: "none" }} />

        {/* Left panel content */}
        <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px 52px" }}>
          {/* Top: branding */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <div style={{ width: 44, height: 44, borderRadius: 9, overflow: "hidden", boxShadow: "0 2px 12px rgba(26,74,46,0.4)", flexShrink: 0 }}><img src="/favicon.png" alt="PALENG-CLICK" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }} /></div>
              <div>
                <div style={{ color: "#f0e6c8", fontWeight: 700, fontSize: 17, letterSpacing: 1 }}>PALENG-CLICK</div>
                <div style={{ color: "rgba(201,168,76,0.8)", fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase" }}>San Juan, Batangas</div>
              </div>
            </div>
          </div>

          {/* Middle: quote / welcome */}
          <div>
            <div style={{ width: 40, height: 2, background: "#c9a84c", marginBottom: 28 }} />
            <h2 style={{ color: "#f0e6c8", fontSize: "clamp(1.6rem, 2.5vw, 2.4rem)", fontWeight: 700, lineHeight: 1.2, marginBottom: 16 }}>
              Welcome to<br />
              <em style={{ color: "#e8c86e" }}>Pamilihang Bayan</em>
            </h2>
            <p style={{ color: "rgba(240,230,200,0.65)", fontSize: 14, lineHeight: 1.8, maxWidth: 340 }}>
              The official digital payment platform of San Juan Public Market, serving 955 stallholders across Bolante, General, Fish, Meat, and Dry Goods sections.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 28 }}>
              <MapPin size={13} color="#c9a84c" />
              <span style={{ color: "rgba(201,168,76,0.75)", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase" }}>San Juan, Batangas, Philippines</span>
            </div>
          </div>

          {/* Bottom: footer note */}
          <div style={{ borderTop: "1px solid rgba(201,168,76,0.2)", paddingTop: 24 }}>
            <p style={{ color: "rgba(240,230,200,0.35)", fontSize: 11, letterSpacing: 0.5 }}>
              © 2026 Municipality of San Juan, Batangas
            </p>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — login form ─────────────────────────────────────────── */}
      <div style={{ flex: "1 1 0%", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative", background: "#f8f5f0", minHeight: "100vh" }}>
        {/* Subtle background texture */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 80% 20%, rgba(45,122,79,0.05) 0%, transparent 60%), radial-gradient(circle at 20% 80%, rgba(201,168,76,0.04) 0%, transparent 50%)", pointerEvents: "none" }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ width: "100%", maxWidth: 440, position: "relative" }}
        >
          {/* Back link */}
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#7a8a7a", fontSize: 13, textDecoration: "none", marginBottom: 36, fontFamily: "Georgia, serif" }}>
            <ArrowLeft size={14} />
            Back to home
          </Link>

          {/* Mobile logo (hidden on desktop) */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }} className="lg:hidden">
            <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}><img src="/favicon.png" alt="PALENG-CLICK" style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "inherit" }} /></div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#1a2e1a", fontFamily: "Georgia, serif" }}>PALENG-CLICK</div>
              <div style={{ fontSize: 10, color: "#7a8a7a", letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
            </div>
          </div>

          {/* Form card */}
          <div style={{ background: "#ffffff", border: "1px solid #ddd5c5", borderRadius: 16, padding: "44px 40px", boxShadow: "0 8px 40px rgba(26,46,26,0.08), 0 2px 8px rgba(26,46,26,0.04)" }}>

            {/* Gold top accent */}
            <div style={{ height: 3, background: "linear-gradient(90deg, #1a4a2e, #2d7a4f, #c9a84c)", borderRadius: "12px 12px 0 0", margin: "-44px -40px 36px", borderTopLeftRadius: 15, borderTopRightRadius: 15 }} />

            {/* Header */}
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.75rem", fontWeight: 700, color: "#1a2e1a", lineHeight: 1.2, marginBottom: 8 }}>
                Sign In
              </h1>
              <p style={{ color: "#7a8a7a", fontSize: 13.5, fontFamily: "Georgia, serif", lineHeight: 1.6 }}>
                Access the San Juan Public Market payment portal.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 20 }}>
                <label htmlFor="email" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#3a4e3a", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "Georgia, serif", marginBottom: 8 }}>
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ width: "100%", height: 48, border: "1.5px solid #ddd5c5", borderRadius: 8, padding: "0 16px", fontSize: 14, fontFamily: "Georgia, serif", color: "#1a2e1a", background: "#fdfaf6", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                  onFocus={e => e.target.style.borderColor = "#2d7a4f"}
                  onBlur={e => e.target.style.borderColor = "#ddd5c5"}
                />
              </div>

              <div style={{ marginBottom: 28 }}>
                <label htmlFor="password" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#3a4e3a", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "Georgia, serif", marginBottom: 8 }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ width: "100%", height: 48, border: "1.5px solid #ddd5c5", borderRadius: 8, padding: "0 48px 0 16px", fontSize: 14, fontFamily: "Georgia, serif", color: "#1a2e1a", background: "#fdfaf6", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
                    onFocus={e => e.target.style.borderColor = "#2d7a4f"}
                    onBlur={e => e.target.style.borderColor = "#ddd5c5"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9aaa9a", padding: 0, display: "flex" }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading}
                style={{ width: "100%", height: 50, background: isLoading ? "#aaa" : "linear-gradient(135deg, #1a4a2e, #2d7a4f)", color: "#f0e6c8", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: isLoading ? "not-allowed" : "pointer", letterSpacing: 0.8, fontFamily: "Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "opacity 0.2s", boxShadow: isLoading ? "none" : "0 4px 16px rgba(26,74,46,0.25)" }}
              >
                {isLoading ? (
                  <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Signing in…</>
                ) : "Sign In to PALENG-CLICK"}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#ede5d5" }} />
              <span style={{ color: "#b0a090", fontSize: 11, fontFamily: "Georgia, serif", letterSpacing: 1 }}>OFFICIAL ACCESS ONLY</span>
              <div style={{ flex: 1, height: 1, background: "#ede5d5" }} />
            </div>

            {/* Footer note */}
            <p style={{ textAlign: "center", color: "#9aaa9a", fontSize: 12.5, fontFamily: "Georgia, serif", lineHeight: 1.7 }}>
              Having trouble logging in?<br />
              Contact the <strong style={{ color: "#2d7a4f" }}>Municipal Treasurer's Office</strong>.
            </p>
          </div>

          {/* Bottom note */}
          <p style={{ textAlign: "center", color: "#b0a090", fontSize: 11, fontFamily: "Georgia, serif", marginTop: 24, letterSpacing: 0.5 }}>
            © 2026 Municipality of San Juan, Batangas · PALENG-CLICK
          </p>
        </motion.div>
      </div>

      {/* Make left panel visible on lg screens */}
      <style>{`
        @media (min-width: 1024px) {
          #login-left { display: block !important; }
        }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default LoginPage;