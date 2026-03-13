import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { nodes } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { promoteToLeader } from '@/lib/replication'

const PatchSchema = z.object({
  role: z.enum(['leader', 'follower']).optional(),
  state: z.enum(['healthy', 'partitioned', 'recovering']).optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const nodeData = await db.select().from(nodes).where(eq(nodes.node_id, params.id))
    if (nodeData.length === 0) {
      return NextResponse.json({ data: null, error: 'Node not found' }, { status: 404 })
    }
    return NextResponse.json({ data: nodeData[0], error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
    }

    if (parsed.data.role === 'leader') {
      const result = await promoteToLeader(params.id)
      return NextResponse.json({ data: result[0], error: null })
    }

    const updated = await db.update(nodes)
      .set({ ...parsed.data, last_heartbeat: new Date() })
      .where(eq(nodes.node_id, params.id))
      .returning()

    return NextResponse.json({ data: updated[0], error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
