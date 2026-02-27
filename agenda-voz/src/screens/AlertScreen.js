import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  Animated, Easing, Vibration, AppState,
} from 'react-native';
import { Audio } from 'expo-av';
import * as KeepAwake from 'expo-keep-awake';
import { theme } from '../theme';
import { getItemById, getSettings } from '../utils/storage';
import { cancelRepeatAlarms, scheduleRepeatAlarm } from '../utils/alarmManager';

export default function AlertScreen({ navigation, route }) {
  const { itemId } = route.params || {};

  const [item, setItem] = useState(null);
  const [countdown, setCountdown] = useState(null); // segundos hasta próxima repetición
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatInterval, setRepeatInterval] = useState(5);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const countdownTimer = useRef(null);
  const vibrationActive = useRef(false);

  useEffect(() => {
    KeepAwake.activateKeepAwake();
    loadAndPlay();
    startPulseAnimation();
    startGlowAnimation();

    return () => {
      KeepAwake.deactivateKeepAwake();
      cleanup();
    };
  }, []);

  async function loadAndPlay() {
    try {
      const [loadedItem, settings] = await Promise.all([
        getItemById(itemId),
        getSettings(),
      ]);

      if (!loadedItem) {
        navigation.goBack();
        return;
      }

      setItem(loadedItem);
      const interval = loadedItem.repeatInterval || settings.defaultRepeatInterval || 5;
      setRepeatInterval(interval);
      startCountdown(interval * 60);

      // Cancelar repeticiones previas
      await cancelRepeatAlarms(itemId);

      // Reproducir audio
      await playVoice(loadedItem.audioFilePath || loadedItem.audioUri);

      // Vibración persistente
      startVibration();
    } catch (e) {
      console.warn('AlertScreen error:', e);
    }
  }

  async function playVoice(uri) {
    if (!uri) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 1.0 }
      );
      setSound(s);
      setIsPlaying(true);
      s.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  function startVibration() {
    vibrationActive.current = true;
    const pattern = [0, 800, 400, 800, 400, 800, 1000];
    const repeatVibrate = () => {
      if (vibrationActive.current) {
        Vibration.vibrate(pattern);
        setTimeout(repeatVibrate, 4000);
      }
    };
    repeatVibrate();
  }

  function stopVibration() {
    vibrationActive.current = false;
    Vibration.cancel();
  }

  function startCountdown(seconds) {
    setCountdown(seconds);
    countdownTimer.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current);
          handleRepeat();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleRepeat() {
    // Programar próxima alarma
    await scheduleRepeatAlarm(itemId, repeatInterval);
    // Ir a home y mostrar notificación
    cleanup();
    navigation.navigate('Home');
  }

  async function handleUnderstood() {
    // Cancelar todo y cerrar
    await cancelRepeatAlarms(itemId);
    cleanup();
    navigation.navigate('Home');
  }

  function cleanup() {
    clearInterval(countdownTimer.current);
    stopVibration();
    if (sound) {
      sound.stopAsync().catch(() => {});
      sound.unloadAsync().catch(() => {});
    }
  }

  async function replayAudio() {
    if (sound) {
      if (isPlaying) {
        await sound.stopAsync();
        setIsPlaying(false);
        return;
      }
      await sound.replayAsync();
      setIsPlaying(true);
    } else if (item?.audioFilePath || item?.audioUri) {
      await playVoice(item.audioFilePath || item.audioUri);
    }
  }

  function startPulseAnimation() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }

  function startGlowAnimation() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }

  function formatCountdown(secs) {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(108, 99, 255, 0.2)', 'rgba(108, 99, 255, 0.6)'],
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Fondo animado */}
      <Animated.View style={[styles.glowBg, { backgroundColor: glowColor }]} />

      <View style={styles.content}>
        {/* Icono pulsante */}
        <Animated.View style={[styles.bellContainer, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.bellIcon}>🔔</Text>
        </Animated.View>

        {/* Título */}
        <Text style={styles.alertTitle}>RECORDATORIO</Text>
        <Text style={styles.itemName} numberOfLines={2}>
          {item?.name || 'Cargando...'}
        </Text>

        {/* Hora */}
        <Text style={styles.timeLabel}>
          {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
        </Text>

        {/* Reproductor */}
        {(item?.audioFilePath || item?.audioUri) && (
          <TouchableOpacity style={styles.replayBtn} onPress={replayAudio}>
            <Text style={styles.replayIcon}>{isPlaying ? '⏹' : '▶'}</Text>
            <Text style={styles.replayText}>
              {isPlaying ? 'Detener audio' : 'Escuchar de nuevo'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Countdown */}
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>Se repetirá en</Text>
          <Text style={styles.countdownTimer}>{formatCountdown(countdown)}</Text>
          <Text style={styles.countdownSub}>si no confirmás</Text>
        </View>

        {/* BOTÓN ENTENDIDO */}
        <TouchableOpacity
          style={styles.understoodBtn}
          onPress={handleUnderstood}
          activeOpacity={0.85}
        >
          <Text style={styles.understoodIcon}>✅</Text>
          <Text style={styles.understoodText}>ENTENDIDO</Text>
        </TouchableOpacity>

        <Text style={styles.footerHint}>
          Presioná ENTENDIDO para apagar la alarma
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  glowBg: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  bellContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary + '55',
    marginBottom: theme.spacing.sm,
  },
  bellIcon: { fontSize: 60 },
  alertTitle: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: '800',
    letterSpacing: 4,
  },
  itemName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.xxl,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
  },
  timeLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.lg,
    fontWeight: '300',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.round,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  replayIcon: { fontSize: 18 },
  replayText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  countdownBox: {
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  countdownLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    letterSpacing: 1,
    marginBottom: 4,
  },
  countdownTimer: {
    color: theme.colors.secondary,
    fontSize: 42,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  countdownSub: {
    color: theme.colors.textMuted,
    fontSize: theme.fontSize.xs,
    marginTop: 2,
  },
  understoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.xl,
    paddingHorizontal: 48,
    paddingVertical: 20,
    marginTop: theme.spacing.sm,
    elevation: 10,
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  understoodIcon: { fontSize: 28 },
  understoodText: {
    color: '#fff',
    fontSize: theme.fontSize.xl,
    fontWeight: '900',
    letterSpacing: 2,
  },
  footerHint: {
    color: theme.colors.textDim,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
  },
});
