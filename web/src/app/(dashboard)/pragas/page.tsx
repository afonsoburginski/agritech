'use client'

import { useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Bug,
  MapPin,
  Search,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart2,
  Navigation,
  AlertTriangle,
  CheckCircle,
  FlaskConical,
  Loader2,
} from 'lucide-react'
import { useSupabaseQuery, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

/* ─── types ─── */

interface ScoutRow {
  id: number
  nome: string | null
  status: string | null
  observacao: string | null
  talhao_id: number | null
  total_pragas: number
  created_at: string
  talhoes?: {
    id: number
    nome: string
    area: number | string | null
    cultura_atual: string | null
    percentual_infestacao: number | string | null
  } | null
  scout_pragas?: { coordinates: { type: string; coordinates: [number, number] } | null }[] | null
}

interface TalhaoMonth {
  key: string
  talhaoNome: string
  talhaoId: number | null
  talhaoArea: number | null
  talhaoCultura: string | null
  percentualInfestacao: number | null
  totalPragas: number
  scoutCount: number
  latestScout: ScoutRow
  latitude: number | null
  longitude: number | null
  trend: number | null
}

interface MonthSection {
  title: string
  monthKey: string
  items: TalhaoMonth[]
}

interface DetailPraga {
  pragaNome: string
  contagem: number
  prioridade: string | null
  pragaNomeCientifico: string | null
  tipoPraga: string | null
  observacao: string | null
  recomendacao: string | null
}

interface DetailPayload {
  title: string
  talhaoArea: number | null
  talhaoCultura: string | null
  percentualInfestacao: number | null
  latitude: number | null
  longitude: number | null
  visitado: boolean
  dataVisita: string | null
  observacoes: string | null
  pragas: DetailPraga[]
  loading: boolean
  synced: boolean
}

/* ─── helpers ─── */

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function getMonthKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split('-')
  const now = new Date()
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const name = MONTH_NAMES[parseInt(month, 10) - 1] ?? month
  return key === current ? `${name} ${year} (atual)` : `${name} ${year}`
}

