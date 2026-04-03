import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CreditCard, QrCode, MessageSquare, Newspaper,
  FileBarChart, LogOut, Menu, X, Wallet, History, FileText, Store, Bell,
  Search, Receipt, Send, DollarSign, ChevronRight, type LucideIcon,
} from "lucide-react";
import PushNotificationBanner from "@/components/PushNotificationBanner";

interface NavItem { label: string; path: string; icon: LucideIcon; }

// ── Nav definitions ──────────────────────────────────────────────────────────
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

// ── Colour palettes ───────────────────────────────────────────────────────────
const V = {
  green:     "#2d6a4f",
  greenLt:   "#40916c",
  greenPale: "#d8f3dc",
  greenBg:   "#e8f5e9",
  text:      "#1c2b1c",
  muted:     "#6b7c6b",
  border:    "#e2ddd6",
  bg:        "#f9f6f1",
};

const ROLE_COLORS = {
  admin:   { solid: "#1e3a5f", light: "#2563eb", pale: "#eff6ff", border: "#bfdbfe", text: "#1e40af", bg: "#f8fafc", muted: "#64748b" },
  cashier: { solid: "#1a3a2e", light: "#059669", pale: "#ecfdf5", border: "#a7f3d0", text: "#065f46", bg: "#f8fafc", muted: "#6b7280" },
  vendor:  { solid: V.green,   light: V.greenLt, pale: V.greenBg, border: "#c8e6c9",  text: V.green,  bg: V.bg,     muted: V.muted  },
};

