'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { FileText, BookOpen, Activity, Eye, Loader2, Printer, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useSupabaseQuery } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

interface Fazenda {
  id: number
  nome: string
}

const REPORT_TYPES = [
  {
    value: 'technical' as const,
    label: 'Relatório Técnico',
    description: 'Documento formal para acompanhamento manual de monitoramento. Inclui resumo executivo, pragas/doenças, comparativo e bloco de assinaturas (CREA).',
    icon: BookOpen,
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  },
  {
    value: 'pest-disease' as const,
    label: 'Pragas e Doenças',
    description: 'Visão operacional com foco em monitoramento automatizado (câmeras, sensores, IA). Mesma estrutura, linguagem semanal e mapa de calor.',
    icon: Activity,
    color: 'text-purple-700 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
  },
]

export default function RelatoriosPage() {
  const [selectedFazenda, setSelectedFazenda] = useState<string>('')
  const [responsavel, setResponsavel] = useState('')
  const [reportType, setReportType] = useState<'technical' | 'pest-disease'>('technical')
  const [loading, setLoading] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const { data: fazendas = [], isLoading: loadingFazendas } = useSupabaseQuery<Fazenda[]>(
    queryKeys.fazendas.list(),
    async (sb) => {
      const { data } = await sb.from('fazendas').select('id, nome')
      const items = (data ?? []) as Fazenda[]
      if (items.length > 0 && !selectedFazenda) setSelectedFazenda(String(items[0].id))
      return items
    },
  )

  async function handleGenerate(preview: boolean) {
    setLoading(true)
    setPreviewHtml(null)
    setMessage(null)
    try {
      const res = await fetch(`/api/reports/generate?format=html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          fazendaId: parseInt(selectedFazenda),
          responsavel: responsavel || 'Responsável Técnico',
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || err.message || 'Falha ao gerar relatório')
      }
      const html = await res.text()

      if (preview) {
        setPreviewHtml(html)
        setMessage({ type: 'success', text: 'Pré-visualização gerada. Revise abaixo ou clique em "Abrir / PDF" para imprimir ou salvar.' })
      } else {
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const w = window.open(url, '_blank')
        if (w) w.onload = () => setTimeout(() => w.print(), 500)
        setMessage({ type: 'success', text: 'Relatório aberto em nova aba. Use Ctrl+P para salvar como PDF.' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Erro ao gerar relatório.' })
    } finally {
      setLoading(false)
    }
  }

  const currentType = REPORT_TYPES.find((t) => t.value === reportType)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">Gere relatórios por fazenda com base em monitoramentos (scouts) e identificações de pragas</p>
      </div>

      {message && (
        <div
          role="alert"
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
            message.type === 'error'
              ? 'border-destructive/50 bg-destructive/10 text-destructive'
              : 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração</CardTitle>
              <CardDescription>Fazenda e responsável técnico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fazenda</Label>
                {loadingFazendas ? (
                  <Skeleton className="h-9 w-full" />
                ) : (
                  <Select value={selectedFazenda} onValueChange={setSelectedFazenda}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a fazenda" />
                    </SelectTrigger>
                    <SelectContent>
                      {fazendas.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Responsável Técnico</Label>
                <Input
                  placeholder="Nome do responsável"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tipo de relatório</CardTitle>
              <CardDescription>Escolha o formato conforme o uso</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setReportType(t.value)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${reportType === t.value ? t.bg : 'hover:bg-muted/50'}`}
                >
                  <div className="flex items-center gap-2">
                    <t.icon className={`h-4 w-4 ${t.color}`} />
                    <span className="font-medium">{t.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => handleGenerate(true)}
              disabled={loading || !selectedFazenda}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Pré-visualizar
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleGenerate(false)}
              disabled={loading || !selectedFazenda}
            >
              <Printer className="h-4 w-4" />
              Abrir / PDF
            </Button>
          </div>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Pré-visualização
              {currentType && (
                <span className={`text-sm font-normal ${currentType.color}`}>— {currentType.label}</span>
              )}
            </CardTitle>
            <CardDescription>
              {previewHtml
                ? 'Clique em "Abrir / PDF" para imprimir ou salvar como arquivo.'
                : 'Selecione fazenda e tipo, depois clique em "Pré-visualizar".'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {previewHtml ? (
              <div className="rounded-lg border bg-white dark:bg-zinc-900 overflow-hidden">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ height: '720px' }}
                  title="Pré-visualização do relatório"
                />
              </div>
            ) : (
              <div className="flex h-[520px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 text-muted-foreground">
                <FileText className="mb-3 h-14 w-14 opacity-40" />
                <p className="font-medium">Nenhum relatório gerado ainda</p>
                <p className="mt-1 text-center text-sm max-w-sm">
                  Os dados vêm dos <strong>scouts</strong> e <strong>scout_marker_pragas</strong> da fazenda escolhida.
                </p>
                <p className="mt-2 text-xs flex items-center gap-1">
                  <Info className="h-3.5 w-3.5" /> Selecione os parâmetros e clique em Pré-visualizar
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
