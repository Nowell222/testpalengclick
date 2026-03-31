import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CreditCard, QrCode, MessageSquare, Newspaper,
  FileBarChart, LogOut, Menu, X, Wallet, History, FileText, Store, Bell,
  Search, Receipt, Send, ChevronRight, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavItem { label: string; path: string; icon: LucideIcon; }

const adminNav: NavItem[] = [
  { label: "Dashboard",       path: "/admin",          icon: LayoutDashboard },
  { label: "User Management", path: "/admin/users",    icon: Users           },
  { label: "Payments",        path: "/admin/payments", icon: CreditCard      },
  { label: "QR Code",         path: "/admin/qr-codes", icon: QrCode          },
  { label: "SMS",             path: "/admin/sms",      icon: MessageSquare   },
  { label: "News / Updates",  path: "/admin/news",     icon: Newspaper       },
  { label: "Reports",         path: "/admin/reports",  icon: FileBarChart    },
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

// ── Shared green sidebar colors ───────────────────────────────────────────────
const C = {
  bg:      "linear-gradient(160deg, #1a3020, #0f1e0f)",
  gold:    "#c9a84c",
  goldLt:  "#e8c86e",
  cream:   "#f0e6c8",
  dimCream:"rgba(240,230,200,0.55)",
  dimGold: "rgba(201,168,76,0.15)",
  border:  "rgba(201,168,76,0.18)",
};

const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location    = useLocation();
  const navigate    = useNavigate();
  const [open, setOpen] = useState(false);
  const { signOut, profile } = useAuth();

  const navItems    = role === "admin" ? adminNav : role === "vendor" ? vendorNav : cashierNav;
  const isActive    = (path: string) => location.pathname === path;
  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : roleLabels[role];
  const initials    = `${profile?.first_name?.[0] ?? ""}${profile?.last_name?.[0] ?? ""}`;
  const handleLogout = async () => { await signOut(); navigate("/login"); };

  // ════════════════════════════════════════════════════════════════════════════
  // VENDOR — municipality-themed, mobile-first with bottom tab bar
  // ════════════════════════════════════════════════════════════════════════════
  if (role === "vendor") {
    return (
      <div style={{ minHeight: "100vh", background: "#f8f5f0", fontFamily: "Georgia,'Times New Roman',serif" }}>

        {/* ── MOBILE HEADER — hidden on desktop via inline style + CSS ────── */}
        <style>{`
          @media (min-width: 1024px) {
            #vendor-mobile-header  { display: none !important; }
            #vendor-mobile-content { display: none !important; }
            #vendor-bottom-nav     { display: none !important; }
          }
          @media (max-width: 1023px) {
            #vendor-desktop-layout { display: none !important; }
          }
        `}</style>

        <header id="vendor-mobile-header" style={{
          position: "sticky", top: 0, zIndex: 40,
          background: C.bg, borderBottom: `2px solid ${C.gold}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px", height: 56,
        }}>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
              <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <div style={{ color: C.cream, fontWeight: 700, fontSize: 12, letterSpacing: 0.8 }}>PALENG-CLICK</div>
              <div style={{ color: "rgba(201,168,76,0.75)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>Vendor Portal</div>
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.cream, fontSize: 11, fontWeight: 600 }}>{profile?.first_name}</div>
              <div style={{ color: "rgba(201,168,76,0.65)", fontSize: 8, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
            </div>
            <button onClick={() => setOpen(true)} style={{
              background: "rgba(255,255,255,0.08)", border: `1px solid ${C.border}`,
              borderRadius: 8, padding: "7px 9px", cursor: "pointer", display: "flex",
            }}>
              <Menu size={17} color={C.cream} />
            </button>
          </div>
        </header>

        {/* ── SLIDE-OVER DRAWER (mobile full nav) ───────────────────────── */}
        {open && (
          <div id="vendor-mobile-header" style={{ position: "fixed", inset: 0, zIndex: 50 }}>
            <div onClick={() => setOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(5,15,8,0.75)", backdropFilter: "blur(4px)" }} />
            <div style={{
              position: "absolute", top: 0, right: 0, bottom: 0, width: 285,
              background: C.bg, borderLeft: `1px solid ${C.border}`,
              display: "flex", flexDirection: "column",
            }}>
              <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${C.gold}, ${C.goldLt}, ${C.gold})` }} />

              {/* Drawer header */}
              <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, overflow: "hidden" }}>
                    <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div>
                    <div style={{ color: C.cream, fontWeight: 700, fontSize: 13 }}>PALENG-CLICK</div>
                    <div style={{ color: "rgba(201,168,76,0.65)", fontSize: 8, letterSpacing: 2.5, textTransform: "uppercase" }}>San Juan, Batangas</div>
                  </div>
                </div>
                <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 8px", cursor: "pointer", display: "flex" }}>
                  <X size={15} color={C.gold} />
                </button>
              </div>

              {/* User pill */}
              <div style={{ padding: "14px 18px", borderBottom: `1px solid rgba(201,168,76,0.08)` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.dimGold, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg,${C.gold},${C.goldLt})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ color: "#1a2e1a", fontWeight: 700, fontSize: 14 }}>{initials}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.cream, fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                    <div style={{ color: "rgba(201,168,76,0.6)", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
                  </div>
                </div>
              </div>

              {/* Nav links */}
              <nav style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
                <div style={{ color: "rgba(201,168,76,0.35)", fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "4px 10px 10px" }}>Menu</div>
                {vendorNav.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link key={item.path} to={item.path} onClick={() => setOpen(false)} style={{ textDecoration: "none" }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "11px 13px", borderRadius: 10, marginBottom: 3,
                        background: active ? "rgba(201,168,76,0.12)" : "transparent",
                        border: active ? `1px solid rgba(201,168,76,0.22)` : "1px solid transparent",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: active ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <item.icon size={14} color={active ? C.goldLt : "rgba(240,230,200,0.45)"} />
                          </div>
                          <span style={{ color: active ? C.goldLt : C.dimCream, fontSize: 13, fontWeight: active ? 700 : 400 }}>{item.label}</span>
                        </div>
                        <ChevronRight size={12} color={active ? C.gold : "rgba(201,168,76,0.2)"} />
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* Logout */}
              <div style={{ padding: "10px 12px 20px", borderTop: `1px solid rgba(201,168,76,0.12)` }}>
                <button onClick={handleLogout} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                  background: "rgba(179,74,42,0.1)", border: "1px solid rgba(179,74,42,0.22)",
                  borderRadius: 10, padding: "12px", cursor: "pointer", color: "#e07a5a", fontSize: 13,
                }}>
                  <LogOut size={14} /> Logout
                </button>
                <div style={{ color: "rgba(240,230,200,0.2)", fontSize: 9, textAlign: "center", marginTop: 12, letterSpacing: 0.5 }}>
                  © 2026 Municipality of San Juan, Batangas
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DESKTOP SIDEBAR + CONTENT — hidden on mobile via CSS ──────── */}
        <div id="vendor-desktop-layout" style={{ display: "flex", minHeight: "100vh" }}>

          {/* Desktop sidebar */}
          <aside style={{
            width: 256, flexShrink: 0, background: C.bg,
            borderRight: `1px solid ${C.border}`,
            display: "flex", flexDirection: "column",
            position: "sticky", top: 0, height: "100vh",
          }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${C.gold}, ${C.goldLt}, ${C.gold}, transparent)` }} />

            {/* Brand */}
            <div style={{ padding: "20px 18px 16px", borderBottom: `1px solid rgba(201,168,76,0.1)` }}>
              <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, overflow: "hidden", boxShadow: `0 2px 10px rgba(201,168,76,0.2)` }}>
                  <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <div>
                  <div style={{ color: C.cream, fontWeight: 700, fontSize: 13.5, letterSpacing: 0.8 }}>PALENG-CLICK</div>
                  <div style={{ color: "rgba(201,168,76,0.65)", fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase" }}>San Juan, Batangas</div>
                </div>
              </Link>

              {/* User card */}
              <div style={{ background: C.dimGold, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${C.gold},${C.goldLt})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ color: "#1a2e1a", fontWeight: 700, fontSize: 12 }}>{initials}</span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: C.cream, fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</div>
                  <div style={{ color: "rgba(201,168,76,0.6)", fontSize: 8.5, letterSpacing: 1.5, textTransform: "uppercase" }}>Vendor</div>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>
              <div style={{ color: "rgba(201,168,76,0.35)", fontSize: 8.5, letterSpacing: 2.5, textTransform: "uppercase", padding: "2px 10px 10px" }}>Navigation</div>
              {vendorNav.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link key={item.path} to={item.path} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "9px 11px", borderRadius: 9, marginBottom: 2,
                      background: active ? "rgba(201,168,76,0.12)" : "transparent",
                      border: active ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
                      cursor: "pointer", transition: "background 0.15s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 7, background: active ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <item.icon size={13} color={active ? C.goldLt : "rgba(240,230,200,0.4)"} />
                        </div>
                        <span style={{ color: active ? C.goldLt : C.dimCream, fontSize: 12.5, fontWeight: active ? 700 : 400 }}>{item.label}</span>
                      </div>
                      {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.gold, flexShrink: 0 }} />}
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div style={{ padding: "10px 10px 16px", borderTop: `1px solid rgba(201,168,76,0.1)` }}>
              <div style={{ color: "rgba(240,230,200,0.2)", fontSize: 9, textAlign: "center", marginBottom: 8, letterSpacing: 0.5 }}>
                Municipality of San Juan, Batangas
              </div>
              <button onClick={handleLogout} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "rgba(179,74,42,0.08)", border: "1px solid rgba(179,74,42,0.18)",
                borderRadius: 9, padding: "9px", cursor: "pointer", color: "#e07a5a", fontSize: 12,
              }}>
                <LogOut size={13} /> Logout
              </button>
            </div>
          </aside>

          {/* Desktop content */}
          <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
              <Outlet />
            </div>
          </main>
        </div>

        {/* ── MOBILE CONTENT — hidden on desktop via CSS ─────────────────── */}
        <div id="vendor-mobile-content" style={{ paddingBottom: 96 }}>
          <div style={{ padding: "16px 16px" }}>
            <Outlet />
          </div>
        </div>

        {/* ── MOBILE BOTTOM TAB BAR — hidden on desktop via CSS ──────────── */}
        <div id="vendor-bottom-nav" style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
          padding: "8px 16px calc(8px + env(safe-area-inset-bottom, 0px))",
          background: "linear-gradient(to top, rgba(10,20,12,0.98) 60%, transparent)",
          pointerEvents: "none",
        }}>
          <nav style={{
            display: "flex", alignItems: "center", justifyContent: "space-around",
            background: "linear-gradient(135deg, #1a3020, #0f2018)",
            borderRadius: 100,
            border: "1px solid rgba(201,168,76,0.25)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.08) inset",
            padding: "6px 8px",
            pointerEvents: "all",
          }}>
          {vendorBottomNav.map((item) => {
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} style={{ textDecoration: "none", flex: 1 }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "6px 4px", borderRadius: 100,
                  background: active ? "linear-gradient(135deg, rgba(201,168,76,0.2), rgba(232,200,110,0.1))" : "transparent",
                  transition: "background 0.2s",
                  gap: 3,
                }}>
                  <div style={{
                    width: active ? 36 : 28, height: active ? 36 : 28,
                    borderRadius: "50%",
                    background: active ? `linear-gradient(135deg, ${C.gold}, ${C.goldLt})` : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s",
                    boxShadow: active ? "0 2px 12px rgba(201,168,76,0.4)" : "none",
                  }}>
                    <item.icon size={active ? 17 : 15} color={active ? "#1a2e1a" : "rgba(240,230,200,0.45)"} />
                  </div>
                  <span style={{
                    color: active ? C.goldLt : "rgba(240,230,200,0.4)",
                    fontSize: 8.5, fontWeight: active ? 700 : 400,
                    letterSpacing: 0.3, lineHeight: 1,
                  }}>{item.label}</span>
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
  // ADMIN / CASHIER — original layout unchanged
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen bg-background">
      {open && <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link to="/" className="flex items-center gap-2">
            <div style={{ width: 30, height: 30, borderRadius: 7, overflow: "hidden" }}>
              <img src="/favicon.png" alt="PC" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <span className="font-semibold text-foreground">PALENG-CLICK</span>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-3 pt-3 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{roleLabels[role]}</span>
          <p className="text-xs text-foreground font-medium truncate">{displayName}</p>
        </div>
        <nav className="overflow-y-auto px-2 py-2">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
              className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive(item.path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3 mt-auto">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur-sm px-4">
          <button onClick={() => setOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">{role}</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;