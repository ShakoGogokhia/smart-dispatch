import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { AppProviders, usePreferences } from "@/src/providers/app-providers";
import { RootNavigator } from "@/src/navigation";
import { WelcomeTourProvider } from "@/src/components/welcome-tour";

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppProviders>
        <WelcomeTourProvider>
          <ThemedStatusBar />
          <RootNavigator />
        </WelcomeTourProvider>
      </AppProviders>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { theme } = usePreferences();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}
