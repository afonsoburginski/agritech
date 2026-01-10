/**
 * Sync Service
 * Gerencia sincronização entre SQLite local e Supabase remoto
 * 
 * Estratégia: Offline-First
 * 1. Todas operações são salvas primeiro no SQLite local
 * 2. Operações pendentes são adicionadas à fila de sync
 * 3. Quando online, processa a fila e envia ao Supabase
 * 4. Dados remotos são baixados e mesclados com locais
 */

import { supabase, isSupabaseConfigured } from './supabase';
import { getDatabase } from '@/database/db';
import { networkService } from './network-service';
import { logger } from './logger';
import { useAppStore } from '@/stores/app-store';

export type SyncOperation = 'create' | 'update' | 'delete';
export type EntityType = 'atividades' | 'scouts' | 'pragas';

// Mapeamento de tabelas SQLite → Supabase
const TABLE_MAP: Record<EntityType, string> = {
  atividades: 'activities',
  scouts: 'scouts',
  pragas: 'pests',
};

// Mapeamento inverso Supabase → SQLite
const REVERSE_TABLE_MAP: Record<string, EntityType> = {
  activities: 'atividades',
  scouts: 'scouts',
  pests: 'pragas',
};

interface SyncQueueItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  operation: SyncOperation;
  payload: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  nextRetryAt?: string;
}

class SyncService {
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  /**
   * Inicia o serviço de sincronização
   */
  start(): void {
    // Monitorar mudanças de rede
    networkService.addListener((isOnline) => {
      useAppStore.getState().setOnline(isOnline);
      if (isOnline) {
        this.sync();
      }
    });

    // Sincronizar a cada 5 minutos quando online
    this.syncInterval = setInterval(() => {
      if (networkService.online) {
        this.sync();
      }
    }, 5 * 60 * 1000);

    // Verificar status inicial
    networkService.getStatus().then((isOnline) => {
      useAppStore.getState().setOnline(isOnline);
      if (isOnline) {
        this.sync();
      }
    });

    logger.info('SyncService iniciado');
  }

