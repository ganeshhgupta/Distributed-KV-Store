import { db } from './db'
import { wal_log, kv_store, nodes } from './schema'
import { eq, and, gte, asc } from 'drizzle-orm'

export async function appendWAL(
  node_id: string,
  log_index: number,
  operation: 'put' | 'delete',
  key: string,
  value: string | null,
  term: number
) {
  const [entry] = await db.insert(wal_log)
    .values({ node_id, log_index, operation, key, value, term, timestamp: new Date(), replicated_to: [node_id] })
    .returning()
  return entry
}

export async function markReplicated(log_index: number, leader_node_id: string, follower_node_id: string) {
  const entries = await db.select().from(wal_log)
    .where(and(eq(wal_log.node_id, leader_node_id), eq(wal_log.log_index, log_index)))

  if (entries.length === 0) return

  const current = entries[0].replicated_to ?? []
  if (!current.includes(follower_node_id)) {
    await db.update(wal_log)
      .set({ replicated_to: [...current, follower_node_id] })
      .where(and(eq(wal_log.node_id, leader_node_id), eq(wal_log.log_index, log_index)))
  }
}

export async function getNextLogIndex(node_id: string): Promise<number> {
  const nodeData = await db.select().from(nodes).where(eq(nodes.node_id, node_id))
  if (nodeData.length === 0) return 1
  return (nodeData[0].current_log_index ?? 0) + 1
}

export async function replayWAL(node_id: string, from_index: number) {
  // Get all WAL entries for any node from from_index onwards (using leader's WAL)
  const entries = await db.select()
    .from(wal_log)
    .where(gte(wal_log.log_index, from_index))
    .orderBy(asc(wal_log.log_index))

  // Clear node's current kv_store
  await db.delete(kv_store).where(eq(kv_store.node_id, node_id))

  const conflicts: string[] = []
  let processed = 0

  for (const entry of entries) {
    if (entry.operation === 'put' && entry.value !== null) {
      // Check for conflict (same key different value from same index)
      const existing = await db.select()
        .from(kv_store)
        .where(and(eq(kv_store.node_id, node_id), eq(kv_store.key, entry.key)))

      if (existing.length > 0) {
        if (existing[0].value !== entry.value) {
          conflicts.push(`key=${entry.key} at index=${entry.log_index}`)
        }
        await db.update(kv_store)
          .set({ value: entry.value, version: (existing[0].version ?? 0) + 1, committed: true })
          .where(and(eq(kv_store.node_id, node_id), eq(kv_store.key, entry.key)))
      } else {
        await db.insert(kv_store).values({
          node_id,
          key: entry.key,
          value: entry.value,
          version: 1,
          committed: true,
        })
      }
    } else if (entry.operation === 'delete') {
      await db.delete(kv_store)
        .where(and(eq(kv_store.node_id, node_id), eq(kv_store.key, entry.key)))
    }
    processed++
  }

  // Update node's committed log index
  if (entries.length > 0) {
    const maxIndex = Math.max(...entries.map(e => e.log_index))
    await db.update(nodes)
      .set({ committed_log_index: maxIndex, current_log_index: maxIndex, state: 'healthy' })
      .where(eq(nodes.node_id, node_id))
  }

  // Count final kv entries
  const finalKV = await db.select().from(kv_store).where(eq(kv_store.node_id, node_id))

  return {
    processed,
    final_kv_count: finalKV.length,
    conflicts,
  }
}

export async function getWALForNode(node_id: string) {
  return db.select()
    .from(wal_log)
    .where(eq(wal_log.node_id, node_id))
    .orderBy(asc(wal_log.log_index))
}

export async function getAllWAL() {
  return db.select()
    .from(wal_log)
    .orderBy(asc(wal_log.log_index))
}
