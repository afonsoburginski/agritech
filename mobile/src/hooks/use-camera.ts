/**
 * Hook de Câmera para Scanner
 * Gerencia permissões, captura de foto e seleção de galeria
 */

import { useState, useCallback, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { logger } from '@/services/logger';

export interface CameraResult {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

/**
 * Hook para captura de imagem (câmera ou galeria)
 */
export function useCamera() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // ========================================
  // VERIFICAR PERMISSÕES
  // ========================================
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();
        const { status: galleryStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
        
        // Considera com permissão se pelo menos galeria estiver disponível
        setHasPermission(cameraStatus === 'granted' || galleryStatus === 'granted');
      } catch (err) {
        logger.error('Erro ao verificar permissões', { error: err });
        setHasPermission(false);
      }
    };

    checkPermissions();
  }, []);

  // ========================================
  // SOLICITAR PERMISSÃO DE CÂMERA
  // ========================================
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setHasPermission(granted);
      return granted;
    } catch (err) {
      logger.error('Erro ao solicitar permissão de câmera', { error: err });
      return false;
    }
  }, []);

  // ========================================
  // TIRAR FOTO
  // ========================================
  const takePhoto = useCallback(async (): Promise<CameraResult | null> => {
    try {
      // Verificar/solicitar permissão
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('Permissão de câmera negada');
        return null;
      }

      setIsCapturing(true);

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      setIsCapturing(false);

      if (result.canceled || !result.assets?.[0]) {
        logger.info('Captura de foto cancelada');
        return null;
      }

      const asset = result.assets[0];
      logger.info('Foto capturada', { 
        uri: asset.uri, 
        width: asset.width, 
        height: asset.height 
      });

      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      };
    } catch (err: any) {
      logger.error('Erro ao capturar foto', { error: err.message });
      setIsCapturing(false);
      throw new Error('Erro ao capturar foto');
    }
  }, []);

  // ========================================
  // SELECIONAR DA GALERIA
  // ========================================
  const pickFromGallery = useCallback(async (): Promise<CameraResult | null> => {
    try {
      // Verificar/solicitar permissão
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        logger.warn('Permissão de galeria negada');
        return null;
      }

      setIsCapturing(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      setIsCapturing(false);

      if (result.canceled || !result.assets?.[0]) {
        logger.info('Seleção de imagem cancelada');
        return null;
      }

      const asset = result.assets[0];
      logger.info('Imagem selecionada da galeria', { 
        uri: asset.uri, 
        width: asset.width, 
        height: asset.height 
      });

      return {
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
      };
    } catch (err: any) {
      logger.error('Erro ao selecionar imagem', { error: err.message });
      setIsCapturing(false);
      throw new Error('Erro ao selecionar imagem');
    }
  }, []);

  return {
    hasPermission,
    isCapturing,
    requestCameraPermission,
    takePhoto,
    pickFromGallery,
  };
}
