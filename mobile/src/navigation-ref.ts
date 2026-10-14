import { createNavigationContainerRef } from "@react-navigation/native";

import type { RootStackParamList } from "@/src/types/navigation";

/** Lets components outside a screen (e.g. the welcome tour) navigate. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
