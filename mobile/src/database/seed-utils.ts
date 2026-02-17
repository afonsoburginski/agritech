/**
 * Utilitários para gerenciar dados de exemplo (seed data)
 * Permite limpar e recriar dados de exemplo para desenvolvimento/testes
 */

import { getDatabase } from './db';
import { clearSeedData, seedData } from './migrations/002_seed_data';
import { logger } from '@/services/logger';

/**
 * Limpa todos os dados de exemplo do banco
 */
export async function clearAllSeedData(): Promise<void> {
  try {
    const db = await getDatabase();
    if (!db) {
      logger.warn('SQLite não disponível, não é possível limpar dados');
      return;
    }

    await clearSeedData(db);
    logger.info('Dados de exemplo limpos com sucesso');
  } catch (error) {
    logger.error('Erro ao limpar dados de exemplo', { error });
    throw error;
  }
}

/**
 * Recria todos os dados de exemplo (limpa e insere novamente)
 */
export async function recreateSeedData(): Promise<void> {
  try {
    const db = await getDatabase();
    if (!db) {
      logger.warn('SQLite não disponível, não é possível recriar dados');
      return;
    }

    logger.info('Recriando dados de exemplo...');
    await clearSeedData(db);
    await seedData(db, false); // false porque já limpamos
    logger.info('Dados de exemplo recriados com sucesso');
  } catch (error) {
    logger.error('Erro ao recriar dados de exemplo', { error });
    throw error;
  }
}

/**
 * Insere dados de exemplo se não existirem
 * Útil para garantir que sempre há dados para desenvolvimento
 */
export async function ensureSeedData(): Promise<void> {
  try {
    const db = await getDatabase();
    if (!db) {
      logger.warn('SQLite não disponível, não é possível inserir dados');
      return;
    }

    await seedData(db, false);
  } catch (error) {
    logger.error('Erro ao garantir dados de exemplo', { error });
    throw error;
  }
}

/**
 * Retorna estatísticas dos dados de exemplo
 */
export async function getSeedDataStats(): Promise<{
  scouts: number;
  pragas: number;
  atividades: number;
}> {
  try {
    const db = await getDatabase();
    if (!db) {
      return { scouts: 0, pragas: 0, atividades: 0 };
    }

    const scoutsResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM scouts'
    );
    const pragasResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM pragas'
    );
    const atividadesResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM atividades'
    );

    return {
      scouts: scoutsResult?.count || 0,
      pragas: pragasResult?.count || 0,
      atividades: atividadesResult?.count || 0,
    };
  } catch (error) {
    logger.error('Erro ao obter estatísticas dos dados', { error });
    return { scouts: 0, pragas: 0, atividades: 0 };
  }
}
