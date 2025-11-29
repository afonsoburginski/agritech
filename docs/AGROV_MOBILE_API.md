# AGROV Mobile API - Documentação

## 📱 Visão Geral

A **AGROV Mobile API** é uma API REST desenvolvida para suportar o aplicativo móvel **AgrovMobile**, que funciona como complemento ao sistema AGROV ERP. A API fornece funcionalidades essenciais para gestão de atividades agrícolas, monitoramento de pragas e sincronização de dados em campo.

## 🔐 Autenticação

A API utiliza **JWT (JSON Web Tokens)** para autenticação. Todos os endpoints (exceto login) requerem um token JWT válido no header `Authorization: Bearer <token>`.

### Fluxo de Autenticação

1. O usuário faz login através do endpoint `/mobile/auth/login`
2. O sistema valida as credenciais e retorna um token JWT
3. O token contém informações do usuário e fazenda selecionada
4. O token deve ser enviado em todas as requisições subsequentes

## 📋 Principais Funcionalidades

### 1. Autenticação e Autorização

#### Login
- **Endpoint**: `POST /mobile/auth/login`
- **Descrição**: Autentica o usuário e retorna token JWT
- **Funcionalidades**:
  - Validação de credenciais (email e senha)
  - Seleção de fazenda (pode especificar fazendaId ou usar a primeira disponível)
  - Geração de token JWT com informações do usuário e fazenda
  - Retorno da lista de fazendas disponíveis para o usuário
  - Atualização do último acesso do usuário

### 2. Gestão de Atividades

#### Listar Atividades
- **Endpoint**: `GET /mobile/atividades`
- **Descrição**: Lista todas as atividades da fazenda do usuário
- **Funcionalidades**:
  - Sincronização incremental via parâmetro `lastSync`
  - Filtro automático por fazenda (baseado no token JWT)
  - Retorna atividades com informações completas:
    - Dados básicos (título, descrição, tipo, situação, prioridade)
    - Datas (início, fim, criação, atualização)
    - Talhões vinculados
    - Safra associada
    - Recursos utilizados (produtos, maquinários, funcionários)
    - Status de sincronização

#### Criar Atividade
- **Endpoint**: `POST /mobile/atividades`
- **Descrição**: Cria uma nova atividade
- **Funcionalidades**:
  - Validação de dados obrigatórios
  - Vinculação automática à fazenda do usuário
  - Suporte a múltiplos talhões
  - Registro de recursos utilizados (produtos, maquinários, funcionários)
  - Geração de código único
  - Cálculo de custo aproximado

#### Atualizar Atividade
- **Endpoint**: `PUT /mobile/atividades/{id}`
- **Descrição**: Atualiza uma atividade existente
- **Funcionalidades**:
  - Validação de propriedade (apenas atividades da fazenda do usuário)
  - Atualização de todos os campos
  - Preservação de histórico

#### Remover Atividade
- **Endpoint**: `DELETE /mobile/atividades/{id}`
- **Descrição**: Remove uma atividade
- **Funcionalidades**:
  - Validação de propriedade
  - Remoção segura com validações

### 3. Monitoramento de Pragas (Scout)

#### Listar Monitoramentos
- **Endpoint**: `GET /mobile/scouts`
- **Descrição**: Lista todos os monitoramentos de pragas da fazenda
- **Funcionalidades**:
  - Sincronização incremental via parâmetro `lastSync`
  - Filtro automático por fazenda
  - Retorna monitoramentos com:
    - Informações do talhão
    - Marcadores (pontos de monitoramento)
    - Contagens de pragas por ponto
    - Estatísticas (total de marcadores, visitados, pragas, percentual de infestação)
    - Status de sincronização

#### Criar Monitoramento
- **Endpoint**: `POST /mobile/scouts`
- **Descrição**: Cria um novo monitoramento de pragas
- **Funcionalidades**:
  - Validação de talhão obrigatório
  - Criação de marcadores (pontos de monitoramento)
  - Registro de contagens de pragas
  - Informações de estádio fenológico
  - Cálculo de limiares e prioridades

