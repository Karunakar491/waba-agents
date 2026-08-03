import { MessageSquare } from 'lucide-react'

// Iris — Template Studio's chat-based assistant (2026-08-04). PLACEHOLDER
// ONLY, same honest-placeholder pattern used for the Campaigns page it
// replaced in the nav. Design is approved (mockup iterated with the
// founder); no backend exists yet — the tool-calling loop against Claude
// (ClaudeApiClient, already used by Task A's wizard) that drives real
// template/send actions through TemplateStudioService is a separate,
// not-yet-started build.
export default function TemplateIrisPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Iris</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe a template you want to create, or a send you want to launch, in plain language.
        </p>
      </div>

      <div className="rounded-xl border border-dashed bg-card p-8 text-center space-y-2">
        <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Iris is being built next</p>
        <p className="text-xs text-muted-foreground">
          The conversation flow and live confirm-before-submit preview are designed — this page will go live here
          once the backend exists.
        </p>
      </div>
    </div>
  )
}
