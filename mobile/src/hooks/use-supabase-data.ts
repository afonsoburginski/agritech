/**
 * Hook para buscar dados diretamente do Supabase
 * Usado quando SQLite não está disponível (Expo Go) ou para dados em tempo real
 * 
 * Tabelas Supabase (schema simplificado):
 *   atividades, talhoes, safras, scouts, scout_pragas
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/services/supabase';
import { useAuthFazendaPadrao } from '@/stores/auth-store';
import { logger } from '@/services/logger';
import type { Database } from '@/types/supabase';
import type { CulturaTalhaoEnum } from '@/types/supabase';
import { CULTURA_TALHAO_LABEL } from '@/types/supabase';

type AtividadeTipo = Database['public']['Enums']['atividade_tipo'];
type AtividadePrioridade = Database['public']['Enums']['atividade_prioridade'];
type AtividadeSituacao = Database['public']['Enums']['atividade_situacao'];

// Helper para garantir que supabase não é null
const getSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase não configurado');
  }
  return supabase;
};

/** Extrai lat/lng de scout_pragas.coordinates (GeoJSON Point: { type: 'Point', coordinates: [lng, lat] }). */
export function pointFromCoordinates(coords: unknown): { lat: number; lng: number } | null {
  const c = coords as { type?: string; coordinates?: number[] } | null;
  if (!c || c.type !== 'Point' || !Array.isArray(c.coordinates) || c.coordinates.length < 2) return null;
  const lng = Number(c.coordinates[0]);
  const lat = Number(c.coordinates[1]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

// Types
export interface SupabaseActivity {
  id: number;
  titulo: string;
  descricao?: string;
  tipo?: AtividadeTipo;
  situacao: AtividadeSituacao;
  prioridade?: AtividadePrioridade;
  dataInicio?: string;
  dataFim?: string;
  createdAt: string;
  /** IDs dos talhões vinculados à atividade */
  talhaoIds?: number[];
  talhoes?: { id: number; nome: string }[];
}

export type { AtividadeTipo, AtividadePrioridade, AtividadeSituacao };

export interface SupabaseScout {
  id: number;
  nome: string;
  status?: string;
  observacao?: string;
  talhaoId?: number;
  talhaoNome?: string;
  talhaoArea?: number;
  talhaoCulturaAtual?: string;
  /** Cultura do talhão (enum) para ícones no app */
  talhaoCultura?: CulturaTalhaoEnum | null;
  /** Percentual de infestação do talhão (0–100), calculado em tempo real no banco a partir dos pontos de praga dentro do polígono */
  talhaoPercentualInfestacao?: number;
  latitude?: number;
  longitude?: number;
  totalMarkers: number;
  markersVisitados: number;
  totalPragas: number;
  percentualInfestacao: number;
  createdAt: string;
}

export interface SupabasePest {
  id: number;
  scoutId: number;
  pragaNome?: string;
  pragaNomeCientifico?: string;
  tipoPraga?: string;
  contagem?: number;
  presenca?: boolean;
  prioridade?: string;
  observacao?: string;
  dataContagem?: string;
  /** Recomendação da Embrapa (embrapa_recomendacoes.descricao). */
  recomendacao?: string;
}

export interface SupabaseTalhao {
  id: number;
  nome: string;
  area?: number;
  culturaAtual?: string;
  color?: string;
}

/** Talhão com polígono para mapa (coordinates do banco → coords [lat,lng][]) */
export interface SupabaseTalhaoMap {
  id: number;
  nome: string;
  color?: string;
  coords: number[][];
  area?: number;
  culturaAtual?: string;
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
 * Hook para atividades do Supabase (filtrado pela fazenda selecionada)
 */
export function useSupabaseActivities() {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
  const [activities, setActivities] = useState<SupabaseActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || fazendaId == null) {
      setActivities([]);
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
        .eq('fazenda_id', fazendaId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (queryError) {
        logger.error('Erro na query de atividades', { error: queryError });
        throw queryError;
      }

      const mapped: SupabaseActivity[] = (data || []).map((row: any) => ({
        id: row.id,
        titulo: row.titulo,
        descricao: row.descricao,
        tipo: row.tipo,
        situacao: row.situacao || 'PENDENTE',
        prioridade: row.prioridade,
        dataInicio: row.data_inicio,
        dataFim: row.data_fim,
        createdAt: row.created_at,
        talhaoIds: Array.isArray(row.talhao_ids) ? row.talhao_ids : [],
      }));

      setActivities(mapped);
    } catch (err: any) {
      logger.error('Erro ao carregar atividades do Supabase', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    load();
  }, [load]);

  return { activities, isLoading, error, refresh: load };
}

/**
 * Hook para scouts do Supabase (filtrado pela fazenda selecionada)
 */
export function useSupabaseScouts() {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
  const [scouts, setScouts] = useState<SupabaseScout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || fazendaId == null) {
      setScouts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sb = getSupabase();

      const { data, error: queryError } = await sb
        .from('scouts')
        .select('*, talhoes(id, nome, area, cultura_atual, percentual_infestacao), scout_pragas(coordinates)')
        .eq('fazenda_id', fazendaId)
        .order('created_at', { ascending: false });

      if (queryError) {
        logger.error('Erro na query de scouts', { error: queryError });
        throw queryError;
      }

      const mapped: SupabaseScout[] = (data || []).map((row: any) => {
        const t = row.talhoes;
        const pragas = row.scout_pragas;
        const first = Array.isArray(pragas) ? pragas[0] : pragas;
        const point = pointFromCoordinates(first?.coordinates);
        const lat = point?.lat;
        const lng = point?.lng;
        return {
          id: row.id,
          nome: row.nome,
          status: row.status,
          observacao: row.observacao,
          talhaoId: row.talhao_id,
          talhaoNome: t?.nome,
          talhaoArea: t?.area != null ? parseFloat(t.area) : undefined,
          talhaoCulturaAtual: t?.cultura_atual != null ? CULTURA_TALHAO_LABEL[t.cultura_atual as CulturaTalhaoEnum] : undefined,
          talhaoCultura: (t?.cultura_atual as CulturaTalhaoEnum | undefined) ?? undefined,
          talhaoPercentualInfestacao: t?.percentual_infestacao != null ? Number(t.percentual_infestacao) : undefined,
          latitude: lat,
          longitude: lng,
          totalMarkers: row.total_markers || 0,
          markersVisitados: row.markers_visitados || 0,
          totalPragas: row.total_pragas || 0,
          percentualInfestacao: t?.percentual_infestacao != null ? Number(t.percentual_infestacao) : 0,
          createdAt: row.created_at,
        };
      });

      setScouts(mapped);
    } catch (err: any) {
      logger.error('Erro ao carregar scouts do Supabase', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: quando talhoes.percentual_infestacao é atualizado pelo trigger, refetch para exibir novo valor
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const sb = getSupabase();
    const channel = sb
      .channel('talhoes-infestacao')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'talhoes' }, () => {
        load();
      })
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [load]);

  return { scouts, isLoading, error, refresh: load };
}

/**
 * Hook para pragas (scout_pragas) do Supabase (filtrado pela fazenda selecionada via scouts)
 */
export function useSupabasePests() {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
  const [pests, setPests] = useState<SupabasePest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || fazendaId == null) {
      setPests([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const { data, error: queryError } = await getSupabase()
        .from('scout_pragas')
        .select('*, embrapa_recomendacoes(nome_praga, nome_cientifico, tipo, descricao), scouts!inner(fazenda_id)')
        .eq('scouts.fazenda_id', fazendaId)
        .order('data_contagem', { ascending: false });

      if (queryError) throw queryError;

      const er = (r: any) => r.embrapa_recomendacoes ?? {};
      const mapped: SupabasePest[] = (data || []).map((row: any) => ({
        id: row.id,
        scoutId: row.scout_id,
        pragaNome: er(row).nome_praga ?? 'Desconhecida',
        pragaNomeCientifico: er(row).nome_cientifico ?? undefined,
        tipoPraga: row.tipo_praga ?? er(row).tipo ?? undefined,
        contagem: row.contagem,
        presenca: row.presenca,
        prioridade: row.prioridade,
        observacao: row.observacao,
        dataContagem: row.data_contagem,
        recomendacao: er(row).descricao ?? undefined,
      }));

      setPests(mapped);
      logger.info('Pragas carregadas do Supabase', { count: mapped.length });
    } catch (err: any) {
      logger.error('Erro ao carregar pragas do Supabase', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    load();
  }, [load]);

  return { pests, isLoading, error, refresh: load };
}

/** Praga agregada por nome (soma de contagens no talhão) */
export interface PragaAgregada {
  pragaNome: string;
  contagem: number;
  prioridade?: string;
  pragaNomeCientifico?: string;
  tipoPraga?: string;
  observacao?: string;
  recomendacao?: string;
}

/** Talhão com pragas agregadas (monitoramentos recentes agrupados por talhão) */
export interface ScoutWithPestsSummary {
  id: number;
  nome: string;
  talhaoNome?: string;
  talhaoId?: number;
  talhaoArea?: number;
  talhaoCulturaAtual?: string;
  /** Cultura (enum) para ícone no app */
  cultura?: CulturaTalhaoEnum | null;
  /** Percentual de infestação do talhão no mês atual (0–100), em tempo real */
  percentualInfestacao?: number;
  /** Coordenadas do talhão (centro do polígono) para exibir localização */
  latitude?: number;
  longitude?: number;
  /** Observação do scout mais recente desse talhão */
  observacoes?: string;
  createdAt: string;
  totalPragas: number;
  /** Lista de pragas do talhão (nome + contagem total) */
  pragas?: PragaAgregada[];
}

/**
 * Hook para monitoramentos recentes que têm pragas identificadas.
 * Busca por scout_pragas -> scouts, para não depender de total_pragas em scouts.
 */
export function useRecentScoutsWithPests(limit = 5) {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
  const [scouts, setScouts] = useState<ScoutWithPestsSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || fazendaId == null) {
      setScouts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const sb = getSupabase();

      const { data: pragasData, error: queryError } = await sb
        .from('scout_pragas')
        .select(`
          tipo_praga,
          contagem,
          prioridade,
          observacao,
          data_contagem,
          embrapa_recomendacoes (nome_praga, nome_cientifico, tipo, descricao),
          scouts!inner (
            id,
            nome,
            created_at,
            observacao,
            fazenda_id,
            talhoes (id, nome, area, cultura_atual, coordinates, percentual_infestacao)
          )
        `)
        .eq('scouts.fazenda_id', fazendaId)
        .order('data_contagem', { ascending: false })
        .limit(200);

      if (queryError) {
        logger.error('Erro ao buscar pragas para monitoramentos recentes', { error: queryError });
        throw queryError;
      }

      type TalhaoCoords = { type?: string; coordinates?: number[][][] } | null;
      type TalhaoRow = { id: number; nome: string; area?: number; cultura_atual?: string; coordinates?: TalhaoCoords; percentual_infestacao?: number | null } | null;
      type EmbrapaRow = { nome_praga?: string; nome_cientifico?: string | null; tipo?: string; descricao?: string | null } | null;
      type Row = {
        tipo_praga?: string | null;
        contagem?: number | null;
        prioridade?: string | null;
        observacao?: string | null;
        embrapa_recomendacoes?: EmbrapaRow | EmbrapaRow[];
        scouts?: {
          id: number;
          nome: string;
          created_at: string;
          observacao?: string | null;
          talhoes?: TalhaoRow | TalhaoRow[] | null;
        } | null;
      };

      const prioridadeRank = (p: string) => {
        const u = (p || '').toUpperCase();
        return u === 'ALTA' || u === 'CRITICA' ? 2 : u === 'MEDIA' ? 1 : 0;
      };

      function centroidFromCoordinates(coords: TalhaoCoords | null | undefined): { lat: number; lng: number } | null {
        if (!coords?.coordinates?.[0]?.length) return null;
        const ring = coords.coordinates[0];
        let sumLng = 0, sumLat = 0;
        for (const p of ring) {
          sumLng += p[0];
          sumLat += p[1];
        }
        return { lng: sumLng / ring.length, lat: sumLat / ring.length };
      }

      type PragaAgg = {
        contagem: number;
        prioridade?: string;
        pragaNomeCientifico?: string;
        tipoPraga?: string;
        observacao?: string;
        recomendacao?: string;
      };
      const rows = (pragasData || []) as Row[];
      const byTalhaoKey = new Map<string, {
        talhaoId?: number;
        talhaoNome: string;
        area?: number;
        culturaAtual?: string;
        cultura?: CulturaTalhaoEnum | null;
        percentualInfestacao?: number;
        coordinates?: TalhaoCoords;
        latestCreatedAt: string;
        latestObservacao?: string;
        pragasByNome: Map<string, PragaAgg>;
      }>();

      for (const row of rows) {
        const scout = row.scouts;
        if (!scout) continue;

        const rawTalhao = scout.talhoes;
        const talhao = Array.isArray(rawTalhao) ? rawTalhao[0] : rawTalhao;
        const talhaoId = talhao?.id;
        const talhaoNome = talhao?.nome ?? 'Sem talhão';
        const key = talhaoId != null ? String(talhaoId) : talhaoNome;

        const contagem = row.contagem ?? 1;
        const embrapa = Array.isArray(row.embrapa_recomendacoes) ? row.embrapa_recomendacoes[0] : row.embrapa_recomendacoes;
        const pragaNome = embrapa?.nome_praga ?? 'Praga';

        let cur = byTalhaoKey.get(key);
        if (!cur) {
          cur = {
            talhaoId: talhaoId ?? undefined,
            talhaoNome,
            area: talhao?.area != null ? parseFloat(String(talhao.area)) : undefined,
            culturaAtual: talhao?.cultura_atual != null ? CULTURA_TALHAO_LABEL[talhao.cultura_atual as CulturaTalhaoEnum] : undefined,
            cultura: (talhao?.cultura_atual as CulturaTalhaoEnum | undefined) ?? undefined,
            percentualInfestacao: talhao?.percentual_infestacao != null ? Number(talhao.percentual_infestacao) : undefined,
            coordinates: talhao?.coordinates ?? undefined,
            latestCreatedAt: scout.created_at,
            latestObservacao: scout.observacao ?? undefined,
            pragasByNome: new Map(),
          };
          byTalhaoKey.set(key, cur);
        }
        const existing = cur.pragasByNome.get(pragaNome);
        if (!existing) {
          cur.pragasByNome.set(pragaNome, {
            contagem,
            prioridade: row.prioridade ?? undefined,
            pragaNomeCientifico: embrapa?.nome_cientifico ?? undefined,
            tipoPraga: row.tipo_praga ?? embrapa?.tipo ?? undefined,
            observacao: row.observacao ?? undefined,
            recomendacao: embrapa?.descricao ?? undefined,
          });
        } else {
          existing.contagem += contagem;
          if (row.prioridade && prioridadeRank(row.prioridade) > prioridadeRank(existing.prioridade ?? '')) {
            existing.prioridade = row.prioridade;
          }
          if (embrapa?.nome_cientifico && !existing.pragaNomeCientifico) existing.pragaNomeCientifico = embrapa.nome_cientifico;
          if ((row.tipo_praga ?? embrapa?.tipo) && !existing.tipoPraga) existing.tipoPraga = row.tipo_praga ?? embrapa?.tipo;
          if (row.observacao && !existing.observacao) existing.observacao = row.observacao;
          if (embrapa?.descricao && !existing.recomendacao) existing.recomendacao = embrapa.descricao;
        }
        if (scout.created_at > cur.latestCreatedAt) {
          cur.latestCreatedAt = scout.created_at;
          cur.latestObservacao = scout.observacao ?? undefined;
        }
      }

      const list: ScoutWithPestsSummary[] = Array.from(byTalhaoKey.entries())
        .map(([, agg]) => ({
          totalPragas: Array.from(agg.pragasByNome.values()).reduce((s, a) => s + a.contagem, 0),
          latestCreatedAt: agg.latestCreatedAt,
          agg,
        }))
        .sort((a, b) => (b.latestCreatedAt > a.latestCreatedAt ? 1 : -1))
        .slice(0, limit)
        .map(({ agg, totalPragas, latestCreatedAt }, index) => {
          const center = centroidFromCoordinates(agg.coordinates);
          return {
            id: agg.talhaoId ?? index,
            nome: agg.talhaoNome,
            talhaoNome: agg.talhaoNome,
            talhaoId: agg.talhaoId,
            talhaoArea: agg.area,
            talhaoCulturaAtual: agg.culturaAtual,
            cultura: agg.cultura ?? undefined,
            percentualInfestacao: agg.percentualInfestacao,
            latitude: center ? center.lat : undefined,
            longitude: center ? center.lng : undefined,
            observacoes: agg.latestObservacao,
            createdAt: latestCreatedAt,
            totalPragas,
            pragas: Array.from(agg.pragasByNome.entries())
              .map(([pragaNome, a]) => ({
                pragaNome,
                contagem: a.contagem,
                prioridade: a.prioridade,
                pragaNomeCientifico: a.pragaNomeCientifico,
                tipoPraga: a.tipoPraga,
                observacao: a.observacao,
                recomendacao: a.recomendacao,
              }))
              .sort((a, b) => b.contagem - a.contagem),
          };
        });

      setScouts(list);
    } catch (err: any) {
      logger.error('Erro ao carregar monitoramentos com pragas', { error: err.message });
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [limit, fazendaId]);

  useEffect(() => {
    load();
  }, [load]);

  return { scouts, isLoading, error, refresh: load };
}

/** Resposta da RPC get_talhao_monitoramento_detail (snake_case). */
export interface TalhaoMonitoramentoDetailRpcRow {
  talhao_id: number;
  talhao_nome: string;
  area?: number | null;
  cultura_atual?: string | null;
  percentual_infestacao?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  observacoes?: string | null;
  pragas: Array<{
    praga_nome: string;
    contagem: number;
    prioridade?: string | null;
    praga_nome_cientifico?: string | null;
    tipo_praga?: string | null;
    observacao?: string | null;
    recomendacao?: string | null;
  }>;
}

export interface TalhaoMonitoramentoDetailPayload {
  mode: 'talhao';
  title: string;
  talhaoArea?: number;
  talhaoCulturaAtual?: string;
  cultura?: CulturaTalhaoEnum | null;
  percentualInfestacao?: number;
  latitude?: number;
  longitude?: number;
  observacoes?: string;
  pragas: Array<{
    pragaNome: string;
    contagem: number;
    prioridade?: string;
    pragaNomeCientifico?: string;
    tipoPraga?: string;
    observacao?: string;
    recomendacao?: string;
  }>;
  pestsLoading: false;
  onClose?: () => void;
}

/**
 * Busca dados do talhão para o bottom sheet via RPC get_talhao_monitoramento_detail.
 * Usado na tela Início ao abrir o detalhe: garante todas as pragas do talhão com detalhes.
 */
export async function fetchTalhaoMonitoramentoDetail(
  talhaoId: number,
  title: string,
  onClose?: () => void,
  monthStart?: string,
): Promise<TalhaoMonitoramentoDetailPayload | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = getSupabase();
    const rpcArgs: Record<string, unknown> = { p_talhao_id: talhaoId };
    if (monthStart) rpcArgs.p_month_start = monthStart;
    const { data, error } = await (sb as { rpc: (fn: string, args: Record<string, unknown>) => ReturnType<typeof sb.rpc> }).rpc(
      'get_talhao_monitoramento_detail',
      rpcArgs,
    );
    if (error) {
      logger.error('Erro ao buscar detalhe do talhão (RPC)', { error: error.message, talhaoId });
      return null;
    }
    const row = data as TalhaoMonitoramentoDetailRpcRow | null;
    if (!row || 'error' in row) return null;
    const pragas = (row.pragas ?? []).map((p) => ({
      pragaNome: p.praga_nome ?? 'Desconhecida',
      contagem: p.contagem ?? 0,
      prioridade: p.prioridade ?? undefined,
      pragaNomeCientifico: p.praga_nome_cientifico ?? undefined,
      tipoPraga: p.tipo_praga ?? undefined,
      observacao: p.observacao ?? undefined,
      recomendacao: p.recomendacao ?? undefined,
    }));
    return {
      mode: 'talhao',
      title: row.talhao_nome ?? title,
      talhaoArea: row.area != null ? Number(row.area) : undefined,
      talhaoCulturaAtual: row.cultura_atual != null ? CULTURA_TALHAO_LABEL[row.cultura_atual as CulturaTalhaoEnum] : undefined,
      cultura: (row.cultura_atual as CulturaTalhaoEnum | undefined) ?? undefined,
      percentualInfestacao: row.percentual_infestacao != null ? Number(row.percentual_infestacao) : undefined,
      latitude: row.latitude != null ? Number(row.latitude) : undefined,
      longitude: row.longitude != null ? Number(row.longitude) : undefined,
      observacoes: row.observacoes ?? undefined,
      pragas,
      pestsLoading: false,
      onClose,
    };
  } catch (err: any) {
    logger.error('Erro ao buscar detalhe do talhão', { error: err.message, talhaoId });
    return null;
  }
}

