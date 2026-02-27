import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  TextInput, Switch, Alert, ScrollView,
} from 'react-native';
import { theme } from '../theme';
import { getSettings, saveSettings } from '../utils/storage';
import { rebuildAllAlarms, cancelAllAlarms } from '../utils/alarmManager';

export default function SettingsScreen({ navigation }) {
  const [settings, setSettings] = useState({
    defaultRepeatInterval: 5,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

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
    Alert.alert(
      'Reconstruir alarmas',
      '¿Reprogramar todas las alarmas activas? Hacé esto si las alarmas dejaron de funcionar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reconstruir',
          onPress: async () => {
            await rebuildAllAlarms();
            Alert.alert('Listo', 'Todas las alarmas fueron reprogramadas.');
          },
        },
      ]
    );
  }

  function updateField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

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
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>GENERAL</Text>

          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowTitle}>Repetición por defecto</Text>
              <Text style={styles.rowSub}>Minutos entre repeticiones si no se confirma</Text>
            </View>
            <TextInput
              style={styles.numberInput}
              value={String(settings.defaultRepeatInterval)}
              onChangeText={(v) => updateField('defaultRepeatInterval', parseInt(v) || 5)}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MANTENIMIENTO</Text>

          <TouchableOpacity style={styles.actionBtn} onPress={rebuildAll}>
            <Text style={styles.actionIcon}>🔄</Text>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Reconstruir alarmas</Text>
              <Text style={styles.actionSub}>Reprogramar todas las alarmas activas</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACERCA DE</Text>
          <View style={styles.aboutBox}>
            <Text style={styles.appName}>📅 Agenda Voz</Text>
            <Text style={styles.appVersion}>Versión 1.0.0</Text>
            <Text style={styles.appDesc}>
              Tu agenda personal con recordatorios en tu propia voz.
              {'\n\n'}Creada con React Native / Expo.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backBtn: { padding: 8 },
  backText: { color: theme.colors.primary, fontSize: theme.fontSize.md },
  headerTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.radius.round,
  },
  saveBtnSaved: { backgroundColor: theme.colors.success },
  saveText: { color: '#fff', fontWeight: '700' },
  scroll: { flex: 1 },
  section: {
    margin: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  sectionLabel: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rowInfo: { flex: 1, marginRight: 16 },
  rowTitle: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '600' },
  rowSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  numberInput: {
    width: 64,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: 10,
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    textAlign: 'center',
    fontWeight: '700',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  actionIcon: { fontSize: 24 },
  actionInfo: { flex: 1 },
  actionTitle: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '600' },
  actionSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  aboutBox: { alignItems: 'center', paddingVertical: 8 },
  appName: { fontSize: 28, marginBottom: 4 },
  appVersion: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: 12 },
  appDesc: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
