import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  // TSIDs overflow JS Number.MAX_SAFE_INTEGER — backend serializes these as
  // strings (ToStringSerializer); keep as string end-to-end, never coerce to number.
  id: string
  email: string
  name: string
  accountId: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  setUser: (user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: true }),
      clearAuth: () => set({ user: null, isAuthenticated: false }),
    }),
    { name: 'auth' }
  )
)
