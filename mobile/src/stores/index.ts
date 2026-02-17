/**
 * Stores - Estado Global MÍNIMO
 * 
 * APENAS o essencial:
 * - auth-store: Autenticação e usuário
 * - app-store: Status de conexão, sync, contadores
 * 
 * Para dados, usar hooks locais:
 * - use-atividades.ts
 * - use-scouts.ts
 * - use-pragas.ts
 */

// Auth (necessário global)
export * from './auth-store';

// App state mínimo
export * from './app-store';
