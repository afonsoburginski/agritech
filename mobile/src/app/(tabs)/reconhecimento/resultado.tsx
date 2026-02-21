import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image as RNImage,
  LayoutChangeEvent,
  FlatList,
  Modal,
  useColorScheme,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { useColor } from '@/hooks/useColor';
import { useReconhecimentoResultStore, type DetectedPestEntry } from '@/stores/reconhecimento-result-store';
import { supabase } from '@/services/supabase';
import { logger } from '@/services/logger';
import { BlurView } from 'expo-blur';
import {
  ChevronLeft,
  CheckCircle2,
  Check,
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
  Pencil,
  Search,
  Eye,
} from 'lucide-react-native';

interface EmbrapaOption {
  nome_praga: string;
  nome_cientifico: string | null;
}

const BBOX_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#F97316', '#06B6D4', '#84CC16', '#6366F1'];

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

export default function ReconhecimentoResultadoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const payload = useReconhecimentoResultStore((s) => s.payload);
  const clearPayload = useReconhecimentoResultStore((s) => s.clearPayload);

  const [selectedPlotId, setSelectedPlotId] = useState<number | string | null>(null);
  const [pests, setPests] = useState<DetectedPestEntry[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [imageLayout, setImageLayout] = useState<{ width: number; height: number } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [embrapaList, setEmbrapaList] = useState<EmbrapaOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPestIdx, setEditingPestIdx] = useState<number | null>(null);
  const [imageModalPestIdx, setImageModalPestIdx] = useState<number | null>(null);
  const [naturalImageSize, setNaturalImageSize] = useState<{ w: number; h: number } | null>(null);
  const [modalImageLayout, setModalImageLayout] = useState<{ width: number; height: number } | null>(null);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');
  const primaryForegroundColor = useColor({}, 'primaryForeground');
  const borderColor = useColor({}, 'border');
  const backgroundColor = useColor({}, 'background');
  /** Fundo do item de talhão selecionado: no dark evita branco (primary+20), usa overlay sutil */
  const selectedPlotItemBg = isDark ? 'rgba(255,255,255,0.1)' : primaryColor + '25';

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

  useEffect(() => {
    if (isEditing && embrapaList.length === 0 && supabase) {
      (async () => {
        try {
          const { data } = await supabase
            .from('embrapa_recomendacoes')
            .select('nome_praga, nome_cientifico')
            .order('nome_praga');
          if (data) setEmbrapaList(data as EmbrapaOption[]);
        } catch (err: unknown) {
          logger.warn('Erro ao carregar lista de pragas', { error: err });
        }
      })();
    }
  }, [isEditing, embrapaList.length]);

  const filteredEmbrapa = useMemo(() => {
    if (!searchQuery.trim()) return embrapaList;
    const q = searchQuery.toLowerCase().trim();
    return embrapaList.filter(
      (e) =>
        e.nome_praga.toLowerCase().includes(q) ||
        (e.nome_cientifico ?? '').toLowerCase().includes(q),
    );
  }, [embrapaList, searchQuery]);

  const handleImageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setImageLayout({ width, height });
  }, []);

  useEffect(() => {
    if (payload?.imageUri) {
      RNImage.getSize(payload.imageUri, (w, h) => setNaturalImageSize({ w, h }));
    }
  }, [payload?.imageUri]);

  const getContainedRect = useCallback(() => {
    if (!imageLayout || !naturalImageSize) return null;
    const containerW = imageLayout.width;
    const containerH = imageLayout.height;
    const imgAspect = naturalImageSize.w / naturalImageSize.h;
    const containerAspect = containerW / containerH;
    let drawW: number, drawH: number, offsetX: number, offsetY: number;
    if (imgAspect > containerAspect) {
      drawW = containerW;
      drawH = containerW / imgAspect;
      offsetX = 0;
      offsetY = (containerH - drawH) / 2;
    } else {
      drawH = containerH;
      drawW = containerH * imgAspect;
      offsetX = (containerW - drawW) / 2;
      offsetY = 0;
    }
    return { drawW, drawH, offsetX, offsetY };
  }, [imageLayout, naturalImageSize]);

  const getModalContainedRect = useCallback(() => {
    if (!modalImageLayout || !naturalImageSize) return null;
    const containerW = modalImageLayout.width;
    const containerH = modalImageLayout.height;
    const imgAspect = naturalImageSize.w / naturalImageSize.h;
    const containerAspect = containerW / containerH;
    let drawW: number, drawH: number, offsetX: number, offsetY: number;
    if (imgAspect > containerAspect) {
      drawW = containerW;
      drawH = containerW / imgAspect;
      offsetX = 0;
      offsetY = (containerH - drawH) / 2;
    } else {
      drawH = containerH;
      drawW = containerH * imgAspect;
      offsetX = (containerW - drawW) / 2;
      offsetY = 0;
    }
    return { drawW, drawH, offsetX, offsetY };
  }, [modalImageLayout, naturalImageSize]);

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

  const updatePestName = useCallback((idx: number, name: string, scientificName?: string) => {
    setPests((prev) => prev.map((p, i) => i === idx ? { ...p, name, ...(scientificName !== undefined ? { scientificName } : {}) } : p));
  }, []);

  const selectEmbrapaForPest = useCallback((idx: number, option: EmbrapaOption) => {
    updatePestName(idx, option.nome_praga, option.nome_cientifico ?? undefined);
    setEditingPestIdx(null);
    setSearchQuery('');
  }, [updatePestName]);

  const closePestPicker = useCallback(() => {
    setEditingPestIdx(null);
    setSearchQuery('');
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

  const isMenuOpen = editingPestIdx !== null;

  return (
    <View style={[styles.container, { backgroundColor, paddingTop: insets.top }]}>
      {/* Modal de seleção de praga com desfoque de fundo */}
      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePestPicker}
      >
        <View style={styles.modalContainer}>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.backdropDim]} />
          <TouchableOpacity style={styles.modalDismissTop} activeOpacity={1} onPress={closePestPicker} />
          <View style={[styles.modalContent, { backgroundColor: cardColor }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Selecionar praga</Text>
              <TouchableOpacity onPress={closePestPicker} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon name={X} size={22} color={mutedColor} />
              </TouchableOpacity>
            </View>
            <View style={[styles.searchInputRow, { borderColor }]}>
              <Icon name={Search} size={18} color={mutedColor} />
              <TextInput
                style={[styles.searchInput, { color: textColor }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar praga..."
                placeholderTextColor={mutedColor}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredEmbrapa}
              keyExtractor={(item) => item.nome_praga}
              style={styles.modalList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.searchResultItem, { borderBottomColor: borderColor }]}
                  onPress={() => { if (editingPestIdx !== null) selectEmbrapaForPest(editingPestIdx, item); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.searchResultName, { color: textColor }]}>{item.nome_praga}</Text>
                  {item.nome_cientifico ? (
                    <Text style={[styles.searchResultScientific, { color: mutedColor }]}>{item.nome_cientifico}</Text>
                  ) : null}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.searchEmpty, { color: mutedColor }]}>Nenhuma praga encontrada</Text>
              }
            />
          </View>
          <TouchableOpacity style={styles.modalDismissBottom} activeOpacity={1} onPress={closePestPicker} />
        </View>
      </Modal>

      <View style={[styles.header, { borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <Icon name={ChevronLeft} size={24} color={textColor} />
          <Text style={[styles.backLabel, { color: textColor }]}>Voltar</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Resultado</Text>
        <TouchableOpacity
          onPress={() => setIsEditing((prev) => !prev)}
          style={[styles.editButton, { backgroundColor: isEditing ? '#10B981' : 'transparent', borderColor: isEditing ? '#10B981' : mutedColor + '60' }]}
          activeOpacity={0.7}
        >
          <Icon name={isEditing ? Check : Pencil} size={18} color={isEditing ? '#FFF' : textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.connectionStatus, { backgroundColor: isOnline ? '#10B98120' : '#F59E0B20' }]}>
          <Icon name={isOnline ? Wifi : WifiOff} size={16} color={isOnline ? '#10B981' : '#F59E0B'} />
          <Text style={[styles.connectionText, { color: isOnline ? '#10B981' : '#F59E0B' }]}>
            {isOnline ? 'Online - Dados serão salvos no servidor' : 'Offline - Será sincronizado depois'}
          </Text>
        </View>

        {/* Imagem com quadradinhos só no modal (botão olho no card) */}

        {/* Modal para ver imagem da praga em tela cheia */}
        <Modal
          visible={imageModalPestIdx !== null}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setImageModalPestIdx(null)}
        >
          <View style={[styles.imageModalContainer, { width: WINDOW_WIDTH, height: WINDOW_HEIGHT }]}>
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.92)' }]} />
            <TouchableOpacity
              style={[styles.imageModalClose, { top: insets.top + 12 }]}
              onPress={() => setImageModalPestIdx(null)}
              activeOpacity={0.7}
            >
              <Icon name={X} size={24} color="#FFF" />
            </TouchableOpacity>
            {imageModalPestIdx !== null && (
              <>
                <View style={[styles.imageModalImageWrapper, { width: WINDOW_WIDTH, height: WINDOW_HEIGHT * 0.7 }]}>
                  {imageUri ? (
                    <RNImage
                      key={`modal-img-${imageModalPestIdx}`}
                      source={{ uri: imageUri }}
                      style={styles.imageModalFull}
                      resizeMode="contain"
                      onLayout={(e) => {
                        const { width: w, height: h } = e.nativeEvent.layout;
                        setModalImageLayout({ width: w, height: h });
                      }}
                      onError={() => setModalImageLayout(null)}
                    />
                  ) : (
                    <View style={styles.imageModalPlaceholder}>
                      <Text style={styles.imageModalPlaceholderText}>Imagem indisponível</Text>
                    </View>
                  )}
                  {imageUri ? (() => {
                    const rect = getModalContainedRect();
                    if (!rect) return null;
                    return pests.map((pest, idx) => {
                      const bb = pest.boundingBox;
                      if (!bb) return null;
                      const color = BBOX_COLORS[idx % BBOX_COLORS.length];
                      const isActive = idx === imageModalPestIdx;
                      const boxLeft = rect.offsetX + bb.x * rect.drawW;
                      const boxTop = rect.offsetY + bb.y * rect.drawH;
                      const boxW = bb.width * rect.drawW;
                      const boxH = bb.height * rect.drawH;
                      return (
                        <View key={idx} style={StyleSheet.absoluteFill} pointerEvents="none" collapsable={false}>
                          <View
                            style={[
                              styles.boundingBox,
                              {
                                left: boxLeft,
                                top: boxTop,
                                width: boxW,
                                height: boxH,
                                borderColor: color,
                                borderWidth: isActive ? 3 : 1.5,
                                opacity: isActive ? 1 : 0.5,
                              },
                            ]}
                            pointerEvents="none"
                          />
                          <View
                            style={[
                              styles.bboxLabel,
                              {
                                backgroundColor: color,
                                left: boxLeft,
                                top: boxTop - 24,
                              },
                            ]}
                            pointerEvents="none"
                          >
                            <Text style={styles.bboxLabelText}>{pest.name}</Text>
                          </View>
                        </View>
                      );
                    });
                  })() : null}
                </View>
                <View style={styles.imageModalPestLabel}>
                  <Text style={styles.imageModalPestName}>{pests[imageModalPestIdx]?.name}</Text>
                  {pests[imageModalPestIdx]?.scientificName ? (
                    <Text style={styles.imageModalPestScientific}>{pests[imageModalPestIdx].scientificName}</Text>
                  ) : null}
                </View>
              </>
            )}
          </View>
        </Modal>

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
                  {isEditing ? (
                    <TouchableOpacity
                      style={[styles.pestNameSelect, { borderColor: editingPestIdx === idx ? primaryColor : borderColor }]}
                      onPress={() => { setEditingPestIdx(editingPestIdx === idx ? null : idx); setSearchQuery(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pestName, { color: textColor, flex: 1 }]}>{pest.name}</Text>
                      <Icon name={Pencil} size={14} color={mutedColor} />
                    </TouchableOpacity>
                  ) : (
                    <Text style={[styles.pestName, { color: textColor }]}>{pest.name}</Text>
                  )}
                  {pest.scientificName ? (
                    <Text style={[styles.pestScientific, { color: mutedColor }]}>{pest.scientificName}</Text>
                  ) : null}
                </View>
                <View style={styles.pestCardActions}>
                  <TouchableOpacity
                    onPress={() => setImageModalPestIdx(idx)}
                    style={[styles.showImageBtn, { borderColor }]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Icon name={Eye} size={15} color={mutedColor} />
                  </TouchableOpacity>
                  <View style={[styles.confiancaBadge, { backgroundColor: primaryColor + '25' }]}>
                    <Text style={[styles.confiancaText, { color: primaryColor }]}>
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
                  pest.severity === 'alta' || pest.severity === 'critica' ? '#EF444425'
                    : pest.severity === 'media' ? '#F59E0B25' : '#10B98125',
              }]}>
                <Text style={[styles.severidadeText, {
                  color:
                    pest.severity === 'alta' || pest.severity === 'critica' ? '#EF4444'
                      : pest.severity === 'media' ? '#F59E0B' : '#10B981',
                }]}>
                  Severidade: {pest.severity === 'critica' ? 'Crítica' : pest.severity === 'alta' ? 'Alta' : pest.severity === 'media' ? 'Média' : 'Baixa'}
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
              <View style={[styles.embrapaIconBg, { backgroundColor: '#10B981' + '20' }]}>
                <Icon name={Leaf} size={18} color="#10B981" />
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
                    backgroundColor: selectedPlotId === plot.id ? selectedPlotItemBg : cardColor,
                  },
                ]}
                onPress={() => setSelectedPlotId(plot.id)}
                activeOpacity={0.7}
              >
                <View style={styles.plotItemContent}>
                  <View
                    style={[
                      styles.plotIcon,
                      { backgroundColor: selectedPlotId === plot.id ? primaryColor : mutedColor + '40' },
                    ]}
                  >
                    <Icon name={MapPin} size={14} color={selectedPlotId === plot.id ? primaryForegroundColor : mutedColor} />
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
          <Button variant="outline" onPress={handleBack} style={[styles.cancelButton, styles.actionButtonPill]}>
            <Icon name={X} size={18} color={textColor} />
            <Text style={{ marginLeft: 6 }}>Cancelar</Text>
          </Button>
          <Button
            variant="default"
            onPress={handleConfirm}
            style={[styles.confirmButton, styles.actionButtonPill, { backgroundColor: primaryColor }]}
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
  modalContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  backdropDim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  modalDismissTop: { flex: 1 },
  modalDismissBottom: { flex: 1 },
  modalContent: { borderRadius: 16, overflow: 'hidden', maxHeight: '60%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalList: { maxHeight: 320 },
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
  editButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
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
  imageContainer: { position: 'relative', marginBottom: 16, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  resultImage: { width: '100%', height: 240, borderRadius: 12 },
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
    overflow: 'visible',
  },
  bboxLabel: {
    position: 'absolute',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  bboxLabelText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  imageModalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imageModalClose: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageModalImageWrapper: { position: 'relative' },
  imageModalFull: { width: '100%', height: '100%' },
  imageModalPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  imageModalPlaceholderText: { fontSize: 16, color: 'rgba(255,255,255,0.6)' },
  imageModalPestLabel: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  imageModalPestName: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  imageModalPestScientific: { fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  showImageBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  pestNameSelect: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 8 },
  pestScientific: { fontSize: 12, fontStyle: 'italic' },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderRadius: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  searchResultItem: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  searchResultName: { fontSize: 15, fontWeight: '600' },
  searchResultScientific: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
  searchEmpty: { padding: 20, textAlign: 'center', fontSize: 14 },
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
  actionButtonPill: { borderRadius: 12 },
});
