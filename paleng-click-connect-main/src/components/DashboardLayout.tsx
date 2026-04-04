import { useState, useEffect } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CreditCard, QrCode, MessageSquare, Newspaper,
  FileBarChart, LogOut, Menu, X, Wallet, History, FileText, Store, Bell,
  Search, Receipt, Send, DollarSign, ChevronRight, type LucideIcon,
} from "lucide-react";
import PushNotificationBanner from "@/components/PushNotificationBanner";

interface NavItem { label: string; path: string; icon: LucideIcon; badge?: number }

const adminNav: NavItem[] = [
  { label: "Dashboard",       path: "/admin",               icon: LayoutDashboard },
  { label: "User Management", path: "/admin/users",         icon: Users           },
  { label: "Payments",        path: "/admin/payments",      icon: CreditCard      },
  { label: "QR Code",         path: "/admin/qr-codes",      icon: QrCode          },
  { label: "SMS",             path: "/admin/sms",           icon: MessageSquare   },
  { label: "News / Updates",  path: "/admin/news",          icon: Newspaper       },
  { label: "Reports",         path: "/admin/reports",       icon: FileBarChart    },
  { label: "Fee Schedules",   path: "/admin/fee-schedules", icon: DollarSign      },
];
const adminBottomNav: NavItem[] = [
  { label: "Home",     path: "/admin",          icon: LayoutDashboard },
  { label: "Users",    path: "/admin/users",    icon: Users           },
  { label: "Payments", path: "/admin/payments", icon: CreditCard      },
  { label: "Reports",  path: "/admin/reports",  icon: FileBarChart    },
  { label: "More",     path: "/admin/news",     icon: Newspaper       },
];
const vendorNav: NavItem[] = [
  { label: "Dashboard",       path: "/vendor",               icon: LayoutDashboard },
  { label: "Pay Online",      path: "/vendor/pay",           icon: Wallet          },
  { label: "Payment History", path: "/vendor/history",       icon: History         },
  { label: "Statement",       path: "/vendor/statement",     icon: FileText        },
  { label: "Stall Info",      path: "/vendor/stall",         icon: Store           },
  { label: "Notifications",   path: "/vendor/notifications", icon: Bell            },
  { label: "News",            path: "/vendor/news",          icon: Newspaper       },
];
const vendorBottomNav: NavItem[] = [
  { label: "Home",    path: "/vendor",               icon: LayoutDashboard },
  { label: "Pay",     path: "/vendor/pay",           icon: Wallet          },
  { label: "History", path: "/vendor/history",       icon: History         },
  { label: "Alerts",  path: "/vendor/notifications", icon: Bell            },
  { label: "More",    path: "/vendor/statement",     icon: FileText        },
];
const cashierNav: NavItem[] = [
  { label: "Dashboard",      path: "/cashier",         icon: LayoutDashboard },
  { label: "Accept Payment", path: "/cashier/accept",  icon: CreditCard      },
  { label: "Search Vendor",  path: "/cashier/search",  icon: Search          },
  { label: "Payment Status", path: "/cashier/status",  icon: Receipt         },
  { label: "Print SOA",      path: "/cashier/soa",     icon: FileText        },
  { label: "SMS Reminders",  path: "/cashier/sms",     icon: Send            },
  { label: "Reports",        path: "/cashier/reports", icon: FileBarChart    },
];
const cashierBottomNav: NavItem[] = [
  { label: "Home",    path: "/cashier",         icon: LayoutDashboard },
  { label: "Accept",  path: "/cashier/accept",  icon: CreditCard      },
  { label: "Search",  path: "/cashier/search",  icon: Search          },
  { label: "Status",  path: "/cashier/status",  icon: Receipt         },
  { label: "Reports", path: "/cashier/reports", icon: FileBarChart    },
];

interface DashboardLayoutProps { role: "admin" | "vendor" | "cashier"; }
const roleLabels = { admin: "Municipal Treasurer", vendor: "Vendor Portal", cashier: "Cashier Terminal" };

