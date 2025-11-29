import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '@/services/auth-service';
import { storage } from '@/services/storage';
import { logger } from '@/services/logger';

interface User {
  id: number;
  nome: string;
  email: string;
}

interface Fazenda {
  id: number;
  nome: string;
}

interface AuthState {
  // Estado
  user: User | null;
  fazendaPadrao: Fazenda | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      user: null,
      fazendaPadrao: null,
      token: null,
      isLoading: true,
      error: null,

      // Actions
      login: async (email: string, senha: string) => {
        try {
          set({ isLoading: true, error: null });

          const response = await authService.login({ email, senha });
          const userData = await storage.getUser();

          if (!userData) {
            throw new Error('Erro ao salvar dados do usuário');
          }

          const token = response.data.token;

          set({
            user: {
              id: userData.id,
              nome: userData.nome,
              email: userData.email,
            },
            fazendaPadrao: response.data.fazendaPadrao,
            token,
            isLoading: false,
            error: null,
          });
        } catch (error: any) {
          const errorMessage = error.message || 'Erro ao fazer login';
          set({
            isLoading: false,
            error: errorMessage,
          });
          throw new Error(errorMessage);
        }
      },

      logout: async () => {
        try {
          await authService.logout();
          set({
            user: null,
            fazendaPadrao: null,
            token: null,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          logger.error('Erro ao fazer logout', { error }, error as Error);
          // Mesmo com erro, limpar estado local
          set({
            user: null,
            fazendaPadrao: null,
            token: null,
            isLoading: false,
            error: null,
          });
        }
      },

      checkAuth: async () => {
        try {
          set({ isLoading: true });

          const token = await storage.getToken();
          const userData = await storage.getUser();

          // Se há token e dados do usuário, está autenticado
          if (token && userData) {
            set({
              user: {
                id: userData.id,
                nome: userData.nome,
                email: userData.email,
              },
              fazendaPadrao: userData.fazendaPadrao || null,
              token,
              isLoading: false,
              error: null,
            });
            return;
          }

          // Tentar login automático se não estiver autenticado
          const autoLoginEnabled = await storage.isAutoLoginEnabled();
          if (autoLoginEnabled) {
            const credentials = await storage.getCredentials();
            if (credentials.email && credentials.senha) {
              try {
                const response = await authService.login({
                  email: credentials.email!,
                  senha: credentials.senha!,
                });
                const userData = await storage.getUser();

                if (!userData) {
                  throw new Error('Erro ao salvar dados do usuário');
                }

                set({
                  user: {
                    id: userData.id,
                    nome: userData.nome,
                    email: userData.email,
                  },
                  fazendaPadrao: response.data.fazendaPadrao,
                  token: response.data.token,
                  isLoading: false,
                  error: null,
                });
                return;
              } catch (error: any) {
                logger.warn('Login automático falhou', { error: error.message });
                await storage.clearCredentials();
              }
            }
          }

          // Se chegou aqui, não está autenticado
          set({
            user: null,
            fazendaPadrao: null,
            token: null,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          logger.error('Erro ao verificar autenticação', { error }, error as Error);
          set({
            isLoading: false,
            error: 'Erro ao verificar autenticação',
          });
        }
      },

      refreshToken: async () => {
        const token = await storage.getToken();
        if (token) {
          set({ token });
        } else {
          get().logout();
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        fazendaPadrao: state.fazendaPadrao,
      }),
    }
  )
);

// Selectors
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useAuthFazendaPadrao = () => useAuthStore((state) => state.fazendaPadrao);
export const useAuthIsAuthenticated = () => useAuthStore((state) => !!state.token && !!state.user);
export const useAuthIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
