'use client'

interface LagData {
  node_id: string
  role: string
  state: string
  current_log_index: number
  committed_log_index: number
  lag: number
  last_heartbeat: string | null
}

interface ReplicationLagProps {
  data: LagData[]
}

export default function ReplicationLag({ data }: ReplicationLagProps) {
  const maxLag = Math.max(...data.map(d => d.lag), 1)

  return (
    <div className="space-y-4">
      {data.map(node => {
        const pct = Math.min((node.lag / maxLag) * 100, 100)
        const lagColor = node.lag === 0 ? 'bg-success' : node.lag <= 2 ? 'bg-warning' : 'bg-error'
        const stateColor = node.state === 'healthy' ? 'text-success' : node.state === 'partitioned' ? 'text-error' : 'text-warning'

        return (
          <div key={node.node_id} className="bg-surface border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{node.node_id.toUpperCase()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${node.role === 'leader' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-secondary'}`}>
                  {node.role}
                </span>
                <span className={`text-xs ${stateColor}`}>{node.state}</span>
              </div>
              <div className="text-right text-sm">
                <span className="text-text-secondary">Lag: </span>
                <span className={node.lag === 0 ? 'text-success' : 'text-warning font-bold'}>{node.lag} entries</span>
              </div>
            </div>
            <div className="w-full bg-border/30 rounded-full h-2 mb-2">
              <div className={`h-2 rounded-full transition-all ${lagColor}`} style={{ width: `${node.role === 'leader' ? 100 : Math.max(100 - pct, 5)}%` }} />
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>Log: {node.current_log_index} / Committed: {node.committed_log_index}</span>
              <span>{node.last_heartbeat ? `${Math.round((Date.now() - new Date(node.last_heartbeat).getTime()) / 1000)}s ago` : 'N/A'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