function prevMonthKey(mk: string) {
  const [y, m] = mk.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function extractCoords(scout: ScoutRow): { lat: number; lng: number } | null {
  const pragas = scout.scout_pragas
  if (!pragas?.length) return null
  const c = pragas[0]?.coordinates?.coordinates
  if (!c) return null
  return { lat: c[1], lng: c[0] }
}

function severityColor(s: string | null) {
  switch (s?.toLowerCase()) {
    case 'critica': return 'text-red-600 bg-red-500/10'
    case 'alta': return 'text-orange-600 bg-orange-500/10'
    case 'media': return 'text-amber-600 bg-amber-500/10'
    case 'baixa': return 'text-emerald-600 bg-emerald-500/10'
    default: return 'text-muted-foreground bg-muted'
  }
}

function severityLabel(s: string | null) {
  switch (s?.toLowerCase()) {
    case 'critica': return 'Crítica'
    case 'alta': return 'Alta'
    case 'media': return 'Média'
    case 'baixa': return 'Baixa'
    default: return s ?? '—'
  }
}

/* ─── page ─── */

export default function MonitoramentoPage() {
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<DetailPayload | null>(null)

  const { data: scoutsRaw, isLoading } = useSupabaseQuery<ScoutRow[]>(
    queryKeys.scouts.all,
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return []
      const { data: uf } = await sb.from('user_fazendas').select('fazenda_id').eq('user_id', user.id)
      const fazendaIds = (uf ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (!fazendaIds.length) return []
      const { data } = await sb
        .from('scouts')
        .select('id, nome, status, observacao, talhao_id, total_pragas, created_at, talhoes(id, nome, area, cultura_atual, percentual_infestacao), scout_pragas(coordinates)')
        .in('fazenda_id', fazendaIds)
        .order('created_at', { ascending: false })
      return (data ?? []) as unknown as ScoutRow[]
    },
  )

  const scouts = scoutsRaw ?? []

  const sections = useMemo((): MonthSection[] => {
    const byMonth = new Map<string, ScoutRow[]>()
    for (const s of scouts) {
      const mk = getMonthKey(s.created_at)
      const arr = byMonth.get(mk) ?? []
      arr.push(s)
      byMonth.set(mk, arr)
    }

    const pestsByMonthTalhao = new Map<string, number>()
    for (const [mk, list] of byMonth.entries()) {
      const byT = new Map<string, number>()
      for (const s of list) {
        const tk = (s.talhoes as { nome?: string })?.nome ?? s.nome ?? String(s.id)
        byT.set(tk, (byT.get(tk) ?? 0) + (s.total_pragas || 0))
      }
      for (const [tk, count] of byT.entries()) {
        pestsByMonthTalhao.set(`${mk}|${tk}`, count)
      }
    }

    const sorted = Array.from(byMonth.keys()).sort((a, b) => b.localeCompare(a))

    return sorted.map((mk): MonthSection => {
      const list = byMonth.get(mk)!
      const prevMk = prevMonthKey(mk)
      const byTalhao = new Map<string, { scouts: ScoutRow[]; totalPragas: number }>()

      for (const s of list) {
        const tk = (s.talhoes as { nome?: string })?.nome ?? s.nome ?? String(s.id)
        const cur = byTalhao.get(tk) ?? { scouts: [], totalPragas: 0 }
        cur.scouts.push(s)
        cur.totalPragas += s.total_pragas || 0
        byTalhao.set(tk, cur)
      }

      const items: TalhaoMonth[] = Array.from(byTalhao.entries())
        .filter(([tk]) => !search || tk.toLowerCase().includes(search.toLowerCase()))
        .map(([tk, { scouts: tScouts, totalPragas }]) => {
          const latest = tScouts.sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
          const talhao = latest.talhoes as { id?: number; nome?: string; area?: number | string | null; cultura_atual?: string | null; percentual_infestacao?: number | string | null } | null
          const coords = extractCoords(latest)
          const prevPragas = pestsByMonthTalhao.get(`${prevMk}|${tk}`)
          return {
            key: `${mk}-${tk}`,
            talhaoNome: tk,
            talhaoId: talhao?.id ?? latest.talhao_id ?? null,
            talhaoArea: talhao?.area != null ? Number(talhao.area) : null,
            talhaoCultura: talhao?.cultura_atual ?? null,
            percentualInfestacao: talhao?.percentual_infestacao != null ? Number(talhao.percentual_infestacao) : null,
            totalPragas,
            scoutCount: tScouts.length,
            latestScout: latest,
            latitude: coords?.lat ?? null,
            longitude: coords?.lng ?? null,
            trend: prevPragas != null ? totalPragas - prevPragas : null,
          }
        })
        .sort((a, b) => b.totalPragas - a.totalPragas)

      return { title: formatMonthLabel(mk), monthKey: mk, items }
    }).filter(s => s.items.length > 0)
  }, [scouts, search])

  const currentMonthKey = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }, [])

  const currentMonthScouts = scouts.filter(s => getMonthKey(s.created_at) === currentMonthKey)
  const totalPragasMonth = currentMonthScouts.reduce((sum, s) => sum + (s.total_pragas || 0), 0)
  const visitados = currentMonthScouts.filter(s => s.status === 'CONCLUIDO').length
  const pendentes = currentMonthScouts.length - visitados

  const handleOpenDetail = useCallback(async (item: TalhaoMonth, monthKey: string) => {
    setDetail({
      title: item.talhaoNome,
      talhaoArea: item.talhaoArea,
      talhaoCultura: item.talhaoCultura,
      percentualInfestacao: item.percentualInfestacao,
      latitude: item.latitude,
      longitude: item.longitude,
      visitado: item.latestScout.status === 'CONCLUIDO',
      dataVisita: null,
      observacoes: item.latestScout.observacao,
      pragas: [],
      loading: true,
      synced: true,
    })

    if (item.talhaoId != null) {
      try {
        const [year, month] = monthKey.split('-').map(Number)
        const monthStart = new Date(year, month - 1, 1).toISOString()
        const { data } = await supabase.rpc('get_talhao_monitoramento_detail', {
          p_talhao_id: item.talhaoId,
          p_month_start: monthStart,
        })
        const row = data as {
          talhao_nome?: string
          area?: number
          cultura_atual?: string
          percentual_infestacao?: number
          latitude?: number
          longitude?: number
          observacoes?: string
          pragas?: {
            praga_nome?: string
            contagem?: number
            prioridade?: string
            praga_nome_cientifico?: string
            tipo_praga?: string
            observacao?: string
            recomendacao?: string
          }[]
        } | null

        if (row) {
          setDetail({
            title: row.talhao_nome ?? item.talhaoNome,
            talhaoArea: row.area != null ? Number(row.area) : item.talhaoArea,
            talhaoCultura: row.cultura_atual ?? item.talhaoCultura,
            percentualInfestacao: row.percentual_infestacao != null ? Number(row.percentual_infestacao) : item.percentualInfestacao,
            latitude: row.latitude != null ? Number(row.latitude) : item.latitude,
            longitude: row.longitude != null ? Number(row.longitude) : item.longitude,
            visitado: item.latestScout.status === 'CONCLUIDO',
            dataVisita: null,
            observacoes: row.observacoes ?? item.latestScout.observacao,
            pragas: (row.pragas ?? []).map(p => ({
              pragaNome: p.praga_nome ?? 'Desconhecida',
              contagem: p.contagem ?? 0,
              prioridade: p.prioridade ?? null,
              pragaNomeCientifico: p.praga_nome_cientifico ?? null,
              tipoPraga: p.tipo_praga ?? null,
              observacao: p.observacao ?? null,
              recomendacao: p.recomendacao ?? null,
            })),
            loading: false,
            synced: true,
          })
          return
        }
      } catch { /* fall through */ }
    }

    setDetail(prev => prev ? { ...prev, loading: false } : null)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoramento</h1>
        <p className="text-muted-foreground">Pontos de coleta por talhão, pragas identificadas e acompanhamento de visitas.</p>
      </div>

      {/* Resumo do mês */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <BarChart2 className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold">Resumo do mês</p>
            <p className="text-sm text-muted-foreground">
              {totalPragasMonth} {totalPragasMonth === 1 ? 'praga' : 'pragas'} em {currentMonthScouts.length} {currentMonthScouts.length === 1 ? 'ponto' : 'pontos'} de coleta
              {currentMonthScouts.length > 0 && ` · ${visitados} visitados, ${pendentes} pendentes`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por talhão..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Seções por mês */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : sections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Bug className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="font-medium text-muted-foreground">Nenhum monitoramento</p>
            <p className="text-sm text-muted-foreground">{search ? 'Tente buscar por outro termo' : 'Sem dados de scouts nas suas fazendas'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.monthKey}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold flex-1">{section.title}</h2>
                <span className="text-xs text-muted-foreground">
                  {section.items.length} talhão{section.items.length !== 1 ? 'ões' : ''}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <button
                    key={item.key}
                    className="text-left rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleOpenDetail(item, section.monthKey)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.totalPragas > 0 ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                        <MapPin className={`h-5 w-5 ${item.totalPragas > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold truncate">{item.talhaoNome}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          {item.talhaoArea != null && <span>{Number(item.talhaoArea).toLocaleString('pt-BR')} ha</span>}
                          {item.talhaoCultura && <span>{item.talhaoCultura}</span>}
                          <span>{item.scoutCount} scout{item.scoutCount > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {item.totalPragas > 0 && (
                            <Badge variant="secondary" className="text-amber-700 bg-amber-500/10 text-xs">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              {item.totalPragas} praga{item.totalPragas > 1 ? 's' : ''}
                            </Badge>
                          )}
                          {item.percentualInfestacao != null && item.percentualInfestacao > 0 && (
                            <span className="text-xs font-semibold text-amber-600">
                              Infestação: {Number(item.percentualInfestacao).toFixed(1)}%
                            </span>
                          )}
                          <TrendBadge trend={item.trend} />
                        </div>
                      </div>
                      <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${item.latestScout.status === 'CONCLUIDO' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de detalhes — mesmo layout do bottom sheet mobile */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="sm:max-w-xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {detail?.title ?? ''}
            </DialogTitle>
          </DialogHeader>
          {detail && <DetailContent detail={detail} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ─── components ─── */

function TrendBadge({ trend }: { trend: number | null }) {
  if (trend == null) return null
  if (trend === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
        <Minus className="h-3 w-3" /> Estável
      </span>
    )
  const improved = trend < 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${improved ? 'text-emerald-700 bg-emerald-500/10' : 'text-red-700 bg-red-500/10'}`}>
      {improved ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
      {improved ? `${Math.abs(trend)} menos` : `+${trend} pragas`}
    </span>
  )
}

function DetailContent({ detail }: { detail: DetailPayload }) {
  const showLocation = detail.latitude != null && detail.longitude != null && (detail.latitude !== 0 || detail.longitude !== 0)
  const isScout = detail.visitado !== undefined

  return (
    <div className="space-y-4">
      {/* Card topo: Resumo do ponto ou do talhão + data */}
      <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4">
        <MapPin className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1">
          <p className="text-base font-bold text-muted-foreground">
            {isScout ? 'Resumo do ponto' : 'Resumo do talhão'}
          </p>
          {isScout && detail.dataVisita && (
            <p className="text-[13px] text-muted-foreground mt-0.5">
              {new Date(detail.dataVisita).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      {/* Talhão */}
      <section className="border-t pt-4">
        <SectionHeader icon={MapPin} title="Talhão" />
        <div className="space-y-2 text-sm">
          <DetailRow label="Área" value={detail.talhaoArea != null ? `${Number(detail.talhaoArea).toLocaleString('pt-BR')} ha` : '—'} mono />
          <DetailRow label="Cultura atual" value={detail.talhaoCultura || '—'} mono />
          {detail.percentualInfestacao != null && (
            <DetailRow
              label="Infestação (mês atual)"
              value={`${Number(detail.percentualInfestacao).toFixed(1)}%`}
              mono
              valueClass={detail.percentualInfestacao > 0 ? 'text-amber-600 font-semibold' : ''}
            />
          )}
        </div>
      </section>

      {/* Localização */}
      <section className="border-t pt-4">
        <SectionHeader icon={Navigation} title="Localização" />
        {showLocation ? (
          <div className="space-y-2 text-sm">
            <DetailRow label="Latitude" value={Number(detail.latitude).toFixed(6)} mono />
            <DetailRow label="Longitude" value={Number(detail.longitude).toFixed(6)} mono />
          </div>
        ) : (
          <p className="text-sm font-semibold font-mono text-muted-foreground">Coordenadas não disponíveis</p>
        )}
      </section>

      {/* Pragas Identificadas */}
      <section className="border-t pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Bug className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Pragas Identificadas</p>
          {detail.pragas.length > 0 && (
            <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary">
              {detail.pragas.length}
            </span>
          )}
        </div>

        {detail.loading ? (
          <div className="flex items-center justify-center py-5 text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">Carregando pragas...</span>
          </div>
        ) : detail.pragas.length > 0 ? (
          <div className="space-y-2.5">
            {detail.pragas.map((pest, i) => (
              <div key={`${pest.pragaNome}-${i}`} className="rounded-[10px] border bg-card p-3 space-y-2">
                {/* Header: nome + severidade */}
                <div className="mb-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[15px] font-semibold truncate flex-1">{pest.pragaNome || 'Desconhecida'}</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${severityColor(pest.prioridade)}`}>
                      {severityLabel(pest.prioridade)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground italic mt-0.5">
                    {pest.pragaNomeCientifico?.trim() || '—'}
                  </p>
                </div>
                {/* Detalhes: quantidade + tipo lado a lado */}
                <div className="flex gap-4">
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Quantidade</p>
                    <p className="text-[13px] font-semibold">
                      {pest.contagem ?? 0} {(pest.contagem ?? 0) === 1 ? 'indivíduo' : 'indivíduos'}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-muted-foreground">Tipo</p>
                    <p className="text-[13px] font-semibold">{pest.tipoPraga?.trim() || '—'}</p>
                  </div>
                </div>
                {/* Observação */}
                <p className="text-xs italic text-muted-foreground mt-2">
                  {pest.observacao?.trim() || '—'}
                </p>
                {/* Recomendação (Embrapa) */}
                {pest.recomendacao?.trim() && (
                  <div className="border-t pt-2 mt-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <FlaskConical className="h-[13px] w-[13px] text-emerald-600" />
                      <p className="text-xs font-semibold">Recomendação</p>
                    </div>
                    <p className="text-[13px] leading-5">{pest.recomendacao}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-[10px] bg-emerald-500/10 p-3.5">
            <CheckCircle className="h-[18px] w-[18px] text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-600">Nenhuma praga identificada</p>
          </div>
        )}
      </section>

      {/* Observações */}
      <section className="border-t pt-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Observações</p>
        </div>
        <p className={`text-sm leading-5 ${detail.observacoes?.trim() ? '' : 'text-muted-foreground'}`}>
          {detail.observacoes?.trim() || '—'}
        </p>
      </section>

      {/* Sync status */}
      <div className="mt-1">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${
          detail.synced
            ? 'bg-emerald-500/15 text-emerald-600'
            : 'bg-amber-500/15 text-amber-600'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${detail.synced ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {detail.synced ? 'Sincronizado' : 'Aguardando sincronização'}
        </span>
      </div>
    </div>
  )
}

function SectionHeader({ icon: IconComp, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <IconComp className="h-4 w-4 text-primary" />
      <p className="text-sm font-semibold">{title}</p>
    </div>
  )
}

function DetailRow({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${mono ? 'font-mono' : ''} ${valueClass ?? ''}`}>{value}</span>
    </div>
  )
}
