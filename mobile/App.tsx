import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/src/providers/app-providers";
import { RootNavigator } from "@/src/navigation";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <StatusBar style="auto" />
        <RootNavigator />
      </AppProviders>
    </GestureHandlerRootView>
  );
}
