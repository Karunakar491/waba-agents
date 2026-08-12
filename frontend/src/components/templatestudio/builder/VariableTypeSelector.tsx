import type { VariableFormat } from '../templateModel'

// NEW (Figma node 172:2) — Meta's parameter_format is locked for a
// template's lifetime once created, so this only ever shows in Create
// mode; Edit mode has no way to change it and doesn't render this.
export default function VariableTypeSelector({ value, onChange }: {
  value: VariableFormat
  onChange: (v: VariableFormat) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-foreground">Type of variable</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as VariableFormat)}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
      >
        <option value="NUMBERED">Number — e.g. {'{{1}}'}</option>
        <option value="NAMED">Text — e.g. {'{{customer_name}}'}</option>
      </select>
    </div>
  )
}
