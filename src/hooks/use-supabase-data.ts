/**
 * Hook para buscar dados diretamente do Supabase
 * Usado quando SQLite não está disponível (Expo Go) ou para dados em tempo real
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
  id: string;
  name: string;
  description?: string;
  type: string;
  status: 'pendente' | 'em_andamento' | 'concluida';
  priority: string;
  plotId?: string;
  plotName?: string;
  createdAt: string;
}

export interface SupabaseScout {
  id: string;
  latitude: number;
  longitude: number;
  visited: boolean;
  visitDate?: string;
  observations?: string;
  plotId?: string;
  plotName?: string;
  createdAt: string;
  pestsCount: number;
}

export interface SupabasePest {
  id: string;
  scoutId: string;
  name: string;
  scientificName?: string;
  quantity: number;
  severity: string;
  confidence: number;
  notes?: string;
  createdAt: string;
}

export interface SupabasePlot {
  id: string;
  name: string;
  code: string;
  areaHectares: number;
  culture: string;
  healthStatus: 'healthy' | 'attention' | 'critical';
}

export interface SupabaseHeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  pestType: string;
}

export interface DashboardStats {
  totalActivities: number;
  pendingActivities: number;
  completedActivities: number;
  inProgressActivities: number;
  totalScouts: number;
  visitedScouts: number;
  pendingScouts: number;
  totalPests: number;
  criticalAreas: number;
  healthyAreas: number;
  attentionAreas: number;
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

      const { data, error: supaError } = await getSupabase()
        .from('activities')
        .select('id, name, description, type, status, priority, plot_id, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (supaError) {
        logger.error('Erro na query de atividades', { error: supaError });
        throw supaError;
      }

      const mapped: SupabaseActivity[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        type: row.type,
        status: row.status,
        priority: row.priority,
        plotId: row.plot_id,
        plotName: undefined, // Sem join por simplicidade
        createdAt: row.created_at,
      }));

      setActivities(mapped);
      logger.info('Atividades carregadas do Supabase', { count: mapped.length });
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

      const { data, error: supaError } = await getSupabase()
        .from('scouts')
        .select('id, latitude, longitude, visited, visit_date, observations, plot_id, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (supaError) {
        logger.error('Erro na query de scouts', { error: supaError });
        throw supaError;
      }

      const mapped: SupabaseScout[] = (data || []).map((row: any) => ({
        id: row.id,
        latitude: parseFloat(row.latitude),
        longitude: parseFloat(row.longitude),
        visited: row.visited,
        visitDate: row.visit_date,
        observations: row.observations,
        plotId: row.plot_id,
        plotName: undefined, // Sem join por simplicidade
        createdAt: row.created_at,
        pestsCount: 0, // Será calculado separadamente se necessário
      }));

      setScouts(mapped);
      logger.info('Scouts carregados do Supabase', { count: mapped.length });
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
 * Hook para pragas do Supabase
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

      const { data, error: supaError } = await getSupabase()
        .from('pests')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (supaError) throw supaError;

      const mapped: SupabasePest[] = (data || []).map((row: any) => ({
        id: row.id,
        scoutId: row.scout_id,
        name: row.name,
        scientificName: row.scientific_name,
        quantity: row.quantity,
        severity: row.severity,
        confidence: parseFloat(row.confidence),
        notes: row.notes,
        createdAt: row.created_at,
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

/**
 * Hook para dados do heatmap do Supabase
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
        const { data, error } = await getSupabase()
          .from('heatmap_points')
          .select('latitude, longitude, intensity, pest_type')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped: SupabaseHeatmapPoint[] = (data || []).map((row: any) => ({
          lat: parseFloat(row.latitude),
          lng: parseFloat(row.longitude),
          intensity: parseFloat(row.intensity),
          pestType: row.pest_type,
        }));

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
  const [plots, setPlots] = useState<SupabasePlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from('plots')
          .select('id, name, code, area_hectares, culture, health_status')
          .order('name');

        if (error) throw error;

        const mapped: SupabasePlot[] = (data || []).map((row: any) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          areaHectares: parseFloat(row.area_hectares),
          culture: row.culture,
          healthStatus: row.health_status,
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
 * Hook para estatísticas do dashboard
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalActivities: 0,
    pendingActivities: 0,
    completedActivities: 0,
    inProgressActivities: 0,
    totalScouts: 0,
    visitedScouts: 0,
    pendingScouts: 0,
    totalPests: 0,
    criticalAreas: 0,
    healthyAreas: 0,
    attentionAreas: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        // Buscar todas as estatísticas em paralelo
        const sb = getSupabase();
        const [activitiesRes, scoutsRes, pestsRes, plotsRes] = await Promise.all([
          sb.from('activities').select('status').is('deleted_at', null),
          sb.from('scouts').select('visited').is('deleted_at', null),
          sb.from('pests').select('id').is('deleted_at', null),
          sb.from('plots').select('health_status'),
        ]);

        const activities = activitiesRes.data || [];
        const scouts = scoutsRes.data || [];
        const pests = pestsRes.data || [];
        const plots = plotsRes.data || [];

        setStats({
          totalActivities: activities.length,
          pendingActivities: activities.filter((a: any) => a.status === 'pendente').length,
          completedActivities: activities.filter((a: any) => a.status === 'concluida').length,
          inProgressActivities: activities.filter((a: any) => a.status === 'em_andamento').length,
          totalScouts: scouts.length,
          visitedScouts: scouts.filter((s: any) => s.visited).length,
          pendingScouts: scouts.filter((s: any) => !s.visited).length,
          totalPests: pests.length,
          criticalAreas: plots.filter((p: any) => p.health_status === 'critical').length,
          healthyAreas: plots.filter((p: any) => p.health_status === 'healthy').length,
          attentionAreas: plots.filter((p: any) => p.health_status === 'attention').length,
        });

        logger.info('Estatísticas do dashboard carregadas');
      } catch (err: any) {
        logger.error('Erro ao carregar estatísticas', { error: err.message });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { stats, isLoading };
}

/**
 * Hook para atividades por mês (para o gráfico radar)
 */
