// src/lib/modules/auth/auth.service.ts
import { supabase } from '@/src/lib/core/supabase/client.supabase';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  name: string;
}

export const authService = {
  /**
   * Registro de usuario con Supabase Auth
   */
  register: async (credentials: RegisterCredentials) => {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          name: credentials.name,
        },
      },
    });

    if (error) {
      console.error('Error en registro:', error.message);
      throw error;
    }

    console.log('✅ Usuario registrado:', data.user?.email);
    return data;
  },

  /**
   * Login con Supabase Auth
   */
  login: async (credentials: AuthCredentials) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      console.error('Error en login:', error.message);
      throw error;
    }

    console.log('✅ Usuario autenticado:', data.user?.email);
    return data;
  },

  /**
   * Logout
   */
  logout: async () => {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Error en logout:', error.message);
      throw error;
    }

    console.log('✅ Sesión cerrada');
  },

  /**
   * Obtener sesión actual
   */
  getSession: async () => {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error obteniendo sesión:', error.message);
      throw error;
    }

    return data.session;
  },

  /**
   * Enviar notificación push a un usuario específico
   */
  sendPushNotification: async (
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>
  ) => {
    try {
      // 1. Obtener tokens del usuario desde Supabase
      const { data: tokens, error } = await supabase
        .from('push_tokens')
        .select('expo_push_token')
        .eq('user_id', userId);

      if (error) {
        console.error('Error obteniendo tokens:', error);
        return;
      }

      if (!tokens || tokens.length === 0) {
        console.log('⚠️ No hay tokens registrados para este usuario');
        return;
      }

      // 2. Preparar mensajes para Expo Push Service
      const messages = tokens.map((token) => ({
        to: token.expo_push_token,
        sound: 'default',
        title,
        body,
        data: { ...data, userId },
      }));

      // 3. Enviar a Expo Push Notification Service
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('📤 Notificación enviada exitosamente');
      } else {
        console.error('❌ Error en respuesta de Expo:', result);
      }

      return result;
    } catch (error) {
      console.error('❌ Error enviando notificación push:', error);
      throw error;
    }
  },

  /**
   * Enviar notificación de bienvenida al iniciar sesión
   */
  sendWelcomeNotification: async (userId: string, userName?: string) => {
    const title = `¡Bienvenido${userName ? ` ${userName}` : ''}! 👋`;
    const body = 'Has iniciado sesión exitosamente en la aplicación';
    
    await authService.sendPushNotification(userId, title, body, {
      type: 'welcome',
      timestamp: new Date().toISOString(),
    });
  },
};