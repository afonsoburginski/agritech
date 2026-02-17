'use client'

import { useState, useRef, useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Sparkles, Loader2, ImageIcon, Trash2, Eye, Upload, X, Save, RotateCcw, Copy, Check,
} from 'lucide-react'
import { useSupabaseQuery, useOptimisticMutation } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

interface PestVector {
  id: number
  nome_praga: string
  nome_cientifico: string | null
  tipo: string
  descricao_visual: string | null
  caracteristicas_chave: any
  imagem_referencia_url: string | null
  fonte: string
  confianca: number | null
  created_at: string
  /** Vetor de embedding (pgvector no Supabase pode vir como string "[0.1, -0.2, ...]" ou array) */
  embedding?: string | number[] | null
  /** URL do ícone SVG no Storage (para exibir no app mobile na resposta da análise) */
  icone_url?: string | null
}

interface PreviewData {
  imageFile: File
  imagePreview: string
  nome_praga: string
  nome_cientifico: string
  tipo: string
  descricao_visual: string
  caracteristicas_chave: string[]
  confianca: number
}

const fonteColor = (f: string) => {
  if (f === 'CHATGPT') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200'
  if (f === 'EMBRAPA') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200'
  return 'bg-muted text-muted-foreground border-border'
}

function parseEmbedding(embedding: string | number[] | null | undefined): number[] | null {
  if (embedding == null) return null
  if (Array.isArray(embedding)) return embedding
  if (typeof embedding === 'string') {
    try {
      const parsed = JSON.parse(embedding) as number[]
      return Array.isArray(parsed) ? parsed : null
    } catch {
      const match = embedding.match(/\[[\d.,\s-]+\]/)
      if (match) {
        try {
          return JSON.parse(match[0]) as number[]
        } catch {
          return null
        }
      }
      return null
    }
  }
  return null
}

