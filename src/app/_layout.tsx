import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
// import 'react-native-reanimated'; // Comentado temporariamente devido a incompatibilidade com Expo Go

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore, useAuthIsAuthenticated, useAuthIsLoading } from '@/stores/auth-store';
import { initializeDatabase } from '@/database/db';
import { logger } from '@/services/logger';
import { ThemeProvider } from '@/theme/theme-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthIsAuthenticated();
  const isLoading = useAuthIsLoading();
  const checkAuth = useAuthStore((state) => state.checkAuth);

  // Inicializar database e verificar autenticação ao iniciar
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDatabase();
      } catch (error) {
        logger.error('Erro ao inicializar database', { error }, error as Error);
      }
      checkAuth();
    };
    init();
  }, [checkAuth]);

  // Gerenciar navegação baseada em autenticação
  useEffect(() => {
    if (isLoading) {
      return;
    }

    // Ignorar se segments ainda está vazio (router não inicializou)
    if (segments.length === 0) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';
    
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
    // Não redirecionar se já está em (tabs) e autenticado
  }, [isAuthenticated, segments, isLoading, router]);

  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar hidden={true} />
    </ThemeProvider>
  );
}