/**
 * Hook para dados do heatmap (derivado de scout_pragas).
 * Se fazendaId for informado, retorna apenas pragas dos scouts dessa fazenda.
 */
export function useSupabaseHeatmap(fazendaId?: number | null) {
  const [points, setPoints] = useState<SupabaseHeatmapPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const sb = getSupabase();

        const { data: pragas, error: pragasError } = fazendaId != null
          ? await sb
              .from('scout_pragas')
              .select('id, coordinates, contagem, embrapa_recomendacoes(nome_praga), scouts!inner(fazenda_id)')
              .eq('scouts.fazenda_id', fazendaId)
          : await sb
              .from('scout_pragas')
              .select('id, coordinates, contagem, embrapa_recomendacoes(nome_praga)');

        if (pragasError) throw pragasError;

        const mapped: SupabaseHeatmapPoint[] = (pragas || [])
          .map((p: any) => {
            const point = pointFromCoordinates(p.coordinates);
            if (!point) return null;
            const er = p.embrapa_recomendacoes ?? {};
            const contagem = p.contagem || 1;
            const intensity = contagem <= 0
              ? 0.05
              : Math.min(1, 1 - Math.exp(-contagem / 4));
            return {
              lat: point.lat,
              lng: point.lng,
              intensity,
              pragaNome: er.nome_praga ?? 'Desconhecida',
            };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);

        setPoints(mapped);
        logger.info('Heatmap carregado do Supabase', { count: mapped.length, fazendaId });
      } catch (err: any) {
        logger.error('Erro ao carregar heatmap do Supabase', { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [fazendaId, refetchTrigger]);

  const refetch = useCallback(() => {
    setRefetchTrigger((v) => v + 1);
  }, []);

  return { points, isLoading, hasData: points.length > 0, refetch };
}

/**
 * Hook para talhões do Supabase (filtrado pela fazenda selecionada)
 */
export function useSupabasePlots() {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
  const [plots, setPlots] = useState<SupabaseTalhao[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured() || fazendaId == null) {
        setPlots([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from('talhoes')
          .select('id, nome, area, cultura_atual, color')
          .eq('fazenda_id', fazendaId)
          .order('nome');

        if (error) throw error;

        const mapped: SupabaseTalhao[] = (data || []).map((row: any) => ({
          id: row.id,
          nome: row.nome,
          area: row.area ? parseFloat(row.area) : undefined,
          culturaAtual: row.cultura_atual != null ? CULTURA_TALHAO_LABEL[row.cultura_atual as CulturaTalhaoEnum] : undefined,
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
  }, [fazendaId]);

  return { plots, isLoading };
}

/**
 * Converte coluna coordinates (GeoJSON Polygon) do banco em array [lat, lng][] para Leaflet.
 * GeoJSON: { type: 'Polygon', coordinates: [ [ [lng, lat], ... ] ] } ou array direto.
 */
export function parseTalhaoCoordinates(raw: unknown): number[][] {
  if (!raw) return [];
  const r = raw as { coordinates?: number[][][] } | number[][][];
  let ring: number[][] = [];
  if (r && typeof r === 'object' && 'coordinates' in r && Array.isArray(r.coordinates?.[0])) {
    ring = r.coordinates[0];
  } else if (Array.isArray(r) && Array.isArray(r[0])) {
    ring = r[0];
  }
  if (ring.length === 0) return [];
  return ring
    .filter((p): p is number[] => Array.isArray(p) && p.length >= 2)
    .map((p) => [p[1], p[0]] as [number, number]);
}

/**
 * Hook para talhões com polígonos (coordinates) para uso no heatmap/mapa.
 * Se fazendaId for informado, retorna apenas talhões dessa fazenda.
 */
export function useSupabaseTalhoesForMap(fazendaId?: number | null) {
  const [talhoes, setTalhoes] = useState<SupabaseTalhaoMap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        let query = getSupabase()
          .from('talhoes')
          .select('id, nome, color, coordinates, area, cultura_atual')
          .order('nome');
        if (fazendaId != null) {
          query = query.eq('fazenda_id', fazendaId);
        }
        const { data, error } = await query;
        if (error) throw error;

        const mapped: SupabaseTalhaoMap[] = (data || [])
          .map((row: any) => {
            const coords = parseTalhaoCoordinates(row.coordinates);
            return {
              id: row.id,
              nome: row.nome,
              color: row.color ?? undefined,
              coords,
              area: row.area != null ? parseFloat(row.area) : undefined,
              culturaAtual: row.cultura_atual != null ? CULTURA_TALHAO_LABEL[row.cultura_atual as CulturaTalhaoEnum] : undefined,
            };
          })
          .filter((t) => t.coords.length >= 3);

        setTalhoes(mapped);
        logger.info('Talhões para mapa carregados do Supabase', { count: mapped.length, fazendaId });
      } catch (err: any) {
        logger.error('Erro ao carregar talhões para mapa', { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [fazendaId, refetchTrigger]);

  const refetch = useCallback(() => {
    setRefetchTrigger((v) => v + 1);
  }, []);

  return { talhoes, isLoading, hasData: talhoes.length > 0, refetch };
}

/**
 * Função para buscar pragas de um scout específico
 */
export async function fetchPestsByScoutId(scoutId: string | number | null): Promise<SupabasePest[]> {
  if (!isSupabaseConfigured() || !scoutId) {
    return [];
  }

  try {
    const sb = getSupabase();
    const numericId = typeof scoutId === 'string' ? parseInt(scoutId) : scoutId;

    const { data, error } = await sb
      .from('scout_pragas')
      .select('*, embrapa_recomendacoes(nome_praga, nome_cientifico, tipo, descricao)')
      .eq('scout_id', numericId)
      .order('contagem', { ascending: false });

    if (error) {
      logger.error('Erro ao buscar pragas do scout', { error: error.message, scoutId });
      return [];
    }

    const er = (p: any) => p.embrapa_recomendacoes ?? {};
    return (data || []).map((p: any) => ({
      id: p.id,
      scoutId: p.scout_id,
      pragaNome: er(p).nome_praga ?? 'Desconhecida',
      pragaNomeCientifico: er(p).nome_cientifico ?? undefined,
      tipoPraga: p.tipo_praga ?? er(p).tipo ?? undefined,
      contagem: p.contagem || 0,
      presenca: p.presenca,
      prioridade: p.prioridade,
      observacao: p.observacao,
      dataContagem: p.data_contagem,
      recomendacao: er(p).descricao ?? undefined,
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
 * Hook para estatísticas do dashboard (filtrado pela fazenda selecionada)
 */
export function useDashboardStats() {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
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
    if (!isSupabaseConfigured() || fazendaId == null) {
      setIsLoading(false);
      return;
    }

    try {
      const sb = getSupabase();
      const [atividadesRes, scoutsRes, pragasRes, talhoesRes] = await Promise.all([
        sb.from('atividades').select('situacao').eq('fazenda_id', fazendaId).is('deleted_at', null),
        sb.from('scouts').select('status, total_pragas').eq('fazenda_id', fazendaId),
        sb.from('scout_pragas').select('id, scouts!inner(fazenda_id)').eq('scouts.fazenda_id', fazendaId),
        sb.from('talhoes').select('id').eq('fazenda_id', fazendaId),
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
  }, [fazendaId]);

  useEffect(() => {
    load();
  }, [load]);

  return { stats, isLoading, refresh: load };
}

/** Resultado do cálculo de saúde da fazenda com base em dados reais */
export interface FarmHealthResult {
  label: 'Excelente' | 'Boa' | 'Regular' | 'Atenção' | 'Crítica' | 'Sem dados';
  score: number; // 0-100
  isLoading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Saúde da fazenda: lida da coluna fazendas.saude (atualizada automaticamente por triggers
 * quando há inserção/atualização em atividades, scouts ou scout_pragas).
 */
export function useFarmHealth(): FarmHealthResult {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;

  const [label, setLabel] = useState<FarmHealthResult['label']>('Sem dados');
  const [score, setScore] = useState(50);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured() || fazendaId == null) {
      setIsLoading(false);
      return;
    }
    try {
      const sb = getSupabase();
      const { data, error } = await sb
        .from('fazendas')
        .select('saude')
        .eq('id', fazendaId)
        .maybeSingle();
      if (error) throw error;
      const row = data as { saude?: { label?: string; score?: number } } | null;
      const saude = row?.saude;
      if (saude) {
        const validLabels: FarmHealthResult['label'][] = [
          'Excelente', 'Boa', 'Regular', 'Atenção', 'Crítica', 'Sem dados',
        ];
        setLabel(validLabels.includes(saude.label as FarmHealthResult['label']) ? saude.label as FarmHealthResult['label'] : 'Sem dados');
        setScore(typeof saude.score === 'number' ? Math.max(0, Math.min(100, saude.score)) : 50);
      }
    } catch (err: any) {
      logger.error('Erro ao carregar saúde da fazenda', { error: err.message });
      setLabel('Sem dados');
      setScore(50);
    } finally {
      setIsLoading(false);
    }
  }, [fazendaId]);

  useEffect(() => {
    setIsLoading(true);
    load();
  }, [load]);

  return {
    label,
    score,
    isLoading,
    refresh: load,
  };
}

/**
 * Hook para atividades por mês (para o gráfico radar) (filtrado pela fazenda selecionada)
 */
export function useActivitiesByMonth() {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
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
      if (!isSupabaseConfigured() || fazendaId == null) {
        setData(demoData);
        setIsLoading(false);
        return;
      }

      try {
        const currentYear = new Date().getFullYear();

        const { data: atividades, error } = await getSupabase()
          .from('atividades')
          .select('created_at')
          .eq('fazenda_id', fazendaId)
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
  }, [fazendaId]);

  return { data, isLoading };
}

/**
 * Hook para top pragas (filtrado pela fazenda selecionada via scouts)
 */
export function useTopPests() {
  const fazenda = useAuthFazendaPadrao();
  const fazendaId = fazenda?.id != null ? Number(fazenda.id) : null;
  const [pests, setPests] = useState<{ name: string; count: number; prioridade: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured() || fazendaId == null) {
        setPests([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from('scout_pragas')
          .select('contagem, prioridade, embrapa_recomendacoes(nome_praga), scouts!inner(fazenda_id)')
          .eq('scouts.fazenda_id', fazendaId);

        if (error) throw error;

        const grouped: Record<string, { count: number; prioridade: string }> = {};
        (data || []).forEach((p: any) => {
          const nome = (p.embrapa_recomendacoes?.nome_praga ?? 'Desconhecida') || 'Desconhecida';
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
  }, [fazendaId]);

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
      const [{ data: scoutsData, error: scoutsError }, { data: talhaoRow }] = await Promise.all([
        sb.from('scouts').select('*').eq('talhao_id', numericPlotId).order('created_at', { ascending: false }),
        sb.from('talhoes').select('percentual_infestacao').eq('id', numericPlotId).single(),
      ]);

      if (scoutsError) throw scoutsError;

      if (!scoutsData || scoutsData.length === 0) {
        setScouts([]);
        setIsLoading(false);
        return;
      }

      const talhaoPercentual = talhaoRow?.percentual_infestacao != null ? Number(talhaoRow.percentual_infestacao) : 0;

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
          percentualInfestacao: talhaoPercentual,
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
