import { api } from './api';
import { storage } from './storage';
import { LoginResponse } from '../types';
import { getDeviceId, getPlatform } from '../utils/helpers';

export interface LoginCredentials {
  email: string;
  senha: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const deviceId = await getDeviceId();
      const platform = getPlatform();

      console.log('Tentando login:', { email: credentials.email, deviceId, platform });

      const response = await api.post<LoginResponse>('/mobile/auth/login', {
        ...credentials,
        deviceId,
        platform,
      });

      console.log('Login bem-sucedido:', response.data);

      // A API retorna { success, message, data: { token, fazendaPadrao, usuario, ... } }
      const loginData = response.data;
      
      if (!loginData.data || !loginData.data.token) {
        throw new Error('Resposta da API inválida: token não encontrado');
      }

      // Salvar token e dados do usuário
      await storage.saveToken(loginData.data.token);
      
      const userDataToSave = {
        id: loginData.data.usuario.id,
        nome: loginData.data.usuario.nome,
        email: loginData.data.usuario.email,
        fazendaPadrao: loginData.data.fazendaPadrao,
      };
      
      console.log('Salvando dados do usuário:', userDataToSave);
      await storage.saveUser(userDataToSave);

      // Verificar se foi salvo corretamente
      const savedUser = await storage.getUser();
      console.log('Dados do usuário salvos verificados:', savedUser);

      // Salvar credenciais para login automático
      await storage.saveCredentials(credentials.email, credentials.senha);
      console.log('Credenciais salvas para login automático');

      return loginData;
    } catch (error: any) {
      console.error('Erro detalhado no login:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
        config: error.config?.url,
      });
      
      const errorMessage = 
        error.response?.data?.message ||
        error.message ||
        'Erro ao fazer login. Verifique sua conexão e tente novamente.';
      
      throw new Error(errorMessage);
    }
  },

  async logout(): Promise<void> {
    // Opcionalmente manter credenciais salvas para login automático
    // Se quiser remover também, descomente a linha abaixo
    // await storage.clearCredentials();
    await storage.clearAll();
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await storage.getToken();
    return !!token;
  },
};
