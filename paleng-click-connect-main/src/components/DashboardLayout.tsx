import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CreditCard, QrCode, MessageSquare, Newspaper,
  FileBarChart, LogOut, Menu, X, Wallet, History, FileText, Store, Bell,
  Search, Receipt, Send, DollarSign, ChevronRight, ClipboardList, Settings, type LucideIcon,
} from "lucide-react";
import PushNotificationBanner from "@/components/PushNotificationBanner";
import VendorBottomNav from "@/components/VendorBottomNav";

interface NavItem { label: string; path: string; icon: LucideIcon; badge?: number }

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
const vendorNav: NavItem[] = [
  { label: "Dashboard", path: "/vendor", icon: LayoutDashboard },
  { label: "Pay Online", path: "/vendor/pay", icon: Wallet },
  { label: "Payment History", path: "/vendor/history", icon: History },
  { label: "Statement", path: "/vendor/statement", icon: FileText },
  { label: "Stall Info", path: "/vendor/stall", icon: Store },
  { label: "Notifications", path: "/vendor/notifications", icon: Bell },
  { label: "News & Inbox", path: "/vendor/news", icon: Newspaper },
];
const vendorBottomNav: NavItem[] = [
  { label: "Home", path: "/vendor", icon: LayoutDashboard },
  { label: "Pay", path: "/vendor/pay", icon: Wallet },
  { label: "History", path: "/vendor/history", icon: History },
  { label: "Alerts", path: "/vendor/notifications", icon: Bell },
  { label: "More", path: "/vendor/statement", icon: FileText },
];
const cashierNav: NavItem[] = [
  { label: "Dashboard", path: "/cashier", icon: LayoutDashboard },
  { label: "Accept Payment", path: "/cashier/accept", icon: CreditCard },
  { label: "Search Vendor", path: "/cashier/search", icon: Search },
  { label: "Payment Status", path: "/cashier/status", icon: Receipt },
  { label: "Print SOA", path: "/cashier/soa", icon: FileText },
  { label: "SMS Reminders", path: "/cashier/sms", icon: Send },
  { label: "Shift History", path: "/cashier/shifts", icon: History },
  { label: "Reports", path: "/cashier/reports", icon: FileBarChart },
  { label: "Settings", path: "/cashier/settings", icon: Settings },
];
const cashierBottomNav: NavItem[] = [
  { label: "Home", path: "/cashier", icon: LayoutDashboard },
  { label: "Accept", path: "/cashier/accept", icon: CreditCard },
  { label: "Search", path: "/cashier/search", icon: Search },
  { label: "Status", path: "/cashier/status", icon: Receipt },
  { label: "Reports", path: "/cashier/reports", icon: FileBarChart },
];

interface DashboardLayoutProps { role: "admin" | "vendor" | "cashier"; }
const roleLabels = { admin: "Municipal Treasurer", vendor: "Vendor Portal", cashier: "Cashier Terminal" };

// ── Cashier sidebar colors ────────────────────────────────────────────────────
const CASHIER_DARK = "#0d1f15";
const CASHIER_GRAD = "linear-gradient(160deg,#0d3320 0%,#0f6e56 70%,#10b981 100%)";
const CASHIER_ACTIVE = "#10b981";
const CASHIER_SIDEBAR_BG = "#0d1f15";

