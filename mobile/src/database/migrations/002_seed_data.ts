/**
 * Migration para inserir dados de exemplo (seed data)
 * Cria scouts com coordenadas GPS e pragas associadas para simulação
 */

import { logger } from '@/services/logger';

/**
 * Gera um UUID simples
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gera uma data ISO string
 */
function getISODate(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

/**
 * Limpa todos os dados de exemplo do banco
 */
export async function clearSeedData(db: any): Promise<void> {
  try {
    logger.info('Limpando dados de exemplo...');
    
    await db.withTransactionAsync(async () => {
      // Deletar pragas primeiro (devido à foreign key)
      await db.runAsync('DELETE FROM pragas');
      
      // Deletar scouts
      await db.runAsync('DELETE FROM scouts');
      
      // Deletar atividades (se houver)
      await db.runAsync('DELETE FROM atividades');
    });
    
    logger.info('Dados de exemplo limpos com sucesso');
  } catch (error) {
    logger.error('Erro ao limpar dados de exemplo', { error });
    throw error;
  }
}

/**
 * Insere dados de exemplo no banco
 * @param force - Se true, limpa dados existentes antes de inserir
 */
export async function seedData(db: any, force: boolean = false): Promise<void> {
  try {
    // Verificar se já existem dados
    const existingScouts = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM scouts'
    );

    if (existingScouts && existingScouts.count > 0) {
      if (force) {
        logger.info('Forçando recriação dos dados de exemplo...');
        await clearSeedData(db);
      } else {
        logger.info('Dados de exemplo já existem, pulando seed');
        return;
      }
    }

    logger.info('Inserindo dados de exemplo...');

    // Coordenadas base (região agrícola simulada - Brasil)
    // Latitude/longitude de uma área agrícola típica
    const baseLat = -23.5505; // São Paulo (exemplo)
    const baseLng = -46.6333;

    // Criar 15 scouts distribuídos em uma área
    const scouts = [];
    const pragas = [];

    for (let i = 0; i < 15; i++) {
      const scoutId = generateUUID();
      
      // Distribuir scouts em uma área de ~2km x 2km
      const latOffset = (Math.random() - 0.5) * 0.02; // ~2km
      const lngOffset = (Math.random() - 0.5) * 0.02;
      
      const latitude = baseLat + latOffset;
      const longitude = baseLng + lngOffset;
      
      const daysAgo = Math.floor(Math.random() * 30); // Últimos 30 dias
      const createdAt = getISODate(daysAgo);
      const updatedAt = getISODate(Math.floor(Math.random() * daysAgo));

      scouts.push({
        id: scoutId,
        latitude,
        longitude,
        accuracy: 5 + Math.random() * 15, // 5-20 metros
        altitude: 700 + Math.random() * 100,
        heading: Math.random() * 360,
        speed: Math.random() * 5,
        createdAt,
        updatedAt,
        synced: 1, // Já sincronizados
      });

      // Criar 1-3 pragas por scout (70% dos scouts têm pragas)
      if (Math.random() > 0.3) {
        const numPragas = Math.floor(Math.random() * 3) + 1;
        const pragaNomes = [
          'Lagarta-do-cartucho',
          'Pulgão',
          'Ácaro-rajado',
          'Mosca-branca',
          'Tripes',
          'Cigarrinha',
          'Percevejo',
        ];

        for (let j = 0; j < numPragas; j++) {
          const pragaId = generateUUID();
          const pragaNome = pragaNomes[Math.floor(Math.random() * pragaNomes.length)];
          const quantidade = Math.floor(Math.random() * 50) + 1;
          const severidades = ['baixa', 'média', 'alta'];
          const severidade = severidades[Math.floor(Math.random() * severidades.length)];

          pragas.push({
            id: pragaId,
            scoutId,
            nome: pragaNome,
            quantidade,
            severidade,
            createdAt,
            updatedAt,
            synced: 1,
          });
        }
      }
    }

    // Inserir scouts
    await db.withTransactionAsync(async () => {
      for (const scout of scouts) {
        await db.runAsync(
          `INSERT INTO scouts (
            id, latitude, longitude, accuracy, altitude, heading, speed,
            "created-at", "updated-at", synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            scout.id,
            scout.latitude,
            scout.longitude,
            scout.accuracy,
            scout.altitude,
            scout.heading,
            scout.speed,
            scout.createdAt,
            scout.updatedAt,
            scout.synced,
          ]
        );
      }

      // Inserir pragas
      for (const praga of pragas) {
        await db.runAsync(
          `INSERT INTO pragas (
            id, "scout-id", nome, quantidade, severidade,
            "created-at", "updated-at", synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            praga.id,
            praga.scoutId,
            praga.nome,
            praga.quantidade,
            praga.severidade,
            praga.createdAt,
            praga.updatedAt,
            praga.synced,
          ]
        );
      }
    });

    logger.info(`Dados de exemplo inseridos: ${scouts.length} scouts, ${pragas.length} pragas`);
  } catch (error) {
    logger.error('Erro ao inserir dados de exemplo', { error });
    throw error;
  }
}
