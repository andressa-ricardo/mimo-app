import {
  AndroidImportance,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  getExactAlarmPermissionsAsync,
  getPermissionsAsync,
  requestExactAlarmPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
  setNotificationHandler,
  type NotificationPermissionsStatus,
} from "expo-notifications";
import { Platform } from "react-native";

export const TASK_CHANNEL_ID = "task-reminders";
export const BILL_CHANNEL_ID = "bill-reminders";

export const TASK_REMINDER_KIND = "task-reminder";
export const BILL_REMINDER_KIND = "bill-reminder";
export const APPOINTMENT_REMINDER_KIND = "appointment-reminder";

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

let channelsAvailable = Platform.OS === "android";
/** Channels are created once per session; a failure is not retried (or re-logged). */
let channelsAttempted = false;

/**
 * Creates the Android channels. Expo Go on Android rejects this call (its
 * scoped channel manager fails to read the channel back), so a failure is not
 * fatal: reminders then use the default channel instead.
 */
async function ensureChannels(): Promise<void> {
  if (Platform.OS !== "android" || channelsAttempted) return;
  channelsAttempted = true;
  try {
    await setNotificationChannelAsync(TASK_CHANNEL_ID, {
      name: "Lembretes de tarefas",
      importance: AndroidImportance.HIGH,
    });
    await setNotificationChannelAsync(BILL_CHANNEL_ID, {
      name: "Vencimentos de contas",
      importance: AndroidImportance.DEFAULT,
    });
    channelsAvailable = true;
  } catch (error: unknown) {
    channelsAvailable = false;
    console.warn("Canais de notificação indisponíveis; usando o canal padrão.", error);
  }
}

/** The channel to schedule on, or undefined to fall back to the default one. */
export function channelFor(channelId: string): string | undefined {
  return channelsAvailable ? channelId : undefined;
}

/** Creates the Android channels (required before the prompt on Android 13+) and asks once. */
export async function ensureReminderPermission(): Promise<ReminderPermission> {
  if (Platform.OS === "web") return "unavailable";

  try {
    await ensureChannels();
    const current = await getPermissionsAsync();
    if (isGranted(current)) return "granted";
    if (!current.canAskAgain) return "denied";

    return isGranted(await requestPermissionsAsync()) ? "granted" : "denied";
  } catch (error: unknown) {
    console.warn("Notificações indisponíveis.", error);
    return "unavailable";
  }
}

/** True only when notifications are already allowed — never shows a prompt. */
export async function hasNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const granted = isGranted(await getPermissionsAsync());
    if (granted) await ensureChannels();
    return granted;
  } catch {
    return false;
  }
}

/** Resolves with the notification identifier only if scheduling succeeded. */
export async function scheduleTaskReminder(
  taskId: string,
  title: string,
  date: Date,
): Promise<string> {
  return scheduleNotificationAsync({
    content: {
      title: "Lembrete de tarefa",
      body: title,
      data: { kind: TASK_REMINDER_KIND, taskId },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date,
      channelId: channelFor(TASK_CHANNEL_ID),
    },
  });
}

export type ExactAlarmStatus = "exact" | "inexact" | "not-applicable";

/**
 * Android 12+ delivers reminders on time only with the exact-alarm
 * permission; without it the system may deliver them minutes late.
 */
export async function getExactAlarmStatus(): Promise<ExactAlarmStatus> {
  if (Platform.OS !== "android") return "not-applicable";
  try {
    return (await getExactAlarmPermissionsAsync()).granted ? "exact" : "inexact";
  } catch {
    return "not-applicable";
  }
}

/** Opens the system "Alarms & reminders" screen; resolves when the user returns. */
export async function requestExactAlarms(): Promise<"granted" | "denied" | "unsupported"> {
  try {
    return (await requestExactAlarmPermissionsAsync()).granted ? "granted" : "denied";
  } catch (error: unknown) {
    console.warn("Permissão de alarme exato indisponível.", error);
    return "unsupported";
  }
}

const TEST_DELAY_MS = 5000;

/** Schedules a notification a few seconds ahead to check the whole pipeline. */
export async function sendTestNotification(): Promise<ReminderPermission> {
  const permission = await ensureReminderPermission();
  if (permission !== "granted") return permission;
  await scheduleNotificationAsync({
    content: {
      title: "Notificação de teste",
      body: "Tudo certo! Os lembretes do Mimo estão funcionando.",
      data: { kind: "test" },
    },
    trigger: {
      type: SchedulableTriggerInputTypes.DATE,
      date: Date.now() + TEST_DELAY_MS,
      channelId: channelFor(TASK_CHANNEL_ID),
    },
  });
  return "granted";
}

export async function cancelTaskReminder(
  notificationId: string,
): Promise<void> {
  await cancelScheduledNotificationAsync(notificationId);
}

/**
 * Cancels every scheduled notification of a kind. Task reminders created
 * before `kind` existed are recognized by their `taskId`.
 */
export async function cancelScheduledByKind(kind: string): Promise<void> {
  if (Platform.OS === "web") return;
  const scheduled = await getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    const data = notification.content.data as Record<string, unknown> | null;
    const matches =
      data?.kind === kind ||
      (kind === TASK_REMINDER_KIND && data?.kind === undefined && typeof data?.taskId === "string");
    if (matches) await cancelScheduledNotificationAsync(notification.identifier);
  }
}
