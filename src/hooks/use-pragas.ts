/**
 * Hook de Pragas e Reconhecimento - CRUD Real com SQLite
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getDatabase } from '@/database/db';
import { logger } from '@/services/logger';
import { useAppStore } from '@/stores/app-store';

// Types
export type Severidade = 'baixa' | 'media' | 'alta' | 'critica';

export interface Praga {
  id: string;
  scoutId: string;
  nome: string;
  nomePopular?: string;
  nomeCientifico?: string;
  quantidade?: number;
  severidade: Severidade;
  confianca?: number;
  imagemUri?: string;
  recomendacao?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
}

export interface PragaInput {
  scoutId: string;
  nome: string;
  nomePopular?: string;
  nomeCientifico?: string;
  quantidade?: number;
  severidade: Severidade;
  confianca?: number;
  imagemUri?: string;
  recomendacao?: string;
}

export interface ReconhecimentoResult {
  praga: string;
  nomePopular?: string;
  nomeCientifico?: string;
  confianca: number;
  severidade: Severidade;
  recomendacao?: string;
  alternativas?: Array<{ praga: string; confianca: number }>;
}

// Gerar ID único
const generateId = () => `praga_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Hook principal - CRUD de Pragas
 */
export function usePragas(scoutId?: string) {
  const [pragas, setPragas] = useState<Praga[]>([]);
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
        // Query com filtro opcional por scoutId
        let query = `
          SELECT 
            id, "scout-id" as scoutId, nome, quantidade, severidade,
            "created-at" as createdAt, "updated-at" as updatedAt, synced
          FROM pragas 
          WHERE "deleted-at" IS NULL
        `;
        
        const params: any[] = [];
        if (scoutId) {
          query += ` AND "scout-id" = ?`;
          params.push(scoutId);
        }
        
        query += ` ORDER BY "created-at" DESC`;

        const result = await db.getAllAsync(query, params);

        const data: Praga[] = result.map((row: any) => ({
          id: row.id,
          scoutId: row.scoutId,
          nome: row.nome,
          quantidade: row.quantidade,
          severidade: row.severidade || 'media',
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          synced: row.synced === 1,
        }));

        setPragas(data);
        
        // Atualizar contador global (só se não filtrou por scout)
        if (!scoutId) {
          updateCounts({ pragasTotal: data.length });
        }
        
        logger.info('Pragas carregadas do SQLite', { count: data.length, scoutId });
      } else {
        setPragas([]);
      }

      setIsLoading(false);
    } catch (err: any) {
      logger.error('Erro ao carregar pragas', { error: err.message });
      setError('Erro ao carregar pragas');
      setIsLoading(false);
    }
  }, [scoutId, updateCounts]);

  // Carregar na montagem e quando scoutId mudar
  useEffect(() => {
    load();
  }, [load]);

  // ========================================
  // CRIAR PRAGA
  // ========================================
  const create = useCallback(async (input: PragaInput): Promise<Praga> => {
    const now = new Date().toISOString();
    const newPraga: Praga = {
      id: generateId(),
      scoutId: input.scoutId,
      nome: input.nome,
      nomePopular: input.nomePopular,
      nomeCientifico: input.nomeCientifico,
      quantidade: input.quantidade,
      severidade: input.severidade,
      confianca: input.confianca,
      imagemUri: input.imagemUri,
      recomendacao: input.recomendacao,
      createdAt: now,
      updatedAt: now,
      synced: false,
    };

    try {
      const db = await getDatabase();
      
      if (db) {
        await db.runAsync(`
          INSERT INTO pragas (
            id, "scout-id", nome, quantidade, severidade,
            "created-at", "updated-at", synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newPraga.id,
          newPraga.scoutId,
          newPraga.nome,
          newPraga.quantidade || null,
          newPraga.severidade,
          newPraga.createdAt,
          newPraga.updatedAt,
          0,
        ]);
        
        logger.info('Praga salva no SQLite', { id: newPraga.id, nome: newPraga.nome, scoutId: newPraga.scoutId });
      }

      setPragas((prev) => [newPraga, ...prev]);
      return newPraga;
    } catch (err: any) {
      logger.error('Erro ao criar praga', { error: err.message });
      throw new Error('Erro ao criar praga');
    }
  }, []);

  // ========================================
  // ATUALIZAR PRAGA
  // ========================================
  const update = useCallback(async (id: string, updates: Partial<PragaInput>) => {
    const now = new Date().toISOString();

    try {
      const db = await getDatabase();
      
      if (db) {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.nome !== undefined) {
          fields.push('nome = ?');
          values.push(updates.nome);
        }
        if (updates.quantidade !== undefined) {
          fields.push('quantidade = ?');
          values.push(updates.quantidade);
        }
        if (updates.severidade !== undefined) {
          fields.push('severidade = ?');
          values.push(updates.severidade);
        }

        fields.push('"updated-at" = ?', 'synced = 0');
        values.push(now, id);

        await db.runAsync(`
          UPDATE pragas SET ${fields.join(', ')} WHERE id = ?
        `, values);
      }

      setPragas((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, ...updates, updatedAt: now, synced: false }
            : p
        )
      );
    } catch (err: any) {
      logger.error('Erro ao atualizar praga', { error: err.message });
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
          UPDATE pragas 
          SET "deleted-at" = ?, "updated-at" = ?, synced = 0
          WHERE id = ?
        `, [now, now, id]);
      }

      setPragas((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      logger.error('Erro ao deletar praga', { error: err.message });
    }
  }, []);

  return {
    pragas,
    isLoading,
    error,
    refresh: load,
    create,
    update,
    remove,
  };
}

/**
 * Hook para reconhecimento de pragas via IA
 * Estado é local/temporário até o usuário confirmar
 */
export function useReconhecimento() {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [result, setResult] = useState<ReconhecimentoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  // Referência para o scout atual (se houver)
  const currentScoutId = useRef<string | null>(null);

  // ========================================
  // RECONHECER IMAGEM
  // ========================================
  const recognize = useCallback(async (uri: string, scoutId?: string): Promise<ReconhecimentoResult> => {
    try {
      setIsRecognizing(true);
      setError(null);
      setResult(null);
      setImageUri(uri);
      currentScoutId.current = scoutId || null;

      // TODO: Enviar imagem para API de reconhecimento
      // Por enquanto, simular resposta da IA
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Simular diferentes resultados baseado na hora (para testes)
      const pragas = [
        {
          praga: 'Lagarta-do-cartucho',
          nomePopular: 'Lagarta militar',
          nomeCientifico: 'Spodoptera frugiperda',
          confianca: 0.94,
          severidade: 'media' as Severidade,
          recomendacao: 'Aplicar inseticida biológico à base de Bacillus thuringiensis (Bt). Monitorar área por 7 dias.',
          alternativas: [
            { praga: 'Lagarta-da-espiga', confianca: 0.12 },
            { praga: 'Lagarta-rosca', confianca: 0.08 },
          ],
        },
        {
          praga: 'Ferrugem asiática',
          nomePopular: 'Ferrugem da soja',
          nomeCientifico: 'Phakopsora pachyrhizi',
          confianca: 0.91,
          severidade: 'alta' as Severidade,
          recomendacao: 'Aplicar fungicida triazol + estrobilurina. Reaplicar em 14 dias.',
          alternativas: [
            { praga: 'Ferrugem comum', confianca: 0.15 },
          ],
        },
        {
          praga: 'Percevejo-marrom',
          nomePopular: 'Percevejo da soja',
          nomeCientifico: 'Euschistus heros',
          confianca: 0.88,
          severidade: 'baixa' as Severidade,
          recomendacao: 'Monitorar população. Controle necessário acima de 2 percevejos/m².',
        },
      ];

      const mockResult = pragas[Math.floor(Math.random() * pragas.length)];

      setResult(mockResult);
      setIsRecognizing(false);
      
      logger.info('Reconhecimento concluído', { 
        praga: mockResult.praga, 
        confianca: mockResult.confianca,
        imageUri: uri,
      });
      
      return mockResult;
    } catch (err: any) {
      logger.error('Erro no reconhecimento', { error: err.message });
      setError('Erro ao reconhecer praga. Tente novamente.');
      setIsRecognizing(false);
      throw err;
    }
  }, []);

  // ========================================
  // SALVAR RESULTADO (após confirmação do usuário)
  // ========================================
  const saveResult = useCallback(async (scoutId: string): Promise<Praga | null> => {
    if (!result) return null;

    try {
      const db = await getDatabase();
      const now = new Date().toISOString();
      const newPraga: Praga = {
        id: generateId(),
        scoutId,
        nome: result.praga,
        nomePopular: result.nomePopular,
        nomeCientifico: result.nomeCientifico,
        severidade: result.severidade,
        confianca: result.confianca,
        imagemUri: imageUri || undefined,
        recomendacao: result.recomendacao,
        createdAt: now,
        updatedAt: now,
        synced: false,
      };

      if (db) {
        await db.runAsync(`
          INSERT INTO pragas (
            id, "scout-id", nome, quantidade, severidade,
            "created-at", "updated-at", synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newPraga.id,
          newPraga.scoutId,
          newPraga.nome,
          1,
          newPraga.severidade,
          newPraga.createdAt,
          newPraga.updatedAt,
          0,
        ]);
        
        logger.info('Praga do reconhecimento salva', { id: newPraga.id, scoutId });
      }

      // Limpar estado
      setResult(null);
      setImageUri(null);
      currentScoutId.current = null;

      return newPraga;
    } catch (err: any) {
      logger.error('Erro ao salvar resultado', { error: err.message });
      throw err;
    }
  }, [result, imageUri]);

  // ========================================
  // LIMPAR/CANCELAR
  // ========================================
  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setImageUri(null);
    currentScoutId.current = null;
  }, []);

  return {
    isRecognizing,
    result,
    error,
    imageUri,
    recognize,
    saveResult,
    clear,
  };
}

/**
 * Hook para contadores por severidade
 */
export function usePragasCount() {
  const [counts, setCounts] = useState({ total: 0, baixa: 0, media: 0, alta: 0, critica: 0 });
  
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const db = await getDatabase();
        if (db) {
          const result = await db.getFirstAsync(`
            SELECT 
              COUNT(*) as total,
              SUM(CASE WHEN severidade = 'baixa' THEN 1 ELSE 0 END) as baixa,
              SUM(CASE WHEN severidade = 'media' THEN 1 ELSE 0 END) as media,
              SUM(CASE WHEN severidade = 'alta' THEN 1 ELSE 0 END) as alta,
              SUM(CASE WHEN severidade = 'critica' THEN 1 ELSE 0 END) as critica
            FROM pragas 
            WHERE "deleted-at" IS NULL
          `);
          
          if (result) {
            setCounts({
              total: result.total || 0,
              baixa: result.baixa || 0,
              media: result.media || 0,
              alta: result.alta || 0,
              critica: result.critica || 0,
            });
          }
        }
      } catch (err) {
        logger.error('Erro ao carregar contadores de pragas', { error: err });
      }
    };
    
    loadCounts();
  }, []);

  return counts;
}
