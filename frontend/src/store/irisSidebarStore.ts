import { create } from 'zustand'

// AppShell's navy nav rail renders Iris's session list inline when on the
// Iris route (2026-08-06 — founder wants one merged navy sidebar, not a
// separate light panel next to a collapsed rail). IrisWorkspace (a sibling
// of AppShell under the same <Outlet/>, not its child) is the owner of this
// data — a store lets AppShell read it without a Context provider wrapping
// the route tree. No persistence: this is live session state, not a
// preference.
export interface SessionSummary { id: string; title: string | null; updatedAt: string }

interface IrisSidebarState {
  sessions: SessionSummary[]
  loading: boolean
  activeId: string | null
  searchQuery: string
  onNewChat: (() => void) | null
  onSelect: ((id: string) => void) | null
  setIrisSidebar: (v: Partial<Omit<IrisSidebarState, 'searchQuery' | 'setSearchQuery' | 'setIrisSidebar' | 'clearIrisSidebar'>>) => void
  setSearchQuery: (q: string) => void
  clearIrisSidebar: () => void
}

const initial = {
  sessions: [] as SessionSummary[],
  loading: false,
  activeId: null as string | null,
  searchQuery: '',
  onNewChat: null as (() => void) | null,
  onSelect: null as ((id: string) => void) | null,
}

export const useIrisSidebarStore = create<IrisSidebarState>()((set) => ({
  ...initial,
  setIrisSidebar: (v) => set(v),
  setSearchQuery: (q) => set({ searchQuery: q }),
  clearIrisSidebar: () => set(initial),
}))
