/**
 * Hook para buscar dados diretamente do Supabase
 * Usado quando SQLite não está disponível (Expo Go) ou para dados em tempo real
 * 
 * Tabelas Supabase (novo schema):
 *   atividades, talhoes, safras, scouts, scout_markers, scout_marker_pragas
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { logger } from '@/services/logger';

// Helper para garantir que supabase não é null
const getSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase não configurado');
  }
  return supabase;
};

// Types
export interface SupabaseActivity {
  id: number;
  codigo?: string;
  titulo: string;
  descricao?: string;
  tipo?: string;
  situacao: string;
  prioridade?: string;
  etapa?: string;
  dataInicio?: string;
  dataFim?: string;
  custoAproximado?: number;
  createdAt: string;
  talhoes?: { id: number; nome: string }[];
}

export interface SupabaseScout {
  id: number;
  nome: string;
  status?: string;
  observacao?: string;
  talhaoId?: number;
  talhaoNome?: string;
  totalMarkers: number;
  markersVisitados: number;
  totalPragas: number;
  percentualInfestacao: number;
  createdAt: string;
}

export interface SupabasePest {
  id: number;
  markerId: number;
  pragaNome?: string;
  pragaNomeCientifico?: string;
  tipoPraga?: string;
  contagem?: number;
  presenca?: boolean;
  prioridade?: string;
  observacao?: string;
  dataContagem?: string;
}

export interface SupabaseTalhao {
  id: number;
  nome: string;
  area?: number;
  culturaAtual?: string;
  color?: string;
}

export interface SupabaseHeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  pragaNome?: string;
}

export interface DashboardStats {
  totalActivities: number;
  pendingActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  totalScouts: number;
  completedScouts: number;
  pendingScouts: number;
  totalPests: number;
  totalTalhoes: number;
}

/**
 * Hook para atividades do Supabase
 */
