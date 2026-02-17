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
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { UserPlus, Shield, ShieldCheck, Trash2, Loader2, Users, Building2, UserCheck } from 'lucide-react'
import { useSupabaseQuery, useOptimisticMutation, supabase } from '@/hooks/use-supabase-query'
import { queryKeys } from '@/lib/query-keys'

interface UserProfile {
  id: string
  nome: string
  email: string
  telefone: string | null
  cpf: string | null
  created_at: string
  user_fazendas: {
    id: number
    role: string
    fazenda_id: number
    fazendas?: { id: number; nome: string }
  }[]
}

export default function UsuariosPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteNome, setInviteNome] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: usersResult, isLoading } = useSupabaseQuery<{ rows: UserProfile[]; count: number }>(
    queryKeys.users.list(),
    async (sb) => {
      const { data, count } = await sb
        .from('profiles')
        .select('*, user_fazendas(id, role, fazenda_id, fazendas:fazenda_id(id, nome))', { count: 'exact' })
        .order('created_at', { ascending: false })
      return { rows: (data ?? []) as unknown as UserProfile[], count: count ?? 0 }
    },
  )
  const users = usersResult?.rows ?? []
  const totalUsersCount = usersResult?.count ?? 0

  const stats = useMemo(() => {
    const withFazenda = users.filter((u) => u.user_fazendas?.length > 0)
    return {
      total: users.length,
      admins: withFazenda.filter((u) => u.user_fazendas?.[0]?.role === 'admin').length,
      members: withFazenda.filter((u) => u.user_fazendas?.[0]?.role === 'member').length,
      semFazenda: users.filter((u) => !u.user_fazendas?.length).length,
    }
  }, [users])

  const updateRoleMutation = useOptimisticMutation<void, { userFazendaId: number; newRole: string }>({
    mutationFn: async (sb, { userFazendaId, newRole }) => {
      await sb.from('user_fazendas').update({ role: newRole }).eq('id', userFazendaId)
    },
    optimisticKey: queryKeys.users.list(),
    optimisticUpdate: (old: UserProfile[] | undefined, { userFazendaId, newRole }) =>
      (old ?? []).map(u => ({
        ...u,
        user_fazendas: u.user_fazendas.map(uf =>
          uf.id === userFazendaId ? { ...uf, role: newRole } : uf
        ),
      })),
    invalidateKeys: [queryKeys.users.all],
  })

  const removeUserMutation = useOptimisticMutation<void, number>({
    mutationFn: async (sb, userFazendaId) => {
      await sb.from('user_fazendas').delete().eq('id', userFazendaId)
    },
    optimisticKey: queryKeys.users.list(),
    optimisticUpdate: (old: UserProfile[] | undefined, userFazendaId: number) =>
      (old ?? []).map(u => ({
        ...u,
        user_fazendas: u.user_fazendas.filter(uf => uf.id !== userFazendaId),
      })),
    invalidateKeys: [queryKeys.users.all],
  })

  async function handleInviteUser(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError(null)
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteEmail,
        password: invitePassword,
        options: { data: { nome: inviteNome } },
      })
      if (authError) throw authError
      if (!authData.user) throw new Error('Usuário não foi criado')

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (currentUser) {
        const { data: myFazendas } = await supabase
          .from('user_fazendas')
          .select('fazenda_id')
          .eq('user_id', currentUser.id)
          .limit(1)

        if (myFazendas && myFazendas.length > 0) {
          await supabase.from('user_fazendas').insert({
            user_id: authData.user.id,
            fazenda_id: myFazendas[0].fazenda_id,
            role: inviteRole,
          })
        }
      }

      setDialogOpen(false)
      setInviteEmail('')
      setInviteNome('')
      setInvitePassword('')
      setInviteRole('member')
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setInviting(false)
    }
  }

  const columns: ColumnDef<UserProfile>[] = useMemo(() => [
    {
      accessorKey: 'nome',
      header: ({ column }) => <SortableHeader column={column}>Usuário</SortableHeader>,
      cell: ({ row }) => {
        const initials = row.original.nome
          ? row.original.nome.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
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
      accessorKey: 'telefone',
      header: 'Telefone',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.telefone ?? '—'}</span>,
    },
    {
      id: 'fazenda',
      header: 'Fazenda',
      cell: ({ row }) => {
        const uf = row.original.user_fazendas?.[0]
        const nome = (uf?.fazendas as { nome?: string })?.nome
        return (
          <span className="flex items-center gap-1.5 text-sm">
            {nome ? <Building2 className="h-3.5 w-3.5 text-muted-foreground" /> : null}
            {nome ?? '—'}
          </span>
        )
      },
    },
    {
      id: 'role',
      header: 'Papel',
      cell: ({ row }) => {
        const uf = row.original.user_fazendas?.[0]
        if (!uf) return <Badge variant="outline">Sem fazenda</Badge>
        return (
          <Select
            value={uf.role}
            onValueChange={(val) => updateRoleMutation.mutate({ userFazendaId: uf.id, newRole: val })}
          >
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">
                <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5" /> Administrador</div>
              </SelectItem>
              <SelectItem value="member">
                <div className="flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> Membro</div>
              </SelectItem>
            </SelectContent>
          </Select>
        )
      },
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
      cell: ({ row }) => {
        const uf = row.original.user_fazendas?.[0]
        if (!uf) return null
        return (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm('Remover este usuário da fazenda? Ele perderá acesso aos dados da propriedade.')) {
                removeUserMutation.mutate(uf.id)
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )
      },
      enableHiding: false,
    },
  ], [updateRoleMutation, removeUserMutation])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">Gerencie quem tem acesso às fazendas e seus papéis (admin ou membro)</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setError(null) }}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <UserPlus className="h-4 w-4" />
              Convidar usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Novo usuário</DialogTitle>
              <DialogDescription>
                Crie uma conta no sistema e associe à mesma fazenda que você. O usuário poderá acessar o app e o painel web.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInviteUser} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label>Nome completo *</Label>
                <Input placeholder="Ex: Maria Silva" value={inviteNome} onChange={(e) => setInviteNome(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" placeholder="maria@exemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
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
              <div className="space-y-2">
                <Label>Papel na fazenda</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="member">Membro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">usuários no sistema</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administradores</CardTitle>
            <ShieldCheck className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">{stats.admins}</div>
            <p className="text-xs text-muted-foreground">com permissão de gestão</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros</CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.members}</div>
            <p className="text-xs text-muted-foreground">com acesso à fazenda</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sem fazenda</CardTitle>
            <Building2 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.semFazenda}</div>
            <p className="text-xs text-muted-foreground">conta sem propriedade</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de usuários</CardTitle>
          <CardDescription>Altere o papel ou remova o vínculo com a fazenda. Remover não exclui a conta do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={users}
            isLoading={isLoading}
            searchKey="nome"
            searchPlaceholder="Buscar por nome ou email..."
            totalCount={totalUsersCount}
            emptyMessage="Nenhum usuário encontrado. Use “Convidar usuário” para adicionar alguém à sua fazenda."
          />
        </CardContent>
      </Card>
    </div>
  )
}
