import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import { getItems, getActiveAlarm, setActiveAlarm, clearActiveAlarm } from './storage';

export const ALARM_TASK = 'AGENDA_ALARM_TASK';
export const CHANNEL_ID = 'alarms';

// ─── Configuración de notificaciones ─────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

export async function setupNotifications() {
  // Crear canal de alta prioridad en Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alarmas de Agenda',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500, 200, 500],
      lightColor: '#6c63ff',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true,
    });
  }

  const { status } = await Notifications.requestPermissionsAsync({
    android: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === 'granted';
}

// ─── Programar alarmas semanales ──────────────────────────────────────────────

export async function scheduleItemAlarms(item) {
  // Cancelar alarmas anteriores del item
  await cancelItemAlarms(item.id);

  if (!item.active || !item.schedule?.days?.length) return;

  const [hours, minutes] = item.schedule.time.split(':').map(Number);

  for (const day of item.schedule.days) {
    // day: 1=Lunes ... 7=Domingo (ISO weekday)
    await Notifications.scheduleNotificationAsync({
      identifier: `${item.id}_day${day}`,
      content: {
        title: '🔔 ' + item.name,
        body: 'Toca para escuchar tu recordatorio',
        data: { itemId: item.id, type: 'agenda_alarm' },
        sound: 'default',
        priority: 'max',
        vibrate: [0, 500, 200, 500],
        android: {
          channelId: CHANNEL_ID,
          priority: 'max',
          sound: 'default',
          vibrationPattern: [0, 500, 200, 500],
          color: '#6c63ff',
          actions: [
            { identifier: 'UNDERSTOOD', buttonTitle: '✅ Entendido', isDestructive: false },
          ],
        },
      },
      trigger: {
        weekday: day, // expo-notifications: 1=Sunday, 2=Monday... adjustamos abajo
        hour: hours,
        minute: minutes,
        repeats: true,
      },
    });
  }
}

export async function cancelItemAlarms(itemId) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(itemId)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function cancelAllAlarms() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Reschedule repetición (cuando no presionaron Entendido) ──────────────────

export async function scheduleRepeatAlarm(itemId, repeatMinutes) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + repeatMinutes);

  await Notifications.scheduleNotificationAsync({
    identifier: `${itemId}_repeat_${Date.now()}`,
    content: {
      title: '🔔 Recordatorio pendiente',
      body: 'Aún no confirmaste este recordatorio',
      data: { itemId, type: 'agenda_repeat' },
      sound: 'default',
      priority: 'max',
      android: {
        channelId: CHANNEL_ID,
        priority: 'max',
        color: '#ff6584',
      },
    },
    trigger: { date: now },
  });
}

export async function cancelRepeatAlarms(itemId) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.identifier.startsWith(`${itemId}_repeat`)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

// ─── Reconstruir todas las alarmas al iniciar la app ──────────────────────────

export async function rebuildAllAlarms() {
  await cancelAllAlarms();
  const items = await getItems();
  for (const item of items) {
    if (item.active) {
      await scheduleItemAlarms(item);
    }
  }
}
