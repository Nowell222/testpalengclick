import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CreditCard, QrCode, MessageSquare, Newspaper,
  FileBarChart, LogOut, Menu, X, Wallet, History, FileText, Store, Bell,
  Search, Receipt, Send, ChevronRight, Calendar, type LucideIcon,
} from "lucide-react";

interface NavItem { label: string; path: string; icon: LucideIcon; }

const adminNav: NavItem[] = [
  { label: "Dashboard",       path: "/admin",                icon: LayoutDashboard },
  { label: "User Management", path: "/admin/users",          icon: Users           },
  { label: "Payments",        path: "/admin/payments",       icon: CreditCard      },
  { label: "Fee Schedules",   path: "/admin/fee-schedules",  icon: Calendar        },
  { label: "QR Code",         path: "/admin/qr-codes",       icon: QrCode          },
  { label: "SMS",             path: "/admin/sms",            icon: MessageSquare   },
  { label: "News / Updates",  path: "/admin/news",           icon: Newspaper       },
  { label: "Reports",         path: "/admin/reports",        icon: FileBarChart    },
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

interface DashboardLayoutProps { role: "admin" | "vendor" | "cashier"; }
const roleLabels = { admin: "Municipal Treasurer", vendor: "Vendor Portal", cashier: "Cashier" };

// ── Palette ───────────────────────────────────────────────────────────────────
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
  admin:   { solid: "#1e3a5f", light: "#2563eb", pale: "#eff6ff", border: "#bfdbfe", text: "#1e40af" },
  cashier: { solid: "#1a3a2e", light: "#059669", pale: "#ecfdf5", border: "#a7f3d0", text: "#065f46" },
  vendor:  { solid: V.green,   light: V.greenLt, pale: V.greenBg, border: "#c8e6c9",  text: V.green  },
};

// ── Reusable sidebar nav items ────────────────────────────────────────────────
const SidebarNavItem = ({ item, active, rc, onClick }: { item: NavItem; active: boolean; rc: typeof ROLE_COLORS.admin; onClick?: () => void }) => (
  <Link to={item.path} onClick={onClick} style={{ textDecoration: "none" }}>
    <div style={{
      display: "flex", alignItems: "center", gap: 9,
      padding: "8px 10px", borderRadius: 9, marginBottom: 1,
      background: active ? rc.pale : "transparent",
      border: active ? `1px solid ${rc.border}` : "1px solid transparent",
      cursor: "pointer", transition: "background 0.12s",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: active ? rc.pale : "#f5f5f5",
        border: active ? `1px solid ${rc.border}` : "1px solid transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <item.icon size={13} color={active ? rc.text : "#6b7280"} />
      </div>
      <span style={{ color: active ? rc.text : "#374151", fontSize: 12.5, fontWeight: active ? 700 : 400, flex: 1 }}>
        {item.label}
      </span>
      {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: rc.light, flexShrink: 0 }} />}
    </div>
  </Link>
);

