# Guia Técnico de Implementação - Refatoração Agrov Mobile

## 📋 Visão Geral

Documentação técnica detalhada para implementação da refatoração arquitetural do aplicativo Agrov Mobile. Este documento descreve cada passo e task necessária para transformar a arquitetura atual em uma solução robusta, escalável e confiável.

**Objetivo:** Implementar arquitetura modular com Zustand, SQLite, sincronização offline robusta e geolocalização funcional.

---

## Passo 1: Preparação e Estruturação do Projeto

### Task 1.1: Instalação e Verificação de Dependências

**Objetivo:** Garantir que todas as dependências necessárias estejam instaladas e nas versões corretas.

**Ações:**
- Instalar `zustand` versão `^4.4.0` via Bun
- Instalar `zod` versão `^3.22.0` via Bun
- Instalar `expo-sqlite` versão `~14.0.0` via Bun
- Verificar se `expo-location` versão `~19.0.5` está instalado (já existe, apenas implementar)
- Verificar compatibilidade de `@react-native-community/netinfo` para detecção de conexão
- Validar que todas as dependências existentes são compatíveis com Expo SDK ~54.0.20
- Verificar TypeScript versão ~5.9.2 e garantir strict mode habilitado

**Validação:**
- Executar `bun install` e verificar ausência de conflitos
- Verificar `package.json` para confirmar versões exatas
- Validar que não há dependências duplicadas ou conflitantes

---

### Task 1.2: Estruturação Modular de Diretórios

**Objetivo:** Criar arquitetura modular separada por features, seguindo princípios de baixo acoplamento e alta coesão.

**Estrutura a Criar:**

```
src/
├── features/
│   ├── auth/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── atividades/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── scout/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   └── sync/
│       ├── components/
│       ├── hooks/
│       └── types.ts
├── stores/
│   ├── authStore.ts
│   ├── atividadesStore.ts
│   ├── scoutStore.ts
│   └── syncStore.ts
├── services/
│   ├── locationService.ts
│   ├── syncService.ts
│   ├── logger.ts
│   └── apiService.ts
├── repositories/
│   ├── atividadeRepository.ts
│   ├── scoutRepository.ts
│   ├── pragaRepository.ts
│   ├── unidadeFenologicaRepository.ts
│   ├── limiarRepository.ts
│   └── syncQueueRepository.ts
├── database/
│   ├── db.ts
│   ├── schema.ts
│   └── migrations/
│       └── 001_initial_schema.ts
├── hooks/
│   ├── useLocation.ts
│   ├── useSync.ts
│   └── useOffline.ts
├── components/
│   └── shared/
│       ├── Button.tsx
│       ├── Input.tsx
│       └── Loading.tsx
├── types/
│   ├── entities.ts
│   ├── api.ts
│   └── store.ts
└── utils/
    ├── validation.ts
    ├── constants.ts
    └── helpers.ts
```

**Ações:**
- Criar todos os diretórios listados acima
- Mover componentes existentes para `src/components/shared/` ou para suas respectivas features
- Mover hooks existentes para `src/hooks/` ou para suas respectivas features
- Mover services existentes para `src/services/`
- Organizar types em `src/types/` com separação por domínio
- Atualizar todos os imports relativos para usar path aliases (`@/`)

**Validação:**
- Verificar que não há imports quebrados após reorganização
- Validar que path aliases estão configurados corretamente no `tsconfig.json`
- Garantir que cada feature é auto-contida (não depende de outras features diretamente)

---

### Task 1.3: Configuração de Path Aliases

**Objetivo:** Configurar aliases de importação para facilitar imports absolutos e melhorar manutenibilidade.

**Ações:**
- Atualizar `tsconfig.json` para incluir path alias `@/*` apontando para `src/*`
- Configurar Metro bundler para resolver os aliases (se necessário)
- Atualizar todos os imports relativos para usar aliases absolutos
- Garantir que imports de features usem `@/features/`, stores usem `@/stores/`, etc.

**Validação:**
- Executar build e verificar ausência de erros de resolução de módulos
- Validar que todos os imports estão usando aliases consistentes

---

## Passo 2: Implementação de Gerenciamento de Estado com Zustand

### Task 2.1: Configuração Base do Zustand

**Objetivo:** Configurar Zustand como solução de gerenciamento de estado global, substituindo Context API.

**Ações:**
- Instalar e configurar Zustand DevTools para desenvolvimento
- Criar store base com middleware de persistência (usando AsyncStorage temporariamente, será migrado para SQLite)
- Configurar TypeScript strict para stores com type inference completo
- Implementar padrão de store modular (um store por domínio)

**Arquitetura de Store:**
- Cada store deve exportar hook customizado (ex: `useAuthStore`)
- Stores devem ter actions como métodos do store
- Implementar selectors granulares para evitar re-renders desnecessários
- Usar `subscribeWithSelector` middleware onde necessário para otimizações

**Validação:**
- Verificar que stores não causam re-renders em componentes que não usam dados alterados
- Validar type safety completo (zero tipos `any`)

---

### Task 2.2: Implementação do AuthStore

**Objetivo:** Criar store para gerenciamento de autenticação, substituindo AuthContext existente.

