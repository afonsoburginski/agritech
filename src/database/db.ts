import { logger } from '@/services/logger';
import { runMigrations } from './migrations';
import Constants from 'expo-constants';

let dbInstance: any = null;
let isDatabaseAvailable = false;
let SQLite: any = null;

/**
 * Carrega o módulo SQLite dinamicamente
 * Conforme documentação: https://docs.expo.dev/versions/latest/sdk/sqlite/
 * 
 * IMPORTANTE: No Expo Go, módulos nativos não funcionam.
 * Para usar expo-sqlite, é necessário um development build ou build de produção.
 */
async function loadSQLite(): Promise<boolean> {
  // Se já carregou, retornar
  if (SQLite !== null) {
    return true;
  }
  
  // Verificar se está no Expo Go - não tentar carregar módulos nativos
  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  if (isExpoGo) {
    // Expo Go não suporta módulos nativos - usar fallback em memória
    return false;
  }
  
  try {
    // Usar import dinâmico - só será executado em runtime em development builds
    // O Metro pode tentar analisar, mas em development builds funcionará
    const sqliteModule = await import('expo-sqlite');
    
    if (sqliteModule && typeof sqliteModule.openDatabaseAsync === 'function') {
      SQLite = sqliteModule;
      return true;
    }
    return false;
  } catch (error: any) {
    // Silenciar erros - pode ser que o módulo não esteja disponível
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
  if (!(await isSQLiteAvailable())) {
    logger.warn('SQLite não disponível, usando dados em memória');
    return null;
  }

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
