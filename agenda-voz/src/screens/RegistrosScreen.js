import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, SafeAreaView, Dimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '../theme';
import { getRegistros, deleteRegistro } from '../utils/storage';

const SCREEN_W = Dimensions.get('window').width;
const CHART_W  = SCREEN_W - 48;
const CHART_H  = 160;

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' });
}
function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit' });
}

// ─── Gráfico de línea simple ──────────────────────────────────────────────────
function LineChart({ data, color, label, unit, height = CHART_H }) {
  if (!data.length) return null;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * (CHART_W - 40),
    y: height - 24 - ((d.value - min) / range) * (height - 48),
    value: d.value,
    label: d.label,
  }));

  return (
    <View style={[chartStyles.container, { height: height + 40 }]}>
      <Text style={[chartStyles.chartLabel, { color }]}>{label}</Text>
      <View style={chartStyles.chartArea}>
        {/* Líneas de fondo */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <View key={i} style={[chartStyles.gridLine, { bottom: 24 + f * (height - 48) }]} />
        ))}
        {/* Valores del eje Y */}
        <Text style={[chartStyles.yLabel, { bottom: 24 + (height - 48) }]}>{Math.round(max)}</Text>
        <Text style={[chartStyles.yLabel, { bottom: 24 }]}>{Math.round(min)}</Text>
        {/* Línea del gráfico */}
        {pts.slice(1).map((pt, i) => {
          const prev = pts[i];
          const dx = pt.x - prev.x;
          const dy = pt.y - prev.y;
          const len = Math.sqrt(dx*dx + dy*dy);
          const angle = Math.atan2(dy, dx) * 180 / Math.PI;
          return (
            <View key={i} style={[chartStyles.line, {
              width: len, left: prev.x + 20,
              top: prev.y - 1,
              backgroundColor: color + 'bb',
              transform: [{ rotate: `${angle}deg` }],
            }]} />
          );
        })}
        {/* Puntos */}
        {pts.map((pt, i) => (
          <View key={i} style={[chartStyles.dot, { left: pt.x + 16, top: pt.y - 5, backgroundColor: color }]}>
            <Text style={chartStyles.dotLabel}>{pt.value}{unit}</Text>
          </View>
        ))}
        {/* Eje X */}
        {pts.filter((_, i) => i === 0 || i === pts.length - 1 || pts.length <= 5).map((pt, i) => (
          <Text key={i} style={[chartStyles.xLabel, { left: pt.x + 8 }]}>{pt.label}</Text>
        ))}
      </View>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  container: { marginBottom: 8 },
  chartLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  chartArea: { flex: 1, position: 'relative' },
  gridLine: { position: 'absolute', left: 20, right: 0, height: 1, backgroundColor: theme.colors.border },
  yLabel: { position: 'absolute', left: 0, color: theme.colors.textDim, fontSize: 9, width: 18, textAlign: 'right' },
  line: { position: 'absolute', height: 2, transformOrigin: 'left center' },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  dotLabel: { position: 'absolute', top: -16, left: -6, color: '#fff', fontSize: 9, fontWeight: '700', width: 32, textAlign: 'center' },
  xLabel: { position: 'absolute', bottom: 0, color: theme.colors.textDim, fontSize: 9, width: 40, textAlign: 'center' },
});

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function RegistrosScreen({ navigation }) {
  const [registros, setRegistros] = useState([]);
  const [filtro, setFiltro] = useState('todos'); // 'todos' | 'peso' | 'comida'

  useFocusEffect(useCallback(() => { load(); }, []));

  async function load() {
    const data = await getRegistros();
    setRegistros(data);
  }

  async function confirmDelete(r) {
    Alert.alert('Eliminar registro', '¿Eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await deleteRegistro(r.id);
        setRegistros(p => p.filter(x => x.id !== r.id));
      }},
    ]);
  }

  // ─── Datos para gráficos ──────────────────────────────────────────────────
  function buildChartData(tipo, campo) {
    // Agrupar por día, tomar el último registro del día
    const byDay = {};
    registros
      .filter(r => r.tipo === tipo && r[campo])
      .forEach(r => {
        const day = new Date(r.fecha).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' });
        if (!byDay[day] || r.fecha > byDay[day].fecha) byDay[day] = r;
      });
    return Object.entries(byDay)
      .sort((a,b) => a[1].fecha - b[1].fecha)
      .slice(-14) // últimos 14 días
      .map(([day, r]) => ({ label: day, value: r[campo] }));
  }

  // Sumar calorías por día
  function buildCaloriasChart() {
    const byDay = {};
    registros
      .filter(r => r.tipo === 'comida' && r.calorias)
      .forEach(r => {
        const day = new Date(r.fecha).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit' });
        byDay[day] = (byDay[day] || { total: 0, fecha: r.fecha });
        byDay[day].total += r.calorias;
        if (r.fecha > byDay[day].fecha) byDay[day].fecha = r.fecha;
      });
    return Object.entries(byDay)
      .sort((a,b) => a[1].fecha - b[1].fecha)
      .slice(-14)
      .map(([day, d]) => ({ label: day, value: d.total }));
  }

  const pesoData     = buildChartData('peso', 'peso');
  const caloriasData = buildCaloriasChart();
  const filtrados    = filtro === 'todos' ? registros : registros.filter(r => r.tipo === filtro);

  const renderRegistro = ({ item: r }) => (
    <TouchableOpacity
      style={styles.card}
      onLongPress={() => confirmDelete(r)}
      activeOpacity={0.9}
    >
      <View style={[styles.cardIconBox, { backgroundColor: r.tipo === 'peso' ? theme.colors.accent + '22' : '#ff6584' + '22' }]}>
        <Text style={styles.cardIcon}>{r.tipo === 'peso' ? '⚖️' : '🍽️'}</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardDate}>{formatDate(r.fecha)}</Text>
          <Text style={styles.cardTime}>{formatTime(r.fecha)}</Text>
        </View>
        {r.tipo === 'peso' && (
          <Text style={styles.cardValue}><Text style={[styles.cardBig, { color: theme.colors.accent }]}>{r.peso}</Text> kg</Text>
        )}
        {r.tipo === 'comida' && (
          <>
            {r.nombre && <Text style={styles.cardName}>{r.nombre}</Text>}
            {r.ingredientes ? (
              <Text style={styles.cardIngred} numberOfLines={2}>{r.ingredientes}</Text>
            ) : null}
            {r.calorias ? (
              <Text style={styles.cardValue}><Text style={[styles.cardBig, { color: '#ff6584' }]}>{r.calorias}</Text> kcal</Text>
            ) : null}
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  const hasPeso     = pesoData.length >= 2;
  const hasCalorias = caloriasData.length >= 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Agenda</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📊 Registros</Text>
        <View style={{ width: 80 }} />
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={r => r.id}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View>
            {/* Gráficos */}
            {(hasPeso || hasCalorias) && (
              <View style={styles.chartsSection}>
                <Text style={styles.chartsTitle}>Evolución</Text>
                {hasPeso && (
                  <LineChart data={pesoData} color={theme.colors.accent} label="⚖️ Peso (kg)" unit="kg" />
                )}
                {hasCalorias && (
                  <LineChart data={caloriasData} color="#ff6584" label="🔥 Calorías diarias (kcal)" unit="kcal" />
                )}
              </View>
            )}

            {/* Filtros */}
            <View style={styles.filtros}>
              {[['todos','📋 Todos'],['peso','⚖️ Peso'],['comida','🍽️ Comida']].map(([k,l]) => (
                <TouchableOpacity key={k} style={[styles.filtroBtn, filtro===k&&styles.filtroBtnActive]} onPress={() => setFiltro(k)}>
                  <Text style={[styles.filtroText, filtro===k&&styles.filtroTextActive]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionTitle}>Registros ({filtrados.length})</Text>
          </View>
        )}
        renderItem={renderRegistro}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📊</Text>
            <Text style={styles.emptyTitle}>Sin registros</Text>
            <Text style={styles.emptyText}>Tocá + para registrar tu peso o una comida</Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('AddRegistro')} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Mantené presionado para eliminar</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { padding: 8 },
  backText: { color: theme.colors.primary, fontSize: 15 },
  headerTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '800' },
  chartsSection: { margin: 16, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  chartsTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12 },
  filtros: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  filtroBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  filtroBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filtroText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  filtroTextActive: { color: '#fff' },
  sectionTitle: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginLeft: 16, marginBottom: 4 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  card: { flexDirection: 'row', backgroundColor: theme.colors.cardBg, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  cardIconBox: { width: 56, alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 26 },
  cardBody: { flex: 1, padding: 12 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardDate: { color: theme.colors.text, fontSize: 13, fontWeight: '700' },
  cardTime: { color: theme.colors.textMuted, fontSize: 12 },
  cardName: { color: theme.colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  cardIngred: { color: theme.colors.textMuted, fontSize: 12, marginBottom: 4 },
  cardValue: { color: theme.colors.textMuted, fontSize: 13 },
  cardBig: { fontSize: 22, fontWeight: '900' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: theme.colors.textMuted, fontSize: 14, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 40, right: 24, width: 64, height: 64, borderRadius: 32, backgroundColor: '#ff6584', alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#ff6584', shadowOffset:{width:0,height:4}, shadowOpacity:0.4, shadowRadius:8 },
  fabText: { color: '#fff', fontSize: 32, lineHeight: 36, fontWeight: '300' },
  hint: { position: 'absolute', bottom: 16, alignSelf: 'center', color: theme.colors.textDim, fontSize: 11 },
});
