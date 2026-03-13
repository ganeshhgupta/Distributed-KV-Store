'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import TraceTimeline from '@/components/TraceTimeline'
import { Suspense } from 'react'

interface Trace {
  id: number
  operation_id: string
  operation_type: string
  key: string
  started_at: string | null
  completed_at: string | null
  status: string
}

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

function TracingContent() {
  const searchParams = useSearchParams()
  const opParam = searchParams.get('op')

  const [traces, setTraces] = useState<Trace[]>([])
  const [selectedTrace, setSelectedTrace] = useState<Trace | null>(null)
  const [spans, setSpans] = useState<Span[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/traces').then(r => r.json()).then(json => {
      if (json.data) {
        setTraces(json.data)
        if (opParam) {
          const found = json.data.find((t: Trace) => t.operation_id === opParam)
          if (found) loadTrace(found)
        }
      }
    })
  }, [opParam])

  async function loadTrace(trace: Trace) {
    setSelectedTrace(trace)
    setLoading(true)
    const res = await fetch(`/api/traces?operation_id=${trace.operation_id}`)
    const json = await res.json()
    if (json.data?.spans) setSpans(json.data.spans)
    setLoading(false)
  }

  const totalDuration = selectedTrace?.started_at && selectedTrace?.completed_at
    ? new Date(selectedTrace.completed_at).getTime() - new Date(selectedTrace.started_at).getTime()
    : null

  const slowSpans = spans.filter(s => (s.duration_ms ?? 0) > 100)
  const slowestSpan = spans.reduce((a, b) => (a.duration_ms ?? 0) > (b.duration_ms ?? 0) ? a : b, spans[0])

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Distributed Trace Viewer</h1>
        <p className="text-text-secondary mt-1">End-to-end operation traces with span waterfall (Jaeger-style)</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Trace List */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Recent Traces</div>
          <div className="space-y-1 max-h-[600px] overflow-y-auto">
            {traces.map(trace => {
              const isSelected = selectedTrace?.operation_id === trace.operation_id
              const duration = trace.started_at && trace.completed_at
                ? new Date(trace.completed_at).getTime() - new Date(trace.started_at).getTime()
                : null
              return (
                <button
                  key={trace.id}
                  onClick={() => loadTrace(trace)}
                  className={`w-full text-left px-3 py-2 rounded transition-colors ${
                    isSelected ? 'bg-accent/10 border border-accent/30' : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      trace.operation_type === 'put' ? 'bg-success/20 text-success' :
                      trace.operation_type === 'get' ? 'bg-accent/20 text-accent' :
                      'bg-error/20 text-error'
                    }`}>{trace.operation_type.toUpperCase()}</span>
                    <span className={`text-xs ${trace.status === 'success' ? 'text-success' : trace.status === 'error' ? 'text-error' : 'text-warning'}`}>
                      {trace.status}
                    </span>
                  </div>
                  <div className="text-white text-xs font-mono truncate">{trace.key}</div>
                  <div className="text-text-secondary text-xs mt-0.5">
                    {duration != null ? `${duration}ms` : '-'} ·{' '}
                    {trace.started_at ? new Date(trace.started_at).toLocaleTimeString() : ''}
                  </div>
                </button>
              )
            })}
            {traces.length === 0 && (
              <div className="text-text-secondary text-xs text-center py-6">No traces yet</div>
            )}
          </div>
        </div>

        {/* Trace Detail */}
        <div className="col-span-2 space-y-4">
          {selectedTrace ? (
            <>
              <div className="bg-surface border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-white font-semibold">
                      {selectedTrace.operation_type.toUpperCase()} · <span className="font-mono text-accent">{selectedTrace.key}</span>
                    </div>
                    <div className="text-text-secondary text-xs mt-1 font-mono">{selectedTrace.operation_id}</div>
                  </div>
                  <span className={`text-sm px-3 py-1 rounded-full font-medium ${
                    selectedTrace.status === 'success' ? 'bg-success/20 text-success' :
                    selectedTrace.status === 'error' ? 'bg-error/20 text-error' :
                    'bg-warning/20 text-warning'
                  }`}>
                    {selectedTrace.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-primary rounded p-3">
                    <div className="text-text-secondary text-xs">Total Duration</div>
                    <div className="text-white font-bold mt-1">{totalDuration != null ? `${totalDuration}ms` : 'N/A'}</div>
                  </div>
                  <div className="bg-primary rounded p-3">
                    <div className="text-text-secondary text-xs">Slowest Span</div>
                    <div className={`font-bold mt-1 ${(slowestSpan?.duration_ms ?? 0) > 100 ? 'text-warning' : 'text-white'}`}>
                      {slowestSpan ? `${slowestSpan.span_name} (${slowestSpan.duration_ms}ms)` : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-primary rounded p-3">
                    <div className="text-text-secondary text-xs">Slow Spans (&gt;100ms)</div>
                    <div className={`font-bold mt-1 ${slowSpans.length > 0 ? 'text-warning' : 'text-success'}`}>
                      {slowSpans.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-white font-semibold">Span Waterfall</div>
                  <div className="flex gap-4 text-xs text-text-secondary">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-accent rounded inline-block" /> Leader</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-success rounded inline-block" /> Follower</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-warning rounded inline-block" /> Slow (&gt;100ms)</span>
                  </div>
                </div>
                {loading ? (
                  <div className="text-text-secondary text-center py-8">Loading spans...</div>
                ) : (
                  <TraceTimeline spans={spans} total_duration_ms={totalDuration ?? undefined} />
                )}
              </div>

              {/* Span Table */}
              <div className="bg-surface border border-border rounded-lg p-5">
                <div className="text-white font-semibold mb-3">Span Details</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-text-secondary py-2 px-2">Span</th>
                      <th className="text-left text-text-secondary py-2 px-2">Node</th>
                      <th className="text-left text-text-secondary py-2 px-2">Duration</th>
                      <th className="text-left text-text-secondary py-2 px-2">Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spans.map(span => (
                      <tr key={span.id} className={`border-b border-border/50 ${(span.duration_ms ?? 0) > 100 ? 'bg-warning/5' : ''}`}>
                        <td className="py-1.5 px-2 text-white">{span.span_name}</td>
                        <td className="py-1.5 px-2 text-text-secondary">{span.node_id ?? '-'}</td>
                        <td className={`py-1.5 px-2 font-medium ${(span.duration_ms ?? 0) > 100 ? 'text-warning' : 'text-white'}`}>
                          {span.duration_ms != null ? `${span.duration_ms}ms` : '-'}
                          {(span.duration_ms ?? 0) > 100 && ' ⚠'}
                        </td>
                        <td className="py-1.5 px-2 text-text-secondary font-mono truncate max-w-48">
                          {span.metadata ? JSON.stringify(span.metadata) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="bg-surface border border-border rounded-lg p-12 text-center">
              <div className="text-text-secondary">Select a trace from the list to view details</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TracingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-text-secondary">Loading...</div>}>
      <TracingContent />
    </Suspense>
  )
}
