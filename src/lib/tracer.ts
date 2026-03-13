import { db } from './db'
import { traces, spans } from './schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export interface SpanData {
  span_name: string
  node_id?: string
  started_at: Date
  ended_at?: Date
  duration_ms?: number
  metadata?: Record<string, unknown>
  parent_span_id?: string
}

export async function createTrace(operation_type: string, key: string) {
  const operation_id = randomUUID()
  await db.insert(traces).values({
    operation_id,
    operation_type,
    key,
    started_at: new Date(),
    status: 'pending',
  })
  return operation_id
}

export async function addSpan(trace_id: string, span: SpanData) {
  const span_id = randomUUID()
  const duration_ms = span.duration_ms ??
    (span.ended_at && span.started_at
      ? Math.round(span.ended_at.getTime() - span.started_at.getTime())
      : null)

  await db.insert(spans).values({
    trace_id,
    span_name: span.span_name,
    node_id: span.node_id ?? null,
    started_at: span.started_at,
    ended_at: span.ended_at ?? null,
    duration_ms,
    metadata: span.metadata ?? {},
    parent_span_id: span.parent_span_id ?? null,
  })
  return span_id
}

export async function completeTrace(operation_id: string, status: 'success' | 'error') {
  await db.update(traces)
    .set({ completed_at: new Date(), status })
    .where(eq(traces.operation_id, operation_id))
}

export async function measureSpan<T>(
  trace_id: string,
  span_name: string,
  node_id: string | undefined,
  fn: () => Promise<T>,
  parent_span_id?: string
): Promise<{ result: T; span_id: string }> {
  const started_at = new Date()
  try {
    const result = await fn()
    const ended_at = new Date()
    const span_id = await addSpan(trace_id, {
      span_name,
      node_id,
      started_at,
      ended_at,
      duration_ms: ended_at.getTime() - started_at.getTime(),
      metadata: {},
      parent_span_id,
    })
    return { result, span_id }
  } catch (err) {
    const ended_at = new Date()
    await addSpan(trace_id, {
      span_name,
      node_id,
      started_at,
      ended_at,
      duration_ms: ended_at.getTime() - started_at.getTime(),
      metadata: { error: String(err) },
      parent_span_id,
    })
    throw err
  }
}
