import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import DashboardLayout from "./components/DashboardLayout";

import AdminDashboardHome from "./pages/admin/AdminDashboardHome";
import AdminUserManagement from "./pages/admin/AdminUserManagement";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminQRCodes from "./pages/admin/AdminQRCodes";
import AdminSMS from "./pages/admin/AdminSMS";
import AdminNews from "./pages/admin/AdminNews";
import AdminReports from "./pages/admin/AdminReports";

import VendorDashboardHome from "./pages/vendor/VendorDashboardHome";
import VendorPayOnline from "./pages/vendor/VendorPayOnline";
import VendorHistory from "./pages/vendor/VendorHistory";
import VendorStatement from "./pages/vendor/VendorStatement";
import VendorStallInfo from "./pages/vendor/VendorStallInfo";
import VendorNotifications from "./pages/vendor/VendorNotifications";
import VendorNews from "./pages/vendor/VendorNews";

import CashierDashboardHome from "./pages/cashier/CashierDashboardHome";
import CashierAcceptPayment from "./pages/cashier/CashierAcceptPayment";
import CashierSearchVendor from "./pages/cashier/CashierSearchVendor";
import CashierPaymentStatus from "./pages/cashier/CashierPaymentStatus";
import CashierSOA from "./pages/cashier/CashierSOA";
import CashierSMS from "./pages/cashier/CashierSMS";
import CashierReports from "./pages/cashier/CashierReports";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <DashboardLayout role="admin" />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboardHome />} />
              <Route path="users" element={<AdminUserManagement />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="qr-codes" element={<AdminQRCodes />} />
              <Route path="sms" element={<AdminSMS />} />
              <Route path="news" element={<AdminNews />} />
              <Route path="reports" element={<AdminReports />} />
            </Route>

            {/* Vendor routes */}
            <Route path="/vendor" element={
              <ProtectedRoute allowedRoles={["vendor"]}>
                <DashboardLayout role="vendor" />
              </ProtectedRoute>
            }>
              <Route index element={<VendorDashboardHome />} />
              <Route path="pay" element={<VendorPayOnline />} />
              <Route path="history" element={<VendorHistory />} />
              <Route path="statement" element={<VendorStatement />} />
              <Route path="stall" element={<VendorStallInfo />} />
              <Route path="notifications" element={<VendorNotifications />} />
              <Route path="news" element={<VendorNews />} />
            </Route>

            {/* Cashier routes */}
            <Route path="/cashier" element={
              <ProtectedRoute allowedRoles={["cashier"]}>
                <DashboardLayout role="cashier" />
              </ProtectedRoute>
            }>
              <Route index element={<CashierDashboardHome />} />
              <Route path="accept" element={<CashierAcceptPayment />} />
              <Route path="search" element={<CashierSearchVendor />} />
              <Route path="status" element={<CashierPaymentStatus />} />
              <Route path="soa" element={<CashierSOA />} />
              <Route path="sms" element={<CashierSMS />} />
              <Route path="reports" element={<CashierReports />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
