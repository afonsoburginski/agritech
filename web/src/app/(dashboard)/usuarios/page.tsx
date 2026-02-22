'use client'

import { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DataTable, SortableHeader } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  UserPlus,
  Shield,
  ShieldCheck,
  Trash2,
  Loader2,
  Users,
  Building2,
  UserCheck,
  Pencil,
  Plus,
} from 'lucide-react'
import { useSupabaseQuery, useOptimisticMutation, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

interface Vinculo {
  userFazendaId: number
  fazendaId: number
  fazendaNome: string
  role: string
}

interface UserRow {
  profileId: string
  nome: string
  email: string
  telefone: string | null
  created_at: string
  vinculos: Vinculo[]
}

interface MyFazenda {
  fazenda_id: number
  nome: string
}

interface VinculoRow {
  id: number
  user_id: string
  fazenda_id: number
  role: string
  created_at?: string
  profiles?: { id: string; nome: string; email: string; telefone?: string | null; created_at?: string }
  fazendas?: { id: number; nome: string }
}

export default function UsuariosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [inviteRole, setInviteRole] = useState('technician')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteFazendaId, setInviteFazendaId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editUser, setEditUser] = useState<UserRow | null>(null)
  const [addFazendaId, setAddFazendaId] = useState('')
  const [addRole, setAddRole] = useState('technician')
  const [addingVinculo, setAddingVinculo] = useState(false)
  const queryClient = useQueryClient()

  const { data: myFazendasData } = useSupabaseQuery<{ list: MyFazenda[]; ids: number[] }>(
    ['my-fazendas-for-invite'],
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return { list: [], ids: [] }
      const { data: ufData } = await sb
        .from('user_fazendas')
        .select('fazenda_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
      const ids = (ufData ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (ids.length === 0) return { list: [], ids: [] }
      const { data: fData } = await sb
        .from('fazendas')
        .select('id, nome')
        .in('id', ids)
      const byId = new Map((fData ?? []).map((f: { id: number; nome: string }) => [f.id, f.nome]))
      const list: MyFazenda[] = ids.map((fazenda_id) => ({
        fazenda_id,
        nome: byId.get(fazenda_id) ?? `Fazenda ${fazenda_id}`,
      }))
      return { list, ids }
    },
  )
  const myFazendas = myFazendasData?.list ?? []
  const myFazendaIds = myFazendasData?.ids ?? []

  const { data: vinculosRaw, isLoading } = useSupabaseQuery<VinculoRow[]>(
    ['vinculos-por-fazenda'],
    async (sb) => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return []
      const { data: ufMine } = await sb
        .from('user_fazendas')
        .select('fazenda_id')
        .eq('user_id', user.id)
        .eq('role', 'owner')
      const fazendaIds = (ufMine ?? []).map((r: { fazenda_id: number }) => r.fazenda_id)
      if (fazendaIds.length === 0) return []

      const { data: ufRows, error: err } = await sb
        .from('user_fazendas')
        .select('id, role, fazenda_id, user_id, created_at')
        .in('fazenda_id', fazendaIds)
      if (err || !ufRows?.length) return (ufRows ?? []) as VinculoRow[]

      const userIds = Array.from(new Set(ufRows.map((r: { user_id: string }) => r.user_id)))
      const { data: profiles } = await sb.from('profiles').select('id, nome, email, telefone, created_at').in('id', userIds)
      const { data: fazendas } = await sb.from('fazendas').select('id, nome').in('id', fazendaIds)
      const profileMap = new Map((profiles ?? []).map((p: { id: string; nome: string; email: string; telefone?: string | null; created_at?: string }) => [p.id, p]))
      const fazendaMap = new Map((fazendas ?? []).map((f: { id: number; nome: string }) => [f.id, f]))

      return ufRows.map((uf: { id: number; user_id: string; fazenda_id: number; role: string; created_at?: string }) => ({
        ...uf,
        profiles: profileMap.get(uf.user_id),
        fazendas: fazendaMap.get(uf.fazenda_id),
      })) as VinculoRow[]
    },
  )

  const userRows: UserRow[] = useMemo(() => {
    const list = vinculosRaw ?? []
    const byUser = new Map<string, UserRow>()
    for (const v of list) {
      const profile = v.profiles as { nome?: string; email?: string; telefone?: string | null; created_at?: string } | undefined
      const fazenda = v.fazendas as { nome?: string } | undefined
      const vinculo: Vinculo = {
        userFazendaId: v.id,
        fazendaId: v.fazenda_id,
        fazendaNome: fazenda?.nome ?? '—',
        role: v.role,
      }
      const existing = byUser.get(v.user_id)
      if (existing) {
        existing.vinculos.push(vinculo)
      } else {
        byUser.set(v.user_id, {
          profileId: v.user_id,
          nome: profile?.nome ?? '—',
          email: profile?.email ?? '',
          telefone: profile?.telefone ?? null,
          created_at: (profile as { created_at?: string })?.created_at ?? v.created_at ?? new Date().toISOString(),
          vinculos: [vinculo],
        })
      }
    }
    return Array.from(byUser.values())
  }, [vinculosRaw])

  const stats = useMemo(() => ({
    total: userRows.length,
    owners: userRows.reduce((acc, u) => acc + u.vinculos.filter((v) => v.role === 'owner').length, 0),
    technicians: userRows.reduce((acc, u) => acc + u.vinculos.filter((v) => v.role === 'technician').length, 0),
  }), [userRows])

  const updateRoleMutation = useOptimisticMutation<void, { userFazendaId: number; newRole: string }>({
    mutationFn: async (sb, { userFazendaId, newRole }) => {
      await sb.from('user_fazendas').update({ role: newRole }).eq('id', userFazendaId)
    },
    invalidateKeys: [queryKeys.users.all, ['vinculos-por-fazenda']],
  })

  const removeUserMutation = useOptimisticMutation<void, number>({
    mutationFn: async (sb, userFazendaId) => {
      await sb.from('user_fazendas').delete().eq('id', userFazendaId)
    },
    invalidateKeys: [queryKeys.users.all, ['vinculos-por-fazenda']],
  })

  async function handleAddVinculo() {
    if (!editUser || !addFazendaId) return
    setAddingVinculo(true)
    try {
      await supabase.from('user_fazendas').insert({
        user_id: editUser.profileId,
        fazenda_id: Number(addFazendaId),
        role: addRole,
      })
      queryClient.invalidateQueries({ queryKey: ['vinculos-por-fazenda'] })
      setAddFazendaId('')
      setAddRole('technician')
      setEditUser(null)
    } finally {
      setAddingVinculo(false)
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError(null)
    try {
      const targetFazendaId = inviteFazendaId ? Number(inviteFazendaId) : myFazendas[0]?.fazenda_id
      if (!targetFazendaId) throw new Error('Selecione uma fazenda.')

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
        options: { data: { nome: inviteNome } },
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('Usuário não foi criado')

      await supabase.from('user_fazendas').insert({
        user_id: authData.user.id,
        fazenda_id: targetFazendaId,
        role: inviteRole,
      })

      setDialogOpen(false)
      resetForm()
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      queryClient.invalidateQueries({ queryKey: ['vinculos-por-fazenda'] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário')
    } finally {
      setInviting(false)
    }
  }

  function resetForm() {
    setInviteEmail('')
    setInviteNome('')
    setInvitePassword('')
    setInviteRole('technician')
    setInviteFazendaId('')
    setError(null)
  }

  const roleLabel = (role: string) => (role === 'owner' ? 'Proprietário' : 'Técnico')

  const columns: ColumnDef<UserRow>[] = useMemo(
    () => [
      {
        accessorKey: 'nome',
        header: ({ column }) => <SortableHeader column={column}>Usuário</SortableHeader>,
        cell: ({ row }) => {
          const initials = row.original.nome
            ? row.original.nome
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : '??'
          return (
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{row.original.nome}</div>
                <div className="text-xs text-muted-foreground">{row.original.email}</div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'fazendas',
        header: 'Fazendas',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1.5">
            {row.original.vinculos.map((v) => (
              <Badge key={v.userFazendaId} variant="secondary" className="text-xs font-normal">
                <Building2 className="mr-1 h-3 w-3" />
                {v.fazendaNome} · {roleLabel(v.role)}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'created_at',
        header: ({ column }) => <SortableHeader column={column}>Desde</SortableHeader>,
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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditUser(row.original)} title="Editar vínculos">
            <Pencil className="h-4 w-4" />
          </Button>
        ),
        enableHiding: false,
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">Gerencie quem tem acesso às suas fazendas e seus papéis.</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" />
              Adicionar usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:min-w-[520px] sm:max-w-[520px] min-h-[520px] max-h-[520px] flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Adicionar usuário</DialogTitle>
              <DialogDescription>
                Crie uma conta e vincule a uma das suas fazendas. O usuário poderá acessar o app e o painel web.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="flex flex-1 flex-col min-h-0">
              <div className="space-y-4 overflow-y-auto min-h-0 pr-1">
                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome completo *</Label>
                    <Input placeholder="Ex: Maria Silva" value={inviteNome} onChange={(e) => setInviteNome(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input type="email" placeholder="maria@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Senha inicial *</Label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fazenda *</Label>
                    <Select
                      value={inviteFazendaId || (myFazendas.length === 1 ? String(myFazendas[0].fazenda_id) : '')}
                      onValueChange={setInviteFazendaId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a fazenda" />
                      </SelectTrigger>
                      <SelectContent>
                        {myFazendas.map((f) => (
                          <SelectItem key={f.fazenda_id} value={String(f.fazenda_id)}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-3.5 w-3.5" />
                              {f.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Papel na fazenda</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Proprietário</SelectItem>
                        <SelectItem value="technician">Técnico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter className="mt-4 shrink-0">
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={inviting} className="gap-2">
                  {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Criar usuário
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">usuários nas suas fazendas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Proprietários</CardTitle>
            <ShieldCheck className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">{stats.owners}</div>
            <p className="text-xs text-muted-foreground">vínculos como dono</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Técnicos</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.technicians}</div>
            <p className="text-xs text-muted-foreground">vínculos como técnico</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>Um usuário por linha. Clique em Editar para alterar fazendas e papéis.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={userRows}
            isLoading={isLoading}
            searchKey="nome"
            searchPlaceholder="Buscar por nome..."
            totalCount={userRows.length}
            emptyMessage="Nenhum usuário encontrado. Use “Adicionar usuário” para associar alguém a uma fazenda."
          />
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar vínculos</DialogTitle>
            <DialogDescription>
              {editUser ? `${editUser.nome} — altere o papel por fazenda ou remova/adicione acesso.` : ''}
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                {editUser.vinculos.map((v) => (
                  <div
                    key={v.userFazendaId}
                    className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 font-medium">{v.fazendaNome}</span>
                    <Select
                      value={v.role}
                      onValueChange={(val) => updateRoleMutation.mutate({ userFazendaId: v.userFazendaId, newRole: val })}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Proprietário</SelectItem>
                        <SelectItem value="technician">Técnico</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remover ${editUser.nome} da fazenda "${v.fazendaNome}"?`)) {
                          removeUserMutation.mutate(v.userFazendaId)
                          const next = editUser.vinculos.filter((x) => x.userFazendaId !== v.userFazendaId)
                          setEditUser(next.length ? { ...editUser, vinculos: next } : null)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3">
                <div className="flex-1 min-w-[140px] space-y-1">
                  <Label className="text-xs">Fazenda</Label>
                  <Select value={addFazendaId} onValueChange={setAddFazendaId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {myFazendas
                        .filter((f) => !editUser.vinculos.some((v) => v.fazendaId === f.fazenda_id))
                        .map((f) => (
                          <SelectItem key={f.fazenda_id} value={String(f.fazenda_id)}>
                            {f.nome}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[130px] space-y-1">
                  <Label className="text-xs">Papel</Label>
                  <Select value={addRole} onValueChange={setAddRole}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Proprietário</SelectItem>
                      <SelectItem value="technician">Técnico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={!addFazendaId || addingVinculo}
                  onClick={handleAddVinculo}
                  className="gap-1"
                >
                  {addingVinculo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Adicionar
                </Button>
              </div>
              {myFazendas.filter((f) => !editUser.vinculos.some((v) => v.fazendaId === f.fazenda_id)).length === 0 && (
                <p className="text-xs text-muted-foreground">Usuário já está em todas as suas fazendas.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
