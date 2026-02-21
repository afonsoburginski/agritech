import { useState, useMemo, useCallback, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, TextInput, SectionList } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { View } from '@/components/ui/view';
import { Text } from '@/components/ui/text';
import { AppHeader } from '@/components/app-header';
import { BottomSheet } from '@/components/ui/bottom-sheet-simple';
import { MonitoramentoDetailSheet, type MonitoramentoDetailPraga } from '@/components/monitoramento-detail-sheet';
import { useScouts } from '@/hooks/use-scouts';
import { useSupabaseScouts, fetchTalhaoMonitoramentoDetail } from '@/hooks/use-supabase-data';
import { useColor } from '@/hooks/useColor';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Icon } from '@/components/ui/icon';
import { palette } from '@/theme/colors';
import { useAppStore } from '@/stores/app-store';
import { useEffectiveAvatarUri } from '@/stores/auth-store';
import {
  Bug,
  Search,
  MapPin,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
  BarChart2,
} from 'lucide-react-native';

interface ScoutDetail {
  id: string;
  latitude: number;
  longitude: number;
  talhaoNome?: string;
  talhaoId?: number;
  talhaoArea?: number;
  talhaoCulturaAtual?: string;
  talhaoCultura?: import('@/types/supabase').CulturaTalhaoEnum | null;
  talhaoPercentualInfestacao?: number;
  visitado: boolean;
  dataVisita?: string;
  pragasCount: number;
  observacoes?: string;
  createdAt: string;
  synced: boolean;
}

interface TalhaoMonth {
  key: string;
  talhaoNome: string;
  talhaoId?: number;
  talhaoArea?: number;
  talhaoCulturaAtual?: string;
  /** Percentual de infestação do talhão (0–100), calculado em tempo real no banco */
  talhaoPercentualInfestacao?: number;
  totalPragas: number;
  scoutCount: number;
  latestScout: ScoutDetail;
  /** Delta vs previous month: positive=more pests, negative=fewer, null=no data */
  trend: number | null;
}

interface MonthSection {
  title: string;
  monthKey: string;
  data: TalhaoMonth[];
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getMonthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split('-');
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthName = MONTH_NAMES[parseInt(month, 10) - 1] ?? month;
  if (key === currentKey) return `${monthName} ${year} (atual)`;
  return `${monthName} ${year}`;
}

