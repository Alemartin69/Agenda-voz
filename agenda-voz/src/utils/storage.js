import AsyncStorage from '@react-native-async-storage/async-storage';

const ITEMS_KEY = '@agenda_items';
const SETTINGS_KEY = '@agenda_settings';

export const defaultSettings = {
  defaultRepeatInterval: 5,
};

// ─── Agenda Items ─────────────────────────────────────────────────────────────

export async function getItems() {
  try {
    const raw = await AsyncStorage.getItem(ITEMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveItems(items) {
  await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export async function getItemById(id) {
  const items = await getItems();
  return items.find((i) => i.id === id) || null;
}

export async function addItem(item) {
  const items = await getItems();
  items.push(item);
  await saveItems(items);
}

export async function updateItem(updated) {
  const items = await getItems();
  const idx = items.findIndex((i) => i.id === updated.id);
  if (idx !== -1) {
    items[idx] = updated;
    await saveItems(items);
  }
}

export async function deleteItem(id) {
  const items = await getItems();
  await saveItems(items.filter((i) => i.id !== id));
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Active Alarms (alarms currently ringing) ────────────────────────────────

const ACTIVE_KEY = '@active_alarm';

export async function setActiveAlarm(data) {
  await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(data));
}

export async function getActiveAlarm() {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearActiveAlarm() {
  await AsyncStorage.removeItem(ACTIVE_KEY);
}
