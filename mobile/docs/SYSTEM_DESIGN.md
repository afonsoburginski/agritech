# System Design - Agrov Mobile

> Documento de referência para IA. Define COMO o app funciona tecnicamente.

---

## 1. Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Expo (React Native) | SDK ~54 |
| Navegação | Expo Router (file-based) | ~6.0 |
| Linguagem | TypeScript | ~5.9 (strict) |
| Estado global | Zustand | ^4.4 |
| Banco local | expo-sqlite | ~16.0 |
| Banco cloud | Supabase (Postgres) | - |
| Auth | Supabase Auth | JWT |
| Validação | Zod | ^3.22 |
| HTTP | Axios | ^1.13 |
| Mapas | react-native-maps | 1.18 |
| GPS | expo-location | ~19.0 |
| Câmera | expo-image-picker | ^17.0 |
| IA (fotos) | OpenAI API (Vision) | - |
| API agrícola | Embrapa AGROFIT v1 | OAuth2 client_credentials |

---

## 2. Arquitetura Geral

```
┌───────────────────────────────────────────────────────┐
│                    PRESENTATION                        │
│  app/(auth)/login.tsx    app/(tabs)/atividades.tsx     │
│  app/(tabs)/monitoramento.tsx  app/(tabs)/reconhecimento│
│  components/ui/*          components/maps/*            │
└───────────────────────┬───────────────────────────────┘
                        │ usa hooks + stores
┌───────────────────────▼───────────────────────────────┐
│                   BUSINESS LOGIC                       │
│  stores/ (Zustand)     hooks/ (React hooks)           │
│    auth-store.ts         use-atividades.ts            │
│    app-store.ts          use-scouts.ts                │
│                          use-pragas.ts                │
│                          use-sync.ts                  │
│                          use-location.ts              │
└───────────────────────┬───────────────────────────────┘
                        │ chama services
┌───────────────────────▼───────────────────────────────┐
│                      SERVICES                          │
│  services/                                            │
│    supabase.ts        → Supabase client (auth + DB)   │
│    api.ts             → AGROV ERP API (legado)        │
│    auth-service.ts    → Login/logout                  │
│    sync-service.ts    → Sincronização offline          │
│    location-service.ts→ GPS                           │
│    openai-service.ts  → Reconhecimento de praga       │
│    network-service.ts → Detecção online/offline       │
│    logger.ts          → Logging estruturado           │
│    storage.ts         → SecureStore (tokens)          │
└──────────┬────────────────────┬───────────────────────┘
           │                    │
┌──────────▼──────────┐  ┌─────▼────────────────────────┐
│    LOCAL DATA        │  │       REMOTE DATA             │
│  database/           │  │  Supabase (Postgres + Auth)   │
│    db.ts (SQLite)    │  │  Embrapa AGROFIT API          │
│    schema.ts         │  │  OpenAI API                   │
│    migrations/       │  │  AGROV ERP API (legado)       │
└─────────────────────┘  └───────────────────────────────┘
```

---

## 3. Estrutura de Diretórios

```
src/
├── app/                    # Telas (Expo Router file-based)
│   ├── (auth)/             # Telas de autenticação
│   │   ├── _layout.tsx
│   │   └── login.tsx
│   ├── (tabs)/             # Telas principais (tab bar)
│   │   ├── _layout.tsx
│   │   ├── index.tsx           # Dashboard
│   │   ├── atividades.tsx      # Lista de atividades
│   │   ├── monitoramento.tsx   # Mapa de scouts
│   │   ├── reconhecimento.tsx  # Identificação por foto
│   │   └── perfil.tsx          # Perfil do usuário
│   └── _layout.tsx         # Root layout
├── components/             # Componentes reutilizáveis
│   ├── ui/                 # Design system (button, input, card...)
│   ├── charts/             # Gráficos (bar, radar, stacked-area)
│   └── maps/               # Mapa de calor
├── stores/                 # Zustand stores (estado global)
│   ├── auth-store.ts       # Auth state + actions
│   └── app-store.ts        # App-wide state
├── hooks/                  # Custom React hooks
│   ├── use-atividades.ts   # CRUD atividades
│   ├── use-scouts.ts       # CRUD scouts
│   ├── use-pragas.ts       # Catálogo pragas
│   ├── use-sync.ts         # Sincronização
│   ├── use-location.ts     # GPS
│   ├── use-camera.ts       # Câmera
│   └── use-supabase-data.ts # Dados do Supabase
├── services/               # Lógica de infraestrutura
│   ├── supabase.ts         # Supabase client
│   ├── api.ts              # Axios instance (AGROV ERP)
│   ├── auth-service.ts     # Login/logout/refresh
│   ├── sync-service.ts     # Fila de sync
│   ├── location-service.ts # GPS com retry
│   ├── openai-service.ts   # Vision API
│   ├── network-service.ts  # NetInfo
│   ├── logger.ts           # Logger (sanitiza dados sensíveis)
│   └── storage.ts          # SecureStore
├── database/               # SQLite (dados offline)
│   ├── db.ts               # Singleton, init, migrations
│   ├── schema.ts           # DDL das tabelas locais
│   ├── migrations/         # Migrations versionadas
│   └── seed-utils.ts       # Dados de exemplo
├── types/                  # TypeScript types
│   ├── index.ts            # Entidades, DTOs, enums
│   └── supabase.ts         # Types gerados do Supabase
├── constants/              # Cores, tema, constantes
├── theme/                  # Theme provider, globals
└── utils/                  # Helpers genéricos
```

