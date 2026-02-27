import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, SafeAreaView, ActivityIndicator, Modal } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import uuid from 'react-native-uuid';
import { theme } from '../theme';
import { addItem, updateItem } from '../utils/storage';
import { scheduleItemAlarms, cancelItemAlarms } from '../utils/alarmManager';

const DAYS = [
  { id:2, label:'L', full:'Lunes' }, { id:3, label:'M', full:'Martes' },
  { id:4, label:'X', full:'Miércoles' }, { id:5, label:'J', full:'Jueves' },
  { id:6, label:'V', full:'Viernes' }, { id:7, label:'S', full:'Sábado' }, { id:1, label:'D', full:'Domingo' },
];

const TIPOS = [
  { id:'recordatorio', label:'🔔 Recordatorio', color:'#6c63ff' },
  { id:'vencimiento',  label:'📅 Vencimiento',  color:'#ffa502' },
];

export default function AddEditScreen({ navigation, route }) {
  const editItem = route.params?.item || null;
  const [name, setName]             = useState(editItem?.name || '');
  const [tipo, setTipo]             = useState(editItem?.tipo || 'recordatorio');
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDays, setSelectedDays] = useState(editItem?.schedule?.days || [2,3,4,5,6]);
  const [hour, setHour]             = useState(parseInt(editItem?.schedule?.time?.split(':')[0] || '8'));
  const [minute, setMinute]         = useState(parseInt(editItem?.schedule?.time?.split(':')[1] || '0'));
  const [repeatInterval, setRepeatInterval] = useState(String(editItem?.repeatInterval || 5));
  const [audioUri, setAudioUri]     = useState(editItem?.audioUri || null);
  const [audioFilePath, setAudioFilePath] = useState(editItem?.audioFilePath || null);
  const [recording, setRecording]   = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const timerRef = useRef(null);
  const [sound, setSound]           = useState(null);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [saving, setSaving]         = useState(false);

  useEffect(() => { return () => { if (sound) sound.unloadAsync(); clearInterval(timerRef.current); }; }, [sound]);

  const tc = TIPOS.find(t => t.id === tipo) || TIPOS[0];
  const padTwo = n => n.toString().padStart(2,'0');
  const changeHour = d => setHour(h => (h+d+24)%24);
  const changeMinute = d => setMinute(m => (m+d+60)%60);

  async function startRecording() {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permiso requerido', 'Necesitamos el micrófono.'); return; }
    await Audio.setAudioModeAsync({ allowsRecordingIOS:true, playsInSilentModeIOS:true });
    const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    setRecording(rec); setIsRecording(true); setRecDuration(0);
    timerRef.current = setInterval(() => setRecDuration(d => d+1), 1000);
  }

  async function stopRecording() {
    clearInterval(timerRef.current); setIsRecording(false);
    if (!recording) return;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI(); setRecording(null);
    const dest = FileSystem.documentDirectory + `agenda_${Date.now()}.m4a`;
    if (audioFilePath) { try { await FileSystem.deleteAsync(audioFilePath, { idempotent:true }); } catch {} }
    await FileSystem.copyAsync({ from:uri, to:dest });
    setAudioUri(uri); setAudioFilePath(dest);
    await Audio.setAudioModeAsync({ allowsRecordingIOS:false });
  }

  async function playAudio() {
    const fp = audioFilePath || audioUri; if (!fp) return;
    if (isPlaying) { if (sound) { await sound.stopAsync(); setIsPlaying(false); } return; }
    try {
      if (sound) await sound.unloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS:false, playsInSilentModeIOS:true, staysActiveInBackground:false });
      const { sound: s } = await Audio.Sound.createAsync({ uri:fp }, { shouldPlay:true });
      setSound(s); setIsPlaying(true);
      s.setOnPlaybackStatusUpdate(st => { if (st.didJustFinish) setIsPlaying(false); });
    } catch (e) { Alert.alert('Error', e.message); }
  }

  async function save() {
    if (!name.trim()) { Alert.alert('Falta el nombre', 'Ingresá un nombre.'); return; }
    if (!selectedDays.length) { Alert.alert('Seleccioná días', 'Elegí al menos un día.'); return; }
    if (!audioUri && !audioFilePath) {
      Alert.alert('Sin audio', '¿Guardar sin audio grabado?',
        [{ text:'Cancelar', style:'cancel' }, { text:'Guardar igual', onPress:doSave }]);
      return;
    }
    doSave();
  }

  async function doSave() {
    setSaving(true);
    try {
      const item = {
        id: editItem?.id || uuid.v4(), name: name.trim(), tipo,
        schedule: { days: selectedDays, time: `${padTwo(hour)}:${padTwo(minute)}` },
        repeatInterval: parseInt(repeatInterval)||5,
        audioUri, audioFilePath,
        active: editItem?.active ?? true,
        createdAt: editItem?.createdAt || Date.now(), updatedAt: Date.now(),
      };
      if (editItem) { await cancelItemAlarms(item.id); await updateItem(item); }
      else { await addItem(item); }
      if (item.active) await scheduleItemAlarms(item);
      navigation.goBack();
    } catch (e) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  }

  const toggleDay = id => setSelectedDays(p => p.includes(id) ? p.filter(d => d!==id) : [...p,id]);
  const fmtDur = s => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{editItem ? 'Editar' : 'Nuevo'} recordatorio</Text>
        <View style={{ width:70 }} />
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Tipo */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TIPO</Text>
          <TouchableOpacity style={[styles.tipoSelector, { borderColor:tc.color }]} onPress={() => setShowPicker(true)}>
            <Text style={[styles.tipoText, { color:tc.color }]}>{tc.label}</Text>
            <Text style={[styles.tipoArrow, { color:tc.color }]}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Nombre */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOMBRE</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName}
            placeholder="Ej: Tomar medicamento, Reunión..." placeholderTextColor={theme.colors.textDim}
            maxLength={80} returnKeyType="done" />
          <Text style={styles.hintText}>💡 Usá el 🎤 del teclado Android para dictar</Text>
        </View>

        {/* Días */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DÍAS</Text>
          <View style={styles.daysRow}>
            {DAYS.map(d => (
              <TouchableOpacity key={d.id} style={[styles.dayBtn, selectedDays.includes(d.id)&&styles.dayBtnActive]} onPress={() => toggleDay(d.id)}>
                <Text style={[styles.dayL, selectedDays.includes(d.id)&&styles.dayActive]}>{d.label}</Text>
                <Text style={[styles.dayF, selectedDays.includes(d.id)&&styles.dayActive]}>{d.full.substring(0,3)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.qRow}>
            <TouchableOpacity style={styles.qBtn} onPress={() => setSelectedDays([2,3,4,5,6])}><Text style={styles.qText}>Lun–Vie</Text></TouchableOpacity>
            <TouchableOpacity style={styles.qBtn} onPress={() => setSelectedDays([1,7])}><Text style={styles.qText}>Fin de semana</Text></TouchableOpacity>
            <TouchableOpacity style={styles.qBtn} onPress={() => setSelectedDays([1,2,3,4,5,6,7])}><Text style={styles.qText}>Todos</Text></TouchableOpacity>
          </View>
        </View>

        {/* Hora */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HORA</Text>
          <View style={styles.timeRow}>
            <View style={styles.spinBox}>
              <Text style={styles.spinLbl}>Hora</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => changeHour(1)}><Text style={styles.spinArrow}>▲</Text></TouchableOpacity>
              <View style={styles.spinVal}><Text style={styles.spinNum}>{padTwo(hour)}</Text></View>
              <TouchableOpacity style={styles.spinBtn} onPress={() => changeHour(-1)}><Text style={styles.spinArrow}>▼</Text></TouchableOpacity>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.spinBox}>
              <Text style={styles.spinLbl}>Min</Text>
              <TouchableOpacity style={styles.spinBtn} onPress={() => changeMinute(5)}><Text style={styles.spinArrow}>▲</Text></TouchableOpacity>
              <View style={styles.spinVal}><Text style={styles.spinNum}>{padTwo(minute)}</Text></View>
              <TouchableOpacity style={styles.spinBtn} onPress={() => changeMinute(-5)}><Text style={styles.spinArrow}>▼</Text></TouchableOpacity>
            </View>
            <View style={styles.timePreview}>
              <Text style={styles.timePreviewNum}>{padTwo(hour)}:{padTwo(minute)}</Text>
              <Text style={styles.timePreviewSub}>{hour<12?'mañana':hour<18?'tarde':'noche'}</Text>
            </View>
          </View>
          <View style={styles.qRow}>
            {[[7,0],[8,0],[12,0],[18,0],[21,0]].map(([h,m]) => (
              <TouchableOpacity key={`${h}${m}`} style={[styles.qBtn, hour===h&&minute===m&&styles.qBtnActive]} onPress={() => { setHour(h); setMinute(m); }}>
                <Text style={[styles.qText, hour===h&&minute===m&&styles.qTextActive]}>{padTwo(h)}:{padTwo(m)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Repetición */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>REPETIR CADA (si no confirmás)</Text>
          <View style={styles.repeatRow}>
            {[1,2,3,5,10,15,20,30].map(n => (
              <TouchableOpacity key={n} style={[styles.repeatBtn, repeatInterval===String(n)&&styles.repeatBtnActive]} onPress={() => setRepeatInterval(String(n))}>
                <Text style={[styles.repeatText, repeatInterval===String(n)&&styles.repeatTextActive]}>{n} min</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Grabar voz */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TU VOZ PARA EL RECORDATORIO</Text>
          {isRecording ? (
            <View style={styles.recActive}>
              <View style={styles.recPulse}><View style={styles.recDot} /></View>
              <Text style={styles.recTime}>{fmtDur(recDuration)}</Text>
              <Text style={styles.recLabel}>Grabando... hablá ahora</Text>
              <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
                <Text style={styles.stopBtnText}>⏹ Detener grabación</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[styles.recBtn, (audioUri||audioFilePath)&&styles.recBtnDone]} onPress={startRecording}>
              <Text style={styles.recBtnIcon}>🎙️</Text>
              <Text style={styles.recBtnText}>{(audioUri||audioFilePath)?'Volver a grabar':'Grabar mi voz'}</Text>
            </TouchableOpacity>
          )}
          {(audioUri||audioFilePath) && !isRecording && (
            <View style={styles.playerRow}>
              <Text style={styles.playerLabel}>🎵 Audio grabado ✓</Text>
              <TouchableOpacity style={styles.playBtn} onPress={playAudio}>
                <Text style={styles.playBtnText}>{isPlaying?'⏹ Parar':'▶ Escuchar'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Guardar */}
        <TouchableOpacity style={[styles.saveBtn, saving&&{opacity:0.6}]} onPress={save} disabled={saving} activeOpacity={0.85}>
          {saving ? <ActivityIndicator size="small" color="#fff"/> : <><Text style={styles.saveIcon}>💾</Text><Text style={styles.saveText}>GUARDAR RECORDATORIO</Text></>}
        </TouchableOpacity>
        <View style={{ height:40 }} />
      </ScrollView>

      {/* Modal tipo */}
      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Tipo de recordatorio</Text>
            {TIPOS.map(t => (
              <TouchableOpacity key={t.id} style={[styles.modalOpt, tipo===t.id&&{ backgroundColor:t.color+'22', borderColor:t.color }]} onPress={() => { setTipo(t.id); setShowPicker(false); }}>
                <Text style={[styles.modalOptText, { color: tipo===t.id ? t.color : theme.colors.text }]}>{t.label}</Text>
                {tipo===t.id && <Text style={{ color:t.color, fontSize:18 }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:theme.colors.background },
  header:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:theme.colors.border },
  backBtn:{ padding:8 }, backText:{ color:theme.colors.primary, fontSize:15 },
  headerTitle:{ color:theme.colors.text, fontSize:18, fontWeight:'700' },
  scroll:{ flex:1 },
  section:{ margin:16, marginBottom:0, backgroundColor:theme.colors.surface, borderRadius:16, padding:16, borderWidth:1, borderColor:theme.colors.border },
  sectionLabel:{ color:theme.colors.primary, fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:10 },
  tipoSelector:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:14, borderWidth:2 },
  tipoText:{ fontSize:17, fontWeight:'700' }, tipoArrow:{ fontSize:14, fontWeight:'700' },
  input:{ backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:14, color:theme.colors.text, fontSize:15, borderWidth:1, borderColor:theme.colors.border },
  hintText:{ color:theme.colors.textMuted, fontSize:11, marginTop:6 },
  daysRow:{ flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:10 },
  dayBtn:{ width:40, height:52, borderRadius:10, backgroundColor:theme.colors.surfaceAlt, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:theme.colors.border },
  dayBtnActive:{ backgroundColor:theme.colors.primary, borderColor:theme.colors.primary },
  dayL:{ color:theme.colors.textMuted, fontSize:15, fontWeight:'700' },
  dayF:{ color:theme.colors.textDim, fontSize:9 },
  dayActive:{ color:'#fff' },
  qRow:{ flexDirection:'row', gap:6, flexWrap:'wrap', marginTop:6 },
  qBtn:{ backgroundColor:theme.colors.surfaceAlt, borderRadius:20, paddingHorizontal:12, paddingVertical:6, borderWidth:1, borderColor:theme.colors.border },
  qBtnActive:{ backgroundColor:theme.colors.primary, borderColor:theme.colors.primary },
  qText:{ color:theme.colors.textMuted, fontSize:11 }, qTextActive:{ color:'#fff', fontWeight:'700' },
  timeRow:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:12, marginBottom:12 },
  spinBox:{ alignItems:'center', gap:4 },
  spinLbl:{ color:theme.colors.textMuted, fontSize:11, marginBottom:2 },
  spinBtn:{ width:56, height:40, backgroundColor:theme.colors.surfaceAlt, borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:theme.colors.border },
  spinArrow:{ color:theme.colors.primary, fontSize:18, fontWeight:'700' },
  spinVal:{ width:56, height:56, backgroundColor:theme.colors.primary+'22', borderRadius:10, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:theme.colors.primary+'55' },
  spinNum:{ color:theme.colors.text, fontSize:28, fontWeight:'800' },
  timeSep:{ color:theme.colors.text, fontSize:36, fontWeight:'200', marginTop:20 },
  timePreview:{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:12, marginTop:20 },
  timePreviewNum:{ color:theme.colors.text, fontSize:26, fontWeight:'800' },
  timePreviewSub:{ color:theme.colors.textMuted, fontSize:11, marginTop:2 },
  repeatRow:{ flexDirection:'row', flexWrap:'wrap', gap:8 },
  repeatBtn:{ paddingHorizontal:14, paddingVertical:9, borderRadius:20, backgroundColor:theme.colors.surfaceAlt, borderWidth:1, borderColor:theme.colors.border },
  repeatBtnActive:{ backgroundColor:theme.colors.primary, borderColor:theme.colors.primary },
  repeatText:{ color:theme.colors.textMuted, fontSize:13, fontWeight:'600' },
  repeatTextActive:{ color:'#fff' },
  recBtn:{ flexDirection:'row', alignItems:'center', gap:10, backgroundColor:theme.colors.primary, borderRadius:24, paddingHorizontal:28, paddingVertical:14, alignSelf:'center', elevation:4 },
  recBtnDone:{ backgroundColor:theme.colors.textDim },
  recBtnIcon:{ fontSize:22 }, recBtnText:{ color:'#fff', fontSize:15, fontWeight:'700' },
  recActive:{ alignItems:'center', gap:10, paddingVertical:8 },
  recPulse:{ width:70, height:70, borderRadius:35, backgroundColor:theme.colors.danger+'22', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:theme.colors.danger+'66' },
  recDot:{ width:30, height:30, borderRadius:15, backgroundColor:theme.colors.danger },
  recTime:{ color:theme.colors.danger, fontSize:28, fontWeight:'800' },
  recLabel:{ color:theme.colors.textMuted, fontSize:13 },
  stopBtn:{ backgroundColor:theme.colors.danger, borderRadius:24, paddingHorizontal:24, paddingVertical:10 },
  stopBtnText:{ color:'#fff', fontWeight:'700', fontSize:15 },
  playerRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:theme.colors.surfaceAlt, borderRadius:12, padding:10, marginTop:10 },
  playerLabel:{ color:theme.colors.accent, fontSize:13, fontWeight:'600' },
  playBtn:{ backgroundColor:theme.colors.accent+'22', borderRadius:20, paddingHorizontal:14, paddingVertical:7, borderWidth:1, borderColor:theme.colors.accent+'44' },
  playBtnText:{ color:theme.colors.accent, fontWeight:'700', fontSize:13 },
  saveBtn:{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, margin:16, backgroundColor:theme.colors.success, borderRadius:20, paddingVertical:18, elevation:6 },
  saveIcon:{ fontSize:22 }, saveText:{ color:'#fff', fontSize:18, fontWeight:'900', letterSpacing:1 },
  modalOverlay:{ flex:1, backgroundColor:'rgba(0,0,0,0.6)', justifyContent:'center', alignItems:'center', padding:24 },
  modalBox:{ backgroundColor:theme.colors.surface, borderRadius:20, padding:20, width:'100%', borderWidth:1, borderColor:theme.colors.border },
  modalTitle:{ color:theme.colors.text, fontSize:20, fontWeight:'800', marginBottom:16, textAlign:'center' },
  modalOpt:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:14, borderRadius:12, marginBottom:8, borderWidth:1, borderColor:theme.colors.border },
  modalOptText:{ fontSize:17, fontWeight:'600' },
});
