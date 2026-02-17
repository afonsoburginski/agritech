'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { UserCircle, Save, Loader2, Building2 } from 'lucide-react'
import { useSupabaseQuery, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

interface MyProfile {
  id: string
  nome: string
  email: string
  telefone: string | null
  cpf: string | null
}

interface FazendaData {
  id: number
  nome: string
  cnpj: string | null
  cidade: string | null
  estado: string | null
  area_total: number | null
}

export default function ContaPage() {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [formLoaded, setFormLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const queryClient = useQueryClient()

  const [fazendaNome, setFazendaNome] = useState('')
  const [fazendaCnpj, setFazendaCnpj] = useState('')
  const [fazendaCidade, setFazendaCidade] = useState('')
  const [fazendaEstado, setFazendaEstado] = useState('')
  const [fazendaAreaTotal, setFazendaAreaTotal] = useState('')
  const [fazendaFormLoaded, setFazendaFormLoaded] = useState(false)

  const { data: profile, isLoading } = useSupabaseQuery<MyProfile | null>(
    queryKeys.profile.me(),
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return null
      const { data } = await sb
        .from('profiles')
        .select('id, nome, email, telefone, cpf')
        .eq('id', user.id)
        .single()
      return data as MyProfile | null
    },
  )

  const { data: fazenda, isLoading: fazendaLoading } = useSupabaseQuery<FazendaData | null>(
    [...queryKeys.fazendas.all, 'mine'],
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return null
      const { data: uf } = await sb
        .from('user_fazendas')
        .select('fazenda_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      if (!uf) return null
      const { data: f } = await sb
        .from('fazendas')
        .select('*')
        .eq('id', uf.fazenda_id)
        .single()
      const faz = f as FazendaData | null
      if (faz && !fazendaFormLoaded) {
        setFazendaNome(faz.nome ?? '')
        setFazendaCnpj(faz.cnpj ?? '')
        setFazendaCidade(faz.cidade ?? '')
        setFazendaEstado(faz.estado ?? '')
        setFazendaAreaTotal(faz.area_total ? String(faz.area_total) : '')
        setFazendaFormLoaded(true)
      }
      return faz
    },
  )

  const saveFazendaMutation = useMutation({
    mutationFn: async () => {
      if (!fazenda) return
      await supabase
        .from('fazendas')
        .update({
          nome: fazendaNome,
          cnpj: fazendaCnpj || null,
          cidade: fazendaCidade || null,
          estado: fazendaEstado || null,
          area_total: fazendaAreaTotal ? parseFloat(fazendaAreaTotal) : null,
        })
        .eq('id', fazenda.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fazendas.all })
    },
  })

  useEffect(() => {
    if (profile && !formLoaded) {
      setNome(profile.nome ?? '')
      setTelefone(profile.telefone ?? '')
      setCpf(profile.cpf ?? '')
      setFormLoaded(true)
    }
  }, [profile, formLoaded])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage({ type: 'error', text: 'Sessão inválida. Faça login novamente.' })
        return
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: nome.trim() || null,
          telefone: telefone.trim() || null,
          cpf: cpf.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (error) throw error
      await queryClient.invalidateQueries({ queryKey: queryKeys.profile.me() })
      setMessage({ type: 'success', text: 'Dados salvos com sucesso.' })
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
          <p className="text-muted-foreground">Dados pessoais e propriedade vinculada.</p>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Conta</h1>
        <p className="text-muted-foreground">Dados pessoais e propriedade vinculada à sua conta.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Dados pessoais
            </CardTitle>
            <CardDescription>Estes dados podem ser alterados por você a qualquer momento.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={profile.email ?? ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado nesta tela.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cpf">CPF</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            {message && (
              <p
                className={`text-sm ${message.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}
              >
                {message.text}
              </p>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar alterações
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>

      <Card className="overflow-hidden border-2 transition-shadow hover:shadow-lg">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">Propriedade</CardTitle>
              <CardDescription>Informações da fazenda vinculada à sua conta</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {fazendaLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : !fazenda ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-12 text-center">
              <Building2 className="mb-3 h-12 w-12 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">Nenhuma fazenda associada</p>
              <p className="mt-1 text-sm text-muted-foreground">Entre em contato com o administrador.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome da Fazenda</Label>
                <Input
                  value={fazendaNome}
                  onChange={(e) => setFazendaNome(e.target.value)}
                  placeholder="Ex: Fazenda Santa Maria"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">CNPJ</Label>
                <Input
                  value={fazendaCnpj}
                  onChange={(e) => setFazendaCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="h-10 font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Cidade</Label>
                  <Input value={fazendaCidade} onChange={(e) => setFazendaCidade(e.target.value)} className="h-10" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">UF</Label>
                  <Input
                    value={fazendaEstado}
                    onChange={(e) => setFazendaEstado(e.target.value)}
                    placeholder="MG"
                    maxLength={2}
                    className="h-10 uppercase"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Área total (hectares)</Label>
                <Input
                  type="number"
                  value={fazendaAreaTotal}
                  onChange={(e) => setFazendaAreaTotal(e.target.value)}
                  placeholder="0.00"
                  className="h-10"
                  step="0.01"
                  min={0}
                />
              </div>
              <Separator className="my-4" />
              <Button
                type="button"
                onClick={() => saveFazendaMutation.mutate()}
                disabled={saveFazendaMutation.isPending}
                className="w-full gap-2 h-11"
              >
                {saveFazendaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveFazendaMutation.isSuccess ? 'Salvo!' : 'Salvar alterações da propriedade'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
