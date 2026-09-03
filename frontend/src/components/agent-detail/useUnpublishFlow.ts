import { useState } from 'react'
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query'
import api from '../../lib/api'

/**
 * Shared Unpublish/Republish flow — same mutation shape needed by Skills,
 * UI Skills, and FAQ (EL gate: 3+ near-identical instances in one diff must
 * be extracted, not copy-pasted). `basePath` is the resource's collection
 * URL (e.g. `/agents/{id}/skills`); the two actions POST to `${id}/unpublish`
 * and `${id}/republish` under it, matching every backend controller's shape.
 */
export function useUnpublishFlow<T extends { id: string }>(basePath: string, queryKey: QueryKey) {
  const queryClient = useQueryClient()
  const [unpublishTarget, setUnpublishTarget] = useState<T | null>(null)

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => api.post(`${basePath}/${id}/unpublish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      setUnpublishTarget(null)
    },
  })

  const republishMutation = useMutation({
    mutationFn: (id: string) => api.post(`${basePath}/${id}/republish`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  return { unpublishTarget, setUnpublishTarget, unpublishMutation, republishMutation }
}
