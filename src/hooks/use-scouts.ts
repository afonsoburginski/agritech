/**
 * Hook de Scouts - CRUD Real com SQLite + Sync Supabase
 * 
 * Estratégia Offline-First:
 * 1. Todas operações são salvas primeiro no SQLite local
 * 2. Operações são adicionadas à fila de sync
 * 3. Sync service envia ao Supabase quando online
 */

import { useState, useEffect, useCallback } from 'react';
import { getDatabase } from '@/database/db';
import { logger } from '@/services/logger';
import { useAppStore } from '@/stores/app-store';
import { syncService } from '@/services/sync-service';

// Types
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

// Gerar ID único
const generateId = () => `scout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Armazenamento em memória para fallback (Expo Go)
let scoutsMemoryStore: Scout[] = [];

/**
 * Hook principal - CRUD de Scouts
 */
export function useScouts() {
  const [scouts, setScouts] = useState<Scout[]>([]);
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
        // Carregar scouts com contagem de pragas
        const result = await db.getAllAsync(`
          SELECT 
            s.id, s.latitude, s.longitude, s.accuracy, s.altitude,
            s."created-at" as createdAt,
            s."updated-at" as updatedAt,
            s.synced,
            COALESCE((SELECT COUNT(*) FROM pragas p WHERE p."scout-id" = s.id AND p."deleted-at" IS NULL), 0) as pragasCount
          FROM scouts s
          WHERE s."deleted-at" IS NULL
          ORDER BY s."created-at" DESC
        `);

        const data: Scout[] = result.map((row: any) => ({
          id: row.id,
          latitude: row.latitude,
          longitude: row.longitude,
          accuracy: row.accuracy,
          altitude: row.altitude,
          visitado: row.pragasCount > 0, // Visitado se tem pragas registradas
          pragasCount: row.pragasCount || 0,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          synced: row.synced === 1,
        }));

        setScouts(data);
        
        // Atualizar contador global
        const pendentes = data.filter((s) => !s.visitado).length;
        updateCounts({ scoutsPendentes: pendentes });
        
        logger.info('Scouts carregados do SQLite', { count: data.length });
      } else {
        // Fallback para dados em memória (Expo Go)
        logger.warn('SQLite não disponível, usando dados em memória');
        setScouts(scoutsMemoryStore);
      }

      setIsLoading(false);
    } catch (err: any) {
      logger.error('Erro ao carregar scouts', { error: err.message });
      setError('Erro ao carregar scouts');
      setIsLoading(false);
    }
  }, [updateCounts]);

  // Carregar na montagem
  useEffect(() => {
    load();
  }, [load]);

  // ========================================
  // CRIAR SCOUT (PONTO DE MONITORAMENTO)
  // ========================================
  const create = useCallback(async (input: ScoutInput): Promise<Scout> => {
    const now = new Date().toISOString();
    const newScout: Scout = {
      id: generateId(),
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      altitude: input.altitude,
      talhaoNome: input.talhaoNome,
      observacoes: input.observacoes,
      visitado: false,
      pragasCount: 0,
      createdAt: now,
      updatedAt: now,
      synced: false,
    };

    try {
      const db = await getDatabase();
      
      if (db) {
        await db.runAsync(`
          INSERT INTO scouts (
            id, latitude, longitude, accuracy, altitude,
            "created-at", "updated-at", synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newScout.id,
          newScout.latitude,
          newScout.longitude,
          newScout.accuracy || null,
          newScout.altitude || null,
          newScout.createdAt,
          newScout.updatedAt,
          0,
        ]);
        
        // Adicionar à fila de sincronização
        await syncService.addToQueue('scouts', newScout.id, 'create', {
          id: newScout.id,
          latitude: newScout.latitude,
          longitude: newScout.longitude,
          accuracy: newScout.accuracy,
          altitude: newScout.altitude,
          createdAt: newScout.createdAt,
          updatedAt: newScout.updatedAt,
        });
        
        logger.info('Scout salvo no SQLite e adicionado à fila de sync', { id: newScout.id });
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
  }, []);

  // ========================================
  // MARCAR COMO VISITADO
  // ========================================
  const marcarVisitado = useCallback(async (id: string) => {
    const now = new Date().toISOString();

    try {
      const db = await getDatabase();
      
      if (db) {
        await db.runAsync(`
          UPDATE scouts 
          SET "updated-at" = ?, synced = 0
          WHERE id = ?
        `, [now, id]);
      }

      setScouts((prev) => {
        const updated = prev.map((s) =>
          s.id === id
            ? { ...s, visitado: true, dataVisita: now, updatedAt: now, synced: false }
            : s
        );
        scoutsMemoryStore = updated;
        return updated;
      });
    } catch (err: any) {
      logger.error('Erro ao marcar scout como visitado', { error: err.message });
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
          UPDATE scouts 
          SET "deleted-at" = ?, "updated-at" = ?, synced = 0
          WHERE id = ?
        `, [now, now, id]);
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

  // ========================================
  // ATUALIZAR CONTAGEM DE PRAGAS (chamado pelo hook de pragas)
  // ========================================
  const atualizarPragasCount = useCallback((scoutId: string, delta: number) => {
    setScouts((prev) => {
      const updated = prev.map((s) =>
        s.id === scoutId
          ? { ...s, pragasCount: Math.max(0, s.pragasCount + delta), visitado: true }
          : s
      );
      scoutsMemoryStore = updated;
      return updated;
    });
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

/**
 * Hook para dados do heatmap
 */
export function useHeatmapData() {
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const db = await getDatabase();
        
        if (db) {
          // Buscar scouts com pragas para o heatmap
          const result = await db.getAllAsync(`
            SELECT 
              s.id, s.latitude, s.longitude,
              COUNT(p.id) as pragasCount
            FROM scouts s
            LEFT JOIN pragas p ON p."scout-id" = s.id AND p."deleted-at" IS NULL
            WHERE s."deleted-at" IS NULL
            GROUP BY s.id
            HAVING pragasCount > 0
          `);

          const data: HeatmapPoint[] = result.map((row: any) => ({
            lat: row.latitude,
            lng: row.longitude,
            intensity: Math.min(row.pragasCount / 10, 1), // Normaliza para 0-1
            scoutId: row.id,
          }));

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

/**
 * Hook para contadores
 */
export function useScoutsCount() {
  const [counts, setCounts] = useState({ total: 0, visitados: 0, pendentes: 0, comPragas: 0 });
  
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const db = await getDatabase();
        if (db) {
          const result = await db.getFirstAsync(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN (SELECT COUNT(*) FROM pragas p WHERE p."scout-id" = s.id) > 0 THEN 1 ELSE 0 END) as comPragas
            FROM scouts s
            WHERE s."deleted-at" IS NULL
          `) as { total: number; comPragas: number } | null;
          
          if (result) {
            setCounts({
              total: result.total || 0,
              visitados: result.comPragas || 0,
              pendentes: (result.total || 0) - (result.comPragas || 0),
              comPragas: result.comPragas || 0,
            });
          }
        }
      } catch (err) {
        logger.error('Erro ao carregar contadores de scouts', { error: err });
      }
    };
    
    loadCounts();
  }, []);

  return counts;
}

/**
 * Hook para total de pragas
 */
export function useTotalPragas() {
  const [total, setTotal] = useState(0);
  
  useEffect(() => {
    const loadTotal = async () => {
      try {
        const db = await getDatabase();
        if (db) {
          const result = await db.getFirstAsync(`
            SELECT COUNT(*) as total FROM pragas WHERE "deleted-at" IS NULL
          `) as { total: number } | null;
          setTotal(result?.total || 0);
        }
      } catch (err) {
        logger.error('Erro ao carregar total de pragas', { error: err });
      }
    };
    
    loadTotal();
  }, []);

  return total;
}
