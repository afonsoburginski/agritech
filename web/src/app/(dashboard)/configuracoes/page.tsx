'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Wifi, Loader2, Sun, Moon, Monitor, Info, RefreshCw, CheckCircle, XCircle, Server, Sparkles, Leaf,
} from 'lucide-react'
import { useSupabaseQuery } from '@/hooks/use-supabase-query'

const APP_VERSION = '1.0.0'

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => setMounted(true), [])

  const { data: integrationStatus = { supabase: null, embrapa: null, openai: null } } = useSupabaseQuery(
    ['integrations', 'status'],
    async (sb) => {
      let sbStatus: boolean | null = null
      let embrapaStatus: boolean | null = null

      try {
        const { error } = await sb.from('fazendas').select('id').limit(1)
        sbStatus = !error
      } catch { sbStatus = false }

      try {
        const res = await fetch('/api/identify-pest', { method: 'GET' })
        embrapaStatus = res.ok
      } catch { embrapaStatus = false }

      return { supabase: sbStatus, embrapa: embrapaStatus, openai: true as boolean | null }
    },
    { staleTime: 60000 },
  )

  const StatusIcon = ({ status }: { status: boolean | null }) => {
    if (status === null) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    if (status) return <CheckCircle className="h-5 w-5 text-emerald-500" />
    return <XCircle className="h-5 w-5 text-destructive" />
  }

  const integrations = [
    { key: 'supabase' as const, label: 'Supabase', desc: 'Banco de dados e autenticação', icon: Server, ok: 'Conectado', fail: 'Erro' },
    { key: 'embrapa' as const, label: 'Embrapa AGROFIT', desc: 'Catálogo de pragas e produtos', icon: Leaf, ok: 'Disponível', fail: 'Indisponível' },
    { key: 'openai' as const, label: 'OpenAI Vision', desc: 'Identificação de pragas por IA', icon: Sparkles, ok: 'Configurado', fail: 'Erro' },
  ]

  async function handleRefreshData() {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Aparência, integrações e preferências do app.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Aparência */}
        <Card className="overflow-hidden border-2">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              {mounted && resolvedTheme === 'dark' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              Aparência
            </CardTitle>
            <CardDescription>Tema de exibição do painel.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {mounted ? (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light' as const, icon: Sun, label: 'Claro' },
                  { value: 'dark' as const, icon: Moon, label: 'Escuro' },
                  { value: 'system' as const, icon: Monitor, label: 'Sistema' },
                ].map(({ value, icon: Icon, label }) => (
                  <Button
                    key={value}
                    type="button"
                    variant={(theme ?? 'system') === value ? 'default' : 'outline'}
                    className="h-auto flex-col gap-2 py-4"
                    onClick={() => setTheme(value)}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{label}</span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dados e cache */}
        <Card className="overflow-hidden border-2">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <RefreshCw className="h-5 w-5" />
              Dados
            </CardTitle>
            <CardDescription>Forçar atualização dos dados em cache.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleRefreshData}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar todos os dados
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Invalida o cache e recarrega listas, dashboard e integrações.
            </p>
          </CardContent>
        </Card>

        {/* Sobre */}
        <Card className="overflow-hidden border-2 lg:col-span-2">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Info className="h-5 w-5" />
              Sobre o AGROV
            </CardTitle>
            <CardDescription>Versão e informações do aplicativo.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Versão</span>
                <p className="font-medium">{APP_VERSION}</p>
              </div>
              <div>
                <span className="text-muted-foreground">ERP Agrícola</span>
                <p className="font-medium">Monitoramento de pragas, vetorização e relatórios.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Wifi className="h-5 w-5" />
            Status das integrações
          </CardTitle>
          <CardDescription>
            Conectividade com os serviços usados pelo AGROV. Atualizado a cada minuto.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {integrations.map((item) => {
              const status = integrationStatus[item.key]
              const isOk = status === true
              const isChecking = status === null
              return (
                <div
                  key={item.key}
                  className={`flex flex-col gap-3 rounded-xl border-2 p-4 transition-colors ${
                    isOk
                      ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                      : isChecking
                        ? 'border-muted bg-muted/30'
                        : 'border-destructive/30 bg-destructive/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          isOk ? 'bg-emerald-500/20' : isChecking ? 'bg-muted' : 'bg-destructive/20'
                        }`}
                      >
                        <item.icon
                          className={`h-5 w-5 ${
                            isOk ? 'text-emerald-600' : isChecking ? 'text-muted-foreground' : 'text-destructive'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    <StatusIcon status={status} />
                  </div>
                  <Badge
                    variant={isOk ? 'default' : 'secondary'}
                    className={`w-fit ${isOk ? 'bg-emerald-600 hover:bg-emerald-700' : ''} ${!isOk && !isChecking ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' : ''}`}
                  >
                    {isChecking ? 'Verificando...' : isOk ? item.ok : item.fail}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
