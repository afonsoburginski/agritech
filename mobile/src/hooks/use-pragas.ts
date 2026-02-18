/**
 * Hook de Pragas e Reconhecimento - CRUD com WatermelonDB
 */

import { Q } from '@nozbe/watermelondb';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getWatermelonDB } from '@/database/watermelon/database';
import PragaModel from '@/database/watermelon/models/Praga';
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


export interface ReconhecimentoBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReconhecimentoPest {
  praga: string;
  nomePopular?: string;
  nomeCientifico?: string;
  confianca: number;
  severidade: Severidade;
  tipoPraga?: string;
  recomendacao?: string;
  boundingBox?: ReconhecimentoBoundingBox;
}

export interface ReconhecimentoResult {
  praga: string;
  nomePopular?: string;
  nomeCientifico?: string;
  confianca: number;
  severidade: Severidade;
  tipoPraga?: string;
  recomendacao?: string;
  alternativas?: Array<{ praga: string; confianca: number }>;
  /** All detected pests from the image */
  pests: ReconhecimentoPest[];
  imagemUrl?: string | null;
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

  const toPraga = (m: PragaModel): Praga => ({
    id: m.id,
    scoutId: m.scoutId,
    nome: m.nome,
    quantidade: m.quantidade ?? undefined,
    severidade: (m.severidade as Severidade) || 'media',
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
        const coll = db.get<PragaModel>('pragas');
        const query = scoutId
          ? coll.query(Q.where('deleted_at', null), Q.where('scout_id', scoutId), Q.sortBy('created_at', Q.desc))
          : coll.query(Q.where('deleted_at', null), Q.sortBy('created_at', Q.desc));
        const list = await query.fetch();
        const data = list.map(toPraga);
        setPragas(data);
        if (!scoutId) updateCounts({ pragasTotal: data.length });
        logger.info('Pragas carregadas do WatermelonDB', { count: data.length, scoutId });
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

  const create = useCallback(async (input: PragaInput): Promise<Praga> => {
    const now = new Date();
    const nowStr = now.toISOString();
    const ts = now.getTime();
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
      createdAt: nowStr,
      updatedAt: nowStr,
      synced: false,
    };

    try {
      const db = getWatermelonDB();
      if (db) {
        await db.write(async () => {
          const coll = db.get<PragaModel>('pragas');
          const record = coll.prepareCreateFromDirtyRaw({
            id: newPraga.id,
            scout_id: newPraga.scoutId,
            nome: newPraga.nome,
            quantidade: newPraga.quantidade ?? null,
            severidade: newPraga.severidade,
            created_at: ts,
            updated_at: ts,
            synced: false,
            deleted_at: null,
          });
          await db.batch(record);
        });
        logger.info('Praga salva no WatermelonDB', { id: newPraga.id, nome: newPraga.nome, scoutId: newPraga.scoutId });
      }
      setPragas((prev) => [newPraga, ...prev]);
      return newPraga;
    } catch (err: any) {
      logger.error('Erro ao criar praga', { error: err.message });
      throw new Error('Erro ao criar praga');
    }
  }, []);

  const update = useCallback(async (id: string, updates: Partial<PragaInput>) => {
    const now = new Date();
    const nowStr = now.toISOString();
    try {
      const db = getWatermelonDB();
      if (db) {
        await db.write(async () => {
          const rec = await db.get<PragaModel>('pragas').find(id);
          await rec.update((r) => {
            if (updates.nome !== undefined) r.nome = updates.nome;
            if (updates.quantidade !== undefined) r.quantidade = updates.quantidade;
            if (updates.severidade !== undefined) r.severidade = updates.severidade;
            r.updatedAt = now;
            r.synced = false;
          });
        });
      }
      setPragas((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: nowStr, synced: false } : p))
      );
    } catch (err: any) {
      logger.error('Erro ao atualizar praga', { error: err.message });
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    const now = new Date();
    try {
      const db = getWatermelonDB();
      if (db) {
        await db.write(async () => {
          const rec = await db.get<PragaModel>('pragas').find(id);
          await rec.update((r) => {
            r.deletedAt = now;
            r.updatedAt = now;
            r.synced = false;
          });
        });
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
 * Hook para reconhecimento de pragas via IA (OpenAI Vision)
 * Estado é local/temporário até o usuário confirmar
 */
export function useReconhecimento() {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [result, setResult] = useState<ReconhecimentoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isOfflinePending, setIsOfflinePending] = useState(false);
  
  // Referência para o scout atual (se houver)
  const currentScoutId = useRef<string | null>(null);

  // ========================================
  // RECONHECER IMAGEM VIA OPENAI
  // ========================================
  const recognize = useCallback(async (
    uri: string,
    scoutId?: string,
    metadata?: { fazendaId?: number; talhaoId?: number; cultura?: string }
  ): Promise<ReconhecimentoResult> => {
    // Importar dinamicamente para evitar problemas de bundling
    const { recognizePest } = await import('@/services/openai-service');
    
    try {
      setIsRecognizing(true);
      setError(null);
      setResult(null);
      setImageUri(uri);
      setIsOfflinePending(false);
      currentScoutId.current = scoutId || null;

      // Chamar API da OpenAI Vision (cultura/talhaoId ajudam a Edge a buscar produtos Embrapa)
      const apiResult = await recognizePest(uri, metadata);

      const convertedPests: ReconhecimentoPest[] = (apiResult.pests ?? []).map((p: any) => ({
        praga: p.name,
        nomePopular: p.popularName,
        nomeCientifico: p.scientificName,
        confianca: p.confidence,
        severidade: (p.severity as Severidade) || 'media',
        tipoPraga: p.pestType,
        recomendacao: p.recommendation,
        boundingBox: p.boundingBox,
      }));

      const convertedResult: ReconhecimentoResult = {
        praga: apiResult.name,
        nomePopular: apiResult.popularName,
        nomeCientifico: apiResult.scientificName,
        confianca: apiResult.confidence,
        severidade: apiResult.severity as Severidade,
        tipoPraga: apiResult.pestType,
        recomendacao: apiResult.recomendacao ?? apiResult.recommendation,
        alternativas: apiResult.alternatives?.map(a => ({ praga: a.name, confianca: a.confidence })),
        pests: convertedPests,
        imagemUrl: apiResult.image?.url ?? null,
      };

      setResult(convertedResult);
      setIsRecognizing(false);
      
      logger.info('Reconhecimento OpenAI concluído', { 
        praga: convertedResult.praga, 
        confianca: convertedResult.confianca,
      });
      
      return convertedResult;
    } catch (err: any) {
      logger.error('Erro no reconhecimento', { error: err.message });
      
      // Se for erro de offline, marcar como pendente (foto já foi salva na fila)
      if (err.message.includes('Sem conexão') || err.message.includes('foto foi salva') || err.message.includes('offline')) {
        setIsOfflinePending(true);
        setError(err.message || 'Sem conexão. A foto foi salva e será analisada quando estiver online.');
      } else {
        setError('Erro ao reconhecer praga. Tente novamente.');
      }
      
      setIsRecognizing(false);
      throw err;
    }
  }, []);

  // ========================================
  // SALVAR RESULTADO NO SUPABASE (após confirmação do usuário)
  // ========================================
  const saveResult = useCallback(async (
    scoutId: string,
    overrides?: { pragaNome?: string; contagem?: number }
  ): Promise<Praga | null> => {
    if (!result) return null;

    const pragaNome = overrides?.pragaNome ?? result.praga;
    const contagem = overrides?.contagem ?? 1;

    try {
      const now = new Date().toISOString();
      const pestId = generateId();
      
      const newPraga: Praga = {
        id: pestId,
        scoutId,
        nome: pragaNome,
        nomePopular: result.nomePopular,
        nomeCientifico: result.nomeCientifico,
        quantidade: contagem,
        severidade: result.severidade,
        confianca: result.confianca,
        imagemUri: imageUri || undefined,
        recomendacao: result.recomendacao,
        createdAt: now,
        updatedAt: now,
        synced: false,
      };

      // The reconhecimento screen already handles Supabase inserts directly.
      // saveResult only writes to the local WatermelonDB for offline-first storage.
      // When scoutId is a local ID (scout_xxx), we skip Supabase to avoid duplicates.
      const scoutIdNum = typeof scoutId === 'number' ? scoutId : parseInt(String(scoutId), 10);
      const hasValidScoutId = Number.isFinite(scoutIdNum) && scoutIdNum > 0;

      if (hasValidScoutId) {
        const { supabase, isSupabaseConfigured } = await import('@/services/supabase');
        if (isSupabaseConfigured() && supabase) {
          const { getEmbrapaRecomendacaoId } = await import('@/services/embrapa-recomendacoes');
          const embrapaRecomendacaoId = await getEmbrapaRecomendacaoId(
            supabase,
            pragaNome,
            result.nomeCientifico ?? null
          );
          const { error: supaError } = await supabase.from('scout_pragas').insert({
            scout_id: scoutIdNum,
            embrapa_recomendacao_id: embrapaRecomendacaoId,
            tipo_praga: result.tipoPraga ?? 'PRAGA',
            contagem,
            presenca: true,
            prioridade: result.severidade === 'critica' ? 'ALTA' : result.severidade === 'alta' ? 'ALTA' : result.severidade === 'media' ? 'MEDIA' : 'BAIXA',
            observacao: result.recomendacao,
            data_contagem: now,
            imagem_url: result.imagemUrl ?? null,
          });

          if (supaError) {
            logger.error('Erro ao salvar praga no Supabase', { error: supaError });
          } else {
            newPraga.synced = true;
            logger.info('Praga salva no Supabase', { id: pestId, scoutId: scoutIdNum, name: pragaNome });
          }
        }
      } else {
        newPraga.synced = true;
      }

      const db = getWatermelonDB();
      if (db) {
        const ts = new Date().getTime();
        await db.write(async () => {
          const coll = db.get<PragaModel>('pragas');
          const record = coll.prepareCreateFromDirtyRaw({
            id: newPraga.id,
            scout_id: newPraga.scoutId,
            nome: newPraga.nome,
            quantidade: contagem,
            severidade: newPraga.severidade,
            created_at: ts,
            updated_at: ts,
            synced: newPraga.synced,
            deleted_at: null,
          });
          await db.batch(record);
        });
        logger.info('Praga do reconhecimento salva no WatermelonDB', { id: newPraga.id });
      }

      setResult(null);
      setImageUri(null);
      setIsOfflinePending(false);
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
    setIsOfflinePending(false);
    currentScoutId.current = null;
  }, []);

  return {
    isRecognizing,
    result,
    error,
    imageUri,
    isOfflinePending,
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
        const db = getWatermelonDB();
        if (db) {
          const coll = db.get<PragaModel>('pragas');
          const base = Q.where('deleted_at', null);
          const [total, baixa, media, alta, critica] = await Promise.all([
            coll.query(base).fetchCount(),
            coll.query(Q.and(base, Q.where('severidade', 'baixa'))).fetchCount(),
            coll.query(Q.and(base, Q.where('severidade', 'media'))).fetchCount(),
            coll.query(Q.and(base, Q.where('severidade', 'alta'))).fetchCount(),
            coll.query(Q.and(base, Q.where('severidade', 'critica'))).fetchCount(),
          ]);
          setCounts({ total, baixa, media, alta, critica });
        }
      } catch (err) {
        logger.error('Erro ao carregar contadores de pragas', { error: err });
      }
    };
    loadCounts();
  }, []);
  return counts;
}