**Estado a Gerenciar:**
- `user`: objeto User ou null
- `token`: string JWT ou null
- `isAuthenticated`: boolean derivado de token !== null
- `loading`: boolean para estados de carregamento
- `error`: string | null para erros de autenticação

**Actions a Implementar:**
- `login(email: string, password: string)`: Promise<void>
  - Validar credenciais via API
  - Armazenar token e dados do usuário
  - Atualizar estado de autenticação
  - Tratar erros de rede e credenciais inválidas
  
- `logout()`: void
  - Limpar token e dados do usuário
  - Invalidar sessão no backend (se possível)
  - Resetar estado para não autenticado
  
- `refreshToken()`: Promise<void>
  - Renovar token JWT quando próximo de expirar
  - Atualizar token no estado e storage
  
- `checkAuth()`: Promise<void>
  - Verificar se token ainda é válido ao iniciar app
  - Restaurar sessão se token válido

**Persistência:**
- Usar middleware `persist` do Zustand
- Armazenar apenas token e dados essenciais do usuário
- Não persistir senhas ou dados sensíveis

**Validação:**
- Verificar que login/logout funcionam corretamente
- Validar que token é persistido e restaurado ao reiniciar app
- Garantir que erros são tratados adequadamente

---

### Task 2.3: Implementação do AtividadesStore

**Objetivo:** Criar store para gerenciamento de atividades, centralizando estado que atualmente está duplicado em múltiplos componentes.

**Estado a Gerenciar:**
- `atividades`: array de Atividade
- `loading`: boolean
- `error`: string | null
- `lastSync`: Date | null (timestamp da última sincronização)
- `filters`: objeto com filtros ativos (tipo, data, status)

**Actions a Implementar:**
- `fetchAtividades()`: Promise<void>
  - Buscar atividades da API quando online
  - Buscar do SQLite quando offline
  - Atualizar estado com dados obtidos
  
- `createAtividade(data: CreateAtividadeDTO)`: Promise<void>
  - Criar atividade localmente no SQLite
  - Adicionar à fila de sincronização
  - Atualizar estado otimisticamente
  - Tratar erros de validação
  
- `updateAtividade(id: string, data: UpdateAtividadeDTO)`: Promise<void>
  - Atualizar atividade no SQLite
  - Adicionar à fila de sincronização
  - Atualizar estado otimisticamente
  
- `deleteAtividade(id: string)`: Promise<void>
  - Marcar como deletado no SQLite
  - Adicionar à fila de sincronização
  - Remover do estado otimisticamente
  
- `setFilters(filters: FilterObject)`: void
  - Atualizar filtros ativos
  - Aplicar filtros aos dados em memória
  
- `clearFilters()`: void
  - Resetar filtros para estado inicial

**Selectors a Implementar:**
- `selectAtividades`: retorna atividades filtradas
- `selectAtividadeById`: retorna atividade específica por ID
- `selectLoading`: retorna estado de carregamento
- `selectError`: retorna erro atual

**Validação:**
- Verificar que CRUD funciona corretamente
- Validar que filtros são aplicados corretamente
- Garantir que estado é sincronizado entre componentes que usam o store

---

### Task 2.4: Implementação do ScoutStore

**Objetivo:** Criar store para gerenciamento de scouts e marcadores no mapa, integrando com geolocalização.

**Estado a Gerenciar:**
- `scouts`: array de Scout (marcadores no mapa)
- `currentLocation`: LocationObject | null (localização atual do usuário)
- `loading`: boolean
- `error`: string | null
- `mapRegion`: objeto com região do mapa (latitude, longitude, latitudeDelta, longitudeDelta)

**Actions a Implementar:**
- `fetchScouts()`: Promise<void>
  - Buscar scouts da API quando online
  - Buscar do SQLite quando offline
  - Atualizar estado e mapa
  
- `addScout(location: LocationObject, data: ScoutData)`: Promise<void>
  - Criar scout no SQLite com coordenadas GPS
  - Adicionar à fila de sincronização
  - Atualizar estado e mapa otimisticamente
  - Validar precisão do GPS (máximo 20m)
  
- `updateScout(id: string, data: UpdateScoutDTO)`: Promise<void>
  - Atualizar scout no SQLite
  - Adicionar à fila de sincronização
  - Atualizar estado e mapa
  
- `deleteScout(id: string)`: Promise<void>
  - Marcar como deletado no SQLite
  - Adicionar à fila de sincronização
  - Remover do estado e mapa
  
- `setCurrentLocation(location: LocationObject)`: void
  - Atualizar localização atual do usuário
  - Atualizar região do mapa se necessário
  
- `setMapRegion(region: MapRegion)`: void
  - Atualizar região visível do mapa
  - Usado para controle de zoom e pan

**Selectors a Implementar:**
- `selectScoutsInRegion`: retorna scouts visíveis na região atual do mapa
- `selectScoutById`: retorna scout específico por ID
- `selectCurrentLocation`: retorna localização atual

**Validação:**
- Verificar que scouts são criados com coordenadas GPS corretas
- Validar que mapa é atualizado quando scouts são adicionados/removidos
- Garantir que localização atual é atualizada corretamente

---

### Task 2.5: Implementação do SyncStore

**Objetivo:** Criar store para gerenciamento do estado de sincronização, monitoramento da fila e status de sync.

