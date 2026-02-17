'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  Bug, Camera, Smartphone, AlertTriangle, TrendingUp, ChevronRight,
} from 'lucide-react'
import { useSupabaseQuery } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Identification {
  id: number
  praga_nome: string
  praga_nome_cientifico: string | null
  tipo_praga: string | null
  prioridade: string | null
  fonte: string | null
  openai_confidence: number | null
  data_contagem: string | null
  imagem_url: string | null
  embrapa_praga_id: string | null
}

interface ChartRow {
  data_contagem: string | null
  prioridade: string | null
  fonte: string | null
}

const priorityVariant = (p: string | null) => {
  if (p === 'ALTA') return 'destructive' as const
  if (p === 'MEDIA') return 'secondary' as const
  return 'outline' as const
}

const columns: ColumnDef<Identification>[] = [
  {
    accessorKey: 'praga_nome',
    header: ({ column }) => <SortableHeader column={column}>Praga</SortableHeader>,
    cell: ({ row }) => (
      <div>
        <div className="font-medium">{row.original.praga_nome}</div>
        {row.original.praga_nome_cientifico && (
          <div className="text-xs text-muted-foreground italic">{row.original.praga_nome_cientifico}</div>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'openai_confidence',
    header: ({ column }) => <SortableHeader column={column}>Confiança</SortableHeader>,
    cell: ({ row }) => {
      const c = row.original.openai_confidence
      if (!c) return <span className="text-muted-foreground">--</span>
      const pct = (c * 100).toFixed(0)
      return (
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full ${Number(pct) > 80 ? 'bg-green-500' : Number(pct) > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-sm tabular-nums">{pct}%</span>
        </div>
      )
    },
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
    accessorKey: 'fonte',
    header: 'Fonte',
    cell: ({ row }) => {
      const f = row.original.fonte
      const icon = f === 'CAMERA' ? <Camera className="mr-1 h-3 w-3" /> : f === 'MOBILE' ? <Smartphone className="mr-1 h-3 w-3" /> : null
      return <Badge variant="outline" className="gap-0.5">{icon}{f ?? 'N/A'}</Badge>
    },
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
  const { data: identificationsResult, isLoading: loadingPragas } = useSupabaseQuery<{ rows: Identification[]; count: number }>(
    queryKeys.stats.dashboard(),
    async (sb) => {
      const { data, count } = await sb
        .from('scout_marker_pragas')
        .select('*', { count: 'exact' })
        .order('data_contagem', { ascending: false })
      return { rows: (data ?? []) as Identification[], count: count ?? 0 }
    },
  )
  const identifications = identificationsResult?.rows ?? []
  const totalIdentificationsCount = identificationsResult?.count ?? 0

  const { data: chartRaw = [], isLoading: loadingCharts } = useSupabaseQuery<ChartRow[]>(
    queryKeys.stats.charts(),
    async (sb) => {
      const since = subDays(new Date(), 30).toISOString()
      const { data } = await sb
        .from('scout_marker_pragas')
        .select('data_contagem, prioridade, fonte')
        .gte('data_contagem', since)
        .order('data_contagem', { ascending: true })
      return (data ?? []) as ChartRow[]
    },
  )

  const chartDataByDay = useMemo(() => {
    const byDate: Record<string, { date: string; total: number; ALTA: number; MEDIA: number; BAIXA: number; MOBILE: number; CAMERA: number }> = {}
    const start = subDays(new Date(), 30)
    for (let d = 0; d <= 30; d++) {
      const day = format(subDays(new Date(), 30 - d), 'yyyy-MM-dd')
      byDate[day] = { date: format(subDays(new Date(), 30 - d), 'dd/MM', { locale: ptBR }), total: 0, ALTA: 0, MEDIA: 0, BAIXA: 0, MOBILE: 0, CAMERA: 0 }
    }
    chartRaw.forEach((row) => {
      const dateVal = row.data_contagem
      if (!dateVal) return
      const day = format(new Date(dateVal), 'yyyy-MM-dd')
      if (!byDate[day]) return
      byDate[day].total += 1
      const p = row.prioridade ?? 'BAIXA'
      if (p === 'ALTA') byDate[day].ALTA += 1
      else if (p === 'MEDIA') byDate[day].MEDIA += 1
      else byDate[day].BAIXA += 1
      const f = row.fonte ?? 'MOBILE'
      if (f === 'MOBILE') byDate[day].MOBILE += 1
      else if (f === 'CAMERA') byDate[day].CAMERA += 1
    })
    return Object.keys(byDate)
      .sort()
      .map((k) => byDate[k])
  }, [chartRaw])

  const stats = {
    total: totalIdentificationsCount,
    alta: identifications.filter(d => d.prioridade === 'ALTA').length,
    camera: identifications.filter(d => d.fonte === 'CAMERA').length,
    mobile: identifications.filter(d => d.fonte === 'MOBILE').length,
  }

  const pestStatCards = [
    { label: 'Total Identificações', value: stats.total, icon: Bug, color: '' },
    { label: 'Prioridade Alta', value: stats.alta, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Via Câmeras', value: stats.camera, icon: Camera, color: 'text-blue-600' },
    { label: 'Via Mobile', value: stats.mobile, icon: Smartphone, color: 'text-green-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Monitoramento de pragas e identificações recentes</p>
      </div>

      {/* 4 cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {pestStatCards.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color || 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              {loadingPragas ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dois line charts — legendas por cor no header, alinhados */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
            <div className="space-y-1.5">
              <CardTitle>Identificações por dia</CardTitle>
              <CardDescription>Últimos 30 dias — total por dia</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--primary))]" aria-hidden />
                Total
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCharts ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartDataByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    labelFormatter={(_, payload) => payload[0]?.payload?.date && `Data: ${payload[0].payload.date}`}
                  />
                  <Line type="monotone" dataKey="total" name="Total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
            <div className="space-y-1.5">
              <CardTitle>Identificações por prioridade</CardTitle>
              <CardDescription>Últimos 30 dias — ALTA, MÉDIA e BAIXA</CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden />
                Alta
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
                Média
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden />
                Baixa
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {loadingCharts ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartDataByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="ALTA" name="Alta" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="MEDIA" name="Média" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="BAIXA" name="Baixa" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Identificações recentes
              </CardTitle>
              <CardDescription>Últimas pragas identificadas (app mobile ou API câmeras)</CardDescription>
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
            emptyMessage="Nenhum registro. Envie imagens pelo app mobile ou POST /api/identify-pest."
            totalCount={totalIdentificationsCount}
          />
        </CardContent>
      </Card>
    </div>
  )
}