#### Atualizar Monitoramento
- **Endpoint**: `PUT /mobile/scouts/{id}`
- **Descrição**: Atualiza um monitoramento existente
- **Funcionalidades**:
  - Validação de propriedade
  - Atualização de marcadores e contagens
  - Recalculo de estatísticas

#### Listar Pragas
- **Endpoint**: `GET /mobile/scouts/pragas`
- **Descrição**: Lista as pragas disponíveis
- **Funcionalidades**:
  - Filtro por cultura (query param `cultura`)
  - Filtro por tipo (query param `tipo`)
  - Retorna informações básicas da praga

#### Detalhes da Praga
- **Endpoint**: `GET /mobile/scouts/pragas/{id}`
- **Descrição**: Retorna detalhes completos de uma praga
- **Funcionalidades**:
  - Informações completas (nome comum, científico, cultura)
  - Imagem da praga (byte array)

#### Enumerations
- **Endpoint**: `GET /mobile/scouts/limiar-estagio`
- **Descrição**: Retorna valores do enum `EnumLimiarPorEstadio`

- **Endpoint**: `GET /mobile/scouts/unidade-fenologica`
- **Descrição**: Retorna valores do enum `EnumUnidadeFenologica`

## 🔄 Sincronização

A API suporta **sincronização incremental** através do parâmetro `lastSync`:

- **Formato**: `yyyy-MM-dd'T'HH:mm:ss` (ISO 8601)
- **Uso**: Enviar a data/hora da última sincronização bem-sucedida
- **Retorno**: Apenas registros criados ou modificados após a data informada
- **Benefícios**:
  - Redução de tráfego de rede
  - Sincronização mais rápida
  - Economia de bateria no dispositivo móvel

## 📊 Estrutura de Resposta

Todas as respostas seguem o padrão `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Operação realizada com sucesso",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00",
  "errorCode": null,
  "errorDetails": null
}
```

### Resposta de Sucesso
- `success`: `true`
- `message`: Mensagem descritiva
- `data`: Dados da resposta
- `timestamp`: Data/hora da resposta

### Resposta de Erro
- `success`: `false`
- `message`: Mensagem de erro
- `errorCode`: Código do erro (opcional)
- `errorDetails`: Detalhes adicionais (opcional)

## 🔒 Segurança

### Autenticação JWT
- **Algoritmo**: HS256 (HMAC-SHA256)
- **Expiração**: 24 horas (86400 segundos)
- **Claims incluídos**:
  - `userId`: ID do usuário
  - `fazendaId`: ID da fazenda selecionada
  - `email`: Email do usuário
  - `iss`: Issuer (agrov-mobile-api)
  - `exp`: Data de expiração

### Autorização
- Todos os endpoints (exceto `/mobile/auth/login`) requerem o role `MOBILE`
- O token JWT é validado em cada requisição
- A fazenda é extraída automaticamente do token

### CORS
- CORS habilitado para todas as origens
- Métodos permitidos: GET, POST, PUT, DELETE, OPTIONS
- Headers permitidos: authorization, content-type

## 📝 Modelos de Dados Principais

### Atividade
- Informações básicas (código, título, descrição)
- Classificação (tipo, situação, prioridade, etapa)
- Datas (início, fim, criação, atualização)
- Relacionamentos (talhões, safra, scout, usuário responsável)
- Recursos (produtos, maquinários, funcionários)
- Custos e controle de estoque

### Scout (Monitoramento)
- Informações básicas (nome, status, observação)
- Talhão monitorado
- Marcadores (pontos de monitoramento com coordenadas GPS)
- Contagens de pragas por marcador
- Estatísticas agregadas
- Usuário responsável

### Praga
- Nome comum e científico
- Cultura associada
- Tipo de praga
- Imagem de referência

## 🚀 Endpoints Disponíveis

### Autenticação
- `POST /mobile/auth/login` - Login e obtenção de token

