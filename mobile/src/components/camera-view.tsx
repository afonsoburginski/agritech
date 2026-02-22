import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { X, RotateCcw, Zap, ZapOff, RefreshCw } from 'lucide-react-native';

interface CameraScreenProps {
  onCapture: (uri: string) => void;
  onClose: () => void;
}

type CameraFacing = 'back' | 'front';

export function CameraScreen({ onCapture, onClose }: CameraScreenProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isTaking, setIsTaking] = useState(false);
  const insets = useSafeAreaInsets();

  const handleTakePicture = useCallback(async () => {
    if (!cameraRef.current || isTaking) return;
    setIsTaking(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: Platform.OS === 'android',
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch {
      // Silently fail - user can retry
    } finally {
      setIsTaking(false);
    }
  }, [isTaking]);

  const handleRetake = useCallback(() => {
    setCapturedUri(null);
  }, []);

  const handleUsePhoto = useCallback(() => {
    if (capturedUri) {
      onCapture(capturedUri);
    }
  }, [capturedUri, onCapture]);

  const toggleFlash = useCallback(() => {
    setFlash((f) => (f === 'off' ? 'on' : 'off'));
  }, []);

  const toggleFacing = useCallback(() => {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  }, []);

  if (!permission) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.permissionBox}>
          <Text style={styles.permissionTitle}>Permissão necessária</Text>
          <Text style={styles.permissionText}>
            Precisamos de acesso à câmera para identificar pragas.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Permitir câmera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permissionCancelButton} onPress={onClose}>
            <Text style={styles.permissionCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (capturedUri) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Image source={{ uri: capturedUri }} style={styles.preview} resizeMode="contain" />

        <TouchableOpacity
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Icon name={X} size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={[styles.confirmBar, { paddingBottom: insets.bottom + 20 }]}>
          <TouchableOpacity style={styles.retakeButton} onPress={handleRetake} activeOpacity={0.7}>
            <Icon name={RefreshCw} size={22} color="#FFF" />
            <Text style={styles.retakeText}>Tirar outra</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.usePhotoButton} onPress={handleUsePhoto} activeOpacity={0.8}>
            <Text style={styles.usePhotoText}>Usar foto</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        flash={flash}
        mode="picture"
        animateShutter
      />

      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 12 }]}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Icon name={X} size={24} color="#FFF" />
      </TouchableOpacity>

      <View style={[styles.topControls, { top: insets.top + 12 }]}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash} activeOpacity={0.7}>
          <Icon name={flash === 'on' ? Zap : ZapOff} size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity style={styles.flipButton} onPress={toggleFacing} activeOpacity={0.7}>
          <Icon name={RotateCcw} size={24} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.shutterOuter}
          onPress={handleTakePicture}
          activeOpacity={0.7}
          disabled={isTaking}
        >
          {isTaking ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </TouchableOpacity>

        <View style={styles.flipButton} />
      </View>

      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>Posicione a câmera sobre a praga</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  preview: {
    ...StyleSheet.absoluteFillObject,
  },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  topControls: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    gap: 12,
    zIndex: 10,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 24,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  flipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retakeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  usePhotoButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: '#22C55E',
  },
  usePhotoText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionBox: {
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 16,
  },
  permissionTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
  },
  permissionText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  permissionCancelButton: {
    paddingVertical: 10,
  },
  permissionCancelText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
  },
});
