'use client'
import { useState } from 'react'

interface PartitionControlsProps {
  onInject: (from: string, to: string) => Promise<void>
  onHeal: (from: string, to: string) => Promise<void>
  activePartitions: Array<{ from_node: string; to_node: string }>
}

const NODE_IDS = ['n1', 'n2', 'n3']

export default function PartitionControls({ onInject, onHeal, activePartitions }: PartitionControlsProps) {
  const [fromNode, setFromNode] = useState('n1')
  const [toNode, setToNode] = useState('n3')
  const [loading, setLoading] = useState(false)

  const isPartitioned = (a: string, b: string) =>
    activePartitions.some(p =>
      (p.from_node === a && p.to_node === b) || (p.from_node === b && p.to_node === a)
    )

  async function handleInject() {
    setLoading(true)
    await onInject(fromNode, toNode)
    setLoading(false)
  }

  async function handleHeal() {
    setLoading(true)
    await onHeal(fromNode, toNode)
    setLoading(false)
  }

  const partitioned = isPartitioned(fromNode, toNode)

  return (
    <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
      <div className="text-white font-medium">Partition Control</div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-text-secondary text-xs mb-1 block">From Node</label>
          <select
            value={fromNode}
            onChange={e => setFromNode(e.target.value)}
            className="w-full bg-primary border border-border text-white rounded px-3 py-2 text-sm"
          >
            {NODE_IDS.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-text-secondary text-xs mb-1 block">To Node</label>
          <select
            value={toNode}
            onChange={e => setToNode(e.target.value)}
            className="w-full bg-primary border border-border text-white rounded px-3 py-2 text-sm"
          >
            {NODE_IDS.filter(n => n !== fromNode).map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleInject}
          disabled={loading || partitioned}
          className="flex-1 bg-error/20 hover:bg-error/30 text-error border border-error/40 rounded px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {loading ? '...' : 'Inject Partition'}
        </button>
        <button
          onClick={handleHeal}
          disabled={loading || !partitioned}
          className="flex-1 bg-success/20 hover:bg-success/30 text-success border border-success/40 rounded px-4 py-2 text-sm font-medium disabled:opacity-40 transition-colors"
        >
          {loading ? '...' : 'Heal Partition'}
        </button>
      </div>
      {partitioned && (
        <div className="text-error text-xs flex items-center gap-1">
          <span>⚠</span> Partition active between {fromNode.toUpperCase()} ↔ {toNode.toUpperCase()}
        </div>
      )}
    </div>
  )
}
