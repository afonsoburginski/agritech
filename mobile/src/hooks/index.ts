/**
 * Hooks do App
 * 
 * Hooks de dados (carregam do SQLite sob demanda):
 * - useAtividades - CRUD de tarefas agrícolas
 * - useScouts - CRUD de pontos de monitoramento
 * - usePragas - CRUD de pragas identificadas
 * - useReconhecimento - Reconhecimento de pragas via IA
 * 
 * Hooks de dispositivo:
 * - useCamera - Câmera e galeria
 * - useLocation - GPS do dispositivo
 * 
 * Hooks de sincronização:
 * - useSync - Status e controle de sincronização SQLite <-> Supabase
 * 
 * Hooks de UI:
 * - useColor - Cores do tema
 * - useColorScheme - Light/Dark mode
 */

// Dados (CRUD com SQLite)
export * from './use-atividades';
export * from './use-scouts';
export * from './use-pragas';

// Dados (Supabase Remote)
export * from './use-supabase-data';

// Dispositivo
export * from './use-camera';
export * from './use-location';

// Sincronização
export * from './use-sync';

// UI (BNA UI: useColor, useColorScheme, useModeToggle)
export * from './useColor';
export * from './use-color-scheme';
export * from './useModeToggle';
export * from './use-theme-color';