**Estado a Gerenciar:**
- `isOnline`: boolean (derivado de NetInfo)
- `isSyncing`: boolean (indica se sync está em progresso)
- `pendingCount`: number (quantidade de itens pendentes na fila)
- `failedCount`: number (quantidade de itens que falharam)
- `lastSyncTime`: Date | null
- `syncProgress`: number (0-100) para indicar progresso

**Actions a Implementar:**
- `setOnlineStatus(isOnline: boolean)`: void
  - Atualizar status de conexão
  - Disparar sincronização automática quando voltar online
  
- `startSync()`: Promise<void>
  - Iniciar processo de sincronização
  - Processar fila de itens pendentes
  - Atualizar progresso
  
- `stopSync()`: void
  - Parar processo de sincronização
  - Limpar estado de progresso
  
- `updateSyncStatus(status: SyncStatus)`: void
  - Atualizar contadores de pendentes/falhados
  - Atualizar timestamp da última sincronização
  - Atualizar progresso

**Selectors a Implementar:**
- `selectSyncStatus`: retorna objeto com status completo de sincronização
- `selectIsOnline`: retorna status de conexão
- `selectHasPendingItems`: retorna boolean indicando se há itens pendentes

**Validação:**
- Verificar que status de conexão é atualizado corretamente
- Validar que sincronização é disparada automaticamente quando volta online
- Garantir que progresso é atualizado durante sync

---

### Task 2.6: Migração de Estado do Context API para Zustand

**Objetivo:** Substituir completamente Context API por Zustand, removendo dependências do sistema antigo.

**Ações:**
- Identificar todos os usos de `useContext` no código
- Mapear cada contexto para store correspondente
- Substituir `useContext(AuthContext)` por `useAuthStore()`
- Substituir `useState` que gerencia estado global por stores apropriados
- Remover arquivo `AuthContext.tsx` após migração completa
- Atualizar `_layout.tsx` para remover providers de contexto
- Verificar que não há mais imports de contextos

**Estratégia de Migração:**
- Migrar feature por feature (auth primeiro, depois atividades, depois scout)
- Testar cada migração antes de prosseguir
- Manter Context API funcionando em paralelo durante migração
- Remover Context API apenas após validação completa

**Validação:**
- Verificar que não há mais usos de Context API
- Validar que todos os componentes funcionam corretamente com Zustand
- Garantir que não há regressões de funcionalidade

---

## Passo 3: Implementação de Persistência com Expo SQLite

### Task 3.1: Design do Schema do Banco de Dados

**Objetivo:** Criar schema normalizado e otimizado para todas as entidades do aplicativo.

**Entidades a Modelar:**

**Tabela: atividades**
- `id`: TEXT PRIMARY KEY (UUID)
- `nome`: TEXT NOT NULL
- `descricao`: TEXT
- `tipo`: TEXT
- `status`: TEXT
- `data_inicio`: TEXT (ISO 8601)
- `data_fim`: TEXT (ISO 8601)
- `created_at`: TEXT NOT NULL (ISO 8601)
- `updated_at`: TEXT NOT NULL (ISO 8601)
- `synced`: INTEGER DEFAULT 0 (0 = não sincronizado, 1 = sincronizado)
- `deleted_at`: TEXT (soft delete, ISO 8601 ou NULL)

**Tabela: scouts**
- `id`: TEXT PRIMARY KEY (UUID)
- `latitude`: REAL NOT NULL
- `longitude`: REAL NOT NULL
- `accuracy`: REAL (precisão do GPS em metros)
- `altitude`: REAL
- `heading`: REAL
- `speed`: REAL
- `created_at`: TEXT NOT NULL (ISO 8601)
- `updated_at`: TEXT NOT NULL (ISO 8601)
- `synced`: INTEGER DEFAULT 0
- `deleted_at`: TEXT

**Tabela: pragas**
- `id`: TEXT PRIMARY KEY (UUID)
- `scout_id`: TEXT NOT NULL (FOREIGN KEY para scouts)
- `nome`: TEXT NOT NULL
- `quantidade`: INTEGER
- `severidade`: TEXT
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL
- `synced`: INTEGER DEFAULT 0
- `deleted_at`: TEXT

**Tabela: unidades_fenologicas**
- `id`: TEXT PRIMARY KEY (UUID)
- `nome`: TEXT NOT NULL
- `codigo`: TEXT UNIQUE
- `descricao`: TEXT
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL
- `synced`: INTEGER DEFAULT 0

**Tabela: limiares**
- `id`: TEXT PRIMARY KEY (UUID)
- `unidade_fenologica_id`: TEXT NOT NULL (FOREIGN KEY)
- `praga_id`: TEXT NOT NULL (FOREIGN KEY)
- `valor_minimo`: REAL
- `valor_maximo`: REAL
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL
- `synced`: INTEGER DEFAULT 0

**Tabela: sync_queue**
- `id`: TEXT PRIMARY KEY (UUID)
- `entity_type`: TEXT NOT NULL ('atividade', 'scout', 'praga', etc.)
- `entity_id`: TEXT NOT NULL
- `operation`: TEXT NOT NULL ('CREATE', 'UPDATE', 'DELETE')
- `payload`: TEXT NOT NULL (JSON serializado)
- `retry_count`: INTEGER DEFAULT 0
- `max_retries`: INTEGER DEFAULT 5
- `status`: TEXT NOT NULL ('PENDING', 'PROCESSING', 'FAILED', 'COMPLETED')
- `error_message`: TEXT
- `created_at`: TEXT NOT NULL
- `updated_at`: TEXT NOT NULL
- `next_retry_at`: TEXT (timestamp para retry com backoff)

