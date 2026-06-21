import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import AppLayout from "@/components/AppLayout";
import RequireAuth from "@/components/RequireAuth";

const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const ApprovalInboxPage = lazy(() => import("@/pages/ApprovalInboxPage"));
const AuditLogsPage = lazy(() => import("@/pages/AuditLogsPage"));
const BadgePricingPage = lazy(() => import("@/pages/BadgePricingPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const DriverHubPage = lazy(() => import("@/pages/DriverHubPage"));
const DriverEarningsPage = lazy(() => import("@/pages/DriverEarningsPage"));
const DispatchConsolePage = lazy(() => import("@/pages/DispatchConsolePage"));
const CustomerHistoryPage = lazy(() => import("@/pages/CustomerHistoryPage"));
const DemoScenarioPage = lazy(() => import("@/pages/DemoScenarioPage"));
const DriversPage = lazy(() => import("@/pages/DriversPage"));
const InventoryAlertsPage = lazy(() => import("@/pages/InventoryAlertsPage"));
const LiveMapPage = lazy(() => import("@/pages/LiveMapPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const MarketDashboardPage = lazy(() => import("@/pages/MarketDashboardPage"));
const MarketItemsPage = lazy(() => import("@/pages/MarketItemsPage"));
const MarketPromoCodesPage = lazy(() => import("@/pages/MarketPromoCodesPage"));
const MarketSettingsPage = lazy(() => import("@/pages/MarketSettingsPage"));
const MarketsPage = lazy(() => import("@/pages/MarketsPage"));
const MyMarketsPage = lazy(() => import("@/pages/MyMarketsPage"));
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const OrderTrackingPage = lazy(() => import("@/pages/OrderTrackingPage"));
const SupportTicketsPage = lazy(() => import("@/pages/SupportTicketsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const RoutesPage = lazy(() => import("@/pages/RoutesPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const PublicMarketPage = lazy(() => import("@/pages/public/PublicMarketPage"));
const PublicMarketsPage = lazy(() => import("@/pages/public/PublicMarketsPage"));
const PublicDiscoveryPage = lazy(() => import("@/pages/public/PublicDiscoveryPage"));

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </RequireAuth>
  );
}

function AuthedLayout() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}

function PageLoader() {
  return (
    <div className="app-shell">
      <div className="mx-auto max-w-7xl">
        <div className="intro-panel p-8 text-sm text-white/80">Loading page...</div>
      </div>
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={withSuspense(<PublicMarketsPage />)} />
      <Route path="/discover/:collection" element={withSuspense(<PublicDiscoveryPage />)} />
      <Route path="/m/:marketId" element={withSuspense(<PublicMarketPage />)} />
      <Route path="/track" element={withSuspense(<OrderTrackingPage />)} />
      <Route path="/track/:code" element={withSuspense(<OrderTrackingPage />)} />
      <Route path="/login" element={withSuspense(<LoginPage />)} />

      <Route element={<AuthedLayout />}>
        <Route path="/checkout" element={withSuspense(<CheckoutPage />)} />
      </Route>

      <Route element={<ProtectedLayout />}>
        <Route path="/orders" element={withSuspense(<OrdersPage />)} />
        <Route path="/order-history" element={withSuspense(<CustomerHistoryPage />)} />
        <Route path="/profile" element={withSuspense(<ProfilePage />)} />
        <Route path="/routes" element={withSuspense(<RoutesPage />)} />
        <Route path="/live-map" element={withSuspense(<LiveMapPage />)} />
        <Route path="/dispatch" element={withSuspense(<DispatchConsolePage />)} />
        <Route path="/analytics" element={withSuspense(<AnalyticsPage />)} />
        <Route path="/notifications" element={withSuspense(<NotificationsPage />)} />
        <Route path="/support" element={withSuspense(<SupportTicketsPage />)} />
        <Route path="/approvals" element={withSuspense(<ApprovalInboxPage />)} />
        <Route path="/audit-logs" element={withSuspense(<AuditLogsPage />)} />
        <Route path="/demo-scenario" element={withSuspense(<DemoScenarioPage />)} />
        <Route path="/badge-pricing" element={withSuspense(<BadgePricingPage />)} />
        <Route path="/driver-hub" element={withSuspense(<DriverHubPage />)} />
        <Route path="/driver-earnings" element={withSuspense(<DriverEarningsPage />)} />
        <Route path="/drivers" element={withSuspense(<DriversPage />)} />
        <Route path="/users" element={withSuspense(<UsersPage />)} />
        <Route path="/promo-codes" element={withSuspense(<MarketPromoCodesPage />)} />

        <Route path="/markets">
          <Route index element={withSuspense(<MarketsPage />)} />
          <Route path=":marketId" element={withSuspense(<MarketSettingsPage />)} />
          <Route path=":marketId/dashboard" element={withSuspense(<MarketDashboardPage />)} />
          <Route path=":marketId/items" element={withSuspense(<MarketItemsPage />)} />
          <Route path=":marketId/inventory-alerts" element={withSuspense(<InventoryAlertsPage />)} />
          <Route path=":marketId/promo-codes" element={withSuspense(<MarketPromoCodesPage />)} />
        </Route>

        <Route path="/my-markets" element={withSuspense(<MyMarketsPage />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
