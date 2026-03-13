'use client'
import { useState } from 'react'
import QuorumDiagram from '@/components/QuorumDiagram'
import Link from 'next/link'

/* ─── sample data ─── */
const PUT_SAMPLES: Array<{ key: string; value: string; label: string }> = [
  { key: 'user:alice',           value: '{"name":"Alice","role":"admin","tier":"premium"}', label: 'user:alice' },
  { key: 'config:db_pool',       value: '{"min":2,"max":20,"idle_timeout":30000}',          label: 'config:db_pool' },
  { key: 'feature:dark_mode',    value: 'true',                                             label: 'feature:dark_mode' },
  { key: 'session:tok_x9f2',     value: '{"uid":"alice","ttl":3600,"ip":"10.0.0.1"}',       label: 'session:tok_x9f2' },
  { key: 'metrics:req_per_sec',  value: '2847',                                             label: 'metrics:rps' },
  { key: 'lock:schema_v4',       value: 'locked',                                           label: 'lock:schema_v4' },
]

const GET_SAMPLES = [
  'user:1001', 'user:alice', 'config:max_connections', 'config:timeout_ms',
  'metrics:cpu', 'feature:dark_mode', 'session:abc123', 'metrics:memory',
]

const DELETE_SAMPLES = [
  'lock:migration_v3', 'session:abc123', 'session:tok_x9f2',
  'cache:homepage', 'user:alice', 'feature:beta_api',
]

/* ─── types ─── */
type NodeVote = { acked: boolean; reason?: string }
type OpResult = {
  success: boolean
  operation_id?: string
  trace_id?: string
  log_index?: number
  acks?: number
  node_votes?: Record<string, NodeVote>
  decision?: string
  error?: string
  key?: string
  value?: string | null
  version?: number
  reads?: Array<{ node_id: string; value: string | null | undefined; version: number }>
  not_found?: boolean
}
type RecentOp = { key: string; type: string; result: OpResult; timestamp: Date }

