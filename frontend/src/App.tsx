import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AgentsPage from './pages/AgentsPage'
import CreateAgentPage from './pages/CreateAgentPage'
import AgentDetailPage from './pages/AgentDetailPage'
import InboxPage from './pages/InboxPage'
import HumanHandoverPage from './pages/HumanHandoverPage'
import ProfilePage from './pages/ProfilePage'
import AppShell from './components/layout/AppShell'
import ProtectedRoute from './components/router/ProtectedRoute'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/"         element={<Navigate to="/agents" replace />} />
              <Route path="/agents"   element={<AgentsPage />} />
              <Route path="/agents/new" element={<CreateAgentPage />} />
              <Route path="/agents/:id" element={<AgentDetailPage />} />
              <Route path="/inbox"    element={<InboxPage />} />
              <Route path="/handover" element={<HumanHandoverPage />} />
              <Route path="/profile"  element={<ProfilePage />} />
              {/* Backward compat */}
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/settings"  element={<Navigate to="/profile" replace />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/agents" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
