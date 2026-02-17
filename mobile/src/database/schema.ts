/**
 * Schema do banco de dados SQLite
 * Define todas as tabelas e índices do sistema
 */

export const SCHEMA_VERSION = 2;

export const createSchemaSQL = `
-- Tabela de atividades
CREATE TABLE IF NOT EXISTS atividades (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT,
  status TEXT,
  "data-inicio" TEXT,
  "data-fim" TEXT,
  "created-at" TEXT NOT NULL,
  "updated-at" TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  "deleted-at" TEXT
);

-- Tabela de scouts
CREATE TABLE IF NOT EXISTS scouts (
  id TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL,
  altitude REAL,
  heading REAL,
  speed REAL,
  "created-at" TEXT NOT NULL,
  "updated-at" TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  "deleted-at" TEXT
);

-- Tabela de pragas
CREATE TABLE IF NOT EXISTS pragas (
  id TEXT PRIMARY KEY,
  "scout-id" TEXT NOT NULL,
  nome TEXT NOT NULL,
  quantidade INTEGER,
  severidade TEXT,
  "created-at" TEXT NOT NULL,
  "updated-at" TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  "deleted-at" TEXT,
  FOREIGN KEY ("scout-id") REFERENCES scouts(id) ON DELETE CASCADE
);

-- Tabela de unidades fenológicas
CREATE TABLE IF NOT EXISTS "unidades-fenologicas" (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  codigo TEXT UNIQUE,
  descricao TEXT,
  "created-at" TEXT NOT NULL,
  "updated-at" TEXT NOT NULL,
  synced INTEGER DEFAULT 0
);

-- Tabela de limiares
CREATE TABLE IF NOT EXISTS limiares (
  id TEXT PRIMARY KEY,
  "unidade-fenologica-id" TEXT NOT NULL,
  "praga-id" TEXT NOT NULL,
  "valor-minimo" REAL,
  "valor-maximo" REAL,
  "created-at" TEXT NOT NULL,
  "updated-at" TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  FOREIGN KEY ("unidade-fenologica-id") REFERENCES "unidades-fenologicas"(id) ON DELETE CASCADE,
  FOREIGN KEY ("praga-id") REFERENCES pragas(id) ON DELETE CASCADE
);

-- Tabela de fila de sincronização
CREATE TABLE IF NOT EXISTS "sync-queue" (
  id TEXT PRIMARY KEY,
  "entity-type" TEXT NOT NULL,
  "entity-id" TEXT NOT NULL,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,
  "retry-count" INTEGER DEFAULT 0,
  "max-retries" INTEGER DEFAULT 5,
  status TEXT NOT NULL,
  "error-message" TEXT,
  "created-at" TEXT NOT NULL,
  "updated-at" TEXT NOT NULL,
  "next-retry-at" TEXT
);

-- Tabela de controle de migrations
CREATE TABLE IF NOT EXISTS "schema-migrations" (
  version INTEGER PRIMARY KEY,
  "applied-at" TEXT NOT NULL
);

-- Índices para otimização de queries
CREATE INDEX IF NOT EXISTS "idx-atividades-updated-at" ON atividades("updated-at");
CREATE INDEX IF NOT EXISTS "idx-atividades-synced" ON atividades(synced);
CREATE INDEX IF NOT EXISTS "idx-scouts-updated-at" ON scouts("updated-at");
CREATE INDEX IF NOT EXISTS "idx-scouts-synced" ON scouts(synced);
CREATE INDEX IF NOT EXISTS "idx-sync-queue-status" ON "sync-queue"(status);
CREATE INDEX IF NOT EXISTS "idx-sync-queue-next-retry" ON "sync-queue"("next-retry-at");
CREATE INDEX IF NOT EXISTS "idx-pragas-scout-id" ON pragas("scout-id");
`;

