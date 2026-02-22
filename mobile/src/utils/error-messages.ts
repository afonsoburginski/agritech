/**
 * Mensagens de erro em português (BR) para o usuário.
 * Converte erros técnicos em inglês em mensagens amigáveis e evita crashes ao usar offline.
 */

const MAP: Record<string, string> = {
  // Rede / offline
  'Network request failed': 'Sem conexão. Verifique sua internet e tente novamente.',
  'Failed to fetch': 'Sem conexão. Verifique sua internet e tente novamente.',
  'Network Error': 'Sem conexão. Verifique sua internet e tente novamente.',
  'Load failed': 'Falha ao carregar. Verifique sua conexão.',
  'The Internet connection appears to be offline': 'Você está offline. Conecte-se à internet para continuar.',
  'offline': 'Você está offline. Algumas funções estarão disponíveis ao conectar.',
  // Timeout
  'AbortError': 'Tempo esgotado. Tente novamente.',
  'timeout': 'Tempo esgotado. Tente novamente.',
  'Timeout': 'Tempo esgotado. Tente novamente.',
  // Auth (Supabase)
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'E-mail não confirmado. Verifique sua caixa de entrada.',
  'User already registered': 'Este e-mail já está cadastrado.',
  'already registered': 'Este e-mail já está cadastrado.',
  'Invalid email or password': 'E-mail ou senha incorretos.',
  'Token has expired': 'Sessão expirada. Faça login novamente.',
  // Permissões
  'Permission denied': 'Permissão negada. Ative nas configurações do app.',
  'Location permission denied': 'Permissão de localização negada. Ative nas configurações.',
  'Camera permission denied': 'Permissão de câmera negada. Ative nas configurações.',
  // Supabase / API genérico
  'Supabase not configured': 'Serviço não configurado. Tente mais tarde.',
  'JWT expired': 'Sessão expirada. Faça login novamente.',
  'PGRST301': 'Dados não encontrados.',
  'new row violates row-level security': 'Você não tem permissão para esta ação.',
  // Arquivo / armazenamento
  'Directory of cache not available': 'Armazenamento temporário indisponível. Tente novamente.',
  'Database not available': 'Dados locais temporariamente indisponíveis. Tente novamente.',
};

/**
 * Retorna uma mensagem em português (BR) adequada para exibir ao usuário.
 * @param error - Erro (Error, string ou unknown)
 * @param fallback - Mensagem padrão se não houver mapeamento
 */
export function getUserFacingError(error: unknown, fallback: string): string {
  if (error == null) return fallback;
  const msg =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : (error as { message?: string })?.message;
  if (!msg || typeof msg !== 'string') return fallback;

  const lower = msg.toLowerCase();
  for (const [key, pt] of Object.entries(MAP)) {
    if (lower.includes(key.toLowerCase())) return pt;
  }
  // Se a mensagem já parecer em português (caracteres comuns), usar como está (limitado)
  if (/[\u00C0-\u024F\u1E00-\u1EFF]/.test(msg) || msg.includes('ão') || msg.includes('ê') || msg.includes('ú')) {
    return msg.length <= 120 ? msg : fallback;
  }
  return fallback;
}

/** Mensagens padrão em PT-BR para uso em Alert e setError */
export const ERROR_MESSAGES = {
  GENERIC: 'Algo deu errado. Tente novamente.',
  OFFLINE: 'Você está offline. Conecte-se à internet para continuar.',
  OFFLINE_SAVED: 'Sem conexão. Os dados foram salvos e serão sincronizados quando você estiver online.',
  LOAD_FAILED: 'Não foi possível carregar. Tente novamente.',
  SAVE_FAILED: 'Não foi possível salvar. Tente novamente.',
  NETWORK: 'Verifique sua conexão com a internet e tente novamente.',
  SESSION_EXPIRED: 'Sessão expirada. Faça login novamente.',
  PERMISSION_DENIED: 'Permissão negada. Ative nas configurações do app.',
  TIMEOUT: 'Tempo esgotado. Tente novamente.',
  NOT_CONFIGURED: 'Serviço não configurado.',
} as const;
