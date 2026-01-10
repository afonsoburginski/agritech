import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
// import 'react-native-reanimated'; // Comentado temporariamente devido a incompatibilidade com Expo Go

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore, useAuthIsAuthenticated, useAuthIsLoading } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import type { AppState } from '@/stores/app-store';
import { initializeDatabase } from '@/database/db';
import { logger } from '@/services/logger';
import { ThemeProvider } from '@/theme/theme-provider';
import { networkService } from '@/services/network-service';
import { syncService } from '@/services/sync-service';

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
  const loadAvatar = useAppStore((state: AppState) => state.loadAvatar);

  // Inicializar database, serviços de rede/sync e verificar autenticação ao iniciar
  useEffect(() => {
    const init = async () => {
      try {
        // 1. Inicializar database SQLite
        await initializeDatabase();
        
        // 2. Carregar avatar salvo
        await loadAvatar();
        
        // 3. Iniciar monitoramento de rede
        networkService.start();
        
        // 4. Iniciar serviço de sincronização
        syncService.start();
        
        logger.info('App inicializado com sucesso');
      } catch (error) {
        logger.error('Erro ao inicializar app', { error }, error as Error);
      }
      checkAuth();
    };
    
    init();
    
    // Cleanup ao desmontar
    return () => {
      networkService.stop();
      syncService.stop();
    };
  }, [checkAuth, loadAvatar]);

  // Gerenciar navegação baseada em autenticação
  useEffect(() => {
    if (isLoading) {
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
