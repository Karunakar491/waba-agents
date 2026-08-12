// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function FooterEditor({ footerText, setFooterText }: { footerText: string; setFooterText: (t: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">Footer (optional)</label>
      <input
        type="text"
        value={footerText}
        onChange={(e) => setFooterText(e.target.value)}
        placeholder="Footer text"
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      />
    </div>
  )
}
