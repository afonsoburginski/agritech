import * as Device from 'expo-device';
import { Platform } from 'react-native';

export const getDeviceId = async (): Promise<string> => {
  try {
    // Usando Expo Device para obter um ID único
    if (Device.osName) {
      return `${Platform.OS}_${Device.modelName || 'unknown'}_${Date.now()}`;
    }
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  } catch (error) {
    // Fallback para um ID único baseado em timestamp
    return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

export const getPlatform = (): 'ios' | 'android' => {
  return Platform.OS === 'ios' ? 'ios' : 'android';
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
