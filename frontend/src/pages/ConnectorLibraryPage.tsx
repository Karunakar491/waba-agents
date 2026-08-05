import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import api from '../lib/api'
import { ConnectorsTable, type ConnectorRow } from '../components/connectors/ConnectorsTable'

interface WabaEntry {
  id: string
  wabaId: string
  label: string | null
  status: string
}

export default function ConnectorLibraryPage() {
  const [search, setSearch] = useState('')

  const { data: wabas = [], isLoading: wabasLoading } = useQuery<WabaEntry[]>({
    queryKey: ['wabas'],
    queryFn: () => api.get('/waba').then((r) => r.data.data),
  })
  const waba = wabas[0] ?? null

  const { data: connectors = [], isLoading: connectorsLoading } = useQuery<ConnectorRow[]>({
    queryKey: ['library-connectors', waba?.id],
    queryFn: () => api.get('/connectors', { params: { wabaId: waba!.id } }).then((r) => r.data.data?.connectors ?? []),
    enabled: !!waba,
  })

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return connectors
    return connectors.filter((c) => c.name.toLowerCase().includes(q))
  }, [connectors, search])

  const isLoading = wabasLoading || connectorsLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connectors</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {waba ? `Every connector live on any agent on ${waba.label ?? waba.wabaId}.` : 'Every connector your agents have, in one place.'}
        </p>
      </div>

      {!isLoading && !waba ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 py-20 text-center">
          <p className="font-semibold text-foreground">No WABA connected yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Connect a WABA to see your agents' connectors here.
          </p>
        </div>
      ) : (
        <>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search connectors by name…"
              className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:border-primary transition"
            />
          </div>

          <div className="rounded-xl border bg-card shadow-surface-resting overflow-hidden overflow-x-auto">
            <ConnectorsTable isLoading={isLoading} rows={filteredRows} />
          </div>
        </>
      )}
    </div>
  )
}
