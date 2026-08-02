import { useCallback, useEffect, useRef, useState } from 'react'

export type JobPollStatus = 'idle' | 'pending' | 'accepted' | 'failed' | 'unknown'

interface UseJobPollOptions {
  /**
   * Fetches current status for the given id; return the raw status string.
   * The id is passed explicitly (not closed over) because start() is always
   * called immediately after the id becomes known — closing over React state
   * here would read the pre-update value from the render that created this
   * options object, not the id just obtained.
   */
  fetchStatus: (id: string) => Promise<string>
  /** Status strings that mean "keep polling". Everything else is terminal. */
  pendingValues: string[]
  /** Status strings that count as success. */
  successValues: string[]
  intervalMs?: number
  maxAttempts?: number
}

/**
 * Shared polling hook for async Meta operations that return an id and must be
 * polled for status (Agent Event, Agent Eval run). Bounded — gives up after
 * maxAttempts and reports "unknown" rather than spinning forever, so a
 * dropped network mid-poll never reads as a stuck infinite spinner.
 */
export function useJobPoll({
  fetchStatus,
  pendingValues,
  successValues,
  intervalMs = 2000,
  maxAttempts = 30,
}: UseJobPollOptions) {
  const [status, setStatus] = useState<JobPollStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptsRef = useRef(0)

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const start = useCallback((id: string) => {
    stop()
    attemptsRef.current = 0
    setStatus('pending')

    const tick = async () => {
      attemptsRef.current += 1
      try {
        const raw = await fetchStatus(id)
        if (pendingValues.includes(raw)) {
          if (attemptsRef.current >= maxAttempts) {
            setStatus('unknown')
            return
          }
          timerRef.current = setTimeout(tick, intervalMs)
          return
        }
        setStatus(successValues.includes(raw) ? 'accepted' : 'failed')
      } catch {
        setStatus('unknown')
      }
    }

    tick()
  }, [fetchStatus, pendingValues, successValues, maxAttempts, intervalMs, stop])

  const reset = useCallback(() => {
    stop()
    setStatus('idle')
  }, [stop])

  // Kill any in-flight poll when the owning component unmounts (modal closed,
  // tab switched away) — otherwise the setTimeout chain outlives it and keeps
  // hitting the Meta status API in the background for up to maxAttempts.
  useEffect(() => stop, [stop])

  return { status, start, stop, reset }
}
