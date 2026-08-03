import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AgentsPage from './pages/AgentsPage'
import CreateAgentPage from './pages/CreateAgentPage'
import AgentDetailPage from './pages/AgentDetailPage'
import SkillLibraryPage from './pages/SkillLibraryPage'
import SkillTemplateBrowsePage from './pages/SkillTemplateBrowsePage'
import BusinessPersonaLibraryPage from './pages/BusinessPersonaLibraryPage'
import ConnectorLibraryPage from './pages/ConnectorLibraryPage'
import FileLibraryPage from './pages/FileLibraryPage'
import ReportsPage from './pages/ReportsPage'
import WabasPage from './pages/WabasPage'
import InboxPage from './pages/InboxPage'
import HumanHandoverPage from './pages/HumanHandoverPage'
import ProfilePage from './pages/ProfilePage'
import ModuleSelectorPage from './pages/ModuleSelectorPage'
import TemplateStudioPage from './pages/TemplateStudioPage'
import TemplateCampaignsPage from './pages/TemplateCampaignsPage'
import TemplateSettingsPage from './pages/TemplateSettingsPage'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/router/ProtectedRoute'
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
 */
function RootRedirect() {
  const { data: entitlements, isLoading } = useModuleEntitlements()
  if (isLoading) return null

  const enabledModules = (Object.keys(MODULE_HOME_ROUTE) as ModuleName[]).filter((m) => entitlements?.[m])
  if (enabledModules.length === 1) {
    return <Navigate to={MODULE_HOME_ROUTE[enabledModules[0]]} replace />
  }
  // 0 enabled is handled by ProtectedRoute's lock screen before this ever
  // renders; 2+ enabled shows the selector.
  return <Navigate to="/select" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/"       element={<RootRedirect />} />
            <Route path="/select" element={<ModuleSelectorPage />} />

            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/templates" element={<TemplateStudioPage />} />
              <Route path="/templates/campaigns" element={<TemplateCampaignsPage />} />
              <Route path="/templates/settings" element={<TemplateSettingsPage />} />
              <Route path="/agents"   element={<AgentsPage />} />
              <Route path="/agents/new" element={<CreateAgentPage />} />
              <Route path="/agents/:id" element={<AgentDetailPage />} />
              <Route path="/library/skills" element={<SkillLibraryPage />} />
              <Route path="/library/skills/browse" element={<SkillTemplateBrowsePage />} />
              <Route path="/library/persona" element={<BusinessPersonaLibraryPage />} />
              <Route path="/library/connectors" element={<ConnectorLibraryPage />} />
              <Route path="/library/files" element={<FileLibraryPage />} />
              <Route path="/reports"  element={<ReportsPage />} />
              <Route path="/wabas"    element={<WabasPage />} />
              <Route path="/inbox"    element={<InboxPage />} />
              <Route path="/handover" element={<HumanHandoverPage />} />
              <Route path="/profile"  element={<ProfilePage />} />
              <Route path="/settings"  element={<Navigate to="/profile" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
