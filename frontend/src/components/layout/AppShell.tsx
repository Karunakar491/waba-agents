import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Settings,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react'
import { useLogout } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/agents',    icon: Bot,             label: 'Agents'    },
  { to: '/inbox',     icon: MessageSquare,   label: 'Inbox'     },
  { to: '/settings',  icon: Settings,        label: 'Settings'  },
]

const COLLAPSE_KEY = 'sidebar-collapsed'

export default function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  // Below md the sidebar is an off-canvas drawer — closed by default, overlays content
  const [mobileOpen, setMobileOpen] = useState(false)

  // In the mobile drawer, always show full labels regardless of desktop collapse
  const iconOnly = collapsed && !mobileOpen

  // Reset the drawer when crossing to desktop, and close it on Escape
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  function toggle() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      return !c
    })
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile drawer backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas drawer below md, static rail from md up */}
      <aside
        id="app-sidebar"
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-brand-navy transition-transform duration-200 md:static md:transition-[width]',
          collapsed ? 'md:w-16' : 'md:w-60',
          'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex h-16 items-center gap-2 border-b border-white/10',
            iconOnly ? 'justify-center px-0' : 'px-6',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pink">
            <Bot className="h-4 w-4 text-white" />
          </div>
          {!iconOnly && (
            <span className="truncate text-lg font-semibold tracking-tight text-white">
              Meta Agents
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className={cn('flex-1 space-y-1 py-4', iconOnly ? 'px-2' : 'px-3')}>
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              title={iconOnly ? label : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors',
                  iconOnly ? 'justify-center px-0' : 'px-3',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!iconOnly && label}
              {iconOnly && <span className="sr-only">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className={cn('border-t border-white/10 p-3', iconOnly && 'p-2')}>
          <div
            className={cn(
              'flex items-center gap-3 rounded-lg py-2',
              iconOnly ? 'justify-center px-0' : 'px-3',
            )}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-pink text-xs font-semibold text-white"
              title={iconOnly ? `${user?.name ?? ''} — sign out below` : undefined}
            >
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            {!iconOnly && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                <p className="truncate text-xs text-white/50">{user?.email}</p>
              </div>
            )}
            {!iconOnly && (
              <button
                onClick={() => logout.mutate()}
                className="text-white/40 transition-colors hover:text-white"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
          {iconOnly && (
            <button
              onClick={() => logout.mutate()}
              className="flex w-full justify-center rounded-lg py-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3">
            {/* Desktop: collapse rail. Mobile: open drawer. */}
            <button
              onClick={toggle}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar"
              className="hidden rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:block"
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="app-sidebar"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? 'Home'}
              </span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center gap-3 pr-2">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