export default function MonitoramentoScreen() {
  const router = useRouter();
  const avatarUri = useEffectiveAvatarUri();
  const backgroundColor = useColor({}, 'background');
  const cardColor = useColor({}, 'card');
  const textColor = useColor({}, 'text');
  const mutedColor = useColor({}, 'textMuted');
  const borderColor = useColor({}, 'border');
  const primaryColor = useColor({}, 'primary');
  const [searchQuery, setSearchQuery] = useState('');
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { isOnline } = useAppStore();
  const { scouts: localScouts, refresh } = useScouts();
  const { scouts: supabaseScouts, isLoading, refresh: refreshSupabase } = useSupabaseScouts();
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);
  const [detailPayload, setDetailPayload] = useState<{
    title: string;
    talhaoArea?: number;
    talhaoCulturaAtual?: string;
    percentualInfestacao?: number;
    latitude?: number;
    longitude?: number;
    visitado: boolean;
    dataVisita?: string;
    pragas: MonitoramentoDetailPraga[];
    pestsLoading?: boolean;
    observacoes?: string;
    synced: boolean;
  } | null>(null);
  useFocusEffect(
    useCallback(() => {
      refreshSupabase();
      refresh();
    }, [refreshSupabase, refresh])
  );

  const handleTalhaoPress = async (item: TalhaoMonth, monthKey: string) => {
    const scout = item.latestScout;
    const title = item.talhaoNome || `Ponto ${scout.id.slice(-6)}`;
    const onClose = () => setDetailSheetVisible(false);

    // Show loading state immediately
    setDetailPayload({
      title,
      talhaoArea: item.talhaoArea,
      talhaoCulturaAtual: item.talhaoCulturaAtual,
      percentualInfestacao: item.talhaoPercentualInfestacao,
      latitude: scout.latitude,
      longitude: scout.longitude,
      visitado: scout.visitado,
      dataVisita: scout.dataVisita,
      pragas: [],
      pestsLoading: true,
      observacoes: scout.observacoes,
      synced: scout.synced,
    });
    setDetailSheetVisible(true);

    // Use RPC to fetch all pests for this talhão (scoped to month)
    if (item.talhaoId != null) {
      const [year, month] = monthKey.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1).toISOString();
      const payload = await fetchTalhaoMonitoramentoDetail(item.talhaoId, title, onClose, monthStart);
      if (payload) {
        setDetailPayload({
          title: payload.title,
          talhaoArea: payload.talhaoArea,
          talhaoCulturaAtual: payload.talhaoCulturaAtual,
          percentualInfestacao: payload.percentualInfestacao,
          latitude: payload.latitude,
          longitude: payload.longitude,
          visitado: scout.visitado,
          dataVisita: scout.dataVisita,
          pragas: payload.pragas,
          pestsLoading: false,
          observacoes: payload.observacoes,
          synced: scout.synced,
        });
        return;
      }
    }

    // Fallback: no talhaoId or RPC failed — show empty
    setDetailPayload((prev) => prev ? { ...prev, pestsLoading: false } : prev);
  };

  const scouts = useMemo((): ScoutDetail[] => {
    if (isOnline && supabaseScouts.length > 0) {
      return supabaseScouts.map(s => ({
        id: String(s.id),
        latitude: s.latitude ?? 0,
        longitude: s.longitude ?? 0,
        talhaoNome: s.talhaoNome || s.nome,
        talhaoId: s.talhaoId,
        talhaoArea: s.talhaoArea,
        talhaoCulturaAtual: s.talhaoCulturaAtual,
        talhaoCultura: s.talhaoCultura,
        talhaoPercentualInfestacao: s.talhaoPercentualInfestacao,
        visitado: s.status === 'CONCLUIDO',
        dataVisita: undefined,
        pragasCount: s.totalPragas,
        observacoes: s.observacao,
        createdAt: s.createdAt,
        synced: true,
      }));
    }
    return localScouts.map((s): ScoutDetail => ({
      id: s.id,
      latitude: s.latitude,
      longitude: s.longitude,
      talhaoNome: s.talhaoNome,
      talhaoId: undefined,
      talhaoArea: undefined,
      talhaoCulturaAtual: undefined,
      visitado: s.visitado,
      dataVisita: s.dataVisita,
      pragasCount: s.pragasCount,
      observacoes: s.observacoes,
      createdAt: s.createdAt,
      synced: s.synced,
    }));
  }, [isOnline, supabaseScouts, localScouts]);

  // Group scouts by month -> talhão, compute trends
  const sections = useMemo((): MonthSection[] => {
    // Group by month
    const byMonth = new Map<string, ScoutDetail[]>();
    for (const s of scouts) {
      const mk = getMonthKey(s.createdAt);
      const arr = byMonth.get(mk) ?? [];
      arr.push(s);
      byMonth.set(mk, arr);
    }

    // Build per-month per-talhão pest totals for trend computation
    const pestsByMonthTalhao = new Map<string, number>(); // "YYYY-MM|talhaoKey" -> totalPragas
    for (const [mk, list] of byMonth.entries()) {
      const byTalhao = new Map<string, number>();
      for (const s of list) {
        const tk = s.talhaoNome ?? s.id;
        byTalhao.set(tk, (byTalhao.get(tk) ?? 0) + (s.pragasCount || 0));
      }
      for (const [tk, count] of byTalhao.entries()) {
        pestsByMonthTalhao.set(`${mk}|${tk}`, count);
      }
    }

    function prevMonthKey(mk: string): string {
      const [y, m] = mk.split('-').map(Number);
      const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
      return prev;
    }

    const sorted = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a));

    return sorted.map((mk): MonthSection => {
      const list = byMonth.get(mk)!;
      const prevMk = prevMonthKey(mk);

      // Group by talhão within this month
      const byTalhao = new Map<string, { scouts: ScoutDetail[]; totalPragas: number }>();
      for (const s of list) {
        const tk = s.talhaoNome ?? s.id;
        const cur = byTalhao.get(tk) ?? { scouts: [], totalPragas: 0 };
        cur.scouts.push(s);
        cur.totalPragas += s.pragasCount || 0;
        byTalhao.set(tk, cur);
      }

      // Filter by search
      const data: TalhaoMonth[] = Array.from(byTalhao.entries())
        .filter(([tk]) => !searchQuery || tk.toLowerCase().includes(searchQuery.toLowerCase()))
        .map(([tk, { scouts: tScouts, totalPragas }]): TalhaoMonth => {
          const latest = tScouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
          const prevKey = `${prevMk}|${tk}`;
          const prevPragas = pestsByMonthTalhao.get(prevKey);
          const trend = prevPragas != null ? totalPragas - prevPragas : null;
          return {
            key: `${mk}-${tk}`,
            talhaoNome: tk,
            talhaoId: latest.talhaoId,
            talhaoArea: latest.talhaoArea,
            talhaoCulturaAtual: latest.talhaoCulturaAtual,
            talhaoPercentualInfestacao: latest.talhaoPercentualInfestacao,
            totalPragas,
            scoutCount: tScouts.length,
            latestScout: latest,
            trend,
          };
        })
        .sort((a, b) => b.totalPragas - a.totalPragas);

      return {
        title: formatMonthLabel(mk),
        monthKey: mk,
        data,
      };
    }).filter(s => s.data.length > 0);
  }, [scouts, searchQuery]);

  // Current month stats
  const currentMonthKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const currentMonthScouts = useMemo(() => scouts.filter(s => getMonthKey(s.createdAt) === currentMonthKey), [scouts, currentMonthKey]);
  const totalPragasCurrentMonth = currentMonthScouts.reduce((sum, s) => sum + (s.pragasCount || 0), 0);

  const handlePerfil = () => router.push('/(tabs)/perfil');

  const renderTrendBadge = (trend: number | null) => {
    if (trend == null) return null;
    if (trend === 0) {
      return (
        <View style={[styles.trendBadge, { backgroundColor: '#6B728015' }]}>
          <Icon name={MinusIcon} size={10} color="#6B7280" />
          <Text style={[styles.trendText, { color: '#6B7280' }]}>Estável</Text>
        </View>
      );
    }
    const improved = trend < 0;
    const color = improved ? '#10B981' : '#EF4444';
    const bg = improved ? '#10B98115' : '#EF444415';
    return (
      <View style={[styles.trendBadge, { backgroundColor: bg }]}>
        <Icon name={improved ? TrendingDown : TrendingUp} size={10} color={color} />
        <Text style={[styles.trendText, { color }]}>
          {improved ? `${Math.abs(trend)} menos` : `+${trend} pragas`}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <AppHeader
        title="Monitoramento"
        avatarUri={avatarUri}
        onAvatarPress={handlePerfil}
        isOnline={isOnline}
        showDuvidasButton
      >
        <Text style={styles.headerDescription}>
          Pontos de coleta por talhão, pragas identificadas e acompanhamento de visitas no campo.
        </Text>
      </AppHeader>

      {/* Card resumo do mês */}
      <View style={[styles.summaryCard, { backgroundColor: cardColor, borderColor }]}>
        <View style={[styles.summaryCardIcon, { backgroundColor: palette.gold + '20' }]}>
          <Icon name={BarChart2} size={20} color={palette.gold} />
        </View>
        <View style={styles.summaryCardContent}>
          <Text style={[styles.summaryCardTitle, { color: textColor }]}>Resumo do mês</Text>
          <Text style={[styles.summaryCardText, { color: mutedColor }]}>
            {totalPragasCurrentMonth} {totalPragasCurrentMonth === 1 ? 'praga' : 'pragas'} em {currentMonthScouts.length} {currentMonthScouts.length === 1 ? 'ponto' : 'pontos'} de coleta
            {currentMonthScouts.length > 0
              ? ` · ${currentMonthScouts.filter(s => s.visitado).length} visitados, ${currentMonthScouts.filter(s => !s.visitado).length} pendentes`
              : ''}
          </Text>
        </View>
      </View>

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

      {/* Monthly sections */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: cardColor }]}>
              <Icon name={Bug} size={32} color={mutedColor} />
            </View>
            <Text style={[styles.emptyTitle, { color: textColor }]}>Nenhum monitoramento</Text>
            <Text style={[styles.emptySubtitle, { color: mutedColor }]}>
              {searchQuery ? 'Tente buscar por outro termo' : 'Adicione um ponto de monitoramento'}
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
            <Icon name={Calendar} size={14} color={primaryColor} />
            <Text style={[styles.sectionTitle, { color: textColor }]}>{section.title}</Text>
            <Text style={[styles.sectionCount, { color: mutedColor }]}>
              {section.data.length} talhão{section.data.length !== 1 ? 'ões' : ''}
            </Text>
          </View>
        )}
        renderItem={({ item, section }) => (
          <TouchableOpacity
            style={[styles.talhaoCard, { backgroundColor: cardColor }]}
            activeOpacity={0.7}
            onPress={() => handleTalhaoPress(item, section.monthKey)}
          >
            <View style={styles.talhaoLeft}>
              <View style={[styles.talhaoIcon, { backgroundColor: item.totalPragas > 0 ? '#F59E0B20' : '#10B98120' }]}>
                <Icon name={MapPin} size={18} color={item.totalPragas > 0 ? '#F59E0B' : '#10B981'} />
              </View>
              <View style={styles.talhaoInfo}>
                <Text style={[styles.talhaoName, { color: textColor }]} numberOfLines={1}>
                  {item.talhaoNome}
                </Text>
                <View style={styles.talhaoMeta}>
                  {(item.talhaoArea != null || item.talhaoCulturaAtual) && (
                    <Text style={[styles.talhaoMetaText, { color: mutedColor }]} numberOfLines={1}>
                      {[item.talhaoArea != null && `${Number(item.talhaoArea).toLocaleString('pt-BR')} ha`, item.talhaoCulturaAtual].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  {item.totalPragas > 0 && (
                    <View style={styles.pragasBadge}>
                      <Icon name={AlertTriangle} size={11} color={palette.gold} />
                      <Text style={[styles.pragasText, { color: palette.gold }]}>
                        {item.totalPragas} praga{item.totalPragas > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  {item.talhaoPercentualInfestacao != null && item.talhaoPercentualInfestacao > 0 && (
                    <Text style={[styles.talhaoMetaText, { color: '#F59E0B', fontWeight: '600' }]}>
                      Infestação: {Number(item.talhaoPercentualInfestacao).toFixed(1)}%
                    </Text>
                  )}
                  <Text style={[styles.talhaoMetaText, { color: mutedColor }]}>
                    {item.scoutCount} scout{item.scoutCount > 1 ? 's' : ''}
                  </Text>
                </View>
                {renderTrendBadge(item.trend)}
              </View>
            </View>
            <View style={styles.talhaoRight}>
              <View style={[styles.statusDot, { backgroundColor: item.latestScout.visitado ? '#10B981' : '#F59E0B' }]} />
              <Icon name={ChevronRight} size={18} color={mutedColor} />
            </View>
          </TouchableOpacity>
        )}
      />

      {detailPayload != null && (
        <BottomSheet
          isVisible={detailSheetVisible}
          onClose={() => setDetailSheetVisible(false)}
          title={detailPayload.title}
        >
          <MonitoramentoDetailSheet
            talhaoArea={detailPayload.talhaoArea}
            talhaoCulturaAtual={detailPayload.talhaoCulturaAtual}
            percentualInfestacao={detailPayload.percentualInfestacao}
            latitude={detailPayload.latitude}
            longitude={detailPayload.longitude}
            visitado={detailPayload.visitado}
            dataVisita={detailPayload.dataVisita}
            pragas={detailPayload.pragas}
            pestsLoading={detailPayload.pestsLoading}
            observacoes={detailPayload.observacoes}
            synced={detailPayload.synced}
            onClose={() => setDetailSheetVisible(false)}
          />
        </BottomSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: -28,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  summaryCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardContent: { flex: 1 },
  summaryCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryCardText: {
    fontSize: 13,
    lineHeight: 18,
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 10,
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    marginTop: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  sectionCount: { fontSize: 12, fontWeight: '500' },
  talhaoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  talhaoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  talhaoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  talhaoInfo: { flex: 1 },
  talhaoName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  talhaoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  talhaoMetaText: { fontSize: 12 },
  pragasBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pragasText: { fontSize: 12, fontWeight: '600' },
  talhaoRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  trendText: { fontSize: 10, fontWeight: '600' },
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
  emptyTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  emptySubtitle: { fontSize: 14 },
});