const ROLE_COLORS = {
  admin:   { solid: "#1e3a5f", light: "#2563eb", pale: "#eff6ff", border: "#bfdbfe", text: "#1e40af", bg: "#f8fafc", muted: "#64748b" },
  cashier: { solid: "#1a3a2e", light: "#059669", pale: "#ecfdf5", border: "#a7f3d0", text: "#065f46", bg: "#f8fafc", muted: "#6b7280" },
  vendor:  { solid: "#0d2240", light: "#2563eb", pale: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", bg: "#f1f5f9", muted: "#64748b" },
};

/* ─────────────────────────────────────────────────────────────
   VENDOR SIDEBAR DESIGN (new mockup design)
───────────────────────────────────────────────────────────── */
const VENDOR_SIDEBAR_BG  = "#0f172a"; // slate-900
const VENDOR_TOPNAV_BG   = "linear-gradient(160deg,#0d2240 0%,#1a3a5f 45%,#1d4ed8 80%,#2563eb 100%)";
const VENDOR_ACTIVE_BG   = "#1d4ed8"; // blue-700

const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [navReady, setNavReady] = useState(false);

  // Only show the bottom nav after the page content has had time to mount.
  // This prevents the nav from flashing on screen during the loading spinner phase.
  useEffect(() => {
    setNavReady(false);
    const t = setTimeout(() => setNavReady(true), 300);
    return () => clearTimeout(t);
  }, [location.pathname]);
  const { signOut, profile } = useAuth();

  const isVendor    = role === "vendor";
  const navItems    = role === "admin" ? adminNav    : isVendor ? vendorNav    : cashierNav;
  const bottomItems = role === "admin" ? adminBottomNav : isVendor ? vendorBottomNav : cashierBottomNav;

  const isActive    = (path: string) => location.pathname === path;
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : roleLabels[role];
  const firstName   = profile?.first_name ?? "";
  const initials    = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`;
  const handleLogout = async () => { await signOut(); navigate("/login"); };

  const rc = ROLE_COLORS[role];
  const fontFamily = isVendor
    ? "'Plus Jakarta Sans', system-ui, sans-serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  /* ── Vendor Sidebar Nav List ─────────────────────────────────────────────── */
  const VendorNavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{
        color: "rgba(255,255,255,0.3)", fontSize: 8.5, letterSpacing: 2.5,
        textTransform: "uppercase", padding: "14px 12px 6px",
      }}>Navigation</div>
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} onClick={onItemClick} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 12,
              background: active ? VENDOR_ACTIVE_BG : "transparent",
              color: active ? "#fff" : "rgba(255,255,255,0.55)",
              fontSize: 13, fontWeight: active ? 600 : 500,
              cursor: "pointer", transition: "all 0.12s", position: "relative",
            }}
              onMouseEnter={e => !active && ((e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={e => !active && ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
            >
              {active && (
                <div style={{
                  position: "absolute", left: 0, top: "25%", bottom: "25%",
                  width: 3, borderRadius: "0 3px 3px 0", background: "#60a5fa",
                  marginLeft: -12,
                }} />
              )}
              <item.icon size={15} color={active ? "#fff" : "rgba(255,255,255,0.55)"} style={{ flexShrink: 0, opacity: 0.9 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge ? (
                <span style={{
                  background: "#ef4444", color: "#fff",
                  fontSize: 9, fontWeight: 800,
                  padding: "2px 7px", borderRadius: 999,
                  minWidth: 18, textAlign: "center",
                }}>{item.badge}</span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  /* ── Vendor Bottom Mobile Nav ────────────────────────────────────────────── */
  const VendorBottomNav = () => {
    const [moreOpen, setMoreOpen] = useState(false);
    const primaryItems = bottomItems.slice(0, 4);
    const moreItems = navItems.filter(n => !primaryItems.find(p => p.path === n.path));

    return (
      <>
        {moreOpen && (
          <div onClick={() => setMoreOpen(false)} style={{
            position: "fixed", inset: 0, zIndex: 45,
            background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)",
          }} />
        )}
        {moreOpen && (
          <div style={{
            position: "fixed", bottom: 90, left: 12, right: 12, zIndex: 46,
            background: VENDOR_SIDEBAR_BG, borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)", overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 16px 8px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.3)", fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
            }}>More Navigation</div>
            {moreItems.map(item => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} onClick={() => setMoreOpen(false)} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px",
                    background: active ? VENDOR_ACTIVE_BG : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    color: active ? "#fff" : "rgba(255,255,255,0.7)",
                  }}>
                    <item.icon size={15} />
                    <span style={{ fontSize: 13, fontWeight: active ? 700 : 400 }}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
          padding: "8px 12px calc(8px + env(safe-area-inset-bottom,0px))",
          background: "linear-gradient(to top,rgba(15,23,42,0.98) 65%,transparent)",
          pointerEvents: "none",
        }}>
          <nav style={{
            display: "flex", alignItems: "center", justifyContent: "space-around",
            background: VENDOR_SIDEBAR_BG,
            borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            padding: "5px 6px", pointerEvents: "all",
          }}>
            {primaryItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} style={{ textDecoration: "none", flex: 1 }}>
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    padding: "5px 4px", borderRadius: 100, gap: 3,
                  }}>
                    <div style={{
                      width: active ? 36 : 28, height: active ? 36 : 28,
                      borderRadius: "50%",
                      background: active ? VENDOR_ACTIVE_BG : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                      boxShadow: active ? "0 2px 10px rgba(29,78,216,0.4)" : "none",
                    }}>
                      <item.icon size={active ? 16 : 15} color={active ? "#fff" : "rgba(255,255,255,0.45)"} />
                    </div>
                    <span style={{
                      color: active ? "#60a5fa" : "rgba(255,255,255,0.4)",
                      fontSize: 8.5, fontWeight: active ? 700 : 400, letterSpacing: 0.3,
                    }}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
            {moreItems.length > 0 && (
              <button onClick={() => setMoreOpen(v => !v)} style={{
                flex: 1, background: "none", border: "none", cursor: "pointer", padding: 0,
              }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "5px 4px", gap: 3,
                }}>
                  <div style={{
                    width: moreOpen ? 36 : 28, height: moreOpen ? 36 : 28,
                    borderRadius: "50%",
                    background: moreOpen ? VENDOR_ACTIVE_BG : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    <Menu size={moreOpen ? 16 : 15} color={moreOpen ? "#fff" : "rgba(255,255,255,0.45)"} />
                  </div>
                  <span style={{ color: moreOpen ? "#60a5fa" : "rgba(255,255,255,0.4)", fontSize: 8.5, fontWeight: moreOpen ? 700 : 400 }}>More</span>
                </div>
              </button>
            )}
          </nav>
        </div>
      </>
    );
  };

  /* ── Vendor Logout Footer ────────────────────────────────────────────────── */
  const VendorLogoutFooter = () => (
    <div style={{ padding: "12px 12px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <button onClick={handleLogout} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", borderRadius: 12,
        color: "rgba(255,100,100,0.7)", fontSize: 13, fontWeight: 600,
        background: "none", border: "none", cursor: "pointer", fontFamily,
        transition: "all 0.12s",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)", e.currentTarget.style.color = "#fca5a5")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent", e.currentTarget.style.color = "rgba(255,100,100,0.7)")}
      >
        <LogOut size={15} /> Logout
      </button>
      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textAlign: "center", paddingTop: 8 }}>
        Municipality of San Juan, Batangas
      </div>
    </div>
  );

  /* ── Vendor Mobile Drawer ────────────────────────────────────────────────── */
  const VendorDrawer = () => (
    <>
      <div onClick={() => setOpen(false)} style={{
        position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
      }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 280, background: VENDOR_SIDEBAR_BG,
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "-6px 0 24px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Brand header */}
        <div style={{
          padding: "16px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 13, color: "#fff", letterSpacing: -1,
            }}>PC</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} style={{
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex", color: "rgba(255,255,255,0.7)",
          }}>
            <X size={15} />
          </button>
        </div>
        {/* User pill */}
        <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 10px", borderRadius: 10,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg,#1a3a5f,#2563eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{initials}</span>
            </div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{displayName}</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
            </div>
          </div>
        </div>
        <VendorNavList onItemClick={() => setOpen(false)} />
        <VendorLogoutFooter />
      </div>
    </>
  );

  /* ════════════════════════════════════════════════════════════════════════════
     VENDOR LAYOUT — new dark sidebar design from mockup
  ════════════════════════════════════════════════════════════════════════════ */
  if (isVendor) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily }}>
        <style>{`
          @media (min-width: 1024px) { .v-mobile-only { display: none !important; } }
          @media (max-width: 1023px) { .v-desktop-only { display: none !important; } }
          * { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }
        `}</style>

        {open && <VendorDrawer />}

        {/* ── MOBILE HEADER ──────────────────────────────────────────────── */}
        <header className="v-mobile-only" style={{
          position: "sticky", top: 0, zIndex: 40,
          background: VENDOR_TOPNAV_BG,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", height: 64,
          boxShadow: "0 2px 12px rgba(13,34,64,0.35)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 900, fontSize: 13, color: "#fff", letterSpacing: -1,
            }}>PC</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: 0.3 }}>PALENG-CLICK</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div>
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "6px 12px 6px 6px", borderRadius: 10,
            background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(135deg,#1a3a5f,#2563eb)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{initials}</span>
            </div>
            <div>
              <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{firstName}</div>
              <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
            </div>
          </div>
        </header>

        {/* ── DESKTOP LAYOUT ─────────────────────────────────────────────── */}
        <div className="v-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
          {/* Sidebar */}
          <aside style={{
            width: 240, flexShrink: 0, background: VENDOR_SIDEBAR_BG,
            display: "flex", flexDirection: "column",
            position: "sticky", top: 0, height: "100vh",
          }}>
            {/* Top nav bar */}
            <div style={{
              height: 64, background: VENDOR_TOPNAV_BG,
              display: "flex", alignItems: "center",
              padding: "0 16px", gap: 10, flexShrink: 0,
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: 13, color: "#fff", letterSpacing: -1, flexShrink: 0,
              }}>PC</div>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: 0.3 }}>PALENG-CLICK</div>
                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div>
              </div>
            </div>
            <VendorNavList />
            <VendorLogoutFooter />
          </aside>

          {/* Main area */}
          <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
            {/* Desktop top bar */}
            <header style={{
              height: 64, background: VENDOR_TOPNAV_BG,
              display: "flex", alignItems: "center", padding: "0 24px",
              gap: 16, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.07)",
              position: "sticky", top: 0, zIndex: 30,
            }}>
              <div style={{ flex: 1 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Link to="/vendor/notifications" style={{ textDecoration: "none" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "rgba(255,255,255,0.7)", cursor: "pointer",
                  }}>
                    <Bell size={16} />
                  </div>
                </Link>
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 12px 6px 6px", borderRadius: 10,
                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.1)",
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: "linear-gradient(135deg,#1a3a5f,#2563eb)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <span style={{ color: "#fff", fontWeight: 800, fontSize: 11 }}>{initials}</span>
                  </div>
                  <div>
                    <div style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{displayName}</div>
                    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
                  </div>
                </div>
              </div>
            </header>

            <main style={{ flex: 1, overflowY: "auto", background: "#f1f5f9" }}>
              <PushNotificationBanner />
              <Outlet />
            </main>
          </div>
        </div>

        {/* ── MOBILE CONTENT ─────────────────────────────────────────────── */}
        <div className="v-mobile-only" style={{ paddingBottom: 96 }}>
          <div style={{ padding: "16px" }}>
            <Outlet />
          </div>
        </div>

        {/* ── MOBILE BOTTOM NAV — only render after content has mounted ── */}
        {navReady && (
          <div className="v-mobile-only">
            <VendorBottomNav />
          </div>
        )}
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════════
     ADMIN / CASHIER — unchanged design
  ════════════════════════════════════════════════════════════════════════════ */
  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
      <div style={{ color: "#9ca3af", fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "2px 8px 10px" }}>Navigation</div>
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <Link key={item.path} to={item.path} onClick={onItemClick} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 9, marginBottom: 1,
              background: active ? rc.pale : "transparent",
              border: active ? `1px solid ${rc.border}` : "1px solid transparent",
              cursor: "pointer", transition: "background 0.12s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: active ? rc.pale : "#f5f5f5",
                  border: active ? `1px solid ${rc.border}` : "1px solid transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <item.icon size={13} color={active ? rc.text : "#6b7280"} />
                </div>
                <span style={{ color: active ? rc.text : "#374151", fontSize: 12.5, fontWeight: active ? 700 : 400 }}>
                  {item.label}
                </span>
              </div>
              {active
                ? <div style={{ width: 5, height: 5, borderRadius: "50%", background: rc.light, flexShrink: 0 }} />
                : <ChevronRight size={12} color="#d1d5db" />}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const UserPill = ({ size = 30 }: { size?: number }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: rc.pale, border: `1px solid ${rc.border}`, borderRadius: 10, padding: "9px 11px",
    }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg,${rc.solid},${rc.light})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: size * 0.37 }}>{initials}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: "#111827", fontWeight: 600, fontSize: 12 }}>{displayName}</div>
        <div style={{ color: rc.text, fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
          {roleLabels[role]}
        </div>
      </div>
    </div>
  );

  const LogoutFooter = () => (
    <div style={{ padding: "10px 10px 20px", borderTop: "1px solid #f0f2f5" }}>
      <button onClick={handleLogout} style={{
        width: "100%", display: "flex", alignItems: "center", gap: 8,
        background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10,
        padding: "10px 14px", cursor: "pointer", color: "#dc2626", fontSize: 13, fontFamily,
      }}>
        <LogOut size={14} /> Logout
      </button>
      <div style={{ color: "#d1d5db", fontSize: 9, textAlign: "center", marginTop: 10 }}>
        © 2026 Municipality of San Juan, Batangas
      </div>
    </div>
  );



  const Drawer = () => (
    <>
      <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49, background: "rgba(0,0,0,0.3)", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 288, background: "#fff", borderLeft: `1px solid ${rc.border}`,
        boxShadow: "-6px 0 24px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column",
      }}>
        <div style={{ height: 4, background: `linear-gradient(90deg,${rc.solid},${rc.light})` }} />
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", border: `1px solid ${rc.border}` }}>
              <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>PALENG-CLICK</div>
              <div style={{ color: "#9ca3af", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} style={{
            background: rc.pale, border: `1px solid ${rc.border}`, borderRadius: 7,
            padding: "5px 7px", cursor: "pointer", display: "flex", color: rc.text,
          }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid #f0f2f5" }}>
          <UserPill size={34} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 11px", borderRadius: 10, marginBottom: 2,
                  background: active ? rc.pale : "transparent",
                  border: active ? `1px solid ${rc.border}` : "1px solid transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: active ? rc.pale : "#f5f5f4",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <item.icon size={14} color={active ? rc.text : "#6b7280"} />
                    </div>
                    <span style={{ color: active ? rc.text : "#374151", fontSize: 13, fontWeight: active ? 700 : 400 }}>{item.label}</span>
                  </div>
                  <ChevronRight size={12} color={active ? rc.text : "#d1d5db"} />
                </div>
              </Link>
            );
          })}
        </div>
        <LogoutFooter />
      </div>
    </>
  );

  return (
    <div style={{ minHeight: "100vh", background: rc.bg, fontFamily }}>
      <style>{`
        @media (min-width: 1024px) { .ac-mobile-only { display: none !important; } }
        @media (max-width: 1023px) { .ac-desktop-only { display: none !important; } }
      `}</style>
      {open && <Drawer />}
      <div className="ac-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{
          width: 252, flexShrink: 0, background: "#fff", borderRight: "1px solid #e8ecf0",
          display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh",
        }}>
          <div style={{ height: 4, background: `linear-gradient(90deg,${rc.solid},${rc.light})`, flexShrink: 0 }} />
          <div style={{ padding: "16px 16px 13px", borderBottom: "1px solid #f0f2f5", flexShrink: 0 }}>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", marginBottom: 13 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", border: "1px solid #e8ecf0", flexShrink: 0 }}>
                <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              <div>
                <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
                <div style={{ color: "#9ca3af", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
              </div>
            </Link>
            <UserPill />
          </div>
          <NavList />
          <LogoutFooter />
        </aside>
        <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
          <header style={{
            position: "sticky", top: 0, zIndex: 30,
            display: "flex", alignItems: "center", height: 52, padding: "0 24px",
            background: "rgba(255,255,255,0.96)", borderBottom: "1px solid #e8ecf0",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)", backdropFilter: "blur(8px)", flexShrink: 0,
          }}>
            <div style={{ flex: 1 }} />
            <span style={{
              background: rc.pale, border: `1px solid ${rc.border}`, color: rc.text,
              borderRadius: 20, padding: "3px 14px", fontSize: 11, fontWeight: 600,
              letterSpacing: 0.5, textTransform: "capitalize",
            }}>{role}</span>
          </header>
          <main style={{ flex: 1, overflowY: "auto", padding: "28px", background: rc.bg }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <header className="ac-mobile-only" style={{
        position: "sticky", top: 0, zIndex: 40, background: "#fff", borderBottom: "1px solid #e8ecf0",
        boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 16px", height: 56,
      }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, overflow: "hidden", border: "1px solid #e8ecf0", flexShrink: 0 }}>
            <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          </div>
          <div>
            <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, letterSpacing: 0.4 }}>PALENG-CLICK</div>
            <div style={{ color: rc.muted, fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>{role === "admin" ? "Admin" : "Cashier"}</div>
          </div>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#111827", fontSize: 12, fontWeight: 600 }}>{firstName}</div>
            <div style={{ color: rc.muted, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>{role}</div>
          </div>
          <button onClick={() => setOpen(true)} style={{
            background: rc.pale, border: `1px solid ${rc.border}`,
            borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex", color: rc.text,
          }}>
            <Menu size={17} />
          </button>
        </div>
      </header>
      <div className="ac-mobile-only" style={{ paddingBottom: 96, background: rc.bg }}>
        <div style={{ padding: "16px" }}><Outlet /></div>
      </div>

    </div>
  );
};

export default DashboardLayout;
