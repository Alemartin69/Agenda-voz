import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, Alert, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { getItems, updateItem, deleteItem } from '../utils/storage';
import { scheduleItemAlarms, cancelItemAlarms } from '../utils/alarmManager';

const DAY_LABELS = { 1:'Dom', 2:'Lun', 3:'Mar', 4:'Mié', 5:'Jue', 6:'Vie', 7:'Sáb' };

const TIPO_CONFIG = {
  recordatorio: { icon: '🔔', color: '#6c63ff', label: 'Recordatorio' },
  vencimiento:  { icon: '📅', color: '#ffa502', label: 'Vencimiento' },
  peso:         { icon: '⚖️', color: '#2ed573', label: 'Peso' },
  comida:       { icon: '🍽️', color: '#ff6584', label: 'Comida' },
};

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);

  useFocusEffect(useCallback(() => { loadItems(); }, []));

  async function loadItems() {
    const data = await getItems();
    setItems(data);
  }

  async function toggleActive(item) {
    const updated = { ...item, active: !item.active };
    await updateItem(updated);
    if (updated.active) await scheduleItemAlarms(updated);
    else await cancelItemAlarms(updated.id);
    setItems(p => p.map(i => i.id === item.id ? updated : i));
  }

  async function confirmDelete(item) {
    Alert.alert('Eliminar', `¿Eliminar "${item.name}"?`,
      [{ text: 'Cancelar', style: 'cancel' },
       { text: 'Eliminar', style: 'destructive', onPress: async () => {
         await cancelItemAlarms(item.id);
         await deleteItem(item.id);
         setItems(p => p.filter(i => i.id !== item.id));
       }}]);
  }

  function formatDays(days) {
    if (!days?.length) return 'Sin días';
    if (days.length === 7) return 'Todos los días';
    if (days.length === 5 && [2,3,4,5,6].every(d => days.includes(d))) return 'Lun–Vie';
    if (days.length === 2 && [1,7].every(d => days.includes(d))) return 'Fin de semana';
    return days.map(d => DAY_LABELS[d]).join(', ');
  }

  function renderExtraInfo(item) {
    const tipo = item.tipo || 'recordatorio';
    if (tipo === 'peso' && item.peso) return `⚖️ ${item.peso} kg`;
    if (tipo === 'comida' && item.calorias) return `🔥 ${item.calorias} kcal`;
    if (tipo === 'comida' && item.ingredientes) return `🍽️ ${item.ingredientes.substring(0, 30)}...`;
    return null;
  }

  const renderItem = ({ item }) => {
    const tc = TIPO_CONFIG[item.tipo || 'recordatorio'];
    const extra = renderExtraInfo(item);
    return (
      <TouchableOpacity
        style={[styles.card, !item.active && styles.cardInactive]}
        onPress={() => navigation.navigate('AddEdit', { item })}
        onLongPress={() => confirmDelete(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.tipoBar, { backgroundColor: tc.color }]} />
        <View style={styles.cardLeft}>
          <Text style={styles.tipoIcon}>{tc.icon}</Text>
          <View style={styles.cardInfo}>
            <View style={styles.cardTopRow}>
              <Text style={[styles.itemName, !item.active && styles.textMuted]} numberOfLines={1}>{item.name}</Text>
              <View style={[styles.tipoBadge, { backgroundColor: tc.color + '22', borderColor: tc.color + '55' }]}>
                <Text style={[styles.tipoBadgeText, { color: tc.color }]}>{tc.label}</Text>
              </View>
            </View>
            <View style={styles.itemMeta}>
              <Text style={styles.metaText}>🕐 {item.schedule?.time || '--:--'}</Text>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>📅 {formatDays(item.schedule?.days)}</Text>
            </View>
            <View style={styles.itemMeta}>
              <Text style={styles.metaText}>🔄 {item.repeatInterval || 5} min</Text>
              {item.audioUri || item.audioFilePath
                ? <><Text style={styles.metaSep}>·</Text><Text style={[styles.metaText, { color: theme.colors.accent }]}>🎙️ Con audio</Text></>
                : <><Text style={styles.metaSep}>·</Text><Text style={[styles.metaText, { color: theme.colors.warning }]}>⚠️ Sin audio</Text></>
              }
            </View>
            {extra && (
              <View style={[styles.extraBadge, { backgroundColor: tc.color + '15' }]}>
                <Text style={[styles.extraText, { color: tc.color }]}>{extra}</Text>
              </View>
            )}
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
  };

  const activos = items.filter(i => i.active).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Agenda Voz</Text>
          <Text style={styles.headerSub}>{activos} recordatorio{activos !== 1 ? 's' : ''} activo{activos !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Sin recordatorios</Text>
          <Text style={styles.emptyText}>Tocá el botón + para crear tu primer recordatorio</Text>
        </View>
      ) : (
        <FlatList data={items} keyExtractor={i => i.id} renderItem={renderItem} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddEdit', { item: null })} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Mantené presionado para eliminar</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md },
  headerTitle: { color: theme.colors.text, fontSize: theme.fontSize.xxl, fontWeight: '800' },
  headerSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginTop: 2 },
  settingsBtn: { width: 44, height: 44, borderRadius: theme.radius.round, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  settingsIcon: { fontSize: 20 },
  list: { padding: theme.spacing.md, paddingBottom: 100 },
  card: { backgroundColor: theme.colors.cardBg, borderRadius: theme.radius.lg, marginBottom: theme.spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  cardInactive: { opacity: 0.55 },
  tipoBar: { width: 4, alignSelf: 'stretch' },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md },
  tipoIcon: { fontSize: 26, marginRight: 10 },
  cardInfo: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  itemName: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '700', flex: 1, marginRight: 8 },
  textMuted: { color: theme.colors.textMuted },
  tipoBadge: { borderRadius: theme.radius.round, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  tipoBadgeText: { fontSize: theme.fontSize.xs, fontWeight: '700' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  metaText: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  metaSep: { color: theme.colors.textDim, marginHorizontal: 4, fontSize: theme.fontSize.xs },
  extraBadge: { marginTop: 6, borderRadius: theme.radius.sm, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  extraText: { fontSize: theme.fontSize.xs, fontWeight: '700' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xl },
  emptyIcon: { fontSize: 64, marginBottom: theme.spacing.lg },
  emptyTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '700', marginBottom: theme.spacing.sm },
  emptyText: { color: theme.colors.textMuted, fontSize: theme.fontSize.md, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', bottom: 40, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36, fontWeight: '300' },
  hint: { position: 'absolute', bottom: 16, alignSelf: 'center', color: theme.colors.textDim, fontSize: theme.fontSize.xs },
});
