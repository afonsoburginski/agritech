import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const StorageKeys = {
  AUTH_TOKEN: '@Auth:token',
  AUTH_USER: '@Auth:user',
  SAVED_EMAIL: '@Auth:savedEmail',
  SAVED_PASSWORD: 'Auth_savedPassword', // SecureStore não aceita @ e :
  AUTO_LOGIN_ENABLED: '@Auth:autoLoginEnabled',
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
      console.error('Erro ao salvar credenciais:', error);
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
      console.error('Erro ao recuperar credenciais:', error);
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
      console.error('Erro ao limpar credenciais:', error);
    }
  },

  // Limpar tudo (logout)
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove([
      StorageKeys.AUTH_TOKEN,
      StorageKeys.AUTH_USER,
      StorageKeys.SAVED_EMAIL,
      StorageKeys.AUTO_LOGIN_ENABLED,
    ]);
    // Limpar senha do SecureStore
    try {
      await SecureStore.deleteItemAsync(StorageKeys.SAVED_PASSWORD);
    } catch (error) {
      // Ignorar erro se não existir
    }
  },
};
