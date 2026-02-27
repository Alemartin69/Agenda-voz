import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView, Alert } from 'react-native';
import { theme } from '../theme';
import { getSettings, saveSettings } from '../utils/storage';
import { rebuildAllAlarms } from '../utils/alarmManager';

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState({ defaultRepeatInterval: 5, anthropicApiKey: '' });
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    const s = await getSettings();
    setSettings(s);
  }

  async function save() {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function rebuildAll() {
    Alert.alert('Reconstruir alarmas', '¿Reprogramar todas las alarmas activas?',
      [{ text: 'Cancelar', style: 'cancel' },
       { text: 'Reconstruir', onPress: async () => { await rebuildAllAlarms(); Alert.alert('Listo', 'Alarmas reprogramadas.'); } }]);
  }

  function update(key, val) { setSettings(p => ({ ...p, [key]: val })); }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <TouchableOpacity onPress={save} style={[styles.saveBtn, saved && styles.saveBtnSaved]}>
          <Text style={styles.saveText}>{saved ? '✓ Guardado' : 'Guardar'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll}>

        {/* IA - API Key */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>🤖 INTELIGENCIA ARTIFICIAL</Text>
          <Text style={styles.sectionSub}>
            Para calcular calorías de comidas necesitás una API Key de Anthropic (Claude).{'\n'}
            Obtenela gratis en: console.anthropic.com
          </Text>
          <Text style={styles.fieldLabel}>API Key de Anthropic</Text>
          <View style={styles.apiKeyRow}>
            <TextInput
              style={styles.apiKeyInput}
              value={settings.anthropicApiKey || ''}
              onChangeText={v => update('anthropicApiKey', v)}
              placeholder="sk-ant-..."
              placeholderTextColor={theme.colors.textDim}
              secureTextEntry={!showKey}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowKey(s => !s)}>
              <Text style={styles.eyeIcon}>{showKey ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {settings.anthropicApiKey ? (
            <Text style={styles.apiKeyOk}>✅ API Key configurada</Text>
          ) : (
            <Text style={styles.apiKeyWarning}>⚠️ Sin API Key — el cálculo de calorías no estará disponible</Text>
          )}
        </View>

        {/* General */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GENERAL</Text>
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Repetición por defecto</Text>
              <Text style={styles.rowSub}>Minutos entre repeticiones</Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={String(settings.defaultRepeatInterval)}
              onChangeText={v => update('defaultRepeatInterval', parseInt(v) || 5)}
              keyboardType="numeric" maxLength={3}
            />
          </View>
        </View>

        {/* Mantenimiento */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MANTENIMIENTO</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={rebuildAll}>
            <Text style={styles.actionIcon}>🔄</Text>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Reconstruir alarmas</Text>
              <Text style={styles.actionSub}>Si las alarmas dejaron de funcionar</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Acerca de */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACERCA DE</Text>
          <View style={styles.aboutBox}>
            <Text style={styles.appName}>📅 Agenda Voz</Text>
            <Text style={styles.appVersion}>Versión 1.1.0</Text>
            <Text style={styles.appDesc}>Tu agenda personal con recordatorios en tu propia voz, registro de peso y cálculo de calorías con IA.</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { padding: 8 },
  backText: { color: theme.colors.primary, fontSize: theme.fontSize.md },
  headerTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' },
  saveBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.radius.round },
  saveBtnSaved: { backgroundColor: theme.colors.success },
  saveText: { color: '#fff', fontWeight: '700' },
  scroll: { flex: 1 },
  section: { margin: theme.spacing.md, marginBottom: 0, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  sectionLabel: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: '700', letterSpacing: 1.5, marginBottom: theme.spacing.sm },
  sectionSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.md, lineHeight: 18 },
  fieldLabel: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600', marginBottom: 6 },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  apiKeyInput: { flex: 1, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing.sm, color: theme.colors.text, fontSize: theme.fontSize.sm, borderWidth: 1, borderColor: theme.colors.border },
  eyeBtn: { width: 40, height: 40, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  eyeIcon: { fontSize: 18 },
  apiKeyOk: { color: theme.colors.success, fontSize: theme.fontSize.xs, marginTop: 6 },
  apiKeyWarning: { color: theme.colors.warning, fontSize: theme.fontSize.xs, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  rowInfo: { flex: 1, marginRight: 16 },
  rowTitle: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '600' },
  rowSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  numberInput: { width: 64, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.sm, padding: 10, color: theme.colors.text, fontSize: theme.fontSize.lg, textAlign: 'center', fontWeight: '700', borderWidth: 1, borderColor: theme.colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  actionIcon: { fontSize: 24 },
  actionInfo: { flex: 1 },
  actionTitle: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '600' },
  actionSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  aboutBox: { alignItems: 'center', paddingVertical: 8 },
  appName: { fontSize: 28, marginBottom: 4 },
  appVersion: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: 8 },
  appDesc: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, textAlign: 'center', lineHeight: 20 },
});
