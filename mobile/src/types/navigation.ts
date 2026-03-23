export type RootStackParamList = {
  Home: undefined;
  PublicMarkets: undefined;
  PublicMarket: { marketId: string };
  Login: undefined;
  Checkout: undefined;
  Orders: undefined;
  Routes: undefined;
  LiveMap: undefined;
  Analytics: undefined;
  DriverHub: undefined;
  Drivers: undefined;
  Users: undefined;
  Markets: undefined;
  MyMarkets: undefined;
  MarketSettings: { marketId: string };
  MarketItems: { marketId: string };
  MarketPromoCodes: { marketId: string };
};

export type PublicRouteName = "PublicMarkets" | "PublicMarket" | "Login" | "Home";

export type ProtectedRouteName = Exclude<keyof RootStackParamList, PublicRouteName>;
