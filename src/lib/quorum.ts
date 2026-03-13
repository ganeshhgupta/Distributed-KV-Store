import { db } from './db'
import { kv_store, wal_log, nodes, quorum_decisions } from './schema'
import { eq, and, desc } from 'drizzle-orm'
import { appendWAL, getNextLogIndex, markReplicated } from './wal'
import { getLeader, getFollowers } from './replication'
import { isPartitioned } from './partition'
import { createTrace, addSpan, completeTrace } from './tracer'
import { randomUUID } from 'crypto'

const WRITE_QUORUM = 2 // W=2
const READ_QUORUM = 2  // R=2
const QUORUM_TIMEOUT_MS = 500

type NodeVote = { acked: boolean; reason?: string }

export async function kvPut(key: string, value: string) {
  const operation_id = randomUUID()
  const trace_id = await createTrace('put', key)
  const t0 = Date.now()

  try {
    // Get leader
    const clientReceiveStart = new Date()
    const leader = await getLeader()
    if (!leader) throw new Error('No leader available')

    await addSpan(trace_id, {
      span_name: 'client_receive',
      node_id: leader.node_id,
      started_at: clientReceiveStart,
      ended_at: new Date(),
      duration_ms: Date.now() - clientReceiveStart.getTime(),
      metadata: { key, value, operation: 'put' },
    })

    // Leader appends to WAL
    const leaderAppendStart = new Date()
    const log_index = await getNextLogIndex(leader.node_id)
    const walEntry = await appendWAL(leader.node_id, log_index, 'put', key, value, 1)

    // Update leader's log index
    await db.update(nodes)
      .set({ current_log_index: log_index, last_heartbeat: new Date() })
      .where(eq(nodes.node_id, leader.node_id))

    await addSpan(trace_id, {
      span_name: 'leader_append',
      node_id: leader.node_id,
      started_at: leaderAppendStart,
      ended_at: new Date(),
      duration_ms: Date.now() - leaderAppendStart.getTime(),
      metadata: { log_index, term: 1 },
    })

    // Replicate to followers in parallel
    const followers = await getFollowers()
    const nodeVotes: Record<string, NodeVote> = {
      [leader.node_id]: { acked: true }
    }
    let acks = 1 // leader always acks

    const replicatePromises = followers.map(async (follower) => {
      const repStart = new Date()
      try {
        const partitioned = await isPartitioned(leader.node_id, follower.node_id)
        if (partitioned) {
          nodeVotes[follower.node_id] = { acked: false, reason: 'partitioned' }
          await addSpan(trace_id, {
            span_name: `replicate_${follower.node_id}`,
            node_id: follower.node_id,
            started_at: repStart,
            ended_at: new Date(),
            duration_ms: Date.now() - repStart.getTime(),
            metadata: { reason: 'partitioned', log_index },
          })
          return
        }

        // Simulate replication: write to follower's kv_store
        const existing = await db.select()
          .from(kv_store)
          .where(and(eq(kv_store.node_id, follower.node_id), eq(kv_store.key, key)))

        if (existing.length > 0) {
          await db.update(kv_store)
            .set({ value, version: (existing[0].version ?? 0) + 1, committed: true, written_at: new Date() })
            .where(and(eq(kv_store.node_id, follower.node_id), eq(kv_store.key, key)))
        } else {
          await db.insert(kv_store).values({
            node_id: follower.node_id, key, value, version: 1, committed: true,
          })
        }

        await markReplicated(log_index, leader.node_id, follower.node_id)
        await db.update(nodes)
          .set({ committed_log_index: log_index, current_log_index: log_index, last_heartbeat: new Date() })
          .where(eq(nodes.node_id, follower.node_id))

        nodeVotes[follower.node_id] = { acked: true }
        acks++

        await addSpan(trace_id, {
          span_name: `replicate_${follower.node_id}`,
          node_id: follower.node_id,
          started_at: repStart,
          ended_at: new Date(),
          duration_ms: Date.now() - repStart.getTime(),
          metadata: { log_index, acked: true },
        })
      } catch (err) {
        nodeVotes[follower.node_id] = { acked: false, reason: String(err) }
        await addSpan(trace_id, {
          span_name: `replicate_${follower.node_id}`,
          node_id: follower.node_id,
          started_at: repStart,
          ended_at: new Date(),
          duration_ms: Date.now() - repStart.getTime(),
          metadata: { error: String(err) },
        })
      }
    })

    await Promise.all(replicatePromises)

    // Evaluate quorum
    const quorumStart = new Date()
    const achieved = acks >= WRITE_QUORUM
    const decision = achieved ? 'accept' : 'reject'

    await addSpan(trace_id, {
      span_name: 'quorum_eval',
      node_id: leader.node_id,
      started_at: quorumStart,
      ended_at: new Date(),
      duration_ms: Date.now() - quorumStart.getTime(),
      metadata: { required_acks: WRITE_QUORUM, received_acks: acks, decision },
    })

    // Record quorum decision
    await db.insert(quorum_decisions).values({
      operation_id,
      key,
      value,
      required_acks: WRITE_QUORUM,
      received_acks: acks,
      node_votes: nodeVotes,
      decision,
    })

    if (!achieved) {
      await completeTrace(trace_id, 'error')
      return { success: false, error: 'quorum_failed', operation_id, acks, node_votes: nodeVotes }
    }

    // Commit on leader
    const commitStart = new Date()
    const existing = await db.select()
      .from(kv_store)
      .where(and(eq(kv_store.node_id, leader.node_id), eq(kv_store.key, key)))

    if (existing.length > 0) {
      await db.update(kv_store)
        .set({ value, version: (existing[0].version ?? 0) + 1, committed: true, written_at: new Date() })
        .where(and(eq(kv_store.node_id, leader.node_id), eq(kv_store.key, key)))
    } else {
      await db.insert(kv_store).values({
        node_id: leader.node_id, key, value, version: 1, committed: true,
      })
    }

    await db.update(nodes)
      .set({ committed_log_index: log_index })
      .where(eq(nodes.node_id, leader.node_id))

    await addSpan(trace_id, {
      span_name: 'commit',
      node_id: leader.node_id,
      started_at: commitStart,
      ended_at: new Date(),
      duration_ms: Date.now() - commitStart.getTime(),
      metadata: { key, value },
    })

    const respondStart = new Date()
    await addSpan(trace_id, {
      span_name: 'respond',
      node_id: leader.node_id,
      started_at: respondStart,
      ended_at: new Date(),
      duration_ms: 1,
      metadata: { status: 'success', total_ms: Date.now() - t0 },
    })

    await completeTrace(trace_id, 'success')

    return {
      success: true,
      operation_id,
      trace_id,
      log_index,
      acks,
      node_votes: nodeVotes,
      decision: 'accept',
    }
  } catch (err) {
    await completeTrace(trace_id, 'error')
    throw err
  }
}

