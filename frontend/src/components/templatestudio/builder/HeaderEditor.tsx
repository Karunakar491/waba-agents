import { Loader2 } from 'lucide-react'
import ErrorBanner from '../../shared/ErrorBanner'
import type { HeaderFormat } from '../templateModel'

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function HeaderEditor({ headerFormat, setHeaderFormat, headerText, setHeaderText, headerHandle, mediaError, setMediaError, uploadMediaMutation }: {
  headerFormat: HeaderFormat
  setHeaderFormat: (f: HeaderFormat) => void
  headerText: string
  setHeaderText: (t: string) => void
  headerHandle: string
  mediaError: string | null
  setMediaError: (e: string | null) => void
  uploadMediaMutation: { mutate: (f: File) => void; isPending: boolean }
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3">
      <label className="block text-xs font-medium text-foreground">Header (optional)</label>
      <select
        value={headerFormat}
        onChange={(e) => { setHeaderFormat(e.target.value as HeaderFormat); setMediaError(null) }}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      >
        <option value="NONE">None</option>
        <option value="TEXT">Text</option>
        <option value="IMAGE">Image</option>
        <option value="VIDEO">Video</option>
        <option value="DOCUMENT">Document</option>
      </select>
      {headerFormat === 'TEXT' && (
        <input
          type="text"
          value={headerText}
          onChange={(e) => setHeaderText(e.target.value)}
          placeholder="Header text"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        />
      )}
      {(headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') && (
        <div className="space-y-1">
          <input
            type="file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadMediaMutation.mutate(f) }}
            className="text-sm text-foreground"
          />
          {uploadMediaMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {headerHandle && <p className="text-xs text-accent-teal-solid">Media uploaded.</p>}
          {mediaError && <ErrorBanner error={mediaError} />}
          {headerFormat === 'IMAGE' && (
            <p className="text-xs text-warning">
              Known Karix issue: image header handles can be rejected by Meta (error 2388084) due to a malformed
              type marker on Karix&apos;s side. If submission fails on an image header, this is likely why — not a bug
              in this form.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
