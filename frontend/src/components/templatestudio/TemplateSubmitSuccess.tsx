import { Check } from 'lucide-react'

// Figma node 99:2 "3.8 — Templates: Submit Success" — create-mode only,
// shown in place of the form once a create submission succeeds.
export default function TemplateSubmitSuccess({
  templateName, onBackToTemplates, onCreateAnother,
}: {
  templateName: string
  onBackToTemplates: () => void
  onCreateAnother: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-teal">
        <Check className="h-7 w-7 text-white" />
      </div>
      <div className="max-w-[400px] space-y-2">
        <p className="text-xl font-semibold text-foreground">Template submitted for review</p>
        <p className="text-sm text-muted-foreground">
          {templateName || 'Your template'} is now with Meta. Reviews typically take 1–24 hours — you'll see
          the status update on the Templates page.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBackToTemplates}
          className="rounded-lg bg-accent-teal-solid px-5 py-3 text-sm font-medium text-white shadow-surface-resting transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          Back to Templates
        </button>
        <button
          type="button"
          onClick={onCreateAnother}
          className="rounded-lg border bg-background px-5 py-3 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          Create another
        </button>
      </div>
    </div>
  )
}
