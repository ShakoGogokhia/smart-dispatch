import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { LoadingBlock, Screen } from "@/src/components/ui";
import { useMe } from "@/src/lib/use-me";
import { useAuth } from "@/src/providers/app-providers";
import type { ProtectedRouteName, RootStackParamList } from "@/src/types/navigation";

export function useProtectedAccess(routeName: ProtectedRouteName, params?: Record<string, unknown>) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { ready, token, setPendingRoute, signOut } = useAuth();
  const meQ = useMe(ready && !!token);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!token) {
      setPendingRoute({ name: routeName, params });
      navigation.replace("Login");
      return;
    }

    if (meQ.isError) {
      setPendingRoute({ name: routeName, params });
      void signOut().finally(() => {
        navigation.replace("Login");
      });
    }
  }, [meQ.isError, navigation, params, ready, routeName, setPendingRoute, signOut, token]);

  if (!ready || !token || meQ.isLoading) {
    return {
      ready: false,
      me: null,
      fallback: (
        <Screen>
          <LoadingBlock message="Checking workspace access..." />
        </Screen>
      ),
    };
  }

  if (meQ.isError || !meQ.data) {
    return {
      ready: false,
      me: null,
      fallback: (
        <Screen>
          <LoadingBlock message="Refreshing your session..." />
        </Screen>
      ),
    };
  }

  return {
    ready: true,
    me: meQ.data,
    fallback: null,
  };
}
