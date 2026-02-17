/**
 * Tipos globais compartilhados
 * Entidades do domínio da aplicação
 */

// ============================================
// USUÁRIO E AUTENTICAÇÃO
// ============================================

export interface User {
  id: number;
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
}

export interface Fazenda {
  id: number;
  nome: string;
  area?: number;
  localizacao?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  timestamp: string;
  data: {
    token: string;
    tokenType: string;
    expiresAt: string;
    expiresIn: number;
    fazendaPadrao: Fazenda;
    usuario: User;
    fazendasDisponiveis?: Fazenda[];
  };
}

// ============================================
// ATIVIDADES (TAREFAS)
// ============================================

export type AtividadeStatus = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';
export type AtividadeTipo = 'plantio' | 'colheita' | 'pulverizacao' | 'adubacao' | 'irrigacao' | 'monitoramento' | 'manutencao' | 'outros';

export interface Atividade {
  id: string;
  nome: string;
  descricao?: string;
  tipo: AtividadeTipo;
  status: AtividadeStatus;
  talhaoId?: string;
  talhaoNome?: string;
  dataInicio?: string;
  dataFim?: string;
  responsavel?: string;
  observacoes?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  deletedAt?: string;
}

export interface AtividadeInput {
  nome: string;
  descricao?: string;
  tipo: AtividadeTipo;
  talhaoId?: string;
  dataInicio?: string;
  responsavel?: string;
  observacoes?: string;
}

// ============================================
// SCOUTS (PONTOS DE MONITORAMENTO)
// ============================================

export interface Scout {
  id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  talhaoId?: string;
  talhaoNome?: string;
  visitado: boolean;
  dataVisita?: string;
  observacoes?: string;
  pragasCount: number;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  deletedAt?: string;
}

export interface ScoutInput {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  talhaoId?: string;
  observacoes?: string;
}

// ============================================
// PRAGAS (IDENTIFICAÇÕES)
// ============================================

export type PragaSeveridade = 'baixa' | 'media' | 'alta' | 'critica';

export interface Praga {
  id: string;
  scoutId: string;
  nome: string;
  nomePopular?: string;
  nomeCientifico?: string;
  quantidade?: number;
  severidade: PragaSeveridade;
  confianca?: number; // 0-1 (confiança da IA)
  imagemUri?: string;
  imagemBase64?: string;
  recomendacao?: string;
  createdAt: string;
  updatedAt: string;
  synced: boolean;
  deletedAt?: string;
}

export interface PragaInput {
  scoutId: string;
  nome: string;
  nomePopular?: string;
  nomeCientifico?: string;
  quantidade?: number;
  severidade: PragaSeveridade;
  confianca?: number;
  imagemUri?: string;
  imagemBase64?: string;
  recomendacao?: string;
}

// ============================================
// RECONHECIMENTO (IA)
// ============================================

export interface ReconhecimentoResult {
  praga: string;
  nomePopular?: string;
  nomeCientifico?: string;
  confianca: number;
  severidade: PragaSeveridade;
  recomendacao?: string;
  alternativas?: Array<{
    praga: string;
    confianca: number;
  }>;
}

// ============================================
// TALHÕES
// ============================================

export interface Talhao {
  id: string;
  nome: string;
  fazendaId: number;
  area?: number;
  cultura?: string;
  coordenadas?: Array<{ lat: number; lng: number }>;
  cor?: string;
}

// ============================================
// SINCRONIZAÇÃO
// ============================================

export type SyncOperation = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'processing' | 'success' | 'failed';
export type SyncEntityType = 'atividade' | 'scout' | 'praga';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: string; // JSON stringified
  retryCount: number;
  maxRetries: number;
  status: SyncStatus;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  nextRetryAt?: string;
}

// ============================================
// ESTATÍSTICAS E DASHBOARD
// ============================================

export interface DashboardStats {
  atividades: {
    total: number;
    pendentes: number;
    emAndamento: number;
    concluidas: number;
  };
  scouts: {
    total: number;
    visitados: number;
    pendentes: number;
  };
  pragas: {
    total: number;
    porSeveridade: {
      baixa: number;
      media: number;
      alta: number;
      critica: number;
    };
  };
  sync: {
    pendentes: number;
    falhas: number;
    ultimaSync?: string;
  };
}

// ============================================
// HEATMAP
// ============================================

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  pragaId?: string;
  scoutId?: string;
}

// ============================================
// FILTERS E SORTING
// ============================================

export interface AtividadeFilters {
  status?: AtividadeStatus;
  tipo?: AtividadeTipo;
  talhaoId?: string;
  dataInicio?: string;
  dataFim?: string;
  search?: string;
}

export interface ScoutFilters {
  visitado?: boolean;
  talhaoId?: string;
  comPragas?: boolean;
  search?: string;
}

export interface PragaFilters {
  scoutId?: string;
  severidade?: PragaSeveridade;
  search?: string;
}
