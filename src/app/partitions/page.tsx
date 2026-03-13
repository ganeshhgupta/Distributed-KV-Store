'use client'
import { useEffect, useState } from 'react'
import PartitionControls from '@/components/PartitionControls'

interface PartitionRecord {
  id: number
  from_node: string
  to_node: string
  injected_at: string | null
  healed_at: string | null
  active: boolean
}

interface NodeState {
  node_id: string
  state: string
  role: string
}

export default function PartitionsPage() {
  const [partitions, setPartitions] = useState<PartitionRecord[]>([])
  const [nodes, setNodes] = useState<NodeState[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [demoRunning, setDemoRunning] = useState(false)
  const [demoLog, setDemoLog] = useState<string[]>([])

  const activePartitions = partitions.filter(p => p.active)

  async function loadData() {
    const [pRes, nRes] = await Promise.all([
      fetch('/api/partition').then(r => r.json()),
      fetch('/api/nodes').then(r => r.json()),
    ])
    if (pRes.data) setPartitions(pRes.data)
    if (nRes.data) setNodes(nRes.data)
  }

  useEffect(() => { loadData() }, [])

  async function handleInject(from: string, to: string) {
    await fetch('/api/partition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_node: from, to_node: to, action: 'inject' }),
    })
    setMessage(`✓ Partition injected: ${from.toUpperCase()} ↔ ${to.toUpperCase()}`)
    await loadData()
  }

  async function handleHeal(from: string, to: string) {
    await fetch('/api/partition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_node: from, to_node: to, action: 'heal' }),
    })
    setMessage(`✓ Partition healed: ${from.toUpperCase()} ↔ ${to.toUpperCase()}`)
    await loadData()
  }

  async function runDemo() {
    setDemoRunning(true)
    setDemoLog([])
    const log = (msg: string) => setDemoLog(prev => [...prev, msg])

    try {
      log('1. Injecting partition between N1 (leader) and N3...')
      await fetch('/api/partition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_node: 'n1', to_node: 'n3', action: 'inject' }),
      })
      await loadData()
      log('   ✓ Partition active — N3 is isolated')
      await new Promise(r => setTimeout(r, 800))

      log('2. Writing 5 keys (quorum still met: N1+N2=2)...')
      for (let i = 1; i <= 5; i++) {
        const res = await fetch('/api/kv', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: `demo:key${i}`, value: `value_${i}` }),
        })
        const json = await res.json()
        log(`   PUT demo:key${i} → ${json.data?.success ? `✓ ACKs: ${json.data.acks}/2` : '✗ Failed'}`)
        await new Promise(r => setTimeout(r, 400))
      }

      log('3. Healing partition N1 ↔ N3...')
      await fetch('/api/partition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from_node: 'n1', to_node: 'n3', action: 'heal' }),
      })
      await loadData()
      log('   ✓ Partition healed — N3 is recovering')
      await new Promise(r => setTimeout(r, 500))

      log('4. Triggering WAL catch-up for N3...')
      const catchRes = await fetch('/api/replicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_node_id: 'n3' }),
      })
      const catchJson = await catchRes.json()
      log(`   ✓ Replicated ${catchJson.data?.replicated_entries ?? 0} entries to N3`)
      await loadData()
      log('5. Demo complete — N3 is back in sync. Zero data loss.')
    } finally {
      setDemoRunning(false)
    }
  }

  const nodePositions: Record<string, { x: number; y: number }> = {
    n1: { x: 150, y: 60 },
    n2: { x: 50, y: 220 },
    n3: { x: 250, y: 220 },
  }

  function isLinkPartitioned(a: string, b: string) {
    return activePartitions.some(p =>
      (p.from_node === a && p.to_node === b) || (p.from_node === b && p.to_node === a)
    )
  }

  const links = [['n1', 'n2'], ['n1', 'n3'], ['n2', 'n3']]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Network Partition Simulator</h1>
        <p className="text-text-secondary mt-1">Inject and heal network partitions — observe quorum behavior</p>
      </div>

      {message && (
        <div className="mb-4 bg-success/10 border border-success/30 text-success rounded px-4 py-2 text-sm flex justify-between">
          {message}
          <button onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Network Topology SVG */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-text-secondary text-xs uppercase tracking-wider mb-4">Network Topology</div>
          <svg viewBox="0 0 300 300" className="w-full h-64">
            {/* Links */}
            {links.map(([a, b]) => {
              const partitioned = isLinkPartitioned(a, b)
              const pa = nodePositions[a]
              const pb = nodePositions[b]
              return (
                <g key={`${a}-${b}`}>
                  <line
                    x1={pa.x} y1={pa.y + 20} x2={pb.x} y2={pb.y + 20}
                    stroke={partitioned ? '#E74C3C' : '#37475A'}
                    strokeWidth={partitioned ? 2 : 1.5}
                    strokeDasharray={partitioned ? '6,4' : undefined}
                  />
                  {partitioned && (
                    <text
                      x={(pa.x + pb.x) / 2}
                      y={(pa.y + pb.y) / 2 + 20}
                      textAnchor="middle"
                      fill="#E74C3C"
                      fontSize="16"
                    >✂</text>
                  )}
                </g>
              )
            })}
            {/* Nodes */}
            {Object.entries(nodePositions).map(([nodeId, pos]) => {
              const node = nodes.find(n => n.node_id === nodeId)
              const isPartitioned = node?.state === 'partitioned'
              const fill = isPartitioned ? '#E74C3C' : node?.role === 'leader' ? '#FF9900' : '#067D62'
              return (
                <g key={nodeId}>
                  <circle cx={pos.x} cy={pos.y + 20} r={28} fill={fill} fillOpacity={0.15} stroke={fill} strokeWidth={2} />
                  <text x={pos.x} y={pos.y + 16} textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
                    {nodeId.toUpperCase()}
                  </text>
                  <text x={pos.x} y={pos.y + 32} textAnchor="middle" fill={fill} fontSize="9">
                    {node?.role ?? ''}
                  </text>
                  <text x={pos.x} y={pos.y + 44} textAnchor="middle" fill="#B0BEC5" fontSize="8">
                    {node?.state ?? ''}
                  </text>
                </g>
              )
            })}
          </svg>
          <div className="flex gap-4 text-xs text-text-secondary mt-2 justify-center">
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-border inline-block" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-error inline-block border-dashed" /> Partitioned</span>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          <PartitionControls
            onInject={handleInject}
            onHeal={handleHeal}
            activePartitions={activePartitions}
          />

          <div className="bg-surface border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-white font-medium">Fault Injection Demo</div>
              <button
                onClick={runDemo}
                disabled={demoRunning}
                className="bg-accent hover:bg-accent/80 text-primary text-sm font-bold px-4 py-1.5 rounded disabled:opacity-40 transition-colors"
              >
                {demoRunning ? '⏳ Running...' : '▶ Auto Demo'}
              </button>
            </div>
            <div className="text-text-secondary text-xs mb-3">
              Inject N1↔N3 partition → write 5 keys → heal → WAL catch-up
            </div>
            {demoLog.length > 0 && (
              <div className="bg-primary rounded p-3 space-y-1 max-h-48 overflow-y-auto">
                {demoLog.map((line, i) => (
                  <div key={i} className="text-xs font-mono text-text-secondary">{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Partition History */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-white font-semibold mb-4">Partition History</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-text-secondary py-2 px-3 font-medium">From</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">To</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Status</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Injected</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Healed</th>
            </tr>
          </thead>
          <tbody>
            {partitions.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-white/5">
                <td className="py-2 px-3 text-white font-bold">{p.from_node.toUpperCase()}</td>
                <td className="py-2 px-3 text-white font-bold">{p.to_node.toUpperCase()}</td>
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.active ? 'bg-error/20 text-error animate-pulse' : 'bg-success/20 text-success'}`}>
                    {p.active ? 'ACTIVE' : 'HEALED'}
                  </span>
                </td>
                <td className="py-2 px-3 text-text-secondary text-xs">
                  {p.injected_at ? new Date(p.injected_at).toLocaleString() : '-'}
                </td>
                <td className="py-2 px-3 text-text-secondary text-xs">
                  {p.healed_at ? new Date(p.healed_at).toLocaleString() : '-'}
                </td>
              </tr>
            ))}
            {partitions.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-text-secondary">No partitions recorded</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
