import { useState } from "react";
import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, CreditCard, QrCode, MessageSquare, Newspaper,
  FileBarChart, LogOut, Menu, X, Wallet, History, FileText, Store, Bell,
  Search, Receipt, Send, type LucideIcon,
} from "lucide-react";

interface NavItem { label: string; path: string; icon: LucideIcon; }

const adminNav: NavItem[] = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "User Management", path: "/admin/users", icon: Users },
  { label: "Payments", path: "/admin/payments", icon: CreditCard },
  { label: "QR Code", path: "/admin/qr-codes", icon: QrCode },
  { label: "SMS", path: "/admin/sms", icon: MessageSquare },
  { label: "News / Updates", path: "/admin/news", icon: Newspaper },
  { label: "Reports", path: "/admin/reports", icon: FileBarChart },
];

const vendorNav: NavItem[] = [
  { label: "Dashboard", path: "/vendor", icon: LayoutDashboard },
  { label: "Pay Online", path: "/vendor/pay", icon: Wallet },
  { label: "Payment History", path: "/vendor/history", icon: History },
  { label: "Statement of Account", path: "/vendor/statement", icon: FileText },
  { label: "Stall Information", path: "/vendor/stall", icon: Store },
  { label: "Notifications", path: "/vendor/notifications", icon: Bell },
  { label: "News / Updates", path: "/vendor/news", icon: Newspaper },
];

const cashierNav: NavItem[] = [
  { label: "Dashboard", path: "/cashier", icon: LayoutDashboard },
  { label: "Accept Payment", path: "/cashier/accept", icon: CreditCard },
  { label: "Search Vendor", path: "/cashier/search", icon: Search },
  { label: "Payment Status", path: "/cashier/status", icon: Receipt },
  { label: "Print SOA", path: "/cashier/soa", icon: FileText },
  { label: "SMS Reminders", path: "/cashier/sms", icon: Send },
  { label: "Reports", path: "/cashier/reports", icon: FileBarChart },
];

interface DashboardLayoutProps { role: "admin" | "vendor" | "cashier"; }

const roleLabels = { admin: "Municipal Treasurer", vendor: "Vendor", cashier: "Cashier" };

const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut, profile } = useAuth();

  const navItems = role === "admin" ? adminNav : role === "vendor" ? vendorNav : cashierNav;
  const isActive = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = profile ? `${profile.first_name} ${profile.last_name}` : roleLabels[role];

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-xs font-bold text-primary-foreground">PC</span>
            </div>
            <span className="font-semibold text-foreground">PALENG-CLICK</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{roleLabels[role]}</span>
          <p className="text-xs text-foreground font-medium truncate">{displayName}</p>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive(item.path)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur-sm px-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
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
