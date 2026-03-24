import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import AppLayout from "@/components/AppLayout";
import RequireAuth from "@/components/RequireAuth";

const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const DriverHubPage = lazy(() => import("@/pages/DriverHubPage"));
const DriversPage = lazy(() => import("@/pages/DriversPage"));
const LiveMapPage = lazy(() => import("@/pages/LiveMapPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const MarketItemsPage = lazy(() => import("@/pages/MarketItemsPage"));
const MarketPromoCodesPage = lazy(() => import("@/pages/MarketPromoCodesPage"));
const MarketSettingsPage = lazy(() => import("@/pages/MarketSettingsPage"));
const MarketsPage = lazy(() => import("@/pages/MarketsPage"));
const MyMarketsPage = lazy(() => import("@/pages/MyMarketsPage"));
const OrdersPage = lazy(() => import("@/pages/OrdersPage"));
const RoutesPage = lazy(() => import("@/pages/RoutesPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const PublicMarketPage = lazy(() => import("@/pages/public/PublicMarketPage"));
const PublicMarketsPage = lazy(() => import("@/pages/public/PublicMarketsPage"));

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </RequireAuth>
  );
}

function PageLoader() {
  return (
    <div className="app-shell">
      <div className="mx-auto max-w-7xl">
        <div className="dashboard-card p-8 text-sm text-slate-600 dark:text-slate-300">Loading page...</div>
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
      <Route path="/m/:marketId" element={withSuspense(<PublicMarketPage />)} />
      <Route path="/login" element={withSuspense(<LoginPage />)} />

      <Route element={<ProtectedLayout />}>
        <Route path="/checkout" element={withSuspense(<CheckoutPage />)} />
        <Route path="/orders" element={withSuspense(<OrdersPage />)} />
        <Route path="/routes" element={withSuspense(<RoutesPage />)} />
        <Route path="/live-map" element={withSuspense(<LiveMapPage />)} />
        <Route path="/analytics" element={withSuspense(<AnalyticsPage />)} />
        <Route path="/driver-hub" element={withSuspense(<DriverHubPage />)} />
        <Route path="/drivers" element={withSuspense(<DriversPage />)} />
        <Route path="/users" element={withSuspense(<UsersPage />)} />

        <Route path="/markets">
          <Route index element={withSuspense(<MarketsPage />)} />
          <Route path=":marketId" element={withSuspense(<MarketSettingsPage />)} />
          <Route path=":marketId/items" element={withSuspense(<MarketItemsPage />)} />
          <Route path=":marketId/promo-codes" element={withSuspense(<MarketPromoCodesPage />)} />
        </Route>

        <Route path="/my-markets" element={withSuspense(<MyMarketsPage />)} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
