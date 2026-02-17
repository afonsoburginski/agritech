/**
 * Hook de Sincronização
 * Fornece acesso ao status de sync e funções de controle
 */

import { useCallback } from 'react';
import { useAppStore, useIsOnline, useIsSyncing, usePendingSyncCount } from '@/stores/app-store';
import { syncService } from '@/services/sync-service';
import { logger } from '@/services/logger';

export function useSync() {
  const isOnline = useIsOnline();
  const isSyncing = useIsSyncing();
  const pendingCount = usePendingSyncCount();
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);

  /**
   * Força sincronização manual
   */
  const forceSync = useCallback(async () => {
    if (!isOnline) {
      logger.warn('Não é possível sincronizar: offline');
      return false;
    }

    if (isSyncing) {
      logger.info('Sincronização já em andamento');
      return false;
    }

    try {
      await syncService.forceSync();
      return true;
    } catch (error) {
      logger.error('Erro ao forçar sincronização', { error });
      return false;
    }
  }, [isOnline, isSyncing]);

  /**
   * Retorna status formatado para exibição
   */
  const getStatusText = useCallback(() => {
    if (!isOnline) {
      return 'Offline';
    }
    if (isSyncing) {
      return 'Sincronizando...';
    }
    if (pendingCount > 0) {
      return `${pendingCount} pendente${pendingCount > 1 ? 's' : ''}`;
    }
    return 'Sincronizado';
  }, [isOnline, isSyncing, pendingCount]);

  /**
   * Retorna última sincronização formatada
   */
  const getLastSyncText = useCallback(() => {
    if (!lastSyncAt) {
      return 'Nunca sincronizado';
    }

    const date = new Date(lastSyncAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Agora mesmo';
    }
    if (diffMinutes < 60) {
      return `Há ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
    }
    if (diffHours < 24) {
      return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    }
    return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  }, [lastSyncAt]);

  return {
    isOnline,
    isSyncing,
    pendingCount,
    lastSyncAt,
    forceSync,
    getStatusText,
    getLastSyncText,
  };
}