/* ─── chip component ─── */
function Chip({ label, onClick, active }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-2.5 py-1 rounded-full border transition-all duration-150 font-mono
        ${active
          ? 'bg-accent/20 border-accent/60 text-accent'
          : 'bg-white/5 border-border text-text-secondary hover:text-white hover:border-white/30 hover:bg-white/10'
        }`}
    >
      {label}
    </button>
  )
}

export default function OperationsPage() {
  /* PUT state */
  const [putKey, setPutKey]   = useState('')
  const [putValue, setPutValue] = useState('')
  const [activePutSample, setActivePutSample] = useState<string | null>(null)

  /* GET state */
  const [getKey, setGetKey]  = useState('')
  const [getResult, setGetResult] = useState<OpResult | null>(null)
  const [activeGetSample, setActiveGetSample] = useState<string | null>(null)

  /* DELETE state */
  const [deleteKey, setDeleteKey] = useState('')
  const [deleteResult, setDeleteResult] = useState<OpResult | null>(null)
  const [activeDelSample, setActiveDelSample] = useState<string | null>(null)

  /* shared */
  const [loading, setLoading] = useState<'put' | 'get' | 'delete' | null>(null)
  const [putResult, setPutResult] = useState<OpResult | null>(null)
  const [recentOps, setRecentOps] = useState<RecentOp[]>([])

  /* ── PUT ── */
  async function executePut(k = putKey, v = putValue) {
    if (!k || !v) return
    setLoading('put')
    setPutResult(null)
    try {
      const res = await fetch('/api/kv', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k, value: v }),
      })
      const json = await res.json()
      const result: OpResult = json.data ?? json
      setPutResult(result)
      setRecentOps(prev => [{ key: k, type: 'PUT', result, timestamp: new Date() }, ...prev.slice(0, 9)])
    } finally {
      setLoading(null)
    }
  }

  function applyPutSample(s: { key: string; value: string; label: string }) {
    setPutKey(s.key)
    setPutValue(s.value)
    setActivePutSample(s.label)
    executePut(s.key, s.value)
  }

  /* ── GET ── */
  async function executeGet(k = getKey) {
    if (!k) return
    setLoading('get')
    setGetResult(null)
    try {
      const res = await fetch(`/api/kv?key=${encodeURIComponent(k)}`)
      const json = await res.json()
      const result: OpResult = json.data ?? json
      setGetResult(result)
      setRecentOps(prev => [{ key: k, type: 'GET', result, timestamp: new Date() }, ...prev.slice(0, 9)])
    } finally {
      setLoading(null)
    }
  }

  function applyGetSample(k: string) {
    setGetKey(k)
    setActiveGetSample(k)
    executeGet(k)
  }

  /* ── DELETE ── */
  async function executeDelete(k = deleteKey) {
    if (!k) return
    setLoading('delete')
    setDeleteResult(null)
    try {
      const res = await fetch('/api/kv', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: k }),
      })
      const json = await res.json()
      const result: OpResult = json.data ?? json
      setDeleteResult(result)
      setRecentOps(prev => [{ key: k, type: 'DELETE', result, timestamp: new Date() }, ...prev.slice(0, 9)])
    } finally {
      setLoading(null)
    }
  }

  function applyDelSample(k: string) {
    setDeleteKey(k)
    setActiveDelSample(k)
    executeDelete(k)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">KV Operations</h1>
        <p className="text-text-secondary mt-1">
          PUT / GET / DELETE — quorum consensus · click any chip for instant real output
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">

        {/* ══ PUT ══ */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-success/20 text-success px-2.5 py-0.5 rounded text-xs font-bold tracking-wider">PUT</span>
            <span className="text-white font-medium text-sm">Write Key-Value</span>
          </div>

          {/* sample chips */}
          <div>
            <div className="text-text-secondary text-xs mb-1.5">Quick samples — click to execute:</div>
            <div className="flex flex-wrap gap-1.5">
              {PUT_SAMPLES.map(s => (
                <Chip
                  key={s.label}
                  label={s.label}
                  active={activePutSample === s.label}
                  onClick={() => applyPutSample(s)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-text-secondary text-xs block mb-1">Key</label>
            <input
              value={putKey}
              onChange={e => { setPutKey(e.target.value); setActivePutSample(null) }}
              placeholder="e.g. user:1001"
              className="w-full bg-primary border border-border text-white rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs block mb-1">Value</label>
            <textarea
              value={putValue}
              onChange={e => { setPutValue(e.target.value); setActivePutSample(null) }}
              placeholder='e.g. {"name":"Alice"}'
              rows={3}
              className="w-full bg-primary border border-border text-white rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:border-accent transition-colors resize-none font-mono"
            />
          </div>
          <button
            onClick={() => executePut()}
            disabled={loading === 'put' || !putKey || !putValue}
            className="w-full bg-success/20 hover:bg-success/30 text-success border border-success/40
              rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {loading === 'put' ? '⏳ Writing...' : '▶ Execute PUT'}
          </button>

          {/* inline result */}
          {putResult && (
            <div className={`rounded-lg p-3 text-xs border animate-fade-in ${
              putResult.success
                ? 'bg-success/5 border-success/30 text-success'
                : 'bg-error/5 border-error/30 text-error'
            }`}>
              {putResult.success
                ? `✓ Written · log_index=${putResult.log_index} · ACKs: ${putResult.acks}/2`
                : `✗ ${putResult.error ?? 'failed'}`
              }
            </div>
          )}
        </div>

        {/* ══ GET ══ */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-accent/20 text-accent px-2.5 py-0.5 rounded text-xs font-bold tracking-wider">GET</span>
            <span className="text-white font-medium text-sm">Read Key</span>
          </div>

          <div>
            <div className="text-text-secondary text-xs mb-1.5">Quick samples — click to read:</div>
            <div className="flex flex-wrap gap-1.5">
              {GET_SAMPLES.map(k => (
                <Chip
                  key={k}
                  label={k}
                  active={activeGetSample === k}
                  onClick={() => applyGetSample(k)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-text-secondary text-xs block mb-1">Key</label>
            <input
              value={getKey}
              onChange={e => { setGetKey(e.target.value); setActiveGetSample(null) }}
              onKeyDown={e => e.key === 'Enter' && executeGet()}
              placeholder="e.g. user:1001"
              className="w-full bg-primary border border-border text-white rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={() => executeGet()}
            disabled={loading === 'get' || !getKey}
            className="w-full bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40
              rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {loading === 'get' ? '⏳ Reading...' : '▶ Execute GET'}
          </button>

          {/* result card */}
          {loading === 'get' && (
            <div className="rounded-lg border border-border bg-primary p-3 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-2/3 mb-2" />
              <div className="h-3 bg-white/10 rounded w-1/2" />
            </div>
          )}
          {getResult && loading !== 'get' && (
            <div className="rounded-lg border border-border bg-primary p-3 animate-fade-in">
              {getResult.not_found ? (
                <div className="text-text-secondary text-sm italic">Key not found in cluster</div>
              ) : (
                <>
                  <div className="text-xs text-text-secondary mb-1">Value</div>
                  <div className="text-white text-sm font-mono break-all bg-black/30 rounded px-2 py-1.5 mb-2">
                    {String(getResult.value)}
                  </div>
                  <div className="flex gap-4 text-xs text-text-secondary">
                    <span>version: <span className="text-accent">{getResult.version}</span></span>
                    <span>from: <span className="text-white">{getResult.reads?.map(r => r.node_id).join(', ')}</span></span>
                  </div>
                </>
              )}
              {getResult.operation_id && (
                <Link href={`/tracing?op=${getResult.operation_id}`} className="text-accent text-xs mt-2 block hover:underline">
                  View trace →
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ══ DELETE ══ */}
        <div className="bg-surface border border-border rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-error/20 text-error px-2.5 py-0.5 rounded text-xs font-bold tracking-wider">DEL</span>
            <span className="text-white font-medium text-sm">Delete Key</span>
          </div>

          <div>
            <div className="text-text-secondary text-xs mb-1.5">Quick samples — click to delete:</div>
            <div className="flex flex-wrap gap-1.5">
              {DELETE_SAMPLES.map(k => (
                <Chip
                  key={k}
                  label={k}
                  active={activeDelSample === k}
                  onClick={() => applyDelSample(k)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-text-secondary text-xs block mb-1">Key</label>
            <input
              value={deleteKey}
              onChange={e => { setDeleteKey(e.target.value); setActiveDelSample(null) }}
              onKeyDown={e => e.key === 'Enter' && executeDelete()}
              placeholder="e.g. lock:migration_v3"
              className="w-full bg-primary border border-border text-white rounded-lg px-3 py-2 text-sm
                focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={() => executeDelete()}
            disabled={loading === 'delete' || !deleteKey}
            className="w-full bg-error/20 hover:bg-error/30 text-error border border-error/40
              rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
          >
            {loading === 'delete' ? '⏳ Deleting...' : '▶ Execute DELETE'}
          </button>

          {deleteResult && loading !== 'delete' && (
            <div className={`rounded-lg p-3 text-xs border animate-fade-in ${
              deleteResult.success
                ? 'bg-success/5 border-success/30 text-success'
                : 'bg-error/5 border-error/30 text-error'
            }`}>
              {deleteResult.success
                ? `✓ Tombstoned · log_index=${deleteResult.log_index} · ACKs: ${deleteResult.acks}/2`
                : `✗ ${deleteResult.error ?? 'failed'}`
              }
            </div>
          )}
        </div>
      </div>

      {/* ── quorum decision panel ── */}
      {putResult?.node_votes && (
        <div className="mb-6 animate-fade-in-up">
          <QuorumDiagram
            node_votes={putResult.node_votes}
            decision={putResult.decision ?? 'reject'}
            required_acks={2}
            received_acks={putResult.acks ?? 0}
          />
          {putResult.operation_id && (
            <div className="mt-2 text-center">
              <Link href={`/tracing?op=${putResult.operation_id}`} className="text-accent text-sm hover:underline">
                View full trace for this operation →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── recent ops table ── */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Recent Operations</h2>
        {recentOps.length === 0 ? (
          <div className="text-text-secondary text-sm text-center py-8">
            Click a sample chip above or type a key — results appear here in real time
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Type','Key','ACKs','Result','Time','Trace'].map(h => (
                  <th key={h} className="text-left text-text-secondary py-2 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOps.map((op, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-white/5 transition-colors animate-fade-in">
                  <td className="py-2 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                      op.type === 'PUT'    ? 'bg-success/20 text-success' :
                      op.type === 'GET'    ? 'bg-accent/20 text-accent'   :
                      'bg-error/20 text-error'}`}>{op.type}</span>
                  </td>
                  <td className="py-2 px-3 text-white font-mono text-xs">{op.key}</td>
                  <td className="py-2 px-3 text-text-secondary">
                    {op.result.acks != null ? `${op.result.acks}/2` : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`text-xs ${op.result.success ? 'text-success' : 'text-error'}`}>
                      {op.result.success ? '✓ success' : `✗ ${op.result.error ?? 'failed'}`}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-text-secondary text-xs">{op.timestamp.toLocaleTimeString()}</td>
                  <td className="py-2 px-3">
                    {op.result.operation_id && (
                      <Link href={`/tracing?op=${op.result.operation_id}`} className="text-accent text-xs hover:underline">trace →</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
