/**
 * Embrapa AGROFIT Service
 * 
 * Acessa o catálogo da Embrapa via Edge Function 'embrapa-proxy'
 * para manter as credenciais seguras no servidor.
 */

import { logger } from './logger';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export interface EmbrapaPraga {
  id?: string;
  codPraga?: string;
  nomePraga?: string;
  nomeCientifico?: string;
  [key: string]: any;
}

export interface EmbrapaPlantaDaninha {
  id?: string;
  nomePlanta?: string;
  nomeCientifico?: string;
  [key: string]: any;
}

export interface EmbrapaCultura {
  id?: string;
  nomeCultura?: string;
  [key: string]: any;
}

export interface EmbrapaProdutoFormulado {
  id?: string;
  nomeComercial?: string;
  nomeProduto?: string;
  ingredienteAtivo?: string;
  classeUso?: string;
  classificacaoToxicologica?: string;
  titular?: string;
  [key: string]: any;
}

async function callEmbrapaProxy<T>(endpoint: string, query?: string): Promise<T[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    logger.warn('Supabase não configurado para Embrapa proxy');
    return [];
  }

  const params = new URLSearchParams({ endpoint });
  if (query) {
    params.set('q', query);
  }

  const url = `${SUPABASE_URL}/functions/v1/embrapa-proxy?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Erro no Embrapa proxy', { status: response.status, error: errorText });
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [data];
  } catch (error: any) {
    logger.error('Erro ao chamar Embrapa proxy', { error: error.message, endpoint });
    return [];
  }
}

/**
 * Busca pragas no catálogo AGROFIT
 */
export async function searchPragas(nomePraga?: string): Promise<EmbrapaPraga[]> {
  const query = nomePraga ? `nomePraga=${encodeURIComponent(nomePraga)}` : '';
  return callEmbrapaProxy<EmbrapaPraga>('/pragas', query);
}

/**
 * Busca plantas daninhas no catálogo AGROFIT
 */
export async function searchPlantasDaninhas(nome?: string): Promise<EmbrapaPlantaDaninha[]> {
  const query = nome ? `nomePlanta=${encodeURIComponent(nome)}` : '';
  return callEmbrapaProxy<EmbrapaPlantaDaninha>('/plantasDaninhas', query);
}

/**
 * Busca culturas no catálogo AGROFIT
 */
export async function searchCulturas(nome?: string): Promise<EmbrapaCultura[]> {
  const query = nome ? `nomeCultura=${encodeURIComponent(nome)}` : '';
  return callEmbrapaProxy<EmbrapaCultura>('/culturas', query);
}

/**
 * Busca produtos formulados no catálogo AGROFIT
 */
export async function searchProdutosFormulados(codPraga?: string): Promise<EmbrapaProdutoFormulado[]> {
  const query = codPraga ? `codPraga=${encodeURIComponent(codPraga)}` : '';
  return callEmbrapaProxy<EmbrapaProdutoFormulado>('/produtosFormulados', query);
}

export const embrapaService = {
  searchPragas,
  searchPlantasDaninhas,
  searchCulturas,
  searchProdutosFormulados,
};
