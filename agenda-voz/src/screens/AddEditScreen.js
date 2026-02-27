import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, SafeAreaView, Platform, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import uuid from 'react-native-uuid';
import { theme } from '../theme';
import { addItem, updateItem, getSettings } from '../utils/storage';
import { scheduleItemAlarms, cancelItemAlarms } from '../utils/alarmManager';

// Días semana (weekday en expo-notifications: 1=Domingo, 2=Lunes ... 7=Sábado)
const DAYS = [
  { id: 2, label: 'L', full: 'Lunes' },
  { id: 3, label: 'M', full: 'Martes' },
  { id: 4, label: 'X', full: 'Miércoles' },
  { id: 5, label: 'J', full: 'Jueves' },
  { id: 6, label: 'V', full: 'Viernes' },
  { id: 7, label: 'S', full: 'Sábado' },
  { id: 1, label: 'D', full: 'Domingo' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export default function AddEditScreen({ navigation, route }) {
  const editItem = route.params?.item || null;

  const [name, setName] = useState(editItem?.name || '');
  const [selectedDays, setSelectedDays] = useState(editItem?.schedule?.days || [2, 3, 4, 5, 6]);
  const [hour, setHour] = useState(editItem?.schedule?.time?.split(':')[0] || '08');
  const [minute, setMinute] = useState(editItem?.schedule?.time?.split(':')[1] || '00');
  const [repeatInterval, setRepeatInterval] = useState(String(editItem?.repeatInterval || 5));
  const [audioUri, setAudioUri] = useState(editItem?.audioUri || null);
  const [audioFilePath, setAudioFilePath] = useState(editItem?.audioFilePath || null);

  // Grabación
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationTimer = useRef(null);

  // Reproducción
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Reconocimiento de voz (STT) - simulado con TextInput activable por voz
  const [isListening, setIsListening] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
      clearInterval(durationTimer.current);
    };
  }, [sound]);

  // ─── Grabación ──────────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono para grabar tu voz.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);

      durationTimer.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e) {
      Alert.alert('Error', 'No se pudo iniciar la grabación: ' + e.message);
    }
  }

  async function stopRecording() {
    clearInterval(durationTimer.current);
    setIsRecording(false);

    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Copiar a directorio permanente
      const fileName = `agenda_${Date.now()}.m4a`;
      const destPath = FileSystem.documentDirectory + fileName;

      // Eliminar audio anterior si existe
      if (audioFilePath) {
        try { await FileSystem.deleteAsync(audioFilePath, { idempotent: true }); } catch {}
      }

      await FileSystem.copyAsync({ from: uri, to: destPath });
      setAudioUri(uri);
      setAudioFilePath(destPath);

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la grabación: ' + e.message);
    }
  }

  // ─── Reproducción ────────────────────────────────────────────────────────────

  async function playAudio() {
    if (isPlaying) {
      if (sound) {
        await sound.stopAsync();
        setIsPlaying(false);
      }
      return;
    }

    const filePath = audioFilePath || audioUri;
    if (!filePath) return;

    try {
      if (sound) await sound.unloadAsync();
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: filePath },
        { shouldPlay: true }
      );
      setSound(s);
      setIsPlaying(true);
      s.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (e) {
      Alert.alert('Error', 'No se pudo reproducir el audio: ' + e.message);
    }
  }

  // ─── Reconocimiento de voz para el nombre (STT básico) ───────────────────────

  async function startVoiceInput() {
    // En Expo managed workflow, usamos grabación + placeholder
    // Para STT real se necesita expo-speech-recognition (bare workflow)
    Alert.alert(
      'Entrada por voz',
      'Grabá tu mensaje y el texto se capturará.\n\nNota: El reconocimiento de voz completo requiere conectar un servicio STT. Por ahora ingresá el texto manualmente o usá el micrófono del teclado de Android.',
      [{ text: 'OK' }]
    );
  }

  // ─── Guardar ─────────────────────────────────────────────────────────────────

  async function save() {
    if (!name.trim()) {
      Alert.alert('Falta el nombre', 'Ingresá un nombre para este recordatorio.');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Seleccioná días', 'Elegí al menos un día de la semana.');
      return;
    }
    if (!audioUri && !audioFilePath) {
      Alert.alert(
        'Sin audio',
        '¿Guardar sin audio grabado? El recordatorio solo mostrará notificación.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Guardar igual', onPress: doSave },
        ]
      );
      return;
    }
    doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      const interval = parseInt(repeatInterval) || 5;
      const item = {
        id: editItem?.id || uuid.v4(),
        name: name.trim(),
        schedule: {
          days: selectedDays,
          time: `${hour}:${minute}`,
        },
        repeatInterval: interval,
        audioUri: audioUri,
        audioFilePath: audioFilePath,
        active: editItem?.active ?? true,
        createdAt: editItem?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };

      if (editItem) {
        await cancelItemAlarms(item.id);
        await updateItem(item);
      } else {
        await addItem(item);
      }

      if (item.active) {
        await scheduleItemAlarms(item);
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(dayId) {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  }

  function formatDuration(secs) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editItem ? 'Editar' : 'Nuevo'} recordatorio</Text>
        <TouchableOpacity
          onPress={save}
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveText}>Guardar</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Nombre */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOMBRE DEL RECORDATORIO</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Ej: Tomar medicamento, Llamar a Juan..."
              placeholderTextColor={theme.colors.textDim}
              maxLength={80}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.voiceInputBtn} onPress={startVoiceInput}>
              <Text style={styles.voiceInputIcon}>🎤</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Usá el teclado o el ícono 🎤 para dictar</Text>
        </View>

        {/* Días */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DÍAS DE LA SEMANA</Text>
          <View style={styles.daysRow}>
            {DAYS.map((day) => (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayBtn, selectedDays.includes(day.id) && styles.dayBtnActive]}
                onPress={() => toggleDay(day.id)}
              >
                <Text style={[styles.dayLabel, selectedDays.includes(day.id) && styles.dayLabelActive]}>
                  {day.label}
                </Text>
                <Text style={[styles.dayFull, selectedDays.includes(day.id) && styles.dayLabelActive]}>
                  {day.full}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Accesos rápidos */}
          <View style={styles.quickRow}>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedDays([2,3,4,5,6])}>
              <Text style={styles.quickText}>Lun-Vie</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedDays([1,7])}>
              <Text style={styles.quickText}>Fin de semana</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickBtn} onPress={() => setSelectedDays([1,2,3,4,5,6,7])}>
              <Text style={styles.quickText}>Todos</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hora */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HORA DEL RECORDATORIO</Text>
          <View style={styles.timeContainer}>
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Hora</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pickerContent}
              >
                {HOURS.map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.pickerItem, hour === h && styles.pickerItemActive]}
                    onPress={() => setHour(h)}
                  >
                    <Text style={[styles.pickerItemText, hour === h && styles.pickerItemTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.pickerWrap}>
              <Text style={styles.pickerLabel}>Min</Text>
              <ScrollView
                style={styles.pickerScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.pickerContent}
              >
                {MINUTES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.pickerItem, minute === m && styles.pickerItemActive]}
                    onPress={() => setMinute(m)}
                  >
                    <Text style={[styles.pickerItemText, minute === m && styles.pickerItemTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={styles.timePreview}>
              <Text style={styles.timePreviewText}>{hour}:{minute}</Text>
              <Text style={styles.timePreviewSub}>
                {parseInt(hour) < 12 ? 'mañana' : parseInt(hour) < 18 ? 'tarde' : 'noche'}
              </Text>
            </View>
          </View>
        </View>

        {/* Repetición */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REPETICIÓN SI NO SE CONFIRMA</Text>
          <Text style={styles.sectionSub}>
            Si no presionás "Entendido", la alarma se repetirá cada:
          </Text>
          <View style={styles.repeatRow}>
            {[1, 2, 3, 5, 10, 15, 20, 30].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.repeatBtn, repeatInterval === String(n) && styles.repeatBtnActive]}
                onPress={() => setRepeatInterval(String(n))}
              >
                <Text style={[styles.repeatBtnText, repeatInterval === String(n) && styles.repeatBtnTextActive]}>
                  {n} min
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.repeatCustomRow}>
            <Text style={styles.repeatCustomLabel}>Personalizado:</Text>
            <TextInput
              style={styles.repeatInput}
              value={repeatInterval}
              onChangeText={(v) => setRepeatInterval(v.replace(/\D/g, ''))}
              keyboardType="numeric"
              maxLength={3}
              placeholder="5"
              placeholderTextColor={theme.colors.textDim}
            />
            <Text style={styles.repeatCustomLabel}>minutos</Text>
          </View>
        </View>

        {/* Grabación de voz */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TU VOZ PARA EL RECORDATORIO</Text>
          <Text style={styles.sectionSub}>
            Grabá el mensaje que escucharás cuando suene la alarma
          </Text>

          {/* Botón grabar */}
          <View style={styles.recordContainer}>
            {isRecording ? (
              <View style={styles.recordingActive}>
                <View style={styles.recordingPulse}>
                  <View style={styles.recordingDot} />
                </View>
                <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
                <Text style={styles.recordingLabel}>Grabando... hablá ahora</Text>
                <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                  <Text style={styles.stopBtnText}>⏹ Detener</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.recordBtn, (audioUri || audioFilePath) && styles.recordBtnHasAudio]}
                onPress={startRecording}
              >
                <Text style={styles.recordIcon}>🎙️</Text>
                <Text style={styles.recordBtnText}>
                  {(audioUri || audioFilePath) ? 'Volver a grabar' : 'Grabar mi voz'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Reproductor */}
          {(audioUri || audioFilePath) && !isRecording && (
            <View style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerIcon}>🎵</Text>
                <Text style={styles.playerText}>Audio grabado</Text>
              </View>
              <TouchableOpacity style={styles.playBtn} onPress={playAudio}>
                <Text style={styles.playBtnText}>{isPlaying ? '⏹ Parar' : '▶ Reproducir'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 60 }} />
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
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
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
    marginBottom: theme.spacing.sm,
  },
  sectionSub: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing.md,
    lineHeight: 18,
  },
  hint: { color: theme.colors.textDim, fontSize: theme.fontSize.xs, marginTop: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  voiceInputBtn: {
    width: 48,
    height: 48,
    backgroundColor: theme.colors.primary + '22',
    borderRadius: theme.radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: theme.colors.primary + '44',
  },
  voiceInputIcon: { fontSize: 22 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  dayBtn: {
    width: 42,
    height: 52,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  dayBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.md, fontWeight: '700' },
  dayFull: { color: theme.colors.textDim, fontSize: 9 },
  dayLabelActive: { color: '#fff' },
  quickRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  quickBtn: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.round,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  quickText: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  timeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickerWrap: { flex: 1 },
  pickerLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
    marginBottom: 4,
  },
  pickerScroll: { height: 150, backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md },
  pickerContent: { paddingVertical: 8 },
  pickerItem: { paddingVertical: 8, alignItems: 'center' },
  pickerItemActive: { backgroundColor: theme.colors.primary + '33' },
  pickerItemText: { color: theme.colors.textMuted, fontSize: theme.fontSize.lg },
  pickerItemTextActive: { color: theme.colors.primary, fontWeight: '700' },
  timeSep: { color: theme.colors.text, fontSize: 32, fontWeight: '200', marginBottom: 20 },
  timePreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    height: 80,
  },
  timePreviewText: { color: theme.colors.text, fontSize: 28, fontWeight: '800' },
  timePreviewSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  repeatBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  repeatBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  repeatBtnText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  repeatBtnTextActive: { color: '#fff' },
  repeatCustomRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  repeatCustomLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  repeatInput: {
    width: 60,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    padding: 8,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  recordContainer: { alignItems: 'center', marginVertical: 8 },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.round,
    paddingHorizontal: 28,
    paddingVertical: 14,
    elevation: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  recordBtnHasAudio: { backgroundColor: theme.colors.textDim },
  recordIcon: { fontSize: 22 },
  recordBtnText: { color: '#fff', fontSize: theme.fontSize.md, fontWeight: '700' },
  recordingActive: { alignItems: 'center', gap: 10 },
  recordingPulse: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.colors.danger + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.danger + '66',
  },
  recordingDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.colors.danger,
  },
  recordingTime: { color: theme.colors.danger, fontSize: 28, fontWeight: '800' },
  recordingLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  stopBtn: {
    backgroundColor: theme.colors.danger,
    borderRadius: theme.radius.round,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: 8,
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerIcon: { fontSize: 18 },
  playerText: { color: theme.colors.text, fontSize: theme.fontSize.sm, fontWeight: '600' },
  playBtn: {
    backgroundColor: theme.colors.accent + '22',
    borderRadius: theme.radius.round,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: theme.colors.accent + '44',
  },
  playBtnText: { color: theme.colors.accent, fontWeight: '700', fontSize: theme.fontSize.sm },
});
