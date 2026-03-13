import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const nodes = pgTable('nodes', {
  id: serial('id').primaryKey(),
  node_id: text('node_id').notNull().unique(), // n1, n2, n3
  role: text('role').notNull().default('follower'), // leader | follower
  state: text('state').notNull().default('healthy'), // healthy | partitioned | recovering
  last_heartbeat: timestamp('last_heartbeat').defaultNow(),
  current_log_index: integer('current_log_index').notNull().default(0),
  committed_log_index: integer('committed_log_index').notNull().default(0),
})

export const kv_store = pgTable('kv_store', {
  id: serial('id').primaryKey(),
  node_id: text('node_id').notNull(),
  key: text('key').notNull(),
  value: text('value'),
  version: integer('version').notNull().default(1),
  written_at: timestamp('written_at').defaultNow(),
  committed: boolean('committed').notNull().default(false),
})

export const wal_log = pgTable('wal_log', {
  id: serial('id').primaryKey(),
  node_id: text('node_id').notNull(),
  log_index: integer('log_index').notNull(),
  operation: text('operation').notNull(), // put | delete
  key: text('key').notNull(),
  value: text('value'),
  term: integer('term').notNull().default(1),
  timestamp: timestamp('timestamp').defaultNow(),
  replicated_to: text('replicated_to').array().default([]),
})

export const quorum_decisions = pgTable('quorum_decisions', {
  id: serial('id').primaryKey(),
  operation_id: text('operation_id').notNull(),
  key: text('key').notNull(),
  value: text('value'),
  required_acks: integer('required_acks').notNull().default(2),
  received_acks: integer('received_acks').notNull().default(0),
  node_votes: jsonb('node_votes').notNull().default({}),
  decision: text('decision').notNull().default('pending'), // accept | reject | pending
  decided_at: timestamp('decided_at').defaultNow(),
})

export const partitions = pgTable('partitions', {
  id: serial('id').primaryKey(),
  from_node: text('from_node').notNull(),
  to_node: text('to_node').notNull(),
  injected_at: timestamp('injected_at').defaultNow(),
  healed_at: timestamp('healed_at'),
  active: boolean('active').notNull().default(true),
})

export const traces = pgTable('traces', {
  id: serial('id').primaryKey(),
  operation_id: text('operation_id').notNull().unique(),
  operation_type: text('operation_type').notNull(), // put | get | delete
  key: text('key').notNull(),
  started_at: timestamp('started_at').defaultNow(),
  completed_at: timestamp('completed_at'),
  status: text('status').notNull().default('pending'), // success | error | pending
})

export const spans = pgTable('spans', {
  id: serial('id').primaryKey(),
  trace_id: text('trace_id').notNull(),
  span_name: text('span_name').notNull(),
  node_id: text('node_id'),
  started_at: timestamp('started_at').defaultNow(),
  ended_at: timestamp('ended_at'),
  duration_ms: integer('duration_ms'),
  metadata: jsonb('metadata').default({}),
  parent_span_id: text('parent_span_id'),
})

export type Node = typeof nodes.$inferSelect
export type KVStore = typeof kv_store.$inferSelect
export type WalLog = typeof wal_log.$inferSelect
export type QuorumDecision = typeof quorum_decisions.$inferSelect
export type Partition = typeof partitions.$inferSelect
export type Trace = typeof traces.$inferSelect
export type Span = typeof spans.$inferSelect
