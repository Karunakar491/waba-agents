import { NAME_RE } from '../templateModel'

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7). Focus rings
// normalized to focus-visible:ring-2 ring-accent-teal-solid ring-offset-2
// everywhere in this split — the original had an inconsistent extra
// `focus-visible:border-primary transition` on some inputs but not others;
// dropped rather than preserved, since it wasn't a deliberate pattern to
// begin with (EM-flagged during the decomposition plan review).
export default function TemplateMetaFields({ templateName, setTemplateName, language, setLanguage, category, setCategory }: {
  templateName: string; setTemplateName: (v: string) => void
  language: string; setLanguage: (v: string) => void
  category: string; setCategory: (v: string) => void
}) {
  const nameHint = templateName && !NAME_RE.test(templateName)
    ? 'Meta requires lowercase letters, numbers, and underscores only.'
    : templateName.length > 512
      ? 'Meta limits names to 512 characters.'
      : null

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Template name</label>
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="order_shipped"
            maxLength={512}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          />
          {nameHint && <p className="mt-1 text-xs text-warning">{nameHint}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Language</label>
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="en"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          <option value="UTILITY">Utility</option>
          <option value="MARKETING">Marketing</option>
          <option value="AUTHENTICATION">Authentication</option>
        </select>
      </div>
    </>
  )
}
