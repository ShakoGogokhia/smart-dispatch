import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";

import type { Order } from "@/src/types/api";

const DRIVER_CHANNEL_ID = "driver-offers";

let notificationsPrepared = false;

let notificationsModulePromise: Promise<typeof import("expo-notifications") | null> | null = null;
let notificationHandlerConfigured = false;

function shouldUseExpoNotifications() {
  if (Platform.OS === "web") {
    return false;
  }

  return Constants.executionEnvironment !== "storeClient";
}

async function getNotificationsModule() {
  if (!shouldUseExpoNotifications()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications")
      .then((module) => module)
      .catch(() => null);
  }

  const Notifications = await notificationsModulePromise;

  if (!Notifications || notificationHandlerConfigured) {
    return Notifications;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  notificationHandlerConfigured = true;

  return Notifications;
}

export async function prepareLocalNotifications() {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return;
  }

  if (notificationsPrepared) {
    return;
  }

  notificationsPrepared = true;

  const permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    await Notifications.requestPermissionsAsync();
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(DRIVER_CHANNEL_ID, {
      name: "Driver offers",
      description: "Alerts for newly assigned dispatch offers",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 260, 180, 260],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: "default",
    });
  }
}

export async function notifyIncomingOffer(order: Order) {
  const Notifications = await getNotificationsModule();

  if (!Notifications) {
    return;
  }

  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
    // Keep alerts resilient even if haptics are unavailable.
  });

  const permissions = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permissions?.granted) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "New delivery offer",
      body: `${order.code} • ${order.dropoff_address || "No dropoff address"}`,
      data: { orderId: order.id, screen: "DriverHub" },
      sound: "default",
    },
    trigger:
      Platform.OS === "android"
        ? {
            channelId: DRIVER_CHANNEL_ID,
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 1,
          }
        : null,
  }).catch(() => {
    // The in-app alert still covers the UX if scheduling fails.
  });
}
