import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Pressable,
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
import { HelpCircle, ClipboardList, Camera, Bug, CheckCircle2, Maximize2, X, MapPin, Calendar, Wheat, Sprout, Flower2, Leaf, Award, Gauge, AlertTriangle, AlertCircle, BarChart2, type LucideIcon } from 'lucide-react-native';
import { useSupabaseActivities, useSupabasePlots, useRecentScoutsWithPests, useFarmHealth, fetchTalhaoMonitoramentoDetail, type ScoutWithPestsSummary, type SupabaseActivity, type AtividadeTipo } from '@/hooks/use-supabase-data';
import type { CulturaTalhaoEnum } from '@/types/supabase';
import { useAvatarUri, useAppStore } from '@/stores/app-store';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { BottomSheet } from '@/components/ui/bottom-sheet-simple';
import { MonitoramentoDetailSheet, type MonitoramentoDetailPraga } from '@/components/monitoramento-detail-sheet';
import { Heatmap, type HeatmapMapType } from '@/components/maps/heatmap';
import { useColor } from '@/hooks/useColor';
import { palette } from '@/theme/colors';

const HEADER_GREEN = palette.darkGreen; // Verde padrão do app (#0e270a)
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

const WHATSAPP_NUMBER = '556681358930'; // +55 66 8135-8930

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

const DUVIDAS_OPCOES: { label: string; message: string }[] = [
  { label: 'Tarefas e Atividades', message: 'Olá! Tenho dúvida sobre o módulo de Tarefas e Atividades do app Agritech.' },
  { label: 'Monitoramento de pragas', message: 'Olá! Tenho dúvida sobre o Monitoramento de pragas e pontos de coleta.' },
  { label: 'Reconhecimento de pragas (Scanner)', message: 'Olá! Tenho dúvida sobre o Reconhecimento de pragas pelo Scanner/IA.' },
  { label: 'Saúde da fazenda', message: 'Olá! Tenho dúvida sobre o indicador de Saúde da fazenda e como é calculado.' },
  { label: 'Relatórios', message: 'Olá! Tenho dúvida sobre a geração de Relatórios em PDF.' },
  { label: 'Mapa de calor', message: 'Olá! Tenho dúvida sobre o Mapa de calor de pragas.' },
  { label: 'Outra dúvida', message: 'Olá! Gostaria de tirar uma dúvida sobre o app Agritech.' },
];

function formatActivityDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function getSituacaoStyle(situacao: string): { iconBg: string; iconLabel: string } {
  switch (situacao) {
    case 'CONCLUIDA':
      return { iconBg: '#16a34a', iconLabel: 'C' };
    case 'EM_ANDAMENTO':
      return { iconBg: '#3B7DD8', iconLabel: 'E' };
    default:
      return { iconBg: '#D4A617', iconLabel: 'P' }; // PENDENTE
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
  const [duvidasModalVisible, setDuvidasModalVisible] = useState(false);
  const [selectedDuvida, setSelectedDuvida] = useState<typeof DUVIDAS_OPCOES[0] | null>(null);
  const [mapFullscreenVisible, setMapFullscreenVisible] = useState(false);
  const [heatmapMapType, setHeatmapMapType] = useState<HeatmapMapType>('satellite');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetPayload, setSheetPayload] = useState<SheetPayload | null>(null);
  const [taskDetailVisible, setTaskDetailVisible] = useState(false);
  const [selectedAtividade, setSelectedAtividade] = useState<SupabaseActivity | null>(null);
  const avatarUri = useAvatarUri();
  const { plots } = useSupabasePlots();
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshActivities(), refreshMonitoramentos(), refreshSaude()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshActivities, refreshMonitoramentos, refreshSaude]);

  const openWhatsApp = useCallback((message: string) => {
    setDuvidasModalVisible(false);
    setSelectedDuvida(null);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {});
  }, []);

  const handleConfirmarDuvida = useCallback(() => {
    if (selectedDuvida) openWhatsApp(selectedDuvida.message);
  }, [selectedDuvida, openWhatsApp]);

  const closeDuvidasModal = useCallback(() => {
    setDuvidasModalVisible(false);
    setSelectedDuvida(null);
  }, []);

  return (
    <View style={styles.container}>
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
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.contentContainer}>
            <View style={styles.headerRow}>
              <View style={styles.headerSide}>
                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/perfil')}
                  activeOpacity={0.7}
                  style={styles.avatarContainer}
                >
                  <Image
                    source={avatarUri ? { uri: avatarUri } : require('../../../assets/images/avatar.jpg')}
                    style={styles.avatar}
                    resizeMode="cover"
                  />
                  <View
                    style={[
                      styles.statusDot,
                      {
                        backgroundColor: isOnline ? '#10B981' : '#9CA3AF',
                        borderColor: HEADER_GREEN,
                      },
                    ]}
                  >
                    {!isOnline && <View style={[styles.offlineBar, { backgroundColor: HEADER_GREEN }]} />}
                  </View>
                </TouchableOpacity>
              </View>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {fazenda?.nome ?? 'Fazenda'}
              </Text>
              <View style={styles.headerSide}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => setDuvidasModalVisible(true)}
                >
                  <Icon name={HelpCircle} size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroSection}>
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
            </View>
          </View>
        </View>

        <View style={[styles.contentContainer, styles.firstCardOverlap, styles.cardsWrapper]}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>TAREFAS RECENTES</Text>
            {atividadesExibir.length === 0 ? (
              <View style={styles.emptyTransactions}>
                <Text style={styles.emptyTransactionsText}>Nenhuma tarefa recente</Text>
              </View>
            ) : (
              atividadesExibir.map((atv, index) => {
                const { iconBg, iconLabel } = getSituacaoStyle(atv.situacao);
                const talhaoNome = atv.talhaoIds?.length ? plots.find(p => p.id === atv.talhaoIds?.[0])?.nome : undefined;
                const tipoLabel = TIPOS_ATIVIDADE.find(t => t.value === atv.tipo)?.label ?? atv.tipo ?? '—';
                return (
                  <TouchableOpacity
                    key={atv.id}
                    style={[
                      styles.transactionRow,
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
                      <Text style={styles.txName} numberOfLines={1}>{atv.titulo}</Text>
                      <Text style={styles.txDate}>
                        {formatActivityDate(atv.createdAt)}
                        {talhaoNome ? ` · ${talhaoNome}` : ''}
                      </Text>
                    </View>
                    <View style={styles.txAmounts}>
                      <Text style={styles.txAmountUsdc}>{getSituacaoLabel(atv.situacao)}</Text>
                      <Text style={styles.txAmountFiat}>{tipoLabel}</Text>
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
              <Text style={styles.viewAllLinkText}>Ver todas as tarefas</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>MONITORAMENTOS RECENTES COM PRAGAS</Text>
            {monitoramentosComPragas.length === 0 ? (
              <View style={styles.emptyMonitoramentos}>
                <Icon name={Bug} size={32} color="#71717a" />
                <Text style={styles.emptyMonitoramentosText}>Nenhum monitoramento com pragas identificadas</Text>
              </View>
            ) : (
              <>
                {monitoramentosComPragas.map((scout, index) => (
                  <TouchableOpacity
                    key={scout.talhaoId ?? scout.id}
                    style={[
                      styles.monitoramentoRow,
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
                    <View style={styles.monitoramentoIcon}>
                      <Icon name={getCulturaIcon(scout.cultura ?? scout.talhaoCulturaAtual)} size={20} color={HEADER_GREEN} />
                    </View>
                    <View style={styles.monitoramentoContent}>
                      <Text style={styles.monitoramentoTitleRow} numberOfLines={1}>
                        <Text style={styles.monitoramentoNome}>
                          {scout.talhaoNome || scout.nome || `Ponto #${scout.id}`}
                        </Text>
                        {scout.talhaoCulturaAtual ? (
                          <>
                            <Text style={styles.monitoramentoBullet}> • </Text>
                            <Text style={styles.monitoramentoCultura}>{scout.talhaoCulturaAtual}</Text>
                          </>
                        ) : null}
                        {scout.percentualInfestacao != null && scout.percentualInfestacao > 0 ? (
                          <>
                            <Text style={styles.monitoramentoBullet}> • </Text>
                            <Text style={styles.monitoramentoPercentual}>{Number(scout.percentualInfestacao).toFixed(1)}% infestação</Text>
                          </>
                        ) : null}
                      </Text>
                      <Text style={styles.monitoramentoMeta}>
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
                  <Text style={styles.viewAllLinkText}>Ver todos os monitoramentos</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.heatmapTitleRow}>
              <Text style={[styles.cardTitle, styles.heatmapCardTitleInline]}>MAPA DE PRAGAS</Text>
              <View style={styles.heatmapSwitcher}>
                <TouchableOpacity
                  style={[styles.heatmapSwitcherBtn, heatmapMapType === 'satellite' && styles.heatmapSwitcherBtnActive]}
                  onPress={() => setHeatmapMapType('satellite')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.heatmapSwitcherText, heatmapMapType === 'satellite' && styles.heatmapSwitcherTextActive]}>Satélite</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.heatmapSwitcherBtn, heatmapMapType === 'street' && styles.heatmapSwitcherBtnActive]}
                  onPress={() => setHeatmapMapType('street')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.heatmapSwitcherText, heatmapMapType === 'street' && styles.heatmapSwitcherTextActive]}>Mapa</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setMapFullscreenVisible(true)}
                activeOpacity={0.8}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name={Maximize2} size={14} color={HEADER_GREEN} />
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
        <View style={styles.mapFullscreenContainer}>
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

      <Modal
        visible={duvidasModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDuvidasModal}
      >
        <Pressable style={styles.modalBackdrop} onPress={closeDuvidasModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Em qual módulo você tem dúvida?</Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {DUVIDAS_OPCOES.map((op) => {
                const isSelected = selectedDuvida?.label === op.label;
                return (
                  <TouchableOpacity
                    key={op.label}
                    style={[
                      styles.modalOption,
                      isSelected && { backgroundColor: HEADER_GREEN + '18', borderWidth: 1.5, borderColor: HEADER_GREEN },
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setSelectedDuvida(op)}
                  >
                    <Icon name={HelpCircle} size={18} color={HEADER_GREEN} />
                    <Text style={styles.modalOptionText}>{op.label}</Text>
                    {isSelected && <Icon name={CheckCircle2} size={20} color={HEADER_GREEN} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[
                styles.modalConfirmBtn,
                { backgroundColor: HEADER_GREEN, opacity: selectedDuvida ? 1 : 0.5 },
              ]}
              activeOpacity={0.7}
              onPress={handleConfirmarDuvida}
              disabled={!selectedDuvida}
            >
              <Text style={styles.modalConfirmText}>Confirmar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalCancelBtn, { borderColor: HEADER_GREEN }]}
              activeOpacity={0.7}
              onPress={closeDuvidasModal}
            >
              <Text style={[styles.modalCancelText, { color: HEADER_GREEN }]}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
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

      {/* Bottom sheet: detalhes da tarefa (só leitura) */}
      <BottomSheet
        isVisible={taskDetailVisible}
        onClose={() => { setTaskDetailVisible(false); setSelectedAtividade(null); }}
        title={selectedAtividade?.titulo ?? 'Detalhes da Tarefa'}
      >
        {selectedAtividade && (
          <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingHorizontal: 4, paddingBottom: 24 }}>
              <View style={[styles.detailStatusCardInicio, {
                backgroundColor: selectedAtividade.situacao === 'CONCLUIDA' ? '#10B98115' :
                  selectedAtividade.situacao === 'EM_ANDAMENTO' ? '#F59E0B15' : primaryColor + '15',
              }]}>
                <Icon
                  name={selectedAtividade.situacao === 'CONCLUIDA' ? CheckCircle2 : Calendar}
                  size={22}
                  color={selectedAtividade.situacao === 'CONCLUIDA' ? '#10B981' :
                    selectedAtividade.situacao === 'EM_ANDAMENTO' ? '#F59E0B' : primaryColor}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.detailStatusLabelInicio, {
                    color: selectedAtividade.situacao === 'CONCLUIDA' ? '#10B981' :
                      selectedAtividade.situacao === 'EM_ANDAMENTO' ? '#F59E0B' : primaryColor,
                  }]}>
                    {getSituacaoLabel(selectedAtividade.situacao)}
                  </Text>
                  <Text style={[styles.detailDateInicio, { color: mutedColor }]}>
                    Criada em {new Date(selectedAtividade.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>

              {selectedAtividade.descricao ? (
                <View style={[styles.detailSectionInicio, { borderColor }]}>
                  <View style={styles.detailSectionHeaderInicio}>
                    <Icon name={ClipboardList} size={16} color={primaryColor} />
                    <Text style={[styles.detailSectionTitleInicio, { color: textColor }]}>Descrição</Text>
                  </View>
                  <Text style={[styles.detailSectionContentInicio, { color: textColor }]}>
                    {selectedAtividade.descricao}
                  </Text>
                </View>
              ) : null}

              <View style={[styles.detailSectionInicio, { borderColor }]}>
                <View style={styles.detailSectionHeaderInicio}>
                  <Icon name={CheckCircle2} size={16} color={palette.gold} />
                  <Text style={[styles.detailSectionTitleInicio, { color: textColor }]}>Tipo</Text>
                </View>
                <Text style={[styles.detailSectionContentInicio, { color: textColor }]}>
                  {TIPOS_ATIVIDADE.find(t => t.value === selectedAtividade.tipo)?.label ?? selectedAtividade.tipo ?? '—'}
                </Text>
              </View>

              <View style={[styles.detailSectionInicio, { borderColor }]}>
                <View style={styles.detailSectionHeaderInicio}>
                  <Icon name={MapPin} size={16} color={primaryColor} />
                  <Text style={[styles.detailSectionTitleInicio, { color: textColor }]}>Talhão</Text>
                </View>
                <Text style={[styles.detailSectionContentInicio, { color: textColor }]}>
                  {selectedAtividade.talhaoIds?.length
                    ? selectedAtividade.talhaoIds.map(id => plots.find(p => p.id === id)?.nome).filter(Boolean).join(', ') || '—'
                    : 'Não definido'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.verTarefasBtn, { backgroundColor: HEADER_GREEN }]}
                activeOpacity={0.8}
                onPress={() => {
                  setTaskDetailVisible(false);
                  setSelectedAtividade(null);
                  router.push('/(tabs)/atividades');
                }}
              >
                <Text style={styles.verTarefasBtnText}>Ver na tela Tarefas</Text>
              </TouchableOpacity>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: HEADER_GREEN,
    paddingBottom: 56,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerSide: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
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
  heatmapSwitcherBtnActive: {
    backgroundColor: HEADER_GREEN,
  },
  heatmapSwitcherText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  heatmapSwitcherTextActive: {
    color: '#fff',
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
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 320,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    marginBottom: 8,
  },
  modalOptionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
    flex: 1,
  },
  modalConfirmBtn: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    opacity: 1,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  modalCancelBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Task detail bottom sheet (inicio)
  detailStatusCardInicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  detailStatusLabelInicio: {
    fontSize: 16,
    fontWeight: '600',
  },
  detailDateInicio: {
    fontSize: 13,
    marginTop: 2,
  },
  detailSectionInicio: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  detailSectionHeaderInicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  detailSectionTitleInicio: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailSectionContentInicio: {
    fontSize: 15,
    lineHeight: 22,
  },
  verTarefasBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  verTarefasBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
