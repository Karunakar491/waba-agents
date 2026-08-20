import { cn } from '../../../lib/utils'
import { BODY_MAX, extractVariables } from '../templateModel'

export function bodyLeadingTrailingVariable(bodyText: string): boolean {
  const trimmed = bodyText.trim()
  const startsWithVar = /^\{\{\s*\w+\s*\}\}/.test(trimmed)
  const endsWithVar = /\{\{\s*\w+\s*\}\}$/.test(trimmed)
  return startsWithVar || endsWithVar
}

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function BodyEditor({ bodyText, setBodyText, bodyExamples, setBodyExamples }: {
  bodyText: string
  setBodyText: (t: string) => void
  bodyExamples: Record<string, string>
  setBodyExamples: (updater: (prev: Record<string, string>) => Record<string, string>) => void
}) {
  const hasLeadingOrTrailingVar = bodyLeadingTrailingVariable(bodyText)
  const overMax = bodyText.length > BODY_MAX

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-foreground">Body text</label>
        <span className={cn('text-[11px] tabular-nums', overMax ? 'text-destructive' : 'text-muted-foreground')}>
          {bodyText.length}/{BODY_MAX}
        </span>
      </div>
      <textarea
        rows={4}
        value={bodyText}
        onChange={(e) => setBodyText(e.target.value)}
        placeholder="Hi {{1}}, your order has shipped."
        maxLength={BODY_MAX}
        className="w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      />
      {hasLeadingOrTrailingVar && (
        <p className="mt-1 text-xs text-warning">
          Meta rejects bodies that start or end with a variable — add real text before and after.
        </p>
      )}
      {extractVariables(bodyText).map((v) => (
        <div key={v} className="mt-2 flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">{'{{' + v + '}}'} =</span>
          <input
            type="text"
            value={bodyExamples[v] || ''}
            onChange={(e) => setBodyExamples((prev) => ({ ...prev, [v]: e.target.value }))}
            placeholder="Example value (required by Meta)"
            className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          />
        </div>
      ))}
    </div>
  )
}
