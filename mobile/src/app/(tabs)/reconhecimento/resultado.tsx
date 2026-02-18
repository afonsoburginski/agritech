import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image as RNImage,
  LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { useReconhecimentoResultStore, type DetectedPestEntry } from '@/stores/reconhecimento-result-store';
import {
  ChevronLeft,
  CheckCircle2,
  X,
  MapPin,
  Layers,
  WifiOff,
  Wifi,
  Leaf,
  Target,
  Minus,
  Plus,
  Trash2,
} from 'lucide-react-native';

const BBOX_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#84CC16', '#6366F1'];

export default function ReconhecimentoResultadoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const payload = useReconhecimentoResultStore((s) => s.payload);
  const clearPayload = useReconhecimentoResultStore((s) => s.clearPayload);

  const [selectedPlotId, setSelectedPlotId] = useState<number | string | null>(null);
  const [pests, setPests] = useState<DetectedPestEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number } | null>(null);

  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');
  const primaryForegroundColor = useColor({}, 'primaryForeground');
  const borderColor = useColor({}, 'border');
  const backgroundColor = useColor({}, 'background');

  useEffect(() => {
    if (payload?.plots.length && !selectedPlotId) {
      setSelectedPlotId(payload.plots[0].id);
    }
  }, [payload?.plots, selectedPlotId]);

  useEffect(() => {
    if (payload?.pests && pests.length === 0) {
      setPests(payload.pests);
    }
  }, [payload?.pests, pests.length]);

  useEffect(() => {
    if (!payload) {
      router.replace('/(tabs)/reconhecimento');
    }
  }, [payload, router]);

  const handleImageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImageLayout({ width, height });
  }, []);

  const updatePestContagem = useCallback((idx: number, delta: number) => {
    setPests((prev) => prev.map((p, i) => {
      if (i !== idx) return p;
      const next = Math.max(1, p.contagem + delta);
      return { ...p, contagem: next };
    }));
  }, []);

  const setPestContagem = useCallback((idx: number, value: string) => {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num) || num < 1) return;
    setPests((prev) => prev.map((p, i) => i === idx ? { ...p, contagem: num } : p));
  }, []);

  const removePest = useCallback((idx: number) => {
    setPests((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updatePestName = useCallback((idx: number, name: string) => {
    setPests((prev) => prev.map((p, i) => i === idx ? { ...p, name } : p));
  }, []);

  if (!payload) return null;

  const { result, imageUri, location, plots, isOnline, onConfirm, onCancel } = payload;

  const handleBack = () => onCancel();

  const handleConfirm = async () => {
    if (!selectedPlotId) {
      Alert.alert('Erro', 'Selecione um talhão');
      return;
    }
    if (pests.length === 0) {
      Alert.alert('Erro', 'Nenhuma praga para salvar');
      return;
    }
    setIsSaving(true);
    try {
      await onConfirm(selectedPlotId, pests);
    } catch (error: any) {
      Alert.alert('Erro', error?.message || 'Erro ao salvar reconhecimento');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name={ChevronLeft} size={24} color={textColor} />
          <Text style={[styles.backLabel, { color: textColor }]}>Voltar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Resultado</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.connectionStatus, { backgroundColor: isOnline ? '#10B98115' : '#F59E0B15' }]}>
          <Icon name={isOnline ? Wifi : WifiOff} size={16} color={isOnline ? '#10B981' : '#F59E0B'} />
          <Text style={[styles.connectionText, { color: isOnline ? '#10B981' : '#F59E0B' }]}>
            {isOnline ? 'Online - Dados serão salvos no servidor' : 'Offline - Será sincronizado depois'}
          </Text>
        </View>

        {imageUri ? (
          <View style={styles.imageContainer}>
            <RNImage
              source={{ uri: imageUri }}
              style={styles.resultImage}
              resizeMode="cover"
              onLayout={handleImageLayout}
            />
            {imageLayout && pests.map((pest, idx) => {
              const bb = pest.boundingBox;
              if (!bb) return null;
              const color = BBOX_COLORS[idx % BBOX_COLORS.length];
              return (
                <View
                  key={idx}
                  style={[
                    styles.boundingBox,
                    {
                      left: bb.x * imageLayout.width,
                      top: bb.y * imageLayout.height,
                      width: bb.width * imageLayout.width,
                      height: bb.height * imageLayout.height,
                      borderColor: color,
                    },
                  ]}
                  pointerEvents="none"
                >
                  <View style={[styles.bboxLabel, { backgroundColor: color }]}>
                    <Text style={styles.bboxLabelText} numberOfLines={1}>{pest.name}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Multi-pest cards */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Pragas Identificadas ({pests.length})
        </Text>

        {pests.map((pest, idx) => {
          const color = BBOX_COLORS[idx % BBOX_COLORS.length];
          return (
            <View key={idx} style={[styles.pestCard, { backgroundColor: cardColor, borderLeftColor: color }]}>
              <View style={styles.pestCardHeader}>
                <View style={styles.pestNameSection}>
                  <Text style={[styles.pestName, { color: textColor }]}>{pest.name}</Text>
                  {pest.scientificName ? (
                    <Text style={[styles.pestScientific, { color: mutedColor }]}>{pest.scientificName}</Text>
                  ) : null}
                </View>
                <View style={styles.pestCardActions}>
                  <View style={[styles.confiancaBadge, { backgroundColor: '#D4AF37' + '20' }]}>
                    <Text style={[styles.confiancaText, { color: '#D4AF37' }]}>
                      {Math.round(pest.confidence * 100)}%
                    </Text>
                  </View>
                  {pests.length > 1 && (
                    <TouchableOpacity onPress={() => removePest(idx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Icon name={Trash2} size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={[styles.severidadeBadge, {
                backgroundColor:
                  pest.severity === 'alta' || pest.severity === 'critica' ? '#EF444420'
                    : pest.severity === 'media' ? '#F59E0B20' : '#10B98120',
              }]}>
                <Text style={[styles.severidadeText, {
                  color:
                    pest.severity === 'alta' || pest.severity === 'critica' ? '#EF4444'
                      : pest.severity === 'media' ? '#F59E0B' : '#10B981',
                }]}>
                  {pest.severity.toUpperCase()}
                </Text>
              </View>

              {pest.recommendation ? (
                <Text style={[styles.pestRecommendation, { color: mutedColor }]}>{pest.recommendation}</Text>
              ) : null}

              {/* Population count stepper */}
              <View style={styles.contagemRow}>
                <Text style={[styles.contagemLabel, { color: textColor }]}>População observada:</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={[styles.stepperBtn, { borderColor }]}
                    onPress={() => updatePestContagem(idx, -1)}
                    activeOpacity={0.7}
                  >
                    <Icon name={Minus} size={16} color={textColor} />
                  </TouchableOpacity>
                  <TextInput
                    style={[styles.stepperInput, { color: textColor, borderColor }]}
                    value={String(pest.contagem)}
                    onChangeText={(v) => setPestContagem(idx, v)}
                    keyboardType="number-pad"
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    style={[styles.stepperBtn, { borderColor }]}
                    onPress={() => updatePestContagem(idx, 1)}
                    activeOpacity={0.7}
                  >
                    <Icon name={Plus} size={16} color={textColor} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {/* Recomendação */}
        {result.recomendacao ? (
          <View style={[styles.embrapaSection, { backgroundColor: cardColor }]}>
            <View style={styles.embrapaSectionHeader}>
              <View style={[styles.embrapaIconBg, { backgroundColor: '#059669' + '20' }]}>
                <Icon name={Leaf} size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.embrapaSectionTitle, { color: textColor }]}>Recomendação</Text>
              </View>
            </View>
            <Text style={[styles.recomendacaoText, { color: textColor }]}>
              {result.recomendacao}
            </Text>
          </View>
        ) : null}

        {/* Plot selection */}
        <View style={[styles.plotSection, { borderColor, backgroundColor: cardColor }]}>
          <View style={styles.plotHeader}>
            <Icon name={Layers} size={18} color={textColor} />
            <Text style={[styles.plotTitle, { color: textColor }]}>Selecione o Talhão</Text>
          </View>
          <View style={styles.plotList}>
            {plots.map((plot) => (
              <TouchableOpacity
                key={plot.id}
                style={[
                  styles.plotItem,
                  {
                    borderColor: selectedPlotId === plot.id ? primaryColor : borderColor,
                    backgroundColor: selectedPlotId === plot.id ? primaryColor + '10' : cardColor,
                  },
                ]}
                onPress={() => setSelectedPlotId(plot.id)}
                activeOpacity={0.7}
              >
                <View style={styles.plotItemContent}>
                  <View
                    style={[
                      styles.plotIcon,
                      { backgroundColor: selectedPlotId === plot.id ? primaryColor : mutedColor + '30' },
                    ]}
                  >
                    <Icon name={MapPin} size={14} color={selectedPlotId === plot.id ? '#FFF' : mutedColor} />
                  </View>
                  <View style={styles.plotInfo}>
                    <Text style={[styles.plotName, { color: textColor }]}>{plot.nome}</Text>
                    <Text style={[styles.plotDetails, { color: mutedColor }]}>
                      {plot.culturaAtual || 'Cultura não definida'} • {plot.area ?? '?'} ha
                    </Text>
                  </View>
                </View>
                {selectedPlotId === plot.id ? <Icon name={CheckCircle2} size={18} color={primaryColor} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.locationInfo, { backgroundColor: cardColor }]}>
          <Icon name={MapPin} size={16} color={mutedColor} />
          <Text style={[styles.locationText, { color: mutedColor }]}>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        </View>

        <View style={styles.resultActions}>
          <Button variant="outline" onPress={handleBack} style={styles.cancelButton}>
            <Icon name={X} size={18} color={textColor} />
            <Text style={{ marginLeft: 6 }}>Cancelar</Text>
          </Button>
          <Button
            variant="default"
            onPress={handleConfirm}
            style={[styles.confirmButton, { backgroundColor: primaryColor }]}
            disabled={isSaving || !selectedPlotId || pests.length === 0}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={primaryForegroundColor} />
            ) : (
              <Icon name={CheckCircle2} size={18} color={primaryForegroundColor} />
            )}
            <Text style={{ color: primaryForegroundColor, marginLeft: 6 }}>
              {isSaving ? 'Salvando...' : `Confirmar (${pests.length})`}
            </Text>
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 12 },
  backLabel: { fontSize: 16, marginLeft: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  headerSpacer: { width: 100 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  connectionText: { fontSize: 12, fontWeight: '500' },
  imageContainer: { position: 'relative', marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  resultImage: { width: '100%', height: 200, borderRadius: 12 },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
  },
  bboxLabel: {
    position: 'absolute',
    top: -18,
    left: -2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bboxLabelText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  pestCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    gap: 10,
  },
  pestCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pestNameSection: { flex: 1, gap: 2 },
  pestName: { fontSize: 17, fontWeight: '700' },
  pestScientific: { fontSize: 12, fontStyle: 'italic' },
  pestCardActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  confiancaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  confiancaText: { fontSize: 13, fontWeight: '700' },
  severidadeBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  severidadeText: { fontSize: 11, fontWeight: '600' },
  pestRecommendation: { fontSize: 13, lineHeight: 18 },
  contagemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  contagemLabel: { fontSize: 13, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperInput: {
    width: 48,
    height: 36,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  embrapaSection: { padding: 16, borderRadius: 12, gap: 12, marginBottom: 16, marginTop: 4 },
  embrapaSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  embrapaIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  embrapaSectionTitle: { fontSize: 14, fontWeight: '700' },
  embrapaMatchStatus: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  recomendacaoText: { fontSize: 13, lineHeight: 20 },
  embrapaProdutoItem: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  embrapaProdutoNome: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  embrapaProdutoDetalhe: { fontSize: 11, lineHeight: 16 },
  plotSection: { marginTop: 4, paddingTop: 16, paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderRadius: 12, marginBottom: 16 },
  plotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  plotTitle: { fontSize: 15, fontWeight: '600' },
  plotList: { gap: 8 },
  plotItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 10, borderWidth: 1.5 },
  plotItemContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  plotIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  plotInfo: { flex: 1 },
  plotName: { fontSize: 14, fontWeight: '600' },
  plotDetails: { fontSize: 11, marginTop: 2 },
  locationInfo: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginBottom: 16, gap: 8 },
  locationText: { fontSize: 12, fontFamily: 'monospace' },
  resultActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  confirmButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
