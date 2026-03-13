import { NextRequest, NextResponse } from 'next/server'
import { getAllNodes } from '@/lib/replication'
import { db } from '@/lib/db'
import { kv_store } from '@/lib/schema'
import { eq, count } from 'drizzle-orm'

export async function GET() {
  try {
    const allNodes = await getAllNodes()
    const nodesWithStats = await Promise.all(
      allNodes.map(async (node) => {
        const kvCount = await db.select({ count: count() })
          .from(kv_store)
          .where(eq(kv_store.node_id, node.node_id))
        return { ...node, kv_count: kvCount[0]?.count ?? 0 }
      })
    )
    return NextResponse.json({ data: nodesWithStats, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
