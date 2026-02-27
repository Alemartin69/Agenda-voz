import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';
import { theme } from '../theme';
import { addItem, updateItem } from '../utils/storage';
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

export default function AddEditScreen({ navigation, route }) {
  const editItem = route.params?.item || null;

  const [name, setName] = useState(editItem?.name || '');
  const [selectedDays, setSelectedDays] = useState(editItem?.schedule?.days || [2, 3, 4, 5, 6]);
  const [hour, setHour] = useState(parseInt(editItem?.schedule?.time?.split(':')[0] || '8'));
  const [minute, setMinute] = useState(parseInt(editItem?.schedule?.time?.split(':')[1] || '0'));
  const [repeatInterval, setRepeatInterval] = useState(String(editItem?.repeatInterval || 5));
  const [audioUri, setAudioUri] = useState(editItem?.audioUri || null);
  const [audioFilePath, setAudioFilePath] = useState(editItem?.audioFilePath || null);

  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const durationTimer = useRef(null);

  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
      clearInterval(durationTimer.current);
    };
  }, [sound]);

  function changeHour(delta) { setHour((h) => (h + delta + 24) % 24); }
  function changeMinute(delta) { setMinute((m) => (m + delta + 60) % 60); }
  function padTwo(n) { return n.toString().padStart(2, '0'); }

  async function startRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso al micrófono para grabar tu voz.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      setRecordingDuration(0);
      durationTimer.current = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
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
      const fileName = `agenda_${Date.now()}.m4a`;
      const destPath = FileSystem.documentDirectory + fileName;
      if (audioFilePath) { try { await FileSystem.deleteAsync(audioFilePath, { idempotent: true }); } catch {} }
      await FileSystem.copyAsync({ from: uri, to: destPath });
      setAudioUri(uri);
      setAudioFilePath(destPath);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar la grabación: ' + e.message);
    }
  }

  async function playAudio() {
    const filePath = audioFilePath || audioUri;
    if (!filePath) return;
    if (isPlaying) { if (sound) { await sound.stopAsync(); setIsPlaying(false); } return; }
    try {
      if (sound) await sound.unloadAsync();
      const { sound: s } = await Audio.Sound.createAsync({ uri: filePath }, { shouldPlay: true });
      setSound(s);
      setIsPlaying(true);
      s.setOnPlaybackStatusUpdate((status) => { if (status.didJustFinish) setIsPlaying(false); });
    } catch (e) {
      Alert.alert('Error', 'No se pudo reproducir el audio.');
    }
  }

  async function save() {
    if (!name.trim()) { Alert.alert('Falta el nombre', 'Ingresá un nombre para este recordatorio.'); return; }
    if (selectedDays.length === 0) { Alert.alert('Seleccioná días', 'Elegí al menos un día de la semana.'); return; }
    if (!audioUri && !audioFilePath) {
      Alert.alert('Sin audio grabado', '¿Guardar sin audio? El recordatorio solo mostrará una notificación.',
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
        schedule: { days: selectedDays, time: `${padTwo(hour)}:${padTwo(minute)}` },
        repeatInterval: parseInt(repeatInterval) || 5,
        audioUri, audioFilePath,
        active: editItem?.active ?? true,
        createdAt: editItem?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      if (editItem) { await cancelItemAlarms(item.id); await updateItem(item); }
      else { await addItem(item); }
      if (item.active) await scheduleItemAlarms(item);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(dayId) {
    setSelectedDays((prev) => prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]);
  }

  function formatDuration(secs) {
    return `${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editItem ? 'Editar' : 'Nuevo'} recordatorio</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Nombre */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOMBRE DEL RECORDATORIO</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Ej: Tomar medicamento, Llamar a Juan..."
            placeholderTextColor={theme.colors.textDim}
            maxLength={80}
            returnKeyType="done"
          />
          <View style={styles.sttHint}>
            <Text style={styles.sttHintIcon}>💡</Text>
            <Text style={styles.sttHintText}>
              Para dictar por voz: tocá el campo, abrí el teclado y usá el ícono 🎤 de tu teclado Android
            </Text>
          </View>
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

        {/* Hora con botones +/- */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HORA DEL RECORDATORIO</Text>
          <View style={styles.timeRow}>
            <View style={styles.spinnerBox}>
              <Text style={styles.spinnerLabel}>Hora</Text>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeHour(1)}>
                <Text style={styles.spinnerArrow}>▲</Text>
              </TouchableOpacity>
              <View style={styles.spinnerValue}>
                <Text style={styles.spinnerNumber}>{padTwo(hour)}</Text>
              </View>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeHour(-1)}>
                <Text style={styles.spinnerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.timeSep}>:</Text>

            <View style={styles.spinnerBox}>
              <Text style={styles.spinnerLabel}>Min</Text>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeMinute(5)}>
                <Text style={styles.spinnerArrow}>▲</Text>
              </TouchableOpacity>
              <View style={styles.spinnerValue}>
                <Text style={styles.spinnerNumber}>{padTwo(minute)}</Text>
              </View>
              <TouchableOpacity style={styles.spinnerBtn} onPress={() => changeMinute(-5)}>
                <Text style={styles.spinnerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.timePreview}>
              <Text style={styles.timePreviewText}>{padTwo(hour)}:{padTwo(minute)}</Text>
              <Text style={styles.timePreviewSub}>{hour < 12 ? 'mañana' : hour < 18 ? 'tarde' : 'noche'}</Text>
              <Text style={styles.timePreviewSub2}>▲▼ cambia de 5 en 5</Text>
            </View>
          </View>

          <View style={styles.quickRow}>
            {[[7,0],[8,0],[12,0],[18,0],[21,0]].map(([h,m]) => (
              <TouchableOpacity
                key={`${h}${m}`}
                style={[styles.quickBtn, hour===h && minute===m && styles.quickBtnActive]}
                onPress={() => { setHour(h); setMinute(m); }}
              >
                <Text style={[styles.quickText, hour===h && minute===m && styles.quickTextActive]}>
                  {padTwo(h)}:{padTwo(m)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Repetición */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REPETIR CADA (si no confirmás)</Text>
          <View style={styles.repeatRow}>
            {[1,2,3,5,10,15,20,30].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.repeatBtn, repeatInterval===String(n) && styles.repeatBtnActive]}
                onPress={() => setRepeatInterval(String(n))}
              >
                <Text style={[styles.repeatBtnText, repeatInterval===String(n) && styles.repeatBtnTextActive]}>{n} min</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Grabar voz */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TU VOZ PARA EL RECORDATORIO</Text>
          <Text style={styles.sectionSub}>Grabá el mensaje que escucharás cuando suene la alarma</Text>

          {isRecording ? (
            <View style={styles.recordingActive}>
              <View style={styles.recordingPulse}><View style={styles.recordingDot} /></View>
              <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
              <Text style={styles.recordingLabel}>Grabando... hablá ahora</Text>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Text style={styles.stopBtnText}>⏹ Detener grabación</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.recordBtn, (audioUri||audioFilePath) && styles.recordBtnHasAudio]}
              onPress={startRecording}
            >
              <Text style={styles.recordIcon}>🎙️</Text>
              <Text style={styles.recordBtnText}>{(audioUri||audioFilePath) ? 'Volver a grabar' : 'Grabar mi voz'}</Text>
            </TouchableOpacity>
          )}

          {(audioUri||audioFilePath) && !isRecording && (
            <View style={styles.playerRow}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerIcon}>🎵</Text>
                <Text style={styles.playerText}>Audio grabado ✓</Text>
              </View>
              <TouchableOpacity style={styles.playBtn} onPress={playAudio}>
                <Text style={styles.playBtnText}>{isPlaying ? '⏹ Parar' : '▶ Escuchar'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* BOTÓN GUARDAR */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.saveIcon}>💾</Text>
              <Text style={styles.saveText}>GUARDAR RECORDATORIO</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  backBtn: { padding: 8 },
  backText: { color: theme.colors.primary, fontSize: theme.fontSize.md },
  headerTitle: { color: theme.colors.text, fontSize: theme.fontSize.lg, fontWeight: '700' },
  scroll: { flex: 1 },
  section: {
    margin: theme.spacing.md, marginBottom: 0,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border,
  },
  sectionLabel: { color: theme.colors.primary, fontSize: theme.fontSize.xs, fontWeight: '700', letterSpacing: 1.5, marginBottom: theme.spacing.sm },
  sectionSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, marginBottom: theme.spacing.md },
  nameInput: {
    backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md,
    padding: theme.spacing.md, color: theme.colors.text, fontSize: theme.fontSize.md,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8,
  },
  sttHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: theme.colors.primary + '15', borderRadius: theme.radius.sm,
    padding: 10, borderWidth: 1, borderColor: theme.colors.primary + '30',
  },
  sttHintIcon: { fontSize: 14 },
  sttHintText: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, flex: 1, lineHeight: 16 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  dayBtn: {
    width: 40, height: 52, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  dayBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  dayLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.md, fontWeight: '700' },
  dayFull: { color: theme.colors.textDim, fontSize: 9 },
  dayLabelActive: { color: '#fff' },
  quickRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  quickBtn: {
    backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.round,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: theme.colors.border,
  },
  quickBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  quickText: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs },
  quickTextActive: { color: '#fff', fontWeight: '700' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 },
  spinnerBox: { alignItems: 'center', gap: 4 },
  spinnerLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginBottom: 2 },
  spinnerBtn: {
    width: 56, height: 40, backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  spinnerArrow: { color: theme.colors.primary, fontSize: 18, fontWeight: '700' },
  spinnerValue: {
    width: 56, height: 56, backgroundColor: theme.colors.primary + '22',
    borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.primary + '55',
  },
  spinnerNumber: { color: theme.colors.text, fontSize: 28, fontWeight: '800' },
  timeSep: { color: theme.colors.text, fontSize: 36, fontWeight: '200', marginTop: 20 },
  timePreview: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md, padding: 12, marginTop: 20,
  },
  timePreviewText: { color: theme.colors.text, fontSize: 26, fontWeight: '800' },
  timePreviewSub: { color: theme.colors.textMuted, fontSize: theme.fontSize.xs, marginTop: 2 },
  timePreviewSub2: { color: theme.colors.textDim, fontSize: 10, marginTop: 4 },
  repeatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  repeatBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: theme.radius.round,
    backgroundColor: theme.colors.surfaceAlt, borderWidth: 1, borderColor: theme.colors.border,
  },
  repeatBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  repeatBtnText: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm, fontWeight: '600' },
  repeatBtnTextActive: { color: '#fff' },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.round,
    paddingHorizontal: 28, paddingVertical: 14, alignSelf: 'center',
    elevation: 4, shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 6,
  },
  recordBtnHasAudio: { backgroundColor: theme.colors.textDim },
  recordIcon: { fontSize: 22 },
  recordBtnText: { color: '#fff', fontSize: theme.fontSize.md, fontWeight: '700' },
  recordingActive: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  recordingPulse: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: theme.colors.danger + '22',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.danger + '66',
  },
  recordingDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: theme.colors.danger },
  recordingTime: { color: theme.colors.danger, fontSize: 28, fontWeight: '800' },
  recordingLabel: { color: theme.colors.textMuted, fontSize: theme.fontSize.sm },
  stopBtn: { backgroundColor: theme.colors.danger, borderRadius: theme.radius.round, paddingHorizontal: 24, paddingVertical: 10 },
  stopBtnText: { color: '#fff', fontWeight: '700', fontSize: theme.fontSize.md },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md,
    padding: theme.spacing.sm, marginTop: 10,
  },
  playerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playerIcon: { fontSize: 18 },
  playerText: { color: theme.colors.accent, fontSize: theme.fontSize.sm, fontWeight: '600' },
  playBtn: {
    backgroundColor: theme.colors.accent + '22', borderRadius: theme.radius.round,
    paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: theme.colors.accent + '44',
  },
  playBtnText: { color: theme.colors.accent, fontWeight: '700', fontSize: theme.fontSize.sm },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    margin: theme.spacing.md, backgroundColor: theme.colors.success,
    borderRadius: theme.radius.xl, paddingVertical: 18,
    elevation: 6, shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveIcon: { fontSize: 22 },
  saveText: { color: '#fff', fontSize: theme.fontSize.lg, fontWeight: '900', letterSpacing: 1 },
});
