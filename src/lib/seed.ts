import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { nodes, kv_store, wal_log } from './schema'

async function seed() {
  const sql = neon(process.env.NEON_DATABASE_URL!)
  const db = drizzle(sql, { schema })

  console.log('Seeding database...')

  // Clear existing data
  await db.delete(wal_log)
  await db.delete(kv_store)
  await db.delete(nodes)

  // Insert 3 nodes
  await db.insert(nodes).values([
    { node_id: 'n1', role: 'leader', state: 'healthy', current_log_index: 20, committed_log_index: 20, last_heartbeat: new Date() },
    { node_id: 'n2', role: 'follower', state: 'healthy', current_log_index: 20, committed_log_index: 20, last_heartbeat: new Date() },
    { node_id: 'n3', role: 'follower', state: 'healthy', current_log_index: 18, committed_log_index: 18, last_heartbeat: new Date() },
  ])
  console.log('Nodes seeded')

  // 15 sample KV pairs per node
  const sampleKVs = [
    { key: 'user:1001', value: '{"name":"Alice","role":"admin"}' },
    { key: 'user:1002', value: '{"name":"Bob","role":"viewer"}' },
    { key: 'config:max_connections', value: '100' },
    { key: 'config:timeout_ms', value: '5000' },
    { key: 'config:retry_count', value: '3' },
    { key: 'session:abc123', value: '{"user":"Alice","expires":1800}' },
    { key: 'session:def456', value: '{"user":"Bob","expires":900}' },
    { key: 'metrics:cpu', value: '42.5' },
    { key: 'metrics:memory', value: '67.3' },
    { key: 'metrics:disk', value: '55.1' },
    { key: 'feature:dark_mode', value: 'true' },
    { key: 'feature:beta_api', value: 'false' },
    { key: 'cache:homepage', value: '{"ttl":300,"hits":1240}' },
    { key: 'queue:jobs_pending', value: '7' },
    { key: 'lock:migration_v3', value: 'locked' },
  ]

  for (const nodeId of ['n1', 'n2', 'n3']) {
    for (let i = 0; i < sampleKVs.length; i++) {
      await db.insert(kv_store).values({
        node_id: nodeId,
        key: sampleKVs[i].key,
        value: sampleKVs[i].value,
        version: 1,
        committed: true,
        written_at: new Date(),
      })
    }
  }
  console.log('KV pairs seeded')

  // 20 WAL entries on leader (n1)
  const walOps = [
    { operation: 'put', key: 'user:1001', value: '{"name":"Alice","role":"admin"}' },
    { operation: 'put', key: 'user:1002', value: '{"name":"Bob","role":"viewer"}' },
    { operation: 'put', key: 'config:max_connections', value: '100' },
    { operation: 'put', key: 'config:timeout_ms', value: '5000' },
    { operation: 'put', key: 'config:retry_count', value: '3' },
    { operation: 'put', key: 'session:abc123', value: '{"user":"Alice","expires":1800}' },
    { operation: 'put', key: 'session:def456', value: '{"user":"Bob","expires":900}' },
    { operation: 'put', key: 'metrics:cpu', value: '42.5' },
    { operation: 'put', key: 'metrics:memory', value: '67.3' },
    { operation: 'put', key: 'metrics:disk', value: '55.1' },
    { operation: 'put', key: 'feature:dark_mode', value: 'true' },
    { operation: 'put', key: 'feature:beta_api', value: 'false' },
    { operation: 'put', key: 'cache:homepage', value: '{"ttl":300,"hits":1240}' },
    { operation: 'put', key: 'queue:jobs_pending', value: '7' },
    { operation: 'put', key: 'lock:migration_v3', value: 'locked' },
    { operation: 'put', key: 'metrics:cpu', value: '44.1' },
    { operation: 'put', key: 'metrics:memory', value: '68.9' },
    { operation: 'delete', key: 'session:def456', value: null },
    { operation: 'put', key: 'queue:jobs_pending', value: '3' },
    { operation: 'put', key: 'metrics:cpu', value: '42.5' },
  ] as const

  for (let i = 0; i < walOps.length; i++) {
    const replicatedTo = i < 18 ? ['n1', 'n2', 'n3'] : ['n1', 'n2']
    await db.insert(wal_log).values({
      node_id: 'n1',
      log_index: i + 1,
      operation: walOps[i].operation,
      key: walOps[i].key,
      value: walOps[i].value ?? null,
      term: 1,
      timestamp: new Date(Date.now() - (20 - i) * 60000),
      replicated_to: replicatedTo,
    })
  }
  console.log('WAL entries seeded')
  console.log('Seeding complete!')
}

seed().catch(console.error)
