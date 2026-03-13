import { db } from '@/lib/db'
import { nodes, kv_store, wal_log, partitions, quorum_decisions } from '@/lib/schema'
import { eq, desc, count } from 'drizzle-orm'
import NodeCard from '@/components/NodeCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

async function getDashboardData() {
  const [allNodes, kvCount, walCount, activePartitions, recentOps] = await Promise.all([
    db.select().from(nodes).orderBy(nodes.node_id),
    db.select({ count: count() }).from(kv_store).where(eq(kv_store.committed, true)),
    db.select({ count: count() }).from(wal_log),
    db.select({ count: count() }).from(partitions).where(eq(partitions.active, true)),
    db.select().from(quorum_decisions).orderBy(desc(quorum_decisions.decided_at)).limit(10),
  ])

  const nodesWithKV = await Promise.all(
    allNodes.map(async (node) => {
      const kv = await db.select({ count: count() }).from(kv_store).where(eq(kv_store.node_id, node.node_id))
      return { ...node, kv_count: kv[0]?.count ?? 0 }
    })
  )

  const leader = allNodes.find(n => n.role === 'leader')
  const followers = allNodes.filter(n => n.role !== 'leader')
  const avgLag = followers.length > 0
    ? Math.round(followers.reduce((sum, f) => sum + ((leader?.current_log_index ?? 0) - f.committed_log_index), 0) / followers.length)
    : 0

  return { nodesWithKV, kvCount: kvCount[0]?.count ?? 0, walCount: walCount[0]?.count ?? 0, activePartitions: activePartitions[0]?.count ?? 0, recentOps, avgLag }
}

export default async function Dashboard() {
  const { nodesWithKV, kvCount, walCount, activePartitions, recentOps, avgLag } = await getDashboardData()

  const metrics = [
    { label: 'Total Keys', value: kvCount, color: 'text-accent' },
    { label: 'WAL Entries', value: walCount, color: 'text-success' },
    { label: 'Active Partitions', value: activePartitions, color: activePartitions > 0 ? 'text-error' : 'text-success' },
    { label: 'Avg Replication Lag', value: `${avgLag} entries`, color: avgLag > 0 ? 'text-warning' : 'text-success' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Cluster Dashboard</h1>
        <p className="text-text-secondary mt-1">3-node distributed KV cluster — W=2, R=2, N=3</p>
      </div>

      {/* Node Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {nodesWithKV.map(node => (
          <NodeCard
            key={node.node_id}
            node_id={node.node_id}
            role={node.role}
            state={node.state}
            current_log_index={node.current_log_index}
            committed_log_index={node.committed_log_index}
            last_heartbeat={node.last_heartbeat ? node.last_heartbeat.toISOString() : null}
            kv_count={node.kv_count}
          />
        ))}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {metrics.map(m => (
          <div key={m.label} className="bg-surface border border-border rounded-lg p-4">
            <div className="text-text-secondary text-xs uppercase tracking-wider mb-1">{m.label}</div>
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Recent Operations */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Recent Operations</h2>
          <Link href="/operations" className="text-accent text-sm hover:underline">View all →</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Key</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Value</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">ACKs</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Decision</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Time</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Trace</th>
            </tr>
          </thead>
          <tbody>
            {recentOps.map(op => (
              <tr key={op.id} className="border-b border-border/50 hover:bg-white/5">
                <td className="py-2 px-3 text-white font-mono text-xs">{op.key}</td>
                <td className="py-2 px-3 text-text-secondary font-mono text-xs max-w-24 truncate">{op.value ?? '-'}</td>
                <td className="py-2 px-3 text-text-secondary">{op.received_acks}/{op.required_acks}</td>
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${op.decision === 'accept' ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
                    {op.decision}
                  </span>
                </td>
                <td className="py-2 px-3 text-text-secondary text-xs">
                  {op.decided_at ? new Date(op.decided_at).toLocaleTimeString() : '-'}
                </td>
                <td className="py-2 px-3">
                  <Link href={`/tracing?op=${op.operation_id}`} className="text-accent text-xs hover:underline">
                    trace →
                  </Link>
                </td>
              </tr>
            ))}
            {recentOps.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-text-secondary">No operations yet — try the Operations page</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
