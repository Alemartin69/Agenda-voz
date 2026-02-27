import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Switch, Alert, StatusBar, SafeAreaView, Animated
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { getItems, updateItem, deleteItem } from '../utils/storage';
import { scheduleItemAlarms, cancelItemAlarms } from '../utils/alarmManager';

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
// expo-notifications weekday: 1=Sunday, 2=Monday...7=Saturday
const DAY_LABELS = { 1: 'Dom', 2: 'Lun', 3: 'Mar', 4: 'Mié', 5: 'Jue', 6: 'Vie', 7: 'Sáb' };

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [])
  );

  async function loadItems() {
    setLoading(true);
    const data = await getItems();
    setItems(data);
    setLoading(false);
  }

  async function toggleActive(item) {
    const updated = { ...item, active: !item.active };
    await updateItem(updated);
    if (updated.active) {
      await scheduleItemAlarms(updated);
    } else {
      await cancelItemAlarms(updated.id);
    }
    setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
  }

  async function confirmDelete(item) {
    Alert.alert(
      'Eliminar recordatorio',
      `¿Eliminar "${item.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await cancelItemAlarms(item.id);
            await deleteItem(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          },
        },
      ]
    );
  }

  function formatDays(days) {
    if (!days || days.length === 0) return 'Sin días';
    if (days.length === 7) return 'Todos los días';
    if (days.length === 5 && [2, 3, 4, 5, 6].every((d) => days.includes(d)))
      return 'Lun - Vie';
    if (days.length === 2 && [1, 7].every((d) => days.includes(d)))
      return 'Fines de semana';
    return days.map((d) => DAY_LABELS[d]).join(', ');
  }

  const renderItem = ({ item, index }) => (
    <TouchableOpacity
      style={[styles.card, !item.active && styles.cardInactive]}
      onPress={() => navigation.navigate('AddEdit', { item })}
      onLongPress={() => confirmDelete(item)}
      activeOpacity={0.85}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.statusDot, { backgroundColor: item.active ? theme.colors.accent : theme.colors.textDim }]} />
        <View style={styles.cardInfo}>
          <Text style={[styles.itemName, !item.active && styles.textMuted]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={styles.metaText}>🕐 {item.schedule?.time || '--:--'}</Text>
            <Text style={styles.metaSep}>·</Text>
            <Text style={styles.metaText}>📅 {formatDays(item.schedule?.days)}</Text>
          </View>
          <View style={styles.itemMeta}>
            <Text style={styles.metaText}>🔄 Cada {item.repeatInterval || 5} min</Text>
            {item.audioUri ? (
              <>
                <Text style={styles.metaSep}>·</Text>
                <Text style={[styles.metaText, { color: theme.colors.accent }]}>🎙️ Audio grabado</Text>
              </>
            ) : (
              <>
                <Text style={styles.metaSep}>·</Text>
                <Text style={[styles.metaText, { color: theme.colors.warning }]}>⚠️ Sin audio</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <Switch
        value={item.active}
        onValueChange={() => toggleActive(item)}
        trackColor={{ false: theme.colors.border, true: theme.colors.primary + '88' }}
        thumbColor={item.active ? theme.colors.primary : theme.colors.textDim}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Agenda Voz</Text>
          <Text style={styles.headerSub}>
            {items.filter((i) => i.active).length} recordatorio{items.filter((i) => i.active).length !== 1 ? 's' : ''} activo{items.filter((i) => i.active).length !== 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Sin recordatorios</Text>
          <Text style={styles.emptyText}>
            Tocá el botón + para crear tu primer recordatorio con tu propia voz
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddEdit', { item: null })}
        activeOpacity={0.85}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Mantené presionado para eliminar</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginTop: 2,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: { fontSize: 20 },
  list: {
    padding: theme.spacing.md,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: theme.colors.cardBg,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardInactive: {
    opacity: 0.6,
  },
  cardLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  cardInfo: { flex: 1 },
  itemName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    marginBottom: 4,
  },
  textMuted: { color: theme.colors.textMuted },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
  },
  metaSep: {
    color: theme.colors.textDim,
    marginHorizontal: 4,
    fontSize: theme.fontSize.xs,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyIcon: { fontSize: 64, marginBottom: theme.spacing.lg },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xl,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  fab: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '300',
  },
  hint: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    color: theme.colors.textDim,
    fontSize: theme.fontSize.xs,
  },
});
