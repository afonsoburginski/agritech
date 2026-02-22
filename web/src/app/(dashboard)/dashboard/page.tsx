'use client'

import Link from 'next/link'
import { useState, useMemo, useCallback } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Bug, AlertTriangle, TrendingUp, ChevronRight, Leaf,
  ClipboardList, Calendar, CheckCircle2, MapPin, Clock,
  Loader2, Trash2, Award, Gauge, AlertCircle, BarChart2, Heart,
} from 'lucide-react'
import { useSupabaseQuery, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'
import { format, subDays, subMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type ChartRange = 7 | 30 | 365
const CHART_RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 365, label: '1 ano' },
]

const TIPOS_ATIVIDADE: { value: string; label: string }[] = [
  { value: 'MONITORAMENTO', label: 'Monitoramento' },
  { value: 'APLICACAO', label: 'Aplicação' },
  { value: 'CONTROLE_PRAGAS', label: 'Controle de Pragas' },
  { value: 'VERIFICACAO', label: 'Verificação' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'OUTROS', label: 'Outros' },
]

interface AtividadeRow {
  id: number
  titulo: string
  descricao: string | null
  tipo: string | null
  situacao: string
  data_inicio: string | null
  created_at: string
  talhao_ids: number[] | null
}

function getSituacaoLabel(s: string) {
  switch (s) {
    case 'CONCLUIDA': return 'Concluída'
    case 'EM_ANDAMENTO': return 'Em andamento'
    default: return 'Pendente'
  }
}

function getSituacaoStyle(s: string): { bg: string; text: string; letter: string } {
  switch (s) {
    case 'CONCLUIDA': return { bg: 'bg-green-600', text: 'text-green-600', letter: 'C' }
    case 'EM_ANDAMENTO': return { bg: 'bg-blue-500', text: 'text-blue-600', letter: 'E' }
    default: return { bg: 'bg-amber-500', text: 'text-amber-600', letter: 'P' }
  }
}

interface ScoutPraga {
  id: number
  praga_nome: string | null
  tipo_praga: string | null
  contagem: number | null
  prioridade: string | null
  data_contagem: string | null
  imagem_url: string | null
  recomendacao: string | null
  embrapa_recomendacao_id: number | null
  scouts?: { id: number; nome: string; talhao_id: number | null } | null
}

interface ChartRow {
  data_contagem: string | null
  prioridade: string | null
}

/** Linha de scout_pragas com fazenda_id para agregar saúde por dia por fazenda (scouts pode vir como objeto ou array do Supabase) */
interface SaudeDailyRow {
  data_contagem: string | null
  prioridade: string | null
  scouts: { fazenda_id: number } | { fazenda_id: number }[] | null
}

