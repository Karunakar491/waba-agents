// Shared draft/publish pattern (2026-08-13, see wiki/decisions/ for the
// full write-up). One hook, used independently by each tab that wants it —
// each caller owns its own Publish button/Draft indicator; this hook only
// tracks whether the caller's local draft differs from the live value and
// exposes a publish() that clears dirtiness on success.
//
// Dirty check is JSON.stringify equality, not a deep-equal library — this
// codebase has no deep-equal dependency yet and the values compared here
// (form-shaped objects/arrays of primitives) are exactly the shapes
// JSON.stringify compares safely (no functions, no Dates, no key-order
// sensitivity across renders since both sides come from the same shape).
import { useEffect, useRef, useState } from 'react'
import { useMutation, type UseMutationResult } from '@tanstack/react-query'

export interface UseDraftPublishOptions<TValue, TResult = unknown> {
  /** The current live/published value (e.g. from a useQuery). */
  liveValue: TValue
  /** Sends the draft to the backend (and, transitively, to Meta). */
  publish: (draft: TValue) => Promise<TResult>
  /** Called after a successful publish. */
  onPublished?: (result: TResult) => void
}

export interface UseDraftPublishResult<TValue, TResult = unknown> {
  draft: TValue
  setDraft: (value: TValue | ((prev: TValue) => TValue)) => void
  /** True when draft differs from the live value. */
  isDirty: boolean
  /** Discards the draft, resetting it back to the live value. */
  resetDraft: () => void
  publish: () => void
  isPublishing: boolean
  publishError: UseMutationResult<TResult, unknown, TValue>['error']
}

export function useDraftPublish<TValue, TResult = unknown>({
  liveValue,
  publish,
  onPublished,
}: UseDraftPublishOptions<TValue, TResult>): UseDraftPublishResult<TValue, TResult> {
  const [draft, setDraft] = useState<TValue>(liveValue)

  // Once the user has started editing, an incoming live refetch (e.g. a
  // background poll) must NOT clobber their in-progress draft — only seed
  // the draft from live on first load. Tracked via ref, not a dep-driven
  // effect re-sync, to avoid the exact stale-deps/effect-refire trap logged
  // in Memory/feedback_react_effect_stale_deps.
  const hasUserEditedRef = useRef(false)
  useEffect(() => {
    if (!hasUserEditedRef.current) setDraft(liveValue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(liveValue)])

  const mutation = useMutation<TResult, unknown, TValue>({
    mutationFn: publish,
    onSuccess: (result) => {
      hasUserEditedRef.current = false
      onPublished?.(result)
    },
  })

  return {
    draft,
    setDraft: (value) => {
      hasUserEditedRef.current = true
      setDraft(value)
    },
    isDirty: JSON.stringify(draft) !== JSON.stringify(liveValue),
    resetDraft: () => {
      hasUserEditedRef.current = false
      setDraft(liveValue)
    },
    publish: () => mutation.mutate(draft),
    isPublishing: mutation.isPending,
    publishError: mutation.error,
  }
}
