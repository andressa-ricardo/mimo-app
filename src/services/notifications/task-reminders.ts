import {
  AndroidImportance,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationPermissionsStatus,
} from "expo-notifications";
import { Platform } from "react-native";

const TASK_CHANNEL_ID = "task-reminders";

export type ReminderPermission = "granted" | "denied" | "unavailable";

export function configureNotifications(): void {
  if (Platform.OS === "web") return;

  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

function isGranted(status: NotificationPermissionsStatus): boolean {
  return (
    status.granted || status.ios?.status === IosAuthorizationStatus.PROVISIONAL
  );
}

/** Creates the Android channel (required before the prompt on Android 13+) and asks once. */
export async function ensureReminderPermission(): Promise<ReminderPermission> {
  if (Platform.OS === "web") return "unavailable";

  try {
    if (Platform.OS === "android") {
      await setNotificationChannelAsync(TASK_CHANNEL_ID, {
        name: "Lembretes de tarefas",
        importance: AndroidImportance.HIGH,
      });
    }

    const current = await getPermissionsAsync();
    if (isGranted(current)) return "granted";
    if (!current.canAskAgain) return "denied";

    return isGranted(await requestPermissionsAsync()) ? "granted" : "denied";
  } catch (error: unknown) {
    console.warn("Notificações indisponíveis.", error);
    return "unavailable";
  }
}

/** Resolves with the notification identifier only if scheduling succeeded. */
export async function scheduleTaskReminder(
  taskId: string,
  title: string,
  date: Date,
): Promise<string> {
  return scheduleNotificationAsync({
    content: { title: "Lembrete de tarefa", body: title, data: { taskId } },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date,
      channelId: TASK_CHANNEL_ID,
    },
  });
}

export async function cancelTaskReminder(
  notificationId: string,
): Promise<void> {
  await cancelScheduledNotificationAsync(notificationId);
}
