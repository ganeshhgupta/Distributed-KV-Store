import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { traces, spans } from '@/lib/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const operation_id = searchParams.get('operation_id')

    if (operation_id) {
      const traceData = await db.select().from(traces).where(eq(traces.operation_id, operation_id))
      if (traceData.length === 0) {
        return NextResponse.json({ data: null, error: 'Trace not found' }, { status: 404 })
      }
      const spansData = await db.select().from(spans)
        .where(eq(spans.trace_id, operation_id))
        .orderBy(spans.started_at)
      return NextResponse.json({ data: { trace: traceData[0], spans: spansData }, error: null })
    }

    const recentTraces = await db.select().from(traces)
      .orderBy(desc(traces.started_at))
      .limit(20)

    return NextResponse.json({ data: recentTraces, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
