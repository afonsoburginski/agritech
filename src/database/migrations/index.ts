import { logger } from '@/services/logger';
import { SCHEMA_VERSION, createSchemaSQL } from '../schema';

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
          }

          // Aqui podem ser adicionadas migrations futuras
          // Exemplo:
          // if (currentVersion < 2) {
          //   await db.execAsync('ALTER TABLE ...');
          //   await db.runAsync('INSERT INTO schema_migrations ...', [2, ...]);
          // }

          logger.info('Migrations aplicadas com sucesso');
        } catch (error) {
          logger.error('Erro ao aplicar migration', { error });
          throw error; // Rollback automático pela transação
        }
      });
    } else {
      logger.info('Nenhuma migration pendente');
    }
  } catch (error) {
    logger.error('Erro ao executar migrations', { error });
    throw error;
  }
}

