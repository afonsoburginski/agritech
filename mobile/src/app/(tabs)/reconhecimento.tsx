import { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Dimensions, Alert, Image as RNImage, ActivityIndicator, ScrollView, TextInput } from 'react-native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { BottomSheet, useBottomSheet } from '@/components/ui/bottom-sheet-simple';
import { useCamera } from '@/hooks/use-camera';
import { useReconhecimento } from '@/hooks/use-pragas';
import { useScouts } from '@/hooks/use-scouts';
import { useLocation } from '@/hooks/use-location';
import { useSupabasePlots } from '@/hooks/use-supabase-data';
import { useColor } from '@/hooks/useColor';
import { useAppStore, usePendingRecognitionCount, useLastProcessedRecognitionCount } from '@/stores/app-store';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { refreshPendingRecognitionCount } from '@/services/recognition-queue-service';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { logger } from '@/services/logger';
import { 
  Camera, 
  Image as ImageIcon,
  Zap,
  Target,
  Scan,
  Info,
  CheckCircle2,
  X,
  MapPin,
  Layers,
  WifiOff,
  Wifi,
  FlaskConical,
  Leaf,
  ShieldCheck,
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

export default function ReconhecimentoScreen() {
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const primaryColor = useColor({}, 'primary');
  const primaryForegroundColor = useColor({}, 'primaryForeground');
  const borderColor = useColor({}, 'border');
  
  // Hooks
  const { takePhoto, pickFromGallery, isCapturing } = useCamera();
  const { recognize, result, saveResult, isRecognizing, clear, imageUri, isOfflinePending } = useReconhecimento();
  const { create: createScout } = useScouts();
  const { location, captureLocation } = useLocation();
  const { plots, isLoading: plotsLoading } = useSupabasePlots();
  const { isOnline, setLastProcessedRecognitionCount } = useAppStore();
  const pendingRecognitionCount = usePendingRecognitionCount();
  const lastProcessedCount = useLastProcessedRecognitionCount();
  const fazenda = useAuthFazendaPadrao();
  const { isVisible, open, close } = useBottomSheet();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPlotId, setSelectedPlotId] = useState<number | string | null>(null);
  const [editedPragaName, setEditedPragaName] = useState<string | null>(null);
  const [isEditingPraga, setIsEditingPraga] = useState(false);

  // Atualizar contador da fila ao focar na tela
  useEffect(() => {
    refreshPendingRecognitionCount();
  }, []);

  // Avisar quando fotos da fila forem processadas (voltou online)
  useEffect(() => {
    if (lastProcessedCount > 0) {
      Alert.alert(
        'Reconhecimentos concluídos',
        `${lastProcessedCount} foto(s) da fila foram analisadas. Você pode salvar os resultados ao abrir cada um no histórico ou na próxima sincronização.`
      );
      setLastProcessedRecognitionCount(0);
    }
  }, [lastProcessedCount, setLastProcessedRecognitionCount]);
  
  // Selecionar primeiro talhão por padrão quando carregar
  useEffect(() => {
    if (plots.length > 0 && !selectedPlotId) {
      setSelectedPlotId(plots[0].id);
    }
  }, [plots, selectedPlotId]);

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

    if (!selectedPlotId) {
      Alert.alert('Erro', 'Selecione um talhão');
      return;
    }

    const fazendaId = fazenda?.id;
    if (isSupabaseConfigured() && supabase && (fazendaId == null || typeof fazendaId !== 'number')) {
      Alert.alert('Erro', 'Fazenda não selecionada. Selecione uma fazenda para salvar no Supabase.');
      return;
    }

    try {
      setIsSaving(true);
      
      const now = new Date().toISOString();
      const scoutId = `scout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const pragaNomeToSave = editedPragaName ?? result.praga;

      // Primeiro salvar o scout no Supabase
      if (isSupabaseConfigured() && supabase && typeof fazendaId === 'number') {
        // Criar scout (sessão de monitoramento)
        const { data: newScout, error: scoutError } = await supabase.from('scouts').insert({
          fazenda_id: fazendaId,
          nome: `Reconhecimento ${new Date().toLocaleDateString('pt-BR')}`,
          talhao_id: parseInt(String(selectedPlotId)) || null,
          status: 'CONCLUIDO',
          observacao: `Praga identificada: ${pragaNomeToSave}`,
          total_markers: 1,
          markers_visitados: 1,
          total_pragas: 1,
        }).select('id').single();

        if (scoutError) {
          logger.error('Erro ao salvar scout no Supabase', { error: scoutError });
          throw new Error('Erro ao salvar ponto de monitoramento');
        }
        
        const newScoutId = newScout?.id;
        logger.info('Scout criado no Supabase', { id: newScoutId, plotId: selectedPlotId });

        // Criar marker com localização GPS
        if (newScoutId) {
          const { data: marker, error: markerError } = await supabase.from('scout_markers').insert({
            scout_id: newScoutId,
            numero: 1,
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            visitado: true,
            data_marcacao: now,
          }).select('id').single();

          if (markerError) {
            logger.error('Erro ao salvar marker no Supabase', { error: markerError });
          } else if (marker) {
            // Salvar a praga vinculada ao marker
            const { error: pragaError } = await supabase.from('scout_marker_pragas').insert({
              marker_id: marker.id,
              praga_nome: pragaNomeToSave,
              praga_nome_cientifico: result.nomeCientifico,
              tipo_praga: 'PRAGA',
              contagem: 1,
              presenca: true,
              prioridade: result.severidade === 'critica' || result.severidade === 'alta' ? 'ALTA' : result.severidade === 'media' ? 'MEDIA' : 'BAIXA',
              observacao: result.recomendacao,
              data_contagem: now,
            });

            if (pragaError) {
              logger.error('Erro ao salvar praga no Supabase', { error: pragaError });
            }
          }
        }
      }

      // Também salvar localmente (com nome ajustado se o usuário editou)
      await saveResult(scoutId, editedPragaName !== null ? { pragaNome: pragaNomeToSave } : undefined);
      
      const selectedPlot = plots.find(p => String(p.id) === String(selectedPlotId));
      
      close();
      clear();
      setEditedPragaName(null);
      setIsEditingPraga(false);
      Alert.alert(
        'Sucesso!', 
        `Praga "${pragaNomeToSave}" identificada e salva no ${selectedPlot?.nome || 'talhão selecionado'}!`
      );
    } catch (error: any) {
      logger.error('Erro ao confirmar reconhecimento', { error: error.message });
      Alert.alert('Erro', error.message || 'Erro ao salvar reconhecimento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    close();
    clear();
    setEditedPragaName(null);
    setIsEditingPraga(false);
  };

  const effectivePragaName = result ? (editedPragaName ?? result.praga) : '';

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

      {/* Fila offline: aviso quando há fotos pendentes */}
      {pendingRecognitionCount > 0 && (
        <View style={[styles.offlineQueueBanner, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B40' }]}>
          <Icon name={WifiOff} size={18} color="#F59E0B" />
          <Text style={[styles.offlineQueueText, { color: '#92400E' }]}>
            {pendingRecognitionCount} foto(s) na fila. Serão analisadas quando estiver online.
          </Text>
        </View>
      )}

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
          <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
            {/* Status de conexão */}
            <View style={[styles.connectionStatus, { 
              backgroundColor: isOnline ? '#10B98115' : '#F59E0B15' 
            }]}>
              <Icon 
                name={isOnline ? Wifi : WifiOff} 
                size={16} 
                color={isOnline ? '#10B981' : '#F59E0B'} 
              />
              <Text style={[styles.connectionText, { 
                color: isOnline ? '#10B981' : '#F59E0B' 
              }]}>
                {isOnline ? 'Online - Dados serão salvos no servidor' : 'Offline - Será sincronizado depois'}
              </Text>
            </View>

            {imageUri && (
              <RNImage source={{ uri: imageUri }} style={styles.resultImage} resizeMode="cover" />
            )}

            <View style={[styles.resultCard, { backgroundColor: cardColor }]}>
              <View style={styles.resultHeader}>
                <View style={styles.resultMain}>
                  {isEditingPraga ? (
                    <TextInput
                      style={[styles.resultPragaInput, { color: textColor, borderColor }]}
                      value={effectivePragaName}
                      onChangeText={(t) => setEditedPragaName(t)}
                      placeholder="Nome da praga"
                      placeholderTextColor={mutedColor}
                      autoFocus
                    />
                  ) : (
                    <Text style={[styles.resultPraga, { color: textColor }]}>{effectivePragaName}</Text>
                  )}
                  {result.nomePopular && !isEditingPraga && (
                    <Text style={[styles.resultPopular, { color: mutedColor }]}>
                      {result.nomePopular}
                    </Text>
                  )}
                  {result.nomeCientifico && !isEditingPraga && (
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
              <TouchableOpacity
                style={[styles.ajustarPragaRow, { borderColor: borderColor + '60' }]}
                onPress={() => {
                  if (isEditingPraga) {
                    setEditedPragaName(null);
                    setIsEditingPraga(false);
                  } else {
                    setEditedPragaName(result.praga);
                    setIsEditingPraga(true);
                  }
                }}
                activeOpacity={0.7}
              >
                <Icon name={Target} size={16} color={primaryColor} />
                <Text style={[styles.ajustarPragaText, { color: primaryColor }]}>
                  {isEditingPraga ? 'Usar nome da IA' : 'Ajustar nome da praga'}
                </Text>
              </TouchableOpacity>

              <View style={[styles.severidadeBadge, { 
                backgroundColor: result.severidade === 'alta' || result.severidade === 'critica' ? '#EF4444' + '20' : 
                                 result.severidade === 'media' ? '#F59E0B' + '20' : '#10B981' + '20'
              }]}>
                <Text style={[styles.severidadeText, {
                  color: result.severidade === 'alta' || result.severidade === 'critica' ? '#EF4444' : 
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

            {/* Dados Embrapa AGROFIT */}
            {result.embrapa && (
              <View style={[styles.embrapaSection, { backgroundColor: cardColor }]}>
                <View style={styles.embrapaSectionHeader}>
                  <View style={[styles.embrapaIconBg, { backgroundColor: '#059669' + '20' }]}>
                    <Icon name={Leaf} size={18} color="#059669" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.embrapaSectionTitle, { color: textColor }]}>
                      Base Embrapa AGROFIT
                    </Text>
                    <Text style={[styles.embrapaMatchStatus, { color: result.embrapa.matched ? '#059669' : '#F59E0B' }]}>
                      {result.embrapa.matched ? 'Praga encontrada no catálogo' : 'Sem correspondência exata'}
                    </Text>
                  </View>
                  {result.embrapa.matched && (
                    <Icon name={ShieldCheck} size={20} color="#059669" />
                  )}
                </View>

                {result.embrapa.produtosRecomendados && result.embrapa.produtosRecomendados.length > 0 && (
                  <View style={styles.embrapaProdutos}>
                    <View style={styles.embrapaProdutosHeader}>
                      <Icon name={FlaskConical} size={14} color={primaryColor} />
                      <Text style={[styles.embrapaProdutosTitle, { color: textColor }]}>
                        Produtos Recomendados ({result.embrapa.produtosRecomendados.length})
                      </Text>
                    </View>
                    {result.embrapa.produtosRecomendados.slice(0, 5).map((prod: any, idx: number) => (
                      <View key={idx} style={[styles.embrapaProdutoItem, { borderColor: borderColor + '60' }]}>
                        <Text style={[styles.embrapaProdutoNome, { color: textColor }]}>
                          {prod.nome}
                        </Text>
                        <Text style={[styles.embrapaProdutoDetalhe, { color: mutedColor }]}>
                          Ingrediente ativo: {prod.ingredienteAtivo}
                        </Text>
                        <Text style={[styles.embrapaProdutoDetalhe, { color: mutedColor }]}>
                          Classe: {prod.classeAgronômica} | Tox: {prod.classificacaoToxicologica}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Seleção de Talhão */}
            <View style={[styles.plotSection, { borderColor, backgroundColor: cardColor }]}>
              <View style={styles.plotHeader}>
                <Icon name={Layers} size={18} color={textColor} />
                <Text style={[styles.plotTitle, { color: textColor }]}>
                  Selecione o Talhão
                </Text>
              </View>
              
              {plotsLoading ? (
                <ActivityIndicator size="small" color={primaryColor} style={{ marginVertical: 12 }} />
              ) : (
                <View style={styles.plotList}>
                  {plots.map((plot) => (
                    <TouchableOpacity
                      key={plot.id}
                      style={[
                        styles.plotItem,
                        { 
                          borderColor: selectedPlotId === plot.id ? primaryColor : borderColor,
                          backgroundColor: selectedPlotId === plot.id ? primaryColor + '10' : cardColor,
                        }
                      ]}
                      onPress={() => setSelectedPlotId(plot.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.plotItemContent}>
                        <View style={[styles.plotIcon, { 
                          backgroundColor: selectedPlotId === plot.id ? primaryColor : mutedColor + '30' 
                        }]}>
                          <Icon 
                            name={MapPin} 
                            size={14} 
                            color={selectedPlotId === plot.id ? '#FFF' : mutedColor} 
                          />
                        </View>
                        <View style={styles.plotInfo}>
                          <Text style={[styles.plotName, { color: textColor }]}>{plot.nome}</Text>
                          <Text style={[styles.plotDetails, { color: mutedColor }]}>
                            {plot.culturaAtual || 'Cultura não definida'} • {plot.area || '?'} ha
                          </Text>
                        </View>
                      </View>
                      {selectedPlotId === plot.id && (
                        <Icon name={CheckCircle2} size={18} color={primaryColor} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Localização atual */}
            {location && (
              <View style={[styles.locationInfo, { backgroundColor: cardColor }]}>
                <Icon name={MapPin} size={16} color={mutedColor} />
                <Text style={[styles.locationText, { color: mutedColor }]}>
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
              </View>
            )}

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
                style={[styles.confirmButton, { backgroundColor: primaryColor }]}
                disabled={isSaving || !location || !selectedPlotId}
              >
                <Icon name={CheckCircle2} size={18} color={primaryForegroundColor} />
                <Text style={{ color: primaryForegroundColor, marginLeft: 6 }}>
                  {isSaving ? 'Salvando...' : 'Confirmar'}
                </Text>
              </Button>
            </View>
          </ScrollView>
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
  offlineQueueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  offlineQueueText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
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
  resultPragaInput: {
    fontSize: 20,
    fontWeight: '700',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  ajustarPragaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  ajustarPragaText: {
    fontSize: 13,
    fontWeight: '600',
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
  // Novos estilos para seleção de talhão e status
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  plotSection: {
    marginTop: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderRadius: 12,
  },
  plotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  plotTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  plotList: {
    gap: 8,
  },
  plotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  plotItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  plotIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plotInfo: {
    flex: 1,
  },
  plotName: {
    fontSize: 14,
    fontWeight: '600',
  },
  plotDetails: {
    fontSize: 11,
    marginTop: 2,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  locationText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  embrapaSection: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 12,
  },
  embrapaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  embrapaIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  embrapaSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  embrapaMatchStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  embrapaProdutos: {
    gap: 8,
  },
  embrapaProdutosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  embrapaProdutosTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  embrapaProdutoItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  embrapaProdutoNome: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  embrapaProdutoDetalhe: {
    fontSize: 11,
    lineHeight: 16,
  },
});
