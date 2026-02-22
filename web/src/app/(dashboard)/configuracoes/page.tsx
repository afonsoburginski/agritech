'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Loader2, Sun, Moon, Monitor, RefreshCw, CheckCircle, XCircle,
  Server, Sparkles, Leaf, Info,
} from 'lucide-react'
import { useSupabaseQuery } from '@/hooks/use-supabase-query'

const APP_VERSION = '1.0.0'

export default function ConfiguracoesPage() {
  const queryClient = useQueryClient()
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshed, setRefreshed] = useState(false)

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

  const integrations = [
    { key: 'supabase' as const, label: 'Supabase', desc: 'Banco de dados e autenticação', icon: Server },
    { key: 'embrapa' as const, label: 'Embrapa AGROFIT', desc: 'Catálogo de pragas e produtos', icon: Leaf },
    { key: 'openai' as const, label: 'OpenAI Vision', desc: 'Identificação de pragas por IA', icon: Sparkles },
  ]

  async function handleRefreshData() {
    setRefreshing(true)
    setRefreshed(false)
    await queryClient.invalidateQueries()
    setRefreshing(false)
    setRefreshed(true)
    setTimeout(() => setRefreshed(false), 2000)
  }

  const themes = [
    { value: 'light' as const, icon: Sun, label: 'Claro' },
    { value: 'dark' as const, icon: Moon, label: 'Escuro' },
    { value: 'system' as const, icon: Monitor, label: 'Sistema' },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Aparência, integrações e cache.</p>
      </div>

      {/* Aparência */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {mounted && resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            Aparência
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mounted ? (
            <div className="grid grid-cols-3 gap-2">
              {themes.map(({ value, icon: Icon, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={(theme ?? 'system') === value ? 'default' : 'outline'}
                  className="h-auto flex-col gap-1.5 py-3"
                  onClick={() => setTheme(value)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium">{label}</span>
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex h-16 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cache de dados */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Cache de dados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Invalida o cache e recarrega todos os dados (dashboard, listas, integrações).
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRefreshData}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : refreshed ? (
              <CheckCircle className="mr-2 h-4 w-4" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {refreshed ? 'Dados atualizados!' : 'Atualizar todos os dados'}
          </Button>
        </CardContent>
      </Card>

      {/* Integrações */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Integrações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {integrations.map((item, idx) => {
            const status = integrationStatus[item.key]
            const isOk = status === true
            const isChecking = status === null
            return (
              <div key={item.key}>
                {idx > 0 && <Separator className="my-3" />}
                <div className="flex items-center gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isOk ? 'bg-emerald-500/10' : isChecking ? 'bg-muted' : 'bg-destructive/10'
                  }`}>
                    <item.icon className={`h-4 w-4 ${
                      isOk ? 'text-emerald-600' : isChecking ? 'text-muted-foreground' : 'text-destructive'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  {isChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        isOk
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {isOk ? 'Online' : 'Offline'}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Sobre */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Fox Fieldcore</p>
              <p className="text-xs text-muted-foreground">v{APP_VERSION} &middot; Monitoramento de pragas, vetorização e relatórios</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
