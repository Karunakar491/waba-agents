import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Users,
  User,
  Building2,
  LogOut,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  BarChart3,
  FileText,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useLogout } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { cn } from '../../lib/utils'

// Sub-items under "Agents". All four now have a real account-wide aggregate
// Library page (TASK-050 Skills, TASK-064 Connectors — live fan-out, no
// local mirror — TASK-060 Persona, TASK-065 Knowledge Base/Files — local
// mirror, Files+Websites as tabs on one page) — they always route there
// instead of an agent deep-link.
const AGENT_SUB_NAV = [
  { tab: 'knowledge',  label: 'Knowledge Base',   to: '/library/files' },
  { tab: 'skills',     label: 'Skills',           to: '/library/skills' },
  { tab: 'connectors', label: 'Connectors',       to: '/library/connectors' },
  { tab: 'persona',    label: 'Business Persona', to: '/library/persona' },
]

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',    soon: false, end: false },
  { to: '/agents',   icon: Bot,          label: 'Agents',         soon: false, end: false },
  { to: '/reports',  icon: BarChart3,    label: 'Reports',        soon: false, end: false },
  { to: '/wabas',    icon: Building2,    label: 'WABAs',          soon: false, end: false },
  { to: '/inbox',    icon: MessageSquare, label: 'Inbox',          soon: false, end: false },
  { to: '/handover', icon: Users,         label: 'Human Handover', soon: true,  end: false },
  { to: '/profile',  icon: User,          label: 'Profile',        soon: false, end: false },
]

// Template Studio is its own module (separate AccountModule entitlement,
// see ModuleAccessFilter) sharing this same AppShell — it must NOT show the
// Business Agents nav above. Iris/Templates/Settings are siblings, not
// nested pages of one another — `end: true` on Templates keeps its NavLink
// from staying highlighted while on /templates/iris or /templates/settings.
// No dedicated Campaigns section (2026-08-04) — bulk-send lives as a "Send"
// action on Templates and conversationally through Iris, same backend
// endpoint either way, not a separate nav destination.
const TEMPLATE_STUDIO_NAV = [
  { to: '/templates/iris', icon: MessageSquare, label: 'Iris', soon: false, end: false },
  { to: '/templates', icon: FileText, label: 'Templates', soon: false, end: true },
  { to: '/templates/settings', icon: SettingsIcon, label: 'Settings', soon: false, end: false },
]

const COLLAPSE_KEY = 'sidebar-collapsed'

export default function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const location = useLocation()
  // Collapsed by default (modern-app convention) — only stays expanded if the
  // user explicitly expanded it before (localStorage holds '0').
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) !== '0',
  )
  // Below md the sidebar is an off-canvas drawer — closed by default, overlays content
  const [mobileOpen, setMobileOpen] = useState(false)
  // Hover-to-peek: while collapsed, hovering the rail floats it open over the
  // content (doesn't reflow main) — like Notion/Linear/VS Code's activity bar.
  const [railHover, setRailHover] = useState(false)
  const activeNav = location.pathname.startsWith('/templates') ? TEMPLATE_STUDIO_NAV : NAV

  // Whether the sidebar is showing full labels right now (persisted collapse
  // state OFF, or hovering the rail while collapsed). Mobile drawer always
  // shows full labels regardless of desktop collapse.
  const showExpanded = !collapsed || railHover
  const iconOnly = !showExpanded && !mobileOpen
  const floating = collapsed && railHover && !mobileOpen

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

      {/* Sidebar — off-canvas drawer below md; fixed rail from md up (fixed,
          not static, so hover-peek can float over content instead of
          reflowing it — main's padding-left tracks the collapsed baseline). */}
      <aside
        id="app-sidebar"
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label="Navigation"
        onMouseEnter={() => collapsed && setRailHover(true)}
        onMouseLeave={() => setRailHover(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col bg-brand-navy transition-transform duration-200 md:transition-[width]',
          showExpanded ? 'md:w-60' : 'md:w-16',
          floating && 'md:shadow-2xl',
          'w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        {/* Logo — also the feature switcher (2026-08-04): takes you back to
            the Netflix-style /select screen from inside any feature, not
            just at login. Always available, regardless of how many modules
            this account has — with just one enabled, /select still works as
            a "what's available to me" view (the rest greyed). Custom tooltip
            instead of a native `title` (only shown in the collapsed rail —
            expanded mode already has the "Meta Agents" label doing that job).
            Motion kept to DESIGN.md's own rule: feedback only, ≤200ms ease-out,
            no ambient/attention-seeking animation. */}
        <Link
          to="/select"
          aria-label="Switch feature"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'group relative flex h-16 items-center gap-2 border-b border-white/10 transition-colors hover:bg-white/5',
            iconOnly ? 'justify-center px-0' : 'px-6',
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-pink transition-transform duration-150 ease-out group-hover:scale-110">
            <Bot className="h-4 w-4 text-white" />
          </div>
          {!iconOnly && (
            <span className="truncate text-lg font-semibold tracking-tight text-white">
              Meta Agents
            </span>
          )}
          {iconOnly && (
            <span
              role="tooltip"
              className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-surface-lifted opacity-0 -translate-x-1 transition-all duration-150 ease-out group-hover:opacity-100 group-hover:translate-x-0 z-50"
            >
              Switch feature
            </span>
          )}
        </Link>

        {/* Nav */}
        <nav className={cn('flex-1 space-y-1 py-4', iconOnly ? 'px-2' : 'px-3')}>
          {activeNav.map(({ to, icon: Icon, label, soon, end }) => (
            <div key={to}>
              <NavLink
                to={to}
                end={end}
                title={iconOnly ? label : undefined}
                onClick={() => { if (!soon) setMobileOpen(false) }}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors',
                    iconOnly ? 'justify-center px-0' : 'px-3',
                    soon
                      ? 'pointer-events-none text-white/30'
                      : isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:bg-white/10 hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!iconOnly && (
                  <span className="flex flex-1 items-center justify-between">
                    {label}
                    {soon && (
                      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/40">
                        Soon
                      </span>
                    )}
                  </span>
                )}
                {iconOnly && <span className="sr-only">{label}</span>}
              </NavLink>

              {/* Agents sub-nav — always expanded, hidden entirely in the
                  collapsed rail (sub-items don't fit a 64px icon-only rail). */}
              {to === '/agents' && !iconOnly && (
                <div className="mt-1 space-y-1">
                  {AGENT_SUB_NAV.map(({ tab, label: subLabel, to: subTo }) => {
                    const isActive = location.pathname === subTo
                    return (
                      <NavLink
                        key={tab}
                        to={subTo}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'block rounded-lg py-2 pl-11 pr-3 text-sm transition-colors',
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'text-white/50 hover:bg-white/10 hover:text-white/80',
                        )}
                      >
                        {subLabel}
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
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

      {/* Main — padding-left tracks the persisted collapse state (not hover),
          so a hover-peek floats over content instead of shifting it. */}
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden transition-[padding] duration-200',
          collapsed ? 'md:pl-16' : 'md:pl-60',
        )}
      >
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
                {activeNav.find((n) => location.pathname === n.to)?.label
                  ?? activeNav.find((n) => location.pathname.startsWith(n.to + '/'))?.label
                  ?? activeNav[0]?.label}
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
