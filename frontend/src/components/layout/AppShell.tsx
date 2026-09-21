import { useEffect, useMemo, useState } from 'react'
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
  BookOpen,
  Zap,
  Plug,
  FileText,
  Settings as SettingsIcon,
  Plus,
  Search,
  Loader2,
  Bug,
} from 'lucide-react'
import { useLogout } from '../../hooks/useAuth'
import { useAuthStore } from '../../store/authStore'
import { useIrisSidebarStore } from '../../store/irisSidebarStore'
import { cn } from '../../lib/utils'
import ClientCommandBar from './ClientCommandBar'
import ErrorBoundary from '../shared/ErrorBoundary'

// Sub-items under "Agents". All four now have a real account-wide aggregate
// Library page (TASK-050 Skills, TASK-064 Connectors — live fan-out, no
// local mirror — TASK-060 Persona, TASK-065 Knowledge Base/Files — local
// mirror, Files+Websites as tabs on one page) — they always route there
// instead of an agent deep-link.
//
// Icons are the same four AgentDetailPage's LEFT_TABS already use for these
// exact concepts (BookOpen/Zap/Plug/FileText) — the agent's own tabs and the
// account-wide library pages are the same four ideas, and giving them two icon
// vocabularies would be the app disagreeing with itself.
//
// They exist because these four used to VANISH from a collapsed rail: the block
// below was gated on `!iconOnly`, so a rail the user could collapse at any time
// silently removed four of the product's main destinations. Hover-to-peek did
// reveal them, which is a gesture a weekly, non-technical user never learns.
const AGENT_SUB_NAV = [
  { tab: 'knowledge',  icon: BookOpen, label: 'Knowledge Base',   to: '/library/files' },
  { tab: 'skills',     icon: Zap,      label: 'Skills',           to: '/library/skills' },
  { tab: 'connectors', icon: Plug,     label: 'Connectors',       to: '/library/connectors' },
  { tab: 'persona',    icon: FileText, label: 'Business Persona', to: '/library/persona' },
]

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',    soon: false, end: false },
  { to: '/agents',   icon: Bot,          label: 'Agents',         soon: false, end: false },
  { to: '/reports',  icon: BarChart3,    label: 'Reports',        soon: false, end: false },
  // Own nav item (2026-08-13) — mirrors Template Studio's existing
  // /templates/debug page; raw technical logs (API calls, webhooks) don't
  // belong mixed into Reports' business-metric tabs.
  { to: '/debug',    icon: Bug,          label: 'Debug',          soon: false, end: false },
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
  { to: '/templates/debug', icon: Bug, label: 'Debug', soon: false, end: false },
]

const COLLAPSE_KEY = 'sidebar-collapsed'

