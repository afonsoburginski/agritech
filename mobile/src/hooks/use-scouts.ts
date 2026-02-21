/**
 * Hook de Scouts - CRUD com WatermelonDB + Sync Supabase
 *
 * Offline-First: operações são salvas no WatermelonDB e enfileiradas para sync.
 */

import { useState, useEffect, useCallback } from 'react';
import { Q } from '@nozbe/watermelondb';
import { getWatermelonDB } from '@/database/watermelon';
import ScoutModel from '@/database/watermelon/models/Scout';
import { logger } from '@/services/logger';
import { useAppStore } from '@/stores/app-store';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { syncService } from '@/services/sync-service';

export interface Scout {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  talhaoId?: string;
  talhaoNome?: string;
  visitado: boolean;
  dataVisita?: string;
  pragasCount: number;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface ScoutInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  talhaoNome?: string;
  observacoes?: string;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  scoutId?: string;
}

const generateId = () => `scout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
let scoutsMemoryStore: Scout[] = [];

function scoutModelToScout(m: ScoutModel, pragasCount: number): Scout {
  return {
    id: m.id,
    latitude: m.latitude,
    longitude: m.longitude,
    accuracy: m.accuracy ?? undefined,
    altitude: m.altitude ?? undefined,
    visitado: pragasCount > 0,
    pragasCount,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    synced: m.synced,
  };
}

export function useScouts() {
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const updateCounts = useAppStore((s) => s.updateCounts);
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const db = getWatermelonDB();

      if (db) {
        const scoutsColl = db.get<ScoutModel>('scouts');
        const pragasColl = db.get('pragas');
        const list = await scoutsColl
          .query(Q.where('deleted_at', null), Q.sortBy('created_at', Q.desc))
          .fetch();

        const data: Scout[] = [];
        for (const s of list) {
          const count = await pragasColl
            .query(Q.where('scout_id', s.id), Q.where('deleted_at', null))
            .fetchCount();
          data.push(scoutModelToScout(s, count));
        }

        setScouts(data);
        const pendentes = data.filter((s) => !s.visitado).length;
        updateCounts({ scoutsPendentes: pendentes });
        logger.info('Scouts carregados do WatermelonDB', { count: data.length });
      } else {
        setScouts(scoutsMemoryStore);
      }

      setIsLoading(false);
    } catch (err: any) {
      logger.error('Erro ao carregar scouts', { error: err.message });
      setError('Erro ao carregar scouts');
      setIsLoading(false);
    }
  }, [updateCounts]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (input: ScoutInput): Promise<Scout> => {
    const now = new Date();
    const nowStr = now.toISOString();
    const id = generateId();
    const scoutNome = input.talhaoNome
      ? `Scout ${input.talhaoNome}`
      : `Scout ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const newScout: Scout = {
      id,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      altitude: input.altitude,
      talhaoNome: input.talhaoNome,
      observacoes: input.observacoes,
      visitado: false,
      pragasCount: 0,
      createdAt: nowStr,
      updatedAt: nowStr,
      synced: false,
    };

    try {
      const db = getWatermelonDB();

      if (db) {
        const scoutsColl = db.get<ScoutModel>('scouts');
        const ts = now.getTime();
        const raw = {
          id,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy ?? null,
          altitude: input.altitude ?? null,
          created_at: ts,
          updated_at: ts,
          synced: false,
          deleted_at: null,
        };
        await db.write(async () => {
          const record = scoutsColl.prepareCreateFromDirtyRaw(raw);
          await db.batch(record);
        });

        await syncService.addToQueue('scouts', id, 'create', {
          fazendaId: fazendaId,
          nome: scoutNome,
          observacao: input.observacoes ?? null,
          status: 'PENDENTE',
          latitude: newScout.latitude,
          longitude: newScout.longitude,
        });
        logger.info('Scout salvo no WatermelonDB e adicionado à fila de sync', { id });
      }

      setScouts((prev) => {
        const updated = [newScout, ...prev];
        scoutsMemoryStore = updated;
        return updated;
      });
      return newScout;
    } catch (err: any) {
      logger.error('Erro ao criar scout', { error: err.message });
      throw new Error('Erro ao criar scout');
    }
  }, [fazendaId]);

  const marcarVisitado = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    try {
      const db = getWatermelonDB();
      if (db) {
        const scout = await db.get<ScoutModel>('scouts').find(id);
        await db.write(async () => {
          await scout.update((r: ScoutModel) => {
            r.updatedAt = new Date();
            r.synced = false;
          });
        });
      }
      setScouts((prev) => {
        const updated = prev.map((s) =>
          s.id === id ? { ...s, visitado: true, dataVisita: now, updatedAt: now, synced: false } : s
        );
        scoutsMemoryStore = updated;
        return updated;
      });
    } catch (err: any) {
      logger.error('Erro ao marcar scout como visitado', { error: err.message });
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const now = new Date();
    try {
      const db = getWatermelonDB();
      if (db) {
        const scout = await db.get<ScoutModel>('scouts').find(id);
        await db.write(async () => {
          await scout.update((r) => {
            r.deletedAt = now;
            r.updatedAt = now;
            r.synced = false;
          });
        });
      }
      setScouts((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        scoutsMemoryStore = updated;
        return updated;
      });
    } catch (err: any) {
      logger.error('Erro ao deletar scout', { error: err.message });
    }
  }, []);

  const atualizarPragasCount = useCallback((scoutId: string, delta: number) => {
    setScouts((prev) =>
      prev.map((s) =>
        s.id === scoutId
          ? { ...s, pragasCount: Math.max(0, s.pragasCount + delta), visitado: true }
          : s
      )
    );
  }, []);

  return {
    scouts,
    isLoading,
    error,
    refresh: load,
    create,
    marcarVisitado,
    remove,
    atualizarPragasCount,
  };
}

