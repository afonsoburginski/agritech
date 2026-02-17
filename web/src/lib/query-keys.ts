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
    dashboard: () => ['stats', 'dashboard'] as const,
    charts: () => ['stats', 'charts'] as const,
  },
  profile: {
    me: () => ['profile', 'me'] as const,
  },
} as const
