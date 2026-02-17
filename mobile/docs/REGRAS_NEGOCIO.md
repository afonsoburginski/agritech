# Regras de Negócio - Agrov Mobile

> Documento de referência para IA. Define O QUE o app faz e POR QUÊ.

---

## 1. Propósito do App

O **Agrov Mobile** é um app de campo para técnicos e produtores agrícolas. Funciona como extensão mobile do ERP AGROV. Permite:

- Registrar **atividades agrícolas** em talhões (aplicações, plantio, colheita, etc.)
- Fazer **monitoramento de pragas (scouting)** com GPS em pontos do talhão
- **Identificar pragas por foto** (IA via OpenAI Vision)
- Trabalhar **offline** e sincronizar quando houver rede

---

## 2. Entidades e Conceitos-Chave

### Hierarquia de negócio

```
Usuário
  └── pertence a N Fazendas (multi-tenant por fazenda)
        └── Fazenda tem N Talhões (parcelas de terra com polígono GPS)
              └── Talhão pertence a 1 Safra ativa
                    ├── Atividades (tarefas agrícolas)
                    └── Scouts (monitoramentos de praga)
```

### Entidades salvas no Supabase (regra de negócio)

| Entidade | Descrição |
|----------|-----------|
| **profiles** | Dados do usuário (nome, email, telefone, cpf). Estende auth.users |
| **fazendas** | Fazendas/propriedades (nome, cnpj, cidade, estado, area_total) |
| **user_fazendas** | Relação N:N entre usuários e fazendas |
| **talhoes** | Talhões da fazenda (nome, area, cultura_atual, polígono GPS, cor) |
| **safras** | Safras (nome, cultura, data_inicio, data_fim, ativa) |
| **atividades** | Atividades agrícolas (título, tipo, situação, prioridade, datas, custo) |
| **atividade_talhoes** | Relação N:N entre atividade e talhões |
| **atividade_produtos** | Produtos usados na atividade (nome, tipo, qtd, valor) |
| **atividade_maquinarios** | Maquinários usados (nome, tipo, horas, combustível) |
| **atividade_funcionarios** | Funcionários alocados (nome, cpf, horas, datas) |
| **scouts** | Sessões de monitoramento (nome, talhão, status, observação, estatísticas) |
| **scout_markers** | Pontos de monitoramento com GPS (lat, lng, visitado, data) |
| **scout_marker_pragas** | Contagem de praga num marcador (praga ref, contagem, presença, estádio, prioridade) |

### Dados que vêm da Embrapa (AGROFIT API) - NÃO salvos no Supabase

| Dado | Fonte | Uso no app |
|------|-------|------------|
| Catálogo de pragas | AGROFIT `/pragas` | Listagem para seleção ao registrar scout |
| Catálogo de plantas daninhas | AGROFIT `/plantasDaninhas` | Identificação no monitoramento |
| Catálogo de culturas | AGROFIT `/culturas` | Referência de culturas |
| Produtos formulados | AGROFIT `/produtosFormulados` | Recomendação de controle após identificar praga |

> **Princípio:** A Embrapa é fonte de verdade para dados de referência agronômica. O Supabase armazena apenas dados de negócio do usuário (atividades, scouts, fazendas).

---

## 3. Regras por Funcionalidade

### 3.1 Autenticação

- Login com email + senha via Supabase Auth
- JWT com claims: userId, fazendaId, email
- Token expira em 24h; refresh automático
- Ao logar, selecionar fazenda (se múltiplas disponíveis)
- Todas as operações são filtradas pela fazenda do token (multi-tenant)

### 3.2 Atividades Agrícolas

- **CRUD completo** com sincronização offline
- Campos obrigatórios: `titulo`, pelo menos 1 talhão
- Tipos: APLICACAO, PLANTIO, COLHEITA, PREPARO_SOLO, IRRIGACAO, etc.
- Situações: PENDENTE, EM_ANDAMENTO, CONCLUIDA, CANCELADA
- Prioridades: BAIXA, MEDIA, ALTA, URGENTE
- Etapas: PLANEJAMENTO, PREPARACAO, EXECUCAO, FINALIZACAO
- Cada atividade pode ter N produtos, N maquinários, N funcionários
- `custoAproximado` é calculado automaticamente (soma valorTotal dos produtos)
- `retirarEstoque` indica se deve debitar estoque no ERP
- Código gerado automaticamente: `ATV-YYYY-NNN`
- Soft delete (campo `deleted_at`) para sincronização
- Sincronização incremental via `lastSync` (só traz modificados)

### 3.3 Monitoramento de Pragas (Scout)

- **Fluxo:**
  1. Criar scout vinculado a 1 talhão
  2. Adicionar marcadores (pontos GPS no talhão)
  3. Visitar cada marcador e registrar pragas encontradas
  4. App calcula estatísticas automaticamente

