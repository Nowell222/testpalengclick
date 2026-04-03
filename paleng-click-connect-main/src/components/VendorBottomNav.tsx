/**
 * VendorBottomNav — shared mobile bottom nav for ALL vendor pages.
 *
 * Tabs: Home | Inbox | My QR (centre FAB) | Payments | News
 *
 * Usage:
 *   import VendorBottomNav from "@/components/VendorBottomNav";
 *   <VendorBottomNav active="home" />
 *
 * active prop values: "home" | "inbox" | "qr" | "payments" | "news"
 */

import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Bell, QrCode, List, Newspaper,
} from "lucide-react";

const DS = {
  gradientCard: "linear-gradient(135deg, #1a3a5f 0%, #2563eb 100%)",
  blue900: "#0d2240",
  blue700: "#1d4ed8",
};

type ActiveTab = "home" | "inbox" | "qr" | "payments" | "news";

const TABS = [
  { id: "home",     label: "Home",     icon: LayoutDashboard, to: "/vendor"               },
  { id: "inbox",    label: "Inbox",    icon: Bell,            to: "/vendor/notifications" },
  { id: "qr",       label: "My QR",   icon: QrCode,          to: "/vendor/stall"         },
  { id: "payments", label: "Payments", icon: List,            to: "/vendor/history"       },
  { id: "news",     label: "News",     icon: Newspaper,       to: "/vendor/news"          },
] as const;

interface Props {
  unreadNotifs?: number;
}

const VendorBottomNav = ({ unreadNotifs = 0 }: Props) => {
  const location = useLocation();

  const getActive = (): ActiveTab => {
    const path = location.pathname;
    if (path === "/vendor" || path === "/vendor/") return "home";
    if (path.startsWith("/vendor/notifications"))          return "inbox";
    if (path.startsWith("/vendor/stall"))                  return "qr";
    if (path.startsWith("/vendor/history") || path.startsWith("/vendor/pay") || path.startsWith("/vendor/statement")) return "payments";
    if (path.startsWith("/vendor/news"))                   return "news";
    return "home";
  };

  const active = getActive();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 lg:hidden"
      style={{ zIndex: 50, background: "white", borderTop: "1px solid #f1f5f9" }}
    >
      <div className="flex items-center justify-around px-2 pb-3 pt-1">
        {TABS.map((tab) => {
          const isActive  = active === tab.id;
          const isCenter  = tab.id === "qr";

          if (isCenter) {
            return (
              <div key={tab.id} className="flex flex-col items-center gap-1" style={{ marginTop: -20 }}>
                <Link to={tab.to}>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{
                      background: DS.gradientCard,
                      boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
                      border: "4px solid #f0f4f8",
                    }}
                  >
                    <QrCode className="h-6 w-6 text-white" />
                  </div>
                </Link>
                <span className="text-[10px] font-medium text-slate-400">{tab.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={tab.id}
              to={tab.to}
              className="flex flex-col items-center gap-1 px-2 py-1 relative"
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center transition-all"
                style={
                  isActive
                    ? { background: DS.blue900, boxShadow: "0 3px 10px rgba(13,34,64,0.35)" }
                    : {}
                }
              >
                <tab.icon
                  className="h-5 w-5"
                  style={{ color: isActive ? "white" : "#94a3b8", width: 18, height: 18 }}
                />
                {tab.id === "inbox" && unreadNotifs > 0 && (
                  <span
                    className="absolute top-0 right-1 w-2 h-2 rounded-full bg-red-500"
                    style={{ border: "1.5px solid white" }}
                  />
                )}
              </div>
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? DS.blue700 : "#94a3b8", fontWeight: isActive ? 700 : 500 }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default VendorBottomNav;