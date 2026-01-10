import { useState } from 'react';
import { StyleSheet, TouchableOpacity, Dimensions, Alert, Image as RNImage, ActivityIndicator } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { BottomSheet, useBottomSheet } from '@/components/ui/bottom-sheet-simple';
import { useCamera } from '@/hooks/use-camera';
import { useReconhecimento } from '@/hooks/use-pragas';
import { useScouts } from '@/hooks/use-scouts';
import { useLocation } from '@/hooks/use-location';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { 
  Camera, 
  Image as ImageIcon,
  Zap,
  Target,
  Scan,
  Info,
  CheckCircle2,
  X
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function ReconhecimentoScreen() {
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');
  const borderColor = useColor({}, 'border');
  
  // Hooks
  const { takePhoto, pickFromGallery, isCapturing } = useCamera();
  const { recognize, result, saveResult, isRecognizing, clear, imageUri } = useReconhecimento();
  const { create: createScout } = useScouts();
  const { location, captureLocation } = useLocation();
  const { isVisible, open, close } = useBottomSheet();
  const [isSaving, setIsSaving] = useState(false);

  // Handlers
  const handleTakePhoto = async () => {
    try {
      const photo = await takePhoto();
      if (!photo) return;

      // Capturar localização
      await captureLocation();

      // Reconhecer
      await recognize(photo.uri);
      open();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao capturar foto');
    }
  };

  const handleSelectImage = async () => {
    try {
      const image = await pickFromGallery();
      if (!image) return;

      await captureLocation();
      await recognize(image.uri);
      open();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao selecionar imagem');
    }
  };

  const handleConfirm = async () => {
    if (!result || !location) {
      Alert.alert('Erro', 'Dados incompletos');
      return;
    }

    try {
      setIsSaving(true);
      
      // Criar scout com localização atual
      const scout = await createScout({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });

      // Salvar praga vinculada ao scout
      await saveResult(scout.id);
      
      close();
      clear();
      Alert.alert('Sucesso', `Praga "${result.praga}" identificada e salva!`);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao salvar reconhecimento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    close();
    clear();
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: textColor }]}>Scanner</Text>
          <Text style={[styles.headerSubtitle, { color: mutedColor }]}>
            Identifique pragas com IA
          </Text>
        </View>
        <TouchableOpacity 
          style={[styles.infoButton, { borderColor }]}
          activeOpacity={0.7}
        >
          <Icon name={Info} size={20} color={mutedColor} />
        </TouchableOpacity>
      </View>

      {/* Main Scanner Area */}
      <View style={styles.scannerSection}>
        <View style={[styles.scannerFrame, { borderColor: primaryColor }]}>
          <View style={[styles.scannerInner, { backgroundColor: cardColor }]}>
            {isRecognizing ? (
              <>
                <ActivityIndicator size="large" color={primaryColor} />
                <Text style={[styles.scannerTitle, { color: textColor, marginTop: 20 }]}>
                  Analisando...
                </Text>
                <Text style={[styles.scannerDescription, { color: mutedColor }]}>
                  Identificando praga na imagem
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.scannerIcon, { backgroundColor: primaryColor + '15' }]}>
                  <Icon name={Scan} size={48} color={primaryColor} />
                </View>
                <Text style={[styles.scannerTitle, { color: textColor }]}>
                  Aponte para a praga
                </Text>
                <Text style={[styles.scannerDescription, { color: mutedColor }]}>
                  Posicione a câmera sobre a praga ou folha afetada para identificação automática
                </Text>
              </>
            )}
          </View>
          
          {/* Corner decorations */}
          <View style={[styles.corner, styles.cornerTL, { borderColor: primaryColor }]} />
          <View style={[styles.corner, styles.cornerTR, { borderColor: primaryColor }]} />
          <View style={[styles.corner, styles.cornerBL, { borderColor: primaryColor }]} />
          <View style={[styles.corner, styles.cornerBR, { borderColor: primaryColor }]} />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsSection}>
        <TouchableOpacity 
          style={[styles.mainButton, { backgroundColor: primaryColor }]}
          onPress={handleTakePhoto}
          activeOpacity={0.8}
          disabled={isCapturing || isRecognizing}
        >
          {isCapturing ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Icon name={Camera} size={28} color="#FFF" />
          )}
        </TouchableOpacity>

        <View style={styles.secondaryActions}>
          <TouchableOpacity 
            style={[styles.secondaryButton, { backgroundColor: cardColor }]}
            onPress={handleSelectImage}
            activeOpacity={0.7}
            disabled={isCapturing || isRecognizing}
          >
            <Icon name={ImageIcon} size={22} color={textColor} />
            <Text style={[styles.secondaryButtonText, { color: textColor }]}>
              Galeria
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Features */}
      <View style={styles.featuresSection}>
        <View style={[styles.featureCard, { backgroundColor: cardColor }]}>
          <View style={[styles.featureIcon, { backgroundColor: palette.gold + '20' }]}>
            <Icon name={Zap} size={18} color={palette.gold} />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: textColor }]}>Identificação Rápida</Text>
            <Text style={[styles.featureDescription, { color: mutedColor }]}>Resultado em segundos</Text>
          </View>
        </View>

        <View style={[styles.featureCard, { backgroundColor: cardColor }]}>
          <View style={[styles.featureIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Icon name={Target} size={18} color="#10B981" />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: textColor }]}>Alta Precisão</Text>
            <Text style={[styles.featureDescription, { color: mutedColor }]}>IA treinada com +1000 pragas</Text>
          </View>
        </View>
      </View>

      {/* Modal de Resultado */}
      <BottomSheet
        isVisible={isVisible}
        onClose={handleCancel}
        title="Resultado do Reconhecimento"
      >
        {result && (
          <View style={styles.resultContainer}>
            {imageUri && (
              <RNImage source={{ uri: imageUri }} style={styles.resultImage} resizeMode="cover" />
            )}

            <View style={[styles.resultCard, { backgroundColor: cardColor }]}>
              <View style={styles.resultHeader}>
                <View style={styles.resultMain}>
                  <Text style={[styles.resultPraga, { color: textColor }]}>{result.praga}</Text>
                  {result.nomePopular && (
                    <Text style={[styles.resultPopular, { color: mutedColor }]}>
                      {result.nomePopular}
                    </Text>
                  )}
                  {result.nomeCientifico && (
                    <Text style={[styles.resultCientifico, { color: mutedColor }]}>
                      <Text style={{ fontStyle: 'italic' }}>{result.nomeCientifico}</Text>
                    </Text>
                  )}
                </View>
                <View style={[styles.confiancaBadge, { backgroundColor: palette.gold + '20' }]}>
                  <Text style={[styles.confiancaText, { color: palette.gold }]}>
                    {Math.round(result.confianca * 100)}%
                  </Text>
                </View>
              </View>

              <View style={[styles.severidadeBadge, { 
                backgroundColor: result.severidade === 'alta' ? '#EF4444' + '20' : 
                                 result.severidade === 'media' ? '#F59E0B' + '20' : '#10B981' + '20'
              }]}>
                <Text style={[styles.severidadeText, {
                  color: result.severidade === 'alta' ? '#EF4444' : 
                         result.severidade === 'media' ? '#F59E0B' : '#10B981'
                }]}>
                  Severidade: {result.severidade.toUpperCase()}
                </Text>
              </View>

              {result.recomendacao && (
                <View style={styles.recomendacaoContainer}>
                  <Text style={[styles.recomendacaoLabel, { color: textColor }]}>Recomendação:</Text>
                  <Text style={[styles.recomendacaoText, { color: mutedColor }]}>
                    {result.recomendacao}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.resultActions}>
              <Button
                variant="outline"
                onPress={handleCancel}
                style={styles.cancelButton}
              >
                <Icon name={X} size={18} color={textColor} />
                <Text style={{ marginLeft: 6 }}>Cancelar</Text>
              </Button>
              <Button
                variant="default"
                onPress={handleConfirm}
                style={styles.confirmButton}
                disabled={isSaving || !location}
              >
                <Icon name={CheckCircle2} size={18} color="#FFF" />
                <Text style={{ color: '#FFF', marginLeft: 6 }}>
                  {isSaving ? 'Salvando...' : 'Confirmar'}
                </Text>
              </Button>
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  infoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scannerSection: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: width - 64,
    aspectRatio: 1,
    maxHeight: 320,
    position: 'relative',
    padding: 3,
  },
  scannerInner: {
    flex: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  scannerIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  scannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  scannerDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  actionsSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  mainButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 16,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  featuresSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    paddingBottom: 24,
  },
  featureCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 11,
    marginTop: 2,
  },
  resultContainer: {
    gap: 16,
  },
  resultImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  resultCard: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resultMain: {
    flex: 1,
    gap: 4,
  },
  resultPraga: {
    fontSize: 20,
    fontWeight: '700',
  },
  resultPopular: {
    fontSize: 14,
  },
  resultCientifico: {
    fontSize: 12,
  },
  confiancaBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  confiancaText: {
    fontSize: 14,
    fontWeight: '700',
  },
  severidadeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  severidadeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recomendacaoContainer: {
    marginTop: 8,
    gap: 6,
  },
  recomendacaoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  recomendacaoText: {
    fontSize: 13,
    lineHeight: 18,
  },
  resultActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
