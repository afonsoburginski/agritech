/**
 * Fila de reconhecimento de pragas (offline)
 * Persiste no WatermelonDB e processa quando o app estiver online.
 */

import { Q } from '@nozbe/watermelondb';
import * as FileSystem from 'expo-file-system/legacy';
import { getWatermelonDB } from '@/database/watermelon/database';
import PendingRecognitionModel from '@/database/watermelon/models/PendingRecognition';
import { logger } from './logger';
import { networkService } from './network-service';
import { imageUriToBase64, callIdentifyPestEdgeFunction } from './openai-service';
import { useAppStore } from '@/stores/app-store';

const getCacheDir = (): string => {
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) throw new Error('Diretório de cache não disponível');
  return `${base}recognition_queue/`;
};

export interface RecognitionQueueMetadata {
  fazendaId?: number;
  talhaoId?: number;
  latitude?: number;
  longitude?: number;
  markerId?: number;
}

/**
 * Garante que o diretório de cache existe
 */
async function ensureCacheDir(): Promise<string> {
  const dir = getCacheDir();
  const exists = await FileSystem.getInfoAsync(dir);
  if (!exists.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Adiciona uma imagem à fila (offline). Salva a imagem em arquivo e o path no WatermelonDB.
 */
export async function addToRecognitionQueue(
  imageUri: string,
  metadata?: RecognitionQueueMetadata
): Promise<string> {
  const db = getWatermelonDB();
  if (!db) {
    throw new Error('Banco de dados não disponível. Não foi possível salvar na fila.');
  }

  const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  const base64 = await imageUriToBase64(imageUri);
  const dir = await ensureCacheDir();
  const filePath = `${dir}${id}.base64`;
  await FileSystem.writeAsStringAsync(filePath, base64);

  await db.write(async () => {
    const coll = db.get<PendingRecognitionModel>('pending_recognition_queue');
    const record = coll.prepareCreateFromDirtyRaw({
      id,
      image_path: filePath,
      metadata: metadata ? JSON.stringify(metadata) : null,
      status: 'pending',
      error_message: null,
      result: null,
      created_at: now,
      updated_at: now,
    });
    await db.batch(record);
  });

  await updatePendingCountInStore();
  logger.info('Reconhecimento adicionado à fila (offline)', { id });
  return id;
}

/**
 * Retorna a quantidade de itens pendentes na fila
 */
export async function getPendingRecognitionCount(): Promise<number> {
  const db = getWatermelonDB();
  if (!db) return 0;
  return await db
    .get<PendingRecognitionModel>('pending_recognition_queue')
    .query(Q.where('status', 'pending'))
    .fetchCount();
}

/**
 * Atualiza o contador de pendentes no app store
 */
async function updatePendingCountInStore(): Promise<void> {
  const count = await getPendingRecognitionCount();
  useAppStore.getState().setPendingRecognitionCount(count);
}

/**
 * Atualiza o contador de pendentes no store (ao abrir o app ou a aba Reconhecimento)
 */
export async function refreshPendingRecognitionCount(): Promise<void> {
  await updatePendingCountInStore();
}

/**
 * Processa a fila de reconhecimentos (quando online)
 */
export async function processRecognitionQueue(): Promise<{ processed: number; failed: number }> {
  const isOnline = await networkService.getStatus();
  if (!isOnline) return { processed: 0, failed: 0 };

  const db = getWatermelonDB();
  if (!db) return { processed: 0, failed: 0 };

  const rows = await db
    .get<PendingRecognitionModel>('pending_recognition_queue')
    .query(Q.where('status', 'pending'), Q.sortBy('created_at', Q.asc), Q.take(20))
    .fetch();

  if (rows.length === 0) {
    await updatePendingCountInStore();
    return { processed: 0, failed: 0 };
  }

  logger.info('Processando fila de reconhecimento', { count: rows.length });
  let processed = 0;
  let failed = 0;
  const now = Date.now();

  for (const row of rows) {
    try {
      await db.write(async () => {
        await row.update((r) => {
          r.status = 'processing';
          r.updatedAt = new Date(now);
        });
      });

      const base64 = await FileSystem.readAsStringAsync(row.imagePath);
      const metadata = row.metadata ? (JSON.parse(row.metadata) as RecognitionQueueMetadata) : undefined;
      const result = await callIdentifyPestEdgeFunction(base64, metadata);

      await db.write(async () => {
        await row.update((r) => {
          r.status = 'completed';
          r.result = JSON.stringify(result);
          r.errorMessage = null;
          r.updatedAt = new Date(now);
        });
      });

      try {
        await FileSystem.deleteAsync(row.imagePath, { idempotent: true });
      } catch (_) {}

      processed++;
      logger.info('Reconhecimento da fila concluído', { id: row.id, name: result.name });
    } catch (error: any) {
      failed++;
      const errMsg = error?.message ?? 'Erro desconhecido';
      await db.write(async () => {
        await row.update((r) => {
          r.status = 'failed';
          r.errorMessage = errMsg;
          r.updatedAt = new Date(now);
        });
      });
      logger.error('Erro ao processar item da fila', { id: row.id, error: errMsg });
    }
  }

  await updatePendingCountInStore();
  if (processed > 0) {
    useAppStore.getState().setLastProcessedRecognitionCount(processed);
  }
  return { processed, failed };
}

/**
 * Remove itens concluídos ou com falha antigos (opcional, para não encher o banco)
 */
export async function cleanupProcessedQueue(olderThanDays: number = 7): Promise<void> {
  const db = getWatermelonDB();
  if (!db) return;
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  const rows = await db
    .get<PendingRecognitionModel>('pending_recognition_queue')
    .query(
      Q.and(
        Q.where('status', Q.oneOf(['completed', 'failed'])),
        Q.where('updated_at', Q.lt(cutoff))
      )
    )
    .fetch();
  await db.write(async () => {
    for (const row of rows) {
      try {
        await FileSystem.deleteAsync(row.imagePath, { idempotent: true });
      } catch (_) {}
      await row.destroyPermanently();
    }
  });
  await updatePendingCountInStore();
}
