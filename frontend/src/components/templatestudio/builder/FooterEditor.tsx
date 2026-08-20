import { cn } from '../../../lib/utils'

export const FOOTER_MAX = 60

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function FooterEditor({ footerText, setFooterText }: { footerText: string; setFooterText: (t: string) => void }) {
  const overMax = footerText.length > FOOTER_MAX
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="block text-xs font-medium text-foreground">Footer (optional)</label>
        <span className={cn('text-[11px] tabular-nums', overMax ? 'text-destructive' : 'text-muted-foreground')}>
          {footerText.length}/{FOOTER_MAX}
        </span>
      </div>
      <input
        type="text"
        value={footerText}
        onChange={(e) => setFooterText(e.target.value)}
        placeholder="Footer text"
        maxLength={FOOTER_MAX}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      />
    </div>
  )
}
