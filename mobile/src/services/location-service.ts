import * as Location from 'expo-location';
import { logger } from './logger';

export interface LocationObject {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
}

class LocationService {
  /**
   * Solicita permissão de localização
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      logger.error('Erro ao solicitar permissão de localização', { error }, error as Error);
      return false;
    }
  }

  /**
   * Obtém a localização atual do dispositivo
   */
  async getCurrentLocation(): Promise<LocationObject> {
    try {
      // Verificar permissão
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Permissão de localização negada');
      }

      // Obter localização
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
        altitude: location.coords.altitude || undefined,
        heading: location.coords.heading || undefined,
        speed: location.coords.speed || undefined,
      };
    } catch (error: any) {
      logger.error('Erro ao obter localização', { error: error.message }, error);
      throw new Error(error.message || 'Erro ao obter localização');
    }
  }

  /**
   * Verifica se a permissão já foi concedida
   */
  async checkPermission(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      logger.error('Erro ao verificar permissão', { error }, error as Error);
      return false;
    }
  }
}

export const locationService = new LocationService();
