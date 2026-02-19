import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { ClipboardList, Camera, Bug, CheckCircle2, Maximize2, X, MapPin, Calendar, Wheat, Sprout, Flower2, Leaf, Award, Gauge, AlertTriangle, AlertCircle, BarChart2, type LucideIcon } from 'lucide-react-native';
import { useSupabaseActivities, useSupabasePlots, useRecentScoutsWithPests, useFarmHealth, fetchTalhaoMonitoramentoDetail, type ScoutWithPestsSummary, type SupabaseActivity, type AtividadeTipo } from '@/hooks/use-supabase-data';
import type { CulturaTalhaoEnum } from '@/types/supabase';
import { useAppStore } from '@/stores/app-store';
import { useEffectiveAvatarUri } from '@/stores/auth-store';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { BottomSheet } from '@/components/ui/bottom-sheet-simple';
import { MonitoramentoDetailSheet, type MonitoramentoDetailPraga } from '@/components/monitoramento-detail-sheet';
import { TaskDetailSheet, type AtividadeDetalhes } from '@/components/task-detail-sheet';
import { Heatmap, type HeatmapMapType } from '@/components/maps/heatmap';
import { AppHeader } from '@/components/app-header';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { palette } from '@/theme/colors';
import { supabase, isSupabaseConfigured } from '@/services/supabase';

const HEADER_GREEN = palette.darkGreen; // Verde padrão do app (light); no dark mantém para identidade
const CONTENT_PADDING = 20;
const MAX_ATIVIDADES_NO_CARD = 5;
const MAX_MONITORAMENTOS_NO_CARD = 5;

const TIPOS_ATIVIDADE: { value: AtividadeTipo; label: string }[] = [
  { value: 'MONITORAMENTO', label: 'Monitoramento' },
  { value: 'APLICACAO', label: 'Aplicação' },
  { value: 'CONTROLE_PRAGAS', label: 'Controle de Pragas' },
  { value: 'VERIFICACAO', label: 'Verificação' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'OUTROS', label: 'Outros' },
];

type SaudeLabel = 'Excelente' | 'Boa' | 'Regular' | 'Atenção' | 'Crítica' | 'Sem dados';
const SAUDE_STYLE: Record<SaudeLabel, { icon: LucideIcon; color: string }> = {
  Excelente: { icon: Award, color: '#86efac' },
  Boa: { icon: CheckCircle2, color: '#bbf7d0' },
  Regular: { icon: Gauge, color: '#fde047' },
  Atenção: { icon: AlertTriangle, color: '#fdba74' },
  Crítica: { icon: AlertCircle, color: '#fca5a5' },
  'Sem dados': { icon: BarChart2, color: 'rgba(255,255,255,0.7)' },
};
function getSaudeStyle(label: string): { icon: LucideIcon; color: string } {
  return SAUDE_STYLE[label as SaudeLabel] ?? SAUDE_STYLE['Sem dados'];
}

function formatActivityDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function getSituacaoStyle(situacao: string, isDark?: boolean): { iconBg: string; iconLabel: string } {
  const dark = !!isDark;
  switch (situacao) {
    case 'CONCLUIDA':
      return { iconBg: dark ? '#22c55e' : '#16a34a', iconLabel: 'C' };
    case 'EM_ANDAMENTO':
      return { iconBg: dark ? '#60a5fa' : '#3B7DD8', iconLabel: 'E' };
    default:
      return { iconBg: dark ? '#facc15' : '#D4A617', iconLabel: 'P' }; // PENDENTE
  }
}

function getSituacaoLabel(situacao: string): string {
  switch (situacao) {
    case 'CONCLUIDA': return 'Concluída';
    case 'EM_ANDAMENTO': return 'Em andamento';
    default: return 'Pendente';
  }
}

