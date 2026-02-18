// src/lib/core/notifications/usePushNotifications.ts
import { useEffect, useRef, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { NotificationAdapter } from './notification.adapter';
import { supabase } from '../supabase/client.supabase';

interface UsePushNotificationsProps {
  userId?: string | null;
  enabled?: boolean;
  onAppOpen?: () => void;
}

export const usePushNotifications = ({
  userId,
  enabled = true,
  onAppOpen,
}: UsePushNotificationsProps) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    // 1. Configurar handler de notificaciones
    NotificationAdapter.setup();

    // 2. Registrar dispositivo y obtener token
    const registerDevice = async () => {
      const token = await NotificationAdapter.registerForPushNotificationsAsync();

      if (token) {
        setExpoPushToken(token);

        // Si hay userId, guardar en Supabase
        if (userId) {
          await saveTokenToSupabase(token, userId);
        }
      }
    };

    registerDevice();

    // 3. Listener: Notificación recibida (app en foreground)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('📩 Notificación recibida:', notification);
        setNotification(notification);
      }
    );

    // 4. Listener: Usuario tocó la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Usuario interactuó con notificación:', response);
        // Aquí puedes navegar a una pantalla específica según response.notification.request.content.data
      }
    );

    // 5. Listener: Detectar cuando la app pasa a foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 App abierta desde background');
        
        // Callback opcional
        if (onAppOpen) {
          onAppOpen();
        }

        // Enviar notificación de "app abierta"
        if (userId) {
          sendAppOpenedNotification(userId);
        }
      }

      appState.current = nextAppState;
    });

    return () => {
        notificationListener.current?.remove();
        responseListener.current?.remove();
        subscription.remove();
      };      
  }, [userId, enabled]);

  /**
   * Guardar token en Supabase
   */
  const saveTokenToSupabase = async (token: string, userId: string) => {
    try {
      const deviceName = Device.deviceName || Platform.OS;

      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          expo_push_token: token,
          device_name: deviceName,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'expo_push_token',
        }
      );

      if (error) {
        console.error('❌ Error guardando token en Supabase:', error);
      } else {
        console.log('✅ Token guardado exitosamente en Supabase');
      }
    } catch (error) {
      console.error('❌ Error en saveTokenToSupabase:', error);
    }
  };

  /**
   * Enviar notificación cuando se abre la app
   */
  const sendAppOpenedNotification = async (userId: string) => {
    try {
      // Obtener tokens del usuario
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .eq('user_id', userId);

      if (!tokens || tokens.length === 0) return;

      // Preparar mensaje
      const messages = tokens.map((token) => ({
        to: token.expo_push_token,
        sound: 'default',
        title: '👋 ¡Hola de nuevo!',
        body: 'Bienvenido de vuelta a la aplicación',
        data: { type: 'app_opened', userId },
      }));

      // Enviar a Expo Push Service
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      console.log('📤 Notificación de "app abierta" enviada');
    } catch (error) {
      console.error('Error enviando notificación de app abierta:', error);
    }
  };

  /**
   * Enviar notificación local de prueba
   */
  const sendTestNotification = async () => {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🧪 Notificación de Prueba',
        body: 'Esta es una notificación local de testing',
        data: { test: true },
      },
      trigger: null, // null = enviar inmediatamente
    });
  };

  return {
    expoPushToken,
    notification,
    sendTestNotification,
  };
};