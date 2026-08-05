import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import AdminLayout from "./components/admin/AdminLayout";
import CashierLayout from "./components/cashier/CashierLayout";
import VendorLayout from "./components/vendor/VendorLayout";
import BploLayout from "./components/bplo/BploLayout";
import BploDashboard from "./pages/bplo/BploDashboard";
import BploSettings from "./pages/bplo/BploSettings";
import BploDelinquents from "./pages/bplo/BploDelinquents";
import BploStallHistory from "./pages/bplo/BploStallHistory";

import AdminDashboardHome from "./pages/admin/AdminDashboardHome";
import AdminUserManagement from "./pages/admin/AdminUserManagement";
import AdminApplications from "./pages/admin/AdminApplications";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminQRCodes from "./pages/admin/AdminQRCodes";
import AdminSMS from "./pages/admin/AdminSMS";
import AdminNews from "./pages/admin/AdminNews";
import AdminReports from "./pages/admin/AdminReports";
import AdminFeeSchedules from "./pages/admin/AdminFeeSchedules";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminSettings from "./pages/admin/AdminSettings";

import VendorDashboardHome from "./pages/vendor/VendorDashboardHome";
import VendorPayOnline from "./pages/vendor/VendorPayOnline";
import VendorHistory from "./pages/vendor/VendorHistory";
import VendorStatement from "./pages/vendor/VendorStatement";
import VendorStallInfo from "./pages/vendor/VendorStallInfo";
import VendorNotifications from "./pages/vendor/VendorNotifications";
import VendorNews from "./pages/vendor/VendorNews";
import VendorMessages from "./pages/vendor/VendorMessages";

import AdminMessages from "./pages/admin/AdminMessages";

import CashierDashboardHome from "./pages/cashier/CashierDashboardHome";
import CashierAcceptPayment from "./pages/cashier/CashierAcceptPayment";
import CashierSearchVendor from "./pages/cashier/CashierSearchVendor";
import CashierPaymentStatus from "./pages/cashier/CashierPaymentStatus";
import CashierSOA from "./pages/cashier/CashierSOA";
import CashierSMS from "./pages/cashier/CashierSMS";
import CashierShiftHistory from "./pages/cashier/CashierShiftHistory";
import CashierReports from "./pages/cashier/CashierReports";
import CashierSettings from "./pages/cashier/CashierSettings";
import CashierFeeSchedules from "./pages/cashier/CashierFeeSchedules";

import VendorApply from "./pages/VendorApply";
import InstallPage from "./pages/InstallPage";
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
            <Route path="/apply" element={<VendorApply />} />
            <Route path="/install" element={<InstallPage />} />

            {/* Admin routes */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={["admin", "eemo"]}>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboardHome />} />
              <Route path="users" element={<AdminUserManagement />} />
              <Route path="applications" element={<AdminApplications />} />
              <Route path="history" element={<BploStallHistory />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="qr-codes" element={<AdminQRCodes />} />
              <Route path="sms" element={<AdminSMS />} />
              <Route path="news" element={<AdminNews />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="fee-schedules" element={<AdminFeeSchedules />} />
              <Route path="audit-logs" element={<AdminAuditLogs />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Vendor routes */}
            <Route path="/vendor" element={
              <ProtectedRoute allowedRoles={["vendor"]}>
                <VendorLayout />
              </ProtectedRoute>
            }>
              <Route index element={<VendorDashboardHome />} />
              <Route path="pay" element={<VendorPayOnline />} />
              <Route path="history" element={<VendorHistory />} />
              <Route path="statement" element={<VendorStatement />} />
              <Route path="stall" element={<VendorStallInfo />} />
              <Route path="notifications" element={<VendorNotifications />} />
              <Route path="news" element={<VendorNews />} />
              <Route path="messages" element={<VendorMessages />} />
            </Route>

            {/* Cashier routes */}
            <Route path="/cashier" element={
              <ProtectedRoute allowedRoles={["cashier"]}>
                <CashierLayout />
              </ProtectedRoute>
            }>
              <Route index element={<CashierDashboardHome />} />
              <Route path="accept" element={<CashierAcceptPayment />} />
              <Route path="search" element={<CashierSearchVendor />} />
              <Route path="status" element={<CashierPaymentStatus />} />
              <Route path="soa" element={<CashierSOA />} />
              <Route path="sms" element={<CashierSMS />} />
              <Route path="shifts" element={<CashierShiftHistory />} />
              <Route path="reports" element={<CashierReports />} />
              <Route path="fee-schedules" element={<CashierFeeSchedules />} />
              <Route path="settings" element={<CashierSettings />} />
            </Route>

            {/* BPLO routes */}
            <Route path="/bplo" element={
              <ProtectedRoute allowedRoles={["bplo"]}>
                <BploLayout />
              </ProtectedRoute>
            }>
              <Route index element={<BploDashboard />} />
              <Route path="history" element={<BploStallHistory />} />
              <Route path="delinquents" element={<BploDelinquents />} />
              <Route path="settings" element={<BploSettings />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;