export function useSupabaseActivities() {
  const [activities, setActivities] = useState<SupabaseActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sb = getSupabase();

      const { data, error: queryError } = await sb
        .from('atividades')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (queryError) {
        logger.error('Erro na query de atividades', { error: queryError });
        throw queryError;
      }

      const mapped: SupabaseActivity[] = (data || []).map((row: any) => ({
        id: row.id,
        codigo: row.codigo,
        titulo: row.titulo,
        descricao: row.descricao,
        tipo: row.tipo,
        situacao: row.situacao || 'PENDENTE',
        prioridade: row.prioridade,
        etapa: row.etapa,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        custoAproximado: row.custo_aproximado,
        createdAt: row.created_at,
      }));

      setActivities(mapped);
    } catch (err: any) {
      logger.error('Erro ao carregar atividades do Supabase', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { activities, isLoading, error, refresh: load };
}

/**
 * Hook para scouts do Supabase
 */
export function useSupabaseScouts() {
  const [scouts, setScouts] = useState<SupabaseScout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sb = getSupabase();

      const { data, error: queryError } = await sb
        .from('scouts')
        .select('*, talhoes(id, nome)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (queryError) {
        logger.error('Erro na query de scouts', { error: queryError });
        throw queryError;
      }

      const mapped: SupabaseScout[] = (data || []).map((row: any) => ({
        id: row.id,
        nome: row.nome,
        status: row.status,
        observacao: row.observacao,
        talhaoId: row.talhao_id,
        talhaoNome: row.talhoes?.nome,
        totalMarkers: row.total_markers || 0,
        markersVisitados: row.markers_visitados || 0,
        totalPragas: row.total_pragas || 0,
        percentualInfestacao: row.percentual_infestacao || 0,
        createdAt: row.created_at,
      }));

      setScouts(mapped);
      const withPests = mapped.filter(s => s.totalPragas > 0).length;
    } catch (err: any) {
      logger.error('Erro ao carregar scouts do Supabase', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { scouts, isLoading, error, refresh: load };
}

/**
 * Hook para pragas (scout_marker_pragas) do Supabase
 */
export function useSupabasePests() {
  const [pests, setPests] = useState<SupabasePest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: queryError } = await getSupabase()
        .from('scout_marker_pragas')
        .select('*')
        .order('data_contagem', { ascending: false });

      if (queryError) throw queryError;

      const mapped: SupabasePest[] = (data || []).map((row: any) => ({
        id: row.id,
        markerId: row.marker_id,
        pragaNome: row.praga_nome,
        pragaNomeCientifico: row.praga_nome_cientifico,
        tipoPraga: row.tipo_praga,
        contagem: row.contagem,
        presenca: row.presenca,
        prioridade: row.prioridade,
        observacao: row.observacao,
        dataContagem: row.data_contagem,
      }));

      setPests(mapped);
      logger.info('Pragas carregadas do Supabase', { count: mapped.length });
    } catch (err: any) {
      logger.error('Erro ao carregar pragas do Supabase', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { pests, isLoading, error, refresh: load };
}

/** Scout resumido com contagem de pragas, derivado de scout_marker_pragas (não depende de total_pragas em scouts) */
export interface ScoutWithPestsSummary {
  id: number;
  nome: string;
  talhaoNome?: string;
  createdAt: string;
  totalPragas: number;
}

/**
 * Hook para monitoramentos recentes que têm pragas identificadas.
 * Busca por scout_marker_pragas -> scout_markers -> scouts, para não depender de total_pragas em scouts.
 */
export function useRecentScoutsWithPests(limit = 5) {
  const [scouts, setScouts] = useState<ScoutWithPestsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sb = getSupabase();

      const { data: pragasData, error: queryError } = await sb
        .from('scout_marker_pragas')
        .select(`
          id,
          data_contagem,
          scout_markers (
            scout_id,
            scouts (
              id,
              nome,
              created_at,
              talhoes (nome)
            )
          )
        `)
        .order('data_contagem', { ascending: false })
        .limit(100);

      if (queryError) {
        logger.error('Erro ao buscar pragas para monitoramentos recentes', { error: queryError });
        throw queryError;
      }

      type Row = {
        scout_markers?: {
          scout_id: number;
          scouts?: {
            id: number;
            nome: string;
            created_at: string;
            talhoes?: { nome: string } | Array<{ nome: string }> | null;
          } | null;
        } | null;
      };

      const rows = (pragasData || []) as Row[];
      const byScoutId = new Map<number, { nome: string; talhaoNome?: string; createdAt: string; count: number }>();

      for (const row of rows) {
        const marker = row.scout_markers;
        const scout = marker?.scouts;
        if (!marker?.scout_id || !scout) continue;

        const talhoes = scout.talhoes;
        const talhaoNome = Array.isArray(talhoes) ? talhoes[0]?.nome : talhoes?.nome;

        const existing = byScoutId.get(scout.id);
        if (existing) {
          existing.count += 1;
        } else {
          byScoutId.set(scout.id, {
            nome: scout.nome ?? `Ponto #${scout.id}`,
            talhaoNome,
            createdAt: scout.created_at,
            count: 1,
          });
        }
      }

      const list: ScoutWithPestsSummary[] = Array.from(byScoutId.entries())
        .slice(0, limit)
        .map(([id, v]) => ({
          id,
          nome: v.nome,
          talhaoNome: v.talhaoNome,
          createdAt: v.createdAt,
          totalPragas: v.count,
        }));

      setScouts(list);
      logger.info('Monitoramentos com pragas carregados', { count: list.length });
    } catch (err: any) {
      logger.error('Erro ao carregar monitoramentos com pragas', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  return { scouts, isLoading, error, refresh: load };
}

/**
 * Hook para dados do heatmap (derivado de scout_markers + pragas)
 */
export function useSupabaseHeatmap() {
  const [points, setPoints] = useState<SupabaseHeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const sb = getSupabase();

        // Buscar markers que têm pragas
        const { data: markers, error: markersError } = await sb
          .from('scout_markers')
          .select('id, latitude, longitude, scout_marker_pragas(contagem, praga_nome)');

        if (markersError) throw markersError;

        const mapped: SupabaseHeatmapPoint[] = (markers || [])
          .filter((m: any) => m.scout_marker_pragas && m.scout_marker_pragas.length > 0)
          .map((m: any) => {
            const totalContagem = m.scout_marker_pragas.reduce(
              (sum: number, p: any) => sum + (p.contagem || 1), 0
            );
            return {
              lat: parseFloat(m.latitude),
              lng: parseFloat(m.longitude),
              intensity: Math.min(totalContagem / 10, 1),
              pragaNome: m.scout_marker_pragas[0]?.praga_nome,
            };
          });

        setPoints(mapped);
        logger.info('Heatmap carregado do Supabase', { count: mapped.length });
      } catch (err: any) {
        logger.error('Erro ao carregar heatmap do Supabase', { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { points, isLoading, hasData: points.length > 0 };
}

/**
 * Hook para talhões do Supabase
 */
export function useSupabasePlots() {
  const [plots, setPlots] = useState<SupabaseTalhao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from('talhoes')
          .select('id, nome, area, cultura_atual, color')
          .order('nome');

        if (error) throw error;

        const mapped: SupabaseTalhao[] = (data || []).map((row: any) => ({
          id: row.id,
          nome: row.nome,
          area: row.area ? parseFloat(row.area) : undefined,
          culturaAtual: row.cultura_atual,
          color: row.color,
        }));

        setPlots(mapped);
        logger.info('Talhões carregados do Supabase', { count: mapped.length });
      } catch (err: any) {
        logger.error('Erro ao carregar talhões do Supabase', { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { plots, isLoading };
}

/**
 * Função para buscar pragas de um scout específico (via markers)
 */
export async function fetchPestsByScoutId(scoutId: string | number | null): Promise<SupabasePest[]> {
  if (!isSupabaseConfigured() || !scoutId) {
    return [];
  }

  try {
    const sb = getSupabase();
    const numericId = typeof scoutId === 'string' ? parseInt(scoutId) : scoutId;

    // Buscar markers do scout, depois pragas dos markers
    const { data: markers, error: markersError } = await sb
      .from('scout_markers')
      .select('id')
      .eq('scout_id', numericId);

    if (markersError || !markers || markers.length === 0) return [];

    const markerIds = markers.map((m: any) => m.id);

    const { data, error } = await sb
      .from('scout_marker_pragas')
      .select('*')
      .in('marker_id', markerIds)
      .order('contagem', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar pragas do scout', { error: error.message, scoutId });
      return [];
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      markerId: p.marker_id,
      pragaNome: p.praga_nome,
      pragaNomeCientifico: p.praga_nome_cientifico,
      tipoPraga: p.tipo_praga,
      contagem: p.contagem || 0,
      presenca: p.presenca,
      prioridade: p.prioridade,
      observacao: p.observacao,
      dataContagem: p.data_contagem,
    }));
  } catch (err: any) {
    logger.error('Erro ao buscar pragas do scout', { error: err.message });
    return [];
  }
}

/**
 * Hook para buscar pragas de um scout específico
 */
export function usePestsByScout(scoutId: string | number | null) {
  const [pests, setPests] = useState<SupabasePest[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!scoutId) {
      setPests([]);
      return;
    }

    const load = async () => {
      setIsLoading(true);
      const result = await fetchPestsByScoutId(scoutId);
      setPests(result);
      setIsLoading(false);
    };

    load();
  }, [scoutId]);

  return { pests, isLoading };
}

/**
 * Hook para estatísticas do dashboard
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalActivities: 0,
    pendingActivities: 0,
    completedActivities: 0,
    inProgressActivities: 0,
    totalScouts: 0,
    completedScouts: 0,
    pendingScouts: 0,
    totalPests: 0,
    totalTalhoes: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const sb = getSupabase();
      const [atividadesRes, scoutsRes, pragasRes, talhoesRes] = await Promise.all([
        sb.from('atividades').select('situacao').is('deleted_at', null),
        sb.from('scouts').select('status, total_pragas').is('deleted_at', null),
        sb.from('scout_marker_pragas').select('id'),
        sb.from('talhoes').select('id'),
      ]);

      const atividades = atividadesRes.data || [];
      const scouts = scoutsRes.data || [];
      const pragas = pragasRes.data || [];
      const talhoes = talhoesRes.data || [];

      setStats({
        totalActivities: atividades.length,
        pendingActivities: atividades.filter((a: any) => a.situacao === 'PENDENTE').length,
        completedActivities: atividades.filter((a: any) => a.situacao === 'CONCLUIDA').length,
        inProgressActivities: atividades.filter((a: any) => a.situacao === 'EM_ANDAMENTO').length,
        totalScouts: scouts.length,
        completedScouts: scouts.filter((s: any) => s.status === 'CONCLUIDO').length,
        pendingScouts: scouts.filter((s: any) => s.status === 'PENDENTE' || s.status === 'EM_ANDAMENTO').length,
        totalPests: pragas.length,
        totalTalhoes: talhoes.length,
      });

    } catch (err: any) {
      logger.error('Erro ao carregar estatísticas', { error: err.message });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, isLoading, refresh: load };
}

/**
 * Hook para atividades por mês (para o gráfico radar)
 */
export function useActivitiesByMonth() {
  const [data, setData] = useState<{ label: string; value: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const demoData = [
    { label: 'Jan', value: 12 },
    { label: 'Fev', value: 8 },
    { label: 'Mar', value: 15 },
    { label: 'Abr', value: 6 },
    { label: 'Mai', value: 18 },
    { label: 'Jun', value: 10 },
  ];

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setData(demoData);
        setIsLoading(false);
        return;
      }

      try {
        const currentYear = new Date().getFullYear();

        const { data: atividades, error } = await getSupabase()
          .from('atividades')
          .select('created_at')
          .is('deleted_at', null)
          .gte('created_at', `${currentYear}-01-01`)
          .lte('created_at', `${currentYear}-12-31`);

        if (error) throw error;

        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
        const counts = new Array(12).fill(0);

        (atividades || []).forEach((a: any) => {
          const month = new Date(a.created_at).getMonth();
          counts[month]++;
        });

        const totalCount = counts.reduce((a, b) => a + b, 0);

        if (totalCount === 0) {
          setData(demoData);
        } else {
          const result = monthNames.map((label, index) => ({
            label,
            value: counts[index],
          }));
          setData(result);
        }

      } catch (err: any) {
        logger.error('Erro ao carregar atividades por mês', { error: err.message });
        setData(demoData);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { data, isLoading };
}

/**
 * Hook para top pragas
 */
export function useTopPests() {
  const [pests, setPests] = useState<{ name: string; count: number; prioridade: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from('scout_marker_pragas')
          .select('praga_nome, contagem, prioridade');

        if (error) throw error;

        const grouped: Record<string, { count: number; prioridade: string }> = {};
        (data || []).forEach((p: any) => {
          const nome = p.praga_nome || 'Desconhecida';
          if (!grouped[nome]) {
            grouped[nome] = { count: 0, prioridade: p.prioridade || 'BAIXA' };
          }
          grouped[nome].count += p.contagem || 1;
          if (p.prioridade === 'ALTA' ||
            (p.prioridade === 'MEDIA' && grouped[nome].prioridade === 'BAIXA')) {
            grouped[nome].prioridade = p.prioridade;
          }
        });

        const result = Object.entries(grouped)
          .map(([name, d]) => ({ name, ...d }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        setPests(result);
        logger.info('Top pragas carregadas', { count: result.length });
      } catch (err: any) {
        logger.error('Erro ao carregar top pragas', { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { pests, isLoading };
}

/**
 * Hook para buscar scouts e pragas de um talhão específico
 */
export interface ScoutWithPests {
  id: number;
  nome: string;
  status?: string;
  observacao?: string;
  totalMarkers: number;
  totalPragas: number;
  percentualInfestacao: number;
  createdAt: string;
  pests: SupabasePest[];
}

export function useScoutsByPlot(plotId: number | string | undefined) {
  const [scouts, setScouts] = useState<ScoutWithPests[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || !plotId) {
      setScouts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sb = getSupabase();

      const numericPlotId = typeof plotId === 'string' ? parseInt(plotId) : plotId;
      const { data: scoutsData, error: scoutsError } = await sb
        .from('scouts')
        .select('*')
        .eq('talhao_id', numericPlotId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (scoutsError) throw scoutsError;

      if (!scoutsData || scoutsData.length === 0) {
        setScouts([]);
        setIsLoading(false);
        return;
      }

      // Para cada scout, buscar pragas via markers
      const results: ScoutWithPests[] = [];
      for (const s of scoutsData) {
        const pests = await fetchPestsByScoutId(s.id);
        results.push({
          id: s.id,
          nome: s.nome,
          status: s.status ?? undefined,
          observacao: s.observacao ?? undefined,
          totalMarkers: s.total_markers || 0,
          totalPragas: s.total_pragas || 0,
          percentualInfestacao: s.percentual_infestacao || 0,
          createdAt: s.created_at,
          pests,
        });
      }

      setScouts(results);
      logger.info(`Scouts do talhão ${plotId} carregados`, { count: results.length });
    } catch (err: any) {
      logger.error(`Erro ao carregar scouts do talhão ${plotId}`, { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [plotId]);

  useEffect(() => {
    load();
  }, [load]);

  return { scouts, isLoading, error, refresh: load };
}
