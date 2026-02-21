import { create } from 'zustand';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/services/supabase';
import { logger } from '@/services/logger';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { useAppStore } from '@/stores/app-store';

/** Converte base64 em ArrayBuffer para upload no Storage. */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

interface Profile {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  cpf?: string | null;
  avatar_url?: string | null;
}

/** Papel do usuário na fazenda: owner = dono (pode convidar técnicos), technician = técnico com acesso */
export type FazendaRole = 'owner' | 'technician';

interface Fazenda {
  id: number;
  nome: string;
  role?: FazendaRole | string;
}

interface AuthState {
  session: Session | null;
  user: SupabaseUser | null;
  profile: Profile | null;
  fazendaPadrao: Fazenda | null;
  /** True quando o usuário tem mais de uma fazenda e ainda não escolheu qual usar (mostrar seletor). */
  pendingFazendaChoice: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  initialize: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, nome: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  loadProfile: () => Promise<void>;
  /** Faz upload da foto de perfil (URI local), atualiza profiles.avatar_url e estado. */
  uploadAvatar: (localUri: string) => Promise<string>;
  /** Lista todas as fazendas do usuário (para trocar fazenda padrão). */
  loadFazendas: () => Promise<Fazenda[]>;
  /** Define a fazenda padrão (por id). Persiste no estado e usa nas próximas operações. */
  setFazendaPadrao: (fazenda: Fazenda | null) => void;
  /** Marca que o usuário já escolheu a fazenda (esconde o seletor pendente). */
  clearPendingFazendaChoice: () => void;
  clearError: () => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  fazendaPadrao: null,
  pendingFazendaChoice: false,
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
          useAppStore.getState().setAvatar(null);
          set({
            session: null,
            user: null,
            profile: null,
            fazendaPadrao: null,
            pendingFazendaChoice: false,
            isLoading: false,
            error: null,
          });
          return;
        }

        set({
          session,
          user: session.user,
        });

        if (session.user) {
          try {
            await get().loadProfile();
          } catch (e) {
            logger.warn('Erro ao carregar perfil no initialize', { error: e });
          }
        }
        set({ isLoading: false });
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

      // Atualiza estado imediatamente para o layout redirecionar (não depender só do onAuthStateChange)
      set({
        session: data.session,
        user: data.user ?? null,
        isLoading: false,
      });
      logger.info('Sign in successful', { userId: data.user?.id });

      // Carrega perfil e fazendas para definir pendingFazendaChoice antes do redirecionamento
      await get().loadProfile();
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
        .select('id, nome, email, telefone, cpf, avatar_url')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.warn('Error loading profile', { error: profileError.message });
      }

      // Load user's fazendas (todas; primeira como padrão se ainda não tiver uma definida)
      const { data: userFazendas, error: fazendaError } = await supabase
        .from('user_fazendas')
        .select('fazenda_id, role, fazendas(id, nome)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (fazendaError) {
        logger.warn('Error loading fazendas', { error: fazendaError.message });
      }

      const list: Fazenda[] = (userFazendas ?? []).map((uf) => ({
        id: (uf.fazendas as { id: number; nome: string })?.id,
        nome: (uf.fazendas as { id: number; nome: string })?.nome ?? '',
        role: (uf.role === 'owner' || uf.role === 'technician' ? uf.role : uf.role) as FazendaRole | string,
      })).filter((f) => f.id != null);

      const currentPadrao = get().fazendaPadrao;
      const fazenda = list.length > 0
        ? (currentPadrao != null && list.some((f) => f.id === currentPadrao.id)
          ? currentPadrao
          : { id: list[0].id, nome: list[0].nome, role: list[0].role })
        : null;
      const hasMultipleFazendas = list.length > 1;

      const profileData = profile
        ? {
            id: profile.id,
            nome: profile.nome,
            email: profile.email,
            telefone: profile.telefone,
            cpf: profile.cpf,
            avatar_url: (profile as { avatar_url?: string | null }).avatar_url ?? null,
          }
        : null;

      set({
        profile: profileData,
        fazendaPadrao: fazenda,
        pendingFazendaChoice: hasMultipleFazendas,
      });

      // Sincronizar avatar no app-store (profile primeiro, depois auth user_metadata)
      const avatarFromAuth = user?.user_metadata?.avatar_url;
      const effectiveAvatar =
        profileData?.avatar_url ??
        (avatarFromAuth && typeof avatarFromAuth === 'string' && avatarFromAuth.length > 0 ? avatarFromAuth : null);
      useAppStore.getState().setAvatar(effectiveAvatar);
    } catch (error) {
      logger.error('Error loading profile data', { error }, error as Error);
    }
  },

  loadFazendas: async () => {
    if (!supabase) return [];
    const { user } = get();
    if (!user) return [];
    const { data } = await supabase
      .from('user_fazendas')
      .select('fazenda_id, role, fazendas(id, nome)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    return (data ?? []).map((uf) => ({
      id: (uf.fazendas as { id: number; nome: string })?.id,
      nome: (uf.fazendas as { id: number; nome: string })?.nome ?? '',
      role: uf.role as FazendaRole | string,
    })).filter((f) => f.id != null);
  },

  uploadAvatar: async (localUri) => {
    if (!supabase) throw new Error('Supabase não configurado');
    const { user } = get();
    if (!user) throw new Error('Usuário não autenticado');

    const path = `${user.id}/avatar`;
    // Em React Native fetch(uri) com file:// retorna corpo vazio; usar expo-file-system para ler os bytes
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: 'base64',
    });
    if (!base64 || base64.length === 0) {
      throw new Error('Não foi possível ler a imagem. Tente outra foto.');
    }
    const arrayBuffer = base64ToArrayBuffer(base64);
    const contentType = 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (uploadError) {
      logger.error('Erro ao fazer upload do avatar', { error: uploadError.message });
      throw new Error(uploadError.message || 'Falha ao enviar foto');
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Atualiza profiles (trigger sincroniza automaticamente com auth.users)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Erro ao atualizar avatar no perfil', { error: updateError.message });
      throw new Error(updateError.message || 'Falha ao atualizar perfil');
    }

    // Sincroniza diretamente com auth metadata (redundância de segurança)
    await supabase.auth.updateUser({
      data: { avatar_url: urlData.publicUrl },
    });

    const prev = get().profile;
    set({ profile: prev ? { ...prev, avatar_url: urlData.publicUrl } : null });
    useAppStore.getState().setAvatar(avatarUrl);
    return avatarUrl;
  },

  setFazendaPadrao: (fazenda) => {
    set({ fazendaPadrao: fazenda });
  },

  clearPendingFazendaChoice: () => {
    set({ pendingFazendaChoice: false });
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
/** Avatar: prioriza profile.avatar_url, depois auth user_metadata.avatar_url, depois cache do app-store. */
export const useEffectiveAvatarUri = () => {
  const profileUrl = useAuthStore((s) => s.profile?.avatar_url);
  const authAvatarUrl = useAuthStore((s) => {
    const url = s.user?.user_metadata?.avatar_url;
    return url && typeof url === 'string' && url.length > 0 ? url : null;
  });
  const appUrl = useAppStore((s) => s.avatarUri);
  return profileUrl ?? authAvatarUrl ?? appUrl ?? null;
};
export const usePendingFazendaChoice = () => useAuthStore((state) => state.pendingFazendaChoice);
export const useAuthIsAuthenticated = () => useAuthStore((state) => !!state.session);
export const useAuthIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);
export const useAuthSession = () => useAuthStore((state) => state.session);