type SaudeLabel = 'Excelente' | 'Boa' | 'Regular' | 'Atenção' | 'Crítica' | 'Sem dados'
interface SaudeData {
  label: SaudeLabel
  score: number
  stats?: {
    totalPests?: number
    totalScouts?: number
    totalTalhoes?: number
    pendingScouts?: number
    completedScouts?: number
    totalActivities?: number
    pendingActivities?: number
    completedActivities?: number
    inProgressActivities?: number
  }
  pestSeverity?: { alta?: number; media?: number }
}
const SAUDE_LABELS: { value: SaudeLabel; label: string; className: string; icon: typeof Award }[] = [
  { value: 'Excelente', label: 'Excelente', className: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/40', icon: Award },
  { value: 'Boa', label: 'Boa', className: 'bg-green-500/15 text-green-700 border-green-500/40', icon: CheckCircle2 },
  { value: 'Regular', label: 'Regular', className: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/40', icon: Gauge },
  { value: 'Atenção', label: 'Atenção', className: 'bg-amber-500/15 text-amber-700 border-amber-500/40', icon: AlertTriangle },
  { value: 'Crítica', label: 'Crítica', className: 'bg-red-500/15 text-red-700 border-red-500/40', icon: AlertCircle },
  { value: 'Sem dados', label: 'Sem dados', className: 'bg-muted text-muted-foreground border-border', icon: BarChart2 },
]
function getSaudeStyle(l: SaudeLabel) {
  return SAUDE_LABELS.find(s => s.value === l) ?? SAUDE_LABELS[SAUDE_LABELS.length - 1]
}

/** Tooltip do chart de saúde: mostra por ponto (dia/mês) score + Alta/Média/Baixa daquele período apenas */
function SaudeChartTooltipContent({
  active,
  payload,
  label,
  saudeFazendas,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; name?: string; value?: number; color?: string; payload?: Record<string, unknown> }>
  label?: string
  saudeFazendas: { id: number; nome: string; saude: SaudeData | null }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="border-border bg-background min-w-[10rem] max-w-[18rem] rounded-lg border px-2.5 py-1.5 text-xs shadow-xl transition-all ease-in-out">
      {label != null && <div className="font-medium text-foreground mb-1.5">{String(label)}</div>}
      <div className="grid gap-2">
        {payload.map((item) => {
          const fazenda = saudeFazendas.find((f) => String(f.id) === String(item.dataKey))
          const row = item.payload ?? {}
          const alta = Number(row[`${item.dataKey}_alta`] ?? 0)
          const media = Number(row[`${item.dataKey}_media`] ?? 0)
          const baixa = Number(row[`${item.dataKey}_baixa`] ?? 0)
          const total = alta + media + baixa
          return (
            <div key={String(item.dataKey)} className="space-y-1 rounded border border-border/50 bg-muted/30 px-2 py-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color ?? 'var(--muted-foreground)' }}
                  />
                  <span className="text-muted-foreground font-medium">{item.name ?? fazenda?.nome}</span>
                </span>
                <span className="text-foreground font-mono font-semibold tabular-nums">
                  Score: {typeof item.value === 'number' ? Math.round(item.value) : item.value}/100
                </span>
              </div>
              <div className="text-muted-foreground space-y-0.5 pt-0.5 border-t border-border/50">
                <div>
                  Neste período: Alta {alta} · Média {media} · Baixa {baixa}
                  {total > 0 && <span className="ml-1">({total} identificações)</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Tooltip do chart de prioridade: mostra data + Alta/Média/Baixa + total do dia */
function PrioridadeChartTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey?: string; name?: string; value?: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (typeof p.value === 'number' ? p.value : 0), 0)
  return (
    <div className="border-border bg-background min-w-[10rem] rounded-lg border px-2.5 py-1.5 text-xs shadow-xl transition-all ease-in-out">
      {label != null && <div className="font-medium text-foreground mb-1.5">{String(label)}</div>}
      <div className="grid gap-1.5">
        {payload.map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color ?? 'var(--muted-foreground)' }}
              />
              <span className="text-muted-foreground">{item.name}</span>
            </span>
            <span className="text-foreground font-mono font-medium tabular-nums">{typeof item.value === 'number' ? item.value : item.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-border/50 flex justify-between text-muted-foreground">
        <span>Total do dia</span>
        <span className="font-mono font-semibold text-foreground tabular-nums">{total}</span>
      </div>
    </div>
  )
}

const priorityVariant = (p: string | null) => {
  if (p === 'ALTA' || p === 'CRITICA') return 'destructive' as const
  if (p === 'MEDIA') return 'secondary' as const
  return 'outline' as const
}

const columns: ColumnDef<ScoutPraga>[] = [
  {
    accessorKey: 'praga_nome',
    header: ({ column }) => <SortableHeader column={column}>Praga</SortableHeader>,
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.praga_nome ?? 'Não identificada'}</div>
        {row.original.tipo_praga && (
          <div className="text-xs text-muted-foreground">{row.original.tipo_praga}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'contagem',
    header: ({ column }) => <SortableHeader column={column}>Qtd</SortableHeader>,
    cell: ({ row }) => <span className="tabular-nums">{row.original.contagem ?? 1}</span>,
  },
  {
    accessorKey: 'prioridade',
    header: ({ column }) => <SortableHeader column={column}>Prioridade</SortableHeader>,
    cell: ({ row }) => (
      <Badge variant={priorityVariant(row.original.prioridade)}>
        {row.original.prioridade ?? 'N/A'}
      </Badge>
    ),
  },
  {
    id: 'scout',
    header: 'Scout',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.scouts?.nome ?? '--'}
      </span>
    ),
  },
  {
    accessorKey: 'data_contagem',
    header: ({ column }) => <SortableHeader column={column}>Data</SortableHeader>,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.data_contagem
          ? new Date(row.original.data_contagem).toLocaleDateString('pt-BR')
          : '--'}
      </span>
    ),
  },
]

export default function DashboardPage() {
  const [fazendaId, setFazendaId] = useState<number | null>(null)
  const [chartRange, setChartRange] = useState<ChartRange>(30)

  const { data: fazendas } = useSupabaseQuery<{ id: number; nome: string }[]>(
    queryKeys.fazendas.list(),
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return []
      const { data: uf } = await sb.from('user_fazendas').select('fazenda_id').eq('user_id', user.id)
      const ids = (uf ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (!ids.length) return []
      const { data } = await sb.from('fazendas').select('id, nome').in('id', ids).order('nome')
      return (data ?? []) as { id: number; nome: string }[]
    },
  )

  const { data: identificationsResult, isLoading: loadingPragas } = useSupabaseQuery<{ rows: ScoutPraga[]; count: number }>(
    queryKeys.stats.dashboard(fazendaId),
    async (sb) => {
      if (fazendaId == null) {
        const { data, count } = await sb
          .from('scout_pragas')
          .select('*, scouts(id, nome, talhao_id)', { count: 'exact' })
          .order('data_contagem', { ascending: false })
          .limit(100)
        return { rows: (data ?? []) as ScoutPraga[], count: count ?? 0 }
      }
      const { data, count } = await sb
        .from('scout_pragas')
        .select('*, scouts!inner(id, nome, talhao_id, fazenda_id)', { count: 'exact' })
        .eq('scouts.fazenda_id', fazendaId)
        .order('data_contagem', { ascending: false })
        .limit(100)
      return { rows: (data ?? []) as ScoutPraga[], count: count ?? 0 }
    },
  )
  const identifications = identificationsResult?.rows ?? []
  const totalIdentificationsCount = identificationsResult?.count ?? 0

  const { data: chartRaw = [], isLoading: loadingCharts } = useSupabaseQuery<ChartRow[]>(
    queryKeys.stats.charts(fazendaId, chartRange),
    async (sb) => {
      const since = subDays(new Date(), chartRange).toISOString()
      if (fazendaId == null) {
        const { data } = await sb
          .from('scout_pragas')
          .select('data_contagem, prioridade')
          .gte('data_contagem', since)
          .order('data_contagem', { ascending: true })
        return (data ?? []) as ChartRow[]
      }
      const { data: scoutIds } = await sb.from('scouts').select('id').eq('fazenda_id', fazendaId)
      const ids = (scoutIds ?? []).map((r: { id: number }) => r.id)
      if (!ids.length) return []
      const { data } = await sb
        .from('scout_pragas')
        .select('data_contagem, prioridade')
        .in('scout_id', ids)
        .gte('data_contagem', since)
        .order('data_contagem', { ascending: true })
      return (data ?? []) as ChartRow[]
    },
  )

  const { data: activities = [], refetch: refetchActivities } = useSupabaseQuery<AtividadeRow[]>(
    queryKeys.stats.activities(fazendaId),
    async (sb) => {
      let q = sb.from('atividades').select('id, titulo, descricao, tipo, situacao, data_inicio, created_at, talhao_ids').is('deleted_at', null).order('created_at', { ascending: false }).limit(20)
      if (fazendaId != null) {
        q = q.eq('fazenda_id', fazendaId)
      } else {
        const { data: { user } } = await sb.auth.getUser()
        if (!user) return []
        const { data: uf } = await sb.from('user_fazendas').select('fazenda_id').eq('user_id', user.id)
        const fids = (uf ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
        if (!fids.length) return []
        q = q.in('fazenda_id', fids)
      }
      const { data } = await q
      return (data ?? []) as AtividadeRow[]
    },
  )

  const { data: talhoesList = [] } = useSupabaseQuery<{ id: number; nome: string }[]>(
    queryKeys.stats.talhoesList(fazendaId),
    async (sb) => {
      if (fazendaId != null) {
        const { data } = await sb.from('talhoes').select('id, nome').eq('fazenda_id', fazendaId)
        return (data ?? []) as { id: number; nome: string }[]
      }
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return []
      const { data: uf } = await sb.from('user_fazendas').select('fazenda_id').eq('user_id', user.id)
      const fids = (uf ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (!fids.length) return []
      const { data } = await sb.from('talhoes').select('id, nome').in('fazenda_id', fids)
      return (data ?? []) as { id: number; nome: string }[]
    },
  )

  const { data: saudeFazendas = [], isLoading: loadingSaude } = useSupabaseQuery<{ id: number; nome: string; saude: SaudeData | null }[]>(
    queryKeys.stats.saude(fazendaId),
    async (sb) => {
      if (fazendaId != null) {
        const { data } = await sb.from('fazendas').select('id, nome, saude').eq('id', fazendaId).maybeSingle()
        if (!data) return []
        const saude = data.saude as SaudeData | null
        const label = saude?.label && ['Excelente', 'Boa', 'Regular', 'Atenção', 'Crítica', 'Sem dados'].includes(saude.label) ? saude.label : 'Sem dados'
        return [{ id: data.id, nome: data.nome, saude: saude ? { ...saude, label: label as SaudeLabel } : { label: 'Sem dados' as SaudeLabel, score: 0 } }]
      }
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return []
      const { data: uf } = await sb.from('user_fazendas').select('fazenda_id').eq('user_id', user.id)
      const fids = (uf ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (!fids.length) return []
      const { data } = await sb.from('fazendas').select('id, nome, saude').in('id', fids)
      return (data ?? []).map((f: { id: number; nome: string; saude: unknown }) => {
        const saude = f.saude as SaudeData | null
        const label = saude?.label && ['Excelente', 'Boa', 'Regular', 'Atenção', 'Crítica', 'Sem dados'].includes(saude.label) ? saude.label : 'Sem dados'
        return { id: f.id, nome: f.nome, saude: saude ? { ...saude, label: label as SaudeLabel } : { label: 'Sem dados' as SaudeLabel, score: 0 } }
      })
    },
  )

  const { data: saudeDailyRaw = [] } = useSupabaseQuery<SaudeDailyRow[]>(
    queryKeys.stats.saudeDaily(fazendaId, chartRange),
    async (sb) => {
      const since = subDays(new Date(), chartRange).toISOString()
      if (fazendaId != null) {
        const { data: scoutIds } = await sb.from('scouts').select('id').eq('fazenda_id', fazendaId)
        const ids = (scoutIds ?? []).map((r: { id: number }) => r.id)
        if (!ids.length) return []
        const { data } = await sb
          .from('scout_pragas')
          .select('data_contagem, prioridade, scouts(fazenda_id)')
          .in('scout_id', ids)
          .gte('data_contagem', since)
          .order('data_contagem', { ascending: true })
        return (data ?? []).map((r: { data_contagem: string | null; prioridade: string | null; scouts?: { fazenda_id: number } | { fazenda_id: number }[] | null }) => {
          const sc = r.scouts
          const fazendaIdVal = Array.isArray(sc) ? sc[0]?.fazenda_id : sc?.fazenda_id
          return { data_contagem: r.data_contagem, prioridade: r.prioridade, scouts: fazendaIdVal != null ? { fazenda_id: fazendaIdVal } : { fazenda_id: fazendaId } }
        }) as SaudeDailyRow[]
      }
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return []
      const { data: uf } = await sb.from('user_fazendas').select('fazenda_id').eq('user_id', user.id)
      const fids = (uf ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (!fids.length) return []
      const { data } = await sb
        .from('scout_pragas')
        .select('data_contagem, prioridade, scouts!inner(fazenda_id)')
        .in('scouts.fazenda_id', fids)
        .gte('data_contagem', since)
        .order('data_contagem', { ascending: true })
      return (data ?? []).map((r: { data_contagem: string | null; prioridade: string | null; scouts?: { fazenda_id: number } | { fazenda_id: number }[] | null }) => {
        const sc = r.scouts
        const fazendaIdVal = Array.isArray(sc) ? sc[0]?.fazenda_id : sc?.fazenda_id
        return { data_contagem: r.data_contagem, prioridade: r.prioridade, scouts: fazendaIdVal != null ? { fazenda_id: fazendaIdVal } : null } as SaudeDailyRow
      }) as SaudeDailyRow[]
    },
  )

  const [selectedActivity, setSelectedActivity] = useState<AtividadeRow | null>(null)
  const [taskToggling, setTaskToggling] = useState(false)
  const [taskDeleting, setTaskDeleting] = useState(false)

  const handleToggleTask = useCallback(async () => {
    if (!selectedActivity) return
    setTaskToggling(true)
    const newStatus = selectedActivity.situacao === 'CONCLUIDA' ? 'PENDENTE' : 'CONCLUIDA'
    await supabase.from('atividades').update({ situacao: newStatus, updated_at: new Date().toISOString() }).eq('id', selectedActivity.id)
    await refetchActivities()
    setSelectedActivity(prev => prev ? { ...prev, situacao: newStatus } : null)
    setTaskToggling(false)
  }, [selectedActivity, refetchActivities])

  const handleDeleteTask = useCallback(async () => {
    if (!selectedActivity) return
    if (!confirm(`Excluir a tarefa "${selectedActivity.titulo}"?`)) return
    setTaskDeleting(true)
    await supabase.from('atividades').update({ deleted_at: new Date().toISOString() }).eq('id', selectedActivity.id)
    await refetchActivities()
    setSelectedActivity(null)
    setTaskDeleting(false)
  }, [selectedActivity, refetchActivities])

  const chartDataByDay = useMemo(() => {
    const isYear = chartRange === 365
    const byKey: Record<string, { date: string; total: number; ALTA: number; MEDIA: number; BAIXA: number }> = {}

    if (isYear) {
      for (let m = 0; m < 12; m++) {
        const d = startOfMonth(subMonths(new Date(), 11 - m))
        const key = format(d, 'yyyy-MM')
        byKey[key] = { date: format(d, 'MMM/yy', { locale: ptBR }), total: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 }
      }
      chartRaw.forEach((row) => {
        const dateVal = row.data_contagem
        if (!dateVal) return
        const key = format(new Date(dateVal), 'yyyy-MM')
        if (!byKey[key]) return
        byKey[key].total += 1
        const p = row.prioridade ?? 'BAIXA'
        if (p === 'ALTA' || p === 'CRITICA') byKey[key].ALTA += 1
        else if (p === 'MEDIA') byKey[key].MEDIA += 1
        else byKey[key].BAIXA += 1
      })
    } else {
      const days = chartRange
      for (let d = 0; d <= days; d++) {
        const day = format(subDays(new Date(), days - d), 'yyyy-MM-dd')
        byKey[day] = { date: format(subDays(new Date(), days - d), 'dd/MM', { locale: ptBR }), total: 0, ALTA: 0, MEDIA: 0, BAIXA: 0 }
      }
      chartRaw.forEach((row) => {
        const dateVal = row.data_contagem
        if (!dateVal) return
        const day = format(new Date(dateVal), 'yyyy-MM-dd')
        if (!byKey[day]) return
        byKey[day].total += 1
        const p = row.prioridade ?? 'BAIXA'
        if (p === 'ALTA' || p === 'CRITICA') byKey[day].ALTA += 1
        else if (p === 'MEDIA') byKey[day].MEDIA += 1
        else byKey[day].BAIXA += 1
      })
    }

    return Object.keys(byKey)
      .sort()
      .map((k) => byKey[k])
  }, [chartRaw, chartRange])

  const prioridadeTotais = useMemo(() => {
    let alta = 0, media = 0, baixa = 0
    chartDataByDay.forEach((d) => {
      alta += d.ALTA
      media += d.MEDIA
      baixa += d.BAIXA
    })
    return { alta, media, baixa, total: alta + media + baixa }
  }, [chartDataByDay])

  const saudeChartColors = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--destructive))']
  const saudeChartConfig = useMemo<ChartConfig>(() => {
    const c: ChartConfig = { date: { label: 'Data' } }
    saudeFazendas.forEach((f, i) => {
      c[String(f.id)] = { label: f.nome, color: saudeChartColors[i % saudeChartColors.length] }
    })
    return c
  }, [saudeFazendas])
  const prioridadeChartConfig: ChartConfig = useMemo(() => ({
    date: { label: 'Data' },
    ALTA: { label: 'Alta/Crítica', color: 'hsl(var(--destructive))' },
    MEDIA: { label: 'Média', color: 'hsl(38, 92%, 50%)' },
    BAIXA: { label: 'Baixa', color: 'hsl(var(--primary))' },
  }), [])
  /** Score por fazenda (diário ou mensal): derivado de scout_pragas. Penalidades: Alta -12, Média -4, Baixa -1; base 100, limitado 0–100. */
  const saudeChartData = useMemo(() => {
    const isYear = chartRange === 365
    const PENALTY_ALTA = 12
    const PENALTY_MEDIA = 4
    const PENALTY_BAIXA = 1

    const byFarmByKey: Record<number, Record<string, { alta: number; media: number; baixa: number }>> = {}
    if (isYear) {
      saudeFazendas.forEach((f) => {
        byFarmByKey[f.id] = {}
        for (let m = 0; m < 12; m++) {
          const d = startOfMonth(subMonths(new Date(), 11 - m))
          const key = format(d, 'yyyy-MM')
          byFarmByKey[f.id][key] = { alta: 0, media: 0, baixa: 0 }
        }
      })
      saudeDailyRaw.forEach((row) => {
        const sc = row.scouts
        const fid = Array.isArray(sc) ? sc[0]?.fazenda_id : sc?.fazenda_id
        if (fid == null || !byFarmByKey[fid]) return
        const dateVal = row.data_contagem
        if (!dateVal) return
        const key = format(new Date(dateVal), 'yyyy-MM')
        const cell = byFarmByKey[fid][key]
        if (!cell) return
        const p = row.prioridade ?? 'BAIXA'
        if (p === 'ALTA' || p === 'CRITICA') cell.alta += 1
        else if (p === 'MEDIA') cell.media += 1
        else cell.baixa += 1
      })
      const result: Record<string, number | string | null>[] = []
      for (let m = 0; m < 12; m++) {
        const d = startOfMonth(subMonths(new Date(), 11 - m))
        const key = format(d, 'yyyy-MM')
        const row: Record<string, number | string | null> = { date: format(d, 'MMM/yy', { locale: ptBR }) }
        saudeFazendas.forEach((f) => {
          const cell = byFarmByKey[f.id]?.[key]
          const alta = cell?.alta ?? 0
          const media = cell?.media ?? 0
          const baixa = cell?.baixa ?? 0
          const total = alta + media + baixa
          row[`${f.id}_alta`] = alta
          row[`${f.id}_media`] = media
          row[`${f.id}_baixa`] = baixa
          if (total === 0) {
            row[String(f.id)] = 0
          } else {
            const score = Math.max(0, Math.min(100, 100 - PENALTY_ALTA * alta - PENALTY_MEDIA * media - PENALTY_BAIXA * baixa))
            row[String(f.id)] = Math.round(score)
          }
        })
        result.push(row)
      }
      return result
    }

    const days = chartRange
    saudeFazendas.forEach((f) => {
      byFarmByKey[f.id] = {}
      for (let d = 0; d <= days; d++) {
        const day = format(subDays(new Date(), days - d), 'yyyy-MM-dd')
        byFarmByKey[f.id][day] = { alta: 0, media: 0, baixa: 0 }
      }
    })
    saudeDailyRaw.forEach((row) => {
      const sc = row.scouts
      const fid = Array.isArray(sc) ? sc[0]?.fazenda_id : sc?.fazenda_id
      if (fid == null || !byFarmByKey[fid]) return
      const dateVal = row.data_contagem
      if (!dateVal) return
      const day = format(new Date(dateVal), 'yyyy-MM-dd')
      const cell = byFarmByKey[fid][day]
      if (!cell) return
      const p = row.prioridade ?? 'BAIXA'
      if (p === 'ALTA' || p === 'CRITICA') cell.alta += 1
      else if (p === 'MEDIA') cell.media += 1
      else cell.baixa += 1
    })
    const result: Record<string, number | string | null>[] = []
    for (let d = 0; d <= days; d++) {
      const date = format(subDays(new Date(), days - d), 'yyyy-MM-dd')
      const row: Record<string, number | string | null> = { date: format(subDays(new Date(), days - d), 'dd/MM', { locale: ptBR }) }
      saudeFazendas.forEach((f) => {
        const cell = byFarmByKey[f.id]?.[date]
        const alta = cell?.alta ?? 0
        const media = cell?.media ?? 0
        const baixa = cell?.baixa ?? 0
        const total = alta + media + baixa
        row[`${f.id}_alta`] = alta
        row[`${f.id}_media`] = media
        row[`${f.id}_baixa`] = baixa
        if (total === 0) {
          row[String(f.id)] = 0
        } else {
          const score = Math.max(0, Math.min(100, 100 - PENALTY_ALTA * alta - PENALTY_MEDIA * media - PENALTY_BAIXA * baixa))
          row[String(f.id)] = Math.round(score)
        }
      })
      result.push(row)
    }
    return result
  }, [saudeFazendas, saudeDailyRaw, chartRange])

  const stats = {
    total: totalIdentificationsCount,
    alta: identifications.filter(d => d.prioridade === 'ALTA' || d.prioridade === 'CRITICA').length,
    comRecomendacao: identifications.filter(d => d.embrapa_recomendacao_id != null).length,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Monitoramento de pragas e identificações recentes</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={String(chartRange)}
            onValueChange={(v) => setChartRange(Number(v) as ChartRange)}
          >
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {CHART_RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fazendas && fazendas.length > 0 && (
            <Select
              value={fazendaId == null ? 'all' : String(fazendaId)}
              onValueChange={(v) => setFazendaId(v === 'all' ? null : Number(v))}
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="Fazenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Ver todos</SelectItem>
                {fazendas.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Bug className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Identificações</p>
                <p className="text-lg font-semibold tabular-nums">
                  {loadingPragas ? <Skeleton className="h-6 w-10" /> : stats.total}
                </p>
                <p className="text-[10px] text-muted-foreground">últimas 100 no filtro</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-destructive/10 p-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Alta / Crítica</p>
                <p className="text-lg font-semibold tabular-nums text-destructive">
                  {loadingPragas ? <Skeleton className="h-6 w-10" /> : stats.alta}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {stats.total > 0 ? `${Math.round((stats.alta / stats.total) * 100)}% do total` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Leaf className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Com recomendação</p>
                <p className="text-lg font-semibold tabular-nums text-primary">
                  {loadingPragas ? <Skeleton className="h-6 w-10" /> : stats.comRecomendacao}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {stats.total > 0 ? `${Math.round((stats.comRecomendacao / stats.total) * 100)}% do total` : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex flex-row items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Heart className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">Saúde atual</p>
                {loadingSaude ? (
                  <Skeleton className="h-6 w-16 mt-0.5" />
                ) : saudeFazendas.length === 0 ? (
                  <p className="text-sm font-medium text-muted-foreground">—</p>
                ) : saudeFazendas.length === 1 ? (
                  <>
                    <p className="text-lg font-semibold tabular-nums">
                      {(() => {
                        const s = saudeFazendas[0].saude ?? { label: 'Sem dados' as SaudeLabel, score: 0 }
                        const style = getSaudeStyle(s.label)
                        const textClass = style.className.split(' ').find(c => c.startsWith('text-')) ?? 'text-muted-foreground'
                        return <span className={textClass}>{style.label}</span>
                      })()}
                      {' · '}
                      <span className="text-muted-foreground">
                        {typeof saudeFazendas[0].saude?.score === 'number' ? Math.round(saudeFazendas[0].saude.score) : 0}/100
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{saudeFazendas[0].nome}</p>
                  </>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{saudeFazendas.length} fazendas</p>
                    <ul className="space-y-0.5">
                      {saudeFazendas.map((f) => {
                        const s = f.saude ?? { label: 'Sem dados' as SaudeLabel, score: 0 }
                        const style = getSaudeStyle(s.label)
                        const textClass = style.className.split(' ').find(c => c.startsWith('text-')) ?? 'text-muted-foreground'
                        return (
                          <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-muted-foreground">{f.nome}</span>
                            <span className="shrink-0 tabular-nums">
                              <span className={textClass}>{style.label}</span>
                              <span className="ml-1 text-muted-foreground">
                                {typeof s.score === 'number' ? Math.round(s.score) : 0}/100
                              </span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <Card className="flex flex-col">
          <CardHeader className="pb-2 min-h-[11rem] flex flex-col justify-start">
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Saúde da fazenda
            </CardTitle>
            <CardDescription>
              {chartRange === 365
                ? 'Score de saúde (0–100) por fazenda, por mês nos últimos 12 meses. Passe o mouse para detalhes (scouts, pragas, severidade).'
                : `Score de saúde (0–100) por fazenda, calculado por dia nos últimos ${chartRange} dias. Passe o mouse para detalhes.`}
            </CardDescription>
            {saudeFazendas.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {saudeFazendas.map((f, i) => {
                  const s = f.saude ?? { label: 'Sem dados' as SaudeLabel, score: 0 }
                  const style = getSaudeStyle(s.label)
                  const color = saudeChartColors[i % saudeChartColors.length]
                  return (
                    <Badge key={f.id} variant="outline" className={`text-xs font-medium border ${style.className}`}>
                      <span className="h-2 w-2 rounded-full mr-1.5 shrink-0" style={{ backgroundColor: color }} />
                      {f.nome} · {style.label} ({typeof s.score === 'number' ? Math.round(s.score) : 0})
                    </Badge>
                  )
                })}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loadingSaude ? (
              <Skeleton className="h-[280px] w-full rounded-xl" />
            ) : saudeFazendas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart2 className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Nenhuma fazenda ou dados de saúde disponíveis</p>
              </div>
            ) : (
              <ChartContainer config={saudeChartConfig} className="min-h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={saudeChartData}
                    margin={{ left: 12, right: 12 }}
                    accessibilityLayer
                  >
                    <CartesianGrid vertical={false} className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => (chartRange === 365 ? value : String(value).slice(0, 5))}
                    />
                    <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={28} />
                    <RechartsTooltip
                      content={<SaudeChartTooltipContent saudeFazendas={saudeFazendas} />}
                      cursor={false}
                    />
                    {saudeFazendas.map((f) => (
                      <Line
                        key={f.id}
                        type="monotone"
                        dataKey={String(f.id)}
                        name={f.nome}
                        stroke={`var(--color-${f.id})`}
                        strokeWidth={2}
                        dot={{ fill: `var(--color-${f.id})` }}
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-2 min-h-[11rem] flex flex-col justify-start">
            <div className="space-y-1.5">
              <CardTitle>Identificações por prioridade</CardTitle>
              <CardDescription>
                {chartRange === 365
                  ? 'Quantidade de pragas por mês nos últimos 12 meses, por prioridade (Alta/Crítica, Média e Baixa).'
                  : `Quantidade de pragas por dia nos últimos ${chartRange} dias, por prioridade (Alta/Crítica, Média e Baixa).`}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30 font-medium">
                <span className="h-2 w-2 rounded-full bg-red-500 mr-1.5" />
                Alta/Crítica · {prioridadeTotais.alta}
              </Badge>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-500 mr-1.5" />
                Média · {prioridadeTotais.media}
              </Badge>
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30 font-medium">
                <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5" />
                Baixa · {prioridadeTotais.baixa}
              </Badge>
              <span className="text-sm text-muted-foreground self-center ml-1">
                Total: {prioridadeTotais.total} {chartRange === 365 ? 'nos 12 meses' : `nos ${chartRange} dias`}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCharts ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ChartContainer config={prioridadeChartConfig} className="min-h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={chartDataByDay}
                    margin={{ left: 12, right: 12 }}
                    accessibilityLayer
                  >
                    <CartesianGrid vertical={false} className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={(value) => (chartRange === 365 ? value : String(value).slice(0, 5))}
                    />
                    <YAxis domain={[0, 'auto']} allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                    <RechartsTooltip
                      cursor={false}
                      content={<PrioridadeChartTooltipContent />}
                    />
                    <Line type="monotone" dataKey="ALTA" name="Alta/Crítica" stroke="var(--color-ALTA)" strokeWidth={2} dot={{ fill: 'var(--color-ALTA)' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="MEDIA" name="Média" stroke="var(--color-MEDIA)" strokeWidth={2} dot={{ fill: 'var(--color-MEDIA)' }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="BAIXA" name="Baixa" stroke="var(--color-BAIXA)" strokeWidth={2} dot={{ fill: 'var(--color-BAIXA)' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Tarefas recentes
            </CardTitle>
            <CardDescription>Atividades da fazenda</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma tarefa recente</p>
          ) : (
            <ul className="divide-y">
              {activities.slice(0, 8).map((atv) => {
                const style = getSituacaoStyle(atv.situacao)
                const talhaoNome = atv.talhao_ids?.length && talhoesList.length ? talhoesList.find(t => t.id === atv.talhao_ids?.[0])?.nome : undefined
                const tipoLabel = TIPOS_ATIVIDADE.find(t => t.value === atv.tipo)?.label ?? atv.tipo ?? '—'
                return (
                  <li key={atv.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedActivity(atv)}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/50 rounded-lg transition-colors"
                    >
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 ${style.bg}`}>
                        {style.letter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{atv.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(atv.created_at), 'dd MMM yyyy', { locale: ptBR })}
                          {talhaoNome ? ` · ${talhaoNome}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{getSituacaoLabel(atv.situacao)}</p>
                        <p className="text-xs text-muted-foreground">{tipoLabel}</p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Identificações recentes
              </CardTitle>
              <CardDescription>Últimas pragas identificadas via app mobile</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/pragas" className="gap-1">Ver tudo <ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={identifications}
            isLoading={loadingPragas}
            searchKey="praga_nome"
            searchPlaceholder="Buscar praga..."
            pageSize={8}
            emptyMessage="Nenhum registro. Envie imagens pelo app mobile para identificar pragas."
            totalCount={totalIdentificationsCount}
          />
        </CardContent>
      </Card>

      <Dialog open={!!selectedActivity} onOpenChange={(open) => !open && setSelectedActivity(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedActivity && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{selectedActivity.titulo}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className={`rounded-lg border p-4 flex items-center gap-3 ${
                  selectedActivity.situacao === 'CONCLUIDA' ? 'bg-green-500/10 border-green-500/30' :
                  selectedActivity.situacao === 'EM_ANDAMENTO' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-primary/10 border-primary/30'
                }`}>
                  {selectedActivity.situacao === 'CONCLUIDA' ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                  ) : (
                    <Clock className="h-6 w-6 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <p className={`font-semibold ${
                      selectedActivity.situacao === 'CONCLUIDA' ? 'text-green-700' :
                      selectedActivity.situacao === 'EM_ANDAMENTO' ? 'text-amber-700' : 'text-primary'
                    }`}>
                      {getSituacaoLabel(selectedActivity.situacao)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Criada em {format(new Date(selectedActivity.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5" /> Descrição
                  </p>
                  <p className="text-sm">{selectedActivity.descricao || 'Nenhuma descrição informada'}</p>
                </div>

                <div className="space-y-1 border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Tipo de atividade
                  </p>
                  <p className="text-sm font-medium">{TIPOS_ATIVIDADE.find(t => t.value === selectedActivity.tipo)?.label ?? selectedActivity.tipo ?? '—'}</p>
                </div>

                <div className="space-y-1 border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> Talhão
                  </p>
                  <p className="text-sm font-medium">
                    {selectedActivity.talhao_ids?.length && talhoesList.length
                      ? selectedActivity.talhao_ids.map(id => talhoesList.find(t => t.id === id)?.nome).filter(Boolean).join(', ') || 'Não definido'
                      : 'Não definido'}
                  </p>
                </div>

                <div className="space-y-1 border-t pt-4">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> Datas
                  </p>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Criada em</span>
                      <span className="font-mono">{format(new Date(selectedActivity.created_at), 'dd/MMM/yyyy', { locale: ptBR })}</span>
                    </div>
                    {selectedActivity.data_inicio && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Início previsto</span>
                        <span className="font-mono">{format(new Date(selectedActivity.data_inicio), 'dd/MMM/yyyy', { locale: ptBR })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Sincronizado
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button size="sm" variant="outline" onClick={handleToggleTask} disabled={taskToggling} className="flex-1">
                    {taskToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {taskToggling ? 'Atualizando...' : selectedActivity.situacao === 'CONCLUIDA' ? 'Reabrir' : 'Concluir'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={handleDeleteTask} disabled={taskDeleting}>
                    {taskDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
