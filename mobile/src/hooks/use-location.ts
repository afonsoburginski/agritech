import { useState } from 'react';
import { LocationObject, locationService } from '@/services/location-service';
import { logger } from '@/services/logger';

interface UseLocationReturn {
  loading: boolean;
  error: string | null;
  location: LocationObject | null;
  captureLocation: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook React para facilitar uso de geolocalização em componentes
 */
export function useLocation(): UseLocationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationObject | null>(null);

  const captureLocation = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      logger.debug('Iniciando captura de localização');

      const capturedLocation = await locationService.getCurrentLocation();

      setLocation(capturedLocation);
      logger.info('Localização capturada com sucesso', {
        latitude: capturedLocation.latitude,
        longitude: capturedLocation.longitude,
        accuracy: capturedLocation.accuracy,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao capturar localização';
      setError(errorMessage);
      logger.error('Erro ao capturar localização', { error: err }, err as Error);
    } finally {
      setLoading(false);
    }
  };

  const clearError = (): void => {
    setError(null);
  };

  return {
    loading,
    error,
    location,
    captureLocation,
    clearError,
  };
}

