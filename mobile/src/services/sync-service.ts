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

import { Q } from '@nozbe/watermelondb';
import { supabase, isSupabaseConfigured } from './supabase';
import { getWatermelonDB } from '@/database/watermelon/database';
import { networkService } from './network-service';
import SyncQueueModel from '@/database/watermelon/models/SyncQueue';
import AtividadeModel from '@/database/watermelon/models/Atividade';
import ScoutModel from '@/database/watermelon/models/Scout';
import PragaModel from '@/database/watermelon/models/Praga';
import { logger } from './logger';
import { useAppStore } from '@/stores/app-store';
import { processRecognitionQueue } from './recognition-queue-service';

export type SyncOperation = 'create' | 'update' | 'delete';
export type EntityType = 'atividades' | 'scouts' | 'pragas';

const TABLE_MAP: Record<EntityType, string> = {
  atividades: 'atividades',
  scouts: 'scouts',
  pragas: 'scout_pragas',
};

const REVERSE_TABLE_MAP: Record<string, EntityType> = {
  atividades: 'atividades',
  scouts: 'scouts',
  scout_pragas: 'pragas',
};


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
    const db = getWatermelonDB();
    if (!db) {
      logger.warn('Database não disponível para adicionar à fila');
      return;
    }

    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    try {
      await db.write(async () => {
        const coll = db.get<SyncQueueModel>('sync_queue');
        const record = coll.prepareCreateFromDirtyRaw({
          id,
          entity_type: entityType,
          entity_id: entityId,
          operation,
          payload: JSON.stringify(payload),
          retry_count: 0,
          max_retries: 5,
          status: 'pending',
          error_message: null,
          created_at: now,
          updated_at: now,
          next_retry_at: null,
        });
        await db.batch(record);
      });

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

      // 1. Processar fila de operações pendentes (upload)
      await this.processQueue();

      // 2. Baixar dados remotos (download)
      await this.downloadRemoteData();

      // 3. Processar fila de reconhecimento de pragas (fotos tiradas offline)
      try {
        const { processed } = await processRecognitionQueue();
        if (processed > 0) {
          logger.info('Reconhecimentos da fila processados', { count: processed });
        }
      } catch (err) {
        logger.warn('Erro ao processar fila de reconhecimento', { error: err });
      }

      // Marcar como sincronizado
      useAppStore.getState().markSynced();

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
    const db = getWatermelonDB();
    if (!db || !supabase) return;

    try {
      const pendingItems = await db
        .get<SyncQueueModel>('sync_queue')
        .query(Q.where('status', 'pending'), Q.sortBy('created_at', Q.asc), Q.take(50))
        .fetch();

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
  private async processSyncItem(item: SyncQueueModel): Promise<void> {
    const db = getWatermelonDB();
    if (!db || !supabase) return;

    const now = Date.now();

    try {
      await db.write(async () => {
        await item.update((r) => {
          r.status = 'processing';
          r.updatedAt = new Date(now);
        });
      });

      const payload = JSON.parse(item.payload);
      const supabaseTable = TABLE_MAP[item.entityType as EntityType] as any;
      let error: any = null;

      switch (item.operation) {
        case 'create':
          const { error: createError } = await supabase
            .from(supabaseTable)
            .insert(this.toSnakeCase(payload) as any);
          error = createError;
          break;
        case 'update':
          const { error: updateError } = await supabase
            .from(supabaseTable)
            .update(this.toSnakeCase(payload) as any)
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

      if (error) throw error;

      await db.write(async () => {
        await item.update((r) => {
          r.status = 'completed';
          r.updatedAt = new Date(now);
        });

        const entityColl =
          item.entityType === 'atividades'
            ? db.get<AtividadeModel>('atividades')
            : item.entityType === 'scouts'
              ? db.get<ScoutModel>('scouts')
              : db.get<PragaModel>('pragas');
        const entity = await entityColl.find(item.entityId);
        await entity.update((r: any) => {
          r.synced = true;
          r.updatedAt = new Date(now);
        });

        await item.destroyPermanently();
      });

      logger.info('Item sincronizado com sucesso', {
        entityType: item.entityType,
        entityId: item.entityId,
      });
    } catch (error: any) {
      const newRetryCount = item.retryCount + 1;
      const status = newRetryCount >= item.maxRetries ? 'failed' : 'pending';
      const nextRetryAt = Date.now() + Math.pow(2, newRetryCount) * 1000;

      await db.write(async () => {
        await item.update((r) => {
          r.status = status;
          r.retryCount = newRetryCount;
          r.errorMessage = error?.message || 'Erro desconhecido';
          r.nextRetryAt = nextRetryAt;
          r.updatedAt = new Date(now);
        });
      });

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
   * Retorna os IDs das fazendas do usuário logado (user_fazendas).
   * Só baixamos dados dessas fazendas para o WatermelonDB.
   */
  private async getFazendaIdsForCurrentUser(): Promise<number[]> {
    if (!supabase) return [];
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        logger.warn('Download remoto: usuário não autenticado');
        return [];
      }
      const { data, error } = await supabase
        .from('user_fazendas')
        .select('fazenda_id')
        .eq('user_id', session.user.id);
      if (error) {
        logger.warn('Erro ao buscar fazendas do usuário', { error: error.message });
        return [];
      }
      const ids = (data ?? []).map((r: { fazenda_id: number }) => r.fazenda_id).filter((id): id is number => id != null);
      logger.info('Fazendas do usuário para download', { count: ids.length, ids });
      return ids;
    } catch (e) {
      logger.error('Erro ao obter fazendas do usuário', { error: e });
      return [];
    }
  }

  /**
   * Baixa do Supabase apenas atividades, scouts e pragas das fazendas do usuário
   * e grava no WatermelonDB (não baixa a base inteira).
   */
  private async downloadRemoteData(): Promise<void> {
    const db = getWatermelonDB();
    if (!db || !supabase) return;

    const fazendaIds = await this.getFazendaIdsForCurrentUser();
    if (fazendaIds.length === 0) {
      logger.info('Nenhuma fazenda do usuário para baixar');
      return;
    }

    // 1) Atividades da(s) fazenda(s) do usuário
    try {
      const { data: atividades, error } = await supabase
        .from('atividades')
        .select('*')
        .in('fazenda_id', fazendaIds)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.warn('Erro ao baixar atividades', { error: error.message });
      } else if (atividades?.length) {
        for (const row of atividades) {
          await this.upsertLocalRecord('atividades', this.mapRemoteAtividade(row));
        }
        logger.info('Atividades baixadas para WatermelonDB', { count: atividades.length });
      }
    } catch (e) {
      logger.error('Erro ao baixar atividades', { error: e });
    }

    // 2) Scouts da(s) fazenda(s) do usuário (monitoramentos)
    try {
      const { data: scouts, error } = await supabase
        .from('scouts')
        .select('*')
        .in('fazenda_id', fazendaIds)
        .order('updated_at', { ascending: false });

      if (error) {
        logger.warn('Erro ao baixar scouts', { error: error.message });
      } else if (scouts?.length) {
        const scoutIds = scouts.map((s: { id: number }) => s.id);

        const { data: firstPragas } = await supabase
          .from('scout_pragas')
          .select('scout_id, coordinates')
          .in('scout_id', scoutIds);

        const firstCoordByScout = new Map<number, { latitude: number; longitude: number }>();
        for (const p of firstPragas ?? []) {
          if (!firstCoordByScout.has(p.scout_id) && p.coordinates?.type === 'Point' && Array.isArray(p.coordinates?.coordinates) && p.coordinates.coordinates.length >= 2) {
            const [lng, lat] = p.coordinates.coordinates;
            firstCoordByScout.set(p.scout_id, {
              latitude: Number(lat) || 0,
              longitude: Number(lng) || 0,
            });
          }
        }

        for (const row of scouts) {
          const coord = firstCoordByScout.get(row.id);
          await this.upsertLocalRecord('scouts', this.mapRemoteScout(row, coord));
        }
        logger.info('Scouts baixados para WatermelonDB', { count: scouts.length });

        // 3) Pragas (scout_pragas) dos scouts que já baixamos
        const { data: pragasRows, error: pragasError } = await supabase
          .from('scout_pragas')
          .select('id, scout_id, embrapa_recomendacao_id, contagem, prioridade, data_contagem, created_at, updated_at, embrapa_recomendacoes(nome_praga)')
          .in('scout_id', scoutIds)
          .order('data_contagem', { ascending: false });

        if (pragasError) {
          logger.warn('Erro ao baixar pragas', { error: pragasError.message });
        } else if (pragasRows?.length) {
          let count = 0;
          for (const row of pragasRows) {
            await this.upsertLocalRecord('pragas', this.mapRemotePraga(row, row.scout_id));
            count++;
          }
          logger.info('Pragas baixadas para WatermelonDB', { count });
        }
      }
    } catch (e) {
      logger.error('Erro ao baixar scouts/pragas', { error: e });
    }
  }

  private mapRemoteAtividade(row: any): any {
    const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
    return {
      id: String(row.id),
      nome: row.titulo ?? row.nome ?? '',
      descricao: row.descricao ?? null,
      tipo: row.tipo ?? null,
      status: row.situacao ?? row.status ?? null,
      dataInicio: row.data_inicio ? new Date(row.data_inicio).getTime() : null,
      dataFim: row.data_fim ? new Date(row.data_fim).getTime() : null,
      createdAt: created,
      updatedAt: updated,
    };
  }

  private mapRemoteScout(row: any, firstMarker?: { latitude: number; longitude: number }): any {
    const created = row.created_at ? new Date(row.created_at).getTime() : Date.now();
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : Date.now();
    return {
      id: String(row.id),
      latitude: firstMarker?.latitude ?? 0,
      longitude: firstMarker?.longitude ?? 0,
      accuracy: null,
      altitude: null,
      heading: null,
      speed: null,
      createdAt: created,
      updatedAt: updated,
    };
  }

  private mapRemotePraga(row: any, scoutId: number): any {
    const created = row.data_contagem ? new Date(row.data_contagem).getTime() : (row.created_at ? new Date(row.created_at).getTime() : Date.now());
    const updated = row.updated_at ? new Date(row.updated_at).getTime() : created;
    const er = row.embrapa_recomendacoes ?? {};
    return {
      id: String(row.id),
      scoutId: String(scoutId),
      nome: er.nome_praga ?? '',
      embrapaRecomendacaoId: row.embrapa_recomendacao_id != null ? String(row.embrapa_recomendacao_id) : null,
      quantidade: row.contagem ?? 1,
      severidade: row.prioridade ?? null,
      createdAt: created,
      updatedAt: updated,
    };
  }

  /**
   * Insere ou atualiza registro local
   */
  private async upsertLocalRecord(table: EntityType, remoteData: any): Promise<void> {
    const db = getWatermelonDB();
    if (!db) return;

    const localData = this.toCamelCase(remoteData);
    const now = Date.now();

    try {
      const tableName = table === 'atividades' ? 'atividades' : table === 'scouts' ? 'scouts' : 'pragas';
      let existing: AtividadeModel | ScoutModel | PragaModel | null = null;
      try {
        existing = (await db.get(tableName).find(localData.id)) as any;
      } catch {
        // not found
      }
      if (existing) {
        const remoteTs =
          typeof localData.updatedAt === 'string'
            ? new Date(localData.updatedAt).getTime()
            : (localData.updatedAt as number) ?? now;
        const localTs = (existing as any).updatedAt?.getTime?.() ?? 0;
        if (remoteTs > localTs) {
          await this.updateLocalRecord(table, localData);
        }
      } else {
        await this.insertLocalRecord(table, localData);
      }
    } catch (error) {
      logger.error(`Erro ao upsert ${table}`, { error, id: localData.id });
    }
  }

  private toTimestamp(v: any): number {
    if (v == null) return Date.now();
    if (typeof v === 'number') return v;
    return new Date(v).getTime();
  }

  /**
   * Insere registro local
   */
  private async insertLocalRecord(table: EntityType, data: any): Promise<void> {
    const db = getWatermelonDB();
    if (!db) return;

    const now = Date.now();
    const created = this.toTimestamp(data.createdAt);
    const updated = this.toTimestamp(data.updatedAt);

    await db.write(async () => {
      switch (table) {
        case 'atividades': {
          const coll = db.get<AtividadeModel>('atividades');
          const raw: Record<string, any> = {
            id: data.id,
            nome: data.nome ?? '',
            descricao: data.descricao ?? null,
            tipo: data.tipo ?? null,
            status: data.status ?? null,
            data_inicio: data.dataInicio != null ? this.toTimestamp(data.dataInicio) : null,
            data_fim: data.dataFim != null ? this.toTimestamp(data.dataFim) : null,
            created_at: created,
            updated_at: updated,
            synced: true,
            deleted_at: null,
          };
          const record = coll.prepareCreateFromDirtyRaw(raw);
          await db.batch(record);
          break;
        }
        case 'scouts': {
          const coll = db.get<ScoutModel>('scouts');
          const raw = {
            id: data.id,
            latitude: data.latitude,
            longitude: data.longitude,
            accuracy: data.accuracy ?? null,
            altitude: data.altitude ?? null,
            heading: data.heading ?? null,
            speed: data.speed ?? null,
            created_at: created,
            updated_at: updated,
            synced: true,
            deleted_at: null,
          };
          const record = coll.prepareCreateFromDirtyRaw(raw);
          await db.batch(record);
          break;
        }
        case 'pragas': {
          const coll = db.get<PragaModel>('pragas');
          const raw = {
            id: data.id,
            scout_id: data.scoutId,
            nome: data.nome ?? '',
            embrapa_recomendacao_id: data.embrapaRecomendacaoId ?? null,
            quantidade: data.quantidade ?? null,
            severidade: data.severidade ?? null,
            created_at: created,
            updated_at: updated,
            synced: true,
            deleted_at: null,
          };
          const record = coll.prepareCreateFromDirtyRaw(raw);
          await db.batch(record);
          break;
        }
      }
    });
  }

  /**
   * Atualiza registro local
   */
  private async updateLocalRecord(table: EntityType, data: any): Promise<void> {
    const db = getWatermelonDB();
    if (!db) return;

    const updated = this.toTimestamp(data.updatedAt);

    await db.write(async () => {
      switch (table) {
        case 'atividades': {
          const rec = await db.get<AtividadeModel>('atividades').find(data.id);
          await rec.update((r) => {
            r.nome = data.nome ?? r.nome;
            r.descricao = data.descricao ?? r.descricao;
            r.tipo = data.tipo ?? r.tipo;
            r.status = data.status ?? r.status;
            r.dataInicio = data.dataInicio != null ? this.toTimestamp(data.dataInicio) : r.dataInicio;
            r.dataFim = data.dataFim != null ? this.toTimestamp(data.dataFim) : r.dataFim;
            r.updatedAt = new Date(updated);
            r.synced = true;
          });
          break;
        }
        case 'scouts': {
          const rec = await db.get<ScoutModel>('scouts').find(data.id);
          await rec.update((r) => {
            r.latitude = data.latitude ?? r.latitude;
            r.longitude = data.longitude ?? r.longitude;
            r.accuracy = data.accuracy ?? r.accuracy;
            r.altitude = data.altitude ?? r.altitude;
            r.heading = data.heading ?? r.heading;
            r.speed = data.speed ?? r.speed;
            r.updatedAt = new Date(updated);
            r.synced = true;
          });
          break;
        }
        case 'pragas': {
          const rec = await db.get<PragaModel>('pragas').find(data.id);
          await rec.update((r) => {
            r.scoutId = data.scoutId ?? r.scoutId;
            r.nome = data.nome ?? r.nome;
            r.embrapaRecomendacaoId = data.embrapaRecomendacaoId ?? r.embrapaRecomendacaoId;
            r.quantidade = data.quantidade ?? r.quantidade;
            r.severidade = data.severidade ?? r.severidade;
            r.updatedAt = new Date(updated);
            r.synced = true;
          });
          break;
        }
      }
    });
  }

  /**
   * Atualiza contador de pendentes
   */
  private async updatePendingCount(): Promise<void> {
    const db = getWatermelonDB();
    if (!db) return;
    try {
      const count = await db.get<SyncQueueModel>('sync_queue').query(Q.where('status', 'pending')).fetchCount();
      useAppStore.getState().updateSyncStatus(count);
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
    const db = getWatermelonDB();
    if (!db) return 0;
    try {
      return await db.get<SyncQueueModel>('sync_queue').query(Q.where('status', 'pending')).fetchCount();
    } catch {
      return 0;
    }
  }
}

export const syncService = new SyncService();
