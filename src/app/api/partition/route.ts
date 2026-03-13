import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { injectPartition, healPartition, getActivePartitions } from '@/lib/partition'
import { db } from '@/lib/db'
import { partitions } from '@/lib/schema'
import { desc } from 'drizzle-orm'

const PartitionSchema = z.object({
  from_node: z.string().min(1),
  to_node: z.string().min(1),
  action: z.enum(['inject', 'heal']),
})

export async function GET() {
  try {
    const all = await db.select().from(partitions).orderBy(desc(partitions.injected_at))
    return NextResponse.json({ data: all, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = PartitionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
    }

    const { from_node, to_node, action } = parsed.data

    if (action === 'inject') {
      const result = await injectPartition(from_node, to_node)
      return NextResponse.json({ data: result, error: null })
    } else {
      const result = await healPartition(from_node, to_node)
      return NextResponse.json({ data: result, error: null })
    }
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
