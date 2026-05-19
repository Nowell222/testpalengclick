import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Wallet, History, FileText, Store, Bell, Newspaper,
  LogOut, Menu, X, Loader2, type LucideIcon
} from "lucide-react";
import PushNotificationBanner from "@/components/PushNotificationBanner";
import VendorBottomNav from "@/components/VendorBottomNav";

interface NavItem { label: string; path: string; icon: LucideIcon; badge?: number }

const vendorNav: NavItem[] = [
  { label: "Dashboard", path: "/vendor", icon: LayoutDashboard },
  { label: "Pay Online", path: "/vendor/pay", icon: Wallet },
  { label: "Payment History", path: "/vendor/history", icon: History },
  { label: "Statement", path: "/vendor/statement", icon: FileText },
  { label: "Stall Info", path: "/vendor/stall", icon: Store },
  { label: "Notifications", path: "/vendor/notifications", icon: Bell },
  { label: "News & Inbox", path: "/vendor/news", icon: Newspaper },
];

const VENDOR_SIDEBAR_BG = "#0f172a";
const VENDOR_TOPNAV_BG = "linear-gradient(160deg,#0d2240 0%,#1a3a5f 45%,#1d4ed8 80%,#2563eb 100%)";
const VENDOR_ACTIVE_BG = "#1d4ed8";

const VendorLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { signOut, profile } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const navItems = vendorNav;

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : "Vendor Portal";
  const firstName = profile?.first_name ?? "";
  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      navigate("/login");
    } finally {
      setIsLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const confirmLogout = () => setShowLogoutConfirm(true);

  const LogoutModal = () => (
    <>
      {showLogoutConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}>
          <div style={{ background: "#fff", borderRadius: 28, width: "100%", maxWidth: 420, overflow: "hidden", boxShadow: "0 25px 70px rgba(0,0,0,0.3)", animation: "modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div style={{ padding: "40px 32px 32px" }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, color: "#2563eb" }}>
                <LogOut size={30} strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 12, letterSpacing: "-0.02em" }}>Sign Out Confirmation</h3>
              <p style={{ color: "#4b5563", fontSize: 15, lineHeight: 1.6, marginBottom: 36 }}>
                Are you sure you want to sign out? You will need to re-authenticate to access your vendor dashboard.
              </p>
              <div style={{ display: "flex", gap: 16 }}>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ flex: 1, padding: "14px", borderRadius: 16, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 15, fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  style={{ flex: 1, padding: "14px", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #1e40af, #2563eb)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: isLoggingOut ? "not-allowed" : "pointer", boxShadow: `0 8px 20px rgba(37, 99, 235, 0.2)`, transition: "all 0.2s", opacity: isLoggingOut ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
                >
                  {isLoggingOut ? <><Loader2 size={18} className="animate-spin" /> Signing out...</> : "Sign Me Out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </>
  );

  const VendorNavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "14px 12px 6px" }}>Navigation</div>
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} onClick={onItemClick} style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: active ? VENDOR_ACTIVE_BG : "transparent", color: active ? "#fff" : "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer", transition: "all 0.12s", position: "relative" }}
              onMouseEnter={e => !active && ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={e => !active && ((e.currentTarget as HTMLDivElement).style.background = "transparent")}>
              {active && <div style={{ position: "absolute", left: 0, top: "25%", bottom: "25%", width: 3, borderRadius: "0 3px 3px 0", background: "#60a5fa", marginLeft: -12 }} />}
              <item.icon size={15} color={active ? "#fff" : "rgba(255,255,255,0.55)"} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const VendorLogoutFooter = () => (
    <div style={{ padding: "12px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={confirmLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, color: "rgba(255,100,100,0.7)", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", transition: "all 0.12s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)", e.currentTarget.style.color = "#fca5a5")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,100,100,0.7)")}>
        <LogOut size={15} /> Signout
      </button>
      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textAlign: "center", paddingTop: 8 }}>Municipality of San Juan, Batangas</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{`@media(min-width:1024px){.v-mobile-only{display:none!important}}@media(max-width:1023px){.v-desktop-only{display:none!important}}*{font-family:'Plus Jakarta Sans',system-ui,sans-serif}`}</style>
      
      {/* Mobile drawer */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 280, background: VENDOR_SIDEBAR_BG, borderLeft: "1px solid rgba(255,255,255,0.08)", boxShadow: "-6px 0 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <img src="/favicon.png" alt="PC Logo" style={{ width: 24, height: 24, objectFit: "contain" }} />
                </div>
                <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>PALENG-CLICK</div><div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div></div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.7)" }}><X size={15} /></button>
            </div>
            <VendorNavList onItemClick={() => setOpen(false)} />
            <VendorLogoutFooter />
          </div>
        </>
      )}

      {/* Mobile header */}
      <header className="v-mobile-only" style={{ position: "sticky", top: 0, zIndex: 40, background: VENDOR_TOPNAV_BG, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 64, boxShadow: "0 2px 12px rgba(13,34,64,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <img src="/favicon.png" alt="PC Logo" style={{ width: 24, height: 24, objectFit: "contain" }} />
          </div>
          <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>PALENG-CLICK</div><div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }} onClick={() => navigate("/vendor/stall")}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1a3a5f,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{initials}</span>
            )}
          </div>
          <div><div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{firstName}</div><div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div></div>
        </div>
      </header>

      {/* Desktop layout */}
      <div className="v-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 240, flexShrink: 0, background: VENDOR_SIDEBAR_BG, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ height: 64, background: VENDOR_TOPNAV_BG, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="/favicon.png" alt="PC Logo" style={{ width: 24, height: 24, objectFit: "contain" }} />
            </div>
            <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>PALENG-CLICK</div><div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div></div>
          </div>
          <VendorNavList />
          <VendorLogoutFooter />
        </aside>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
          <header style={{ height: 64, background: VENDOR_TOPNAV_BG, display: "flex", alignItems: "center", padding: "0 24px", gap: 16, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)", position: "sticky", top: 0, zIndex: 30 }}>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link to="/vendor/notifications" style={{ textDecoration: "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.7)", cursor: "pointer" }}><Bell size={16} /></div>
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }} onClick={() => navigate("/vendor/stall")}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1a3a5f,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{initials}</span>
                  )}
                </div>
                <div><div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{displayName}</div><div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div></div>
              </div>
            </div>
          </header>
          <main style={{ flex: 1, overflowY: "auto", background: "#f1f5f9" }}>
            <PushNotificationBanner />
            <div style={{ 
              padding: location.pathname === "/vendor" || location.pathname === "/vendor/" ? "0" : "24px", 
              maxWidth: location.pathname === "/vendor" || location.pathname === "/vendor/" ? "none" : 1200, 
              margin: "0 auto" 
            }}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile content */}
      <div className="v-mobile-only" style={{ paddingBottom: 96 }}>
        <div style={{ padding: "16px" }}><Outlet /></div>
      </div>
      <div className="v-mobile-only"><VendorBottomNav /></div>
      <LogoutModal />
    </div>
  );
};

export default VendorLayout;
