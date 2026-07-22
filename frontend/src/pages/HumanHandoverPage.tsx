import { Users } from 'lucide-react'

export default function HumanHandoverPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Human Handover</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Your human handover product will be integrated here. This section is coming soon.
      </p>
    </div>
  )
}
