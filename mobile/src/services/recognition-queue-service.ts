/**
 * Fila de reconhecimento de pragas (offline)
 *
 * Estratégia dual:
 *  1. WatermelonDB (quando disponível em development builds)
 *  2. AsyncStorage + FileSystem como fallback universal (funciona no Expo Go)
 *
 * A imagem é sempre salva como base64 no FileSystem (cache).
 * Os metadados ficam no WatermelonDB ou AsyncStorage.
 */

import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWatermelonDB } from '@/database/watermelon/database';
import type { ReconhecimentoResult, ReconhecimentoPest, Severidade } from '@/hooks/use-pragas';
import type { LocationObject } from '@/services/location-service';
import { logger } from './logger';
import { networkService } from './network-service';
import { imageUriToBase64, callIdentifyPestEdgeFunction } from './openai-service';
import type { PestRecognitionResult } from './openai-service';
import { useAppStore } from '@/stores/app-store';

export interface PendingRecognitionItem {
  id: string;
  createdAt: number;
  status: string;
}

export interface RecognitionQueueMetadata {
  fazendaId?: number;
  talhaoId?: number;
  latitude?: number;
  longitude?: number;
}

export interface ProcessSingleResult {
  result: ReconhecimentoResult;
  location: LocationObject;
  imageUri: string;
}

// ---------------------------------------------------------------------------
// Filesystem helpers
// ---------------------------------------------------------------------------

const getCacheDir = (): string => {
  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!base) throw new Error('Diretório de cache não disponível');
  return `${base}recognition_queue/`;
};

