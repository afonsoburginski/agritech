'use client'

import { useState, useMemo } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Bug, ImageIcon, Camera, Smartphone, Globe } from 'lucide-react'
import { useSupabaseQuery } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'

const PestMapMapcn = dynamic(() => import('@/components/pest-map-mapcn').then((m) => m.PestMapMapcn), { ssr: false })

interface PragaRecord {
  id: number
  marker_id: number
  praga_nome: string
  praga_nome_cientifico: string | null
  tipo_praga: string | null
  contagem: number | null
  prioridade: string | null
  fonte: string | null
  openai_confidence: number | null
  data_contagem: string | null
  imagem_url: string | null
  embrapa_praga_id: string | null
  embrapa_produtos_recomendados: any[] | null
  observacao: string | null
  scout_markers?: {
    latitude: string
    longitude: string
    numero: number
    scout_id: number
  }
}

const priorityVariant = (p: string | null) => {
  if (p === 'ALTA') return 'destructive' as const
  if (p === 'MEDIA') return 'secondary' as const
  return 'outline' as const
}

const fonteIcon = (f: string | null) => {
  if (f === 'CAMERA') return <Camera className="mr-1 h-3 w-3" />
  if (f === 'MOBILE') return <Smartphone className="mr-1 h-3 w-3" />
  if (f === 'WEB') return <Globe className="mr-1 h-3 w-3" />
  return null
}

