import { db } from './db'
import { nodes, kv_store, wal_log } from './schema'
import { eq, and, gte, asc, desc } from 'drizzle-orm'
import { markReplicated } from './wal'

export async function getLeader() {
  const leaders = await db.select().from(nodes).where(eq(nodes.role, 'leader'))
  return leaders[0] ?? null
}

export async function getFollowers() {
  return db.select().from(nodes).where(eq(nodes.role, 'follower'))
}

export async function getAllNodes() {
  return db.select().from(nodes).orderBy(asc(nodes.node_id))
}

export async function replicateToFollower(follower_node_id: string) {
  const leader = await getLeader()
  if (!leader) throw new Error('No leader found')

  const followerNodes = await db.select().from(nodes).where(eq(nodes.node_id, follower_node_id))
  if (followerNodes.length === 0) throw new Error('Follower not found')
  const follower = followerNodes[0]

  // Find WAL entries that haven't been replicated to this follower
  const leaderWAL = await db.select()
    .from(wal_log)
    .where(and(
      eq(wal_log.node_id, leader.node_id),
      gte(wal_log.log_index, follower.committed_log_index + 1)
    ))
    .orderBy(asc(wal_log.log_index))

  let replicated = 0

  for (const entry of leaderWAL) {
    // Apply WAL entry to follower's kv_store
    if (entry.operation === 'put' && entry.value !== null) {
      const existing = await db.select()
        .from(kv_store)
        .where(and(eq(kv_store.node_id, follower_node_id), eq(kv_store.key, entry.key)))

      if (existing.length > 0) {
        await db.update(kv_store)
          .set({ value: entry.value, version: (existing[0].version ?? 0) + 1, committed: true })
          .where(and(eq(kv_store.node_id, follower_node_id), eq(kv_store.key, entry.key)))
      } else {
        await db.insert(kv_store).values({
          node_id: follower_node_id,
          key: entry.key,
          value: entry.value,
          version: 1,
          committed: true,
        })
      }
    } else if (entry.operation === 'delete') {
      await db.delete(kv_store)
        .where(and(eq(kv_store.node_id, follower_node_id), eq(kv_store.key, entry.key)))
    }

    // Mark as replicated in leader's WAL
    await markReplicated(entry.log_index, leader.node_id, follower_node_id)
    replicated++
  }

  // Update follower log index
  if (leaderWAL.length > 0) {
    const maxIndex = Math.max(...leaderWAL.map(e => e.log_index))
    await db.update(nodes)
      .set({ committed_log_index: maxIndex, current_log_index: maxIndex, state: 'healthy', last_heartbeat: new Date() })
      .where(eq(nodes.node_id, follower_node_id))
  }

  return {
    replicated_entries: replicated,
    follower_log_index: follower.committed_log_index + replicated,
    leader_log_index: leader.current_log_index,
  }
}

export async function promoteToLeader(node_id: string) {
  // Demote current leader
  await db.update(nodes)
    .set({ role: 'follower' })
    .where(eq(nodes.role, 'leader'))

  // Promote new leader
  await db.update(nodes)
    .set({ role: 'leader', state: 'healthy' })
    .where(eq(nodes.node_id, node_id))

  return db.select().from(nodes).where(eq(nodes.node_id, node_id))
}

export async function getReplicationLag() {
  const allNodes = await db.select().from(nodes).orderBy(asc(nodes.node_id))
  const leader = allNodes.find(n => n.role === 'leader')
  if (!leader) return []

  return allNodes.map(n => ({
    node_id: n.node_id,
    role: n.role,
    state: n.state,
    current_log_index: n.current_log_index,
    committed_log_index: n.committed_log_index,
    lag: n.role === 'leader' ? 0 : (leader.current_log_index - n.committed_log_index),
    last_heartbeat: n.last_heartbeat,
  }))
}
