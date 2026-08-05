import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

// A standalone account-wide Human Handover dashboard isn't built yet — but
// unlike the old stub, this isn't a dead end (DESIGN.md's empty-state rule:
// a next-action prompt, never a bare "coming soon"). The real mechanism
// already exists per-agent: when handoff is enabled, AgentDetailPage's
// Thread Control release action is the actual handoff control today.
export default function HumanHandoverPage() {
  return (
    <div className="max-w-lg space-y-3 py-12">
      <h1 className="text-2xl font-bold text-foreground">Human Handover</h1>
      <p className="text-sm text-muted-foreground">
        An account-wide handover dashboard isn't built yet. Today, handoff is managed per agent —
        open an agent with handoff enabled and use its Thread Control action to release a
        conversation back to a human.
      </p>
      <Link
        to="/agents"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Go to Agents
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