async function ensureCacheDir(): Promise<string> {
  const dir = getCacheDir();
  const exists = await FileSystem.getInfoAsync(dir);
  if (!exists.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

// ---------------------------------------------------------------------------
// AsyncStorage fallback – armazena a lista de itens como JSON
// ---------------------------------------------------------------------------

const AS_QUEUE_KEY = '@recognition_queue_items';

interface ASQueueItem {
  id: string;
  imagePath: string;
  metadata: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage: string | null;
  result: string | null;
  createdAt: number;
  updatedAt: number;
}

async function asGetAll(): Promise<ASQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(AS_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function asSaveAll(items: ASQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(AS_QUEUE_KEY, JSON.stringify(items));
}

// ---------------------------------------------------------------------------
// Detecção de backend disponível
// ---------------------------------------------------------------------------

function useWatermelon(): boolean {
  return getWatermelonDB() != null;
}

// ---------------------------------------------------------------------------
// Store helpers
// ---------------------------------------------------------------------------

async function updatePendingCountInStore(): Promise<void> {
  const count = await getPendingRecognitionCount();
  useAppStore.getState().setPendingRecognitionCount(count);
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export async function addToRecognitionQueue(
  imageUri: string,
  metadata?: RecognitionQueueMetadata,
): Promise<string> {
  const id = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();

  const base64 = await imageUriToBase64(imageUri);
  const dir = await ensureCacheDir();
  const filePath = `${dir}${id}.base64`;
  await FileSystem.writeAsStringAsync(filePath, base64);

  if (useWatermelon()) {
    const db = getWatermelonDB()!;
    const { Q } = await import('@nozbe/watermelondb');
    const PendingRecognitionModel = (await import('@/database/watermelon/models/PendingRecognition')).default;
    await db.write(async () => {
      const coll = db.get<typeof PendingRecognitionModel>(PendingRecognitionModel.table);
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
  } else {
    const items = await asGetAll();
    items.push({
      id,
      imagePath: filePath,
      metadata: metadata ? JSON.stringify(metadata) : null,
      status: 'pending',
      errorMessage: null,
      result: null,
      createdAt: now,
      updatedAt: now,
    });
    await asSaveAll(items);
  }

  await updatePendingCountInStore();
  logger.info('Reconhecimento adicionado à fila (offline)', { id, backend: useWatermelon() ? 'watermelon' : 'asyncstorage' });
  return id;
}

export async function getPendingRecognitionCount(): Promise<number> {
  if (useWatermelon()) {
    const db = getWatermelonDB()!;
    const { Q } = await import('@nozbe/watermelondb');
    const PendingRecognitionModel = (await import('@/database/watermelon/models/PendingRecognition')).default;
    return await db
      .get<typeof PendingRecognitionModel>(PendingRecognitionModel.table)
      .query(Q.where('status', 'pending'))
      .fetchCount();
  }
  const items = await asGetAll();
  return items.filter((i) => i.status === 'pending').length;
}

export async function refreshPendingRecognitionCount(): Promise<void> {
  await updatePendingCountInStore();
}

export async function getPendingRecognitionsList(): Promise<PendingRecognitionItem[]> {
  if (useWatermelon()) {
    const db = getWatermelonDB()!;
    const { Q } = await import('@nozbe/watermelondb');
    const PendingRecognitionModel = (await import('@/database/watermelon/models/PendingRecognition')).default;
    const rows = await db
      .get<typeof PendingRecognitionModel>(PendingRecognitionModel.table)
      .query(Q.where('status', Q.oneOf(['pending', 'failed'])), Q.sortBy('created_at', Q.asc))
      .fetch();
    return rows.map((r: any) => ({
      id: r.id,
      createdAt: r.createdAt instanceof Date ? r.createdAt.getTime() : r.createdAt,
      status: r.status,
    }));
  }
  const items = await asGetAll();
  return items
    .filter((i) => i.status === 'pending' || i.status === 'failed')
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((i) => ({ id: i.id, createdAt: i.createdAt, status: i.status }));
}

export async function processSingleRecognition(id: string): Promise<ProcessSingleResult | null> {
  const isOnline = await networkService.getStatus();
  if (!isOnline) return null;

  if (useWatermelon()) {
    return processSingleWatermelon(id);
  }
  return processSingleAsyncStorage(id);
}

// ---------------------------------------------------------------------------
// Processamento – WatermelonDB
// ---------------------------------------------------------------------------

async function processSingleWatermelon(id: string): Promise<ProcessSingleResult | null> {
  const db = getWatermelonDB()!;
  const PendingRecognitionModel = (await import('@/database/watermelon/models/PendingRecognition')).default;
  const row: any = await db.get<typeof PendingRecognitionModel>(PendingRecognitionModel.table).find(id);
  if (row.status !== 'pending' && row.status !== 'failed') return null;

  const now = Date.now();
  try {
    await db.write(async () => {
      await row.update((r: any) => { r.status = 'processing'; r.updatedAt = new Date(now); });
    });

    const base64 = await FileSystem.readAsStringAsync(row.imagePath);
    const metadata = row.metadata ? (JSON.parse(row.metadata) as RecognitionQueueMetadata) : undefined;
    const apiResult = await callIdentifyPestEdgeFunction(base64, metadata);

    const location: LocationObject = { latitude: metadata?.latitude ?? 0, longitude: metadata?.longitude ?? 0 };
    const imageUri = `data:image/jpeg;base64,${base64}`;

    await db.write(async () => {
      await row.update((r: any) => {
        r.status = 'completed';
        r.result = JSON.stringify(apiResult);
        r.errorMessage = null;
        r.updatedAt = new Date(now);
      });
    });

    try { await FileSystem.deleteAsync(row.imagePath, { idempotent: true }); } catch {}

    await updatePendingCountInStore();
    const result = apiResultToReconhecimentoResult(apiResult);
    logger.info('Reconhecimento da fila concluído', { id, name: result.praga });
    return { result, location, imageUri };
  } catch (error: any) {
    const errMsg = error?.message ?? 'Erro desconhecido';
    await db.write(async () => {
      await row.update((r: any) => { r.status = 'failed'; r.errorMessage = errMsg; r.updatedAt = new Date(now); });
    });
    await updatePendingCountInStore();
    logger.error('Erro ao processar item da fila', { id, error: errMsg });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Processamento – AsyncStorage fallback
// ---------------------------------------------------------------------------

async function processSingleAsyncStorage(id: string): Promise<ProcessSingleResult | null> {
  const items = await asGetAll();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  const item = items[idx];
  if (item.status !== 'pending' && item.status !== 'failed') return null;

  const now = Date.now();
  try {
    items[idx] = { ...item, status: 'processing', updatedAt: now };
    await asSaveAll(items);

    const base64 = await FileSystem.readAsStringAsync(item.imagePath);
    const metadata = item.metadata ? (JSON.parse(item.metadata) as RecognitionQueueMetadata) : undefined;
    const apiResult = await callIdentifyPestEdgeFunction(base64, metadata);

    const location: LocationObject = { latitude: metadata?.latitude ?? 0, longitude: metadata?.longitude ?? 0 };
    const imageUri = `data:image/jpeg;base64,${base64}`;

    const freshItems = await asGetAll();
    const freshIdx = freshItems.findIndex((i) => i.id === id);
    if (freshIdx !== -1) {
      freshItems[freshIdx] = {
        ...freshItems[freshIdx],
        status: 'completed',
        result: JSON.stringify(apiResult),
        errorMessage: null,
        updatedAt: now,
      };
      await asSaveAll(freshItems);
    }

    try { await FileSystem.deleteAsync(item.imagePath, { idempotent: true }); } catch {}

    await updatePendingCountInStore();
    const result = apiResultToReconhecimentoResult(apiResult);
    logger.info('Reconhecimento da fila concluído (AsyncStorage)', { id, name: result.praga });
    return { result, location, imageUri };
  } catch (error: any) {
    const errMsg = error?.message ?? 'Erro desconhecido';
    const freshItems = await asGetAll();
    const freshIdx = freshItems.findIndex((i) => i.id === id);
    if (freshIdx !== -1) {
      freshItems[freshIdx] = { ...freshItems[freshIdx], status: 'failed', errorMessage: errMsg, updatedAt: now };
      await asSaveAll(freshItems);
    }
    await updatePendingCountInStore();
    logger.error('Erro ao processar item da fila', { id, error: errMsg });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Processamento em lote (background sync)
// ---------------------------------------------------------------------------

export async function processRecognitionQueue(): Promise<{ processed: number; failed: number }> {
  const isOnline = await networkService.getStatus();
  if (!isOnline) return { processed: 0, failed: 0 };

  const list = await getPendingRecognitionsList();
  if (list.length === 0) return { processed: 0, failed: 0 };

  logger.info('Processando fila de reconhecimento', { count: list.length });
  let processed = 0;
  let failed = 0;

  for (const item of list.slice(0, 20)) {
    try {
      await processSingleRecognition(item.id);
      processed++;
    } catch {
      failed++;
    }
  }

  if (processed > 0) {
    useAppStore.getState().setLastProcessedRecognitionCount(processed);
  }
  return { processed, failed };
}

// ---------------------------------------------------------------------------
// Limpeza de itens antigos
// ---------------------------------------------------------------------------

export async function cleanupProcessedQueue(olderThanDays: number = 7): Promise<void> {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  if (useWatermelon()) {
    const db = getWatermelonDB()!;
    const { Q } = await import('@nozbe/watermelondb');
    const PendingRecognitionModel = (await import('@/database/watermelon/models/PendingRecognition')).default;
    const rows = await db
      .get<typeof PendingRecognitionModel>(PendingRecognitionModel.table)
      .query(Q.and(Q.where('status', Q.oneOf(['completed', 'failed'])), Q.where('updated_at', Q.lt(cutoff))))
      .fetch();
    await db.write(async () => {
      for (const row of rows) {
        try { await FileSystem.deleteAsync((row as any).imagePath, { idempotent: true }); } catch {}
        await (row as any).destroyPermanently();
      }
    });
  } else {
    const items = await asGetAll();
    const toKeep: ASQueueItem[] = [];
    for (const item of items) {
      if ((item.status === 'completed' || item.status === 'failed') && item.updatedAt < cutoff) {
        try { await FileSystem.deleteAsync(item.imagePath, { idempotent: true }); } catch {}
      } else {
        toKeep.push(item);
      }
    }
    await asSaveAll(toKeep);
  }

  await updatePendingCountInStore();
}

// ---------------------------------------------------------------------------
// Conversão de resultado da API
// ---------------------------------------------------------------------------

function apiResultToReconhecimentoResult(api: PestRecognitionResult): ReconhecimentoResult {
  const pests: ReconhecimentoPest[] = (api.pests ?? []).map((p) => ({
    praga: p.name,
    nomePopular: p.popularName,
    nomeCientifico: p.scientificName,
    confianca: p.confidence,
    severidade: (p.severity as Severidade) || 'media',
    tipoPraga: p.pestType,
    recomendacao: p.recommendation,
    boundingBox: p.boundingBox,
  }));
  return {
    praga: api.name,
    nomePopular: api.popularName,
    nomeCientifico: api.scientificName,
    confianca: api.confidence,
    severidade: api.severity as Severidade,
    tipoPraga: api.pestType,
    recomendacao: api.recomendacao ?? api.recommendation,
    alternativas: api.alternatives?.map((a) => ({ praga: a.name, confianca: a.confidence })),
    pests,
    imagemUrl: api.image?.url ?? null,
  };
}
