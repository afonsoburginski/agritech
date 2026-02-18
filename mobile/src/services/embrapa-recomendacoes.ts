/**
 * Resolve nome de praga (popular ou científico) para embrapa_recomendacao_id.
 * Usa apenas a tabela embrapa_recomendacoes; se não houver match, retorna o id de "Outros".
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger';

let cacheOutrosId: number | null = null;

/**
 * Retorna o id da linha "Outros" em embrapa_recomendacoes (para pragas não catalogadas).
 */
export async function getOutrosEmbrapaId(sb: SupabaseClient): Promise<number> {
  if (cacheOutrosId != null) return cacheOutrosId;
  const { data, error } = await sb
    .from('embrapa_recomendacoes')
    .select('id')
    .eq('nome_praga', 'Outros')
    .limit(1)
    .single();
  if (error || !data?.id) {
    logger.warn('embrapa_recomendacoes: linha Outros não encontrada', { error: error?.message });
    throw new Error('Referência Embrapa "Outros" não encontrada');
  }
  cacheOutrosId = data.id;
  return cacheOutrosId;
}

/**
 * Resolve nome popular e/ou científico para embrapa_recomendacao_id.
 * Tenta primeiro por nome_praga (exato, trim), depois por nome_cientifico. Se não achar, retorna id de "Outros".
 */
export async function getEmbrapaRecomendacaoId(
  sb: SupabaseClient,
  nomePraga: string,
  nomeCientifico?: string | null
): Promise<number> {
  const nome = (nomePraga ?? '').trim();
  const cient = (nomeCientifico ?? '').trim();

  if (nome) {
    const { data } = await sb
      .from('embrapa_recomendacoes')
      .select('id')
      .eq('nome_praga', nome)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  if (cient) {
    const { data } = await sb
      .from('embrapa_recomendacoes')
      .select('id')
      .eq('nome_cientifico', cient)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data.id;
  }

  return getOutrosEmbrapaId(sb);
}
