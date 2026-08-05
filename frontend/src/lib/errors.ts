export function extractErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  const data = (err as { response?: { data?: { error?: string; message?: string } } })?.response?.data
  return data?.error ?? data?.message ?? 'Something went wrong. Please try again.'
}