export default function PragasPage() {
  const [selectedPraga, setSelectedPraga] = useState<PragaRecord | null>(null)
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterSource, setFilterSource] = useState('all')

  const { data: pragasResult, isLoading } = useSupabaseQuery<{ rows: PragaRecord[]; count: number }>(
    queryKeys.pragas.list({ priority: filterPriority, source: filterSource }),
    async (sb) => {
      let query = sb
        .from('scout_marker_pragas')
        .select('*, scout_markers(latitude, longitude, numero, scout_id)', { count: 'exact' })
        .order('data_contagem', { ascending: false })

      if (filterPriority !== 'all') query = query.eq('prioridade', filterPriority)
      if (filterSource !== 'all') query = query.eq('fonte', filterSource)

      const { data, count } = await query
      return { rows: (data ?? []) as PragaRecord[], count: count ?? 0 }
    },
  )
  const pragas = pragasResult?.rows ?? []
  const totalPragasCount = pragasResult?.count ?? 0

  const mapMarkers = useMemo(
    () =>
      pragas
        .filter((p) => p.scout_markers?.latitude && p.scout_markers?.longitude)
        .map((p) => ({
          id: p.id,
          lat: parseFloat(p.scout_markers!.latitude),
          lng: parseFloat(p.scout_markers!.longitude),
          nome: p.praga_nome,
          prioridade: p.prioridade ?? 'BAIXA',
          contagem: p.contagem ?? 1,
        })),
    [pragas],
  )

  const columns: ColumnDef<PragaRecord>[] = useMemo(
    () => [
      {
        accessorKey: 'praga_nome',
        header: ({ column }) => <SortableHeader column={column}>Praga</SortableHeader>,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            {row.original.imagem_url ? (
              <img src={row.original.imagem_url} alt="" className="h-10 w-10 rounded-md object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div>
              <div className="font-medium">{row.original.praga_nome}</div>
              {row.original.praga_nome_cientifico && (
                <div className="text-xs text-muted-foreground italic">{row.original.praga_nome_cientifico}</div>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'tipo_praga',
        header: 'Tipo',
        cell: ({ row }) => <Badge variant="outline">{row.original.tipo_praga ?? 'N/A'}</Badge>,
      },
      {
        accessorKey: 'contagem',
        header: ({ column }) => <SortableHeader column={column}>Qtd</SortableHeader>,
        cell: ({ row }) => <span className="tabular-nums">{row.original.contagem ?? '--'}</span>,
      },
      {
        accessorKey: 'openai_confidence',
        header: ({ column }) => <SortableHeader column={column}>IA</SortableHeader>,
        cell: ({ row }) => {
          const c = row.original.openai_confidence
          if (!c) return <span className="text-muted-foreground">--</span>
          const pct = (c * 100).toFixed(0)
          return (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${Number(pct) > 80 ? 'bg-green-500' : Number(pct) > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs tabular-nums">{pct}%</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'prioridade',
        header: ({ column }) => <SortableHeader column={column}>Prioridade</SortableHeader>,
        cell: ({ row }) => (
          <Badge variant={priorityVariant(row.original.prioridade)}>{row.original.prioridade ?? 'N/A'}</Badge>
        ),
      },
      {
        accessorKey: 'fonte',
        header: 'Fonte',
        cell: ({ row }) => (
          <Badge variant="outline" className="gap-0.5">
            {fonteIcon(row.original.fonte)}
            {row.original.fonte ?? 'N/A'}
          </Badge>
        ),
      },
      {
        accessorKey: 'embrapa_praga_id',
        header: 'Embrapa',
        cell: ({ row }) =>
          row.original.embrapa_praga_id ? (
            <Badge className="bg-green-600 hover:bg-green-700">AGROFIT</Badge>
          ) : (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        accessorKey: 'data_contagem',
        header: ({ column }) => <SortableHeader column={column}>Data</SortableHeader>,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {row.original.data_contagem
              ? new Date(row.original.data_contagem).toLocaleDateString('pt-BR')
              : '--'}
          </span>
        ),
      },
    ],
    [],
  )

  const filterToolbar = (
    <div className="flex items-center gap-2">
      <Select value={filterPriority} onValueChange={setFilterPriority}>
        <SelectTrigger className="h-8 w-[130px]">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="ALTA">Alta</SelectItem>
          <SelectItem value="MEDIA">Média</SelectItem>
          <SelectItem value="BAIXA">Baixa</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterSource} onValueChange={setFilterSource}>
        <SelectTrigger className="h-8 w-[130px]">
          <SelectValue placeholder="Fonte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          <SelectItem value="MOBILE">Mobile</SelectItem>
          <SelectItem value="CAMERA">Câmera</SelectItem>
          <SelectItem value="WEB">Web</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Monitoramento</h1>
        <p className="text-muted-foreground">Consulta de pragas, ervas daninhas e doenças identificadas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            Registros de Pragas
          </CardTitle>
          <CardDescription>Clique em uma linha para ver detalhes. O mapa abaixo mostra os pontos com coordenadas.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={pragas}
            isLoading={isLoading}
            searchKey="praga_nome"
            searchPlaceholder="Buscar por nome da praga..."
            toolbar={filterToolbar}
            onRowClick={setSelectedPraga}
            emptyMessage="Nenhuma praga encontrada. Ajuste os filtros ou envie imagens para identificação."
            totalCount={totalPragasCount}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapa (dark)</CardTitle>
          <CardDescription>
            Visualização geográfica — {mapMarkers.length} ponto(s) com coordenadas. Estilo mapcn dark.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[500px] w-full rounded-b-lg overflow-hidden">
            <PestMapMapcn markers={mapMarkers} className="h-full w-full" />
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedPraga} onOpenChange={() => setSelectedPraga(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              {selectedPraga?.praga_nome}
            </DialogTitle>
          </DialogHeader>
          {selectedPraga && (
            <div className="space-y-4">
              {selectedPraga.imagem_url && (
                <img
                  src={selectedPraga.imagem_url}
                  alt={selectedPraga.praga_nome}
                  className="w-full h-48 object-cover rounded-lg"
                />
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome Científico</p>
                  <p className="font-medium italic">{selectedPraga.praga_nome_cientifico ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium">{selectedPraga.tipo_praga ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Contagem</p>
                  <p className="font-medium">{selectedPraga.contagem ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Confiança IA</p>
                  <p className="font-medium">
                    {selectedPraga.openai_confidence
                      ? `${(selectedPraga.openai_confidence * 100).toFixed(1)}%`
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prioridade</p>
                  <Badge variant={priorityVariant(selectedPraga.prioridade)}>{selectedPraga.prioridade ?? 'N/A'}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Fonte</p>
                  <Badge variant="outline">{selectedPraga.fonte ?? 'N/A'}</Badge>
                </div>
              </div>
              {selectedPraga.observacao && (
                <div>
                  <p className="text-sm text-muted-foreground">Observação</p>
                  <p className="text-sm">{selectedPraga.observacao}</p>
                </div>
              )}
              {selectedPraga.embrapa_produtos_recomendados &&
                selectedPraga.embrapa_produtos_recomendados.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Produtos Recomendados (Embrapa)</p>
                    <div className="space-y-1">
                      {selectedPraga.embrapa_produtos_recomendados.map((prod: any, i: number) => (
                        <div key={i} className="text-sm p-2 bg-muted rounded-md">
                          {prod.nome ?? prod.produto ?? JSON.stringify(prod)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