const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { signOut, profile } = useAuth();

  const navItems    = role === "admin" ? adminNav : role === "vendor" ? vendorNav : cashierNav;
  const isActive    = (path: string) => location.pathname === path;
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : roleLabels[role];
  const initials    = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`;
  const handleLogout = async () => { await signOut(); navigate("/login"); };
  const rc = ROLE_COLORS[role];

  // ════════════════════════════════════════════════════════════════════════════
  // VENDOR — warm ivory, light green, mobile-first
  // ════════════════════════════════════════════════════════════════════════════
  if (role === "vendor") {
    return (
      <div style={{ minHeight: "100vh", background: V.bg, fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <style>{`
          @media (min-width: 1024px) {
            #v-mhdr { display: none !important; }
            #v-mcnt { display: none !important; }
            #v-bnav { display: none !important; }
          }
          @media (max-width: 1023px) {
            #v-desk { display: none !important; }
          }
          .vn-item:hover { background: ${V.greenBg} !important; }
        `}</style>

        {/* ── MOBILE HEADER ────────────────────────────────────────────── */}
        <header id="v-mhdr" style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "#fff", borderBottom: `1px solid ${V.border}`,
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
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
              <div style={{ color: V.text, fontSize: 12, fontWeight: 600 }}>{profile?.first_name}</div>
              <div style={{ color: V.muted, fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
            </div>
            <button onClick={() => setOpen(true)} style={{
              background: V.greenBg, border: `1px solid #c8e6c9`,
              borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex", color: V.green,
            }}>
              <Menu size={17} />
            </button>
          </div>
        </header>

        {/* ── VENDOR MOBILE DRAWER ─────────────────────────────────────── */}
        {open && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50 }}>
            <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(20,40,20,0.3)", backdropFilter: "blur(3px)" }} />
            <div style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: 288,
              background: "#fff", borderLeft: `1px solid ${V.border}`,
              boxShadow: "-6px 0 24px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column",
            }}>
              <div style={{ height: 4, background: `linear-gradient(90deg, ${V.green}, ${V.greenLt})` }} />
              <div style={{ padding: "16px 18px 13px", borderBottom: `1px solid ${V.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, overflow: "hidden", border: `1px solid ${V.border}` }}>
                    <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div>
                    <div style={{ color: V.text, fontWeight: 700, fontSize: 13 }}>PALENG-CLICK</div>
                    <div style={{ color: V.muted, fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: V.greenBg, border: `1px solid #c8e6c9`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", color: V.green }}>
                  <X size={15} />
                </button>
              </div>
              <div style={{ padding: "12px 16px", borderBottom: `1px solid ${V.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: V.greenBg, border: "1px solid #c8e6c9", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${V.green}, ${V.greenLt})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{initials}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: V.text, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                    <div style={{ color: V.green, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>Vendor</div>
                  </div>
                </div>
              </div>
              <nav style={{ flex: 1, overflowY: "auto", padding: "10px 10px" }}>
                <div style={{ color: V.muted, fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "4px 8px 10px" }}>Menu</div>
                {vendorNav.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>
                      <div className="vn-item" style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 11px", borderRadius: 10, marginBottom: 2,
                        background: active ? V.greenBg : "transparent",
                        border: active ? "1px solid #c8e6c9" : "1px solid transparent", cursor: "pointer",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: active ? V.greenPale : "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <item.icon size={14} color={active ? V.green : V.muted} />
                          </div>
                          <span style={{ color: active ? V.green : V.text, fontSize: 13, fontWeight: active ? 700 : 400 }}>{item.label}</span>
                        </div>
                        <ChevronRight size={12} color={active ? V.green : "#d1d5db"} />
                      </div>
                    </Link>
                  );
                })}
              </nav>
              <div style={{ padding: "10px 10px 20px", borderTop: `1px solid ${V.border}` }}>
                <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 10, padding: "11px", cursor: "pointer", color: "#dc2626", fontSize: 13, fontFamily: "inherit" }}>
                  <LogOut size={14} /> Logout
                </button>
                <div style={{ color: "#d1d5db", fontSize: 9, textAlign: "center", marginTop: 12 }}>© 2026 Municipality of San Juan, Batangas</div>
              </div>
            </div>
          </div>
        )}

        {/* ── DESKTOP SIDEBAR + CONTENT ─────────────────────────────────── */}
        <div id="v-desk" style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: 252, flexShrink: 0, background: "#fff", borderRight: `1px solid ${V.border}`, display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: V.greenBg, border: "1px solid #c8e6c9", borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${V.green}, ${V.greenLt})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 12 }}>{initials}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: V.text, fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                  <div style={{ color: V.green, fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>Vendor</div>
                </div>
              </div>
            </div>
            <nav style={{ flex: 1, overflowY: "auto", padding: "10px 8px" }}>
              <div style={{ color: V.muted, fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "2px 8px 10px" }}>Navigation</div>
              {vendorNav.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link key={item.path} to={item.path} style={{ textDecoration: "none" }}>
                    <div className="vn-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 9, marginBottom: 1, background: active ? V.greenBg : "transparent", border: active ? "1px solid #c8e6c9" : "1px solid transparent", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: active ? V.greenPale : "#f5f5f4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <item.icon size={13} color={active ? V.green : V.muted} />
                        </div>
                        <span style={{ color: active ? V.green : V.text, fontSize: 12.5, fontWeight: active ? 700 : 400 }}>{item.label}</span>
                      </div>
                      {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: V.green, flexShrink: 0 }} />}
                    </div>
                  </Link>
                );
              })}
            </nav>
            <div style={{ padding: "10px 8px 16px", borderTop: `1px solid ${V.border}` }}>
              <div style={{ color: "#d1d5db", fontSize: 9, textAlign: "center", marginBottom: 8 }}>Municipality of San Juan, Batangas</div>
              <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 9, padding: "9px", cursor: "pointer", color: "#dc2626", fontSize: 12, fontFamily: "inherit" }}>
                <LogOut size={13} /> Logout
              </button>
            </div>
          </aside>
          <main style={{ flex: 1, minWidth: 0, overflowY: "auto", background: V.bg }}>
            <div style={{ padding: "28px", maxWidth: 1100, margin: "0 auto" }}><Outlet /></div>
          </main>
        </div>

        {/* ── MOBILE CONTENT ───────────────────────────────────────────── */}
        <div id="v-mcnt" style={{ paddingBottom: 96, background: V.bg }}>
          <div style={{ padding: "16px" }}><Outlet /></div>
        </div>

        {/* ── MOBILE BOTTOM TAB BAR ────────────────────────────────────── */}
        <div id="v-bnav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40, padding: "8px 12px calc(8px + env(safe-area-inset-bottom, 0px))", background: "linear-gradient(to top, rgba(249,246,241,0.98) 65%, transparent)", pointerEvents: "none" }}>
          <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-around", background: "#fff", borderRadius: 100, border: `1px solid ${V.border}`, boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)", padding: "5px 6px", pointerEvents: "all" }}>
            {vendorBottomNav.map((item) => {
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} style={{ textDecoration: "none", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "5px 4px", borderRadius: 100, gap: 3 }}>
                    <div style={{ width: active ? 36 : 28, height: active ? 36 : 28, borderRadius: "50%", background: active ? V.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", boxShadow: active ? "0 2px 10px rgba(45,106,79,0.3)" : "none" }}>
                      <item.icon size={active ? 16 : 15} color={active ? "#fff" : V.muted} />
                    </div>
                    <span style={{ color: active ? V.green : V.muted, fontSize: 8.5, fontWeight: active ? 700 : 400, letterSpacing: 0.3, lineHeight: 1 }}>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN / CASHIER — light sidebar, full mobile drawer
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8fafc" }}>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden"
          style={{ background: "rgba(0,0,0,0.2)", backdropFilter: "blur(2px)" }}
          onClick={() => setOpen(false)} />
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 252, background: "#fff", borderRight: "1px solid #e8ecf0", display: "flex", flexDirection: "column", transition: "transform 0.2s" }}>

        {/* Role color strip */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${rc.solid}, ${rc.light})`, flexShrink: 0 }} />

        {/* Brand + close button on mobile */}
        <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid #f0f2f5", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", border: "1px solid #e8ecf0", flexShrink: 0 }}>
                <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              <div>
                <div style={{ color: "#111827", fontWeight: 700, fontSize: 13, letterSpacing: 0.3 }}>PALENG-CLICK</div>
                <div style={{ color: "#9ca3af", fontSize: 8, letterSpacing: 2, textTransform: "uppercase" }}>San Juan, Batangas</div>
              </div>
            </Link>
            {/* Close button — mobile only */}
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden"
              style={{ background: rc.pale, border: `1px solid ${rc.border}`, borderRadius: 7, padding: "5px 7px", cursor: "pointer", display: "flex", color: rc.text, flexShrink: 0 }}>
              <X size={15} />
            </button>
          </div>

          {/* User card */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: rc.pale, border: `1px solid ${rc.border}`, borderRadius: 10, padding: "9px 11px" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, background: `linear-gradient(135deg, ${rc.solid}, ${rc.light})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{initials}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: "#111827", fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
              <div style={{ color: rc.text, fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>{roleLabels[role]}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ overflowY: "auto", padding: "10px 8px", flexShrink: 0 }}>
          <div style={{ color: "#9ca3af", fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "2px 8px 10px" }}>Navigation</div>
          {navItems.map((item) => (
            <SidebarNavItem
              key={item.path}
              item={item}
              active={isActive(item.path)}
              rc={rc}
              onClick={() => setOpen(false)}
            />
          ))}
        </nav>

        {/* Logout pinned */}
        <div style={{ marginTop: "auto", padding: "10px 8px 16px", borderTop: "1px solid #f0f2f5", flexShrink: 0 }}>
          <div style={{ color: "#d1d5db", fontSize: 9, textAlign: "center", marginBottom: 8 }}>
            Municipality of San Juan, Batangas
          </div>
          <button onClick={handleLogout} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 9, padding: "9px", cursor: "pointer", color: "#dc2626", fontSize: 12, fontFamily: "inherit" }}>
            <LogOut size={13} /> Logout
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, flexDirection: "column", minWidth: 0 }}>

        {/* Top bar — mobile only (hamburger hidden on desktop) */}
        <header
          className="lg:hidden"
          style={{ position: "sticky", top: 0, zIndex: 30, display: "flex", alignItems: "center", gap: 12, height: 52, padding: "0 16px", background: "rgba(255,255,255,0.96)", borderBottom: "1px solid #e8ecf0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", backdropFilter: "blur(8px)", flexShrink: 0 }}>
          <button onClick={() => setOpen(true)} style={{ background: rc.pale, border: `1px solid ${rc.border}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: rc.text, display: "flex" }}>
            <Menu size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <div style={{ width: 24, height: 24, borderRadius: 5, overflow: "hidden", border: "1px solid #e8ecf0" }}>
              <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <span style={{ color: "#111827", fontWeight: 700, fontSize: 13 }}>PALENG-CLICK</span>
          </div>
          <span style={{ background: rc.pale, border: `1px solid ${rc.border}`, color: rc.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "capitalize" }}>
            {role}
          </span>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f8fafc" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;