import { db } from './db'
import { partitions, nodes } from './schema'
import { eq, and, or } from 'drizzle-orm'

export async function injectPartition(from_node: string, to_node: string) {
  // Heal any existing partition between these nodes first
  await db.update(partitions)
    .set({ active: false, healed_at: new Date() })
    .where(
      and(
        eq(partitions.active, true),
        or(
          and(eq(partitions.from_node, from_node), eq(partitions.to_node, to_node)),
          and(eq(partitions.from_node, to_node), eq(partitions.to_node, from_node))
        )
      )
    )

  // Create new partition
  const [partition] = await db.insert(partitions)
    .values({ from_node, to_node, active: true })
    .returning()

  // Update node states
  await db.update(nodes)
    .set({ state: 'partitioned' })
    .where(eq(nodes.node_id, to_node))

  return partition
}

export async function healPartition(from_node: string, to_node: string) {
  const updated = await db.update(partitions)
    .set({ active: false, healed_at: new Date() })
    .where(
      and(
        eq(partitions.active, true),
        or(
          and(eq(partitions.from_node, from_node), eq(partitions.to_node, to_node)),
          and(eq(partitions.from_node, to_node), eq(partitions.to_node, from_node))
        )
      )
    )
    .returning()

  // Check if target node is still in any other partitions
  const remaining = await db.select()
    .from(partitions)
    .where(
      and(
        eq(partitions.active, true),
        or(eq(partitions.from_node, to_node), eq(partitions.to_node, to_node))
      )
    )

  if (remaining.length === 0) {
    await db.update(nodes)
      .set({ state: 'recovering' })
      .where(eq(nodes.node_id, to_node))
  }

  return updated
}

export async function isPartitioned(node_a: string, node_b: string): Promise<boolean> {
  const result = await db.select()
    .from(partitions)
    .where(
      and(
        eq(partitions.active, true),
        or(
          and(eq(partitions.from_node, node_a), eq(partitions.to_node, node_b)),
          and(eq(partitions.from_node, node_b), eq(partitions.to_node, node_a))
        )
      )
    )
  return result.length > 0
}

export async function getActivePartitions() {
  return db.select().from(partitions).where(eq(partitions.active, true))
}

export async function getReachableNodes(leader_id: string): Promise<string[]> {
  const allNodeIds = ['n1', 'n2', 'n3']
  const activePartitions = await getActivePartitions()

  return allNodeIds.filter(nodeId => {
    if (nodeId === leader_id) return true
    // Check if leader can reach this node
    const isBlocked = activePartitions.some(p =>
      (p.from_node === leader_id && p.to_node === nodeId) ||
      (p.from_node === nodeId && p.to_node === leader_id)
    )
    return !isBlocked
  })
}
