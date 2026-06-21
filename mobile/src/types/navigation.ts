export type RootStackParamList = {
  Home: undefined;
  PublicMarkets: undefined;
  PublicMarket: { marketId: string };
  Login: { mode?: "login" | "register" } | undefined;
  Checkout: undefined;
  Profile: undefined;
  Orders: undefined;
  Routes: undefined;
  LiveMap: undefined;
  Analytics: undefined;
  OrderTracking: { code?: string } | undefined;
  DriverHub: undefined;
  DriverEarnings: undefined;
  Drivers: undefined;
  Users: undefined;
  Markets: undefined;
  MyMarkets: undefined;
  MarketSettings: { marketId: string };
  MarketItems: { marketId: string };
  MarketPromoCodes: { marketId: string };
};

export type PublicRouteName = "PublicMarkets" | "PublicMarket" | "Login" | "Home" | "OrderTracking";

export type ProtectedRouteName = Exclude<keyof RootStackParamList, PublicRouteName>;