**Índices a Criar:**
- `idx_atividades_updated_at` em `atividades(updated_at)`
- `idx_atividades_synced` em `atividades(synced)`
- `idx_scouts_updated_at` em `scouts(updated_at)`
- `idx_scouts_synced` em `scouts(synced)`
- `idx_sync_queue_status` em `sync_queue(status)`
- `idx_sync_queue_next_retry` em `sync_queue(next_retry_at)`
- `idx_pragas_scout_id` em `pragas(scout_id)`

**Validação:**
- Verificar que schema suporta todas as operações necessárias
- Validar que índices cobrem todas as queries frequentes
- Garantir que foreign keys estão corretamente definidas

---

### Task 3.2: Implementação do Database Service

**Objetivo:** Criar serviço centralizado para gerenciamento da conexão com SQLite.

**Funcionalidades:**
- Abrir conexão com banco de dados SQLite
- Executar migrations na primeira abertura
- Gerenciar pool de conexões (se necessário)
- Fechar conexão adequadamente
- Tratar erros de abertura/criação do banco

**Ações:**
- Criar função `getDatabase()` que retorna instância única do banco
- Implementar singleton pattern para garantir uma única conexão
- Criar função `initializeDatabase()` que executa schema inicial
- Implementar tratamento de erros para falhas de abertura
- Adicionar logging para operações de database

**Validação:**
- Verificar que banco é criado corretamente na primeira execução
- Validar que migrations são executadas na ordem correta
- Garantir que não há vazamentos de conexão

---

### Task 3.3: Implementação do Sistema de Migrations

**Objetivo:** Criar sistema versionado de migrations para evolução do schema.

**Funcionalidades:**
- Tabela `schema_migrations` para rastrear versões aplicadas
- Executar migrations em ordem sequencial
- Rollback em caso de falha
- Validação de integridade após cada migration

**Ações:**
- Criar tabela `schema_migrations` com campos `version` e `applied_at`
- Implementar função `runMigrations()` que verifica versão atual e aplica novas
- Criar migration inicial `001_initial_schema.ts` com todas as tabelas
- Implementar rollback automático se migration falhar
- Adicionar validação de schema após cada migration

**Validação:**
- Verificar que migrations são aplicadas corretamente
- Validar que rollback funciona em caso de erro
- Garantir que schema está consistente após migrations

---

### Task 3.4: Implementação de Repositories

**Objetivo:** Criar camada de abstração entre stores e banco de dados usando Repository pattern.

**Repositories a Implementar:**

**AtividadeRepository:**
- `findAll(filters?: FilterOptions): Promise<Atividade[]>`
- `findById(id: string): Promise<Atividade | null>`
- `create(data: CreateAtividadeDTO): Promise<Atividade>`
- `update(id: string, data: UpdateAtividadeDTO): Promise<Atividade>`
- `delete(id: string): Promise<void>`
- `findUnsynced(): Promise<Atividade[]>`
- `markAsSynced(id: string): Promise<void>`

**ScoutRepository:**
- `findAll(filters?: FilterOptions): Promise<Scout[]>`
- `findById(id: string): Promise<Scout | null>`
- `create(data: CreateScoutDTO): Promise<Scout>`
- `update(id: string, data: UpdateScoutDTO): Promise<Scout>`
- `delete(id: string): Promise<void>`
- `findUnsynced(): Promise<Scout[]>`
- `markAsSynced(id: string): Promise<void>`
- `findByRegion(region: MapRegion): Promise<Scout[]>` (para otimização de mapa)

**PragaRepository, UnidadeFenologicaRepository, LimiarRepository:**
- Implementar CRUD completo similar aos acima
- Métodos específicos conforme necessidade de cada entidade

**SyncQueueRepository:**
- `add(item: SyncQueueItem): Promise<void>`
- `getPending(limit?: number): Promise<SyncQueueItem[]>`
- `getFailed(): Promise<SyncQueueItem[]>`
- `updateStatus(id: string, status: SyncStatus, error?: string): Promise<void>`
- `incrementRetry(id: string): Promise<void>`
- `remove(id: string): Promise<void>`
- `getNextRetryItems(): Promise<SyncQueueItem[]>` (para retry com backoff)

**Padrões a Seguir:**
- Todas as operações devem usar transações quando necessário
- Prepared statements para prevenir SQL injection
- Tratamento de erros consistente
- Logging de operações críticas
- Validação de dados antes de inserir/atualizar

**Validação:**
- Verificar que todos os métodos funcionam corretamente
- Validar que transações são usadas adequadamente
- Garantir que prepared statements estão sendo usados
- Testar performance de queries com índices

---

## Passo 4: Implementação de Geolocalização

### Task 4.1: Criação do Location Service

**Objetivo:** Criar serviço centralizado para todas as operações de geolocalização.

**Funcionalidades a Implementar:**

