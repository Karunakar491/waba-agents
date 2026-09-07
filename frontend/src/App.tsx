import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AgentsPage from './pages/AgentsPage'
import CreateAgentPage from './pages/CreateAgentPage'
import AgentDetailPage from './pages/AgentDetailPage'
import SkillLibraryPage from './pages/SkillLibraryPage'
import SkillEditPage from './pages/SkillEditPage'
import BusinessPersonaLibraryPage from './pages/BusinessPersonaLibraryPage'
import ConnectorWorkbenchPage from './pages/ConnectorWorkbenchPage'
import FileLibraryPage from './pages/FileLibraryPage'
import ReportsPage from './pages/ReportsPage'
import DebugPage from './pages/DebugPage'
import WabasPage from './pages/WabasPage'
import WabaDetailPage from './pages/WabaDetailPage'
import InboxPage from './pages/InboxPage'
import HumanHandoverPage from './pages/HumanHandoverPage'
import ProfilePage from './pages/ProfilePage'
import ModuleSelectorPage from './pages/ModuleSelectorPage'
import TemplateStudioPage from './pages/TemplateStudioPage'
import TemplateIrisPage from './pages/TemplateIrisPage'
import TemplateIrisAllChatsPage from './pages/TemplateIrisAllChatsPage'
import TemplateSettingsPage from './pages/TemplateSettingsPage'
import TemplateDebugPage from './pages/TemplateDebugPage'
import NotFoundPage from './pages/NotFoundPage'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/router/ProtectedRoute'
import { ActionFeedbackProvider } from './components/shared/ActionFeedback'
import { useModuleEntitlements, type ModuleName } from './hooks/useModuleEntitlements'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
})

// Maps a module to where it lands when it's the operator's only enabled
// feature (skip the selector entirely — PM: zero friction for the common
// case, which is 100% of accounts today since only BUSINESS_AGENTS exists).
const MODULE_HOME_ROUTE: Record<ModuleName, string> = {
  BUSINESS_AGENTS: '/dashboard',
  TEMPLATE_STUDIO: '/templates',
}

/**
 * "/" only — decides where an authenticated operator lands. Reads the SAME
 * cached entitlements query ProtectedRoute already fetched (no extra
 * network call). Every OTHER route (bookmarks, deep-links, sessionStorage
 * last-agent:{tab} resume) bypasses this entirely — this is the post-login
 * default, not a checkpoint on navigation.
 *
 * postLogin state (2026-08-13, founder: "when a user logs in, all the
 * webhooks related to the WABA should be displayed") — set only by
 * useLogin's navigate('/', { state: { postLogin: true } }), never by a
 * bookmark/deep-link/refresh landing on "/". Deliberately NOT a hardcoded
 * destination change to MODULE_HOME_ROUTE itself — that would silently
 * change what every later visit to "/" does, not just the moment right
 * after signing in, and would bypass the module-resolution fix from
 * 2026-08-04 this function exists to do. Only redirects to Webhooks for the
 * module that actually has an Inbox (BUSINESS_AGENTS); forwarded through
 * /select for the (currently unused) multi-module case — see
 * ModuleSelectorPage.
 */
function RootRedirect() {
  const { data: entitlements, isLoading } = useModuleEntitlements()
  const location = useLocation()
  const postLogin = Boolean((location.state as { postLogin?: boolean } | null)?.postLogin)

  if (isLoading) {
    return (
      <div className="flex h-dvh w-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const enabledModules = (Object.keys(MODULE_HOME_ROUTE) as ModuleName[]).filter((m) => entitlements?.[m])
  if (enabledModules.length === 1) {
    const mod = enabledModules[0]
    if (postLogin && mod === 'BUSINESS_AGENTS') {
      return <Navigate to="/inbox?view=webhooks" replace />
    }
    return <Navigate to={MODULE_HOME_ROUTE[mod]} replace />
  }
  // 0 enabled is handled by ProtectedRoute's lock screen before this ever
  // renders; 2+ enabled shows the selector.
  return <Navigate to="/select" state={postLogin ? { postLogin: true } : undefined} replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Wraps the router so a confirmation survives the navigation that often
          follows the action it is confirming. */}
      <ActionFeedbackProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/"       element={<RootRedirect />} />
            <Route path="/select" element={<ModuleSelectorPage />} />

            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/templates" element={<TemplateStudioPage />} />
              <Route path="/templates/iris" element={<TemplateIrisPage />} />
              <Route path="/templates/iris/all" element={<TemplateIrisAllChatsPage />} />
              <Route path="/templates/settings" element={<TemplateSettingsPage />} />
              <Route path="/templates/debug" element={<TemplateDebugPage />} />
              <Route path="/agents"   element={<AgentsPage />} />
              <Route path="/agents/new" element={<CreateAgentPage />} />
              <Route path="/agents/:id" element={<AgentDetailPage />} />
              <Route path="/library/skills" element={<SkillLibraryPage />} />
              <Route path="/library/skills/:skillId/edit" element={<SkillEditPage />} />
              {/* Merged into SkillLibraryPage as a tab (2026-08-05) — kept as a
                  redirect, not a dead route, so any bookmarked/shared link
                  still lands somewhere useful instead of 404ing. */}
              <Route path="/library/skills/browse" element={<Navigate to="/library/skills?tab=browse" replace />} />
              <Route path="/library/persona" element={<BusinessPersonaLibraryPage />} />
              {/* The workbench is the Connectors screen: the sidebar is the whole list, so
                  there is no separate two-table page to land on first. */}
              <Route path="/library/connectors" element={<ConnectorWorkbenchPage />} />
              <Route path="/library/connectors/:connectorId" element={<ConnectorWorkbenchPage />} />
              <Route path="/library/connectors/:connectorId/actions/:actionId" element={<ConnectorWorkbenchPage />} />
              <Route path="/library/files" element={<FileLibraryPage />} />
              <Route path="/reports"  element={<ReportsPage />} />
              <Route path="/debug"    element={<DebugPage />} />
              <Route path="/wabas"    element={<WabasPage />} />
              <Route path="/wabas/:wabaId" element={<WabaDetailPage />} />
              <Route path="/inbox"    element={<InboxPage />} />
              <Route path="/handover" element={<HumanHandoverPage />} />
              <Route path="/profile"  element={<ProfilePage />} />
              <Route path="/settings"  element={<Navigate to="/profile" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      </ActionFeedbackProvider>
    </QueryClientProvider>
  )
}
