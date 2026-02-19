# Autenticação e modelo de contas (fazendas, donos, técnicos)

## Estado atual da base

### Tabelas envolvidas

1. **auth.users (Supabase Auth)**  
   - Contas de login (e-mail/senha). Cada pessoa = 1 usuário (uuid).

2. **public.profiles**  
   - Perfil estendido: `id` (FK auth.users), `nome`, `email`, `telefone`, `cpf`.  
   - Criado por trigger no signup. RLS: usuário só acessa o próprio perfil.

3. **public.fazendas**  
   - Propriedades rurais: `id`, `nome`, `cnpj`, `cidade`, `estado`, `area_total`, etc.  
   - **Não tem** `owner_id`. Não fica explícito quem é o dono.

4. **public.user_fazendas**  
   - Relação N:N usuário ↔ fazenda: `user_id`, `fazenda_id`, `role` (texto, default `'member'`).  
   - UNIQUE (user_id, fazenda_id).  
   - RLS hoje:  
     - SELECT: só as próprias linhas (`user_id = auth.uid()`).  
     - INSERT: só pode inserir com `user_id = auth.uid()` (usuário só se adiciona a si mesmo).

### O que o app faz hoje

- **auth-store**: no login, carrega `profiles` e `user_fazendas` (com `fazendas(id, nome)`).  
- Usa **apenas a primeira** fazenda do usuário como `fazendaPadrao`.  
- Não há tela de “trocar fazenda” nem de “convidar técnico”.  
- Role existe na tabela mas não há enum (valores livres como `'member'`).

### Problemas para o modelo desejado

- **Dono com várias fazendas**: a estrutura já permite (várias linhas em `user_fazendas`), mas o app só usa a primeira; além disso, não há noção clara de “dono” (role ou `owner_id`).
- **Técnicos com acesso**: hoje **só o próprio usuário** pode se inserir em `user_fazendas`. O dono **não consegue** adicionar outro usuário (técnico) à fazenda, porque a RLS de INSERT exige `user_id = auth.uid()`.
- **Papéis (roles)** não estão padronizados: não existe distinção formal entre dono e técnico.

---

## Modelo desejado (regras de negócio)

1. **Cliente (dono)**  
   - É quem criou a conta.  
   - Pode ter **várias fazendas** (cada uma com seu vínculo em `user_fazendas` com role `owner`).  
   - **Adiciona técnicos** às fazendas: insere em `user_fazendas` (user_id do técnico, fazenda_id, role `technician`). Não existe fluxo de “convidar” (convite por e-mail); o dono apenas associa técnicos já cadastrados às fazendas.

2. **Técnicos**  
   - Usuários com conta no app (auth.users + profiles).  
   - Têm acesso a **uma ou mais fazendas** às quais o dono os vinculou (role `technician`).  
   - Exemplo: dono com 2 fazendas e 3 técnicos — 2 técnicos com acesso às 2 fazendas, 1 técnico com acesso a apenas 1 fazenda.  
   - Só o dono (owner) da fazenda pode gerenciar vínculos (adicionar/remover técnicos).

3. **Fluxo**  
   - Cadastro → cria usuário + profile.  
   - Dono cria fazenda → INSERT em `fazendas` + INSERT em `user_fazendas` (ele mesmo com role `owner`).  
   - Dono adiciona técnico à fazenda → INSERT em `user_fazendas` (user_id do técnico, fazenda_id, role `technician`).  
   - Técnico faz login → vê as fazendas em que está em `user_fazendas` e usa uma como “padrão” (ou escolhe).

---

## Ajustes na base (migração)

- **Papéis padronizados**  
  - `user_fazendas.role` restrito a: `'owner'` (dono da fazenda) ou `'technician'` (técnico com acesso).  
  - Valores antigos (ex.: `'member'`) tratados como `'owner'` na migração.

- **Dono da fazenda**  
  - Coluna `fazendas.owner_id` (uuid, FK `profiles.id`), opcional.  
  - Preenchida ao criar a fazenda e/ou por backfill a partir do primeiro usuário com role `owner` em `user_fazendas`.

- **RLS em user_fazendas**  
  - **SELECT**: mantido (só as próprias linhas).  
  - **INSERT**:  
    - usuário pode se adicionar (`user_id = auth.uid()`), **ou**  
    - usuário que já é `owner` dessa fazenda pode inserir **outro** usuário (ex.: técnico).  
  - **UPDATE/DELETE**:  
    - dono da fazenda pode alterar/remover qualquer vínculo daquela fazenda;  
    - usuário pode remover o próprio vínculo (sair da fazenda).

- **RLS em fazendas**  
  - SELECT/UPDATE: quem tem linha em `user_fazendas` para essa fazenda (como hoje).  
  - INSERT: usuário autenticado pode criar; trigger ou app preenche `owner_id = auth.uid()` e cria a linha em `user_fazendas` com role `owner`.

Com isso, a base fica alinhada ao modelo: **um dono, várias fazendas; por fazenda, vários técnicos; um técnico pode estar em várias fazendas; apenas donos podem adicionar/remover técnicos.**

---

## Avatar do usuário

- **profiles.avatar_url** (text, nullable): URL pública da foto de perfil (Supabase Storage).  
- Bucket **avatars**: cada usuário pode fazer upload em `{user_id}/avatar` (ex.: JPEG). RLS: leitura pública; escrita apenas para o próprio `user_id`.  
- App: ao carregar perfil, usa `avatar_url`; ao trocar foto, faz upload no Storage, atualiza `profiles.avatar_url` e exibe a nova URL.

---

## Próximos passos no app (resumo)

- Carregar **todas** as fazendas do usuário (não só a primeira) e permitir **trocar fazenda padrão**.  
- Tela/fluxo para o **dono** criar nova fazenda (INSERT fazenda + user_fazendas owner).  
- Tela para o **dono** adicionar técnico à fazenda (buscar usuário por e-mail → INSERT user_fazendas com role `technician`).  
- Avatar: exibir `profile.avatar_url`; ao alterar foto, upload no Storage e update em `profiles.avatar_url`.

Este doc pode ser usado como referência para a migração e para as próximas features de multi-fazenda e avatar.
