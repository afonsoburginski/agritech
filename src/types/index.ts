/**
 * Tipos globais compartilhados
 * Apenas tipos super recorrentes que são usados em múltiplas features
 */

// User e Autenticação (usado em várias features)
export interface User {
  id: number;
  nome: string;
  email: string;
}

export interface Fazenda {
  id: number;
  nome: string;
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
    usuario: {
      id: number;
      nome: string;
      email: string;
      cpf?: string;
      telefone?: string;
    };
    fazendasDisponiveis?: any[];
  };
}
