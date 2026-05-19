import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CreditCard, QrCode, MessageSquare, Newspaper,
  FileBarChart, LogOut, Menu, X, Loader2,
  DollarSign, ClipboardList, Settings, Store, type LucideIcon,
} from "lucide-react";
import PushNotificationBanner from "@/components/PushNotificationBanner";

interface NavItem { 
  label: string; 
  path: string; 
  icon: LucideIcon; 
  badge?: number 
}

const adminNav: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "User Management", path: "/admin/users", icon: Users },
  { label: "Applications", path: "/admin/applications", icon: Store },
  { label: "Payments", path: "/admin/payments", icon: CreditCard },
  { label: "QR Code", path: "/admin/qr-codes", icon: QrCode },
  { label: "SMS", path: "/admin/sms", icon: MessageSquare },
  { label: "News & Inbox", path: "/admin/news", icon: Newspaper },
  { label: "Reports", path: "/admin/reports", icon: FileBarChart },
  { label: "Fee Schedules", path: "/admin/fee-schedules", icon: DollarSign },
  { label: "Audit Logs", path: "/admin/audit-logs", icon: ClipboardList },
  { label: "Settings", path: "/admin/settings", icon: Settings },
];

const adminBottomNav: NavItem[] = [
  { label: "Home", path: "/admin", icon: LayoutDashboard },
  { label: "Users", path: "/admin/users", icon: Users },
  { label: "Payments", path: "/admin/payments", icon: CreditCard },
  { label: "Reports", path: "/admin/reports", icon: FileBarChart },
  { label: "Inbox", path: "/admin/news", icon: Newspaper },
];



