// Step 3 of the Create flow (Figma node 172:53 "Submit for Review") —
// extracted from TemplateBuilderForm.tsx to keep that file under the
// 200-line component ceiling.
export default function ReviewSummary({ templateName, language, category, bodyText }: {
  templateName: string; language: string; category: string; bodyText: string
}) {
  return (
    <div className="space-y-2 rounded-lg border border-dashed p-3 text-sm">
      <p className="text-xs font-medium tracking-[0.06em] text-muted-foreground">REVIEW BEFORE SUBMITTING</p>
      <p><span className="font-medium text-foreground">Name</span> <span className="text-muted-foreground">{templateName}</span></p>
      <p><span className="font-medium text-foreground">Language</span> <span className="text-muted-foreground">{language}</span></p>
      <p><span className="font-medium text-foreground">Category</span> <span className="text-muted-foreground">{category}</span></p>
      <p className="text-xs text-muted-foreground">
        This cannot be undone once submitted — Meta review can take up to 24 hours. Check the live preview on the right before continuing.
      </p>
      {!bodyText.trim() && (
        <p className="text-xs text-destructive">Go back to Step 2 — the body text is empty.</p>
      )}
    </div>
  )
}
