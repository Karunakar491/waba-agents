import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import type { BusinessProfileResponse } from '../agent-detail/BusinessProfileTab'
import type { PersonaRow } from './personaTypes'

// Matches WabaDtos.PhoneNumber (GET /waba/{wabaId}/phones) — no wabaId/
// wabaLabel here, unlike the account-wide Dashboard inventory DTO.
interface PhoneEntry {
  phoneNumberId: string
  displayPhoneNumber: string
  verifiedName: string | null
}

interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

/**
 * Account-wide Business Persona rows — drafts (account-wide, no phone
 * number) plus each phone number's live+history, fanned out client-side.
 * Accounts today hold few phone numbers (same accepted assumption as the
 * Dashboard's phone inventory) — this is a small, bounded number of calls,
 * not the "loop over every agent" shape EM ruled out for Connectors. No
 * backend change needed for this table (PM+EM gate, 2026-07-30).
 */
export function usePersonaData() {
  // Multi-WABA switcher deferred (same follow-up as SkillLibraryPage) —
  // default to the first WABA this account has access to.
  const { data: wabas = [] } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const { data: phones = [], isLoading: phonesLoading } = useQuery<PhoneEntry[]>({
    queryKey: ['waba-phones', waba?.id],
    // GET /waba/{wabaId}/phones expects the EXTERNAL Meta WABA id
    // (WabaService.getPhones's wabaRepository.findFirstByWabaIdOrderByIdAsc
    // lookup), not our internal DB row id — confirmed live: passing waba.id
    // here 400'd with "WABA not found" for every WABA. Caught by live
    // verification, not by EL review (which checked query/race correctness,
    // not endpoint-id semantics).
    queryFn: () => api.get(`/waba/${waba!.wabaId}/phones`).then((r) => r.data.data ?? []),
    enabled: !!waba,
  })

  const { data: drafts = [], isLoading: draftsLoading } = useQuery<BusinessProfileResponse[]>({
    queryKey: ['business-profile-drafts'],
    queryFn: () => api.get('/business-profiles/drafts').then((r) => r.data.data ?? []),
  })

  const liveAndHistoryQueries = useQueries({
    queries: phones.map((p) => ({
      queryKey: ['business-profile-live-and-history', p.phoneNumberId],
      queryFn: async () => {
        const [liveRes, historyRes] = await Promise.all([
          api.get('/business-profiles/live', { params: { phoneNumberId: p.phoneNumberId } }),
          api.get('/business-profiles/history', { params: { phoneNumberId: p.phoneNumberId } }),
        ])
        return {
          phone: p,
          live: liveRes.data.data as BusinessProfileResponse | null,
          history: (historyRes.data.data ?? []) as BusinessProfileResponse[],
        }
      },
      enabled: !!waba,
    })),
  })

  const perNumberLoading = phones.length > 0 && liveAndHistoryQueries.some((q) => q.isLoading)

  const rows: PersonaRow[] = useMemo(() => {
    const result: PersonaRow[] = []
    for (const draft of drafts) {
      result.push({ profile: draft, displayPhoneNumber: null, lastTouched: draft.updatedAt })
    }
    for (const q of liveAndHistoryQueries) {
      if (!q.data) continue
      const { phone, live, history } = q.data
      if (live) result.push({ profile: live, displayPhoneNumber: phone.displayPhoneNumber, lastTouched: live.deployedAt })
      for (const h of history) {
        result.push({ profile: h, displayPhoneNumber: phone.displayPhoneNumber, lastTouched: h.archivedAt })
      }
    }
    return result
  }, [drafts, liveAndHistoryQueries])

  return {
    phones,
    rows,
    isLoading: draftsLoading || phonesLoading || perNumberLoading,
  }
}