export async function kvGet(key: string) {
  const operation_id = randomUUID()
  const trace_id = await createTrace('get', key)
  const t0 = Date.now()

  try {
    const leader = await getLeader()
    if (!leader) throw new Error('No leader available')

    // Read from R=2 nodes
    const allNodesList = await db.select().from(nodes)
    const readNodes = allNodesList.slice(0, READ_QUORUM)

    const reads: Array<{ node_id: string; value: string | null | undefined; version: number }> = []

    for (const node of readNodes) {
      const readStart = new Date()
      const partitioned = await isPartitioned(leader.node_id, node.node_id)
      if (partitioned && node.node_id !== leader.node_id) {
        await addSpan(trace_id, {
          span_name: `read_${node.node_id}`,
          node_id: node.node_id,
          started_at: readStart,
          ended_at: new Date(),
          duration_ms: 1,
          metadata: { reason: 'partitioned' },
        })
        continue
      }

      const entries = await db.select()
        .from(kv_store)
        .where(and(eq(kv_store.node_id, node.node_id), eq(kv_store.key, key), eq(kv_store.committed, true)))

      const entry = entries[0]
      reads.push({ node_id: node.node_id, value: entry?.value, version: entry?.version ?? 0 })

      await addSpan(trace_id, {
        span_name: `read_${node.node_id}`,
        node_id: node.node_id,
        started_at: readStart,
        ended_at: new Date(),
        duration_ms: Date.now() - readStart.getTime(),
        metadata: { value: entry?.value, version: entry?.version },
      })
    }

    // Return value with highest version (read-repair)
    const best = reads.sort((a, b) => b.version - a.version)[0]
    const notFound = !best || best.value === null || best.value === undefined

    await completeTrace(trace_id, 'success')

    return {
      success: true,
      operation_id,
      trace_id,
      key,
      value: notFound ? null : best.value,
      version: best?.version ?? 0,
      reads,
      not_found: notFound,
    }
  } catch (err) {
    await completeTrace(trace_id, 'error')
    throw err
  }
}

export async function kvDelete(key: string) {
  const operation_id = randomUUID()
  const trace_id = await createTrace('delete', key)

  try {
    const leader = await getLeader()
    if (!leader) throw new Error('No leader available')

    const log_index = await getNextLogIndex(leader.node_id)
    await appendWAL(leader.node_id, log_index, 'delete', key, null, 1)
    await db.update(nodes)
      .set({ current_log_index: log_index })
      .where(eq(nodes.node_id, leader.node_id))

    const followers = await getFollowers()
    const nodeVotes: Record<string, NodeVote> = { [leader.node_id]: { acked: true } }
    let acks = 1

    const replicatePromises = followers.map(async (follower) => {
      const partitioned = await isPartitioned(leader.node_id, follower.node_id)
      if (partitioned) {
        nodeVotes[follower.node_id] = { acked: false, reason: 'partitioned' }
        return
      }
      await db.delete(kv_store).where(and(eq(kv_store.node_id, follower.node_id), eq(kv_store.key, key)))
      await markReplicated(log_index, leader.node_id, follower.node_id)
      await db.update(nodes)
        .set({ committed_log_index: log_index, current_log_index: log_index })
        .where(eq(nodes.node_id, follower.node_id))
      nodeVotes[follower.node_id] = { acked: true }
      acks++
    })

    await Promise.all(replicatePromises)

    const achieved = acks >= WRITE_QUORUM
    const decision = achieved ? 'accept' : 'reject'

    await db.insert(quorum_decisions).values({
      operation_id,
      key,
      value: null,
      required_acks: WRITE_QUORUM,
      received_acks: acks,
      node_votes: nodeVotes,
      decision,
    })

    if (!achieved) {
      await completeTrace(trace_id, 'error')
      return { success: false, error: 'quorum_failed', operation_id, acks, node_votes: nodeVotes }
    }

    await db.delete(kv_store).where(and(eq(kv_store.node_id, leader.node_id), eq(kv_store.key, key)))
    await db.update(nodes).set({ committed_log_index: log_index }).where(eq(nodes.node_id, leader.node_id))

    await completeTrace(trace_id, 'success')

    return { success: true, operation_id, trace_id, log_index, acks, node_votes: nodeVotes, decision: 'accept' }
  } catch (err) {
    await completeTrace(trace_id, 'error')
    throw err
  }
}