// ════════════════════════════════════════════════════════════════════════════
const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location    = useLocation();
  const navigate    = useNavigate();
  const [open, setOpen] = useState(false);
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
    ? "Georgia, 'Times New Roman', serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

  // ── Shared: Sidebar nav list ─────────────────────────────────────────────
  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
      <div style={{
        color: isVendor ? V.muted : "#9ca3af",
        fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase",
        padding: "2px 8px 10px",
      }}>Navigation</div>
      {navItems.map((item) => {
        const active = isActive(item.path);
        const accent = isVendor ? V.green    : rc.text;
        const pale   = isVendor ? V.greenBg  : rc.pale;
        const bdr    = isVendor ? "#c8e6c9"  : rc.border;
        const iconPale = isVendor ? V.greenPale : rc.pale;
        return (
          <Link key={item.path} to={item.path} onClick={onItemClick} style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 10px", borderRadius: 9, marginBottom: 1,
              background: active ? pale : "transparent",
              border: active ? `1px solid ${bdr}` : "1px solid transparent",
              cursor: "pointer", transition: "background 0.12s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: active ? iconPale : "#f5f5f5",
                  border: active ? `1px solid ${bdr}` : "1px solid transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <item.icon size={13} color={active ? accent : (isVendor ? V.muted : "#6b7280")} />
                </div>
                <span style={{ color: active ? accent : (isVendor ? V.text : "#374151"), fontSize: 12.5, fontWeight: active ? 700 : 400 }}>
                  {item.label}
                </span>
              </div>
              {active
                ? <div style={{ width: 5, height: 5, borderRadius: "50%", background: isVendor ? V.green : rc.light, flexShrink: 0 }} />
                : <ChevronRight size={12} color="#d1d5db" />
              }
            </div>
          </Link>
        );
      })}
    </nav>
  );

  // ── Shared: User pill ────────────────────────────────────────────────────
  const UserPill = ({ size = 30 }: { size?: number }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      background: isVendor ? V.greenBg : rc.pale,
      border: `1px solid ${isVendor ? "#c8e6c9" : rc.border}`,
      borderRadius: 10, padding: "9px 11px",
    }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, ${isVendor ? V.green : rc.solid}, ${isVendor ? V.greenLt : rc.light})`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: size * 0.37 }}>{initials}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: isVendor ? V.text : "#111827", fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
        <div style={{ color: isVendor ? V.green : rc.text, fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>
          {isVendor ? "Vendor" : roleLabels[role]}
        </div>
      </div>
    </div>
  );

  // ── Shared: Bottom mobile tab bar with "More" sheet ─────────────────────
  const BottomNav = () => {
    const [moreOpen, setMoreOpen] = useState(false);
    // First 4 items are always shown; rest go in the "More" sheet
    const primaryItems = bottomItems.slice(0, 4);
    // All nav items not in the first 4 primary slots
    const moreItems = navItems.filter(n => !primaryItems.find(p => p.path === n.path));
    const accent = isVendor ? V.green : rc.light;
    const muted  = isVendor ? V.muted : rc.muted;

    return (
      <>
        {/* More sheet backdrop */}
        {moreOpen && (
          <div
            onClick={() => setMoreOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 45,
              background: "rgba(0,0,0,0.25)", backdropFilter: "blur(2px)",
            }}
          />
        )}

        {/* More sheet panel */}
        {moreOpen && (
          <div style={{
            position: "fixed", bottom: 90, left: 12, right: 12, zIndex: 46,
            background: "#fff",
            borderRadius: 18,
            border: `1px solid ${isVendor ? V.border : "#e2e8f0"}`,
            boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "10px 16px 8px",
              borderBottom: `1px solid ${isVendor ? V.border : "#f0f2f5"}`,
              color: isVendor ? V.muted : "#9ca3af",
              fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
            }}>More Navigation</div>
            {moreItems.map(item => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} onClick={() => setMoreOpen(false)} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 16px",
                    background: active ? (isVendor ? V.greenBg : rc.pale) : "transparent",
                    borderBottom: `1px solid ${isVendor ? V.border : "#f5f5f5"}`,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                      background: active ? (isVendor ? V.green : rc.solid) : (isVendor ? V.greenBg : rc.pale),
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <item.icon size={14} color={active ? "#fff" : (isVendor ? V.green : rc.text)} />
                    </div>
                    <span style={{
                      color: active ? (isVendor ? V.green : rc.text) : (isVendor ? V.text : "#374151"),
                      fontSize: 13, fontWeight: active ? 700 : 400,
                    }}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* The fixed bottom pill nav */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
          padding: "8px 12px calc(8px + env(safe-area-inset-bottom, 0px))",
          background: isVendor
            ? "linear-gradient(to top, rgba(249,246,241,0.98) 65%, transparent)"
            : "linear-gradient(to top, rgba(248,250,252,0.98) 65%, transparent)",
          pointerEvents: "none",
        }}>
          <nav style={{
            display: "flex", alignItems: "center", justifyContent: "space-around",
            background: "#ffffff",
            borderRadius: 100,
            border: `1px solid ${isVendor ? V.border : "#e2e8f0"}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)",
            padding: "5px 6px",
            pointerEvents: "all",
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
                      background: active ? (isVendor ? V.green : rc.solid) : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.2s",
                      boxShadow: active ? `0 2px 10px ${isVendor ? "rgba(45,106,79,0.3)" : rc.solid + "44"}` : "none",
                    }}>
                      <item.icon size={active ? 16 : 15} color={active ? "#fff" : muted} />
                    </div>
                    <span style={{
                      color: active ? accent : muted,
                      fontSize: 8.5, fontWeight: active ? 700 : 400,
                      letterSpacing: 0.3, lineHeight: 1,
                    }}>{item.label}</span>
                  </div>
                </Link>
              );
            })}

            {/* More button — opens sheet */}
            {moreItems.length > 0 && (
              <button
                onClick={() => setMoreOpen(v => !v)}
                style={{
                  flex: 1, background: "none", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "5px 4px", borderRadius: 100, gap: 3,
                }}>
                  <div style={{
                    width: moreOpen ? 36 : 28, height: moreOpen ? 36 : 28,
                    borderRadius: "50%",
                    background: moreOpen ? (isVendor ? V.green : rc.solid) : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                  }}>
                    <Menu size={moreOpen ? 16 : 15} color={moreOpen ? "#fff" : muted} />
                  </div>
                  <span style={{
                    color: moreOpen ? accent : muted,
                    fontSize: 8.5, fontWeight: moreOpen ? 700 : 400,
                    letterSpacing: 0.3, lineHeight: 1,
                  }}>More</span>
                </div>
              </button>
            )}
          </nav>
        </div>
      </>
    );
  };

  // ── Shared: Logout footer ────────────────────────────────────────────────
  const LogoutFooter = () => (
    <div style={{ padding: "10px 8px 16px", borderTop: `1px solid ${isVendor ? V.border : "#f0f2f5"}`, flexShrink: 0 }}>
      <div style={{ color: "#d1d5db", fontSize: 9, textAlign: "center", marginBottom: 8 }}>
        Municipality of San Juan, Batangas
      </div>
      <button onClick={handleLogout} style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        background: "#fff5f5", border: "1px solid #fecaca",
        borderRadius: 9, padding: "9px", cursor: "pointer", color: "#dc2626", fontSize: 12,
        fontFamily,
      }}>
        <LogOut size={13} /> Logout
      </button>
    </div>
  );

  // ── Shared: Mobile drawer ────────────────────────────────────────────────
  const Drawer = () => (
    <>
      {/* Backdrop */}
      <div onClick={() => setOpen(false)} style={{
        position: "fixed", inset: 0, zIndex: 49,
        background: "rgba(0,0,0,0.3)", backdropFilter: "blur(3px)",
      }} />
      {/* Panel slides from right */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 288, background: "#fff",
        borderLeft: `1px solid ${isVendor ? V.border : "#e2e8f0"}`,
        boxShadow: "-6px 0 24px rgba(0,0,0,0.08)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Colour strip */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${isVendor ? V.green : rc.solid}, ${isVendor ? V.greenLt : rc.light})` }} />

        {/* Drawer header */}
        <div style={{
          padding: "14px 16px 12px",
          borderBottom: `1px solid ${isVendor ? V.border : "#f0f2f5"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", border: `1px solid ${isVendor ? V.border : "#e2e8f0"}` }}>
              <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>PALENG-CLICK</div>
              <div style={{ color: isVendor ? V.muted : "#9ca3af", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
            </div>
          </div>
          <button onClick={() => setOpen(false)} style={{
            background: isVendor ? V.greenBg : rc.pale,
            border: `1px solid ${isVendor ? "#c8e6c9" : rc.border}`,
            borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex",
            color: isVendor ? V.green : rc.text,
          }}>
            <X size={15} />
          </button>
        </div>

        {/* User pill */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${isVendor ? V.border : "#f0f2f5"}` }}>
          <UserPill size={34} />
        </div>

        {/* Nav */}
        <div style={{ padding: "4px 8px 2px 8px" }}>
          <div style={{ color: isVendor ? V.muted : "#9ca3af", fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "8px 2px 4px" }}>Menu</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
          {navItems.map((item) => {
            const active = isActive(item.path);
            const accent  = isVendor ? V.green   : rc.text;
            const pale    = isVendor ? V.greenBg  : rc.pale;
            const bdr     = isVendor ? "#c8e6c9"  : rc.border;
            const iconPale= isVendor ? V.greenPale: rc.pale;
            return (
              <Link key={item.path} to={item.path} onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 11px", borderRadius: 10, marginBottom: 2,
                  background: active ? pale : "transparent",
                  border: active ? `1px solid ${bdr}` : "1px solid transparent",
                  cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: active ? iconPale : "#f5f5f4",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <item.icon size={14} color={active ? accent : (isVendor ? V.muted : "#6b7280")} />
                    </div>
                    <span style={{ color: active ? accent : (isVendor ? V.text : "#374151"), fontSize: 13, fontWeight: active ? 700 : 400 }}>
                      {item.label}
                    </span>
                  </div>
                  <ChevronRight size={12} color={active ? accent : "#d1d5db"} />
                </div>
              </Link>
            );
          })}
        </div>

        <div style={{ padding: "10px 10px 20px", borderTop: `1px solid ${isVendor ? V.border : "#f0f2f5"}` }}>
          <button onClick={handleLogout} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: "#fff5f5", border: "1px solid #fecaca",
            borderRadius: 10, padding: "11px", cursor: "pointer", color: "#dc2626", fontSize: 13,
            fontFamily,
          }}>
            <LogOut size={14} /> Logout
          </button>
          <div style={{ color: "#d1d5db", fontSize: 9, textAlign: "center", marginTop: 12 }}>
            © 2026 Municipality of San Juan, Batangas
          </div>
        </div>
      </div>
    </>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // VENDOR — warm ivory design
  // ════════════════════════════════════════════════════════════════════════════
  if (isVendor) {
    return (
      <div style={{ minHeight: "100vh", background: V.bg, fontFamily }}>
        <style>{`
          @media (min-width: 1024px) {
            .v-mobile-only { display: none !important; }
          }
          @media (max-width: 1023px) {
            .v-desktop-only { display: none !important; }
          }
        `}</style>

        {/* ── MOBILE HEADER — hidden: VendorMobileShell in each page handles this ── */}
        <header className="v-mobile-only" style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "#fff", borderBottom: `1px solid ${V.border}`,
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          display: "none",
          alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", height: 56,
        }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, overflow: "hidden", border: `1px solid ${V.border}`, flexShrink: 0 }}>
              <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ color: V.text, fontWeight: 700, fontSize: 13, letterSpacing: 0.4 }}>PALENG-CLICK</div>
              <div style={{ color: V.muted, fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div>
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: V.text, fontSize: 12, fontWeight: 600 }}>{firstName}</div>
              <div style={{ color: V.muted, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
            </div>
            <button onClick={() => setOpen(true)} style={{
              background: V.greenBg, border: "1px solid #c8e6c9",
              borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex", color: V.green,
            }}>
              <Menu size={17} />
            </button>
          </div>
        </header>

        {/* Mobile drawer */}
        {open && <Drawer />}

        {/* ── DESKTOP ────────────────────────────────────────────────────── */}
        <div className="v-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{
            width: 252, flexShrink: 0, background: "#ffffff",
            borderRight: `1px solid ${V.border}`,
            display: "flex", flexDirection: "column",
            position: "sticky", top: 0, height: "100vh",
          }}>
            <div style={{ height: 4, background: `linear-gradient(90deg, ${V.green}, ${V.greenLt})` }} />
            <div style={{ padding: "18px 16px 14px", borderBottom: `1px solid ${V.border}` }}>
              <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 14 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, overflow: "hidden", border: `1px solid ${V.border}` }}>
                  <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div>
                  <div style={{ color: V.text, fontWeight: 700, fontSize: 13, letterSpacing: 0.4 }}>PALENG-CLICK</div>
                  <div style={{ color: V.muted, fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
                </div>
              </Link>
              <UserPill />
            </div>
            <NavList />
            <LogoutFooter />
          </aside>
          <main style={{ flex: 1, minWidth: 0, overflowY: "auto", background: V.bg }}>
            <div style={{ padding: "28px", maxWidth: 1100, margin: "0 auto" }}>
              <div style={{ marginBottom: 16 }}><PushNotificationBanner /></div>
              <Outlet />
            </div>
          </main>
        </div>

        {/* ── MOBILE CONTENT — no extra padding, VendorMobileShell wraps each page ── */}
        <div className="v-mobile-only" style={{ paddingBottom: 0, background: V.bg }}>
          <div style={{ padding: "0" }}>
            <Outlet />
          </div>
        </div>

        {/* ── MOBILE BOTTOM TAB — hidden: VendorMobileShell handles this ── */}
        <div className="v-mobile-only" style={{ display: "none" }}>
          <BottomNav />
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN / CASHIER — shared design with role-specific palette
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: rc.bg, fontFamily }}>
      <style>{`
        @media (min-width: 1024px) {
          .ac-mobile-only { display: none !important; }
        }
        @media (max-width: 1023px) {
          .ac-desktop-only { display: none !important; }
        }
      `}</style>

      {/* Mobile drawer */}
      {open && <Drawer />}

      {/* ── DESKTOP LAYOUT ───────────────────────────────────────────────── */}
      <div className="ac-desktop-only" style={{ display: "flex", minHeight: "100vh" }}>
        <aside style={{
          width: 252, flexShrink: 0, background: "#ffffff",
          borderRight: "1px solid #e8ecf0",
          display: "flex", flexDirection: "column",
          position: "sticky", top: 0, height: "100vh",
        }}>
          {/* Colour strip */}
          <div style={{ height: 4, background: `linear-gradient(90deg, ${rc.solid}, ${rc.light})`, flexShrink: 0 }} />

          {/* Brand */}
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

        {/* Desktop main — NO hamburger in header on desktop */}
        <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>
          <header style={{
            position: "sticky", top: 0, zIndex: 30,
            display: "flex", alignItems: "center",
            height: 52, padding: "0 24px",
            background: "rgba(255,255,255,0.96)",
            borderBottom: "1px solid #e8ecf0",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            backdropFilter: "blur(8px)",
            flexShrink: 0,
          }}>
            <div style={{ flex: 1 }} />
            <span style={{
              background: rc.pale, border: `1px solid ${rc.border}`,
              color: rc.text, borderRadius: 20,
              padding: "3px 14px", fontSize: 11, fontWeight: 600,
              letterSpacing: 0.5, textTransform: "capitalize",
            }}>
              {role}
            </span>
          </header>
          <main style={{ flex: 1, overflowY: "auto", padding: "28px", background: rc.bg }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* ── MOBILE HEADER ────────────────────────────────────────────────── */}
      <header className="ac-mobile-only" style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "#fff", borderBottom: "1px solid #e8ecf0",
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
          {/* Hamburger ONLY on mobile */}
          <button onClick={() => setOpen(true)} style={{
            background: rc.pale, border: `1px solid ${rc.border}`,
            borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex", color: rc.text,
          }}>
            <Menu size={17} />
          </button>
        </div>
      </header>

      {/* ── MOBILE CONTENT ───────────────────────────────────────────────── */}
      <div className="ac-mobile-only" style={{ paddingBottom: 96, background: rc.bg }}>
        <div style={{ padding: "16px" }}>
          <Outlet />
        </div>
      </div>

      {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────────────────── */}
      <div className="ac-mobile-only">
        <BottomNav />
      </div>
    </div>
  );
};

export default DashboardLayout;