export default function VetorizacaoPage() {
  const [detailVector, setDetailVector] = useState<PestVector | null>(null)
  const [embeddingCopied, setEmbeddingCopied] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const { data: vectorsResult, isLoading } = useSupabaseQuery<{ rows: PestVector[]; count: number }>(
    queryKeys.vectors.list(),
    async (sb) => {
      const { data, count } = await sb
        .from('pest_reference_vectors')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
      return { rows: (data ?? []) as PestVector[], count: count ?? 0 }
    },
  )
  const vectors = vectorsResult?.rows ?? []
  const totalCount = vectorsResult?.count ?? 0

  const deleteMutation = useOptimisticMutation<void, number>({
    mutationFn: async (sb, id) => {
      await sb.from('pest_reference_vectors').delete().eq('id', id)
    },
    optimisticKey: queryKeys.vectors.list(),
    optimisticUpdate: (old: PestVector[] | undefined, id: number) =>
      (old ?? []).filter(v => v.id !== id),
    invalidateKeys: [queryKeys.vectors.all],
  })

  const analyzeImage = useCallback(async (file: File) => {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const imagePreview = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })

      const formData = new FormData()
      formData.append('image', file)
      const res = await fetch('/api/vectorize-pest?preview=true', { method: 'POST', body: formData })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Falha na análise')
      }

      const json = await res.json()
      const a = json.analysis
      setPreview({
        imageFile: file,
        imagePreview,
        nome_praga: a.nome_praga ?? '',
        nome_cientifico: a.nome_cientifico ?? '',
        tipo: a.tipo ?? 'INSETO',
        descricao_visual: a.descricao_visual ?? '',
        caracteristicas_chave: Array.isArray(a.caracteristicas_chave) ? a.caracteristicas_chave : [],
        confianca: a.confianca ?? 0.5,
      })
    } catch (e: any) {
      setAnalyzeError(e.message)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) analyzeImage(file)
  }, [analyzeImage])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) analyzeImage(file)
    e.target.value = ''
  }, [analyzeImage])

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    setAnalyzeError(null)
    try {
      const formData = new FormData()
      formData.append('image', preview.imageFile)
      formData.append('nome_praga', preview.nome_praga)
      formData.append('nome_cientifico', preview.nome_cientifico)
      formData.append('tipo', preview.tipo)
      formData.append('descricao_visual', preview.descricao_visual)
      formData.append('caracteristicas_chave', JSON.stringify(preview.caracteristicas_chave.filter(Boolean)))

      const res = await fetch('/api/vectorize-pest', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Falha ao salvar')
      }
      setPreview(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.vectors.all })
    } catch (e: any) {
      setAnalyzeError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDescartar = () => {
    setPreview(null)
    setAnalyzeError(null)
  }

  const addCaracteristica = () => {
    if (!preview) return
    setPreview({ ...preview, caracteristicas_chave: [...preview.caracteristicas_chave, ''] })
  }

  const updateCaracteristica = (index: number, value: string) => {
    if (!preview) return
    const next = [...preview.caracteristicas_chave]
    next[index] = value
    setPreview({ ...preview, caracteristicas_chave: next })
  }

  const removeCaracteristica = (index: number) => {
    if (!preview) return
    setPreview({ ...preview, caracteristicas_chave: preview.caracteristicas_chave.filter((_, i) => i !== index) })
  }

  const columns: ColumnDef<PestVector>[] = useMemo(() => [
    {
      accessorKey: 'nome_praga',
      header: ({ column }) => <SortableHeader column={column}>Praga</SortableHeader>,
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {(row.original.icone_url ?? row.original.imagem_referencia_url) ? (
            <img src={row.original.icone_url ?? row.original.imagem_referencia_url!} alt="" className="h-10 w-10 rounded-md object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="font-medium">{row.original.nome_praga}</div>
            {row.original.nome_cientifico && (
              <div className="text-xs text-muted-foreground italic">{row.original.nome_cientifico}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'tipo',
      header: 'Tipo',
      cell: ({ row }) => <Badge variant="outline">{row.original.tipo}</Badge>,
    },
    {
      accessorKey: 'descricao_visual',
      header: 'Descrição',
      cell: ({ row }) => (
        <span className="max-w-[200px] truncate block text-sm text-muted-foreground">
          {row.original.descricao_visual ?? '--'}
        </span>
      ),
    },
    {
      accessorKey: 'fonte',
      header: 'Fonte',
      cell: ({ row }) => (
        <Badge className={fonteColor(row.original.fonte)} variant="outline">{row.original.fonte}</Badge>
      ),
    },
    {
      accessorKey: 'confianca',
      header: ({ column }) => <SortableHeader column={column}>Confiança</SortableHeader>,
      cell: ({ row }) => {
        const c = row.original.confianca
        if (!c) return <span className="text-muted-foreground">--</span>
        return <span className="tabular-nums">{(c * 100).toFixed(0)}%</span>
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <SortableHeader column={column}>Data</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {new Date(row.original.created_at).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDetailVector(row.original) }}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('Excluir esta referência?')) deleteMutation.mutate(row.original.id)
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      enableHiding: false,
    },
  ], [deleteMutation])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">AI Training</h1>
        <p className="text-muted-foreground">
          Adicione imagens de pragas para treinar a IA. A IA analisa, gera descrições e vetores; revise, edite e salve.
        </p>
      </div>

      {!preview && (
        <Card
          className={`border-2 border-dashed transition-colors ${
            dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
          } ${analyzing ? 'pointer-events-none opacity-70' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-16">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            {analyzing ? (
              <>
                <Loader2 className="h-14 w-14 text-primary animate-spin mb-4" />
                <p className="text-lg font-medium">ChatGPT analisando a imagem...</p>
                <p className="text-sm text-muted-foreground mt-1">Identificando praga e gerando descrição visual</p>
              </>
            ) : (
              <>
                <div className="rounded-full bg-primary/10 p-4 mb-4">
                  <Upload className="h-10 w-10 text-primary" />
                </div>
                <p className="text-lg font-medium">
                  Arraste uma imagem aqui ou{' '}
                  <button type="button" className="text-primary underline underline-offset-2 hover:no-underline" onClick={() => inputRef.current?.click()}>
                    clique para selecionar
                  </button>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Insetos, ervas daninhas ou doenças. A IA preenche os dados para você revisar.
                </p>
              </>
            )}
            {analyzeError && !preview && (
              <p className="mt-4 text-sm text-destructive">{analyzeError}</p>
            )}
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Pré-visualização — edite e salve
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDescartar} className="gap-1">
                <RotateCcw className="h-4 w-4" /> Descartar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !preview.nome_praga.trim()} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {analyzeError && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{analyzeError}</div>
            )}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Imagem</Label>
                <div className="relative aspect-video max-w-sm rounded-lg border bg-muted overflow-hidden">
                  <img src={preview.imagePreview} alt="Preview" className="w-full h-full object-contain" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Confiança da IA: <span className="font-medium">{(preview.confianca * 100).toFixed(0)}%</span>
                </p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Praga *</Label>
                    <Input value={preview.nome_praga} onChange={(e) => setPreview({ ...preview, nome_praga: e.target.value })} placeholder="Ex: Percevejo-marrom" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Científico</Label>
                    <Input value={preview.nome_cientifico} onChange={(e) => setPreview({ ...preview, nome_cientifico: e.target.value })} placeholder="Ex: Euschistus heros" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={preview.tipo} onValueChange={(t) => setPreview({ ...preview, tipo: t })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSETO">Inseto</SelectItem>
                      <SelectItem value="ERVA_DANINHA">Erva Daninha</SelectItem>
                      <SelectItem value="DOENCA">Doença</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição Visual</Label>
              <Textarea
                value={preview.descricao_visual}
                onChange={(e) => setPreview({ ...preview, descricao_visual: e.target.value })}
                placeholder="Descrição detalhada da praga..."
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Características-chave</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addCaracteristica}>+ Adicionar</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {preview.caracteristicas_chave.map((c, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input value={c} onChange={(e) => updateCaracteristica(i, e.target.value)} className="h-8 w-40" placeholder="Característica" />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeCaracteristica(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {preview.caracteristicas_chave.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhuma. Clique em &quot;Adicionar&quot;.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={vectors}
        isLoading={isLoading}
        searchKey="nome_praga"
        searchPlaceholder="Buscar referência..."
        emptyMessage="Nenhuma referência salva. Arraste uma imagem acima para começar."
        totalCount={totalCount}
        pageSizeOptions={[10, 20, 50, 100, 200]}
      />

      <Dialog open={!!detailVector} onOpenChange={(open) => { if (!open) { setDetailVector(null); setEmbeddingCopied(false) } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              {detailVector?.nome_praga}
            </DialogTitle>
          </DialogHeader>
          {detailVector && (
            <div className="space-y-4">
              {detailVector.imagem_referencia_url && (
                <img src={detailVector.imagem_referencia_url} alt="" className="w-full h-48 object-cover rounded-lg" />
              )}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Nome Científico</p>
                  <p className="font-medium italic">{detailVector.nome_cientifico ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p className="font-medium">{detailVector.tipo}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fonte</p>
                  <Badge className={fonteColor(detailVector.fonte)} variant="outline">{detailVector.fonte}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Confiança</p>
                  <p className="font-medium">{detailVector.confianca ? `${(detailVector.confianca * 100).toFixed(1)}%` : 'N/A'}</p>
                </div>
              </div>
              {detailVector.descricao_visual && (
                <div>
                  <p className="text-sm font-medium mb-1">Descrição Visual</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{detailVector.descricao_visual}</p>
                </div>
              )}
              {detailVector.caracteristicas_chave && Array.isArray(detailVector.caracteristicas_chave) && detailVector.caracteristicas_chave.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1">Características-Chave</p>
                  <div className="flex flex-wrap gap-1">
                    {detailVector.caracteristicas_chave.map((c: string, i: number) => (
                      <Badge key={i} variant="secondary">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {(() => {
                const vec = parseEmbedding(detailVector.embedding)
                if (!vec || vec.length === 0) {
                  return (
                    <div>
                      <p className="text-sm font-medium mb-1">Vetor (embedding)</p>
                      <p className="text-sm text-muted-foreground">Sem vetor — este registro não possui embedding (ex.: importado com --skip-ai).</p>
                    </div>
                  )
                }
                const preview = vec.slice(0, 12).map((n) => n.toFixed(6)).join(', ')
                const copyVec = () => {
                  navigator.clipboard.writeText(JSON.stringify(vec))
                  setEmbeddingCopied(true)
                  setTimeout(() => setEmbeddingCopied(false), 2000)
                }
                return (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-medium">Vetor (embedding)</p>
                      <Button variant="outline" size="sm" className="h-7 gap-1" onClick={copyVec}>
                        {embeddingCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {embeddingCopied ? 'Copiado' : 'Copiar vetor'}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{vec.length} dimensões (text-embedding-3-small)</p>
                    <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto max-h-24 overflow-y-auto border">
                      [{preview}{vec.length > 12 ? ', …' : ''}]
                    </pre>
                  </div>
                )
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
