'use client'

interface NodeCardProps {
  node_id: string
  role: string
  state: string
  current_log_index: number
  committed_log_index: number
  last_heartbeat: string | null
  kv_count?: number
}

export default function NodeCard({ node_id, role, state, current_log_index, committed_log_index, last_heartbeat, kv_count }: NodeCardProps) {
  const borderColor = state === 'healthy' ? 'border-success' : state === 'partitioned' ? 'border-error' : 'border-warning'
  const pulseClass = state === 'partitioned' ? 'animate-pulse' : ''
  const stateColor = state === 'healthy' ? 'text-success' : state === 'partitioned' ? 'text-error' : 'text-warning'
  const roleBg = role === 'leader' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-secondary'

  const heartbeatAge = last_heartbeat
    ? Math.round((Date.now() - new Date(last_heartbeat).getTime()) / 1000)
    : null

  return (
    <div className={`bg-surface rounded-lg border-2 ${borderColor} ${pulseClass} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-white font-bold text-lg">{node_id.toUpperCase()}</div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBg}`}>
          {role}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">State</span>
          <span className={`font-medium ${stateColor}`}>{state}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Log Index</span>
          <span className="text-white">{current_log_index}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">Committed</span>
          <span className="text-white">{committed_log_index}</span>
        </div>
        {kv_count !== undefined && (
          <div className="flex justify-between">
            <span className="text-text-secondary">KV Pairs</span>
            <span className="text-white">{kv_count}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-secondary">Heartbeat</span>
          <span className="text-white text-xs">{heartbeatAge != null ? `${heartbeatAge}s ago` : 'N/A'}</span>
        </div>
      </div>
    </div>
  )
}