export function useHeatmapData() {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const db = getWatermelonDB();
        if (db) {
          const scoutsColl = db.get<ScoutModel>('scouts');
          const pragasColl = db.get('pragas');
          const list = await scoutsColl
            .query(Q.where('deleted_at', null))
            .fetch();
          const data: HeatmapPoint[] = [];
          for (const s of list) {
            const count = await pragasColl
              .query(Q.where('scout_id', s.id), Q.where('deleted_at', null))
              .fetchCount();
            if (count > 0) {
              data.push({
                lat: s.latitude,
                lng: s.longitude,
                intensity: Math.min(count / 10, 1),
                scoutId: s.id,
              });
            }
          }
          setPoints(data);
        }
        setIsLoading(false);
      } catch (err) {
        logger.error('Erro ao carregar heatmap', { error: err });
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return { points, isLoading, hasData: points.length > 0 };
}

export function useScoutsCount() {
  const [counts, setCounts] = useState({ total: 0, visitados: 0, pendentes: 0, comPragas: 0 });

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const db = getWatermelonDB();
        if (db) {
          const scoutsColl = db.get<ScoutModel>('scouts');
          const pragasColl = db.get('pragas');
          const total = await scoutsColl
            .query(Q.where('deleted_at', null))
            .fetchCount();
          let comPragas = 0;
          const list = await scoutsColl.query(Q.where('deleted_at', null)).fetch();
          for (const s of list) {
            const c = await pragasColl
              .query(Q.where('scout_id', s.id), Q.where('deleted_at', null))
              .fetchCount();
            if (c > 0) comPragas++;
          }
          setCounts({
            total,
            visitados: comPragas,
            pendentes: total - comPragas,
            comPragas,
          });
        }
      } catch (err) {
        logger.error('Erro ao carregar contadores de scouts', { error: err });
      }
    };
    loadCounts();
  }, []);

  return counts;
}

export function useTotalPragas() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const loadTotal = async () => {
      try {
        const db = getWatermelonDB();
        if (db) {
          const n = await db
            .get('pragas')
            .query(Q.where('deleted_at', null))
            .fetchCount();
          setTotal(n);
        }
      } catch (err) {
        logger.error('Erro ao carregar total de pragas', { error: err });
      }
    };
    loadTotal();
  }, []);

  return total;
}
