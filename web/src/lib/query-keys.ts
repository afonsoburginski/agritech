export const queryKeys = {
  pragas: {
    all: ['pragas'] as const,
    list: (filters?: Record<string, string>) => ['pragas', 'list', filters] as const,
  },
  vectors: {
    all: ['vectors'] as const,
    list: () => ['vectors', 'list'] as const,
  },
  users: {
    all: ['users'] as const,
    list: () => ['users', 'list'] as const,
  },
  fazendas: {
    all: ['fazendas'] as const,
    list: () => ['fazendas', 'list'] as const,
    detail: (id: number) => ['fazendas', 'detail', id] as const,
  },
  scouts: {
    all: ['scouts'] as const,
  },
  stats: {
    dashboard: (fazendaId?: number | null) => ['stats', 'dashboard', fazendaId ?? 'all'] as const,
    charts: (fazendaId?: number | null, chartRange?: number) => ['stats', 'charts', fazendaId ?? 'all', chartRange ?? 30] as const,
    activities: (fazendaId?: number | null) => ['stats', 'activities', fazendaId ?? 'all'] as const,
    talhoesList: (fazendaId?: number | null) => ['stats', 'talhoesList', fazendaId ?? 'all'] as const,
    saude: (fazendaId?: number | null) => ['stats', 'saude', fazendaId ?? 'all'] as const,
    saudeDaily: (fazendaId?: number | null, chartRange?: number) => ['stats', 'saudeDaily', fazendaId ?? 'all', chartRange ?? 30] as const,
  },
  profile: {
    me: () => ['profile', 'me'] as const,
  },
} as const