**Solicitação de Permissões:**
- `requestLocationPermission()`: Promise<boolean>
  - Verificar status atual de permissão
  - Solicitar permissão se não concedida
  - Retornar true se concedida, false caso contrário
  - Tratar casos de permissão negada permanentemente
  - Fornecer feedback ao usuário sobre necessidade da permissão

**Captura de Localização:**
- `getCurrentLocation(options?: LocationOptions)`: Promise<LocationObject>
  - Verificar permissão antes de capturar
  - Usar `LocationAccuracy.Balanced` como padrão
  - Validar precisão do GPS (máximo 20 metros)
  - Implementar retry automático se precisão insuficiente (máximo 3 tentativas)
  - Usar `LocationAccuracy.Highest` no último retry se necessário
  - Retornar erro se precisão não atingir threshold após retries
  - Timeout de 30 segundos para evitar travamento

**Validação de Precisão:**
- Verificar que `coords.accuracy <= 20` (metros)
- Se precisão insuficiente, tentar novamente com accuracy maior
- Se após 3 tentativas ainda insuficiente, retornar erro informativo
- Logar precisão obtida para debugging

**Tratamento de Erros:**
- Permissão negada: retornar erro específico com mensagem amigável
- GPS desabilitado: detectar e informar usuário
- Timeout: retornar erro após 30 segundos
- Precisão insuficiente: retornar erro após 3 tentativas
- Erro de rede (se usar network location): fallback para GPS apenas

**Validação:**
- Testar em diferentes condições (interior, exterior, movimento)
- Verificar que permissões são solicitadas corretamente
- Validar que precisão é verificada adequadamente
- Garantir que erros são tratados e comunicados ao usuário

---

### Task 4.2: Criação do Hook useLocation

**Objetivo:** Criar hook React para facilitar uso de geolocalização em componentes.

**Estado a Gerenciar:**
- `loading`: boolean (indica se captura está em progresso)
- `error`: string | null (mensagem de erro se houver)
- `location`: LocationObject | null (última localização capturada)

**Funcionalidades:**
- `captureLocation()`: Promise<void>
  - Chamar `getCurrentLocation()` do service
  - Atualizar estado de loading durante captura
  - Atualizar estado de location em caso de sucesso
  - Atualizar estado de error em caso de falha
  - Integrar com `scoutStore` para salvar automaticamente

**Validação:**
- Verificar que hook funciona corretamente em componentes
- Validar que estados são atualizados adequadamente
- Garantir que erros são propagados corretamente

---

### Task 4.3: Integração com Tela de Scout

**Objetivo:** Integrar captura de GPS na tela de scout para permitir criação de marcadores.

**Ações:**
- Adicionar botão "Capturar Localização" na tela de scout
- Conectar botão ao hook `useLocation`
- Exibir loading durante captura
- Exibir erro se captura falhar
- Atualizar mapa com nova localização após captura bem-sucedida
- Criar marcador no mapa na localização capturada
- Permitir adicionar dados adicionais (praga, unidade fenológica) após captura

**Fluxo:**
1. Usuário clica em "Capturar Localização"
2. Verificar permissão (solicitar se necessário)
3. Exibir indicador de loading
4. Capturar GPS com validação de precisão
5. Se sucesso: criar scout no store e atualizar mapa
6. Se erro: exibir mensagem de erro ao usuário
7. Abrir formulário para adicionar dados do scout

**Validação:**
- Verificar que botão funciona corretamente
- Validar que mapa é atualizado após captura
- Garantir que formulário é aberto após captura bem-sucedida
- Testar em diferentes condições de GPS

---

## Passo 5: Implementação de Sincronização Offline

### Task 5.1: Implementação da Fila de Sincronização

**Objetivo:** Criar sistema de fila para gerenciar operações pendentes de sincronização.

**Funcionalidades:**

**Adição à Fila:**
- Quando operação CRUD é realizada offline, adicionar à fila automaticamente
- Serializar payload completo da operação em JSON
- Marcar status como 'PENDING'
- Definir `next_retry_at` como null inicialmente
- Criar timestamp de criação

**Processamento da Fila:**
- Buscar itens com status 'PENDING' ordenados por `created_at`
- Processar itens em lote (máximo 10 por vez para evitar sobrecarga)
- Atualizar status para 'PROCESSING' antes de processar
- Após processamento, atualizar status para 'COMPLETED' ou 'FAILED'

**Priorização:**
- Processar itens mais antigos primeiro (FIFO)
- Considerar prioridade se implementada (campo opcional)
- Processar CREATE antes de UPDATE/DELETE quando possível

**Validação:**
- Verificar que itens são adicionados à fila corretamente
- Validar que processamento segue ordem FIFO
- Garantir que status é atualizado corretamente

---

### Task 5.2: Implementação de Retry com Exponential Backoff

**Objetivo:** Implementar sistema de retry automático com backoff exponencial para operações que falham.

**Algoritmo de Backoff:**
- Fórmula: `delay = baseDelay * 2^retryCount`
- `baseDelay`: 1000ms (1 segundo)
- `maxRetries`: 5 tentativas
- `maxDelay`: 30000ms (30 segundos) - cap no delay máximo

**Funcionalidades:**

