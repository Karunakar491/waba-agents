import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

export interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

const STORAGE_KEY = 'template-studio-waba'

// Shared across all Template Studio sections (Iris/Templates/Settings)
// so picking a WABA on one page keeps it selected when switching sections —
// each page used to hold this in isolated local state before the nav split.
export function useSelectedWaba() {
  const { data: wabas = [], isLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const [selectedWabaId, setSelectedWabaIdState] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || '')

  function setSelectedWabaId(id: string) {
    setSelectedWabaIdState(id)
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  const validSelectedId = wabas.some((w) => w.id === selectedWabaId) ? selectedWabaId : ''

  return { wabas, isLoading, selectedWabaId: validSelectedId, setSelectedWabaId }
}
