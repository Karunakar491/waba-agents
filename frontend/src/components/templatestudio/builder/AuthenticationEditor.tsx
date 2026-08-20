import { AUTH_BODY_TEXT } from '../templateModel'

export function otpCodeLooksValid(code: string): boolean {
  return /^[a-zA-Z0-9]{4,15}$/.test(code.trim())
}

// Extracted from TemplateBuilderForm.tsx (V2 rebrand slice 7).
export default function AuthenticationEditor({ codeExpirationMinutes, setCodeExpirationMinutes, otpExampleCode, setOtpExampleCode }: {
  codeExpirationMinutes: number
  setCodeExpirationMinutes: (n: number) => void
  otpExampleCode: string
  setOtpExampleCode: (v: string) => void
}) {
  const codeFormatOk = !otpExampleCode.trim() || otpCodeLooksValid(otpExampleCode)
  return (
    <div className="space-y-3 rounded-lg border border-dashed p-3">
      <p className="text-xs text-muted-foreground">
        Authentication templates follow Meta&apos;s OTP rules — body is the code slot only ({AUTH_BODY_TEXT}); no freeform header/footer.
        This form submits COPY_CODE only (ONE_TAP / ZERO_TAP deferred).
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Code expiration (minutes)</label>
        <input
          type="number"
          min={1}
          max={90}
          value={codeExpirationMinutes}
          onChange={(e) => setCodeExpirationMinutes(Number(e.target.value))}
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground">Example code (for Meta&apos;s review)</label>
        <input
          type="text"
          value={otpExampleCode}
          onChange={(e) => setOtpExampleCode(e.target.value)}
          placeholder="123456"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-teal-solid focus-visible:ring-offset-2"
        />
        {!codeFormatOk && (
          <p className="mt-1 text-xs text-warning">Example code should be 4-15 letters/numbers only.</p>
        )}
      </div>
    </div>
  )
}
