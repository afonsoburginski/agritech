import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { User, HelpCircle, ClipboardList, Camera, Bug } from 'lucide-react-native';
import { useSupabaseActivities, useRecentScoutsWithPests } from '@/hooks/use-supabase-data';

const BRAND_GREEN = '#16a34a';
const CONTENT_PADDING = 20;
const MAX_ATIVIDADES_NO_CARD = 5;

// Saúde geral da fazenda (substituir por dados reais depois)
const MOCK_SAUDE_FAZENDA = 'Boa'; // ou percentual ex: '85%'
const MAX_MONITORAMENTOS_NO_CARD = 5;

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

export default function InicioScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { activities, refresh: refreshActivities } = useSupabaseActivities();
  const { scouts: monitoramentosComPragas, refresh: refreshMonitoramentos } = useRecentScoutsWithPests(MAX_MONITORAMENTOS_NO_CARD);
  const atividadesExibir = activities.slice(0, MAX_ATIVIDADES_NO_CARD);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshActivities(), refreshMonitoramentos()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshActivities, refreshMonitoramentos]);

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
              <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon name={User} size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Account</Text>
              <TouchableOpacity activeOpacity={0.7} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Icon name={HelpCircle} size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroSection}>
              <Text style={styles.balanceAmount}>{MOCK_SAUDE_FAZENDA}</Text>
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
            {atividadesExibir.length === 0 ? (
              <View style={styles.emptyTransactions}>
                <Text style={styles.emptyTransactionsText}>Nenhuma tarefa recente</Text>
              </View>
            ) : (
              atividadesExibir.map((atv, index) => {
                const { iconBg, iconLabel } = getSituacaoStyle(atv.situacao);
                return (
                  <View
                    key={atv.id}
                    style={[
                      styles.transactionRow,
                      index === atividadesExibir.length - 1 && styles.transactionRowLast,
                    ]}
                  >
                    <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
                      <Text style={styles.txIconText}>{iconLabel}</Text>
                    </View>
                    <View style={styles.txContent}>
                      <Text style={styles.txName} numberOfLines={1}>{atv.titulo}</Text>
                      <Text style={styles.txDate}>{formatActivityDate(atv.createdAt)}</Text>
                    </View>
                    <View style={styles.txAmounts}>
                      <Text style={styles.txAmountUsdc}>{getSituacaoLabel(atv.situacao)}</Text>
                      <Text style={styles.txAmountFiat}>{atv.tipo || '—'}</Text>
                    </View>
                  </View>
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
                  <View
                    key={scout.id}
                    style={[
                      styles.monitoramentoRow,
                      index === monitoramentosComPragas.length - 1 && styles.monitoramentoRowLast,
                    ]}
                  >
                    <View style={styles.monitoramentoIcon}>
                      <Icon name={Bug} size={20} color={BRAND_GREEN} />
                    </View>
                    <View style={styles.monitoramentoContent}>
                      <Text style={styles.monitoramentoNome} numberOfLines={1}>
                        {scout.talhaoNome || scout.nome || `Ponto #${scout.id}`}
                      </Text>
                      <Text style={styles.monitoramentoMeta}>
                        {formatActivityDate(scout.createdAt)} · {scout.totalPragas} {scout.totalPragas === 1 ? 'praga' : 'pragas'}
                      </Text>
                    </View>
                  </View>
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: BRAND_GREEN,
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
    backgroundColor: BRAND_GREEN,
    zIndex: 0,
  },
  refreshOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
    backgroundColor: BRAND_GREEN,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
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
    color: BRAND_GREEN,
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
    color: BRAND_GREEN,
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
  monitoramentoNome: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  monitoramentoMeta: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 2,
  },
});
