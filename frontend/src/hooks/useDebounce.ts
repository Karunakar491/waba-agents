import { useEffect, useState } from 'react'

/**
 * Not wired into any page today — every current client-side search filter
 * is synchronous and instant on small in-memory lists, and stays that way.
 * This exists so a future server-side-search migration doesn't need to
 * invent this from scratch.
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}
