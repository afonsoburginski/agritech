# Banco de dados local (offline)

O app usa **SQLite** via `expo-sqlite` para persistência offline.

## Escolha: SQLite (não WatermelonDB nem Realm)

- **SQLite**: já integrado com expo-sqlite, schema simples (scouts, atividades, pragas, sync-queue, fila de reconhecimento), suficiente para o volume de dados do app. Sincronização manual com Supabase via `sync-service`.
- **WatermelonDB** e **Realm**: trariam mais complexidade e dependências; o volume de dados (scouts, atividades, fila) não exige reativação em tempo real em milhares de registros. SQLite atende.

## Quando o SQLite está disponível

- **Development build** (`expo run:ios`, `expo run:android`) ou **build de produção**: SQLite funciona. Dados são salvos localmente e sincronizados com a nuvem quando online.
- **Expo Go**: o módulo nativo não está disponível. O app usa dados em memória e continua funcionando com Supabase quando há internet; ao fechar o app, os dados locais são perdidos. Para teste com persistência offline, use um development build.

## Sincronização

O `sync-service`:

1. Salva todas as operações primeiro no SQLite (quando disponível).
2. Envia a fila de alterações para o Supabase quando online.
3. Baixa dados remotos e atualiza o banco local (pull).
4. Processa a fila de reconhecimento de pragas (fotos tiradas offline) quando online.

Só o necessário é sincronizado: tabelas `atividades`, `scouts`, `pragas` (mapeadas para `scout_marker_pragas` no Supabase) e a fila de reconhecimento.