- **Marcadores (scout_markers):**
  - Posição GPS (lat, lng) capturada no campo
  - Precisão GPS obrigatória <= 20 metros
  - Flag `visitado` marca se o ponto foi inspecionado
  - Cada marcador pode ter N pragas contadas

- **Contagem de pragas (scout_marker_pragas):**
  - Referencia uma praga (pelo ID/nome da Embrapa ou do ERP)
  - `contagem` = quantidade de indivíduos
  - `presenca` = boolean (encontrou ou não)
  - `estadio_fenologico` = estádio da cultura no ponto (ex: V3, R1)
  - `limiar_por_estadio` = tipo de limiar (ex: Larva, Adulto)
  - `unidade_fenologica` = unidade de medida (ex: Indivíduo/m²)
  - `prioridade` = BAIXA, MEDIA, ALTA (derivada do limiar)

- **Estatísticas calculadas:**
  - `total_markers` = total de pontos
  - `markers_visitados` = pontos já visitados
  - `total_pragas` = soma de todas as contagens
  - `percentual_infestacao` = (markers com praga / markers visitados) * 100

### 3.4 Reconhecimento de Praga por Foto

- Usuário tira foto de uma praga
- App envia para OpenAI Vision API
- Retorna identificação provável (nome comum, científico)
- Pode cruzar com catálogo da Embrapa para detalhes e recomendação de controle

### 3.5 Sincronização Offline

- **Offline-first:** todas as operações são salvas localmente (SQLite) primeiro
- Fila de sincronização (`sync_queue`) com operações pendentes
- Tipos de operação: CREATE, UPDATE, DELETE
- Retry com exponential backoff (1s, 2s, 4s, 8s, 16s; max 5 tentativas)
- Sincronização incremental: usa `lastSync` para pegar só mudanças
- Conflitos: estratégia Last-Write-Wins (comparar `updated_at`)
- Auto-sync quando volta online (detectado via NetInfo)
- A fila de sync é LOCAL (SQLite). O Supabase é o destino final.

---

## 4. Fluxo de Dados

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  App Mobile  │────>│   SQLite     │────>│   Supabase   │
│ (React Native)│    │  (offline)   │     │  (cloud DB)  │
└──────┬───────┘     └──────────────┘     └──────────────┘
       │                                         │
       │  Dados de referência                    │ Dados de negócio
       │  (read-only, cache local)               │ (CRUD, sync)
       ▼                                         │
┌──────────────┐                                 │
│ Embrapa API  │                                 │
│  (AGROFIT)   │                                 │
└──────────────┘                                 │
                                                 │
       ┌─────────────────────────────────────────┘
       │  Supabase Auth (JWT)
       │  Supabase Realtime (futuro)
       │  Supabase Storage (fotos, futuro)
```

### Quem provê o quê

| Dado | Fonte | Persistência |
|------|-------|-------------|
| Usuário, autenticação | Supabase Auth | Supabase |
| Fazendas, talhões, safras | Supabase | Supabase |
| Atividades (CRUD) | App → Supabase | Supabase + SQLite (cache) |
| Scouts, markers, contagens | App → Supabase | Supabase + SQLite (cache) |
| Catálogo de pragas | Embrapa AGROFIT | Cache local (SQLite/memória) |
| Catálogo de produtos | Embrapa AGROFIT | Cache local |
| Catálogo de culturas | Embrapa AGROFIT | Cache local |
| Identificação por foto | OpenAI Vision | Não persiste (resultado exibido) |

---

## 5. Enums e Valores Válidos

### Atividade

```
tipo: APLICACAO | PLANTIO | COLHEITA | PREPARO_SOLO | IRRIGACAO | ADUBACAO | MONITORAMENTO | OUTRO
situacao: PENDENTE | EM_ANDAMENTO | CONCLUIDA | CANCELADA
prioridade: BAIXA | MEDIA | ALTA | URGENTE
etapa: PLANEJAMENTO | PREPARACAO | EXECUCAO | FINALIZACAO
```

### Scout

```
status: PENDENTE | EM_ANDAMENTO | CONCLUIDO | CANCELADO
```

### Praga Contagem

```
prioridade: BAIXA | MEDIA | ALTA
```

---

## 6. Regras de Acesso (Multi-Tenant)

- Cada operação é filtrada pela `fazenda_id` do usuário logado
- Um usuário só vê/edita dados da fazenda selecionada
- Ao trocar de fazenda, recarregar todos os dados
- RLS (Row Level Security) no Supabase garante isolamento por `user_id` e `fazenda_id`
- Soft delete: registros deletados não são removidos fisicamente (campo `deleted_at`)
