import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { usePreferences } from "@/src/providers/app-providers";
import type { RootStackParamList } from "@/src/types/navigation";
import { HomeScreen, LoginScreen, PublicMarketScreen, PublicMarketsScreen, CheckoutScreen } from "@/src/screens/public";
import { AnalyticsScreen, LiveMapScreen, OrdersScreen, RoutesScreen } from "@/src/screens/operations";
import { DriverHubScreen } from "@/src/screens/driver";
import { DriversScreen, MarketsScreen, MyMarketsScreen, UsersScreen } from "@/src/screens/admin-core";
import { MarketItemsScreen, MarketPromoCodesScreen, MarketSettingsScreen } from "@/src/screens/market-management";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { theme } = usePreferences();

  return (
    <NavigationContainer theme={theme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="PublicMarkets" component={PublicMarketsScreen} />
        <Stack.Screen name="PublicMarket" component={PublicMarketScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} />
        <Stack.Screen name="Orders" component={OrdersScreen} />
        <Stack.Screen name="Routes" component={RoutesScreen} />
        <Stack.Screen name="LiveMap" component={LiveMapScreen} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} />
        <Stack.Screen name="DriverHub" component={DriverHubScreen} />
        <Stack.Screen name="Drivers" component={DriversScreen} />
        <Stack.Screen name="Users" component={UsersScreen} />
        <Stack.Screen name="Markets" component={MarketsScreen} />
        <Stack.Screen name="MyMarkets" component={MyMarketsScreen} />
        <Stack.Screen name="MarketSettings" component={MarketSettingsScreen} />
        <Stack.Screen name="MarketItems" component={MarketItemsScreen} />
        <Stack.Screen name="MarketPromoCodes" component={MarketPromoCodesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
