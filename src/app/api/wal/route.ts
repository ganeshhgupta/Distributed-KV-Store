import { NextRequest, NextResponse } from 'next/server'
import { getWALForNode, getAllWAL } from '@/lib/wal'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const node_id = searchParams.get('node_id')
    const entries = node_id ? await getWALForNode(node_id) : await getAllWAL()
    return NextResponse.json({ data: entries, error: null })
  } catch (err) {
    return NextResponse.json({ data: null, error: String(err) }, { status: 500 })
  }
}
