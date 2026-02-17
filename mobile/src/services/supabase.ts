/**
 * Cliente Supabase
 * Configurado para funcionar com React Native e AsyncStorage
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';
import type { Database } from '@/types/supabase';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  logger.warn('Supabase não configurado - variáveis de ambiente ausentes', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
  });
}

// Criar cliente Supabase tipado apenas se as variáveis estiverem configuradas
export const supabase = supabaseUrl && supabaseKey
  ? createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Verifica se o Supabase está disponível e configurado
 */
export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

/**
 * Verifica se a conexão com Supabase está funcionando
 */
export async function testSupabaseConnection(): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    // Tenta uma query simples para verificar conexão
    const { error } = await supabase.from('_health_check').select('count').limit(1).maybeSingle();
    
    // Se der erro de tabela não existir, a conexão está OK
    if (error?.code === '42P01') {
      return true;
    }
    
    return !error;
  } catch (error) {
    logger.warn('Erro ao testar conexão Supabase', { error });
    return false;
  }
}

export default supabase;
