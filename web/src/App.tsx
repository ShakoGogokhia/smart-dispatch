import { Navigate, Route, Routes, Outlet } from "react-router-dom";

import RequireAuth from "@/components/RequireAuth";
import AppLayout from "@/components/AppLayout";

import LoginPage from "@/pages/LoginPage";

// protected existing pages
import OrdersPage from "@/pages/OrdersPage";
import RoutesPage from "@/pages/RoutesPage";
import LiveMapPage from "@/pages/LiveMapPage";
import AnalyticsPage from "@/pages/AnalyticsPage";

import MarketsPage from "./pages/MarketsPage";
import MyMarketsPage from "./pages/MyMarketsPage";
import MarketItemsPage from "./pages/MarketItemsPage";
import MarketPromoCodesPage from "./pages/MarketPromoCodesPage";
import MarketSettingsPage from "./pages/MarketSettingsPage";

// ✅ NEW public pages
import PublicMarketsPage from "./pages/public/PublicMarketsPage";
import PublicMarketPage from "./pages/public/PublicMarketPage";

// ✅ NEW protected checkout
import CheckoutPage from "@/pages/CheckoutPage";

function ProtectedLayout() {
  return (
    <RequireAuth>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ✅ PUBLIC */}
      <Route path="/" element={<PublicMarketsPage />} />
      <Route path="/m/:marketId" element={<PublicMarketPage />} />

      <Route path="/login" element={<LoginPage />} />

      {/* ✅ PROTECTED (requires login) */}
      <Route element={<ProtectedLayout />}>
        {/* customer */}
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<OrdersPage />} />

        {/* dispatch/admin */}
        <Route path="routes" element={<RoutesPage />} />
        <Route path="live-map" element={<LiveMapPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />

        {/* markets backoffice */}
        <Route path="markets">
          <Route index element={<MarketsPage />} />
          <Route path=":marketId" element={<MarketSettingsPage />} />
          <Route path=":marketId/items" element={<MarketItemsPage />} />
          <Route path=":marketId/promo-codes" element={<MarketPromoCodesPage />} />
        </Route>

        <Route path="my-markets" element={<MyMarketsPage />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}