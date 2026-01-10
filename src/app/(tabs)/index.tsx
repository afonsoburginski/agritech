import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAuthUser, useAuthFazendaPadrao } from '@/stores/auth-store';
import { useAppStore, useAvatarUri } from '@/stores/app-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { QuickStatsCard } from '@/components/ui/quick-stats-card';
import { QuickActionButton } from '@/components/ui/quick-action-button';
import { 
  ClipboardList, 
  Bug, 
  Camera,
  Clock,
  MapPin,
  TrendingUp,
  Calendar,
  CheckCircle2,
  Plus,
  AlertTriangle,
  Activity
} from 'lucide-react-native';
import { RadarChart } from '@/components/charts/radar-chart';
import { ChartContainer } from '@/components/charts/chart-container';
import { Heatmap } from '@/components/maps/heatmap';
import { 
  useDashboardStats, 
  useSupabaseActivities, 
  useSupabaseScouts,
  useActivitiesByMonth 
} from '@/hooks/use-supabase-data';

export default function HomeScreen() {
  const router = useRouter();
  const backgroundColor = useColor({}, 'background');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const user = useAuthUser();
  const fazenda = useAuthFazendaPadrao();
  const { isOnline, pendingSyncCount } = useAppStore();
  const avatarUri = useAvatarUri();
  const [activeTab, setActiveTab] = useState('atividades');
  
  // Dados do Supabase
  const { stats, isLoading: statsLoading } = useDashboardStats();
  const { activities, isLoading: activitiesLoading } = useSupabaseActivities();
  const { scouts, isLoading: scoutsLoading } = useSupabaseScouts();
  const { data: activitiesByMonth } = useActivitiesByMonth();
  
  // Cores adaptativas para dark mode
  const activityColor = palette.gold;
  const locationIconColor = palette.gold;

  // Dados reais do Supabase
  const pendingSync = pendingSyncCount;
  const atividadesCount = stats.totalActivities;
  const atividadesPendentes = stats.pendingActivities + stats.inProgressActivities;
  const scoutsCount = stats.totalScouts;
  const pragasCount = stats.totalPests;
  const atividadesRecentes = activities.slice(0, 5);
  const scoutsRecentes = scouts.slice(0, 5);

  // Dados para radar chart - normalizar para 0-100 baseado no máximo
  const maxActivities = Math.max(...activitiesByMonth.map(a => a.value), 1);
  const atividadesPorMesRadar = activitiesByMonth.map(item => ({
    label: item.label,
    value: Math.round((item.value / maxActivities) * 100),
  }));

  const handleNovaAtividade = () => {
    router.push('/(tabs)/atividades?openForm=true');
  };

  const handleNovoMonitoramento = () => {
    // TODO: Navegar para criar novo monitoramento
    router.push('/(tabs)/monitoramento');
  };

  const handleReconhecimento = () => {
    router.push('/(tabs)/reconhecimento');
  };

  const handlePerfil = () => {
    router.push('/(tabs)/perfil');
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={{ flex: 1 }}>
              <Text variant="heading" style={{ color: textColor }}>
                Olá, {user?.nome ? user.nome.split(' ')[0] : 'Usuário'}
              </Text>
              {fazenda && (
                <Text variant="body" style={{ color: mutedColor, marginTop: 4 }}>
                  {fazenda.nome}
                </Text>
              )}
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
              <View style={[
                styles.statusDot,
                {
                  backgroundColor: isOnline ? '#10B981' : '#9CA3AF',
                  borderColor: backgroundColor,
                }
              ]}>
                {!isOnline && (
                  <View style={[styles.offlineBar, { backgroundColor: backgroundColor }]} />
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status de Sincronização */}
        {pendingSync > 0 && (
          <View style={styles.syncContainer}>
            <Card style={{ borderColor: palette.gold, borderWidth: 1 }}>
              <View style={styles.syncCardContent}>
                <View style={[styles.syncIconContainer, { backgroundColor: palette.gold + '20' }]}>
                  <Icon name={Clock} size={20} color={palette.gold} />
                </View>
                <View style={styles.syncInfo}>
                  <Text variant="subtitle" style={{ color: textColor }}>
                    {pendingSync} {pendingSync === 1 ? 'item' : 'itens'} pendente{pendingSync !== 1 ? 's' : ''}
                  </Text>
                  <Text variant="caption" style={{ color: mutedColor, marginTop: 2 }}>
                    Aguardando sincronização
                  </Text>
                </View>
                <Badge variant="outline" style={{ borderColor: palette.gold }}>
                  <Text style={{ color: palette.gold, fontSize: 12 }}>Sincronizar</Text>
                </Badge>
              </View>
            </Card>
          </View>
        )}

        {/* Resumo Rápido - Grid de Estatísticas */}
        <View style={styles.section}>
          <Text variant="subtitle" style={{ color: textColor, marginBottom: 12 }}>
            Resumo
          </Text>
          <View style={styles.statsGrid}>
            <QuickStatsCard
              icon={ClipboardList}
              value={atividadesCount}
              label="Atividades"
              color={activityColor}
            />
            <QuickStatsCard
              icon={Clock}
              value={atividadesPendentes}
              label="Pendentes"
              color={palette.gold}
            />
          </View>
          <View style={[styles.statsGrid, { marginTop: 12 }]}>
            <QuickStatsCard
              icon={Bug}
              value={scoutsCount}
              label="Monitoramentos"
              color="#3B82F6"
            />
            <QuickStatsCard
              icon={AlertTriangle}
              value={pragasCount}
              label="Pragas"
              color="#EF4444"
            />
          </View>
        </View>

        {/* Ações Rápidas */}
        <View style={styles.section}>
          <Text variant="subtitle" style={{ color: textColor, marginBottom: 12 }}>
            Ações Rápidas
          </Text>
          <View style={styles.actionsGrid}>
            <QuickActionButton
              icon={Plus}
              label="Nova Atividade"
              onPress={handleNovaAtividade}
              color={activityColor}
            />
            <QuickActionButton
              icon={Bug}
              label="Monitorar"
              onPress={handleNovoMonitoramento}
              color="#3B82F6"
            />
            <QuickActionButton
              icon={Camera}
              label="Reconhecer"
              onPress={handleReconhecimento}
              color={palette.gold}
            />
          </View>
        </View>

        {/* Tabs de Conteúdo */}
        <View style={styles.tabsSection}>
          <Tabs value={activeTab} onValueChange={setActiveTab} style={styles.tabsContainer}>
            <TabsList style={styles.tabsList}>
              <TabsTrigger value="atividades" style={styles.tabTrigger}>
                <View style={styles.tabContent}>
                  <Icon 
                    name={ClipboardList} 
                    size={18} 
                    color={activeTab === 'atividades' ? primaryColor : mutedColor} 
                  />
                  <Text 
                    variant="body" 
                    style={{ 
                      color: activeTab === 'atividades' ? primaryColor : mutedColor,
                      fontWeight: activeTab === 'atividades' ? '600' : '400',
                      marginLeft: 6
                    }}
                  >
                    Atividades
                  </Text>
                </View>
                {activeTab === 'atividades' && (
                  <View style={[styles.underline, { backgroundColor: primaryColor }]} />
                )}
              </TabsTrigger>
              
              <TabsTrigger value="monitoramento" style={styles.tabTrigger}>
                <View style={styles.tabContent}>
                  <Icon 
                    name={Bug} 
                    size={18} 
                    color={activeTab === 'monitoramento' ? primaryColor : mutedColor} 
                  />
                  <Text 
                    variant="body" 
                    style={{ 
                      color: activeTab === 'monitoramento' ? primaryColor : mutedColor,
                      fontWeight: activeTab === 'monitoramento' ? '600' : '400',
                      marginLeft: 6
                    }}
                  >
                    Monitoramento
                  </Text>
                </View>
                {activeTab === 'monitoramento' && (
                  <View style={[styles.underline, { backgroundColor: primaryColor }]} />
                )}
              </TabsTrigger>
            </TabsList>

            {/* Conteúdo Tab: Atividades */}
            <TabsContent value="atividades" style={styles.tabContentContainer}>
              {/* Gráfico de Atividades por Mês */}
              <Card style={styles.chartCard}>
                <ChartContainer
                  title="Atividades por Mês"
                  description="Análise de desempenho das atividades ao longo dos meses"
                >
                  <RadarChart
                    data={atividadesPorMesRadar}
                    config={{
                      height: 300,
                      showLabels: true,
                      animated: true,
                      duration: 1000,
                    }}
                  />
                </ChartContainer>
              </Card>

              {/* Lista de Atividades Recentes */}
              <View style={styles.listSection}>
                <View style={styles.sectionHeader}>
                  <Text variant="subtitle" style={{ color: textColor }}>
                    Atividades Recentes
                  </Text>
                  <Text 
                    variant="caption" 
                    style={{ color: primaryColor, fontWeight: '600' }}
                    onPress={() => router.push('/(tabs)/atividades')}
                  >
                    Ver todas
                  </Text>
                </View>
                {activitiesLoading ? (
                  <Card style={styles.emptyCard}>
                    <Text variant="body" style={{ color: mutedColor }}>Carregando...</Text>
                  </Card>
                ) : !atividadesRecentes || atividadesRecentes.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Icon name={ClipboardList} size={32} color={mutedColor} />
                    <Text variant="body" style={{ color: mutedColor, marginTop: 12, textAlign: 'center' }}>
                      Nenhuma atividade registrada
                    </Text>
                  </Card>
                ) : (
                  atividadesRecentes.map((atividade) => (
                    <Card key={atividade.id} style={styles.activityCard}>
                      <View style={styles.activityHeader}>
                        <Text variant="title" style={{ color: textColor, flex: 1 }} numberOfLines={1}>
                          {atividade.name}
                        </Text>
                        <Badge variant={atividade.status === 'concluida' ? 'success' : atividade.status === 'em_andamento' ? 'default' : 'outline'}>
                          {atividade.status === 'concluida' ? 'Concluída' : atividade.status === 'em_andamento' ? 'Em Andamento' : 'Pendente'}
                        </Badge>
                      </View>
                      {atividade.description && (
                        <Text variant="caption" style={{ color: mutedColor, marginTop: 8 }} numberOfLines={2}>
                          {atividade.description}
                        </Text>
                      )}
                      <View style={styles.activityFooter}>
                        <View style={styles.activityInfo}>
                          <Icon name={Calendar} size={14} color={mutedColor} />
                          <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                            {new Date(atividade.createdAt).toLocaleDateString('pt-BR')}
                          </Text>
                        </View>
                        {atividade.plotName && (
                          <View style={styles.activityInfo}>
                            <Icon name={MapPin} size={14} color={locationIconColor} />
                            <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                              {atividade.plotName}
                            </Text>
                          </View>
                        )}
                      </View>
                    </Card>
                  ))
                )}
              </View>
            </TabsContent>

            {/* Conteúdo Tab: Monitoramento */}
            <TabsContent value="monitoramento" style={styles.tabContentContainer}>
              {/* Mapa de Calor */}
              <View style={styles.heatmapSection}>
                <Text variant="subtitle" style={{ color: textColor, marginBottom: 12 }}>
                  Mapa de Pragas
                </Text>
                <Heatmap height={280} />
              </View>

              {/* Lista de Scouts Recentes */}
              <View style={styles.listSection}>
                <View style={styles.sectionHeader}>
                  <Text variant="subtitle" style={{ color: textColor }}>
                    Monitoramentos Recentes
                  </Text>
                  <Text 
                    variant="caption" 
                    style={{ color: primaryColor, fontWeight: '600' }}
                    onPress={() => router.push('/(tabs)/monitoramento')}
                  >
                    Ver todos
                  </Text>
                </View>
                {scoutsLoading ? (
                  <Card style={styles.emptyCard}>
                    <Text variant="body" style={{ color: mutedColor }}>Carregando...</Text>
                  </Card>
                ) : !scoutsRecentes || scoutsRecentes.length === 0 ? (
                  <Card style={styles.emptyCard}>
                    <Icon name={Bug} size={32} color={mutedColor} />
                    <Text variant="body" style={{ color: mutedColor, marginTop: 12, textAlign: 'center' }}>
                      Nenhum monitoramento registrado
                    </Text>
                  </Card>
                ) : (
                  scoutsRecentes.map((scout) => (
                    <Card key={scout.id} style={styles.scoutCard}>
                      <View style={styles.scoutHeader}>
                        <View style={styles.scoutLocation}>
                          <Icon name={MapPin} size={16} color={locationIconColor} />
                          <Text variant="body" style={{ color: textColor, marginLeft: 6, flex: 1 }} numberOfLines={1}>
                            {scout.plotName || `${scout.latitude.toFixed(4)}, ${scout.longitude.toFixed(4)}`}
                          </Text>
                        </View>
                        <Badge variant={scout.visited ? 'success' : 'outline'}>
                          {scout.visited ? 'Visitado' : 'Pendente'}
                        </Badge>
                      </View>
                      {scout.pestsCount > 0 && (
                        <View style={styles.scoutInfo}>
                          <Icon name={TrendingUp} size={14} color={palette.gold} />
                          <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                            {scout.pestsCount} {scout.pestsCount === 1 ? 'praga' : 'pragas'} detectada{scout.pestsCount > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                      {scout.observations && (
                        <Text variant="caption" style={{ color: mutedColor, marginTop: 8 }} numberOfLines={2}>
                          {scout.observations}
                        </Text>
                      )}
                    </Card>
                  ))
                )}
              </View>

              {/* Indicador de Pragas */}
              <Card style={styles.alertCard}>
                <View style={styles.alertContent}>
                  <View style={[styles.alertIconContainer, { backgroundColor: '#FEF3C7' }]}>
                    <Icon name={AlertTriangle} size={24} color="#D97706" />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text variant="subtitle" style={{ color: textColor }}>
                      {pragasCount} pragas detectadas
                    </Text>
                    <Text variant="caption" style={{ color: mutedColor, marginTop: 2 }}>
                      Verifique os monitoramentos recentes
                    </Text>
                  </View>
                </View>
              </Card>
            </TabsContent>
          </Tabs>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  statusDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBar: {
    width: 6,
    height: 2,
    borderRadius: 1,
  },
  syncContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  syncCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncInfo: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  tabsSection: {
    paddingHorizontal: 16,
  },
  tabsContainer: {
    flex: 1,
  },
  tabsList: {
    backgroundColor: 'transparent',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 16,
  },
  tabTrigger: {
    paddingBottom: 12,
    marginRight: 24,
    backgroundColor: 'transparent',
    borderRadius: 0,
    minHeight: 'auto',
    position: 'relative',
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
  tabContentContainer: {
    flex: 1,
  },
  chartCard: {
    marginBottom: 16,
    padding: 20,
    width: '100%',
    maxWidth: '100%',
    minHeight: Dimensions.get('window').width - 24, // Altura mínima igual à largura da tela
    alignItems: 'center',
    justifyContent: 'center',
  },
  heatmapSection: {
    marginBottom: 20,
  },
  listSection: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 150,
  },
  activityCard: {
    marginBottom: 12,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityFooter: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoutCard: {
    marginBottom: 12,
  },
  scoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  scoutLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  scoutInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  alertCard: {
    marginBottom: 16,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  alertIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: {
    flex: 1,
  },
});
