import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useAuthStore, useAuthIsAuthenticated, useAuthIsLoading, usePendingFazendaChoice } from '@/stores/auth-store';
import { useAppStore } from '@/stores/app-store';
import type { AppState } from '@/stores/app-store';
import { initWatermelonDB } from '@/database/watermelon';
import { logger } from '@/services/logger';
import { ThemeProvider } from '@/theme/theme-provider';
import { networkService } from '@/services/network-service';
import { syncService } from '@/services/sync-service';
import { refreshPendingRecognitionCount } from '@/services/recognition-queue-service';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAuthIsAuthenticated();
  const isLoading = useAuthIsLoading();
  const pendingFazendaChoice = usePendingFazendaChoice();
  const initialize = useAuthStore((state) => state.initialize);
  const loadAvatar = useAppStore((state: AppState) => state.loadAvatar);

  // Initialize Supabase auth listener and app services
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Initialize WatermelonDB (SQLite) — requires dev build; in Expo Go falls back to in-memory
        const dbPromise = initWatermelonDB();
        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Database timeout')), 8000)
        );
        await Promise.race([dbPromise, timeoutPromise]).catch(() => {});

        if (!mounted) return;

        // 2. Load saved avatar
        try {
          await loadAvatar();
        } catch (e) {
          logger.warn('Erro ao carregar avatar', { error: e });
        }

        if (!mounted) return;

        // 3. Start network monitoring
        try {
          networkService.start();
        } catch (e) {
          logger.warn('Erro ao iniciar NetworkService', { error: e });
        }

        // 4. Start sync service (delayed to not block UI)
        setTimeout(() => {
          if (mounted) {
            try {
              syncService.start();
            } catch (e) {
              logger.warn('Erro ao iniciar SyncService', { error: e });
            }
          }
        }, 2000);

        // 5. Carregar contador da fila de reconhecimento (offline)
        if (mounted) {
          try {
            await refreshPendingRecognitionCount();
          } catch (e) {
            logger.warn('Erro ao carregar fila de reconhecimento', { error: e });
          }
        }

      } catch (error) {
        logger.error('Erro ao inicializar app', { error }, error as Error);
      }
    };

    init();

    // Initialize Supabase auth listener (returns unsubscribe function)
    const unsubscribe = initialize();

    // Cleanup on unmount
    return () => {
      mounted = false;
      unsubscribe();
      networkService.stop();
      syncService.stop();
    };
  }, [initialize, loadAvatar]);

  // Auth-based navigation guard: login → (se >1 fazenda) (auth)/escolher-fazenda → tabs
  // No Android/Expo Go segments pode vir em ordem diferente; considerar qualquer tela de auth
  useEffect(() => {
    if (isLoading) return;

    const segs = (segments || []) as string[];
    const inAuthGroup = segs[0] === '(auth)' || segs.some((s) => ['login', 'signup', 'forgot-password', 'escolher-fazenda'].includes(String(s)));
    const onEscolherFazenda = segs.includes('escolher-fazenda');

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }
    if (isAuthenticated && inAuthGroup && !onEscolherFazenda) {
      if (pendingFazendaChoice) {
        router.replace('/(auth)/escolher-fazenda');
      } else {
        router.replace('/(tabs)');
      }
      return;
    }
    if (isAuthenticated && (segs[0] === '(tabs)' || segs.includes('inicio')) && pendingFazendaChoice) {
      router.replace('/(auth)/escolher-fazenda');
    }
  }, [isAuthenticated, segments, isLoading, pendingFazendaChoice, router]);

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