export function useActivitiesByMonth() {
  const [data, setData] = useState<{ label: string; value: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        // Dados mock para quando Supabase não está configurado
        setData([
          { label: 'Jan', value: 5 },
          { label: 'Fev', value: 8 },
          { label: 'Mar', value: 6 },
          { label: 'Abr', value: 4 },
          { label: 'Mai', value: 7 },
          { label: 'Jun', value: 3 },
        ]);
        setIsLoading(false);
        return;
      }

      try {
        const currentYear = new Date().getFullYear();
        
        const { data: activities, error } = await getSupabase()
          .from('activities')
          .select('created_at')
          .is('deleted_at', null)
          .gte('created_at', `${currentYear}-01-01`)
          .lte('created_at', `${currentYear}-12-31`);

        if (error) throw error;

        // Contar por mês
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const counts = new Array(12).fill(0);

        (activities || []).forEach((a: any) => {
          const month = new Date(a.created_at).getMonth();
          counts[month]++;
        });

        // Pegar últimos 6 meses com dados relevantes ou os 6 primeiros
        const result = monthNames.slice(0, 6).map((label, index) => ({
          label,
          value: counts[index],
        }));

        setData(result);
        logger.info('Atividades por mês carregadas', { months: result.length });
      } catch (err: any) {
        logger.error('Erro ao carregar atividades por mês', { error: err.message });
        // Fallback com dados mock
        setData([
          { label: 'Jan', value: 5 },
          { label: 'Fev', value: 8 },
          { label: 'Mar', value: 6 },
          { label: 'Abr', value: 4 },
          { label: 'Mai', value: 7 },
          { label: 'Jun', value: 3 },
        ]);
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
  const [pests, setPests] = useState<{ name: string; count: number; severity: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!isSupabaseConfigured()) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await getSupabase()
          .from('pests')
          .select('name, quantity, severity')
          .is('deleted_at', null);

        if (error) throw error;

        // Agrupar por nome
        const grouped: Record<string, { count: number; severity: string }> = {};
        (data || []).forEach((p: any) => {
          if (!grouped[p.name]) {
            grouped[p.name] = { count: 0, severity: p.severity };
          }
          grouped[p.name].count += p.quantity;
          // Manter a severidade mais alta
          if (p.severity === 'critica' || 
              (p.severity === 'alta' && grouped[p.name].severity !== 'critica') ||
              (p.severity === 'media' && !['critica', 'alta'].includes(grouped[p.name].severity))) {
            grouped[p.name].severity = p.severity;
          }
        });

        const result = Object.entries(grouped)
          .map(([name, data]) => ({ name, ...data }))
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