### Atividades
- `GET /mobile/atividades?lastSync={datetime}` - Listar atividades
- `POST /mobile/atividades` - Criar atividade
- `PUT /mobile/atividades/{id}` - Atualizar atividade
- `DELETE /mobile/atividades/{id}` - Remover atividade

### Monitoramento (Scout)
- `GET /mobile/scouts?lastSync={datetime}` - Listar monitoramentos
- `POST /mobile/scouts` - Criar monitoramento
- `PUT /mobile/scouts/{id}` - Atualizar monitoramento
- `GET /mobile/scouts/pragas?cultura={cultura}&tipo={tipo}` - Listar pragas
- `GET /mobile/scouts/pragas/{id}` - Detalhes da praga
- `GET /mobile/scouts/limiar-estagio` - Enum limiar por estádio
- `GET /mobile/scouts/unidade-fenologica` - Enum unidade fenológica

## 📱 Casos de Uso do App Mobile

### 1. Campo de Trabalho
- **Cenário**: Técnico agrícola em campo precisa registrar atividades
- **Fluxo**:
  1. Login no app
  2. Seleção de fazenda (se múltiplas)
  3. Visualização de atividades pendentes
  4. Criação de nova atividade com recursos utilizados
  5. Sincronização automática ou manual

### 2. Monitoramento de Pragas
- **Cenário**: Monitoramento de pragas em talhões
- **Fluxo**:
  1. Criação de monitoramento para um talhão
  2. Criação de pontos de monitoramento (marcadores) com GPS
  3. Visita aos pontos e registro de contagens de pragas
  4. Consulta de informações da praga (imagem, limiares)
  5. Cálculo automático de percentual de infestação
  6. Geração de recomendações baseadas em limiares

### 3. Sincronização Offline
- **Cenário**: Trabalho em áreas sem conectividade
- **Fluxo**:
  1. Download inicial de dados (atividades, monitoramentos)
  2. Trabalho offline com dados locais
  3. Sincronização quando conectividade disponível
  4. Uso de `lastSync` para sincronização incremental

### 4. Gestão de Recursos
- **Cenário**: Registro de uso de produtos, maquinários e funcionários
- **Fluxo**:
  1. Criação/edição de atividade
  2. Adição de produtos utilizados (quantidade, valor)
  3. Registro de maquinários (horas trabalhadas, combustível)
  4. Vinculação de funcionários (horas trabalhadas)
  5. Cálculo automático de custos

## 🔧 Configuração Técnica

### Base URL
```
http://localhost:8080
```

### Content-Type
- **Request**: `application/json`
- **Response**: `application/json`

### Encoding
- **UTF-8**

### Timezone
- **UTC-3** (Brasil)

## 📚 Recursos Adicionais

### Validações
- Validação de dados de entrada usando Bean Validation
- Validação de propriedade (usuário só acessa dados de sua fazenda)
- Validação de integridade referencial

### Logging
- Logs estruturados para todas as operações
- Níveis: DEBUG, INFO, WARN, ERROR
- Rastreamento de requisições e erros

### Performance
- Sincronização incremental reduz tráfego
- Filtros automáticos por fazenda
- Cache de dados quando apropriado

## 🐛 Tratamento de Erros

### Códigos HTTP
- `200 OK` - Sucesso
- `201 Created` - Recurso criado
- `400 Bad Request` - Dados inválidos
- `401 Unauthorized` - Token inválido ou ausente
- `403 Forbidden` - Acesso negado
- `404 Not Found` - Recurso não encontrado
- `500 Internal Server Error` - Erro interno

### Mensagens de Erro
Todas as mensagens de erro seguem o padrão `ApiResponse` com:
- Mensagem descritiva em português
- Código de erro (quando aplicável)
- Detalhes adicionais (quando necessário)

## 📞 Suporte

Para dúvidas ou problemas com a API, consulte:
- Documentação técnica: Este documento
- Swagger UI: `http://localhost:8080/swagger-ui` (quando configurado)
- OpenAPI JSON: `http://localhost:8080/api-docs` (quando configurado)

---

**Versão da API**: 1.0.0  
**Última atualização**: 2024-01-15