/** Ícone do talhão conforme a cultura (enum preferido; fallback em texto livre). */
function getCulturaIcon(cultura: CulturaTalhaoEnum | string | null | undefined): LucideIcon {
  if (cultura == null || cultura === '') return Sprout;
  switch (cultura) {
    case 'TRIGO': return Wheat;
    case 'MILHO': return Sprout;
    case 'ALGODAO': return Flower2;
    case 'SOJA': return Leaf;
    case 'CAFE': return Leaf;
    case 'FEIJAO': return Leaf;
    case 'OUTROS': return Sprout;
    default:
      if (typeof cultura !== 'string') return Sprout;
      const c = cultura.toLowerCase().trim();
      if (c.includes('trigo')) return Wheat;
      if (c.includes('milho')) return Sprout;
      if (c.includes('algodão') || c.includes('algodao')) return Flower2;
      if (c.includes('soja')) return Leaf;
      if (c.includes('café') || c.includes('cafe')) return Leaf;
      if (c.includes('feijão') || c.includes('feijao')) return Leaf;
      return Sprout;
  }
}

type SheetPayload =
  | { mode: 'scout'; title: string; talhaoArea?: number; talhaoCulturaAtual?: string; percentualInfestacao?: number; latitude?: number; longitude?: number; visitado: boolean; dataVisita?: string; pragas: MonitoramentoDetailPraga[]; pestsLoading?: boolean; observacoes?: string; synced: boolean; onClose?: () => void }
  | { mode: 'talhao'; title: string; talhaoId?: number; talhaoArea?: number; talhaoCulturaAtual?: string; percentualInfestacao?: number; latitude?: number; longitude?: number; observacoes?: string; pragas: MonitoramentoDetailPraga[]; pestsLoading?: boolean; onClose?: () => void };

