import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text, StyleSheet } from 'react-native';

import HomeScreen      from './src/screens/HomeScreen';
import AddEditScreen   from './src/screens/AddEditScreen';
import AlertScreen     from './src/screens/AlertScreen';
import SettingsScreen  from './src/screens/SettingsScreen';
import RegistrosScreen from './src/screens/RegistrosScreen';
import AddRegistroScreen from './src/screens/AddRegistroScreen';

import { setupNotifications, rebuildAllAlarms } from './src/utils/alarmManager';
import { theme } from './src/theme';

SplashScreen.preventAutoHideAsync();
const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef(null);
  const notifListener  = useRef();
  const responseListener = useRef();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      try { await setupNotifications(); await rebuildAllAlarms(); } catch {}
      finally { setReady(true); await SplashScreen.hideAsync(); }
    }
    init();
  }, []);

  useEffect(() => {
    notifListener.current = Notifications.addNotificationReceivedListener(n => {
      const d = n.request.content.data;
      if ((d?.type === 'agenda_alarm' || d?.type === 'agenda_repeat') && navigationRef.current)
        navigationRef.current.navigate('Alert', { itemId: d.itemId });
    });
    responseListener.current = Notifications.addNotificationResponseReceivedListener(r => {
      const d = r.notification.request.content.data;
      if (r.actionIdentifier === 'UNDERSTOOD') return;
      if ((d?.type === 'agenda_alarm' || d?.type === 'agenda_repeat') && navigationRef.current)
        navigationRef.current.navigate('Alert', { itemId: d.itemId });
    });
    return () => {
      Notifications.removeNotificationSubscription(notifListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  if (!ready) return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Agenda Voz</Text>
    </View>
  );

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" backgroundColor={theme.colors.background} />
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: theme.colors.background } }}>
        <Stack.Screen name="Home"        component={HomeScreen} />
        <Stack.Screen name="AddEdit"     component={AddEditScreen}     options={{ presentation: 'modal' }} />
        <Stack.Screen name="Alert"       component={AlertScreen}       options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="Settings"    component={SettingsScreen}    options={{ presentation: 'modal' }} />
        <Stack.Screen name="Registros"   component={RegistrosScreen} />
        <Stack.Screen name="AddRegistro" component={AddRegistroScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: theme.colors.primary, fontSize: 22, fontWeight: 'bold' },
});
