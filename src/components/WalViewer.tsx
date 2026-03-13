'use client'

interface WalEntry {
  id: number
  node_id: string
  log_index: number
  operation: string
  key: string
  value: string | null
  term: number
  timestamp: string | null
  replicated_to: string[] | null
}

interface WalViewerProps {
  entries: WalEntry[]
  highlightIndex?: number
}

export default function WalViewer({ entries, highlightIndex }: WalViewerProps) {
  const allNodes = ['n1', 'n2', 'n3']

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-text-secondary py-2 px-3 font-medium">Index</th>
            <th className="text-left text-text-secondary py-2 px-3 font-medium">Op</th>
            <th className="text-left text-text-secondary py-2 px-3 font-medium">Key</th>
            <th className="text-left text-text-secondary py-2 px-3 font-medium">Value</th>
            <th className="text-left text-text-secondary py-2 px-3 font-medium">Term</th>
            <th className="text-left text-text-secondary py-2 px-3 font-medium">Time</th>
            <th className="text-left text-text-secondary py-2 px-3 font-medium">Replicated</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(entry => {
            const isHighlighted = entry.log_index === highlightIndex
            return (
              <tr
                key={entry.id}
                className={`border-b border-border/50 transition-colors ${
                  isHighlighted ? 'bg-accent/10' : 'hover:bg-white/5'
                }`}
              >
                <td className="py-2 px-3 text-accent font-mono font-bold">{entry.log_index}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    entry.operation === 'put' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'
                  }`}>
                    {entry.operation.toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-3 text-white font-mono text-xs">{entry.key}</td>
                <td className="py-2 px-3 text-text-secondary font-mono text-xs max-w-32 truncate">
                  {entry.value ?? <span className="text-error italic">tombstone</span>}
                </td>
                <td className="py-2 px-3 text-text-secondary">{entry.term}</td>
                <td className="py-2 px-3 text-text-secondary text-xs">
                  {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '-'}
                </td>
                <td className="py-2 px-3">
                  <div className="flex gap-1">
                    {allNodes.map(n => (
                      <span
                        key={n}
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          entry.replicated_to?.includes(n)
                            ? 'bg-success/20 text-success'
                            : 'bg-border text-text-secondary'
                        }`}
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {entries.length === 0 && (
        <div className="text-text-secondary text-center py-8">No WAL entries found</div>
      )}
    </div>
  )
}
