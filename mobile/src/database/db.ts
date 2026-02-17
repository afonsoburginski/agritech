import { logger } from '@/services/logger';
import { runMigrations } from './migrations';
import Constants from 'expo-constants';

let dbInstance: any = null;
let isDatabaseAvailable = false;
let SQLite: any = null;
let hasWarnedUnavailable = false;

/**
 * Detecta se o app está rodando no Expo Go (onde módulos nativos como SQLite não estão disponíveis).
 * Usa executionEnvironment e appOwnership para maior confiabilidade.
 */
function isExpoGo(): boolean {
  // storeClient = Expo Go; appOwnership === 'expo' = também Expo Go
  const env = Constants.executionEnvironment;
  const ownership = Constants.appOwnership;
  return env === 'storeClient' || ownership === 'expo';
}

/**
 * Carrega o módulo SQLite dinamicamente.
 * No Expo Go o SQLite não está disponível: o app usa dados em memória e Supabase quando online.
 * Para persistência offline completa (scouts, atividades, fila de reconhecimento), use um development build (expo run:ios / expo run:android).
 * @see https://docs.expo.dev/versions/latest/sdk/sqlite/
 */
async function loadSQLite(): Promise<boolean> {
  if (SQLite !== null) return true;

  if (isExpoGo()) {
    if (!hasWarnedUnavailable) {
      hasWarnedUnavailable = true;
      logger.info(
        'Modo Expo Go: persistência local desativada. Use um development build para offline completo.'
      );
    }
    return false;
  }

  try {
    const sqliteModule = await import('expo-sqlite');
    if (sqliteModule && typeof sqliteModule.openDatabaseAsync === 'function') {
      SQLite = sqliteModule;
      return true;
    }
    return false;
  } catch {
    if (!hasWarnedUnavailable) {
      hasWarnedUnavailable = true;
      logger.warn('SQLite não disponível, usando dados em memória');
    }
    return false;
  }
}

/**
 * Verifica se o SQLite está disponível
 */
async function isSQLiteAvailable(): Promise<boolean> {
  return await loadSQLite();
}

/**
 * Obtém instância única do banco de dados SQLite
 * Implementa singleton pattern para garantir uma única conexão
 * Retorna null se SQLite não estiver disponível (Expo Go)
 * 
 * Conforme documentação: https://docs.expo.dev/versions/latest/sdk/sqlite/
 */
export async function getDatabase(): Promise<any> {
  if (!(await isSQLiteAvailable())) return null;

  if (dbInstance) {
    return dbInstance;
  }

  try {
    // Usar openDatabaseAsync conforme documentação oficial
    dbInstance = await SQLite.openDatabaseAsync('agritech.db');

    // Executar migrations na primeira abertura
    await runMigrations(dbInstance);

    isDatabaseAvailable = true;
    return dbInstance;
  } catch (error) {
    logger.error('Erro ao abrir banco de dados', { error }, error as Error);
    // Não lançar erro, apenas logar - permite que app continue funcionando
    isDatabaseAvailable = false;
    return null;
  }
}

/**
 * Fecha conexão com o banco de dados
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.closeAsync();
      dbInstance = null;
    } catch (error) {
      logger.error('Erro ao fechar banco de dados', { error });
      throw error;
    }
  }
}

/**
 * Inicializa o banco de dados (chamado na inicialização do app)
 * Não lança erro se SQLite não estiver disponível (Expo Go)
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await getDatabase();
    // Database e seeds inicializados via runMigrations
  } catch (error: any) {
    // Ignorar erros de módulo nativo não encontrado (Expo Go)
    if (error?.message?.includes('Cannot find native module') || 
        error?.message?.includes('ExpoSQLiteNext') ||
        error?.message?.includes('SQLiteSession')) {
      // Silenciar - é esperado no Expo Go
      return;
    }
    logger.error('Erro ao inicializar database', { error: error?.message });
    // Não lançar erro - permite que app continue funcionando sem SQLite
  }
}

/**
 * Verifica se o database está disponível
 */
export function isDatabaseReady(): boolean {
  return isDatabaseAvailable && dbInstance !== null;
}

/**
 * Indica se o app está rodando no Expo Go (sem persistência local).
 * Útil para mostrar mensagem ao usuário sobre uso de development build para offline.
 */
export function getIsExpoGo(): boolean {
  return isExpoGo();
}
