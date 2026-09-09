/**
 * The headers this request will carry that nobody types here.
 *
 * Postman greys in `Content-Type`, `Host` and `Content-Length` above the
 * editable rows, and the founder pointed at exactly that. Ours are different
 * but the reason is the same: without them a technical user adds a
 * `Content-Type` header by hand, and we ignore it.
 *
 * - `Content-Type` — Meta's `content_type` is an enum with a single member,
 *   `application/json`. Not ours to change, and not the user's.
 * - the connector's credential headers — they come from `auth_config` and are
 *   added by Meta at call time. Their values are typed at publish and never
 *   stored by us, so there is nothing to show but the name.
 *
 * Read-only on purpose. A row you cannot edit is honest; an editable row whose
 * value gets overwritten is not.
 */
export default function AutoHeaders({ authHeaders }: { authHeaders: string[] }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-xs font-medium text-muted-foreground">Sent automatically</span>
      <div className="overflow-hidden rounded-lg border border-dashed">
        <table className="w-full border-collapse text-xs">
          <tbody className="text-muted-foreground">
            <tr className="border-b last:border-b-0">
              <td className="w-1/3 px-3 py-2 font-mono">Content-Type</td>
              <td className="px-3 py-2 font-mono">application/json</td>
              <td className="px-3 py-2">Meta accepts no other value</td>
            </tr>
            {authHeaders.map((name) => (
              <tr key={name} className="border-b last:border-b-0">
                <td className="w-1/3 px-3 py-2 font-mono">{name}</td>
                <td className="px-3 py-2 italic">set when you publish</td>
                <td className="px-3 py-2">From the connector&apos;s Authorization</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
