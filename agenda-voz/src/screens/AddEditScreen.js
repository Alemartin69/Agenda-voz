import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, SafeAreaView, ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';
import { theme } from '../theme';
import { addItem, updateItem, getSettings } from '../utils/storage';
import { scheduleItemAlarms, cancelItemAlarms } from '../utils/alarmManager';

const DAYS = [
  { id: 2, label: 'L', full: 'Lunes' },
  { id: 3, label: 'M', full: 'Martes' },
  { id: 4, label: 'X', full: 'Miércoles' },
  { id: 5, label: 'J', full: 'Jueves' },
  { id: 6, label: 'V', full: 'Viernes' },
  { id: 7, label: 'S', full: 'Sábado' },
  { id: 1, label: 'D', full: 'Domingo' },
];

const TIPOS = [
  { id: 'recordatorio', label: '🔔 Recordatorio', color: '#6c63ff' },
  { id: 'vencimiento',  label: '📅 Vencimiento',  color: '#ffa502' },
  { id: 'peso',         label: '⚖️ Peso',          color: '#2ed573' },
  { id: 'comida',       label: '🍽️ Comida',        color: '#ff6584' },
];

export default function AddEditScreen({ navigation, route }) {
  const editItem = route.params?.item || null;

  const [name, setName]               = useState(editItem?.name || '');
  const [tipo, setTipo]               = useState(editItem?.tipo || 'recordatorio');
  const [showTipoPicker, setShowTipoPicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState(editItem?.schedule?.days || [2,3,4,5,6]);
  const [hour, setHour]               = useState(parseInt(editItem?.schedule?.time?.split(':')[0] || '8'));
  const [minute, setMinute]           = useState(parseInt(editItem?.schedule?.time?.split(':')[1] || '0'));
  const [repeatInterval, setRepeatInterval] = useState(String(editItem?.repeatInterval || 5));

  // Campos especiales
  const [peso, setPeso]               = useState(String(editItem?.peso || ''));
  const [ingredientes, setIngredientes] = useState(editItem?.ingredientes || '');
  const [calorias, setCalorias]       = useState(String(editItem?.calorias || ''));
  const [calculandoCalorias, setCalculandoCalorias] = useState(false);

  // Audio
  const [audioUri, setAudioUri]       = useState(editItem?.audioUri || null);
  const [audioFilePath, setAudioFilePath] = useState(editItem?.audioFilePath || null);
  const [recording, setRecording]     = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationTimer = useRef(null);
  const [sound, setSound]             = useState(null);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    return () => { if (sound) sound.unloadAsync(); clearInterval(durationTimer.current); };
  }, [sound]);

  const tipoActual = TIPOS.find(t => t.id === tipo) || TIPOS[0];

  function padTwo(n) { return n.toString().padStart(2, '0'); }
  function changeHour(d) { setHour(h => (h + d + 24) % 24); }
  function changeMinute(d) { setMinute(m => (m + d + 60) % 60); }

  // ─── Grabación ──────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos el micrófono.'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec); setIsRecording(true); setRecordingDuration(0);
      durationTimer.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function stopRecording() {
    clearInterval(durationTimer.current); setIsRecording(false);
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); setRecording(null);
      const dest = FileSystem.documentDirectory + `agenda_${Date.now()}.m4a`;
      if (audioFilePath) { try { await FileSystem.deleteAsync(audioFilePath, { idempotent: true }); } catch {} }
      await FileSystem.copyAsync({ from: uri, to: dest });
      setAudioUri(uri); setAudioFilePath(dest);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) { Alert.alert('Error grabación', e.message); }
  }

  async function playAudio() {
    const fp = audioFilePath || audioUri; if (!fp) return;
    if (isPlaying) { if (sound) { await sound.stopAsync(); setIsPlaying(false); } return; }
    try {
      if (sound) await sound.unloadAsync();
      const { sound: s } = await Audio.Sound.createAsync({ uri: fp }, { shouldPlay: true });
      setSound(s); setIsPlaying(true);
      s.setOnPlaybackStatusUpdate(st => { if (st.didJustFinish) setIsPlaying(false); });
    } catch (e) { Alert.alert('Error audio', e.message); }
  }

  // ─── Calcular calorías con IA ────────────────────────────────────────────────
  async function calcularCalorias() {
    if (!ingredientes.trim()) {
      Alert.alert('Sin ingredientes', 'Escribí los ingredientes primero.');
      return;
    }
    const settings = await getSettings();
    if (!settings.anthropicApiKey) {
      Alert.alert(
        'API Key requerida',
        'Para calcular calorías necesitás configurar tu API Key de Anthropic en ⚙️ Configuración.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Ir a Configuración', onPress: () => navigation.navigate('Settings') },
        ]
      );
      return;
    }

    setCalculandoCalorias(true);
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.anthropicApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{
            role: 'user',
            content: `Calculá las calorías totales aproximadas de esta comida. Respondé SOLO con un número entero, sin texto ni explicaciones.\n\nIngredientes: ${ingredientes}`,
          }],
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const texto = data.content?.[0]?.text?.trim() || '';
      const numero = texto.replace(/[^\d]/g, '');

      if (numero) {
        setCalorias(numero);
        Alert.alert('✅ Calorías calculadas', `La comida tiene aproximadamente ${numero} kcal`);
      } else {
        Alert.alert('Error', 'No se pudo interpretar la respuesta de la IA: ' + texto);
      }
    } catch (e) {
      Alert.alert('Error al calcular', e.message);
    } finally {
      setCalculandoCalorias(false);
    }
  }

  // ─── Guardar ─────────────────────────────────────────────────────────────────
  async function save() {
    if (!name.trim()) { Alert.alert('Falta el nombre', 'Ingresá un nombre.'); return; }
    if (selectedDays.length === 0) { Alert.alert('Seleccioná días', 'Elegí al menos un día.'); return; }
    if (tipo === 'peso' && !peso) { Alert.alert('Falta el peso', 'Ingresá un valor de peso.'); return; }
    if (!audioUri && !audioFilePath) {
      Alert.alert('Sin audio', '¿Guardar sin audio grabado?',
        [{ text: 'Cancelar', style: 'cancel' }, { text: 'Guardar igual', onPress: doSave }]);
      return;
    }
    doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      const item = {
        id: editItem?.id || uuid.v4(),
        name: name.trim(),
        tipo,
        schedule: { days: selectedDays, time: `${padTwo(hour)}:${padTwo(minute)}` },
        repeatInterval: parseInt(repeatInterval) || 5,
        audioUri, audioFilePath,
        peso: tipo === 'peso' ? parseFloat(peso) || null : null,
        ingredientes: tipo === 'comida' ? ingredientes : '',
        calorias: tipo === 'comida' ? parseInt(calorias) || null : null,
        active: editItem?.active ?? true,
        createdAt: editItem?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      if (editItem) { await cancelItemAlarms(item.id); await updateItem(item); }
      else { await addItem(item); }
      if (item.active) await scheduleItemAlarms(item);
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  function toggleDay(id) {
    setSelectedDays(p => p.includes(id) ? p.filter(d => d !== id) : [...p, id]);
  }

  function formatDur(s) { return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`; }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editItem ? 'Editar' : 'Nuevo'} recordatorio</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── TIPO DE TAREA ────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TIPO DE TAREA</Text>
          <TouchableOpacity
            style={[styles.tipoSelector, { borderColor: tipoActual.color }]}
            onPress={() => setShowTipoPicker(true)}
          >
            <Text style={[styles.tipoSelectorText, { color: tipoActual.color }]}>{tipoActual.label}</Text>
            <Text style={[styles.tipoArrow, { color: tipoActual.color }]}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* ── NOMBRE ──────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOMBRE DEL RECORDATORIO</Text>
          <TextInput
            style={styles.nameInput}
            value={name} onChangeText={setName}
            placeholder="Ej: Tomar medicamento..."
            placeholderTextColor={theme.colors.textDim}
            maxLength={80} returnKeyType="done"
          />
          <View style={styles.sttHint}>
            <Text style={styles.sttHintText}>💡 Para dictar: tocá el campo y usá el 🎤 de tu teclado Android</Text>
          </View>
        </View>

        {/* ── CAMPO PESO (solo cuando tipo = peso) ────────────────────────── */}
        {tipo === 'peso' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>⚖️ REGISTRO DE PESO</Text>
            <View style={styles.pesoRow}>
              <TextInput
                style={styles.pesoInput}
                value={peso}
                onChangeText={setPeso}
                placeholder="Ej: 75.5"
                placeholderTextColor={theme.colors.textDim}
                keyboardType="decimal-pad"
                maxLength={6}
              />
              <View style={styles.pesoUnit}>
                <Text style={styles.pesoUnitText}>kg</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── CAMPO COMIDA (solo cuando tipo = comida) ────────────────────── */}
        {tipo === 'comida' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>🍽️ INGREDIENTES DE LA COMIDA</Text>
            <Text style={styles.sectionSub}>Dictá o escribí los ingredientes con cantidades</Text>
            <TextInput
              style={styles.ingredientesInput}
              value={ingredientes}
              onChangeText={setIngredientes}
              placeholder="Ej: 200g pollo a la plancha, 100g arroz integral, ensalada de tomate y lechuga..."
              placeholderTextColor={theme.colors.textDim}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.calcBtn, calculandoCalorias && styles.calcBtnDisabled]}
              onPress={calcularCalorias}
              disabled={calculandoCalorias}
            >
              {calculandoCalorias ? (
                <><ActivityIndicator size="small" color="#fff" /><Text style={styles.calcBtnText}>Calculando con IA...</Text></>
              ) : (
                <><Text style={styles.calcBtnIcon}>🤖</Text><Text style={styles.calcBtnText}>Calcular calorías con IA</Text></>
              )}
            </TouchableOpacity>

            {/* Campo calorías */}
            <View style={styles.caloriasRow}>
              <Text style={styles.caloriasLabel}>Total de calorías:</Text>
              <View style={styles.caloriasInputWrap}>
                <TextInput
                  style={styles.caloriasInput}
                  value={calorias}
                  onChangeText={setCalorias}
                  placeholder="0"
                  placeholderTextColor={theme.colors.textDim}
                  keyboardType="numeric"
                  maxLength={6}
                />
                <Text style={styles.caloriasUnit}>kcal</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── DÍAS ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DÍAS DE LA SEMANA</Text>
          <View style={styles.daysRow}>
            {DAYS.map(day => (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayBtn, selectedDays.includes(day.id) && styles.dayBtnActive]}
                onPress={() => toggleDay(day.id)}
              >
                <Text style={[styles.dayLabel, selectedDays.includes(day.id) && styles.dayLabelActive]}>{day.label}</Text>
                <Text style={[styles.dayFull, selectedDays.includes(day.id) && styles.dayLabelActive]}>{day.full.substring(0,3)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedDays([2,3,4,5,6])}><Text style={styles.quickText}>Lun–Vie</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedDays([1,7])}><Text style={styles.quickText}>Fin de semana</Text></TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedDays([1,2,3,4,5,6,7])}><Text style={styles.quickText}>Todos</Text></TouchableOpacity>
          </View>
        </View>

        {/* ── HORA ────────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HORA DEL RECORDATORIO</Text>
          <View style={styles.timeRow}>
            <View style={styles.spinnerBox}>
              <Text style={styles.spinnerLabel}>Hora</Text>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeHour(1)}><Text style={styles.spinnerArrow}>▲</Text></TouchableOpacity>
              <View style={styles.spinnerValue}><Text style={styles.spinnerNumber}>{padTwo(hour)}</Text></View>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeHour(-1)}><Text style={styles.spinnerArrow}>▼</Text></TouchableOpacity>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.spinnerBox}>
              <Text style={styles.spinnerLabel}>Min</Text>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeMinute(5)}><Text style={styles.spinnerArrow}>▲</Text></TouchableOpacity>
              <View style={styles.spinnerValue}><Text style={styles.spinnerNumber}>{padTwo(minute)}</Text></View>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeMinute(-5)}><Text style={styles.spinnerArrow}>▼</Text></TouchableOpacity>
            </View>
            <View style={styles.timePreview}>
              <Text style={styles.timePreviewText}>{padTwo(hour)}:{padTwo(minute)}</Text>
              <Text style={styles.timePreviewSub}>{hour < 12 ? 'mañana' : hour < 18 ? 'tarde' : 'noche'}</Text>
            </View>
          </View>
          <View style={styles.quickRow}>
            {[[7,0],[8,0],[12,0],[18,0],[21,0]].map(([h,m]) => (
              <TouchableOpacity key={`${h}${m}`} style={[styles.quickBtn, hour===h&&minute===m&&styles.quickBtnActive]} onPress={() => { setHour(h); setMinute(m); }}>
                <Text style={[styles.quickText, hour===h&&minute===m&&styles.quickTextActive]}>{padTwo(h)}:{padTwo(m)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── REPETICIÓN ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REPETIR CADA (si no confirmás)</Text>
          <View style={styles.repeatRow}>
            {[1,2,3,5,10,15,20,30].map(n => (
              <TouchableOpacity key={n} style={[styles.repeatBtn, repeatInterval===String(n)&&styles.repeatBtnActive]} onPress={() => setRepeatInterval(String(n))}>
                <Text style={[styles.repeatBtnText, repeatInterval===String(n)&&styles.repeatBtnTextActive]}>{n} min</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── GRABAR VOZ ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TU VOZ PARA EL RECORDATORIO</Text>
          {isRecording ? (
            <View style={styles.recordingActive}>
              <View style={styles.recordingPulse}><View style={styles.recordingDot} /></View>
              <Text style={styles.recordingTime}>{formatDur(recordingDuration)}</Text>
              <Text style={styles.recordingLabel}>Grabando... hablá ahora</Text>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Text style={styles.stopBtnText}>⏹ Detener grabación</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.recordBtn, (audioUri||audioFilePath)&&styles.recordBtnHasAudio]} onPress={startRecording}>
              <Text style={styles.recordIcon}>🎙️</Text>
              <Text style={styles.recordBtnText}>{(audioUri||audioFilePath) ? 'Volver a grabar' : 'Grabar mi voz'}</Text>
            </TouchableOpacity>
          )}
          {(audioUri||audioFilePath) && !isRecording && (
            <View style={styles.playerRow}>
              <Text style={styles.playerText}>🎵 Audio grabado ✓</Text>
              <TouchableOpacity style={styles.playBtn} onPress={playAudio}>
                <Text style={styles.playBtnText}>{isPlaying ? '⏹ Parar' : '▶ Escuchar'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── BOTÓN GUARDAR ───────────────────────────────────────────────── */}
        <TouchableOpacity style={[styles.saveBtn, saving&&styles.saveBtnDisabled]} onPress={save} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <><Text style={styles.saveIcon}>💾</Text><Text style={styles.saveText}>GUARDAR RECORDATORIO</Text></>}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAL SELECTOR DE TIPO ──────────────────────────────────────────── */}
      <Modal visible={showTipoPicker} transparent animationType="fade" onRequestClose={() => setShowTipoPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTipoPicker(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Tipo de tarea</Text>
            {TIPOS.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.modalOption, tipo === t.id && { backgroundColor: t.color + '22', borderColor: t.color }]}
                onPress={() => { setTipo(t.id); setShowTipoPicker(false); }}
              >
                <Text style={[styles.modalOptionText, { color: tipo === t.id ? t.color : theme.colors.text }]}>{t.label}</Text>
                {tipo === t.id && <Text style={{ color: t.color, fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  backBtn: { padding: 8 },
  backText: { color: theme.colors.primary, fontSize: theme.fontSize.md },
  headerTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' },
  scroll: { flex: 1 },
  section: { margin: theme.spacing.md, marginBottom: 0, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  sectionLabel: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: '700', letterSpacing: 1.5, marginBottom: theme.spacing.sm },
  sectionSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.sm },

  // Tipo
  tipoSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 2 },
  tipoSelectorText: { fontSize: theme.fontSize.lg, fontWeight: '700' },
  tipoArrow: { fontSize: 16, fontWeight: '700' },

  // Nombre
  nameInput: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: theme.fontSize.md, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  sttHint: { backgroundColor: theme.colors.primary + '15', borderRadius: theme.radius.sm, padding: 10, borderWidth: 1, borderColor: theme.colors.primary + '30' },
  sttHintText: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },

  // Peso
  pesoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pesoInput: { flex: 1, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: 32, fontWeight: '800', textAlign: 'center', borderWidth: 1, borderColor: theme.colors.accent },
  pesoUnit: { backgroundColor: theme.colors.accent + '22', borderRadius: theme.radius.md, padding: 16, borderWidth: 1, borderColor: theme.colors.accent },
  pesoUnitText: { color: theme.colors.accent, fontSize: theme.fontSize.lg, fontWeight: '700' },

  // Comida
  ingredientesInput: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing.md, color: theme.colors.text, fontSize: theme.fontSize.md, borderWidth: 1, borderColor: theme.colors.border, minHeight: 100, marginBottom: 12 },
  calcBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#ff6584', borderRadius: theme.radius.round, paddingVertical: 12, paddingHorizontal: 20, marginBottom: 12 },
  calcBtnDisabled: { opacity: 0.6 },
  calcBtnIcon: { fontSize: 18 },
  calcBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
  caloriasRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.warning },
  caloriasLabel: { color: theme.colors.text, fontSize: theme.fontSize.md, fontWeight: '600' },
  caloriasInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  caloriasInput: { backgroundColor: theme.colors.background, borderRadius: theme.radius.sm, padding: 8, color: theme.colors.warning, fontSize: 22, fontWeight: '800', textAlign: 'center', minWidth: 80, borderWidth: 1, borderColor: theme.colors.warning },
  caloriasUnit: { color: theme.colors.warning, fontWeight: '700', fontSize: theme.fontSize.sm },

  // Días
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  dayBtn: { width: 40, height: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  dayBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.md, fontWeight: '700' },
  dayFull: { color: theme.colors.textDim, fontSize: 9 },
  dayLabelActive: { color: '#fff' },
  quickRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  quickBtn: { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.round, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.colors.border },
  quickBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  quickText: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  quickTextActive: { color: '#fff', fontWeight: '700' },

  // Hora
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 },
  spinnerBox: { alignItems: 'center', gap: 4 },
  spinnerLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginBottom: 2 },
  spinnerBtn: { width: 56, height: 40, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  spinnerArrow: { color: theme.colors.primary, fontSize: 18, fontWeight: '700' },
  spinnerValue: { width: 56, height: 56, backgroundColor: theme.colors.primary + '22', borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.primary + '55' },
  spinnerNumber: { color: theme.colors.text, fontSize: 28, fontWeight: '800' },
  timeSep: { color: theme.colors.text, fontSize: 36, fontWeight: '200', marginTop: 20 },
  timePreview: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 12, marginTop: 20 },
  timePreviewText: { color: theme.colors.text, fontSize: 26, fontWeight: '800' },
  timePreviewSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },

  // Repetición
  repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  repeatBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.round, backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border },
  repeatBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  repeatBtnText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  repeatBtnTextActive: { color: '#fff' },

  // Grabación
  recordBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.primary, borderRadius: theme.radius.round, paddingHorizontal: 28, paddingVertical: 14, alignSelf: 'center', elevation: 4 },
  recordBtnHasAudio: { backgroundColor: theme.colors.textDim },
  recordIcon: { fontSize: 22 },
  recordBtnText: { color: '#fff', fontSize: theme.fontSize.md, fontWeight: '700' },
  recordingActive: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  recordingPulse: { width: 70, height: 70, borderRadius: 35, backgroundColor: theme.colors.danger + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.danger + '66' },
  recordingDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.danger },
  recordingTime: { color: theme.colors.danger, fontSize: 28, fontWeight: '800' },
  recordingLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  stopBtn: { backgroundColor: theme.colors.danger, borderRadius: theme.radius.round, paddingHorizontal: 24, paddingVertical: 10 },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
  playerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: theme.spacing.sm, marginTop: 10 },
  playerText: { color: theme.colors.accent, fontSize: theme.fontSize.sm, fontWeight: '600' },
  playBtn: { backgroundColor: theme.colors.accent + '22', borderRadius: theme.radius.round, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: theme.colors.accent + '44' },
  playBtnText: { color: theme.colors.accent, fontWeight: '700', fontSize: theme.fontSize.sm },

  // Guardar
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, margin: theme.spacing.md, backgroundColor: theme.colors.success, borderRadius: theme.radius.xl, paddingVertical: 18, elevation: 6 },
  saveBtnDisabled: { opacity: 0.6 },
  saveIcon: { fontSize: 22 },
  saveText: { color: '#fff', fontSize: theme.fontSize.lg, fontWeight: '900', letterSpacing: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.spacing.lg, width: '100%', borderWidth: 1, borderColor: theme.colors.border },
  modalTitle: { color: theme.colors.text, fontSize: theme.fontSize.xl, fontWeight: '800', marginBottom: theme.spacing.md, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing.md, borderRadius: theme.radius.md, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border },
  modalOptionText: { fontSize: theme.fontSize.lg, fontWeight: '600' },
});
