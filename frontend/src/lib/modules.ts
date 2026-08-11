import { Bot, FileText } from 'lucide-react'
import type { ModuleName } from '../hooks/useModuleEntitlements'

export interface ModuleDef {
  key: ModuleName
  label: string
  description: string
  icon: typeof Bot
  homeRoute: string
}

// Single source of truth for module metadata — ModuleSelectorPage and the
// command bar's module switcher pill both render this same list, so a new
// module only needs adding here once.
export const MODULES: ModuleDef[] = [
  {
    key: 'BUSINESS_AGENTS',
    label: 'Business Agents',
    description: 'AI agents on WhatsApp, Messenger, and Instagram — skills, knowledge base, connectors.',
    icon: Bot,
    homeRoute: '/dashboard',
  },
  {
    key: 'TEMPLATE_STUDIO',
    label: 'Template Studio',
    description: 'Create and bulk-import WhatsApp message templates.',
    icon: FileText,
    homeRoute: '/templates',
  },
]

export function activeModuleFor(pathname: string): ModuleName {
  return pathname.startsWith('/templates') ? 'TEMPLATE_STUDIO' : 'BUSINESS_AGENTS'
}
