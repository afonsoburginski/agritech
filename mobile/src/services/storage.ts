import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logger } from './logger';

const StorageKeys = {
  AUTH_TOKEN: '@Auth:token',
  AUTH_USER: '@Auth:user',
  SAVED_EMAIL: '@Auth:savedEmail',
  SAVED_PASSWORD: 'Auth_savedPassword', // SecureStore não aceita @ e :
  AUTO_LOGIN_ENABLED: '@Auth:autoLoginEnabled',
  /** Cache de perfil + fazendas para uso offline (vinculado ao user id) */
  AUTH_CACHED_USER_ID: '@Auth:cachedUserId',
  AUTH_CACHED_PROFILE: '@Auth:cachedProfile',
  AUTH_CACHED_FAZENDAS: '@Auth:cachedFazendas',
  AUTH_CACHED_FAZENDA_PADRAO: '@Auth:cachedFazendaPadrao',
} as const;

export const storage = {
  // Token e usuário
  async saveToken(token: string): Promise<void> {
    if (!token || token === 'undefined' || token === 'null') {
      throw new Error('Token inválido: não é possível salvar token vazio ou undefined');
    }
    await AsyncStorage.setItem(StorageKeys.AUTH_TOKEN, token);
  },

  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);
  },

  async saveUser(user: any): Promise<void> {
    await AsyncStorage.setItem(StorageKeys.AUTH_USER, JSON.stringify(user));
  },

  async getUser(): Promise<any | null> {
    const user = await AsyncStorage.getItem(StorageKeys.AUTH_USER);
    return user ? JSON.parse(user) : null;
  },

  // Credenciais para login automático
  async saveCredentials(email: string, senha: string): Promise<void> {
    try {
      await AsyncStorage.setItem(StorageKeys.SAVED_EMAIL, email);
      await SecureStore.setItemAsync(StorageKeys.SAVED_PASSWORD, senha);
      await AsyncStorage.setItem(StorageKeys.AUTO_LOGIN_ENABLED, 'true');
    } catch (error) {
      logger.error('Erro ao salvar credenciais', { error });
      throw error;
    }
  },

  async getCredentials(): Promise<{ email: string | null; senha: string | null }> {
    try {
      const email = await AsyncStorage.getItem(StorageKeys.SAVED_EMAIL);
      const senha = await SecureStore.getItemAsync(StorageKeys.SAVED_PASSWORD);
      return {
        email: email || null,
        senha: senha || null,
      };
    } catch (error) {
      logger.error('Erro ao recuperar credenciais', { error });
      return { email: null, senha: null };
    }
  },

  async isAutoLoginEnabled(): Promise<boolean> {
    try {
      const enabled = await AsyncStorage.getItem(StorageKeys.AUTO_LOGIN_ENABLED);
      return enabled === 'true';
    } catch (error) {
      return false;
    }
  },

  async clearCredentials(): Promise<void> {
    try {
      await AsyncStorage.removeItem(StorageKeys.SAVED_EMAIL);
      await SecureStore.deleteItemAsync(StorageKeys.SAVED_PASSWORD);
      await AsyncStorage.removeItem(StorageKeys.AUTO_LOGIN_ENABLED);
    } catch (error) {
      logger.error('Erro ao limpar credenciais', { error });
    }
  },

  // Cache de perfil/fazendas para login offline
  async saveAuthCache(userId: string, profile: object, fazendas: object[], fazendaPadrao: object | null): Promise<void> {
    try {
      await AsyncStorage.setItem(StorageKeys.AUTH_CACHED_USER_ID, userId);
      await AsyncStorage.setItem(StorageKeys.AUTH_CACHED_PROFILE, JSON.stringify(profile));
      await AsyncStorage.setItem(StorageKeys.AUTH_CACHED_FAZENDAS, JSON.stringify(fazendas));
      await AsyncStorage.setItem(StorageKeys.AUTH_CACHED_FAZENDA_PADRAO, JSON.stringify(fazendaPadrao ?? null));
    } catch (error) {
      logger.error('Erro ao salvar cache de auth', { error });
    }
  },

  async getAuthCache(): Promise<{ userId: string; profile: object; fazendas: object[]; fazendaPadrao: object | null } | null> {
    try {
      const userId = await AsyncStorage.getItem(StorageKeys.AUTH_CACHED_USER_ID);
      const profileRaw = await AsyncStorage.getItem(StorageKeys.AUTH_CACHED_PROFILE);
      const fazendasRaw = await AsyncStorage.getItem(StorageKeys.AUTH_CACHED_FAZENDAS);
      const fazendaPadraoRaw = await AsyncStorage.getItem(StorageKeys.AUTH_CACHED_FAZENDA_PADRAO);
      if (!userId || !profileRaw || !fazendasRaw) return null;
      const profile = JSON.parse(profileRaw) as object;
      const fazendas = JSON.parse(fazendasRaw) as object[];
      const fazendaPadrao = fazendaPadraoRaw ? (JSON.parse(fazendaPadraoRaw) as object | null) : null;
      return { userId, profile, fazendas, fazendaPadrao };
    } catch (error) {
      logger.error('Erro ao ler cache de auth', { error });
      return null;
    }
  },

  async clearAuthCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        StorageKeys.AUTH_CACHED_USER_ID,
        StorageKeys.AUTH_CACHED_PROFILE,
        StorageKeys.AUTH_CACHED_FAZENDAS,
        StorageKeys.AUTH_CACHED_FAZENDA_PADRAO,
      ]);
    } catch (error) {
      logger.error('Erro ao limpar cache de auth', { error });
    }
  },

  // Limpar tudo (logout)
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      StorageKeys.AUTH_TOKEN,
      StorageKeys.AUTH_USER,
      StorageKeys.SAVED_EMAIL,
      StorageKeys.AUTO_LOGIN_ENABLED,
      StorageKeys.AUTH_CACHED_USER_ID,
      StorageKeys.AUTH_CACHED_PROFILE,
      StorageKeys.AUTH_CACHED_FAZENDAS,
      StorageKeys.AUTH_CACHED_FAZENDA_PADRAO,
    ]);
    try {
      await SecureStore.deleteItemAsync(StorageKeys.SAVED_PASSWORD);
    } catch {
      // Ignorar erro se não existir
    }
    await this.clearAuthCache();
  },
};
