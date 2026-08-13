import { useState } from 'react'
import { Tag } from 'lucide-react'
import { NAME_RE } from '../templateModel'

const CATEGORY_LABEL: Record<string, string> = {
  UTILITY: 'Utility',
  MARKETING: 'Marketing',
  AUTHENTICATION: 'Authentication',
}

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

  // Figma node 150:63 "CategoryLocked" — category shows as a summary pill
  // with an explicit Change action rather than a bare always-open select,
  // since most templates never change category after the first pick.
  const [changingCategory, setChangingCategory] = useState(false)

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
      {changingCategory ? (
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Category</label>
          <select
            value={category}
            autoFocus
            onChange={(e) => { setCategory(e.target.value); setChangingCategory(false) }}
            onBlur={() => setChangingCategory(false)}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <option value="UTILITY">Utility</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Authentication</option>
          </select>
        </div>
      ) : (
        <div className="flex w-full items-center justify-between rounded-lg border bg-background px-3 py-2">
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-foreground" />
            <span className="text-sm font-medium text-foreground">{CATEGORY_LABEL[category] ?? category}</span>
          </div>
          <button
            type="button"
            onClick={() => setChangingCategory(true)}
            className="text-xs font-medium text-accent-teal-solid hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            Change
          </button>
        </div>
      )}
    </>
  )
}
