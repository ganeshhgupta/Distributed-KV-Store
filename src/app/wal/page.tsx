'use client'
import { useEffect, useState } from 'react'
import WalViewer from '@/components/WalViewer'

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

interface ReplayResult {
  processed: number
  final_kv_count: number
  conflicts: string[]
}

export default function WALPage() {
  const [selectedNode, setSelectedNode] = useState('n1')
  const [walEntries, setWalEntries] = useState<WalEntry[]>([])
  const [fromIndex, setFromIndex] = useState(0)
  const [replaying, setReplaying] = useState(false)
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null)
  const [replayStep, setReplayStep] = useState(-1)
  const [loading, setLoading] = useState(false)

  async function loadWAL(nodeId: string) {
    setLoading(true)
    const res = await fetch(`/api/wal?node_id=${nodeId}`)
    const json = await res.json()
    if (json.data) setWalEntries(json.data)
    setLoading(false)
  }

  useEffect(() => { loadWAL(selectedNode) }, [selectedNode])

  async function handleReplay() {
    setReplaying(true)
    setReplayResult(null)
    setReplayStep(-1)

    // Animate through steps
    const relevant = walEntries.filter(e => e.log_index >= fromIndex)
    for (let i = 0; i < relevant.length; i++) {
      setReplayStep(relevant[i].log_index)
      await new Promise(r => setTimeout(r, 300))
    }

    const res = await fetch('/api/wal/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node_id: selectedNode, from_index: fromIndex }),
    })
    const json = await res.json()
    if (json.data) setReplayResult(json.data)
    setReplayStep(-1)
    setReplaying(false)
    await loadWAL(selectedNode)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">WAL Viewer</h1>
        <p className="text-text-secondary mt-1">Write-Ahead Log — append-only operation log with replay simulation</p>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-6">
        {/* Node Selector */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Select Node</div>
          <div className="flex gap-2">
            {['n1', 'n2', 'n3'].map(n => (
              <button
                key={n}
                onClick={() => setSelectedNode(n)}
                className={`flex-1 py-2 rounded text-sm font-medium border transition-colors ${
                  selectedNode === n
                    ? 'bg-accent/20 text-accent border-accent/40'
                    : 'bg-primary text-text-secondary border-border hover:text-white'
                }`}
              >
                {n.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="mt-3 text-text-secondary text-xs">
            {walEntries.length} entries
          </div>
        </div>

        {/* Replay Panel */}
        <div className="col-span-2 bg-surface border border-border rounded-lg p-5">
          <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">WAL Replay Simulator</div>

          {/* quick index chips */}
          <div className="mb-3">
            <div className="text-text-secondary text-xs mb-1.5">Start from index:</div>
            <div className="flex gap-2 flex-wrap">
              {[0, 1, 5, 10, 15].map(idx => (
                <button
                  key={idx}
                  onClick={() => { setFromIndex(idx); setReplayResult(null) }}
                  className={`text-xs px-3 py-1 rounded-full border font-mono transition-colors ${
                    fromIndex === idx
                      ? 'bg-accent/20 border-accent/60 text-accent'
                      : 'bg-white/5 border-border text-text-secondary hover:text-white hover:border-white/30'
                  }`}
                >
                  #{idx}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-text-secondary text-xs block mb-1">From Index</label>
              <input
                type="number"
                value={fromIndex}
                min={0}
                onChange={e => { setFromIndex(Number(e.target.value)); setReplayResult(null) }}
                className="w-full bg-primary border border-border text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={handleReplay}
              disabled={replaying}
              className="bg-accent hover:bg-accent/80 text-primary font-bold px-6 py-2 rounded text-sm disabled:opacity-40 transition-colors"
            >
              {replaying ? 'Replaying...' : '▶ Replay'}
            </button>
          </div>

          {replayResult && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="bg-primary rounded p-3 text-center">
                <div className="text-text-secondary text-xs">Entries Processed</div>
                <div className="text-accent text-xl font-bold mt-1">{replayResult.processed}</div>
              </div>
              <div className="bg-primary rounded p-3 text-center">
                <div className="text-text-secondary text-xs">Final KV Count</div>
                <div className="text-success text-xl font-bold mt-1">{replayResult.final_kv_count}</div>
              </div>
              <div className="bg-primary rounded p-3 text-center">
                <div className="text-text-secondary text-xs">Conflicts</div>
                <div className={`text-xl font-bold mt-1 ${replayResult.conflicts.length > 0 ? 'text-error' : 'text-success'}`}>
                  {replayResult.conflicts.length}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">WAL Log — {selectedNode.toUpperCase()}</h2>
          <div className="flex gap-3 text-xs text-text-secondary">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/50 inline-block" /> PUT</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-error/50 inline-block" /> DELETE</span>
            {replaying && <span className="text-accent animate-pulse">● Replaying...</span>}
          </div>
        </div>
        {loading ? (
          <div className="text-text-secondary text-center py-8">Loading...</div>
        ) : (
          <WalViewer entries={walEntries} highlightIndex={replayStep} />
        )}
      </div>
    </div>
  )
}