  /**
   * Para o serviço de sincronização
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    logger.info('SyncService parado');
  }

  /**
   * Adiciona uma operação à fila de sincronização
   */
  async addToQueue(
    entityType: EntityType,
    entityId: string,
    operation: SyncOperation,
    payload: Record<string, any>
  ): Promise<void> {
    const db = await getDatabase();
    if (!db) {
      logger.warn('Database não disponível para adicionar à fila');
      return;
    }

    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      await db.runAsync(
        `INSERT INTO "sync-queue" 
         (id, "entity-type", "entity-id", operation, payload, "retry-count", "max-retries", status, "created-at", "updated-at")
         VALUES (?, ?, ?, ?, ?, 0, 5, 'pending', ?, ?)`,
        [id, entityType, entityId, operation, JSON.stringify(payload), now, now]
      );

      // Atualizar contador de pendentes
      await this.updatePendingCount();

      logger.info('Operação adicionada à fila de sync', { entityType, entityId, operation });
    } catch (error) {
      logger.error('Erro ao adicionar à fila de sync', { error, entityType, entityId });
    }
  }

  /**
   * Executa sincronização completa
   */
  async sync(): Promise<void> {
    if (this.isSyncing) {
      logger.info('Sincronização já em andamento');
      return;
    }

    if (!isSupabaseConfigured()) {
      logger.warn('Supabase não configurado, pulando sync');
      return;
    }

    if (!networkService.online) {
      logger.info('Offline, pulando sync');
      return;
    }

    this.isSyncing = true;
    useAppStore.getState().setSyncing(true);

    try {
      logger.info('Iniciando sincronização');

      // 1. Processar fila de operações pendentes (upload)
      await this.processQueue();

      // 2. Baixar dados remotos (download)
      await this.downloadRemoteData();

      // Marcar como sincronizado
      useAppStore.getState().markSynced();

      logger.info('Sincronização concluída com sucesso');
    } catch (error) {
      logger.error('Erro durante sincronização', { error });
    } finally {
      this.isSyncing = false;
      useAppStore.getState().setSyncing(false);
    }
  }

  /**
   * Processa a fila de sincronização (upload)
   */
  private async processQueue(): Promise<void> {
    const db = await getDatabase();
    if (!db || !supabase) return;

    try {
      const pendingItems = await db.getAllAsync<SyncQueueItem>(
        `SELECT * FROM "sync-queue" 
         WHERE status = 'pending' 
         ORDER BY "created-at" ASC 
         LIMIT 50`
      );

      for (const item of pendingItems) {
        await this.processSyncItem(item);
      }
    } catch (error) {
      logger.error('Erro ao processar fila de sync', { error });
    }
  }

  /**
   * Processa um item individual da fila
   */
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const db = await getDatabase();
    if (!db || !supabase) return;

    const now = new Date().toISOString();

    try {
      // Marcar como processando
      await db.runAsync(
        `UPDATE "sync-queue" SET status = 'processing', "updated-at" = ? WHERE id = ?`,
        [now, item.id]
      );

      const payload = JSON.parse(item.payload);
      
      // Mapear tabela SQLite → Supabase
      const supabaseTable = TABLE_MAP[item.entityType];

      // Executar operação no Supabase
      let error: any = null;

      switch (item.operation) {
        case 'create':
          const { error: createError } = await supabase
            .from(supabaseTable)
            .insert(this.toSnakeCase(payload));
          error = createError;
          break;

        case 'update':
          const { error: updateError } = await supabase
            .from(supabaseTable)
            .update(this.toSnakeCase(payload))
            .eq('id', item.entityId);
          error = updateError;
          break;

        case 'delete':
          const { error: deleteError } = await supabase
            .from(supabaseTable)
            .delete()
            .eq('id', item.entityId);
          error = deleteError;
          break;
      }

      if (error) {
        throw error;
      }

      // Marcar como concluído e marcar entidade como sincronizada
      await db.runAsync(
        `UPDATE "sync-queue" SET status = 'completed', "updated-at" = ? WHERE id = ?`,
        [now, item.id]
      );

      await db.runAsync(
        `UPDATE "${item.entityType}" SET synced = 1, "updated-at" = ? WHERE id = ?`,
        [now, item.entityId]
      );

      // Remover da fila após sucesso
      await db.runAsync(`DELETE FROM "sync-queue" WHERE id = ?`, [item.id]);

      logger.info('Item sincronizado com sucesso', { 
        entityType: item.entityType, 
        entityId: item.entityId 
      });
    } catch (error: any) {
      // Incrementar retry e marcar como falha
      const newRetryCount = item.retryCount + 1;
      const status = newRetryCount >= item.maxRetries ? 'failed' : 'pending';
      const nextRetryAt = new Date(Date.now() + Math.pow(2, newRetryCount) * 1000).toISOString();

      await db.runAsync(
        `UPDATE "sync-queue" 
         SET status = ?, "retry-count" = ?, "error-message" = ?, "next-retry-at" = ?, "updated-at" = ?
         WHERE id = ?`,
        [status, newRetryCount, error?.message || 'Erro desconhecido', nextRetryAt, now, item.id]
      );

      logger.warn('Falha ao sincronizar item', {
        entityType: item.entityType,
        entityId: item.entityId,
        retryCount: newRetryCount,
        error: error?.message,
      });
    }

    await this.updatePendingCount();
  }

  /**
   * Baixa dados remotos e mescla com locais
   */
  private async downloadRemoteData(): Promise<void> {
    const db = await getDatabase();
    if (!db || !supabase) return;

    // Iterar sobre as tabelas Supabase e mapear para SQLite
    const supabaseTables = ['activities', 'scouts', 'pests'] as const;

    for (const supabaseTable of supabaseTables) {
      const localTable = REVERSE_TABLE_MAP[supabaseTable];
      
      try {
        const { data, error } = await supabase
          .from(supabaseTable)
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(100);

        if (error) {
          logger.warn(`Erro ao baixar ${supabaseTable}`, { error: error.message });
          continue;
        }

        if (!data || data.length === 0) {
          continue;
        }

        // Upsert cada registro
        for (const remoteItem of data) {
          await this.upsertLocalRecord(localTable, remoteItem);
        }

        logger.info(`Baixados ${data.length} registros de ${supabaseTable}`);
      } catch (error) {
        logger.error(`Erro ao baixar ${supabaseTable}`, { error });
      }
    }
  }

  /**
   * Insere ou atualiza registro local
   */
  private async upsertLocalRecord(table: EntityType, remoteData: any): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    const localData = this.toCamelCase(remoteData);
    const now = new Date().toISOString();

    try {
      // Verificar se já existe
      const existing = await db.getFirstAsync(
        `SELECT id, "updated-at" FROM "${table}" WHERE id = ?`,
        [localData.id]
      ) as { id: string; 'updated-at': string } | null;

      if (existing) {
        // Só atualiza se o remoto for mais recente
        const remoteUpdatedAt = new Date(localData.updatedAt || now);
        const localUpdatedAt = new Date(existing['updated-at'] || '1970-01-01');

        if (remoteUpdatedAt > localUpdatedAt) {
          await this.updateLocalRecord(table, localData);
        }
      } else {
        await this.insertLocalRecord(table, localData);
      }
    } catch (error) {
      logger.error(`Erro ao upsert ${table}`, { error, id: localData.id });
    }
  }

  /**
   * Insere registro local
   */
  private async insertLocalRecord(table: EntityType, data: any): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    const now = new Date().toISOString();

    switch (table) {
      case 'atividades':
        await db.runAsync(
          `INSERT OR IGNORE INTO atividades 
           (id, nome, descricao, tipo, status, "data-inicio", "data-fim", "created-at", "updated-at", synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            data.id, data.nome, data.descricao, data.tipo, data.status,
            data.dataInicio, data.dataFim, data.createdAt || now, data.updatedAt || now
          ]
        );
        break;

      case 'scouts':
        await db.runAsync(
          `INSERT OR IGNORE INTO scouts 
           (id, latitude, longitude, accuracy, altitude, heading, speed, "created-at", "updated-at", synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            data.id, data.latitude, data.longitude, data.accuracy,
            data.altitude, data.heading, data.speed, data.createdAt || now, data.updatedAt || now
          ]
        );
        break;

      case 'pragas':
        await db.runAsync(
          `INSERT OR IGNORE INTO pragas 
           (id, "scout-id", nome, quantidade, severidade, "created-at", "updated-at", synced)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [
            data.id, data.scoutId, data.nome, data.quantidade,
            data.severidade, data.createdAt || now, data.updatedAt || now
          ]
        );
        break;
    }
  }

  /**
   * Atualiza registro local
   */
  private async updateLocalRecord(table: EntityType, data: any): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    const now = new Date().toISOString();

    switch (table) {
      case 'atividades':
        await db.runAsync(
          `UPDATE atividades SET 
           nome = ?, descricao = ?, tipo = ?, status = ?, 
           "data-inicio" = ?, "data-fim" = ?, "updated-at" = ?, synced = 1
           WHERE id = ?`,
          [
            data.nome, data.descricao, data.tipo, data.status,
            data.dataInicio, data.dataFim, data.updatedAt || now, data.id
          ]
        );
        break;

      case 'scouts':
        await db.runAsync(
          `UPDATE scouts SET 
           latitude = ?, longitude = ?, accuracy = ?, altitude = ?, 
           heading = ?, speed = ?, "updated-at" = ?, synced = 1
           WHERE id = ?`,
          [
            data.latitude, data.longitude, data.accuracy, data.altitude,
            data.heading, data.speed, data.updatedAt || now, data.id
          ]
        );
        break;

      case 'pragas':
        await db.runAsync(
          `UPDATE pragas SET 
           "scout-id" = ?, nome = ?, quantidade = ?, severidade = ?, 
           "updated-at" = ?, synced = 1
           WHERE id = ?`,
          [
            data.scoutId, data.nome, data.quantidade, data.severidade,
            data.updatedAt || now, data.id
          ]
        );
        break;
    }
  }

  /**
   * Atualiza contador de pendentes
   */
  private async updatePendingCount(): Promise<void> {
    const db = await getDatabase();
    if (!db) return;

    try {
      const result = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM "sync-queue" WHERE status = 'pending'`
      ) as { count: number } | null;

      useAppStore.getState().updateSyncStatus(result?.count || 0);
    } catch (error) {
      logger.error('Erro ao contar pendentes', { error });
    }
  }

  /**
   * Converte camelCase para snake_case (para Supabase)
   */
  private toSnakeCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      result[snakeKey] = obj[key];
    }
    return result;
  }

  /**
   * Converte snake_case para camelCase (do Supabase)
   */
  private toCamelCase(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = obj[key];
    }
    return result;
  }

  /**
   * Força sincronização manual
   */
  async forceSync(): Promise<void> {
    await this.sync();
  }

  /**
   * Retorna contagem de itens pendentes
   */
  async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    if (!db) return 0;

    try {
      const result = await db.getFirstAsync(
        `SELECT COUNT(*) as count FROM "sync-queue" WHERE status = 'pending'`
      ) as { count: number } | null;

      return result?.count || 0;
    } catch (error) {
      return 0;
    }
  }
}

export const syncService = new SyncService();