export default function AppShell() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const location = useLocation()
  // Expanded by default, per DESIGN.md §5: the rail "defaults to
  // expanded/labeled (discoverable for a first-time, non-technical user),
  // collapse is opt-in and persisted". It had drifted to collapsed, justified
  // in a comment as "modern-app convention" — so this restores the spec rather
  // than proposing a new opinion.
  //
  // `=== '1'` rather than `!== '0'` deliberately: toggle() writes '1' when the
  // user collapses and '0' when they expand, so this flips the default for
  // people who never touched it while leaving BOTH explicit choices intact.
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )
  // Below md the sidebar is an off-canvas drawer — closed by default, overlays content
  const [mobileOpen, setMobileOpen] = useState(false)
  // Hover-to-peek: while collapsed, hovering the rail floats it open over the
  // content (doesn't reflow main) — like Notion/Linear/VS Code's activity bar.
  const [railHover, setRailHover] = useState(false)
  const activeNav = location.pathname.startsWith('/templates') ? TEMPLATE_STUDIO_NAV : NAV

  // The header used to end in `?? activeNav[0]?.label`, so every route absent
  // from the main nav claimed to be the first nav item — the library pages and
  // the skill editor all sat under a breadcrumb reading "Dashboard", which is
  // worse than no breadcrumb at all (founder-reported 2026-09-03).
  //
  // The library routes live in AGENT_SUB_NAV, not NAV, which is why they fell
  // through. Longest matching prefix wins, so /library/skills/:id/edit resolves
  // to Skills rather than to whatever happens to be listed first.
  const headerLabel = useMemo(() => {
    const candidates = [
      ...activeNav.map((n) => ({ to: n.to, label: n.label })),
      ...AGENT_SUB_NAV.map((n) => ({ to: n.to, label: n.label })),
    ]
    const exact = candidates.find((c) => location.pathname === c.to)
    if (exact) return exact.label
    const prefixed = candidates
      .filter((c) => location.pathname.startsWith(c.to + '/'))
      .sort((a, b) => b.to.length - a.to.length)[0]
    if (prefixed) return prefixed.label
    // Nothing matched: say nothing rather than name the wrong page.
    return ''
  }, [activeNav, location.pathname])
  // Iris's chat history/New-chat/search render INLINE inside this same navy
  // nav (as the "Iris" item's sub-nav, same shape as Agents' AGENT_SUB_NAV)
  // instead of a separate light sidebar next to it — one merged sidebar, per
  // founder's explicit correction (2026-08-06, UX+PM+EM approved: "One rail,
  // one grammar" — every row here, chat session included, is a plain NavLink
  // treatment). Iris pins the rail permanently expanded since the whole
  // point is showing labels/history — never writes COLLAPSE_KEY, so a
  // manually-collapsed rail elsewhere in the app is untouched after leaving
  // Iris.
  const isIrisRoute = location.pathname === '/templates/iris'
  const irisSidebar = useIrisSidebarStore()

  // Whether the sidebar is showing full labels right now (persisted collapse
  // state OFF, or hovering the rail while collapsed, or pinned open on
  // Iris). Mobile drawer always shows full labels regardless of desktop
  // collapse.
  const showExpanded = isIrisRoute || !collapsed || railHover
  const iconOnly = !showExpanded && !mobileOpen
  const floating = !isIrisRoute && collapsed && railHover && !mobileOpen

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
    <div className="flex h-dvh flex-col bg-background">
      {/* Client Command Bar (roadmap item 45) — one continuous frame with the
          sidebar below (DESIGN.md §0 move 2, amended 2026-08-06): normal flow
          at the very top, full width, so the sidebar (fixed, offset by this
          bar's height via top-11 below) starts exactly where this bar ends —
          same navy, no seam, no border between them. */}
      <ClientCommandBar />

      <div className="relative flex flex-1 overflow-hidden">
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
        onMouseEnter={() => !isIrisRoute && collapsed && setRailHover(true)}
        onMouseLeave={() => setRailHover(false)}
        className={cn(
          'fixed left-0 top-11 bottom-0 z-40 flex flex-col bg-gradient-to-b from-ink to-black transition-transform duration-200 md:transition-[width]',
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
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-teal-solid transition-transform duration-150 ease-out group-hover:scale-110">
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
        {/* min-h-0 + overflow-y-auto, not just flex-1: a flex child will not
            shrink below its content without min-h-0, so before this the rail
            did not scroll — it pushed the account block and Sign out past the
            bottom of the viewport, unreachable. Adding the Library group put
            expanded content at ~636px against ~616px on a 1366x768 laptop,
            which is what most of these users are on (DESIGN.md §0.1). */}
        {/* Named so a test can target this nav specifically — there is only one
            today, and a second would otherwise break every selector silently. */}
        <nav
          aria-label="Main"
          className={cn('min-h-0 flex-1 space-y-1 overflow-y-auto py-4', iconOnly ? 'px-2' : 'px-3')}
        >
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

              {/* Agents sub-nav. Renders in BOTH rail states — collapsed it
                  borrows the main nav's own grammar one row up (icon +
                  `title` + sr-only label) rather than inventing a second one.
                  It used to be gated on `!iconOnly`, which meant collapsing
                  the rail deleted four destinations with no trace of them.

                  Headed "Library" because that is what they are: these route
                  to account-wide /library/* pages, never to an agent, so
                  reading as four unlabelled rows under "Agents" sent anyone
                  hunting for their uploaded files to the wrong place. */}
              {to === '/agents' && (
                <div
                  role="group"
                  aria-labelledby="nav-library-heading"
                  className={cn('space-y-1', iconOnly ? 'mt-2' : 'mt-1')}
                >
                  {/* Always rendered, visually hidden in the 64px rail where no
                      word fits. It used to be dropped entirely when collapsed,
                      so a screen-reader user heard twelve flat sibling links —
                      the same defect this change exists to fix, reproduced in
                      the audio channel. Caption token per DESIGN.md §4 (11px
                      Medium, +6%); white/50 is 5.33:1 — white/30 is this file's
                      DISABLED shade (used for "Soon") and computes to 2.59:1. */}
                  <p
                    id="nav-library-heading"
                    className={cn(
                      'text-[11px] font-medium uppercase tracking-[0.06em] text-white/50',
                      iconOnly ? 'sr-only' : 'pl-11 pr-3 pt-2',
                    )}
                  >
                    Library
                  </p>
                  {/* Collapsed, every row is centred, so indentation cannot show
                      where the group starts. A rule above it opened the group
                      and nothing closed it — which read as a NEW top-level group
                      swallowing Reports and everything below. Bounded both ends,
                      and the inset active pill below is what carries the
                      nesting. */}
                  {iconOnly && <div className="mx-auto h-px w-6 bg-white/10" aria-hidden="true" />}
                  {AGENT_SUB_NAV.map(({ tab, icon: SubIcon, label: subLabel, to: subTo }) => {
                    const isActive = location.pathname === subTo
                    return (
                      <NavLink
                        key={tab}
                        to={subTo}
                        title={iconOnly ? subLabel : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg py-2 text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60',
                          // Inset when collapsed: a 32px active pill against a
                          // main item's 48px is the nesting cue a user actually
                          // sees at 64px. mx-2, not mx-2.5 — DESIGN.md §3 is a
                          // strict 4px grid and 10px is off it.
                          iconOnly ? 'mx-2 justify-center px-0' : 'pl-11 pr-3',
                          isActive
                            ? 'bg-white/15 text-white'
                            : 'text-white/50 hover:bg-white/10 hover:text-white/80',
                        )}
                      >
                        <SubIcon className="h-3.5 w-3.5 shrink-0" />
                        {iconOnly ? (
                          <span className="sr-only">{subLabel}</span>
                        ) : (
                          // A label longer than "Business Persona" would wrap
                          // and break the row height without this.
                          <span className="truncate">{subLabel}</span>
                        )}
                      </NavLink>
                    )
                  })}
                  {/* Closes the group. Without this the rule above reads as the
                      start of a new top-level section running to the bottom. */}
                  {iconOnly && <div className="mx-auto h-px w-6 bg-white/10" aria-hidden="true" />}
                </div>
              )}

              {/* Iris sub-nav — New chat + search + session history, same
                  shape as Agents' sub-nav above ("One rail, one grammar":
                  chat sessions are switchers, styled as plain nav rows, not
                  a distinct light-panel sidebar). Iris is always expanded on
                  this route, so no iconOnly guard needed here. */}
              {to === '/templates/iris' && isIrisRoute && (
                <div className="mt-1 space-y-1 pl-3 pr-1">
                  <button
                    type="button"
                    onClick={() => irisSidebar.onNewChat?.()}
                    className="flex w-full items-center gap-3 rounded-lg py-2 pl-8 pr-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    New chat
                  </button>

                  <div className="relative pl-8">
                    <Search className="absolute left-10 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                    <input
                      type="text"
                      value={irisSidebar.searchQuery}
                      onChange={(e) => irisSidebar.setSearchQuery(e.target.value)}
                      placeholder="Search chats…"
                      className="w-full rounded-lg border border-white/10 bg-white/10 py-1.5 pl-7 pr-2.5 text-sm text-white placeholder:text-white/40 outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    />
                  </div>

                  <div className="space-y-0.5">
                    {irisSidebar.loading && (
                      <Loader2 className="mx-auto mt-2 h-4 w-4 animate-spin text-white/40" />
                    )}
                    {!irisSidebar.loading && (() => {
                      const filtered = irisSidebar.sessions.filter((s) =>
                        (s.title ?? 'New chat').toLowerCase().includes(irisSidebar.searchQuery.toLowerCase())
                      )
                      if (filtered.length === 0) {
                        return (
                          <p className="py-2 pl-8 text-xs text-white/40">
                            {irisSidebar.searchQuery ? `No chats match "${irisSidebar.searchQuery}".` : 'No chats yet.'}
                          </p>
                        )
                      }
                      // DESIGN.md's session-sidebar rule: 5 most recent only,
                      // "View all chats" for the rest — was previously
                      // rendering every session unfiltered (2026-08-12 fix,
                      // Figma node 108:2).
                      return filtered.slice(0, 5).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => irisSidebar.onSelect?.(s.id)}
                          className={cn(
                            'block w-full truncate rounded-lg py-2 pl-8 pr-3 text-left text-sm transition-colors',
                            s.id === irisSidebar.activeId
                              ? 'bg-white/15 text-white'
                              : 'text-white/50 hover:bg-white/10 hover:text-white/80',
                          )}
                        >
                          {s.title ?? 'New chat'}
                        </button>
                      ))
                    })()}
                  </div>

                  {!irisSidebar.loading && irisSidebar.sessions.length > 0 && (
                    <Link
                      to="/templates/iris/all"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-1.5 rounded-lg py-2 pl-8 pr-3 text-sm text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
                    >
                      View all chats
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  )}
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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-teal-solid text-xs font-semibold text-white"
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
          so a hover-peek floats over content instead of shifting it. Iris is
          pinned expanded (see showExpanded above), so it needs pl-60 too —
          this line still said pl-16 for isIrisRoute from the earlier
          icon-only-rail attempt, which is stale now that the rail actually
          renders at full width there; that mismatch was the content-hidden-
          under-the-sidebar bug. */}
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden transition-[padding] duration-200',
          collapsed && !isIrisRoute ? 'md:pl-16' : 'md:pl-60',
        )}
      >
        {/* Topbar */}
        <header className="flex h-16 items-center justify-between border-b bg-card px-4">
          <div className="flex items-center gap-3">
            {/* Desktop: collapse rail. Mobile: open drawer. Hidden on Iris —
                the rail is forced icon-only there, nothing to toggle. */}
            {!isIrisRoute && (
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
            )}
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
              <span className="font-medium text-foreground">{headerLabel}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex items-center gap-3 pr-2">
            <span className="text-sm text-muted-foreground">{user?.name}</span>
          </div>
        </header>

        {/* Page content — ErrorBoundary keyed on the route so a crashed
            page's error state resets on navigation instead of sticking. */}
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        </div>
      </div>
    </div>
  )
}
