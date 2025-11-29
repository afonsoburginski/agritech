import { logger } from '@/services/logger';
import { runMigrations } from './migrations';
import Constants from 'expo-constants';

let dbInstance: any = null;
let isDatabaseAvailable = false;
let SQLite: any = null;

// Verificar se estamos no Expo Go (não suporta módulos nativos)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

/**
 * Carrega o módulo SQLite dinamicamente (necessário para Expo Go)
 */
async function loadSQLite(): Promise<boolean> {
  // Se já carregou, retornar
  if (SQLite !== null) {
    return true;
  }
  
  // Se estiver no Expo Go, não tentar carregar (não suporta módulos nativos)
  if (isExpoGo) {
    return false;
  }
  
  try {
    // Usar require dinâmico com verificação de disponibilidade
    const sqliteModule = await import('expo-sqlite');
    if (sqliteModule && typeof sqliteModule.openDatabaseAsync === 'function') {
      SQLite = sqliteModule;
      return true;
    }
    return false;
  } catch (error: any) {
    // Silenciar erro no Expo Go - é esperado que não funcione
    if (error?.message?.includes('Cannot find native module') || 
        error?.message?.includes('ExpoSQLiteNext')) {
      // Expo Go não suporta módulos nativos - isso é normal
      return false;
    }
    // Módulo expo-sqlite não disponível - silenciar warning
    return false;
  }
}

/**
 * Verifica se o SQLite está disponível (não funciona no Expo Go)
 */
async function isSQLiteAvailable(): Promise<boolean> {
  return await loadSQLite();
}

/**
 * Obtém instância única do banco de dados SQLite
 * Implementa singleton pattern para garantir uma única conexão
 * Retorna null se SQLite não estiver disponível (Expo Go)
 */
export async function getDatabase(): Promise<any> {
  if (!(await isSQLiteAvailable())) {
    // SQLite não disponível no Expo Go - silenciar warning
    return null;
  }

  if (dbInstance) {
    return dbInstance;
  }

  try {
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
    // Database inicializado silenciosamente
  } catch (error: any) {
    // Ignorar erros de módulo nativo não encontrado (Expo Go)
    if (error?.message?.includes('Cannot find native module') || 
        error?.message?.includes('ExpoSQLiteNext')) {
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

