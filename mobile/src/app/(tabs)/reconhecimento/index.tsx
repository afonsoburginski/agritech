import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { useCamera } from '@/hooks/use-camera';
import { useReconhecimento, type ReconhecimentoResult } from '@/hooks/use-pragas';
import { useLocation } from '@/hooks/use-location';
import type { LocationObject } from '@/services/location-service';
import { useSupabasePlots } from '@/hooks/use-supabase-data';
import { useColor } from '@/hooks/useColor';
import { useAppStore, usePendingRecognitionCount, useLastProcessedRecognitionCount } from '@/stores/app-store';
import { useAuthFazendaPadrao, useAuthStore } from '@/stores/auth-store';
import { useReconhecimentoResultStore, type DetectedPestEntry } from '@/stores/reconhecimento-result-store';
import {
  refreshPendingRecognitionCount,
  getPendingRecognitionsList,
  processSingleRecognition,
  addToRecognitionQueue,
  type PendingRecognitionItem,
} from '@/services/recognition-queue-service';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { logger } from '@/services/logger';
import { getEmbrapaRecomendacaoId, getOutrosEmbrapaId } from '@/services/embrapa-recomendacoes';
import type { TablesInsert } from '@/types/supabase';
import { ZoomableImage } from '@/components/zoomable-image';
import { CameraScreen } from '@/components/camera-view';
import { Camera, Image as ImageIcon, Zap, Target, Scan, Info, WifiOff, Search, X, RefreshCw, Download, List, ChevronRight } from 'lucide-react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';

const { width } = Dimensions.get('window');

