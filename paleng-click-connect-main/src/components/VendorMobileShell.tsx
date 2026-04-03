/**
 * VendorMobileShell
 * ─────────────────
 * Wraps every vendor page in the GCash-style mobile header + bottom nav.
 * On desktop (lg+) it renders nothing — the existing DashboardLayout sidebar
 * already handles desktop navigation.
 *
 * Usage:
 *   <VendorMobileShell title="Payment History" subtitle="All your payments">
 *     {children}
 *   </VendorMobileShell>
 */

import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, CreditCard, History, FileText, Store,
  Bell, Newspaper, QrCode, List, UserCircle, X, ChevronRight,
  LogOut, ArrowLeft,
} from "lucide-react";

/* ── nav definitions ──────────────────────────────────────────────────────── */
const NAV = [
  { label: "Dashboard",       to: "/vendor",               icon: LayoutDashboard },
  { label: "Pay Online",      to: "/vendor/pay",           icon: CreditCard      },
  { label: "Payment History", to: "/vendor/history",       icon: History         },
  { label: "Statement",       to: "/vendor/statement",     icon: FileText        },
  { label: "Stall Info",      to: "/vendor/stall",         icon: Store           },
  { label: "Notifications",   to: "/vendor/notifications", icon: Bell            },
  { label: "News & Updates",  to: "/vendor/news",          icon: Newspaper       },
];

const BOTTOM_NAV = [
  { label: "Home",     to: "/vendor",               icon: LayoutDashboard },
  { label: "Inbox",    to: "/vendor/notifications", icon: Bell            },
  // centre slot — QR (handled separately)
  { label: "Payments", to: "/vendor/history",       icon: List            },
  { label: "Profile",  to: "/vendor/stall",         icon: UserCircle      },
];

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** show a back arrow instead of the brand logo */
  showBack?: boolean;
}

