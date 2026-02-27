import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, Alert, SafeAreaView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { getItems, updateItem, deleteItem } from '../utils/storage';
import { scheduleItemAlarms, cancelItemAlarms } from '../utils/alarmManager';

const DAY_LABELS = { 1:'Dom', 2:'Lun', 3:'Mar', 4:'Mié', 5:'Jue', 6:'Vie', 7:'Sáb' };
const DAY_ORDER  = [2,3,4,5,6,7,1];

const TIPO_CONFIG = {
  recordatorio: { icon: '🔔', color: '#6c63ff', label: 'Recordatorio' },
  vencimiento:  { icon: '📅', color: '#ffa502', label: 'Vencimiento' },
};

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [viewMode, setViewMode] = useState('agenda'); // 'agenda' | 'lista'

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
    Alert.alert('Eliminar', `¿Eliminar "${item.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await cancelItemAlarms(item.id);
        await deleteItem(item.id);
        setItems(p => p.filter(i => i.id !== item.id));
      }},
    ]);
  }

  function formatDays(days) {
    if (!days?.length) return 'Sin días';
    if (days.length === 7) return 'Todos los días';
    if (days.length === 5 && [2,3,4,5,6].every(d => days.includes(d))) return 'Lun–Vie';
    if (days.length === 2 && [1,7].every(d => days.includes(d))) return 'Fin de semana';
    return days.sort((a,b)=>DAY_ORDER.indexOf(a)-DAY_ORDER.indexOf(b)).map(d => DAY_LABELS[d]).join(', ');
  }

  // ─── Modo Agenda: agrupar por día ───────────────────────────────────────────
  function buildAgenda() {
    const agenda = [];
    for (const dayId of DAY_ORDER) {
      const dayItems = items
        .filter(i => i.schedule?.days?.includes(dayId))
        .sort((a,b) => (a.schedule?.time || '').localeCompare(b.schedule?.time || ''));
      if (dayItems.length > 0) {
        agenda.push({ type: 'header', dayId, label: getDayFull(dayId), key: `h${dayId}` });
        dayItems.forEach(item => agenda.push({ type: 'item', item, key: `i${item.id}d${dayId}` }));
      }
    }
    return agenda;
  }

  function getDayFull(id) {
    return { 1:'Domingo', 2:'Lunes', 3:'Martes', 4:'Miércoles', 5:'Jueves', 6:'Viernes', 7:'Sábado' }[id];
  }

  function isToday(dayId) {
    const today = new Date().getDay(); // 0=Sun
    const map = { 0:1, 1:2, 2:3, 3:4, 4:5, 5:6, 6:7 };
    return map[today] === dayId;
  }

  const renderAgendaRow = ({ item: row }) => {
    if (row.type === 'header') {
      const today = isToday(row.dayId);
      return (
        <View style={[styles.agendaHeader, today && styles.agendaHeaderToday]}>
          <Text style={[styles.agendaHeaderText, today && styles.agendaHeaderTextToday]}>
            {today ? '📍 ' : ''}{row.label}
          </Text>
          {today && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>HOY</Text></View>}
        </View>
      );
    }
    const { item } = row;
    const tc = TIPO_CONFIG[item.tipo || 'recordatorio'];
    return (
      <TouchableOpacity
        style={[styles.agendaCard, !item.active && styles.cardInactive]}
        onPress={() => navigation.navigate('AddEdit', { item })}
        onLongPress={() => confirmDelete(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.timeBlock, { borderLeftColor: tc.color }]}>
          <Text style={[styles.timeText, { color: tc.color }]}>{item.schedule?.time || '--:--'}</Text>
          <Text style={styles.tipoIcon}>{tc.icon}</Text>
        </View>
        <View style={styles.agendaCardBody}>
          <Text style={[styles.agendaItemName, !item.active && styles.textMuted]} numberOfLines={1}>{item.name}</Text>
          <View style={styles.agendaMeta}>
            <Text style={styles.metaText}>🔄 c/{item.repeatInterval||5}min</Text>
            {(item.audioUri||item.audioFilePath)
              ? <Text style={[styles.metaText,{color:theme.colors.accent,marginLeft:8}]}>🎙️ Audio</Text>
              : <Text style={[styles.metaText,{color:theme.colors.warning,marginLeft:8}]}>⚠️ Sin audio</Text>}
          </View>
        </View>
        <Switch
          value={item.active}
          onValueChange={() => toggleActive(item)}
          trackColor={{ false: theme.colors.border, true: tc.color + '88' }}
          thumbColor={item.active ? tc.color : theme.colors.textDim}
        />
      </TouchableOpacity>
    );
  };

  const renderListCard = ({ item }) => {
    const tc = TIPO_CONFIG[item.tipo || 'recordatorio'];
    return (
      <TouchableOpacity
        style={[styles.listCard, !item.active && styles.cardInactive]}
        onPress={() => navigation.navigate('AddEdit', { item })}
        onLongPress={() => confirmDelete(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.tipoBar, { backgroundColor: tc.color }]} />
        <View style={styles.listCardContent}>
          <View style={styles.listCardTop}>
            <Text style={styles.tipoIconLg}>{tc.icon}</Text>
            <Text style={[styles.listItemName, !item.active && styles.textMuted]} numberOfLines={1}>{item.name}</Text>
            <Switch value={item.active} onValueChange={() => toggleActive(item)}
              trackColor={{ false: theme.colors.border, true: tc.color+'88' }}
              thumbColor={item.active ? tc.color : theme.colors.textDim} />
          </View>
          <Text style={styles.listMeta}>🕐 {item.schedule?.time} · 📅 {formatDays(item.schedule?.days)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const agendaData  = buildAgenda();
  const activos     = items.filter(i => i.active).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>📋 Agenda</Text>
          <Text style={styles.headerSub}>{activos} activo{activos!==1?'s':''} de {items.length}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Registros')}>
            <Text style={styles.iconBtnText}>📊</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.iconBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toggle vista */}
      <View style={styles.viewToggle}>
        <TouchableOpacity style={[styles.toggleBtn, viewMode==='agenda'&&styles.toggleBtnActive]} onPress={() => setViewMode('agenda')}>
          <Text style={[styles.toggleText, viewMode==='agenda'&&styles.toggleTextActive]}>📅 Por día</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, viewMode==='lista'&&styles.toggleBtnActive]} onPress={() => setViewMode('lista')}>
          <Text style={[styles.toggleText, viewMode==='lista'&&styles.toggleTextActive]}>📋 Lista</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Sin recordatorios</Text>
          <Text style={styles.emptyText}>Tocá + para crear tu primer recordatorio</Text>
        </View>
      ) : viewMode === 'agenda' ? (
        <FlatList
          data={agendaData}
          keyExtractor={r => r.key}
          renderItem={renderAgendaRow}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderListCard}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { color: theme.colors.text, fontSize: 26, fontWeight: '800' },
  headerSub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 20 },
  viewToggle: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: theme.colors.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: theme.colors.border },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: theme.colors.primary },
  toggleText: { color: theme.colors.textMuted, fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  // Agenda
  agendaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 6, paddingHorizontal: 4 },
  agendaHeaderToday: {},
  agendaHeaderText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  agendaHeaderTextToday: { color: theme.colors.primary },
  todayBadge: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  todayBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  agendaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.cardBg, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  timeBlock: { width: 64, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', borderLeftWidth: 4, paddingVertical: 12 },
  timeText: { fontSize: 15, fontWeight: '800' },
  tipoIcon: { fontSize: 16, marginTop: 4 },
  agendaCardBody: { flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  agendaItemName: { color: theme.colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  agendaMeta: { flexDirection: 'row', alignItems: 'center' },
  // Lista
  listCard: { flexDirection: 'row', backgroundColor: theme.colors.cardBg, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  tipoBar: { width: 4, alignSelf: 'stretch' },
  listCardContent: { flex: 1, padding: 12 },
  listCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tipoIconLg: { fontSize: 22 },
  listItemName: { flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: '700' },
  listMeta: { color: theme.colors.textMuted, fontSize: 12 },
  cardInactive: { opacity: 0.5 },
  textMuted: { color: theme.colors.textMuted },
  metaText: { color: theme.colors.textMuted, fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { color: theme.colors.text, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: theme.colors.textMuted, fontSize: 15, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 40, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: theme.colors.primary, shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:8 },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36, fontWeight: '300' },
  hint: { position: 'absolute', bottom: 16, alignSelf: 'center', color: theme.colors.textDim, fontSize: 11 },
});
