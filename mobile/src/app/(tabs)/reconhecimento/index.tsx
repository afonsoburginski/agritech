import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Dimensions, Alert, ActivityIndicator, Image as RNImage } from 'react-native';
import { useRouter } from 'expo-router';
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
import { refreshPendingRecognitionCount } from '@/services/recognition-queue-service';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { logger } from '@/services/logger';
import { getEmbrapaRecomendacaoId, getOutrosEmbrapaId } from '@/services/embrapa-recomendacoes';
import type { TablesInsert } from '@/types/supabase';
import { Camera, Image as ImageIcon, Zap, Target, Scan, Info, WifiOff, Search, RotateCcw } from 'lucide-react-native';
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

  const { takePhoto, pickFromGallery, isCapturing } = useCamera();
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
  /** Imagem selecionada da galeria: mostra preview e botão "Analisar imagem" antes de rodar a IA */
  const [selectedGalleryImage, setSelectedGalleryImage] = useState<string | null>(null);

  useEffect(() => {
    refreshPendingRecognitionCount();
  }, []);

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

  const handleTakePhoto = async () => {
    try {
      const photo = await takePhoto();
      if (!photo) return;
      if (!isOnline) {
        const saved = await savePhotoToGallery(photo.uri);
        Alert.alert('Offline', saved ? 'Foto salva na galeria. Analise quando estiver online.' : 'Não foi possível salvar na galeria. Verifique as permissões.');
        return;
      }
      const loc: LocationObject | null = await captureLocation() as LocationObject | null;
      const res = await recognize(photo.uri, undefined, recognitionMetadata);
      openResultScreen(res, loc, photo.uri);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao capturar foto');
    }
  };

  const handleSelectImage = async () => {
    try {
      const image = await pickFromGallery();
      if (!image) return;
      setSelectedGalleryImage(image.uri);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao selecionar imagem');
    }
  };

  const handleAnalyzeSelectedImage = async () => {
    if (!selectedGalleryImage) return;
    try {
      if (!isOnline) {
        const saved = await savePhotoToGallery(selectedGalleryImage);
        setSelectedGalleryImage(null);
        Alert.alert('Offline', saved ? 'Foto salva na galeria. Analise quando estiver online.' : 'Não foi possível salvar na galeria. Verifique as permissões.');
        return;
      }
      const loc: LocationObject | null = await captureLocation() as LocationObject | null;
      const capturedUri = selectedGalleryImage;
      const res = await recognize(selectedGalleryImage, undefined, recognitionMetadata);
      setSelectedGalleryImage(null);
      openResultScreen(res, loc, capturedUri);
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao analisar imagem');
    }
  };

  const handleClearGalleryPreview = () => {
    setSelectedGalleryImage(null);
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

  const showingGalleryPreview = !!selectedGalleryImage && !isRecognizing;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: textColor }]}>Reconhecimento</Text>
          <Text style={[styles.headerSubtitle, { color: mutedColor }]}>Identifique pragas com IA</Text>
        </View>
        <TouchableOpacity style={[styles.infoButton, { borderColor: mutedColor + '60' }]} activeOpacity={0.7}>
          <Icon name={Info} size={20} color={mutedColor} />
        </TouchableOpacity>
      </View>

      {pendingRecognitionCount > 0 && (
        <View style={[styles.offlineQueueBanner, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B40' }]}>
          <Icon name={WifiOff} size={18} color="#F59E0B" />
          <Text style={[styles.offlineQueueText, { color: '#F59E0B' }]}>
            {pendingRecognitionCount} foto(s) na fila. Serão analisadas quando estiver online.
          </Text>
        </View>
      )}

      <View style={styles.scannerSection}>
        {showingGalleryPreview ? (
          <View style={[styles.galleryPreviewFrame, { borderColor: primaryColor }]}>
            <RNImage source={{ uri: selectedGalleryImage! }} style={styles.galleryPreviewImage} resizeMode="cover" />
            <View style={styles.galleryPreviewOverlay}>
              <Text style={styles.galleryPreviewTitleLight}>Imagem selecionada</Text>
              <Text style={styles.galleryPreviewSubtitleLight}>
                Toque no botão abaixo para identificar a praga
              </Text>
              <TouchableOpacity
                style={[styles.analyzeButton, { backgroundColor: primaryColor }]}
                onPress={handleAnalyzeSelectedImage}
                activeOpacity={0.85}
              >
                <Icon name={Search} size={24} color="#FFF" />
                <Text style={styles.analyzeButtonText}>Analisar imagem</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chooseAnotherButton, { borderColor: borderColor }]}
                onPress={handleClearGalleryPreview}
                activeOpacity={0.7}
              >
                <Icon name={RotateCcw} size={18} color={mutedColor} />
                <Text style={[styles.chooseAnotherText, { color: mutedColor }]}>Escolher outra imagem</Text>
              </TouchableOpacity>
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

      {!showingGalleryPreview && (
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerSubtitle: { fontSize: 14, marginTop: 4 },
  infoButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  offlineQueueBanner: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, gap: 8 },
  offlineQueueText: { fontSize: 13, fontWeight: '500', flex: 1 },
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
  galleryPreviewFrame: { width: width - 64, aspectRatio: 1, maxHeight: 320, borderRadius: 16, overflow: 'hidden', borderWidth: 3 },
  galleryPreviewImage: { width: '100%', height: '100%' },
  galleryPreviewOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 20, backgroundColor: 'rgba(0,0,0,0.6)', gap: 8 },
  galleryPreviewTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  galleryPreviewSubtitle: { fontSize: 13, textAlign: 'center', marginBottom: 4 },
  galleryPreviewTitleLight: { fontSize: 16, fontWeight: '600', textAlign: 'center', color: '#FFF' },
  galleryPreviewSubtitleLight: { fontSize: 13, textAlign: 'center', marginBottom: 4, color: 'rgba(255,255,255,0.9)' },
  analyzeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, gap: 10 },
  analyzeButtonText: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  chooseAnotherButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 6 },
  chooseAnotherText: { fontSize: 14, fontWeight: '500' },
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
