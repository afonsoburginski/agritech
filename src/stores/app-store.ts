/**
 * App Store - Estado Global MÍNIMO
 * 
 * APENAS dados que PRECISAM ser globais:
 * - Status de conexão
 * - Contadores para badges/dashboard
 * - Última sincronização
 * 
 * NÃO colocar aqui:
 * - Listas completas de dados (usar hooks + SQLite)
 * - Estado de UI/formulários (usar useState local)
 * - Filtros de tela (usar useState local)
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/services/logger';

const AVATAR_STORAGE_KEY = '@agritech:user_avatar';

export interface AppState {
  // Conexão
  isOnline: boolean;
  
  // Sync
  pendingSyncCount: number;
  lastSyncAt: string | null;
  isSyncing: boolean;
  
  // Avatar do usuário
  avatarUri: string | null;
  
  // Contadores (para badges/dashboard) - atualizados sob demanda
  counts: {
    atividadesPendentes: number;
    scoutsPendentes: number;
    pragasTotal: number;
  };

  // Actions
  setOnline: (isOnline: boolean) => void;
  setSyncing: (isSyncing: boolean) => void;
  updateSyncStatus: (pendingCount: number) => void;
  markSynced: () => void;
  updateCounts: (counts: Partial<AppState['counts']>) => void;
  setAvatar: (uri: string | null) => Promise<void>;
  loadAvatar: () => Promise<void>;
  
  // Refresh counts from SQLite
  refreshCounts: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Estado inicial
  isOnline: true,
  pendingSyncCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  avatarUri: null,
  counts: {
    atividadesPendentes: 0,
    scoutsPendentes: 0,
    pragasTotal: 0,
  },

  setOnline: (isOnline) => {
    set({ isOnline });
    if (isOnline) {
      logger.info('App online');
    } else {
      logger.warn('App offline');
    }
  },

  setSyncing: (isSyncing) => {
    set({ isSyncing });
  },

  updateSyncStatus: (pendingCount) => {
    set({ pendingSyncCount: pendingCount });
  },

  markSynced: () => {
    set({ 
      lastSyncAt: new Date().toISOString(),
      pendingSyncCount: 0,
    });
  },

  updateCounts: (counts) => {
    set((state) => ({
      counts: { ...state.counts, ...counts },
    }));
  },

  refreshCounts: async () => {
    try {
      // TODO: Buscar contadores do SQLite
      // Por enquanto, valores mock
      set({
        counts: {
          atividadesPendentes: 3,
          scoutsPendentes: 2,
          pragasTotal: 7,
        },
      });
    } catch (error) {
      logger.error('Erro ao atualizar contadores', { error });
    }
  },

  setAvatar: async (uri) => {
    try {
      if (uri) {
        await AsyncStorage.setItem(AVATAR_STORAGE_KEY, uri);
      } else {
        await AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
      }
      set({ avatarUri: uri });
      logger.info('Avatar atualizado', { hasAvatar: !!uri });
    } catch (error) {
      logger.error('Erro ao salvar avatar', { error });
      throw error;
    }
  },

  loadAvatar: async () => {
    try {
      const savedAvatar = await AsyncStorage.getItem(AVATAR_STORAGE_KEY);
      set({ avatarUri: savedAvatar });
      logger.info('Avatar carregado', { hasAvatar: !!savedAvatar });
    } catch (error) {
      logger.error('Erro ao carregar avatar', { error });
    }
  },
}));

// Selectors simples
export const useIsOnline = () => useAppStore((s) => s.isOnline);
export const useIsSyncing = () => useAppStore((s) => s.isSyncing);
export const usePendingSyncCount = () => useAppStore((s) => s.pendingSyncCount);
export const useAppCounts = () => useAppStore((s) => s.counts);
export const useAvatarUri = () => useAppStore((s) => s.avatarUri);