/** Salva a foto na galeria do aparelho. Retorna true se salvou, false se falhou ou sem permissão. */
async function savePhotoToGallery(uri: string): Promise<boolean> {
  try {
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') return false;
    // Android exige file:/// e extensão; garantir URI com extensão se necessário
    let localUri = uri;
    if (!/\.(jpg|jpeg|png)$/i.test(uri)) {
      const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
      if (!dir) return false;
      const dest = `${dir}reconhecimento_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      localUri = dest;
    }
    await MediaLibrary.saveToLibraryAsync(localUri);
    return true;
  } catch (e) {
    logger.error('Erro ao salvar na galeria', { error: e });
    return false;
  }
}

export default function ReconhecimentoScreen() {
  const router = useRouter();
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');
  const primaryForegroundColor = useColor({}, 'primaryForeground');
  const borderColor = useColor({}, 'border');

  const { pickFromGallery, isCapturing } = useCamera();
  const { recognize, result, saveResult, clear, imageUri, isRecognizing } = useReconhecimento();
  const { location, captureLocation } = useLocation();
  const { plots, isLoading: plotsLoading } = useSupabasePlots();
  const { isOnline, setLastProcessedRecognitionCount } = useAppStore();
  const pendingRecognitionCount = usePendingRecognitionCount();
  const lastProcessedCount = useLastProcessedRecognitionCount();
  const fazenda = useAuthFazendaPadrao();
  const setPayload = useReconhecimentoResultStore((s) => s.setPayload);
  const clearPayload = useReconhecimentoResultStore((s) => s.clearPayload);
  const [isSaving, setIsSaving] = useState(false);
  const [capturedImage, setCapturedImage] = useState<{ uri: string; source: 'camera' | 'gallery' } | null>(null);
  const [pendingList, setPendingList] = useState<PendingRecognitionItem[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const loadPendingList = useCallback(async () => {
    await refreshPendingRecognitionCount();
    const list = await getPendingRecognitionsList();
    setPendingList(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPendingList();
    }, [loadPendingList])
  );

  useEffect(() => {
    if (lastProcessedCount > 0) {
      Alert.alert(
        'Reconhecimentos concluídos',
        `${lastProcessedCount} foto(s) da fila foram analisadas. Você pode salvar os resultados ao abrir cada um no histórico ou na próxima sincronização.`
      );
      setLastProcessedRecognitionCount(0);
    }
  }, [lastProcessedCount, setLastProcessedRecognitionCount]);

  const recognitionMetadata = {
    fazendaId: fazenda?.id,
    talhaoId: plots[0]?.id,
    cultura: plots[0]?.culturaAtual,
  };

  const handleTakePhoto = () => {
    setShowCamera(true);
  };

  const handleCameraCapture = useCallback((uri: string) => {
    setShowCamera(false);
    setCapturedImage({ uri, source: 'camera' });
  }, []);

  const handleCameraClose = useCallback(() => {
    setShowCamera(false);
  }, []);

  const handleSelectImage = async () => {
    try {
      const image = await pickFromGallery();
      if (!image) return;
      setCapturedImage({ uri: image.uri, source: 'gallery' });
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao selecionar imagem');
    }
  };

  const handleConfirmImage = async () => {
    if (!capturedImage) return;
    setIsConfirming(true);
    try {
      if (!isOnline) {
        const loc: LocationObject | null = (await captureLocation()) as LocationObject | null;
        const saved = await savePhotoToGallery(capturedImage.uri);
        await addToRecognitionQueue(capturedImage.uri, {
          fazendaId: recognitionMetadata.fazendaId,
          talhaoId: recognitionMetadata.talhaoId,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
        });
        await loadPendingList();
        setCapturedImage(null);
        Alert.alert(
          'Adicionado à fila',
          saved
            ? 'Foto salva na galeria e adicionada à fila. Conecte ao WiFi e toque no item abaixo para analisar.'
            : 'Adicionado à fila. Conecte ao WiFi e toque no item abaixo para analisar.',
        );
        return;
      }
      const loc: LocationObject | null = (await captureLocation()) as LocationObject | null;
      const capturedUri = capturedImage.uri;
      const res = await recognize(capturedImage.uri, undefined, recognitionMetadata);
      setCapturedImage(null);
      const locationToUse: LocationObject = loc ?? { latitude: 0, longitude: 0 };
      openResultScreen(res, locationToUse, capturedUri);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao analisar imagem');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDiscardImage = () => {
    setCapturedImage(null);
  };

  const handleRetakeOrReselect = async () => {
    const source = capturedImage?.source;
    setCapturedImage(null);
    if (source === 'camera') {
      handleTakePhoto();
    } else {
      handleSelectImage();
    }
  };

  const handleProcessQueueItem = async (item: PendingRecognitionItem) => {
    if (!isOnline) {
      Alert.alert('Sem conexão', 'Conecte ao WiFi para analisar este item.');
      return;
    }
    try {
      setProcessingId(item.id);
      const data = await processSingleRecognition(item.id);
      if (data) {
        await loadPendingList();
        openResultScreen(data.result, data.location, data.imageUri);
      }
    } catch (error: any) {
      await loadPendingList();
      Alert.alert('Erro ao analisar', error.message || 'Não foi possível analisar. Toque novamente para tentar.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatQueueItemDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return `Hoje às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const doConfirm = async (
    selectedPlotId: number | string,
    pestsToSave: DetectedPestEntry[],
    confirmResult: ReconhecimentoResult,
    confirmLocation: LocationObject,
  ) => {
    const fazendaId = fazenda?.id;
    const userId = useAuthStore.getState().user?.id ?? null;
    const imagemUrl = confirmResult.imagemUrl ?? null;

    if (isSupabaseConfigured() && supabase && (fazendaId == null || typeof fazendaId !== 'number')) {
      Alert.alert('Erro', 'Fazenda não selecionada. Selecione uma fazenda para salvar no Supabase.');
      return;
    }
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const talhaoId = parseInt(String(selectedPlotId)) || null;

      if (isSupabaseConfigured() && supabase && typeof fazendaId === 'number') {
        let scoutIdToUse: number | null = null;

        const pestNames = pestsToSave.map(p => p.name).join(', ');
        const { data: newScout, error: scoutError } = await supabase.from('scouts').insert({
          fazenda_id: fazendaId,
          nome: `Reconhecimento ${new Date().toLocaleDateString('pt-BR')}`,
          talhao_id: talhaoId,
          status: 'CONCLUIDO',
          observacao: `Pragas identificadas: ${pestNames}`,
          total_markers: 1,
          markers_visitados: 1,
          total_pragas: pestsToSave.reduce((s, p) => s + p.contagem, 0),
          user_id: userId,
          imagem_url: imagemUrl,
        }).select('id').single();

        if (scoutError) {
          logger.error('Erro ao salvar scout no Supabase', { error: scoutError });
          throw new Error('Erro ao salvar ponto de monitoramento');
        }
        scoutIdToUse = newScout?.id ?? null;

        if (scoutIdToUse) {
          const embrapaIds = await Promise.all(
            pestsToSave.map((p) =>
              getEmbrapaRecomendacaoId(supabase!, p.name, p.scientificName ?? null)
            )
          );
          const outrosId = await getOutrosEmbrapaId(supabase!);
          const coordinates = {
            type: 'Point' as const,
            coordinates: [confirmLocation.longitude, confirmLocation.latitude] as [number, number],
          };
          const rows: TablesInsert<'scout_pragas'>[] = pestsToSave.map((p, i) => ({
            scout_id: scoutIdToUse!,
            embrapa_recomendacao_id: embrapaIds[i] ?? outrosId,
            coordinates,
            data_marcacao: now,
            tipo_praga: p.pestType ?? 'PRAGA',
            contagem: p.contagem,
            presenca: true,
            prioridade: p.severity === 'critica' || p.severity === 'alta' ? 'ALTA' : p.severity === 'media' ? 'MEDIA' : 'BAIXA',
            data_contagem: now,
            imagem_url: imagemUrl,
            praga_nome: p.name,
          }));
          const { error: insertError } = await supabase.from('scout_pragas').insert(rows);
          if (insertError) {
            logger.error('Erro ao salvar pragas no Supabase', { error: insertError });
            throw new Error('Erro ao salvar pragas');
          }

          const { data: currentPragas } = await supabase
            .from('scout_pragas')
            .select('contagem')
            .eq('scout_id', scoutIdToUse);
          const totalPragas = (currentPragas ?? []).reduce((s: number, r: any) => s + (r.contagem ?? 1), 0);
          await supabase.from('scouts').update({ total_pragas: totalPragas }).eq('id', scoutIdToUse);
        }

        logger.info('Reconhecimento salvo no Supabase', { talhaoId, scoutId: scoutIdToUse, pests: pestsToSave.length, userId, hasImage: !!imagemUrl });
        useAppStore.getState().triggerScoutsRefresh();
      }

      const localScoutId = `scout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await saveResult(localScoutId, pestsToSave[0] ? { pragaNome: pestsToSave[0].name } : undefined);

      const selectedPlot = plots.find((p) => String(p.id) === String(selectedPlotId));
      clear();

      const pestNames = pestsToSave.map(p => p.name).join(', ');
      Alert.alert(
        'Sucesso!',
        `${pestsToSave.length} praga(s) salva(s) no ${selectedPlot?.nome || 'talhão selecionado'}: ${pestNames}`
      );
    } catch (error: any) {
      logger.error('Erro ao confirmar reconhecimento', { error: error.message });
      Alert.alert('Erro', error.message || 'Erro ao salvar reconhecimento');
    } finally {
      setIsSaving(false);
    }
  };

  const openResultScreen = (freshResult?: ReconhecimentoResult | null, freshLocation?: LocationObject | null, capturedImageUri?: string) => {
    const r = freshResult ?? result;
    const loc = freshLocation ?? location;
    if (!r || !loc) {
      logger.error('openResultScreen: resultado ou localização ausente', {
        hasResult: !!r,
        hasLocation: !!loc,
      });
      Alert.alert('Erro', 'Resultado ou localização não disponível. Tente novamente.');
      return;
    }
    const recomendacao = r.recomendacao ?? undefined;
    const pestsForStore: DetectedPestEntry[] = (r.pests ?? []).map(p => ({
      name: p.praga,
      popularName: p.nomePopular,
      scientificName: p.nomeCientifico,
      confidence: p.confianca,
      severity: p.severidade,
      pestType: p.tipoPraga,
      recommendation: p.recomendacao,
      boundingBox: p.boundingBox,
      contagem: 1,
      recomendacao,
    }));
    if (pestsForStore.length === 0) {
      pestsForStore.push({
        name: r.praga,
        popularName: r.nomePopular,
        scientificName: r.nomeCientifico,
        confidence: r.confianca,
        severity: r.severidade,
        pestType: r.tipoPraga,
        recommendation: r.recomendacao,
        contagem: 1,
        recomendacao,
      });
    }
    const resolvedImageUri = capturedImageUri || imageUri || '';
    const payloadLocation = { latitude: loc.latitude, longitude: loc.longitude };
    setPayload({
      result: r,
      pests: pestsForStore,
      imageUri: resolvedImageUri,
      location: payloadLocation,
      plots: plots.map((p) => ({ id: p.id, nome: p.nome, culturaAtual: p.culturaAtual, area: p.area })),
      fazendaId: fazenda?.id,
      isOnline: isOnline ?? false,
      onConfirm: async (selectedPlotId, pestsToSave) => {
        await doConfirm(selectedPlotId, pestsToSave, r, payloadLocation);
        clearPayload();
        router.back();
      },
      onCancel: () => {
        clear();
        clearPayload();
        router.back();
      },
    });
    router.push('/(tabs)/reconhecimento/resultado');
  };

  const showingPreview = !!capturedImage && !isRecognizing;

  if (showCamera) {
    return <CameraScreen onCapture={handleCameraCapture} onClose={handleCameraClose} />;
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: textColor }]}>Reconhecimento</Text>
        </View>
        <TouchableOpacity style={[styles.infoButton, { borderColor: mutedColor + '60' }]} activeOpacity={0.7}>
          <Icon name={Info} size={20} color={mutedColor} />
        </TouchableOpacity>
      </View>

      {pendingRecognitionCount > 0 && (
        <View style={[styles.offlineQueueBanner, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B40' }]}>
          <Icon name={WifiOff} size={18} color="#F59E0B" />
          <Text style={[styles.offlineQueueText, { color: '#F59E0B' }]}>
            {pendingRecognitionCount} foto(s) na fila. Conecte ao WiFi e toque em um item abaixo para analisar.
          </Text>
        </View>
      )}

      {pendingList.length > 0 && (
        <View style={[styles.queueSection, { backgroundColor: cardColor, borderColor }]}>
          <View style={styles.queueSectionHeader}>
            <Icon name={List} size={18} color={primaryColor} />
            <Text style={[styles.queueSectionTitle, { color: textColor }]}>Na fila (aguardando WiFi)</Text>
          </View>
          <ScrollView style={styles.queueList} horizontal={false} showsVerticalScrollIndicator={false}>
            {pendingList.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.queueItem, { backgroundColor, borderTopColor: borderColor }]}
                onPress={() => handleProcessQueueItem(item)}
                disabled={processingId !== null}
                activeOpacity={0.7}
              >
                {processingId === item.id ? (
                  <ActivityIndicator size="small" color={primaryColor} />
                ) : (
                  <Icon
                    name={item.status === 'failed' ? RefreshCw : Search}
                    size={20}
                    color={item.status === 'failed' ? '#EF4444' : isOnline ? primaryColor : mutedColor}
                  />
                )}
                <View style={styles.queueItemText}>
                  <Text style={[styles.queueItemLabel, { color: item.status === 'failed' ? '#EF4444' : textColor }]}>
                    {item.status === 'failed'
                      ? 'Falhou — toque para tentar novamente'
                      : isOnline
                        ? 'Toque para analisar'
                        : 'Conecte ao WiFi para analisar'}
                  </Text>
                  <Text style={[styles.queueItemDate, { color: mutedColor }]}>{formatQueueItemDate(item.createdAt)}</Text>
                </View>
                {isOnline && processingId !== item.id && (
                  <Icon name={ChevronRight} size={18} color={mutedColor} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.scannerSection}>
        {showingPreview ? (
          <View style={styles.previewContainer}>
            <View style={[styles.previewFrame, { borderColor: primaryColor }]}>
              <ZoomableImage
                uri={capturedImage!.uri}
                imageWidth={width - 48}
                imageHeight={380}
                containerStyle={styles.previewScroll}
              />
              <TouchableOpacity
                style={styles.previewCloseButton}
                onPress={handleDiscardImage}
                activeOpacity={0.8}
              >
                <Icon name={X} size={20} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.previewActions}>
              <Text style={[styles.previewTitle, { color: textColor }]}>
                {capturedImage!.source === 'camera' ? 'Foto capturada' : 'Imagem selecionada'}
              </Text>
              <Text style={[styles.previewSubtitle, { color: mutedColor }]}>
                Arraste para ajustar o enquadramento
              </Text>

              <TouchableOpacity
                style={[styles.previewConfirmButton, { backgroundColor: primaryColor }, isConfirming && { opacity: 0.8 }]}
                onPress={handleConfirmImage}
                activeOpacity={0.85}
                disabled={isConfirming || isRecognizing}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                {isConfirming || isRecognizing ? (
                  <ActivityIndicator size="small" color={primaryForegroundColor} />
                ) : (
                  <Icon name={isOnline ? Search : Download} size={22} color={primaryForegroundColor} />
                )}
                <Text style={[styles.previewConfirmText, { color: primaryForegroundColor }]}>
                  {isConfirming || isRecognizing ? 'Aguarde...' : isOnline ? 'Analisar imagem' : 'Salvar na galeria'}
                </Text>
              </TouchableOpacity>

              <View style={styles.previewSecondaryRow}>
                <TouchableOpacity
                  style={[styles.previewSecondaryButton, { backgroundColor: cardColor }]}
                  onPress={handleRetakeOrReselect}
                  activeOpacity={0.7}
                >
                  <Icon name={RefreshCw} size={16} color={textColor} />
                  <Text style={[styles.previewSecondaryText, { color: textColor }]}>
                    {capturedImage!.source === 'camera' ? 'Tirar outra' : 'Escolher outra'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.previewSecondaryButton, { backgroundColor: cardColor }]}
                  onPress={handleDiscardImage}
                  activeOpacity={0.7}
                >
                  <Icon name={X} size={16} color="#EF4444" />
                  <Text style={[styles.previewSecondaryText, { color: '#EF4444' }]}>Descartar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={[styles.scannerFrame, { borderColor: primaryColor }]}>
            <View style={[styles.scannerInner, { backgroundColor: cardColor }]}>
              {isRecognizing ? (
                <>
                  <ActivityIndicator size="large" color={primaryColor} />
                  <Text style={[styles.scannerTitle, { color: textColor, marginTop: 20 }]}>Analisando...</Text>
                  <Text style={[styles.scannerDescription, { color: mutedColor }]}>Identificando praga na imagem</Text>
                </>
              ) : (
                <>
                  <View style={[styles.scannerIcon, { backgroundColor: primaryColor + '15' }]}>
                    <Icon name={Scan} size={48} color={primaryColor} />
                  </View>
                  <Text style={[styles.scannerTitle, { color: textColor }]}>Aponte para a praga</Text>
                  <Text style={[styles.scannerDescription, { color: mutedColor }]}>
                    Posicione a câmera sobre a praga ou folha afetada para identificação automática
                  </Text>
                </>
              )}
            </View>
            <View style={[styles.corner, styles.cornerTL, { borderColor: primaryColor }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: primaryColor }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: primaryColor }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: primaryColor }]} />
          </View>
        )}
      </View>

      {!showingPreview && (
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.mainButton, { backgroundColor: primaryColor }]}
            onPress={handleTakePhoto}
            activeOpacity={0.8}
            disabled={isCapturing || isRecognizing}
          >
            {isCapturing ? (
              <ActivityIndicator size="small" color={primaryForegroundColor} />
            ) : (
              <Icon name={Camera} size={28} color={primaryForegroundColor} />
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
              <Text style={[styles.secondaryButtonText, { color: textColor }]}>Galeria</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!showingPreview && (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  infoButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  offlineQueueBanner: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, gap: 8 },
  offlineQueueText: { fontSize: 13, fontWeight: '500', flex: 1 },
  queueSection: { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  queueSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14 },
  queueSectionTitle: { fontSize: 15, fontWeight: '700' },
  queueList: { maxHeight: 180 },
  queueItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
  queueItemText: { flex: 1 },
  queueItemLabel: { fontSize: 14, fontWeight: '600' },
  queueItemDate: { fontSize: 12, marginTop: 2 },
  scannerSection: { flex: 1, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  scannerFrame: { width: width - 64, aspectRatio: 1, maxHeight: 320, position: 'relative', padding: 3 },
  scannerInner: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scannerIcon: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  scannerTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  scannerDescription: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  corner: { position: 'absolute', width: 24, height: 24, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  previewContainer: { flex: 1, width: '100%', alignItems: 'center', gap: 20 },
  previewFrame: { width: width - 48, height: 380, borderRadius: 16, overflow: 'hidden', borderWidth: 2.5 },
  previewScroll: { flex: 1, backgroundColor: '#1a1a1a' },
  previewCloseButton: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  previewActions: { width: '100%', paddingHorizontal: 8, alignItems: 'center', gap: 12 },
  previewTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  previewSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 4 },
  previewConfirmButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: 16, borderRadius: 14, gap: 10 },
  previewConfirmText: { fontSize: 17, fontWeight: '700' },
  previewSecondaryRow: { flexDirection: 'row', gap: 12, width: '100%' },
  previewSecondaryButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 6 },
  previewSecondaryText: { fontSize: 14, fontWeight: '600' },
  actionsSection: { alignItems: 'center', paddingVertical: 24 },
  mainButton: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  secondaryActions: { flexDirection: 'row', gap: 16 },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24, gap: 8 },
  secondaryButtonText: { fontSize: 14, fontWeight: '500' },
  featuresSection: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, paddingBottom: 24 },
  featureCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, gap: 12 },
  featureIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: '600' },
  featureDescription: { fontSize: 11, marginTop: 2 },
});
