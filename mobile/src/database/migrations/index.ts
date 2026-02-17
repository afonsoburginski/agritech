import { logger } from '@/services/logger';
import { SCHEMA_VERSION, createSchemaSQL } from '../schema';
import { seedData } from './002_seed_data';

/**
 * Executa todas as migrations pendentes
 */
export async function runMigrations(db: any): Promise<void> {
  try {
    // Criar tabela de migrations se não existir
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS "schema-migrations" (
        version INTEGER PRIMARY KEY,
        "applied-at" TEXT NOT NULL
      );
    `);

    // Verificar versão atual
    const result = await db.getFirstAsync<{ version: number }>(
      'SELECT MAX(version) as version FROM "schema-migrations"'
    );
    const currentVersion = result?.version || 0;

    logger.info('Verificando migrations', { currentVersion, targetVersion: SCHEMA_VERSION });

    let schemaCreated = false;

    // Executar migrations pendentes
    if (currentVersion < SCHEMA_VERSION) {
      await db.withTransactionAsync(async () => {
        try {
          // Executar schema inicial
          if (currentVersion === 0) {
            logger.info('Aplicando migration inicial (001_initial_schema)');
            await db.execAsync(createSchemaSQL);
            
            // Registrar migration
            await db.runAsync(
              'INSERT INTO "schema-migrations" (version, "applied-at") VALUES (?, ?)',
              [1, new Date().toISOString()]
            );
            
            schemaCreated = true;
          }

          // Migration 2: Fila de reconhecimento de pragas (offline)
          if (currentVersion < 2) {
            logger.info('Aplicando migration 002_pending_recognition_queue');
            await db.execAsync(`
              CREATE TABLE IF NOT EXISTS "pending-recognition-queue" (
                id TEXT PRIMARY KEY,
                "image-path" TEXT NOT NULL,
                metadata TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                "error-message" TEXT,
                result TEXT,
                "created-at" TEXT NOT NULL,
                "updated-at" TEXT NOT NULL
              );
              CREATE INDEX IF NOT EXISTS "idx-pending-recognition-status" ON "pending-recognition-queue"(status);
            `);
            await db.runAsync(
              'INSERT INTO "schema-migrations" (version, "applied-at") VALUES (?, ?)',
              [2, new Date().toISOString()]
            );
          }

          logger.info('Migrations aplicadas com sucesso');
        } catch (error) {
          logger.error('Erro ao aplicar migration', { error });
          throw error; // Rollback automático pela transação
        }
      });
    } else {
      logger.info('Nenhuma migration pendente');
    }

    // Sempre verificar e garantir que dados de exemplo existem
    // (tanto na primeira criação quanto se o banco já existir sem dados)
    try {
      await seedData(db, false); // false = não força, apenas insere se não existir
    } catch (error) {
      logger.error('Erro ao inserir dados de exemplo', { error });
      // Não falhar a migration se o seed falhar
    }
  } catch (error) {
    logger.error('Erro ao executar migrations', { error });
    throw error;
  }
}