const ROLE_COLORS = {
  admin: { solid: "#0d3320", light: "#0f6e56", pale: "#ecfdf5", border: "#a7f3d0", text: "#065f46", bg: "#f4faf7", muted: "#6b7280" },
  cashier: { solid: "#0d3320", light: "#0f6e56", pale: "#ecfdf5", border: "#a7f3d0", text: "#065f46", bg: "#f4faf7", muted: "#6b7280" },
  vendor: { solid: "#0d2240", light: "#2563eb", pale: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", bg: "#f1f5f9", muted: "#64748b" },
};

const VENDOR_SIDEBAR_BG = "#0f172a";
const VENDOR_TOPNAV_BG = "linear-gradient(160deg,#0d2240 0%,#1a3a5f 45%,#1d4ed8 80%,#2563eb 100%)";
const VENDOR_ACTIVE_BG = "#1d4ed8";

const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { signOut, profile } = useAuth();

  const isVendor = role === "vendor";
  const isCashier = role === "cashier";
  const navItems = role === "admin" ? adminNav : isVendor ? vendorNav : cashierNav;
  const bottomItems = role === "admin" ? adminBottomNav : isVendor ? vendorBottomNav : cashierBottomNav;

  const isActive = (path: string) => location.pathname === path;
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : roleLabels[role];
  const firstName = profile?.first_name ?? "";
  const initials = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`;
  const handleLogout = async () => { await signOut(); navigate("/login"); };

  const rc = ROLE_COLORS[role];
  const fontFamily = isVendor
    ? "'Plus Jakarta Sans', system-ui, sans-serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  /* ══════════════════════════════════════════════════════════════════════════
     VENDOR LAYOUT (unchanged from original, preserved exactly)
  ══════════════════════════════════════════════════════════════════════════ */
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
      <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, color: "rgba(255,100,100,0.7)", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily, transition: "all 0.12s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)", e.currentTarget.style.color = "#fca5a5")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,100,100,0.7)")}>
        <LogOut size={15} /> Logout
      </button>
      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textAlign: "center", paddingTop: 8 }}>Municipality of San Juan, Batangas</div>
    </div>
  );

  if (isVendor) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily }}>
        <style>{`@media(min-width:1024px){.v-mobile-only{display:none!important}}@media(max-width:1023px){.v-desktop-only{display:none!important}}*{font-family:'Plus Jakarta Sans',system-ui,sans-serif}`}</style>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 280, background: VENDOR_SIDEBAR_BG, borderLeft: "1px solid rgba(255,255,255,0.08)", boxShadow: "-6px 0 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff", letterSpacing: -1 }}>PC</div>
                  <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>PALENG-CLICK</div><div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div></div>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.7)" }}><X size={15} /></button>
              </div>
              <VendorNavList onItemClick={() => setOpen(false)} />
              <VendorLogoutFooter />
            </div>
          </>
        )}
        <header className="v-mobile-only" style={{ position: "sticky", top: 0, zIndex: 40, background: VENDOR_TOPNAV_BG, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 64, boxShadow: "0 2px 12px rgba(13,34,64,0.35)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff" }}>PC</div>
            <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>PALENG-CLICK</div><div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1a3a5f,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{initials}</span>
            </div>
            <div><div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{firstName}</div><div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div></div>
          </div>
        </header>
        <div className="v-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 240, flexShrink: 0, background: VENDOR_SIDEBAR_BG, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
            <div style={{ height: 64, background: VENDOR_TOPNAV_BG, display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, color: "#fff", flexShrink: 0 }}>PC</div>
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
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 6px", borderRadius: 10, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#1a3a5f,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{initials}</span></div>
                  <div><div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{displayName}</div><div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div></div>
                </div>
              </div>
            </header>
            <main style={{ flex: 1, overflowY: "auto", background: "#f1f5f9" }}>
              <PushNotificationBanner />
              <Outlet />
            </main>
          </div>
        </div>
        <div className="v-mobile-only" style={{ paddingBottom: 96 }}>
          <div style={{ padding: "16px" }}><Outlet /></div>
        </div>
        <div className="v-mobile-only"><VendorBottomNav /></div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CASHIER LAYOUT — new premium dark sidebar
  ══════════════════════════════════════════════════════════════════════════ */
  if (isCashier) {
    const CashierNavList = ({ onItemClick }: { onItemClick?: () => void }) => (
      <nav style={{ flex: 1, overflowY: "auto", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase", padding: "12px 10px 5px" }}>Navigation</div>
        {cashierNav.map((item) => {
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

    const CashierLogoutFooter = () => (
      <div style={{ padding: "10px 10px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "8px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: CASHIER_GRAD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 10 }}>{initials}</span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: "#d1fae5", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
            <div style={{ color: "rgba(110,231,183,0.5)", fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase" }}>Cashier</div>
          </div>
        </div>
        <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, color: "rgba(255,100,100,0.65)", fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily, transition: "all 0.12s" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)", e.currentTarget.style.color = "#fca5a5")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,100,100,0.65)")}>
          <LogOut size={13} /> Sign Out
        </button>
        <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 8.5, textAlign: "center", paddingTop: 6 }}>Municipality of San Juan, Batangas</div>
      </div>
    );

    return (
      <div style={{ minHeight: "100vh", background: rc.bg, fontFamily }}>
        <style>{`@media(min-width:1024px){.ac-mobile-only{display:none!important}}@media(max-width:1023px){.ac-desktop-only{display:none!important}}`}</style>

        {/* Mobile drawer */}
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
            <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 280, background: CASHIER_SIDEBAR_BG, borderLeft: "1px solid rgba(16,185,129,0.12)", boxShadow: "-6px 0 32px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
              <div style={{ height: 4, background: CASHIER_GRAD, flexShrink: 0 }} />
              <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: CASHIER_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#fff", flexShrink: 0 }}>PC</div>
                  <div><div style={{ color: "#fff", fontWeight: 800, fontSize: 13 }}>PALENG-CLICK</div><div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>Cashier Terminal</div></div>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "5px 7px", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.6)" }}><X size={15} /></button>
              </div>
              <CashierNavList onItemClick={() => setOpen(false)} />
              <CashierLogoutFooter />
            </div>
          </>
        )}

        {/* Desktop layout */}
        <div className="ac-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 240, flexShrink: 0, background: CASHIER_SIDEBAR_BG, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
            <div style={{ height: 4, background: CASHIER_GRAD, flexShrink: 0 }} />
            <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
              <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", marginBottom: 0 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: CASHIER_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#fff", flexShrink: 0 }}>PC</div>
                <div>
                  <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
                  <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>Cashier Terminal</div>
                </div>
              </Link>
            </div>
            <CashierNavList />
            <CashierLogoutFooter />
          </aside>

          <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
            <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", height: 56, padding: "0 24px", background: "rgba(255,255,255,0.96)", borderBottom: "1px solid #e8ecf0", boxShadow: "0 1px 8px rgba(15,110,86,0.06)", backdropFilter: "blur(8px)", flexShrink: 0 }}>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ background: rc.pale, border: `1px solid ${rc.border}`, color: rc.text, borderRadius: 20, padding: "3px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                  Cashier
                </span>
              </div>
            </header>
            <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: rc.bg }}>
              <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                <Outlet />
              </div>
            </main>
          </div>
        </div>

        {/* Mobile header */}
        <header className="ac-mobile-only" style={{ position: "sticky", top: 0, zIndex: 40, background: "#fff", borderBottom: "1px solid #e8ecf0", boxShadow: "0 2px 8px rgba(15,110,86,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56 }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: CASHIER_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#fff" }}>PC</div>
            <div>
              <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
              <div style={{ color: rc.muted, fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Cashier</div>
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#111827", fontSize: 12, fontWeight: 600 }}>{firstName}</div>
              <div style={{ color: rc.muted, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Cashier</div>
            </div>
            <button onClick={() => setOpen(true)} style={{ background: rc.pale, border: `1px solid ${rc.border}`, borderRadius: 9, padding: "7px 9px", cursor: "pointer", display: "flex", color: rc.text }}>
              <Menu size={17} />
            </button>
          </div>
        </header>

        <div className="ac-mobile-only" style={{ background: rc.bg }}>
          <div style={{ padding: "16px" }}><Outlet /></div>
        </div>

        {/* Mobile bottom nav */}
        <nav className="ac-mobile-only" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, background: "rgba(255,255,255,0.97)", borderTop: "1px solid #e8ecf0", boxShadow: "0 -4px 16px rgba(15,110,86,0.08)", backdropFilter: "blur(12px)", display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {cashierBottomNav.map((item) => {
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
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ADMIN LAYOUT — green cashier-style dark sidebar
  ══════════════════════════════════════════════════════════════════════════ */
  const ADMIN_SIDEBAR_BG = "#0d1f15";
  const ADMIN_GRAD = "linear-gradient(160deg,#0d3320 0%,#0f6e56 70%,#10b981 100%)";

  const AdminNavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase", padding: "12px 10px 5px" }}>Navigation</div>
      {navItems.map((item) => {
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
      <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)", borderRadius: 10, padding: "8px 10px", marginBottom: 10, display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: ADMIN_GRAD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 10 }}>{initials}</span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: "#d1fae5", fontWeight: 600, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayName}</div>
          <div style={{ color: "rgba(110,231,183,0.5)", fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase" }}>Admin</div>
        </div>
      </div>
      <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, color: "rgba(255,100,100,0.65)", fontSize: 12, fontWeight: 600, background: "none", border: "none", cursor: "pointer", fontFamily, transition: "all 0.12s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)", e.currentTarget.style.color = "#fca5a5")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,100,100,0.65)")}>
        <LogOut size={13} /> Sign Out
      </button>
      <div style={{ color: "rgba(255,255,255,0.15)", fontSize: 8.5, textAlign: "center", paddingTop: 6 }}>Municipality of San Juan, Batangas</div>
    </div>
  );

  const AdminDrawer = () => (
    <>
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50, width: 280, background: ADMIN_SIDEBAR_BG, borderLeft: "1px solid rgba(16,185,129,0.12)", boxShadow: "-6px 0 32px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column" }}>
        <div style={{ height: 4, background: ADMIN_GRAD, flexShrink: 0 }} />
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
  );

  return (
    <div style={{ minHeight: "100vh", background: rc.bg, fontFamily }}>
      <style>{`@media(min-width:1024px){.ac-mobile-only{display:none!important}}@media(max-width:1023px){.ac-desktop-only{display:none!important}}`}</style>
      {open && <AdminDrawer />}

      {/* Desktop layout */}
      <div className="ac-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{ width: 240, flexShrink: 0, background: ADMIN_SIDEBAR_BG, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
          <div style={{ height: 4, background: ADMIN_GRAD, flexShrink: 0 }} />
          <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
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
          <header style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", height: 56, padding: "0 24px", background: "rgba(255,255,255,0.96)", borderBottom: "1px solid #e8ecf0", boxShadow: "0 1px 8px rgba(15,110,86,0.06)", backdropFilter: "blur(8px)", flexShrink: 0 }}>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ background: rc.pale, border: `1px solid ${rc.border}`, color: rc.text, borderRadius: 20, padding: "3px 14px", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                Admin
              </span>
            </div>
          </header>
          <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: rc.bg }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Mobile header */}
      <header className="ac-mobile-only" style={{ position: "sticky", top: 0, zIndex: 40, background: "#fff", borderBottom: "1px solid #e8ecf0", boxShadow: "0 2px 8px rgba(15,110,86,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", height: 56 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: ADMIN_GRAD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11, color: "#fff" }}>PC</div>
          <div>
            <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
            <div style={{ color: rc.muted, fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Admin</div>
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#111827", fontSize: 12, fontWeight: 600 }}>{firstName}</div>
            <div style={{ color: rc.muted, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Admin</div>
          </div>
          <button onClick={() => setOpen(true)} style={{ background: rc.pale, border: `1px solid ${rc.border}`, borderRadius: 9, padding: "7px 9px", cursor: "pointer", display: "flex", color: rc.text }}>
            <Menu size={17} />
          </button>
        </div>
      </header>

      <div className="ac-mobile-only" style={{ background: rc.bg }}>
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
    </div>
  );
};

export default DashboardLayout;