// src/lib/modules/auth/AuthProvider.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '@/src/lib/core/supabase/client.supabase';
import { authService } from './auth.service';
import { Session } from '@supabase/supabase-js';
import { usePushNotifications } from '@/src/lib/core/notifications/usePushNotifications';

interface AuthContextType {
  session: Session | null;
  user: Session['user'] | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Configurar notificaciones push
  usePushNotifications({
    userId: session?.user?.id || null,
    enabled: !!session,
  });

  useEffect(() => {
    // Obtener sesión inicial
    authService
      .getSession()
      .then(setSession)
      .finally(() => setIsLoading(false));

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event);
      setSession(session);

      // Enviar notificación cuando el usuario inicia sesión
      if (event === 'SIGNED_IN' && session?.user) {
        const userName = session.user.user_metadata?.name;
        
        // Pequeño delay para asegurar que el token se guardó
        setTimeout(() => {
          authService.sendWelcomeNotification(session.user.id, userName);
        }, 2000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await authService.login({ email, password });
    } catch (error: any) {
      throw new Error(error.message || 'Error al iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true);
    try {
      await authService.register({ email, password, name });
    } catch (error: any) {
      throw new Error(error.message || 'Error al registrarse');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await authService.logout();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};