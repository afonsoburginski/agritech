import { useState, useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Image } from 'react-native';
import { useRouter } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { BottomSheet, useBottomSheet } from '@/components/ui/bottom-sheet-simple';
import { useScouts } from '@/hooks/use-scouts';
import { useSupabaseScouts } from '@/hooks/use-supabase-data';
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
  EyeOff
} from 'lucide-react-native';

type TabType = 'todos' | 'visitados' | 'pendentes';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Usar dados do Supabase se online, senão usar dados locais
  const scouts = useMemo(() => {
    if (isOnline && supabaseScouts.length > 0) {
      return supabaseScouts.map(s => ({
        id: s.id,
        latitude: s.latitude,
        longitude: s.longitude,
        talhaoNome: s.plotName,
        visitado: s.visited,
        dataVisita: s.visitDate,
        pragasCount: s.pestsCount,
        observacoes: s.observations,
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
});
