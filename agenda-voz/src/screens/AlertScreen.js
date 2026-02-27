import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Animated, Easing, Vibration } from 'react-native';
import { Audio } from 'expo-av';
import * as KeepAwake from 'expo-keep-awake';
import { theme } from '../theme';
import { getItemById, getSettings } from '../utils/storage';
import { cancelRepeatAlarms, scheduleRepeatAlarm } from '../utils/alarmManager';

export default function AlertScreen({ navigation, route }) {
  const { itemId } = route.params || {};
  const [item, setItem]         = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [soundObj, setSoundObj] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(5);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const countdownTimer = useRef(null);
  const vibActive  = useRef(false);
  const soundRef   = useRef(null);

  useEffect(() => {
    KeepAwake.activateKeepAwake();
    init();
    startPulse();
    startGlow();
    return () => {
      KeepAwake.deactivateKeepAwake();
      cleanup();
    };
  }, []);

  async function init() {
    try {
      const [loadedItem, settings] = await Promise.all([getItemById(itemId), getSettings()]);
      if (!loadedItem) { navigation.goBack(); return; }
      setItem(loadedItem);
      const interval = loadedItem.repeatInterval || settings.defaultRepeatInterval || 5;
      setRepeatInterval(interval);
      await cancelRepeatAlarms(itemId);
      startCountdown(interval * 60);
      startVibration();
      await playVoice(loadedItem.audioFilePath || loadedItem.audioUri);
    } catch (e) { console.warn('AlertScreen init error:', e); }
  }

  async function playVoice(uri) {
    if (!uri) return;
    try {
      // Configurar audio para reproducción en silencio y segundo plano
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0, isLooping: false }
      );
      soundRef.current = sound;
      setSoundObj(sound);
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate(status => {
        if (status.didJustFinish) setIsPlaying(false);
      });
    } catch (e) { console.warn('Audio playback error:', e); }
  }

  async function replayAudio() {
    const uri = item?.audioFilePath || item?.audioUri;
    if (!uri) return;
    if (isPlaying && soundRef.current) {
      await soundRef.current.stopAsync();
      setIsPlaying(false);
      return;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.replayAsync();
        setIsPlaying(true);
        return;
      } catch {}
    }
    await playVoice(uri);
  }

  function startVibration() {
    vibActive.current = true;
    const pattern = [0, 800, 400, 800, 400, 800, 1000];
    const loop = () => { if (vibActive.current) { Vibration.vibrate(pattern); setTimeout(loop, 4200); } };
    loop();
  }

  function stopVibration() { vibActive.current = false; Vibration.cancel(); }

  function startCountdown(secs) {
    setCountdown(secs);
    countdownTimer.current = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) { clearInterval(countdownTimer.current); handleRepeat(); return 0; }
        return p - 1;
      });
    }, 1000);
  }

  async function handleRepeat() {
    await scheduleRepeatAlarm(itemId, repeatInterval);
    cleanup();
    navigation.navigate('Home');
  }

  async function handleUnderstood() {
    await cancelRepeatAlarms(itemId);
    cleanup();
    navigation.navigate('Home');
  }

  function cleanup() {
    clearInterval(countdownTimer.current);
    stopVibration();
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
    }
  }

  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.18, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }

  function startGlow() {
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: false }),
    ])).start();
  }

  function fmt(s) { if (s === null) return '--:--'; return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`; }

  const glowBg = glowAnim.interpolate({ inputRange:[0,1], outputRange:['rgba(108,99,255,0.15)','rgba(108,99,255,0.5)'] });

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: glowBg }]} />
      <View style={styles.content}>
        <Animated.View style={[styles.bellWrap, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.bellIcon}>🔔</Text>
        </Animated.View>

        <Text style={styles.tag}>RECORDATORIO</Text>
        <Text style={styles.itemName} numberOfLines={2}>{item?.name || '...'}</Text>
        <Text style={styles.clockText}>{new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</Text>

        {(item?.audioFilePath || item?.audioUri) && (
          <TouchableOpacity style={styles.replayBtn} onPress={replayAudio}>
            <Text style={styles.replayIcon}>{isPlaying ? '⏹' : '▶'}</Text>
            <Text style={styles.replayText}>{isPlaying ? 'Detener audio' : 'Escuchar de nuevo'}</Text>
          </TouchableOpacity>
        )}

        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>Se repite en</Text>
          <Text style={styles.countdownTimer}>{fmt(countdown)}</Text>
          <Text style={styles.countdownSub}>si no confirmás</Text>
        </View>

        <TouchableOpacity style={styles.understoodBtn} onPress={handleUnderstood} activeOpacity={0.85}>
          <Text style={styles.understoodIcon}>✅</Text>
          <Text style={styles.understoodText}>ENTENDIDO</Text>
        </TouchableOpacity>

        <Text style={styles.footerHint}>Presioná ENTENDIDO para apagar la alarma</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: theme.colors.background },
  content: { flex:1, alignItems:'center', justifyContent:'center', padding:28, gap:16 },
  bellWrap: { width:120, height:120, borderRadius:60, backgroundColor:theme.colors.primary+'22', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:theme.colors.primary+'55', marginBottom:8 },
  bellIcon: { fontSize:60 },
  tag: { color:theme.colors.primary, fontSize:11, fontWeight:'800', letterSpacing:4 },
  itemName: { color:theme.colors.text, fontSize:28, fontWeight:'800', textAlign:'center', lineHeight:36 },
  clockText: { color:theme.colors.textMuted, fontSize:18 },
  replayBtn: { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:theme.colors.surface, borderRadius:24, paddingHorizontal:24, paddingVertical:12, borderWidth:1, borderColor:theme.colors.border },
  replayIcon: { fontSize:18 },
  replayText: { color:theme.colors.text, fontSize:15, fontWeight:'600' },
  countdownBox: { alignItems:'center', backgroundColor:theme.colors.surface, borderRadius:16, padding:16, paddingHorizontal:32, borderWidth:1, borderColor:theme.colors.border },
  countdownLabel: { color:theme.colors.textMuted, fontSize:11, letterSpacing:1 },
  countdownTimer: { color:theme.colors.secondary, fontSize:44, fontWeight:'900' },
  countdownSub: { color:theme.colors.textMuted, fontSize:11, marginTop:2 },
  understoodBtn: { flexDirection:'row', alignItems:'center', gap:12, backgroundColor:theme.colors.success, borderRadius:24, paddingHorizontal:48, paddingVertical:20, marginTop:8, elevation:10, shadowColor:theme.colors.success, shadowOffset:{width:0,height:6}, shadowOpacity:0.5, shadowRadius:12 },
  understoodIcon: { fontSize:28 },
  understoodText: { color:'#fff', fontSize:22, fontWeight:'900', letterSpacing:2 },
  footerHint: { color:theme.colors.textDim, fontSize:11, textAlign:'center' },
});
