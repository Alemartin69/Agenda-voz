import AsyncStorage from '@react-native-async-storage/async-storage';

const ITEMS_KEY    = '@agenda_items';
const SETTINGS_KEY = '@agenda_settings';
const REGISTROS_KEY = '@registros_diarios';

export const defaultSettings = {
  defaultRepeatInterval: 5,
  openaiApiKey: '',
};

// ─── Agenda Items (alarmas / recordatorios) ───────────────────────────────────
export async function getItems() {
  try { const r = await AsyncStorage.getItem(ITEMS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
export async function saveItems(items) { await AsyncStorage.setItem(ITEMS_KEY, JSON.stringify(items)); }
export async function getItemById(id) { const items = await getItems(); return items.find(i => i.id === id) || null; }
export async function addItem(item) { const items = await getItems(); items.push(item); await saveItems(items); }
export async function updateItem(updated) { const items = await getItems(); const idx = items.findIndex(i => i.id === updated.id); if (idx !== -1) { items[idx] = updated; await saveItems(items); } }
export async function deleteItem(id) { const items = await getItems(); await saveItems(items.filter(i => i.id !== id)); }

// ─── Registros diarios (peso / comida) ───────────────────────────────────────
export async function getRegistros() {
  try { const r = await AsyncStorage.getItem(REGISTROS_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
export async function saveRegistros(registros) { await AsyncStorage.setItem(REGISTROS_KEY, JSON.stringify(registros)); }
export async function addRegistro(registro) {
  const registros = await getRegistros();
  registros.unshift(registro); // más reciente primero
  await saveRegistros(registros);
}
export async function deleteRegistro(id) {
  const registros = await getRegistros();
  await saveRegistros(registros.filter(r => r.id !== id));
}

// ─── Settings ────────────────────────────────────────────────────────────────
export async function getSettings() {
  try { const r = await AsyncStorage.getItem(SETTINGS_KEY); return r ? { ...defaultSettings, ...JSON.parse(r) } : defaultSettings; } catch { return defaultSettings; }
}
export async function saveSettings(s) { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

// ─── Active Alarm ─────────────────────────────────────────────────────────────
const ACTIVE_KEY = '@active_alarm';
export async function setActiveAlarm(data) { await AsyncStorage.setItem(ACTIVE_KEY, JSON.stringify(data)); }
export async function getActiveAlarm() { try { const r = await AsyncStorage.getItem(ACTIVE_KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
export async function clearActiveAlarm() { await AsyncStorage.removeItem(ACTIVE_KEY); }