---

## 4. Schema do Supabase (Postgres)

### Princípio

Somente dados de **regra de negócio** vão para o Supabase. Dados de referência agronômica (pragas, culturas, produtos) vêm da **Embrapa AGROFIT** e ficam em cache local.

### Tabelas

```
auth.users (gerenciado pelo Supabase Auth)
  │
  ▼
profiles ──< user_fazendas >── fazendas
                                  │
                                  ├── talhoes
                                  │
                                  └── safras
                                        │
                              atividades ┤ (via fazenda_id + safra opcional)
                              │          │
                              ├── atividade_talhoes
                              ├── atividade_produtos
                              ├── atividade_maquinarios
                              └── atividade_funcionarios
                              
                              scouts ──── (via fazenda_id + talhao_id)
                              │
                              └── scout_markers
                                    │
                                    └── scout_marker_pragas
```

### RLS (Row Level Security)

Todas as tabelas usam RLS. Regras:
- `profiles`: usuário só vê/edita o próprio perfil
- `fazendas`, `talhoes`, `safras`: usuário só acessa fazendas às quais está vinculado (via `user_fazendas`)
- `atividades`, `scouts` e filhas: filtrado por `fazenda_id` do usuário

---

## 5. Fontes de Dados Externas

### 5.1 Embrapa AGROFIT API

- **Base URL:** `https://api.cnptia.embrapa.br/agrofit/v1`
- **Auth:** OAuth2 client_credentials (consumer key + secret → access token)
- **Token URL:** `https://api.cnptia.embrapa.br/token`
- **Dados disponíveis:**
  - `GET /pragas` — catálogo de pragas
  - `GET /plantasDaninhas` — plantas daninhas
  - `GET /culturas` — culturas
  - `GET /produtosFormulados` — produtos formulados (defensivos)
- **Uso no app:** consulta de referência (read-only), cache local
- **Variáveis (.env):**
  - `EXPO_PUBLIC_AGROFIT_API_URL`
  - `EMBRAPA_TOKEN_URL`
  - `EMBRAPA_CONSUMER_KEY`
  - `EMBRAPA_CONSUMER_SECRET`
  - `EMBRAPA_ACCESS_TOKEN`

### 5.2 OpenAI Vision API

- **Uso:** identificação de pragas por foto
- **Variável (.env):** `OPENAI_API_KEY`
- **Fluxo:** foto → base64 → OpenAI → resposta com identificação

### 5.3 AGROV ERP API (legado)

- **Base URL:** configurável (originalmente `http://localhost:8080`)
- **Auth:** JWT próprio (email + senha → token)
- **Status:** legado — sendo substituído por Supabase + Embrapa
- **Endpoints:** `/mobile/auth/login`, `/mobile/atividades`, `/mobile/scouts`

---

## 6. Fluxo de Sincronização

