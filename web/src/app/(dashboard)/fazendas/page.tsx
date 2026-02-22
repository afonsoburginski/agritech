'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Save, Loader2, Building2, MapPin, Ruler, CheckCircle } from 'lucide-react'
import { useSupabaseQuery, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

interface FazendaData {
  id: number
  nome: string
  cnpj: string | null
  cidade: string | null
  estado: string | null
  area_total?: number | string | null
}

function areaTotalToString(v: number | string | null | undefined): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  return String(v)
}

export default function FazendasPage() {
  const queryClient = useQueryClient()

  const { data: fazendasList, isLoading } = useSupabaseQuery<FazendaData[]>(
    [...queryKeys.fazendas.all, 'mine-all'],
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return []
      const { data: ufList } = await sb
        .from('user_fazendas')
        .select('fazenda_id')
        .eq('user_id', user.id)
      const ids = (ufList ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (ids.length === 0) return []
      const { data: fList } = await sb
        .from('fazendas')
        .select('id, nome, cnpj, cidade, estado, area_total')
        .in('id', ids)
      return (fList ?? []) as FazendaData[]
    },
  )

  const fazendas = fazendasList ?? []

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dados das fazendas</h1>
        <p className="text-sm text-muted-foreground">Edite as informações das propriedades. A área total (hectares) não pode ser alterada.</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : fazendas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Building2 className="mb-3 h-12 w-12 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhuma fazenda vinculada à sua conta.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {fazendas.map((fazenda) => (
            <FazendaCard
              key={fazenda.id}
              fazenda={fazenda}
              onInvalidate={() => queryClient.invalidateQueries({ queryKey: queryKeys.fazendas.all })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FazendaCard({
  fazenda: initial,
  onInvalidate,
}: {
  fazenda: FazendaData
  onInvalidate: () => void
}) {
  const [nome, setNome] = useState(initial.nome ?? '')
  const [cnpj, setCnpj] = useState(initial.cnpj ?? '')
  const [cidade, setCidade] = useState(initial.cidade ?? '')
  const [estado, setEstado] = useState(initial.estado ?? '')
  const [formLoaded, setFormLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!formLoaded) {
      setNome(initial.nome ?? '')
      setCnpj(initial.cnpj ?? '')
      setCidade(initial.cidade ?? '')
      setEstado(initial.estado ?? '')
      setFormLoaded(true)
    }
  }, [initial.id, initial.nome, initial.cnpj, initial.cidade, initial.estado, formLoaded])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    try {
      await supabase
        .from('fazendas')
        .update({
          nome: nome || null,
          cnpj: cnpj || null,
          cidade: cidade || null,
          estado: estado || null,
          /* area_total não é enviado: permanece o valor do banco */
        })
        .eq('id', initial.id)
      onInvalidate()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          {initial.nome || `Fazenda #${initial.id}`}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Nome da fazenda</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Fazenda Santa Maria"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">CNPJ</Label>
            <Input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              placeholder="00.000.000/0000-00"
              className="font-mono text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-sm flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Cidade
              </Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">UF</Label>
              <Input
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                placeholder="MG"
                maxLength={2}
                className="uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 text-muted-foreground" />
              Área total (hectares)
            </Label>
            <p className="text-sm text-muted-foreground py-2">{areaTotalToString(initial.area_total)}</p>
          </div>

          <Separator />

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="mr-2 h-4 w-4" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? 'Salvo!' : 'Salvar alterações'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
