'use client'

import { useState, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Save, Loader2, Mail, Phone, CreditCard, CheckCircle } from 'lucide-react'
import { useSupabaseQuery, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

interface MyProfile {
  id: string
  nome: string
  email: string
  telefone: string | null
  cpf: string | null
  created_at: string
}

interface UserRole {
  role: string
}

export default function ContaPage() {
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cpf, setCpf] = useState('')
  const [formLoaded, setFormLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useSupabaseQuery<MyProfile | null>(
    queryKeys.profile.me(),
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return null
      const { data } = await sb
        .from('profiles')
        .select('id, nome, email, telefone, cpf, created_at')
        .eq('id', user.id)
        .single()
      return data as MyProfile | null
    },
  )

  const { data: userRole } = useSupabaseQuery<UserRole | null>(
    ['profile', 'role'],
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return null
      const { data } = await sb
        .from('user_fazendas')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      return data as UserRole | null
    },
  )

  useEffect(() => {
    if (profile && !formLoaded) {
      setNome(profile.nome ?? '')
      setTelefone(profile.telefone ?? '')
      setCpf(profile.cpf ?? '')
      setFormLoaded(true)
    }
  }, [profile, formLoaded])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    setSaved(false)
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
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: unknown) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const initials = profile?.nome
    ? profile.nome.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  const roleLabel = userRole?.role === 'owner' ? 'Proprietário' : 'Técnico'
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : '...'

  if (isLoading || !profile) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Skeleton className="h-20 w-20 rounded-full mx-auto" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Minha conta</h1>
        <p className="text-sm text-muted-foreground">Gerencie seus dados pessoais.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">{profile.nome}</h2>
              <p className="text-sm text-muted-foreground truncate">{profile.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={userRole?.role === 'owner' ? 'default' : 'secondary'} className="text-xs">
                  {roleLabel}
                </Badge>
                <span className="text-xs text-muted-foreground">Membro desde {memberSince}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold">Dados pessoais</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome" className="text-sm">Nome completo</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome completo"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                disabled
                className="bg-muted/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-sm flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  Telefone
                </Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpf" className="text-sm flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  CPF
                </Label>
                <Input
                  id="cpf"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>

            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                {message.text}
              </p>
            )}

            <Separator />

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : saved ? (
                <CheckCircle className="mr-2 h-4 w-4" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saved ? 'Salvo!' : 'Salvar dados pessoais'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