**Cálculo de Delay:**
- Primeira retry: 1 segundo
- Segunda retry: 2 segundos
- Terceira retry: 4 segundos
- Quarta retry: 8 segundos
- Quinta retry: 16 segundos
- Se exceder maxDelay, usar maxDelay

**Agendamento de Retry:**
- Ao falhar, calcular `next_retry_at = now + delay`
- Incrementar `retry_count`
- Atualizar status para 'PENDING' novamente
- Não processar item até `next_retry_at` ser atingido

**Processamento de Retry:**
- Ao processar fila, verificar `next_retry_at`
- Processar apenas itens onde `next_retry_at <= now`
- Se `retry_count >= maxRetries`, marcar como 'FAILED' permanentemente
- Logar tentativas de retry para debugging

**Validação:**
- Verificar que delays são calculados corretamente
- Validar que retries são agendados adequadamente
- Garantir que itens não são processados antes do tempo
- Testar cenário de múltiplas falhas seguidas

---

### Task 5.3: Resolução de Conflitos (Last-Write-Wins)

**Objetivo:** Implementar estratégia de resolução de conflitos quando servidor retorna 409 Conflict.

**Estratégia Last-Write-Wins:**
- Comparar `updated_at` do item local com `updated_at` do servidor
- Se local é mais recente: sobrescrever servidor (PUT com force)
- Se servidor é mais recente: descartar mudança local e atualizar com dados do servidor
- Se timestamps são iguais: tratar como sucesso (já sincronizado)

**Fluxo de Resolução:**
1. Receber resposta 409 Conflict da API
2. Fazer GET do item no servidor para obter `updated_at` do servidor
3. Comparar timestamps
4. Se local mais recente: fazer PUT com `force: true` (se API suportar) ou DELETE + CREATE
5. Se servidor mais recente: atualizar item local com dados do servidor e marcar como sincronizado
6. Remover da fila após resolução

**Tratamento de Erros:**
- Se GET falhar durante resolução: incrementar retry e tentar novamente
- Se PUT/DELETE falhar após resolução: incrementar retry
- Se após 3 tentativas de resolução ainda falhar: marcar como FAILED

**Validação:**
- Testar cenário de conflito simulado
- Verificar que timestamps são comparados corretamente
- Validar que dados são atualizados adequadamente após resolução
- Garantir que fila é limpa após resolução bem-sucedida

---

### Task 5.4: Sincronização Incremental

**Objetivo:** Implementar sincronização incremental usando `lastSync` para evitar transferir dados desnecessários.

**Funcionalidades:**

**Rastreamento de LastSync:**
- Armazenar timestamp da última sincronização bem-sucedida em `syncStore`
- Persistir `lastSync` no SQLite ou AsyncStorage
- Atualizar `lastSync` após cada sincronização bem-sucedida

**Sincronização Incremental:**
- Ao sincronizar, enviar parâmetro `?since=lastSync` para API
- API retorna apenas itens modificados desde `lastSync`
- Atualizar apenas itens que mudaram no banco local
- Se `lastSync` é null, fazer sincronização completa

**Sincronização Bidirecional:**
- Enviar itens locais não sincronizados para servidor (fila)
- Receber itens do servidor modificados desde `lastSync`
- Resolver conflitos se necessário
- Atualizar `lastSync` após sincronização completa

**Validação:**
- Verificar que apenas dados novos/modificados são transferidos
- Validar que `lastSync` é atualizado corretamente
- Garantir que sincronização completa funciona quando `lastSync` é null

---

### Task 5.5: Detecção de Conexão e Sincronização Automática

**Objetivo:** Implementar detecção de mudanças de conexão e disparar sincronização automaticamente.

**Funcionalidades:**

**Monitoramento de Conexão:**
- Usar `@react-native-community/netinfo` para monitorar conexão
- Atualizar `syncStore.isOnline` quando conexão muda
- Escutar eventos de mudança de conexão

**Sincronização Automática:**
- Quando conexão volta (offline → online): disparar `processSyncQueue()` automaticamente
- Quando app inicia e está online: verificar fila e sincronizar se houver itens pendentes
- Sincronizar periodicamente quando online (a cada 5 minutos, opcional)

**Otimizações:**
- Não sincronizar se já está sincronizando
- Não sincronizar se fila está vazia
- Debounce de eventos de conexão para evitar múltiplas sincronizações

**Validação:**
- Testar mudança de offline para online
- Verificar que sincronização é disparada automaticamente
- Validar que não há sincronizações duplicadas
- Garantir que funciona ao iniciar app com conexão

---

## Passo 6: Sistema de Logging Estruturado

### Task 6.1: Implementação do Logger Service

**Objetivo:** Substituir todos os `console.log` por sistema de logging estruturado e profissional.

**Funcionalidades:**

**Níveis de Log:**
- `debug`: informações detalhadas para desenvolvimento
- `info`: informações gerais de operação
- `warn`: avisos que não impedem funcionamento
- `error`: erros que impedem operação

**Estrutura de Log:**
- Timestamp ISO 8601
- Nível de log
- Mensagem descritiva
- Contexto opcional (objeto com dados relevantes)
- Stack trace para erros

**Filtragem por Ambiente:**
- Em desenvolvimento (`__DEV__`): logar todos os níveis
- Em produção: logar apenas `warn` e `error`
- Configurável via variável de ambiente

