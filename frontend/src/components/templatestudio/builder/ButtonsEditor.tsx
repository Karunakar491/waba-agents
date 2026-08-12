import { Plus, Trash2 } from 'lucide-react'
import type { ButtonDraft, ButtonType } from '../templateModel'

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7). Added
// focus-visible to every select/input/button below — the original had
// none anywhere in this component, a gap independent of the token swap.
export default function ButtonsEditor({ buttons, setButtons }: {
  buttons: ButtonDraft[]
  setButtons: (updater: (prev: ButtonDraft[]) => ButtonDraft[]) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground">Buttons (optional)</label>
        <button
          type="button"
          onClick={() => setButtons((prev) => [...prev, { type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '', code: '' }])}
          className="flex items-center gap-1 rounded text-xs text-accent-teal-solid hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" /> Add button
        </button>
      </div>
      {buttons.map((b, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            value={b.type}
            onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, type: e.target.value as ButtonType } : x)))}
            className="rounded-lg border bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          >
            <option value="QUICK_REPLY">Quick reply</option>
            <option value="URL">URL</option>
            <option value="PHONE_NUMBER">Phone</option>
            <option value="COPY_CODE">Copy offer code</option>
          </select>
          <input
            type="text"
            value={b.text}
            onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            placeholder="Button text"
            className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
          />
          {b.type === 'URL' && (
            <input
              type="text"
              value={b.url}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
              placeholder="https://…"
              className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            />
          )}
          {b.type === 'PHONE_NUMBER' && (
            <input
              type="text"
              value={b.phoneNumber}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, phoneNumber: e.target.value } : x)))}
              placeholder="+911234567890"
              className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            />
          )}
          {b.type === 'COPY_CODE' && (
            <input
              type="text"
              value={b.code}
              onChange={(e) => setButtons((prev) => prev.map((x, j) => (j === i ? { ...x, code: e.target.value } : x)))}
              placeholder="Example code, e.g. CARIBE25"
              maxLength={15}
              className="min-w-[8rem] flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            />
          )}
          <button
            type="button"
            onClick={() => setButtons((prev) => prev.filter((_, j) => j !== i))}
            className="rounded-lg border p-1.5 text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
            aria-label="Remove button"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
