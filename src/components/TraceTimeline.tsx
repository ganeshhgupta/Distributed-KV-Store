'use client'

interface Span {
  id: number
  trace_id: string
  span_name: string
  node_id: string | null
  started_at: string | null
  ended_at: string | null
  duration_ms: number | null
  metadata: Record<string, unknown> | null
  parent_span_id: string | null
}

interface TraceTimelineProps {
  spans: Span[]
  total_duration_ms?: number
}

export default function TraceTimeline({ spans, total_duration_ms }: TraceTimelineProps) {
  if (spans.length === 0) return <div className="text-text-secondary text-sm">No spans recorded</div>

  const times = spans
    .filter(s => s.started_at)
    .map(s => new Date(s.started_at!).getTime())
  const minTime = Math.min(...times)
  const maxEnd = Math.max(...spans.filter(s => s.ended_at).map(s => new Date(s.ended_at!).getTime()))
  const totalMs = total_duration_ms ?? ((maxEnd - minTime) || 1)

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-text-secondary mb-3">
        <span>0ms</span>
        <span>{totalMs}ms total</span>
      </div>
      {spans.map((span) => {
        const startMs = span.started_at ? new Date(span.started_at).getTime() - minTime : 0
        const endMs = span.ended_at ? new Date(span.ended_at).getTime() - minTime : startMs + (span.duration_ms ?? 0)
        const left = Math.min((startMs / totalMs) * 100, 95)
        const width = Math.max(((endMs - startMs) / totalMs) * 100, 1)
        const isSlow = (span.duration_ms ?? 0) > 100
        const barColor = isSlow ? 'bg-warning' : span.node_id === 'n1' ? 'bg-accent' : 'bg-success'

        return (
          <div key={span.id} className="flex items-center gap-3 group">
            <div className="w-36 text-xs text-text-secondary truncate shrink-0 text-right">{span.span_name}</div>
            <div className="flex-1 relative h-6 bg-border/30 rounded overflow-hidden">
              <div
                className={`absolute top-0 h-full ${barColor} rounded opacity-80 group-hover:opacity-100 transition-opacity`}
                style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
              />
            </div>
            <div className="w-20 text-xs text-right shrink-0">
              <span className={isSlow ? 'text-warning font-bold' : 'text-text-secondary'}>
                {span.duration_ms != null ? `${span.duration_ms}ms` : '-'}
              </span>
              {isSlow && <span className="ml-1 text-warning text-xs">⚠</span>}
            </div>
            <div className="w-8 text-xs text-text-secondary shrink-0">{span.node_id ?? '-'}</div>
          </div>
        )
      })}
    </div>
  )
}