**Sanitização de Dados Sensíveis:**
- Remover automaticamente: `password`, `token`, `auth`, `secret`, `key`
- Não logar dados de cartão de crédito
- Mascarar dados sensíveis se necessário logar

**Integração com Serviço de Logging (Futuro):**
- Estrutura preparada para enviar logs para serviço externo
- Buffer de logs para envio em lote
- Retry automático se envio falhar

**Validação:**
- Verificar que todos os níveis funcionam corretamente
- Validar que dados sensíveis são removidos
- Garantir que logs são formatados adequadamente

---

### Task 6.2: Substituição de console.log

**Objetivo:** Encontrar e substituir todos os `console.log`, `console.error`, `console.warn` por logger estruturado.

**Ações:**
- Buscar todos os usos de `console.*` no código
- Categorizar por nível apropriado (debug/info/warn/error)
- Substituir `console.log` por `logger.debug` ou `logger.info`
- Substituir `console.error` por `logger.error`
- Substituir `console.warn` por `logger.warn`
- Adicionar contexto relevante quando disponível
- Remover logs de debug desnecessários

**Validação:**
- Verificar que não há mais `console.*` no código
- Validar que logs são úteis e informativos
- Garantir que não há logs excessivos

---

## Passo 7: Validação com Zod

### Task 7.1: Criação de Schemas de Validação

**Objetivo:** Criar schemas Zod para todas as entidades e DTOs do aplicativo.

**Schemas a Criar:**

**AtividadeSchema:**
- `nome`: string, mínimo 1 caractere, obrigatório
- `descricao`: string, opcional
- `tipo`: string, enum com valores válidos
- `status`: string, enum com valores válidos
- `data_inicio`: string, formato ISO 8601, opcional
- `data_fim`: string, formato ISO 8601, opcional, deve ser após `data_inicio` se ambos presentes

**ScoutSchema:**
- `latitude`: number, entre -90 e 90, obrigatório
- `longitude`: number, entre -180 e 180, obrigatório
- `accuracy`: number, positivo, opcional
- `altitude`: number, opcional
- `heading`: number, entre 0 e 360, opcional
- `speed`: number, positivo, opcional

**PragaSchema:**
- `nome`: string, mínimo 1 caractere, obrigatório
- `quantidade`: number, inteiro positivo, obrigatório
- `severidade`: string, enum com valores válidos, obrigatório
- `scout_id`: string, UUID válido, obrigatório

**Schemas de API:**
- `LoginRequestSchema`: email e password
- `CreateAtividadeRequestSchema`: dados para criar atividade
- `UpdateAtividadeRequestSchema`: dados para atualizar (todos opcionais exceto id)
- Schemas de resposta da API

**Validação:**
- Verificar que todos os schemas estão corretos
- Validar que tipos inferidos estão corretos
- Garantir que mensagens de erro são claras

---

### Task 7.2: Integração em Formulários

**Objetivo:** Integrar validação Zod em todos os formulários do aplicativo.

**Ações:**
- Identificar todos os formulários no app
- Aplicar schema correspondente em cada formulário
- Validar dados antes de submeter
- Exibir mensagens de erro de validação ao usuário
- Prevenir submissão se validação falhar

**Fluxo de Validação:**
1. Usuário preenche formulário
2. Ao submeter, validar com schema Zod
3. Se válido: prosseguir com submissão
4. Se inválido: exibir erros específicos por campo
5. Destacar campos com erro visualmente

**Validação:**
- Testar cada formulário com dados válidos e inválidos
- Verificar que mensagens de erro são claras
- Garantir que validação previne submissão inválida

---

### Task 7.3: Validação de Payloads de API

**Objetivo:** Validar todos os dados recebidos e enviados para API com Zod.

**Ações:**
- Validar payloads de requisições antes de enviar
- Validar respostas da API ao receber
- Tratar erros de validação adequadamente
- Logar erros de validação para debugging

**Validação:**
- Verificar que payloads inválidos são rejeitados
- Validar que respostas inválidas são tratadas
- Garantir que app não quebra com dados inesperados

---

## Passo 8: Eliminação de Tipos `any`

### Task 8.1: Identificação de Tipos `any`

**Objetivo:** Encontrar todos os usos de `any` no código e categorizar por criticidade.

**Ações:**
- Buscar todos os `any` no código TypeScript
- Categorizar: crítico (afeta funcionalidade) vs não-crítico
- Priorizar eliminação de tipos críticos
- Documentar casos onde `any` é necessário temporariamente

**Validação:**
- Lista completa de todos os `any` encontrados
- Priorização clara de quais eliminar primeiro

---

### Task 8.2: Criação de Tipos Específicos

**Objetivo:** Criar tipos TypeScript específicos para substituir `any`.

**Ações:**
- Criar interfaces para todas as entidades
- Criar types para DTOs de API
- Criar types para props de componentes
- Criar types para estados de stores
- Usar generics quando apropriado
- Usar union types quando valores são limitados

**Validação:**
- Verificar que tipos cobrem todos os casos
- Validar que type inference funciona corretamente
- Garantir que não há erros de tipo

---

### Task 8.3: Substituição Gradual

**Objetivo:** Substituir `any` por tipos específicos, feature por feature.

