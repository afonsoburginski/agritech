'use client'

import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

export { supabase }

export function useSupabaseQuery<T>(
  key: QueryKey,
  queryFn: (sb: typeof supabase) => Promise<T>,
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery({
    queryKey: key,
    queryFn: () => queryFn(supabase),
    ...options,
  })
}

export function useOptimisticMutation<TData, TVariables>(opts: {
  mutationFn: (sb: typeof supabase, vars: TVariables) => Promise<TData>
  invalidateKeys?: QueryKey[]
  optimisticKey?: QueryKey
  optimisticUpdate?: (old: any, vars: TVariables) => any
}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: TVariables) => opts.mutationFn(supabase, vars),
    onMutate: async (vars) => {
      if (opts.optimisticKey && opts.optimisticUpdate) {
        await qc.cancelQueries({ queryKey: opts.optimisticKey })
        const prev = qc.getQueryData(opts.optimisticKey)
        qc.setQueryData(opts.optimisticKey, (old: any) => opts.optimisticUpdate!(old, vars))
        return { prev }
      }
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.prev && opts.optimisticKey) {
        qc.setQueryData(opts.optimisticKey, ctx.prev)
      }
    },
    onSettled: () => {
      opts.invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }))
    },
  })
}
