import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import Constants from 'expo-constants';
import { logger } from '@/services/logger';
import { appSchemaWatermelon } from './schema';
import { migrations } from './migrations';
import { Atividade, Scout, Praga, SyncQueue, PendingRecognition } from './models';

let databaseInstance: Database | null = null;
let initError: Error | null = null;

/** Expo Go não inclui o módulo nativo do SQLite/JSI; não tentamos inicializar para evitar erro. */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

/**
 * Inicializa o WatermelonDB (SQLite nativo).
 * No Expo Go retorna null sem tentar carregar o nativo; os hooks usam fallback em memória/Supabase.
 * Use um development build (expo run:ios / expo run:android) para persistência offline completa.
 */
export async function initWatermelonDB(): Promise<Database | null> {
  if (databaseInstance) return databaseInstance;
  if (initError) return null;

  if (isExpoGo()) {
    return null;
  }

  try {
    const adapter = new SQLiteAdapter({
      schema: appSchemaWatermelon,
      migrations,
      jsi: true,
      onSetUpError: (error) => {
        logger.error('WatermelonDB setup error', { error });
      },
    });

    const db = new Database({
      adapter,
      modelClasses: [Atividade, Scout, Praga, SyncQueue, PendingRecognition],
    });

    databaseInstance = db;
    return db;
  } catch (e: any) {
    initError = e;
    return null;
  }
}

/**
 * Retorna a instância do database se já foi inicializada.
 * Não inicializa; use initWatermelonDB() no _layout primeiro.
 */
export function getWatermelonDB(): Database | null {
  return databaseInstance;
}

/**
 * Verifica se o WatermelonDB está disponível.
 */
export function isWatermelonDBReady(): boolean {
  return databaseInstance != null;
}
