// src/lib/core/notifications/notification.adapter.ts
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export const NotificationAdapter = {
  /**
   * Configuración global de notificaciones
   */
  setup: () => {
    // Definir comportamiento cuando se recibe notificación con app ABIERTA
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        // 🔔 Mostrar alerta visual
        shouldShowAlert: true,
        // 🔊 Reproducir sonido
        shouldPlaySound: true,
        // 🔴 No alterar badge del ícono
        shouldSetBadge: false,
        // 🏳️ Mostrar banner deslizable (iOS)
        shouldShowBanner: true,
        // 📜 Mantener en Centro de Notificaciones (iOS)
        shouldShowList: true,
      }),
    });
  },

  /**
   * Registrar dispositivo y obtener Expo Push Token
   * @returns Token de Expo o null si falla
   */
  registerForPushNotificationsAsync: async (): Promise<string | null> => {
    let token;

    // A. Configuración específica para ANDROID 🤖
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#bd93f9', // Color del LED (Dracula Purple)
      });
    }

    // B. Verificar que es dispositivo físico 📱
    // (Los simuladores NO tienen Push Token)
    if (Device.isDevice) {
      // C. Gestión de Permisos 👮
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Si no tenemos permiso, pedirlo
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // Si el usuario rechazó el permiso
      if (finalStatus !== 'granted') {
        console.log('⚠️ Permiso de notificaciones denegado por el usuario');
        return null;
      }

      // D. Obtener el Token de Expo 🎟️
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        process.env.EXPO_PUBLIC_PROJECT_ID;

      if (!projectId) {
        console.warn('⚠️ No se encontró Project ID. Configura EAS o .env');
      }

      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;

      console.log('✅ Expo Push Token obtenido:', token);
    } else {
      console.log('⚠️ Debes usar un dispositivo físico para Push Notifications');
      console.log('💡 Los simuladores/emuladores NO soportan notificaciones push');
    }

    return token || null;
  },
};