**Estratégia:**
- Começar por stores (mais crítico)
- Depois repositories
- Depois services
- Por último componentes (menos crítico)

**Validação:**
- Verificar que cada substituição não quebra código
- Validar que type safety melhorou
- Garantir que não há regressões

---

## Passo 9: Testes e Validação

### Task 9.1: Testes Manuais - Funcionalidades Core

**Checklist de Testes:**

**Autenticação:**
- [ ] Login com credenciais válidas
- [ ] Login com credenciais inválidas
- [ ] Logout
- [ ] Restauração de sessão ao reiniciar app
- [ ] Expiração de token

**Geolocalização:**
- [ ] Solicitação de permissão
- [ ] Captura de GPS com precisão adequada
- [ ] Retry quando precisão insuficiente
- [ ] Tratamento de permissão negada
- [ ] Criação de scout com GPS

**CRUD de Atividades:**
- [ ] Criar atividade online
- [ ] Criar atividade offline
- [ ] Editar atividade
- [ ] Deletar atividade
- [ ] Listar atividades com filtros

**Sincronização:**
- [ ] Criar dados offline
- [ ] Verificar que aparecem na fila
- [ ] Conectar à internet
- [ ] Verificar sincronização automática
- [ ] Validar dados no backend após sync
- [ ] Testar retry em caso de falha
- [ ] Testar resolução de conflitos

**Validação:**
- Todos os itens do checklist devem passar
- Documentar bugs encontrados
- Priorizar correção de bugs críticos

---

### Task 9.2: Testes de Performance

**Métricas a Validar:**
- Tempo de carregamento inicial do app
- Tempo de sincronização de 100 registros (< 5 segundos)
- Tempo de queries SQLite (< 100ms)
- Redução de re-renders (~40% conforme métrica)
- Uso de memória com muitos dados

**Ações:**
- Medir métricas antes e depois da refatoração
- Identificar gargalos de performance
- Otimizar queries lentas
- Otimizar re-renders desnecessários

**Validação:**
- Todas as métricas devem estar dentro dos targets
- Performance deve ser melhor ou igual à versão anterior

---

### Task 9.3: Testes em Dispositivos Reais

**Dispositivos a Testar:**
- Android (mínimo 2 dispositivos diferentes)
- iOS (mínimo 2 dispositivos diferentes)
- Diferentes versões de OS
- Diferentes condições de rede

**Cenários a Testar:**
- App em background durante sync
- App fechado e reaberto
- Mudança de rede durante uso
- GPS em diferentes condições (interior/exterior)

**Validação:**
- App deve funcionar em todos os dispositivos testados
- Não deve haver crashes
- Performance deve ser aceitável em todos

---

## Passo 10: Documentação Final

### Task 10.1: Documentação de Arquitetura

**Conteúdo:**
- Diagrama de arquitetura geral
- Descrição de cada camada (Presentation, Business Logic, Data)
- Fluxo de dados entre camadas
- Decisões arquiteturais e justificativas

**Validação:**
- Documentação deve ser clara e completa
- Diagramas devem estar atualizados

---

### Task 10.2: Documentação de Stores

**Conteúdo para cada store:**
- Estado gerenciado
- Actions disponíveis e suas assinaturas
- Selectors disponíveis
- Como usar o store em componentes
- Exemplos de uso

**Validação:**
- Todos os stores devem estar documentados
- Exemplos devem ser funcionais

---

### Task 10.3: Documentação de APIs e Serviços

**Conteúdo:**
- Endpoints da API usados
- Formatos de request/response
- Tratamento de erros
- Autenticação
- Rate limiting (se aplicável)

**Validação:**
- Todas as APIs devem estar documentadas
- Exemplos de request/response devem estar incluídos

---

### Task 10.4: Guia de Manutenção

**Conteúdo:**
- Como adicionar nova feature
- Como adicionar nova store
- Como adicionar nova tabela SQLite
- Como adicionar nova migration
- Como debugar sincronização
- Como debugar problemas de performance
- Convenções de código
- Padrões a seguir

**Validação:**
- Guia deve ser prático e útil
- Exemplos devem ser claros

---

## ✅ Checklist Final de Validação

### Funcionalidades
- [ ] Todas as funcionalidades core estão implementadas
- [ ] Geolocalização funciona corretamente
- [ ] Sincronização offline é robusta
- [ ] CRUD funciona online e offline
- [ ] Autenticação funciona corretamente

### Qualidade
- [ ] Zero tipos `any` críticos
- [ ] Todos os `console.log` substituídos por logger
- [ ] Validação Zod em todos os formulários
- [ ] Tratamento de erros adequado
- [ ] Logging estruturado funcionando

### Performance
- [ ] Redução de ~40% em re-renders
- [ ] Sincronização < 5s para 100 registros
- [ ] Queries SQLite < 100ms
- [ ] App carrega rapidamente

### Documentação
- [ ] Arquitetura documentada
- [ ] Stores documentados
- [ ] APIs documentadas
- [ ] Guia de manutenção completo

### Testes
- [ ] Testes manuais passaram
- [ ] Testes de performance passaram
- [ ] Testes em dispositivos reais passaram
- [ ] Não há bugs críticos conhecidos

---

**Última atualização:** 26/11/2025