```
                  ┌──────────────┐
                  │   Operação   │
                  │  do usuário  │
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │ Salva local  │
                  │  (SQLite)    │
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐     ┌──────────┐
                  │ Adiciona à   │────>│sync_queue│
                  │ fila de sync │     │ (SQLite) │
                  └──────┬───────┘     └──────────┘
                         │
              ┌──────────▼──────────┐
              │    Online?          │
              │  (NetInfo check)    │
              └──┬──────────────┬───┘
                 │ SIM          │ NÃO
          ┌──────▼──────┐   ┌──▼────────────┐
          │  Processa   │   │  Aguarda      │
          │  fila →     │   │  reconexão    │
          │  Supabase   │   │  (auto-sync)  │
          └──────┬──────┘   └───────────────┘
                 │
          ┌──────▼──────┐
          │  Sucesso?   │
          └──┬──────┬───┘
             │SIM   │NÃO
     ┌───────▼──┐ ┌─▼──────────────┐
     │ Remove   │ │ Retry backoff  │
     │ da fila  │ │ (1s,2s,4s,8s,  │
     │ Marca    │ │  16s; max 5x)  │
     │ synced=1 │ │ Status=FAILED  │
     └──────────┘ │ se esgotou     │
                  └────────────────┘
```

### Sincronização incremental

- GET com `?lastSync=YYYY-MM-DDTHH:mm:ss`
- Retorna somente registros criados/modificados desde a data
- `lastSync` persistido localmente (SQLite ou AsyncStorage)

### Resolução de conflitos

- Estratégia: **Last-Write-Wins**
- Compara `updated_at` local vs servidor
- Mais recente prevalece

---

## 7. Autenticação

### Fluxo

```
1. Usuário digita email + senha
2. App chama Supabase Auth (signInWithPassword)
3. Supabase retorna session (access_token + refresh_token)
4. App persiste tokens no SecureStore
5. Todas as requests ao Supabase usam o access_token automaticamente
6. Refresh automático quando token expira
```

### Multi-tenant (fazendas)

- Após login, app busca fazendas do usuário (via `user_fazendas`)
- Usuário seleciona fazenda ativa
- `fazenda_id` é armazenado no Zustand auth-store
- Todas as queries filtram por `fazenda_id`
- RLS no Supabase garante isolamento

---

## 8. Embrapa AGROFIT — Fluxo de Token

```
1. App (ou edge function) faz POST para:
   https://api.cnptia.embrapa.br/token
   Body: grant_type=client_credentials
   Header: Authorization: Basic base64(consumer_key:consumer_secret)

2. Recebe access_token (ex: 99b74b4d-202e-34d9-a7b2-339e59262ca9)

3. Usa token em requests:
   GET https://api.cnptia.embrapa.br/agrofit/v1/pragas
   Header: Authorization: Bearer {access_token}

4. Token expira → repetir passo 1
```

> **Segurança:** consumer_key e consumer_secret ficam no `.env` SEM prefixo `EXPO_PUBLIC_` (não vão para o app). O ideal é chamar a Embrapa via **Supabase Edge Function** que tem acesso aos secrets do servidor.

---

## 9. Variáveis de Ambiente (.env)

```bash
# OpenAI
OPENAI_API_KEY=sk-proj-...

# Supabase
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_...

# Database
DATABASE_URL=postgresql://...

# Embrapa AGROFIT
EXPO_PUBLIC_AGROFIT_API_URL=https://api.cnptia.embrapa.br/agrofit/v1
EXPO_PUBLIC_EMBRAPA_CALLBACK_URL=agritech://embrapa/callback
EMBRAPA_TOKEN_URL=https://api.cnptia.embrapa.br/token
EMBRAPA_CONSUMER_KEY=xP8K7E...
EMBRAPA_CONSUMER_SECRET=CtDfDC...
EMBRAPA_ACCESS_TOKEN=99b74b4d-...
```

Prefixo `EXPO_PUBLIC_` = acessível no app (client-side).
Sem prefixo = só no servidor/edge function.

---

## 10. Decisões Arquiteturais

| Decisão | Justificativa |
|---------|--------------|
| Supabase ao invés de backend custom | Auth, DB, RLS, realtime, storage integrados. Sem servidor para manter. |
| SQLite para offline | expo-sqlite nativo, rápido, sem dependências externas |
| Zustand ao invés de Context API | Performance (sem re-renders cascata), API simples, middleware de persistência |
| Embrapa como fonte de referência | Dados oficiais do governo, gratuitos, atualizados |
| OpenAI Vision para identificação | Melhor accuracy para imagens agrícolas, API simples |
| Expo Router (file-based) | Padrão Expo, navegação declarativa, deep linking |
| Zod para validação | Type-safe, runtime validation, integra com TypeScript |
| RLS no Supabase | Segurança multi-tenant no nível do banco, sem depender do app |
