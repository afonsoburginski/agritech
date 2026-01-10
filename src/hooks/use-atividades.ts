/**
 * Hook de Atividades - CRUD Real com SQLite + Sync Supabase
 * 
 * Estratégia Offline-First:
 * 1. Todas operações são salvas primeiro no SQLite local
 * 2. Operações são adicionadas à fila de sync
 * 3. Sync service envia ao Supabase quando online
 */

import { useState, useEffect, useCallback } from 'react';
import { getDatabase, isDatabaseReady } from '@/database/db';
import { logger } from '@/services/logger';
import { useAppStore } from '@/stores/app-store';
import { syncService } from '@/services/sync-service';

// Types
export interface Atividade {
  id: string;
  nome: string;
  descricao?: string;
  tipo: string;
  status: 'pendente' | 'em_andamento' | 'concluida';
  talhaoNome?: string;
  dataInicio?: string;
  dataFim?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface AtividadeInput {
  nome: string;
  descricao?: string;
  tipo: string;
  talhaoNome?: string;
  dataInicio?: string;
}

// Gerar ID único
const generateId = () => `atv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Hook principal - CRUD de Atividades
 */
// Armazenamento em memória para fallback (Expo Go)
let memoryStore: Atividade[] = [];

export function useAtividades() {
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const updateCounts = useAppStore((s) => s.updateCounts);

  // ========================================
  // CARREGAR DO SQLITE
  // ========================================
  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const db = await getDatabase();
      
      if (db) {
        // Carregar do SQLite
        const result = await db.getAllAsync(`
          SELECT 
            id, nome, descricao, tipo, status,
            "data-inicio" as dataInicio,
            "data-fim" as dataFim,
            "created-at" as createdAt,
            "updated-at" as updatedAt,
            synced
          FROM atividades 
          WHERE "deleted-at" IS NULL
          ORDER BY "created-at" DESC
        `);

        const data: Atividade[] = result.map((row: any) => ({
          id: row.id,
          nome: row.nome,
          descricao: row.descricao,
          tipo: row.tipo || 'outros',
          status: row.status || 'pendente',
          dataInicio: row.dataInicio,
          dataFim: row.dataFim,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          synced: row.synced === 1,
        }));

        setAtividades(data);
        
        // Atualizar contador global
        const pendentes = data.filter((a) => a.status === 'pendente').length;
        updateCounts({ atividadesPendentes: pendentes });
        
        logger.info('Atividades carregadas do SQLite', { count: data.length });
      } else {
        // Fallback para dados em memória (Expo Go)
        logger.warn('SQLite não disponível, usando dados em memória');
        setAtividades(memoryStore);
      }

      setIsLoading(false);
    } catch (err: any) {
      logger.error('Erro ao carregar atividades', { error: err.message });
      setError('Erro ao carregar atividades');
      setIsLoading(false);
    }
  }, [updateCounts]);

  // Carregar na montagem
  useEffect(() => {
    load();
  }, [load]);

  // ========================================
  // CRIAR ATIVIDADE
  // ========================================
  const create = useCallback(async (input: AtividadeInput): Promise<Atividade> => {
    const now = new Date().toISOString();
    const newAtividade: Atividade = {
      id: generateId(),
      nome: input.nome,
      descricao: input.descricao,
      tipo: input.tipo,
      status: 'pendente',
      talhaoNome: input.talhaoNome,
      dataInicio: input.dataInicio || now,
      createdAt: now,
      updatedAt: now,
      synced: false,
    };

    try {
      const db = await getDatabase();
      
      if (db) {
        // Salvar no SQLite
        await db.runAsync(`
          INSERT INTO atividades (
            id, nome, descricao, tipo, status,
            "data-inicio", "created-at", "updated-at", synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newAtividade.id,
          newAtividade.nome,
          newAtividade.descricao || null,
          newAtividade.tipo,
          newAtividade.status,
          newAtividade.dataInicio,
          newAtividade.createdAt,
          newAtividade.updatedAt,
          0, // synced = false
        ]);
        
        // Adicionar à fila de sincronização
        await syncService.addToQueue('atividades', newAtividade.id, 'create', {
          id: newAtividade.id,
          nome: newAtividade.nome,
          descricao: newAtividade.descricao,
          tipo: newAtividade.tipo,
          status: newAtividade.status,
          dataInicio: newAtividade.dataInicio,
          createdAt: newAtividade.createdAt,
          updatedAt: newAtividade.updatedAt,
        });
        
        logger.info('Atividade salva no SQLite e adicionada à fila de sync', { id: newAtividade.id });
      }

      // Atualizar estado local e memória
      setAtividades((prev) => {
        const updated = [newAtividade, ...prev];
        memoryStore = updated;
        return updated;
      });
      updateCounts({ atividadesPendentes: atividades.filter((a) => a.status === 'pendente').length + 1 });

      return newAtividade;
    } catch (err: any) {
      logger.error('Erro ao criar atividade', { error: err.message });
      throw new Error('Erro ao criar atividade');
    }
  }, [atividades, updateCounts]);

  // ========================================
  // MARCAR COMO CONCLUÍDA
  // ========================================
  const concluir = useCallback(async (id: string) => {
    const now = new Date().toISOString();

    try {
      const db = await getDatabase();
      
      if (db) {
        await db.runAsync(`
          UPDATE atividades 
          SET status = 'concluida', 
              "data-fim" = ?,
              "updated-at" = ?,
              synced = 0
          WHERE id = ?
        `, [now, now, id]);
        
        // Adicionar à fila de sincronização
        await syncService.addToQueue('atividades', id, 'update', {
          status: 'concluida',
          dataFim: now,
          updatedAt: now,
        });
        
        logger.info('Atividade concluída no SQLite e adicionada à fila de sync', { id });
      }

      // Atualizar estado local e memória
      setAtividades((prev) => {
        const updated = prev.map((a) =>
          a.id === id
            ? { ...a, status: 'concluida' as const, dataFim: now, updatedAt: now, synced: false }
            : a
        );
        memoryStore = updated;
        return updated;
      });
      
      const pendentes = atividades.filter((a) => a.status === 'pendente' && a.id !== id).length;
      updateCounts({ atividadesPendentes: pendentes });
    } catch (err: any) {
      logger.error('Erro ao concluir atividade', { error: err.message });
      throw new Error('Erro ao concluir atividade');
    }
  }, [atividades, updateCounts]);

  // ========================================
  // REABRIR (VOLTAR PARA PENDENTE)
  // ========================================
  const reabrir = useCallback(async (id: string) => {
    const now = new Date().toISOString();

    try {
      const db = await getDatabase();
      
      if (db) {
        await db.runAsync(`
          UPDATE atividades 
          SET status = 'pendente', 
              "data-fim" = NULL,
              "updated-at" = ?,
              synced = 0
          WHERE id = ?
        `, [now, id]);
      }

      setAtividades((prev) => {
        const updated = prev.map((a) =>
          a.id === id
            ? { ...a, status: 'pendente' as const, dataFim: undefined, updatedAt: now, synced: false }
            : a
        );
        memoryStore = updated;
        return updated;
      });
    } catch (err: any) {
      logger.error('Erro ao reabrir atividade', { error: err.message });
    }
  }, []);

  // ========================================
  // DELETAR (SOFT DELETE)
  // ========================================
  const remove = useCallback(async (id: string) => {
    const now = new Date().toISOString();

    try {
      const db = await getDatabase();
      
      if (db) {
        await db.runAsync(`
          UPDATE atividades 
          SET "deleted-at" = ?,
              "updated-at" = ?,
              synced = 0
          WHERE id = ?
        `, [now, now, id]);
        
        // Adicionar à fila de sincronização
        await syncService.addToQueue('atividades', id, 'delete', {
          deletedAt: now,
          updatedAt: now,
        });
        
        logger.info('Atividade deletada no SQLite e adicionada à fila de sync', { id });
      }

      setAtividades((prev) => {
        const updated = prev.filter((a) => a.id !== id);
        memoryStore = updated;
        return updated;
      });
    } catch (err: any) {
      logger.error('Erro ao deletar atividade', { error: err.message });
    }
  }, []);

  return {
    atividades,
    isLoading,
    error,
    refresh: load,
    create,
    concluir,
    reabrir,
    remove,
  };
}

/**
 * Hook para contadores (query leve)
 */
export function useAtividadesCount() {
  const [counts, setCounts] = useState({ total: 0, pendentes: 0, concluidas: 0 });
  
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const db = await getDatabase();
        if (db) {
          const result = await db.getFirstAsync(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) as pendentes,
              SUM(CASE WHEN status = 'concluida' THEN 1 ELSE 0 END) as concluidas
            FROM atividades 
            WHERE "deleted-at" IS NULL
          `);
          
          if (result) {
            setCounts({
              total: result.total || 0,
              pendentes: result.pendentes || 0,
              concluidas: result.concluidas || 0,
            });
          }
        }
      } catch (err) {
        logger.error('Erro ao carregar contadores', { error: err });
      }
    };
    
    loadCounts();
  }, []);

  return counts;
}
