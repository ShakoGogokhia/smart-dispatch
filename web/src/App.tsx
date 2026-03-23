import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import AppLayout from "@/components/AppLayout";
import RequireAuth from "@/components/RequireAuth";

import AnalyticsPage from "@/pages/AnalyticsPage";
import CheckoutPage from "@/pages/CheckoutPage";
import LiveMapPage from "@/pages/LiveMapPage";
import LoginPage from "@/pages/LoginPage";
import MarketItemsPage from "@/pages/MarketItemsPage";
import MarketPromoCodesPage from "@/pages/MarketPromoCodesPage";
import MarketSettingsPage from "@/pages/MarketSettingsPage";
import MarketsPage from "@/pages/MarketsPage";
import MyMarketsPage from "@/pages/MyMarketsPage";
import OrdersPage from "@/pages/OrdersPage";
import RoutesPage from "@/pages/RoutesPage";
import UsersPage from "@/pages/UsersPage";
import PublicMarketPage from "@/pages/public/PublicMarketPage";
import PublicMarketsPage from "@/pages/public/PublicMarketsPage";

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
      <Route path="/" element={<PublicMarketsPage />} />
      <Route path="/m/:marketId" element={<PublicMarketPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/routes" element={<RoutesPage />} />
        <Route path="/live-map" element={<LiveMapPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/users" element={<UsersPage />} />

        <Route path="/markets">
          <Route index element={<MarketsPage />} />
          <Route path=":marketId" element={<MarketSettingsPage />} />
          <Route path=":marketId/items" element={<MarketItemsPage />} />
          <Route path=":marketId/promo-codes" element={<MarketPromoCodesPage />} />
        </Route>

        <Route path="/my-markets" element={<MyMarketsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
