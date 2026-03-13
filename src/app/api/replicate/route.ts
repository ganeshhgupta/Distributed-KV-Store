import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { replicateToFollower, getReplicationLag } from '@/lib/replication'

const ReplicateSchema = z.object({
  follower_node_id: z.string().min(1),
})

export async function GET() {
  try {
    const lag = await getReplicationLag()
    return NextResponse.json({ data: lag, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ReplicateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
    }
    const result = await replicateToFollower(parsed.data.follower_node_id)
    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