export default function InicioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [mapFullscreenVisible, setMapFullscreenVisible] = useState(false);
  const [heatmapMapType, setHeatmapMapType] = useState<HeatmapMapType>('satellite');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetPayload, setSheetPayload] = useState<SheetPayload | null>(null);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [selectedAtividade, setSelectedAtividade] = useState<SupabaseActivity | null>(null);
  const avatarUri = useEffectiveAvatarUri();
  const { plots } = useSupabasePlots();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const screenHeight = Dimensions.get('window').height;
  const isOnline = useAppStore((s) => s.isOnline);
  const fazenda = useAuthFazendaPadrao();
  const { activities, refresh: refreshActivities } = useSupabaseActivities();
  const { scouts: monitoramentosComPragas, refresh: refreshMonitoramentos } = useRecentScoutsWithPests(MAX_MONITORAMENTOS_NO_CARD);
  const { label: saudeFazenda, isLoading: saudeLoading, refresh: refreshSaude } = useFarmHealth();
  const saudeStyle = !saudeLoading ? getSaudeStyle(saudeFazenda) : null;
  const atividadesExibir = activities.slice(0, MAX_ATIVIDADES_NO_CARD);

  const detailTask = useMemo((): AtividadeDetalhes | null => {
    if (!selectedAtividade) return null;
    const firstTalhaoId = selectedAtividade.talhaoIds?.length ? selectedAtividade.talhaoIds[0] : undefined;
    return {
      id: selectedAtividade.id,
      nome: selectedAtividade.titulo,
      descricao: selectedAtividade.descricao,
      tipo: selectedAtividade.tipo ?? 'OUTROS',
      status: (selectedAtividade.situacao ?? 'PENDENTE').toLowerCase(),
      plotId: firstTalhaoId != null ? String(firstTalhaoId) : undefined,
      talhaoNome: firstTalhaoId != null ? plots.find((p) => p.id === firstTalhaoId)?.nome : undefined,
      dataInicio: selectedAtividade.dataInicio ?? selectedAtividade.createdAt,
      createdAt: selectedAtividade.createdAt,
      synced: true,
    };
  }, [selectedAtividade, plots]);

  const [isTogglingInicio, setIsTogglingInicio] = useState(false);
  const [isDeletingInicio, setIsDeletingInicio] = useState(false);

  const handleInicioToggleStatus = useCallback(async () => {
    if (!detailTask || !isSupabaseConfigured() || !supabase) return;
    try {
      setIsTogglingInicio(true);
      const newStatus = detailTask.status === 'concluida' ? 'pendente' : 'concluida';
      await supabase
        .from('atividades')
        .update({ situacao: newStatus === 'concluida' ? 'CONCLUIDA' : 'PENDENTE', updated_at: new Date().toISOString() })
        .eq('id', Number(detailTask.id));
      await refreshActivities();
    } finally {
      setIsTogglingInicio(false);
    }
  }, [detailTask, refreshActivities]);

  const handleInicioEdit = useCallback(() => {
    setTaskDetailVisible(false);
    setSelectedAtividade(null);
    router.push('/(tabs)/atividades');
  }, [router]);

  const handleInicioDelete = useCallback(() => {
    if (!detailTask) return;
    Alert.alert(
      'Excluir tarefa',
      `Tem certeza que deseja excluir "${detailTask.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            if (!isSupabaseConfigured() || !supabase) return;
            try {
              setIsDeletingInicio(true);
              await supabase.from('atividades').update({ deleted_at: new Date().toISOString() }).eq('id', Number(detailTask.id));
              await refreshActivities();
              setTaskDetailVisible(false);
              setSelectedAtividade(null);
            } finally {
              setIsDeletingInicio(false);
            }
          },
        },
      ]
    );
  }, [detailTask, refreshActivities]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshActivities(), refreshMonitoramentos(), refreshSaude()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshActivities, refreshMonitoramentos, refreshSaude]);

  const heatmapSwitcherBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const heatmapSwitcherActiveBg = isDark ? 'rgba(255,255,255,0.25)' : HEADER_GREEN;
  const heatmapSwitcherActiveText = '#fff';
  const monitoramentoIconColor = isDark ? '#86efac' : HEADER_GREEN;
  const monitoramentoIconBg = isDark ? 'rgba(134,239,172,0.18)' : 'rgba(22, 163, 74, 0.12)';
  const cardAccentIconColor = isDark ? '#fff' : HEADER_GREEN;

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.pullRefreshGreen} pointerEvents="none" />
      {refreshing && (
        <View style={styles.refreshOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" style={styles.refreshSpinner} />
        </View>
      )}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 60 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
            colors={['#fff']}
            progressViewOffset={9999}
          />
        }
      >
        <AppHeader
          title={fazenda?.nome ?? 'Fazenda'}
          avatarUri={avatarUri}
          onAvatarPress={() => router.push('/(tabs)/perfil')}
          isOnline={isOnline}
          showDuvidasButton
        >
          {saudeLoading ? (
            <View style={styles.saudeSkeleton} />
          ) : (
            <View style={styles.saudeRow}>
              <Icon name={saudeStyle!.icon} size={32} color={saudeStyle!.color} style={styles.saudeIcon} />
              <Text style={[styles.balanceAmount, { color: saudeStyle!.color }]}>
                {saudeFazenda === 'Sem dados' ? 'Nenhum' : saudeFazenda}
              </Text>
            </View>
          )}
          <View style={styles.balanceBadge}>
            <Text style={styles.balanceLabelText}>Saúde geral da fazenda</Text>
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.actionButton}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/atividades?openForm=true')}
            >
              <Icon name={ClipboardList} size={22} color="#fff" />
              <Text style={styles.actionButtonText}>Nova tarefa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonPrimary]}
              activeOpacity={0.8}
              onPress={() => router.push('/(tabs)/reconhecimento')}
            >
              <Icon name={Camera} size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Escanear</Text>
            </TouchableOpacity>
          </View>
        </AppHeader>

        <View style={[styles.contentContainer, styles.firstCardOverlap, styles.cardsWrapper]}>
          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <Text style={[styles.cardTitle, { color: mutedColor }]}>TAREFAS RECENTES</Text>
            {atividadesExibir.length === 0 ? (
              <View style={styles.emptyTransactions}>
                <Text style={[styles.emptyTransactionsText, { color: mutedColor }]}>Nenhuma tarefa recente</Text>
              </View>
            ) : (
              atividadesExibir.map((atv, index) => {
                const { iconBg, iconLabel } = getSituacaoStyle(atv.situacao, isDark);
                const talhaoNome = atv.talhaoIds?.length ? plots.find(p => p.id === atv.talhaoIds?.[0])?.nome : undefined;
                const tipoLabel = TIPOS_ATIVIDADE.find(t => t.value === atv.tipo)?.label ?? atv.tipo ?? '—';
                return (
                  <TouchableOpacity
                    key={atv.id}
                    style={[
                      styles.transactionRow,
                      { borderBottomColor: borderColor },
                      index === atividadesExibir.length - 1 && styles.transactionRowLast,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      setSelectedAtividade(atv);
                      setTaskDetailVisible(true);
                    }}
                  >
                    <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
                      <Text style={styles.txIconText}>{iconLabel}</Text>
                    </View>
                    <View style={styles.txContent}>
                      <Text style={[styles.txName, { color: textColor }]} numberOfLines={1}>{atv.titulo}</Text>
                      <Text style={[styles.txDate, { color: mutedColor }]}>
                        {formatActivityDate(atv.createdAt)}
                        {talhaoNome ? ` · ${talhaoNome}` : ''}
                      </Text>
                    </View>
                    <View style={styles.txAmounts}>
                      <Text style={[styles.txAmountUsdc, { color: textColor }]}>{getSituacaoLabel(atv.situacao)}</Text>
                      <Text style={[styles.txAmountFiat, { color: mutedColor }]}>{tipoLabel}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <TouchableOpacity
              style={styles.viewAllLink}
              activeOpacity={0.7}
              onPress={() => router.push('/(tabs)/atividades')}
            >
              <Text style={[styles.viewAllLinkText, { color: primaryColor }]}>Ver todas as tarefas</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <Text style={[styles.cardTitle, { color: mutedColor }]}>MONITORAMENTOS RECENTES COM PRAGAS</Text>
            {monitoramentosComPragas.length === 0 ? (
              <View style={styles.emptyMonitoramentos}>
                <Icon name={Bug} size={32} color={mutedColor} />
                <Text style={[styles.emptyMonitoramentosText, { color: mutedColor }]}>Nenhum monitoramento com pragas identificadas</Text>
              </View>
            ) : (
              <>
                {monitoramentosComPragas.map((scout, index) => (
                  <TouchableOpacity
                    key={scout.talhaoId ?? scout.id}
                    style={[
                      styles.monitoramentoRow,
                      { borderBottomColor: borderColor },
                      index === monitoramentosComPragas.length - 1 && styles.monitoramentoRowLast,
                    ]}
                    activeOpacity={0.7}
                    onPress={async () => {
                      const title = scout.talhaoNome ?? scout.nome ?? 'Talhão';
                      const onClose = () => setSheetVisible(false);
                      if (scout.talhaoId != null) {
                        setSheetPayload({
                          mode: 'talhao',
                          title,
                          talhaoId: scout.talhaoId,
                          percentualInfestacao: scout.percentualInfestacao,
                          pragas: [],
                          pestsLoading: true,
                          onClose,
                        });
                        setSheetVisible(true);
                        const payload = await fetchTalhaoMonitoramentoDetail(scout.talhaoId, title, onClose);
                        if (payload) setSheetPayload(payload);
                      } else {
                        setSheetPayload({
                          mode: 'talhao',
                          title,
                          talhaoArea: scout.talhaoArea,
                          talhaoCulturaAtual: scout.talhaoCulturaAtual,
                          percentualInfestacao: scout.percentualInfestacao,
                          latitude: scout.latitude,
                          longitude: scout.longitude,
                          observacoes: scout.observacoes,
                          pragas: scout.pragas ?? [],
                          onClose,
                        });
                        setSheetVisible(true);
                      }
                    }}
                  >
                    <View style={[styles.monitoramentoIcon, { backgroundColor: monitoramentoIconBg }]}>
                      <Icon name={getCulturaIcon(scout.cultura ?? scout.talhaoCulturaAtual)} size={20} color={monitoramentoIconColor} />
                    </View>
                    <View style={styles.monitoramentoContent}>
                      <Text style={styles.monitoramentoTitleRow} numberOfLines={1}>
                        <Text style={[styles.monitoramentoNome, { color: textColor }]}>
                          {scout.talhaoNome || scout.nome || `Ponto #${scout.id}`}
                        </Text>
                        {scout.talhaoCulturaAtual ? (
                          <>
                            <Text style={[styles.monitoramentoBullet, { color: mutedColor }]}> • </Text>
                            <Text style={[styles.monitoramentoCultura, { color: mutedColor }]}>{scout.talhaoCulturaAtual}</Text>
                          </>
                        ) : null}
                        {scout.percentualInfestacao != null && scout.percentualInfestacao > 0 ? (
                          <>
                            <Text style={[styles.monitoramentoBullet, { color: mutedColor }]}> • </Text>
                            <Text style={styles.monitoramentoPercentual}>{Number(scout.percentualInfestacao).toFixed(1)}% infestação</Text>
                          </>
                        ) : null}
                      </Text>
                      <Text style={[styles.monitoramentoMeta, { color: mutedColor }]}>
                        {formatActivityDate(scout.createdAt)} · {scout.totalPragas} {scout.totalPragas === 1 ? 'praga' : 'pragas'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.viewAllLink}
                  activeOpacity={0.7}
                  onPress={() => router.push('/(tabs)/monitoramento')}
                >
                  <Text style={[styles.viewAllLinkText, { color: primaryColor }]}>Ver todos os monitoramentos</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: cardColor }]}>
            <View style={styles.heatmapTitleRow}>
              <Text style={[styles.cardTitle, styles.heatmapCardTitleInline, { color: mutedColor }]}>MAPA DE PRAGAS</Text>
              <View style={[styles.heatmapSwitcher, { backgroundColor: heatmapSwitcherBg }]}>
                <TouchableOpacity
                  style={[styles.heatmapSwitcherBtn, heatmapMapType === 'satellite' && { backgroundColor: heatmapSwitcherActiveBg }]}
                  onPress={() => setHeatmapMapType('satellite')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.heatmapSwitcherText, { color: mutedColor }, heatmapMapType === 'satellite' && { color: heatmapSwitcherActiveText }]}>Satélite</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heatmapSwitcherBtn, heatmapMapType === 'street' && { backgroundColor: heatmapSwitcherActiveBg }]}
                  onPress={() => setHeatmapMapType('street')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.heatmapSwitcherText, { color: mutedColor }, heatmapMapType === 'street' && { color: heatmapSwitcherActiveText }]}>Mapa</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setMapFullscreenVisible(true)}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name={Maximize2} size={14} color={cardAccentIconColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.heatmapWrapper}>
              <Heatmap height={280} mapType={heatmapMapType} />
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={mapFullscreenVisible}
        animationType="fade"
        onRequestClose={() => setMapFullscreenVisible(false)}
      >
        <View style={[styles.mapFullscreenContainer, { backgroundColor: isDark ? backgroundColor : '#1a1a1a' }]}>
          <TouchableOpacity
            style={[styles.mapFullscreenClose, { paddingTop: insets.top + 12 }]}
            onPress={() => setMapFullscreenVisible(false)}
            activeOpacity={0.8}
          >
            <Icon name={X} size={24} color="#fff" />
            <Text style={styles.mapFullscreenCloseText}>Fechar</Text>
          </TouchableOpacity>
          <View style={styles.mapFullscreenMap}>
            <Heatmap height={Math.max(280, screenHeight - insets.top - 68)} mapType={heatmapMapType} />
          </View>
        </View>
      </Modal>

      {sheetPayload != null && (
        <BottomSheet
          isVisible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          title={sheetPayload.title}
        >
          <MonitoramentoDetailSheet
            talhaoArea={sheetPayload.talhaoArea}
            talhaoCulturaAtual={sheetPayload.talhaoCulturaAtual}
            percentualInfestacao={sheetPayload.percentualInfestacao}
            latitude={sheetPayload.latitude}
            longitude={sheetPayload.longitude}
            visitado={sheetPayload.mode === 'scout' ? sheetPayload.visitado : undefined}
            dataVisita={sheetPayload.mode === 'scout' ? sheetPayload.dataVisita : undefined}
            pragas={sheetPayload.pragas}
            pestsLoading={sheetPayload.pestsLoading}
            observacoes={sheetPayload.observacoes}
            synced={sheetPayload.mode === 'scout' ? sheetPayload.synced : undefined}
            onClose={sheetPayload.onClose ?? (() => setSheetVisible(false))}
          />
        </BottomSheet>
      )}

      <TaskDetailSheet
        isVisible={taskDetailVisible}
        onClose={() => { setTaskDetailVisible(false); setSelectedAtividade(null); }}
        task={detailTask}
        onToggleStatus={handleInicioToggleStatus}
        onEdit={handleInicioEdit}
        onDelete={handleInicioDelete}
        isToggling={isTogglingInicio}
        isDeleting={isDeletingInicio}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F0', // fallback light; override inline por tema
  },
  pullRefreshGreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    backgroundColor: HEADER_GREEN,
    zIndex: 0,
  },
  refreshOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: HEADER_GREEN,
    zIndex: 2,
    paddingTop: 56,
    alignItems: 'center',
  },
  refreshSpinner: {},
  contentContainer: {
    paddingHorizontal: CONTENT_PADDING,
  },
  cardsWrapper: {
    gap: 16,
  },
  saudeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 10,
  },
  saudeIcon: {
    marginRight: 2,
  },
  saudeSkeleton: {
    width: 220,
    height: 40,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 0,
  },
  balanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  balanceLabelText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'stretch',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  actionButtonPrimary: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  scroll: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    gap: 16,
  },
  firstCardOverlap: {
    marginTop: -48,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  heatmapTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
    width: '100%',
  },
  heatmapCardTitleInline: {
    marginBottom: 0,
  },
  heatmapSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 999,
    padding: 2,
  },
  heatmapSwitcherBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heatmapSwitcherText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  heatmapWrapper: {
    position: 'relative',
  },
  mapFullscreenContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  mapFullscreenClose: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  mapFullscreenCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mapFullscreenMap: {
    flex: 1,
  },
  emptyTransactions: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTransactionsText: {
    fontSize: 15,
    color: '#71717a',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txIconText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  txContent: {
    flex: 1,
  },
  txName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  txDate: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 2,
  },
  txAmounts: {
    alignItems: 'flex-end',
  },
  txAmountUsdc: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  txAmountPositive: {
    color: HEADER_GREEN,
  },
  txAmountFiat: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 2,
  },
  transactionRowLast: {
    borderBottomWidth: 0,
  },
  viewAllLink: {
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  viewAllLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: HEADER_GREEN,
    textDecorationLine: 'underline',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717a',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  emptyMonitoramentos: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  emptyMonitoramentosText: {
    fontSize: 14,
    color: '#71717a',
    textAlign: 'center',
  },
  monitoramentoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  monitoramentoRowLast: {
    borderBottomWidth: 0,
  },
  monitoramentoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  monitoramentoContent: {
    flex: 1,
  },
  monitoramentoTitleRow: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  monitoramentoNome: {
    fontWeight: '600',
    color: '#000',
  },
  monitoramentoBullet: {
    color: '#a1a1aa',
    fontWeight: '400',
  },
  monitoramentoCultura: {
    fontSize: 13,
    fontWeight: '400',
    color: '#71717a',
  },
  monitoramentoPercentual: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  monitoramentoMeta: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 2,
  },
});
