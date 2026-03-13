import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { replayWAL } from '@/lib/wal'

const ReplaySchema = z.object({
  node_id: z.string().min(1),
  from_index: z.number().int().min(0),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ReplaySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 })
    }
    const result = await replayWAL(parsed.data.node_id, parsed.data.from_index)
    return NextResponse.json({ data: result, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
