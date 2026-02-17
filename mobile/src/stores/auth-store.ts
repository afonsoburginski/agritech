import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import { logger } from '@/services/logger';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
}

interface Fazenda {
  id: number;
  nome: string;
  role?: string;
}

interface AuthState {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  fazendaPadrao: Fazenda | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  clearError: () => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  fazendaPadrao: null,
  isLoading: true,
  error: null,

  initialize: () => {
    if (!supabase) {
      logger.warn('Supabase not configured, skipping auth initialization');
      set({ isLoading: false });
      return () => {};
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {

        if (event === 'SIGNED_OUT' || !session) {
          set({
            session: null,
            user: null,
            profile: null,
            fazendaPadrao: null,
            isLoading: false,
            error: null,
          });
          return;
        }

        set({
          session,
          user: session.user,
          isLoading: false,
        });

        // Load profile data after setting session
        if (session.user) {
          setTimeout(() => get().loadProfile(), 0);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  },

  setSession: (session: Session | null) => {
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
    });
  },

  signIn: async (email: string, password: string) => {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        let message = error.message;
        if (message === 'Invalid login credentials') {
          message = 'E-mail ou senha incorretos';
        } else if (message === 'Email not confirmed') {
          message = 'E-mail não confirmado. Verifique sua caixa de entrada.';
        }
        throw new Error(message);
      }

      // Session is handled by onAuthStateChange
      logger.info('Sign in successful', { userId: data.user?.id });
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao fazer login';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  signUp: async (email: string, password: string, nome: string) => {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
            full_name: nome,
          },
        },
      });

      if (error) {
        let message = error.message;
        if (message.includes('already registered')) {
          message = 'Este e-mail já está cadastrado';
        }
        throw new Error(message);
      }

      // If email confirmation is required, user won't have a session yet
      if (!data.session) {
        set({ isLoading: false });
      }

      logger.info('Sign up successful', { userId: data.user?.id });
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao criar conta';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  signOut: async () => {
    if (!supabase) return;

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Error signing out', { error: error.message });
      }
      // State is handled by onAuthStateChange
    } catch (error) {
      logger.error('Error signing out', { error }, error as Error);
      // Force clear local state even on error
      set({
        session: null,
        user: null,
        profile: null,
        fazendaPadrao: null,
        isLoading: false,
        error: null,
      });
    }
  },

  resetPassword: async (email: string) => {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }

    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.auth.resetPasswordForEmail(email);

      if (error) {
        throw new Error(error.message);
      }

      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao enviar e-mail de recuperação';
      set({ isLoading: false, error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  loadProfile: async () => {
    if (!supabase) return;

    const { user } = get();
    if (!user) return;

    try {
      // Load profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nome, email, telefone, cpf')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.warn('Error loading profile', { error: profileError.message });
      }

      // Load user's fazendas (get first one as default)
      const { data: userFazendas, error: fazendaError } = await supabase
        .from('user_fazendas')
        .select('fazenda_id, role, fazendas(id, nome)')
        .eq('user_id', user.id)
        .limit(1);

      if (fazendaError) {
        logger.warn('Error loading fazendas', { error: fazendaError.message });
      }

      const fazenda = userFazendas?.[0]
        ? {
            id: (userFazendas[0].fazendas as any)?.id,
            nome: (userFazendas[0].fazendas as any)?.nome,
            role: userFazendas[0].role,
          }
        : null;

      set({
        profile: profile
          ? {
              id: profile.id,
              nome: profile.nome,
              email: profile.email,
              telefone: profile.telefone,
              cpf: profile.cpf,
            }
          : null,
        fazendaPadrao: fazenda,
      });
    } catch (error) {
      logger.error('Error loading profile data', { error }, error as Error);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Selectors
export const useAuthUser = () =>
  useAuthStore((state) => {
    if (state.profile) {
      return {
        id: state.profile.id,
        nome: state.profile.nome,
        email: state.profile.email,
      };
    }
    if (state.user) {
      return {
        id: state.user.id,
        nome: state.user.user_metadata?.nome || state.user.user_metadata?.full_name || state.user.email?.split('@')[0] || '',
        email: state.user.email || '',
      };
    }
    return null;
  });
export const useAuthFazendaPadrao = () => useAuthStore((state) => state.fazendaPadrao);
export const useAuthIsAuthenticated = () => useAuthStore((state) => !!state.session);
export const useAuthIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthSession = () => useAuthStore((state) => state.session);
