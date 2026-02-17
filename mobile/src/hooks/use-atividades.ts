/**
 * Hook de Atividades - CRUD com WatermelonDB + Sync Supabase
 * Offline-First: salva local, fila de sync envia ao Supabase quando online.
 */

import { Q } from '@nozbe/watermelondb';
import { useState, useEffect, useCallback } from 'react';
import { getWatermelonDB } from '@/database/watermelon/database';
import AtividadeModel from '@/database/watermelon/models/Atividade';
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

  const toAtividade = (m: AtividadeModel): Atividade => ({
    id: m.id,
    nome: m.nome,
    descricao: m.descricao ?? undefined,
    tipo: m.tipo || 'outros',
    status: (m.status as Atividade['status']) || 'pendente',
    dataInicio: m.dataInicio != null ? new Date(m.dataInicio).toISOString() : undefined,
    dataFim: m.dataFim != null ? new Date(m.dataFim).toISOString() : undefined,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    synced: m.synced,
  });

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const db = getWatermelonDB();
      if (db) {
        const list = await db
          .get<AtividadeModel>('atividades')
          .query(Q.where('deleted_at', null), Q.sortBy('created_at', Q.desc))
          .fetch();
        const data = list.map(toAtividade);
        setAtividades(data);
        const pendentes = data.filter((a) => a.status === 'pendente').length;
        updateCounts({ atividadesPendentes: pendentes });
        logger.info('Atividades carregadas do WatermelonDB', { count: data.length });
      } else {
        logger.warn('WatermelonDB não disponível, usando dados em memória');
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

  const create = useCallback(async (input: AtividadeInput): Promise<Atividade> => {
    const now = new Date();
    const nowStr = now.toISOString();
    const ts = now.getTime();
    const newAtividade: Atividade = {
      id: generateId(),
      nome: input.nome,
      descricao: input.descricao,
      tipo: input.tipo,
      status: 'pendente',
      talhaoNome: input.talhaoNome,
      dataInicio: input.dataInicio || nowStr,
      createdAt: nowStr,
      updatedAt: nowStr,
      synced: false,
    };

    try {
      const db = getWatermelonDB();
      if (db) {
        const dataInicioTs = input.dataInicio ? new Date(input.dataInicio).getTime() : ts;
        await db.write(async () => {
          const coll = db.get<AtividadeModel>('atividades');
          const record = coll.prepareCreateFromDirtyRaw({
            id: newAtividade.id,
            nome: newAtividade.nome,
            descricao: newAtividade.descricao ?? null,
            tipo: newAtividade.tipo,
            status: newAtividade.status,
            data_inicio: dataInicioTs,
            data_fim: null,
            created_at: ts,
            updated_at: ts,
            synced: false,
            deleted_at: null,
          });
          await db.batch(record);
        });
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
        logger.info('Atividade salva no WatermelonDB e adicionada à fila de sync', { id: newAtividade.id });
      }
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

  const concluir = useCallback(async (id: string) => {
    const now = new Date();
    const nowStr = now.toISOString();

    try {
      const db = getWatermelonDB();
      if (db) {
        await db.write(async () => {
          const rec = await db.get<AtividadeModel>('atividades').find(id);
          await rec.update((r) => {
            r.status = 'concluida';
            r.dataFim = now.getTime();
            r.updatedAt = now;
            r.synced = false;
          });
        });
        await syncService.addToQueue('atividades', id, 'update', {
          status: 'concluida',
          dataFim: nowStr,
          updatedAt: nowStr,
        });
        logger.info('Atividade concluída no WatermelonDB e adicionada à fila de sync', { id });
      }
      setAtividades((prev) => {
        const updated = prev.map((a) =>
          a.id === id ? { ...a, status: 'concluida' as const, dataFim: nowStr, updatedAt: nowStr, synced: false } : a
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

  const reabrir = useCallback(async (id: string) => {
    const now = new Date();
    const nowStr = now.toISOString();
    try {
      const db = getWatermelonDB();
      if (db) {
        await db.write(async () => {
          const rec = await db.get<AtividadeModel>('atividades').find(id);
          await rec.update((r) => {
            r.status = 'pendente';
            r.dataFim = null;
            r.updatedAt = now;
            r.synced = false;
          });
        });
      }
      setAtividades((prev) => {
        const updated = prev.map((a) =>
          a.id === id ? { ...a, status: 'pendente' as const, dataFim: undefined, updatedAt: nowStr, synced: false } : a
        );
        memoryStore = updated;
        return updated;
      });
    } catch (err: any) {
      logger.error('Erro ao reabrir atividade', { error: err.message });
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const now = new Date();
    const nowStr = now.toISOString();
    try {
      const db = getWatermelonDB();
      if (db) {
        await db.write(async () => {
          const rec = await db.get<AtividadeModel>('atividades').find(id);
          await rec.update((r) => {
            r.deletedAt = now;
            r.updatedAt = now;
            r.synced = false;
          });
        });
        await syncService.addToQueue('atividades', id, 'delete', {
          deletedAt: nowStr,
          updatedAt: nowStr,
        });
        logger.info('Atividade deletada no WatermelonDB e adicionada à fila de sync', { id });
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
        const db = getWatermelonDB();
        if (db) {
          const coll = db.get<AtividadeModel>('atividades');
          const base = Q.where('deleted_at', null);
          const [total, pendentes, concluidas] = await Promise.all([
            coll.query(base).fetchCount(),
            coll.query(Q.and(base, Q.where('status', 'pendente'))).fetchCount(),
            coll.query(Q.and(base, Q.where('status', 'concluida'))).fetchCount(),
          ]);
          setCounts({ total, pendentes, concluidas });
        }
      } catch (err) {
        logger.error('Erro ao carregar contadores', { error: err });
      }
    };
    loadCounts();
  }, []);
  return counts;
}
