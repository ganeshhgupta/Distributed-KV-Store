import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const sql = neon(process.env.NEON_DATABASE_URL!)
const db = drizzle(sql)

async function runMigrations() {
  console.log('Running migrations...')

  await sql`
    CREATE TABLE IF NOT EXISTS nodes (
      id SERIAL PRIMARY KEY,
      node_id TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'follower',
      state TEXT NOT NULL DEFAULT 'healthy',
      last_heartbeat TIMESTAMP DEFAULT NOW(),
      current_log_index INTEGER NOT NULL DEFAULT 0,
      committed_log_index INTEGER NOT NULL DEFAULT 0
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS kv_store (
      id SERIAL PRIMARY KEY,
      node_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      written_at TIMESTAMP DEFAULT NOW(),
      committed BOOLEAN NOT NULL DEFAULT false
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS wal_log (
      id SERIAL PRIMARY KEY,
      node_id TEXT NOT NULL,
      log_index INTEGER NOT NULL,
      operation TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      term INTEGER NOT NULL DEFAULT 1,
      timestamp TIMESTAMP DEFAULT NOW(),
      replicated_to TEXT[] DEFAULT '{}'
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS quorum_decisions (
      id SERIAL PRIMARY KEY,
      operation_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      required_acks INTEGER NOT NULL DEFAULT 2,
      received_acks INTEGER NOT NULL DEFAULT 0,
      node_votes JSONB NOT NULL DEFAULT '{}',
      decision TEXT NOT NULL DEFAULT 'pending',
      decided_at TIMESTAMP DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS partitions (
      id SERIAL PRIMARY KEY,
      from_node TEXT NOT NULL,
      to_node TEXT NOT NULL,
      injected_at TIMESTAMP DEFAULT NOW(),
      healed_at TIMESTAMP,
      active BOOLEAN NOT NULL DEFAULT true
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS traces (
      id SERIAL PRIMARY KEY,
      operation_id TEXT NOT NULL UNIQUE,
      operation_type TEXT NOT NULL,
      key TEXT NOT NULL,
      started_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending'
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS spans (
      id SERIAL PRIMARY KEY,
      trace_id TEXT NOT NULL,
      span_name TEXT NOT NULL,
      node_id TEXT,
      started_at TIMESTAMP DEFAULT NOW(),
      ended_at TIMESTAMP,
      duration_ms INTEGER,
      metadata JSONB DEFAULT '{}',
      parent_span_id TEXT
    )
  `

  console.log('Migrations complete!')
}

runMigrations().catch(console.error)
