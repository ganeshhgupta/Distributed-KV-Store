'use client'
import { useEffect, useState } from 'react'
import ReplicationLag from '@/components/ReplicationLag'
import WalViewer from '@/components/WalViewer'

interface LagData {
  node_id: string
  role: string
  state: string
  current_log_index: number
  committed_log_index: number
  lag: number
  last_heartbeat: string | null
}

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

export default function ReplicationPage() {
  const [lagData, setLagData] = useState<LagData[]>([])
  const [walEntries, setWalEntries] = useState<WalEntry[]>([])
  const [catchingUp, setCatchingUp] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function loadData() {
    const [lagRes, walRes] = await Promise.all([
      fetch('/api/replicate').then(r => r.json()),
      fetch('/api/wal').then(r => r.json()),
    ])
    if (lagRes.data) setLagData(lagRes.data)
    if (walRes.data) setWalEntries(walRes.data.slice(-20).reverse())
  }

  useEffect(() => { loadData() }, [])

  async function handleCatchUp(follower_id: string) {
    setCatchingUp(follower_id)
    try {
      const res = await fetch('/api/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_node_id: follower_id }),
      })
      const json = await res.json()
      if (json.data) {
        setMessage(`✓ Replicated ${json.data.replicated_entries} entries to ${follower_id.toUpperCase()}`)
      }
      await loadData()
    } finally {
      setCatchingUp(null)
    }
  }

  async function handlePromote(node_id: string) {
    setPromoting(node_id)
    try {
      const res = await fetch(`/api/nodes/${node_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'leader' }),
      })
      const json = await res.json()
      if (json.data) setMessage(`✓ ${node_id.toUpperCase()} promoted to leader`)
      await loadData()
    } finally {
      setPromoting(null)
    }
  }

  const followers = lagData.filter(n => n.role === 'follower')

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Replication</h1>
        <p className="text-text-secondary mt-1">Leader/follower log synchronization and lag monitoring</p>
      </div>

      {message && (
        <div className="mb-4 bg-success/10 border border-success/30 text-success rounded px-4 py-2 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage(null)} className="text-text-secondary hover:text-white">×</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-white font-semibold mb-3">Replication Lag</h2>
          <ReplicationLag data={lagData} />
        </div>

        <div className="bg-surface border border-border rounded-lg p-5">
          <h2 className="text-white font-semibold mb-4">Cluster Controls</h2>

          <div className="mb-5">
            <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Promote to Leader</div>
            <div className="flex gap-2">
              {lagData.map(node => (
                <button
                  key={node.node_id}
                  onClick={() => handlePromote(node.node_id)}
                  disabled={!!promoting || node.role === 'leader'}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium border transition-colors ${
                    node.role === 'leader'
                      ? 'bg-accent/20 text-accent border-accent/40 cursor-default'
                      : 'bg-white/5 hover:bg-white/10 text-white border-border disabled:opacity-40'
                  }`}
                >
                  {promoting === node.node_id ? '...' : node.node_id.toUpperCase()}
                  {node.role === 'leader' && <span className="ml-1 text-xs">★</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Quick write samples to generate replication lag */}
          <div className="mb-5">
            <div className="text-text-secondary text-xs uppercase tracking-wider mb-2">Write to Create Lag</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'metrics:cpu',      value: String(Math.round(30 + Math.random() * 50)) },
                { key: 'config:timeout',   value: '8000' },
                { key: 'feature:new_ui',   value: 'true' },
                { key: 'cache:user_count', value: String(Math.round(1000 + Math.random() * 9000)) },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={async () => {
                    await fetch('/api/kv', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(s),
                    })
                    await loadData()
                    setMessage(`✓ PUT ${s.key}=${s.value} — check replication lag below`)
                  }}
                  className="text-xs px-2.5 py-1 rounded-full border border-border bg-white/5
                    text-text-secondary hover:text-white hover:border-white/30 transition-colors font-mono"
                >
                  {s.key}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-text-secondary text-xs uppercase tracking-wider mb-3">Manual Catch-Up</div>
            <div className="space-y-2">
              {followers.map(node => (
                <div key={node.node_id} className="flex items-center justify-between bg-primary rounded p-3">
                  <div>
                    <span className="text-white font-medium">{node.node_id.toUpperCase()}</span>
                    <span className="text-text-secondary text-xs ml-2">lag: {node.lag} entries</span>
                  </div>
                  <button
                    onClick={() => handleCatchUp(node.node_id)}
                    disabled={catchingUp === node.node_id || node.lag === 0}
                    className="text-xs bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 px-3 py-1 rounded disabled:opacity-40 transition-colors"
                  >
                    {catchingUp === node.node_id ? 'Syncing...' : node.lag === 0 ? 'In Sync' : 'Catch Up'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={loadData} className="mt-4 w-full text-xs text-text-secondary hover:text-white border border-border rounded px-3 py-2 transition-colors">
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-white font-semibold mb-4">WAL Tail (Last 20 Entries)</h2>
        <WalViewer entries={walEntries} />
      </div>
    </div>
  )
}
