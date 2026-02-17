/**
 * Auth Service
 * Thin wrapper around Supabase Auth for the mobile app.
 * All auth state is managed by the auth-store via onAuthStateChange.
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface LoginCredentials {
  email: string;
  senha: string;
}

export interface SignUpData {
  email: string;
  senha: string;
  nome: string;
}

export const authService = {
  async login(credentials: LoginCredentials) {
    if (!supabase) throw new Error('Supabase não configurado');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.senha,
    });

    if (error) throw error;
    return data;
  },

  async signUp(data: SignUpData) {
    if (!supabase) throw new Error('Supabase não configurado');

    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.senha,
      options: {
        data: {
          nome: data.nome,
          full_name: data.nome,
        },
      },
    });

    if (error) throw error;
    return result;
  },

  async logout() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error('Logout error', { error: error.message });
      throw error;
    }
  },

  async resetPassword(email: string) {
    if (!supabase) throw new Error('Supabase não configurado');

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async getSession() {
    if (!supabase) return null;

    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  async getUser() {
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session;
  },

  async updatePassword(newPassword: string) {
    if (!supabase) throw new Error('Supabase não configurado');

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  },

  async updateProfile(updates: { nome?: string; email?: string }) {
    if (!supabase) throw new Error('Supabase não configurado');

    const { error } = await supabase.auth.updateUser({
      data: updates,
    });

    if (error) throw error;
  },
};
