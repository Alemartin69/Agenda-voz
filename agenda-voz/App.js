import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { View, Text, StyleSheet } from 'react-native';

import HomeScreen from './src/screens/HomeScreen';
import AddEditScreen from './src/screens/AddEditScreen';
import AlertScreen from './src/screens/AlertScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { setupNotifications, rebuildAllAlarms } from './src/utils/alarmManager';
import { theme } from './src/theme';

SplashScreen.preventAutoHideAsync();

const Stack = createStackNavigator();

export default function App() {
  const navigationRef = useRef(null);
  const notificationListener = useRef();
  const responseListener = useRef();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await setupNotifications();
        await rebuildAllAlarms();
      } catch (e) {
        console.warn('Init error:', e);
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    }
    init();
  }, []);

  useEffect(() => {
    // Notificación recibida con app en PRIMER PLANO
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.type === 'agenda_alarm' || data?.type === 'agenda_repeat') {
        if (navigationRef.current) {
          navigationRef.current.navigate('Alert', { itemId: data.itemId });
        }
      }
    });

    // Usuario tocó la notificación (app en segundo plano o cerrada)
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const actionId = response.actionIdentifier;

      if (actionId === 'UNDERSTOOD') {
        // El usuario presionó Entendido desde la notificación directamente
        return;
      }

      if (data?.type === 'agenda_alarm' || data?.type === 'agenda_repeat') {
        if (navigationRef.current) {
          navigationRef.current.navigate('Alert', { itemId: data.itemId });
        }
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener.current);
      Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Agenda Voz</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" backgroundColor={theme.colors.background} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          cardStyle: { backgroundColor: theme.colors.background },
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddEdit" component={AddEditScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Alert" component={AlertScreen} options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
  },
});
