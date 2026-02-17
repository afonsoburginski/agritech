import { useState, useMemo, useCallback } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { BottomSheet, useBottomSheet } from '@/components/ui/bottom-sheet-simple';
import { useScouts } from '@/hooks/use-scouts';
import { useSupabaseScouts, usePestsByScout, SupabasePest } from '@/hooks/use-supabase-data';
import { useLocation } from '@/hooks/use-location';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAvatarUri, useAppStore } from '@/stores/app-store';
import { 
  Bug, 
  Search, 
  Plus,
  MapPin,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  Navigation,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react-native';

type TabType = 'todos' | 'visitados' | 'pendentes';

interface ScoutDetail {
  id: string;
  latitude: number;
  longitude: number;
  talhaoNome?: string;
  visitado: boolean;
  dataVisita?: string;
  pragasCount: number;
  observacoes?: string;
  createdAt: string;
  synced: boolean;
}

export default function MonitoramentoScreen() {
  const router = useRouter();
  const avatarUri = useAvatarUri();
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('todos');
  
  // Hooks
  const { isOnline } = useAppStore();
  const { scouts: localScouts, create, refresh } = useScouts();
  const { scouts: supabaseScouts, isLoading, refresh: refreshSupabase } = useSupabaseScouts();
  const { location, captureLocation } = useLocation();
  const { isVisible, open, close } = useBottomSheet();
  const { isVisible: isDetailVisible, open: openDetail, close: closeDetail } = useBottomSheet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedScout, setSelectedScout] = useState<ScoutDetail | null>(null);
  
  // Buscar pragas do scout selecionado
  const { pests: scoutPests, isLoading: pestsLoading } = usePestsByScout(selectedScout?.id || null);

  // Ao voltar para a tela (ex.: após salvar reconhecimento), atualizar listas
  useFocusEffect(
    useCallback(() => {
      refreshSupabase();
      refresh();
    }, [refreshSupabase, refresh])
  );
  
  // Abrir modal de detalhes
  const handleScoutPress = (scout: ScoutDetail) => {
    setSelectedScout(scout);
    openDetail();
  };
  
  // Função para obter cor baseada na severidade
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critica': return '#DC2626';
      case 'alta': return '#EA580C';
      case 'media': return '#F59E0B';
      case 'baixa': return '#10B981';
      default: return '#6B7280';
    }
  };
  
  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critica': return 'Crítica';
      case 'alta': return 'Alta';
      case 'media': return 'Média';
      case 'baixa': return 'Baixa';
      default: return severity;
    }
  };
  
  // Usar dados do Supabase se online, senão usar dados locais
  const scouts = useMemo(() => {
    if (isOnline && supabaseScouts.length > 0) {
      return supabaseScouts.map(s => ({
        id: String(s.id),
        latitude: 0,
        longitude: 0,
        talhaoNome: s.talhaoNome || s.nome,
        visitado: s.status === 'CONCLUIDO',
        dataVisita: undefined,
        pragasCount: s.totalPragas,
        observacoes: s.observacao,
        createdAt: s.createdAt,
        updatedAt: s.createdAt,
        synced: true,
      }));
    }
    return localScouts;
  }, [isOnline, supabaseScouts, localScouts]);

  const filteredScouts = scouts.filter((scout) => {
    const matchesSearch = scout.talhaoNome?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         `${scout.latitude}, ${scout.longitude}`.includes(searchQuery.toLowerCase()) ||
                         false;
    const matchesFilter = activeTab === 'todos' || 
                         (activeTab === 'visitados' && scout.visitado) ||
                         (activeTab === 'pendentes' && !scout.visitado);
    return matchesSearch && matchesFilter;
  });

  const totalPragas = scouts.reduce((sum, s) => sum + (s.pragasCount || 0), 0);

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: scouts.length },
    { key: 'visitados', label: 'Visitados', count: scouts.filter(s => s.visitado).length },
    { key: 'pendentes', label: 'Pendentes', count: scouts.filter(s => !s.visitado).length },
  ];

  const handlePerfil = () => {
    router.push('/(tabs)/perfil');
  };

  const handleNovo = async () => {
    try {
      // Capturar localização
      await captureLocation();
      
      if (!location) {
        Alert.alert('Aguarde', 'Obtendo localização...');
        return;
      }

      open();
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao obter localização');
    }
  };

  const handleSubmit = async () => {
    if (!location) {
      Alert.alert('Erro', 'Localização não disponível');
      return;
    }

    try {
      setIsSubmitting(true);
      await create({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
      close();
      refresh();
      Alert.alert('Sucesso', 'Ponto de monitoramento criado!');
    } catch (error: any) {
      Alert.alert('Erro', error.message || 'Erro ao criar ponto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Pragas</Text>
          <Text style={[styles.headerSubtitle, { color: mutedColor }]}>
            {totalPragas} pragas em {scouts.length} pontos
          </Text>
        </View>
        <TouchableOpacity 
          onPress={handlePerfil}
          activeOpacity={0.7}
          style={styles.avatarContainer}
        >
          <Image
            source={avatarUri ? { uri: avatarUri } : require('../../../assets/images/avatar.jpg')}
            style={styles.avatar}
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: cardColor }]}>
          <View style={[styles.statIcon, { backgroundColor: palette.gold + '20' }]}>
            <Icon name={AlertTriangle} size={18} color={palette.gold} />
          </View>
          <Text style={[styles.statValue, { color: textColor }]}>{totalPragas}</Text>
          <Text style={[styles.statLabel, { color: mutedColor }]}>Pragas</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: cardColor }]}>
          <View style={[styles.statIcon, { backgroundColor: '#10B981' + '20' }]}>
            <Icon name={Eye} size={18} color="#10B981" />
          </View>
          <Text style={[styles.statValue, { color: textColor }]}>{scouts.filter(s => s.visitado).length}</Text>
          <Text style={[styles.statLabel, { color: mutedColor }]}>Visitados</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: cardColor }]}>
          <View style={[styles.statIcon, { backgroundColor: '#F59E0B' + '20' }]}>
            <Icon name={EyeOff} size={18} color="#F59E0B" />
          </View>
          <Text style={[styles.statValue, { color: textColor }]}>{scouts.filter(s => !s.visitado).length}</Text>
          <Text style={[styles.statLabel, { color: mutedColor }]}>Pendentes</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchSection}>
        <View style={[styles.searchContainer, { backgroundColor: cardColor, borderColor }]}>
          <Icon name={Search} size={18} color={mutedColor} />
          <TextInput
            style={[styles.searchInput, { color: textColor }]}
            placeholder="Buscar por talhão..."
            placeholderTextColor={mutedColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={[styles.tabsRow, { borderBottomColor: borderColor }]}>
          <View style={styles.tabsList}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.tab}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <Text 
                  style={[
                    styles.tabLabel, 
                    { color: activeTab === tab.key ? primaryColor : mutedColor }
                  ]}
                >
                  {tab.label}
                </Text>
                <Text 
                  style={[
                    styles.tabCount, 
                    { 
                      color: activeTab === tab.key ? primaryColor : mutedColor,
                      opacity: activeTab === tab.key ? 1 : 0.6
                    }
                  ]}
                >
                  {tab.count}
                </Text>
                {activeTab === tab.key && (
                  <View style={[styles.tabIndicator, { backgroundColor: primaryColor }]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity 
            style={[styles.addButton, { borderColor: primaryColor }]}
            activeOpacity={0.7}
            onPress={handleNovo}
          >
            <Icon name={Plus} size={16} color={primaryColor} />
            <Text style={[styles.addButtonText, { color: primaryColor }]}>Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredScouts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: cardColor }]}>
              <Icon name={Bug} size={32} color={mutedColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: textColor }]}>
              Nenhum ponto encontrado
            </Text>
            <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
              {searchQuery ? 'Tente buscar por outro termo' : 'Adicione um ponto de monitoramento'}
            </Text>
          </View>
        ) : (
          filteredScouts.map((scout) => (
            <TouchableOpacity 
              key={scout.id} 
              style={[styles.scoutCard, { backgroundColor: cardColor }]}
              activeOpacity={0.7}
              onPress={() => handleScoutPress(scout as ScoutDetail)}
            >
              <View style={styles.scoutLeft}>
                <View style={[
                  styles.scoutIcon, 
                  { backgroundColor: scout.visitado ? '#10B981' + '20' : '#F59E0B' + '20' }
                ]}>
                  <Icon 
                    name={MapPin} 
                    size={18} 
                    color={scout.visitado ? '#10B981' : '#F59E0B'} 
                  />
                </View>
                <View style={styles.scoutInfo}>
                  <Text style={[styles.scoutName, { color: textColor }]}>
                    {scout.talhaoNome || `Ponto ${scout.id.slice(-4)}`}
                  </Text>
                  <View style={styles.scoutMeta}>
                    {scout.pragasCount > 0 && (
                      <View style={styles.pragasBadge}>
                        <Icon name={AlertTriangle} size={11} color={palette.gold} />
                        <Text style={[styles.pragasText, { color: palette.gold }]}>
                          {scout.pragasCount} praga{scout.pragasCount > 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                    {scout.dataVisita && (
                      <View style={styles.dateContainer}>
                        <Icon name={Calendar} size={11} color={mutedColor} />
                        <Text style={[styles.dateText, { color: mutedColor }]}>
                          {new Date(scout.dataVisita).toLocaleDateString('pt-BR')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.scoutRight}>
                <View style={[
                  styles.statusDot, 
                  { backgroundColor: scout.visitado ? '#10B981' : '#F59E0B' }
                ]} />
                <Icon name={ChevronRight} size={18} color={mutedColor} />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal de Novo Scout */}
      <BottomSheet
        isVisible={isVisible}
        onClose={close}
        title="Novo Ponto de Monitoramento"
      >
        <View style={styles.formContainer}>
          {location && (
            <View style={[styles.locationCard, { backgroundColor: cardColor }]}>
              <Icon name={MapPin} size={20} color={primaryColor} />
              <View style={styles.locationInfo}>
                <Text style={[styles.locationLabel, { color: mutedColor }]}>Localização atual</Text>
                <Text style={[styles.locationCoords, { color: textColor }]}>
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </Text>
                {location.accuracy && (
                  <Text style={[styles.locationAccuracy, { color: mutedColor }]}>
                    Precisão: ±{Math.round(location.accuracy)}m
                  </Text>
                )}
              </View>
            </View>
          )}

          <View style={styles.formActions}>
            <Button
              variant="outline"
              onPress={close}
              style={styles.cancelButton}
            >
              <Text>Cancelar</Text>
            </Button>
            <Button
              variant="default"
              onPress={handleSubmit}
              style={[
                styles.submitButton,
                { 
                  backgroundColor: palette.gold,
                }
              ]}
              disabled={isSubmitting || !location}
            >
              <Text style={{ color: '#000000', fontWeight: '600' }}>
                {isSubmitting ? 'Salvando...' : 'Criar'}
              </Text>
            </Button>
          </View>
        </View>
      </BottomSheet>

      {/* Modal de Detalhes do Ponto */}
      <BottomSheet
        isVisible={isDetailVisible}
        onClose={closeDetail}
        title={selectedScout?.talhaoNome || `Ponto ${selectedScout?.id.slice(-6)}`}
      >
        {selectedScout && (
          <View style={styles.detailContainer}>
            {/* Status */}
            <View style={[styles.detailStatusCard, { 
              backgroundColor: selectedScout.visitado ? '#10B98115' : '#F59E0B15' 
            }]}>
              <Icon 
                name={selectedScout.visitado ? CheckCircle : Clock} 
                size={24} 
                color={selectedScout.visitado ? '#10B981' : '#F59E0B'} 
              />
              <View style={styles.detailStatusInfo}>
                <Text style={[styles.detailStatusLabel, { 
                  color: selectedScout.visitado ? '#10B981' : '#F59E0B' 
                }]}>
                  {selectedScout.visitado ? 'Visitado' : 'Pendente'}
                </Text>
                {selectedScout.dataVisita && (
                  <Text style={[styles.detailStatusDate, { color: mutedColor }]}>
                    {new Date(selectedScout.dataVisita).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </Text>
                )}
              </View>
            </View>

            {/* Localização */}
            <View style={[styles.detailSection, { borderColor }]}>
              <View style={styles.detailSectionHeader}>
                <Icon name={Navigation} size={16} color={primaryColor} />
                <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                  Localização
                </Text>
              </View>
              <View style={styles.detailCoords}>
                <View style={styles.detailCoordRow}>
                  <Text style={[styles.detailCoordLabel, { color: mutedColor }]}>Latitude</Text>
                  <Text style={[styles.detailCoordValue, { color: textColor }]}>
                    {selectedScout.latitude.toFixed(6)}
                  </Text>
                </View>
                <View style={styles.detailCoordRow}>
                  <Text style={[styles.detailCoordLabel, { color: mutedColor }]}>Longitude</Text>
                  <Text style={[styles.detailCoordValue, { color: textColor }]}>
                    {selectedScout.longitude.toFixed(6)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Pragas */}
            <View style={[styles.detailSection, { borderColor }]}>
              <View style={styles.detailSectionHeader}>
                <Icon name={Bug} size={16} color={palette.gold} />
                <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                  Pragas Identificadas
                </Text>
                {scoutPests.length > 0 && (
                  <View style={[styles.pestCountBadge, { backgroundColor: palette.gold + '20' }]}>
                    <Text style={[styles.pestCountText, { color: palette.gold }]}>
                      {scoutPests.length}
                    </Text>
                  </View>
                )}
              </View>
              
              {pestsLoading ? (
                <View style={styles.loadingPests}>
                  <Text style={[styles.loadingText, { color: mutedColor }]}>
                    Carregando pragas...
                  </Text>
                </View>
              ) : scoutPests.length > 0 ? (
                <View style={styles.pestsList}>
                  {scoutPests.map((pest) => (
                    <View 
                      key={pest.id} 
                      style={[styles.pestCard, { backgroundColor: cardColor, borderColor }]}
                    >
                      <View style={styles.pestHeader}>
                        <View style={styles.pestNameRow}>
                          <Text style={[styles.pestName, { color: textColor }]}>
                            {pest.pragaNome || 'Desconhecida'}
                          </Text>
                          <View style={[
                            styles.severityBadge, 
                            { backgroundColor: getSeverityColor((pest.prioridade || 'baixa').toLowerCase()) + '20' }
                          ]}>
                            <Text style={[
                              styles.severityText, 
                              { color: getSeverityColor((pest.prioridade || 'baixa').toLowerCase()) }
                            ]}>
                              {getSeverityLabel((pest.prioridade || 'baixa').toLowerCase())}
                            </Text>
                          </View>
                        </View>
                        {pest.pragaNomeCientifico && (
                          <Text style={[styles.pestScientificName, { color: mutedColor }]}>
                            {pest.pragaNomeCientifico}
                          </Text>
                        )}
                      </View>
                      <View style={styles.pestDetails}>
                        <View style={styles.pestDetailItem}>
                          <Text style={[styles.pestDetailLabel, { color: mutedColor }]}>
                            Quantidade
                          </Text>
                          <Text style={[styles.pestDetailValue, { color: textColor }]}>
                            {pest.contagem || 0} {(pest.contagem || 0) === 1 ? 'indivíduo' : 'indivíduos'}
                          </Text>
                        </View>
                        {pest.tipoPraga && (
                          <View style={styles.pestDetailItem}>
                            <Text style={[styles.pestDetailLabel, { color: mutedColor }]}>
                              Tipo
                            </Text>
                            <Text style={[styles.pestDetailValue, { color: textColor }]}>
                              {pest.tipoPraga}
                            </Text>
                          </View>
                        )}
                      </View>
                      {pest.observacao && (
                        <Text style={[styles.pestNotes, { color: mutedColor }]}>
                          {pest.observacao}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.noPragasCard, { backgroundColor: '#10B98115' }]}>
                  <Icon name={CheckCircle} size={18} color="#10B981" />
                  <Text style={[styles.noPragasText, { color: '#10B981' }]}>
                    Nenhuma praga identificada
                  </Text>
                </View>
              )}
            </View>

            {/* Observações */}
            {selectedScout.observacoes && (
              <View style={[styles.detailSection, { borderColor }]}>
                <View style={styles.detailSectionHeader}>
                  <Icon name={AlertTriangle} size={16} color={mutedColor} />
                  <Text style={[styles.detailSectionTitle, { color: textColor }]}>
                    Observações
                  </Text>
                </View>
                <Text style={[styles.detailObservations, { color: textColor }]}>
                  {selectedScout.observacoes}
                </Text>
              </View>
            )}

            {/* Sync status */}
            <View style={styles.detailSyncRow}>
              <View style={[
                styles.syncBadge, 
                { backgroundColor: selectedScout.synced ? '#10B98120' : '#F59E0B20' }
              ]}>
                <View style={[
                  styles.syncDot,
                  { backgroundColor: selectedScout.synced ? '#10B981' : '#F59E0B' }
                ]} />
                <Text style={[styles.syncText, { 
                  color: selectedScout.synced ? '#10B981' : '#F59E0B' 
                }]}>
                  {selectedScout.synced ? 'Sincronizado' : 'Aguardando sincronização'}
                </Text>
              </View>
            </View>

            {/* Ações */}
            <View style={styles.detailActions}>
              <Button
                variant="outline"
                onPress={closeDetail}
                style={styles.detailCloseButton}
              >
                <Text>Fechar</Text>
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
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  tabsContainer: {
    paddingHorizontal: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  tabsList: {
    flexDirection: 'row',
  },
  tab: {
    paddingVertical: 12,
    marginRight: 16,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
  },
  scoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  scoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  scoutIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoutInfo: {
    flex: 1,
  },
  scoutName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pragasBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pragasText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
  },
  scoutRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  formContainer: {
    gap: 20,
  },
  locationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    alignItems: 'flex-start',
  },
  locationInfo: {
    flex: 1,
    gap: 4,
  },
  locationLabel: {
    fontSize: 12,
  },
  locationCoords: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  locationAccuracy: {
    fontSize: 11,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
  },
  // Estilos do Modal de Detalhes
  detailContainer: {
    gap: 16,
  },
  detailStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  detailStatusInfo: {
    flex: 1,
  },
  detailStatusLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  detailStatusDate: {
    fontSize: 13,
    marginTop: 2,
  },
  detailSection: {
    borderTopWidth: 1,
    paddingTop: 16,
  },
  detailSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailCoords: {
    gap: 8,
  },
  detailCoordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailCoordLabel: {
    fontSize: 13,
  },
  detailCoordValue: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  pragasCountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  pragasCountNumber: {
    fontSize: 28,
    fontWeight: '800',
  },
  pragasCountLabel: {
    fontSize: 13,
  },
  noPragasCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    gap: 10,
  },
  noPragasText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailObservations: {
    fontSize: 14,
    lineHeight: 20,
  },
  detailSyncRow: {
    alignItems: 'flex-start',
    marginTop: 4,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailActions: {
    marginTop: 8,
  },
  detailCloseButton: {
    width: '100%',
  },
  // Estilos de Pragas
  pestCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  pestCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingPests: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
  },
  pestsList: {
    gap: 10,
  },
  pestCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  pestHeader: {
    marginBottom: 8,
  },
  pestNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pestName: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  pestScientificName: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
  },
  pestDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  pestDetailItem: {
    gap: 2,
  },
  pestDetailLabel: {
    fontSize: 11,
  },
  pestDetailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  pestNotes: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
});