const VendorMobileShell = ({ title, subtitle, children, showBack = false }: Props) => {
  const { user, profile: authProfile, signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  /* fetch unread notification count */
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["vendor-unread-count", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read_status", false);
      return count || 0;
    },
  });

  /* fetch stall info for the hamburger menu profile */
  const { data: vendorInfo } = useQuery({
    queryKey: ["vendor-shell-info", user?.id],
    enabled: !!user,
    staleTime: 60000,
    queryFn: async () => {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("*, stalls(stall_number, section)")
        .eq("user_id", user!.id)
        .single();
      return vendor;
    },
  });

  const stall       = vendorInfo?.stalls as any;
  const firstName   = authProfile?.first_name || "Vendor";
  const lastName    = authProfile?.last_name  || "";
  const initials    = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
  const isActive    = (path: string) => location.pathname === path;

  const gradientBg  = "linear-gradient(160deg, #1a3a5f 0%, #1d5799 55%, #2563eb 100%)";

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          MOBILE ONLY  (block lg:hidden)
      ══════════════════════════════════════════════════════════════════ */}
      <div className="block lg:hidden">

        {/* ── Sticky header ─────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
          style={{ background: gradientBg }}
        >
          {showBack ? (
            <Link to="/vendor" className="flex items-center gap-2 text-white">
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-semibold">Back</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
              >
                <Store className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-xs tracking-wide leading-tight">PALENG-CLICK</p>
                <p className="text-[8px] tracking-[2px] uppercase leading-tight" style={{ color: "rgba(255,255,255,0.6)" }}>
                  Vendor Portal
                </p>
              </div>
            </div>
          )}

          {/* Page title (center) */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center">
            <p className="text-white font-bold text-sm leading-tight">{title}</p>
            {subtitle && <p className="text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.65)" }}>{subtitle}</p>}
          </div>

          {/* Right: notification dot + hamburger (replaces profile) */}
          <button
            onClick={() => setMenuOpen(true)}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            {/* Avatar initials */}
            <span className="text-white text-xs font-bold">{initials || "V"}</span>
            {/* Unread badge */}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-white flex items-center justify-center text-[8px] text-white font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Page content ──────────────────────────────────────────────── */}
        <div className="pb-24" style={{ background: "#f0f4f8", minHeight: "calc(100dvh - 60px)" }}>
          <div className="px-4 pt-4">
            {children}
          </div>
        </div>

        {/* ── GCash-style bottom nav ─────────────────────────────────────── */}
        <div
          className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex items-center justify-around px-2 pt-2 pb-3"
          style={{ zIndex: 50 }}
        >
          {/* Home */}
          <Link to={BOTTOM_NAV[0].to} className="flex flex-col items-center gap-1 px-3 py-1">
            <LayoutDashboard className={`h-5 w-5 ${isActive(BOTTOM_NAV[0].to) ? "text-[#1a3a5f]" : "text-slate-400"}`} />
            <span className={`text-[10px] font-${isActive(BOTTOM_NAV[0].to) ? "bold" : "medium"} ${isActive(BOTTOM_NAV[0].to) ? "text-[#1a3a5f]" : "text-slate-400"}`}>
              Home
            </span>
          </Link>

          {/* Inbox */}
          <Link to={BOTTOM_NAV[1].to} className="relative flex flex-col items-center gap-1 px-3 py-1">
            <Bell className={`h-5 w-5 ${isActive(BOTTOM_NAV[1].to) ? "text-[#1a3a5f]" : "text-slate-400"}`} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-2 w-2 h-2 rounded-full bg-red-500 border border-white" />
            )}
            <span className={`text-[10px] font-${isActive(BOTTOM_NAV[1].to) ? "bold" : "medium"} ${isActive(BOTTOM_NAV[1].to) ? "text-[#1a3a5f]" : "text-slate-400"}`}>
              Inbox
            </span>
          </Link>

          {/* Centre QR — raised */}
          <div className="flex flex-col items-center gap-1 -mt-5">
            <Link to="/vendor/stall">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center border-4 border-[#f0f4f8]"
                style={{ background: gradientBg, boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}
              >
                <QrCode className="h-6 w-6 text-white" />
              </div>
            </Link>
            <span className="text-[10px] font-medium text-slate-400">My QR</span>
          </div>

          {/* Payments */}
          <Link to={BOTTOM_NAV[2].to} className="flex flex-col items-center gap-1 px-3 py-1">
            <List className={`h-5 w-5 ${isActive(BOTTOM_NAV[2].to) ? "text-[#1a3a5f]" : "text-slate-400"}`} />
            <span className={`text-[10px] font-${isActive(BOTTOM_NAV[2].to) ? "bold" : "medium"} ${isActive(BOTTOM_NAV[2].to) ? "text-[#1a3a5f]" : "text-slate-400"}`}>
              Payments
            </span>
          </Link>

          {/* Profile — now opens hamburger menu */}
          <button
            onClick={() => setMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1"
          >
            <UserCircle className="h-5 w-5 text-slate-400" />
            <span className="text-[10px] font-medium text-slate-400">Profile</span>
          </button>
        </div>

        {/* ── Hamburger slide-in menu ────────────────────────────────────── */}
        {menuOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
              onClick={() => setMenuOpen(false)}
            />

            {/* Drawer panel — slides from right */}
            <div
              className="fixed top-0 right-0 bottom-0 z-50 flex flex-col overflow-hidden"
              style={{
                width: 300,
                background: "#fff",
                boxShadow: "-8px 0 40px rgba(0,0,0,0.15)",
                borderLeft: "1px solid #e2e8f0",
              }}
            >
              {/* Gradient strip at top */}
              <div style={{ height: 4, background: gradientBg, flexShrink: 0 }} />

              {/* Profile header */}
              <div className="p-5" style={{ background: gradientBg }}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white font-bold text-sm tracking-wide">PALENG-CLICK</p>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center w-8 h-8 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>

                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                    style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)" }}
                  >
                    {initials || "V"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-base leading-tight truncate">
                      {firstName} {lastName}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)" }}>
                      Stall {stall?.stall_number || "—"} · {stall?.section || "General"} Section
                    </p>
                  </div>
                </div>
              </div>

              {/* Nav label */}
              <div className="px-5 pt-4 pb-1">
                <p className="text-[9px] font-semibold uppercase tracking-[2px] text-slate-400">Navigation</p>
              </div>

              {/* Nav items */}
              <nav className="flex-1 overflow-y-auto px-3 pb-3">
                {NAV.map(item => {
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-between px-3 py-3 rounded-xl mb-0.5 transition-all"
                      style={{
                        background: active ? "#e8f0fe" : "transparent",
                        border: active ? "1px solid #c7d8f8" : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background: active ? "#1a3a5f" : "#f1f5f9",
                          }}
                        >
                          <item.icon
                            className="h-4 w-4"
                            style={{ color: active ? "#fff" : "#64748b" }}
                          />
                        </div>
                        <span
                          className="text-sm"
                          style={{ color: active ? "#1a3a5f" : "#374151", fontWeight: active ? 700 : 400 }}
                        >
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.to === "/vendor/notifications" && unreadCount > 0 && (
                          <span
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold"
                          >
                            {unreadCount}
                          </span>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                      </div>
                    </Link>
                  );
                })}
              </nav>

              {/* Divider */}
              <div className="h-px bg-slate-100 mx-5" />

              {/* Logout */}
              <div className="p-5">
                <p className="text-[9px] text-slate-400 text-center mb-3">Municipality of San Juan, Batangas</p>
                <button
                  onClick={async () => { setMenuOpen(false); await signOut(); }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-600 transition-colors"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP ONLY  (hidden lg:block)
          On desktop DashboardLayout already provides the sidebar +
          header, so we just render children directly.
      ══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:block">
        {children}
      </div>
    </>
  );
};

export default VendorMobileShell;
