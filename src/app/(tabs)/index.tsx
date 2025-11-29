import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useColor } from '@/hooks/useColor';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAuthUser, useAuthFazendaPadrao } from '@/stores/auth-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { 
  ClipboardList, 
  Bug, 
  Camera,
  Wifi, 
  WifiOff,
  Clock,
  MapPin,
  TrendingUp,
  Calendar,
  AlertCircle,
  CheckCircle2,
  List,
  AlertTriangle
} from 'lucide-react-native';
import { BarChart } from '@/components/charts/bar-chart';
import { RadarChart } from '@/components/charts/radar-chart';
import { StackedAreaChart } from '@/components/charts/stacked-area-chart';

export default function HomeScreen() {
  const backgroundColor = useColor({}, 'background');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const user = useAuthUser();
  const fazenda = useAuthFazendaPadrao();
  const [activeTab, setActiveTab] = useState('atividades');

  // Mock data - será substituído quando stores estiverem implementados
  const isOnline = true; // TODO: usar syncStore.isOnline
  const pendingSync: number = 0; // TODO: usar syncStore.pendingCount
  const atividadesCount: number = 0; // TODO: usar atividadesStore.atividades.length
  const scoutsCount: number = 0; // TODO: usar scoutStore.scouts.length
  const atividadesRecentes: any[] = []; // TODO: usar atividadesStore.atividades.slice(0, 5)
  const scoutsRecentes: any[] = []; // TODO: usar scoutStore.scouts.slice(0, 5)

  return (
    <View style={[styles.container, { backgroundColor }]}>
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
          <View style={styles.avatarContainer}>
            <Image
              source={require('../../../assets/images/avatar.jpg')}
              style={styles.avatar}
              contentFit="cover"
            />
            <View style={[
              styles.statusDot,
              {
                backgroundColor: isOnline ? '#10B981' : '#9CA3AF', // Verde vibrante para online
                borderColor: backgroundColor,
              }
            ]}>
              {!isOnline && (
                <View style={[styles.offlineBar, { backgroundColor: backgroundColor }]} />
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Status de Sincronização */}
      {pendingSync > 0 && (
        <View style={styles.syncContainer}>
          <Card style={{ ...styles.syncCard, borderColor: palette.gold, borderWidth: 1 }}>
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

      {/* Tabs com Underline */}
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
          
          <TabsTrigger value="reconhecimento" style={styles.tabTrigger}>
            <View style={styles.tabContent}>
              <Icon 
                name={Camera} 
                size={18} 
                color={activeTab === 'reconhecimento' ? primaryColor : mutedColor} 
              />
              <Text 
                variant="body" 
                style={{ 
                  color: activeTab === 'reconhecimento' ? primaryColor : mutedColor,
                  fontWeight: activeTab === 'reconhecimento' ? '600' : '400',
                  marginLeft: 6
                }}
              >
                Reconhecimento
              </Text>
            </View>
            {activeTab === 'reconhecimento' && (
              <View style={[styles.underline, { backgroundColor: primaryColor }]} />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo Tab: Atividades */}
        <TabsContent value="atividades" style={styles.tabContentContainer}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Estatísticas */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsScrollContent}
            >
              <Badge variant="secondary" style={styles.statBadge}>
                <View style={styles.badgeContent}>
                  <Icon name={List} size={14} color={textColor} />
                  <Text variant="body" style={{ fontWeight: '600', marginLeft: 6 }}>
                    {atividadesCount} Total
                  </Text>
                </View>
              </Badge>
              <Badge variant="secondary" style={styles.statBadge}>
                <View style={styles.badgeContent}>
                  <Icon name={Clock} size={14} color={textColor} />
                  <Text variant="body" style={{ fontWeight: '600', marginLeft: 6 }}>
                    {(atividadesRecentes || []).filter((a: any) => a?.status === 'pendente').length} Pendentes
                  </Text>
                </View>
              </Badge>
              <Badge variant="secondary" style={styles.statBadge}>
                <View style={styles.badgeContent}>
                  <Icon name={CheckCircle2} size={14} color={textColor} />
                  <Text variant="body" style={{ fontWeight: '600', marginLeft: 6 }}>
                    {(atividadesRecentes || []).filter((a: any) => a?.status === 'concluida').length} Concluídas
                  </Text>
                </View>
              </Badge>
            </ScrollView>

            {/* Gráfico de Atividades por Mês */}
            <Card style={styles.chartCard}>
              <Text variant="subtitle" style={{ color: textColor, marginBottom: 16 }}>
                Atividades por Mês
              </Text>
              <BarChart
                data={[
                  { label: 'Jan', value: 12, color: '#93C5FD' },
                  { label: 'Fev', value: 18, color: '#60A5FA' },
                  { label: 'Mar', value: 15, color: '#3B82F6' },
                  { label: 'Abr', value: 22, color: '#2563EB' },
                  { label: 'Mai', value: 20, color: '#1D4ED8' },
                ]}
                config={{
                  height: 200,
                  showLabels: true,
                  animated: true,
                }}
              />
            </Card>

            {/* Lista de Atividades Recentes */}
            <View style={styles.section}>
              <Text variant="subtitle" style={{ color: textColor, marginBottom: 12 }}>
                Atividades Recentes
              </Text>
              {!atividadesRecentes || atividadesRecentes.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Icon name={ClipboardList} size={32} color={mutedColor} />
                  <Text variant="body" style={{ color: mutedColor, marginTop: 12, textAlign: 'center' }}>
                    Nenhuma atividade registrada
                  </Text>
                </Card>
              ) : (
                (atividadesRecentes || [])
                  .filter((atividade: any) => atividade && atividade.id)
                  .map((atividade: any) => (
                    <Card key={atividade.id} style={styles.activityCard}>
                      <View style={styles.activityHeader}>
                        <Text variant="title" style={{ color: textColor, flex: 1 }}>
                          {atividade?.nome || 'Sem nome'}
                        </Text>
                        <Badge variant={atividade?.status === 'concluida' ? 'success' : 'outline'}>
                          {atividade?.status || 'pendente'}
                        </Badge>
                      </View>
                      {atividade?.descricao && (
                        <Text variant="caption" style={{ color: mutedColor, marginTop: 8 }}>
                          {atividade.descricao}
                        </Text>
                      )}
                      <View style={styles.activityFooter}>
                        <View style={styles.activityInfo}>
                          <Icon name={Calendar} size={14} color={mutedColor} />
                          <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                            {atividade?.dataInicio ? (() => {
                              try {
                                const date = new Date(atividade.dataInicio);
                                return isNaN(date.getTime()) ? 'Data inválida' : date.toLocaleDateString('pt-BR');
                              } catch {
                                return 'Data inválida';
                              }
                            })() : 'Sem data'}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  ))
              )}
            </View>
          </ScrollView>
        </TabsContent>

        {/* Conteúdo Tab: Monitoramento */}
        <TabsContent value="monitoramento" style={styles.tabContentContainer}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Estatísticas */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statsScrollContent}
            >
              <Badge variant="secondary" style={styles.statBadge}>
                <View style={styles.badgeContent}>
                  <Icon name={Bug} size={14} color={textColor} />
                  <Text variant="body" style={{ fontWeight: '600', marginLeft: 6 }}>
                    {scoutsCount} Scouts
                  </Text>
                </View>
              </Badge>
              <Badge variant="secondary" style={styles.statBadge}>
                <View style={styles.badgeContent}>
                  <Icon name={AlertTriangle} size={14} color={textColor} />
                  <Text variant="body" style={{ fontWeight: '600', marginLeft: 6 }}>
                    {(scoutsRecentes || []).reduce((acc: number, s: any) => acc + (s?.pragasCount || 0), 0)} Pragas
                  </Text>
                </View>
              </Badge>
              <Badge variant="secondary" style={styles.statBadge}>
                <View style={styles.badgeContent}>
                  <Icon name={CheckCircle2} size={14} color={textColor} />
                  <Text variant="body" style={{ fontWeight: '600', marginLeft: 6 }}>
                    {(scoutsRecentes || []).filter((s: any) => s?.visitado).length} Visitados
                  </Text>
                </View>
              </Badge>
            </ScrollView>

            {/* Gráfico Radar - Análise de Monitoramento */}
            <Card style={styles.chartCard}>
              <Text variant="subtitle" style={{ color: textColor, marginBottom: 16 }}>
                Análise de Monitoramento
              </Text>
              <RadarChart
                data={[
                  { label: 'Cobertura', value: 85 },
                  { label: 'Frequência', value: 72 },
                  { label: 'Precisão', value: 90 },
                  { label: 'Rapidez', value: 68 },
                  { label: 'Eficiência', value: 78 },
                ]}
                config={{
                  height: 250,
                  showLabels: true,
                  animated: true,
                  maxValue: 100,
                }}
              />
            </Card>

            {/* Gráfico Stacked Area - Evolução de Pragas */}
            <Card style={styles.chartCard}>
              <Text variant="subtitle" style={{ color: textColor, marginBottom: 16 }}>
                Evolução de Pragas por Semana
              </Text>
              <StackedAreaChart
                data={[
                  { x: 1, y: [5, 3, 2], label: 'Sem 1' },
                  { x: 2, y: [8, 5, 3], label: 'Sem 2' },
                  { x: 3, y: [12, 7, 4], label: 'Sem 3' },
                  { x: 4, y: [10, 6, 5], label: 'Sem 4' },
                ]}
                colors={['#DBEAFE', '#93C5FD', '#60A5FA']}
                categories={['Praga A', 'Praga B', 'Praga C']}
                config={{
                  height: 200,
                  showGrid: true,
                  showLabels: true,
                  animated: true,
                }}
              />
            </Card>

            {/* Lista de Scouts Recentes */}
            <View style={styles.section}>
              <Text variant="subtitle" style={{ color: textColor, marginBottom: 12 }}>
                Monitoramentos Recentes
              </Text>
              {!scoutsRecentes || scoutsRecentes.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Icon name={Bug} size={32} color={mutedColor} />
                  <Text variant="body" style={{ color: mutedColor, marginTop: 12, textAlign: 'center' }}>
                    Nenhum monitoramento registrado
                  </Text>
                </Card>
              ) : (
                (scoutsRecentes || [])
                  .filter((scout: any) => scout && scout.id)
                  .map((scout: any) => (
                    <Card key={scout.id} style={styles.scoutCard}>
                      <View style={styles.scoutHeader}>
                        <View style={styles.scoutLocation}>
                          <Icon name={MapPin} size={16} color={palette.darkGreen} />
                          <Text variant="body" style={{ color: textColor, marginLeft: 6, flex: 1 }}>
                            {scout?.talhao || 'Sem talhão'}
                          </Text>
                        </View>
                        <Badge variant={scout?.visitado ? 'success' : 'outline'}>
                          {scout?.visitado ? 'Visitado' : 'Pendente'}
                        </Badge>
                      </View>
                      {scout?.pragasCount && scout.pragasCount > 0 && (
                        <View style={styles.scoutInfo}>
                          <Icon name={TrendingUp} size={14} color={palette.gold} />
                          <Text variant="caption" style={{ color: mutedColor, marginLeft: 4 }}>
                            {scout.pragasCount} {scout.pragasCount === 1 ? 'praga' : 'pragas'} detectada{scout.pragasCount > 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </Card>
                  ))
              )}
            </View>
          </ScrollView>
        </TabsContent>

        {/* Conteúdo Tab: Reconhecimento */}
        <TabsContent value="reconhecimento" style={styles.tabContentContainer}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Card style={styles.cameraCard}>
              <View style={[styles.cameraIconContainer, { backgroundColor: primaryColor + '20' }]}>
                <Icon name={Camera} size={48} color={primaryColor} />
              </View>
              <Text variant="title" style={{ color: textColor, marginTop: 16, textAlign: 'center' }}>
                Reconhecimento de Praga
              </Text>
              <Text variant="body" style={{ color: mutedColor, marginTop: 8, textAlign: 'center' }}>
                Tire uma foto da praga para identificação automática
              </Text>
              {/* TODO: Botão para abrir câmera quando implementado */}
            </Card>

            <View style={styles.section}>
              <Text variant="subtitle" style={{ color: textColor, marginBottom: 12 }}>
                Histórico de Reconhecimentos
              </Text>
              <Card style={styles.emptyCard}>
                <Icon name={Camera} size={32} color={mutedColor} />
                <Text variant="body" style={{ color: mutedColor, marginTop: 12, textAlign: 'center' }}>
                  Nenhum reconhecimento realizado
                </Text>
              </Card>
            </View>
          </ScrollView>
        </TabsContent>
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.darkGreen + '20',
  },
  statusDot: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBar: {
    width: 8,
    height: 2,
    borderRadius: 1,
  },
  syncContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  syncCard: {
    marginBottom: 0,
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
  tabsContainer: {
    flex: 1,
  },
  tabsList: {
    paddingHorizontal: 24,
    backgroundColor: 'transparent',
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
    marginBottom: 0,
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
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  statsScrollContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
    marginTop: 16,
    marginBottom: 24,
  },
  statBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  badgeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    minHeight: 200,
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
  cameraCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 16,
    marginBottom: 24,
    minHeight: 200,
  },
  cameraIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartCard: {
    marginBottom: 16,
    padding: 16,
  },
});