const ADMIN_SIDEBAR_BG = "#0d1f15";
const ADMIN_GRAD = "linear-gradient(160deg,#0d3320 0%,#0f6e56 70%,#10b981 100%)";
const ADMIN_COLORS = { 
  solid: "#0d3320", 
  light: "#0f6e56", 
  pale: "#ecfdf5", 
  border: "#a7f3d0", 
  text: "#065f46", 
  bg: "#f4faf7", 
  muted: "#6b7280" 
};

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { signOut, profile } = useAuth();

  const isActive = (path: string) => location.pathname === path;
  const currentItem = adminNav.find(item => item.path === location.pathname);
  const pageLabel = currentItem ? currentItem.label : "Settings";

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : "Municipal Treasurer";
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
              <div style={{ width: 64, height: 64, borderRadius: 20, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24, color: "#10b981" }}>
                <LogOut size={30} strokeWidth={2.5} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 12, letterSpacing: "-0.02em" }}>Sign Out Confirmation</h3>
              <p style={{ color: "#4b5563", fontSize: 15, lineHeight: 1.6, marginBottom: 36 }}>
                Are you sure you want to sign out? You will need to re-authenticate to access your admin portal.
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
                  style={{ flex: 1, padding: "14px", borderRadius: 16, border: "none", background: "linear-gradient(135deg, #065f46, #10b981)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: isLoggingOut ? "not-allowed" : "pointer", boxShadow: `0 8px 20px rgba(16, 185, 129, 0.2)`, transition: "all 0.2s", opacity: isLoggingOut ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
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

  const AdminNavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase", padding: "12px 10px 5px" }}>Navigation</div>
      {adminNav.map((item) => {
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} onClick={onItemClick} style={{ textDecoration: "none" }}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: active ? "rgba(16,185,129,0.18)" : "transparent", border: active ? "1px solid rgba(16,185,129,0.25)" : "1px solid transparent", color: active ? "#6ee7b7" : "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.12s", position: "relative" }}
              onMouseEnter={e => !active && ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => !active && ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
            >
              {active && <div style={{ position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3, borderRadius: "0 3px 3px 0", background: "#10b981" }} />}
              <item.icon size={15} color={active ? "#10b981" : "rgba(255,255,255,0.4)"} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981" }} />}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const AdminLogoutFooter = () => (
    <div style={{ padding: "10px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "8px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => navigate("/admin/settings")}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: ADMIN_GRAD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 10 }}>{initials}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#d1fae5", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
          <div style={{ color: "rgba(110,231,183,0.5)", fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase" }}>Admin</div>
        </div>
      </div>
      <button onClick={confirmLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, color: "rgba(255,100,100,0.65)", fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", transition: "all 0.12s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)", e.currentTarget.style.color = "#fca5a5")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,100,100,0.65)")}>
        <LogOut size={13} /> Sign Out
      </button>
      <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 8.5, textAlign: "center", paddingTop: 6 }}>Municipality of San Juan, Batangas</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: ADMIN_COLORS.bg }}>
      <style>{`@media(min-width:1024px){.ac-mobile-only{display:none!important}}@media(max-width:1023px){.ac-desktop-only{display:none!important}}`}</style>
      
      {/* Mobile drawer */}
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 280, background: ADMIN_SIDEBAR_BG, borderLeft: "1px solid rgba(16,185,129,0.12)", boxShadow: "-6px 0 32px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: ADMIN_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#fff", flexShrink: 0 }}>PC</div>
                <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>PALENG-CLICK</div><div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>Admin Portal</div></div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 7px", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.6)" }}><X size={15} /></button>
            </div>
            <AdminNavList onItemClick={() => setOpen(false)} />
            <AdminLogoutFooter />
          </div>
        </>
      )}

      {/* Desktop layout */}
      <div className="ac-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 240, flexShrink: 0, background: ADMIN_SIDEBAR_BG, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ height: 64, padding: "0 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", flexShrink: 0 }}>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: ADMIN_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#fff", flexShrink: 0 }}>PC</div>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>Admin Portal</div>
              </div>
            </Link>
          </div>
          <AdminNavList />
          <AdminLogoutFooter />
        </aside>

        <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
          <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", height: 64, padding: "0 24px", background: ADMIN_GRAD, borderBottom: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", flexShrink: 0, color: "#fff" }}>
            <div style={{ flex: 1 }} />
            <div style={{ flex: 2, display: "flex", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", opacity: 0.9 }}>
                {pageLabel}
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
              <span style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", borderRadius: 20, padding: "3px 14px", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                Admin
              </span>
            </div>
          </header>
          <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: ADMIN_COLORS.bg }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <PushNotificationBanner />
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile header */}
      <header className="ac-mobile-only" style={{ position: "sticky", top: 0, zIndex: 40, background: ADMIN_GRAD, borderBottom: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56, color: "#fff" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: ADMIN_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#fff" }}>PC</div>
          <div>
            <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
            <div style={{ color: ADMIN_COLORS.muted, fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Admin</div>
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>{firstName}</div>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Admin</div>
          </div>
          <button onClick={() => setOpen(true)} style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 9, padding: "7px 9px", cursor: "pointer", display: "flex", color: "#fff" }}>
            <Menu size={17} />
          </button>
        </div>
      </header>

      <div className="ac-mobile-only" style={{ background: ADMIN_COLORS.bg }}>
        <div style={{ padding: "16px", paddingBottom: 80 }}><Outlet /></div>
      </div>

      {/* Admin Mobile Bottom Nav */}
      <nav className="ac-mobile-only" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, background: "rgba(255,255,255,0.97)", borderTop: "1px solid #e8ecf0", boxShadow: "0 -4px 16px rgba(15,110,86,0.08)", backdropFilter: "blur(12px)", display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {adminBottomNav.map((item) => {
          const active = isActive(item.path);
          return (
            <Link key={item.path} to={item.path} style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px 8px", gap: 3 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "linear-gradient(135deg,#0d3320,#0f6e56)" : "transparent", transition: "all 0.15s" }}>
                  <item.icon size={16} color={active ? "#fff" : "#9ca3af"} />
                </div>
                <span style={{ fontSize: 9.5, fontWeight: active ? 700 : 500, color: active ? "#0f6e56" : "#9ca3af", letterSpacing: 0.3 }}>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <LogoutModal />
    </div>
  );
};

export default AdminLayout;
