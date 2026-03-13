import { db } from '@/lib/db'
import { nodes, kv_store } from '@/lib/schema'
import { eq, count } from 'drizzle-orm'
import NodeCard from '@/components/NodeCard'

export const dynamic = 'force-dynamic'

export default async function NodesPage() {
  const allNodes = await db.select().from(nodes).orderBy(nodes.node_id)
  const nodesWithKV = await Promise.all(
    allNodes.map(async (node) => {
      const kv = await db.select({ count: count() }).from(kv_store).where(eq(kv_store.node_id, node.node_id))
      return { ...node, kv_count: kv[0]?.count ?? 0 }
    })
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Cluster Nodes</h1>
        <p className="text-text-secondary mt-1">Node health, roles, and log indices</p>
      </div>

      <div className="grid grid-cols-3 gap-5 mb-8">
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

      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-white font-semibold mb-4">Node Details</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Node</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Role</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">State</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Log Index</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Committed</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">KV Pairs</th>
              <th className="text-left text-text-secondary py-2 px-3 font-medium">Last Heartbeat</th>
            </tr>
          </thead>
          <tbody>
            {nodesWithKV.map(node => (
              <tr key={node.id} className="border-b border-border/50 hover:bg-white/5">
                <td className="py-2 px-3 text-white font-bold">{node.node_id.toUpperCase()}</td>
                <td className="py-2 px-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${node.role === 'leader' ? 'bg-accent/20 text-accent' : 'bg-white/10 text-text-secondary'}`}>
                    {node.role}
                  </span>
                </td>
                <td className="py-2 px-3">
                  <span className={`text-xs ${node.state === 'healthy' ? 'text-success' : node.state === 'partitioned' ? 'text-error' : 'text-warning'}`}>
                    ● {node.state}
                  </span>
                </td>
                <td className="py-2 px-3 text-white">{node.current_log_index}</td>
                <td className="py-2 px-3 text-white">{node.committed_log_index}</td>
                <td className="py-2 px-3 text-white">{node.kv_count}</td>
                <td className="py-2 px-3 text-text-secondary text-xs">
                  {node.last_heartbeat ? new Date(node.last_heartbeat).toLocaleString() : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-surface border border-border rounded-lg p-5">
        <h2 className="text-white font-semibold mb-3">Quorum Configuration</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-primary rounded p-3">
            <div className="text-text-secondary text-xs mb-1">Total Nodes (N)</div>
            <div className="text-white text-2xl font-bold">3</div>
          </div>
          <div className="bg-primary rounded p-3">
            <div className="text-text-secondary text-xs mb-1">Write Quorum (W)</div>
            <div className="text-accent text-2xl font-bold">2</div>
          </div>
          <div className="bg-primary rounded p-3">
            <div className="text-text-secondary text-xs mb-1">Read Quorum (R)</div>
            <div className="text-accent text-2xl font-bold">2</div>
          </div>
        </div>
        <div className="mt-3 text-text-secondary text-sm font-mono bg-primary rounded p-3">
          W + R &gt; N → 2 + 2 &gt; 3 ✓ (Strong Consistency)
        </div>
      </div>
    </div>
  )
}
